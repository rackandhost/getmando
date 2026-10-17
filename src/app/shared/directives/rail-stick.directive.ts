import { computed, DestroyRef, Directive, ElementRef, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

import { METRICS_SOURCE, type Cancel } from '../../core/scroll/metrics-source';

import { railStickOffset, stuckHeight } from './rail-stick';

/** The rail is a sticky bar only on narrow screens that are tall enough to spare the room. */
const COMPACT_QUERY = '(max-width:1023px) and (min-height:500px)';
/** The rail counts as stuck once it has scrolled this close to its offset (sub-pixel slack). */
const STUCK_TOLERANCE = 1;

/**
 * Makes the compact rail stick with only its anchor block and what follows visible (design.md D7).
 *
 * The host is the rail; the element marked `data-rail-anchor` inside it is the first block that stays
 * on screen. `--rail-stick` is how far the rail may scroll before it sticks, measured one frame after
 * the rail or the anchor change size; the stylesheet turns it into a negative `top`. While the compact
 * rail is stuck, the document's `scroll-padding-top` equals what remains visible of it, so a control
 * focused or jumped to below the rail is not left underneath. Only the directive that set the padding
 * clears it.
 */
@Directive({
  selector: '[appRailStick]',
  host: { '[style.--rail-stick]': 'offsetPx()' },
})
export class RailStickDirective {
  private readonly source = inject(METRICS_SOURCE);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);

  private readonly offset = signal<number | null>(null);
  protected readonly offsetPx = computed(() => {
    const offset = this.offset();
    return offset === null ? null : `${offset}px`;
  });

  /** What stays visible of the rail once stuck; set by the last measurement. */
  private visible = 0;
  private anchor: Element | null = null;
  private stopObservingAnchor: Cancel | null = null;
  private cancelMeasure: Cancel | null = null;
  private ownsScrollPadding = false;
  private compact = false;

  constructor() {
    const stopObservingRail = this.source.observeSize(this.host, () => this.scheduleMeasure());
    const stopScroll = this.source.onScroll(() => this.updateScrollPadding());
    const media = this.document.defaultView?.matchMedia?.(COMPACT_QUERY) ?? null;
    const onMediaChange = () => {
      this.compact = media?.matches ?? false;
      this.updateScrollPadding();
    };
    this.compact = media?.matches ?? false;
    media?.addEventListener('change', onMediaChange);
    this.scheduleMeasure();

    inject(DestroyRef).onDestroy(() => {
      stopObservingRail();
      stopScroll();
      this.stopObservingAnchor?.();
      this.cancelMeasure?.();
      media?.removeEventListener('change', onMediaChange);
      this.releaseScrollPadding();
    });
  }

  private scheduleMeasure(): void {
    if (this.cancelMeasure) {
      return;
    }
    this.cancelMeasure = this.source.requestFrame(() => {
      this.cancelMeasure = null;
      this.measure();
    });
  }

  private measure(): void {
    const rail = this.host.getBoundingClientRect();
    const anchor = this.host.querySelector('[data-rail-anchor]');
    this.observeAnchor(anchor);

    const paddingTop = parseFloat(
      this.document.defaultView?.getComputedStyle(this.host).paddingTop ?? '',
    );
    const measure = {
      railHeight: rail.height,
      anchorTop: anchor ? anchor.getBoundingClientRect().top - rail.top : 0,
      paddingTop: Number.isFinite(paddingTop) ? paddingTop : 0,
    };
    this.offset.set(anchor ? railStickOffset(measure) : 0);
    this.visible = anchor ? stuckHeight(measure) : rail.height;
    this.updateScrollPadding();
  }

  private observeAnchor(anchor: Element | null): void {
    if (anchor === this.anchor) {
      return;
    }
    this.stopObservingAnchor?.();
    this.anchor = anchor;
    this.stopObservingAnchor = anchor
      ? this.source.observeSize(anchor, () => this.scheduleMeasure())
      : null;
  }

  private updateScrollPadding(): void {
    const offset = this.offset();
    const stuck =
      this.compact &&
      offset !== null &&
      this.host.getBoundingClientRect().top <= -offset + STUCK_TOLERANCE;

    if (stuck) {
      this.document.documentElement.style.scrollPaddingTop = `${this.visible}px`;
      this.ownsScrollPadding = true;
    } else {
      this.releaseScrollPadding();
    }
  }

  private releaseScrollPadding(): void {
    if (this.ownsScrollPadding) {
      this.document.documentElement.style.removeProperty('scroll-padding-top');
      this.ownsScrollPadding = false;
    }
  }
}
