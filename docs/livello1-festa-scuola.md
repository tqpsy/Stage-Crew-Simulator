# Livello 1 — Festa della scuola: obiettivi (bozza di design)

Stato: **in definizione**. Qui si raccoglie quanto deciso; le voci *Da decidere*
restano aperte.

## Struttura del livello

Il livello è una serata divisa in fasi, sbloccate una dopo l'altra:

| # | Fase | Si sblocca | Cosa serve |
|---|------|-----------|------------|
| 0 | **Montaggio impianto** | subito | quello che il gioco chiede già oggi: corrente, PC → scheda → mixer → finale → sub/teste, 4 PAR in DMX, Test impianto superato |
| 1 | **Discorso del preside** | Test impianto superato | microfono su asta sul palco, XLR fino al mixer, canale aperto e udibile |
| 2 | **DJ set** | discorso finito | consolle DJ (mixer DJ + 2 piatti) alimentata; uscita del mixer DJ → DI → XLR → mixer di sala |
| 3 | **Fine festa e smontaggio** | DJ cacciato da Gerry | niente minigioco: le famiglie escono, si spegne l'impianto (finali per primi) e si smonta |
| 4 | **Carico del furgone** | fine serata (dopo il DJ) | `carico.html`: incastrare i case nel furgone, tre cinghie, la prova su strada. Vedi `docs/minigioco-carico.md` |

Ogni fase si chiude con un proprio test: se passa parte un'**animazione di 10 secondi**
che mostra cosa succede (il preside parla e il pubblico applaude, la gente balla
col DJ, accendini e telefoni per il cantante).

## Montaggio più leggibile (deciso)

Il montaggio del livello 1 chiedeva tutto insieme e diceva cosa mancava solo
al Test impianto. La procedura resta quella vera (connettori, ordine di
accensione, salvavita, fasi, stereo, frontali e tagli): cambiano le dosi e le
informazioni.

1. **Tre giri, come una squadra vera**: Corrente → Audio → Luci. Ogni giro ha
   la sua prova (quadro armato e tutto alimentato; musica dal PC fino alle
   casse; PAR che rispondono alla consolle). Le schede del giro dopo si
   aprono quando il giro prima è passato. Il Test impianto finale resta il
   collaudo completo con lo show.
2. **Foglio di montaggio visibile**: la lista dei collegamenti
   (`buildExpectedConnections`) si spunta da sola mentre si lavora. Nei
   livelli successivi mostrerà solo i conteggi per gruppo.
3. **Il cavo giusto a portata di mano**: toccando una presa senza cavo il
   gioco propone i cavi del baule che ci entrano; con un cavo in mano si
   illuminano i dispositivi con una presa compatibile libera.
4. **Capo squadra tutor (solo livello 1)**: il capo del service avvisa
   *prima* del primo errore di procedura, una volta sola. La conseguenza
   resta. Si può spegnere dalle impostazioni.
5. **Indizi a scalare nel Test impianto**: 1° fallimento indizio vago, 2° il
   pezzo colpevole in rosso, 3° il capo dice cosa manca (e niente birra
   "procedura perfetta").
6. **Posa guidata**: armando un pezzo si evidenzia la zona dove può andare.
7. **Segnale visibile**: con la scheda collegata il PC suona in loop; meter
   del mixer, LED del finale e casse mostrano fin dove arriva il segnale.
8. **Segui il segnale**: tenendo premuto un dispositivo si illumina la catena
   e lampeggia il primo anello mancante.
9. **Segni di nastro sul pavimento**: nel livello 1 il capo ha già fatto la
   pianta (croci di nastro fluo dove vanno sub, stativi, asta, tavolo).
   Dal livello 2 spariscono.
10. **Primo minuto = vittoria facile**: quadro posato, collegato all'allaccio
    e armato → si accende una lampada di servizio.
11. **Scheda "cos'è"** per ogni pezzo (due righe), tenendolo premuto nella barra.

## Scheda Strutture e tavolo regia (deciso)

Una scheda **Strutture** raccoglie ciò che regge gli apparecchi:
- **stativi** per i PAR (spostati dalla scheda Luci);
- **tavolo regia** (la plancia): si posa in Off Stage. Sopra ci vanno
  mixer, consolle luci, PC e scheda audio; sotto il piano c'è il **rack 2U
  del finale**;
- più avanti: rack a terra, americane, altro.

Il finale non è più un apparecchio nudo: sta **dentro un flight case rack
2U** con lo stesso ingombro di prima. Coperchi tolti e appoggiati al tavolo,
frontale del finale tra le guide rack, connettori sul retro del rack.
Toccando il tavolo si apre la vista posteriore di tutta la regia.

Nel livello 1 la regia sta solo in Off Stage: la FOH con il multicore arriva
in un livello successivo. Allora i finali restano a lato palco (Speakon
corti) e in FOH va solo il mixer.

**Fatto:**
- tre giri con la loro prova (pulsante in basso: PROVA CORRENTE / AUDIO /
  LUCI, poi TEST IMPIANTO), schede chiuse col lucchetto finché il giro non
  si apre, foglio di montaggio in alto a sinistra, indizi a scalare (`GIRI`,
  `giroChecks`, `runGiroTest` in `main.js`);
- scheda Strutture con tavolo regia (3 m × 0,8 m, in Off Stage) e stativi;
  sul piano consolle luci, mixer, PC e scheda audio affiancati; sotto il
  rack 2U del finale (`TAVOLO_SLOTS`). I pezzi della regia si posano
  toccando il tavolo;
- toccando il tavolo si apre **la regia da dietro**: i pannelli posteriori
  di tutti gli apparecchi del tavolo uno sotto l'altro. Preso o collegato un
  cavo, la finestra resta aperta: PC → scheda → mixer → finale si cablano
  senza uscire.

- i due coperchi del rack stanno in piedi contro il fianco del case;
- **cavo giusto a portata di mano** (punto 3): toccando una presa senza
  cavo in mano (o con uno che non ci entra) il pannello elenca i cavi dei
  bauli che ci entrano, adattatori compresi; toccandone uno lo si prende e
  il primo capo va subito in quella presa. Con un capo in mano i dispositivi
  che hanno una presa adatta libera si illuminano di verde;
- **posa guidata** (punto 6): armando o trascinando un pezzo si colorano di
  verde le celle libere della sua zona; per i pezzi che si montano sopra un
  altro (testa, PAR, microfono, regia sul tavolo) si cerchiano le basi libere.

- **segnale visibile** (punto 7): con il PC acceso la musica segue i cavi
  (PC → scheda → mixer → finale → sub → testa, ogni apparecchio attivo
  acceso). Sugli apparecchi raggiunti sale una nota verde, le casse
  pulsano a tempo e, appena ne suona una, parte piano la musica di prova in
  loop (si spegne dalle impostazioni: «Musica di prova durante il
  montaggio»). Durante lo show e gli effetti del test tace (`musicReach`,
  `updateSignalFlow`).

- **capo squadra tutor** (punto 4): la prima volta che un'azione sta per
  causare un errore di procedura, il capo del service la ferma e spiega:
  cavo di corrente attaccato o staccato sotto carico (salvavita), mixer
  toccato col finale acceso (colpo nelle casse), finale acceso prima del
  mixer, due pesanti insieme sulla stessa fase (picco) o fase troppo carica
  (magnetotermico). Una volta sola per tipo e per tecnico: se lo rifai, lo
  fai davvero. Solo livello 1, si spegne dalle impostazioni («Consigli del
  capo prima degli errori»). Ogni frase è vera in ogni caso in cui compare
  (anche i PAR senza interruttore: lì il capo dice di abbassare la fase sul
  Quadro; e il picco acceso da una ciabatta con due sub). `tests/capo.js`
  controlla che il consiglio sia quello del guaio che arriverebbe davvero,
  che rifacendo l'azione quel guaio arrivi, che seguendo il consiglio vada
  tutto bene e che con una procedura corretta il capo non parli mai.

- **segui il segnale** (punto 8): nel pannello di ogni dispositivo c'è il
  pulsante «Segui il segnale». Illumina la catena del dispositivo (musica
  PC → … → testa per l'audio, consolle → PAR per le luci, allaccio → Quadro
  → ciabatta per la corrente): in verde gli anelli buoni, in rosso il primo
  che non va, con il motivo (da posare, non collegato alla corrente, senza
  corrente, spento, fase abbassata). Tra un pezzo e l'altro c'è il cavo
  (PC → USB-C → scheda → jack → mixer → XLR → finale → Speakon → sub →
  LINK → testa; consolle → DMX → PAR): se il pezzo è acceso ma il segnale
  non gli arriva, il guasto è nel cavo e la catena dice tra quali pezzi si
  ferma, senza dire se manca, è nella presa sbagliata o è il cavo
  sbagliato. Il pezzo che aspetta il segnale è in ambra. Alla seconda prova
  di un giro fallita di fila il gioco segue il segnale da solo dalla
  sorgente. Si toglie dalle impostazioni (`traceChain`, `showTrace`, `traceLine`);
- **segni di nastro** (punto 9): croci di nastro fluo per quadro, sub,
  frontali, tagli e asta, angoli per il tavolo regia. Solo livello 1, si
  tolgono dalle impostazioni (`TAPE_MARKS`);
- **scheda "cos'è"** (punto 11): tenendo premuto un pezzo nella barra, due
  righe su cos'è e dove va (`PIECE_INFO`). Il tocco breve lo arma come prima.
- La lampada di servizio (punto 10) non si fa.

Test: `tests/aiuti.js`.

- **indizi a scalare nel Test impianto** (punto 5, fatto): come nelle prove
  dei giri. Al primo test andato male solo l'indizio vago con l'effetto
  (scintille, casse che gracchiano, luci in tilt); dal secondo di fila il
  pezzo colpevole in rosso; dal terzo il capo legge la voce del foglio che
  manca. Il colpevole è il primo collegamento che manca dell'impianto che
  ha fallito, se no la prima voce del suo giro che non va. Un collaudo
  riuscito azzera il conto (`giroFails[GIRO_COLLAUDO]`).

## Collaudo come ricompensa e valutazione della serata (fatto)

- **Accensione a catena**: al Test impianto superato cala il buio e
  l'impianto si accende un pezzo alla volta nell'ordine del segnale (quadro
  e ciabatte, PC → scheda → mixer → finale → sub → teste, consolle luci),
  ognuno col suo suono di avvio; poi i PAR e il beat («SI VA IN SCENA!»).
  Ogni prova di giro superata accende in verde la catena del suo giro
  (`playSuccessSequence`, `giroCascade`).
- **Pronti per la prova**: quando tutte le voci del foglio sono a posto il
  pulsante della prova si illumina; ogni voce appena spuntata fa salire un ✓
  verde dai suoi pezzi (`updateFoglio`, `floatCheck`).
- **Valutazione della serata**: dopo il carico si apre «Com'è andata»:
  tempo, errori, guasti risolti, danni, qualità del montaggio, del
  troubleshooting e degli show, reputazione; punteggio su 100 (pesi
  montaggio 30, troubleshooting 25, show 30, danni 15), stelle, titolo (da
  DEVI FARE ANCORA PRATICA a CREW EXCELLENT) e il perché, con un consiglio.
  La prima valutazione entra nei record (comuni a tutte le partite);
  «Rigioca la serata» riparte nello stesso slot. Si riapre dalla scaletta e
  dal foglio (`serataReport`, `openSerata`; test `tests/serata.js`).

## Spiegazioni CREW / PRO (fatto)

- Due livelli di spiegazione, scelti nelle impostazioni («Spiegazioni PRO»,
  comune a tutte le partite). Di partenza **CREW**: a parole semplici, cosa
  fa un pezzo e a cosa serve. **PRO**: i dati tecnici (400 V trifase, fasi
  L1-L3, XLR bilanciato, DMX THRU…).
- La scheda «cos'è» di un pezzo (pressione lunga nella barra) mostra il
  livello scelto e ha un tasto «Più tecnico ›» / «‹ Più semplice» per
  vedere l'altro (`PIECE_CREW`, `PIECE_INFO`, `showPieceInfo`).
- Con PRO gli avvisi delle prove fallite (giri e collaudo) aggiungono il
  perché da tecnico: signal flow, ordine di accensione, DMX in catena,
  carico delle fasi (`PRO_WHY`, `proWhy`). Gli indizi a scalare restano
  uguali: il perché non dice quale cavo manca.

## Scheda obiettivi

**Fatto: scaletta della serata.** A ogni nuova partita, prima del montaggio, si
apre il foglio di lavoro (cliente, luogo, service, tecnico) con gli orari della
serata: 16:00 scarico, 16:30 montaggio, 19:30 test impianto, 20:30 porte,
21:00 preside, 21:10 cambio palco, 21:15 DJ, 22:30 fine festa e smontaggio,
23:00 carico. Ogni voce ha il suo
stato (fatto / adesso / da fare / in arrivo); si riapre dal tasto 📋 in testata.
Le fasi di spettacolo, quando arriveranno nel gioco, si agganciano qui
(`SCHEDULE` in `main.js`).

- Si apre a inizio livello e si può riaprire dall'header.
- Una scheda per fase: **faccia illustrata del personaggio**, nome, due righe di
  descrizione, stato (bloccato / in corso / fatto), birre guadagnate.
- I personaggi sono caricature di persone famose (es. il preside = Donald Trump).
  Illustrazioni vettoriali disegnate in stile caricatura, non foto; per sicurezza,
  se il gioco verrà pubblicato, nome parodia (es. "Preside Tramp").

## Birre (bonus)

Sostituiscono le stelle. Proposta: per ogni fase
- 🍺 fase completata senza magnetotermici né salvavita scattati;
- 🍺 nessun colpo nelle casse (accensione nell'ordine giusto).

Le birre sono il premio della crew: al montaggio non si bevono (contro la
**stanchezza** ci sono caffè e pausa, vedi sotto). Negli show una si può bere
o offrire al capo per un favore; quelle rimaste compaiono nella valutazione
della serata, da bere con Macio.

## Guasti e reputazione (malus)

- Ogni scatto di magnetotermico/salvavita e ogni colpo nelle casse stressa
  l'impianto. Dopo un certo numero (proposta: 3) **si rompe qualcosa** (es. il
  finale o un PAR).
- Il livello si può comunque concludere. L'apparecchio rotto **non toglie
  reputazione** (non è colpa del giocatore): la reputazione scende solo se il
  guasto è gestito male (vedi sotto).

## Stanchezza (fatta, prima versione)

Il tempo passa come stanchezza del tecnico. Più è stanco, più rischia di fare
errori. Si recupera con una pausa: caffè o seduti sul case.

- **Un valore solo**, da 0 (riposato) a 100, salvato nella partita
  (`Profile.data.fatigue`, dentro lo slot della partita: ogni slot ha la
  sua). I salvataggi vecchi e i file importati senza stanchezza riprendono
  col tecnico riposato. Nuova partita: 0.
- **Dove si vede**: nel tasto 🍺 in testata, con le birre in tasca sopra e
  la barra della stanchezza sotto (rossa da 70 in su). Il numero esatto e
  la parola (riposato, un po' stanco, stanco, stanchissimo) sono nel
  suggerimento del tasto e nel messaggio quando lo si tocca.
- **Sale** di 1 per ogni minuto di gioco (conta come il tempo di gioco: non
  col menù aperto) e di 0,25 per ogni pezzo posato e ogni cavo collegato.
  Gli errori mettono tensione: +4 per ogni protezione che scatta (magnetotermico
  o salvavita) e ogni colpo nelle casse, +2 per ogni prova fallita. Così gli
  errori del montaggio rendono più difficili gli show, che ricevono la stanchezza.
- **Scende** con la pausa: il tasto 🍺 apre «Una pausa?» con due scelte.
  ☕ **Caffè dal thermos**: −12 subito, 3 a serata (`Profile.data.coffees`).
  🪑 **Seduto sul case**: −35, ma l'orologio del montaggio va avanti di 20
  minuti (vedi *L'orologio del montaggio*); non si può col pubblico che aspetta il
  cambio palco o con Gerry che controlla i cavi. Le birre non si bevono al
  montaggio: la finestra ricorda a cosa servono.
- **Effetti nel montaggio (livello 1, leggeri)**: sopra 70 ogni tanto il
  connettore scivola di mano (fino a 1 volta su 7 a stanchezza 100). Il
  cavo resta in mano e basta riprovare: nessun collegamento sbagliato.
- **Nel discorso del preside** la stanchezza del tecnico entra nella pagina
  (`preside-dati`, campo `fatigue`) e ne esce a fine discorso
  (`preside-fine`, campo `fatigue`): durante il discorso sale col tempo, la
  birra la fa scendere, e rende i fader più tremolanti, le finestre di
  reazione e il tempo limite del guasto più corti (vedi *Tempi del guasto*).
  Saltato il discorso, la stanchezza non cambia.
- Codice: `FATIGUE`, `setFatigue`, `tireOut`, `openPausa`, `drinkCoffee`, `takePause`, `slipChance` in
  `main.js`. Test: `tests/stanchezza.js`, e `tests/preside-gioco.js` per il
  passaggio al discorso.
- **Da fare**: scarico e posa dei cavi non la ricevono ancora (lì conta solo
  il tempo di gioco); nello spettacolo del DJ stringerà la finestra delle
  note. Nei livelli successivi, effetti più forti (il cavo nella presa
  sbagliata, tocchi meno precisi).

## Consolle luci

Serve una consolle usabile: fader per canale/PAR, anteprima del colore di ogni
luce, **memorie** salvabili. Proposta: ogni fase chiede anche la sua scena
(bianco pieno per il preside, colori/chase per il DJ, luce calda per il cantante).

## Ingressi del mixer (deciso)

Si usa quello che c'è: 4 XLR + 2 jack (occupati dalla scheda). Ogni fase deve
starci da sola, non tutte insieme:

| Fase | XLR usati |
|------|-----------|
| Preside | 1 (mic) |
| DJ | 2 (L/R dalla DI stereo) + eventualmente il mic del preside = 3 |
| Cantante | 2 (voce + chitarra via DI): **bisogna staccare il DJ** |

Il cambio palco (staccare ciò che non serve e ripatchare) fa parte del gioco.

## Cambio palco Preside → DJ (deciso, fatto)

- **Dove si fa**: nella vista montaggio, con i pezzi, i cavi, le fasi del
  Quadro e il magnetotermico di sempre. Niente minigioco a parte: il cambio
  palco è rimettere mano all'impianto montato dal giocatore.
- **Chi porta cosa**: la **consolle** (due lettori e mixer DJ su un banco in
  flight case) la porta DJ Inestimabile; compare in una scheda **DJ** che si
  apre solo col cambio. Nella stessa scheda c'è il suo **stativo luci**
  («LUCI DJ»): un treppiede con la barra orizzontale e sopra, già montati,
  **quattro PAR LED cinesi e una strobo LED in mezzo**. I fari sono già
  collegati tra loro sulla barra: si danno solo **una spina Schuko** e **un
  DMX**. La **DI** è del service: è nella dotazione del
  montaggio (scheda Regia), dove non serve, e va tenuta per il DJ.
- **Le luci del DJ**: le ha indirizzate lui e non si toccano: 4 PAR da 3
  canali (RGB) dall'indirizzo 1 e la strobo (dimmer e velocità), **canali
  1-14**. Il DMX parte dalla consolle luci: sull'universo 1 in coda ai PAR
  del service i canali si pestano (le luci impazziscono insieme), quindi va
  sull'**universo 2**, libero (oppure si spostano gli indirizzi dei PAR).
  La barra non ha interruttore, come i PAR: attaccarla sotto tensione fa
  scattare il salvavita, prima si abbassa la sua fase. Consuma 220 W.
- **Quando**: dopo il discorso del preside (`preside.html`, anche saltato):
  il cambio delle 21:10 diventa «Adesso». Parte dal foglio (tasto «Inizia il
  cambio palco») o dalla scaletta. Prima, il foglio propone il discorso («Il
  preside sale sul palco») e dice cosa manca al microfono.
- **La carta del DJ** (si apre all'inizio): DJ Inestimabile e Musa
  Esistenziale arrivano, la locandina, quanto aspetta il pubblico e il
  canale del microfono. Poi la stessa lista la spunta il foglio:
  1. consolle sul palco;
  2. corrente alla consolle, accesa (spina Schuko: da una ciabatta o dal
     Quadro con l'adattatore CEE / Schuko; consuma 250 W);
  3. una DI (sul palco accanto alla consolle, in Off Stage o in FOH);
  4. MASTER L e R della consolle nei due ingressi della DI (jack);
  5. dalla DI due XLR in due ingressi MIC liberi del mixer;
  6. stativo luci del DJ sul palco (4 PAR e strobo);
  7. corrente alle luci del DJ (spina Schuko);
  8. DMX dalla consolle luci alle luci del DJ, senza pestare i PAR;
  9. il microfono resta collegato: ora è di Musa Esistenziale;
  10. l'impianto del collaudo è ancora tutto a posto.
- **Pazienza del pubblico**: 4 minuti di gioco, barra sul foglio (visibile
  anche chiuso). Non scende con la carta o la scaletta aperte. Se finisce:
  fischi, −5 reputazione (`REP.slowChange`), e il cambio si finisce lo stesso.
- **PRONTI: TOCCA AL DJ** (il tasto in basso durante il cambio): come la
  prova di un giro, indizio vago, al secondo tentativo il pezzo in rosso,
  dal terzo il capo legge la voce della carta. Promosso: +3 reputazione se
  la pazienza non è finita (`REP.changeDone`), −2 se il microfono è stato
  spostato su un altro canale (`REP.wrongInput`), una volta sola.
- Codice: `cambioChecks`, `startCambioDj`, `finishCambioDj` e
  `runCambioTest` in `main.js`; stato in `Profile.data.cambioDj`. Le luci
  del DJ: tipo `djluci`, `DJ_LUCI_DMX` e `djLuciClashes`. Test:
  `tests/cambio-dj.js`.
- **Fatto**: lo spettacolo del DJ (vedi *Lo spettacolo del DJ: Light
  Operator Hero* qui sotto e `docs/spettacolo-dj.md`), con i suoi guasti. La
  «ciabattina del DJ» piena di roba che fa scattare una fase appartiene lì
  (tra i guasti proposti); oggi la consolle consuma poco.

## Lo spettacolo del DJ: Light Operator Hero (deciso)

Nel set di «Notte fuori controllo» il giocatore non fa il DJ: è l'**operatore
luci** e fa le luci a ritmo, come un Guitar Hero delle luci. I guasti non lo
tirano fuori dal gioco a ritmo, se non quelli grossi, e allora è lui a
scegliere chi va a sistemarli.

**La pista delle luci**
- In basso 4 corsie, una per memoria luci: **colori**, **chase**, **strobo**,
  **blackout**. Le note scendono a tempo di musica e si premono quando toccano
  la linea.
- Le corsie comandano **lo stativo luci del DJ** collegato nel cambio palco
  (oltre ai PAR del service): **colori** e **chase** muovono i suoi quattro
  PAR, **strobo** la strobo LED in mezzo alla barra, **blackout** spegne
  tutto. Se la barra non ha corrente o DMX, quelle corsie non fanno niente.
- Nota presa: le luci sul palco fanno quella scena, il pubblico salta, il
  gradimento sale e cresce la combo. Nota mancata: luci in ritardo o ferme,
  gradimento giù, combo azzerata.
- Il **drop** è una nota lunga da tenere premuta: presa, boato del pubblico.
- Livello 1: note lente, finestra larga, un guasto alla volta. La
  **stanchezza** stringe la finestra, la birra la riallarga.
- Il ritmo viene dalla musica: con un file audio vero (vedi sotto) servono i
  suoi BPM e dove cadono i drop; senza, il ritmo techno generato dal codice.

**I guasti, in tre modi**
1. **Guasti che diventano note speciali**, risolti senza lasciare la pista:
   - Musa si avvicina alle casse: nota rossa **MUTE MIC**; presa a tempo
     evita il larsen, mancata il larsen parte;
   - volume del DJ in rosso: nota **fader** da trascinare in giù;
   - Musa si mangia il microfono: nota fader sul suo canale.
2. **Guasti che rompono la pista** (le luci):
   - un PAR perde il DMX: la sua corsia diventa grigia e quelle note non si
     prendono più. Si tocca il PAR, si sistema cavo o indirizzo e la corsia
     torna. Si può andare avanti con 3 corsie e sistemarlo in un momento
     calmo;
   - la barra del DJ perde il DMX (cavo tirato da Musa che balla): i suoi
     quattro PAR e la strobo si fermano insieme, perché hanno un solo DMX.
3. **Guasti grossi**, che portano fuori dalla pista:
   - la ciabattina del DJ fa scattare una fase del Quadro (metà impianto
     spento): si va al Quadro, si riarma e si sposta la spina su un'altra
     fase;
   - arrivano apposta nei momenti calmi del pezzo (le pause prima del drop):
     sistemare subito o aspettare la pausa è una scelta.

**Chi va a sistemare un guasto grosso**

| Scelta | Cosa succede | Reputazione |
|---|---|---|
| **Ci vai tu** (gratis) | Il capo ti dà il cambio alle luci; tu sistemi il guasto | **+5** se in fretta, 0 se lento |
| **Paghi una 🍺 al capo** | Ci va lui, tu resti alle luci senza perdere la combo | **0** (e una birra in meno) |
| **Nessuno** | Dopo un po' ci pensa Gerry, il pubblico intanto patisce | **−5** (come il guasto trovato dal bidello) |

- **Il capo alle luci è peggio di te**: prende le note in automatico ma ne
  manca una su tre e la combo si azzera.
- **Il capo non si spazientisce** (deciso): se vai tu al guasto, resta lui
  alle luci finché non torni, senza limite di tempo.
- **La birra ha un costo vero**: è una birra in meno contro la stanchezza.
  Senza birre in tasca la scelta non c'è: ci vai tu.
- Il capo solo per i guasti grossi (fase che scatta, PAR senza DMX); i
  guasti-nota restano del giocatore. Al massimo **due favori per set**.
- Dal livello 2 il capo non c'è più (tutor solo al livello 1): al suo posto
  un **assistente** da assumere con la reputazione, pagato a birre (design
  in `docs/assistente.md`).

**Il rewind del DJ**
- Quando torni alle luci dopo aver sistemato un guasto grosso, DJ
  Inestimabile fa lo **scratch** e riporta il brano **qualche battuta
  indietro**: le note perse mentre eri via tornano e si possono riprendere.
- Il rewind copre il tempo in cui sei stato via, **fino a 8 battute**: veloce
  recuperi tutto, lento solo l'ultimo pezzo.
- Il gradimento perso si recupera riprendendo quelle note, con un piccolo
  bonus del pubblico al rewind (come nelle serate vere). La **combo riparte
  da zero**.
- **Solo se ci vai tu**: col capo pagato non serve (non hai perso note), con
  Gerry niente rewind (il DJ è offeso e va avanti). **Uno per guasto.**
- Con un file audio vero è lo scratch sul brano stesso: suono dello scratch
  e il pezzo che riparte da qualche secondo prima.

**Finale**: il set finisce, non vogliono smettere, Gerry stacca la corrente e
li butta fuori (scena comica, il giocatore non fa niente). Gradimento, combo
e guasti gestiti diventano birre e reputazione, una volta sola (come il
discorso del preside).

**Audio**: si potrà caricare un brano come base del set (MP3 stereo, 1–2
minuti in loop, sotto i 3–4 MB, diritti liberi), con BPM e secondo del drop.
Passa per la catena simulata: fader, mute, L/R, distorsione del gain in
rosso, ronzio della DI.

**Cambiato giocando**: tre corsie (niente BLACKOUT: il battito prima del
drop è una pausa), il set si fa via via più difficile, e il finale è Gerry
che, arrabbiato per il casino e le parolacce, stacca la corrente di botto
poco prima della fine del brano.

**Fatto** (`dj.html`, dopo il cambio palco): com'è stato costruito, coi
numeri, è in `docs/spettacolo-dj.md`. Dell'audio restano da fare la catena
simulata e il brano caricato dal giocatore.

## Dopo il DJ: il karaoke di Macio (tolto dal livello 1)

**Ottobre 2026**: il karaoke esce dal livello 1. Dopo il DJ la serata va
fine festa → smontaggio → carico → valutazione. `karaoke.html`,
`karaoke-voce.js` e `tests/karaoke.js` restano nel progetto (non sono più
aperti dal gioco); il test dentro il gioco ora è `tests/fine-festa.js`. Il
testo qui sotto resta come appunto.

Gerry ha cacciato il DJ e la serata non può finire così. Niente gruppo di
musicisti (Luca preferisce evitarlo): **Macio**, il collega dello scarico,
prende il microfono e improvvisa un **karaoke**, a metà fra il discorso
del preside (voce nella zona verde, larsen) e il DJ Hero (pista a tempo).
È un'improvvisazione: non è sulla locandina (la serata era solo DJ set) e
nemmeno sulla scaletta finché il DJ set non è finito.

**L'idea**: non c'è un programma di karaoke. Macio ha scritto la canzone
lì per lì e il testo sul portatile girato verso il palco lo manda avanti
il tecnico, **a mano, sillaba per sillaba a tempo**. Macio canta quello
che legge: se la sillaba non arriva in tempo si perde («ehm», «boh»).

- **La pista del testo**: una corsia sola, orizzontale; le sillabe
  arrivano da destra e si tocca **AVANTI** (Spazio) quando sono sulla
  riga. Le sillabe lunghe in fondo a ogni verso si **tengono premute**.
  Lo schermo del karaoke in alto si colora man mano, come un karaoke vero.
- **Macio si gasa e urla**: canta intonato, ma a tratti si esalta e urla
  nel microfono («!!» dalla bocca spalancata). Il fader **VOCE MACIO** va
  tenuto nella **zona verde**: alta quando canta normale (sennò non si
  sente), bassa quando urla (sennò il pubblico si tappa le orecchie). La zona si sposta **un tempo prima**, così si vede
  arrivare. Nei ritornelli più lo abbassi, più si sente il pubblico che
  canta.
- **Il larsen**: due volte Macio va verso una cassa e scende la **zona
  rossa**: con la voce lì sopra per più di un terzo di secondo parte il
  larsen (−6 pubblico, −3 reputazione), poi un attimo di tregua.
- **Macio dimentica le parole** (quattro volte): l'ultima parola del verso
  è «???» e sopra la platea compaiono tre parole (tasti 1 2 3). Quella che
  fa rima piace (+6 pubblico), quella buffa fa ridere («panino», «il
  preside», «Gerry»…, +3), quella sbagliata fa fischiare (−6). Se non
  scegli in tempo Macio canta «ehm» (−4). Macio canta la parola scelta.
- **Botta e risposta** (il ponte, 4 battute): la base resta cassa e
  battimani, Macio canta «Oh-oh!» e la palestra risponde «OH! OH!» sul
  terzo e sul quarto tempo: bolle azzurre e tasto **CORO** (C).
- **Gerry stacca la spina** all'inizio del ponte: base e microfono tacciono,
  le luci si spengono e il pubblico cala finché non la riattacchi (tre
  tocchi sul bottone, o R). Il coro si sente lo stesso: la palestra canta
  anche senza impianto.
- **Ritornello finale**: se il pubblico è almeno al 50% si accendono i
  telefoni e la palestra canta con lui. In fondo «MA-CIO! MA-CIO!».
- **Stanchezza e birra** come nel DJ set: la stanchezza stringe la
  finestra, la birra la riallarga. Facile: finestre e zona verde più
  larghe.
- **Esito**: stelle da sillabe e «OH!» a tempo (60%) e tempo nella zona verde
  (40%); reputazione 5 + (pubblico − 60) / 10 − 3 per larsen; 🍺 senza
  larsen e 🍺 col pubblico almeno al 70%. Una volta sola, come le altre
  fasi.

**La canzone**: «Salviamo la serata», testo e musica originali (niente
diritti). 112 BPM, 32 battute (circa un minuto): intro parlata, strofa,
ritornello, ponte (botta e risposta), ritornello finale. Più corta e
veloce della prima versione, che Luca trovava noiosa. La base (batteria,
basso, accordi Do-Sol-La-Fa) e il coro del pubblico sono suonati dal codice
con Web Audio. La **voce di Macio** ha l'**accento di Chieti** (Macio è di Chieti; non
il dialetto: «spèndo», «quando», «cando», «anghe», «inzième»): una voce
italiana maschile sintetica dice ogni verso e il vocoder WORLD fa cantare
ogni sillaba sulla sua nota, un'ottava sotto, **intonata giusta** (controllata
nota per nota), con un vibrato leggero; dove urla è solo più forte. Dice
anche le frasi dell'intro, «Ehm…» quando si perde una sillaba e «Grazie a
tutti, vajù!» alla fine, le parole sbagliate da scegliere e l'«Oh-oh!» del
ponte. Sta in `karaoke-voce.js` (un mp3 in base64, così
funziona anche aprendo `index.html` dal disco), generato da
`strumenti/voce-macio.py`. Se manca, canta il suono sintetico.

**Nel gioco**: finito il DJ set, il messaggio dice che Macio prende il
microfono e il karaoke si apre da solo (o dal foglio, «Macio prende il
microfono», o dalla scaletta). Serve il microfono ancora collegato a un
ingresso MIC del mixer acceso: se manca, Macio aspetta e il foglio dice
cosa fare. Dopo il karaoke la scaletta e il foglio portano al **carico del furgone**
(23:00). Prende il posto della fase del cantante con chitarra: Dante e
la sua fase escono di scena; le voci *cantante* qui sotto restano come
appunti.

Codice: `karaoke.html` (la pagina), `openKaraoke`, `finishKaraoke` e
`karaokeReady` in `main.js`; stato in `Profile.data.karaoke`. Test:
`tests/karaoke.js` (la pagina da sola) e `tests/karaoke-gioco.js` (dentro
il gioco).

Dopo il karaoke la serata chiude col **carico del furgone** (`carico.html`):
Macio porta fuori i case, tu li incastri nel furgone a quadretti, li leghi
con tre cinghie e si parte; frenata, curve e dosso fanno scivolare quello
che è slegato. Regole in `docs/minigioco-carico.md`.

## Personaggi (proposta)

Filo comune: la scuola, con i personaggi delle **materie** che prendono vita.

| Ruolo | Scelta consigliata | Alternative |
|------|-------------------|-------------|
| Preside | Donald Trump ("Preside Tramp"): discorso lunghissimo, vuole il volume più alto di tutti | — |
| DJ | **Deciso: il duo "Notte fuori controllo"**: in consolle DJ Inestimabile (Andrea Diprè), al microfono il vocalist Musa Esistenziale (Rosario Muniz). Techno. | (prima: Einstein "DJ E=mc²") |
| Cantante con chitarra | Dante Alighieri, "Nel mezzo del cammin — unplugged" | Cristiano Ronaldo che canta e urla "SIUUU" nel mic; Napoleone con la chitarra (e l'asta del mic troppo alta) |
| Bidello (dà le richieste extra) | **Deciso: Gerry Scotti** ("Gerry, il bidello") | — |

Personaggi storici: nessun problema di diritti. Personaggi viventi: caricatura
disegnata e nome parodia.

**Preside Tramp** (fatto, rifatto sulle foto): simbolo SVG `#tramp` in
`preside.html`. Tratti: ciuffo biondo enorme col riporto
sulla fronte, abbronzatura arancio con le occhiaie chiare, sopracciglia chiare
aggrottate, occhi a fessura, bocca a cul di gallina, faccione squadrato con
le guance cadenti; giacca blu larga e cravatta rossa lunghissima. Nessuna
bandiera o simbolo nazionale. Ritratto con `viewBox="6 2 88 88"`.

**DJ Inestimabile e Musa Esistenziale** (fatto, disegnati sulle foto): simboli
SVG in `img/personaggi.svg` (`dipre`, `dipre-cuffie`, `musa`, `musa-base`), stesso
stile e stesso ritaglio del ritratto (`viewBox="6 2 88 88"`).
- DJ Inestimabile: faccione pallido con guance piene e doppio mento, capelli
  castano scuro con la riga a sinistra e la frangia sulla fronte, occhi
  leggermente sbarrati e vitrei con occhiaie violacee e rossore, sudore;
  labbro di sopra sottile con l'arco marcato, sotto pieno, ghigno appena
  accennato; abito scuro, cravatta rossa, cuffie (al collo o in testa).
  Si capisce che è "fatto" solo dall'espressione: niente riferimenti espliciti.
- Musa Esistenziale: faccione largo e pallido, capelli neri lunghissimi e mossi
  con la riga in mezzo, barba scura rasata, bocca spalancata con i denti
  storti e giallastri; a petto nudo e pieno di peli, catenina con la croce.
  Intero sul palco: slip bianco, niente di volgare.
- Locandina `img/locandina-dj.svg`: rifà la scena del divano del video
  ("per il SOCIALE" → "per la SCUOLA"), con Diprè che porge il microfono e
  scratcha alla consolle; titolo al neon **NOTTE FUORI CONTROLLO**. Si apre
  dalla scaletta (voce delle 21:15, tasto "Guarda la locandina"; campo
  `poster` in `SCHEDULE`). Solo nomi d'arte.
- DJ set (da fare, vedi *Lo spettacolo del DJ: Light Operator Hero*): il
  lavoro è fare le luci a ritmo e inseguire i guasti che combinano. Proposte:
  gain del mixer DJ in rosso; Musa che si mangia il microfono (larsen); Musa
  che scende verso le casse; roba del DJ attaccata alla ciabatta sbagliata
  (scatta una fase); macchina del fumo sotto il rilevatore; cavo del
  microfono strappato ballando; memoria luci al "drop". Finale: non vogliono
  smettere, Gerry stacca la corrente e li butta fuori; da lì parte l'ultimo
  obiettivo della serata.

**Gerry, il bidello** (fatto): caricatura vettoriale nello stile del Preside
Tramp (simbolo SVG `#gerry`, `viewBox 0 0 100 140`, colori piatti senza
contorni). Tratti esagerati: testone a pera pelato con due fili in cima,
ciuffi grigi ai lati, un sopracciglio più alto, occhi a fessura sornioni,
nasone, sorriso storto; corporatura grossa nel camice blu da bidello con la
camicia azzurra aperta. Per il ritratto si usa il ritaglio `viewBox="6 0 88 88"`
(la testa è più alta di quella del preside). Dove compare:
- `preside.html`: quando il guasto lo trova lui, sale
  sul palco per qualche secondo ("Tranquilli, ci penso io!") e la sua faccina
  accompagna la nota nella scheda finale;
- `scarico.html`: visto dall'alto dietro al carrello (testa pelata con la
  corona grigia, spalle larghe nel camice blu).

## Tra una fase e l'altra (proposta)

- Fase 0 (montaggio): tempo libero, niente pressione. È anche il tutorial.
- Cambi palco (fasi 1-3): barra di **pazienza del pubblico**. Se si svuota non
  si perde, ma si perde reputazione e il pubblico fischia. Fatto per il
  cambio Preside → DJ (vedi sopra).
- La **stanchezza** sale con il tempo e con le azioni; caffè e pausa la
  abbassano (fatto, vedi *Stanchezza*).

## Guasti (proposta)

- Contatore **stress impianto**: +1 per ogni magnetotermico, salvavita o colpo
  nelle casse.
- Al terzo si rompe l'apparecchio colpevole: colpo nelle casse → tweeter di una
  testa bruciato (suona gracchiante); scatto → il finale va in protezione.
- Si può ripararlo con il **ricambio nel furgone** (zona carico): costa tempo e
  stanchezza. Oppure si va avanti così e si perde reputazione.

## Reputazione (decisa)

Si parte da **0** e si porta tra i livelli; non va sotto lo 0. Misura la
professionalità, non la sfortuna.
- **Sale** con: fase completata (+5), guasto gestito bene (+3), birra rifiutata
  in una richiesta extra (+5), cambio palco finito prima dei fischi (+3).
- **Scende** se un guasto è gestito male: trovato dal bidello al posto tuo (−5),
  larsen (−5), microfono ricollegato a un ingresso diverso da quello cablato al
  montaggio (−2),
  pazienza del pubblico finita per un cambio palco lento (−5).
- **Apparecchio rotto: 0**, non è colpa del giocatore.
- Ogni fase e ogni richiesta extra contano una volta sola per service: rifarle
  non aggiunge altro.
- Nel gioco oggi ci sono il collaudo dell'impianto (+5), lo scarico, la posa
  dei cavi, il discorso del preside (vedi *Il discorso nel gioco*) e il cambio
  palco per il DJ. I numeri sono in `REP` in `main.js`.
- La reputazione apre i livelli successivi a soglie (`LEVELS` in `main.js`,
  proposta: livello 2 a 20, poi 60, 110, 180). Giocato bene, questo livello
  ne vale circa 25-30: basta per aprire il 2. Le fasi di questo livello sono i
  suoi sottolivelli nella scelta del livello e nell'elenco degli slot.

## Animazione di errore (proposta)

Sì, breve (5 s) e comica, quando il test di fine fase fallisce: larsen e preside
con le mani sulle orecchie; silenzio e pubblico che fischia al DJ; Dante al buio.
Poi si torna a sistemare.

## Richieste extra (per ogni livello)

Missioni facoltative chieste dai personaggi. Se la fai il personaggio offre una
🍺: **accettarla** = birra in tasca, **rifiutarla** = +reputazione. Ogni livello ne
ha qualcuna, anche strana.

Livello 1:
- **Cantante**: un monitor di palco dalla mandata AUX.
- **Preside**: la sua musica d'ingresso dal PC mentre sale sul palco.
- **DJ**: la macchina del fumo… ma sotto c'è il rilevatore antincendio della
  palestra (va coperto, o scatta l'allarme e si perde reputazione).
- **Bidello**: vuole caricare il telefono "da quella presa rossa grossa" (il
  quadro): dirgli di no è la risposta giusta.
- **Una mamma**: "quelle luci colorate mi fanno venire mal di testa": un PAR
  in bianco fisso verso le sedie delle famiglie.

## Fasi di spettacolo (deciso)

Giro del livello: **Montaggio → Test impianto → [cambio palco → spettacolo] × 3 → verbale**.

- Tempo di gioco accelerato: preside ~1:30, DJ ~3:00, cantante ~2:30, con un
  orologio finto (21:00 → 21:15).
- **Gradimento del pubblico**: sale con suono/luci giusti, scende con larsen,
  silenzi, buio, volumi sbagliati. A fine fase diventa birre e reputazione.
- Si interviene **dalla consolle** (fader, mute, memorie luci) o **sul posto**
  con un tocco sul dispositivo: parte un'attesa ("stai andando…") che dura di
  più se sei stanco. Nessun omino da muovere.
- Ogni imprevisto si annuncia (fumetto sul personaggio), dà qualche secondo per
  reagire, poi ha una conseguenza. Nel livello 1 al massimo 1-2 insieme.
- Imprevisti **misti**: quelli principali a copione (si imparano) + 1-2 pescati a
  caso per la rigiocabilità.
- La **stanchezza** nello spettacolo: fader più tremolanti, finestre di reazione
  più corte. La birra la fa scendere.
- Il livello 1 perdona: lo spettacolo non si interrompe mai.

| Fase | Insegna | Imprevisti |
|------|---------|-----------|
| Preside | il mixer | parla piano / mangia il mic; larsen vicino alle casse; batte sul mic; cavo del mic staccato |
| DJ | luci e corrente | memoria luci al "drop"; volume in rosso; roba del DJ che sovraccarica una fase; fumo e rilevatore |
| Cantante | il bilanciamento | voce coperta dalla chitarra; corda rotta → musica dal PC; "più voce in spia"; luce calda solo su di lui |

## Grafica e interazione in spettacolo (proposta)

- **Header**: barra del tempo con faccia del personaggio e orologio; il
  gradimento del pubblico è la barra più grande, con la percentuale; la
  stanchezza sta nel tasto della 🍺 (caffè e pausa la fanno scendere); reputazione.
- **Palco isometrico**: resta la vista di gioco del montaggio. Il discorso
  del preside invece ha il suo palco disegnato di fronte (vedi *Il discorso
  nel gioco*). **Deciso: anche le altre fasi di spettacolo (DJ, cantante)
  non vanno nell'isometrico**: come il preside, ognuna ha il suo palco
  disegnato di fronte, con i personaggi e il pubblico in platea (teste che
  si muovono a tempo, colore e fumetti che ne mostrano l'umore).
- **Imprevisti**: fumetto sopra il personaggio o il dispositivo, con un anello
  che si svuota (giallo → rosso). Toccare il fumetto apre direttamente il comando
  giusto (fader, memoria, pannello), per giocare al volo anche sul telefono.
  Esito: spunta verde e +gradimento, oppure suono del guaio e −gradimento.
- **Banco regia** (deciso: **nei livelli successivi**, non nel livello 1):
  la barra in basso del montaggio diventa un cassetto con due
  schede, MIXER e LUCI (sul telefono occupa metà schermo sotto il palco; su
  computer sta di lato).
  - MIXER: una striscia per canale con fader verticale, meter con zona verde,
    MUTE e nome del canale. Niente faccina di chi ci è collegato: il canale
    di ogni personaggio va ricordato (serve nei guasti).
  - LUCI: un cerchio col colore reale di ogni PAR, fader dimmer, tavolozza
    colori, tasti memoria 1-6 (tocco = richiama, tenere premuto = salva).
- **Cambio palco**: si torna alla vista montaggio; la carta del prossimo
  personaggio dice cosa collegare, i canali del mixer mostrano cosa è attaccato.
- **Fine fase**: animazione illustrata di 10 s sopra il palco, poi un mini-verbale
  (gradimento, birre, reputazione).

## Decisi (proposte accettate)

- Personaggi: Preside Tramp, DJ Inestimabile e Musa Esistenziale ("Notte fuori controllo"), Dante unplugged, Gerry Scotti bidello.
- Richieste extra del livello 1: monitor per Dante, telefono del bidello, macchina del fumo.
- Pausa: sì, con il palco oscurato.
- Caricature: vettoriali disegnate nel codice, come i dispositivi.
- Reputazione salvata nel browser del giocatore.
- I numeri (gradimento, stress, pazienza) si tarano giocando.
- Fasi di spettacolo fuori dall'isometrico: ognuna col suo palco di fronte.
- Banco regia completo (mixer e consolle luci con memorie): nei livelli
  successivi.
- PAR: nel livello 1 si puntano da soli in base al ruolo, come ora.

## Il discorso nel gioco

`preside.html`: la fase del discorso del preside. Nato come prototipo in
`prototipi/`, ora è nel gioco: finita la posa dei cavi (anche saltata) si apre
in un iframe sopra il palco, o dalla scaletta («Il preside sale sul palco»).

- **Serve il microfono**: montato sull'asta e collegato con un XLR a un
  ingresso MIC 1–4 del mixer acceso (`presideReady()` in `main.js`). Il Test
  impianto non lo chiede: se manca, dopo la posa un avviso dice cosa collegare
  e il preside sale da solo pochi secondi dopo il collegamento.
- **Il montaggio vero entra nel discorso**: l'ingresso cablato (la risposta a
  «in che ingresso era?» quando si guasta), i PAR montati col nome e il ruolo
  del loro stativo (frontali e tagli, da sinistra a destra: se allo scarico
  se n'è rotto qualcuno ce ne sono meno), i cavi lasciati dalla posa
  (`caviLeftovers()`), le birre in tasca e la stanchezza del tecnico (vedi
  *Stanchezza*).
- **Esito**: la reputazione del discorso (5 + gradimento − larsen ± guasto e
  richieste, vedi sotto) conta una volta sola (`L1:preside`); le birre
  guadagnate vanno in tasca, quelle bevute si tolgono; la stanchezza a fine
  discorso torna al tecnico. Si può saltare dalla
  scheda iniziale: il preside parla lo stesso, reputazione ferma. La scaletta
  mostra il riassunto (pubblico, larsen, birre, reputazione).
- Aperta da sola, la pagina resta il banco di prova: ingresso a caso, 4 PAR,
  scelta del guasto e dei cavi lasciati dalla posa.
- Test: `tests/preside-gioco.js` (dentro il gioco), `tests/preside-cavi.js`
  (le conseguenze della posa, pagina da sola).

Nella scheda iniziale, «Cavi lasciati dalla posa» prova le conseguenze della
posa dei cavi finita col tempo (vedi `docs/minigioco-posa-cavi.md`): cavo nel
passaggio (qualcuno inciampa, il guasto è l'ingresso), microfono accanto alla
corrente (ronzio), cavo in scena (il preside inciampa).

### Dopo la prima prova

- **Grafica**: il discorso resta com'è stato costruito (palco disegnato di
  fronte, header, fumetti, banco regia), non si sposta sul palco isometrico
  (deciso).
- **Guasti veri, non "tocca e risolvi"**: il microfono muto va diagnosticato
  e riparato con decisioni di cablaggio (vedi *Il guasto del microfono* sotto).
- **Lingua dei personaggi**: ognuno parla una lingua fatta solo del suo nome
  (il preside dice solo "Tramp"). La lingua si sente solo nella voce (sintesi vocale col
  volume che esce davvero dal mixer); i sottotitoli e i fumetti sono in italiano chiaro.
- **Rigiocabilità**: apertura e finale fissi; in mezzo 5 imprevisti pescati da
  7 a tempi variabili, che verso la fine si accavallano. Il volume del preside
  va e viene da solo (fader sempre da seguire). Il larsen cresce con volume ×
  vicinanza alla cassa e si sente arrivare: va abbassato quanto basta, non
  zittito. Nuovi imprevisti: la sigla dal PC, e il dilemma "più volume!"
  (accontentare il preside o il pubblico). Suggerimenti nei fumetti solo alla
  prima partita (si possono riaccendere).

### Guasti e reputazione (rivisti)

- **Indizi**: il connettore che penzola dall'asta e il cavo per terra dalla
  parte del mixer si vedono sul palco; il MUTE acceso o il fader giù si vedono
  sul mixer; il filo staccato dentro la spina non si vede e si trova per
  esclusione. Chi osserva va dritto al punto giusto; chi controlla a caso perde
  tempo.
- **Pubblico paziente all'inizio**: nei primi 5 s di silenzio il gradimento cala
  appena; poi il preside se ne accorge («Tramp? TRAMP?») e cala di più; solo un
  silenzio lungo fa crollare il pubblico.
- **Entrata al buio**: lo spettacolo parte con le luci spente. Il preside sale
  sul palco camminando da sinistra fino al leggio (circa 7 s); i **frontali**
  (PAR 2 e 3; PAR 1 e 4 sono i tagli) vanno accesi in bianco entro quando si
  posiziona, altrimenti comincia al buio. Finché i frontali sono spenti il
  preside resta in ombra e il pubblico scontenta.
- **Al massimo un guasto per spettacolo**, tra i primi imprevisti e senza altri
  imprevisti addosso.
- **La reputazione misura la professionalità, non la sfortuna**:
  - il guasto capita: 0;
  - risolto in fretta: +3 e applausi del pubblico (+6 gradimento). «In fretta»
    dipende dal guasto (vedi *Tempi del guasto* sotto);
  - risolto lentamente: 0;
  - risolto dal bidello al posto tuo: −5;
  - microfono ricollegato a un ingresso diverso da quello cablato al montaggio: −2;
  - larsen: −5 (colpa del volume).

### Il guasto del microfono (seconda prova)

Il guasto si risolve ricordando il cablaggio, non premendo un pulsante.

- **Catena da controllare**: Microfono → Cavo → Ingresso (retro del mixer) →
  Mixer (banco). Ogni controllo costa tempo (il mixer meno, è davanti a te) e
  sul palco un cerchio mostra dove stai guardando; quando trovi il guasto il
  cerchio diventa rosso. Sopra la catena la domanda: «Dove si è interrotto il
  segnale?». Durante il guasto il pubblico si scurisce e il banco si allarga.
- **Quattro cause**, una a caso:
  - *Connettore sfilato dal microfono*: si gira la spina XLR finché la chiave
    è allineata, poi si infila. Storta non entra.
  - *Filo staccato dentro la spina del cavo*: non si vede dal palco. Si prende
    un cavo dal baule (XLR, DMX, Jack, Speakon: il DMX sembra un XLR ma ha 5
    poli), si sceglie il capo da attaccare al microfono (femmina: il microfono
    ha l'uscita maschio), poi lo si collega sul retro del mixer.
  - *Cavo uscito dal suo ingresso*: si sceglie la presa sul retro del mixer tra
    MIC 1–4 (XLR in), LINE 5–6 (jack in) e MAIN L/R (XLR out, un'uscita).
  - *Qualcuno ha toccato il mixer*: il canale del preside è in MUTE o col fader
    tutto giù. Si sistema dal banco.
- **La domanda della memoria**: «in che ingresso era?». La risposta è
  l'ingresso cablato al montaggio: va bene qualsiasi MIC 1–4, purché sia
  cablato (deciso). Aperta da sola, la pagina lo estrae a caso a ogni partita
  e lo scrive solo nella scheda iniziale. Se
  lo rimetti altrove nessun avviso: la voce arriva su un canale col fader giù,
  bisogna accorgersene dai meter; a fine discorso −2 reputazione.
- **Musica di riempimento**: durante il guasto si può alzare il PC; il
  pubblico si spazientisce più piano (il calo è meno della metà). Appena il
  preside torna a sentirsi la musica va riabbassata, altrimenti copre il
  discorso e il pubblico cala.
- **Gli errori costano tempo**, non punti: cavo sbagliato, capo sbagliato,
  presa sbagliata o spina storta fanno perdere qualche secondo di silenzio.
- Il prototipo ha nella scheda iniziale la scelta del guasto da provare
  (a caso, microfono, cavo, ingresso, mixer).

### Tempi del guasto

Misurati giocando senza errori (mezzo secondo di reazione tra un tocco e
l'altro): mixer 3 s, ingresso 6 s, microfono 7 s, cavo 11,5 s (15,6 s se prima
si controllano microfono e ingresso, perché il filo staccato non si vede). Con
una soglia unica di 8 s il cavo non poteva mai dare gli applausi, e con un
paio di errori arrivava quasi sempre il bidello. Ora limite e applausi
dipendono dalla causa, con circa 5 s di margine per gli applausi e 15 s per il
limite:

| Guasto | Applausi entro | Tempo limite (poi il bidello) |
|---|---|---|
| Mixer | 8 s | 20 s |
| Ingresso | 11 s | 22 s |
| Microfono | 12 s | 24 s |
| Cavo | 17 s | 32 s |

Il tempo limite si accorcia con la stanchezza, come le altre finestre di
reazione: tempo limite × (1 − stanchezza / 250), quindi fino a −40% a
stanchezza 100; ogni controllo e riparazione dura (1 + stanchezza / 100)
volte di più. Nel gioco la stanchezza di partenza è quella del tecnico;
aperta da sola la pagina parte da 30. Il prossimo imprevisto arriva solo dopo il tempo limite del guasto.

## L'orologio del montaggio

Il montaggio ha un'ora vera: parte alle 16:30 (più il ritardo dello scarico)
e il collaudo è alle 19:30. Si legge sotto il titolo del foglio (ambra a
mezz'ora dal collaudo, rosso in ritardo). Corre col tempo di gioco, 7 secondi
per minuto (`CLOCK.msPerMin`), cioè circa 21 minuti reali per tre ore di
montaggio; un reset del palco non lo riporta indietro.

Le scelte che lo usano:
- **Pezzo difettoso dallo scarico** (finale, sub, testa, Quadro, PC, PAR):
  «Controlla e sistema» da te costa 10 minuti sull'orologio; «Lascialo a
  Macio» lo rende pronto 25 minuti dopo mentre tu fai altro (uno alla volta,
  il giro non passa finché non ha finito). Lo stativo e i bauli restano come
  prima.
- **Pausa**: il caffè non costa tempo ma sono tre; seduto sul case costa 20
  minuti (e intanto Macio va avanti).
- **Collaudo in anticipo**: ogni 2 minuti d'anticipo 1 punto di stanchezza
  in meno prima della posa dei cavi (massimo 35). In ritardo nessun
  riposo, e nella valutazione la qualità del montaggio perde 1 punto ogni 3
  minuti di ritardo (massimo 25). L'ora del collaudo è nel salvataggio
  (`collaudo.clock`) e nei record della serata; le partite di prima non ce
  l'hanno e non perdono niente.

## Montaggio con meno tocchi (fatto)

5 ottobre 2026: il montaggio minimo sul telefono (`tests/partita-telefono.js`)
passa da 233 a 183 tocchi senza togliere scelte: si sono tolti solo i tocchi
che non decidono niente.
- **Niente Fatto tra un cavo e l'altro**: col cavo appena collegato in mano,
  un tocco sul prossimo dispositivo lo lascia giù com'è e va avanti. Le
  pieghe si trascinano come prima; un tocco breve su una piega che cade
  sopra un dispositivo vale come tocco sul dispositivo.
- **Meno «Quale?»**: col cavo in mano, se lì sotto l'altro capo entra in un
  solo dispositivo (quello in verde) il tocco va a lui. Col dito nel mezzo
  di un dispositivo vince lui sui cavi che si possono prendere più in là
  (`inCore`, `edgeFreeElsewhere`; un cavo che sta tutto lì resta nel
  «Quale?», così ogni cavo si prende ancora col dito); il mixer sul tavolo non
  si confonde più col finale nel rack sotto.
- **Acceso, il pannello si chiude da solo** (spento resta aperto: di solito
  si cerca un guasto). L'ordine di accensione lo decidi sempre tu.
- **Dalla stessa presa del Quadro**: dopo un cavo partito da una presa del
  Quadro il prossimo dello stesso tipo riparte da lì (stessa fase), come la
  catena dal THRU. Per un'altra fase si sceglie la presa nel Quadro; un pezzo
  da posare o un cavo preso dal baule lo fanno cadere.
- **Un solo cavo adatto**: toccando una presa libera senza il cavo giusto,
  se nel baule ne entra uno solo (Speakon, DMX, jack, XLR) si prende quello
  senza chiedere. Prendendo i cavi così (`PRESA_PRIMA=1`) il montaggio
  minimo è di 161 tocchi.

## Il guasto del microfono: le strade

Come per il PAR del DJ, il guasto del microfono nel discorso del preside
si può gestire in più modi: cercarlo lungo la catena (in fretta vale
applausi e reputazione), mandare il capo per una 🍺 (ci mette circa 14 s,
niente applausi ma niente figuraccia, tu resti al mixer a tenere il
pubblico con la musica del PC; nella valutazione vale come un guasto
risolto tardi), o lasciarlo: allo scadere arriva Gerry (−5 reputazione).
