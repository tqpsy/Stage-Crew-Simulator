# L'assistente (dal livello 2)

Nel livello 1 il **capo squadra** fa da tutor: ferma il primo errore di
procedura e, nello spettacolo del DJ, per una 🍺 va lui a sistemare un guasto
grosso mentre tu resti alle luci (vedi *Chi va a sistemare un guasto grosso*
in `docs/livello1-festa-scuola.md`).

Dal livello 2 il capo non c'è più (`TUTOR_LEVELS` in `main.js` vale solo per
il livello 1). Al suo posto c'è un **assistente**, da assumere con la
reputazione e da pagare a birre. Il livello 2 non esiste ancora: questo
documento e i dati in `main.js` sono pronti per quando arriverà.

## Cosa è deciso e cosa è proposto

- **Deciso** (dai documenti): dal livello 2 niente capo; al suo posto un
  assistente da assumere con la reputazione, pagato a birre.
- **Proposto** (da confermare): tutto il resto di questo documento. I numeri
  sono già in `ASSISTANTS` in `main.js`, così si cambiano in un posto solo.

## Come si assume

- La **reputazione è una soglia, non si spende**: si assume chi ha la soglia
  raggiunta, e la reputazione resta quella di prima. (La reputazione misura
  la professionalità: spenderla non avrebbe senso.)
- Si sceglie **all'inizio della serata**, nella scaletta, prima del montaggio:
  una scheda «Assistente» con i tre ritratti; quelli sotto soglia sono grigi
  con scritto quanta reputazione manca. Si può anche restare **da soli**.
- La scelta vale **per tutta la serata** (il livello). Alla serata dopo si
  sceglie di nuovo: se nel frattempo la reputazione è scesa sotto la soglia,
  quell'assistente non c'è («non lavora con chi fa brutte figure»).
- Assumerlo è **gratis**: si paga a favore, come col capo. Così senza birre
  in tasca l'assistente c'è ma non si muove (come il capo: senza birre ci vai
  tu).

## Quanto costa

Ogni **favore** (un guasto grosso sistemato al posto tuo) costa birre,
scalate da `Profile.data.beers` nel momento in cui l'assistente parte. La
birra ha lo stesso costo vero di oggi: è una birra in meno contro la
stanchezza e nel punteggio finale.

## I tre assistenti

| | **Nico «Cavetto»** | **Sabri «Nastro Nero»** | **Tonino «Ventennale»** |
|---|---|---|---|
| Carattere | stagista, tanta voglia e poca pratica | brava quanto il capo | vent'anni di palchi |
| Reputazione per assumerlo | **10** | **20** | **35** |
| Birre a favore | 🍺 | 🍺 | 🍺🍺 |
| Alle luci manca | una nota su **due** | una nota su **tre** (come il capo) | una nota su **cinque** |
| Tempo per sistemare | 25 s | 15 s | 10 s |
| Guasti che sa sistemare | solo la **fase che scatta** | fase che scatta e **PAR senza DMX** | fase e DMX |
| Favori per set | 2 | 2 | 3 |

Con una festa della scuola giocata bene si arriva a circa 20–30 di
reputazione (collaudo 5, scarico 3, posa dei cavi fino a 5, discorso del
preside fino a circa 9, cambio palco 3, più lo spettacolo del DJ): all'inizio
del livello 2 c'è quasi sempre Nico, Sabri solo con un livello 1 fatto bene,
Tonino più avanti.

## Cosa sa fare e cosa no

Uguale al capo del livello 1:
- solo i **guasti grossi** (quelli che portano fuori dalla pista); i
  guasti-nota (MUTE MIC, fader) restano del giocatore;
- se ci va l'assistente, **reputazione 0** per quel guasto (né bonus né
  malus) e **niente rewind** del DJ (non hai perso note);
- se ci vai tu, l'assistente ti dà il **cambio alle luci**: prende le note
  in automatico e ne manca una ogni `missEvery`, e ogni nota mancata azzera la
  combo. Se stai via troppo (30 s, come il capo) torna alle luci e il guasto lo
  finisci con la pista che scorre.

Diverso dal capo:
- **Non fa il tutor**: nessun consiglio prima degli errori di procedura
  (dal livello 2 gli errori si fanno davvero).
- **Nico non tocca il DMX**: per un PAR senza DMX la scelta «paga Nico» non
  c'è, ci vai tu o nessuno.
- **Nico ogni tanto sbaglia** (proposta): una volta su tre rimette la spina
  del DJ sulla stessa fase e dopo un po' scatta di nuovo. Il favore è pagato
  lo stesso. Da provare giocando: se è troppo cattivo si toglie.
- **Il tempo per sistemare conta**: mentre l'assistente è al Quadro, la fase
  resta giù e il gradimento del pubblico scende. Con Tonino quasi non si
  sente, con Nico sì.

## La scelta nel gioco

Quando arriva un guasto grosso la finestra «Chi ci va?» diventa:

| Scelta | Cosa succede | Reputazione |
|---|---|---|
| **Ci vai tu** (gratis) | L'assistente ti dà il cambio alle luci | +5 se in fretta, 0 se lento |
| **Paga 🍺 a Nico/Sabri/Tonino** | Ci va lui/lei, tu resti alle luci | 0 (e le birre in meno) |
| **Nessuno** | Dopo un po' ci pensa il custode del posto | −5 |

Il tasto dell'assistente non c'è (o è grigio con il motivo) se: non hai
assunto nessuno, non ha birre abbastanza, ha finito i favori del set, oppure
non sa sistemare quel guasto. Senza assistente «Ci vai tu» vuol dire che
**la pista resta senza nessuno**: le note scendono e si perdono tutte finché
non torni (il rewind del DJ ne recupera fino a 8 battute).

## Come si vede

- **Scaletta**: scheda «Assistente» con ritratto, nome, riga di carattere,
  soglia e costo.
- **Testata**: accanto a 🍺, il ritratto piccolo dell'assistente assunto.
- **Montaggio**: l'assistente è in scena come personaggio (a lato palco) ma
  non fa niente da solo; niente consigli.
- **Spettacolo**: quando dà il cambio alle luci si vede la sua faccina sulla
  pista; le sue note mancate hanno un segno diverso dalle tue.
- **Scheda finale**: «Favori di Sabri: 2 (🍺 −2)».
- Ritratti come gli altri personaggi: SVG in `img/personaggi.svg`, stesso
  ritaglio (`viewBox="6 2 88 88"`), persone inventate (niente caricature di
  persone vere).

## Nei livelli successivi

- **Scarico e posa dei cavi** (proposta): l'assistente può portare un case
  alla volta allo scarico e, nella posa, fissare col nastro un cavo che hai
  già piegato. Stesso costo a birre. Da decidere livello per livello.
- **Esperienza** (proposta): dopo un certo numero di serate insieme
  l'assistente migliora (Nico impara il DMX dopo 3 serate). Si tiene nel
  salvataggio come contatore di serate per assistente.
- **Due assistenti** (proposta) quando arrivano palchi grandi (camion o
  bilico, FOH col multicore): uno a lato palco, uno al FOH.
- **Nuovi assistenti** con soglie più alte e caratteri nuovi (un light
  designer mancato che alle luci non sbaglia mai ma non sa riarmare una fase;
  un elettricista che sistema le fasi in 5 s ma alle luci è un disastro).
- Se arriverà l'idea degli **attrezzi da sbloccare con la reputazione**
  (`ROADMAP.md`), assistenti e attrezzi usano la stessa scheda: soglie di
  reputazione, niente reputazione spesa.

## Cosa c'è già nel codice

In `main.js`, dopo `addRecord`:
- `ASSISTANTS`: i tre assistenti con soglia (`rep`), birre a favore
  (`beers`), note mancate alle luci (`missEvery`), tempo per sistemare
  (`fixS`), guasti che sanno sistemare (`fixes`: `'fase'`, `'dmx'`), favori
  per set (`favors`) e la riga di carattere (`line`);
- `assistantLevel(livello)`: vero dove non c'è il capo tutor;
- `assistantUnlocked(id)`, `assistant()`: soglia raggiunta, assistente assunto;
- `hireAssistant(id, livello)`: assume (o con `null` si resta da soli); nel
  livello 1 dice sempre no;
- `assistantCanFix(guasto)`, `assistantFavor(guasto)`: può andare? ci va,
  paga le birre e conta il favore;
- `assistantNewSet()`: i favori ripartono da zero a ogni set.

Nel salvataggio `scs-save` (versione 5) c'è `assistant: { id, favors }`; la
versione 4 si converte con nessuno assunto. Nuova partita = nessun assistente.
Test: `tests/assistente.js` e la conversione in `tests/salvataggio.js`.

Nel livello 1 niente di tutto questo si vede: resta il capo.
