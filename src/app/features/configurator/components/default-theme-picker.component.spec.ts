import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { THEMES, type ThemeSetting } from '../../../core/themes/theme.registry';
import { expectNoAxeViolations } from '../../../../testing/a11y';

import { DefaultThemePickerComponent } from './default-theme-picker.component';

describe('DefaultThemePickerComponent', () => {
  const optionNames = ['Auto', ...THEMES.map((theme) => theme.name)];
  const countLabel = `${optionNames.length} themes`;

  /** Like the page does: the owner holds the value and feeds it back from `valueChange`. */
  const setup = async (value: ThemeSetting = 'dark') => {
    const user = userEvent.setup();
    const valueChange = vi.fn((next: ThemeSetting) => {
      view.fixture.componentRef.setInput('value', next);
      view.fixture.detectChanges();
    });
    const view = await render(DefaultThemePickerComponent, {
      inputs: { value },
      on: { valueChange },
    });
    return { ...view, user, valueChange };
  };
  const summary = () => screen.getByRole('button', { name: new RegExp(countLabel) });
  const radio = (name: string) => screen.getByRole('radio', { name });
  const radioNames = () =>
    screen
      .queryAllByRole('radio')
      .map((option) => option.getAttribute('aria-labelledby'))
      .map((id) => document.getElementById(id ?? '')?.textContent?.trim());
  const filter = () => screen.getByRole('textbox', { name: 'Filter themes' });
  /** The panel starts closed: tests of the cards open it first. */
  const setupOpen = async (value: ThemeSetting = 'dark') => {
    const view = await setup(value);
    await view.user.click(summary());
    return view;
  };

  it('starts closed: the summary shows the draft theme and no radio is exposed', async () => {
    await setup('light');

    expect(summary()).toHaveTextContent('Light');
    expect(summary()).toHaveTextContent('Mando default');
    expect(summary()).toHaveTextContent(countLabel);
    expect(summary()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByRole('textbox', { name: 'Filter themes' })).toBeNull();
  });

  it('shows Auto and its description in the summary when the draft theme is auto', async () => {
    await setup('auto');

    expect(summary()).toHaveTextContent('Auto');
    expect(summary()).toHaveTextContent('Follows the system: Light or Dark');
  });

  it('exposes aria-expanded and aria-controls on the summary, pointing at the panel', async () => {
    const { user } = await setup('dark');

    expect(summary()).toHaveAttribute('aria-expanded', 'false');
    await user.click(summary());

    expect(summary()).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(summary().getAttribute('aria-controls') ?? '');
    expect(panel).not.toBeNull();
    expect(panel).toContainElement(radio('Dark'));
  });

  it('opens with the help text, the filter and one radio card per option: Auto, then the registry in order', async () => {
    await setupOpen('dark');

    expect(
      screen.getByText(
        'Theme the dashboard opens with. Visitors can still switch it from the theme menu.',
      ),
    ).toBeInTheDocument();
    expect(filter()).toHaveAttribute('placeholder', 'Filter themes…');
    expect(radioNames()).toEqual(optionNames);
  });

  it('checks the card of the draft theme, including auto', async () => {
    const { user } = await setupOpen('auto');

    expect(radio('Auto')).toBeChecked();
    expect(radio('Dark')).not.toBeChecked();

    await user.click(radio('Light'));

    expect(radio('Light')).toBeChecked();
    expect(radio('Auto')).not.toBeChecked();
  });

  it('is a group named Default theme and describes each card by its description', async () => {
    await setupOpen('dark');

    const group = screen.getByRole('group', { name: 'Default theme' });

    expect(within(group).getAllByRole('radio')).toHaveLength(optionNames.length);
    expect(radio('Auto')).toHaveAccessibleDescription('Follows the system: Light or Dark');
    for (const theme of THEMES) {
      expect(radio(theme.name)).toHaveAccessibleDescription(theme.description);
    }
  });

  it('moves the selection and the focus with the arrow keys and emits each theme once', async () => {
    const { user, valueChange } = await setupOpen('auto');

    radio('Auto').focus();
    await user.keyboard('{ArrowRight}');

    expect(valueChange).toHaveBeenLastCalledWith(THEMES[0].id);
    expect(radio(THEMES[0].name)).toBeChecked();
    expect(radio(THEMES[0].name)).toHaveFocus();
    expect(summary()).toHaveTextContent(THEMES[0].name);

    await user.keyboard('{ArrowDown}');

    expect(valueChange).toHaveBeenLastCalledWith(THEMES[1].id);
    expect(valueChange).toHaveBeenCalledTimes(2);
    expect(summary()).toHaveTextContent(THEMES[1].name);
  });

  it('chooses a theme with a click on its card', async () => {
    const { user, valueChange } = await setupOpen('dark');

    await user.click(screen.getByText('Follows the system: Light or Dark'));

    expect(valueChange).toHaveBeenCalledExactlyOnceWith('auto');
  });

  it('does not emit when the checked card is clicked again, when opened or closed, or when filtering', async () => {
    const { user, valueChange } = await setupOpen('dark');

    await user.click(radio('Dark'));
    await user.type(filter(), 'zzz');
    await user.clear(filter());
    await user.click(summary());
    await user.click(summary());

    expect(valueChange).not.toHaveBeenCalled();
  });

  it('filters by substring over name and description, ignoring case', async () => {
    const { user } = await setupOpen('dark');

    await user.type(filter(), 'FOLLOWS');
    expect(radioNames()).toEqual(['Auto']);

    await user.clear(filter());
    await user.type(filter(), 'mando');
    expect(radioNames()).toEqual(
      THEMES.filter((t) => /mando/i.test(t.description)).map((t) => t.name),
    );

    await user.clear(filter());
    expect(radioNames()).toEqual(optionNames);
  });

  it('says so when no theme matches the filter, and lists no card', async () => {
    const { user } = await setupOpen('dark');

    await user.type(filter(), 'zzz');

    expect(screen.getByText('No themes match your search.')).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);

    await user.clear(filter());
    expect(screen.queryByText('No themes match your search.')).toBeNull();
  });

  it('has one tab stop (the summary) while closed and adds the filter and the checked radio once open', async () => {
    const { user } = await setup('light');

    await user.tab();
    expect(summary()).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();

    summary().focus();
    await user.keyboard('{Enter}');
    await user.tab();
    expect(filter()).toHaveFocus();
    await user.tab();
    expect(radio('Light')).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it('opens and closes with Enter and Space, taking the radios out of the tab order while closed', async () => {
    const { user } = await setup('light');

    summary().focus();
    await user.keyboard('{Enter}');

    expect(summary()).toHaveAttribute('aria-expanded', 'true');
    expect(radio('Light')).toBeChecked();

    await user.keyboard(' ');

    expect(summary()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('marks the selected card with a check mark and hides every preview from assistive technology', async () => {
    const { container } = await setupOpen('light');

    expect(container.querySelectorAll('[data-theme-check]')).toHaveLength(1);
    expect(radio('Light').closest('label')?.querySelector('[data-theme-check]')).not.toBeNull();
    const previews = container.querySelectorAll('[data-theme-preview]');
    expect(previews).toHaveLength(optionNames.length + 1);
    for (const preview of previews) expect(preview).toHaveAttribute('aria-hidden', 'true');
  });

  it('previews Auto half dark and half light, and every theme with its registry swatch', async () => {
    const { container } = await setupOpen('dark');

    const halves = (name: string) =>
      Array.from(
        radio(name).closest('label')?.querySelectorAll<HTMLElement>('[data-theme-swatch]') ?? [],
      ).map((swatch) => swatch.getAttribute('data-theme-swatch'));

    expect(halves('Auto')).toEqual(['dark', 'light']);
    for (const theme of THEMES) expect(halves(theme.name)).toEqual([theme.id]);
    expect(container.querySelectorAll('[data-theme-preview]')).toHaveLength(optionNames.length + 1);
  });

  it.each(['dark', 'light', 'auto'] as const)(
    'has no detectable accessibility violations closed or open with %s selected',
    async (value) => {
      const { container, user } = await setup(value);

      await expectNoAxeViolations(container);
      await user.click(summary());
      await expectNoAxeViolations(container);
      await user.type(filter(), 'zzz');
      await expectNoAxeViolations(container);
    },
  );
});
