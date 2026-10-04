# Stage Crew Simulator

Simulatore di cablaggio per stage show: sei un tecnico di un service e devi
scaricare, montare e collegare l'impianto audio e luci prima dello spettacolo.

Si gioca nel browser: basta aprire `index.html`. Serve la connessione a
internet, perché Phaser, Matter.js (lo scarico) e i caratteri arrivano da CDN.

## Schermi supportati

Il gioco funziona con mouse e con il tocco. È provato su questi schermi
(larghezza × altezza in pixel CSS):

| Schermo | Esempio |
|---|---|
| 360 × 640 | telefoni Android piccoli |
| 390 × 844 | iPhone 12–14 |
| 412 × 915 | telefoni Android grandi |
| 844 × 390 | telefono in orizzontale |
| 768 × 1024 | tablet |
| 1366 × 768 e oltre | computer |

**Larghezza minima: 360 px.** Sotto questa misura, per esempio a 320 × 568
(iPhone SE di prima generazione, iPhone 5), l'area di gioco resta troppo
bassa e la partita non si riesce a completare.

## Documenti

- [`ROADMAP.md`](ROADMAP.md): idee per i livelli successivi
- [`docs/`](docs): design del livello 1 e dei minigiochi dello scarico e
  della posa dei cavi; il discorso del preside è in
  `docs/livello1-festa-scuola.md`

## Test

I test sono in `tests/` e richiedono Playwright. Per lanciarli tutti, con
il riepilogo finale:

```
sh tests/tutti.sh
```

Uno solo, per esempio la partita col telefono a 360 × 640:

```
node tests/partita-telefono.js 360 640
```

Senza rete, indica le librerie locali con `PHASER_PATH` e `MATTER_PATH`.
La posa dei cavi ha due test: `tests/posa-cavi.js` (il vecchio minigioco,
pagina da sola) e `tests/posa-cavi-gioco.js` (i cavi stesi al montaggio e il
giro di Gerry alle 20:00). Il discorso del preside (21:00,
`preside.html`, dopo la posa) ne ha altri due: `tests/preside-gioco.js`
(dentro il gioco, dopo collaudo e posa) e `tests/preside-cavi.js` (le
conseguenze della posa, pagina da sola).
Lo spettacolo del DJ (21:15, `dj.html`, dopo il cambio palco) ha
`tests/spettacolo-dj.js` (la pagina da sola) e `tests/dj-gioco.js` (dentro
il gioco). `tests/robustezza.js` prova frecce e WASD, la ripresa di una
partita con uno schermo diverso, Annulla dopo il reset, i file importati e
volume ed «Effetti ridotti» nei minigiochi.
