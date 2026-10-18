import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroCheck, heroChevronDown, heroMagnifyingGlass } from '@ng-icons/heroicons/outline';

import {
  THEMES,
  type ThemeId,
  type ThemeInfo,
  type ThemeSetting,
} from '../../../core/themes/theme.registry';

import { type PreviewSwatch, ThemePreviewComponent } from './theme-preview.component';

interface ThemeOption {
  readonly value: ThemeSetting;
  readonly name: string;
  readonly description: string;
  /** One swatch for a theme; `Auto` shows two, dark and light, side by side. */
  readonly swatches: readonly PreviewSwatch[];
}

const toSwatch = ({ id, swatch }: ThemeInfo): PreviewSwatch => ({ id, ...swatch });
const themeInfo = (id: ThemeId): ThemeInfo => THEMES.find((theme) => theme.id === id) ?? THEMES[0];

/** `Auto` first, then the registry in order: the options are derived, never listed here. */
const OPTIONS: readonly ThemeOption[] = [
  {
    value: 'auto',
    name: 'Auto',
    description: 'Follows the system: Light or Dark',
    swatches: [toSwatch(themeInfo('dark')), toSwatch(themeInfo('light'))],
  },
  ...THEMES.map((theme): ThemeOption => ({
    value: theme.id,
    name: theme.name,
    description: theme.description,
    swatches: [toSwatch(theme)],
  })),
];

let nextId = 0;

/**
 * The Default theme control of the Settings section: a disclosure whose summary shows the chosen
 * option and, opened (it starts closed, to take the least room), a filter and a radio group of one
 * preview card per option. It does not hold the value: the owner passes `value` and updates it from
 * `valueChange`. Opening, closing and filtering are local state and never change the value. It edits
 * the installation default (`settings.theme`), not the device preference of the theme picker.
 */
@Component({
  selector: 'app-default-theme-picker',
  imports: [NgIcon, ThemePreviewComponent],
  templateUrl: 'default-theme-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ heroCheck, heroChevronDown, heroMagnifyingGlass })],
  host: { class: 'flex min-w-0 flex-col gap-2' },
})
export class DefaultThemePickerComponent {
  readonly value = input.required<ThemeSetting>();
  readonly valueChange = output<ThemeSetting>();

  protected readonly optionCount = OPTIONS.length;
  protected readonly open = signal(false);
  protected readonly filter = signal('');
  protected readonly current = computed(
    () => OPTIONS.find((option) => option.value === this.value()) ?? OPTIONS[0],
  );
  /** Case-insensitive substring over name and description. */
  protected readonly shown = computed(() => {
    const query = this.filter().trim().toLowerCase();
    return OPTIONS.filter((option) =>
      `${option.name} ${option.description}`.toLowerCase().includes(query),
    );
  });

  private readonly id = nextId++;
  protected readonly labelId = `default-theme-picker-label-${this.id}`;
  protected readonly panelId = `default-theme-picker-panel-${this.id}`;
  /** One native radio group, so the arrow keys move and select and Tab passes through once. */
  protected readonly groupName = `default-theme-picker-${this.id}`;

  protected optionId(option: ThemeOption, part: 'name' | 'description'): string {
    return `${this.groupName}-${option.value}-${part}`;
  }

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  protected setFilter(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
  }

  protected choose(value: ThemeSetting): void {
    if (value !== this.value()) this.valueChange.emit(value);
  }
}
