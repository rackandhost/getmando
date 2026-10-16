import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { Mock } from 'vitest';

import { METRICS_SOURCE } from '../../core/scroll/metrics-source';
import type { ChromeMode } from '../../core/scroll/scroll-state';
import { ScrollStateService, type ChromeProbe } from '../../core/scroll/scroll-state.service';
import { FakeMetrics } from '../../../testing/fake-metrics';

import { StickyDockDirective } from './sticky-dock.directive';

interface StubHandle {
  mode: WritableSignal<ChromeMode>;
  dispose: Mock;
}

/** Stands in for the service: the directive only needs a mode signal and a way to dispose. */
class StubScrollState {
  probes: ChromeProbe[] = [];
  handles: StubHandle[] = [];

  register(probe: ChromeProbe) {
    const handle: StubHandle = { mode: signal<ChromeMode>('static'), dispose: vi.fn() };
    this.probes.push(probe);
    this.handles.push(handle);
    return { mode: handle.mode.asReadonly(), dispose: handle.dispose };
  }
}

@Component({
  imports: [StickyDockDirective],
  template: `<div id="dock" [appStickyDock]="probe()">
      dock
      <button id="in-a" type="button">a</button>
      <button id="in-b" type="button">b</button>
    </div>
    <button id="out" type="button">outside</button>`,
})
class HostComponent {
  readonly probe = signal<ChromeProbe>({
    id: 'dashboard-dock',
    compactDelta: () => 306,
    minViewportHeight: 720,
  });
}

@Component({
  imports: [StickyDockDirective],
  template: `<div id="outer" [appStickyDock]="outerProbe">
    <div id="inner" [appStickyDock]="innerProbe"><button id="field" type="button">f</button></div>
  </div>`,
})
class NestedHostComponent {
  readonly outerProbe: ChromeProbe = { id: 'outer', compactDelta: () => 0, minViewportHeight: 720 };
  readonly innerProbe: ChromeProbe = { id: 'inner', compactDelta: () => 0, minViewportHeight: 500 };
}

describe('StickyDockDirective', () => {
  let metrics: FakeMetrics;
  let scrollState: StubScrollState;
  let fixture: ComponentFixture<HostComponent>;
  let dock: HTMLElement;
  let height: number;

  const root = () => document.documentElement;

  beforeEach(() => {
    metrics = new FakeMetrics();
    scrollState = new StubScrollState();
    height = 584;
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: METRICS_SOURCE, useValue: metrics },
        { provide: ScrollStateService, useValue: scrollState },
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    dock = fixture.nativeElement.querySelector('#dock');
    vi.spyOn(dock, 'getBoundingClientRect').mockImplementation(
      () => ({ height }) as unknown as DOMRect,
    );
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    root().style.removeProperty('scroll-padding-top');
    vi.restoreAllMocks();
  });

  /** The service changes the chrome's mode; the page renders it. */
  const setMode = (mode: ChromeMode) => {
    scrollState.handles.at(-1)!.mode.set(mode);
    fixture.detectChanges();
  };

  it('registers the probe it is given', () => {
    expect(scrollState.probes).toHaveLength(1);
    expect(scrollState.probes[0].id).toBe('dashboard-dock');
    expect(scrollState.probes[0].minViewportHeight).toBe(720);
    expect(scrollState.probes[0].compactDelta()).toBe(306);
  });

  it.each(['static', 'top', 'scrolled'] as const)(
    'shows the chrome mode %s in data-dock',
    (mode) => {
      setMode(mode);

      expect(dock.getAttribute('data-dock')).toBe(mode);
    },
  );

  it('is Static until the service says otherwise', () => {
    expect(dock.getAttribute('data-dock')).toBe('static');
  });

  describe('--dock-height', () => {
    it('is measured on the first frame, not synchronously', () => {
      expect(dock.style.getPropertyValue('--dock-height')).toBe('');

      metrics.frame();
      fixture.detectChanges();

      expect(dock.style.getPropertyValue('--dock-height')).toBe('584px');
    });

    it('follows the host height one frame after the resize observer fires', () => {
      metrics.frame();
      fixture.detectChanges();

      height = 278;
      metrics.resize(dock);
      fixture.detectChanges();
      expect(dock.style.getPropertyValue('--dock-height')).toBe('584px');
      expect(metrics.pendingFrames).toBe(1);

      metrics.frame();
      fixture.detectChanges();
      expect(dock.style.getPropertyValue('--dock-height')).toBe('278px');
    });

    it('runs one frame for any number of resize notifications', () => {
      metrics.frame();

      metrics.resize(dock);
      metrics.resize(dock);
      metrics.resize(dock);

      expect(metrics.pendingFrames).toBe(1);
    });

    it('rounds a fractional height up so the padding never falls short of the dock', () => {
      height = 277.4;
      metrics.frame();
      fixture.detectChanges();

      expect(dock.style.getPropertyValue('--dock-height')).toBe('278px');
    });
  });

  describe('scroll-padding-top on the document', () => {
    it.each(['top', 'scrolled'] as const)('equals the dock height while the dock is %s', (mode) => {
      metrics.frame();
      setMode(mode);

      expect(root().style.scrollPaddingTop).toBe('584px');
    });

    it('is absent while the dock is Static, the dock not being sticky', () => {
      metrics.frame();
      fixture.detectChanges();

      expect(root().style.scrollPaddingTop).toBe('');
    });

    it('follows the dock height while sticky', () => {
      metrics.frame();
      setMode('top');

      height = 278;
      metrics.resize(dock);
      metrics.frame();
      fixture.detectChanges();

      expect(root().style.scrollPaddingTop).toBe('278px');
    });

    it('is removed when the dock goes back to Static', () => {
      metrics.frame();
      setMode('scrolled');
      expect(root().style.scrollPaddingTop).toBe('584px');

      setMode('static');

      expect(root().style.scrollPaddingTop).toBe('');
    });
  });

  describe('while focus is inside the dock', () => {
    const control = (id: string) => fixture.nativeElement.querySelector(`#${id}`) as HTMLElement;

    beforeEach(() => {
      metrics.frame();
    });

    it.each(['top', 'scrolled'] as const)(
      'drops the padding as soon as a control inside the %s dock takes focus',
      (mode) => {
        setMode(mode);
        expect(root().style.scrollPaddingTop).toBe('584px');

        control('in-a').focus();

        expect(root().style.scrollPaddingTop).toBe('');
      },
    );

    it('keeps it dropped while focus moves between controls of the dock', () => {
      setMode('scrolled');

      control('in-a').focus();
      control('in-b').focus();

      expect(root().style.scrollPaddingTop).toBe('');
    });

    it('restores it synchronously when focus leaves for a control outside', () => {
      setMode('scrolled');
      control('in-a').focus();

      control('out').focus();

      expect(root().style.scrollPaddingTop).toBe('584px');
    });

    it('restores it when the focused control simply loses focus', () => {
      setMode('scrolled');
      control('in-a').focus();

      control('in-a').blur();

      expect(root().style.scrollPaddingTop).toBe('584px');
    });

    it('adds no padding while the dock is Static, however focus moves', () => {
      control('in-a').focus();
      control('out').focus();

      expect(root().style.scrollPaddingTop).toBe('');
    });

    it('applies a height change that happened while focused once focus has left', () => {
      setMode('scrolled');
      control('in-a').focus();

      height = 296;
      metrics.resize(dock);
      metrics.frame();
      fixture.detectChanges();
      expect(root().style.scrollPaddingTop).toBe('');

      control('out').focus();

      expect(root().style.scrollPaddingTop).toBe('296px');
    });

    it('does not bring the padding back when the dock goes Static with focus inside', () => {
      setMode('scrolled');
      control('in-a').focus();

      setMode('static');

      expect(root().style.scrollPaddingTop).toBe('');
    });
  });

  describe('when the probe changes', () => {
    it('disposes the previous registration and registers the new probe once', () => {
      fixture.componentInstance.probe.set({
        id: 'mobile-dock',
        compactDelta: () => 16,
        minViewportHeight: 500,
      });
      fixture.detectChanges();

      expect(scrollState.handles[0].dispose).toHaveBeenCalledTimes(1);
      expect(scrollState.probes.map((p) => p.id)).toEqual(['dashboard-dock', 'mobile-dock']);
    });
  });

  describe('on destroy', () => {
    it('disposes its registration, stops observing and leaves no scroll padding or pending frame', () => {
      metrics.frame();
      setMode('top');
      expect(root().style.scrollPaddingTop).toBe('584px');
      metrics.resize(dock);

      fixture.destroy();

      expect(scrollState.handles[0].dispose).toHaveBeenCalledTimes(1);
      expect(metrics.sizeListeners.get(dock)?.size ?? 0).toBe(0);
      expect(metrics.pendingFrames).toBe(0);
      expect(root().style.scrollPaddingTop).toBe('');
    });
  });

  describe('two docks on one page (the desktop and the mobile dock)', () => {
    let nested: ComponentFixture<NestedHostComponent>;
    let outer: HTMLElement;
    let inner: HTMLElement;
    const heights = { outer: 300, inner: 100 };

    beforeEach(() => {
      heights.outer = 300;
      heights.inner = 100;
      nested = TestBed.createComponent(NestedHostComponent);
      outer = nested.nativeElement.querySelector('#outer');
      inner = nested.nativeElement.querySelector('#inner');
      vi.spyOn(outer, 'getBoundingClientRect').mockImplementation(
        () => ({ height: heights.outer }) as unknown as DOMRect,
      );
      vi.spyOn(inner, 'getBoundingClientRect').mockImplementation(
        () => ({ height: heights.inner }) as unknown as DOMRect,
      );
      nested.detectChanges();
      metrics.frame();
    });

    afterEach(() => nested.destroy());

    // The nested page registered after the one-dock fixture of the outer beforeEach.
    const handle = (id: 'outer' | 'inner') =>
      scrollState.handles[scrollState.probes.findIndex((probe) => probe.id === id)];

    it('keeps the padding of the sticky dock when the Static one changes height', () => {
      handle('outer').mode.set('scrolled');
      nested.detectChanges();
      expect(root().style.scrollPaddingTop).toBe('300px');

      heights.inner = 90;
      metrics.resize(inner);
      metrics.frame();
      nested.detectChanges();

      expect(root().style.scrollPaddingTop).toBe('300px');
    });

    it('keeps the padding of the sticky dock when the Static one is the outer', () => {
      handle('inner').mode.set('scrolled');
      nested.detectChanges();
      expect(root().style.scrollPaddingTop).toBe('100px');

      heights.outer = 250;
      metrics.resize(outer);
      metrics.frame();
      nested.detectChanges();

      expect(root().style.scrollPaddingTop).toBe('100px');
    });

    it('lets the Static dock clear nothing when focus enters and leaves the nested controls', () => {
      handle('inner').mode.set('top');
      nested.detectChanges();
      const field = nested.nativeElement.querySelector('#field') as HTMLElement;

      field.focus();
      field.blur();

      expect(root().style.scrollPaddingTop).toBe('100px');
    });
  });
});
