import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { themeServiceStub, type ThemeServiceStub } from '../../../../testing/theme-service.stub';
import { CommonModule } from '@angular/common';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { AppHeaderComponent } from './app-header.component';

import { ThemeService } from '../../../core/services/theme.service';
import { MetadataService } from '../../../core/services/metadata.service';

import { DEFAULT_DASHBOARD_CONFIG } from '../../../core/models/dashboard.models';

describe('AppHeader', () => {
  const setup = async (
    theme: ThemeServiceStub = themeServiceStub(),
    initialUrl = '/',
    metadata: { title: string; description: string } | null = DEFAULT_DASHBOARD_CONFIG.metadata,
    inputs: Record<string, unknown> = {},
  ): Promise<void> => {
    await render(AppHeaderComponent, {
      imports: [CommonModule],
      inputs,
      providers: [
        provideRouter([
          { path: '', children: [] },
          { path: 'configure', children: [] },
        ]),
        { provide: ThemeService, useValue: theme },
        {
          provide: MetadataService,
          useValue: {
            metadata: signal(metadata ?? undefined),
          },
        },
      ],
    });

    if (initialUrl !== '/') {
      await TestBed.inject(Router).navigateByUrl(initialUrl);
    }
  };

  describe('initial state', () => {
    it('should render', async () => {
      await setup();

      expect(screen.queryByAltText('getMando')).toBeInTheDocument();
      expect(screen.queryByText(DEFAULT_DASHBOARD_CONFIG.metadata.title)).toBeInTheDocument();
      expect(screen.queryByText(DEFAULT_DASHBOARD_CONFIG.metadata.description)).toBeInTheDocument();
      expect(screen.queryByRole('button')).toBeInTheDocument();
    });

    it('shows the YAML title and description in the chip', async () => {
      await setup(undefined, '/', {
        title: 'My dashboard',
        description: 'Simply and lovelly',
      });

      expect(screen.getByRole('heading', { level: 1, name: 'My dashboard' })).toBeInTheDocument();
      expect(screen.getByText('Simply and lovelly')).toBeInTheDocument();
    });

    it('falls back to the default title and description without metadata', async () => {
      await setup(undefined, '/', null);

      expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
      expect(screen.getByText('Your selfhosted applications')).toBeInTheDocument();
    });

    it('exposes only the configurator link and the theme toggle as actions', async () => {
      await setup();

      expect(screen.getAllByRole('link')).toHaveLength(1);
      expect(screen.getAllByRole('button')).toHaveLength(1);
      expect(screen.getByRole('link', { name: 'Open configurator' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
    });
  });

  describe('vertical padding', () => {
    const bannerPadding = () => {
      const { paddingTop, paddingBottom } = getComputedStyle(screen.getByRole('banner'));
      return [paddingTop, paddingBottom];
    };

    it('is 24 px by default', async () => {
      await setup();
      expect(bannerPadding()).toEqual(['24px', '24px']);
    });

    it('is 12 px on both sides when compact', async () => {
      await setup(undefined, '/', undefined, { compact: true });
      expect(bannerPadding()).toEqual(['12px', '12px']);
    });

    it('takes the full and the compact padding from the host (configurator: 24 → 14)', async () => {
      await setup(undefined, '/', undefined, {
        verticalPadding: { full: 24, compact: 14 },
        compact: true,
      });
      expect(bannerPadding()).toEqual(['14px', '14px']);
    });
  });

  describe('functionality', () => {
    it('flips between dark and light through the service, one choice per click', async () => {
      const theme = themeServiceStub('dark');

      await setup(theme);

      await userEvent.click(await screen.findByRole('button'));
      expect(theme.select).toHaveBeenCalledExactlyOnceWith('light');

      await userEvent.click(screen.getByRole('button'));
      expect(theme.select).toHaveBeenCalledTimes(2);
      expect(theme.select).toHaveBeenLastCalledWith('dark');
    });

    it('should update the presented theme when the active theme changes', async () => {
      const theme = themeServiceStub('dark');
      await setup(theme);

      const themeButton = screen.getByRole('button', { name: 'Toggle theme' });
      const darkIcon = themeButton.querySelector('ng-icon');
      const darkSvg = darkIcon?.querySelector('svg');

      expect(darkIcon).toHaveAttribute('aria-hidden', 'true');
      expect(darkSvg).toHaveAttribute('stroke', 'currentColor');
      expect(darkSvg?.querySelector('path')).toHaveAttribute(
        'd',
        expect.stringContaining('M21.752 15.002'),
      );
      expect(themeButton).not.toHaveTextContent('🌙');

      theme.theme.set('light');

      await waitFor(() => {
        const lightSvg = themeButton.querySelector('svg');
        expect(lightSvg).toHaveAttribute('stroke', 'currentColor');
        expect(lightSvg?.querySelector('path')).toHaveAttribute(
          'd',
          expect.stringContaining('M12 3v2.25'),
        );
        expect(themeButton).not.toHaveTextContent('☀️');
        expect(themeButton).not.toHaveTextContent('🌙');
      });
    });
  });

  describe('configurator navigation', () => {
    it('links to the configurator when on the dashboard', async () => {
      await setup();

      const navLink = screen.getByRole('link', { name: 'Open configurator' });
      expect(navLink).toHaveAttribute('href', '/configure');
    });

    it('renders a currentColor Heroicon instead of an emoji on the dashboard', async () => {
      await setup();

      const navLink = screen.getByRole('link', { name: 'Open configurator' });
      const icon = navLink.querySelector('ng-icon');
      const svg = icon?.querySelector('svg');

      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
      expect(svg?.querySelectorAll('path')).toHaveLength(2);
      expect(navLink).not.toHaveTextContent('⚙️');
    });

    it('links back to the dashboard when on the configurator', async () => {
      await setup(undefined, '/configure');

      await waitFor(() => {
        expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute(
          'href',
          '/',
        );
      });
    });

    it('renders a currentColor Heroicon instead of an emoji on the configurator', async () => {
      await setup(undefined, '/configure');

      await waitFor(() => {
        const navLink = screen.getByRole('link', { name: 'Back to dashboard' });
        const icon = navLink.querySelector('ng-icon');
        const svg = icon?.querySelector('svg');

        expect(icon).toHaveAttribute('aria-hidden', 'true');
        expect(svg).toHaveAttribute('stroke', 'currentColor');
        expect(svg?.querySelectorAll('path')).toHaveLength(1);
        expect(navLink).not.toHaveTextContent('⬅️');
      });
    });

    it('shows the label beside the arrow on the configurator, keeping it as the accessible name', async () => {
      await setup(undefined, '/configure');

      await waitFor(() => {
        const navLink = screen.getByRole('link', { name: 'Back to dashboard' });
        expect(navLink).toHaveTextContent('Back to dashboard');
      });
    });

    it('keeps the configurator link on the dashboard as an icon only', async () => {
      await setup();

      expect(screen.getByRole('link', { name: 'Open configurator' })).toHaveTextContent('');
    });
  });
});
