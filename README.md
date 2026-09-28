# Stage Crew Simulator

Simulatore di cablaggio per stage show: sei un tecnico di un service e devi
scaricare, montare e collegare l'impianto audio e luci prima dello spettacolo.

Si gioca nel browser: basta aprire `index.html`.

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
  della posa dei cavi

## Test

I test sono in `tests/` e richiedono Playwright. Esempio:

```
node tests/partita-telefono.js 360 640
```

Senza rete, indica le librerie locali con `PHASER_PATH` e `MATTER_PATH`.
La posa dei cavi ha tre test: `tests/posa-cavi.js` (la pagina da sola),
`tests/posa-cavi-gioco.js` (dentro il gioco) e `tests/preside-cavi.js` (le
conseguenze nel prototipo del discorso del preside).
Lo show del DJ set (`prototipi/spettacolo-dj.html`) ha `tests/spettacolo-dj.js`.
