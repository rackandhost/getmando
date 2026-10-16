import { afterNextRender, DestroyRef, Directive, ElementRef, inject, signal } from '@angular/core';

const LINE_HEIGHT_PX = 16;
/** Sub-pixel scroll positions near an end count as the end. */
const EDGE_TOLERANCE_PX = 1;

/** Which edges of the bar still hide content: the side to fade, never a side with nothing beyond it. */
export type EdgeFade = 'none' | 'start' | 'end' | 'both';

export function edgeFade(scrollLeft: number, maxScrollLeft: number): EdgeFade {
  if (maxScrollLeft <= EDGE_TOLERANCE_PX) return 'none';

  const start = scrollLeft > EDGE_TOLERANCE_PX;
  const end = scrollLeft < maxScrollLeft - EDGE_TOLERANCE_PX;
  return start && end ? 'both' : start ? 'start' : end ? 'end' : 'none';
}

export interface WheelLike {
  readonly deltaX: number;
  readonly deltaY: number;
  /** `WheelEvent.deltaMode`: 0 pixels, 1 lines, 2 pages. */
  readonly deltaMode: number;
}

export interface ScrollState {
  readonly scrollLeft: number;
  readonly maxScrollLeft: number;
  /** Visible width of the scroller, the pixel size of one wheel "page". */
  readonly pageSize: number;
}

/**
 * Pixels to add to `scrollLeft` for a wheel event, or `null` when the browser should keep its default:
 * nothing overflows, the wheel is already horizontal (trackpads), or the end in that direction is reached
 * (so the page can scroll on).
 */
export function wheelScrollDelta(wheel: WheelLike, state: ScrollState): number | null {
  if (state.maxScrollLeft <= 0 || Math.abs(wheel.deltaX) >= Math.abs(wheel.deltaY)) return null;

  const scale = wheel.deltaMode === 1 ? LINE_HEIGHT_PX : wheel.deltaMode === 2 ? state.pageSize : 1;
  const delta = wheel.deltaY * scale;

  if (delta < 0 && state.scrollLeft <= 0) return null;
  if (delta > 0 && state.scrollLeft >= state.maxScrollLeft) return null;

  return delta;
}

/**
 * Lets a mouse wheel scroll a horizontally overflowing bar sideways. Touch and trackpads already scroll it;
 * a plain mouse has only a vertical wheel and the bar hides its scrollbar. `data-fade` tells which edges
 * overflow (`none | start | end | both`) so a mask can fade only those.
 */
@Directive({
  selector: '[appHorizontalNav]',
  host: {
    '(wheel)': 'onWheel($event)',
    '(scroll)': 'measure()',
    '[attr.data-fade]': 'fade()',
  },
})
export class HorizontalNavDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly fade = signal<EdgeFade>('none');

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      this.measure();
      if (typeof ResizeObserver !== 'function') return;

      const observer = new ResizeObserver(() => this.measure());
      observer.observe(this.host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected measure(): void {
    const { scrollLeft, scrollWidth, clientWidth } = this.host;
    this.fade.set(edgeFade(scrollLeft, scrollWidth - clientWidth));
  }

  protected onWheel(event: WheelEvent): void {
    if (event.ctrlKey) return;

    const { scrollLeft, scrollWidth, clientWidth } = this.host;
    const delta = wheelScrollDelta(event, {
      scrollLeft,
      maxScrollLeft: scrollWidth - clientWidth,
      pageSize: clientWidth,
    });

    if (delta === null) return;

    event.preventDefault();
    this.host.scrollLeft = scrollLeft + delta;
  }
}
