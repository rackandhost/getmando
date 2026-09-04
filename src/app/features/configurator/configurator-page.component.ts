import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import {
  Bookmark,
  Category,
  DashboardConfig,
  DashboardMetadata,
  DashboardSettings,
  SelfhostedApp,
} from '../../core/models/dashboard.models';
import { ConfigExportService } from '../../core/services/config-export.service';
import { YamlCodecService } from '../../core/services/yaml-codec.service';
import { ParseError } from '../../core/services/yaml-parser.service';

import {
  CollectionEditEvent,
  CollectionEditorComponent,
} from './components/collection-editor.component';
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

@Component({
  selector: 'app-configurator-page',
  imports: [CollectionEditorComponent],
  templateUrl: 'configurator-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class ConfiguratorPageComponent {
  protected readonly store = inject(ConfiguratorStore);
  private readonly configExport = inject(ConfigExportService);
  private readonly yamlCodec = inject(YamlCodecService);

  protected readonly draft = this.store.draft;
  protected readonly validationErrors = this.store.validationErrors;
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
    { field: 'showAllCategory', label: 'Show all category' },
    { field: 'showDescriptions', label: 'Show descriptions' },
    { field: 'showLabels', label: 'Show labels' },
  ];

  protected startEmpty(): void {
    this.store.startEmpty();
  }

  protected canLoadMountedConfig(): boolean {
    return this.store.canLoadMountedConfig();
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

  protected updateSettingBoolean(field: BooleanSetting, event: Event): void {
    this.store.updateSettings({
      [field]: (event.target as HTMLInputElement).checked,
    } as Partial<DashboardSettings>);
  }

  protected updateSearchEngines(
    engine: DashboardSettings['searchEngines'][number],
    event: Event,
  ): void {
    const enabled = (event.target as HTMLInputElement).checked;
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

  private serializeExportableDraft(): string | undefined {
    const config = this.store.toDashboardConfig();
    if (config) return this.yamlCodec.serialize(config);
    if (!this.store.validate()) return undefined;

    return this.yamlCodec.serialize(this.draft() as DashboardConfig);
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
