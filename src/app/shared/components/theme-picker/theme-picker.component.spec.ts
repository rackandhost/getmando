import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { ThemeService } from '../../../core/services/theme.service';
import { THEMES, type ThemeId } from '../../../core/themes/theme.registry';
import { expectNoAxeViolations } from '../../../../testing/a11y';
import { themeServiceStub } from '../../../../testing/theme-service.stub';

import { ThemePickerComponent } from './theme-picker.component';

describe('ThemePickerComponent', () => {
  const setup = async (committed: ThemeId = 'dark') => {
    const user = userEvent.setup();
    const theme = themeServiceStub(committed);
    const view = await render(ThemePickerComponent, {
      providers: [{ provide: ThemeService, useValue: theme }],
    });
    return { ...view, user, theme };
  };
  const trigger = () => screen.getByRole('button', { name: /^Change theme/ });
  const dialog = () => screen.getByRole('dialog', { name: 'Choose a theme' });
  const search = () => screen.getByRole('combobox', { name: 'Search themes' });
  const options = () => screen.queryAllByRole('option');
  const optionNames = () =>
    options().map((candidate) =>
      document.getElementById(candidate.getAttribute('aria-labelledby') ?? '')?.textContent?.trim(),
    );
  const option = (name: string) => screen.getByRole('option', { name });
  const setupOpen = async (committed: ThemeId = 'dark') => {
    const view = await setup(committed);
    await view.user.click(trigger());
    return view;
  };

  describe('trigger', () => {
    it('is an icon-only button that names the committed theme and announces a dialog', async () => {
      await setup('dark');

      expect(trigger()).toHaveAccessibleName('Change theme, current: Dark');
      expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
      expect(trigger()).toHaveAttribute('aria-expanded', 'false');
      expect(trigger()).toHaveAttribute('title', 'Theme');
      expect(trigger().textContent?.trim()).toBe('');
      expect(trigger().querySelector('ng-icon')).toHaveAttribute('aria-hidden', 'true');
      expect(trigger()).not.toHaveAttribute('aria-keyshortcuts');
    });

    it.each(THEMES.map((theme) => [theme.id, theme.name] as const))(
      'names %s as the current theme: %s',
      async (id, name) => {
        await setup(id);

        expect(trigger()).toHaveAccessibleName(`Change theme, current: ${name}`);
      },
    );

    it('keeps the dialog out of the accessibility tree until the button opens it', async () => {
      await setup();

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByRole('combobox')).toBeNull();
    });
  });

  describe('opening', () => {
    it('opens a modal dialog named "Choose a theme" with the focus in the search field', async () => {
      await setupOpen();

      expect(dialog()).toBeVisible();
      expect(trigger()).toHaveAttribute('aria-expanded', 'true');
      expect(search()).toHaveFocus();
      expect(search()).toHaveAttribute('placeholder', 'Search themes…');
      expect(search()).toHaveValue('');
    });

    it('lists every registered theme, in registry order, in a listbox named "Themes"', async () => {
      await setupOpen();

      const list = within(dialog()).getByRole('listbox', { name: 'Themes' });
      expect(within(list).getAllByRole('option')).toHaveLength(THEMES.length);
      expect(optionNames()).toEqual(THEMES.map((theme) => theme.name));
      expect(search()).toHaveAttribute('aria-controls', list.id);
      expect(search()).toHaveAttribute('aria-expanded', 'true');
    });

    it('shows each option with a decorative swatch, its name and its description', async () => {
      await setupOpen();

      for (const theme of THEMES) {
        const row = option(theme.name);
        expect(row).toHaveTextContent(theme.description);
        expect(row.querySelector('[data-theme-preview]')).toHaveAttribute('aria-hidden', 'true');
      }
    });

    it.each(THEMES.map((theme) => theme.id))(
      'highlights the committed theme (%s) and marks only it Active',
      async (id) => {
        await setupOpen(id);

        for (const theme of THEMES) {
          const row = option(theme.name);
          expect(row).toHaveAttribute('aria-selected', String(theme.id === id));
          expect(row).toHaveAccessibleDescription(
            theme.id === id ? `${theme.description} Active` : theme.description,
          );
        }
        expect(screen.getAllByText('Active')).toHaveLength(1);
      },
    );

    it('has a Close button drawn ESC and the hint line', async () => {
      await setupOpen();

      expect(within(dialog()).getByRole('button', { name: 'Close' })).toHaveTextContent('ESC');
      expect(dialog()).toHaveTextContent('↑ ↓ preview');
      expect(dialog()).toHaveTextContent('↵ apply');
      expect(dialog()).toHaveTextContent('esc cancel');
    });
  });

  describe('filtering', () => {
    it('leaves only Catppuccin Mocha for "moc" and highlights it', async () => {
      const { user } = await setupOpen('dark');

      await user.type(search(), 'moc');

      expect(optionNames()).toEqual(['Catppuccin Mocha']);
      expect(option('Catppuccin Mocha')).toHaveAttribute('aria-selected', 'true');
    });

    it('ignores case', async () => {
      const { user } = await setupOpen();

      await user.type(search(), 'MoC');

      expect(optionNames()).toEqual(['Catppuccin Mocha']);
    });

    it('also searches the description', async () => {
      const { user } = await setupOpen();

      await user.type(search(), 'pastel');
      expect(optionNames()).toEqual(['Catppuccin Mocha']);

      await user.clear(search());
      await user.type(search(), 'mando default');
      expect(optionNames()).toEqual(['Dark', 'Light']);
    });

    it('marks Active only on the committed theme, so a filter that hides it shows no marker', async () => {
      const { user } = await setupOpen('catppuccin-mocha');

      await user.type(search(), 'light');

      expect(optionNames()).toEqual(['Light']);
      expect(screen.queryByText('Active')).toBeNull();
    });

    it('moves the highlight to the first match when the filter changes', async () => {
      const { user } = await setupOpen('light');
      expect(option('Light')).toHaveAttribute('aria-selected', 'true');

      await user.type(search(), 'mando');

      expect(optionNames()).toEqual(['Dark', 'Light']);
      expect(option('Dark')).toHaveAttribute('aria-selected', 'true');
      expect(option('Light')).toHaveAttribute('aria-selected', 'false');
      expect(search()).toHaveAttribute('aria-activedescendant', option('Dark').id);
    });

    it('shows "No themes match your search." and no option when nothing matches', async () => {
      const { user } = await setupOpen();

      await user.type(search(), 'zzz');

      expect(screen.getByText('No themes match your search.')).toBeVisible();
      expect(options()).toHaveLength(0);
      expect(search()).not.toHaveAttribute('aria-activedescendant');
    });

    it('changes nothing on Enter when nothing matches', async () => {
      const { user, theme } = await setupOpen();

      await user.type(search(), 'zzz');
      await user.keyboard('{Enter}');

      expect(theme.select).not.toHaveBeenCalled();
      expect(dialog()).toBeVisible();
    });
  });

  describe('committing', () => {
    it('stores the clicked theme, closes the dialog and returns the focus to the button', async () => {
      const { user, theme } = await setupOpen('dark');

      await user.click(option('Light'));

      expect(theme.select).toHaveBeenCalledExactlyOnceWith('light');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(trigger()).toHaveFocus();
      expect(trigger()).toHaveAttribute('aria-expanded', 'false');
      expect(trigger()).toHaveAccessibleName('Change theme, current: Light');
    });

    it('stores the highlighted theme on Enter, closes and returns the focus to the button', async () => {
      const { user, theme } = await setupOpen('dark');

      await user.type(search(), 'moc');
      await user.keyboard('{Enter}');

      expect(theme.select).toHaveBeenCalledExactlyOnceWith('catppuccin-mocha');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(trigger()).toHaveFocus();
    });

    it('stores the committed theme when Enter is pressed straight away', async () => {
      const { user, theme } = await setupOpen('light');

      await user.keyboard('{Enter}');

      expect(theme.select).toHaveBeenCalledExactlyOnceWith('light');
    });
  });

  describe('closing without a choice', () => {
    it('closes on Escape, stores nothing and returns the focus to the button', async () => {
      const { user, theme } = await setupOpen();

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(theme.select).not.toHaveBeenCalled();
      expect(trigger()).toHaveFocus();
      expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes on the Close button, stores nothing and returns the focus to the button', async () => {
      const { user, theme } = await setupOpen();

      await user.click(within(dialog()).getByRole('button', { name: 'Close' }));

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(theme.select).not.toHaveBeenCalled();
      expect(trigger()).toHaveFocus();
    });

    it('opens again clean: empty search, every theme listed, the committed one highlighted', async () => {
      const { user } = await setupOpen('light');

      await user.type(search(), 'moc');
      await user.keyboard('{Escape}');
      await user.click(trigger());

      expect(search()).toHaveValue('');
      expect(optionNames()).toEqual(THEMES.map((theme) => theme.name));
      expect(option('Light')).toHaveAttribute('aria-selected', 'true');
      expect(search()).toHaveFocus();
    });
  });

  describe('accessibility', () => {
    it('keeps Tab inside the dialog: it cycles between the search field and Close', async () => {
      const { user } = await setupOpen();
      const close = within(dialog()).getByRole('button', { name: 'Close' });
      expect(search()).toHaveFocus();

      await user.tab();
      expect(close).toHaveFocus();
      await user.tab();
      expect(search()).toHaveFocus();
      await user.tab();
      expect(close).toHaveFocus();
    });

    it('keeps Shift+Tab inside the dialog: it cycles backwards without reaching the button', async () => {
      const { user } = await setupOpen();
      const close = within(dialog()).getByRole('button', { name: 'Close' });

      await user.tab({ shift: true });
      expect(close).toHaveFocus();
      await user.tab({ shift: true });
      expect(search()).toHaveFocus();
      await user.tab({ shift: true });
      expect(close).toHaveFocus();
      expect(trigger()).not.toHaveFocus();
    });

    it('points aria-activedescendant at the highlighted option', async () => {
      const { user } = await setupOpen('light');

      expect(search()).toHaveAttribute('aria-activedescendant', option('Light').id);

      await user.type(search(), 'moc');

      expect(search()).toHaveAttribute('aria-activedescendant', option('Catppuccin Mocha').id);
    });

    it('gives every option its own id and exposes aria-selected on the highlighted one only', async () => {
      await setupOpen('dark');

      const ids = options().map((candidate) => candidate.id);
      expect(new Set(ids).size).toBe(THEMES.length);
      expect(ids.every((id) => id !== '')).toBe(true);
      expect(
        options()
          .filter((candidate) => candidate.getAttribute('aria-selected') === 'true')
          .map((candidate) => candidate.id),
      ).toEqual([option('Dark').id]);
    });

    it('keeps every id unique when two pickers are on the page', async () => {
      await render('<app-theme-picker /><app-theme-picker />', {
        imports: [ThemePickerComponent],
        providers: [{ provide: ThemeService, useValue: themeServiceStub() }],
      });

      const ids = [...document.querySelectorAll('[id]')].map((node) => node.id);
      expect(ids.length).toBeGreaterThan(THEMES.length * 2);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('has no axe violations while closed', async () => {
      const { container } = await setup();

      await expectNoAxeViolations(container);
    });

    it.each(THEMES.map((theme) => theme.id))(
      'has no axe violations with the dialog open in %s',
      async (id) => {
        const { container } = await setupOpen(id);

        await expectNoAxeViolations(container);
      },
    );

    it('has no axe violations in the empty state', async () => {
      const { user, container } = await setupOpen();

      await user.type(search(), 'zzz');

      await expectNoAxeViolations(container);
    });
  });
});
