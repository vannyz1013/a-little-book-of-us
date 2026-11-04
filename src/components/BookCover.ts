import { asset, h, paint, prefersReducedMotion } from '../dom';
import { goTo } from '../router';

const TAGLINE = 'A little collection of moments and memories, made just for you.';
const OPEN_MS = 1500;

export function createBookCover(): { element: HTMLElement; onEnter: () => void } {
  const book = h(
    'div',
    { class: 'book' },
    h('div', { class: 'book__pages' }, paint('images/cover/book-page.webp', 'book__sprig')),
    h(
      'div',
      { class: 'book__cover' },
      h('div', { class: 'book__inside' }),
      h(
        'div',
        { class: 'book__front' },
        paint('images/cover/book-cover.webp', 'book__art'),
        h(
          'div',
          { class: 'book__title' },
          h('h1', { tabindex: -1 }, 'A Little', h('br'), 'Book for You'),
          h('p', {}, TAGLINE),
        ),
      ),
    ),
  );

  const open = h('button', { class: 'btn', type: 'button' }, 'Open the Book');
  const element = h(
    'section',
    { class: 'cover' },
    h(
      'picture',
      { class: 'cover__garden' },
      h('source', { media: '(min-aspect-ratio: 1/1)', srcset: asset('images/cover/garden-wide.webp') }),
      h('img', { src: asset('images/cover/garden-tall.webp'), alt: 'A watercolour garden of lavender, blue wildflowers and white daisies under a soft sky' }),
    ),
    paint('images/decorations/butterfly-lavender.webp', 'cover__butterfly cover__butterfly--lavender'),
    paint('images/decorations/butterfly-blue.webp', 'cover__butterfly cover__butterfly--blue'),
    h('div', { class: 'cover__content' }, book, open),
    h('footer', { class: 'cover__footer' }, 'Made with love, just for you.'),
  );

  open.addEventListener('click', () => {
    if (prefersReducedMotion()) return goTo('memories');
    open.disabled = true;
    element.classList.add('is-opening');
    window.setTimeout(() => goTo('memories'), OPEN_MS);
  });

  return {
    element,
    // Close the book again, so it can be reopened after coming back.
    onEnter() {
      open.disabled = false;
      element.classList.remove('is-opening');
    },
  };
}
