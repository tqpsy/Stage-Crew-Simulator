/* Il tavolo regia (da due) e il case accessori davanti: l'ordine della
   prova di Luca (stativi e PAR in Pit, poi il tavolo) non deve bloccare la
   squadra. Il tavolo dice subito cosa va tolto prima; tolto quello, esce.

   Uso:  node tests/scarico-tavolo.js
   Richiede Playwright. Senza rete, MATTER_PATH=/percorso/matter.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
  if (process.env.MATTER_PATH) await p.route('**/matter.min.js', r => r.fulfill({ path: process.env.MATTER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'scarico.html'));
  await p.click('#btn-start');
  await p.waitForFunction(() => G && G.mode === 'play', null, { timeout: 10000 });
  const r = await p.evaluate(() => {
    paused = true;
    const C = id => G.cases.find(x => x.def.id === id), P = G.player, M = G.macio, log = [];
    const run = (n, cond) => { for (let i = 0; i < n; i++) { stepSim(); if (cond && cond()) return i; } return -1; };
    const _t = toast; window.toast = (m, k) => { log.push(m); _t(m, k); };
    G.at = { passante1: 9999, bidello: 9999, telefono: 9999, passante2: 9999 };
    for (let i = 0; i < 3; i++) { vanOrder(); run(900, () => !busy(P) && !G.van.anim); }
    const ord = (w, id, zone) => { selectWorker(w); selectCase(C(id)); sendTo({ zone }); };
    ord(P, 'stativi', 'pit'); run(3600, () => !busy(P));
    ord(P, 'par', 'pit'); run(3600, () => !busy(P));
    const n0 = log.length;
    ord(P, 'tavolo', 'foh'); run(7200, () => !busy(P) && !busy(M));
    const first = log.slice(n0);
    ord(M, 'ricambio', 'palco'); run(3600, () => !busy(M));
    ord(P, 'tavolo', 'foh'); run(7200, () => !busy(P) && !busy(M));
    return { first, ric: C('ricambio').zone, tav: C('tavolo').zone, stuck: log.filter(m => /non ci arrivo|non passa/.test(m)) };
  });
  const problems = [];
  if (r.tav !== 'foh') problems.push('il tavolo non arriva in Off Stage: ' + JSON.stringify(r));
  if (r.ric !== 'palco') problems.push('il case accessori non arriva sul palco: ' + JSON.stringify(r));
  if (r.tav !== 'foh' || r.stuck.length) problems.push('la squadra resta bloccata: ' + JSON.stringify(r.stuck));
  if (!r.first.some(m => /Prima porta via ACCESSORI/.test(m)) && r.first.length) problems.push('messaggio sbagliato: ' + JSON.stringify(r.first));
  console.log('PROBLEMI:', JSON.stringify(problems, null, 1));
  console.log('ERRORI JS:', JSON.stringify(errs));
  await b.close();
  if (problems.length || errs.length) { console.log('TAVOLO FALLITO'); process.exit(1); }
  console.log('TAVOLO E ACCESSORI OK');
})();
