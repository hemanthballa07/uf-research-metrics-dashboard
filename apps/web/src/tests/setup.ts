import '@testing-library/jest-dom';

// jsdom doesn't expose a full Storage API without a proper origin — provide one
const _store = new Map<string, string>();
const localStorageMock: Storage = {
  get length() { return _store.size; },
  key: (i: number) => [..._store.keys()][i] ?? null,
  getItem: (key: string) => _store.get(key) ?? null,
  setItem: (key: string, value: string) => { _store.set(key, String(value)); },
  removeItem: (key: string) => { _store.delete(key); },
  clear: () => { _store.clear(); },
};
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});
