import { Component, signal } from '@angular/core';
import { fireEvent, render, screen } from '@testing-library/angular';

import { METRICS_SOURCE, type MetricsSource } from '../../core/scroll/metrics-source';

import { centeredScrollLeft, ChipAutocenterDirective } from './chip-autocenter.directive';

describe('centeredScrollLeft', () => {
  it('puts the middle of the chip in the middle of the bar', () => {
    // chip 400 → 490 in content coordinates, bar 300 wide: 445 − 150.
    expect(centeredScrollLeft({ left: 400, width: 90 }, 300, 700)).toBe(295);
  });

  it('never scrolls past either end of the content', () => {
    expect(centeredScrollLeft({ left: 0, width: 90 }, 300, 700)).toBe(0);
    expect(centeredScrollLeft({ left: 610, width: 90 }, 300, 700)).toBe(400);
  });

  it('is 0 when everything fits', () => {
    expect(centeredScrollLeft({ left: 120, width: 90 }, 300, 300)).toBe(0);
  });
});

@Component({
  imports: [ChipAutocenterDirective],
  template: `
    <ol aria-label="Chips" [appChipAutocenter]="active()">
      @for (id of ids; track id) {
        <li [attr.data-chip]="id">{{ id }}</li>
      }
    </ol>
  `,
})
class HostComponent {
  readonly ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  readonly active = signal('a');
}

describe('ChipAutocenterDirective', () => {
  const clock = { now: 0, reducedMotion: false };
  const source = {
    now: () => clock.now,
    prefersReducedMotion: () => clock.reducedMotion,
  } as MetricsSource;
  const scrollIntoView = vi.fn();
  const scrollTo = vi.fn();

  beforeEach(() => {
    clock.now = 0;
    clock.reducedMotion = false;
    scrollTo.mockClear();
    scrollIntoView.mockClear();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });

  /** jsdom has no layout: a 300 px bar over seven 90 px chips spaced 100 px apart, 700 px of content. */
  async function setup({ scrollWidth = 700 } = {}) {
    const view = await render(HostComponent, {
      providers: [{ provide: METRICS_SOURCE, useValue: source }],
    });
    const bar = screen.getByRole('list', { name: 'Chips' });
    Object.defineProperty(bar, 'scrollWidth', { configurable: true, value: scrollWidth });
    Object.defineProperty(bar, 'clientWidth', { configurable: true, value: 300 });
    bar.scrollTo = scrollTo as unknown as typeof bar.scrollTo;
    bar.getBoundingClientRect = () => ({ left: 0 }) as DOMRect;
    screen.getAllByRole('listitem').forEach((chip, index) => {
      chip.getBoundingClientRect = () => ({ left: index * 100, width: 90 }) as DOMRect;
    });

    const activate = (id: string) => {
      view.fixture.componentInstance.active.set(id);
      view.fixture.detectChanges();
    };
    return { bar, activate };
  }

  it('does not move the bar when the page first renders', async () => {
    await setup();

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('smoothly centres the newly active chip by scrolling only the bar, never the page', async () => {
    const { activate } = await setup();

    activate('e');

    expect(scrollTo).toHaveBeenCalledOnce();
    expect(scrollTo).toHaveBeenCalledWith({ left: 295, behavior: 'smooth' });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('centres instantly under reduced motion', async () => {
    clock.reducedMotion = true;
    const { activate } = await setup();

    activate('e');

    expect(scrollTo).toHaveBeenCalledWith({ left: 295, behavior: 'auto' });
  });

  it('keeps the first and last chips inside the bar', async () => {
    const { activate } = await setup();

    activate('g');
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 400, behavior: 'smooth' });

    activate('a');
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });
  });

  it('does nothing when the bar does not overflow', async () => {
    const { activate } = await setup({ scrollWidth: 300 });

    activate('e');

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('does not move the bar while the wheel scrolls it or for 1 s after, then resumes on the next change', async () => {
    const { bar, activate } = await setup();

    fireEvent.wheel(bar, { deltaY: 40 });
    clock.now = 600;
    activate('c');
    expect(scrollTo).not.toHaveBeenCalled();

    clock.now = 1001;
    activate('e');
    expect(scrollTo).toHaveBeenCalledOnce();
  });

  it('does not move the bar while the user holds a finger or pointer on it, or for 1 s after', async () => {
    const { bar, activate } = await setup();

    fireEvent.pointerDown(bar);
    clock.now = 5000;
    activate('c');
    expect(scrollTo).not.toHaveBeenCalled();

    fireEvent.pointerUp(bar);
    clock.now = 5500;
    activate('d');
    expect(scrollTo).not.toHaveBeenCalled();

    clock.now = 6001;
    activate('e');
    expect(scrollTo).toHaveBeenCalledOnce();
  });

  it('treats a touch like a pointer', async () => {
    const { bar, activate } = await setup();

    fireEvent.touchStart(bar);
    clock.now = 3000;
    activate('c');
    expect(scrollTo).not.toHaveBeenCalled();

    fireEvent.touchEnd(bar);
    clock.now = 3999;
    activate('d');
    expect(scrollTo).not.toHaveBeenCalled();

    clock.now = 4001;
    activate('e');
    expect(scrollTo).toHaveBeenCalledOnce();
  });

  it('ignores the bar’s own scroll events, so centring never feeds itself', async () => {
    const { bar, activate } = await setup();

    activate('e');
    scrollTo.mockClear();

    fireEvent.scroll(bar);
    fireEvent.scroll(bar);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('centres once per change, not again for the same chip', async () => {
    const { activate } = await setup();

    activate('e');
    activate('e');

    expect(scrollTo).toHaveBeenCalledOnce();
  });
});
