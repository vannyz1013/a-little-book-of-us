import { h, paint } from '../dom';
import { birthdayContent } from '../data/birthdayContent';
import { textWithTag } from './PlaceholderTag';

/**
 * The birthday letter as a sheet of decorated stationery: ivory paper, a fine
 * lavender border, a ribbon of washi tape, and a few pressed botanicals kept in
 * the margins so that they never touch the words. Shared by the 3D world's
 * letter panel and the flat book.
 */
export function createLetterSheet(): HTMLElement {
  const { greeting, paragraphs, signOff } = birthdayContent.letter;
  const [opening, ...body] = paragraphs;
  return h(
    'article',
    { class: 'letter' },
    paint('images/decorations/washi-sage.webp', 'letter__ribbon'),
    paint('images/decorations/sprig-eucalyptus.webp', 'letter__sprig'),
    paint('images/decorations/sprig-floral.webp', 'letter__floral'),
    paint('images/decorations/pressed-cosmos.webp', 'letter__pressed'),
    paint('images/decorations/butterfly-lavender.webp', 'letter__butterfly'),
    h(
      'div',
      { class: 'letter__body' },
      textWithTag('h2', 'letter__greeting', greeting),
      textWithTag('p', 'letter__opening', opening),
      ...body.map((paragraph) => textWithTag('p', 'letter__paragraph', paragraph)),
      h('p', { class: 'letter__signoff' }, signOff),
      textWithTag('p', 'letter__signature', birthdayContent.senderName),
    ),
  );
}
