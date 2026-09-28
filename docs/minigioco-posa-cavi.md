# Minigioco — La posa dei cavi (bozza di design)

Stato: **nel gioco** (livello 1, vedi *Integrazione nel gioco*):
`posa-cavi.html`, test `tests/posa-cavi.js` (la pagina da sola, con due
scenari fissi) e `tests/posa-cavi-gioco.js` (dentro il gioco). Le voci
*Da decidere* restano aperte.

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
| **Via di fuga libera** | La zona davanti all'uscita di sicurezza è rossa: il cavo non ci entra proprio (il dito si ferma e lo dice). |
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
- **Reputazione**, una volta sola: ★★★ +5, ★★ +3, ★ +1. Si può saltare
  dalla sua schermata iniziale: le porte si aprono, reputazione ferma.
- Il salvataggio tiene `cavi` (stelle, giri, metri di cavo e di nastro);
  una partita nuova la azzera.

**Da fare (proposta):**
- Nell'isometrico, dopo la posa, i cavi seguono il percorso steso invece
  dell'instradamento automatico (`computeRoutePoints`).
- Un cavo lasciato in un passaggio senza passacavi può diventare un
  imprevisto dello show (qualcuno inciampa e stacca il cavo: il guasto del
  microfono ha già la causa "cavo uscito dal suo ingresso").
- Il ronzio lasciato apposta si sente davvero durante il discorso del
  preside (un fruscio a 50 Hz sul canale del microfono).
- Passaggi e via di fuga anche al montaggio (posa guidata), così non si
  perdono sotto un pezzo.

## Da decidere

- **Prolunghe**: un cavo troppo corto si allunga con un secondo cavo dal
  baule? La giunta per terra in un passaggio sarebbe un errore in più.
- Orologio (20:00 → 20:30) o senza tempo?
- Più avanti: cavi aerei sulle americane, canaline, multicore con
  splitter, cavi da tenere lontani dai tagli di luce della scena.
