import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { AppService } from '../../../core/services/app.service';
import { ThemeService } from '../../../core/services/theme.service';
import { expectNoAxeViolations } from '../../../../testing/a11y';
import { themeServiceStub } from '../../../../testing/theme-service.stub';

import { AppRailActionsComponent } from './app-rail-actions.component';

describe('AppRailActionsComponent', () => {
  const setup = async (mode: 'wide' | 'compact', url = '/') => {
    const view = await render(`<app-rail-actions mode="${mode}" />`, {
      imports: [AppRailActionsComponent],
      providers: [
        provideRouter([
          { path: '', children: [] },
          { path: 'configure', children: [] },
        ]),
        { provide: AppService, useValue: { appVersion: '2.2.0' } },
        { provide: ThemeService, useValue: themeServiceStub('dark') },
      ],
    });

    if (url !== '/') {
      await TestBed.inject(Router).navigateByUrl(url);
      view.fixture.detectChanges();
    }

    return view;
  };

  describe.each(['wide', 'compact'] as const)('in the %s position', (mode) => {
    it('offers the configurator link and the theme picker, each once', async () => {
      await setup(mode);

      expect(screen.getByRole('link', { name: 'Open configurator' })).toHaveAttribute(
        'href',
        '/configure',
      );
      expect(screen.getAllByRole('button')).toHaveLength(1);
      expect(
        screen.getByRole('button', { name: 'Change theme, current: Dark' }),
      ).toBeInTheDocument();
    });

    it('links back to the dashboard from the configurator', async () => {
      await setup(mode, '/configure');

      expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/');
      expect(screen.queryByRole('link', { name: 'Open configurator' })).not.toBeInTheDocument();
    });

    it('tabs from the configurator link to the theme picker button', async () => {
      const user = userEvent.setup();
      await setup(mode);

      screen.getByRole('link', { name: 'Open configurator' }).focus();
      await user.tab();

      expect(screen.getByRole('button', { name: /^Change theme/ })).toHaveFocus();
    });

    it('hides its icons from assistive technology', async () => {
      const { container } = await setup(mode);

      const icons = container.querySelectorAll('ng-icon');

      // The link's and the picker button's, plus those inside the closed dialog.
      expect(icons.length).toBeGreaterThanOrEqual(2);
      icons.forEach((icon) => expect(icon).toHaveAttribute('aria-hidden', 'true'));
    });

    it('has no accessibility violations', async () => {
      const { container } = await setup(mode);

      await expectNoAxeViolations(container);
    });
  });

  describe('wide position', () => {
    it('shows the version as a link to the project site', async () => {
      await setup('wide');

      const link = screen.getByRole('link', { name: 'Mando v2.2.0' });
      expect(link).toHaveAttribute('href', 'https://getmando.rackandhost.com');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('carries the credit line with the heart named "love" and a link to Rack&Host', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2031-03-04T12:00:00') });
      try {
        const { container } = await setup('wide');

        expect(screen.getByRole('img', { name: 'love' })).toHaveTextContent('♡');
        expect(screen.getByRole('link', { name: 'Rack&Host' })).toHaveAttribute(
          'href',
          'https://rackandhost.com',
        );
        expect(container).toHaveTextContent(/Created with ♡ by Rack&Host 2031/);
      } finally {
        vi.useRealTimers();
      }
    });

    it('names the way back with the text "Dashboard" beside the arrow, on the configurator only', async () => {
      await setup('wide', '/configure');

      const back = screen.getByRole('link', { name: 'Back to dashboard' });
      expect(back).toHaveTextContent('Dashboard');
      expect(within(back).getByText('Dashboard')).toBeVisible();
    });

    it('keeps the configurator link on the dashboard icon-only', async () => {
      await setup('wide');

      expect(screen.getByRole('link', { name: 'Open configurator' })).not.toHaveTextContent(/\S/);
    });
  });

  describe('compact position', () => {
    it('has only the two buttons: no version and no credit', async () => {
      const { container } = await setup('compact');

      expect(screen.getAllByRole('link')).toHaveLength(1);
      expect(screen.queryByRole('link', { name: /^Mando v/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Rack&Host' })).not.toBeInTheDocument();
      expect(container).not.toHaveTextContent('Created with');
    });

    it('leaves the way back icon-only: the text is for the wide rail', async () => {
      await setup('compact', '/configure');

      expect(screen.getByRole('link', { name: 'Back to dashboard' })).not.toHaveTextContent(/\S/);
    });
  });
});
