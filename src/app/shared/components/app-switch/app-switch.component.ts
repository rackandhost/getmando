import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * A labelled on/off tile: the whole tile is one `role="switch"` button named by its visible label
 * (design.md § 5, spec "Switch and segmented controls"). It does not hold the state: the owner passes
 * `checked` and updates it from `checkedChange`.
 */
@Component({
  selector: 'app-switch',
  templateUrl: 'app-switch.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class AppSwitchComponent {
  readonly label = input.required<string>();
  readonly checked = input(false);
  /** Id of the switch element, for error links that move focus to it. */
  readonly controlId = input<string>();
  /** The value the user asks for: the opposite of `checked`. */
  readonly checkedChange = output<boolean>();
}
