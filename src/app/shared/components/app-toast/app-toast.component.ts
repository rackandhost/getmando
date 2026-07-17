import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  viewChildren,
} from '@angular/core';

import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-toast',
  templateUrl: './app-toast.component.html',
  styleUrl: './app-toast.component.css',
  host: {
    class: 'app-toast',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppToastComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly injector = inject(Injector);
  private readonly dismissButtons = viewChildren<ElementRef<HTMLButtonElement>>('dismissButton');

  protected readonly notifications = this.notificationService.notifications;

  protected dismiss(id: number): void {
    const notifications = this.notifications();
    const dismissedIndex = notifications.findIndex((notification) => notification.id === id);
    const focusIndex =
      dismissedIndex === notifications.length - 1 ? dismissedIndex - 1 : dismissedIndex;

    this.notificationService.dismiss(id);

    if (focusIndex < 0 || notifications.length === 1) return;

    afterNextRender(() => this.dismissButtons()[focusIndex]?.nativeElement.focus(), {
      injector: this.injector,
    });
  }
}
