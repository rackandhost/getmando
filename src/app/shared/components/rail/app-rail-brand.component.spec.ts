import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';

import { MetadataService } from '../../../core/services/metadata.service';
import { expectNoAxeViolations } from '../../../../testing/a11y';

import { AppRailBrandComponent } from './app-rail-brand.component';

describe('AppRailBrandComponent', () => {
  const setup = (
    metadata: { title: string; description: string } | null = {
      title: 'My dashboard',
      description: 'Simply and lovelly',
    },
    inputs: { asHeading?: boolean } = {},
  ) =>
    render(AppRailBrandComponent, {
      inputs,
      providers: [
        { provide: MetadataService, useValue: { metadata: signal(metadata ?? undefined) } },
      ],
    });

  it('shows the title and the description from the YAML metadata', async () => {
    await setup();

    expect(screen.getByRole('heading', { level: 1, name: 'My dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Simply and lovelly')).toBeInTheDocument();
  });

  it('falls back to the default title and description without metadata', async () => {
    await setup(null);

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Your selfhosted applications')).toBeInTheDocument();
  });

  it('renders the logo with the name of the app', async () => {
    await setup();

    expect(screen.getByAltText('getMando')).toBeInTheDocument();
  });

  it('shows the title as plain text, not a heading, when the page has its own h1', async () => {
    await setup(null, { asHeading: false });

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = await setup();

    await expectNoAxeViolations(container);
  });
});
