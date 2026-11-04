import { asset, h } from '../dom';

type State = 'idle' | 'playing' | 'paused' | 'blocked' | 'missing';

const SONG = 'audio/happy-birthday.mp3';

export interface MusicPlayer {
  element: HTMLElement;
  /** Warm up the file. Never makes a sound. */
  prepare(): void;
  /** Must run inside the Open Your Letter click: browsers only allow audio there. */
  unlock(): void;
  /** Start the song from the top, audibly. Runs once the letter is revealed. */
  begin(): void;
}

/**
 * One audio element for the life of the page, so the song can never double up.
 * Once started it loops, and it keeps playing from scene to scene until the
 * visitor pauses it: moving between pages never stops, restarts or resets it.
 */
export function createMusicPlayer(): MusicPlayer {
  const audio = h('audio', { preload: 'none', src: asset(SONG) });
  audio.loop = true;
  let state: State = 'idle';
  let userMuted = false;
  // While unlocking it plays silently, so its events aren't the real start.
  let unlocking = false;
  let started = false;
  if (new URLSearchParams(location.search).has('qa')) (window as unknown as Record<string, unknown>).__audio = audio;

  const toggle = h('button', { class: 'music__button', type: 'button' });
  const mute = h('button', { class: 'music__button', type: 'button' });
  const replay = h('button', { class: 'music__button', type: 'button' }, 'Replay');
  const status = h('p', { class: 'music__status', role: 'status' });
  const element = h(
    'div',
    { class: 'music', 'aria-label': 'Birthday song controls', role: 'group' },
    h('div', { class: 'music__buttons' }, toggle, mute, replay),
    status,
  );

  const render = (): void => {
    toggle.textContent = state === 'playing' ? 'Pause' : 'Play';
    toggle.classList.toggle('is-primary', state === 'blocked');
    mute.textContent = userMuted ? 'Unmute' : 'Mute';
    mute.setAttribute('aria-pressed', String(userMuted));

    const missing = state === 'missing';
    toggle.hidden = mute.hidden = replay.hidden = missing;
    status.textContent = missing
      ? `The song isn't here yet. Add the file at public/${SONG}.`
      : state === 'blocked'
        ? 'Your browser held the music back. Press Play to hear your song.'
        : '';
  };

  const set = (next: State): void => {
    state = next;
    render();
  };

  const attempt = (): void => {
    audio.play().catch((error: DOMException) => {
      if (error.name === 'AbortError') return; // Superseded by a pause; not a failure.
      set(error.name === 'NotSupportedError' ? 'missing' : 'blocked');
    });
  };

  audio.addEventListener('playing', () => {
    if (!unlocking) set('playing');
  });
  audio.addEventListener('pause', () => {
    if (!unlocking && state === 'playing') set('paused');
  });
  audio.addEventListener('error', () => set('missing'));

  toggle.addEventListener('click', () => {
    if (state === 'playing') return audio.pause();
    audio.muted = userMuted;
    attempt();
  });
  mute.addEventListener('click', () => {
    userMuted = !userMuted;
    audio.muted = userMuted;
    render();
  });
  replay.addEventListener('click', () => {
    audio.currentTime = 0;
    audio.muted = userMuted;
    if (audio.paused) attempt();
  });

  render();

  return {
    element,
    prepare() {
      if (audio.preload === 'auto') return;
      audio.preload = 'auto';
      audio.load();
    },
    unlock() {
      unlocking = true;
      audio.muted = true;
      attempt();
    },
    begin() {
      unlocking = false;
      audio.muted = userMuted;
      if (state === 'missing' || state === 'blocked') return;
      // Only the very first start begins at the top; after that the controls decide.
      if (started) return;
      started = true;
      audio.currentTime = 0;
      if (audio.paused) attempt();
      else set('playing');
    },
  };
}
