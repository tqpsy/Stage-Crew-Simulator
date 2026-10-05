# Minigioco — La posa dei cavi (bozza di design)

Stato: **sostituito** nel gioco dalla posa al montaggio con il giro di Gerry
(vedi *Posa al montaggio*). Prima era nel gioco (livello 1, *Integrazione nel gioco*):
`posa-cavi.html`, test `tests/posa-cavi.js` (la pagina da sola, con due
scenari fissi) e `tests/posa-cavi-gioco.js` (dentro il gioco).

## In breve

Il montaggio dice **cosa** è collegato a cosa; la posa dice **da dove passa**
il cavo. Dopo il Test impianto, prima dell'apertura porte, la palestra si
vede dall'alto e i cavi vanno stesi per terra come si deve. Poi passa
**Gerry, il bidello**, e controlla: se trova un cavo in mezzo ai piedi, le
porte non si aprono.

In scaletta: tra il Test impianto (19:30) e l'Apertura porte (20:30), per
esempio **20:00 — Messa in sicurezza dei cavi**.

## Come si gioca

- La pianta è la stessa palestra del livello 1 (`main.js`: 10 × 16 m, celle
  da 50 cm), vista dall'alto. I pezzi sono già posati dove li ha messi il
  giocatore al montaggio.
- **I cavi sono già stesi** (deciso): il cablaggio è fatto al montaggio,
  quindi la vista dall'alto si apre con ogni cavo dove l'ha lasciato il
  montaggio, cioè lungo la stessa linea con cui lo disegna l'isometrico
  (dritto da presa a presa, con il giro intorno alla pedana). Una linea
  dritta sullo schermo isometrico dall'alto è una diagonale: il cavo passa
  dove passa davvero, anche in scena, in un passaggio o sulla via di fuga.
- Il giocatore **sceglie quali sistemare** piegando i cavi come corde
  (deciso dopo la prova sul telefono: disegnare il cavo cella per cella
  col dito era confuso e difficile). Si prende un cavo in un punto
  qualsiasi e lo si tira: lì nasce una **piega** (un pallino) e il cavo va
  dritto da un punto all'altro. I pallini del cavo in mano si trascinano;
  vicino a un'altra piega o al capo il cavo si mette in riga da solo
  (tratti dritti), vicino a un muro o al bordo del palco ci si appoggia.
  Una piega messa in riga con le vicine sparisce. Toccando un cavo lo si
  prende in mano e gli altri si spengono; un tocco sul pavimento lo lascia.
  **Com'era** lo rimette come al montaggio. Se sembra tutto a posto si può
  chiamare Gerry subito.
- Ogni cavo ha la **sua lunghezza** (quella del baule: XLR 10 m, Speakon
  15 m, PowerCON 5 m, …). Accanto alla piega si vedono i metri liberi;
  quando la corda è tesa la piega non va oltre. Quello che avanza si
  arrotola a otto accanto al pezzo.
- Attrezzi: **passacavi** (pochi, si posano sui passaggi) e **nastro
  gaffer** (un rotolo di tot metri: il contatore in alto).
- **Gli errori si vedono solo quando passa Gerry** (deciso). Mentre si
  posa non c'è nessun avviso: il capo tutor del montaggio qui non parla.
  Si vedono solo le cose che si toccano con mano: i metri di cavo che
  restano, il nastro rimasto sul rotolo, i passacavi ancora in mano; e il
  la piega si ferma contro un pezzo. La via di fuga no: un cavo ci può
  finire sopra, ed è Gerry a trovarlo. Dopo il giro di Gerry i punti sbagliati
  restano segnati in rosso finché non si rifà quel cavo.
- Quando vuole si chiama Gerry. Al primo giro senza errori:
  ★★★; al secondo ★★; poi ★.

## Le regole (quelle vere di un service)

| Regola | Cosa succede nel gioco |
|---|---|
| **Via di fuga libera** | La zona davanti all'uscita di sicurezza è rossa: lì per terra non ci deve essere niente. Un cavo ci può finire sopra (così lo lascia il montaggio): Gerry lo boccia. |
| **Passaggi con il passacavi** | Passaggio degli artisti e corridoio del pubblico sono a strisce. Si attraversano **di traverso**, dentro un passacavi. Senza passacavi, o correndo lungo il passaggio, Gerry boccia. |
| **Niente cavi in scena** | In mezzo alla pedana passa solo il cavo del microfono (va all'asta). Gli altri stanno lungo il bordo del palco. |
| **Nastro dove si cammina** | Palco, Pit e platea: ogni cella con un cavo va fermata col nastro. Lungo i muri no. Più cavi nella stessa cella fanno un **fascio** e usano un nastro solo: conviene raggrupparli. |
| **Il segnale incrocia la corrente a 90°** | Microfono e multipolare affiancati a un cavo che porta corrente (anche la coppia DMX + PowerCON dei PAR) per almeno 1 m: ronzio. Incrociarli ad angolo retto va bene. |

La tensione del minigioco è tutta qui: il fascio risparmia nastro ma il
microfono non ci può stare dentro; il muro è gratis ma è lungo e la via di
fuga lo interrompe; il passacavi risolve un attraversamento ma ce ne sono
pochi.

## Scenari del prototipo

1. **Festa della scuola** (livello 1): regia sul tavolo in Off Stage, 2 sub,
   4 PAR in catena, asta del preside. 11 cavi, 1 passacavi, 16 m di nastro.
   L'allaccio è oltre il passaggio degli artisti: serve il passacavi.
2. **Regia in sala** (anteprima dei livelli successivi, vedi ROADMAP):
   regia FOH in fondo alla platea, multipolare da 50 m e CEE da 25 m.
   A sinistra la via di fuga interrompe il muro, a destra c'è il corridoio
   da attraversare; e multipolare e corrente non possono fare lo stesso
   fascio. 9 cavi, 2 passacavi, 22 m di nastro.

Il test risolve ogni scenario con un percorso valido e controlla che il
nastro basti con margine (≤ 85% del rotolo) ma non sia infinito (≥ 45%).

## Integrazione nel gioco

**Fatto:**
- In scaletta alle **20:00 — Messa in sicurezza dei cavi**: «Adesso» dopo il
  collaudo, «Fatto» con le stelle e i giri di Gerry quando è finita.
- Si apre da sola alla fine dello show del **primo** collaudo riuscito
  (`afterShow`); se lo show si interrompe resta in scaletta, e il pulsante
  della scaletta diventa «Stendi i cavi». Si fa una volta sola per partita.
- Come lo scarico: `posa-cavi.html?embed=1` in un iframe. La pagina chiede
  la pianta (`posa-cavi-pronta`), il gioco la manda (`posa-cavi-pianta`,
  costruita da `posaLayout()`), il risultato torna con `posa-cavi-fine`.
- La pianta è **quella del montaggio**: i pezzi posati nelle loro celle (i
  pezzi montati stanno sulla loro base: PAR sullo stativo, regia sul tavolo,
  microfono sull'asta) e i cavi di `gameState.edges` tra basi diverse. I
  cavi che fanno la stessa strada si uniscono (PowerCON + DMX tra due PAR);
  quelli tra pezzi dello stesso tavolo non vanno per terra.
- Il montaggio non guarda le lunghezze: se il cavo del baule non basterebbe,
  la posa lo allunga (a multipli di 5 m). Nastro e passacavi si tarano su
  una posa valida trovata dalla pagina stessa (`autoRoute`), con margine.
- Un passaggio o la via di fuga occupati da un pezzo al montaggio non ci
  sono (il montaggio non li conosce ancora). Un cavo di un pezzo che sta in
  mezzo alla pedana può passare in scena, come il microfono.
- **Reputazione**, una volta sola: ★★★ +5, ★★ +3, ★ +1, finita col tempo 0. Si può saltare
  dalla sua schermata iniziale: le porte si aprono, reputazione ferma.
- Il salvataggio tiene `cavi` (stelle, giri, metri di cavo e di nastro);
  una partita nuova la azzera.

- **Nell'isometrico** i cavi seguono le pieghe della posa: per ogni cavo
  del montaggio il salvataggio tiene le pieghe (in metri) e dove stavano le
  due basi (`cavi.routes`, `caviRoute`). Se una base si sposta, o il cavo
  si stacca e si rifà, quel cavo torna al percorso automatico.
- **Conseguenze nello show**: se alle 20:30 restano errori, il salvataggio
  tiene quali (`cavi.left`) e `caviLeftovers()` li traduce in quello che
  succederà: *passaggio* (anche lungo il passaggio o sulla via di fuga):
  qualcuno inciampa nel cavo e lo strappa dal mixer, il guasto del preside
  è l'ingresso; *ronzio*: 50 Hz nelle casse, più forte col fader del
  microfono, e il pubblico cala; *scena*: il preside inciampa nel cavo in
  mezzo al palco. La scaletta lo anticipa. Il discorso del preside
  (`preside.html`, dopo la posa) riceve `caviLeftovers()` dal gioco; aperto
  da solo ha la scelta «Cavi lasciati dalla posa» per provarlo
  (`tests/preside-cavi.js`).

**Da fare:**
- Passaggi e via di fuga anche al montaggio (posa guidata), così non si
  perdono sotto un pezzo.

## Posa al montaggio

Dal 3 ottobre 2026 i cavi si stendono già al montaggio (`main.js`,
*POSA AL MONTAGGIO* e `StageScene.startLay`):

- Ogni cavo per terra va dal centro della base di un pezzo a quello
  dell'altro passando per al massimo 5 **pieghe** (`e.route.bends`, in
  metri). Agli angoli il cavo fa una **curva morbida** (raggio 0,9 m), come
  un cavo vero. Senza posa il gioco sceglie il percorso più corto a L o a Z
  che gira intorno alla pedana.
- Appena collegato (o toccandolo) il cavo **resta in mano**: gli altri si
  spengono. Dal 5 ottobre 2026 un tocco su un dispositivo lascia giù il
  cavo così com'è e va avanti con quel dispositivo (prima serviva Fatto:
  era un tocco in più a ogni cavo). Le pieghe sono
  pallini che si **trascinano** col dito (o col mouse): scattano sui centri
  delle celle da 50 cm e si mettono in riga con le vicine. Le pieghe non
  nascono mai da sole (dopo la prova di Luca del 4 ottobre): si aggiungono
  con **+ Piega** (a metà del tratto più lungo). Per toglierne una la si
  **tiene premuta** finché diventa rossa con la ✕ e si lascia il dito
  (muovendola si annulla). Le pieghe in riga con le vicine spariscono.
- La barra in basso dice i metri usati sulla lunghezza del cavo del baule:
  oltre non si tira (il cavo è teso), quello che avanza si arrotola accanto
  al pezzo. Pulsanti: **+ Piega**, **Com'era** (percorso automatico), **Togli**, **Fatto**
  (anche un tocco sul pavimento, Invio). Sul telefono la vista si avvicina
  al cavo e poi torna com'era.
- Il percorso si salva sul cavo (`e.route`, con la posizione delle due basi):
  se una base si sposta, il cavo torna al percorso automatico. Annulla e
  Ripeti lo comprendono.
- Sul pavimento del montaggio ci sono **via di fuga** (strisce rosse) e
  **passaggi** (strisce gialle, si attraversano dritti). Mentre si stende un
  cavo, i punti che Gerry boccerebbe diventano rossi e la barra dice perché.
  Passacavi e nastro li mette la crew da sola: conta solo da dove passa il cavo.

**Alle 20:00 niente minigioco: passa solo Gerry** (deciso il 3 ottobre 2026,
`openCavi` e `gerryIssues` in `main.js`). Guarda i cavi come sono stesi al
montaggio con le regole della tabella sopra: via di fuga, passaggi lungo,
scena, ronzio (segnale XLR/jack affiancato alla corrente per almeno 1 m).
- Tutto a posto: «Apri le porte», ★★★ al primo giro, ★★ al secondo, poi ★
  (reputazione come prima). I giri si contano in `Profile.data.caviGiri`.
- Errori: la scheda li elenca e restano segnati in rosso. **Sistemo** torna
  al montaggio (la scaletta dice «Chiama Gerry»); **Apri così** apre con i
  cavi in giro, senza stelle né reputazione, e lo show ne trova le
  conseguenze come prima (`cavi.left`).
- `posa-cavi.html` resta come prototipo a sé (`tests/posa-cavi.js`), il
  gioco non lo apre più. Il test dentro il gioco è `tests/posa-cavi-gioco.js`.

## Decisi dopo la prova

- **Niente prolunghe**: ogni cavo ha la sua lunghezza e basta. Se una strada
  non ci sta, se ne cerca un'altra.
- **A tempo**: dalle 20:00 alle 20:30, un minuto vero sono sei minuti di
  gioco (cinque minuti in tutto, come lo scarico). L'orologio è in alto,
  corre solo mentre si posa (fermo con le regole o Gerry aperti) e negli
  ultimi cinque minuti lampeggia. Alle 20:30 Gerry passa comunque: se è
  tutto a posto conta come un giro chiesto; se no apre le porte così, la
  posa finisce **senza stelle** e la reputazione non cambia. La scaletta
  lo racconta («Finita col tempo»).
- Gerry è lo stesso disegno del discorso del preside (simbolo `#gerry` in `preside.html`).

## Più avanti

- cavi aerei sulle americane, canaline, multicore con
  splitter, cavi da tenere lontani dai tagli di luce della scena.
