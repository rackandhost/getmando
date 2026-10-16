import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowDown,
  heroArrowUp,
  heroPencilSquare,
  heroPlus,
  heroTrash,
} from '@ng-icons/heroicons/outline';

import { IconConfig } from '../../../core/models/dashboard.models';

import { AppSwitchComponent } from '../../../shared/components/app-switch/app-switch.component';

import { ConfigSectionComponent } from './config-section.component';

type CollectionName = 'categories' | 'applications' | 'bookmarks';
type EditableItem = {
  id: string;
  name: string;
  icon?: string | IconConfig;
  category?: string;
  description?: string;
  url?: string;
  openNewTab?: boolean;
  tags?: readonly string[];
  favorite?: boolean;
  healthCheck?: boolean;
};
type EditableField =
  | 'id'
  | 'name'
  | 'category'
  | 'description'
  | 'url'
  | 'openNewTab'
  | 'tags'
  | 'favorite'
  | 'healthCheck';
type TextField = Extract<EditableField, 'id' | 'name' | 'category' | 'description' | 'url'>;
type BooleanField = Extract<EditableField, 'openNewTab' | 'favorite' | 'healthCheck'>;
type ArrayField = Extract<EditableField, 'tags'>;
type IconField = 'iconType' | 'iconValue';

export type CollectionEditEvent =
  | { readonly index: number; readonly field: TextField; readonly value: string }
  | { readonly index: number; readonly field: BooleanField; readonly value: boolean }
  | { readonly index: number; readonly field: ArrayField; readonly value: string[] }
  | { readonly index: number; readonly field: 'icon'; readonly value: IconConfig };

@Component({
  selector: 'app-collection-editor',
  imports: [NgIcon, AppSwitchComponent, ConfigSectionComponent],
  templateUrl: 'collection-editor.component.html',
  viewProviders: [
    provideIcons({ heroArrowDown, heroArrowUp, heroPencilSquare, heroPlus, heroTrash }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class CollectionEditorComponent {
  readonly collection = input.required<CollectionName>();
  readonly items = input.required<readonly EditableItem[]>();
  readonly categoryOptions = input<readonly Pick<EditableItem, 'id' | 'name'>[]>([]);
  readonly fieldErrorIds = input<Readonly<Record<string, string>>>({});
  readonly fieldErrors = input<Readonly<Record<string, string>>>({});
  /** The `04`–`06` shown beside the heading; empty when the editor is used outside the numbered page. */
  readonly sectionNumber = input('');
  readonly addItem = output<void>();
  readonly removeItem = output<number>();
  readonly moveItem = output<{ from: number; to: number }>();
  readonly editItem = output<CollectionEditEvent>();

  private readonly removeButtons = viewChildren<ElementRef<HTMLButtonElement>>('removeButton');
  private readonly editButtons = viewChildren<ElementRef<HTMLButtonElement>>('editButton');
  private readonly nameInputs = viewChildren<ElementRef<HTMLInputElement>>('nameInput');
  private readonly moveUpButtons = viewChildren<ElementRef<HTMLButtonElement>>('moveUpButton');
  private readonly moveDownButtons = viewChildren<ElementRef<HTMLButtonElement>>('moveDownButton');
  private readonly injector = inject(Injector);
  /** Rows whose editor is open: opened by Edit, by Add, and by validation errors. */
  private readonly openRows = signal<ReadonlySet<number>>(new Set());

  protected readonly labelClass = 'flex flex-col gap-2 text-[13px] font-medium text-text';
  protected readonly fieldClass =
    'glass-field h-11 w-full rounded-[10px] px-3 text-sm font-normal text-text';
  protected readonly monoFieldClass = `${this.fieldClass} font-mono`;
  protected readonly textareaClass =
    'glass-field min-h-11 w-full rounded-[10px] px-3 py-2.5 text-sm font-normal text-text';
  protected readonly errorClass = 'text-[13px] font-medium text-down';
  protected readonly actionClass =
    'inline-flex size-9 items-center justify-center rounded-[10px] border border-line-strong text-text transition-colors hover:bg-line disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:size-11';
  protected readonly dangerActionClass = this.actionClass.replace('text-text', 'text-down');

  constructor() {
    // A row with a validation error opens, so the error and its field can be seen and reached.
    effect(() => {
      const rows = Object.keys(this.fieldErrors())
        .map((key) => Number.parseInt(key, 10))
        .filter(Number.isInteger);
      if (rows.length === 0) return;

      untracked(() => this.openRows.update((open) => new Set([...open, ...rows])));
    });
  }

  protected addLabel(): string {
    return `Add ${this.collectionLabel()}`;
  }

  protected errorId(index: number, field: EditableField | IconField): string | undefined {
    return this.fieldErrorIds()[this.errorKey(index, field)];
  }

  protected errorMessage(index: number, field: EditableField | IconField): string | undefined {
    return this.fieldErrors()[this.errorKey(index, field)];
  }

  protected itemIcon(item: EditableItem): IconConfig {
    return typeof item.icon === 'object' && item.icon !== undefined
      ? item.icon
      : { type: 'initials', value: '' };
  }

  protected fieldId(index: number, field: EditableField | IconField): string {
    return `field-${this.collection()}-${index}-${this.errorFieldName(field)}`;
  }

  protected describedBy(index: number, field: EditableField | IconField): string | undefined {
    const descriptions = [
      ...(field === 'iconValue'
        ? [`${this.collectionLabel()}-icon-${this.iconType(index)}-help-${index}`]
        : []),
      this.errorId(index, field),
    ].filter((id): id is string => Boolean(id));

    return descriptions.length > 0 ? descriptions.join(' ') : undefined;
  }

  protected itemLabel(item: EditableItem): string {
    return item.name || item.id || 'new item';
  }

  protected fieldLabel(item: EditableItem, field: EditableField): string {
    const itemLabel = this.itemLabel(item);
    const collection = this.collectionLabel();
    const capitalized = `${collection[0].toUpperCase()}${collection.slice(1)}`;
    const labels: Record<EditableField, string> = {
      id: `${capitalized} ID for ${itemLabel}`,
      name: `${capitalized} name for ${itemLabel}`,
      category: `Application category for ${itemLabel}`,
      description: `${capitalized} description for ${itemLabel}`,
      url: `${capitalized} URL for ${itemLabel}`,
      openNewTab: `Open in new tab for ${itemLabel}`,
      tags: `${capitalized} tags for ${itemLabel}`,
      favorite: `Favorite for ${itemLabel}`,
      healthCheck: `Health check for ${itemLabel}`,
    };

    return labels[field];
  }

  protected editText(index: number, field: TextField, event: Event): void {
    this.editItem.emit({
      index,
      field,
      value: (event.target as HTMLInputElement | HTMLSelectElement).value,
    });
  }

  protected setBoolean(index: number, field: BooleanField, value: boolean): void {
    this.editItem.emit({ index, field, value });
  }

  protected editTags(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    this.editItem.emit({ index, field: 'tags', value });
  }

  protected iconType(index: number): IconConfig['type'] {
    return this.itemIcon(this.items()[index]).type;
  }

  protected iconValue(index: number): string {
    return this.itemIcon(this.items()[index]).value;
  }

  protected iconValueLabel(index: number): string {
    const itemLabel = this.itemLabel(this.items()[index]);
    const type = this.iconType(index);
    return `Icon ${type === 'url' ? 'URL' : type} for ${itemLabel}`;
  }

  protected iconHelp(index: number): string {
    switch (this.iconType(index)) {
      case 'url':
        return `Enter the absolute URL for the ${this.collectionLabel()} icon.`;
      case 'name':
        return 'Enter the registered icon name.';
      case 'initials':
        return `Enter the initials displayed for the ${this.collectionLabel()}.`;
    }
  }

  protected updateIconType(index: number, event: Event): void {
    const type = (event.target as HTMLSelectElement).value;
    if (!this.isIconType(type)) return;

    this.editItem.emit({
      index,
      field: 'icon',
      value: { ...this.itemIcon(this.items()[index]), type },
    });
  }

  protected updateIconValue(index: number, event: Event): void {
    this.editItem.emit({
      index,
      field: 'icon',
      value: {
        ...this.itemIcon(this.items()[index]),
        value: (event.target as HTMLInputElement).value,
      },
    });
  }

  protected add(): void {
    const newIndex = this.items().length;
    this.addItem.emit();
    this.expand(newIndex);
  }

  protected remove(index: number): void {
    this.removeItem.emit(index);
    this.remapOpenRows((row) => (row === index ? null : row > index ? row - 1 : row));
    afterNextRender(
      () => {
        const buttons = this.removeButtons();
        buttons[Math.min(index, buttons.length - 1)]?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  /** The moved item keeps its editor open and its focus: on the same-direction button, or the other at an end. */
  protected move(from: number, to: number): void {
    const buttons = to < from ? this.moveUpButtons : this.moveDownButtons;
    const others = to < from ? this.moveDownButtons : this.moveUpButtons;

    this.moveItem.emit({ from, to });
    this.remapOpenRows((row) => (row === from ? to : row === to ? from : row));
    afterNextRender(
      () => {
        const same = buttons()[to]?.nativeElement;
        (same && !same.disabled ? same : others()[to]?.nativeElement)?.focus();
      },
      { injector: this.injector },
    );
  }

  protected isOpen(index: number): boolean {
    return this.openRows().has(index);
  }

  /** Edit opens the editor and puts the focus in its first field, or closes it and keeps the focus on Edit. */
  protected toggle(index: number): void {
    if (this.isOpen(index)) {
      this.collapse(index);
    } else {
      this.expand(index);
    }
  }

  protected collapse(index: number): void {
    this.openRows.update((rows) => {
      const next = new Set(rows);
      next.delete(index);
      return next;
    });
    this.editButtons()[index]?.nativeElement.focus();
  }

  private expand(index: number): void {
    this.openRows.update((rows) => new Set(rows).add(index));
    afterNextRender(() => this.nameInputs()[index]?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  protected editorId(index: number): string {
    return `${this.collection()}-editor-${index}`;
  }

  protected rowNumber(index: number): string {
    return String(index + 1).padStart(2, '0');
  }

  /** Categories are identified by their id; applications and bookmarks by where they lead. */
  protected secondaryText(item: EditableItem): string {
    return this.collection() === 'categories' ? item.id : item.url || item.id;
  }

  protected categoryName(item: EditableItem): string {
    if (this.collection() !== 'applications' || !item.category) return '';
    return (
      this.categoryOptions().find((option) => option.id === item.category)?.name ?? item.category
    );
  }

  /** `health · new tab`, `new tab`, or nothing. */
  protected flagsSummary(item: EditableItem): string {
    if (this.collection() === 'categories') return '';
    return [
      this.collection() === 'applications' && item.healthCheck ? 'health' : '',
      (item.openNewTab ?? true) ? 'new tab' : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  /** The icon's own image when it is a URL; other kinds show their first letters instead. */
  protected iconImage(item: EditableItem): string {
    const icon = this.itemIcon(item);
    return icon.type === 'url' ? icon.value : '';
  }

  protected iconGlyph(item: EditableItem): string {
    const value = this.itemIcon(item).value || this.itemLabel(item);
    return value.slice(0, 2).toUpperCase();
  }

  protected collectionLabel(): string {
    return this.collection() === 'categories' ? 'category' : this.collection().slice(0, -1);
  }

  protected supportsIcon(): boolean {
    return this.collection() === 'applications' || this.collection() === 'bookmarks';
  }

  /** Items are tracked by position, so the open rows follow their items through a move or a removal. */
  private remapOpenRows(map: (row: number) => number | null): void {
    this.openRows.update(
      (rows) =>
        new Set(
          [...rows].flatMap((row) => {
            const mapped = map(row);
            return mapped === null ? [] : [mapped];
          }),
        ),
    );
  }

  private errorKey(index: number, field: EditableField | IconField): string {
    return `${index}-${this.errorFieldName(field)}`;
  }

  private errorFieldName(field: EditableField | IconField): string {
    if (field === 'iconType') return 'icon-type';
    if (field === 'iconValue') return 'icon-value';
    return field;
  }

  private isIconType(value: string): value is IconConfig['type'] {
    return value === 'url' || value === 'name' || value === 'initials';
  }
}
