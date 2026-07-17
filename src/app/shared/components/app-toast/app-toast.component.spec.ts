import { signal } from '@angular/core';
import { render, screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { Notification, NotificationService } from '../../../core/services/notification.service';
import { expectNoAxeViolations } from '../../../../testing/a11y';
import { AppToastComponent } from './app-toast.component';

describe('AppToastComponent', () => {
  const notifications = signal<readonly Notification[]>([]);
  const dismiss = vi.fn((id: number) => {
    notifications.update((active) => active.filter((notification) => notification.id !== id));
  });

  const setup = async (initialNotifications: readonly Notification[] = []) => {
    notifications.set(initialNotifications);
    dismiss.mockReset();

    return render(AppToastComponent, {
      providers: [{ provide: NotificationService, useValue: { notifications, dismiss } }],
    });
  };

  it('renders no live regions or dismiss buttons when empty', async () => {
    await setup();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders all levels in deterministic service order with visible labels', async () => {
    await setup([
      { id: 4, level: 'error', message: 'Could not load apps' },
      { id: 7, level: 'warning', message: 'Using cached settings' },
      { id: 8, level: 'info', message: 'Refreshing dashboard' },
      { id: 12, level: 'success', message: 'Dashboard ready' },
    ]);

    expect(
      screen.getAllByText(/Could not|Using|Refreshing|ready/).map(({ textContent }) => textContent),
    ).toEqual([
      'Could not load apps',
      'Using cached settings',
      'Refreshing dashboard',
      'Dashboard ready',
    ]);
    expect(screen.getAllByText(/^(error|warning|info|success)$/i)).toHaveLength(4);
  });

  it('announces errors assertively and each non-error notification politely', async () => {
    await setup([
      { id: 1, level: 'error', message: 'Failure' },
      { id: 2, level: 'warning', message: 'Caution' },
      { id: 3, level: 'info', message: 'Update' },
      { id: 4, level: 'success', message: 'Saved' },
    ]);

    expect(screen.getByRole('alert')).toHaveTextContent('Failure');
    expect(screen.getAllByRole('status')).toHaveLength(3);
    expect(screen.getByLabelText('Notifications')).not.toHaveAttribute('aria-live');
  });

  it.each([
    ['first', 1, 'Second'],
    ['middle', 2, 'Third'],
  ])(
    'moves focus to the next dismiss button after dismissing the %s toast',
    async (_, id, next) => {
      const user = userEvent.setup();
      await setup([
        { id: 1, level: 'info', message: 'First' },
        { id: 2, level: 'warning', message: 'Second' },
        { id: 3, level: 'success', message: 'Third' },
      ]);
      const button = screen.getByRole('button', {
        name: new RegExp(id === 1 ? 'First' : 'Second'),
      });

      button.focus();
      await user.keyboard('{Enter}');

      expect(dismiss).toHaveBeenCalledWith(id);
      expect(
        screen.queryByRole('button', { name: new RegExp(id === 1 ? 'First' : 'Second') }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: new RegExp(next) })).toHaveFocus();
    },
  );

  it('moves focus to the previous dismiss button after dismissing the last toast', async () => {
    const user = userEvent.setup();
    await setup([
      { id: 1, level: 'info', message: 'First' },
      { id: 2, level: 'success', message: 'Last' },
    ]);

    await user.click(screen.getByRole('button', { name: /Last/ }));

    expect(screen.getByRole('button', { name: /First/ })).toHaveFocus();
  });

  it('does not force focus elsewhere when dismissing the sole toast', async () => {
    const user = userEvent.setup();
    await setup([{ id: 1, level: 'info', message: 'Only' }]);

    await user.click(screen.getByRole('button', { name: /Only/ }));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(document.body);
  });

  it('does not steal focus when notification state changes outside button dismissal', async () => {
    await setup([
      { id: 1, level: 'info', message: 'Expiring' },
      { id: 2, level: 'success', message: 'Remaining' },
    ]);
    const externalControl = document.createElement('button');
    document.body.append(externalControl);
    externalControl.focus();

    try {
      notifications.update((active) => active.filter(({ id }) => id !== 1));

      await waitFor(() => expect(screen.queryByText('Expiring')).not.toBeInTheDocument());
      expect(externalControl).toHaveFocus();
    } finally {
      externalControl.remove();
    }
  });

  it('renders notifications that exist before the component mounts without moving focus', async () => {
    const priorControl = document.createElement('button');
    priorControl.textContent = 'Prior control';
    document.body.append(priorControl);
    priorControl.focus();

    try {
      await setup([{ id: 9, level: 'info', message: 'Already queued' }]);

      expect(screen.getByRole('status')).toHaveTextContent('Already queued');
      expect(priorControl).toHaveFocus();
    } finally {
      priorControl.remove();
    }
  });

  it('has no detectable accessibility violations for a complete stack', async () => {
    const view = await setup([
      { id: 1, level: 'error', message: 'Failure' },
      { id: 2, level: 'warning', message: 'Caution' },
      { id: 3, level: 'info', message: 'Update' },
      { id: 4, level: 'success', message: 'Saved' },
    ]);

    for (const button of screen.getAllByRole('button')) {
      expect(within(button).getByText('×')).toHaveAttribute('aria-hidden', 'true');
    }
    await expectNoAxeViolations(view.container);
  });
});
