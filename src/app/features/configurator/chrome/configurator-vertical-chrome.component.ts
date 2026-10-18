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

import { AppRailActionsComponent } from '../../../shared/components/rail/app-rail-actions.component';
import { AppRailBrandComponent } from '../../../shared/components/rail/app-rail-brand.component';
import { AppRailComponent } from '../../../shared/components/rail/app-rail.component';
import { ChipAutocenterDirective } from '../../../shared/directives/chip-autocenter.directive';
import { HorizontalNavDirective } from '../../../shared/directives/horizontal-nav.directive';
import { stuckHeight } from '../../../shared/directives/rail-stick';
import {
  ConfiguratorChrome,
  SECTION_CLEARANCE,
  type ConfiguratorSection,
  type SectionSelection,
} from '../configurator-chrome';

/** Below this viewport width (px) the rail is a bar on top of the page and the sections are a chip bar. */
const BAR_BELOW_WIDTH = 1024;
/** Air a section keeps below the stuck bar. */
const BAR_CLEARANCE = 16;

/**
 * The configurator's vertical arrangement: the rail (brand, heading tile, section list, actions and
 * credit) beside the body the page hands over as a template. Below 1024 px the rail is a bar whose
 * section list is a chip bar that stays stuck at the top of the page.
 */
@Component({
  selector: 'app-configurator-vertical-chrome',
  imports: [
    AppRailActionsComponent,
    AppRailBrandComponent,
    AppRailComponent,
    ChipAutocenterDirective,
    HorizontalNavDirective,
    NgTemplateOutlet,
  ],
  providers: [{ provide: ConfiguratorChrome, useExisting: ConfiguratorVerticalChromeComponent }],
  templateUrl: 'configurator-vertical-chrome.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class ConfiguratorVerticalChromeComponent implements ConfiguratorChrome {
  /** The page's sections, declared once by the page and drawn here beside the rail. */
  readonly body = input.required<TemplateRef<unknown>>();
  readonly sections = input.required<readonly ConfiguratorSection[]>();
  /** `id` of the section the navigation marks as current. */
  readonly activeId = input.required<string>();
  readonly sectionSelected = output<SectionSelection>();

  private readonly document = inject(DOCUMENT);
  private readonly nav = viewChild<ElementRef<HTMLElement>>('navEl');

  narrow(): boolean {
    return (this.document.defaultView?.innerWidth ?? Infinity) < BAR_BELOW_WIDTH;
  }

  /**
   * The part of the bar that stays on screen while it is stuck. The rail's directive keeps the document's
   * `scroll-padding-top` equal to it while the bar is stuck and clears it otherwise; the column covers nothing.
   */
  stackHeight(): number {
    return this.narrow() ? this.scrollPadding() : 0;
  }

  /**
   * `scroll-margin-top` of the sections. In the column the rail covers nothing. As a bar the margin is the
   * clearance below the stuck part; before the bar has stuck that part is not in the scroll padding yet, so
   * it is added, and a jump from the top of the page does not land the section under the bar.
   */
  sectionMargin(): number {
    if (!this.narrow()) return SECTION_CLEARANCE;

    return BAR_CLEARANCE + Math.max(0, this.stuckPart() - this.scrollPadding());
  }

  private scrollPadding(): number {
    return parseFloat(this.document.documentElement.style.scrollPaddingTop) || 0;
  }

  /** What stays visible of the bar once stuck: from the chip bar down, plus the bar's own top padding. */
  private stuckPart(): number {
    const chipBar = this.nav()?.nativeElement;
    const rail = chipBar?.closest('aside');
    if (!chipBar || !rail) return 0;

    const railBox = rail.getBoundingClientRect();
    const paddingTop =
      parseFloat(this.document.defaultView?.getComputedStyle(rail).paddingTop ?? '') || 0;

    return stuckHeight({
      railHeight: railBox.height,
      anchorTop: chipBar.getBoundingClientRect().top - railBox.top,
      paddingTop,
    });
  }
}
