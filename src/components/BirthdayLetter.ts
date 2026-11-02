import { h, paint, prefersReducedMotion } from '../dom';
import { birthdayContent } from '../data/birthdayContent';
import { createMusicPlayer } from './MusicPlayer';
import { createPageTurn } from './Nav';
import { textWithTag } from './PlaceholderTag';

// The flap lifts, then the letter rises out of the envelope.
const OPENING_MS = 2000;

/** Candle tips as a percentage of cake.webp (printed by scene_birthday.py). */
const CANDLES: [number, number][] = [
  [38.2, 25.9],
  [50, 23.9],
  [61.8, 25.9],
];

function createCake(): HTMLElement {
  return h(
    'div',
    { class: 'cake' },
    paint('images/birthday/cake.webp', 'cake__art'),
    ...CANDLES.map(([left, top], index) =>
      h('span', { class: 'flame', style: `left:${left}%;top:${top}%;--delay:${index * 0.17}s`, 'aria-hidden': 'true' }),
    ),
  );
}

function createEnvelope(): HTMLElement {
  return h(
    'div',
    { class: 'envelope' },
    paint('images/birthday/envelope-back.webp', 'envelope__layer'),
    h('div', { class: 'envelope__sheet' }),
    paint('images/birthday/envelope-front.webp', 'envelope__layer envelope__pocket'),
    h(
      'div',
      { class: 'envelope__flap' },
      paint('images/birthday/envelope-flap.webp', 'envelope__layer'),
      paint('images/birthday/wax-seal.webp', 'envelope__seal'),
    ),
    h('p', { class: 'envelope__to' }, `For ${birthdayContent.recipientName}`),
  );
}

function createSheet(): HTMLElement {
  const { greeting, paragraphs, signOff } = birthdayContent.letter;
  return h(
    'article',
    { class: 'letter' },
    paint('images/decorations/sprig-eucalyptus.webp', 'letter__sprig'),
    textWithTag('h2', 'letter__greeting', greeting),
    ...paragraphs.map((paragraph) => textWithTag('p', 'letter__paragraph', paragraph)),
    h('p', { class: 'letter__signoff' }, signOff),
    textWithTag('p', 'letter__signature', birthdayContent.senderName),
  );
}

export function createBirthdayLetterPage(): { element: HTMLElement; onEnter: () => void; onLeave: () => void } {
  const music = createMusicPlayer();
  const open = h('button', { class: 'btn', type: 'button' }, 'Open Your Letter');

  const scene = h(
    'div',
    { class: 'scene' },
    paint('images/birthday/flowers-left.webp', 'scene__flowers scene__flowers--left'),
    paint('images/birthday/flowers-right.webp', 'scene__flowers scene__flowers--right'),
    paint('images/birthday/cake.webp', 'scene__cake'),
    createEnvelope(),
  );

  const finale = h(
    'div',
    { class: 'finale' },
    createCake(),
    h('h2', { class: 'finale__message' }, birthdayContent.finalMessage),
  );

  const element = h(
    'section',
    { class: 'page page--letter' },
    paint('images/birthday/bunting.webp', 'bunting'),
    h(
      'header',
      { class: 'page-heading' },
      h('h1', { tabindex: -1 }, 'Birthday Letter'),
      h('p', { class: 'letter-prompt' }, 'One last page, just for you.'),
    ),
    h('div', { class: 'closed-view' }, scene, open),
    h('div', { class: 'open-view' }, createSheet(), music.element, finale),
    createPageTurn('things', null),
  );

  const reveal = (): void => {
    element.classList.remove('is-opening');
    element.classList.add('is-open');
    music.begin();
  };

  open.addEventListener('click', () => {
    open.disabled = true;
    music.unlock();
    if (prefersReducedMotion()) return reveal();
    element.classList.add('is-opening');
    window.setTimeout(reveal, OPENING_MS);
  });

  return {
    element,
    onEnter: () => music.prepare(),
    onLeave: () => music.pause(),
  };
}
