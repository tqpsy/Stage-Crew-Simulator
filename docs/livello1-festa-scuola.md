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
| 3 | **Cantante con chitarra** | DJ set finito | microfono voce XLR → mixer; chitarra → DI → XLR → mixer |

Ogni fase si chiude con un proprio test: se passa parte un'**animazione di 10 secondi**
che mostra cosa succede (il preside parla e il pubblico applaude, la gente balla
col DJ, accendini e telefoni per il cantante).

## Scheda obiettivi

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

Le birre sono anche la risorsa per recuperare la **stanchezza** (vedi sotto):
berne una la toglie dal punteggio finale, quindi c'è una scelta da fare.

## Guasti e reputazione (malus)

- Ogni scatto di magnetotermico/salvavita e ogni colpo nelle casse stressa
  l'impianto. Dopo un certo numero (proposta: 3) **si rompe qualcosa** (es. il
  finale o un PAR).
- Il livello si può comunque concludere, ma con un malus di **reputazione**,
  che si porta ai livelli successivi.

## Stanchezza — da sviluppare

Il tempo passa come stanchezza del tecnico. Più è stanco, più rischia di fare
errori (proposta: cavi che a volte si attaccano alla presa sbagliata, tocchi
meno precisi). Si recupera bevendo una birra.

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

## Personaggi (proposta)

Filo comune: la scuola, con i personaggi delle **materie** che prendono vita.

| Ruolo | Scelta consigliata | Alternative |
|------|-------------------|-------------|
| Preside | Donald Trump ("Preside Tramp"): discorso lunghissimo, vuole il volume più alto di tutti | — |
| DJ | Albert Einstein, "DJ E=mc²": capelli elettrizzati, BPM relativi | Leonardo da Vinci con piatti di legno inventati da lui; Sergio Mattarella serissimo alla techno |
| Cantante con chitarra | Dante Alighieri, "Nel mezzo del cammin — unplugged" | Cristiano Ronaldo che canta e urla "SIUUU" nel mic; Napoleone con la chitarra (e l'asta del mic troppo alta) |
| Bidello (dà le richieste extra) | Gerry Scotti o Carlo Conti | Gordon Ramsay che urla per i cavi in giro |

Personaggi storici: nessun problema di diritti. Personaggi viventi: caricatura
disegnata e nome parodia.

## Tra una fase e l'altra (proposta)

- Fase 0 (montaggio): tempo libero, niente pressione. È anche il tutorial.
- Cambi palco (fasi 1-3): barra di **pazienza del pubblico**. Se si svuota non
  si perde, ma si perde reputazione e il pubblico fischia.
- La **stanchezza** sale con il tempo e con le azioni; la birra la abbassa.

## Guasti (proposta)

- Contatore **stress impianto**: +1 per ogni magnetotermico, salvavita o colpo
  nelle casse.
- Al terzo si rompe l'apparecchio colpevole: colpo nelle casse → tweeter di una
  testa bruciato (suona gracchiante); scatto → il finale va in protezione.
- Si può ripararlo con il **ricambio nel furgone** (zona carico): costa tempo e
  stanchezza. Oppure si va avanti così e si perde reputazione.

## Reputazione (proposta)

Scala 0–100, si parte da 50 e si porta tra i livelli.
- apparecchio rotto: −10
- pazienza del pubblico finita: −5 per cambio palco
- fase completata: +5
- birra rifiutata in una richiesta extra: +5

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

- **Header**: barra del tempo con faccia del personaggio e orologio, misuratore
  del gradimento, 🍺, stanchezza, reputazione.
- **Palco isometrico**: resta la vista di gioco. Sopra compaiono i personaggi
  (preside al microfono, DJ alla consolle, Dante sullo sgabello) e il pubblico
  in platea: teste che si muovono a tempo, colore e fumetti che ne mostrano l'umore.
- **Imprevisti**: fumetto sopra il personaggio o il dispositivo, con un anello
  che si svuota (giallo → rosso). Toccare il fumetto apre direttamente il comando
  giusto (fader, memoria, pannello), per giocare al volo anche sul telefono.
  Esito: spunta verde e +gradimento, oppure suono del guaio e −gradimento.
- **Banco regia**: la barra in basso del montaggio diventa un cassetto con due
  schede, MIXER e LUCI (sul telefono occupa metà schermo sotto il palco; su
  computer sta di lato).
  - MIXER: una striscia per canale con fader verticale, meter con zona verde,
    MUTE e nome del canale (con la faccina di chi ci è collegato).
  - LUCI: un cerchio col colore reale di ogni PAR, fader dimmer, tavolozza
    colori, tasti memoria 1-6 (tocco = richiama, tenere premuto = salva).
- **Cambio palco**: si torna alla vista montaggio; la carta del prossimo
  personaggio dice cosa collegare, i canali del mixer mostrano cosa è attaccato.
- **Fine fase**: animazione illustrata di 10 s sopra il palco, poi un mini-verbale
  (gradimento, birre, reputazione).

## Decisi (proposte accettate)

- Personaggi: Preside Tramp, DJ E=mc² (Einstein), Dante unplugged, Gerry Scotti bidello.
- Richieste extra del livello 1: monitor per Dante, telefono del bidello, macchina del fumo.
- Pausa: sì, con il palco oscurato.
- Caricature: vettoriali disegnate nel codice, come i dispositivi.
- Reputazione salvata nel browser del giocatore.
- I numeri (gradimento, stress, pazienza) si tarano giocando.

## Prototipo

`prototipi/spettacolo-preside.html`: la fase del discorso del preside, cliccabile,
per provare il ritmo prima di portarla nel gioco.
