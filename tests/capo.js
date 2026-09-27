/* Il capo squadra tutor del livello 1: la prima volta che un'azione sta per
   causare un errore di procedura la ferma e spiega (una volta sola per tipo);
   se il giocatore la rifà, succede davvero. Con i consigli spenti non
   interviene mai.

   Uso:  node tests/capo.js
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 1000 } });
  if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  await p.evaluate(() => startNewGame('Capo', serviceOffers([])[0]));
  await p.waitForFunction(() => !menuOpen);
  await p.evaluate(() => closeSchedule());
  const res = await p.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const S = window.__scene, out = [];
    const check = (ok, what) => { if (!ok) out.push(what + ' | toast: ' + el('#toast').textContent); };
    const boss = () => el('#toast').classList.contains('boss');
    const P = (ty, gx, gy) => { const w = gridToScreen(gx + .5, gy + .5); S.placeComponentAt(ty, w.x, w.y); };
    const on = ty => { const v = S.compVisuals.tavolo_1.container; S.placeComponentAt(ty, v.x, v.y); };
    const W = (c, a, ap, bb, bp) => { if (c) selectCable(c); openRearPanel(a); onRearPortClick(a, ap); if (rearPanelId) closeRearPanel(); openRearPanel(bb); onRearPortClick(bb, bp); if (rearPanelId) closeRearPanel(); };
    P('quadro', 4, 2); P('tavolo', 7, 5); on('mixer'); on('ampli'); P('sub', 1, 8); P('sub', 7, 8);
    W('cee_tri', 'allaccio', 'out', 'quadro_1', 'in');
    ['mixer_1', 'ampli_1', 'sub_1', 'sub_2'].forEach(d => W('cee_powercon', 'quadro_1', 'out_1', d, 'power'));
    ['main', 'rcd', 'L1'].forEach(k => toggleProtection(k));
    // finale prima del mixer: il capo lo ferma una volta
    toggleDevicePower('ampli_1');
    check(!gameState.placed.ampli_1.on && boss(), 'finale prima del mixer non fermato');
    toggleDevicePower('ampli_1');
    check(gameState.placed.ampli_1.on, 'finale non acceso al secondo tentativo');
    // mixer col finale acceso: fermato, poi il colpo arriva davvero
    toggleDevicePower('mixer_1');
    check(!gameState.placed.mixer_1.on && boss(), 'mixer col finale acceso non fermato');
    check(!(gameState.procErrors || []).includes('pop'), 'colpo nelle casse nonostante il capo');
    toggleDevicePower('mixer_1');
    check(gameState.placed.mixer_1.on && (gameState.procErrors || []).includes('pop'), 'al secondo tentativo il colpo non arriva');
    // due sub insieme sulla stessa fase: fermato il secondo
    toggleDevicePower('sub_1');
    toggleDevicePower('sub_2');
    check(!gameState.placed.sub_2.on && boss() && !gameState.trips, 'secondo sub insieme non fermato');
    await sleep(800);
    // staccare un cavo sotto carico: fermato una volta, poi salvavita
    const e = gameState.edges.find(x => x.b === 'sub_1' && x.bPort === 'power');
    S.selectedEdgeId = e.id; S.deleteSelectedEdge();
    check(gameState.edges.includes(e) && boss() && !gameState.rcdTrips, 'cavo sotto carico staccato senza avviso');
    S.selectedEdgeId = e.id; S.deleteSelectedEdge();
    check(!gameState.edges.includes(e) && gameState.rcdTrips === 1, 'al secondo tentativo il salvavita non scatta');
    // ogni consiglio una volta sola
    const seen = Object.keys(Profile.data.tutorSeen).sort().join(',');
    check(seen === 'ampliFirst,inrush,live,pop', 'consigli visti: ' + seen);
    // con i consigli spenti il capo non interviene
    S.resetLevel(true); Profile.data.tutorSeen = {}; settings().bossTips = false;
    P('quadro', 4, 2); P('tavolo', 7, 5); on('mixer'); on('ampli');
    W('cee_tri', 'allaccio', 'out', 'quadro_1', 'in');
    ['mixer_1', 'ampli_1'].forEach(d => W('cee_powercon', 'quadro_1', 'out_1', d, 'power'));
    ['main', 'rcd', 'L1'].forEach(k => toggleProtection(k));
    toggleDevicePower('ampli_1');
    check(gameState.placed.ampli_1.on && !Object.keys(Profile.data.tutorSeen).length, 'il capo parla anche coi consigli spenti');
    return out;
  });
  console.log('PROBLEMI:', JSON.stringify(res, null, 1)); console.log('ERRORI JS:', errs);
  await b.close();
  const ok = !res.length && !errs.length;
  console.log(ok ? 'CAPO OK' : 'CAPO FALLITO');
  process.exit(ok ? 0 : 1);
})();
