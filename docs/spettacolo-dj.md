# Lo show del DJ set: le luci a tempo (prototipo)

Stato: **prototipo giocabile**, `prototipi/spettacolo-dj.html`. Si apre nel
browser come il gioco. Il cambio palco che lo precede è già nel gioco (vedi
`docs/livello1-festa-scuola.md`); lo show non è ancora collegato alla scaletta.

## L'idea

Alle 21:15 DJ Inestimabile mette *Notte fuori controllo* e Musa Esistenziale
urla al microfono. Il tecnico sta alla consolle luci e **suona le luci come in
Guitar Hero**: le note scendono su quattro corsie e si toccano quando arrivano
sulla riga. Tutto segue il brano vero (`audio/notte-fuori-controllo.mp3`):

- le **pulsazioni** dei tagli cadono sui colpi di cassa;
- lo **strobo** si tiene premuto sulle salite e dà un colpo sul drop;
- il **vocalist parla quando nel brano c'è la voce**: bocca, microfono alzato
  e fumetto seguono la voce separata dal brano;
- il **pubblico salta quando c'è da saltare**: a ogni battito dei drop.

## Le quattro corsie

| Corsia | Tasto | Luce sul palco | Quando |
|---|---|---|---|
| TAGLIO SX | D | PAR 1 (taglio sinistro) | colpi di cassa, alternati col DX |
| TAGLIO DX | F | PAR 4 (taglio destro) | colpi di cassa; nei drop, a inizio battuta, insieme al SX (accordo) |
| VOCE | J | PAR 2 e 3 (frontali) su Musa | nota tenuta per tutta la frase del vocalist |
| STROBO | K | strobo al centro dell'americana | tenuta sulla salita (BUILD), colpo sul primo battito del drop e ogni 4 battute nei drop |

Le corsie sono gli stessi PAR del montaggio (frontali 2 e 3, tagli 1 e 4) più lo
strobo, che è nuovo. Sul telefono ci sono i quattro tasti in basso.

**Mai più di due tasti insieme**: sul telefono si gioca con due pollici. Dove
Musa canta sopra un accordo, l'accordo diventa una nota sola.

## Il brano

`strumenti/mappa-dj.py` analizza il brano e scrive `prototipi/dj-set-mappa.js`:

- **griglia**: 130 BPM, primo battito a 0,296 s, 85 battute (2:37);
- **voce**: separata con il modello UVR-MDX-NET Voc_FT; le frasi sono i tratti
  sopra −34 dB (pause sotto 3/4 di battito unite). Ne escono 25 frasi, tutte
  fuori dai drop. La stessa voce dà l'apertura della bocca di Musa, 25 valori
  al secondo;
- **sezioni** (scritte a mano guardando energia della cassa e voce battuta per
  battuta, come si fa con le mappe di Guitar Hero):

| Battute | Sezione | Cosa succede |
|---|---|---|
| 0–7 | INTRO | niente cassa, Musa urla le prime frasi |
| 8–14 | GROOVE | entra la cassa |
| 15–28 | BREAK | cassa via, voce |
| 29–31 | BUILD | salita |
| 32–36 | DROP 1 | |
| 37–39 | BUILD | |
| 40–46 | DROP 2 | |
| 47 | BUILD | una battuta di stacco |
| 48–51 | DROP 3 | |
| 52–60 | GROOVE | voce sopra la cassa |
| 61–63 | BUILD | |
| 64–71 | DROP 4 | |
| 72–75 | BUILD | |
| 76–82 | DROP 5 | il finale |
| 83–84 | OUTRO | |

Le note si mettono da sole da sezioni e voce (`note_luce` nel programma):
INTRO un colpo ogni due battute, BREAK uno per battuta, GROOVE ogni battito
alternando SX e DX, BUILD strobo tenuto fino all'ultimo battito prima del drop
(quello resta **buio**), DROP accordo a inizio battuta e poi alternati. In
**Facile** restano solo le note sui tempi forti (terza cifra della nota).

Per un altro brano: cambiare `SEZIONI` guardando la stampa battuta per
battuta, poi rilanciare il programma (le istruzioni sono in cima al file).

## Punteggio e pubblico

- Finestre: **perfetto** entro 70 ms, **bene** entro 130 ms. Più in là la nota
  è mancata.
- Combo: il moltiplicatore sale di uno ogni 10 note (fino a ×4).
- **Pubblico** (parte dal 60%): sale con le note prese, scende con le note
  mancate (di più nei drop), con i colpi **fuori tempo** (la luce parte lo
  stesso, e si vede) e mentre **Musa canta al buio**. Il colpo di strobo sul
  primo battito del drop vale +5.
- Il pubblico salta ai drop in proporzione al gradimento: al 90% salta quasi
  tutta la palestra, sotto il 30% quasi nessuno. Sulla salita alza le mani e
  sull'ultimo battito, al buio, si abbassa; nel groove muove la testa; nel
  break ondeggia e accende i telefoni.
- A fine brano: stelle (dalla precisione), pubblico, combo massima, e cosa è
  andato storto.

## Accessibilità e telefoni

- **Strobo vero** spento di serie: lo strobo si vede come un bagliore morbido.
  Acceso, lampeggia a sedicesimi (circa 8,7 lampi al secondo): la scheda
  iniziale lo dice.
- **Ritardo audio** (−100…+300 ms) per cuffie e casse Bluetooth.
- L'audio parte dentro il tocco su «Via la musica» (i telefoni lo chiedono);
  due secondi di conto alla rovescia prima del brano.
- Pausa col tasto ⏸, con lo spazio o cambiando scheda del browser.

## Demo e test

«Guarda la demo» fa suonare le luci al capo: prende tutte le note. Il test
`tests/spettacolo-dj.js` usa un orologio finto (`__dj.virtual`, `__dj.advance`)
e controlla la mappa, la demo a 5 stelle, i salti ai drop, la bocca di Musa,
il pubblico che si svuota senza toccare niente, tasti, colpi fuori tempo e
tenute mollate.

## Da fare

- Collegarlo al gioco dopo il cambio palco (21:15 in scaletta), con
  reputazione e birre.
- I guasti del DJ set proposti nel documento del livello (gain in rosso, larsen
  di Musa, ciabatta del DJ, macchina del fumo) che arrivano **mentre** si
  suonano le luci.
- I colori per sezione oggi sono fissi (`PALETTE`): potrebbero venire dalle
  memorie della consolle luci.
- Le luci davvero montate: un PAR non collegato al montaggio lascia la sua
  corsia al buio.
