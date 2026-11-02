import { h } from '../dom';
import { birthdayContent } from '../data/birthdayContent';
import { createPageTurn } from './Nav';
import { createCorners, createPageHeading } from './PageHeading';
import { createPaperNote, revealOnScroll } from './PaperNote';

export function createLittleThingsPage(): HTMLElement {
  const allNotes: HTMLElement[] = [];
  const groups = birthdayContent.noteGroups.map((group) => {
    const notes = group.notes.map(createPaperNote);
    allNotes.push(...notes);
    return h('section', { class: 'notes' }, h('h2', {}, group.title), h('ul', {}, ...notes));
  });
  revealOnScroll(allNotes);

  return h(
    'section',
    { class: 'page' },
    ...createCorners(),
    createPageHeading('Little Things', 'A handful of small notes.'),
    ...groups,
    createPageTurn('memories', 'letter'),
  );
}
