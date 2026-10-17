/** A numbered section of the page, as the side navigation lists it. */
export interface ConfiguratorSection {
  readonly id: string;
  readonly label: string;
  /** `01`–`07`, decorative: the navigation carries it for assistive technology. */
  readonly number: string;
  /** Id of the section's element. */
  readonly elementId: string;
  /** Link to it that stays on the page (a bare `#id` would resolve against `<base href>`). */
  readonly href: string;
}

/** A section chosen in the navigation: the page scrolls to it and takes over the click. */
export interface SectionSelection {
  readonly elementId: string;
  readonly event: Event;
}

/** Air (px) the sections keep under whatever sticks above them on a page with nothing else covering them. */
export const SECTION_CLEARANCE = 20;

/**
 * What the configurator page needs to know about the layout around it. Each arrangement (the sticky
 * header with a side navigation, the rail) provides itself under this class, so the page finds the one
 * in its view with `viewChild(ConfiguratorChrome)` and keeps the scroll-spy, the store and every handler.
 */
export abstract class ConfiguratorChrome {
  /** The section navigation is the chip bar. */
  abstract narrow(): boolean;
  /** Height (px) of what still covers the top of the viewport: the sticky header or rail part. */
  abstract stackHeight(): number;
  /** `scroll-margin-top` (px) of the sections. */
  abstract sectionMargin(): number;
}
