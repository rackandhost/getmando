/**
 * Pure core of the shared scroll state that drives the sticky chrome (design.md § 4.1, design-system
 * spec "Scroll-state stability"). No Angular, no DOM: every decision is a function of measurements.
 *
 * The loop-free property rests on one rule: eligibility is computed from the document height *as it
 * would be in the Top layout*, so flipping between Top and Scrolled can never change it.
 */

/** `static`: not sticky, Top look. `top`: sticky, large. `scrolled`: sticky, compact band. */
export type ChromeMode = 'static' | 'top' | 'scrolled';

export interface ScrollInput {
  scrollY: number;
  /** Current document height (px), in the layout of `mode`. */
  docHeight: number;
  viewportHeight: number;
  /** Height (px) the chrome loses when it compacts: H_top − H_scrolled. */
  delta: number;
  mode: ChromeMode;
  /** Result of `nextEligible` for these measurements. */
  eligible: boolean;
  /** The viewport is tall enough for the chrome to be sticky (D13). */
  guardOk: boolean;
}

/** Top → Scrolled when `scrollY` rises above this. */
export const ENTER = 40;
/** Scrolled → Top when `scrollY` falls to this or below. */
export const EXIT = 4;
/** Not eligible → eligible when the remaining capacity reaches this. */
export const ELIGIBLE_ON = 80;
/** Eligible → not eligible when the remaining capacity drops below this (24 px dead band). */
export const ELIGIBLE_OFF = 56;

/**
 * Scroll left once the chrome has compacted: `R = (docTop − viewport) − Δ`, where `docTop` is the
 * document height in the Top layout. A Scrolled document is Δ shorter, so it is added back; R is the
 * same in every mode.
 */
export function remainingCapacity(
  i: Pick<ScrollInput, 'docHeight' | 'viewportHeight' | 'delta' | 'mode'>,
): number {
  const docTop = i.docHeight + (i.mode === 'scrolled' ? i.delta : 0);
  return docTop - i.viewportHeight - i.delta;
}

/** Eligibility with a dead band: on at `R ≥ 80`, off at `R < 56`, unchanged in between. */
export function nextEligible(previous: boolean, r: number): boolean {
  return r >= (previous ? ELIGIBLE_OFF : ELIGIBLE_ON);
}

/**
 * The mode for these measurements, in a single step: a chrome that becomes eligible while the page is
 * already scrolled goes straight to Scrolled, so one input change never causes two mode changes.
 */
export function nextMode(i: ScrollInput): ChromeMode {
  if (!i.eligible || !i.guardOk) {
    return 'static';
  }
  if (i.mode === 'scrolled') {
    return i.scrollY <= EXIT ? 'top' : 'scrolled';
  }
  return i.scrollY > ENTER ? 'scrolled' : 'top';
}
