import { h, prefersReducedMotion } from '../dom';
import { isPlaceholder } from '../data/birthdayContent';

export function createPaperNote(text: string, index: number): HTMLElement {
  return h(
    'li',
    { class: `note note--${index % 3}`, style: `--delay: ${index * 90}ms` },
    h('p', {}, text),
    isPlaceholder(text) && h('span', { class: 'placeholder-tag' }, 'placeholder'),
  );
}

/** Notes settle onto the page the first time they scroll into view. */
export function revealOnScroll(notes: HTMLElement[]): void {
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    notes.forEach((note) => note.classList.add('is-seen'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-seen');
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.2 },
  );
  notes.forEach((note) => observer.observe(note));
}
