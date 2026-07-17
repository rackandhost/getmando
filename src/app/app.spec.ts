import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { App } from './app';
import { AppToastComponent } from './shared/components/app-toast/app-toast.component';
import { DashboardComponent } from './views/dashboard/dashboard.component';

@Component({ selector: 'app-dashboard', template: '' })
class DashboardStubComponent {}

@Component({ selector: 'app-toast', template: '' })
class AppToastStubComponent {}

describe('App', () => {
  it('composes the dashboard and toast host exactly once at the root', async () => {
    await TestBed.configureTestingModule({ imports: [App] })
      .overrideComponent(App, {
        remove: { imports: [DashboardComponent, AppToastComponent] },
        add: { imports: [DashboardStubComponent, AppToastStubComponent] },
      })
      .compileComponents();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('app-dashboard')).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('app-toast')).toHaveLength(1);
  });
});
