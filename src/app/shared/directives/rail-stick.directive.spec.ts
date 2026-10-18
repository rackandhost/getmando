import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { METRICS_SOURCE } from '../../core/scroll/metrics-source';
import { FakeMetrics } from '../../../testing/fake-metrics';

import { RailStickDirective } from './rail-stick.directive';

@Component({
  imports: [RailStickDirective],
  template: `<aside id="rail" appRailStick style="padding-top: 12px">
    <div id="above">brand and clock</div>
    <div id="anchor" data-rail-anchor>search</div>
  </aside>`,
})
class HostComponent {}

@Component({
  imports: [RailStickDirective],
  template: `<aside id="rail" appRailStick><div>no anchor</div></aside>`,
})
class NoAnchorHostComponent {}

/** What the browser would report; the tests move these between frames. */
interface Layout {
  railTop: number;
  railHeight: number;
  anchorTop: number;
}

describe('RailStickDirective', () => {
  let metrics: FakeMetrics;
  let compact: boolean;
  let mediaListeners: Set<() => void>;
  let layout: Layout;
  let fixture: ComponentFixture<unknown>;
  let rail: HTMLElement;

  const root = () => document.documentElement;

  const useCompactMedia = () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          get matches() {
            return compact;
          },
          media: query,
          addEventListener: (_: string, listener: () => void) => mediaListeners.add(listener),
          removeEventListener: (_: string, listener: () => void) => mediaListeners.delete(listener),
        }) as unknown as MediaQueryList,
    );
  };

  const stubLayout = (host: HTMLElement) => {
    const anchor = host.querySelector<HTMLElement>('[data-rail-anchor]');
    vi.spyOn(host, 'getBoundingClientRect').mockImplementation(
      () => ({ top: layout.railTop, height: layout.railHeight }) as DOMRect,
    );
    if (anchor) {
      vi.spyOn(anchor, 'getBoundingClientRect').mockImplementation(
        () => ({ top: layout.railTop + layout.anchorTop }) as DOMRect,
      );
    }
    return anchor;
  };

  const create = <T>(component: new () => T) => {
    fixture = TestBed.createComponent(component);
    rail = fixture.nativeElement.querySelector('#rail');
    const anchor = stubLayout(rail);
    fixture.detectChanges();
    return anchor;
  };

  /** The page scrolls: the rail moves up and the scroll listeners fire. */
  const scrollTo = (railTop: number) => {
    layout.railTop = railTop;
    metrics.scrollListeners.forEach((listener) => listener());
  };

  const setMedia = (matches: boolean) => {
    compact = matches;
    mediaListeners.forEach((listener) => listener());
  };

  beforeEach(() => {
    metrics = new FakeMetrics();
    compact = true;
    mediaListeners = new Set();
    layout = { railTop: 0, railHeight: 183, anchorTop: 133 };
    root().style.removeProperty('scroll-padding-top');
    useCompactMedia();
    TestBed.configureTestingModule({
      providers: [{ provide: METRICS_SOURCE, useValue: metrics }],
    });
  });

  afterEach(() => {
    fixture.destroy();
    root().style.removeProperty('scroll-padding-top');
    vi.restoreAllMocks();
  });

  describe('--rail-stick', () => {
    it('is measured on the first frame, not synchronously', () => {
      create(HostComponent);
      expect(rail.style.getPropertyValue('--rail-stick')).toBe('');

      metrics.frame();
      fixture.detectChanges();

      expect(rail.style.getPropertyValue('--rail-stick')).toBe('121px');
    });

    it('follows the layout one frame after the rail changes size', () => {
      create(HostComponent);
      metrics.frame();
      fixture.detectChanges();

      layout.anchorTop = 100;
      metrics.resize(rail);
      fixture.detectChanges();
      expect(rail.style.getPropertyValue('--rail-stick')).toBe('121px');
      expect(metrics.pendingFrames).toBe(1);

      metrics.frame();
      fixture.detectChanges();

      expect(rail.style.getPropertyValue('--rail-stick')).toBe('88px');
    });

    it('follows the layout when only the anchor changes size', () => {
      const anchor = create(HostComponent)!;
      metrics.frame();
      fixture.detectChanges();

      layout.anchorTop = 150;
      metrics.resize(anchor);
      metrics.frame();
      fixture.detectChanges();

      expect(rail.style.getPropertyValue('--rail-stick')).toBe('138px');
    });

    it('is 0 when the rail has no anchor', () => {
      create(NoAnchorHostComponent);

      metrics.frame();
      fixture.detectChanges();

      expect(rail.style.getPropertyValue('--rail-stick')).toBe('0px');
    });
  });

  describe('scroll-padding-top', () => {
    const measure = () => {
      metrics.frame();
      fixture.detectChanges();
    };

    it('is the stuck height while the compact rail is stuck', () => {
      create(HostComponent);
      measure();

      scrollTo(-121);

      expect(root().style.scrollPaddingTop).toBe('62px');
    });

    it('is not set before the rail has reached its offset', () => {
      create(HostComponent);
      measure();

      scrollTo(-60);

      expect(root().style.scrollPaddingTop).toBe('');
    });

    it('is the whole rail when the anchor is its first block and the rail sticks at the top', () => {
      layout.anchorTop = 12;
      create(HostComponent);
      measure();

      scrollTo(0);

      expect(root().style.scrollPaddingTop).toBe('183px');
    });

    it('is dropped when the page scrolls back up', () => {
      create(HostComponent);
      measure();
      scrollTo(-121);

      scrollTo(-10);

      expect(root().style.scrollPaddingTop).toBe('');
    });

    it('is never set when the rail is not in the compact layout', () => {
      compact = false;
      create(HostComponent);
      measure();

      scrollTo(-300);

      expect(root().style.scrollPaddingTop).toBe('');
    });

    it('is applied or dropped when the viewport crosses the compact breakpoint', () => {
      create(HostComponent);
      measure();
      scrollTo(-121);
      expect(root().style.scrollPaddingTop).toBe('62px');

      setMedia(false);
      expect(root().style.scrollPaddingTop).toBe('');

      setMedia(true);
      expect(root().style.scrollPaddingTop).toBe('62px');
    });

    it('is released when the rail goes away', () => {
      create(HostComponent);
      measure();
      scrollTo(-121);

      fixture.destroy();

      expect(root().style.scrollPaddingTop).toBe('');
    });

    it('does not clear a scroll padding it did not set', () => {
      root().style.scrollPaddingTop = '90px';
      create(HostComponent);
      measure();

      scrollTo(-10);
      fixture.destroy();

      expect(root().style.scrollPaddingTop).toBe('90px');
    });
  });
});
