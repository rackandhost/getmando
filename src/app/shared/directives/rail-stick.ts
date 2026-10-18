/** Measurements of a rail, in px: its height and where its sticky anchor sits inside it. */
export interface RailMeasure {
  /** Distance from the top edge of the rail to the top edge of the anchor block. */
  anchorTop: number;
  /** The rail's own top padding. */
  paddingTop: number;
  railHeight: number;
}

/**
 * Px the compact rail may scroll before it sticks: everything above the anchor, while the rail keeps
 * its own top padding so the anchor ends up one padding below the top of the viewport.
 */
export function railStickOffset({
  anchorTop,
  paddingTop,
}: Pick<RailMeasure, 'anchorTop' | 'paddingTop'>): number {
  return Math.max(0, anchorTop - paddingTop);
}

/** Px of the rail that stay visible once it is stuck. */
export function stuckHeight({
  railHeight,
  anchorTop,
  paddingTop,
}: Pick<RailMeasure, 'railHeight' | 'anchorTop' | 'paddingTop'>): number {
  return Math.max(0, railHeight - railStickOffset({ anchorTop, paddingTop }));
}
