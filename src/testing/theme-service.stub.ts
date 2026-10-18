import { computed, linkedSignal, signal, type Signal, type WritableSignal } from '@angular/core';
import { vi, type Mock } from 'vitest';

import { themeInfo, type ThemeId, type ThemeInfo } from '../app/core/themes/theme.registry';

/** What the components read from `ThemeService`: the themes in play, its registry entry and its actions. */
export interface ThemeServiceStub {
  /** What is shown: the preview while there is one, else the committed theme. Writable for specs that just need a theme. */
  theme: WritableSignal<ThemeId>;
  committed: WritableSignal<ThemeId>;
  info: Signal<ThemeInfo>;
  select: Mock<(id: ThemeId) => void>;
  preview: Mock<(id: ThemeId) => void>;
  cancelPreview: Mock<() => void>;
  clearPreference: Mock<() => void>;
}

/**
 * A `ThemeService` for component specs, with the same shape of state as the real one: `select` commits
 * (and ends a preview), `preview` shows a theme over the committed one, `cancelPreview` goes back.
 */
export function themeServiceStub(initial: ThemeId = 'dark'): ThemeServiceStub {
  const committed = signal(initial);
  const previewed = signal<ThemeId | undefined>(undefined);
  const theme = linkedSignal(() => previewed() ?? committed());
  return {
    theme,
    committed,
    info: computed(() => themeInfo(theme())),
    select: vi.fn((id: ThemeId) => {
      previewed.set(undefined);
      committed.set(id);
    }),
    preview: vi.fn((id: ThemeId) => previewed.set(id)),
    cancelPreview: vi.fn(() => previewed.set(undefined)),
    clearPreference: vi.fn(),
  };
}
