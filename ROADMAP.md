# Stage Crew Simulator — appunti per i livelli successivi

Idee e richieste già decise, da sviluppare nei prossimi livelli.

## Luci

- **Richieste del light designer**: il light designer chiederà di
  indirizzare i fari con una modalità precisa (per esempio 8CH) e quindi
  con un certo numero di canali. Il livello dovrà controllare, faro per
  faro, indirizzo e modalità richiesti (oggi il Test impianto accetta
  anche fari in gruppo con lo stesso indirizzo e boccia solo le
  sovrapposizioni parziali sullo stesso universo).
- Obiettivi dopo il test che richiedono di comandare i fari uno per uno.
- **Puntamento a mano dei PAR** (pan/tilt, zona da illuminare): nel
  livello 1 il PAR sullo stativo si punta da solo in base al ruolo
  (frontale dal Pit, taglio dai lati); il puntamento manuale arriverà
  coi livelli del light designer.
- Più avanti: americane (truss) oltre agli stativi, controluce, teste mobili.

## Audio

- **Monitor di palco**: le mandate AUX del mixer del livello 1 sono jack.
  Per i monitor aggiungere nel baule SEGNALE il cavo **Jack/XLR** (jack
  stereo → XLR maschio) verso il finale dei monitor o le spie attive.
- Livelli più avanzati: mixer più grande (digitale) con 4–6 uscite AUX
  in XLR; i canali del mixer crescono coi livelli.
- Quando esisterà il cavo Jack/XLR, il test dovrà accettare anche la
  scheda audio negli ingressi XLR del mixer (CH 1–4): dal vero funziona.
- La DI resta per il cablaggio futuro degli strumenti sul palco.

## Regia e rack

- Livello 1: tavolo regia in Off Stage, finale in rack 2U sotto il piano.
- Livelli 2-3: rack a terra accanto al tavolo (finali, radiomicrofoni),
  impilabili, con un limite di unità (U).
- Più avanti: regia in FOH col multicore; i rack finali restano a lato palco,
  **già cablati dentro** (si collega solo il multipolare).
- Guasto possibile: rack del finale chiuso o col retro contro il muro → il
  finale scalda e va in protezione.

## Attrezzi da sbloccare con la reputazione

Invece di livelli più facili, strumenti veri che semplificano il lavoro:
tester per cavi, sequencer di accensione, cavi già etichettati, multicore,
ciabatte con interruttore generale, rack precablati.

## Guasti nei livelli successivi (proposta)

Il guasto del microfono del preside (vedi `docs/livello1-festa-scuola.md`) è il
modello: una catena di pezzi da controllare, cause diverse e decisioni di
cablaggio per riparare. Ogni guasto nuovo nasce dal materiale nuovo.

| Fase / livello | Catena | Guasti possibili |
|---|---|---|
| DJ (liv. 1) | consolle → DI → XLR → mixer (L/R) | DI col GROUND sbagliato (ronzio), suona un solo canale (manca L o R), ciabatta del DJ sovraccarica che fa scattare il magnetotermico |
| Cantante (liv. 1) | chitarra → jack → DI → XLR → mixer, più la voce | corda rotta (musica dal PC), jack della chitarra difettoso, ingressi finiti: va staccato il DJ |
| Monitor | AUX → Jack/XLR → finale monitor → spia | mandata AUX a zero, Jack/XLR montato al contrario, larsen in spia |
| Luci DMX | consolle → DMX → PAR in catena | indirizzo sbagliato, un PAR che interrompe la catena e spegne quelli dopo, terminatore mancante |
| Stress impianto | — | tweeter bruciato, finale in protezione: si cambia col ricambio nel furgone |

I guasti già visti tornano più difficili: indizi più deboli o assenti (si
trovano per esclusione), catene più lunghe, due guasti insieme o un guasto
sopra un altro imprevisto, bauli più pieni con più tranelli (il Jack/XLR, per
esempio). La domanda «in che ingresso era?» resta il cuore: la risposta è
sempre il cablaggio fatto dal giocatore, e con DJ e cantante gli ingressi
cambiano da una fase all'altra.

## Mezzi e carico/scarico

- Il mezzo del service cresce coi livelli: `LEVEL_VEHICLE` in `main.js`
  sceglie tra `furgone` (livello 1), `camion` e `bilico` (`VEHICLES`).
- Il bilico va rifinito come trattore + semirimorchio separati; con il
  bilico i case vanno spostati più avanti sulla banchina.
- Più case (e più bauli) man mano che crescono impianto e livello.
- **Minigioco dello scarico** (16:00 in scaletta): fisica dall'alto, collega
  CPU, i danni si pagano al montaggio. Design in `docs/minigioco-scarico.md`.

## Test automatici

- Per ogni nuovo livello: aggiornare `tests/collaudo-livello1.js` (o
  crearne uno per il livello) e `tests/partita-telefono.js`, così ogni
  soluzione reale viene promossa e ogni errore bocciato col messaggio
  giusto.
- Il capo squadra tutor vale solo per il livello 1 (`TUTOR_LEVELS`):
  `tests/capo.js` controlla che fermi ogni errore una volta sola. I test che
  provocano errori apposta spengono i consigli (`settings().bossTips`).

## Partita, menù e highscore

- Già fatto: menù di gioco (☰), nome e logo del service (testata,
  livrea dipinta sulla fiancata del furgone, scritta finale; logo pronto o
  creato con forma, simbolo e due colori; la scritta del nome in 6 stili
  da service: Tour, Neon, Stencil, LED wall, Gaffer, Fasci di luce), salvataggio automatico in un solo slot,
  impostazioni (volume, effetti ridotti, salta lo show), scaletta della
  serata all'inizio della partita (tasto 📋 per riaprirla).
- Il salvataggio è un oggetto `scs-save` con `v` (versione): se il formato
  cambia, scrivere una conversione dalla versione vecchia invece di
  azzerare la partita.
- **Reputazione** (il valore principale del service): regole in
  `docs/livello1-festa-scuola.md`. Parte da 0, sale con fasi completate,
  guasti gestiti bene e birre rifiutate, scende con i guasti gestiti male;
  l'apparecchio rotto non conta. Ogni fase conta una volta sola. Oggi c'è
  il collaudo (+5); `addReputation` è pronta per guasti e richieste extra.
  Nuova partita = nuovo service, da 0.
  Da sviluppare: livelli (e mezzi, materiale, venue più grandi) che si
  aprono a soglie di reputazione; reputazione anche dagli obiettivi dopo
  il test (soundcheck, richieste del light designer).
- **Highscore**: per ogni collaudo riuscito `Profile.data.records[livello]`
  tiene già i dati grezzi (tempo di gioco, test fatti e falliti, scatti del
  magnetotermico e del salvavita, colpi nelle casse, nome del service,
  data), i migliori 20. Resta da decidere la formula del punteggio (per
  esempio stelle per livello) e la schermata della classifica, da aprire
  dal menù e alla fine dello show.
- Logo: più avanti anche sui flight case, sulle magliette della crew e
  sui mezzi più grandi; eventualmente un logo caricato come immagine.
- Più avanti, con più livelli: più slot di salvataggio, scelta del livello
  e livelli sbloccati, esporta/importa il salvataggio.
