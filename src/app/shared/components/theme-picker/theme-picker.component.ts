import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroCheck, heroMagnifyingGlass, heroSwatch } from '@ng-icons/heroicons/outline';

import { ThemeService } from '../../../core/services/theme.service';
import { THEMES, themeInfo, type ThemeId } from '../../../core/themes/theme.registry';
import { ThemePreviewComponent, toSwatch } from '../theme-preview/theme-preview.component';

let nextId = 0;

/**
 * The theme button of the chrome and the modal dialog it opens. The dialog is a native `<dialog>` shown
 * with `showModal()`: the browser gives it the focus trap, makes the page behind inert and draws it in
 * the top layer, above the `glass-chrome` surfaces that would otherwise clip a fixed overlay.
 *
 * Focus stays in the search field; the highlighted option is exposed through `aria-activedescendant`.
 * While the dialog is open a highlighted option other than the committed theme is shown as a preview
 * (`ThemeService.preview`; the committed theme needs none, so highlighting it leaves no preview);
 * choosing one stores it as this device's preference (`ThemeService.select`), and every other way out
 * (`Esc`, `Close`, the backdrop, destroying the component) restores the committed theme.
 */
@Component({
  selector: 'app-theme-picker',
  imports: [NgIcon, ThemePreviewComponent],
  templateUrl: 'theme-picker.component.html',
  viewProviders: [provideIcons({ heroCheck, heroMagnifyingGlass, heroSwatch })],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemePickerComponent {
  private readonly themeService = inject(ThemeService);

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly searchField = viewChild.required<ElementRef<HTMLInputElement>>('searchField');
  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');

  private readonly id = nextId++;
  protected readonly searchId = `theme-picker-${this.id}-search`;
  protected readonly listId = `theme-picker-${this.id}-list`;

  /** The theme applied without a preview: the button's name and the `Active` marker follow it. */
  protected readonly committed = this.themeService.committed;
  protected readonly committedName = computed(() => themeInfo(this.committed()).name);

  protected readonly open = signal(false);
  protected readonly query = signal('');
  /** The row the user moved to; `undefined` means the first row shown. */
  protected readonly highlight = signal<ThemeId | undefined>(undefined);

  /** Case-insensitive substring over name and description, in registry order. */
  protected readonly rows = computed(() => {
    const query = this.query().trim().toLowerCase();
    return THEMES.filter((theme) =>
      `${theme.name} ${theme.description}`.toLowerCase().includes(query),
    ).map((theme) => ({ ...theme, swatches: [toSwatch(theme)] }));
  });
  protected readonly highlighted = computed(() => {
    const rows = this.rows();
    return rows.find((row) => row.id === this.highlight())?.id ?? rows[0]?.id;
  });

  private pressedOnBackdrop = false;
  private buttonWatcher?: ResizeObserver;

  constructor() {
    effect(() => {
      const id = this.highlighted();
      if (!this.open()) return;
      if (id && id !== this.committed()) this.themeService.preview(id);
      else this.themeService.cancelPreview();
    });
    inject(DestroyRef).onDestroy(() => {
      this.buttonWatcher?.disconnect();
      this.themeService.cancelPreview();
    });
  }

  protected optionId(id: ThemeId, part?: 'name' | 'description' | 'active'): string {
    return `theme-picker-${this.id}-${id}${part ? `-${part}` : ''}`;
  }

  protected describedBy(id: ThemeId): string {
    const description = this.optionId(id, 'description');
    return id === this.committed() ? `${description} ${this.optionId(id, 'active')}` : description;
  }

  protected show(): void {
    this.query.set('');
    this.highlight.set(this.committed());
    this.dialog().nativeElement.showModal();
    this.open.set(true);
    this.searchField().nativeElement.focus();
    this.watchButton();
  }

  /** Runs for every way the dialog closes: `Esc` (native or ours), `Close`, or a choice. */
  protected onClosed(): void {
    this.open.set(false);
    this.buttonWatcher?.disconnect();
    this.buttonWatcher = undefined;
    this.themeService.cancelPreview();
    this.trigger().nativeElement.focus();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  /**
   * The rail renders the picker in two places and shows one at a time, so a resize can hide the button of
   * an open dialog (`display: none` reports a zero size). The dialog would stay open, invisible and with
   * the page inert, so it closes instead, like any other way out.
   */
  private watchButton(): void {
    if (typeof ResizeObserver !== 'function') return;
    this.buttonWatcher = new ResizeObserver((entries) => {
      if (entries.some(({ contentRect }) => contentRect.width === 0 && contentRect.height === 0)) {
        this.close();
      }
    });
    this.buttonWatcher.observe(this.trigger().nativeElement);
  }

  protected setQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.highlight.set(undefined);
  }

  protected choose(id: ThemeId): void {
    this.themeService.select(id);
    this.close();
  }

  /**
   * The native modal keeps focus off the page but lets it leave for the browser's own interface after
   * the last control. The dialog has two focusable controls, the search field and `Close`, so wrapping
   * at those two edges keeps `Tab` and `Shift+Tab` cycling inside it.
   */
  protected onDialogKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const first = this.searchField().nativeElement;
    const last = this.closeButton().nativeElement;
    const [leaving, entering] = event.shiftKey ? [first, last] : [last, first];
    if (event.target !== leaving) return;
    event.preventDefault();
    entering.focus();
  }

  /** A press and release on the backdrop closes; a text selection dragged out of the field does not. */
  protected onDialogMouseDown(event: MouseEvent): void {
    this.pressedOnBackdrop = event.target === event.currentTarget;
  }

  protected onDialogClick(event: MouseEvent): void {
    if (this.pressedOnBackdrop && event.target === event.currentTarget) this.close();
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const id = this.highlighted();
      if (id) this.choose(id);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.move(event.key === 'ArrowDown' ? 1 : -1);
    }
  }

  /** Moves the highlight one row, wrapping at both ends, and keeps it in view in a scrolling list. */
  private move(step: 1 | -1): void {
    const rows = this.rows();
    if (rows.length === 0) return;
    const at = rows.findIndex((row) => row.id === this.highlighted());
    const next = rows[(at + step + rows.length) % rows.length];
    this.highlight.set(next.id);
    this.dialog()
      .nativeElement.querySelector(`#${this.optionId(next.id)}`)
      ?.scrollIntoView({
        block: 'nearest',
      });
  }
}
