import { asset, h, paint } from '../dom';
import type { Memory } from '../data/birthdayContent';

const TAPES = ['washi-sage', 'washi-rose', 'washi-beige'];
const PRESSED = ['pressed-daisy', 'pressed-fern', 'pressed-cosmos'];

export const memoryImage = (memory: Memory) => ({ src: asset(memory.photo), alt: memory.photoAlt });

/** One taped photograph, shown whole at its own proportions, with no caption. */
export function createMemoryCard(memory: Memory, index: number, onOpen: () => void): HTMLElement {
  const image = memoryImage(memory);
  return h(
    'article',
    { class: 'memory' },
    paint(`images/decorations/${TAPES[index % TAPES.length]}.webp`, 'memory__tape'),
    index % 2 === 0 && paint(`images/decorations/${PRESSED[(index / 2) % PRESSED.length]}.webp`, 'memory__pressed'),
    h(
      'button',
      { class: 'memory__photo', type: 'button', 'aria-label': `View photo ${index + 1} larger`, onclick: onOpen },
      h('img', { src: image.src, alt: image.alt, loading: 'lazy', decoding: 'async' }),
    ),
  );
}
