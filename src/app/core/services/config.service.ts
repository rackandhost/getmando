import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {filter} from 'rxjs/operators';

import {DashboardConfig} from '../models/dashboard.models';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private configSubject = new BehaviorSubject<DashboardConfig | undefined>(undefined);

  readonly config$ = this.configSubject.asObservable().pipe(filter((config) => !!config));

  get subject(): BehaviorSubject<DashboardConfig | undefined> {
    return this.configSubject;
  }

  fireNewSubject(config: DashboardConfig): void {
    this.configSubject.next(config);
  }
}
