import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RailStickDirective } from '../../directives/rail-stick.directive';

/*
 * Tailwind reads class names as whole literals from the source text, so none is assembled at runtime.
 * `max-[1024px]` is `width < 1024px` (Tailwind 4 makes `max-[N]` exclusive), the exact complement of
 * `min-[1024px]`: the rail is a column from 1024 px and a bar on every narrower viewport, with no pixel
 * in between. The bar sticks only where the viewport is also tall enough to spare the room.
 */
const WIDE =
  'min-[1024px]:sticky min-[1024px]:top-5 min-[1024px]:h-[calc(100dvh-40px)] min-[1024px]:w-[300px] ' +
  'min-[1024px]:shrink-0 min-[1024px]:self-start min-[1024px]:overflow-y-auto ' +
  'min-[1024px]:[scrollbar-width:none] min-[1024px]:[&::-webkit-scrollbar]:hidden';

const COMPACT =
  'max-[1024px]:flex-row max-[1024px]:flex-wrap max-[1024px]:items-center max-[1024px]:gap-2.5 ' +
  'max-[1024px]:rounded-[20px] max-[1024px]:p-3 ' +
  '[@media(width<1024px)_and_(min-height:500px)]:sticky ' +
  '[@media(width<1024px)_and_(min-height:500px)]:top-[calc(var(--rail-stick,0px)*-1)]';

/**
 * The vertical layout's sidebar: a sticky column from 1024 px, a bar on top of the page below it. It
 * only lays out and frames what it is given; the block marked `data-rail-anchor` is the first one that
 * stays on screen once the compact bar sticks.
 */
@Component({
  selector: 'app-rail',
  imports: [RailStickDirective],
  template: `<aside
    appRailStick
    class="glass-chrome relative z-20 flex flex-col gap-[18px] rounded-3xl p-[18px] ${WIDE} ${COMPACT}"
    [attr.aria-label]="label()"
  >
    <ng-content />
  </aside>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class AppRailComponent {
  /** The landmark's accessible name. */
  readonly label = input.required<string>();
}
