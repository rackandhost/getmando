import { computed, signal, type Signal, type WritableSignal } from '@angular/core';
import { vi, type Mock } from 'vitest';

import { themeInfo, type ThemeId, type ThemeInfo } from '../app/core/themes/theme.registry';

/** What the components read from `ThemeService`: the active theme, its registry entry and its actions. */
export interface ThemeServiceStub {
  theme: WritableSignal<ThemeId>;
  /** What is applied without a preview. The stub has no preview yet, so it is the active theme. */
  committed: Signal<ThemeId>;
  info: Signal<ThemeInfo>;
  select: Mock<(id: ThemeId) => void>;
  clearPreference: Mock<() => void>;
}

/** A `ThemeService` for component specs: `select` becomes the active theme, as the real one does. */
export function themeServiceStub(initial: ThemeId = 'dark'): ThemeServiceStub {
  const theme = signal(initial);
  return {
    theme,
    committed: theme,
    info: computed(() => themeInfo(theme())),
    select: vi.fn((id: ThemeId) => theme.set(id)),
    clearPreference: vi.fn(),
  };
}
