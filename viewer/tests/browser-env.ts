// jsdom has no layout or ResizeObserver. Graph relationships are tested as data;
// the optional Playwright script verifies actual layout, edges and interaction.
if(typeof window!=='undefined' && !globalThis.ResizeObserver) {
  globalThis.ResizeObserver=class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
