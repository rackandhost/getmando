import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChildren,
} from '@angular/core';

export interface SegmentedOption {
  readonly value: string;
  readonly label: string;
}

let nextId = 0;

/**
 * A short single-choice control (`Light | Dark | Auto`) with radio-group semantics: one tab stop on the
 * checked option, arrow keys move the selection and the focus together, Home and End jump to the ends.
 * It does not hold the value: the owner passes `value` and updates it from `valueChange`.
 */
@Component({
  selector: 'app-segmented',
  templateUrl: 'app-segmented.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2' },
})
export class AppSegmentedComponent {
  /** Visible label above the control and name of the radio group. */
  readonly label = input.required<string>();
  readonly options = input.required<readonly SegmentedOption[]>();
  readonly value = input.required<string>();
  /** Id of the radio group, for error links that move focus to the control. */
  readonly controlId = input<string>();
  readonly valueChange = output<string>();

  protected readonly labelId = `segmented-label-${nextId++}`;
  private readonly radios = viewChildren<ElementRef<HTMLButtonElement>>('radio');

  protected select(value: string): void {
    if (value !== this.value()) this.valueChange.emit(value);
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const count = this.options().length;
    const target = {
      ArrowRight: (index + 1) % count,
      ArrowDown: (index + 1) % count,
      ArrowLeft: (index - 1 + count) % count,
      ArrowUp: (index - 1 + count) % count,
      Home: 0,
      End: count - 1,
    }[event.key];

    if (target === undefined) return;

    event.preventDefault();
    this.radios()[target]?.nativeElement.focus();
    this.select(this.options()[target].value);
  }
}
