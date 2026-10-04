"""La voce di Macio per il karaoke (karaoke.html): una voce italiana maschile
sintetica (Piper it_IT-riccardo, via sherpa-onnx) dice ogni sillaba con
l'accento barese, il vocoder WORLD la fa cantare ogni
sillaba sulla sua nota, lunga quanto la nota (un'ottava sotto la melodia,
con vibrato, e stonata dove Macio stona). Escono un mp3 con tutte le
sillabe una dopo l'altra e karaoke-voce.js con l'mp3 in base64 e dove sta
ogni sillaba.

Uso:  python3 strumenti/voce-macio.py canzone.json cartella-del-modello
  canzone.json: le note di karaoke.html (window.__karaoke.notes, beat,
  stona), vedi tests/karaoke.js per come aprire la pagina.
  cartella-del-modello: vits-piper-it_IT-riccardo-x_low scompattato, da
  github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/
Richiede: numpy, pyworld, sherpa-onnx, soundfile, ffmpeg."""
import base64, json, os, subprocess, sys, tempfile
import numpy as np, pyworld as pw, sherpa_onnx

song = json.load(open(sys.argv[1]))
mdir = sys.argv[2]
OUT_JS = os.path.join(os.path.dirname(__file__), '..', 'karaoke-voce.js')

# l'accento barese, non il dialetto: la «a» accentata si apre verso la «è»
# («Bèri»), le doppie si sentono di più. Ogni verso come lo dice Macio.
BARESE = {
  'Gerry ha spento tutto quanto': 'Gèrri ha spènto tùtto quènto',
  'e il digei è già sul bus': 'e il digèi è gè sul bùss',
  'la palestra aspetta un canto': 'la palèstra aspètta un cènto',
  'passami il microfono!': 'pèssami il micròfono!',
  'Salviamo la serata': 'Salvièmo la serèta',
  'Cantate insieme a me': 'Cantète insième a mè',
  'anche se sono stonato': 'ènche se sòno stonèto',
  'stasera la star è me!': 'stasèra la stèr è mè!',
  'stasera la star è meee!': 'stasèra la stèr è mèèè!',
  'Ho scaricato il furgone': 'Ho scarichèto il furgòne',
  'ho portato su il baule': 'ho portèto su il baùle',
  'ora canto la canzone': 'òra cènto la canzòne',
  'con la voce di un maiale': 'con la vòce di un maièle',
}
# le frasi parlate (intro, sbagli, fine)
PARLATO = {
  'prova': 'Pròva... pròva... si sènte?',
  'scritta': "Questa l'ho scrìtta adèsso!",
  'testo': 'Tècnico, mèndami il tèsto!',
  'ehm': 'Ehm...',
  'fiato': 'Mi è finìto il fièto!',
  'grazie': 'Gràzie palèstra! Uè!',
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
  vib = 1 + 0.018 * np.sin(2 * np.pi * 5.3 * tt) * np.clip((tt - 0.25) / 0.3, 0, 1)
  glide = 2 ** (-0.6 * np.exp(-tt / 0.05) / 12)          # entra da sotto, come si canta
  nf0 = np.where(voiced, hz * vib * glide, 0.0)
  y = pw.synthesize(np.ascontiguousarray(nf0), np.ascontiguousarray(sp[idx]), np.ascontiguousarray(ap[idx]), sr, FP)
  fade = min(len(y), int(sr * 0.03))
  y[-fade:] *= np.linspace(1, 0, fade)
  y[:int(sr * 0.004)] *= np.linspace(0, 1, int(sr * 0.004))
  return y

def stona_at (t):
  for a, b, s in song['stona']:
    if a * song['beat'] * 4 <= t < b * song['beat'] * 4: return s
  return 0

clips, pieces, pos, SR = {}, [], 0, None
def add (key, y, sr):
  global pos, SR
  SR = SR or sr
  y = y / max(1e-6, np.abs(y).max()) * 0.8
  clips[key] = [round(pos / sr, 4), round(len(y) / sr, 4)]
  pieces.append(y); pieces.append(np.zeros(int(sr * 0.05)))
  pos += len(y) + int(sr * 0.05)

lines = {}
for n in song['notes']: lines.setdefault(n['line'], []).append(n)
for li, ns in sorted(lines.items()):
  # il verso detto tutto di fila (suona naturale), poi diviso nelle sue sillabe
  text = ''.join(n['text'] for n in ns).strip()
  x, sr = say(BARESE.get(text, text), SPEED)
  f0, sp, ap = analyze(x, sr)
  bounds, peaks = nuclei(sp, f0, len(ns))
  for k, n in enumerate(ns):
    dur = n['len'] if n['hold'] else min(n['len'], song['beat'] * 0.9)
    y = sing(f0, sp, ap, bounds[k], bounds[k + 1], peaks[k], n['midi'] - 12 + stona_at(n['t']), dur, sr)
    add(n['i'], y, sr)
  print('verso', li, text, '->', BARESE.get(text, text))
for k, text in PARLATO.items():
  x, sr = say(text, 0.95)
  add(k, x, sr)

audio = np.concatenate(pieces)
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
