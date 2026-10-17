import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { expectNoAxeViolations } from '../../../../testing/a11y';

import { AppSelectComponent } from './app-select.component';

const CATEGORIES = [
  { value: 'media', label: 'Media' },
  { value: 'tools', label: 'Tools' },
  { value: 'home', label: 'Home Automation' },
];

describe('AppSelectComponent', () => {
  const setup = async (inputs: Record<string, unknown> = {}) => {
    const valueChange = vi.fn();
    const view = await render(AppSelectComponent, {
      inputs: {
        label: 'Application category for Plex',
        options: CATEGORIES,
        value: 'tools',
        ...inputs,
      },
      on: { valueChange },
    });
    return {
      ...view,
      valueChange,
      trigger: screen.getByRole('button', { name: /category for Plex/ }),
    };
  };
  const option = (name: string) => screen.getByRole('option', { name });

  it('is a button that offers a listbox, named by its label and showing the chosen option', async () => {
    const { trigger } = await setup();

    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveTextContent('Tools');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows the placeholder when no option matches the value', async () => {
    const { trigger } = await setup({ value: '', placeholder: 'No categories available' });

    expect(trigger).toHaveTextContent('No categories available');
  });

  it('opens on click with every option, the chosen one selected and marked with a check', async () => {
    const user = userEvent.setup();
    const { trigger } = await setup();

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((o) => o.textContent?.trim())).toEqual([
      'Media',
      'Tools',
      'Home Automation',
    ]);
    expect(option('Tools')).toHaveAttribute('aria-selected', 'true');
    expect(option('Media')).toHaveAttribute('aria-selected', 'false');
    expect(option('Tools').querySelector('ng-icon')).not.toBeNull();
    expect(option('Media').querySelector('ng-icon')).toBeNull();
    expect(option('Tools')).toHaveFocus();
  });

  it('chooses the clicked option, closes, and returns the focus to the button', async () => {
    const user = userEvent.setup();
    const { trigger, valueChange } = await setup();
    await user.click(trigger);

    await user.click(option('Home Automation'));

    expect(valueChange).toHaveBeenCalledExactlyOnceWith('home');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('does not announce a change when the chosen option is chosen again', async () => {
    const user = userEvent.setup();
    const { trigger, valueChange } = await setup();
    await user.click(trigger);

    await user.click(option('Tools'));

    expect(valueChange).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it.each(['{Enter}', ' ', '{ArrowDown}', '{ArrowUp}'])(
    'opens with %j from the keyboard',
    async (key) => {
      const user = userEvent.setup();
      const { trigger } = await setup();

      await user.tab();
      expect(trigger).toHaveFocus();
      await user.keyboard(key);

      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getAllByRole('option').some((o) => o === document.activeElement)).toBe(true);
    },
  );

  it('moves with the arrows, Home and End, and chooses with Enter or Space', async () => {
    const user = userEvent.setup();
    const { trigger, valueChange } = await setup({ value: 'media' });
    await user.click(trigger);
    expect(option('Media')).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(option('Tools')).toHaveFocus();
    await user.keyboard('{End}');
    expect(option('Home Automation')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(option('Media')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(option('Home Automation')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(option('Media')).toHaveFocus();

    await user.keyboard('{ArrowDown}{Enter}');
    expect(valueChange).toHaveBeenLastCalledWith('tools');
    expect(trigger).toHaveFocus();

    await user.keyboard('{Enter}{End} ');
    expect(valueChange).toHaveBeenLastCalledWith('home');
  });

  it('closes with Escape without choosing and keeps the focus on the button', async () => {
    const user = userEvent.setup();
    const { trigger, valueChange } = await setup();
    await user.click(trigger);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(valueChange).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it('closes when the focus leaves it', async () => {
    const user = userEvent.setup();
    const { trigger } = await setup();
    await user.click(trigger);

    await user.tab();

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes when the button is activated again', async () => {
    const user = userEvent.setup();
    const { trigger } = await setup();
    await user.click(trigger);

    await user.click(trigger);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('cannot be opened while disabled', async () => {
    const user = userEvent.setup();
    const { trigger } = await setup({ disabled: true });

    await user.click(trigger);

    expect(trigger).toBeDisabled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('passes the invalid state and the description through to the button', async () => {
    const { trigger } = await setup({ invalid: true, describedBy: 'error-1' });

    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAttribute('aria-describedby', 'error-1');
  });

  it('has no detectable accessibility violations, closed or open', async () => {
    const user = userEvent.setup();
    const { container, trigger } = await setup();
    await expectNoAxeViolations(container);

    await user.click(trigger);

    await expectNoAxeViolations(container);
  });
});
