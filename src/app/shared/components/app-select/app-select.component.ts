import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroCheck, heroChevronDown } from '@ng-icons/heroicons/outline';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

/**
 * A single-choice dropdown whose menu looks and behaves like the search engine selector's: a button that
 * opens a listbox on `--menu`, the chosen option checked, arrows / Home / End to move, Enter or Space to
 * choose, Escape to close with the focus back on the button. It does not hold the value: the owner passes
 * `value` and applies `valueChange`.
 */
@Component({
  selector: 'app-select',
  imports: [NgIcon],
  templateUrl: 'app-select.component.html',
  viewProviders: [provideIcons({ heroCheck, heroChevronDown })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block', '(focusout)': 'onFocusOut($event)' },
})
export class AppSelectComponent {
  /** Accessible name of the button and of the listbox. */
  readonly label = input.required<string>();
  readonly options = input.required<readonly SelectOption[]>();
  readonly value = input.required<string>();
  /** Shown when no option matches the value (and when there are no options at all). */
  readonly placeholder = input('');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly describedBy = input<string>();
  /** Id of the button, for error links that move focus to the control. */
  readonly controlId = input<string>();
  /** Classes of the button, so each form can give it its own field look. */
  readonly buttonClass = input('');
  readonly valueChange = output<string>();

  protected readonly isOpen = signal(false);
  protected readonly activeIndex = signal(0);
  protected readonly selectedLabel = computed(
    () =>
      this.options().find((option) => option.value === this.value())?.label ?? this.placeholder(),
  );

  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly optionElements = viewChildren<ElementRef<HTMLElement>>('option');

  protected toggle(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
    } else {
      this.open();
    }
  }

  protected select(option: SelectOption): void {
    if (option.value !== this.value()) this.valueChange.emit(option.value);
    this.isOpen.set(false);
    this.trigger().nativeElement.focus();
  }

  protected onFocusOut(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement;
    if (!(event.relatedTarget instanceof Node) || !host.contains(event.relatedTarget)) {
      this.isOpen.set(false);
    }
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen()) {
      event.preventDefault();
      this.isOpen.set(false);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    event.preventDefault();
    if (this.isOpen()) {
      this.moveFocus(event.key === 'ArrowDown' ? 1 : -1);
    } else {
      this.open();
    }
  }

  protected onListboxKeydown(event: KeyboardEvent): void {
    const last = this.options().length - 1;
    const next = {
      ArrowDown: (this.activeIndex() + 1) % (last + 1),
      ArrowUp: (this.activeIndex() + last) % (last + 1),
      Home: 0,
      End: last,
    }[event.key];

    if (next !== undefined) {
      event.preventDefault();
      this.focusOption(next);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.isOpen.set(false);
      this.trigger().nativeElement.focus();
    }
  }

  protected onOptionKeydown(event: KeyboardEvent, option: SelectOption): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    this.select(option);
  }

  private open(): void {
    if (this.disabled() || this.options().length === 0) return;

    const selected = this.options().findIndex((option) => option.value === this.value());
    this.activeIndex.set(Math.max(0, selected));
    this.isOpen.set(true);
    afterNextRender(() => this.focusOption(this.activeIndex()), { injector: this.injector });
  }

  private moveFocus(offset: number): void {
    const count = this.options().length;
    this.focusOption((this.activeIndex() + offset + count) % count);
  }

  private focusOption(index: number): void {
    this.activeIndex.set(index);
    this.optionElements()[index]?.nativeElement.focus();
  }
}
