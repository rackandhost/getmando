import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { ThemeId, ThemeInfo } from '../../../core/themes/theme.registry';

/** A registry swatch with the id of its theme: one half of a preview. */
export type PreviewSwatch = ThemeInfo['swatch'] & { readonly id: ThemeId };

export const toSwatch = ({ id, swatch }: ThemeInfo): PreviewSwatch => ({ id, ...swatch });

/**
 * A decorative preview of one theme (its swatch) or of several side by side, as `Auto` does with dark
 * and light. It draws registry data, not the active tokens, because it must show themes that are not
 * applied. It carries no text and is hidden from assistive technology; the theme's name and
 * description sit beside it.
 */
@Component({
  selector: 'app-theme-preview',
  template: `
    @for (swatch of swatches(); track swatch.id) {
      <span
        class="flex min-w-0 flex-1 flex-col justify-between p-1.5 group-data-[size=sm]/preview:p-1"
        [attr.data-theme-swatch]="swatch.id"
        [style.background-color]="swatch.bg"
      >
        <span class="h-[3px] w-3/5 rounded-xs" [style.background-color]="swatch.text"></span>
        <span
          class="flex items-center justify-between gap-1 rounded-xs px-1 py-0.5 group-data-[size=md]/preview:py-1.5"
          [style.background-color]="swatch.card"
        >
          <span class="h-[3px] w-1/2 rounded-xs" [style.background-color]="swatch.text"></span>
          <span
            class="size-1.5 shrink-0 rounded-full"
            [style.background-color]="swatch.accent"
          ></span>
        </span>
      </span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    'data-theme-preview': '',
    class:
      'group/preview box-border flex shrink-0 overflow-hidden rounded-[9px] border border-line-strong data-[size=md]:h-16 data-[size=md]:w-full data-[size=sm]:h-[38px] data-[size=sm]:w-14',
    '[attr.data-size]': 'size()',
  },
})
export class ThemePreviewComponent {
  readonly swatches = input.required<readonly PreviewSwatch[]>();
  /** `sm` is the 56 × 38 summary preview, `md` fills a card's width at 64 px high. */
  readonly size = input<'sm' | 'md'>('md');
}
