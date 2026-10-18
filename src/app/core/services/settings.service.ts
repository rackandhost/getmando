import { computed, inject, Injectable } from '@angular/core';

import {
  DashboardLayout,
  DashboardSettings,
  DEFAULT_DASHBOARD_CONFIG,
} from '../models/dashboard.models';

import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private configService = inject(ConfigService);

  readonly settings = computed<DashboardSettings>(
    () => this.configService.config()?.settings ?? DEFAULT_DASHBOARD_CONFIG.settings,
  );

  /** The active page layout; `horizontal` until a configuration with another one is loaded. */
  readonly layout = computed<DashboardLayout>(() => this.settings().layout);
}
