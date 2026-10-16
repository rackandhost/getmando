import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-loading',
  templateUrl: 'app-loading.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLoadingComponent {}
