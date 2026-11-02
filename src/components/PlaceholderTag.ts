import { h } from '../dom';
import { isPlaceholder } from '../data/birthdayContent';

/** Renders text, flagging it visibly while it is still a placeholder. */
export function textWithTag(tag: 'p' | 'h2', className: string, text: string): HTMLElement {
  return h(
    tag,
    { class: className },
    text,
    isPlaceholder(text) && h('span', { class: 'placeholder-tag' }, 'placeholder'),
  );
}
