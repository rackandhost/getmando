import { computed, signal, type Signal, type WritableSignal } from '@angular/core';
import { vi, type Mock } from 'vitest';

import { THEMES, type ThemeId, type ThemeInfo } from '../app/core/themes/theme.registry';

/** What the components read from `ThemeService`: the active theme, its registry entry and `select`. */
export interface ThemeServiceStub {
  theme: WritableSignal<ThemeId>;
  info: Signal<ThemeInfo>;
  select: Mock<(id: ThemeId) => void>;
}

/** A `ThemeService` for component specs: `select` becomes the active theme, as the real one does. */
export function themeServiceStub(initial: ThemeId = 'dark'): ThemeServiceStub {
  const theme = signal(initial);
  return {
    theme,
    info: computed(() => THEMES.find((entry) => entry.id === theme()) ?? THEMES[0]),
    select: vi.fn((id: ThemeId) => theme.set(id)),
  };
}
