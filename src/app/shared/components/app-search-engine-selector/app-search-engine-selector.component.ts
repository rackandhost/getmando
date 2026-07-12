import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronDown, heroMagnifyingGlass } from '@ng-icons/heroicons/outline';
import {
  simpleDuckduckgo,
  simpleGoogle,
  simpleStartpage,
  simpleYoutube,
} from '@ng-icons/simple-icons';

import { SearchEngine } from '../../../core/models/dashboard.models';

@Component({
  selector: 'app-search-engine-selector',
  imports: [NgIcon],
  templateUrl: 'app-search-engine-selector.component.html',
  host: {
    '(focusout)': 'onFocusOut($event)',
  },
  viewProviders: [
    provideIcons({
      heroChevronDown,
      heroMagnifyingGlass,
      simpleDuckduckgo,
      simpleGoogle,
      simpleStartpage,
      simpleYoutube,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppSearchEngineSelectorComponent {
  readonly engines = input.required<(SearchEngine | undefined)[]>();
  readonly selectedEngine = input<SearchEngine | null>(null);
  readonly engineSelected = output<SearchEngine | null>();

  protected readonly isOpen = signal(false);
  protected readonly validEngines = computed(() =>
    this.engines().filter((engine): engine is SearchEngine => engine !== undefined),
  );
  protected readonly activeIndex = signal(0);

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly options = viewChildren<ElementRef<HTMLElement>>('option');

  protected toggle(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.validEngines().length === 0) return;

    if (this.isOpen()) {
      this.close();
      return;
    }

    this.open();
  }

  protected select(engine: SearchEngine | null, event?: Event): void {
    event?.preventDefault();
    this.engineSelected.emit(engine);
    this.isOpen.set(false);
    queueMicrotask(() => this.trigger().nativeElement.focus());
  }

  protected close(): void {
    this.isOpen.set(false);
  }

  protected onFocusOut(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement;
    const nextTarget = event.relatedTarget;

    if (!(nextTarget instanceof Node) || !host.contains(nextTarget)) this.close();
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    event.preventDefault();

    if (this.validEngines().length === 0) return;

    if (!this.isOpen()) {
      this.open(event.key === 'ArrowUp' ? this.validEngines().length : 0);
      return;
    }

    this.moveFocus(event.key === 'ArrowDown' ? 1 : -1);
  }

  protected onListboxKeydown(event: KeyboardEvent): void {
    const lastIndex = this.validEngines().length;
    let nextIndex: number | undefined;

    if (event.key === 'ArrowDown') nextIndex = (this.activeIndex() + 1) % (lastIndex + 1);
    if (event.key === 'ArrowUp') nextIndex = (this.activeIndex() + lastIndex) % (lastIndex + 1);
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = lastIndex;

    if (nextIndex !== undefined) {
      event.preventDefault();
      this.focusOption(nextIndex);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      this.trigger().nativeElement.focus();
    }
  }

  private open(index = this.selectedOptionIndex()): void {
    this.activeIndex.set(index);
    this.isOpen.set(true);
    queueMicrotask(() => this.focusOption(index));
  }

  private moveFocus(offset: number): void {
    const optionCount = this.validEngines().length + 1;
    this.focusOption((this.activeIndex() + offset + optionCount) % optionCount);
  }

  private focusOption(index: number): void {
    this.activeIndex.set(index);
    this.options()[index]?.nativeElement.focus();
  }

  private selectedOptionIndex(): number {
    const selectedId = this.selectedEngine()?.id;

    if (!selectedId) return 0;

    const engineIndex = this.validEngines().findIndex(({ id }) => id === selectedId);
    return engineIndex === -1 ? 0 : engineIndex + 1;
  }
}
