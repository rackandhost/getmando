import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  viewChildren,
} from '@angular/core';

import { Notification, NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-toast',
  templateUrl: './app-toast.component.html',
  host: {
    class:
      'pointer-events-none fixed top-4 right-4 z-[1000] w-[min(24rem,calc(100vw-2rem))] max-[640px]:top-3 max-[640px]:right-3 max-[640px]:left-3 max-[640px]:w-auto',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppToastComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly injector = inject(Injector);
  private readonly dismissButtons = viewChildren<ElementRef<HTMLButtonElement>>('dismissButton');

  protected readonly notifications = this.notificationService.notifications;

  /** Decorative level accent (design § 4.5); the level label carries the meaning. Literal for Tailwind. */
  protected readonly accentClass: Record<Notification['level'], string> = {
    error: 'bg-down',
    success: 'bg-up',
    warning: 'bg-accent',
    info: 'bg-text',
  };

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
