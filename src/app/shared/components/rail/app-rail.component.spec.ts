import { render, screen } from '@testing-library/angular';

import { expectNoAxeViolations } from '../../../../testing/a11y';

import { AppRailComponent } from './app-rail.component';

describe('AppRailComponent', () => {
  const setup = (label = 'Dashboard') =>
    render(
      `<app-rail label="${label}">
        <p>brand</p>
        <p data-rail-anchor>search</p>
        <p>actions</p>
      </app-rail>`,
      { imports: [AppRailComponent] },
    );

  it('is a complementary landmark named by its label', async () => {
    await setup('Configurator');

    expect(screen.getByRole('complementary', { name: 'Configurator' })).toBeInTheDocument();
  });

  it('renders what it is given inside the landmark, in order', async () => {
    await setup();

    const rail = screen.getByRole('complementary', { name: 'Dashboard' });

    expect(Array.from(rail.children, (child) => child.textContent?.trim())).toEqual([
      'brand',
      'search',
      'actions',
    ]);
  });

  it('has no accessibility violations', async () => {
    const { container } = await setup();

    await expectNoAxeViolations(container);
  });
});
