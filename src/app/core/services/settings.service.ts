import {inject, Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {map} from 'rxjs/operators';

import {DashboardSettings, DEFAULT_DASHBOARD_CONFIG} from '../models/dashboard.models';

import {ConfigService} from './config.service';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private configService = inject(ConfigService);

  settingsSubject = new BehaviorSubject<DashboardSettings>(DEFAULT_DASHBOARD_CONFIG.settings);

  readonly settings$ = this.configService.config$.pipe(map((config) => config.settings));

  constructor() {
    this.settings$.subscribe((settings) => this.settingsSubject.next(settings));
  }
}
