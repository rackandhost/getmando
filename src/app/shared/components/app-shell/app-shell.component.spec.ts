import { render, screen } from '@testing-library/angular';

import { AppShellComponent } from './app-shell.component';

import { AppService } from '../../../core/services/app.service';
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
});
