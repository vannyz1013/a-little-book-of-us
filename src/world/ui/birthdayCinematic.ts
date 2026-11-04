export type SurpriseMode = 'hidden' | 'playing' | 'finished';

/** Small accessible controls and crisp DOM typography for the 3D birthday scene. */
export class BirthdayCinematicUI {
  readonly element = document.createElement('section');
  readonly skip = document.createElement('button');
  readonly replay = document.createElement('button');
  readonly back = document.createElement('button');
  private readonly messages: HTMLParagraphElement[] = [];
  private readonly copy: HTMLDivElement;
  private readonly onModeChange: (mode: SurpriseMode) => void;
  private mode: SurpriseMode = 'hidden';

  constructor(host: HTMLElement, onModeChange: (mode: SurpriseMode) => void = () => {}) {
    this.onModeChange = onModeChange;
    this.element.className = 'birthday-cinematic';
    this.element.hidden = true;
    this.element.setAttribute('aria-label', 'Birthday surprise controls');

    const copy = document.createElement('div');
    copy.className = 'birthday-cinematic__copy';
    copy.setAttribute('aria-live', 'polite');
    copy.setAttribute('aria-atomic', 'false');
    this.copy = copy;
    const lines = ['A little surprise, just for you.', 'Happy Birthday, Mun Yi!', 'With love, Zi Nor ♡'];
    lines.forEach((text, index) => {
      const line = document.createElement('p');
      line.className = `birthday-cinematic__message birthday-cinematic__message--${index + 1}`;
      line.textContent = text;
      line.setAttribute('aria-hidden', 'true');
      this.messages.push(line);
      copy.append(line);
    });

    const controls = document.createElement('div');
    controls.className = 'birthday-cinematic__controls';
    for (const [button, label, style] of [
      [this.skip, 'Skip', 'birthday-cinematic__button'],
      [this.replay, 'Replay', 'birthday-cinematic__button'],
      [this.back, 'Back to the cake', 'birthday-cinematic__button birthday-cinematic__button--primary'],
    ] as const) {
      button.type = 'button';
      button.textContent = label;
      button.className = style;
      controls.append(button);
    }
    this.element.append(copy, controls);
    host.append(this.element);
    this.host = host;
    this.set('hidden', 0);
  }

  private readonly host: HTMLElement;

  set(mode: SurpriseMode, visibleMessages: number): void {
    const hadFocus = document.activeElement === this.skip;
    const entering = mode === 'playing' && this.mode !== 'playing';
    const finishing = mode === 'finished' && this.mode === 'playing';
    this.mode = mode;
    this.element.hidden = mode === 'hidden';
    this.element.dataset.mode = mode;
    this.host.classList.toggle('is-cinematic', mode !== 'hidden');
    this.skip.hidden = mode !== 'playing';
    this.replay.hidden = mode !== 'finished';
    this.back.hidden = mode === 'hidden';
    this.messages.forEach((message, index) => {
      const visible = (visibleMessages & (1 << index)) !== 0;
      message.classList.toggle('is-visible', visible);
      message.setAttribute('aria-hidden', String(!visible));
    });
    this.copy.classList.toggle('has-visible-message', visibleMessages !== 0);
    if (entering) this.skip.focus({ preventScroll: true });
    if (finishing && hadFocus) this.replay.focus({ preventScroll: true });
    this.onModeChange(mode);
  }
}
