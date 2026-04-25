import {render, screen} from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {BehaviorSubject, of} from 'rxjs';

import {AppCategoriesComponent} from './app-categories.component';

import {AppService} from '../../../core/services/app.service';
import {CategoryService} from '../../../core/services/category.service';
import {SearchService} from '../../../core/services/search.service';

import {APP_CATEGORY, FAVORITES_CATEGORY, Category} from '../../../core/models/dashboard.models';

describe('AppCategoriesComponent', () => {
  const categories: Category[] = [
    APP_CATEGORY,
    {
      id: 'media',
      name: 'Media',
    },
  ];

  const appServiceMock = {
    setSelectedCategory: vi.fn(),
  };

  const selectedCategorySubject = new BehaviorSubject<string>('media');
  const haveSearchSubject = new BehaviorSubject<boolean>(false);

  const setup = async ({selectedCategory = 'media', haveSearch = false}: {selectedCategory?: string; haveSearch?: boolean} = {}) => {
    appServiceMock.setSelectedCategory.mockReset();
    selectedCategorySubject.next(selectedCategory);
    haveSearchSubject.next(haveSearch);

    return render(AppCategoriesComponent, {
      providers: [
        {
          provide: AppService,
          useValue: appServiceMock,
        },
        {
          provide: CategoryService,
          useValue: {
            categories$: of(categories),
            selectedCategory$: selectedCategorySubject,
          },
        },
        {
          provide: SearchService,
          useValue: {
            haveSearchSubject,
          },
        },
      ],
    });
  };

  it('should render the available categories and expose the selected state accessibly', async () => {
    await setup();

    expect(screen.getByRole('navigation', {name: 'Categories'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Apps'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Media'})).toHaveAttribute('aria-pressed', 'true');
  });

  it('should change the category through AppService', async () => {
    const user = userEvent.setup();

    await setup({selectedCategory: APP_CATEGORY.id});

    await user.click(screen.getByRole('button', {name: 'Media'}));

    expect(appServiceMock.setSelectedCategory).toHaveBeenCalledWith('media');
  });

  it('should disable category interaction when there is an active search', async () => {
    const user = userEvent.setup();

    await setup({haveSearch: true});

    const mediaButton = screen.getByRole('button', {name: 'Media'});

    expect(mediaButton).toBeDisabled();

    await user.click(mediaButton);

    expect(appServiceMock.setSelectedCategory).not.toHaveBeenCalled();
  });

  it('should react when search state changes after render', async () => {
    const view = await setup({haveSearch: false});

    const categoriesNav = screen.getByRole('navigation', {name: 'Categories'});
    const mediaButton = screen.getByRole('button', {name: 'Media'});

    expect(categoriesNav).not.toHaveClass('opacity-50');
    expect(mediaButton).toBeEnabled();

    haveSearchSubject.next(true);
    await view.fixture.whenStable();

    expect(categoriesNav).toHaveClass('opacity-50');
    expect(mediaButton).toBeDisabled();

    haveSearchSubject.next(false);
    await view.fixture.whenStable();

    expect(categoriesNav).not.toHaveClass('opacity-50');
    expect(mediaButton).toBeEnabled();
  });

  it('should update the selected category state and styling after render', async () => {
    const view = await setup({selectedCategory: 'media'});

    const appsButton = screen.getByRole('button', {name: 'Apps'});
    const mediaButton = screen.getByRole('button', {name: 'Media'});

    expect(mediaButton).toHaveAttribute('aria-pressed', 'true');
    expect(mediaButton).toHaveClass('bg-white/10', 'border-white/50');
    expect(appsButton).toHaveAttribute('aria-pressed', 'false');

    selectedCategorySubject.next(APP_CATEGORY.id);
    await view.fixture.whenStable();

    expect(appsButton).toHaveAttribute('aria-pressed', 'true');
    expect(appsButton).toHaveClass('bg-white/10', 'border-white/50');
    expect(mediaButton).toHaveAttribute('aria-pressed', 'false');
    expect(mediaButton).not.toHaveClass('bg-white/10', 'border-white/50');
  });

  it('should render FAVORITES_CATEGORY when present and maintain accessibility', async () => {
    const categoriesWithFavorites: Category[] = [
      FAVORITES_CATEGORY,
      APP_CATEGORY,
      {
        id: 'media',
        name: 'Media',
      },
    ];

    selectedCategorySubject.next('favorites');

    await render(AppCategoriesComponent, {
      providers: [
        {
          provide: AppService,
          useValue: appServiceMock,
        },
        {
          provide: CategoryService,
          useValue: {
            categories$: of(categoriesWithFavorites),
            selectedCategory$: selectedCategorySubject,
          },
        },
        {
          provide: SearchService,
          useValue: {
            haveSearchSubject,
          },
        },
      ],
    });

    const favoritesButton = screen.getByRole('button', {name: 'Favorites'});

    expect(favoritesButton).toBeInTheDocument();
    expect(favoritesButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', {name: 'Apps'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Media'})).toBeInTheDocument();
  });
});
