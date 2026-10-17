import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroCheck, heroChevronDown } from '@ng-icons/heroicons/outline';

import type { DashboardLayout } from '../../../core/models/dashboard.models';

import { LayoutThumbnailComponent } from './layout-thumbnail.component';

interface LayoutOption {
  readonly value: DashboardLayout;
  readonly name: string;
  readonly description: string;
}

const LAYOUTS: readonly LayoutOption[] = [
  {
    value: 'horizontal',
    name: 'Horizontal bar',
    description: 'Clock, search and categories on top',
  },
  {
    value: 'vertical',
    name: 'Vertical bar',
    description: 'Sticky sidebar, apps use the full width',
  },
];

let nextId = 0;

/**
 * The Layout control of the Settings section: a disclosure whose summary shows the chosen layout and,
 * opened (the default), a radio group of one preview card per layout. It does not hold the value: the
 * owner passes `value` and updates it from `valueChange`. Opening and closing is local state and never
 * changes the value.
 */
@Component({
  selector: 'app-layout-picker',
  imports: [NgIcon, LayoutThumbnailComponent],
  templateUrl: 'layout-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ heroCheck, heroChevronDown })],
  host: { class: 'flex min-w-0 flex-col gap-2' },
})
export class LayoutPickerComponent {
  readonly value = input.required<DashboardLayout>();
  readonly valueChange = output<DashboardLayout>();

  protected readonly layouts = LAYOUTS;
  protected readonly open = signal(true);
  protected readonly current = computed(
    () => LAYOUTS.find((layout) => layout.value === this.value()) ?? LAYOUTS[0],
  );

  private readonly id = nextId++;
  protected readonly labelId = `layout-picker-label-${this.id}`;
  protected readonly panelId = `layout-picker-panel-${this.id}`;
  /** One native radio group, so the arrow keys move and select and Tab passes through once. */
  protected readonly groupName = `layout-picker-${this.id}`;

  protected optionId(layout: LayoutOption, part: 'name' | 'description'): string {
    return `${this.groupName}-${layout.value}-${part}`;
  }

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  protected choose(layout: DashboardLayout): void {
    if (layout !== this.value()) this.valueChange.emit(layout);
  }
}
