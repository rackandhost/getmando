import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { expectNoAxeViolations } from '../../../../testing/a11y';

import { AppSegmentedComponent } from './app-segmented.component';

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
];

describe('AppSegmentedComponent', () => {
  const setup = async (value = 'dark') => {
    const valueChange = vi.fn();
    const view = await render(AppSegmentedComponent, {
      inputs: { label: 'Theme', options: THEMES, value },
      on: { valueChange },
    });
    return { ...view, valueChange };
  };
  const radio = (name: string) => screen.getByRole('radio', { name });

  it('is a radio group named by its label, with one radio per option', async () => {
    await setup();

    const group = screen.getByRole('radiogroup', { name: 'Theme' });

    expect(screen.getAllByRole('radio').map((r) => r.textContent?.trim())).toEqual([
      'Light',
      'Dark',
      'Auto',
    ]);
    expect(group).toContainElement(radio('Dark'));
  });

  it('checks only the option matching its value and keeps only that one in the tab order', async () => {
    await setup('auto');

    expect(radio('Auto')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Light')).toHaveAttribute('aria-checked', 'false');
    expect(radio('Dark')).toHaveAttribute('aria-checked', 'false');
    expect(radio('Auto')).toHaveAttribute('tabindex', '0');
    expect(radio('Light')).toHaveAttribute('tabindex', '-1');
    expect(radio('Dark')).toHaveAttribute('tabindex', '-1');
  });

  it('selects the option that is clicked', async () => {
    const user = userEvent.setup();
    const { valueChange } = await setup();

    await user.click(radio('Light'));

    expect(valueChange).toHaveBeenCalledExactlyOnceWith('light');
  });

  it('does not announce a change when the checked option is clicked again', async () => {
    const user = userEvent.setup();
    const { valueChange } = await setup();

    await user.click(radio('Dark'));

    expect(valueChange).not.toHaveBeenCalled();
  });

  it('moves the selection and the focus with the arrow keys', async () => {
    const user = userEvent.setup();
    const { valueChange } = await setup('dark');

    await user.tab();
    expect(radio('Dark')).toHaveFocus();
    await user.keyboard('{ArrowRight}');

    expect(valueChange).toHaveBeenLastCalledWith('auto');
    expect(radio('Auto')).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(valueChange).toHaveBeenLastCalledWith('light');
    expect(radio('Light')).toHaveFocus();
  });

  it('moves backwards with the left and up arrows, wrapping at the start', async () => {
    const user = userEvent.setup();
    const { valueChange } = await setup('light');

    await user.tab();
    await user.keyboard('{ArrowLeft}');

    expect(valueChange).toHaveBeenLastCalledWith('auto');

    await user.keyboard('{ArrowUp}');
    expect(valueChange).toHaveBeenLastCalledWith('dark');
  });

  it('jumps to the first and the last option with Home and End', async () => {
    const user = userEvent.setup();
    const { valueChange } = await setup('dark');

    await user.tab();
    await user.keyboard('{End}');
    expect(valueChange).toHaveBeenLastCalledWith('auto');

    await user.keyboard('{Home}');
    expect(valueChange).toHaveBeenLastCalledWith('light');
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = await setup();

    await expectNoAxeViolations(container);
  });
});
