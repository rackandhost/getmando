import { inject, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';

import { LoggerService } from '../services/logger.service';

import { METRICS_SOURCE, type Cancel } from './metrics-source';
import { nextEligible, nextMode, remainingCapacity, type ChromeMode } from './scroll-state';

/** A sticky chrome (dashboard dock, mobile dock, configurator header) that follows the scroll state. */
export interface ChromeProbe {
  /** Names the chrome in diagnostics. */
  id: string;
  /** Height (px) the chrome loses when it compacts; read at every evaluation. */
  compactDelta: () => number;
  /** Viewport height (px) below which the chrome stays Static (D13). */
  minViewportHeight: number;
}

export interface ChromeHandle {
  readonly mode: Signal<ChromeMode>;
  /** Stops following the scroll state; the last chrome to leave releases the browser listeners. */
  dispose(): void;
}

/** Time a state change is left to finish animating before another is allowed (0 under reduced motion). */
const DWELL_MS = 400;
/** More than this many changes within `BREAKER_WINDOW_MS` latch the chrome Static. */
const BREAKER_CHANGES = 4;
const BREAKER_WINDOW_MS = 2_000;

/** What the breaker compares to know the viewport or the content changed. */
interface LayoutKey {
  viewportHeight: number;
  /** Document height in the Top layout, so the chrome's own flips do not change it. */
  docTop: number;
}

interface Tracked {
  probe: ChromeProbe;
  mode: WritableSignal<ChromeMode>;
  eligible: boolean;
  /** No change is allowed before this time. */
  dwellUntil: number;
  changeTimes: number[];
  /** Set while the breaker holds the chrome Static; cleared when the layout key differs. */
  latchedAt: LayoutKey | null;
  cancelDwellTimer: Cancel | null;
}

/**
 * One shared scroll state for every sticky chrome (design-system spec "Scroll-state stability").
 *
 * The browser only notifies: scroll and observer callbacks schedule an animation frame, and every
 * decision is taken in that frame from fresh measurements, never inside an observer callback.
 */
@Injectable({ providedIn: 'root' })
export class ScrollStateService {
  private readonly source = inject(METRICS_SOURCE);
  private readonly logger = inject(LoggerService);

  private readonly chromes = new Set<Tracked>();
  private stopListening: Cancel[] = [];
  private cancelFrame: Cancel | null = null;

  register(probe: ChromeProbe): ChromeHandle {
    const tracked: Tracked = {
      probe,
      mode: signal<ChromeMode>('static'),
      eligible: false,
      dwellUntil: 0,
      changeTimes: [],
      latchedAt: null,
      cancelDwellTimer: null,
    };
    this.chromes.add(tracked);
    if (this.chromes.size === 1) {
      const schedule = () => this.scheduleFrame();
      this.stopListening = [this.source.onScroll(schedule), this.source.onLayoutChange(schedule)];
    }
    this.scheduleFrame();

    return {
      mode: tracked.mode.asReadonly(),
      dispose: () => this.dispose(tracked),
    };
  }

  private dispose(tracked: Tracked): void {
    tracked.cancelDwellTimer?.();
    this.chromes.delete(tracked);
    if (this.chromes.size === 0) {
      this.stopListening.forEach((stop) => stop());
      this.stopListening = [];
      this.cancelFrame?.();
      this.cancelFrame = null;
    }
  }

  private scheduleFrame(): void {
    if (this.cancelFrame) {
      return;
    }
    this.cancelFrame = this.source.requestFrame(() => {
      this.cancelFrame = null;
      this.chromes.forEach((tracked) => this.evaluate(tracked));
    });
  }

  private evaluate(tracked: Tracked): void {
    const { probe } = tracked;
    const mode = tracked.mode();
    const docHeight = this.source.docHeight();
    const viewportHeight = this.source.viewportHeight();
    const delta = probe.compactDelta();
    const docTop = Math.round(docHeight + (mode === 'scrolled' ? delta : 0));
    const key: LayoutKey = { viewportHeight: Math.round(viewportHeight), docTop };

    if (tracked.latchedAt) {
      const unchanged =
        tracked.latchedAt.viewportHeight === key.viewportHeight &&
        tracked.latchedAt.docTop === key.docTop;
      if (unchanged) {
        return;
      }
      tracked.latchedAt = null;
      tracked.changeTimes = [];
    }

    tracked.eligible = nextEligible(
      tracked.eligible,
      remainingCapacity({ docHeight, viewportHeight, delta, mode }),
    );
    const desired = nextMode({
      scrollY: this.source.scrollY(),
      docHeight,
      viewportHeight,
      delta,
      mode,
      eligible: tracked.eligible,
      guardOk: viewportHeight >= probe.minViewportHeight,
    });
    if (desired === mode) {
      return;
    }

    const now = this.source.now();
    if (now < tracked.dwellUntil) {
      this.revisitWhenDwellEnds(tracked, tracked.dwellUntil - now);
      return;
    }

    tracked.changeTimes = [...tracked.changeTimes.filter((t) => now - t < BREAKER_WINDOW_MS), now];
    if (tracked.changeTimes.length > BREAKER_CHANGES) {
      tracked.latchedAt = key;
      tracked.mode.set('static');
      this.logger.warn(
        `[ScrollStateService] "${probe.id}" changed state ${tracked.changeTimes.length} times within ` +
          `${BREAKER_WINDOW_MS} ms; holding it Static until the viewport or content height changes`,
      );
      return;
    }

    tracked.mode.set(desired);
    tracked.dwellUntil = now + (this.source.prefersReducedMotion() ? 0 : DWELL_MS);
  }

  private revisitWhenDwellEnds(tracked: Tracked, remaining: number): void {
    tracked.cancelDwellTimer?.();
    tracked.cancelDwellTimer = this.source.after(remaining, () => {
      tracked.cancelDwellTimer = null;
      this.scheduleFrame();
    });
  }
}
