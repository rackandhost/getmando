import { signal, type WritableSignal } from '@angular/core';
import { render, screen } from '@testing-library/angular';

import { AppShellComponent } from './app-shell.component';

import { AppService } from '../../../core/services/app.service';
import { SettingsService } from '../../../core/services/settings.service';
import type { DashboardLayout } from '../../../core/models/dashboard.models';
import { expectNoAxeViolations } from '../../../../testing/a11y';

describe('AppShell', () => {
  const setup = () =>
    render(
      '<app-shell><header>Page header</header><main><p>Routed content</p></main></app-shell>',
      {
        imports: [AppShellComponent],
        providers: [{ provide: AppService, useValue: { appVersion: '9.9.9' } }],
      },
    );

  it('puts the footer after the routed content, outside of it', async () => {
    await setup();

    const main = screen.getByRole('main');
    const footer = screen.getByRole('contentinfo');

    expect(main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(main).not.toContainElement(footer);
    expect(footer.nextElementSibling).toBeNull();
  });

  it('keeps the routed content and the footer as siblings in one page container', async () => {
    await setup();

    const main = screen.getByRole('main');
    const footer = screen.getByRole('contentinfo');

    expect(footer.closest('app-footer')?.parentElement).toBe(main.parentElement);
  });

  it('does not render the page header: each view renders its own so the dock can wrap it', async () => {
    await setup();

    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getByRole('banner')).toHaveTextContent('Page header');
    expect(document.querySelector('app-header')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = await setup();

    await expectNoAxeViolations(container);
  });

  describe('layout', () => {
    const setupWithLayout = (layout: WritableSignal<DashboardLayout>) =>
      render(
        '<app-shell><header>Page header</header><main><p>Routed content</p></main></app-shell>',
        {
          imports: [AppShellComponent],
          providers: [
            { provide: AppService, useValue: { appVersion: '9.9.9' } },
            { provide: SettingsService, useValue: { layout } },
          ],
        },
      );

    it('keeps the footer bar in the horizontal layout', async () => {
      await setupWithLayout(signal<DashboardLayout>('horizontal'));

      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    it('renders no footer bar in the vertical layout, only the routed content', async () => {
      await setupWithLayout(signal<DashboardLayout>('vertical'));

      expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
      expect(screen.getByRole('main')).toHaveTextContent('Routed content');
      expect(screen.getByRole('banner')).toHaveTextContent('Page header');
    });

    it('adds or removes the footer bar when the layout changes while the page is open', async () => {
      const layout = signal<DashboardLayout>('horizontal');
      const { fixture } = await setupWithLayout(layout);

      layout.set('vertical');
      fixture.detectChanges();

      expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();

      layout.set('horizontal');
      fixture.detectChanges();

      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    it('has no accessibility violations in the vertical layout', async () => {
      const { container } = await setupWithLayout(signal<DashboardLayout>('vertical'));

      await expectNoAxeViolations(container);
    });
  });
});
