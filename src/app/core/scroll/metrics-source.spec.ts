import { createBrowserMetricsSource } from './metrics-source';

describe('browser metrics source', () => {
  let observers: FakeResizeObserver[];

  class FakeResizeObserver {
    observed: Element[] = [];
    disconnected = false;
    constructor(public callback: () => void) {
      observers.push(this);
    }
    observe(element: Element) {
      this.observed.push(element);
    }
    disconnect() {
      this.disconnected = true;
    }
  }

  beforeEach(() => {
    observers = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reads scroll position, viewport and document height from the window and document', () => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(123);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(777);
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(4321);

    const source = createBrowserMetricsSource(document);

    expect(source.scrollY()).toBe(123);
    expect(source.viewportHeight()).toBe(777);
    expect(source.docHeight()).toBe(4321);
  });

  it('reads the reduced-motion preference from the media query', () => {
    const matchMedia = vi.fn((query: string) => ({ matches: query.includes('reduce') }));
    vi.stubGlobal('matchMedia', matchMedia);
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });

    expect(createBrowserMetricsSource(document).prefersReducedMotion()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('listens to scroll passively and stops when unsubscribed', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const listener = vi.fn();

    const stop = createBrowserMetricsSource(document).onScroll(listener);
    window.dispatchEvent(new Event('scroll'));
    stop();
    window.dispatchEvent(new Event('scroll'));

    expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reports layout changes from resize and from a ResizeObserver on the document, and releases both', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const listener = vi.fn();

    const stop = createBrowserMetricsSource(document).onLayoutChange(listener);
    window.dispatchEvent(new Event('resize'));
    observers[0].callback();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(observers[0].observed).toEqual([document.documentElement, document.body]);

    stop();
    window.dispatchEvent(new Event('resize'));

    expect(listener).toHaveBeenCalledTimes(2);
    expect(observers[0].disconnected).toBe(true);
  });

  it('still reports resizes where ResizeObserver does not exist', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const listener = vi.fn();

    const stop = createBrowserMetricsSource(document).onLayoutChange(listener);
    window.dispatchEvent(new Event('resize'));
    stop();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('runs a frame callback on the next animation frame unless it is cancelled', () => {
    const source = createBrowserMetricsSource(document);
    const run = vi.fn();
    const cancelled = vi.fn();

    source.requestFrame(run);
    source.requestFrame(cancelled)();
    vi.advanceTimersByTime(50);

    expect(run).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('runs a delayed callback after the delay unless it is cancelled', () => {
    const source = createBrowserMetricsSource(document);
    const run = vi.fn();
    const cancelled = vi.fn();

    source.after(400, run);
    source.after(400, cancelled)();
    vi.advanceTimersByTime(399);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(run).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
  });
});
