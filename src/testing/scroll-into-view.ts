import { vi, type Mock } from 'vitest';

/**
 * jsdom does no layout and has no `scrollIntoView`. The builder runs every spec file of a worker in one
 * shared jsdom (`isolate: false`), and other specs delete the property when they finish, so a spec that
 * needs it installs its own recorder for each test and puts back what it found, instead of relying on a
 * global polyfill that an earlier file may have removed.
 */
export function stubScrollIntoView(): { scrollIntoView: Mock; restore: () => void } {
  const previous = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
  const scrollIntoView = vi.fn();
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: scrollIntoView,
  });

  return {
    scrollIntoView,
    restore: () => {
      if (previous) Object.defineProperty(Element.prototype, 'scrollIntoView', previous);
      else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    },
  };
}
