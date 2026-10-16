import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/** Id of a configurator section element; the side navigation links to it. */
export function configSectionId(section: string): string {
  return `section-${section}`;
}

/**
 * One numbered section card of the configurator (`01`–`07`): a labelled region with its heading,
 * description and an optional action beside the heading (`[sectionAction]`). The number is
 * decorative, the side navigation carries it for assistive technology.
 */
@Component({
  selector: 'app-config-section',
  templateUrl: 'config-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class ConfigSectionComponent {
  /** Short name of the section, e.g. `applications`; the element id is `section-applications`. */
  readonly section = input.required<string>();
  readonly number = input('');
  readonly title = input.required<string>();
  readonly description = input('');
  /** Keeps a long description to a readable line length (the Export text is 640 px wide in the design). */
  readonly narrowDescription = input(false, { transform: booleanAttribute });

  protected readonly id = computed(() => configSectionId(this.section()));
  protected readonly headingId = computed(() => `${this.id()}-heading`);
}
