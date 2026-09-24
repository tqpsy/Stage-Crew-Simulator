/* Menù di gioco e salvataggio: nuova partita col nome del service,
   salvataggio automatico, ricarica della pagina e Continua, impostazioni
   che restano, Nuova partita che azzera il livello ma tiene impostazioni
   e record (i dati per i futuri highscore).

   Uso:  node tests/salvataggio.js
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 } });
  const p = await ctx.newPage();
  if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const problems = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  const open = async () => {
    await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
    await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  };
  const ev = (fn, arg) => p.evaluate(fn, arg);

  // ---- primo avvio: niente salvataggio, si chiede il nome
  await open();
  check(await p.isVisible('#service-input'), 'al primo avvio manca il campo del nome');
  check(!(await p.isVisible('#menu-resume')), 'al primo avvio c\'è Continua senza partita');
  await p.fill('#service-input', '');
  await p.type('#service-input', 'Service Wasd');      // W, A, S, D non devono sparire
  check(await p.inputValue('#service-input') === 'Service Wasd', 'nel nome non si scrivono tutte le lettere: ' + await p.inputValue('#service-input'));
  await p.click('#new-start');
  check(!(await p.isVisible('#menu-modal')), 'il menù resta aperto dopo Inizia');
  check(await p.textContent('#service-tag') === 'SERVICE WASD · REPUTAZIONE 0', 'nome del service o reputazione non in testata: ' + await p.textContent('#service-tag'));
  check(await ev(() => window.__scene.vanName.text) === 'SERVICE WASD', 'nome del service non sul furgone');

  // ---- un po' di impianto: pezzi, un cavo, Quadro armato, mixer acceso
  await ev(() => {
    const S = window.__scene;
    const P = (ty, gx, gy) => { const w = gridToScreen(gx + .5, gy + .5); S.placeComponentAt(ty, w.x, w.y); };
    P('quadro', 4, 2); P('mixer', 7, 5); P('par', 2, 5);
    const q = placedOfType('quadro')[0].id;
    selectCable('cee_tri'); openRearPanel('allaccio'); onRearPortClick('allaccio', 'out'); openRearPanel(q); onRearPortClick(q, 'in'); if (rearPanelId) closeRearPanel();
    selectCable('cee_powercon'); openRearPanel(q); onRearPortClick(q, 'out_1'); const m = placedOfType('mixer')[0].id; openRearPanel(m); onRearPortClick(m, 'power'); if (rearPanelId) closeRearPanel();
    ['main', 'rcd', 'L1'].forEach(k => toggleProtection(k));
    toggleDevicePower(m);
    S.runSystemTest();                    // fallisce: un test in più nelle statistiche
  });
  const before = await ev(() => ({ placed: Object.keys(gameState.placed).sort(), edges: gameState.edges.length, on: placedOfType('mixer')[0].on, prot: { ...findQuadro().prot, tripped: undefined }, tests: gameState.stats.tests, failed: gameState.stats.failedTests }));
  check(before.edges === 2 && before.on && before.tests === 1 && before.failed === 1, 'preparazione non riuscita: ' + JSON.stringify(before));

  // ---- impostazioni dal menù
  await p.click('#menu-btn');
  await p.click('#menu-settings');
  await p.fill('#set-volume', '30');
  await p.check('#set-reduced');
  await p.fill('#set-service', 'Service Prova');
  await p.press('#set-service', 'Tab');
  await p.click('#settings-back');
  await p.click('#menu-resume');
  check(/^SERVICE PROVA/.test(await p.textContent('#service-tag')), 'rinomina non applicata');
  // reputazione: un collaudo con un test fallito vale 140; rifatto uguale
  // non aggiunge nulla, fatto meglio aggiunge solo la differenza
  const gains = await ev(() => {
    const g = [addRecord(), addRecord()];
    gameState.stats.failedTests = 0; g.push(addRecord());
    gameState.stats.failedTests = 1;
    return { g, total: reputation(), level: Profile.data.reputation.byLevel[LEVEL_ID] };
  });
  check(JSON.stringify(gains) === JSON.stringify({ g: [140, 0, 10], total: 150, level: 150 }), 'reputazione sbagliata: ' + JSON.stringify(gains));
  check(await p.textContent('#service-tag') === 'SERVICE PROVA · REPUTAZIONE 150', 'reputazione non in testata');
  await p.waitForTimeout(1500);          // un po' di tempo di gioco e il salvataggio differito

  // ---- ricarica: Continua riporta tutto com'era
  await open();
  check(await p.isVisible('#menu-resume'), 'dopo la ricarica manca Continua');
  check(/Service Prova · ★ 150/.test(await p.textContent('#menu-resume')), 'Continua non dice nome e reputazione: ' + await p.textContent('#menu-resume'));
  await p.click('#menu-resume');
  const after = await ev(() => ({ placed: Object.keys(gameState.placed).sort(), edges: gameState.edges.length, on: placedOfType('mixer')[0].on, prot: { ...findQuadro().prot, tripped: undefined }, tests: gameState.stats.tests, failed: gameState.stats.failedTests, playMs: gameState.stats.playMs, vol: SFX.volume, reduced: reducedFx(), undo: el('#undo-btn').disabled, conn: el('#conn-val').textContent, van: window.__scene.vanName.text }));
  check(JSON.stringify(after.placed) === JSON.stringify(before.placed), 'pezzi diversi dopo la ricarica: ' + after.placed);
  check(after.edges === before.edges, 'cavi diversi dopo la ricarica');
  check(after.on === true, 'mixer spento dopo la ricarica');
  check(JSON.stringify(after.prot) === JSON.stringify(before.prot), 'protezioni del Quadro diverse dopo la ricarica');
  check(after.tests === 1 && after.failed === 1 && after.playMs >= 1000, 'statistiche perse: ' + JSON.stringify(after));
  check(after.vol === 0.3 && after.reduced, 'impostazioni perse');
  check(after.undo, 'dopo la ricarica si può annullare oltre il salvataggio');
  check(after.van === 'SERVICE PROVA', 'nome sul furgone perso');

  // ---- Nuova partita: livello da capo, impostazioni e record restano
  await p.click('#menu-btn');
  await p.click('#menu-new');
  check(await p.isVisible('#new-warning'), 'manca l\'avviso prima di ricominciare');
  await p.fill('#service-input', 'Service Nuovo');
  await p.click('#new-start');
  const fresh = await ev(() => ({ placed: Object.keys(gameState.placed), edges: gameState.edges.length, tests: gameState.stats.tests, vol: SFX.volume, recs: (Profile.data.records[LEVEL_ID] || []).length, rep: reputation() }));
  check(fresh.placed.length === 1 && fresh.edges === 0 && fresh.tests === 0, 'Nuova partita non azzera il livello: ' + JSON.stringify(fresh));
  check(fresh.vol === 0.3 && fresh.recs === 3, 'Nuova partita perde impostazioni o record: ' + JSON.stringify(fresh));
  check(fresh.rep === 0, 'il nuovo service non parte da reputazione 0');

  console.log('PROBLEMI:', JSON.stringify(problems, null, 1));
  console.log('ERRORI JS:', errs);
  await b.close();
  const ok = !problems.length && !errs.length;
  console.log(ok ? 'SALVATAGGIO OK' : 'SALVATAGGIO FALLITO');
  process.exit(ok ? 0 : 1);
})();
