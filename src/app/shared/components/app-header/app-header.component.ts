import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowLeft, heroCog6Tooth } from '@ng-icons/heroicons/outline';

import { MetadataService } from '../../../core/services/metadata.service';
import { ConfiguratorNavService } from '../../../core/services/configurator-nav.service';
import { ThemePickerComponent } from '../theme-picker/theme-picker.component';

@Component({
  selector: 'app-header',
  imports: [CommonModule, NgIcon, RouterLink, ThemePickerComponent],
  templateUrl: 'app-header.component.html',
  viewProviders: [provideIcons({ heroArrowLeft, heroCog6Tooth })],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent {
  private readonly metadataService = inject(MetadataService);

  /** The scrolled dock reduces the header's vertical padding (design.md § 4.1). */
  readonly compact = input(false);

  /** Vertical padding in px at the top of the page and once compact; the configurator uses 24 → 14. */
  readonly verticalPadding = input({ full: 24, compact: 12 });

  protected readonly paddingY = computed(() =>
    this.compact() ? this.verticalPadding().compact : this.verticalPadding().full,
  );

  readonly metadata = this.metadataService.metadata;

  /** The configurator link, shared with the other layouts' chrome. */
  private readonly nav = inject(ConfiguratorNavService);
  readonly isConfiguratorRoute = this.nav.isConfiguratorRoute;
  readonly navTarget = this.nav.target;
  readonly navLabel = this.nav.label;
  readonly navIcon = this.nav.icon;
}
