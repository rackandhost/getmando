import {Component, computed, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {toSignal} from '@angular/core/rxjs-interop';

import {ThemeService} from '../../../core/services/theme.service';
import {MetadataService} from '../../../core/services/metadata.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: 'app-header.component.html',
})
export class AppHeaderComponent {
  private readonly themeService = inject(ThemeService);
  private readonly metadataService = inject(MetadataService);

  readonly metadata = toSignal(this.metadataService.metadata$);

  readonly themeIcon = computed(() => (this.themeService.isDarkMode() ? '🌙' : '☀️'));
  readonly themeText = computed(() => (this.themeService.isDarkMode() ? 'Dark' : 'Light'));

  onToggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
