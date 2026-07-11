import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ThemeService } from '../../../core/services/theme.service';
import { MetadataService } from '../../../core/services/metadata.service';

@Component({
  selector: 'app-header',
  imports: [CommonModule],
  templateUrl: 'app-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent {
  private readonly themeService = inject(ThemeService);
  private readonly metadataService = inject(MetadataService);

  readonly metadata = this.metadataService.metadata;

  readonly themeIcon = computed(() => (this.themeService.isDark() ? '🌙' : '☀️'));
  readonly themeText = computed(() => (this.themeService.isDark() ? 'Dark' : 'Light'));

  onToggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
