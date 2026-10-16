/** Distance from the viewport top (px) under which a section counts as reached (design.md § 4.1). */
export const ACTIVE_FLOOR = 140;
export const ACTIVE_FLOOR_NARROW = 200;
/** Air between the sticky stack and the section a navigation item scrolls to. */
const STACK_CLEARANCE = 24;

export interface SectionPosition {
  id: string;
  /** Top edge relative to the viewport (px). */
  top: number;
}

/**
 * Where a section's top must be, at the latest, to be the active one: the fixed floor, or the live height
 * of the sticky stack plus 24 px when that is larger, so a section scrolled to just under the stack is active.
 */
export function activeThreshold(stackHeight: number, narrow: boolean): number {
  return Math.max(narrow ? ACTIVE_FLOOR_NARROW : ACTIVE_FLOOR, stackHeight + STACK_CLEARANCE);
}

/**
 * The last section whose top is at or above `threshold`; the first one before any has been reached; the
 * last one when the page is scrolled to the bottom. `sections` are in document order.
 */
export function activeSection(
  sections: readonly SectionPosition[],
  threshold: number,
  atBottom: boolean,
): string | undefined {
  if (sections.length === 0) {
    return undefined;
  }
  if (atBottom) {
    return sections[sections.length - 1].id;
  }

  let active = sections[0].id;
  for (const section of sections) {
    if (section.top <= threshold) {
      active = section.id;
    }
  }
  return active;
}
