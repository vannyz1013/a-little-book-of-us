"""Synthesise an original music-box recording of "Happy Birthday".

The melody is the traditional public-domain tune (Mildred & Patty Hill, 1893);
this file performs it from scratch, so no existing recording is used.

    python tools/song/make_song.py out.wav
    node tools/song/encode_mp3.mjs out.wav public/audio/happy-birthday.mp3

Verse 1 is a solo music box; verse 2 adds a soft waltz accompaniment.
"""
import json
import sys
import wave

import numpy as np

RATE = 44100
BEAT = 0.64  # seconds per crotchet

# (MIDI note, beats) in G major.
MELODY = [
    (74, 0.75), (74, 0.25),
    (76, 1), (74, 1), (79, 1), (78, 2),
    (74, 0.75), (74, 0.25),
    (76, 1), (74, 1), (81, 1), (79, 2),
    (74, 0.75), (74, 0.25),
    (86, 1), (83, 1), (79, 1), (78, 1), (76, 1),
    (84, 0.75), (84, 0.25),
    (83, 1), (79, 1), (81, 1), (79, 3),
]

G, D7, C = (43, [59, 62, 67]), (38, [57, 60, 66]), (36, [55, 60, 64])
# One chord per beat of the 8 bars that follow the pick-up.
HARMONY = (
    [G] * 3 + [D7] * 3 + [D7] * 3 + [G] * 3 + [G] * 3 + [D7] + [C] * 2 + [G] * 2 + [D7] + [G] * 3
)


def midi_hz(note):
    return 440.0 * 2 ** ((note - 69) / 12)


def music_box(note, length=2.6, level=0.5):
    """A plucked steel tine: slightly inharmonic partials and a quick click."""
    t = np.arange(int(length * RATE)) / RATE
    f = midi_hz(note)
    tone = np.zeros_like(t)
    for ratio, amp, decay in ((1, 1.0, 1.5), (2.0, 0.32, 2.6), (3.01, 0.13, 4.6), (5.42, 0.06, 9.0)):
        tone += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-decay * t)
    click = np.sin(2 * np.pi * f * 7.1 * t) * np.exp(-90 * t) * 0.14
    attack = np.minimum(t / 0.004, 1)
    return (tone + click) * attack * level


def felt(note, length=3.0, level=0.26):
    """A soft felted key for the accompaniment."""
    t = np.arange(int(length * RATE)) / RATE
    f = midi_hz(note)
    tone = sum(
        amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-decay * t)
        for ratio, amp, decay in ((1, 1.0, 1.25), (2, 0.34, 2.1), (3, 0.09, 3.4))
    )
    return tone * np.minimum(t / 0.02, 1) * level


def add(track, start, sound):
    begin = int(start * RATE)
    end = min(begin + len(sound), len(track))
    track[begin:end] += sound[: end - begin]


def stretch(beat_index, total):
    """Beat time with a gentle ritardando through the final bars."""
    remaining = total - beat_index
    return BEAT * (1 + (0.55 * (1 - remaining / 6) ** 2 if remaining < 6 else 0))


def perform():
    total_beats = sum(b for _, b in MELODY)
    duration = (total_beats * 2) * BEAT * 1.15 + 5
    box = np.zeros(int(duration * RATE))
    keys = np.zeros(int(duration * RATE))
    score = []
    clock = 0.35

    for verse in range(2):
        beat = 0.0
        for index, (note, beats) in enumerate(MELODY):
            final_verse = verse == 1
            step = stretch(beat, total_beats) if final_verse else BEAT
            human = np.random.default_rng(index + verse * 100).normal(0, 0.006)
            accent = 1.0 if beat % 3 == 1 else 0.86
            add(box, max(clock + human, 0), music_box(note, level=0.46 * accent))
            score.append({"time": round(clock, 3), "note": note, "verse": verse + 1})

            if final_verse:
                # Beat 0 is the pick-up; bars start at beat 1.
                for whole in np.arange(np.ceil(beat), beat + beats - 1e-6):
                    position = int(whole) - 1
                    if position < 0 or position >= len(HARMONY):
                        continue
                    offset = (whole - beat) * step
                    bass, chord = HARMONY[position]
                    if position % 3 == 0:
                        add(keys, clock + offset, felt(bass, level=0.34))
                    else:
                        for voice, chord_note in enumerate(chord):
                            add(keys, clock + offset + voice * 0.012, felt(chord_note, level=0.13))
            clock += beats * step
            beat += beats
        clock += BEAT * 0.5 if verse == 0 else 0

    # A last little rolled chord to settle on.
    for voice, note in enumerate((55, 62, 67, 71, 74, 79)):
        add(box, clock + voice * 0.09, music_box(note, length=3.6, level=0.26))
    end = clock + 4.2

    left = box * 1.0 + keys * 0.85
    right = box * 0.82 + keys * 1.0
    stereo = np.stack([left, right], 1)[: int(end * RATE)]
    return reverb(stereo), score


def reverb(dry):
    """Convolve with a short decaying noise tail: a small warm room."""
    rng = np.random.default_rng(5)
    length = int(1.7 * RATE)
    t = np.arange(length) / RATE
    wet = np.empty_like(dry)
    for channel in range(2):
        tail = rng.normal(0, 1, length) * np.exp(-4.2 * t)
        tail = np.convolve(tail, np.ones(14) / 14, mode="same")  # roll off the highs
        size = len(dry) + length
        spectrum = np.fft.rfft(dry[:, channel], size) * np.fft.rfft(tail, size)
        wet[:, channel] = np.fft.irfft(spectrum, size)[: len(dry)]
    wet /= np.abs(wet).max()
    mixed = dry / np.abs(dry).max() + wet * 0.3
    # Fade the very end, normalise to a gentle peak.
    fade = np.ones(len(mixed))
    fade[-int(1.2 * RATE) :] = np.linspace(1, 0, int(1.2 * RATE)) ** 1.5
    mixed *= fade[:, None]
    return mixed / np.abs(mixed).max() * 0.82


def main(path):
    audio, score = perform()
    pcm = (audio * 32767).astype(np.int16)
    with wave.open(path, "wb") as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(pcm.tobytes())
    with open(path + ".score.json", "w") as out:
        json.dump(score, out)
    print(f"{len(audio) / RATE:.1f}s, {len(score)} melody notes -> {path}")


main(sys.argv[1])
