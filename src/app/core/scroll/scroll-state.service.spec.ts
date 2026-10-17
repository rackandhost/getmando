import { TestBed } from '@angular/core/testing';
import type { Mock } from 'vitest';

import { LoggerService } from '../services/logger.service';
import { NotificationService } from '../services/notification.service';

import { FakeMetrics, docTopFor } from '../../../testing/fake-metrics';

import { METRICS_SOURCE } from './metrics-source';
import { ScrollStateService, type ChromeHandle, type ChromeProbe } from './scroll-state.service';

describe('ScrollStateService', () => {
  let metrics: FakeMetrics;
  let logger: { warn: Mock };
  let notifications: { error: Mock; warning: Mock };
  let service: ScrollStateService;
  const handles: ChromeHandle[] = [];

  const probe = (overrides: Partial<ChromeProbe> = {}): ChromeProbe => ({
    id: 'dock',
    compactDelta: () => metrics.delta,
    minViewportHeight: 720,
    ...overrides,
  });

  const register = (overrides?: Partial<ChromeProbe>): ChromeHandle => {
    const handle = service.register(probe(overrides));
    handles.push(handle);
    return handle;
  };

  /** A chrome that has settled in Top on a page with plenty to scroll. */
  const registerAtTop = (): ChromeHandle => {
    const handle = register();
    metrics.layout('static');
    metrics.frame();
    metrics.layout(handle.mode());
    // The first settle is a state change; let its dwell pass so the test starts from rest.
    metrics.advance(500);
    return handle;
  };

  beforeEach(() => {
    metrics = new FakeMetrics();
    metrics.layout('static');
    logger = { warn: vi.fn() };
    notifications = { error: vi.fn(), warning: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: METRICS_SOURCE, useValue: metrics },
        { provide: LoggerService, useValue: logger },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    service = TestBed.inject(ScrollStateService);
  });

  afterEach(() => {
    handles.splice(0).forEach((handle) => handle.dispose());
  });

  it('starts Static and settles in Top at the first frame on a page with room to scroll', () => {
    const handle = register();

    expect(handle.mode()).toBe('static');
    metrics.frame();

    expect(handle.mode()).toBe('top');
  });

  it('goes to Scrolled after one frame once the user scrolls past 40 px, not synchronously', () => {
    const handle = registerAtTop();

    metrics.scroll(300, handle.mode());
    expect(handle.mode()).toBe('top');
    metrics.frame();

    expect(handle.mode()).toBe('scrolled');
  });

  it('runs one frame for any number of scroll events and observer callbacks', () => {
    const handle = registerAtTop();

    metrics.scroll(100, handle.mode());
    metrics.scroll(120, handle.mode());
    metrics.relayout(handle.mode());

    expect(metrics.pendingFrames).toBe(1);
  });

  it('never changes the mode from inside an observer callback, only schedules a frame', () => {
    const handle = registerAtTop();
    metrics.docTop = docTopFor(1);

    metrics.relayout(handle.mode());

    expect(handle.mode()).toBe('top');
    expect(metrics.pendingFrames).toBe(1);
    metrics.frame();
    expect(handle.mode()).toBe('static');
  });

  it('stays Static on a short page however the user scrolls', () => {
    metrics.docTop = docTopFor(2);
    metrics.layout('static');
    const handle = register();
    metrics.frame();

    for (const y of [0, 200, 0, 200]) {
      metrics.scroll(y, handle.mode());
      metrics.frame();
      metrics.advance(500);
      expect(handle.mode()).toBe('static');
    }
  });

  it('does not flip back to Top when the browser clamps scrollY after compaction', () => {
    // 80 px of capacity left after compaction: the clamped scrollY is 80, still above the 4 px exit.
    metrics.docTop = 900 + 306 + 80;
    const handle = registerAtTop();

    metrics.scroll(300, handle.mode());
    metrics.frame();
    metrics.layout(handle.mode());
    expect(metrics.scrollY()).toBe(80);
    metrics.advance(500);
    metrics.relayout(handle.mode());
    metrics.frame();

    expect(handle.mode()).toBe('scrolled');
  });

  it('moves a Scrolled chrome to Static in a single step when the content shrinks to one row', () => {
    const handle = registerAtTop();
    metrics.scroll(300, handle.mode());
    metrics.frame();
    metrics.layout(handle.mode());
    metrics.advance(500);

    metrics.docTop = docTopFor(1);
    metrics.relayout(handle.mode());
    metrics.frame();
    const afterShrink = handle.mode();
    metrics.layout(afterShrink);
    metrics.frame();
    metrics.advance(500);
    metrics.frame();

    expect(afterShrink).toBe('static');
    expect(handle.mode()).toBe('static');
  });

  it('is Static whenever the viewport is below the probe guard', () => {
    metrics.viewport = 600;
    metrics.layout('static');
    const handle = register();

    metrics.frame();

    expect(handle.mode()).toBe('static');
  });

  describe('dwell', () => {
    it('ignores a change requested within 400 ms of the last one and applies it when the dwell ends', () => {
      const handle = registerAtTop();
      metrics.scroll(300, handle.mode());
      metrics.frame();
      expect(handle.mode()).toBe('scrolled');
      metrics.layout('scrolled');

      metrics.advance(100);
      metrics.scroll(0, handle.mode());
      metrics.frame();
      expect(handle.mode()).toBe('scrolled');

      metrics.advance(299);
      metrics.frame();
      expect(handle.mode()).toBe('scrolled');
      metrics.advance(1);
      metrics.frame();
      expect(handle.mode()).toBe('top');
    });

    it('does not wait under reduced motion', () => {
      metrics.reducedMotion = true;
      const handle = registerAtTop();
      metrics.scroll(300, handle.mode());
      metrics.frame();
      metrics.layout(handle.mode());

      metrics.scroll(0, handle.mode());
      metrics.frame();

      expect(handle.mode()).toBe('top');
    });
  });

  describe('circuit breaker', () => {
    /** Reduced motion removes the dwell, so a scripted user can make 5 changes quickly. */
    const toggle = (handle: ChromeHandle, times: number) => {
      for (let i = 0; i < times; i++) {
        metrics.scroll(handle.mode() === 'scrolled' ? 0 : 300, handle.mode());
        metrics.frame();
        metrics.layout(handle.mode());
        metrics.advance(100);
      }
    };

    beforeEach(() => {
      metrics.reducedMotion = true;
    });

    it('applies 4 changes within 2 s and latches Static on the fifth', () => {
      const handle = registerAtTop();

      // The first settle (Static → Top) is the first of the 4 changes allowed.
      toggle(handle, 3);
      expect(handle.mode()).toBe('scrolled');
      toggle(handle, 1);

      expect(handle.mode()).toBe('static');
    });

    it('logs the latch once through LoggerService and never notifies the user', () => {
      const handle = registerAtTop();

      toggle(handle, 5);
      toggle(handle, 4);

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(String(logger.warn.mock.calls[0][0])).toContain('dock');
      expect(notifications.error).not.toHaveBeenCalled();
      expect(notifications.warning).not.toHaveBeenCalled();
    });

    it('stays Static while only the scroll position changes', () => {
      const handle = registerAtTop();
      toggle(handle, 5);

      metrics.advance(5_000);
      metrics.scroll(300, handle.mode());
      metrics.frame();

      expect(handle.mode()).toBe('static');
    });

    it.each([
      ['the viewport height', (m: FakeMetrics) => (m.viewport = 950)],
      ['the content height', (m: FakeMetrics) => (m.docTop = docTopFor(8))],
    ])('is released when %s changes', (_name, change) => {
      const handle = registerAtTop();
      toggle(handle, 5);
      expect(handle.mode()).toBe('static');

      change(metrics);
      metrics.relayout(handle.mode());
      metrics.frame();

      expect(handle.mode()).not.toBe('static');
    });

    it('does not trip when the same 5 changes are spread over more than 2 s', () => {
      metrics.reducedMotion = false;
      const handle = registerAtTop();

      for (let i = 0; i < 5; i++) {
        metrics.scroll(i % 2 === 0 ? 300 : 0, handle.mode());
        metrics.frame();
        metrics.layout(handle.mode());
        metrics.advance(600);
        metrics.frame();
      }

      expect(handle.mode()).not.toBe('static');
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('removes the source listeners and cancels the pending frame', () => {
      const handle = registerAtTop();
      metrics.scroll(100, handle.mode());
      expect(metrics.pendingFrames).toBe(1);

      handle.dispose();

      expect(metrics.scrollListeners.size).toBe(0);
      expect(metrics.layoutListeners.size).toBe(0);
      expect(metrics.pendingFrames).toBe(0);
    });

    it('keeps listening for the remaining chromes until the last one is disposed', () => {
      const first = register({ id: 'header' });
      const second = register({ id: 'dock' });

      first.dispose();
      expect(metrics.scrollListeners.size).toBe(1);
      metrics.frame();
      expect(second.mode()).toBe('top');

      second.dispose();
      expect(metrics.scrollListeners.size).toBe(0);
    });

    it('no longer changes the mode of a disposed chrome', () => {
      const handle = registerAtTop();
      handle.dispose();

      metrics.scroll(300, 'top');
      metrics.frame();

      expect(handle.mode()).toBe('top');
    });
  });

  it('evaluates each chrome with its own Δ and guard', () => {
    // 620 px of capacity at the top: eligible for a 16 px dock, and for the 306 px one (R = 314).
    metrics.docTop = 900 + 620;
    metrics.layout('static');
    const big = register({ id: 'dock', compactDelta: () => 306 });
    const tall = register({ id: 'header', compactDelta: () => 10, minViewportHeight: 1000 });

    metrics.frame();

    expect(big.mode()).toBe('top');
    expect(tall.mode()).toBe('static');
  });
});
