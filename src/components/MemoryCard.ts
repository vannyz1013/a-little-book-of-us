import { asset, h, paint } from '../dom';
import type { Memory } from '../data/birthdayContent';
import { textWithTag } from './PlaceholderTag';

const TAPES = ['washi-sage', 'washi-rose', 'washi-beige'];
const PLACEHOLDERS = ['placeholder-sage', 'placeholder-rose', 'placeholder-beige'];
const PRESSED = ['pressed-daisy', 'pressed-fern', 'pressed-cosmos'];

/** Painted stand-in used until a real photograph is added. */
export const memoryImage = (memory: Memory, index: number) => ({
  src: asset(memory.photo ?? `images/memories/${PLACEHOLDERS[index % PLACEHOLDERS.length]}.webp`),
  alt: memory.photo ? (memory.photoAlt ?? memory.title) : 'Placeholder: a personal photograph goes here',
  isPlaceholder: !memory.photo,
});

export function createMemoryCard(memory: Memory, index: number, onOpen: () => void): HTMLElement {
  const image = memoryImage(memory, index);
  return h(
    'article',
    { class: 'memory' },
    paint(`images/decorations/${TAPES[index % TAPES.length]}.webp`, 'memory__tape'),
    index % 2 === 0 && paint(`images/decorations/${PRESSED[(index / 2) % PRESSED.length]}.webp`, 'memory__pressed'),
    h(
      'button',
      { class: 'memory__photo', type: 'button', 'aria-label': `View larger: ${memory.title}`, onclick: onOpen },
      h('img', { src: image.src, alt: image.alt, loading: 'lazy', decoding: 'async' }),
      image.isPlaceholder && h('span', { class: 'memory__placeholder' }, 'Your photo goes here'),
    ),
    h(
      'div',
      { class: 'memory__text' },
      textWithTag('h2', 'memory__title', memory.title),
      memory.date && h('p', { class: 'memory__date' }, memory.date),
      textWithTag('p', 'memory__description', memory.description),
      h('p', { class: 'memory__story' }, memory.story),
    ),
  );
}
