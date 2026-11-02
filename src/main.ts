import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/caveat/latin-500.css';
import './styles/global.css';
import './styles/nav.css';
import './styles/cover.css';
import './styles/scrapbook.css';
import './styles/notes.css';
import './styles/letter.css';
import './styles/animations.css';

import { createBirthdayLetterPage } from './components/BirthdayLetter';
import { createBookCover } from './components/BookCover';
import { createLittleThingsPage } from './components/LittleThingsPage';
import { createMemoriesPage } from './components/MemoriesPage';
import { createNav } from './components/Nav';
import { h } from './dom';
import { onRoute, type PageId } from './router';

interface Page {
  element: HTMLElement;
  onEnter?: () => void;
  onLeave?: () => void;
}

const pages: Record<PageId, Page> = {
  home: createBookCover(),
  memories: { element: createMemoriesPage() },
  things: { element: createLittleThingsPage() },
  letter: createBirthdayLetterPage(),
};

const nav = createNav();
const main = h('main', {}, ...Object.values(pages).map((page) => page.element));
document.querySelector('#app')!.append(nav.element, main);

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
