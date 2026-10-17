import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowDownTray,
  heroArrowUpTray,
  heroCheck,
  heroClipboardDocument,
  heroDocument,
  heroServerStack,
} from '@ng-icons/heroicons/outline';
import { firstValueFrom } from 'rxjs';

import {
  Bookmark,
  Category,
  DashboardConfig,
  DashboardMetadata,
  DashboardSettings,
  SelfhostedApp,
} from '../../core/models/dashboard.models';
import { METRICS_SOURCE, type Cancel } from '../../core/scroll/metrics-source';
import { AppService } from '../../core/services/app.service';
import { ConfigExportService } from '../../core/services/config-export.service';
import { ConfigWriteService } from '../../core/services/config-write.service';
import { NotificationService } from '../../core/services/notification.service';
import { SettingsService } from '../../core/services/settings.service';
import { YamlCodecService } from '../../core/services/yaml-codec.service';
import { YamlLoaderService } from '../../core/services/yaml-loader.service';
import { ParseError } from '../../core/services/yaml-parser.service';
import {
  AppSegmentedComponent,
  type SegmentedOption,
} from '../../shared/components/app-segmented/app-segmented.component';
import { AppSwitchComponent } from '../../shared/components/app-switch/app-switch.component';

import {
  CollectionEditEvent,
  CollectionEditorComponent,
} from './components/collection-editor.component';
import { activeSection, activeThreshold } from './active-section';
import { ConfigSectionComponent, configSectionId } from './components/config-section.component';
import { ConfiguratorStore } from './configurator.store';
import { LayoutPickerComponent } from './components/layout-picker.component';
import { ConfiguratorHorizontalChromeComponent } from './chrome/configurator-horizontal-chrome.component';
import { ConfiguratorVerticalChromeComponent } from './chrome/configurator-vertical-chrome.component';
import {
  ConfiguratorChrome,
  SECTION_CLEARANCE,
  type ConfiguratorSection,
} from './configurator-chrome';

/** Where the user is: the section the navigation marks, its distance from the top of the viewport, and whether the page was scrolled to its end. */
interface PlaceInView {
  readonly elementId: string;
  readonly top: number;
  readonly atBottom: boolean;
}

/** Frames in a row that what the new arrangement sticks over the top must hold still before it counts as settled. */
const SETTLED_FRAMES = 4;
/** How long to wait for that: a header that compacts takes about 0.3 s. */
const SETTLE_TIMEOUT_MS = 1000;

type BooleanSetting = Extract<
  keyof DashboardSettings,
  | 'showSeconds'
  | 'showDate'
  | 'allowBookmarks'
  | 'showAllCategory'
  | 'showDescriptions'
  | 'showLabels'
>;

const SECTIONS = [
  { id: 'start', label: 'Starting point' },
  { id: 'metadata', label: 'Metadata' },
  { id: 'settings', label: 'Settings' },
  { id: 'categories', label: 'Categories' },
  { id: 'applications', label: 'Applications' },
  { id: 'bookmarks', label: 'Bookmarks' },
  { id: 'export', label: 'Export' },
].map((section, index) => ({
  ...section,
  number: String(index + 1).padStart(2, '0'),
  elementId: configSectionId(section.id),
}));

@Component({
  selector: 'app-configurator-page',
  imports: [
    NgIcon,
    CollectionEditorComponent,
    AppSegmentedComponent,
    LayoutPickerComponent,
    AppSwitchComponent,
    ConfigSectionComponent,
    ConfiguratorHorizontalChromeComponent,
    ConfiguratorVerticalChromeComponent,
  ],
  viewProviders: [
    provideIcons({
      heroArrowDownTray,
      heroArrowUpTray,
      heroCheck,
      heroClipboardDocument,
      heroDocument,
      heroServerStack,
    }),
  ],
  templateUrl: 'configurator-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class ConfiguratorPageComponent {
  protected readonly store = inject(ConfiguratorStore);
  private readonly appService = inject(AppService);
  private readonly configExport = inject(ConfigExportService);
  private readonly configWrite = inject(ConfigWriteService);
  private readonly notifications = inject(NotificationService);
  private readonly yamlCodec = inject(YamlCodecService);
  private readonly yamlLoader = inject(YamlLoaderService);
  private readonly document = inject(DOCUMENT);

  /** The arrangement follows the active configuration; the draft's layout is only data until it is saved. */
  protected readonly layout = inject(SettingsService).layout;

  /** `false` only when the server says it has no write token; until it answers (or if it cannot), Save stays available. */
  protected readonly writeEnabled = toSignal(this.configWrite.isWriteEnabled(), {
    initialValue: true,
  });

  /** The sections as the navigation lists them, each with a link that stays on this page. */
  protected readonly sectionLinks: readonly ConfiguratorSection[] = SECTIONS.map((section) => ({
    ...section,
    href: this.anchorHref(section.elementId),
  }));

  private readonly source = inject(METRICS_SOURCE);
  private readonly injector = inject(Injector);
  private readonly errorSummary = viewChild<ElementRef<HTMLElement>>('errorSummary');
  /** The arrangement around the page (header and side navigation, or the rail); it answers the scroll-spy's metrics. */
  private readonly chrome = viewChild(ConfiguratorChrome);
  /** Space (px) the sections keep under the sticky stack when scrolled to; bound to `--section-margin`. */
  protected readonly sectionMargin = signal(SECTION_CLEARANCE);
  private cancelFrame: Cancel | null = null;

  /** The section the side navigation marks as current (`id` of `sections`). */
  protected readonly activeId = signal(SECTIONS[0].id);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const stops = [
        this.source.onScroll(() => this.scheduleSpy()),
        this.source.onLayoutChange(() => this.scheduleSpy()),
      ];
      this.scheduleSpy();

      destroyRef.onDestroy(() => {
        stops.forEach((stop) => stop());
        this.cancelFrame?.();
      });
    });
  }

  /** Scroll and layout events only schedule a frame; the measurement happens in it. */
  private scheduleSpy(): void {
    if (this.cancelFrame) return;

    this.cancelFrame = this.source.requestFrame(() => {
      this.cancelFrame = null;
      this.updateActiveSection();
    });
  }

  private updateActiveSection(): void {
    const chrome = this.chrome();
    if (!chrome) return;

    const positions = SECTIONS.flatMap(({ id, elementId }) => {
      const element = this.document.getElementById(elementId);
      return element ? [{ id, top: element.getBoundingClientRect().top }] : [];
    });
    const narrow = chrome.narrow();
    const stack = chrome.stackHeight();
    this.sectionMargin.set(chrome.sectionMargin());
    const atBottom = this.isAtBottom();

    const active = activeSection(positions, activeThreshold(stack, narrow), atBottom);
    if (active) this.activeId.set(active);
  }

  protected readonly draft = this.store.draft;
  protected readonly validationErrors = this.store.validationErrors;
  protected readonly startingPoint = this.store.source;
  protected readonly mountedPath = this.yamlLoader.mountedPath;
  /** Export actions (mockup `config-5-export`): 44 px, radius 10; secondary on `--surface-2`, primary on `--accent`. */
  protected readonly secondaryActionClass =
    'flex h-11 items-center gap-2 rounded-[10px] border border-line-strong bg-surface-2 px-4 text-sm font-medium text-text transition-colors duration-200 hover:bg-line disabled:cursor-not-allowed disabled:opacity-60';
  protected readonly primaryActionClass =
    'flex h-11 items-center gap-2 rounded-[10px] bg-accent text-sm font-semibold text-accent-ink transition-[filter] duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60';
  protected readonly isSavingToServer = signal(false);
  protected readonly showTokenPrompt = signal(false);
  protected readonly pendingToken = signal('');
  protected readonly searchEngineOptions: readonly DashboardSettings['searchEngines'][number][] = [
    'google',
    'duckduckgo',
    'startpage',
    'youtube',
  ];
  protected readonly displayOptions: readonly {
    readonly field: BooleanSetting;
    readonly label: string;
  }[] = [
    { field: 'showSeconds', label: 'Show seconds' },
    { field: 'showDate', label: 'Show date' },
    { field: 'allowBookmarks', label: 'Allow bookmarks' },
    { field: 'showAllCategory', label: 'Show “Apps” category' },
    { field: 'showDescriptions', label: 'Show descriptions' },
    { field: 'showLabels', label: 'Show labels' },
  ];
  protected readonly searchEngineLabels: Record<
    DashboardSettings['searchEngines'][number],
    string
  > = {
    google: 'Google',
    duckduckgo: 'DuckDuckGo',
    startpage: 'Startpage',
    youtube: 'YouTube',
  };
  protected readonly themeOptions: readonly SegmentedOption[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'auto', label: 'Auto' },
  ];
  protected readonly datePositionOptions: readonly SegmentedOption[] = [
    { value: 'top', label: 'Top' },
    { value: 'bottom', label: 'Bottom' },
  ];

  protected startEmpty(): void {
    this.store.startEmpty();
  }

  protected canLoadMountedConfig(): boolean {
    return this.store.canLoadMountedConfig();
  }

  /** `applications[6].category` for `['applications', '6', 'category']`; empty when the error has no field. */
  protected formatPath(path: readonly string[]): string {
    return path.reduce(
      (formatted, segment) =>
        /^\d+$/.test(segment)
          ? `${formatted}[${segment}]`
          : formatted
            ? `${formatted}.${segment}`
            : segment,
      '',
    );
  }

  protected loadMountedConfig(): void {
    this.store.loadMountedConfig();
  }

  protected async importLocalYaml(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.store.importLocalYaml(await this.readFileText(file));
    input.value = '';
  }

  protected updateMetadata(field: keyof DashboardMetadata, event: Event): void {
    this.store.updateMetadata({ [field]: this.inputValue(event) });
  }

  protected updateSettingText(field: keyof DashboardSettings, event: Event): void {
    this.store.updateSettings({ [field]: this.inputValue(event) } as Partial<DashboardSettings>);
  }

  protected updateSettingNumber(field: keyof DashboardSettings, event: Event): void {
    this.store.updateSettings({
      [field]: Number(this.inputValue(event)),
    } as Partial<DashboardSettings>);
  }

  protected setSettingBoolean(field: BooleanSetting, checked: boolean): void {
    this.store.updateSettings({ [field]: checked } as Partial<DashboardSettings>);
  }

  /** Theme, date position and layout: the value comes from a choice control, already one of its options. */
  protected setSettingChoice(field: 'theme' | 'datePosition' | 'layout', value: string): void {
    this.store.updateSettings({ [field]: value } as Partial<DashboardSettings>);
  }

  protected setSearchEngine(
    engine: DashboardSettings['searchEngines'][number],
    enabled: boolean,
  ): void {
    const current = this.draft().settings.searchEngines;
    const searchEngines = enabled
      ? [...new Set([...current, engine])]
      : current.filter((candidate) => candidate !== engine);

    this.store.updateSettings({ searchEngines });
  }

  protected hasSearchEngine(engine: DashboardSettings['searchEngines'][number]): boolean {
    return this.draft().settings.searchEngines.includes(engine);
  }

  protected isSettingEnabled(field: BooleanSetting): boolean {
    return this.draft().settings[field];
  }

  protected errorId(path: readonly string[]): string {
    return `error-${path.join('-')}`;
  }

  protected fieldId(path: readonly string[]): string {
    if (path[0] === 'settings' && path[1] === 'searchEngines')
      return 'field-settings-searchEngines';
    return `field-${path.join('-')}`;
  }

  /** The ids that describe a field: its error when it has one, then any `also` ids (a hint). */
  protected describedBy(path: readonly string[], ...also: string[]): string | undefined {
    const ids = this.errorFor(path) ? [this.errorId(path), ...also] : also;
    return ids.length > 0 ? ids.join(' ') : undefined;
  }

  /** The page's own path in front of an anchor: a bare `#id` resolves against `<base href>` and points at the app root. */
  protected anchorHref(elementId: string): string {
    return `${this.document.location.pathname}#${elementId}`;
  }

  /**
   * Native `#id` anchor navigation only scrolls the document, not this page's own scroll region. A field
   * that is not rendered (an empty collection has no rows) takes the user to its section instead of
   * letting the click navigate.
   */
  protected jumpToField(path: readonly string[], event: Event): void {
    const target = this.document.getElementById(this.fieldId(path));
    if (!target) {
      if (path[0]) this.goToSection(`section-${path[0]}`, event);
      else event.preventDefault();
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ block: 'center' });
    target.focus();
  }

  /**
   * Scrolls a section below the sticky header (the dock's `scroll-padding-top`) and moves focus to its
   * heading. A bare `#id` href would resolve against `<base href>` and leave the page.
   */
  protected goToSection(elementId: string, event: Event): void {
    event.preventDefault();
    this.document.getElementById(elementId)?.scrollIntoView({ block: 'start' });
    this.document.getElementById(`${elementId}-heading`)?.focus({ preventScroll: true });
  }

  protected errorFor(path: readonly string[]): string | undefined {
    return this.validationErrors().find((error) => error.path.join('.') === path.join('.'))
      ?.message;
  }

  protected collectionErrorIds(
    collection: 'categories' | 'applications' | 'bookmarks',
  ): Readonly<Record<string, string>> {
    return this.collectionErrorEntries(collection, (error) => this.errorId(error.path));
  }

  protected collectionErrors(
    collection: 'categories' | 'applications' | 'bookmarks',
  ): Readonly<Record<string, string>> {
    return this.collectionErrorEntries(collection, (error) => error.message);
  }

  private collectionErrorEntries(
    collection: 'categories' | 'applications' | 'bookmarks',
    valueFor: (error: ParseError) => string,
  ): Readonly<Record<string, string>> {
    return Object.fromEntries(
      this.validationErrors()
        .filter((error) => error.path[0] === collection && error.path.length >= 3)
        .map((error) => [`${error.path[1]}-${error.path.slice(2).join('-')}`, valueFor(error)]),
    );
  }

  protected addCategory(): void {
    this.store.addCategory();
  }

  protected addApplication(): void {
    this.store.addApplication();
  }

  protected addBookmark(): void {
    this.store.addBookmark();
  }

  protected updateCategory(event: CollectionEditEvent): void {
    if (event.field === 'icon') return;

    if (event.field === 'id' || event.field === 'name') {
      this.store.updateCategory(event.index, { [event.field]: event.value } as Partial<Category>);
    }
  }

  protected updateApplication(event: CollectionEditEvent): void {
    if (event.field === 'icon') {
      this.store.updateApplication(event.index, { icon: event.value });
      return;
    }

    this.store.updateApplication(event.index, {
      [event.field]: event.value,
    } as Partial<SelfhostedApp>);
  }

  protected updateBookmark(event: CollectionEditEvent): void {
    if (event.field === 'category' || event.field === 'favorite') return;

    if (event.field === 'icon') {
      this.store.updateBookmark(event.index, { icon: event.value });
      return;
    }

    this.store.updateBookmark(event.index, { [event.field]: event.value } as Partial<Bookmark>);
  }

  protected async copyYaml(): Promise<void> {
    const yaml = this.serializeExportableDraft();
    if (!yaml) return;

    await this.configExport.copy(yaml);
  }

  protected downloadYaml(): void {
    const yaml = this.serializeExportableDraft();
    if (!yaml) return;

    this.configExport.download(yaml);
  }

  protected async saveToServer(): Promise<void> {
    const config = this.exportableConfig();
    if (!config) return;

    if (!this.configWrite.hasToken()) {
      this.showTokenPrompt.set(true);
      return;
    }

    await this.performSave(config);
  }

  protected async confirmToken(): Promise<void> {
    const token = this.pendingToken().trim();
    if (!token) return;

    this.configWrite.setToken(token);
    this.pendingToken.set('');
    this.showTokenPrompt.set(false);

    const config = this.exportableConfig();
    if (!config) return;

    await this.performSave(config);
  }

  protected cancelTokenPrompt(): void {
    this.showTokenPrompt.set(false);
    this.pendingToken.set('');
  }

  protected updatePendingToken(event: Event): void {
    this.pendingToken.set(this.inputValue(event));
  }

  private async performSave(config: DashboardConfig): Promise<void> {
    this.isSavingToServer.set(true);
    const result = await firstValueFrom(this.configWrite.save(config));
    this.isSavingToServer.set(false);

    if (result.status === 'saved') {
      this.store.markSaved();
      this.notifications.success('Configuration saved to the server.');
      await this.refreshLiveConfig();
      return;
    }

    if (result.status === 'invalid') {
      this.store.reportServerValidationErrors(result.errors);
      this.revealErrors();
      this.notifications.error('The server rejected the configuration. Check the errors below.');
      return;
    }

    if (result.status === 'unauthorized') {
      this.showTokenPrompt.set(true);
    }

    this.notifications.error(result.message);
  }

  /**
   * Re-fetches the just-saved YAML and pushes it into the live dashboard state, so the running
   * app reflects the save immediately instead of only after a manual reload (F5). When that changes the
   * layout the page draws its sections again inside the other chrome, so where the user was and the Save
   * button they pressed are put back once it has.
   */
  private async refreshLiveConfig(): Promise<void> {
    const result = await firstValueFrom(this.yamlLoader.refreshMountedConfig());
    if (result.status !== 'valid') return;

    if (result.config.settings.layout === this.layout()) {
      this.appService.initializeConfig(result.config);
      return;
    }

    const place = this.placeInView();
    this.appService.initializeConfig(result.config);
    afterNextRender(() => this.restorePlace(place), { injector: this.injector });
  }

  /** Whether the page is scrolled to its very end. */
  private isAtBottom(): boolean {
    return this.source.viewportHeight() + this.source.scrollY() >= this.source.docHeight() - 4;
  }

  /** The section the navigation marks as current, how far below the top of the viewport it is, and whether the page is at its end. */
  private placeInView(): PlaceInView | undefined {
    const elementId = SECTIONS.find((section) => section.id === this.activeId())?.elementId;
    const element = elementId ? this.document.getElementById(elementId) : null;
    if (!elementId || !element) return undefined;

    return { elementId, top: element.getBoundingClientRect().top, atBottom: this.isAtBottom() };
  }

  /**
   * Puts the user back where they were, instantly (a swap is not a movement to animate): at the end of the
   * page if they were there, otherwise the section as far from the top as before, which is then kept
   * below whatever the new arrangement sticks over the top once that has settled. Then focuses Save
   * without scrolling again.
   */
  private restorePlace(place: PlaceInView | undefined): void {
    const view = this.document.defaultView;
    const element = place ? this.document.getElementById(place.elementId) : null;

    if (place?.atBottom) {
      view?.scrollTo({ top: this.source.docHeight(), behavior: 'instant' });
    } else if (place && element) {
      view?.scrollBy({ top: element.getBoundingClientRect().top - place.top, behavior: 'instant' });
      this.keepBelowStack(place.elementId);
    }

    this.document.getElementById('configurator-save')?.focus({ preventScroll: true });
  }

  /**
   * A header or bar that has just rendered is not stuck yet, and is not at its final height: it registers
   * with the scroll state a frame later and then compacts. Waits for what it sticks over the top to hold
   * still, then brings the section below it if it ended up underneath, as a click on its navigation item
   * would. Gives up when the user scrolls meanwhile, or after a second.
   */
  private keepBelowStack(elementId: string): void {
    const scrollY = this.source.scrollY();
    const deadline = this.source.now() + SETTLE_TIMEOUT_MS;
    let stackHeight = Number.NaN;
    let stillFrames = 0;

    const check = () => {
      if (this.source.scrollY() !== scrollY) return;

      const height = this.chrome()?.stackHeight() ?? 0;
      stillFrames = height === stackHeight ? stillFrames + 1 : 0;
      stackHeight = height;
      if (stillFrames < SETTLED_FRAMES && this.source.now() < deadline) {
        this.source.requestFrame(check);
        return;
      }

      const element = this.document.getElementById(elementId);
      if (element && element.getBoundingClientRect().top < height) {
        element.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    };
    this.source.requestFrame(check);
  }

  /** The validated draft, or `undefined` after bringing the error summary into view. */
  private exportableConfig(): DashboardConfig | undefined {
    const config = this.store.toDashboardConfig();
    if (!config) this.revealErrors();
    return config;
  }

  /**
   * The summary sits at the top of the page, far from Export and Save: once it has rendered, scroll to it so
   * a rejected action is not mistaken for one that did nothing.
   */
  private revealErrors(): void {
    afterNextRender(() => this.errorSummary()?.nativeElement.scrollIntoView({ block: 'start' }), {
      injector: this.injector,
    });
  }

  private serializeExportableDraft(): string | undefined {
    const config = this.exportableConfig();
    return config ? this.yamlCodec.serialize(config) : undefined;
  }

  private readFileText(file: File): Promise<string> {
    if ('text' in file && typeof file.text === 'function') return file.text();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
      reader.addEventListener('error', () =>
        reject(reader.error ?? new Error('Unable to read file.')),
      );
      reader.readAsText(file);
    });
  }

  private inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }
}
