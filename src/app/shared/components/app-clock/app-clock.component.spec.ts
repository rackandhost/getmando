import { render, screen } from '@testing-library/angular';
import { BehaviorSubject } from 'rxjs';

import { DEFAULT_DASHBOARD_CONFIG, DashboardSettings } from '../../../core/models/dashboard.models';
import { SettingsService } from '../../../core/services/settings.service';

import { AppClockComponent } from './app-clock.component';

describe('AppClockComponent', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates the rendered time every second under OnPush', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0));
    const settingsSubject = new BehaviorSubject<DashboardSettings>({
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      showDate: false,
      showSeconds: true,
    });

    await render(AppClockComponent, {
      providers: [
        {
          provide: SettingsService,
          useValue: { settingsSubject },
        },
      ],
    });

    expect(screen.getByText('00')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(1001);

    expect(screen.getByText('01')).toBeInTheDocument();
  });
});
