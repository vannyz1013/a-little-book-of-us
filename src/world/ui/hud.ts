import { createNav, createPageTurn } from '../../components/Nav';
import { h } from '../../dom';
import type { PageId } from '../../router';
import type { Interactable } from '../core/interaction';

/** Where the birthday scene's interface sits on screen, in CSS pixels. */
export interface LetterBounds {
  /** Bottom of the navigation bar. */
  top: number;
  /** Top of the controls at the foot of the screen. */
  bottom: number;
}

/** All the flat interface that floats over the world. */
export function createHud(host: HTMLElement, onOpenBook: () => void, onOpenLetter: () => void) {
  const nav = createNav();
  const openBook = h('button', { class: 'btn', type: 'button' }, 'Open the Book');
  const openLetter = h('button', { class: 'btn', type: 'button', hidden: true }, 'Open Your Letter');
  const candleHint = h('p', { class: 'hud__hint', hidden: true }, 'Tap the candle to light it');
  const musicSlot = h('div', { class: 'hud__music' });

  const sections: Record<PageId, HTMLElement> = {
    home: h(
      'section',
      { class: 'hud hud--home' },
      h('h1', { class: 'sr-only', tabindex: -1 }, 'A Little Book for You'),
      h('div', { class: 'hud__foot' }, openBook, h('p', { class: 'hud__signature' }, 'Made with love, just for you.')),
    ),
    memories: h(
      'section',
      { class: 'hud hud--inner' },
      h('header', { class: 'hud__heading' }, h('h1', { tabindex: -1 }, 'Our Memories'), h('p', {}, 'Choose a frame to step inside.')),
      h('div', { class: 'hud__foot' }, createPageTurn('home', 'letter')),
    ),
    letter: h(
      'section',
      { class: 'hud hud--inner hud--letter' },
      h('h1', { class: 'sr-only', tabindex: -1 }, 'Birthday Letter'),
      h('div', { class: 'hud__foot' }, candleHint, musicSlot, openLetter, createPageTurn('memories', null)),
    ),
  };

  const actions = h('div', { class: 'world-actions', role: 'group', 'aria-label': 'Things to do here' });
  const veil = h('div', { class: 'world-veil', 'aria-hidden': 'true' });
  host.append(veil, nav.element, ...Object.values(sections), actions);

  openBook.addEventListener('click', onOpenBook);
  openLetter.addEventListener('click', onOpenLetter);

  return {
    nav,
    openBook,
    openLetter,
    candleHint,
    musicSlot,
    veil,
    show(id: PageId) {
      for (const [key, section] of Object.entries(sections)) section.hidden = key !== id;
      nav.setActive(id);
    },
    /** Measured only while the birthday scene is showing; otherwise null. */
    letterBounds(): LetterBounds | null {
      const section = sections.letter;
      if (section.hidden) return null;
      const foot = section.querySelector<HTMLElement>('.hud__foot')!.getBoundingClientRect();
      const box = nav.element.getBoundingClientRect();
      if (!foot.height || !box.height) return null;
      return { top: box.bottom, bottom: foot.top };
    },
    focusHeading(id: PageId) {
      sections[id].querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
    },
    /** Every 3D object also exists as a real button, for keyboards and screen readers. */
    setActions(items: Interactable[]) {
      actions.replaceChildren(
        ...items
          .filter((item) => item.enabled?.() ?? true)
          .map((item) => {
            const button = h('button', { type: 'button', class: 'world-actions__button' }, item.label);
            button.addEventListener('click', () => item.onActivate());
            button.addEventListener('focus', () => item.onHover?.(true));
            button.addEventListener('blur', () => item.onHover?.(false));
            return button;
          }),
      );
    },
  };
}
