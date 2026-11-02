import { h } from '../dom';
import type { Memory } from '../data/birthdayContent';
import { memoryImage } from './MemoryCard';
import { textWithTag } from './PlaceholderTag';

/** A native <dialog> gives focus trapping and Esc-to-close for free. */
export function createLightbox(): { element: HTMLDialogElement; open: (memory: Memory, index: number) => void } {
  const image = h('img', { class: 'lightbox__image' });
  const caption = h('div', { class: 'lightbox__caption' });
  const close = h('button', { class: 'lightbox__close', type: 'button' }, 'Close');
  const element = h(
    'dialog',
    { class: 'lightbox', 'aria-label': 'Memory' },
    h('div', { class: 'lightbox__frame' }, close, image, caption),
  );

  close.addEventListener('click', () => element.close());
  // A click that lands on the backdrop targets the dialog element itself.
  element.addEventListener('click', (event) => {
    if (event.target === element) element.close();
  });

  return {
    element,
    open(memory, index) {
      const picture = memoryImage(memory, index);
      image.src = picture.src;
      image.alt = picture.alt;
      caption.replaceChildren(
        textWithTag('h2', 'memory__title', memory.title),
        ...(memory.date ? [h('p', { class: 'memory__date' }, memory.date)] : []),
        textWithTag('p', 'lightbox__description', memory.description),
        textWithTag('p', 'lightbox__story', memory.story),
      );
      element.showModal();
      close.focus();
    },
  };
}
