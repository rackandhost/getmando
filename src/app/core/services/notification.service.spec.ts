import { TestBed } from '@angular/core/testing';

import {
  NOTIFICATION_DURATION_MS,
  Notification,
  NotificationService,
} from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [NotificationService] });
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('retains all notification levels for consumers that mount later', () => {
    service.error('Error');
    service.warning('Warning');
    service.info('Info');
    service.success('Success');

    expect(service.notifications()).toEqual([
      { id: 1, level: 'error', message: 'Error' },
      { id: 2, level: 'warning', message: 'Warning' },
      { id: 3, level: 'info', message: 'Info' },
      { id: 4, level: 'success', message: 'Success' },
    ]);
  });

  it('assigns distinct monotonic IDs and preserves same-message notifications', () => {
    service.error('Repeated failure');
    service.error('Repeated failure');
    service.dismiss(1);
    service.error('Repeated failure');

    expect(service.notifications()).toEqual([
      { id: 2, level: 'error', message: 'Repeated failure' },
      { id: 3, level: 'error', message: 'Repeated failure' },
    ]);
  });

  it('trims messages and rejects blank notifications', () => {
    service.info('  Ready  ');
    service.warning('   ');

    expect(service.notifications()).toEqual([{ id: 1, level: 'info', message: 'Ready' }]);
  });

  it('auto-dismisses only after the shared duration', () => {
    service.success('Saved');

    vi.advanceTimersByTime(NOTIFICATION_DURATION_MS - 1);
    expect(service.notifications()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(service.notifications()).toEqual([]);
  });

  it('cancels manual-dismiss timers without affecting later notifications', () => {
    service.info('First');
    vi.advanceTimersByTime(1000);
    service.dismiss(1);
    service.info('Second');

    vi.advanceTimersByTime(NOTIFICATION_DURATION_MS - 1000);
    expect(service.notifications().map(({ message }) => message)).toEqual(['Second']);

    vi.advanceTimersByTime(1000);
    expect(service.notifications()).toEqual([]);
  });

  it('caps the queue at five and evicts the oldest notification', () => {
    for (let index = 1; index <= 6; index++) service.info(`Message ${index}`);

    expect(service.notifications().map(({ id }) => id)).toEqual([2, 3, 4, 5, 6]);
    expect(vi.getTimerCount()).toBe(5);
  });

  it('prevents consumers from mutating records or bypassing the queue cap', () => {
    for (let index = 1; index <= 5; index++) service.info(`Message ${index}`);
    const snapshot = service.notifications();
    const injected: Notification = Object.freeze({ id: 999, level: 'error', message: 'Injected' });

    expect(Reflect.set(snapshot[0], 'message', 'Tampered')).toBe(false);
    expect(Reflect.set(snapshot, snapshot.length, injected)).toBe(false);
    expect(Reflect.deleteProperty(snapshot, '0')).toBe(false);

    service.info('Message 6');

    expect(service.notifications().map(({ id }) => id)).toEqual([2, 3, 4, 5, 6]);
    expect(service.notifications().map(({ message }) => message)).toEqual([
      'Message 2',
      'Message 3',
      'Message 4',
      'Message 5',
      'Message 6',
    ]);
  });

  it('cleans pending timers when its injector is destroyed', () => {
    service.error('Pending');
    service.info('Also pending');

    TestBed.resetTestingModule();

    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(NOTIFICATION_DURATION_MS);
    expect(service.notifications()).toHaveLength(2);
  });
});
