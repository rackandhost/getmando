import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { render, screen, within, type RenderResult } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { DEFAULT_DASHBOARD_CONFIG } from '../../../core/models/dashboard.models';
import { AppService } from '../../../core/services/app.service';
import { MetadataService } from '../../../core/services/metadata.service';
import { ThemeService } from '../../../core/services/theme.service';
import { expectNoAxeViolations } from '../../../../testing/a11y';
import { ConfiguratorChrome, type SectionSelection } from '../configurator-chrome';

import { ConfiguratorVerticalChromeComponent } from './configurator-vertical-chrome.component';

const SECTIONS = [
  { id: 'start', label: 'Starting point', number: '01', elementId: 'section-start', href: '#a' },
  { id: 'metadata', label: 'Metadata', number: '02', elementId: 'section-metadata', href: '#b' },
  { id: 'settings', label: 'Settings', number: '03', elementId: 'section-settings', href: '#c' },
];

/** What the page is to the chrome: it declares the body once, hands it over and asks for the metrics. */
@Component({
  imports: [ConfiguratorVerticalChromeComponent],
  template: `
    <app-configurator-vertical-chrome
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

describe('ConfiguratorVerticalChromeComponent', () => {
  const originalWidth = window.innerWidth;
  const resizeTo = (width: number) =>
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });

  afterEach(() => {
    resizeTo(originalWidth);
    document.documentElement.style.removeProperty('scroll-padding-top');
  });

  /** The chrome only exists on the configurator route, which is where its actions link back from. */
  const setup = async () => {
    const view = await render(PageHostComponent, {
      providers: [
        provideRouter([{ path: 'configure', children: [] }]),
        { provide: AppService, useValue: { appVersion: '2.2.0' } },
        { provide: ThemeService, useValue: { isDark: signal(true), toggleTheme: vi.fn() } },
        {
          provide: MetadataService,
          useValue: { metadata: signal(DEFAULT_DASHBOARD_CONFIG.metadata) },
        },
      ],
    });
    await TestBed.inject(Router).navigateByUrl('/configure');
    view.fixture.detectChanges();
    return view;
  };
  const chrome = (view: RenderResult<PageHostComponent>) =>
    view.fixture.componentInstance.chrome() as ConfiguratorChrome;
  const rail = () => screen.getByRole('complementary', { name: 'Configurator' });
  const nav = () => screen.getByRole('navigation', { name: 'Configurator sections' });
  const before = (first: Element, second: Element) =>
    Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

  it('is the chrome the page finds through the ConfiguratorChrome token', async () => {
    const view = await setup();

    expect(chrome(view)).toBeInstanceOf(ConfiguratorVerticalChromeComponent);
  });

  it('is a Configurator landmark beside the body it was handed, with no header band', async () => {
    await setup();

    expect(rail()).toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByText('the sections')).toBeInTheDocument();
    expect(rail()).not.toContainElement(screen.getByText('the sections'));
  });

  it('has the page’s only h1 in the rail, and the brand title is not a heading', async () => {
    await setup();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(within(rail()).getByRole('heading', { level: 1 })).toHaveTextContent(
      'Configuration editor',
    );
    expect(
      screen.queryByRole('heading', { name: DEFAULT_DASHBOARD_CONFIG.metadata.title }),
    ).not.toBeInTheDocument();
    expect(within(rail()).getByText(DEFAULT_DASHBOARD_CONFIG.metadata.title)).toBeInTheDocument();
    expect(within(rail()).getByText('DASHBOARD SETUP')).toBeInTheDocument();
    expect(within(rail()).getByText(/Build a dashboard configuration locally/)).toBeInTheDocument();
  });

  it('lists the sections numbered, marks the active one and reports the one that is activated', async () => {
    const user = userEvent.setup();
    const view = await setup();

    expect(
      within(nav())
        .getAllByRole('link')
        .map((link) => link.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual(['01 Starting point', '02 Metadata', '03 Settings']);
    expect(within(nav()).getByRole('link', { name: /Starting point/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(within(nav()).getByRole('link', { name: /Metadata/ })).not.toHaveAttribute(
      'aria-current',
    );

    await user.click(within(nav()).getByRole('link', { name: /Settings/ }));

    expect(view.fixture.componentInstance.selected).toHaveLength(1);
    expect(view.fixture.componentInstance.selected[0].elementId).toBe('section-settings');
    expect(view.fixture.componentInstance.selected[0].event.type).toBe('click');
  });

  it('keeps the DOM order equal to the visual order: brand, actions, heading, sections, actions', async () => {
    await setup();

    const toggles = screen.getAllByRole('button', { name: 'Toggle theme' });
    const backLinks = screen.getAllByRole('link', { name: 'Back to dashboard' });
    const heading = within(rail()).getByRole('heading', { level: 1 });

    expect(toggles).toHaveLength(2);
    expect(backLinks).toHaveLength(2);
    expect(backLinks[0]).toHaveAttribute('href', '/');
    const brand = screen.getByText(DEFAULT_DASHBOARD_CONFIG.metadata.title);
    expect(before(brand, backLinks[0])).toBe(true);
    expect(before(toggles[0], heading)).toBe(true);
    expect(before(heading, nav())).toBe(true);
    expect(before(nav(), screen.getByRole('link', { name: /Mando v2\.2\.0/ }))).toBe(true);
    expect(before(nav(), toggles[1])).toBe(true);
    expect(before(toggles[1], screen.getByText(/Created with/))).toBe(true);
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = await setup();

    await expectNoAxeViolations(container);
  });

  describe('metrics', () => {
    it.each([
      [1024, false],
      [1023, true],
    ])('treats a %s px wide window as narrow: %s', async (width, narrow) => {
      const view = await setup();
      resizeTo(width);

      expect(chrome(view).narrow()).toBe(narrow);
    });

    it('covers nothing and keeps the sections 20 px clear of the top while the rail is a column', async () => {
      const view = await setup();
      resizeTo(1280);
      document.documentElement.style.scrollPaddingTop = '80px';

      expect(chrome(view).stackHeight()).toBe(0);
      expect(chrome(view).sectionMargin()).toBe(20);
    });

    describe('as a bar', () => {
      const rect = (top: number, height: number) =>
        ({ top, bottom: top + height, height }) as DOMRect;

      /** A 200 px rail with 12 px of padding whose chip bar starts 134 px down: 200 − (134 − 12) = 78 px stay once stuck. */
      const stubRail = () => {
        const aside = rail();
        aside.style.paddingTop = '12px';
        vi.spyOn(aside, 'getBoundingClientRect').mockReturnValue(rect(0, 200));
        vi.spyOn(nav(), 'getBoundingClientRect').mockReturnValue(rect(134, 66));
      };

      it('reports the stuck part of the rail while it is stuck, with a 16 px clearance below it', async () => {
        const view = await setup();
        resizeTo(390);
        stubRail();
        document.documentElement.style.scrollPaddingTop = '78px';

        expect(chrome(view).stackHeight()).toBe(78);
        expect(chrome(view).sectionMargin()).toBe(16);
      });

      it('reports nothing before the rail sticks, and counts the part that will cover the section', async () => {
        const view = await setup();
        resizeTo(390);
        stubRail();

        expect(chrome(view).stackHeight()).toBe(0);
        expect(chrome(view).sectionMargin()).toBe(16 + 78);
      });
    });
  });
});
