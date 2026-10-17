import { ChangeDetectionStrategy, Component } from '@angular/core';

import { AppFooterComponent } from '../app-footer/app-footer.component';

/**
 * Centred page container shared by every route. The window scrolls: routed content (which renders its
 * own header) is followed by the footer in normal flow.
 */
@Component({
  selector: 'app-shell',
  imports: [AppFooterComponent],
  templateUrl: 'app-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {}
