import { render, screen } from '@testing-library/angular';
import { CommonModule } from '@angular/common';

import { AppFooterComponent } from './app-footer.component';

import { AppService } from '../../../core/services/app.service';
import { expectNoAxeViolations } from '../../../../testing/a11y';

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

  it('links the "Rack&Host" credit to the company site in a new tab', async () => {
    await setup();

    const link = screen.getByRole('link', { name: 'Rack&Host' });
    expect(link).toHaveAttribute('href', 'https://rackandhost.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('names the heart glyph "love" and reads the credit line in order', async () => {
    await setup();

    expect(screen.getByRole('img', { name: 'love' })).toHaveTextContent('♡');
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/Created with ♡ by Rack&Host \d{4}/);
  });

  describe('year', () => {
    afterEach(() => vi.useRealTimers());

    it('shows the current year', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2031-03-04T12:00:00') });
      await setup();

      expect(screen.getByRole('contentinfo')).toHaveTextContent('by Rack&Host 2031');
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = await render(AppFooterComponent, {
      imports: [CommonModule],
      providers: [{ provide: AppService, useValue: { appVersion: '9.9.9' } }],
    });

    await expectNoAxeViolations(container);
  });
});
