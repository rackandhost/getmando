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

    const trigger = screen.getByRole('button', { name: /^Select search engine/ });

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

    await user.click(screen.getByRole('button', { name: /^Select search engine/ }));
    await user.click(screen.getByRole('option', { name: googleEngine.name }));

    expect(engineSelected).toHaveBeenCalledWith(googleEngine);
    expect(screen.queryByRole('listbox', { name: 'Search engines' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Select search engine/ })).toHaveFocus();
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

    await user.click(screen.getByRole('button', { name: /^Select search engine/ }));
    await user.keyboard('{Home}');
    await user.keyboard(key);

    expect(engineSelected).toHaveBeenCalledWith(null);
    expect(screen.queryByRole('listbox', { name: 'Search engines' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Select search engine/ })).toHaveFocus();
  });

  it('should expose the actual selected option to assistive technology', async () => {
    const user = userEvent.setup();

    await render(AppSearchEngineSelectorComponent, {
      inputs: {
        engines: [googleEngine, duckDuckGoEngine],
        selectedEngine: googleEngine,
      },
    });

    await user.click(screen.getByRole('button', { name: /^Select search engine/ }));

    expect(screen.getByRole('option', { name: 'Your apps' })).toHaveAttribute(
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

    const trigger = screen.getByRole('button', { name: /^Select search engine/ });
    trigger.focus();
    await user.keyboard('{ArrowDown}');

    const localOption = screen.getByRole('option', { name: 'Your apps' });
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

    const trigger = screen.getByRole('button', { name: /^Select search engine/ });
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

      const trigger = screen.getByRole('button', { name: /^Select search engine/ });
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

    const trigger = screen.getByRole('button', { name: /^Select search engine/ });
    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox', { name: 'Search engines' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  describe('trigger button', () => {
    it('shows the magnifier, the Apps scope and a chevron, all decorative except the label', async () => {
      await render(AppSearchEngineSelectorComponent, {
        inputs: { engines: [googleEngine] },
      });

      const trigger = screen.getByRole('button', { name: /^Select search engine/ });

      expect(trigger).toHaveTextContent('Apps');
      expect(trigger.querySelector('[name="heroMagnifyingGlass"]')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
      expect(trigger.querySelector('[name="heroChevronDown"]')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    });

    it('shows the selected engine name instead of Apps, keeping the magnifier', async () => {
      await render(AppSearchEngineSelectorComponent, {
        inputs: { engines: [googleEngine], selectedEngine: googleEngine },
      });

      const trigger = screen.getByRole('button', { name: /^Select search engine/ });

      expect(trigger).toHaveTextContent(googleEngine.name);
      expect(trigger).not.toHaveTextContent('Apps');
      expect(trigger.querySelector('[name="heroMagnifyingGlass"]')).not.toBeNull();
    });

    it.each([
      ['Apps scope', null, 'Select search engine, Apps'],
      ['an engine', googleEngine, `Select search engine, ${googleEngine.name}`],
    ])('has an accessible name that contains its visible label for %s', async (_, engine, name) => {
      await render(AppSearchEngineSelectorComponent, {
        inputs: { engines: [googleEngine], selectedEngine: engine },
      });

      const trigger = screen.getByRole('button', { name: /^Select search engine/ });
      const visibleLabel = trigger.textContent?.trim() ?? '';

      expect(trigger).toHaveAccessibleName(name);
      expect(trigger.getAttribute('aria-label')).toContain(visibleLabel);
    });
  });

  describe('options', () => {
    it('lists Your apps first, then the enabled engines', async () => {
      const user = userEvent.setup();
      await render(AppSearchEngineSelectorComponent, {
        inputs: { engines: [googleEngine, duckDuckGoEngine] },
      });

      await user.click(screen.getByRole('button', { name: /^Select search engine/ }));

      const options = screen.getAllByRole('option');

      expect(options).toHaveLength(3);
      expect(options[0]).toHaveAccessibleName('Your apps');
      expect(options[1]).toHaveAccessibleName(googleEngine.name);
      expect(options[2]).toHaveAccessibleName(duckDuckGoEngine.name);
    });

    it.each([
      ['Your apps', undefined],
      [googleEngine.name, googleEngine],
    ])('marks only %s with a check when it is the selected scope', async (name, selected) => {
      const user = userEvent.setup();
      await render(AppSearchEngineSelectorComponent, {
        inputs: { engines: [googleEngine, duckDuckGoEngine], selectedEngine: selected ?? null },
      });

      await user.click(screen.getByRole('button', { name: /^Select search engine/ }));

      const checked = screen
        .getAllByRole('option')
        .filter((option) => option.querySelector('[name="heroCheck"]'));

      expect(checked).toHaveLength(1);
      expect(checked[0]).toHaveAccessibleName(name);
      expect(checked[0]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('keyboard and dismissal', () => {
    it.each([
      ['Enter', '{Enter}'],
      ['Space', ' '],
    ])('opens with %s, moves with the arrows and selects with Enter', async (_, openKey) => {
      const user = userEvent.setup();
      const engineSelected = vi.fn();
      await render(AppSearchEngineSelectorComponent, {
        inputs: { engines: [googleEngine, duckDuckGoEngine] },
        on: { engineSelected },
      });

      const trigger = screen.getByRole('button', { name: /^Select search engine/ });
      trigger.focus();
      await user.keyboard(openKey);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('option', { name: 'Your apps' })).toHaveFocus();

      await user.keyboard('{ArrowDown}{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(engineSelected).toHaveBeenCalledExactlyOnceWith(duckDuckGoEngine);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveFocus();
    });

    it('closes on an outside click without changing the engine', async () => {
      const user = userEvent.setup();
      const engineSelected = vi.fn();
      const outside = document.createElement('button');
      outside.textContent = 'Outside';

      try {
        await render(AppSearchEngineSelectorComponent, {
          inputs: { engines: [googleEngine], selectedEngine: googleEngine },
          on: { engineSelected },
        });
        document.body.append(outside);

        await user.click(screen.getByRole('button', { name: /^Select search engine/ }));
        expect(screen.getByRole('listbox', { name: 'Search engines' })).toBeInTheDocument();

        await user.click(outside);

        expect(screen.queryByRole('listbox', { name: 'Search engines' })).not.toBeInTheDocument();
        expect(engineSelected).not.toHaveBeenCalled();
      } finally {
        outside.remove();
      }
    });

    it('closes with Escape while focus is still on the trigger (menu opened by mouse)', async () => {
      const user = userEvent.setup();
      const engineSelected = vi.fn();
      await render(AppSearchEngineSelectorComponent, {
        inputs: { engines: [googleEngine], selectedEngine: googleEngine },
        on: { engineSelected },
      });

      const trigger = screen.getByRole('button', { name: /^Select search engine/ });
      await user.click(trigger);
      trigger.focus();
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('listbox', { name: 'Search engines' })).not.toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(engineSelected).not.toHaveBeenCalled();
    });

    it('closes with Escape without emitting and keeps the previous engine', async () => {
      const user = userEvent.setup();
      const engineSelected = vi.fn();
      await render(AppSearchEngineSelectorComponent, {
        inputs: { engines: [googleEngine, duckDuckGoEngine], selectedEngine: googleEngine },
        on: { engineSelected },
      });

      const trigger = screen.getByRole('button', { name: /^Select search engine/ });
      await user.click(trigger);
      await user.keyboard('{ArrowDown}{Escape}');

      expect(engineSelected).not.toHaveBeenCalled();
      expect(trigger).toHaveTextContent(googleEngine.name);
      expect(trigger).toHaveFocus();
    });
  });

  it('should have no accessibility violations when open', async () => {
    const user = userEvent.setup();
    const view = await render(AppSearchEngineSelectorComponent, {
      inputs: { engines: [googleEngine] },
    });

    await user.click(screen.getByRole('button', { name: /^Select search engine/ }));

    await expectNoAxeViolations(view.container);
  });
});
