import { computed, DestroyRef, inject, Injectable, signal, Signal } from '@angular/core';

export type NotificationLevel = 'error' | 'warning' | 'info' | 'success';

export interface Notification {
  readonly id: number;
  readonly level: NotificationLevel;
  readonly message: string;
}

export const NOTIFICATION_DURATION_MS = 5000;

const MAX_ACTIVE_NOTIFICATIONS = 5;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificationsState = signal<Notification[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextId = 1;

  readonly notifications: Signal<readonly Notification[]> = computed(() =>
    Object.freeze([...this.notificationsState()]),
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      for (const timer of this.timers.values()) clearTimeout(timer);
      this.timers.clear();
    });
  }

  error(message: string): void {
    this.add('error', message);
  }

  warning(message: string): void {
    this.add('warning', message);
  }

  info(message: string): void {
    this.add('info', message);
  }

  success(message: string): void {
    this.add('success', message);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.notificationsState.update((notifications) =>
      notifications.filter((notification) => notification.id !== id),
    );
  }

  private add(level: NotificationLevel, message: string): void {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) return;

    const notification: Notification = Object.freeze({
      id: this.nextId++,
      level,
      message: normalizedMessage,
    });
    const notifications = this.notificationsState();

    if (notifications.length === MAX_ACTIVE_NOTIFICATIONS) {
      this.dismiss(notifications[0].id);
    }

    this.notificationsState.update((active) => [...active, notification]);
    this.timers.set(
      notification.id,
      setTimeout(() => {
        this.timers.delete(notification.id);
        this.notificationsState.update((active) =>
          active.filter(({ id }) => id !== notification.id),
        );
      }, NOTIFICATION_DURATION_MS),
    );
  }
}
