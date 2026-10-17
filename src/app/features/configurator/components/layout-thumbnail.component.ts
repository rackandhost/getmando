import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { DashboardLayout } from '../../../core/models/dashboard.models';

/** The six placeholder cards of a schematic. */
const BLOCKS = [0, 1, 2, 3, 4, 5] as const;

/**
 * A decorative schematic of a dashboard layout: a bar on top (horizontal) or a sidebar on the left
 * (vertical) around a grid of cards. It carries no text and is hidden from assistive technology; the
 * layout's name and description sit beside it.
 */
@Component({
  selector: 'app-layout-thumbnail',
  template: `
    @if (layout() === 'vertical') {
      <span class="flex w-[24%] shrink-0 flex-col items-center rounded-xs bg-line-strong pt-[3px]">
        <span class="h-[9px] w-3/5 rounded-xs bg-accent group-data-[size=sm]/thumb:h-[5px]"></span>
      </span>
    } @else {
      <span
        class="flex h-[9px] shrink-0 items-center justify-center rounded-xs bg-line-strong group-data-[size=sm]/thumb:h-[5px]"
      >
        <span class="h-3/5 w-[30%] rounded-xs bg-accent"></span>
      </span>
    }
    <span class="grid min-h-0 flex-1 grid-cols-3 gap-[5px] group-data-[size=sm]/thumb:gap-[3px]">
      @for (block of blocks; track block) {
        <span class="rounded-xs bg-text/12"></span>
      }
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    'data-layout-thumbnail': '',
    class:
      'group/thumb box-border flex shrink-0 gap-[5px] rounded-[9px] border border-line-strong bg-field p-[7px] data-[layout=horizontal]:flex-col data-[layout=vertical]:flex-row data-[size=md]:h-16 data-[size=md]:w-full data-[size=sm]:h-[38px] data-[size=sm]:w-14 data-[size=sm]:gap-[3px] data-[size=sm]:p-[5px]',
    '[attr.data-layout]': 'layout()',
    '[attr.data-size]': 'size()',
  },
})
export class LayoutThumbnailComponent {
  readonly layout = input.required<DashboardLayout>();
  /** `sm` is the 56 × 38 summary thumbnail, `md` fills a card's width at 64 px high. */
  readonly size = input<'sm' | 'md'>('md');

  protected readonly blocks = BLOCKS;
}
