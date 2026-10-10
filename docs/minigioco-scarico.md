# Minigioco — Lo scarico (bozza di design)

Stato: **nel gioco** (livello 1, vedi *Integrazione nel gioco*). Deciso: si gioca **da soli con un collega CPU**;
i **danni dello scarico si pagano al montaggio**. Le voci *Da decidere*
restano aperte.

## In breve

Prima del montaggio c'è lo scarico (in scaletta alle **16:00**). Si aprono i
portelloni, dentro c'è tutto il materiale caricato stretto, e va portato
nelle zone giuste della venue prima delle 16:30. Visuale dall'alto, fisica
vera: i bauli pesanti hanno inerzia, i case con le ruote scappano sulla
rampa, gli oggetti fragili si rompono se sbattono. Al tuo fianco c'è
**Macio**, il collega CPU: forte, un po' lento, da chiamare quando un
case è troppo grosso per una persona sola.

Quello che rompi **ti manca al montaggio**. Si gioca in circa 5 minuti; il
primo scarico non si salta (è il tutorial), dal secondo sì.

## Il primo scarico come tutorial giocato (livello 1)

Lo scarico è la prima cosa che vede un giocatore nuovo, quindi è anche il
tutorial: niente regole da leggere prima, si impara facendo il lavoro.
Ogni idea arriva quando serve, con una riga nella barra d'aiuto in basso
(fuori dalla scena, con la X) e un segnale nel mondo.

| Momento | Cosa scopre il giocatore | Come |
|---|---|---|
| Arrivo | devo scaricare | cartello «FESTA DELLA SCUOLA — 16:00», la frase di Macio, *Apri il portellone*. Solo joystick e PRENDI. |
| Primi case | si spostano | davanti ci sono i Top e i ricambi, leggeri, in mano. |
| Case pesante | alcuni pesano | la scheda sopra il case: nome e peso a parole (LEGGERO, MEDIO, PESANTE, ⚠ 2 PERSONE), niente kg. Spingendolo in discesa o di corsa compare FERMO!. |
| Baule da due | non tutto si fa da soli | da solo non si muove (quasi), Macio lo dice, compare **AIUTO**. Da quella chiamata Macio è in squadra e porta da solo i case leggeri. |
| Furgone stivato | c'è un ordine | il case dietro dice ACCESSO BLOCCATO e lampeggiano quelli davanti. Il rack (mixer) sta dietro distro e case PAR. Calcolato dalle posizioni vere (`blockers()`). |
| Carrello | si ottimizza | arriva dopo due consegne a mano (o a 80 s): fino a 3 case leggeri sopra, un viaggio solo, si scarica stando in una zona. Passa il gradino. Se sbatte, il carico si fa male. |
| Fragile | le azioni hanno conseguenze | nastro ⚠ FRAGILE (valigetta, PAR, rack). Un urto: «Movimentazione brusca, −1 reputazione», al massimo −2. |
| Gradino | in due si alza | un case a spinta contro il gradino della palestra si ferma e compare **OH-ISSA**: un tocco, Macio conta «uno… due… ISSA!» e il case passa. Niente tempismo, niente errori. |
| Lavoro | conta come lavori | la barra LAVORO compare a metà (dopo il carrello o 7 case) con un giudizio a parole (Ottimo, Buono, Così così). Nella bolla: la barra, un giudizio e tre righe «come hai lavorato», prima quello che è andato meno bene. Niente percentuali. |
| Sorpresa | quello che scarico serve dopo | a «MATERIALE SCARICATO: 100%» Macio chiede del baule dei cavi: il baule SEGNALE era sotto il telo in fondo al furgone. È quello che si riapre al montaggio. |

**Comandi contestuali**: sul telefono restano sempre joystick e PRENDI
(che diventa LASCIA, CARICA, SCARICA). AIUTO, OH-ISSA e FERMO! compaiono solo
quando si possono usare in quel momento, e spariscono dopo (`showCmd()`).

**Tolti dal livello 1**: il ribaltamento del rack, il cavo incastrato da
tenere premuto, le barrette dello stato sopra i case e il bagliore rosso
«troppo veloce». Il danno si vede sul case (sobbalzo, graffi, ammaccature)
e nelle frasi di Macio.

**Primo scarico**: non si salta. Il tasto *Salta* e l'impostazione valgono
solo dopo averlo giocato una volta in quel salvataggio
(`Profile.data.scaricoPlayed`; il gioco passa `first=1` all'iframe). Senza
fisica (niente rete) si può sempre saltare.

Durata: 16:00 → 16:30 in 6 minuti reali. Il risultato porta in più
`eff` (efficienza %) e `rough` (movimentazioni brusche), salvati in
`Profile.data.scarico`.

## Core loop

### 1. Apertura dei portelloni (5 s)

- La camera parte sul retro del mezzo. Si aprono i portelloni. Se ci sono
  case **non legati** (vedi *Cinghie*), il primo può scivolare fuori
  subito: è una gag, ma può già far danni.
- Si vede l'interno del mezzo dall'alto: i case sono incastrati. Se ne
  prende uno alla volta, e **esce prima quello caricato per ultimo**:
  il baule pesante in fondo arriva solo quando hai liberato il davanti.
- Orologio in alto: 16:00 → 16:30 (1 minuto reale = 6 minuti di gioco).

### 2. Il giro di consegna (si ripete per ogni case)

1. **Prendi** il case dal mezzo. I case leggeri si portano in mano,
   quelli pesanti si spingono o si tirano.
2. **Scendi** dalla rampa o dalla sponda: è il punto più pericoloso, la
   pendenza spinge il case in giù.
3. **Attraversa** il percorso fino alla venue: porte, gradini, pavimento,
   passanti.
4. **Consegna** nella zona giusta. Ogni case ha il nastro colorato della
   sua zona (lo stesso stile dei nastri SEGNALE / CORRENTE dei bauli):

   | Nastro | Zona | Esempi |
   |--------|------|--------|
   | rosa | Backstage / allaccio | Generico CORRENTE, quadro |
   | giallo | Palco | case accessori (asta, microfono, ricambi) |
   | blu | Pit | sub, teste, stativi, PAR |
   | verde | Off Stage · regia | tavolo regia, rack regia, valigetta PC, Generico SEGNALE |

   La palestra dello scarico è quella del montaggio: il palco c'è già
   (si gira intorno) e le zone sono dove serviranno i pezzi.

   Zona giusta: il case "si aggancia" con una spunta. Zona sbagliata: il
   case resta lì e al montaggio c'è da riportarlo al suo posto (costa
   tempo in scaletta).
5. Torni al mezzo per il prossimo. Intanto Macio può portare da solo un
   case leggero (vedi *Il collega CPU*).

### 3. Fine dello scarico

- **Tutto consegnato prima delle 16:30**: bonus (vedi *Punteggio*).
- **Alle 16:30 manca ancora qualcosa**: niente game over. Macio e il
  bidello scaricano il resto **di corsa**. Ogni case scaricato così ha
  una probabilità di danno (più alta per i fragili), e il montaggio parte
  in ritardo.

### 4. Bolla di scarico

Una scheda riassume com'è andata: case per case lo stato (integro /
ammaccato / difettoso / rotto), il tempo, le birre e la reputazione. Poi
si passa al montaggio con quello che è arrivato davvero.

## Meccaniche di fisica e controllo

### Scarico a ordini (2026-10-10): niente joystick

Richiesta di Luca: nello scarico non si guida più il personaggio. Si dà un
ordine — **chi** (Tu o Macio), **cosa** (un case), **dove** (una zona),
**col carrello** o no — e il gioco lo esegue da solo: strada, presa,
trasporto, posa. Il joystick resta solo fuori dallo scarico (che non lo
aveva comunque). In `scarico.html`, sezione *ORDINI*.

- **Barra degli ordini** in basso (`#cmd`): i due pulsanti TU / MACIO con
  quello che stanno facendo, poi le azioni del momento: APRI IL PORTELLONE,
  TIRA GIÙ LA RAMPA, SGANCIA LA CINGHIA (uno per volta); scelto un case,
  CARRELLO, + SOPRA, le quattro zone (prima quella del nastro, con ✓) e ✕.
  Sulla scena si tocca/clicca un personaggio, un case, il carrello o una
  zona; trascinando si sposta la vista. Tasti: 1/2, C, Esc, P.
- **Un ordine = una fila di passi** (`buildSteps`): a mano raggiungi →
  prendi → porta → posa; col carrello, se il case è nel furgone lo si posa
  prima a terra accanto alla rampa, poi maniglie → pala sotto il case
  (CARICA) → l'eventuale case sopra (METTI SOPRA) → viaggio → SCARICA →
  carrello riportato accanto al furgone. Il carrello si muove solo con chi
  lo tiene dalle maniglie e va solo avanti o indietro (due ruote).
- **Percorsi** (`plan`): ricerca A* su griglia di 8 cm con otto versi per
  chi porta; ogni posa è provata con la sagoma vera (persona + case +
  carrello, con Matter.js) contro muri, bordi del pianale, case e persone.
  Una mappa delle distanze "a piedi" (`distField`) guida la ricerca e dice
  subito se una meta non si raggiunge. Seguendo la strada ci si ferma per
  chi passa (bambini, Gerry, il collega), si chiede permesso, dopo un po'
  si cerca un'altra strada; contro uno spigolo si scivola lungo il muro.
  Se non si arriva: ci si ferma, il case resta dov'è e la barra d'aiuto
  dice perché (nessun avanti e indietro: un controllo apposta).
- **Senso unico** (`LANES`): nel furgone con la rampa e nella porta della
  palestra si passa uno per volta; chi deve entrare aspetta di lato.
- **Dal furgone**: un case si sceglie solo se davanti non c'è niente
  (ACCESSO BLOCCATO, come prima); in più, per un case in mano si prova
  prima se poi esce dal furgone, e se no si dice quale case togliere prima
  (es. il QUADRO sopra la VALIGETTA).
- **Macio**: si sceglie come te. Tu gli dai l'ordine in un fumetto
  ("Macio, QUADRO in Backstage!") e lui risponde con le sue battute di
  sempre. Non tocca l'elettronica delicata. Al telefono, l'ordine aspetta.
- **Case da due** (tavolo, rack, sub): partono quando siete liberi tutti e
  due; ognuno va al suo lato e il tavolo si alza in due.
- **Posa**: un posto libero nella zona, dal fondo e lontano dai passaggi
  (rampa, porta della palestra, posto del carrello); la zona del case
  resta quella dove l'hai posato (`ce.zone`), come prima.
- **Bauli dei cavi** (Generico CORRENTE e SEGNALE): per ora niente fisica,
  sono già nelle loro zone (Backstage, Off Stage) e i cavi si prendono dai
  pulsanti di sempre al montaggio. Il vano del furgone è 2,1 m.
- **Urti**: con il percorso che evita i muri non ci sono più colpi da
  guida; i danni restano quelli già stabiliti dal passaggio al montaggio.

### Scarico pratico e fluido (2026-10-10, pomeriggio)

Richiesta di Luca: lo scarico deve essere semplice da comandare, fluido da
guardare e credibile, soprattutto sul telefono ("la complessità sta nel
lavoro del tecnico, non nell'interfaccia e non nella fisica"). Interventi
mirati sullo scarico a ordini, senza cambiarne la struttura:

- **Telefono, barra degli ordini**: in alto TU, MACIO e CARRELLO (+ SOPRA),
  sotto ✕ e le quattro zone tutte in vista (prima quella del nastro). Il
  nome del case si legge sulla scheda in scena, che dice anche chi lo porta
  e come ("TU · MEDIO · in mano · va in PIT") e DOPO L'ORDINE IN CORSO se
  chi è scelto è già occupato.
- **Tocco**: non serve centrare il case, vale il più vicino entro un dito
  (14 px di schermo); chi è già scelto non "ruba" il tocco a un case.
- **Telecamera**: sul case scelto; dato l'ordine torna sul furgone, dove c'è
  il prossimo case (prima seguiva chi lavorava fino in palestra e bisognava
  trascinare la scena a ogni ordine); scelto un collega, va su di lui.
- **Macio e l'elettronica**: con Macio scelto, toccando PC o PAR lui dice
  subito di no e l'ordine passa a TU (prima lo diceva solo alla fine).
- **Perché è fermo**: sopra la testa (e sul pulsante) una scritta breve
  gialla: ASPETTA IL FURGONE, ASPETTA LA PORTA, ASPETTA PC, ASPETTA IL
  COLLEGA, PRONTO, FA PASSARE GERRY; in rosso ✕ NON SI PUÒ quando un ordine
  si ferma (il perché è nella barra d'aiuto). Zona piena: l'ordine non parte
  e si dice subito.
- **Percorsi**: chi porta gira camminando (curve arrotondate partendo dai
  nodi della griglia, provate sulla posa vera); il carrello e i case a
  ruote fisse girano solo nel loro verso. Il calcolo guarda anche i giri che
  mancano per arrivare nel verso giusto: il calcolo più lungo di un giro è
  circa dimezzato (su questa macchina ~70-200 ms contro ~250-500 ms).
- **Incroci**: dietro a chi va più piano ci si accoda alla sua velocità;
  contro chi è fermo ci si ferma a un passo (niente avanti e indietro).
  Faccia a faccia, chi ha le mani libere si scansa subito, chi porta aspetta
  un attimo e poi gira attorno. Il collega fermo senza ordini sulla strada:
  "Permesso!" e si sposta di lato. Gerry col carrello delle pulizie: chi gli
  sta davanti si fa da parte ("Prego, Gerry!") e riparte quando è passato.
  Un urto (Gerry, un bambino) non trascina più nessuno: le persone e quello
  che tengono si muovono solo coi loro passi.
- **Carrello dal furgone**: il carrello aspetta accanto alla rampa; il case
  si porta a mano dritto sulla pala (niente più appoggio a terra e manovra
  per infilarci sotto la pala); se il carrello è lontano lo si va a
  prendere da soli. Poi + SOPRA, viaggio, scarico, carrello di nuovo alla
  rampa. Un bambino sulla pala: "Permesso!" e si aspetta.
- **Prova**: tests/scarico-fluido.js (tocchi veri sul telefono, tre giri
  completi con controllo di fermate, giri sul posto, carrello e urti,
  collega fermo, Gerry, zona piena). Su 18 giri diversi dello scarico
  completo: 18 finiti senza ordini falliti, fermate e ripartenze da
  ~130-800 a ~80-110 a giro.

### Revisione fisica del livello 1 (2026-10-07): un sistema solo, la PRESA

Richiesta di Luca: movimento e presa credibili prima di aggiungere altro.
Arcade ma controllabile; niente peso realistico, niente simulazione
avanzata. In `scarico.html` (sezione *MOVIMENTO E PRESA*):

- **Persone**: velocità impostata direttamente, con accelerazione e
  frenata brevi (`MOVE`: pieno in ~7 passi, fermo in ~4). Niente forze,
  niente scivolate, niente rimbalzi (restituzione 0).
- **Case a terra**: corpi fermi (`isStatic`). Non si spostano a spallate;
  si muovono solo se qualcuno li prende.
- **Presa** (`grab` → `w.hold`): quello che prendi resta rigido rispetto a
  te, alla distanza e con l'angolo di quando l'hai preso, e gira con te.
  Ogni passo (`holdStep`) prova la posizione nuova di persona + oggetto
  (+ carico del carrello) contro muri, case, carrello, bambini; se tocca
  prova senza girare, poi solo in x o in y (si scivola lungo il muro),
  poi più piano; se niente va, ci si ferma. Lasciato, resta lì.
- **In mano** (case leggeri): si gira abbastanza svelto, il case passa
  sopra il bordo del pianale ai lati della rampa e sopra il gradino.
- **Spinto** (pesanti, carrello): avanti spingi e giri piano; indietro
  tiri, senza girare; di lato (solo i case) ti sposti di fianco, come in
  due con un tavolo. Un case da due, da solo, non si muove.
- **Macio che aiuta** (`joinHelp`, `placeHelpers`): si mette sull'altro
  lato e da lì segue il case; niente più ritardo di 0,4 s né FERMO.
- **Carrello** (note di Luca, 2026-10-08): si prende solo dalle maniglie
  (dietro). Il case si appoggia a terra, si prende il carrello e si
  avvicina la pala al case: compare CARICA. Sopra ci sta un secondo case,
  se è piccolo e da mano: lo prendi, ti avvicini, compare METTI SOPRA.
  Col carrello in mano, da fermo, compare SCARICA: prima quello sopra va
  giù di fianco, poi quello sulla pala resta dov'è. Pulsante a parte
  (tasto F). Il carrello si muove come un case spinto; il carico resta
  fermo sopra ed è controllato contro i muri.
- **Furgone stivato pieno**: case uno contro l'altro, senza vuoti, a
  colonne dal portellone al fondo (carrello, stativi, PAR | generici |
  tavolo, accessori | quadro, PC, teste | sub, rack). Una sola cinghia in
  coda al carico tiene fermo tutto.
- **Furgone**: vano 2,7 × 2 m (pieno), parcheggiato col portellone a 3,8 m dalla
  porta della palestra (prima 7 m); porta della palestra a due ante,
  1,6 m. Persone larghe 38 cm (Macio 42).
- Test: `tests/scarico-fisica.js` (personaggio, case in mano, carrello,
  carico, furgone, tavolo in due fino all'Off Stage).

Le sezioni qui sotto su inerzia, ruote, pendenze, ribaltamento e ritardo
di Macio sono il design di partenza: per il livello 1 vale la PRESA.

Motore: **Matter.js** (è già dentro Phaser 3), in una scena a parte
`ScaricoScene`. La fisica lavora sul piano (vista dall'alto, gravità 0),
il disegno usa la stessa prospettiva isometrica del gioco (`isoFrame`,
`drawFlightCase`), così lo stile resta lo stesso.

### Controlli

Dal 2026-10-10 lo scarico va a ordini (vedi sopra).

| | Telefono / mouse | Tastiera |
|---|---|---|
| Chi lavora | tocco su TU / MACIO (o sul personaggio) | 1 / 2 |
| Il case | tocco sul case | — |
| Col carrello | CARRELLO, poi + SOPRA per un case piccolo | C |
| Dove | tocco su una zona (pulsante o scena) | — |
| Annulla / pausa | ✕ / ⏸ | Esc / P |
| Spostare la vista | trascinare la scena | — |

### Peso e inerzia

- Ogni case ha **massa** (kg) e **attrito col suolo** (in Matter:
  `frictionAir`, lo smorzamento della velocità).
- Il tecnico spinge con una **forza massima fissa**. Accelerazione =
  forza / massa: un case da 20 kg parte subito, un baule da 70 kg ci mette
  un attimo a partire **e ci mette un attimo a fermarsi**. È questa la
  sensazione da cercare: il baule che ti trascina oltre la porta.
- **In mano** (sotto i 25 kg): il case si muove col personaggio, che
  rallenta in base al peso e non può correre. Se lo lasci cadere, il case
  prende un colpo.
- **A spinta** (sopra i 25 kg): il personaggio si attacca a un lato (un
  vincolo di Matter) e spinge. Se spingi lontano dal centro il case
  **ruota**: cambiare direzione con un baule pesante vuol dire mettersi
  dalla parte giusta.
- **Ruote**. Qui c'è il caos buono:
  - *ruote piroettanti* (4 girevoli): scorre bene in tutte le direzioni,
    ma su una pendenza scappa via;
  - *2 fisse + 2 piroettanti*: scorre bene in avanti e male di lato
    (l'attrito laterale è più alto di quello in avanti). Si guida come un
    carrello della spesa;
  - *senza ruote*: attrito alto, si trascina a fatica, ma non scappa mai.
    Si può mettere sul **dolly** (vedi *Power-up*).
- **Pendenze** (rampa, sponda, scivolo): una forza costante verso il
  basso della rampa, proporzionale alla massa. Con le ruote piroettanti
  il case va trattenuto, non spinto.
- **Superfici**: cambiano l'attrito (asciutto / bagnato / erba) e possono
  aggiungere scossoni (sampietrini, ghiaia).
- **Ribaltamento**: i case alti e stretti (rack, case LED) hanno una
  **velocità di curva massima**. Se sterzi troppo forte, cadono di lato:
  animazione, colpo forte, poi vanno raddrizzati con un OH-ISSA.

### Spinta di coppia (tu + Macio)

- I case **ingombranti** hanno una **resistenza** più alta della forza di
  una persona. Da solo li muovi al 20% della velocità e ruotano, perché
  spingi da un lato solo.
- **AIUTO** vicino al case: Macio arriva (ci mette qualche secondo, ed è
  una scelta di tempi) e si attacca al **lato opposto** al tuo. Le due
  forze si sommano e le rotazioni si compensano: il case va dritto.
- Macio **segue la tua direzione con 0,4 s di ritardo**. In rettilineo
  va benissimo. In curva stretta, o se inverti di colpo, il case gira su
  se stesso. Il divertimento è qui: bisogna guidare "in largo", pensando
  a un'altra persona che reagisce in ritardo.
- **FERMO!** Macio frena subito. Serve in discesa sulla rampa.
- **OH-ISSA** per sollevare sopra un gradino, un cordolo o il bordo della
  sponda. Parte **da solo** quando spingi un case contro l'ostacolo (se
  pesa più di 45 kg, Macio arriva da solo a darti una mano). Macio conta
  «uno… due… ISSA!» e si preme una volta sola sull'ISSA (circa ±¼ di
  secondo). Riuscito: il case viene alzato e passa da solo. Troppo presto
  o troppo tardi: il case sbatte (piccolo danno) e dopo un attimo Macio
  ricomincia a contare. Per un case ribaltato si preme OH-ISSA lì vicino.
  (Nel prototipo la prima versione, una barra che oscillava e andava
  premuta due volte, era poco chiara.)
- I case lunghi (borsa stativi, truss) hanno anche il problema delle
  **porte**: vanno girati per passare, e con due persone si gira meglio.

### Il collega CPU: Macio

| Parametro | Valore (proposta) |
|---|---|
| Forza | 1,2 × la tua |
| Velocità a vuoto | 0,85 × la tua |
| Ritardo di reazione | 0,4 s (0,2 s dopo il caffè) |
| Tempo di arrivo | cammina davvero fino al case, niente teletrasporto |

Quando non gli dai ordini **non sta fermo**: prende da solo il case
leggero più vicino ancora da consegnare e lo porta nella sua zona. I case
che porta lui si fanno poco male (un quinto circa dei danni). Così tu
puoi pensare ai pesanti. **L'elettronica delicata però no**: la valigetta
del PC e il case PAR li porti tu («La valigetta del PC? No no, quella la
porti tu, capo»), così la fragilità resta una responsabilità del giocatore.

Due ordini:
- **Aiutami** (tocco su AIUTO): viene a spingere con te il case che hai in
  mano.
- **Porta tu** (AIUTO tenuto premuto su un case leggero): lo porta da solo
  alla sua zona. È lento ma sicuro, e **non si ferma per gli imprevisti**:
  il passante lo scansa, ma si prende un colpo. Intanto tu fai altro.

Macio ha anche una sua **stanchezza**: dopo 4–5 spinte pesanti rallenta e
sbuffa. Il caffè lo rimette in sesto. Non si arrabbia mai: commenta
(fumetti brevi: "Piano, piano…", "Questo pesa come mia suocera").

### Danni ai materiali

- A ogni urto Matter dà l'impulso della collisione (massa × velocità
  relativa). Sotto la **soglia di fragilità** del case non succede niente;
  sopra, l'**integrità** del case (0–100) scende in proporzione.
- Colpi tipici: sbattere contro uno stipite, un case che scivola giù
  dalla rampa, un ribaltamento, un case in mano lasciato cadere, un case
  lanciato contro un altro.
- Il case mostra il danno mentre giochi: graffi sul guscio, un angolare
  piegato, e un suono di vetro o di plastica per i fragili.
- **Barra di stato** sopra ogni case, sempre visibile: verde (integro),
  gialla (ammaccato), arancione (difettoso), rossa (rotto), con le tacche
  a 70, 40 e 15. Accanto al case PAR, 4 tacche con i PAR ancora sani.
- **Velocità di sicurezza**: ogni case ha una velocità oltre la quale un
  urto fa danno (la soglia della sua fragilità). Quando la supera, il case
  **si accende di rosso**: se sbatti adesso, si rovina. Così il danno non
  arriva mai a sorpresa.
- **Passo attento**: tenendo premuto Shift (o inclinando poco il
  joystick) vai a metà velocità, sotto la soglia di quasi tutto. Con la
  valigetta del PC in mano il passo si limita da solo.
- Regola di fondo: si rompe qualcosa solo per un errore riconoscibile
  (curva stretta, corsa col PC in mano, case lasciato andare sulla rampa,
  caduta dal pianale), mai per sfortuna.

| Integrità | Stato | Cosa succede al montaggio |
|---|---|---|
| 100–70 | **Integro** | niente |
| 69–40 | **Ammaccato** | solo estetico: il case resta segnato (per ora) |
| 39–15 | **Difettoso** | l'apparecchio arriva con un problema da sistemare: tocco lungo sul pezzo, "stai controllando…", e 10 minuti in più in scaletta |
| 14–0 | **Rotto** | l'apparecchio **non c'è** al montaggio: nel gioco, un pezzo in meno in `AVAILABLE_STOCK` |

**Regola per non bloccare il livello**: gli apparecchi di cui ne esiste
uno solo e senza i quali l'impianto non funziona (mixer, finale, PC,
scheda, quadro, controller DMX, casse) **non scendono sotto Difettoso**.
Si può rompere del tutto solo ciò che ha un doppione o un ricambio:

- **PAR**: se ne arriva uno in meno, il Test impianto chiede i PAR
  arrivati sani, ma la fase perde la 🍺 del "senza guasti". Il **case di
  ricambio** (quello che oggi sta sulla banchina) contiene 1 PAR di
  scorta: montarlo costa tempo, però salva la birra.
- **Stativi, asta, microfono**: nel case di ricambio c'è uno stativo e un
  microfono di scorta.
- **Case di ricambio rotto**: niente scorte per la serata.

Esempi di "difettoso" per gli apparecchi unici: finale in protezione
all'accensione, mixer con un fader che gratta, PC che non si accende al
primo colpo, cassa con la griglia ammaccata che vibra. Ognuno si sistema
con il tocco lungo; più avanti potrà diventare un guasto vero da gestire
durante lo show.

### Reputazione e birre (deciso)

Nel livello 1 la regola è che "l'apparecchio rotto non conta, non è colpa
del giocatore". Allo scarico invece è colpa della crew, quindi propongo:

- 🍺 **Scarico senza rotture** (nessun Rotto; ammaccato e difettoso vanno bene).
- 🍺 **Scarico in orario** (tutto consegnato entro le 16:30, zone giuste).
- **+3 reputazione**: scarico senza nessun danno (una volta sola per
  service, come le altre fasi).
- **−2 reputazione** per ogni apparecchio Rotto allo scarico.

Deciso: i pezzi rotti pesano in reputazione, −2 per ogni apparecchio
Rotto (`REP.scaricoBroken`, già nel gioco).

## Livelli e variabili ambientali

Cinque scenari che crescono con i mezzi (`LEVEL_VEHICLE`: furgone →
camion → bilico). Il primo si fa subito, gli altri sono design per i
livelli futuri.

### 1. Festa della scuola — furgone (livello 1, tutorial)

- **Accesso**: il furgone entra in cortile. Rampa di alluminio corta dal
  portellone, poi asfalto liscio fino alla palestra.
- **Ostacoli**: il **gradino della porta** della palestra (primo OH-ISSA,
  spiegato da Macio); la porta antipanico che si richiude da sola se
  nessuno la tiene; bambini che corrono in cortile (passanti veloci ma
  prevedibili); Gerry Scotti, il bidello, che passa col carrello delle
  pulizie. Bambini e Gerry non spingono contro gli ostacoli: guardano un
  passo avanti, rallentano, si fermano e girano di lato dove c'è posto; i
  bambini fanno spazio a chi porta un case, Gerry aspetta («Prego!») e si
  sposta di corsia (`kidAdapt`, `gerryStep`, test `tests/scarico-npc.js`).
- **Tempo**: largo, 30 minuti di gioco per circa 12 pezzi.
- **Insegna**: peso, rampa, spinta in coppia, zone.

### 2. Sagra in piazza — camion, sampietrini

- **Accesso**: il camion si ferma all'ingresso della ZTL. Si fanno 40
  metri di **sampietrini**.
- **Sampietrini**: velocità massima ridotta, scossoni che fanno danni
  **continui** ai fragili (poco, ma sempre), le ruote piccole si
  **impuntano** tra le pietre e il case si ferma di colpo (l'inerzia fa
  ribaltare i case alti). C'è una **striscia liscia** (il marciapiede in
  lastre) che è la strada giusta, ma è stretta e piena di tavolini del bar.
- **Ostacoli**: tavolini e sedie della sagra, la fontana in mezzo alla
  piazza, i volontari con le casse di vino.
- **Insegna**: scegliere il percorso, non solo andare veloci.

### 3. Matrimonio in villa — pioggia

- **Accesso**: il camion resta sul viale di ghiaia, poi prato fino al
  gazebo.
- **Pioggia**: la **rampa bagnata** ha attrito ridotto, quindi i case con
  ruote piroettanti in discesa vanno tenuti con FERMO!. Il prato diventa
  fango: le ruote affondano e servono spinte in coppia o il dolly.
  L'elettronica **fuori dal gazebo** prende danni lenti per l'acqua: si
  può coprire un case con un telo (1 azione).
- **Ostacoli**: il fotografo che fa le prove sul viale, il catering con i
  carrelli, la wedding planner che vuole "i case neri **non** davanti
  agli ospiti" (un percorso più lungo sul retro).
- **Insegna**: attrito variabile, scegliere l'ordine in base al rischio.

### 4. Teatro comunale — sponda idraulica guasta

- **Accesso**: il camion ha la **sponda idraulica**, un ascensore che
  porta un case alla volta da terra al pianale. Poi montacarichi del
  teatro fino al palcoscenico.
- **Sponda guasta**: a metà scarico si **blocca a mezz'altezza**. Due
  soluzioni: tornare al camion e pompare a mano (mini-azione ritmata, 20
  secondi fermo), oppure fare lo scivolo con le assi (veloce ma ripido,
  con alto rischio di case che scappano).
- **Montacarichi**: porta due case alla volta ed è lento; chi aspetta
  blocca il corridoio.
- **Ostacoli**: la maschera del teatro che controlla i pass, il
  corridoio stretto con le curve a 90° (la borsa stativi non passa se non
  la giri in coppia), il sipario già calato.
- **Insegna**: code, colli di bottiglia, decidere come aggirare un guasto.

### 5. Concerto al palazzetto — bilico, tempi stretti

- **Accesso**: banchina di carico vera, ma **il bilico è arrivato in
  ritardo**. Porte fra 45 minuti, e lo scarico ne ha 15.
- **Tempi stretti**: l'ordine conta. Il palco vuole prima i **motori**
  (vedi sotto) per il rigging, poi il resto. Consegnare nell'ordine
  sbagliato blocca la zona del palco.
- **Ostacoli**: muletti di un altro service che attraversano la banchina
  (non si fermano), il cavo **multipolare** da 50 m che va srotolato
  lungo il percorso e diventa un ostacolo per le ruote, il runner che
  chiede ogni due minuti "Tutto a posto?".
- **Insegna**: tutto insieme, sotto pressione.

## Continuità fra scarico e montaggio

Il materiale che scarichi è lo stesso che monti: la continuità si vede, non
si spiega. Il montaggio non cambia: legge solo i dati che lo scarico lascia.

- **Pausa finale** (circa 9 s, un tocco la accorcia): dopo
  «MATERIALE SCARICATO 100%» e il baule SEGNALE la telecamera passa sul
  piazzale vuoto e poi sulle zone con i case al loro posto. Macio: «Ok. È
  tutto giù.» … «Adesso possiamo cominciare.» Poi la bolla, e dopo «Al
  montaggio» un cartello breve «16:30 — MONTAGGIO» (l'ora vera, col ritardo).
- **Dati**: il risultato porta `cases`, uno per case: `id`, `name`, `short`,
  `what`, `zone` (dove andava), `at` (dove l'hai lasciato), `state`
  (integro, ammaccato, difettoso, rotto), `dents` (ammaccature visibili,
  0-6), `rushed`. Finisce in `Profile.data.scarico.cases`.
- **API in main.js**: `scaricoCase(id)` dà il case; `caseOfPiece(compId)`
  il case da cui esce un pezzo posato (`PIECE_FROM_CASE`: sub → Sub 1 e
  Sub 2, finale e mixer → Rack, Quadro e ciabatte → Distro, PC, scheda e
  controller → Valigetta, PAR → Case PAR e ricambi, stativi…). I case
  difettosi escono per primi, come in `isFaulty`. Scarico saltato o
  salvataggio vecchio: `null`, e il montaggio va come prima.
- **Al montaggio**: il primo pezzo che esce da un case lo «apre»
  (avviso «CASE SUB 1 · Pit»); il pannello del pezzo e quello del baule
  hanno la riga del case. Se il case ha preso colpi «ha ancora
  l'ammaccatura» e la prima volta Macio: «Questo ha preso una bella botta.»
- **Danni scoperti**: il messaggio d'inizio montaggio non elenca più i pezzi
  difettosi; li trovi sul pezzo (segno arancione, «Qualcosa non va: …»),
  con la stessa riparazione di prima.
- **Case in palestra (dal 2026-10-10 non più disegnati)**: al montaggio i
  case dello scarico non compaiono più a terra in palestra; resta il
  furgone. I dati (`cases`, zona dove l'hai lasciato, stato, ammaccature,
  difetti) restano e si vedono nella riga del case dei pannelli. I bauli
  dei cavi si aprono dai pulsanti SEGNALE e CORRENTE della scheda Cavi; se
  sono arrivati aggrovigliati il pulsante ha il segno arancione «!».

### Specifiche di Luca del 2026-10-07 sera

- **TESTA**, mai TOP, in tutto il gioco (scarico, montaggio, carico).
- **Carico come da specifica**: vicino al portellone il carrello a due
  ruote, stativi, PAR, case accessori e i due generici dei cavi
  (CORRENTE → Backstage, SEGNALE → Off Stage, non più sotto il telo); in
  mezzo tavolo regia, quadro e PC; in fondo sub, teste e rack.
- **Carrello a due ruote da facchino**: lo tira fuori Macio appena la rampa
  è giù. Tre posti; un case pesante (≥ 35 kg) ne prende due; i case da due
  (tavolo, rack) non ci stanno. Si carica anche un case spinto. Nelle zone
  LASCIA posa a terra, non ricarica.
- **Peso a categorie**: LEGGERO, MEDIO, PESANTE (in due).
- **Macio**: battute rare e corte («Quello lo facciamo in due.», «Prima
  liberiamo il passaggio.», «Prendi il carrello. Non siamo qui per fare
  palestra.»). Nessun ERRORE per l'ordine.
- **Riepilogo SCARICO COMPLETATO**: materiale scaricato, danneggiato,
  viaggi, uso del carrello, organizzazione, efficienza, stelle. Pesa sulla
  serata come prima (ritardo, danni, reputazione, birre).
- Il palco nella palestra dello scarico si attraversa (ha la scaletta).

### Il furgone (note di Luca del 2026-10-07)

- Si arriva col **furgone chiuso**: APRI il portellone, poi RAMPA.
- Dentro i case sono **legati con tre cinghie** (una per fila) e quelli con
  le ruote hanno il **freno tirato**, come al carico: CINGHIA e FRENO vicino
  al case. Un case legato o frenato non si muove e blocca quelli dietro.
  Il case ricambi non era legato e scivola giù dalla rampa.
- **Macio aiuta davvero**: quando spingi un case pesante arriva da solo a
  spingere con te; se è libero porta lui i case leggeri.
- **Carrello**: tre posti disegnati; con un case in mano vicino al carrello
  il posto libero lampeggia con «CARICA QUI».

## Tipi di flight case e materiali

Valori di partenza da provare nel prototipo. Scorrevolezza: 1 = si
trascina a fatica, 5 = scappa da sola. Ingombro in celle da 0,5 m.

### Livello 1 (festa della scuola)

| Case | Peso | Ruote | Scorr. | Fragilità | Ingombro | Persone | Se si rompe |
|---|---|---|---|---|---|---|---|
| Baule SEGNALE (cavi) | 45 kg | 4 piroettanti | 4 | bassa | 2×1 | 1 | mai oltre Difettoso (cavi aggrovigliati: tempo) |
| Baule CORRENTE (cavi pesanti, CEE) | 70 kg | 4 piroettanti | 4 | bassa | 2×1 | 1 lento, meglio 2 | mai oltre Difettoso |
| Sub (×2) | 40 kg | 2 fisse + 2 piroettanti | 3 | media | 2×2 | 1 | Difettoso: vibra |
| Top (×2) | 20 kg | in mano | — | media (cono) | 1×1 | 1 | Difettoso: gracchia |
| Case PAR (4 PAR) | 25 kg | in mano | — | **alta** (lenti) | 1×1 | 1 | un PAR si rompe ogni 25 punti di danno accumulati (niente dadi) |
| Rack regia (mixer + finale) | 55 kg | 2 fisse + 2 piroettanti | 3 | alta | 1×1, **alto** (si ribalta) | 2 | Difettoso: mixer o finale |
| Borsa stativi (4 stativi + asta) | 22 kg | in mano | — | bassa | **6×1** (lunga) | 1, porte in 2 | uno stativo piegato = Rotto |
| Case distro (quadro + ciabatte) | 35 kg | senza ruote | 1 | bassa | 1×1 | 1 (trascinato) o dolly | Difettoso: quadro che scatta |
| Valigetta regia (PC, scheda, controller DMX) | 8 kg | in mano | — | **altissima** | 1×1 | 1 | Difettoso: PC lento ad avviarsi |
| Case di ricambio | 18 kg | in mano | — | media | 1×1 | 1 | perdi le scorte |

### Livelli successivi

| Case | Peso | Ruote | Scorr. | Fragilità | Ingombro | Persone | Nota di gioco |
|---|---|---|---|---|---|---|---|
| Baule motori (2 paranchi a catena) | 120 kg | 4 piroettanti grosse | 2 | bassa | 2×2 | **2** | lentissimo a partire, impossibile da fermare in discesa |
| Multipolare (bobina 50 m) | 60 kg | bobina (rotola) | 5 in linea, 1 di lato | bassa | 1×1 | 1 | se si srotola lascia un cavo per terra: ostacolo per tutti |
| Schermi LED (case da 6 pannelli) | 75 kg | 2 fisse + 2 piroettanti | 3 | **altissima** | 2×1, **alto** | 2 | si ribalta in curva; un pannello rotto = pixel morti nello show |
| Testata valvolare (backline) | 25 kg | in mano | — | **altissima** (valvole) | 1×1 | 1 | ogni colpo può bruciare una valvola: suono che crepita |
| Teste mobili (case da 2) | 50 kg | 4 piroettanti | 4 | alta | 2×1 | 1 | vanno tenute dritte (bloccate in tilt) |
| Truss (tralicci da 3 m) | 30 kg | in mano, in 2 | — | bassa | **6×1** | 2 | il "divano" di Moving Out: porte, curve, scale |
| Consolle digitale | 40 kg | 2 fisse + 2 piroettanti | 3 | alta | 2×1 | 1 | le porte strette la costringono a girare |

## Power-up e imprevisti

### Power-up

- **Pausa caffè** (la moka in cabina o il bar di fronte): 20 secondi
  fermi, poi per 45 secondi tu e Macio siete più veloci e Macio reagisce
  più in fretta. Ma **conta nella stanchezza** del montaggio: il caffè ti
  presta energia, la birra ti riposa. Uno per scarico.
- **Dolly** (piattaforma con ruote): metti sopra un case senza ruote e
  diventa un case a 4 piroettanti. Uno solo, va riportato al mezzo.
- **Cinghie a cricchetto**: se i case sono legati, all'apertura dei
  portelloni **non cade niente**. Nel livello 1 sono legati a metà (la
  gag del primo case che scivola); quando arriverà il carico a fine
  serata, legarli bene sarà compito del giocatore.
- **Nastro gaffer**: sistema al volo un case Ammaccato prima che
  peggiori (la maniglia che si stacca, il coperchio che si apre). Tre
  pezzi per scarico.
- **Telo**: copre un case dalla pioggia.
- **Radio "Oh-issa!"**: per 30 secondi Macio è sincronizzato, senza
  ritardo e con OH-ISSA sempre perfetti.

### Imprevisti del settore

A copione (sempre uguali, si imparano) più 1–2 pescati a caso per la
rigiocabilità. Nel livello 1 al massimo uno alla volta.

- **Il cavo incastrato**: dal baule SEGNALE esce la coda di un XLR che si
  impiglia in una ruota. Il case si ferma di colpo, e chi lo segue ci
  sbatte contro. Bisogna tornare indietro e liberarlo (tocco lungo).
- **Il passante sulla rampa**: "Scusi, ma chi suona stasera?". Si ferma
  proprio sulla rampa. Il tasto AIUTO lontano da un case diventa
  "Permesso!" e lo fa spostare dopo un secondo; spingergli addosso un case costa
  reputazione.
- **La porta antipanico** che si richiude: la tiene Macio (ma allora non
  spinge), un case usato come fermaporta, o il cuneo.
- **Il vigile**: il mezzo è in divieto di sosta. A metà scarico va
  spostato di 20 metri: la rampa cambia posto e il percorso si allunga.
- **La maniglia che si stacca**: il case in mano cade (piccolo danno) e
  da lì si può solo spingere.
- **La ruota che si blocca**: il case tira da un lato, come un carrello
  della spesa rotto.
- **Macio al telefono**: "È mia moglie, un attimo…". Per 15 secondi è
  fermo. Arriva sempre nel momento peggiore.
- **Il fonico della band che arriva presto e "dà una mano"**: prende un
  case a caso e lo porta nella zona sbagliata.
- **Scroscio di pioggia** (solo scenari all'aperto): 30 secondi di
  rampa bagnata e danni da acqua ai case scoperti.
- **Le pizze del catering**: il fattorino in motorino taglia il
  percorso. Se ne salvi il cartone, Macio è più veloce per 30 secondi.

## Punteggio e record

- Nella bolla di scarico: tempo, case consegnati nella zona giusta,
  danni (per stato), imprevisti gestiti.
- Birre e reputazione come sopra.
- Nei record del livello (`Profile.data.records`) si aggiungono i dati
  grezzi dello scarico (tempo, danni, zone sbagliate), come per il
  collaudo.

## Integrazione nel gioco

**Fatto** (livello 1). Il minigioco è `scarico.html`: si apre da solo nel
browser oppure dentro il gioco, dove `index.html` lo carica a tutto
schermo in un iframe (`?embed=1&service=…`) e riceve il risultato con
`postMessage` (`scarico-fine`). Così fisica, tasti e stili dello scarico
non toccano la scena di Phaser.

- **Quando**: nuova partita → scaletta della serata → "Al lavoro!" apre
  lo scarico → bolla di scarico → "Al montaggio". Nella scaletta la voce
  delle 16:00 diventa "Fatto" con il riassunto (ora di fine, pezzi rotti,
  da sistemare, birre) e il montaggio mostra l'ora vera d'inizio
  (16:30 più il ritardo).
- **Saltare**: dopo il primo scarico giocato, dalla schermata iniziale
  dello scarico ("Salta lo scarico") o dalle impostazioni ("Salta lo
  scarico a inizio partita"): tutto arriva sano, niente birre. Senza rete Matter.js non si carica e lo
  scarico si può solo saltare.
- **Montaggio**: i pezzi rotti mancano dalla dotazione (`levelStock()` in
  `main.js`); il case ricambi, se arriva sano, rimpiazza un PAR e uno
  stativo. Il Test impianto chiede i PAR arrivati (`parsRequired()`: uno
  per stativo, fino a 4). Anche "Reset livello" usa la dotazione ridotta.
  Il messaggio d'inizio montaggio dice che ore sono e cosa manca.
  Anche il giro luci si adatta (`lightingCheck`, `lightsPlan`): con 4 PAR
  due frontali e due tagli, con 3 due frontali e un taglio, con 2 i due
  frontali, con 1 un frontale. Prima i frontali: il preside non deve
  restare al buio.
- **Reputazione**: +3 scarico senza danni, −2 per ogni pezzo rotto, −1
  per ogni bambino urtato (`REP.scarico*`), una volta sola per partita
  (`L1:scarico`).
- **Salvataggio**: versione 4 di `scs-save`, con `scarico` (null finché
  non è fatto) e l'impostazione `skipScarico`. Dalla versione 3: una
  partita già avviata conta lo scarico come saltato. Una partita chiusa a
  metà scarico riparte dalla scaletta.
- **Test**: `tests/scarico.js` gioca uno scarico vero dentro il gioco (PAR
  e stativi rotti) e controlla dotazione, Test impianto, reputazione,
  scaletta, ricarica, partita interrotta e impostazione "salta". Gli altri
  test saltano lo scarico dal suo tasto.
- **Pezzi difettosi** (fatto): chi arriva "difettoso" al montaggio ha un
  **segno arancione "!"** sopra (anche i bauli dei cavi). Si tocca il pezzo
  e nel suo pannello si preme **"Controlla e sistema"** (un attimo di
  lavoro, poi il capo spiega cosa hai sistemato); lo stativo si sistema
  col solo tocco; il baule aggrovigliato non dà cavi finché non premi
  **"Sbroglia i cavi"**. Nel foglio di montaggio compare la voce "Pezzi
  difettosi dello scarico controllati" nel giro del pezzo (corrente:
  quadro; audio: finale, sub, top, PC; luci: PAR, stativi): la prova del
  giro non passa finché non è a posto. Codice: `FAULT_BY_CASE`, `FAULTS`,
  `isFaulty`, `fixFault` in `main.js`.
- **Birre** (fatto): quelle dello scarico si sommano in
  `Profile.data.beers` e si vedono in testata (🍺). Saranno la risorsa per
  la stanchezza del documento del livello 1.
- **Grafica**: resta la vista dall'alto, rifinita: livrea del furgone
  nei colori del service, ruote, specchietti e fanali; recinzione e muri
  della palestra; porta, finestre, spalliere, sipario e scaletta del palco;
  personaggi che camminano (piedi e mani), gocce di sudore spingendo da
  soli un case da due; ruote dei case (le piroettanti girano col moto) e
  maniglie; polvere negli urti, scintille nei danni, onda colorata alle
  consegne, vapore della moka. L'isometrico resta un'idea per dopo.
- **Vista S1** (2026-10-10): dall'alto con la telecamera inclinata in
  avanti, scelta da Luca. Cambia solo il disegno: la fisica resta in pianta.
  A schermo y si accorcia (`KY` 0,78) e le altezze salgono (`KZ` 0,63):
  dei case, del furgone, dei muri, della panchina e della moka si vedono
  coperchio e faccia davanti, disegnati dal fondo verso chi guarda. La
  fiancata davanti del furgone e il muro in fondo alla palestra sono
  tagliati bassi, così il carico e le zone si vedono. Le altezze dei case
  sono in `CASE_Z`. I tocchi prendono la sagoma in piedi (coperchio e
  facce, `caseAtScreen`), le persone si toccano anche sulla testa.
  Personaggi in piedi: Topsy è la foto della sua action figure
  (`img/personaggi/topsy-s1.png`), gli altri il ritratto a caricatura di
  oggi (`personaggi-s1.js`) finché non hanno la loro immagine; senza
  immagine, una sagoma. Test: `tests/scarico-s1.js`.
- **Più avanti**: i case consegnati nella zona sbagliata costano solo
  tempo (potranno comparire lì nel montaggio); scenari 2-5 coi mezzi più
  grandi.
- **Nota di stile**: nello spettacolo resta la regola "nessun omino da
  muovere". Lo scarico è l'unico momento con un personaggio da guidare,
  ed è voluto: è la parte fisica del mestiere.

## Decisi

- Pezzi rotti allo scarico: −2 di reputazione ciascuno.
- La durata: 30 minuti di gioco in 5 minuti reali (con 3 minuti era
  troppo difficile finire in tempo).

## Da decidere

- Il carattere di Macio. Deciso il nome: **Macio** (prima era Tonino).
  L'aspetto resta quello di oggi: pelato, baffi scuri, aria seria.
- Il carico all'uscita (a fine serata, dopo il karaoke): un **minigioco a
  sé, tipo puzzle**, non lo scarico al contrario. Prima versione nel gioco:
  il tetris del furgone, le cinghie e la prova su strada, in
  `docs/minigioco-carico.md`.

## Il minigioco

`scarico.html` (nato come prototipo in `prototipi/`): scenario 1 completo,
con i 12 case del livello 1, Macio, rampa, gradino con OH-ISSA,
ribaltamento del rack, dolly, pausa caffè, cavo incastrato, passanti,
bidello col carrello, Macio al telefono e bolla di scarico finale. La
vista è dall'alto (la fisica è la stessa che servirà in isometrico). I
numeri da tarare sono in cima al file (`WHEEL`, `FRAG`, `CASES`,
`GAME_SECONDS`).

### Taratura dei danni

| Fragilità | Velocità di sicurezza | Danno per urto a piena velocità |
|---|---|---|
| bassa (bauli, distro, stativi) | 3,6 | 0 (solo cadute: −18) |
| media (top, sub, ricambi) | 2,3 | circa −8 |
| alta (rack, case PAR) | 1,9 | circa −15 (un PAR ogni 25) |
| altissima (valigetta PC) | 1,3 | circa −13 (passo limitato); 0 col passo attento |
