import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';

import {
  DEFAULT_DASHBOARD_CONFIG,
  type DashboardSettings,
} from '../../../core/models/dashboard.models';
import { SettingsService } from '../../../core/services/settings.service';
import { expectNoAxeViolations } from '../../../../testing/a11y';

import { AppRailClockComponent } from './app-rail-clock.component';

describe('AppRailClockComponent', () => {
  // Tuesday 13 October 2026, 18:43:07 local time.
  const TUESDAY = new Date(2026, 9, 13, 18, 43, 7);

  const setup = async (settingsOverride: Partial<DashboardSettings> = {}, now = TUESDAY) => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const settings = signal<DashboardSettings>({
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      showDate: true,
      datePosition: 'bottom',
      dateFormat: 'd MMMM yyyy',
      showSeconds: false,
      ...settingsOverride,
    });

    const view = await render(AppRailClockComponent, {
      providers: [{ provide: SettingsService, useValue: { settings } }],
    });

    return { ...view, settings };
  };

  const follows = (earlier: Element, later: Element): boolean =>
    Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);

  afterEach(() => {
    vi.useRealTimers();
  });

  it('splits HH:mm into hours, colon and minutes on a 24-hour clock', async () => {
    await setup({}, new Date(2026, 9, 13, 0, 5, 0));

    expect(screen.getByText('00')).toBeInTheDocument();
    expect(screen.getByText(':')).toBeInTheDocument();
    expect(screen.getByText('05')).toBeInTheDocument();
  });

  it('updates the rendered time every second under OnPush', async () => {
    await setup({ showDate: false, showSeconds: true }, new Date(2026, 0, 1, 12, 7, 0));

    expect(screen.getByText('00')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(1001);

    expect(screen.getByText('01')).toBeInTheDocument();
  });

  it('stops ticking when it is destroyed', async () => {
    const { fixture } = await setup({ showDate: false });
    const pending = vi.getTimerCount();

    fixture.destroy();

    expect(vi.getTimerCount()).toBeLessThan(pending);
  });

  describe('date pills', () => {
    it('shows the weekday and the dateFormat uppercased, after the digits by default', async () => {
      await setup();

      const weekday = screen.getByText('TUESDAY');
      const date = screen.getByText('13 OCTOBER 2026');

      expect(follows(screen.getByText('43'), weekday)).toBe(true);
      expect(follows(weekday, date)).toBe(true);
    });

    it('puts the pills before the digits when datePosition is top', async () => {
      await setup({ datePosition: 'top' });

      expect(follows(screen.getByText('TUESDAY'), screen.getByText('18'))).toBe(true);
      expect(follows(screen.getByText('13 OCTOBER 2026'), screen.getByText('18'))).toBe(true);
    });

    it('shows no pill when showDate is false', async () => {
      await setup({ showDate: false });

      expect(screen.queryByText('TUESDAY')).not.toBeInTheDocument();
      expect(screen.queryByText(/OCTOBER/)).not.toBeInTheDocument();
      expect(screen.getByText('43')).toBeInTheDocument();
    });

    it('changes only the date pill when dateFormat changes', async () => {
      const { settings, fixture } = await setup();

      settings.update((current) => ({ ...current, dateFormat: 'dd/MM' }));
      fixture.detectChanges();

      expect(screen.getByText('13/10')).toBeInTheDocument();
      expect(screen.getByText('TUESDAY')).toBeInTheDocument();
      expect(screen.queryByText('13 OCTOBER 2026')).not.toBeInTheDocument();
    });
  });

  describe('seconds', () => {
    it('renders an aria-hidden seconds readout after the minutes when showSeconds is true', async () => {
      await setup({ showSeconds: true });

      expect(screen.getByText('07')).toHaveAttribute('aria-hidden', 'true');
      expect(follows(screen.getByText('43'), screen.getByText('07'))).toBe(true);
    });

    it('renders no seconds node when showSeconds is false', async () => {
      await setup({ showSeconds: false });

      expect(screen.queryByText('07')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('gives the tile one accessible name with the time and the date', async () => {
      await setup();

      expect(
        screen.getByRole('img', { name: '18:43, Tuesday, 13 October 2026' }),
      ).toBeInTheDocument();
    });

    it('names the tile with the time alone when the date is hidden', async () => {
      await setup({ showDate: false });

      expect(screen.getByRole('img', { name: '18:43' })).toBeInTheDocument();
    });

    it('is not a live region and never changes its name by the second', async () => {
      const { container } = await setup({ showSeconds: true });
      const tile = screen.getByRole('img');
      const name = tile.getAttribute('aria-label');

      await vi.advanceTimersByTimeAsync(5000);

      expect(container.querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull();
      expect(tile.getAttribute('aria-label')).toBe(name);
    });

    it('has no accessibility violations', async () => {
      const { container } = await setup({ showSeconds: true });
      vi.useRealTimers();

      await expectNoAxeViolations(container);
    });
  });

  it('never blinks the colon', async () => {
    await setup({ showSeconds: true });
    const colon = screen.getByText(':');
    const before = colon.className;

    await vi.advanceTimersByTimeAsync(10_000);

    expect(screen.getByText(':')).toBe(colon);
    expect(colon.className).toBe(before);
    expect(colon.className).not.toMatch(/animate|blink|pulse/);
    expect(colon.getAnimations?.() ?? []).toHaveLength(0);
  });
});
