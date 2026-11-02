import { h } from '../dom';
import { hrefFor, pages, pageTitles, type PageId } from '../router';

export function createNav(): { element: HTMLElement; setActive: (id: PageId) => void } {
  const links = pages.map((id) => h('a', { href: hrefFor(id), class: 'book-nav__link' }, pageTitles[id]));
  const element = h('nav', { class: 'book-nav', 'aria-label': 'Book sections' }, ...links);

  return {
    element,
    setActive(id) {
      links.forEach((link, index) => {
        if (pages[index] === id) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    },
  };
}

/** The Back and Next controls at the foot of a page, like turning a leaf. */
export function createPageTurn(back: PageId | null, next: PageId | null): HTMLElement {
  return h(
    'nav',
    { class: 'page-turn', 'aria-label': 'Previous and next page' },
    back
      ? h('a', { href: hrefFor(back), class: 'page-turn__link', rel: 'prev' }, h('span', { 'aria-hidden': 'true' }, '←'), ` ${pageTitles[back]}`)
      : h('span'),
    next
      ? h('a', { href: hrefFor(next), class: 'page-turn__link', rel: 'next' }, `${pageTitles[next]} `, h('span', { 'aria-hidden': 'true' }, '→'))
      : h('span'),
  );
}
