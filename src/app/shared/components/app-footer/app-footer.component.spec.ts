import { render, screen } from '@testing-library/angular';
import { CommonModule } from '@angular/common';

import { AppFooterComponent } from './app-footer.component';

import { AppService } from '../../../core/services/app.service';

describe('AppFooter', () => {
  const setup = async (appVersion = '9.9.9'): Promise<void> => {
    await render(AppFooterComponent, {
      imports: [CommonModule],
      providers: [{ provide: AppService, useValue: { appVersion } }],
    });
  };

  it('links the "Mando" credit to the landing page in a new tab', async () => {
    await setup();

    const link = screen.getByRole('link', { name: 'Mando' });
    expect(link).toHaveAttribute('href', 'https://getmando.rackandhost.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('keeps a space between the "Mando" link and the version', async () => {
    await setup('9.9.9');

    expect(screen.getByRole('contentinfo')).toHaveTextContent('Powered by Mando v9.9.9');
  });
});
