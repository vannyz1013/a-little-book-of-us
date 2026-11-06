"""Synthesise the soft opening theme that plays before the birthday song.

An original composition (no existing melody or recording): slow G-major
harmony on a hushed string pad, a felt piano rolling gentle broken chords,
and a few celesta notes drifting above. It loops, so it begins and ends on a
quiet breath; the browser's small gap at the loop point falls in that hush.

    python tools/song/make_ambient.py out.wav
    node tools/song/encode_mp3.mjs out.wav public/audio/ambient-garden.mp3 96
"""
import sys
import wave

import numpy as np

RATE = 44100
BEAT = 60 / 63  # a slow, unhurried pulse
BAR = 4 * BEAT

# Two bars per chord: (bass, [pad voices]).
CHORDS = {
    "Gmaj7": (43, [59, 62, 66, 71]),
    "Em9": (40, [59, 62, 66, 67]),
    "Cmaj7": (36, [55, 59, 64, 67]),
    "Dsus": (38, [57, 62, 67, 69]),
    "Bm7": (35, [57, 62, 66, 69]),
    "Am9": (45, [55, 59, 60, 64]),
    "D6": (38, [57, 59, 62, 66]),
}
PROGRESSION = [
    "Gmaj7", "Em9", "Cmaj7", "Dsus",
    "Bm7", "Em9", "Am9", "D6",
    "Gmaj7", "Em9", "Cmaj7", "Dsus",
    "Bm7", "Em9", "Cmaj7", "Gmaj7",
]

# Celesta: (beat within the 8-beat chord span, MIDI note). Chord tones only,
# placed sparsely so the line floats rather than sings a tune.
CELESTA = {
    0: [(1, 83), (3.5, 78), (6, 79)],
    1: [(2, 79), (5, 74), (6.5, 76)],
    2: [(1, 76), (3, 79), (6, 83)],
    3: [(2.5, 81), (5.5, 79)],
    4: [(1, 78), (3, 81), (5.5, 74)],
    5: [(2, 79), (4.5, 83), (6.5, 78)],
    6: [(1, 79), (3.5, 76), (6, 72)],
    7: [(2, 74), (4, 78), (6, 81)],
    8: [(1, 86), (3, 83), (5.5, 78)],
    9: [(2, 79), (5, 83)],
    10: [(1.5, 76), (4, 79), (6.5, 84)],
    11: [(2, 81), (4.5, 79), (6, 74)],
    12: [(1, 78), (3.5, 74), (6, 69)],
    13: [(2, 71), (5, 74)],
    14: [(1, 72), (4, 76)],
    15: [(2, 79), (5, 74)],
}


def hz(note):
    return 440.0 * 2 ** ((note - 69) / 12)


def envelope(t, attack, release_at, release):
    rise = np.clip(t / attack, 0, 1) ** 2
    fall = np.clip(1 - (t - release_at) / release, 0, 1) ** 1.5
    return rise * np.where(t < release_at, 1, fall)


def pad(note, length, level, rng):
    """Hushed strings: slightly detuned voices, slow bow, a little vibrato."""
    total = length + 3.0
    t = np.arange(int(total * RATE)) / RATE
    f = hz(note)
    vib = 1 + 0.0025 * np.sin(2 * np.pi * (4.6 + rng.uniform(-0.3, 0.3)) * t + rng.uniform(0, 6.28))
    tone = np.zeros_like(t)
    for detune in (-0.0035, 0.0, 0.004):
        phase = 2 * np.pi * np.cumsum(f * (1 + detune) * vib) / RATE
        tone += np.sin(phase) + 0.18 * np.sin(2 * phase) + 0.06 * np.sin(3 * phase)
    return tone / 3 * envelope(t, 1.8, length, 2.6) * level


def felt(note, level):
    """A soft felted piano key."""
    t = np.arange(int(4.5 * RATE)) / RATE
    f = hz(note)
    tone = sum(
        amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-decay * t)
        for ratio, amp, decay in ((1, 1.0, 0.9), (2, 0.28, 1.7), (3, 0.07, 2.9))
    )
    return tone * np.minimum(t / 0.025, 1) * level


def celesta(note, level):
    """Bell-like celesta: a bright strike that melts away."""
    t = np.arange(int(4.0 * RATE)) / RATE
    f = hz(note)
    tone = np.zeros_like(t)
    for ratio, amp, decay in ((1, 1.0, 1.4), (2.0, 0.22, 2.8), (4.0, 0.07, 5.0), (6.27, 0.025, 9.0)):
        tone += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-decay * t)
    return tone * np.minimum(t / 0.006, 1) * level


def add(track, start, sound):
    begin = int(start * RATE)
    end = min(begin + len(sound), len(track))
    track[begin:end] += sound[: end - begin]


def perform():
    span = 2 * BAR
    lead_in = 0.4
    length = lead_in + span * len(PROGRESSION) + 4.0
    size = int(length * RATE)
    strings, keys, bells = (np.zeros((size, 2)) for _ in range(3))
    rng = np.random.default_rng(11)

    def place(track, start, sound, pan):
        left, right = np.cos(pan * np.pi / 2), np.sin(pan * np.pi / 2)
        add(track[:, 0], start, sound * left * 1.4)
        add(track[:, 1], start, sound * right * 1.4)

    for index, name in enumerate(PROGRESSION):
        start = lead_in + index * span
        bass, voices = CHORDS[name]
        last = index == len(PROGRESSION) - 1
        hold = span + (1.5 if last else 0.35)
        place(strings, start, pad(bass + 12, hold, 0.16, rng), 0.45)
        for voice, note in enumerate(voices):
            place(strings, start + voice * 0.05, pad(note, hold, 0.075, rng), 0.25 + voice * 0.17)

        # Felt piano: a low note, then a slow broken chord rising and settling.
        pattern = [(0, bass + 12, 0.26), (1, voices[0], 0.13), (2, voices[2], 0.12), (3, voices[3], 0.11),
                   (4.5, voices[1], 0.12), (5.5, voices[2], 0.1), (6.5, voices[0], 0.1)]
        if last:
            pattern = [(0, bass + 12, 0.26), (1, voices[0], 0.13), (2, voices[2], 0.12), (3, voices[3], 0.11)]
        for beat, note, level in pattern:
            human = rng.normal(0, 0.012)
            place(keys, start + beat * BEAT + human, felt(note, level), 0.35 + (note - 55) * 0.008)

        for beat, note in CELESTA[index]:
            if last and beat > 4:
                continue
            place(bells, start + beat * BEAT + rng.normal(0, 0.01), celesta(note, 0.085), 0.62)

    mix = strings * 0.9 + keys * 1.0 + bells * 0.8
    mix = reverb(mix)
    # A quiet breath in and out, so the loop point is a hush rather than a cut.
    fade_in = int(1.6 * RATE)
    mix[:fade_in] *= (np.linspace(0, 1, fade_in) ** 2)[:, None]
    fade_out = int(4.0 * RATE)
    mix[-fade_out:] *= (np.linspace(1, 0, fade_out) ** 1.6)[:, None]
    return mix / np.abs(mix).max() * 0.6


def reverb(dry):
    """A soft hall: long, dark decaying noise tail."""
    rng = np.random.default_rng(7)
    length = int(3.2 * RATE)
    t = np.arange(length) / RATE
    wet = np.empty_like(dry)
    for channel in range(2):
        tail = rng.normal(0, 1, length) * np.exp(-2.1 * t)
        tail = np.convolve(tail, np.ones(24) / 24, mode="same")
        size = len(dry) + length
        spectrum = np.fft.rfft(dry[:, channel], size) * np.fft.rfft(tail, size)
        wet[:, channel] = np.fft.irfft(spectrum, size)[: len(dry)]
    wet /= np.abs(wet).max()
    return dry / np.abs(dry).max() + wet * 0.55


def main(path):
    audio = perform()
    pcm = (audio * 32767).astype(np.int16)
    with wave.open(path, "wb") as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(pcm.tobytes())
    print(f"{len(audio) / RATE:.1f}s -> {path}")


main(sys.argv[1])
