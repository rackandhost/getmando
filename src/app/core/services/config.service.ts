import {Injectable, OnDestroy} from '@angular/core';
import {BehaviorSubject, Subject, takeUntil} from 'rxjs';
import {filter} from 'rxjs/operators';

import {DashboardConfig} from '../models/dashboard.models';

@Injectable({ providedIn: 'root' })
export class ConfigService implements OnDestroy {
  private configSubject = new BehaviorSubject<DashboardConfig | undefined>(undefined);

  destroy$: Subject<void> = new Subject<void>();

  readonly config$ = this.configSubject.asObservable().pipe(
    takeUntil(this.destroy$),
    filter((config) => !!config)
  );

  get subject(): BehaviorSubject<DashboardConfig | undefined> {
    return this.configSubject;
  }

  fireNewSubject(config: DashboardConfig): void {
    this.configSubject.next(config);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
  }
}
