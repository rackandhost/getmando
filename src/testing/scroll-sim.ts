import {
  nextEligible,
  nextMode,
  remainingCapacity,
  type ChromeMode,
  type ScrollInput,
} from '../app/core/scroll/scroll-state';

/**
 * Closed-loop model of the page around the scroll state: the document height depends on the chrome's
 * mode, `scrollY` is clamped to the document, and the user's scroll intent is held (the strictest
 * model: a browser never restores a clamped position, this one does).
 *
 * Geometry of the worked example in design.md § 4.1: 5 columns of 171 px cards, 14 px gap.
 */
export const ROW_HEIGHT = 185;
/** Document height with no app rows. */
export const BASE_HEIGHT = 709;

export interface World {
  rows: number;
  viewportHeight: number;
  /** Height the chrome loses when compacting. */
  delta: number;
  /** Viewport guard: the chrome is sticky only at this viewport height or more. */
  minViewportHeight: number;
}

export interface SimState {
  mode: ChromeMode;
  eligible: boolean;
  /** Where the user wants to be; `scrollY` is this clamped to the current document. */
  intent: number;
  scrollY: number;
  docHeight: number;
}

export type Decide = (input: ScrollInput) => ChromeMode;

/** Document height in the Top layout, which is also the Static layout. */
function docTop(world: World): number {
  return BASE_HEIGHT + world.rows * ROW_HEIGHT;
}

function layout(world: World, mode: ChromeMode, intent: number) {
  const docHeight = docTop(world) - (mode === 'scrolled' ? world.delta : 0);
  const maxScrollY = Math.max(0, docHeight - world.viewportHeight);
  return { docHeight, scrollY: Math.min(Math.max(intent, 0), maxScrollY) };
}

/**
 * One evaluation: the browser lays the page out and clamps `scrollY`, the service decides the next
 * mode from those measurements, and the page is laid out again in that mode.
 */
export function evaluate(world: World, state: SimState, decide: Decide = nextMode): SimState {
  const measured = layout(world, state.mode, state.intent);
  const r = remainingCapacity({
    docHeight: measured.docHeight,
    viewportHeight: world.viewportHeight,
    delta: world.delta,
    mode: state.mode,
  });
  const eligible = nextEligible(state.eligible, r);
  const mode = decide({
    scrollY: measured.scrollY,
    docHeight: measured.docHeight,
    viewportHeight: world.viewportHeight,
    delta: world.delta,
    mode: state.mode,
    eligible,
    guardOk: world.viewportHeight >= world.minViewportHeight,
  });

  return { mode, eligible, intent: state.intent, ...layout(world, mode, state.intent) };
}

const MAX_EVALUATIONS = 10;

export interface Settled {
  state: SimState;
  /** Mode changes while settling. */
  modeChanges: number;
  /** Evaluations run, the last one being the first that changed nothing. */
  evaluations: number;
}

/** Evaluates until nothing changes. Throws if it does not settle, i.e. the chrome is in a loop. */
export function settle(world: World, state: SimState, decide: Decide = nextMode): Settled {
  let current = state;
  let modeChanges = 0;

  for (let evaluations = 1; evaluations <= MAX_EVALUATIONS; evaluations++) {
    const next = evaluate(world, current, decide);
    const modeChanged = next.mode !== current.mode;
    const stable = !modeChanged && next.eligible === current.eligible;
    modeChanges += modeChanged ? 1 : 0;
    current = next;
    if (stable) {
      return { state: current, modeChanges, evaluations };
    }
  }
  throw new Error(`Scroll state did not settle in ${MAX_EVALUATIONS} evaluations`);
}

/** A page that has just loaded at the top and settled. */
export function startAt(world: World, decide: Decide = nextMode): SimState {
  const initial: SimState = {
    mode: 'static',
    eligible: false,
    intent: 0,
    ...layout(world, 'static', 0),
  };
  return settle(world, initial, decide).state;
}

/** The user scrolls to `y` (and holds it). */
export function scrollTo(state: SimState, y: number): SimState {
  return { ...state, intent: y };
}
