import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowPath } from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-loading',
  imports: [NgIcon],
  templateUrl: 'app-loading.component.html',
  viewProviders: [provideIcons({ heroArrowPath })],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLoadingComponent {}
