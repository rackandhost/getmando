import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { DEFAULT_DASHBOARD_SEARCH_ENGINES } from '../../../core/models/dashboard.models';
import { expectNoAxeViolations } from '../../../../testing/a11y';
import { AppSearchEngineSelectorComponent } from './app-search-engine-selector.component';

describe('AppSearchEngineSelectorComponent', () => {
  const googleEngine = DEFAULT_DASHBOARD_SEARCH_ENGINES[0];
  const duckDuckGoEngine = DEFAULT_DASHBOARD_SEARCH_ENGINES[1];

  it('should disable the trigger when no engine options are available', async () => {
    const user = userEvent.setup();

    await render(AppSearchEngineSelectorComponent, {
      inputs: { engines: [] },
    });

    const trigger = screen.getByRole('button', { name: 'Select search engine' });

    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox', { name: 'Search engines' })).not.toBeInTheDocument();
  });

  it('should expose available engines and emit the selected engine', async () => {
    const user = userEvent.setup();
    const engineSelected = vi.fn();

    await render(AppSearchEngineSelectorComponent, {
      inputs: { engines: [googleEngine] },
      on: { engineSelected },
    });

    await user.click(screen.getByRole('button', { name: 'Select search engine' }));
    await user.click(screen.getByRole('option', { name: googleEngine.name }));

    expect(engineSelected).toHaveBeenCalledWith(googleEngine);
    expect(screen.queryByRole('listbox', { name: 'Search engines' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select search engine' })).toHaveFocus();
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('should emit local search selection with %s and restore trigger focus', async (_, key) => {
    const user = userEvent.setup();
    const engineSelected = vi.fn();

    await render(AppSearchEngineSelectorComponent, {
      inputs: { engines: [googleEngine], selectedEngine: googleEngine },
      on: { engineSelected },
    });

    await user.click(screen.getByRole('button', { name: 'Select search engine' }));
    await user.keyboard('{Home}');
    await user.keyboard(key);

    expect(engineSelected).toHaveBeenCalledWith(null);
    expect(screen.queryByRole('listbox', { name: 'Search engines' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select search engine' })).toHaveFocus();
  });

  it('should expose the actual selected option to assistive technology', async () => {
    const user = userEvent.setup();

    await render(AppSearchEngineSelectorComponent, {
      inputs: {
        engines: [googleEngine, duckDuckGoEngine],
        selectedEngine: googleEngine,
      },
    });

    await user.click(screen.getByRole('button', { name: 'Select search engine' }));

    expect(screen.getByRole('option', { name: 'Search on your apps' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('option', { name: googleEngine.name, selected: true })).toHaveFocus();
    expect(screen.getByRole('option', { name: duckDuckGoEngine.name })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('should navigate options with Arrow keys, Home, and End', async () => {
    const user = userEvent.setup();

    await render(AppSearchEngineSelectorComponent, {
      inputs: { engines: [googleEngine, duckDuckGoEngine] },
    });

    const trigger = screen.getByRole('button', { name: 'Select search engine' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');

    const localOption = screen.getByRole('option', { name: 'Search on your apps' });
    const googleOption = screen.getByRole('option', { name: googleEngine.name });
    const duckDuckGoOption = screen.getByRole('option', { name: duckDuckGoEngine.name });

    expect(localOption).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(googleOption).toHaveFocus();

    await user.keyboard('{End}');
    expect(duckDuckGoOption).toHaveFocus();

    await user.keyboard('{Home}');
    expect(localOption).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(duckDuckGoOption).toHaveFocus();
  });

  it('should remain open when focus moves between options', async () => {
    const user = userEvent.setup();

    await render(AppSearchEngineSelectorComponent, {
      inputs: { engines: [googleEngine, duckDuckGoEngine] },
    });

    const trigger = screen.getByRole('button', { name: 'Select search engine' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('option', { name: googleEngine.name })).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox', { name: 'Search engines' })).toBeInTheDocument();
  });

  it('should close when Tab moves focus outside the selector', async () => {
    const user = userEvent.setup();
    const externalButton = document.createElement('button');
    externalButton.textContent = 'External control';

    try {
      await render(AppSearchEngineSelectorComponent, {
        inputs: { engines: [googleEngine] },
      });
      document.body.append(externalButton);

      const trigger = screen.getByRole('button', { name: 'Select search engine' });
      trigger.focus();
      await user.keyboard('{ArrowDown}');
      await user.tab();

      expect(externalButton).toHaveFocus();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox', { name: 'Search engines' })).not.toBeInTheDocument();
    } finally {
      externalButton.remove();
    }
  });

  it('should close with Escape and restore focus to the trigger', async () => {
    const user = userEvent.setup();

    await render(AppSearchEngineSelectorComponent, {
      inputs: { engines: [googleEngine] },
    });

    const trigger = screen.getByRole('button', { name: 'Select search engine' });
    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox', { name: 'Search engines' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('should have no accessibility violations when open', async () => {
    const user = userEvent.setup();
    const view = await render(AppSearchEngineSelectorComponent, {
      inputs: { engines: [googleEngine] },
    });

    await user.click(screen.getByRole('button', { name: 'Select search engine' }));

    await expectNoAxeViolations(view.container);
  });
});
