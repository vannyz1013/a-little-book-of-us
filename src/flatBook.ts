import { createBirthdayLetterPage } from './components/BirthdayLetter';
import { createBookCover } from './components/BookCover';
import { createMemoriesPage } from './components/MemoriesPage';
import { createNav } from './components/Nav';
import { h } from './dom';
import { onRoute, type PageId } from './router';

interface Page {
  element: HTMLElement;
  onEnter?: () => void;
  onLeave?: () => void;
}

/** The 2D watercolour book: every device without WebGL still gets the whole gift. */
export function startFlatBook(root: HTMLElement): void {
  const pages: Record<PageId, Page> = {
    home: createBookCover(),
    memories: { element: createMemoriesPage() },
    letter: createBirthdayLetterPage(),
  };

  const nav = createNav();
  const main = h('main', {}, ...Object.values(pages).map((page) => page.element));
  root.append(nav.element, main);

  let current: PageId | null = null;

  // Every page stays mounted, so the opened letter and its song keep their place.
  onRoute((id) => {
    if (current) pages[current].onLeave?.();
    const isFirstLoad = current === null;
    for (const [key, page] of Object.entries(pages)) {
      page.element.hidden = key !== id;
      page.element.classList.toggle('page-enter', key === id);
    }
    current = id;
    nav.setActive(id);
    pages[id].onEnter?.();
    window.scrollTo(0, 0);
    if (!isFirstLoad) pages[id].element.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  });
}
