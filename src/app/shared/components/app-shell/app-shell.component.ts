import { ChangeDetectionStrategy, Component } from '@angular/core';

import { AppFooterComponent } from '../app-footer/app-footer.component';
import { AppHeaderComponent } from '../app-header/app-header.component';

/** Fixed header, scrollable routed content, and fixed footer shared by every route. */
@Component({
  selector: 'app-shell',
  imports: [AppFooterComponent, AppHeaderComponent],
  templateUrl: 'app-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {}
