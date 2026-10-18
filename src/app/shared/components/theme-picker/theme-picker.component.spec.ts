import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { DEFAULT_DASHBOARD_CONFIG } from '../../../core/models/dashboard.models';
import { LoggerService } from '../../../core/services/logger.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SettingsService } from '../../../core/services/settings.service';
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

    it('does not preview the committed theme: opening leaves the service without a preview', async () => {
      const { theme } = await setupOpen('dark');

      expect(theme.preview).not.toHaveBeenCalled();
    });

    it('goes back to no preview, not to a preview of the committed theme, when the highlight returns to it', async () => {
      const { user, theme } = await setupOpen('dark');

      await user.keyboard('{ArrowDown}');
      expect(theme.preview).toHaveBeenCalledExactlyOnceWith('light');
      theme.cancelPreview.mockClear();

      await user.keyboard('{ArrowUp}');

      expect(theme.cancelPreview).toHaveBeenCalled();
      expect(theme.preview).toHaveBeenCalledTimes(1);
    });

    it('does not preview the committed theme when the pointer rests on its row', async () => {
      const { user, theme } = await setupOpen('light');

      await user.hover(option('Dark'));
      theme.preview.mockClear();
      await user.hover(option('Light'));

      expect(theme.preview).not.toHaveBeenCalled();
      expect(theme.theme()).toBe('light');
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

    it.each([
      ['Escape', () => userEvent.keyboard('{Escape}')],
      [
        'the Close button',
        () => userEvent.click(within(dialog()).getByRole('button', { name: 'Close' })),
      ],
      ['a choice', () => userEvent.click(option('Light'))],
    ])('returns the focus to the button without scrolling the page on %s', async (_way, close) => {
      await setupOpen();
      const focus = vi.spyOn(trigger(), 'focus');

      await close();

      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
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

  /** Previewing is a state of `ThemeService`, so these run against the real one over a fake settings source. */
  describe('previewing and cancelling', () => {
    const root = document.documentElement;
    const storedTheme = () => localStorage.getItem('dashboard-theme');
    const setupPreview = async (committed: ThemeId = 'dark') => {
      localStorage.clear();
      const user = userEvent.setup();
      const view = await render(ThemePickerComponent, {
        providers: [
          {
            provide: SettingsService,
            useValue: {
              settings: signal({ ...DEFAULT_DASHBOARD_CONFIG.settings, theme: committed }),
            },
          },
          { provide: LoggerService, useValue: { warn: vi.fn() } },
          { provide: NotificationService, useValue: { warning: vi.fn() } },
        ],
      });
      const themes = TestBed.inject(ThemeService);
      await user.click(trigger());
      TestBed.flushEffects();
      return { ...view, user, themes };
    };

    afterEach(() => {
      localStorage.clear();
      root.removeAttribute('data-theme');
    });

    it('shows the committed theme when it opens, and stores nothing', async () => {
      const { themes } = await setupPreview('light');

      expect(themes.theme()).toBe('light');
      expect(storedTheme()).toBeNull();
    });

    it('previews the next theme on ArrowDown without committing or storing it', async () => {
      const { user, themes } = await setupPreview('dark');

      await user.keyboard('{ArrowDown}');
      TestBed.flushEffects();

      expect(option('Light')).toHaveAttribute('aria-selected', 'true');
      expect(themes.theme()).toBe('light');
      expect(themes.committed()).toBe('dark');
      expect(root.dataset['theme']).toBe('light');
      expect(storedTheme()).toBeNull();
    });

    it('previews the previous theme on ArrowUp', async () => {
      const { user, themes } = await setupPreview('light');

      await user.keyboard('{ArrowUp}');

      expect(option('Dark')).toHaveAttribute('aria-selected', 'true');
      expect(themes.theme()).toBe('dark');
    });

    it('wraps from the last theme to the first on ArrowDown, and back on ArrowUp', async () => {
      const { user, themes } = await setupPreview('catppuccin-mocha');

      await user.keyboard('{ArrowDown}');
      expect(option('Dark')).toHaveAttribute('aria-selected', 'true');
      expect(themes.theme()).toBe('dark');

      await user.keyboard('{ArrowUp}');
      expect(option('Catppuccin Mocha')).toHaveAttribute('aria-selected', 'true');
      expect(themes.theme()).toBe('catppuccin-mocha');
    });

    it('moves only through the rows the filter leaves', async () => {
      const { user, themes } = await setupPreview('dark');

      await user.type(search(), 'mando');
      await user.keyboard('{ArrowDown}{ArrowDown}');

      expect(option('Dark')).toHaveAttribute('aria-selected', 'true');
      expect(themes.theme()).toBe('dark');
    });

    it('previews the first match as the filter changes, and the committed theme when nothing matches', async () => {
      const { user, themes } = await setupPreview('dark');

      await user.type(search(), 'moc');
      expect(themes.theme()).toBe('catppuccin-mocha');

      await user.clear(search());
      await user.type(search(), 'zzz');
      await user.keyboard('{ArrowDown}{ArrowUp}');
      expect(themes.theme()).toBe('dark');
    });

    it('keeps the highlighted option in view when the arrows move it', async () => {
      const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
      const { user } = await setupPreview('dark');

      await user.keyboard('{ArrowDown}');

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
      expect(scrollIntoView.mock.contexts.at(-1)).toBe(option('Light'));
    });

    it('brings the committed row into view when it opens, even after a filter hid it last time', async () => {
      const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
      const { user } = await setupPreview('catppuccin-mocha');
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
      expect(scrollIntoView.mock.contexts.at(-1)).toBe(option('Catppuccin Mocha'));

      await user.type(search(), 'dark');
      await user.keyboard('{Escape}');
      scrollIntoView.mockClear();
      await user.click(trigger());

      expect(scrollIntoView.mock.contexts.at(-1)).toBe(option('Catppuccin Mocha'));
    });

    it('previews the hovered row and leaves it highlighted when the pointer moves on', async () => {
      const { user, themes } = await setupPreview('dark');

      await user.hover(option('Catppuccin Mocha'));
      expect(option('Catppuccin Mocha')).toHaveAttribute('aria-selected', 'true');
      expect(themes.theme()).toBe('catppuccin-mocha');
      expect(themes.committed()).toBe('dark');

      await user.hover(option('Light'));
      expect(themes.theme()).toBe('light');
      expect(storedTheme()).toBeNull();
    });

    it('keeps the button named after the committed theme while another is previewed', async () => {
      const { user } = await setupPreview('dark');

      await user.keyboard('{ArrowDown}');

      expect(trigger()).toHaveAccessibleName('Change theme, current: Dark');
    });

    it('commits the previewed theme on Enter: stored, applied, dialog closed, focus on the button', async () => {
      const { user, themes } = await setupPreview('dark');

      await user.keyboard('{ArrowDown}{Enter}');

      expect(storedTheme()).toBe('light');
      expect(themes.committed()).toBe('light');
      expect(themes.theme()).toBe('light');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(trigger()).toHaveFocus();
      expect(trigger()).toHaveAccessibleName('Change theme, current: Light');
    });

    it('commits a clicked row after a preview of another', async () => {
      const { user, themes } = await setupPreview('dark');

      await user.hover(option('Light'));
      await user.click(option('Catppuccin Mocha'));

      expect(storedTheme()).toBe('catppuccin-mocha');
      expect(themes.theme()).toBe('catppuccin-mocha');
    });

    it('restores the committed theme on Escape and stores nothing', async () => {
      const { user, themes } = await setupPreview('dark');

      await user.keyboard('{ArrowDown}');
      expect(themes.theme()).toBe('light');
      await user.keyboard('{Escape}');

      expect(themes.theme()).toBe('dark');
      expect(themes.committed()).toBe('dark');
      expect(root.dataset['theme']).toBe('dark');
      expect(storedTheme()).toBeNull();
      expect(trigger()).toHaveFocus();
    });

    it('restores the committed theme on the Close button', async () => {
      const { user, themes } = await setupPreview('dark');

      await user.keyboard('{ArrowDown}');
      await user.click(within(dialog()).getByRole('button', { name: 'Close' }));

      expect(themes.theme()).toBe('dark');
      expect(storedTheme()).toBeNull();
    });

    it('restores the committed theme on a click on the backdrop', async () => {
      const { user, themes } = await setupPreview('dark');

      await user.keyboard('{ArrowDown}');
      await user.click(dialog());

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(themes.theme()).toBe('dark');
      expect(storedTheme()).toBeNull();
      expect(trigger()).toHaveFocus();
    });

    it('does not close when a text selection that began in the search field ends on the backdrop', async () => {
      const { user, themes } = await setupPreview('dark');

      await user.keyboard('{ArrowDown}');
      await user.pointer([
        { keys: '[MouseLeft>]', target: search() },
        { keys: '[/MouseLeft]', target: dialog() },
      ]);

      expect(dialog()).toBeVisible();
      expect(themes.theme()).toBe('light');
    });

    it('does not close on a click inside the dialog', async () => {
      const { user } = await setupPreview('dark');

      await user.click(screen.getByText('Themes'));

      expect(dialog()).toBeVisible();
    });

    it('restores the committed theme when it is destroyed mid-preview', async () => {
      const { user, themes, fixture } = await setupPreview('dark');

      await user.keyboard('{ArrowDown}');
      expect(themes.theme()).toBe('light');
      fixture.destroy();

      expect(themes.theme()).toBe('dark');
      expect(storedTheme()).toBeNull();
    });

    it('previews again when it is reopened, starting from the committed theme', async () => {
      const { user, themes } = await setupPreview('dark');

      await user.keyboard('{ArrowDown}{Escape}');
      await user.click(trigger());

      expect(option('Dark')).toHaveAttribute('aria-selected', 'true');
      expect(themes.theme()).toBe('dark');
    });

    /**
     * The rail renders the picker in two places and shows one of them; a resize can turn the one whose
     * dialog is open into `display: none`. A ResizeObserver on the button reports that as a zero size.
     */
    describe('when its button stops being displayed', () => {
      class FakeResizeObserver {
        static instances: FakeResizeObserver[] = [];
        observed: Element[] = [];
        disconnected = false;
        constructor(public callback: ResizeObserverCallback) {
          FakeResizeObserver.instances.push(this);
        }
        observe(element: Element) {
          this.observed.push(element);
        }
        unobserve() {}
        disconnect() {
          this.disconnected = true;
        }
      }
      const observer = () => FakeResizeObserver.instances.at(-1) as FakeResizeObserver;
      const reportSize = (width: number, height: number) => {
        const entry = { contentRect: { width, height } } as ResizeObserverEntry;
        observer().callback([entry], observer() as unknown as ResizeObserver);
        TestBed.flushEffects();
      };

      beforeEach(() => {
        FakeResizeObserver.instances = [];
        vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('watches the button while the dialog is open', async () => {
        await setupPreview('dark');

        expect(FakeResizeObserver.instances).toHaveLength(1);
        expect(observer().observed).toEqual([trigger()]);
      });

      it('closes, restores the committed theme and stores nothing when the button is no longer displayed', async () => {
        const { user, themes } = await setupPreview('dark');

        await user.keyboard('{ArrowDown}');
        expect(themes.theme()).toBe('light');
        reportSize(0, 0);

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(trigger()).toHaveAttribute('aria-expanded', 'false');
        expect(themes.theme()).toBe('dark');
        expect(storedTheme()).toBeNull();
      });

      it('stays open, still previewing, while the button is only resized', async () => {
        const { user, themes } = await setupPreview('dark');

        await user.keyboard('{ArrowDown}');
        reportSize(44, 44);

        expect(dialog()).toBeVisible();
        expect(themes.theme()).toBe('light');
      });

      it('stops watching once the dialog is closed, and watches again when it is reopened', async () => {
        const { user } = await setupPreview('dark');
        const first = observer();

        await user.keyboard('{Escape}');
        expect(first.disconnected).toBe(true);

        await user.click(trigger());
        expect(FakeResizeObserver.instances).toHaveLength(2);
        expect(observer().disconnected).toBe(false);
      });

      it('stops watching when it is destroyed while open', async () => {
        const { fixture } = await setupPreview('dark');

        fixture.destroy();

        expect(observer().disconnected).toBe(true);
      });
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
