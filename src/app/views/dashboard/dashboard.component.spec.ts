import { Component, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';

import type { DashboardLayout } from '../../core/models/dashboard.models';
import { SettingsService } from '../../core/services/settings.service';

import { DashboardComponent } from './dashboard.component';

@Component({ selector: 'app-dashboard-horizontal', template: '<p>horizontal dashboard</p>' })
class HorizontalStubComponent {}

@Component({ selector: 'app-dashboard-vertical', template: '<p>vertical dashboard</p>' })
class VerticalStubComponent {}

describe('DashboardComponent', () => {
  const setup = (layout: DashboardLayout) => {
    const layoutState = signal<DashboardLayout>(layout);

    return render(DashboardComponent, {
      providers: [{ provide: SettingsService, useValue: { layout: layoutState } }],
      componentImports: [HorizontalStubComponent, VerticalStubComponent],
    }).then((view) => ({ ...view, layoutState }));
  };

  it('draws the horizontal dashboard for the horizontal layout and nothing of the vertical one', async () => {
    await setup('horizontal');

    expect(screen.getByText('horizontal dashboard')).toBeInTheDocument();
    expect(screen.queryByText('vertical dashboard')).not.toBeInTheDocument();
  });

  it('draws the vertical dashboard for the vertical layout and nothing of the horizontal one', async () => {
    await setup('vertical');

    expect(screen.getByText('vertical dashboard')).toBeInTheDocument();
    expect(screen.queryByText('horizontal dashboard')).not.toBeInTheDocument();
  });

  it('swaps the dashboard when the layout changes while the page is open', async () => {
    const { layoutState, fixture } = await setup('horizontal');

    layoutState.set('vertical');
    fixture.detectChanges();

    expect(screen.getByText('vertical dashboard')).toBeInTheDocument();
    expect(screen.queryByText('horizontal dashboard')).not.toBeInTheDocument();
  });
});
