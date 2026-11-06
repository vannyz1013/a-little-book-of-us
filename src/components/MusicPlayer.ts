import { asset, h } from '../dom';

type State = 'idle' | 'playing' | 'paused' | 'blocked' | 'missing';

/**
 * The two themes of the day. `ambient` is the soft opening theme, heard from the
 * visitor's first tap; `birthday` takes over, once, when the candle is lit or the
 * gift is opened, and stays for the rest of the visit.
 */
type Theme = 'ambient' | 'birthday';
/** Which theme the music is on: `silent` until the visitor's first tap or key. */
type Phase = 'silent' | Theme;

const THEMES: Record<Theme, { src: string; level: number }> = {
  // The opening theme sits well below the song, as background.
  ambient: { src: 'audio/ambient-garden.mp3', level: 0.55 },
  birthday: { src: 'audio/happy-birthday.mp3', level: 1 },
};

/** Seconds. The crossfade is equal-power, so the pair never peaks above one track. */
const CROSSFADE = 2.6;
const FIRST_FADE_IN = 2.2;
const REPLAY_FADE_IN = 0.6;

export interface MusicPlayer {
  element: HTMLElement;
  /** True once any music has been asked to play, so the controls should show. */
  readonly started: boolean;
  /** Called whenever the controls' state changes. */
  onChange(listener: () => void): void;
  /** Start the opening theme on the visitor's first tap or key press anywhere. */
  listenForFirstGesture(): void;
  /** Move to the birthday song: crossfades once, then never restarts it. */
  celebrate(): void;
  /** Warm up the birthday song. Never makes a sound. */
  prepare(): void;
  /** Inside the Open Your Letter click: lets the browser play the song afterwards. */
  unlock(): void;
  /** The letter is revealed: the birthday song plays (without restarting it). */
  begin(): void;
}

interface Fade {
  from: number;
  to: number;
  duration: number;
  elapsed: number;
}

interface Track {
  theme: Theme;
  audio: HTMLAudioElement;
  gain: GainNode | null;
  /** 0–1, before the theme's own level and the mute. */
  value: number;
  fade: Fade | null;
  /** Set while this controller pauses the element itself, so its event isn't the visitor's. */
  quiet: boolean;
}

type AudioContextConstructor = typeof AudioContext;

/**
 * One controller and two audio elements for the life of the page, so music can
 * never double up. The themes loop and keep playing from scene to scene; only the
 * visitor's own Pause stops them.
 *
 * Volume runs through Web Audio gain nodes where available (iOS ignores an audio
 * element's volume), falling back to the element's volume elsewhere.
 */
export function createMusicPlayer(): MusicPlayer {
  const makeTrack = (theme: Theme): Track => {
    const audio = h('audio', { preload: 'none', src: asset(THEMES[theme].src) });
    audio.loop = true;
    return { theme, audio, gain: null, value: 0, fade: null, quiet: false };
  };
  const tracks: Record<Theme, Track> = { ambient: makeTrack('ambient'), birthday: makeTrack('birthday') };

  let phase: Phase = 'silent';
  let state: State = 'idle';
  let userMuted = false;
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let ticker = 0;
  let lastTick = 0;
  const listeners: (() => void)[] = [];

  const toggle = h('button', { class: 'music__button', type: 'button' });
  const mute = h('button', { class: 'music__button', type: 'button' });
  const replay = h('button', { class: 'music__button', type: 'button' }, 'Replay');
  const status = h('p', { class: 'music__status', role: 'status' });
  const element = h(
    'div',
    { class: 'music', 'aria-label': 'Music controls', role: 'group' },
    h('div', { class: 'music__buttons' }, toggle, mute, replay),
    status,
  );

  const active = (): Track | null => (phase === 'silent' ? null : tracks[phase]);
  const sounding = (): Track[] => Object.values(tracks).filter((track) => track === active() || track.value > 0);

  const render = (): void => {
    toggle.textContent = state === 'playing' ? 'Pause' : 'Play';
    toggle.classList.toggle('is-primary', state === 'blocked');
    mute.textContent = userMuted ? 'Unmute' : 'Mute';
    mute.setAttribute('aria-pressed', String(userMuted));

    const missing = state === 'missing';
    toggle.hidden = mute.hidden = replay.hidden = missing;
    status.textContent = missing
      ? `The music isn't here yet. Add the file at public/${THEMES[phase === 'silent' ? 'ambient' : phase].src}.`
      : state === 'blocked'
        ? 'Your browser held the music back. Press Play to hear it.'
        : '';
    listeners.forEach((listener) => listener());
  };

  const set = (next: State): void => {
    state = next;
    render();
  };

  // ---- Volume ----

  /** Web Audio, created inside a tap so the browser lets it run. */
  const ensureContext = (): void => {
    if (context) {
      if (context.state === 'suspended') void context.resume().catch(() => {});
      return;
    }
    const Context: AudioContextConstructor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!Context) return;
    try {
      context = new Context();
      master = context.createGain();
      master.gain.value = userMuted ? 0 : 1;
      master.connect(context.destination);
      for (const track of Object.values(tracks)) {
        track.gain = context.createGain();
        track.gain.gain.value = 0; // Silent until its theme fades it in.
        context.createMediaElementSource(track.audio).connect(track.gain);
        track.gain.connect(master);
        track.audio.volume = 1;
        apply(track, true);
      }
      void context.resume().catch(() => {});
    } catch {
      // Without Web Audio the elements' own volume does the fading.
      context = null;
      master = null;
      for (const track of Object.values(tracks)) track.gain = null;
    }
  };

  const apply = (track: Track, instant = false): void => {
    const level = track.value * THEMES[track.theme].level;
    if (track.gain && context) {
      const param = track.gain.gain;
      if (instant) {
        param.cancelScheduledValues(context.currentTime);
        param.value = level;
      } else {
        param.setTargetAtTime(level, context.currentTime, 0.03);
      }
    } else {
      track.audio.volume = Math.min(1, Math.max(0, level));
    }
  };

  const applyMute = (): void => {
    if (master && context) master.gain.setTargetAtTime(userMuted ? 0 : 1, context.currentTime, 0.02);
    for (const track of Object.values(tracks)) track.audio.muted = !master && userMuted;
  };

  // ---- Fades: they advance only while the music is audibly playing ----

  const fadeTo = (track: Track, to: number, duration: number): void => {
    track.fade = { from: track.value, to, duration: Math.max(duration, 0.001), elapsed: 0 };
    startTicker();
  };

  const tick = (): void => {
    const now = performance.now();
    const step = Math.min((now - lastTick) / 1000, 0.25);
    lastTick = now;
    if (state !== 'playing') return; // Paused: the fade waits where it is.
    let running = false;
    for (const track of Object.values(tracks)) {
      const fade = track.fade;
      if (!fade) continue;
      fade.elapsed += step;
      const p = Math.min(fade.elapsed / fade.duration, 1);
      // Equal-power curves: rising on a sine, falling on a cosine.
      track.value = fade.to > fade.from
        ? fade.from + (fade.to - fade.from) * Math.sin((p * Math.PI) / 2)
        : fade.to + (fade.from - fade.to) * Math.cos((p * Math.PI) / 2);
      apply(track);
      if (p < 1) {
        running = true;
        continue;
      }
      // Land exactly on the target: cos(π/2) is not quite zero in floating point.
      track.value = fade.to;
      apply(track);
      track.fade = null;
      if (track.value === 0 && track !== active()) silence(track);
    }
    if (!running) stopTicker();
  };

  const startTicker = (): void => {
    if (ticker) return;
    lastTick = performance.now();
    ticker = window.setInterval(tick, 40);
  };

  const stopTicker = (): void => {
    window.clearInterval(ticker);
    ticker = 0;
  };

  // ---- Playback ----

  const silence = (track: Track): void => {
    track.fade = null;
    track.value = 0;
    apply(track, true);
    if (!track.audio.paused) {
      track.quiet = true;
      track.audio.pause();
    }
  };

  const play = (track: Track): void => {
    track.audio.preload = 'auto';
    track.audio.play().catch((error: DOMException) => {
      if (error.name === 'AbortError') return; // Superseded by a pause; not a failure.
      if (track !== active()) return;
      if (error.name === 'NotSupportedError') return set('missing');
      // Still waiting for the first gesture (a touch's pointerdown doesn't count,
      // its touchend does): try again on the next one without raising an alarm.
      if (listening) return;
      set('blocked');
    });
  };

  for (const track of Object.values(tracks)) {
    track.audio.addEventListener('playing', () => {
      if (track !== active()) return;
      stopListening();
      set('playing');
    });
    track.audio.addEventListener('pause', () => {
      if (track.quiet) {
        track.quiet = false;
        return;
      }
      // Paused from outside (a phone call, the system's media keys): follow along.
      if (track === active() && state === 'playing') {
        for (const other of sounding()) if (other !== track) pauseQuietly(other);
        set('paused');
      }
    });
    track.audio.addEventListener('error', () => {
      if (track === active()) set('missing');
    });
  }

  const pauseQuietly = (track: Track): void => {
    if (track.audio.paused) return;
    track.quiet = true;
    track.audio.pause();
  };

  /** Switch to a theme, keeping the visitor's pause and mute choices. */
  const switchTo = (theme: Theme, fadeIn: number): void => {
    ensureContext();
    const previous = active();
    const next = tracks[theme];
    phase = theme;
    if (next.audio.paused || next.value === 0) next.audio.currentTime = 0;
    if (state === 'paused') {
      // Paused by the visitor: be ready on the new theme, but stay quiet until Play.
      if (previous && previous !== next) silence(previous);
      next.value = 1;
      next.fade = null;
      apply(next, true);
      render();
      return;
    }
    if (previous && previous !== next) fadeTo(previous, 0, CROSSFADE);
    apply(next, true);
    fadeTo(next, 1, previous && previous !== next ? CROSSFADE : fadeIn);
    play(next);
    render();
  };

  // ---- First gesture ----

  const gestureEvents = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;
  const ignoredKeys = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'Escape', 'CapsLock']);
  let listening = false;

  const onGesture = (event: Event): void => {
    if (event instanceof KeyboardEvent && ignoredKeys.has(event.key)) return;
    if (phase === 'silent') return switchTo('ambient', FIRST_FADE_IN);
    // Started already, but the browser refused the earlier event: retry on this one.
    const track = active();
    if (state === 'playing' || state === 'paused' || !track) return stopListening();
    ensureContext();
    if (track.audio.paused) play(track);
  };

  const stopListening = (): void => {
    if (!listening) return;
    listening = false;
    for (const type of gestureEvents) document.removeEventListener(type, onGesture, true);
  };

  // ---- Controls ----

  toggle.addEventListener('click', () => {
    ensureContext();
    stopListening();
    if (state === 'playing') {
      for (const track of sounding()) pauseQuietly(track);
      set('paused');
      return;
    }
    if (phase === 'silent') return switchTo('ambient', FIRST_FADE_IN);
    // Resume where each track left off, including one mid-crossfade.
    for (const track of sounding()) play(track);
    startTicker();
  });

  mute.addEventListener('click', () => {
    userMuted = !userMuted;
    applyMute();
    render();
  });

  // Replay starts the current theme again from the top. It never changes which theme.
  replay.addEventListener('click', () => {
    const track = active();
    if (!track) return;
    ensureContext();
    for (const other of Object.values(tracks)) if (other !== track) silence(other);
    track.audio.currentTime = 0;
    track.value = 0;
    apply(track, true);
    fadeTo(track, 1, REPLAY_FADE_IN);
    if (track.audio.paused) play(track);
    else set('playing');
  });

  render();

  if (new URLSearchParams(location.search).has('qa')) {
    const qa = window as unknown as Record<string, unknown>;
    qa.__audio = tracks.birthday.audio;
    qa.__music = {
      snapshot: () => ({
        phase,
        state,
        userMuted,
        context: context?.state ?? 'none',
        tracks: Object.values(tracks).map((track) => ({
          theme: track.theme,
          paused: track.audio.paused,
          time: Math.round(track.audio.currentTime * 100) / 100,
          value: Math.round(track.value * 1000) / 1000,
          gain: Math.round((track.gain ? track.gain.gain.value : track.audio.volume) * 1000) / 1000,
          master: master ? Math.round(master.gain.value * 1000) / 1000 : track.audio.muted ? 0 : 1,
          fading: track.fade !== null,
        })),
      }),
    };
  }

  return {
    element,
    get started() {
      return phase !== 'silent';
    },
    onChange(listener) {
      listeners.push(listener);
    },
    listenForFirstGesture() {
      if (listening || phase !== 'silent') return;
      listening = true;
      for (const type of gestureEvents) document.addEventListener(type, onGesture, { capture: true, passive: true });
    },
    celebrate() {
      if (phase === 'birthday') return;
      switchTo('birthday', FIRST_FADE_IN);
    },
    prepare() {
      const audio = tracks.birthday.audio;
      if (audio.preload === 'auto') return;
      audio.preload = 'auto';
      audio.load();
    },
    unlock() {
      ensureContext();
      // Already on the song: nothing to unlock.
      if (phase === 'birthday') return;
      // Start it silently inside this tap, so the browser allows it a moment later.
      const track = tracks.birthday;
      track.value = 0;
      apply(track, true);
      if (track.audio.paused) {
        track.audio.play().catch(() => {});
      }
    },
    begin() {
      if (phase === 'birthday') return;
      switchTo('birthday', FIRST_FADE_IN);
    },
  };
}
