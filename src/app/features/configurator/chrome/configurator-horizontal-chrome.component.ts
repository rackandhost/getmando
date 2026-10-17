import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  TemplateRef,
  viewChild,
} from '@angular/core';

import type { ChromeProbe } from '../../../core/scroll/scroll-state.service';
import { AppHeaderComponent } from '../../../shared/components/app-header/app-header.component';
import { ChipAutocenterDirective } from '../../../shared/directives/chip-autocenter.directive';
import { HorizontalNavDirective } from '../../../shared/directives/horizontal-nav.directive';
import { StickyDockDirective } from '../../../shared/directives/sticky-dock.directive';
import {
  ConfiguratorChrome,
  SECTION_CLEARANCE,
  type ConfiguratorSection,
  type SectionSelection,
} from '../configurator-chrome';

/** Header padding in px at the top of the page and once scrolled (design.md § 4.1, "Configurator"). */
const HEADER_PADDING = { full: 24, compact: 14 } as const;
/** Below this viewport height the header stays Static, as the mobile dock does (design.md § 4.1). */
const HEADER_MIN_VIEWPORT_HEIGHT = 500;

/** Up to this viewport width (px) the layout is one column and the side navigation is a chip bar. */
const NARROW_MAX_WIDTH = 900;
/** Where the chip bar sticks (below the scrolled header), and the air a chip leaves above its section. */
const CHIP_BAR_TOP = 96;
const CHIP_BAR_CLEARANCE = 16;

/**
 * The configurator's horizontal arrangement: the sticky header band, the heading panel and the side
 * navigation (the chip bar up to 900 px) beside the body the page hands over as a template.
 */
@Component({
  selector: 'app-configurator-horizontal-chrome',
  imports: [
    AppHeaderComponent,
    ChipAutocenterDirective,
    HorizontalNavDirective,
    NgTemplateOutlet,
    StickyDockDirective,
  ],
  providers: [{ provide: ConfiguratorChrome, useExisting: ConfiguratorHorizontalChromeComponent }],
  templateUrl: 'configurator-horizontal-chrome.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class ConfiguratorHorizontalChromeComponent implements ConfiguratorChrome {
  /** The page's sections, declared once by the page and drawn here beside the navigation. */
  readonly body = input.required<TemplateRef<unknown>>();
  readonly sections = input.required<readonly ConfiguratorSection[]>();
  /** `id` of the section the navigation marks as current. */
  readonly activeId = input.required<string>();
  readonly sectionSelected = output<SectionSelection>();

  protected readonly headerPadding = HEADER_PADDING;
  /** The sticky header follows the shared scroll state; padding 24 → 14 on both sides loses 20 px. */
  protected readonly probe: ChromeProbe = {
    id: 'configurator-header',
    compactDelta: () => 2 * (HEADER_PADDING.full - HEADER_PADDING.compact),
    minViewportHeight: HEADER_MIN_VIEWPORT_HEIGHT,
  };

  private readonly document = inject(DOCUMENT);
  private readonly dock = viewChild<ElementRef<HTMLElement>>('dockEl');
  private readonly nav = viewChild<ElementRef<HTMLElement>>('navEl');

  narrow(): boolean {
    return (this.document.defaultView?.innerWidth ?? Infinity) <= NARROW_MAX_WIDTH;
  }

  /**
   * Height of what still covers the top of the viewport: the header while it is sticky (none once it has
   * scrolled away) and, on a narrow page, the chip bar once it is stuck under it.
   */
  stackHeight(): number {
    const header = Math.max(0, this.dock()?.nativeElement.getBoundingClientRect().bottom ?? 0);
    const bar = this.chipBar();
    if (bar && bar.top <= CHIP_BAR_TOP + 1) return Math.max(header, bar.bottom);
    return header;
  }

  /**
   * `scroll-margin-top` of the sections. The header's height already is the document's `scroll-padding-top`;
   * on a narrow page the margin adds what the chip bar covers beyond it, so a chip lands its section clear of the bar.
   */
  sectionMargin(): number {
    const bar = this.chipBar();
    if (!bar) return SECTION_CLEARANCE;

    const padding = parseFloat(this.document.documentElement.style.scrollPaddingTop) || 0;
    return Math.max(SECTION_CLEARANCE, CHIP_BAR_TOP + bar.height + CHIP_BAR_CLEARANCE - padding);
  }

  /** The chip bar's box, or nothing while the navigation is the side column. */
  private chipBar(): DOMRect | undefined {
    return this.narrow() ? this.nav()?.nativeElement.getBoundingClientRect() : undefined;
  }
}
