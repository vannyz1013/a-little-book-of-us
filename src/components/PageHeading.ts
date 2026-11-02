import { h, paint } from '../dom';

/** Shared title block for the inner pages. */
export function createPageHeading(title: string, subtitle: string): HTMLElement {
  return h(
    'header',
    { class: 'page-heading' },
    h('h1', { tabindex: -1 }, title),
    h('p', {}, subtitle),
    paint('images/decorations/divider.webp', 'page-heading__divider'),
  );
}

/** Painted corner bouquets; purely decorative. */
export function createCorners(): HTMLElement[] {
  return [
    paint('images/decorations/sprig-floral.webp', 'corner corner--left'),
    paint('images/decorations/sprig-floral.webp', 'corner corner--right'),
  ];
}
