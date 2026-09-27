# Minigioco — Lo scarico (bozza di design)

Stato: **in definizione**. Deciso: si gioca **da soli con un collega CPU**;
i **danni dello scarico si pagano al montaggio**. Le voci *Da decidere*
restano aperte.

## In breve

Prima del montaggio c'è lo scarico (in scaletta alle **16:00**). Si aprono i
portelloni, dentro c'è tutto il materiale caricato stretto, e va portato
nelle zone giuste della venue prima delle 16:30. Visuale dall'alto, fisica
vera: i bauli pesanti hanno inerzia, i case con le ruote scappano sulla
rampa, gli oggetti fragili si rompono se sbattono. Al tuo fianco c'è
**Tonino**, il collega CPU: forte, un po' lento, da chiamare quando un
case è troppo grosso per una persona sola.

Quello che rompi **ti manca al montaggio**. Si gioca in 2–3 minuti e si
può saltare.

## Core loop

### 1. Apertura dei portelloni (5 s)

- La camera parte sul retro del mezzo. Si aprono i portelloni. Se ci sono
  case **non legati** (vedi *Cinghie*), il primo può scivolare fuori
  subito: è una gag, ma può già far danni.
- Si vede l'interno del mezzo dall'alto: i case sono incastrati. Se ne
  prende uno alla volta, e **esce prima quello caricato per ultimo**:
  il baule pesante in fondo arriva solo quando hai liberato il davanti.
- Orologio in alto: 16:00 → 16:30 (1 minuto reale = 10 minuti di gioco).

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
   | giallo | Palco | stativi, PAR, asta e microfono |
   | rosa | Backstage / allaccio | quadro, baule CORRENTE |
   | blu | Pit / impianto | sub, top |
   | verde | Regia (FOH) | rack regia, valigetta PC |

   Zona giusta: il case "si aggancia" con una spunta. Zona sbagliata: il
   case resta lì e al montaggio c'è da riportarlo al suo posto (costa
   tempo in scaletta).
5. Torni al mezzo per il prossimo. Intanto Tonino può portare da solo un
   case leggero (vedi *Il collega CPU*).

### 3. Fine dello scarico

- **Tutto consegnato prima delle 16:30**: bonus (vedi *Punteggio*).
- **Alle 16:30 manca ancora qualcosa**: niente game over. Tonino e il
  bidello scaricano il resto **di corsa**. Ogni case scaricato così ha
  una probabilità di danno (più alta per i fragili), e il montaggio parte
  in ritardo.

### 4. Bolla di scarico

Una scheda riassume com'è andata: case per case lo stato (integro /
ammaccato / difettoso / rotto), il tempo, le birre e la reputazione. Poi
si passa al montaggio con quello che è arrivato davvero.

## Meccaniche di fisica e controllo

Motore: **Matter.js** (è già dentro Phaser 3), in una scena a parte
`ScaricoScene`. La fisica lavora sul piano (vista dall'alto, gravità 0),
il disegno usa la stessa prospettiva isometrica del gioco (`isoFrame`,
`drawFlightCase`), così lo stile resta lo stesso.

### Controlli

| | Telefono | Tastiera |
|---|---|---|
| Muoversi | joystick virtuale a sinistra | WASD / frecce |
| Prendi / lascia | tasto grande a destra | Spazio |
| Chiama Tonino | tasto AIUTO (tocco = aiutami, tenuto = "porta tu") | E |
| Oh-issa (sollevare insieme) | tasto OH-ISSA a tempo | Q |
| Frena / FERMO! | rilasciare il joystick; doppio tocco = FERMO! | Shift |

Niente mira fine: il personaggio si aggancia al lato del case più vicino.

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

### Spinta di coppia (tu + Tonino)

- I case **ingombranti** hanno una **resistenza** più alta della forza di
  una persona. Da solo li muovi al 20% della velocità e ruotano, perché
  spingi da un lato solo.
- **AIUTO** vicino al case: Tonino arriva (ci mette qualche secondo, ed è
  una scelta di tempi) e si attacca al **lato opposto** al tuo. Le due
  forze si sommano e le rotazioni si compensano: il case va dritto.
- Tonino **segue la tua direzione con 0,4 s di ritardo**. In rettilineo
  va benissimo. In curva stretta, o se inverti di colpo, il case gira su
  se stesso. Il divertimento è qui: bisogna guidare "in largo", pensando
  a un'altra persona che reagisce in ritardo.
- **FERMO!** Tonino frena subito. Serve in discesa sulla rampa.
- **OH-ISSA** per sollevare sopra un gradino, un cordolo o il bordo della
  sponda. Parte una barra con la mano di Tonino che si chiude a ritmo:
  premi nella finestra giusta e il case passa pulito. Fuori tempo, il case
  sbatte (piccolo danno) e si riprova.
- I case lunghi (borsa stativi, truss) hanno anche il problema delle
  **porte**: vanno girati per passare, e con due persone si gira meglio.

### Il collega CPU: Tonino

| Parametro | Valore (proposta) |
|---|---|
| Forza | 1,2 × la tua |
| Velocità a vuoto | 0,85 × la tua |
| Ritardo di reazione | 0,4 s (0,2 s dopo il caffè) |
| Tempo di arrivo | cammina davvero fino al case, niente teletrasporto |

Due ordini:
- **Aiutami** (tocco su AIUTO): viene a spingere con te il case che hai in
  mano.
- **Porta tu** (AIUTO tenuto premuto su un case leggero): lo porta da solo
  alla sua zona. È lento ma sicuro, e **non si ferma per gli imprevisti**:
  il passante lo scansa, ma si prende un colpo. Intanto tu fai altro.

Tonino ha anche una sua **stanchezza**: dopo 4–5 spinte pesanti rallenta e
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

### Reputazione e birre (proposta)

Nel livello 1 la regola è che "l'apparecchio rotto non conta, non è colpa
del giocatore". Allo scarico invece è colpa della crew, quindi propongo:

- 🍺 **Scarico senza rotture** (nessun Rotto; ammaccato e difettoso vanno bene).
- 🍺 **Scarico in orario** (tutto consegnato entro le 16:30, zone giuste).
- **+3 reputazione**: scarico senza nessun danno (una volta sola per
  service, come le altre fasi).
- **−2 reputazione** per ogni apparecchio Rotto allo scarico.

*Da decidere*: se il −2 va bene o se lo scarico deve pesare solo in birre.

## Livelli e variabili ambientali

Cinque scenari che crescono con i mezzi (`LEVEL_VEHICLE`: furgone →
camion → bilico). Il primo si fa subito, gli altri sono design per i
livelli futuri.

### 1. Festa della scuola — furgone (livello 1, tutorial)

- **Accesso**: il furgone entra in cortile. Rampa di alluminio corta dal
  portellone, poi asfalto liscio fino alla palestra.
- **Ostacoli**: il **gradino della porta** della palestra (primo OH-ISSA,
  spiegato da Tonino); la porta antipanico che si richiude da sola se
  nessuno la tiene; bambini che corrono in cortile (passanti veloci ma
  prevedibili); Gerry Scotti, il bidello, che passa col carrello delle
  pulizie.
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
| Case PAR (4 PAR) | 25 kg | in mano | — | **alta** (lenti) | 1×1 | 1 | ogni colpo forte può rompere **un** PAR |
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
  fermi, poi per 45 secondi tu e Tonino siete più veloci e Tonino reagisce
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
- **Radio "Oh-issa!"**: per 30 secondi Tonino è sincronizzato, senza
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
- **La porta antipanico** che si richiude: la tiene Tonino (ma allora non
  spinge), un case usato come fermaporta, o il cuneo.
- **Il vigile**: il mezzo è in divieto di sosta. A metà scarico va
  spostato di 20 metri: la rampa cambia posto e il percorso si allunga.
- **La maniglia che si stacca**: il case in mano cade (piccolo danno) e
  da lì si può solo spingere.
- **La ruota che si blocca**: il case tira da un lato, come un carrello
  della spesa rotto.
- **Tonino al telefono**: "È mia moglie, un attimo…". Per 15 secondi è
  fermo. Arriva sempre nel momento peggiore.
- **Il fonico della band che arriva presto e "dà una mano"**: prende un
  case a caso e lo porta nella zona sbagliata.
- **Scroscio di pioggia** (solo scenari all'aperto): 30 secondi di
  rampa bagnata e danni da acqua ai case scoperti.
- **Le pizze del catering**: il fattorino in motorino taglia il
  percorso. Se ne salvi il cartone, Tonino è più veloce per 30 secondi.

## Punteggio e record

- Nella bolla di scarico: tempo, case consegnati nella zona giusta,
  danni (per stato), imprevisti gestiti.
- Birre e reputazione come sopra.
- Nei record del livello (`Profile.data.records`) si aggiungono i dati
  grezzi dello scarico (tempo, danni, zone sbagliate), come per il
  collaudo.

## Integrazione nel gioco

- **Quando**: dopo la scaletta della serata, prima del montaggio. La
  voce "16:00 scarico" della scaletta diventa "fatto" alla fine del
  minigioco.
- **Saltare**: nelle impostazioni, accanto a "salta lo show", c'è
  "**salta lo scarico**": scarico automatico **senza danni ma senza
  birre**.
- **Rigiocare**: lo scarico si gioca una volta per partita; dal menù si
  potrà rifare "per allenamento", senza effetti sul montaggio.
- **Montaggio**: i case consegnati compaiono nella banchina di carico e
  nelle zone; i pezzi Rotti mancano da `AVAILABLE_STOCK`; i Difettosi
  hanno un segno sul pezzo e vanno sistemati con il tocco lungo prima del
  Test impianto.
- **Salvataggio**: lo stato dello scarico (fatto sì/no, danni per pezzo)
  va nel salvataggio. Se il formato `scs-save` cambia, si aggiunge una
  conversione (senza scarico = scarico saltato senza danni).
- **Test**: un `tests/scarico.js` che controlla almeno che un pezzo Rotto
  manchi al montaggio, che gli apparecchi unici non scendano sotto
  Difettoso e che il Test impianto chieda i PAR arrivati.
- **Nota di stile**: nello spettacolo resta la regola "nessun omino da
  muovere". Lo scarico è l'unico momento con un personaggio da guidare,
  ed è voluto: è la parte fisica del mestiere.

## Da decidere

- Il −2 di reputazione per ogni pezzo rotto allo scarico, o solo birre.
- Il nome e il carattere del collega (proposta: Tonino).
- La durata: 30 minuti di gioco in 3 minuti reali, oppure più corta.
- Il carico all'uscita (a fine serata, smontaggio): stesso minigioco al
  contrario, con il "tetris" del mezzo da riempire. Può essere il motivo
  per cui le **cinghie** contano.

## Prototipo

`prototipi/scarico.html` (si apre da solo nel browser, anche su telefono):
scenario 1 completo, con i 12 case del livello 1, Tonino, rampa, gradino
con OH-ISSA, ribaltamento del rack, dolly, pausa caffè, cavo incastrato,
passanti, bidello col carrello, Tonino al telefono e bolla di scarico
finale. La vista è dall'alto (la fisica è la stessa che servirà in
isometrico). I numeri da tarare sono in cima al file (`WHEEL`, `FRAG`,
`CASES`, `GAME_SECONDS`).
