import {inject, Injectable, OnDestroy} from '@angular/core';
import {BehaviorSubject, Subject, takeUntil} from 'rxjs';
import {map} from 'rxjs/operators';

import {DashboardSettings, DEFAULT_DASHBOARD_CONFIG} from '../models/dashboard.models';

import {ConfigService} from './config.service';

@Injectable({ providedIn: 'root' })
export class SettingsService implements OnDestroy {
  private configService = inject(ConfigService);

  settingsSubject = new BehaviorSubject<DashboardSettings>(DEFAULT_DASHBOARD_CONFIG.settings);

  destroy$: Subject<void> = new Subject<void>();

  readonly settings$ = this.configService.config$.pipe(
    takeUntil(this.destroy$),
    map((config) => config.settings)
  );

  constructor() {
    this.settings$.subscribe((settings) => this.settingsSubject.next(settings));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
  }
}
