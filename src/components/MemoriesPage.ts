import { h } from '../dom';
import { birthdayContent } from '../data/birthdayContent';
import { createLightbox } from './Lightbox';
import { createMemoryCard } from './MemoryCard';
import { createPageTurn } from './Nav';
import { createCorners, createPageHeading } from './PageHeading';

export function createMemoriesPage(): HTMLElement {
  const lightbox = createLightbox();
  const cards = birthdayContent.memories.map((memory, index) =>
    createMemoryCard(memory, index, () => lightbox.open(memory, index)),
  );

  return h(
    'section',
    { class: 'page' },
    ...createCorners(),
    createPageHeading('Our Memories', 'A little scrapbook of our moments.'),
    h('div', { class: 'scrapbook' }, ...cards),
    createPageTurn('home', 'things'),
    lightbox.element,
  );
}
