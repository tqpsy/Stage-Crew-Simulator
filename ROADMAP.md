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
  coi livelli del light designer. Deciso: nel livello 1 i PAR restano
  puntati da soli, come ora.
- Nei livelli successivi (deciso): americane (truss) oltre agli stativi,
  teste mobili; più avanti controluce.
- Banco regia completo (mixer e consolle luci con memorie per ogni fase):
  nei livelli successivi (deciso).

## Audio

Tutto questo arriva nei livelli successivi (deciso).

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

## Assistente (dal livello 2)

Dal livello 2 il capo tutor non c'è più: al suo posto un **assistente** da
assumere a inizio serata. La reputazione è una soglia (non si spende), i
favori nei guasti grossi si pagano a birre. Tre caratteri (proposta): Nico
«Cavetto» (rep. 10, stagista), Sabri «Nastro Nero» (rep. 20, come il capo),
Tonino «Ventennale» (rep. 35, il più bravo, due birre a favore). Design in
`docs/assistente.md`.
- Già fatto: i dati (`ASSISTANTS` in `main.js`), assunzione e favori
  (`hireAssistant`, `assistantFavor`), `assistant` nel salvataggio
  (in ogni slot, le partite vecchie senza assistente si leggono con nessuno
  assunto). Nel livello 1 non si assume nessuno.
- Da fare col livello 2: la scheda «Assistente» nella scaletta, il ritratto
  in testata, la scelta «Chi ci va?» nello spettacolo, i ritratti in
  `img/personaggi.svg`. Più avanti: aiuto allo scarico e alla posa,
  esperienza, due assistenti nei palchi grandi.

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
- **Minigioco dello scarico** (16:00 in scaletta): finito per il livello 1.
  `scarico.html` si apre dopo la scaletta; i pezzi rotti mancano al
  montaggio, i difettosi hanno il segno arancione e si sistemano dal loro
  pannello, le birre vanno in testata. Da fare più avanti: scenari 2-5 coi
  mezzi più grandi, eventuale grafica isometrica. Design in
  `docs/minigioco-scarico.md`.

## Posa dei cavi

- **Posa dei cavi** (20:00 in scaletta): nel gioco per il livello 1 i cavi
  si stendono al montaggio, a tratti dritti; alle 20:00 passa Gerry a
  controllarli. `posa-cavi.html` resta come minigioco a sé (pagina da sola):
  i cavi si sistemano piegandoli come corde, a tempo fino alle 20:30. Gerry il bidello controlla via di
  fuga, passacavi nei passaggi, cavi in scena, nastro e ronzio. Le stelle
  danno reputazione. Nell'isometrico i cavi seguono le pieghe; gli errori
  lasciati alle 20:30 passano al discorso del preside (`caviLeftovers()`).
  Design in `docs/minigioco-posa-cavi.md`.

## Spettacolo

- **Discorso del preside** (21:00): nel gioco. `preside.html` si apre dopo la
  posa dei cavi (o dalla scaletta) quando il microfono è sull'asta e in un
  ingresso MIC del mixer acceso; riceve l'ingresso cablato, i PAR montati, i
  cavi lasciati dalla posa, le birre e la stanchezza, e restituisce
  reputazione (una volta sola), birre e stanchezza. Design in `docs/livello1-festa-scuola.md`.
  Il discorso resta col suo palco disegnato di fronte, non va
  nell'isometrico (deciso); lo stesso vale per il DJ set e il cantante. Il microfono va bene su qualsiasi ingresso MIC,
  purché cablato.
- Dopo il DJ set (fatto): Gerry ha cacciato il DJ e **Macio** improvvisa
  un **karaoke** (`karaoke.html`): il tecnico manda avanti il testo a mano,
  sillaba per sillaba, e tiene la voce di Macio (accento di Chieti) nella
  zona verde.
  Prende il posto del cantante con chitarra. Da fare: a fine serata il
  **carico del furgone**, un minigioco puzzle unico nel suo genere, da
  provare. Design in `docs/livello1-festa-scuola.md`.

## Show del DJ set

- **Light Operator Hero** (21:15 in scaletta): fatto, `dj.html` dopo il
  cambio palco. Luci a ritmo su tre memorie, sempre più difficile, guasti-nota, PAR senza DMX,
  fase del Quadro con la scelta tu / capo / Gerry e il rewind del DJ, finale
  di Gerry. Mappa del brano da `strumenti/mappa-dj.py`. Da fare: l'audio
  nella catena simulata, il brano caricato dal giocatore, guasti a caso,
  l'assistente al posto del capo dal livello 2. Vedi `docs/spettacolo-dj.md`.

## Stanchezza del tecnico

- Livello 1 (fatto): un valore 0-100 nel salvataggio, nel tasto 🍺 in
  testata; sale col tempo di gioco e con le azioni, scende con una birra
  (che esce dal punteggio). Effetto leggero: sopra 70 il connettore a volte
  scivola di mano. Regole in `docs/livello1-festa-scuola.md`.
- Il discorso del preside e lo spettacolo del DJ partono con la stanchezza
  del tecnico (nel DJ stringe la finestra delle note).
- Da fare: passarla allo scarico; nei livelli successivi effetti più forti
  (cavo nella presa sbagliata, tocchi meno precisi) e numeri più duri.
- Riparare col ricambio nel furgone costerà stanchezza (vedi *Guasti* in
  `docs/livello1-festa-scuola.md`).

## Test automatici

- Per ogni nuovo livello: aggiornare `tests/collaudo-livello1.js` (o
  crearne uno per il livello) e `tests/partita-telefono.js`, così ogni
  soluzione reale viene promossa e ogni errore bocciato col messaggio
  giusto.
- Il capo squadra tutor vale solo per il livello 1 (`TUTOR_LEVELS`):
  `tests/capo.js` controlla che fermi ogni errore una volta sola. I test che
  provocano errori apposta spengono i consigli (`settings().bossTips`).
- L'assistente vale dove il capo non c'è: `tests/assistente.js` controlla
  che nel livello 1 non si assuma nessuno, soglie, birre, guasti e favori
  per set. Col livello 2 va esteso alla scelta «Chi ci va?» nello spettacolo.
- `tests/scarico.js`: lo scarico dentro il gioco e le sue conseguenze sul
  montaggio. Senza rete servono `PHASER_PATH` e `MATTER_PATH`.
- `tests/posa-cavi.js` (la pagina da sola) e `tests/posa-cavi-gioco.js` (la
  posa dentro il gioco, con un montaggio vero); `tests/preside-gioco.js`: il
  discorso del preside dentro il gioco, dopo collaudo e posa;
  `tests/preside-cavi.js`: i cavi lasciati dalla posa nel discorso (pagina da
  sola).
- `tests/stanchezza.js`: la stanchezza del tecnico (tasto 🍺, tempo, azioni,
  birra con conferma, connettore che scivola, ricarica, nuova partita).
- `tests/robustezza.js`: frecce e WASD, ripresa con un altro schermo,
  Annulla dopo il reset, file importati, impostazioni nei minigiochi.
- `sh tests/tutti.sh` lancia tutti i test e dice quali falliscono.

## Partita, menù e highscore

- Già fatto: menù di gioco (☰), nome e logo del service (testata,
  livrea dipinta sulla fiancata del furgone, scritta finale; logo pronto o
  creato con forma, simbolo e due colori; la scritta del nome in 6 stili
  da service: Tour, Neon, Stencil, LED wall, Gaffer, Fasci di luce), salvataggio automatico,
  impostazioni (volume, effetti ridotti, salta lo show), scaletta della
  serata all'inizio della partita (tasto 📋 per riaprirla).
- Il salvataggio è un oggetto `scs-save` con `v` (versione): se il formato
  cambia, scrivere una conversione dalla versione vecchia invece di
  azzerare la partita. Oggi è la versione 5.
- **Slot di salvataggio** (fatto): 3 partite (`SLOT_COUNT`). Dal menù
  «Partite salvate»: ogni slot mostra nome e logo del service, tecnico,
  livello e fase raggiunti (es. «Livello 1 · Festa della scuola: Messa in
  sicurezza dei cavi (2/5)»), reputazione, birre e data dell'ultima
  partita. Da lì si gioca, si esporta, si cancella (chiede conferma); negli
  slot vuoti si inizia una nuova partita o se ne importa una. «Nuova
  partita» usa il primo slot vuoto; con gli slot pieni manda a
  cancellarne uno. Cambiare slot a partita in corso ricarica la pagina e
  la partita scelta riparte da sola. Impostazioni, record e service già
  proposti sono comuni a tutti gli slot; il resto (tecnico, service,
  reputazione, livello, fasi, birre) è della partita.
  Formato: `{ v: 5, active, settings, records, usedServices, slots: [partita | null ×3] }`.
  I salvataggi a slot unico (versioni 1-4) si convertono: la partita
  diventa lo slot 1.
- **Esporta/importa** (fatto): «Esporta» scarica un file
  `stage-crew-<service>-<data>.json` con `{ kind: 'stage-crew-simulator',
  v, exportedAt, slot }` (solo la partita, niente impostazioni né
  record). «Importa file» lo rimette in uno slot vuoto dopo aver
  controllato firma, versione (una versione più nuova del gioco viene
  rifiutata) e contenuto; accetta anche un vecchio `scs-save` a slot unico
  (versioni 1-4), che viene convertito.
- **Livelli a soglie di reputazione** (struttura fatta): `LEVELS` in
  `main.js`, i cinque scenari di `docs/minigioco-scarico.md` con venue e
  mezzo. Soglie (proposta): livello 2 a ★ 20, 3 a ★ 60, 4 a ★ 110, 5 a
  ★ 180; il livello 1 giocato bene vale circa 25-30. Dal menù «Livelli»: il
  livello 1 con le sue fasi (fatte ✓, adesso ▶), gli altri bloccati 🔒
  con la soglia, quanto manca e una barra; aperti ma non ancora fatti
  dicono «arriva nelle prossime versioni». Quando la reputazione apre un
  livello nuovo compare un puntino sul ☰ e su «Livelli» finché non lo si
  guarda. Da fare con il livello 2: giocarlo davvero (scelta del livello
  che cambia scena, `LEVEL_VEHICLE`, dotazione) e decidere se si possono
  rigiocare i livelli già finiti.
- **Reputazione** (il valore principale del service): regole in
  `docs/livello1-festa-scuola.md`. Parte da 0, sale con fasi completate,
  guasti gestiti bene e birre rifiutate, scende con i guasti gestiti male;
  l'apparecchio rotto non conta. Ogni fase conta una volta sola. Oggi c'è
  il collaudo (+5); `addReputation` è pronta per guasti e richieste extra.
  Nuova partita = nuovo service, da 0 (in un altro slot: la partita
  vecchia resta).
  I livelli (e mezzi, materiale, venue più grandi) si aprono a soglie di
  reputazione: vedi sopra. Da sviluppare: reputazione anche dagli
  obiettivi dopo il test (soundcheck, richieste del light designer).
- **Highscore**: per ogni collaudo riuscito `Profile.data.records[livello]`
  tiene già i dati grezzi (tempo di gioco, test fatti e falliti, scatti del
  magnetotermico e del salvavita, colpi nelle casse, nome del service,
  data), i migliori 20. Deciso: la classifica è quella **delle proprie
  partite** (niente classifica online), da aprire dal menù e alla fine
  dello show. Resta da definire la formula del punteggio (per esempio
  stelle per livello).
- Logo (deciso, tutto): anche sui flight case, sulle magliette della crew
  e sui mezzi più grandi, e un logo caricato come immagine.
- Da decidere: se i record (e la futura classifica) restano comuni a
  tutti gli slot, come oggi, o si mostrano anche per partita; se il file
  esportato deve poter contenere tutti gli slot insieme.
- Stanchezza del tecnico e assistente da assumere dal livello 2: in
  lavorazione in sessioni a parte.
