import '@testing-library/jest-dom';

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();

  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(String(key)) ?? null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(String(key));
    },
    setItem(key: string, value: string) {
      data.set(String(key), String(value));
    },
  };
}

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

/**
 * Node 25+ exposes an experimental `localStorage` getter that returns `undefined`
 * unless `--localstorage-file` is set. That shadows jsdom's Storage and breaks
 * browser-code tests that call `localStorage` as a global.
 */
if (!globalThis.localStorage) {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    enumerable: true,
    value: createMemoryStorage(),
  });
}
