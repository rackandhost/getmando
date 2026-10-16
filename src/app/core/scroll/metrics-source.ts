import { DOCUMENT, inject, InjectionToken } from '@angular/core';

/** Stops what a subscription or a scheduled callback started. */
export type Cancel = () => void;

/**
 * Everything `ScrollStateService` needs from the browser: measurements, change notifications, a frame
 * scheduler and a clock. It is a token so tests drive the service with a fake document and clock.
 */
export interface MetricsSource {
  scrollY(): number;
  /** Height of the whole document in its current layout. */
  docHeight(): number;
  viewportHeight(): number;
  prefersReducedMotion(): boolean;
  /** Milliseconds on a monotonic clock. */
  now(): number;
  /** The user scrolled. */
  onScroll(listener: () => void): Cancel;
  /** The viewport or the content changed size, or fonts finished loading. */
  onLayoutChange(listener: () => void): Cancel;
  /** Runs `run` on the next animation frame. */
  requestFrame(run: () => void): Cancel;
  /** Runs `run` after `ms` milliseconds. */
  after(ms: number, run: () => void): Cancel;
}

export function createBrowserMetricsSource(document: Document): MetricsSource {
  const win = document.defaultView;
  if (!win) {
    throw new Error('The scroll state needs a browser window');
  }

  return {
    scrollY: () => win.scrollY,
    docHeight: () => document.documentElement.scrollHeight,
    viewportHeight: () => win.innerHeight,
    prefersReducedMotion: () => win.matchMedia('(prefers-reduced-motion: reduce)').matches,
    now: () => win.performance.now(),

    onScroll(listener) {
      win.addEventListener('scroll', listener, { passive: true });
      return () => win.removeEventListener('scroll', listener);
    },

    onLayoutChange(listener) {
      win.addEventListener('resize', listener);
      const observer =
        typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(() => listener()) : null;
      observer?.observe(document.documentElement);
      observer?.observe(document.body);
      document.fonts?.addEventListener('loadingdone', listener);

      return () => {
        win.removeEventListener('resize', listener);
        observer?.disconnect();
        document.fonts?.removeEventListener('loadingdone', listener);
      };
    },

    requestFrame(run) {
      const id = win.requestAnimationFrame(() => run());
      return () => win.cancelAnimationFrame(id);
    },

    after(ms, run) {
      const id = win.setTimeout(run, ms);
      return () => win.clearTimeout(id);
    },
  };
}

export const METRICS_SOURCE = new InjectionToken<MetricsSource>('METRICS_SOURCE', {
  providedIn: 'root',
  factory: () => createBrowserMetricsSource(inject(DOCUMENT)),
});
