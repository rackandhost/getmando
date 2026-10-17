import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { expectNoAxeViolations } from '../../../../testing/a11y';

import { AppSwitchComponent } from './app-switch.component';

describe('AppSwitchComponent', () => {
  const setup = async (inputs: { checked?: boolean; label?: string } = {}) => {
    const checkedChange = vi.fn();
    const view = await render(AppSwitchComponent, {
      inputs: { label: 'Show seconds', ...inputs },
      on: { checkedChange },
    });
    return {
      ...view,
      checkedChange,
      control: screen.getByRole('switch', { name: 'Show seconds' }),
    };
  };

  it('is a switch named by its visible label', async () => {
    const { control } = await setup();

    expect(control).toHaveTextContent('Show seconds');
  });

  it.each([true, false])('reports checked=%s through aria-checked', async (checked) => {
    const { control } = await setup({ checked });

    expect(control).toHaveAttribute('aria-checked', String(checked));
  });

  it('asks for the opposite value when clicked, leaving the state to its owner', async () => {
    const user = userEvent.setup();
    const { control, checkedChange } = await setup({ checked: false });

    await user.click(control);

    expect(checkedChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(control).toHaveAttribute('aria-checked', 'false');
  });

  it('turns off when it is on', async () => {
    const user = userEvent.setup();
    const { control, checkedChange } = await setup({ checked: true });

    await user.click(control);

    expect(checkedChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('toggles with the Space key', async () => {
    const user = userEvent.setup();
    const { control, checkedChange } = await setup();

    await user.tab();
    expect(control).toHaveFocus();
    await user.keyboard(' ');

    expect(checkedChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it.each([true, false])(
    'has no detectable accessibility violations when checked=%s',
    async (checked) => {
      const { container } = await setup({ checked });

      await expectNoAxeViolations(container);
    },
  );
});
