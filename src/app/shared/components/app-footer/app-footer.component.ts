import {CommonModule} from '@angular/common';
import {Component, inject} from '@angular/core';

import {AppService} from '../../../core/services/app.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: 'app-footer.component.html',
})
export class AppFooterComponent {
  private appService = inject(AppService);

  get appVersion(): string {
    return this.appService.appVersion;
  }
}
