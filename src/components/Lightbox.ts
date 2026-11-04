import { h } from '../dom';
import type { Memory } from '../data/birthdayContent';
import { memoryImage } from './MemoryCard';

/** A native <dialog> gives focus trapping and Esc-to-close for free. */
export function createLightbox(closeLabel = 'Close'): { element: HTMLDialogElement; open: (memory: Memory) => void } {
  const image = h('img', { class: 'lightbox__image' });
  const close = h('button', { class: 'lightbox__close', type: 'button' }, closeLabel);
  const element = h('dialog', { class: 'lightbox', 'aria-label': 'Photo' }, h('div', { class: 'lightbox__frame' }, close, image));

  close.addEventListener('click', () => element.close());
  // A click that lands on the backdrop targets the dialog element itself.
  element.addEventListener('click', (event) => {
    if (event.target === element) element.close();
  });

  return {
    element,
    open(memory) {
      const picture = memoryImage(memory);
      image.src = picture.src;
      image.alt = picture.alt;
      element.showModal();
      close.focus();
    },
  };
}
