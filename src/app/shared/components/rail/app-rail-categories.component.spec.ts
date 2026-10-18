import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { APP_CATEGORY, type Category } from '../../../core/models/dashboard.models';
import { AppService } from '../../../core/services/app.service';
import { CategoryService } from '../../../core/services/category.service';
import { SearchService } from '../../../core/services/search.service';
import { expectNoAxeViolations } from '../../../../testing/a11y';

import { AppRailCategoriesComponent } from './app-rail-categories.component';

describe('AppRailCategoriesComponent', () => {
  const categories: Category[] = [
    APP_CATEGORY,
    { id: 'bookmarks', name: 'Bookmarks' },
    { id: 'media', name: 'Media' },
  ];

  const appServiceMock = { setSelectedCategory: vi.fn() };
  const selectedCategory = signal('apps');
  const haveSearch = signal(false);

  const setup = async ({ selected = 'apps', searching = false } = {}) => {
    appServiceMock.setSelectedCategory.mockReset();
    selectedCategory.set(selected);
    haveSearch.set(searching);

    return render(AppRailCategoriesComponent, {
      providers: [
        { provide: AppService, useValue: appServiceMock },
        {
          provide: CategoryService,
          useValue: { categories: signal(categories), selectedCategory },
        },
        { provide: SearchService, useValue: { haveSearch } },
      ],
    });
  };

  const nav = () => screen.getByRole('navigation', { name: 'Categories' });

  it('lists the categories as buttons in a navigation labelled Categories, under a Categories label', async () => {
    await setup();

    expect(screen.getAllByRole('button').map((button) => button.textContent?.trim())).toEqual([
      'Apps',
      'Bookmarks',
      'Media',
    ]);
    expect(nav()).toHaveTextContent('Categories');
  });

  it('marks only the selected category as pressed', async () => {
    await setup({ selected: 'media' });

    expect(screen.getByRole('button', { name: 'Media' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Apps' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Bookmarks' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('selects a category through the app service', async () => {
    await setup();

    await userEvent.click(screen.getByRole('button', { name: 'Media' }));

    expect(appServiceMock.setSelectedCategory).toHaveBeenCalledExactlyOnceWith('media');
  });

  describe('while a search query is active', () => {
    it('disables every category and presses none', async () => {
      await setup({ selected: 'media', searching: true });

      for (const button of screen.getAllByRole('button')) {
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('aria-pressed', 'false');
      }
    });

    it('dims the list to 0.45', async () => {
      await setup({ searching: true });

      expect(nav()).toHaveStyle({ opacity: '0.45' });
    });

    it('does not select anything when a disabled category is clicked', async () => {
      await setup({ searching: true });

      await userEvent.click(screen.getByRole('button', { name: 'Media' }));

      expect(appServiceMock.setSelectedCategory).not.toHaveBeenCalled();
    });

    it('is not dimmed when there is no query', async () => {
      await setup();

      expect(nav().style.opacity).toBe('');
    });
  });

  it('marks each chip with its category id so the selected one can be kept in view', async () => {
    const { container } = await setup();

    expect(
      Array.from(container.querySelectorAll('[data-chip]'), (chip) =>
        chip.getAttribute('data-chip'),
      ),
    ).toEqual(['apps', 'bookmarks', 'media']);
  });

  it('recentres the selected chip in the sideways bar when the selection changes', async () => {
    const { container, fixture } = await setup();
    const bar = container.querySelector('[data-chip]')!.parentElement as HTMLElement;
    Object.defineProperty(bar, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(bar, 'clientWidth', { configurable: true, value: 300 });
    const scrollTo = vi.fn();
    bar.scrollTo = scrollTo;

    selectedCategory.set('media');
    fixture.detectChanges();

    expect(scrollTo).toHaveBeenCalledOnce();
  });

  it('never reorders its items with CSS order, so the DOM order is the visual order', async () => {
    const { container } = await setup();

    const classes = Array.from(container.querySelectorAll('*'), (element) => element.className);

    expect(classes.filter((value) => /(^|[\s:])-?order-/.test(String(value)))).toEqual([]);
  });

  it('has no accessibility violations', async () => {
    const { container } = await setup({ selected: 'media' });

    await expectNoAxeViolations(container);
  });

  it('has no accessibility violations while searching', async () => {
    const { container } = await setup({ searching: true });

    await expectNoAxeViolations(container);
  });
});
