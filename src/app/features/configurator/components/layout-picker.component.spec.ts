import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import type { DashboardLayout } from '../../../core/models/dashboard.models';
import { expectNoAxeViolations } from '../../../../testing/a11y';

import { LayoutPickerComponent } from './layout-picker.component';

describe('LayoutPickerComponent', () => {
  /** Like the page does: the owner holds the value and feeds it back from `valueChange`. */
  const setup = async (value: DashboardLayout = 'horizontal') => {
    const valueChange = vi.fn((next: DashboardLayout) => {
      view.fixture.componentRef.setInput('value', next);
      view.fixture.detectChanges();
    });
    const view = await render(LayoutPickerComponent, {
      inputs: { value },
      on: { valueChange },
    });
    return { ...view, valueChange };
  };
  const summary = () => screen.getByRole('button', { name: /bar.*2 layouts/ });
  const radio = (name: string) => screen.getByRole('radio', { name });

  it('shows the draft layout in the summary and in the open panel, with its card checked', async () => {
    await setup('horizontal');

    expect(summary()).toHaveTextContent('Horizontal bar');
    expect(summary()).toHaveTextContent('Clock, search and categories on top');
    expect(summary()).toHaveTextContent('2 layouts');
    expect(summary()).toHaveAttribute('aria-expanded', 'true');
    expect(radio('Horizontal bar')).toBeChecked();
    expect(radio('Vertical bar')).not.toBeChecked();
  });

  it('reflects a vertical draft', async () => {
    await setup('vertical');

    expect(summary()).toHaveTextContent('Vertical bar');
    expect(radio('Vertical bar')).toBeChecked();
    expect(radio('Horizontal bar')).not.toBeChecked();
  });

  it('is a group named Layout holding one radio per layout, each described by its description', async () => {
    await setup('vertical');

    const group = screen.getByRole('group', { name: 'Layout' });

    expect(within(group).getAllByRole('radio')).toHaveLength(2);
    expect(radio('Horizontal bar')).toHaveAccessibleDescription(
      'Clock, search and categories on top',
    );
    expect(radio('Vertical bar')).toHaveAccessibleDescription(
      'Sticky sidebar, apps use the full width',
    );
    expect(screen.getByText('Choose the dashboard layout')).toBeInTheDocument();
  });

  it('moves the selection and the focus with the arrow keys and announces the new layout', async () => {
    const user = userEvent.setup();
    const { valueChange } = await setup('horizontal');

    radio('Horizontal bar').focus();
    await user.keyboard('{ArrowRight}');

    expect(valueChange).toHaveBeenCalledExactlyOnceWith('vertical');
    expect(radio('Vertical bar')).toBeChecked();
    expect(radio('Vertical bar')).toHaveFocus();
    expect(summary()).toHaveTextContent('Vertical bar');
  });

  it('chooses a layout with a click on its card', async () => {
    const user = userEvent.setup();
    const { valueChange } = await setup('horizontal');

    await user.click(screen.getByText('Sticky sidebar, apps use the full width'));

    expect(valueChange).toHaveBeenCalledExactlyOnceWith('vertical');
  });

  it('puts one tab stop on the group and none inside it once it is left', async () => {
    const user = userEvent.setup();
    await setup('vertical');

    await user.tab();
    expect(summary()).toHaveFocus();
    await user.tab();
    expect(radio('Vertical bar')).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it('closes and opens with Enter and Space, taking the radios out of the tab order while closed', async () => {
    const user = userEvent.setup();
    await setup('vertical');

    summary().focus();
    await user.keyboard('{Enter}');

    expect(summary()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    await user.tab();
    expect(document.body).toHaveFocus();

    summary().focus();
    await user.keyboard(' ');

    expect(summary()).toHaveAttribute('aria-expanded', 'true');
    expect(radio('Vertical bar')).toBeChecked();
  });

  it('keeps the chosen layout when it is closed and reopened', async () => {
    const user = userEvent.setup();
    await setup('horizontal');

    await user.click(radio('Vertical bar'));
    await user.click(summary());
    await user.click(summary());

    expect(radio('Vertical bar')).toBeChecked();
  });

  it('marks the selected card with a check mark and hides every schematic from assistive technology', async () => {
    const { container } = await setup('vertical');

    const check = (name: string) =>
      radio(name).closest('label')?.querySelector('[data-layout-check]');

    expect(check('Vertical bar')).not.toBeNull();
    expect(check('Horizontal bar')).toBeNull();
    const thumbnails = container.querySelectorAll('[data-layout-thumbnail]');
    expect(thumbnails).toHaveLength(3);
    thumbnails.forEach((thumbnail) => expect(thumbnail).toHaveAttribute('aria-hidden', 'true'));
  });

  it('has no detectable accessibility violations open or closed', async () => {
    const user = userEvent.setup();
    const { container } = await setup('vertical');

    await expectNoAxeViolations(container);
    await user.click(summary());
    await expectNoAxeViolations(container);
  });
});
