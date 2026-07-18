import { Injectable, signal } from '@angular/core';

import { DashboardConfig } from '../models/dashboard.models';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly configState = signal<DashboardConfig | undefined>(undefined);
  readonly config = this.configState.asReadonly();

  fireNewSubject(config: DashboardConfig): void {
    this.configState.set(config);
  }
}
