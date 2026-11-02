type Child = Node | string | null | undefined | false;
type Props = Record<string, string | number | boolean | EventListener | undefined>;

/** Tiny element builder, so components read as markup rather than DOM calls. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (typeof value === 'function') element.addEventListener(name.slice(2), value);
    else element.setAttribute(name, value === true ? '' : String(value));
  }
  element.append(...children.filter((child): child is Node | string => Boolean(child)));
  return element;
}

/** Resolve a path in public/ so it works at any GitHub Pages location. */
export const asset = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

export const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Purely decorative painted image, hidden from screen readers. */
export const paint = (path: string, className: string): HTMLImageElement =>
  h('img', { src: asset(path), class: className, alt: '', decoding: 'async', 'aria-hidden': 'true' });
