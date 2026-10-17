import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
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
import { YamlCodecService } from '../../core/services/yaml-codec.service';
import { YamlLoaderService } from '../../core/services/yaml-loader.service';
import { ParseError } from '../../core/services/yaml-parser.service';
import type { ChromeProbe } from '../../core/scroll/scroll-state.service';
import { AppHeaderComponent } from '../../shared/components/app-header/app-header.component';
import {
  AppSegmentedComponent,
  type SegmentedOption,
} from '../../shared/components/app-segmented/app-segmented.component';
import { AppSwitchComponent } from '../../shared/components/app-switch/app-switch.component';
import { HorizontalNavDirective } from '../../shared/directives/horizontal-nav.directive';
import { StickyDockDirective } from '../../shared/directives/sticky-dock.directive';

import {
  CollectionEditEvent,
  CollectionEditorComponent,
} from './components/collection-editor.component';
import { activeSection, activeThreshold } from './active-section';
import { ChipAutocenterDirective } from './chip-autocenter.directive';
import { ConfigSectionComponent, configSectionId } from './components/config-section.component';
import { ConfiguratorStore } from './configurator.store';

type BooleanSetting = Extract<
  keyof DashboardSettings,
  | 'showSeconds'
  | 'showDate'
  | 'allowBookmarks'
  | 'showAllCategory'
  | 'showDescriptions'
  | 'showLabels'
>;

/** Header padding in px at the top of the page and once scrolled (design.md § 4.1, "Configurator"). */
const HEADER_PADDING = { full: 24, compact: 14 } as const;
/** Below this viewport height the header stays Static, as the mobile dock does (design.md § 4.1). */
const HEADER_MIN_VIEWPORT_HEIGHT = 500;

/** Up to this viewport width (px) the layout is one column and the side navigation is a chip bar. */
const NARROW_MAX_WIDTH = 900;
/** Where the chip bar sticks (below the scrolled header), and the air a chip leaves above its section. */
const CHIP_BAR_TOP = 96;
const CHIP_BAR_CLEARANCE = 16;
/** Air the sections keep under the sticky header on a wide page. */
const SECTION_CLEARANCE = 20;

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
    AppHeaderComponent,
    CollectionEditorComponent,
    AppSegmentedComponent,
    AppSwitchComponent,
    ConfigSectionComponent,
    ChipAutocenterDirective,
    HorizontalNavDirective,
    StickyDockDirective,
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

  protected readonly sections = SECTIONS;
  protected readonly headerPadding = HEADER_PADDING;

  /** The sticky header follows the shared scroll state; padding 24 → 14 on both sides loses 20 px. */
  protected readonly probe: ChromeProbe = {
    id: 'configurator-header',
    compactDelta: () => 2 * (HEADER_PADDING.full - HEADER_PADDING.compact),
    minViewportHeight: HEADER_MIN_VIEWPORT_HEIGHT,
  };

  private readonly source = inject(METRICS_SOURCE);
  private readonly dock = viewChild<ElementRef<HTMLElement>>('dockEl');
  private readonly nav = viewChild<ElementRef<HTMLElement>>('navEl');
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
    const positions = SECTIONS.flatMap(({ id, elementId }) => {
      const element = this.document.getElementById(elementId);
      return element ? [{ id, top: element.getBoundingClientRect().top }] : [];
    });
    const narrow = (this.document.defaultView?.innerWidth ?? Infinity) <= NARROW_MAX_WIDTH;
    const bar = narrow ? this.nav()?.nativeElement.getBoundingClientRect() : undefined;
    const stack = this.stackHeight(bar);
    this.sectionMargin.set(this.marginFor(bar));
    const atBottom =
      this.source.viewportHeight() + this.source.scrollY() >= this.source.docHeight() - 4;

    const active = activeSection(positions, activeThreshold(stack, narrow), atBottom);
    if (active) this.activeId.set(active);
  }

  /**
   * Height of what still covers the top of the viewport: the header while it is sticky (none once it has
   * scrolled away) and, on a narrow page, the chip bar once it is stuck under it.
   */
  private stackHeight(bar: DOMRect | undefined): number {
    const header = Math.max(0, this.dock()?.nativeElement.getBoundingClientRect().bottom ?? 0);
    if (bar && bar.top <= CHIP_BAR_TOP + 1) return Math.max(header, bar.bottom);
    return header;
  }

  /**
   * `scroll-margin-top` of the sections. The header's height already is the document's `scroll-padding-top`;
   * on a narrow page the margin adds what the chip bar covers beyond it, so a chip lands its section clear of the bar.
   */
  private marginFor(bar: DOMRect | undefined): number {
    if (!bar) return SECTION_CLEARANCE;

    const padding = parseFloat(this.document.documentElement.style.scrollPaddingTop) || 0;
    return Math.max(SECTION_CLEARANCE, CHIP_BAR_TOP + bar.height + CHIP_BAR_CLEARANCE - padding);
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

  /** Theme and date position: the value comes from a segmented control, already one of its options. */
  protected setSettingChoice(field: 'theme' | 'datePosition', value: string): void {
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

  protected describedBy(path: readonly string[]): string | undefined {
    return this.errorFor(path) ? this.errorId(path) : undefined;
  }

  /** Native `#id` anchor navigation only scrolls the document, not this page's own scroll region. */
  protected jumpToField(path: readonly string[], event: Event): void {
    const target = document.getElementById(this.fieldId(path));
    if (!target) return;

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
    const config = this.store.toDashboardConfig();
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

    const config = this.store.toDashboardConfig();
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
   * app reflects the save immediately instead of only after a manual reload (F5).
   */
  private async refreshLiveConfig(): Promise<void> {
    const result = await firstValueFrom(this.yamlLoader.refreshMountedConfig());
    if (result.status === 'valid') {
      this.appService.initializeConfig(result.config);
    }
  }

  private serializeExportableDraft(): string | undefined {
    const config = this.store.toDashboardConfig();
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
