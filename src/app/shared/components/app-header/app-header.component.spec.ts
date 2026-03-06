import {render, screen} from '@testing-library/angular';
import {Mock} from 'vitest';
import {CommonModule} from '@angular/common';
import {of} from 'rxjs';

import {AppHeaderComponent} from './app-header.component';

import {ThemeService} from '../../../core/services/theme.service';
import {MetadataService} from '../../../core/services/metadata.service';

import {DEFAULT_DASHBOARD_CONFIG} from '../../../core/models/dashboard.models';

describe('AppHeader', () => {
  const setup = async (toggleThemeMock?: Mock): Promise<void> => {
    await render(AppHeaderComponent, {
      imports: [CommonModule],
      providers: [
        {
          provide: ThemeService,
          useValue: {
            isDarkMode: () => true,
            toggleTheme: toggleThemeMock || vi.fn(),
          }
        },
        {
          provide: MetadataService,
          useValue: {
            metadata$: of(DEFAULT_DASHBOARD_CONFIG.metadata)
          }
        }
      ]
    })
  };

  describe('initial state', () => {
    it('should render', async () => {
      await setup();

      expect(screen.queryByAltText('getMando')).toBeInTheDocument();
      expect(screen.queryByText(DEFAULT_DASHBOARD_CONFIG.metadata.title)).toBeInTheDocument();
      expect(screen.queryByText(DEFAULT_DASHBOARD_CONFIG.metadata.description)).toBeInTheDocument();
      expect(screen.queryByRole('button')).toBeInTheDocument();
    })
  })
})
