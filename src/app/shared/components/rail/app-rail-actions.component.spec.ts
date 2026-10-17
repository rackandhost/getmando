import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { AppService } from '../../../core/services/app.service';
import { ThemeService } from '../../../core/services/theme.service';
import { expectNoAxeViolations } from '../../../../testing/a11y';

import { AppRailActionsComponent } from './app-rail-actions.component';

describe('AppRailActionsComponent', () => {
  const toggleTheme = vi.fn();

  const setup = async (mode: 'wide' | 'compact', url = '/') => {
    toggleTheme.mockReset();
    const view = await render(`<app-rail-actions mode="${mode}" />`, {
      imports: [AppRailActionsComponent],
      providers: [
        provideRouter([
          { path: '', children: [] },
          { path: 'configure', children: [] },
        ]),
        { provide: AppService, useValue: { appVersion: '2.2.0' } },
        { provide: ThemeService, useValue: { isDark: signal(true), toggleTheme } },
      ],
    });

    if (url !== '/') {
      await TestBed.inject(Router).navigateByUrl(url);
      view.fixture.detectChanges();
    }

    return view;
  };

  describe.each(['wide', 'compact'] as const)('in the %s position', (mode) => {
    it('offers the configurator link and the theme toggle, each once', async () => {
      await setup(mode);

      expect(screen.getByRole('link', { name: 'Open configurator' })).toHaveAttribute(
        'href',
        '/configure',
      );
      expect(screen.getAllByRole('button')).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
    });

    it('links back to the dashboard from the configurator', async () => {
      await setup(mode, '/configure');

      expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/');
      expect(screen.queryByRole('link', { name: 'Open configurator' })).not.toBeInTheDocument();
    });

    it('toggles the theme', async () => {
      await setup(mode);

      await userEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));

      expect(toggleTheme).toHaveBeenCalledOnce();
    });

    it('hides its icons from assistive technology', async () => {
      const { container } = await setup(mode);

      const icons = container.querySelectorAll('ng-icon');

      expect(icons).toHaveLength(2);
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
  });

  describe('compact position', () => {
    it('has only the two buttons: no version and no credit', async () => {
      const { container } = await setup('compact');

      expect(screen.getAllByRole('link')).toHaveLength(1);
      expect(screen.queryByRole('link', { name: /^Mando v/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Rack&Host' })).not.toBeInTheDocument();
      expect(container).not.toHaveTextContent('Created with');
    });
  });
});
