export class FakeResizeObserver implements ResizeObserver {
  // Declared and assigned rather than a constructor parameter property:
  // Node runs these files in strip-only TypeScript mode, which rejects
  // that syntax outright — and since this module is imported by the test
  // harness itself, it took every browser test in the repo down with it.
  readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  disconnect(): void {}

  observe(target: Element, options?: ResizeObserverOptions): void {}

  unobserve(target: Element): void {}
}
