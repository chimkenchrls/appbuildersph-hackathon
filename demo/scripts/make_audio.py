"""Generates the film's soundtrack and sound effects from scratch, so nothing is licensed or downloaded.

    python3 scripts/make_audio.py        (needs NumPy and SciPy; ffmpeg converts the results to .m4a)

Writes public/audio/music.m4a (68 seconds, cut to the voiceover's scenes) and one file per sound effect.
"""
import subprocess
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, lfilter

SR = 44100
OUT = Path(__file__).resolve().parent.parent / "public" / "audio"
rng = np.random.default_rng(7)

BPM = 96
BEAT = 60 / BPM          # 0.625 s
BAR = 4 * BEAT
TOTAL = 68.0


def t(seconds):
    return np.arange(int(seconds * SR)) / SR


def hz(note):
    """MIDI note number to frequency."""
    return 440.0 * 2 ** ((note - 69) / 12)


def lowpass(x, cutoff, order=2):
    b, a = butter(order, min(cutoff, SR / 2 - 100) / (SR / 2), "low")
    return lfilter(b, a, x)


def highpass(x, cutoff, order=2):
    b, a = butter(order, cutoff / (SR / 2), "high")
    return lfilter(b, a, x)


def env(n, attack, release, sustain=1.0):
    e = np.full(n, sustain)
    a, r = int(attack * SR), int(release * SR)
    a, r = min(a, n), min(r, n)
    if a:
        e[:a] = np.linspace(0, sustain, a)
    if r:
        e[-r:] *= np.linspace(1, 0, r)
    return e


def pad(notes, seconds, bright=1.0):
    """Soft chord: a few detuned partials per note with a slow swell."""
    x = t(seconds)
    out = np.zeros_like(x)
    for note in notes:
        f = hz(note)
        for detune in (-0.004, 0.0, 0.005):
            for k, amp in ((1, 1.0), (2, 0.32 * bright), (3, 0.16 * bright), (4, 0.07 * bright)):
                out += amp * np.sin(2 * np.pi * f * k * (1 + detune) * x + rng.uniform(0, 6.28))
    out *= env(len(x), min(1.2, seconds * 0.35), min(1.4, seconds * 0.4))
    return out / (len(notes) * 3)


def pluck(note, seconds=0.5, bright=1.0):
    x = t(seconds)
    f = hz(note)
    tone = np.sin(2 * np.pi * f * x) + 0.4 * bright * np.sin(2 * np.pi * 2 * f * x) + 0.15 * bright * np.sin(2 * np.pi * 3 * f * x)
    return tone * np.exp(-x * 7) * env(len(x), 0.004, 0.05)


def bass(note, seconds):
    x = t(seconds)
    f = hz(note)
    tone = np.sin(2 * np.pi * f * x) + 0.25 * np.sin(2 * np.pi * 2 * f * x)
    return np.tanh(1.6 * tone) * env(len(x), 0.01, 0.08) * np.exp(-x * 1.5)


def kick():
    x = t(0.28)
    freq = 46 + 90 * np.exp(-x * 34)
    return np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-x * 13)


def hat(seconds=0.05):
    x = t(seconds)
    return highpass(rng.standard_normal(len(x)), 7000) * np.exp(-x * 90)


def tick(pitch=2100.0):
    x = t(0.045)
    return (np.sin(2 * np.pi * pitch * x) + 0.5 * highpass(rng.standard_normal(len(x)), 3000)) * np.exp(-x * 120)


def place(track, sound, at, gain=1.0, pan=0.0):
    """Mix a mono sound into the stereo track at a time in seconds."""
    start = int(at * SR)
    if start >= track.shape[0] or start < 0:
        return
    sound = sound[: track.shape[0] - start]
    left, right = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
    track[start:start + len(sound), 0] += sound * gain * left
    track[start:start + len(sound), 1] += sound * gain * right


def reverb(x, seconds=2.2, wet=0.3):
    n = int(seconds * SR)
    out = np.zeros_like(x)
    for ch in range(2):
        tail = rng.standard_normal(n) * np.exp(-np.arange(n) / (seconds * SR / 5.5))
        tail = lowpass(tail, 5200)
        out[:, ch] = fftconvolve(x[:, ch], tail)[: len(x)]
    out /= np.max(np.abs(out)) + 1e-9
    return x + wet * out * np.max(np.abs(x))


# Scene boundaries in seconds, from the voiceover: hook, problem, cost, reveal, solution, close, end card.
SCENES = [0.0, 12.4, 21.9, 30.3, 41.2, 52.7, 59.0, TOTAL]


def music():
    track = np.zeros((int(TOTAL * SR), 2))

    # D minor while things go wrong; F major from the reveal.
    Dm9, Bb, Gm, Asus, A7 = (50, 57, 60, 64, 65), (46, 53, 58, 62, 65), (43, 50, 55, 58, 62), (45, 52, 57, 62, 64), (45, 52, 55, 61, 64)
    F, C, Dm, Bbmaj, Fadd9 = (53, 60, 65, 69, 72), (48, 55, 60, 64, 67), (50, 57, 62, 65, 69), (46, 53, 58, 62, 65), (41, 53, 60, 65, 67, 69)
    chords = {1: [Dm9, Dm9, Bb], 2: [Dm9, Bb, Gm], 3: [Gm, Asus, A7], 4: [F, C, Dm, Bbmaj], 5: [Bbmaj, F, C, Dm], 6: [Bbmaj, C], 7: [Fadd9]}
    level = {1: 0.5, 2: 0.6, 3: 0.62, 4: 0.8, 5: 0.75, 6: 0.8, 7: 0.85}

    def scene_at(when):
        for n in range(len(SCENES) - 1):
            if SCENES[n] <= when < SCENES[n + 1]:
                return n + 1
        return 7

    def chord_at(when):
        n = scene_at(when)
        start, end = SCENES[n - 1], SCENES[n]
        options = chords[n]
        index = min(len(options) - 1, int((when - start) / ((end - start) / len(options))))
        return options[index], n

    # Pads: each scene's chords share its length equally, so every change lands on a scene boundary.
    for n in range(1, 8):
        start, end = SCENES[n - 1], SCENES[n]
        options = chords[n]
        span = (end - start) / len(options)
        for k, chord in enumerate(options):
            at = start + k * span
            length = span + 0.6
            if n == 3 and k == len(options) - 1:
                length = span - 0.7  # a breath of near-silence before the reveal
            if n == 7:
                length = end - at
            place(track, pad(chord, length, bright=0.6 if n <= 3 else 1.0), at, level[n] * 0.5)
            place(track, pad([chord[0] - 12], length, bright=0.3), at, level[n] * 0.35)

    # Scene 1: a few lone notes over the pad.
    for when, note in ((2.5, 74), (6.2, 77), (9.4, 72), (11.2, 69)):
        place(track, pluck(note, 0.9, 0.5), when, 0.16, pan=0.3)

    # Rhythm on one steady beat grid; what plays on each beat depends on the scene it falls in.
    order = [0, 2, 1, 3, 2, 4, 3, 1]
    beats = int(TOTAL / BEAT)
    for b in range(beats):
        when = b * BEAT
        chord, n = chord_at(when)
        into = (when - SCENES[n - 1]) / (SCENES[n] - SCENES[n - 1])
        for half in (0, 1):
            step = 2 * b + half
            at = when + half * BEAT / 2
            arp_note = chord[order[step % 8] % len(chord)]
            pan = 0.5 * np.sin(step * 1.7)
            if n == 2:
                place(track, pluck(arp_note + 12, 0.45, 0.8), at, 0.1 + 0.03 * into, pan=pan)
            elif n == 3 and at < SCENES[3] - 1.5:
                place(track, pluck(arp_note + 24, 0.45, 1.1), at, 0.12, pan=pan)
                place(track, bass(chord[0] - 12, BEAT * 0.45), at, 0.2)
                place(track, hat(), at, 0.03, pan=-0.3)
            elif n == 4 and (half == 0 or into > 0.3):
                place(track, pluck(arp_note + 12, 0.45, 0.9), at, 0.12, pan=pan)
            elif n == 5:
                place(track, pluck(arp_note + 12, 0.45, 1.0), at, 0.13, pan=pan)
            elif n == 6 and half == 0:
                place(track, pluck(arp_note + 12, 0.45, 0.8), at, 0.11, pan=pan)
        if n == 2:
            place(track, bass(chord[0] - 12, BEAT * 0.9), when, 0.2)
            if into > 0.3:
                place(track, hat(), when + BEAT / 2, 0.035, pan=0.4)
        elif n == 3 and when < SCENES[3] - 1.5:
            place(track, tick(2100 if b % 2 == 0 else 1750), when, 0.16)
            place(track, kick(), when, 0.3)
        elif n == 4:
            if into > 0.12:
                place(track, kick(), when, 0.3)
            if b % 2 == 0:
                place(track, bass(chord[0] - 12, BEAT * 0.9), when, 0.16)
        elif n == 5:
            place(track, kick(), when, 0.32)
            place(track, hat(), when + BEAT / 2, 0.04, pan=0.4)
            place(track, bass(chord[0] - 12, BEAT * 0.9), when, 0.17)
        elif n == 6 and b % 2 == 0:
            place(track, kick(), when, 0.22)
            place(track, bass(chord[0] - 12, BEAT * 1.6), when, 0.16)

    # The clock slows as Kwagi holds it: ticks spread out, then stop, just before the reveal.
    when, gap = SCENES[3] - 1.5, BEAT * 0.7
    while when < SCENES[3] - 0.2:
        place(track, tick(1750), when, 0.14)
        gap *= 1.45
        when += gap

    # The brand chord: a slow upward spread as the logo lands.
    for i, note in enumerate((65, 69, 72, 77, 81)):
        place(track, pluck(note, 2.4, 0.7), SCENES[6] + i * 0.16, 0.16, pan=0.2 * (i - 2))

    track = reverb(track, 2.4, 0.32)
    track[:, 0] = lowpass(track[:, 0], 9000)
    track[:, 1] = lowpass(track[:, 1], 9000)
    # Overall shape: fade in, dip just before the reveal, fade out at the very end.
    x = np.arange(len(track)) / SR
    shape = np.minimum(1, x / 2.0) * np.minimum(1, (TOTAL - x) / 2.5)
    shape *= 1 - 0.7 * np.exp(-((x - (SCENES[3] - 0.25)) ** 2) / 0.1)
    track *= shape[:, None]
    return track / (np.max(np.abs(track)) + 1e-9) * 0.82


def sfx():
    out = {}

    x = t(0.16)  # a message arriving
    out["pop"] = np.sin(2 * np.pi * (520 + 520 * np.exp(-x * 40)) * x) * np.exp(-x * 28)

    x = t(0.5)  # notification: two soft notes
    note = lambda f, at: np.where(x >= at, np.sin(2 * np.pi * f * (x - at)) * np.exp(-(x - at) * 11), 0)
    out["notify"] = 0.9 * note(880, 0) + 0.8 * note(1174.7, 0.11)

    x = t(0.06)  # a tap on glass
    out["tap"] = (np.sin(2 * np.pi * 1500 * x) + 0.6 * highpass(rng.standard_normal(len(x)), 2500)) * np.exp(-x * 110)

    x = t(0.9)  # movement
    sweep = lowpass(rng.standard_normal(len(x)), 1800) * np.sin(np.pi * x / 0.9) ** 2
    out["whoosh"] = highpass(sweep, 250) * (0.6 + 0.4 * np.sin(2 * np.pi * 1.2 * x))

    x = t(2.4)  # rising tension into a morph
    rise = np.sin(2 * np.pi * np.cumsum(180 + 620 * (x / 2.4) ** 2) / SR) * 0.4 + lowpass(rng.standard_normal(len(x)), 3000) * 0.5
    out["riser"] = rise * (x / 2.4) ** 2 * env(len(x), 0.05, 0.08)

    x = t(1.6)  # confirmation chime
    out["chime"] = sum(a * np.sin(2 * np.pi * f * x) * np.exp(-x * d) for f, a, d in ((1046.5, 1, 3.2), (1318.5, 0.7, 3.6), (1568, 0.5, 4.2), (2093, 0.25, 5)))

    x = t(0.5)  # a flagged finding: lower, questioning
    out["flag"] = sum(a * np.sin(2 * np.pi * f * x) * np.exp(-x * 8) for f, a in ((587.3, 1), (698.5, 0.7)))

    x = t(2.8)  # brand mark settling
    out["logo"] = sum(a * np.sin(2 * np.pi * f * x) * np.exp(-x * d) * np.minimum(1, x / 0.02)
                      for f, a, d in ((174.6, 1.0, 1.1), (349.2, 0.8, 1.4), (523.3, 0.6, 1.8), (698.5, 0.5, 2.0), (1046.5, 0.3, 2.6)))

    # Kwagi's call, "ka-hoot": a short consonant, then a round falling hoot with a second, softer one.
    def hoot(seconds, start, end, gain):
        y = t(seconds)
        freq = start + (end - start) * (y / seconds) + 5 * np.sin(2 * np.pi * 6 * y)
        phase = 2 * np.pi * np.cumsum(freq) / SR
        tone = np.sin(phase) + 0.28 * np.sin(2 * phase) + 0.08 * np.sin(3 * phase)
        breath = lowpass(rng.standard_normal(len(y)), 900) * 0.06
        return (tone + breath) * np.sin(np.pi * np.minimum(1, y / seconds)) ** 0.7 * gain

    ka = t(0.07)
    call = np.zeros(int(1.1 * SR))
    click = (highpass(rng.standard_normal(len(ka)), 1800) * 0.5 + np.sin(2 * np.pi * 760 * ka)) * np.exp(-ka * 60)
    call[: len(click)] += click * 0.7
    for sound, at in ((hoot(0.36, 470, 400, 1.0), 0.1), (hoot(0.42, 420, 372, 0.8), 0.56)):
        start = int(at * SR)
        call[start:start + len(sound)] += sound
    out["hoot"] = lowpass(call, 2600)
    return out


def write(name, data):
    data = np.asarray(data, dtype=np.float64)
    if data.ndim == 1:
        data = np.stack([data, data], axis=1)
        data = reverb(np.concatenate([data, np.zeros((int(0.8 * SR), 2))]), 1.0, 0.12)
        data = data / (np.max(np.abs(data)) + 1e-9) * 0.85
    pcm = (np.clip(data, -1, 1) * 32767).astype("<i2").tobytes()
    target = OUT / f"{name}.m4a"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-",
                    "-c:a", "aac", "-b:a", "192k", str(target)], input=pcm, check=True)
    print(f"{target.name}: {len(data) / SR:.2f}s")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    write("music", music())
    for name, data in sfx().items():
        write(name, data)
