import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  Bookmark,
  Category,
  DashboardConfig,
  DashboardMetadata,
  DashboardSettings,
  SelfhostedApp,
} from '../../core/models/dashboard.models';
import { AppService } from '../../core/services/app.service';
import { ConfigExportService } from '../../core/services/config-export.service';
import { ConfigWriteService } from '../../core/services/config-write.service';
import { NotificationService } from '../../core/services/notification.service';
import { YamlCodecService } from '../../core/services/yaml-codec.service';
import { YamlLoaderService } from '../../core/services/yaml-loader.service';
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
  private readonly appService = inject(AppService);
  private readonly configExport = inject(ConfigExportService);
  private readonly configWrite = inject(ConfigWriteService);
  private readonly notifications = inject(NotificationService);
  private readonly yamlCodec = inject(YamlCodecService);
  private readonly yamlLoader = inject(YamlLoaderService);

  protected readonly draft = this.store.draft;
  protected readonly validationErrors = this.store.validationErrors;
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
