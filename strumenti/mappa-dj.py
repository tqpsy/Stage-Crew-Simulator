"""Mappa ritmica dello show del DJ set (prototipi/spettacolo-dj.html).

Legge il brano, trova la griglia dei battiti, separa la voce del vocalist e
scrive prototipi/dj-set-mappa.js: sezioni, frasi della voce, apertura della
bocca di Musa e le note-luce da suonare (stile Guitar Hero).

Uso:
  pip install numpy librosa soundfile onnxruntime torch
  curl -L -o voc.onnx https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR-MDX-NET-Voc_FT.onnx
  python3 strumenti/mappa-dj.py audio/notte-fuori-controllo.mp3 voc.onnx

Le sezioni sono scritte a mano (SEZIONI), come si fa con le mappe di Guitar
Hero: il programma stampa per ogni battuta l'energia della cassa e la voce,
che servono a sceglierle. Le note si mettono da sole a partire da sezioni e
voce, con le regole descritte in docs/spettacolo-dj.md.
"""
import json, sys
import numpy as np, librosa

BRANO = sys.argv[1] if len(sys.argv) > 1 else 'audio/notte-fuori-controllo.mp3'
MODELLO = sys.argv[2] if len(sys.argv) > 2 else 'voc.onnx'
USCITA = 'prototipi/dj-set-mappa.js'

# battute (da 0), comprese: INTRO, GROOVE, BREAK, BUILD (sale verso il drop),
# DROP (si salta), OUTRO
SEZIONI = [
    (0, 7, 'INTRO'), (8, 14, 'GROOVE'), (15, 28, 'BREAK'), (29, 31, 'BUILD'),
    (32, 36, 'DROP'), (37, 39, 'BUILD'), (40, 46, 'DROP'), (47, 47, 'BUILD'),
    (48, 51, 'DROP'), (52, 60, 'GROOVE'), (61, 63, 'BUILD'), (64, 71, 'DROP'),
    (72, 75, 'BUILD'), (76, 82, 'DROP'), (83, 84, 'OUTRO'),
]
SX, DX, VOCE, STROBO = 0, 1, 2, 3


def griglia(y, sr):
    """bpm e primo battito: la griglia fissa che somiglia di più agli attacchi"""
    hop = 128
    oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    t = librosa.times_like(oenv, sr=sr, hop_length=hop)
    tempo = float(np.atleast_1d(librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=hop)[0])[0])
    best = (0, tempo, 0)
    for bpm in np.arange(round(tempo) - 1.5, round(tempo) + 1.5, 0.01):
        p = 60 / bpm
        for o in np.arange(0, p, 0.002):
            s = np.interp(np.arange(o, t[-1], p), t, oenv).mean()
            if s > best[0]:
                best = (s, bpm, o)
    # il primo battito trovato cade sul primo tempo della battuta: per questo
    # brano i salti di energia delle sezioni arrivano ogni 4 battiti da lì
    return round(best[1], 1), round(float(best[2]), 3)


def separa_voce(path, modello):
    """UVR-MDX-NET-Voc_FT: restituisce la voce (mono, 44,1 kHz)"""
    import torch, onnxruntime as ort
    sr = 44100
    n_fft, hop, dim_f, dim_t = 7680, 1024, 3072, 256
    chunk = hop * (dim_t - 1)
    trim = n_fft // 2
    gen = chunk - 2 * trim
    sess = ort.InferenceSession(modello)
    mix, _ = librosa.load(path, sr=sr, mono=False)
    n = mix.shape[1]
    x = np.concatenate([np.zeros((2, trim)), mix, np.zeros((2, gen - n % gen + trim))], 1).astype(np.float32)
    win = torch.hann_window(n_fft, periodic=True)
    bins = n_fft // 2 + 1
    out = []
    for i in range(0, x.shape[1] - 2 * trim, gen):
        w = torch.tensor(x[:, i:i + chunk])
        s = torch.view_as_real(torch.stft(w, n_fft, hop, window=win, center=True, return_complex=True))
        s = s.permute(0, 3, 1, 2).reshape(1, 4, bins, dim_t)[:, :, :dim_f]
        o = torch.tensor(sess.run(None, {'input': s.numpy()})[0])
        o = torch.cat([o, torch.zeros(1, 4, bins - dim_f, dim_t)], 2).reshape(2, 2, bins, dim_t).permute(0, 2, 3, 1).contiguous()
        wav = torch.istft(torch.view_as_complex(o), n_fft, hop, window=win, center=True).numpy()
        out.append(wav[:, trim:-trim])
    v = np.concatenate(out, 1)[:, :n] * 1.021
    return v.mean(0), sr


def frasi_voce(v, sr, beat, t0):
    """frasi del vocalist in secondi, e la bocca: 25 valori al secondo da 0 a 9"""
    hop = int(sr / 100)
    rms = librosa.feature.rms(y=v, frame_length=2048, hop_length=hop)[0]
    db = 20 * np.log10(rms + 1e-6)
    t = librosa.times_like(rms, sr=sr, hop_length=hop)
    on = db > -34
    frasi, a = [], None
    for i, x in enumerate(on):
        if x and a is None:
            a = t[i]
        if not x and a is not None:
            frasi.append([a, t[i]]); a = None
    if a is not None:
        frasi.append([a, t[-1]])
    # unisce le pause brevi (meno di 3/4 di battito), toglie i colpi isolati
    uniti = []
    for f in frasi:
        if uniti and f[0] - uniti[-1][1] < beat * 0.75:
            uniti[-1][1] = f[1]
        else:
            uniti.append(f)
    uniti = [f for f in uniti if f[1] - f[0] >= beat * 0.35]
    step = int(100 / 25)
    livelli = np.clip((db[::step] + 42) / 22, 0, 1)
    bocca = ''.join(str(int(round(x * 9))) for x in livelli)
    return [[round(a, 2), round(b, 2)] for a, b in uniti], bocca, db, t


def sezione(bar):
    for a, b, k in SEZIONI:
        if a <= bar <= b:
            return k, a, b
    return 'OUTRO', bar, bar


def note_luce(frasi, beat, t0, n_bar):
    """[battito, corsia, durata in battiti, anche in FACILE (1) o solo NORMALE (0)]"""
    q = lambda s: round((s - t0) / beat * 4) / 4        # secondi -> battiti, al sedicesimo
    note = []
    voce = [(q(a), max(q(b), q(a) + 0.5)) for a, b in frasi]
    canta = lambda b: any(a - 0.01 <= b < e for a, e in voce)
    for a, e in voce:
        note.append([a, VOCE, e - a if e - a >= 1 else 0, 1])
    for bar in range(n_bar):
        k, s0, s1 = sezione(bar)
        b0 = bar * 4
        if k == 'INTRO':
            if bar % 2 == 0:
                note.append([b0, SX if bar % 4 == 0 else DX, 0, 1])
        elif k == 'BREAK':
            note.append([b0, SX if bar % 2 == 0 else DX, 0, 1])
            if not canta(b0 + 2):
                note.append([b0 + 2, DX if bar % 2 == 0 else SX, 0, 0])
        elif k == 'GROOVE':
            for i in range(4):
                note.append([b0 + i, SX if i % 2 == 0 else DX, 0, 1 if i % 2 == 0 else 0])
        elif k == 'BUILD':
            if bar == s0:
                # lo strobo tenuto fino all'ultimo battito prima del drop: quello è buio
                note.append([b0, STROBO, (s1 + 1) * 4 - 1 - b0, 1])
            for i in (0, 2) if bar < s1 else (0, 1, 2):
                if not canta(b0 + i):
                    note.append([b0 + i, SX if i % 4 == 0 else DX, 0, 1 if i == 0 else 0])
        elif k == 'DROP':
            j = bar - s0
            for i in range(4):
                b = b0 + i
                if i == 0 and j == 0:
                    note.append([b, STROBO, 0, 1])                 # il drop: flash
                elif i == 0 and j % 4 == 0:
                    note.append([b, STROBO, 0, 1])
                elif i == 0:
                    note.append([b, SX, 0, 1])
                    if not canta(b):
                        note.append([b, DX, 0, 0])                 # accordo: i due lati insieme
                else:
                    note.append([b, DX if i % 2 else SX, 0, 1 if i == 2 else 0])
        elif k == 'OUTRO':
            if bar == s1:
                note.append([b0, SX, 0, 1]); note.append([b0, DX, 0, 1])
            else:
                note.append([b0, SX, 0, 1]); note.append([b0 + 2, DX, 0, 0])
    # un tocco singolo sopra una nota tenuta della stessa corsia non si può suonare
    tenute = [(n[0], n[0] + n[2], n[1]) for n in note if n[2] > 0]
    note = [n for n in note if n[2] > 0 or not any(a < n[0] <= e and c == n[1] for a, e, c in tenute)]
    note.sort(key=lambda n: (n[0], n[1]))
    return note


def main():
    y, sr = librosa.load(BRANO, sr=22050, mono=True)
    durata = round(len(y) / sr, 2)
    bpm, t0 = griglia(y, sr)
    beat = 60 / bpm
    n_bar = SEZIONI[-1][1] + 1
    v, vsr = separa_voce(BRANO, MODELLO)
    frasi, bocca, db, t = frasi_voce(v, vsr, beat, t0)
    print(f'{bpm} bpm, primo battito {t0} s, {n_bar} battute, {len(frasi)} frasi della voce')
    for bar in range(n_bar):
        a = t0 + bar * 4 * beat
        m = (t >= a) & (t < a + 4 * beat)
        print(f'battuta {bar:2d} {a:6.2f} s  {sezione(bar)[0]:6s} voce {db[m].mean() if m.any() else -99:6.1f} dB')
    note = note_luce(frasi, beat, t0, n_bar)
    dati = {
        'brano': 'Notte fuori controllo', 'file': '../audio/notte-fuori-controllo.mp3',
        'bpm': bpm, 't0': t0, 'durata': durata, 'battute': n_bar,
        'sezioni': [[a, b, k] for a, b, k in SEZIONI],
        'voce': frasi, 'bocca': bocca, 'note': note,
    }
    with open(USCITA, 'w') as f:
        f.write('/* Generato da strumenti/mappa-dj.py: non modificare a mano. */\n')
        f.write('window.DJ_MAPPA = ' + json.dumps(dati, separators=(',', ':')) + ';\n')
    print(f'{len(note)} note -> {USCITA}')


if __name__ == '__main__':
    main()
