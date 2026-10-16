import {
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

import { METRICS_SOURCE, type Cancel } from '../../core/scroll/metrics-source';
import type { ChromeMode } from '../../core/scroll/scroll-state';
import {
  ScrollStateService,
  type ChromeHandle,
  type ChromeProbe,
} from '../../core/scroll/scroll-state.service';

/**
 * Turns an element into a sticky chrome driven by the shared scroll state (design.md § 4.1, D9, D13).
 *
 * - `data-dock="static|top|scrolled"` follows the registered chrome's mode; styles key off it.
 * - `--dock-height` is the live height of the host, measured one animation frame after a resize.
 * - While the dock is sticky, the document's `scroll-padding-top` equals that height, so a control
 *   focused or jumped to below the dock is never left underneath it. It is dropped while focus is
 *   inside the dock: the browser would otherwise treat the dock's own controls (the search input's
 *   caret above all) as hidden under that padding and scroll the page up to reveal them.
 */
@Directive({
  selector: '[appStickyDock]',
  exportAs: 'appStickyDock',
  host: {
    '[attr.data-dock]': 'mode()',
    '[style.--dock-height]': 'heightPx()',
    '(focusin)': 'onFocusIn()',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class StickyDockDirective {
  /** How this chrome takes part in the scroll state: name, compaction Δ and viewport guard. */
  readonly probe = input.required<ChromeProbe>({ alias: 'appStickyDock' });

  private readonly scrollState = inject(ScrollStateService);
  private readonly source = inject(METRICS_SOURCE);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly root = inject(DOCUMENT).documentElement;

  private readonly handle = signal<ChromeHandle | null>(null);
  private readonly height = signal<number | null>(null);
  private cancelMeasure: Cancel | null = null;
  private focusInside = false;
  /** The document has one `scroll-padding-top`; with two docks on a page, only the one that set it may clear it. */
  private ownsScrollPadding = false;

  /** The registered chrome's state; `static` until the service says otherwise. */
  readonly mode = computed<ChromeMode>(() => this.handle()?.mode() ?? 'static');
  protected readonly heightPx = computed(() => {
    const height = this.height();
    return height === null ? null : `${height}px`;
  });

  constructor() {
    effect((onCleanup) => {
      const handle = this.scrollState.register(this.probe());
      this.handle.set(handle);
      onCleanup(() => {
        handle.dispose();
        this.handle.set(null);
      });
    });

    effect(() => this.applyScrollPadding());

    // The observer only schedules a frame; the height is read and published in that frame.
    const stopObserving = this.source.observeSize(this.host, () => this.scheduleMeasure());
    this.scheduleMeasure();

    inject(DestroyRef).onDestroy(() => {
      stopObserving();
      this.cancelMeasure?.();
      this.releaseScrollPadding();
    });
  }

  /** Controls inside the dock are already visible; the padding is only for what sits below it. */
  private applyScrollPadding(): void {
    const height = this.height();

    if (this.mode() !== 'static' && height !== null && !this.focusInside) {
      this.root.style.scrollPaddingTop = `${height}px`;
      this.ownsScrollPadding = true;
    } else {
      this.releaseScrollPadding();
    }
  }

  private releaseScrollPadding(): void {
    if (this.ownsScrollPadding) {
      this.root.style.removeProperty('scroll-padding-top');
      this.ownsScrollPadding = false;
    }
  }

  protected onFocusIn(): void {
    this.focusInside = true;
    this.applyScrollPadding();
  }

  /** Focus leaving for something outside restores the padding at once, before the browser reveals it. */
  protected onFocusOut(event: FocusEvent): void {
    if (event.relatedTarget instanceof Node && this.host.contains(event.relatedTarget)) {
      return;
    }

    this.focusInside = false;
    this.applyScrollPadding();
  }

  private scheduleMeasure(): void {
    if (this.cancelMeasure) {
      return;
    }
    this.cancelMeasure = this.source.requestFrame(() => {
      this.cancelMeasure = null;
      this.height.set(Math.ceil(this.host.getBoundingClientRect().height));
    });
  }
}
