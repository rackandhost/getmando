import type { ChromeMode } from '../app/core/scroll/scroll-state';
import type { MetricsSource } from '../app/core/scroll/metrics-source';
import { BASE_HEIGHT, ROW_HEIGHT } from './scroll-sim';

/** Document height in the Top layout for `rows` rows of apps (design.md § 4.1 geometry). */
export const docTopFor = (rows: number) => BASE_HEIGHT + rows * ROW_HEIGHT;

/** A document and a clock the test drives by hand; frames and timers run only when told to. */
export class FakeMetrics implements MetricsSource {
  docTop = docTopFor(6);
  delta = 306;
  viewport = 900;
  intent = 0;
  reducedMotion = false;
  time = 1_000;
  scrollListeners = new Set<() => void>();
  layoutListeners = new Set<() => void>();
  sizeListeners = new Map<Element, Set<() => void>>();
  private frames: (() => void)[] = [];
  private timers: { at: number; run: () => void }[] = [];
  private currentDocHeight = this.docTop;
  private currentScrollY = 0;

  scrollY = () => this.currentScrollY;
  docHeight = () => this.currentDocHeight;
  viewportHeight = () => this.viewport;
  prefersReducedMotion = () => this.reducedMotion;
  now = () => this.time;

  onScroll(listener: () => void) {
    this.scrollListeners.add(listener);
    return () => this.scrollListeners.delete(listener);
  }

  onLayoutChange(listener: () => void) {
    this.layoutListeners.add(listener);
    return () => this.layoutListeners.delete(listener);
  }

  observeSize(element: Element, listener: () => void) {
    const listeners = this.sizeListeners.get(element) ?? new Set<() => void>();
    listeners.add(listener);
    this.sizeListeners.set(element, listeners);
    return () => listeners.delete(listener);
  }

  requestFrame(run: () => void) {
    this.frames.push(run);
    return () => {
      this.frames = this.frames.filter((frame) => frame !== run);
    };
  }

  after(ms: number, run: () => void) {
    const timer = { at: this.time + ms, run };
    this.timers.push(timer);
    return () => {
      this.timers = this.timers.filter((t) => t !== timer);
    };
  }

  get pendingFrames(): number {
    return this.frames.length;
  }

  /** Lays the page out for `mode`: a Scrolled document is Δ shorter and scrollY is clamped to it. */
  layout(mode: ChromeMode) {
    this.currentDocHeight = this.docTop - (mode === 'scrolled' ? this.delta : 0);
    this.currentScrollY = Math.min(this.intent, Math.max(0, this.currentDocHeight - this.viewport));
  }

  /** The user scrolls to `y`: the scroll event fires (it does not run any frame by itself). */
  scroll(y: number, mode: ChromeMode) {
    this.intent = y;
    this.layout(mode);
    this.scrollListeners.forEach((listener) => listener());
  }

  /** Content or viewport changed: observers fire (they do not run any frame by itself). */
  relayout(mode: ChromeMode) {
    this.layout(mode);
    this.layoutListeners.forEach((listener) => listener());
  }

  /** An element's box changed size: its size observers fire (they do not run any frame by itself). */
  resize(element: Element) {
    this.sizeListeners.get(element)?.forEach((listener) => listener());
  }

  /** Runs the frames queued so far (not the ones they queue). */
  frame() {
    const queued = this.frames;
    this.frames = [];
    queued.forEach((run) => run());
  }

  advance(ms: number) {
    this.time += ms;
    const due = this.timers.filter((t) => t.at <= this.time).sort((a, b) => a.at - b.at);
    this.timers = this.timers.filter((t) => t.at > this.time);
    due.forEach((t) => t.run());
  }
}
