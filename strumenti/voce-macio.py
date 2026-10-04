"""La voce di Macio per il karaoke (karaoke.html): una voce italiana maschile
sintetica (Piper it_IT-riccardo, via sherpa-onnx) dice ogni sillaba con
l'accento di Chieti, il vocoder WORLD la fa cantare ogni
sillaba sulla sua nota, lunga quanto la nota (un'ottava sotto la melodia,
intonata giusta, con vibrato; dove Macio si gasa canta più forte). Escono un mp3 con tutte le
sillabe una dopo l'altra e karaoke-voce.js con l'mp3 in base64 e dove sta
ogni sillaba.

Uso:  python3 strumenti/voce-macio.py canzone.json cartella-del-modello
  canzone.json: le note di karaoke.html (window.__karaoke.notes, beat,
  urla, scelte), vedi tests/karaoke.js per come aprire la pagina.
  cartella-del-modello: vits-piper-it_IT-riccardo-x_low scompattato, da
  github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/
Richiede: numpy, pyworld, sherpa-onnx, soundfile, ffmpeg."""
import base64, json, os, subprocess, sys, tempfile
import numpy as np, pyworld as pw, sherpa_onnx

song = json.load(open(sys.argv[1]))
mdir = sys.argv[2]
OUT_JS = os.path.join(os.path.dirname(__file__), '..', 'karaoke-voce.js')

# l'accento di Chieti, non il dialetto: dopo la «n» la «t» diventa «d»
# («quando», «cando»), la «c» dura diventa «g» («anghe») e la «s» diventa «z»
# («inzieme»); le vocali accentate aperte. Ogni verso come lo dice Macio.
ACCENTO = {
  'Gerry ha spento tutto quanto': 'Gèrry ha spèndo tutto quando',
  'la palestra aspetta un canto': 'la palèstra aspètta un cando',
  'passami il microfono!': 'pàssami il micròfono!',
  'Cantate insieme a me': 'Candate inzième a me',
  'anche se sono stonato': 'anghe se sono stonato',
  'stasera la star è me!': 'stasèra la star è me!',
  'stasera la star è meee!': 'stasèra la star è me!',
  # le parole sbagliate che il tecnico può scegliere quando Macio si dimentica
  'Gerry': 'Gèrry', 'il preside': 'il prèside', 'Macio': 'Màcio', 'panino': 'panìno',
  'ora canto la canzone': 'òra cando la canzone',
  'con la voce di un maiale': 'con la voce di un maiale',
}
# le frasi parlate (intro, sbagli, fine)
PARLATO = {
  'prova': 'Pròva... pròva... si sènde?',
  'scritta': "Questa l'ho scritta adèsso!",
  'testo': 'Tècnico, mandami il tèsto!',
  'ehm': 'Ehm...',
  'fiato': 'Mi è finito il fiato!',
  'grazie': 'Grazie a tutti, vajù!',
}

tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
  vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=os.path.join(mdir, 'it_IT-riccardo-x_low.onnx'),
    tokens=os.path.join(mdir, 'tokens.txt'), data_dir=os.path.join(mdir, 'espeak-ng-data')), num_threads=2)))

def say (text, speed=0.85):
  a = tts.generate(text, sid=0, speed=speed)
  return np.array(a.samples, dtype=np.float64), a.sample_rate

FP = 5.0   # millisecondi per frame di WORLD
SRATE = 16000
SMOOTH = 5      # frame di media per trovare i centri delle sillabe
SPEED = 0.85    # un po' più lento del parlato: le sillabe si separano meglio
MIND = 70       # millisecondi minimi fra due centri di sillaba
# (provati confrontando quello che capisce Whisper del canto col testo)

def analyze (x, sr):
  f0, t = pw.harvest(x, sr, f0_floor=60, f0_ceil=400, frame_period=FP)
  sp = pw.cheaptrick(x, f0, t, sr)
  ap = pw.d4c(x, f0, t, sr)
  return f0, sp, ap

def nuclei (sp, f0, n):
  """I centri delle sillabe: i picchi di energia nelle parti sonore, n in tutto."""
  # energia nella banda delle vocali (250-1500 Hz): i centri sono lì
  nb = sp.shape[1]
  lo, hi = int(250 / (SRATE / 2) * (nb - 1)), int(1500 / (SRATE / 2) * (nb - 1))
  e = np.log(sp[:, lo:hi].sum(axis=1) + 1e-12)
  e = np.convolve(e, np.ones(SMOOTH) / SMOOTH, mode='same')
  voiced = f0 > 0
  cand = [i for i in range(1, len(e) - 1) if voiced[i] and e[i] >= e[i - 1] and e[i] >= e[i + 1]]
  cand.sort(key=lambda i: -e[i])
  picked = []
  mind = int(MIND / FP)
  for i in cand:
    if all(abs(i - j) >= mind for j in picked): picked.append(i)
    if len(picked) == n: break
  picked.sort()
  if len(picked) < n:            # troppo pochi: si divide in parti uguali
    vi = np.where(voiced)[0]
    a, b = (vi[0], vi[-1]) if len(vi) else (0, len(e) - 1)
    picked = list(np.linspace(a, b, n + 2)[1:-1].astype(int))
  # confini: il minimo di energia fra due centri
  bounds = [0]
  for a, b in zip(picked, picked[1:]):
    bounds.append(a + int(np.argmin(e[a:b + 1])))
  bounds.append(len(e))
  return bounds, picked

def sing (f0, sp, ap, a, b, peak, midi, dur, sr):
  """La sillaba [a, b) cantata su midi per dur secondi: l'attacco (le
  consonanti fino al centro) resta com'è, la vocale si allunga."""
  nfr = max(int(dur * 1000 / FP), 4)
  onset = max(1, min(peak - a, int((b - a) * 0.5), nfr // 3))
  rest = (b - a) - onset
  idx = list(range(a, a + onset))
  if rest > 0:
    idx += list(a + onset + np.minimum(rest - 1, (np.arange(nfr - onset) * rest / max(1, nfr - onset)).astype(int)))
  idx = np.array(idx[:nfr])
  # la coda finale: si tiene la vocale, non le consonanti che seguono
  voiced = f0[idx] > 0
  hz = 440 * 2 ** ((midi - 69) / 12)
  tt = np.arange(len(idx)) * FP / 1000
  vib = 1 + 0.012 * np.sin(2 * np.pi * 5.3 * tt) * np.clip((tt - 0.25) / 0.3, 0, 1)
  nf0 = np.where(voiced, hz * vib, 0.0)
  y = pw.synthesize(np.ascontiguousarray(nf0), np.ascontiguousarray(sp[idx]), np.ascontiguousarray(ap[idx]), sr, FP)
  fade = min(len(y), int(sr * 0.03))
  y[-fade:] *= np.linspace(1, 0, fade)
  y[:int(sr * 0.004)] *= np.linspace(0, 1, int(sr * 0.004))
  return y

def forte_at (t):
  """Dove Macio si gasa e urla nel microfono: due volte più forte."""
  for a, b, *_ in song['urla']:
    if a * song['beat'] * 4 <= t < b * song['beat'] * 4: return 2.0
  return 1.0

clips, pieces, pos, SR = {}, [], 0, None
def add (key, y, sr, norm=True):
  """Un pezzo in fila agli altri. Le frasi parlate si normalizzano da sole;
  le sillabe cantate tutte insieme, così resta la differenza del forte."""
  global pos, SR
  SR = SR or sr
  if norm: y = y / max(1e-6, np.abs(y).max()) * 0.6
  clips[key] = [round(pos / sr, 4), round(len(y) / sr, 4)]
  pieces.append(y); pieces.append(np.zeros(int(sr * 0.05)))
  pos += len(y) + int(sr * 0.05)

def trim (x, sr):
  """Via il silenzio prima e dopo."""
  w = int(sr * 0.01)
  en = np.array([np.abs(x[i:i + w]).max() for i in range(0, len(x) - w, w)])
  on = np.where(en > en.max() * 0.06)[0]
  a, b = (on[0], on[-1] + 1) if len(on) else (0, len(en))
  return x[max(0, a * w - w):min(len(x), b * w + w)]

def word (text, midi, dur, sr0=None):
  """Una parola intera cantata su una nota sola (le parole da scegliere)."""
  x1, sr = say(ACCENTO.get(text, text), SPEED)
  x1 = trim(x1, sr)
  g0, gs, ga = analyze(x1, sr)
  vi = np.where(g0 > 0)[0]
  return sing(g0, gs, ga, 0, len(g0), int(vi[0]) + 2 if len(vi) else 0, midi - 12, dur, sr), sr

lines = {}
for n in song['notes']:
  if n.get('kind', 'testo') == 'testo': lines.setdefault(n['line'], []).append(n)
for li, ns in sorted(lines.items()):
  # il verso detto tutto di fila (suona naturale), poi diviso nelle sue sillabe
  text = ''.join(n['text'] for n in ns).strip()
  x, sr = say(ACCENTO.get(text, text), SPEED)
  f0, sp, ap = analyze(x, sr)
  bounds, peaks = nuclei(sp, f0, len(ns))
  for k, n in enumerate(ns):
    dur = n['len'] if n['hold'] else min(n['len'], song['beat'] * 0.9)
    if (f0[bounds[k]:bounds[k + 1]] > 0).sum() >= 8:
      y = sing(f0, sp, ap, bounds[k], bounds[k + 1], peaks[k], n['midi'] - 12, dur, sr)
    else:
      # il taglio ha preso solo consonanti: la sillaba si dice da sola
      x1 = trim(say(n['text'].strip(), SPEED)[0], sr)
      g0, gs, ga = analyze(x1, sr)
      vi = np.where(g0 > 0)[0]
      y = sing(g0, gs, ga, 0, len(g0), int(vi[0]) + 2 if len(vi) else 0, n['midi'] - 12, dur, sr)
    add(n['i'], y / max(1e-6, np.abs(y).max()) * 0.45 * forte_at(n['t']), sr, False)
  print('verso', li, text, '->', ACCENTO.get(text, text))
# le parole sbagliate (la giusta è già la sillaba del verso): sulla stessa nota
for li, words in song.get('scelte', []):
  n = lines[li][-1]
  dur = n['len'] if n['hold'] else min(n['len'], song['beat'] * 0.9)
  for k, w in enumerate(words):
    if k == 0: continue
    y, sr = word(w, n['midi'], max(dur, 0.25 * len(w.split())), sr)
    add(f'opt-{li}-{k}', y / max(1e-6, np.abs(y).max()) * 0.45 * forte_at(n['t']), sr, False)
  print('scelte', li, words)
# il richiamo del ponte: «Oh-oh!» sul primo e sul secondo tempo
b = song['beat']
y1, sr = word('Oh', 72, b * 0.8); y2, _ = word('Oh', 69, b * 0.9)
y = np.concatenate([y1, np.zeros(max(0, int(sr * b) - len(y1))), y2])
add('ohoh', y / max(1e-6, np.abs(y).max()) * 0.45 * 1.6, sr, False)
for k, text in PARLATO.items():
  x, sr = say(text, 0.95)
  add(k, x, sr)

audio = np.concatenate(pieces)
audio = audio / max(1e-6, np.abs(audio).max()) * 0.95
with tempfile.TemporaryDirectory() as d:
  import soundfile as sf
  wav, mp3 = os.path.join(d, 'v.wav'), os.path.join(d, 'v.mp3')
  sf.write(wav, audio, SR)
  subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-b:a', '40k', mp3], check=True)
  data = base64.b64encode(open(mp3, 'rb').read()).decode()
with open(OUT_JS, 'w') as f:
  f.write('/* La voce di Macio per karaoke.html: le sillabe cantate (per numero di nota)\n'
          '   e le frasi parlate, in un mp3 solo. Generato da strumenti/voce-macio.py:\n'
          '   non modificare a mano. [inizio, durata] in secondi. */\n')
  f.write('window.MACIO_VOCE = ' + json.dumps({ 'clips': clips }) [:-1] + ', "mp3": "' + data + '"};\n')
print('karaoke-voce.js:', round(os.path.getsize(OUT_JS) / 1024), 'KB,', round(len(audio) / SR, 1), 's di voce')
