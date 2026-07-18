import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-loading',
  imports: [CommonModule],
  templateUrl: 'app-loading.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLoadingComponent {}
