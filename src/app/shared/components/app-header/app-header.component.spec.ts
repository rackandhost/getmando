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

      expect(screen.getByText('🌙')).toBeInTheDocument();

      isDark.set(false);

      await waitFor(() => {
        expect(screen.getByText('☀️')).toBeInTheDocument();
        expect(screen.queryByText('🌙')).not.toBeInTheDocument();
      });
    });
  });

  describe('configurator navigation', () => {
    it('links to the configurator when on the dashboard', async () => {
      await setup();

      const navLink = screen.getByRole('link', { name: 'Open configurator' });
      expect(navLink).toHaveAttribute('href', '/configure');
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
  });
});
