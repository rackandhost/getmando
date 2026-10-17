import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RailStickDirective } from '../../directives/rail-stick.directive';

/*
 * Tailwind reads class names as whole literals from the source text, so none is assembled at runtime.
 * The compact bar sticks only on viewports that are narrow and tall enough to spare the room.
 */
const WIDE =
  'min-[1024px]:sticky min-[1024px]:top-5 min-[1024px]:h-[calc(100dvh-40px)] min-[1024px]:w-[300px] ' +
  'min-[1024px]:shrink-0 min-[1024px]:self-start min-[1024px]:overflow-y-auto ' +
  'min-[1024px]:[scrollbar-width:none] min-[1024px]:[&::-webkit-scrollbar]:hidden';

const COMPACT =
  'max-[1023px]:flex-row max-[1023px]:flex-wrap max-[1023px]:items-center max-[1023px]:gap-2.5 ' +
  'max-[1023px]:rounded-[20px] max-[1023px]:p-3 ' +
  '[@media(max-width:1023px)_and_(min-height:500px)]:sticky ' +
  '[@media(max-width:1023px)_and_(min-height:500px)]:top-[calc(var(--rail-stick,0px)*-1)]';

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
