import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Mock } from 'vitest';
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
    toggleThemeMock?: Mock,
    isDark = signal(true),
    initialUrl = '/',
  ): Promise<void> => {
    await render(AppHeaderComponent, {
      imports: [CommonModule],
      providers: [
        provideRouter([
          { path: '', children: [] },
          { path: 'configure', children: [] },
        ]),
        {
          provide: ThemeService,
          useValue: {
            isDark,
            toggleTheme: toggleThemeMock || vi.fn(),
          },
        },
        {
          provide: MetadataService,
          useValue: {
            metadata: signal(DEFAULT_DASHBOARD_CONFIG.metadata),
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
  });

  describe('functionality', () => {
    it('should set the theme', async () => {
      const toggleThemeMock = vi.fn();

      await setup(toggleThemeMock);

      const themeButton = await screen.findByRole('button');

      await userEvent.click(themeButton);

      expect(toggleThemeMock).toBeCalled();
      expect(toggleThemeMock).toBeCalledTimes(1);
    });

    it('should update the presented theme when the active theme changes', async () => {
      const isDark = signal(true);
      await setup(undefined, isDark);

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

      isDark.set(false);

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
      await setup(undefined, undefined, '/configure');

      await waitFor(() => {
        expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute(
          'href',
          '/',
        );
      });
    });

    it('renders a currentColor Heroicon instead of an emoji on the configurator', async () => {
      await setup(undefined, undefined, '/configure');

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
  });
});
