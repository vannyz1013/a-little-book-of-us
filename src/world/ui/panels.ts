import { createLetterSheet } from '../../components/LetterSheet';
import { h } from '../../dom';

/* Long text stays in crisp HTML, never on a 3D surface. */

function dialog(className: string, label: string, closeLabel: string, onClose: () => void, ...content: HTMLElement[]) {
  const close = h('button', { class: 'panel__close', type: 'button' }, closeLabel);
  const element = h('dialog', { class: `panel ${className}`, 'aria-label': label }, ...content, close);
  close.addEventListener('click', () => element.close());
  element.addEventListener('click', (event) => {
    if (event.target === element) element.close();
  });
  element.addEventListener('close', onClose);
  return { element, close };
}

export function createLetterPanel(music: HTMLElement, onClose: () => void) {
  const sheet = createLetterSheet();
  const slot = h('div', { class: 'letter-panel__music' });
  const { element, close } = dialog('letter-panel', 'Your birthday letter', 'Back to the cake', onClose, sheet, slot);
  return {
    element,
    open() {
      // The same controls follow the letter, so the song is never interrupted.
      slot.append(music);
      element.showModal();
      close.focus({ preventScroll: true });
      element.scrollTop = 0;
    },
  };
}
