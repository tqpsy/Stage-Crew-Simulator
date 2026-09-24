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

## Mezzi e carico/scarico

- Il mezzo del service cresce coi livelli: `LEVEL_VEHICLE` in `main.js`
  sceglie tra `furgone` (livello 1), `camion` e `bilico` (`VEHICLES`).
- Il bilico va rifinito come trattore + semirimorchio separati; con il
  bilico i case vanno spostati più avanti sulla banchina.
- Più case (e più bauli) man mano che crescono impianto e livello.

## Test automatici

- Per ogni nuovo livello: aggiornare `tests/collaudo-livello1.js` (o
  crearne uno per il livello) e `tests/partita-telefono.js`, così ogni
  soluzione reale viene promossa e ogni errore bocciato col messaggio
  giusto.

## Partita, menù e highscore

- Già fatto: menù di gioco (☰), nome e logo del service (testata,
  livrea dipinta sulla fiancata del furgone, scritta finale; logo pronto o
  creato con forma, simbolo e due colori), salvataggio automatico in un solo slot,
  impostazioni (volume, effetti ridotti, salta lo show).
- Il salvataggio è un oggetto `scs-save` con `v` (versione): se il formato
  cambia, scrivere una conversione dalla versione vecchia invece di
  azzerare la partita.
- **Reputazione** (il valore principale del service): non cala mai.
  Ogni livello porta la reputazione del suo miglior collaudo (oggi 100 per
  l'impianto che funziona + fino a 50 per la procedura pulita: −10 per test
  fallito, scatto del magnetotermico o del salvavita, −5 per colpo nelle
  casse). Rifare un livello uguale non aggiunge nulla, rifarlo meglio
  aggiunge la differenza. Nuova partita = nuovo service, da 0.
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
