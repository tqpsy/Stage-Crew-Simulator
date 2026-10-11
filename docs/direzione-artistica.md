# Direzione artistica: la miniatura fotografata

Primo campione: lo scarico del Livello 1 (`scarico.html`), 2026-10-11.
Riferimento visivo: **Topsy**, l'action figure di Luca. Le regole qui sotto
vengono da quello che si vede nelle sue foto e nel suo modello 3D, non da
uno stile preso altrove. Valgono per le scene che verranno rifatte dopo
(palestra del montaggio, carico, altri personaggi).

## Cosa si vede in Topsy

- **Proporzioni**: figura realistica (circa 7,5 teste), spalle larghe, braccia
  piene. Sagoma scura e compatta; la pelle (testa, braccia) fa da accento chiaro.
- **Materiali**: stoffa opaca con una trama fine (maglietta, pantaloni cargo),
  dettagli neri un po' lucidi (cinturone, tasche, guanti), pelle satinata.
  Niente superfici lisce da cartone.
- **Palette**: neri caldi (#141418–#2b2c30), pelle #d6a487, un accento verde
  (occhiali). Il colore forte è poco e serve a qualcosa.
- **Luce**: una luce principale morbida da in alto a sinistra, un po' di luce
  davanti, ombre morbide. È la luce di una foto di miniatura, non di un sole duro.
- **Dettaglio**: pochi dettagli, ma veri: cuciture, tasche, tatuaggio a fascia.

## Regole per il mondo

| Cosa | Regola |
|---|---|
| Luce | Una sola: chiave da in alto a sinistra dello schermo, riempimento debole davanti. Le facce dei solidi a destra più scure (come `caseFaces`). Nessun oggetto con una luce sua. |
| Ombre | Tutte nella stessa direzione: in pianta verso +x, +y di 0,35·h e 0,22·h (`dropShadow`, `figShadow`, muri, albero). Sotto ogni cosa un'ombra di contatto. |
| Personaggi | Figure 3D renderizzate nella vista del gioco con la luce della scena e un filo di controluce sul bordo in alto a sinistra, che le stacca dall'asfalto scuro. Ombra di contatto più ombra lunga. Niente contorni neri. |
| Materiali | Riconoscibili ma non rumorosi: asfalto, parquet d'acero, intonaco e zoccolo verniciato, alluminio mandorlato, laminato nero dei case. Trama fine, contrasto basso. |
| Palette | Neutri caldi per l'ambiente (asfalto grigio caldo, acero, intonaco #d9d3c6, zoccolo #5f6f7b, taglio dei muri #3a3d43). Colori saturi **solo** per le funzioni: zone, nastri dei case, cavi, selezione, stati. |
| Muri | Come in un plastico tagliato: tagliati all'altezza utile, con il taglio scuro in alto e lo spigolo chiaro. Dentro la palestra intonaco, zoccolo verniciato fino a 1 m, battiscopa in gomma. Porte e telai tagliati alla stessa quota del muro. |
| Attrezzature | Volumi chiari e dettagli che si leggono a 1,4–1,8 px/cm: profili, sfere, chiusure, maniglie, ruote, griglie. Niente scritte sotto i 9 px a schermo, a parte i nastri. |
| Interfaccia | L'HTML resta com'è. In scena solo selezione, obiettivi e zone; gli avvisi stanno nella barra in basso. |

## Come sono fatti i personaggi

Le figure arrivano già disegnate in **atlanti** (`img/personaggi/<chi>-atlante.webp`
con le celle in `personaggi-atlante.js`). Ogni atlante ha 8 direzioni, la figura
ferma più 6 fotogrammi del passo, per ogni posa delle braccia: `giu`, `avanti`
(alle maniglie), `porta` (case davanti). Il gioco sceglie la direzione da `facing`,
il fotogramma dalla strada fatta (`stride`) e la posa da cosa ha in mano (`drawAtlas`).

- **Topsy** viene dal suo modello 3D definitivo (`topsy3d.js` + `topsy-rig.js`,
  confermati da Luca l'11/10/2026, in `personaggi/topsy/definitivo/` dei file del
  progetto), renderizzato con la telecamera dello scarico (38° dall'alto,
  mondo girato di 45°).
- **Macio, Gerry e i bambini** sono miniature provvisorie (`strumenti/figure/manichini.js`),
  con la stessa luce, la stessa telecamera e lo stesso passo, finché non hanno la
  loro figura. Macio resta Macio: pelato lucido, baffoni scuri, pancia, maglia del
  service col logo anche sulla schiena. La maglia e il logo si tingono nel gioco coi
  colori del service (`tintFig`, maschera `macio-maschera.webp`).

Rigenerare (serve Playwright e three.js r128, che il gioco **non** carica):

```
node strumenti/figure/genera.js --three three.min.js --topsy topsy3d.js --rig topsy-rig.js [topsy macio gerry kid kid2]
```

**Se Topsy cambia ancora**: si rigenera con il nuovo `topsy3d.js` (`... genera.js ... topsy`).
Cambiano solo `img/personaggi/topsy-atlante.webp` e le sue celle: ambiente e codice
del gioco restano uguali. Lo stesso vale per una figura vera di Macio o degli altri.

## Prestazioni

Atlanti in WebP, ritagliati stretti e impacchettati: circa 1,9 MB in tutto
(Topsy 0,9 MB). Le figure simmetriche usano 5 direzioni e le altre 3 allo specchio.
Pavimento, ombre dei muri, case e albero si dipingono una volta sola. Nel gioco non
c'è nessun motore 3D.
