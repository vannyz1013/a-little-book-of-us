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
  const actions = h('div', { class: 'letter-panel__actions' }, slot);
  const { element, close } = dialog('letter-panel', 'Your birthday letter', 'Back to the cake', onClose, sheet, actions);
  // The way back sits with the song's controls, apart from the paper, so neither covers the words.
  actions.append(close);

  // When the paper is shorter than the letter, the writing scrolls inside it. A soft fade
  // at either edge says there is more to read, and lifts once the end is reached.
  const body = sheet.querySelector<HTMLElement>('.letter__body')!;
  const refresh = (): void => {
    // A pixel or two of rounding is not "more to read": no scrollbar for that.
    const more = body.scrollHeight - body.clientHeight > 4;
    sheet.classList.toggle('is-scrollable', more);
    sheet.classList.toggle('has-more-above', more && body.scrollTop > 2);
    sheet.classList.toggle('has-more-below', more && body.scrollTop + body.clientHeight < body.scrollHeight - 2);
  };
  body.addEventListener('scroll', refresh, { passive: true });
  new ResizeObserver(refresh).observe(body);

  return {
    element,
    open() {
      // The same controls follow the letter, so the song is never interrupted.
      slot.append(music);
      element.showModal();
      close.focus({ preventScroll: true });
      element.scrollTop = 0;
      body.scrollTop = 0;
      refresh();
    },
  };
}
