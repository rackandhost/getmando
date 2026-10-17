import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { MetadataService } from '../../../core/services/metadata.service';

/**
 * The rail's brand block: the logo, the dashboard title and its description from the YAML metadata.
 * The title is the page's `h1` unless the page has its own (`asHeading` off). In the compact rail the
 * logo shrinks and the description is hidden.
 */
@Component({
  selector: 'app-rail-brand',
  imports: [NgOptimizedImage],
  template: `<div class="flex min-w-0 items-center gap-3 text-text max-[1023px]:flex-1">
    <img
      alt="getMando"
      class="size-10 shrink-0 rounded-[10px] object-cover max-[1023px]:size-9"
      height="40"
      ngSrc="img/mando.png"
      priority
      width="40"
    />

    <div class="min-w-0">
      @if (asHeading()) {
        <h1 class="truncate text-[17px] leading-tight font-bold tracking-[-0.17px]">
          {{ metadata()?.title || 'Dashboard' }}
        </h1>
      } @else {
        <p class="truncate text-[17px] leading-tight font-bold tracking-[-0.17px]">
          {{ metadata()?.title || 'Dashboard' }}
        </p>
      }

      <p class="truncate text-[13px] leading-tight text-muted max-[1023px]:hidden">
        {{ metadata()?.description || 'Your selfhosted applications' }}
      </p>
    </div>
  </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class AppRailBrandComponent {
  readonly metadata = inject(MetadataService).metadata;

  /** Whether the title is the page's `h1`. */
  readonly asHeading = input(true);
}
