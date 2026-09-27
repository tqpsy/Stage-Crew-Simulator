/* Il capo squadra tutor del livello 1: la prima volta che un'azione sta per
   causare un errore di procedura la ferma e spiega (una volta sola per tipo);
   se il giocatore la rifà, succede davvero. Si controlla anche che dica
   sempre la cosa giusta: in ogni caso il consiglio è quello del guaio che
   sta per capitare davvero, e rifacendo l'azione quel guaio arriva. Con una
   procedura corretta, o coi consigli spenti, il capo non parla mai.

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
  await p.evaluate(() => { closeSchedule(); finishScarico({ skipped: true }); });   // lo scarico ha il suo test
  const res = await p.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const S = window.__scene, out = [];
    const toast = () => el('#toast').textContent;
    const check = (ok, what) => { if (!ok) out.push(what + ' | toast: ' + toast()); };
    // il capo ha appena parlato, con il consiglio della chiave attesa
    const said = key => el('#toast').classList.contains('boss') && toast().includes(TUTOR_TIPS[key]) && Profile.data.tutorSeen[key];
    const P = (ty, gx, gy) => { const w = gridToScreen(gx + .5, gy + .5); S.placeComponentAt(ty, w.x, w.y); };
    const onBase = (ty, base) => { const v = S.compVisuals[base].container; S.placeComponentAt(ty, v.x, v.y); };
    const W = (c, a, ap, bb, bp) => { if (c) selectCable(c); openRearPanel(a); onRearPortClick(a, ap); if (rearPanelId) closeRearPanel(); openRearPanel(bb); onRearPortClick(bb, bp); if (rearPanelId) closeRearPanel(); };
    const fresh = () => { S.resetLevel(true); Profile.data.tutorSeen = {}; settings().bossTips = true; showToast(''); };
    const impianto = () => {
      P('quadro', 4, 2); P('tavolo', 7, 5); onBase('mixer', 'tavolo_1'); onBase('ampli', 'tavolo_1'); P('sub', 1, 8); P('sub', 7, 8);
      W('cee_tri', 'allaccio', 'out', 'quadro_1', 'in');
      ['mixer_1', 'ampli_1', 'sub_1', 'sub_2'].forEach(d => W('cee_powercon', 'quadro_1', 'out_1', d, 'power'));
      ['main', 'rcd', 'L1'].forEach(k => toggleProtection(k));
    };

    // ---- procedura corretta: il capo non deve mai parlare
    fresh(); impianto();
    toggleDevicePower('mixer_1'); await sleep(50);
    toggleDevicePower('ampli_1'); await sleep(800);
    toggleDevicePower('sub_1'); await sleep(800);
    toggleDevicePower('sub_2'); await sleep(800);
    check(['mixer_1', 'ampli_1', 'sub_1', 'sub_2'].every(id => isRunning(id)), 'procedura corretta: qualcosa non è partito');
    // spegnimento corretto: prima i finali e i sub, poi il mixer
    ['sub_2', 'sub_1', 'ampli_1', 'mixer_1'].forEach(id => toggleDevicePower(id));
    check(!Object.keys(Profile.data.tutorSeen).length && !gameState.trips && !gameState.rcdTrips && !(gameState.procErrors || []).length,
      'procedura corretta, ma il capo è intervenuto: ' + Object.keys(Profile.data.tutorSeen));

    // ---- finale prima del mixer, poi mixer col finale acceso, poi due sub insieme
    fresh(); impianto();
    toggleDevicePower('ampli_1');
    check(!gameState.placed.ampli_1.on && said('ampliFirst'), 'finale prima del mixer: consiglio sbagliato o mancante');
    check(!('on' in gameState.placed.ampli_1) || gameState.placed.ampli_1.on === false, 'la previsione ha lasciato l\'interruttore cambiato');
    toggleDevicePower('ampli_1');
    check(gameState.placed.ampli_1.on, 'finale non acceso al secondo tentativo');
    toggleDevicePower('mixer_1');
    check(!gameState.placed.mixer_1.on && said('pop') && !(gameState.procErrors || []).includes('pop'), 'mixer col finale acceso: consiglio sbagliato o colpo arrivato');
    toggleDevicePower('mixer_1');
    check(gameState.placed.mixer_1.on && (gameState.procErrors || []).includes('pop'), 'rifatto: il colpo nelle casse non arriva (il capo avrebbe detto il falso)');
    await sleep(800);
    toggleDevicePower('sub_1');
    toggleDevicePower('sub_2');
    check(!gameState.placed.sub_2.on && said('inrush') && !gameState.trips, 'due sub insieme: consiglio sbagliato o mancante');
    toggleDevicePower('sub_2');
    check(gameState.trips > 0, 'rifatto subito: il magnetotermico non scatta (il capo avrebbe detto il falso)');

    // ---- cavo staccato sotto carico
    fresh(); impianto();
    toggleDevicePower('mixer_1');
    const e = gameState.edges.find(x => x.b === 'mixer_1' && x.bPort === 'power');
    S.selectedEdgeId = e.id; S.deleteSelectedEdge();
    check(gameState.edges.includes(e) && said('live') && !gameState.rcdTrips, 'cavo staccato sotto carico: consiglio sbagliato o mancante');
    S.selectedEdgeId = e.id; S.deleteSelectedEdge();
    check(!gameState.edges.includes(e) && gameState.rcdTrips === 1, 'rifatto: il salvavita non scatta');

    // ---- PAR (senza interruttore) attaccato a una fase viva: si toglie tensione dal Quadro
    fresh(); impianto();
    P('stativo', 6, 6); onBase('par', 'stativo_1');
    W('cee_powercon', 'quadro_1', 'out_1', 'par_1', 'power_in');
    check(!gameState.edges.some(x => x.b === 'par_1') && said('live') && /abbassa la sua fase sul Quadro/.test(toast()), 'PAR su fase viva: consiglio sbagliato o mancante');
    S.cancelPending();
    // come dice il capo: fase abbassata, collegato, fase rialzata: niente salvavita
    toggleProtection('L1');
    W('cee_powercon', 'quadro_1', 'out_1', 'par_1', 'power_in');
    toggleProtection('L1');
    check(gameState.edges.some(x => x.b === 'par_1') && !gameState.rcdTrips && isRunning('par_1'), 'seguendo il consiglio del capo qualcosa va storto');

    // ---- ciabatta che fa partire insieme due sub: stesso consiglio del picco
    fresh();
    P('quadro', 4, 2); P('ciabatta_cee', 6, 2); P('sub', 1, 8); P('sub', 7, 8);
    W('cee_tri', 'allaccio', 'out', 'quadro_1', 'in');
    W(null, 'ciabatta_cee_1', 'in', 'quadro_1', 'out_1');
    W('schuko_powercon', 'ciabatta_cee_1', 'out_1', 'sub_1', 'power');
    W('schuko_powercon', 'ciabatta_cee_1', 'out_2', 'sub_2', 'power');
    ['main', 'rcd', 'L1'].forEach(k => toggleProtection(k));
    ['sub_1', 'sub_2'].forEach(id => toggleDevicePower(id));    // senza corrente: non partono
    check(!Object.keys(Profile.data.tutorSeen).length, 'sub accesi senza corrente: il capo non doveva parlare');
    toggleDevicePower('ciabatta_cee_1');
    check(!gameState.placed.ciabatta_cee_1.on && said('inrush') && !gameState.trips, 'ciabatta con due sub: consiglio sbagliato o mancante');
    toggleDevicePower('ciabatta_cee_1');
    check(gameState.trips > 0, 'ciabatta rifatta: il magnetotermico non scatta (il capo avrebbe detto il falso)');

    // ---- consigli spenti: il capo non interviene mai
    fresh(); settings().bossTips = false; impianto();
    toggleDevicePower('ampli_1');
    check(gameState.placed.ampli_1.on && !Object.keys(Profile.data.tutorSeen).length, 'il capo parla anche coi consigli spenti');
    settings().bossTips = true;
    return out;
  });
  console.log('PROBLEMI:', JSON.stringify(res, null, 1)); console.log('ERRORI JS:', errs);
  await b.close();
  const ok = !res.length && !errs.length;
  console.log(ok ? 'CAPO OK' : 'CAPO FALLITO');
  process.exit(ok ? 0 : 1);
})();
