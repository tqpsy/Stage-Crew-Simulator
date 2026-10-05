# Lo spettacolo del DJ: Light Operator Hero (fatto)

Stato: **nel gioco**. `dj.html` si apre in un iframe dopo il cambio palco
delle 21:10 (da solo, dal foglio o dalla scaletta). Si gioca anche da sola,
aprendo `dj.html`. Il design deciso è in `docs/livello1-festa-scuola.md`
(*Lo spettacolo del DJ: Light Operator Hero*); qui come è fatto.

## La pista delle luci

Il brano vero è `audio/notte-fuori-controllo.mp3`. Il tecnico è l'operatore
luci: tre corsie, una per memoria della consolle luci. Niente tasto di
blackout: il battito prima di ogni drop è una pausa.

| Corsia | Tasto | Sul palco | Quando |
|---|---|---|---|
| COLORI | D | tutti i PAR nel colore della sezione | sulla cassa |
| CHASE | F | un PAR alla volta, in giro | sui controtempi e sulle salite |
| STROBO | J | lo strobo al centro | il **drop** è una nota lunga (una battuta); colpi sulla salita |

- Nota presa: la luce parte, gradimento su, combo (×2 ogni 10, fino a ×4).
  Mancata: gradimento giù (di più nei drop), combo a zero. Premere senza
  nota: la luce parte fuori tempo, e si vede.
- Il drop tenuto fino in fondo fa il boato (+4 gradimento).
- Livello 1: finestre larghe (perfetto 80 ms, bene 160 ms). La **stanchezza**
  sale col tempo e le stringe; la **birra** (🍺, tasto B) la toglie.
- **Si fa via via più difficile**: dal terzo drop i controtempi a ottavi
  nella corsia CHASE, dal quarto anche a metà battuta, nell'ultimo gli
  accordi COLORI + CHASE; le ultime salite con lo strobo a ottavi. Le note
  corrono sempre più veloci (da 1,9 a 1,45 s di pista) e la finestra si
  stringe fino al 18% verso la fine, oltre alla stanchezza. Da 4 note per
  battuta nel primo drop a 5 nell'ultimo.
- Mai più di due tasti insieme: sul telefono si gioca coi pollici.
- Il vocalist parla quando nel brano c'è la voce (voce separata dal brano);
  il pubblico salta ai drop in proporzione al gradimento. Sul telefono le file
  di pubblico lontane passano dietro la pista.

## I guasti, uno alla volta

| Battuta | Guasto | Tipo | Cosa fare |
|---|---|---|---|
| 10 | il DJ alza il suo volume, in rosso | nota speciale | tirare giù il **fader DJ** (trascinare, o V) prima che la nota arrivi |
| 17 (break) | la ciabattina del DJ fa scattare **L2**: PAR spenti, corsie COLORI e CHASE grigie | guasto grosso | scegliere chi va al Quadro |
| 42 | PAR 4 non risponde: corsia CHASE grigia | rompe la pista | toccare il PAR (o P) e capire la causa dagli indizi (vedi sotto) |
| 49 | Musa va verso la cassa mentre canta | nota speciale | **MUTE MIC** (M) in tempo, o larsen |
| 67 | Musa si mangia il microfono | nota speciale | tirare giù il **fader MIC** |

**Il PAR che non risponde** ha una causa pescata a caso fra tre, e il
pannello non la dice: mostra display, spia DMX e ventola del faro, più il
patch sheet (PAR 4 = 010). Display spento e ventola ferma: manca la corrente
(rinfila la PowerCON). Display acceso ma spia DMX spenta: il segnale non
arriva (rinfila il DMX tra PAR 3 e PAR 4). Spia accesa ma indirizzo diverso
dal patch: rimetti 010. Si può sistemare subito o in un momento calmo.

Le note normali vicine a una nota speciale spariscono: un pollice resta
libero. Un fader non abbassato in tempo distorce finché non lo abbassi. La
cura sbagliata del PAR costa un secondo e mezzo.

## Chi va al Quadro

| Scelta | Cosa succede | Reputazione |
|---|---|---|
| **Ci vado io** | il capo prende le luci (ne manca una su tre, niente combo); al Quadro sposti la ciabattina su L3 e riarmi L2 | **+5** entro 15 s, 0 dopo |
| **Pago una 🍺 al capo** | ci va lui, riarma in 6 s, tu resti alle luci | 0, una birra in meno |
| **Aspetto: Gerry** | anche se non scegli entro 10 s; Gerry arriva dopo 20 s | **−5** |

- Al Quadro ogni fase regge 3,6 kW: la ciabattina (3,4 kW) su L1 col finale
  non ci sta; riarmare con la ciabattina ancora su L2 fa riscattare.
- Il capo non si spazientisce (deciso): resta alle luci finché non torni.
  Oltre i 15 s la fase riarmata vale reputazione 0.
- Senza birre il capo non si paga; al massimo due favori per set.
- **Rewind**: tornando alle luci il DJ fa lo scratch e riporta il brano
  indietro del tempo in cui sei stato via (fino a 8 battute, a battiti
  interi). Le note di quel tratto tornano, +3 di gradimento, combo da zero.
  Solo se ci sei andato tu.

## Finale ed esito

Dalla battuta 80 Gerry sale sul palco arrabbiato (fronte rossa, bocca che
urla, trema): troppo casino, e le parolacce davanti ai bambini. Alla battuta
82, terzo battito, poco prima della fine del brano, **stacca la corrente di
botto**. Prima va via la musica: il clac del magnetotermico, un ronzio che
scende e il disco che rallenta e si ferma. Subito dopo le luci sfarfallano e
si spengono. Il pubblico fa «Ohhhh», poi rumoreggia contro il bidello (buuu,
urla, fischi, pugni alzati) mentre Gerry litiga con Musa e il DJ e li butta
fuori. Dopo il taglio non ci sono più note (`taglio` nella mappa). In fondo,
sul palco e nella scheda finale (e nel gioco): «Il bidello ha cacciato via i
musicisti: la festa è rimasta senza musica.» Nel gioco poco
dopo parte il karaoke di Macio (`karaoke.html`).

- Reputazione: 5 + (gradimento − 60) / 10 + guasti: +1 per ogni nota speciale
  presa in tempo, +3 per il PAR sistemato entro 12 s, la scelta del Quadro
  (+5 / 0 / −5), −5 per ogni larsen.
- Birre: una se niente larsen e niente Gerry, una se il pubblico è almeno al 70%.
- Nel gioco (`openDj`, `finishDj` in `main.js`, stato in `Profile.data.dj`):
  reputazione una volta sola, birre bevute e pagate al capo tolte, quelle
  guadagnate aggiunte; scaletta e foglio segnano il set fatto. Saltarlo non
  dà reputazione.

## La mappa

`strumenti/mappa-dj.py` scrive `dj-mappa.js`: griglia a 130 BPM (primo
battito 0,296 s, 85 battute), voce separata col modello UVR-MDX-NET Voc_FT
(25 frasi, e l'apertura della bocca di Musa), sezioni scritte a mano come si
fa con Guitar Hero, note dalle regole di `note_luce`, il battito del taglio
di Gerry (`TAGLIO`). In **Facile** restano
le note sui tempi forti.

## Test

- `tests/spettacolo-dj.js`: la pagina da sola, con un orologio finto: mappa,
  demo a 5 stelle col rewind e il finale, ogni guasto e ogni scelta del
  Quadro, capo spazientito, tasti.
- `tests/dj-gioco.js`: dentro il gioco dopo il cambio palco: dati del
  montaggio, esito, reputazione una volta sola, birre (anche quella del
  capo), ricarica, show saltato.

## Da fare

- L'audio passa per la catena simulata (fader, mute, L/R, distorsione vera
  del gain, ronzio della DI) e il brano si può caricare.
- Guasti pescati a caso oltre a quelli a copione; macchina del fumo sotto il
  rilevatore.
- Dal livello 2 niente capo: l'assistente da assumere con la reputazione.
