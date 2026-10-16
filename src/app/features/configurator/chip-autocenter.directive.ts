import { Directive, effect, ElementRef, inject, input, untracked } from '@angular/core';

import { METRICS_SOURCE } from '../../core/scroll/metrics-source';

/** How long after the last touch, press or wheel on the bar the user is still considered to be driving it. */
const USER_QUIET_MS = 1_000;

/**
 * `scrollLeft` that puts the middle of a chip in the middle of the bar, kept inside the content.
 * `chip.left` is measured from the start of the scrollable content, not from the viewport.
 */
export function centeredScrollLeft(
  chip: { left: number; width: number },
  clientWidth: number,
  scrollWidth: number,
): number {
  const max = Math.max(0, scrollWidth - clientWidth);
  const target = chip.left + chip.width / 2 - clientWidth / 2;
  return Math.min(max, Math.max(0, target));
}

/**
 * Keeps the active chip of a horizontally scrolling bar in view (spec "Responsive configurator").
 *
 * - Runs once per change of the active key, never because the bar scrolled: it does not listen to `scroll`.
 * - Moves only the bar (`scrollTo` on the host), never the page, so it cannot feed the window scroll that
 *   drives the scroll-spy.
 * - Smooth, instant under `prefers-reduced-motion`.
 * - Stays out of the way while the user touches, presses or wheels the bar and for a second after; the next
 *   change of the active key resumes it.
 *
 * Chips are the host's descendants carrying `data-chip="<key>"`.
 */
@Directive({
  selector: '[appChipAutocenter]',
  host: {
    '(wheel)': 'markUserActive()',
    '(pointerdown)': 'press()',
    '(touchstart)': 'press()',
    '(document:pointerup)': 'release()',
    '(document:pointercancel)': 'release()',
    '(document:touchend)': 'release()',
    '(document:touchcancel)': 'release()',
  },
})
export class ChipAutocenterDirective {
  /** Key of the active chip. */
  readonly activeKey = input.required<string>({ alias: 'appChipAutocenter' });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly source = inject(METRICS_SOURCE);

  private previousKey: string | undefined;
  private pressed = false;
  private quietUntil = 0;

  constructor() {
    effect(() => {
      const key = this.activeKey();
      untracked(() => this.onActiveChange(key));
    });
  }

  protected press(): void {
    this.pressed = true;
  }

  protected release(): void {
    if (!this.pressed) return;
    this.pressed = false;
    this.markUserActive();
  }

  protected markUserActive(): void {
    this.quietUntil = this.source.now() + USER_QUIET_MS;
  }

  private onActiveChange(key: string): void {
    const first = this.previousKey === undefined;
    this.previousKey = key;
    if (first || this.pressed || this.source.now() < this.quietUntil) return;

    const bar = this.host;
    const chip = Array.from(bar.querySelectorAll<HTMLElement>('[data-chip]')).find(
      (element) => element.dataset['chip'] === key,
    );
    if (!chip || bar.scrollWidth <= bar.clientWidth) return;

    const chipBox = chip.getBoundingClientRect();
    const left = centeredScrollLeft(
      {
        left: chipBox.left - bar.getBoundingClientRect().left + bar.scrollLeft,
        width: chipBox.width,
      },
      bar.clientWidth,
      bar.scrollWidth,
    );
    bar.scrollTo({ left, behavior: this.source.prefersReducedMotion() ? 'auto' : 'smooth' });
  }
}
