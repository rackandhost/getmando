import { Directive, ElementRef, inject } from '@angular/core';

const LINE_HEIGHT_PX = 16;

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
 * a plain mouse has only a vertical wheel and the bar hides its scrollbar.
 */
@Directive({
  selector: '[appHorizontalNav]',
  host: { '(wheel)': 'onWheel($event)' },
})
export class HorizontalNavDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

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
