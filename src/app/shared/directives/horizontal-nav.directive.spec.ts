import { fireEvent, render, screen } from '@testing-library/angular';

import { HorizontalNavDirective, wheelScrollDelta } from './horizontal-nav.directive';

describe('wheelScrollDelta', () => {
  const wheel = (deltaY: number, deltaX = 0, deltaMode = 0) => ({ deltaX, deltaY, deltaMode });

  it('turns a vertical wheel into a horizontal pixel delta', () => {
    expect(wheelScrollDelta(wheel(120), { scrollLeft: 0, maxScrollLeft: 300, pageSize: 350 })).toBe(
      120,
    );
    expect(
      wheelScrollDelta(wheel(-80), { scrollLeft: 100, maxScrollLeft: 300, pageSize: 350 }),
    ).toBe(-80);
  });

  it('scales line and page wheel modes to pixels', () => {
    const state = { scrollLeft: 0, maxScrollLeft: 1000, pageSize: 350 };

    expect(wheelScrollDelta(wheel(3, 0, 1), state)).toBe(48);
    expect(wheelScrollDelta(wheel(1, 0, 2), state)).toBe(350);
  });

  it('leaves native horizontal wheels (trackpads) alone', () => {
    expect(
      wheelScrollDelta(wheel(5, 60), { scrollLeft: 0, maxScrollLeft: 300, pageSize: 350 }),
    ).toBeNull();
  });

  it('does nothing when the content does not overflow', () => {
    expect(
      wheelScrollDelta(wheel(120), { scrollLeft: 0, maxScrollLeft: 0, pageSize: 350 }),
    ).toBeNull();
  });

  it('lets the page scroll once the end in that direction is reached', () => {
    expect(
      wheelScrollDelta(wheel(120), { scrollLeft: 300, maxScrollLeft: 300, pageSize: 350 }),
    ).toBeNull();
    expect(
      wheelScrollDelta(wheel(-120), { scrollLeft: 0, maxScrollLeft: 300, pageSize: 350 }),
    ).toBeNull();
  });

  it('still scrolls away from an end', () => {
    expect(
      wheelScrollDelta(wheel(-120), { scrollLeft: 300, maxScrollLeft: 300, pageSize: 350 }),
    ).toBe(-120);
    expect(wheelScrollDelta(wheel(120), { scrollLeft: 0, maxScrollLeft: 300, pageSize: 350 })).toBe(
      120,
    );
  });
});

describe('HorizontalNavDirective', () => {
  const setup = async ({ scrollWidth = 614, clientWidth = 348 } = {}) => {
    await render('<nav appHorizontalNav aria-label="Tabs">tabs</nav>', {
      imports: [HorizontalNavDirective],
    });
    const nav = screen.getByRole('navigation', { name: 'Tabs' });

    Object.defineProperty(nav, 'scrollWidth', { configurable: true, value: scrollWidth });
    Object.defineProperty(nav, 'clientWidth', { configurable: true, value: clientWidth });

    return nav;
  };

  it('scrolls the host sideways on a vertical wheel and keeps the page still', async () => {
    const nav = await setup();

    const notPrevented = fireEvent.wheel(nav, { deltaY: 100 });

    expect(nav.scrollLeft).toBe(100);
    expect(notPrevented).toBe(false);
  });

  it('does not touch the page scroll at the end of the content', async () => {
    const nav = await setup();
    nav.scrollLeft = 266;

    const notPrevented = fireEvent.wheel(nav, { deltaY: 100 });

    expect(nav.scrollLeft).toBe(266);
    expect(notPrevented).toBe(true);
  });

  it('ignores a pinch-zoom wheel (ctrl held)', async () => {
    const nav = await setup();

    const notPrevented = fireEvent.wheel(nav, { deltaY: 100, ctrlKey: true });

    expect(nav.scrollLeft).toBe(0);
    expect(notPrevented).toBe(true);
  });

  it('does nothing when everything fits', async () => {
    const nav = await setup({ scrollWidth: 300, clientWidth: 300 });

    const notPrevented = fireEvent.wheel(nav, { deltaY: 100 });

    expect(nav.scrollLeft).toBe(0);
    expect(notPrevented).toBe(true);
  });
});
