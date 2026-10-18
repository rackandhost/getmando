import { Component, signal, viewChild } from '@angular/core';
import { render, screen, within, type RenderResult } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { DEFAULT_DASHBOARD_CONFIG } from '../../../core/models/dashboard.models';
import { MetadataService } from '../../../core/services/metadata.service';
import { ThemeService } from '../../../core/services/theme.service';
import { themeServiceStub } from '../../../../testing/theme-service.stub';
import { ConfiguratorChrome, type SectionSelection } from '../configurator-chrome';

import { ConfiguratorHorizontalChromeComponent } from './configurator-horizontal-chrome.component';

const SECTIONS = [
  { id: 'start', label: 'Starting point', number: '01', elementId: 'section-start', href: '#a' },
  { id: 'metadata', label: 'Metadata', number: '02', elementId: 'section-metadata', href: '#b' },
];

/** What the page is to the chrome: it declares the body once, hands it over and asks for the metrics. */
@Component({
  imports: [ConfiguratorHorizontalChromeComponent],
  template: `
    <app-configurator-horizontal-chrome
      [activeId]="activeId()"
      [body]="body"
      [sections]="sections"
      (sectionSelected)="selected.push($event)"
    />
    <ng-template #body><p>the sections</p></ng-template>
  `,
})
class PageHostComponent {
  readonly sections = SECTIONS;
  readonly activeId = signal('start');
  readonly selected: SectionSelection[] = [];
  readonly chrome = viewChild(ConfiguratorChrome);
}

describe('ConfiguratorHorizontalChromeComponent', () => {
  const originalWidth = window.innerWidth;
  const resizeTo = (width: number) =>
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });

  afterEach(() => {
    resizeTo(originalWidth);
    document.documentElement.style.removeProperty('scroll-padding-top');
  });

  const setup = () =>
    render(PageHostComponent, {
      providers: [
        { provide: ThemeService, useValue: themeServiceStub() },
        {
          provide: MetadataService,
          useValue: { metadata: signal(DEFAULT_DASHBOARD_CONFIG.metadata) },
        },
      ],
    });
  const chrome = (view: RenderResult<PageHostComponent>) =>
    view.fixture.componentInstance.chrome() as ConfiguratorChrome;
  const nav = () => screen.getByRole('navigation', { name: 'Configurator sections' });

  it('is the chrome the page finds through the ConfiguratorChrome token', async () => {
    const view = await setup();

    expect(chrome(view)).toBeInstanceOf(ConfiguratorHorizontalChromeComponent);
  });

  it('draws the banner, then the heading and the side navigation beside the body it was handed', async () => {
    await setup();

    const main = screen.getByRole('main');

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(main).not.toContainElement(screen.getByRole('banner'));
    expect(within(main).getByRole('heading', { level: 1 })).toHaveTextContent(
      'Configuration editor',
    );
    expect(within(main).getByText('the sections')).toBeInTheDocument();
    expect(
      nav().compareDocumentPosition(screen.getByText('the sections')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('lists the sections, marks the active one and reports the one that is activated', async () => {
    const user = userEvent.setup();
    const view = await setup();

    expect(
      within(nav())
        .getAllByRole('link')
        .map((link) => link.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual(['01 Starting point', '02 Metadata']);
    expect(within(nav()).getByRole('link', { name: /Starting point/ })).toHaveAttribute(
      'aria-current',
      'true',
    );

    await user.click(within(nav()).getByRole('link', { name: /Metadata/ }));

    expect(view.fixture.componentInstance.selected).toHaveLength(1);
    expect(view.fixture.componentInstance.selected[0].elementId).toBe('section-metadata');
    expect(view.fixture.componentInstance.selected[0].event.type).toBe('click');
  });

  it.each([
    [900, true],
    [901, false],
  ])('treats a %s px wide window as narrow: %s', async (width, narrow) => {
    const view = await setup();
    resizeTo(width);

    expect(chrome(view).narrow()).toBe(narrow);
  });

  it('keeps the sections 20 px clear of the header on a wide page, where nothing covers them', async () => {
    const view = await setup();
    resizeTo(1280);

    expect(chrome(view).sectionMargin()).toBe(20);
    expect(chrome(view).stackHeight()).toBe(0);
  });

  it('reports the header while it is stuck, and the chip bar once it sticks under it', async () => {
    const view = await setup();
    resizeTo(600);
    const rect = (top: number, bottom: number) =>
      ({ top, bottom, height: bottom - top }) as DOMRect;
    const header = screen.getByRole('banner').closest('[data-dock]') as HTMLElement;
    vi.spyOn(header, 'getBoundingClientRect').mockReturnValue(rect(0, 80));
    const bar = vi.spyOn(nav(), 'getBoundingClientRect').mockReturnValue(rect(300, 360));

    expect(chrome(view).stackHeight()).toBe(80);

    bar.mockReturnValue(rect(96, 156));
    document.documentElement.style.scrollPaddingTop = '80px';

    expect(chrome(view).stackHeight()).toBe(156);
    expect(chrome(view).sectionMargin()).toBe(96 + 60 + 16 - 80);
  });
});
