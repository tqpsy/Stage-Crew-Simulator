# Minigioco del carico — il tetris del furgone

Stato: **prima versione nel gioco** (livello 1). `carico.html` si apre alle
23:00, dopo il DJ set (dopo il karaoke, quando ci sarà). Le regole sono da
provare giocando: i numeri da tarare sono in cima al file.

## In breve

La festa è finita. **Macio** porta fuori i case dalla palestra uno alla
volta, nell'ordine che capita. Il tecnico li incastra nel furgone, li lega
con tre cinghie e si parte. Durante il viaggio si vede cosa succede a quello
che è legato male. Gerry chiude il cancello alle **23:30**.

Non è lo scarico al contrario: lì contano fisica e percorso, qui contano
**incastro, ordine e peso**. Il viaggio alla fine mette alla prova il carico.

## Le regole

1. **Il vano a quadretti.** Il vano è di 7 × 11 quadretti da 25 cm (1,75 ×
   2,75 m). I passaruota rubano 3 quadretti per lato. I 12 case del
   livello 1 occupano 64 dei 71 quadretti liberi, quindi ci stanno, ma solo
   a pensarci un po'.
2. **Il marciapiede.** Sul marciapiede stanno solo **tre** case. Se è pieno,
   Macio aspetta. Un case già nel furgone si può riportare sul marciapiede
   se c'è un posto libero.
3. **La roba della scuola.** Due volte Macio porta qualcosa che non è
   vostro: il **leggio della scuola** e la **scopa di Gerry**. Va lasciato
   nel riquadro di Gerry, così si libera un posto. Se parte col furgone,
   costa una stella.
4. **Trascinare e girare.** I case si trascinano col dito o col mouse e si
   agganciano ai quadretti. L'ombra è verde se il case ci sta, rossa se no.
   Un tocco lo gira, e lo girano anche il tasto ↻ Ruota, **R** e il tasto
   destro mentre lo trascini. Se sporge dal portellone non entra.
5. **L'assetto.** Il mirino sul pianale è il baricentro dei chili.
   I pesanti vanno verso la cabina e al centro. Se il baricentro è troppo
   dietro (oltre il 55% del vano) o troppo di lato (oltre 0,6 quadretti),
   l'assetto è sbagliato: in viaggio tutto scivola di un quadretto in più e
   si perde una stella.
6. **Le cinghie.** Quando tutti i 12 case sono dentro si passa alle cinghie.
   Ce ne sono **tre**, e ognuna lega una fila da sponda a sponda: ogni case
   che tocca quella fila non si muove.
7. **Il viaggio.** Ci sono frenata (4 quadretti), curva a destra (3),
   ripartenza (2), curva a sinistra (3) e il dosso. I case slegati scivolano
   un quadretto alla volta finché non sbattono:
   - quello che viene preso si rovina in base ai **chili** di chi arriva,
     alla corsa fatta e alla **sua** fragilità;
   - quello che sbatte si rovina in base alla sua fragilità (anche un case
     leggero sente il colpo);
   - sul dosso saltano i case slegati nella metà dietro, e si rovinano solo
     quelli fragili.
   Un carico stretto non scivola. Le cinghie servono dove resta spazio.

## Punteggio

Si parte da 5 stelle e si perdono così:

| | Stelle |
|---|---|
| ogni case rotto | −2 |
| ogni case difettoso | −1 |
| due o più ammaccati | −1 |
| assetto sbagliato | −1 |
| roba della scuola nel furgone | −1 |
| partiti dopo le 23:30 | −1 |

| Stelle | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| Reputazione | −3 | −1 | 0 | +1 | +3 | +5 |

Con 5 stelle il capo offre una **birra**. La reputazione conta una volta
sola (`L1:carico`). Si può saltare, ma senza stelle e senza reputazione.

Gli stati dei case sono gli stessi dello scarico: integro, ammaccato,
difettoso e rotto. Oggi restano solo nella bolla e nel salvataggio
(`Profile.data.carico`). Più avanti potranno pesare sul livello dopo:
il case rotto al carico arriva rotto al prossimo scarico.

## Telefono e computer

Una sola tela, che si gira da sola: il furgone si mette in verticale con la
cabina in alto, oppure in orizzontale con la cabina a sinistra, e il
marciapiede va di fianco o sotto. Vince la sistemazione coi quadretti più
grandi. Gli avvisi e le battute di Macio stanno nella barra in basso, mai
sopra la scena.

## Dentro il gioco

- `SCHEDULE` alle 23:00: «Smontaggio e carico», `phase: 'carico'`, che è
  «Adesso» dopo il DJ set. Si apre dalla scaletta («Carica il furgone») o dal
  foglio («Smonta e carica il furgone»).
- `openCarico` e `finishCarico` in `main.js`. La pagina manda `carico-fine`
  con stelle, reputazione, birra, ora di partenza, case rovinati e roba
  della scuola portata via.
- Quando arriverà il karaoke, il carico andrà dopo di lui: basta cambiare la
  condizione in `schedulePhaseState('carico')`.
- Test: `tests/carico.js` (la pagina da sola e dentro il gioco).

## Da provare

- Se tre cinghie sono troppe o troppo poche.
- L'ordine di Macio: oggi è a caso. Un ordine "cattivo" (i sub per ultimi)
  potrebbe rendere il puzzle più interessante.
- Lo smontaggio vero e proprio prima del carico (staccare i cavi in ordine,
  spegnere prima di staccare), magari come fase nel gioco isometrico.
- Coi mezzi più grandi (camion, bilico): più case, case impilabili (i
  leggeri sopra i pesanti) e la sponda idraulica.
