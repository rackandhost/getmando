import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AppService } from '../../../core/services/app.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: 'app-header.component.html',
})
export class AppHeaderComponent {
  private readonly appService = inject(AppService);
  readonly themeService = inject(ThemeService);

  readonly metadata$ = this.appService.metadata$;

  readonly themeIcon = computed(() => (this.themeService.isDarkMode() ? '🌙' : '☀️'));
  readonly themeText = computed(() => (this.themeService.isDarkMode() ? 'Dark' : 'Light'));
}
