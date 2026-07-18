import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AppService } from '../../../core/services/app.service';

@Component({
  selector: 'app-footer',
  imports: [CommonModule],
  templateUrl: 'app-footer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppFooterComponent {
  private appService = inject(AppService);

  get appVersion(): string {
    return this.appService.appVersion;
  }
}
