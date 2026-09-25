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
  // il logo segue il nome mentre lo si scrive: "Luci Verdi" → faro verde
  await p.type('#service-input', 'Luci Verdi');
  const auto = await ev(() => ({ icon: draft.logo.icon, bg: draft.logo.bg, same: JSON.stringify(draft.logo) === JSON.stringify(logoFromName('Luci Verdi')) }));
  check(auto.icon === 'faro' && auto.bg === '#49b06a' && auto.same, 'il logo non segue il nome: ' + JSON.stringify(auto));
  check(await ev(() => logoFromName('Service Rossi').bg) === '#e0503f', '"Rossi" non dà il rosso');
  check(await ev(() => logoFromName('Neon Night').style) === 'neon', '"Neon" non dà la scritta al neon');
  check(await ev(() => logoFromName('Power').icon) === 'fulmine', '"Power" non dà il fulmine');
  await p.fill('#service-input', '');
  await p.type('#service-input', 'Service Wasd');      // W, A, S, D non devono sparire
  check(await p.inputValue('#service-input') === 'Service Wasd', 'nel nome non si scrivono tutte le lettere: ' + await p.inputValue('#service-input'));
  // marchio: uno pronto, poi personalizzato (iniziali, fondo blu, scritta neon)
  await p.click('#new-logo-btn');
  await p.click('#logo-presets [data-preset="1"]');
  await p.click('#logo-icons [data-icon="iniziali"]');
  await p.click('#logo-bg [data-color="#3b7bff"]');
  await p.click('#logo-styles [data-style="neon"]');
  check(await ev(() => draft.auto) === false, 'dopo un ritocco a mano il logo segue ancora il nome');
  check(await ev(() => />W</.test(logoSVG(draft.logo, draft.name, 96))), 'le iniziali del logo non seguono il nome (senza la parola Service)');
  check(await p.$$eval('#logo-styles canvas', cs => cs.length) === 6, 'mancano le anteprime dei 6 stili della scritta');
  check(await p.$eval('#logo-styles [data-style="neon"]', b => b.classList.contains('sel')), 'stile scelto non evidenziato');
  await p.click('#logo-done');
  check(await p.inputValue('#service-input') === 'Service Wasd', 'tornando dal logo il nome si è perso');
  check(await p.$eval('#new-logo canvas', c => c.width > 0), 'anteprima del marchio assente');
  await p.click('#new-start');
  check(!(await p.isVisible('#menu-modal')), 'il menù resta aperto dopo Inizia');
  const logo1 = await ev(() => Profile.data.logo);
  check(JSON.stringify(logo1) === JSON.stringify({ shape: 'scudo', icon: 'iniziali', bg: '#3b7bff', fg: '#eee9df', style: 'neon' }), 'logo scelto non salvato: ' + JSON.stringify(logo1));
  check(/#3b7bff/.test(await p.innerHTML('#service-logo')), 'logo non in testata');
  check(await p.textContent('#service-tag') === 'SERVICE WASD · REPUTAZIONE 0', 'nome del service o reputazione non in testata: ' + await p.textContent('#service-tag'));
  await p.waitForFunction(() => window.__scene.livery && window.__scene.livery.name === 'SERVICE WASD');
  check(await ev(() => window.__scene.livery.logo.bg) === '#3b7bff', 'logo non sul furgone');
  await p.waitForFunction(() => window.__scene.brandKey && window.__scene.textures.exists(window.__scene.brandKey));

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
  // il microfono ha il corpo tondo come il PAR, ma nel suo pannello c'è
  // solo l'uscita XLR: niente display DMX e niente avviso sulla corrente
  const micPanel = await ev(() => {
    const S = window.__scene, w = gridToScreen(4.5, 6.5);
    S.placeComponentAt('asta', w.x, w.y);
    const a = placedOfType('asta')[0];
    const w2 = gridToScreen(a.gx + .5, a.gy + .5); S.placeComponentAt('mic', w2.x, w2.y);
    const m = placedOfType('mic')[0];
    openRearPanel(m.id);
    const html = el('#rear-svg').innerHTML;
    closeRearPanel();
    // si toglie di nuovo, per non cambiare il resto del test
    S.deleteComponent(m.id); S.deleteComponent(placedOfType('asta')[0].id);
    return { dmx: /rp-btn|Indirizzo|DMX/.test(html), power: /corrente/.test(html), xlr: /XLR OUT/.test(html) };
  });
  check(!micPanel.dmx && !micPanel.power && micPanel.xlr, 'pannello del microfono sbagliato: ' + JSON.stringify(micPanel));
  const before = await ev(() => ({ placed: Object.keys(gameState.placed).sort(), edges: gameState.edges.length, on: placedOfType('mixer')[0].on, prot: { ...findQuadro().prot, tripped: undefined }, tests: gameState.stats.tests, failed: gameState.stats.failedTests }));
  check(before.edges === 2 && before.on && before.tests === 1 && before.failed === 1, 'preparazione non riuscita: ' + JSON.stringify(before));

  // ---- impostazioni dal menù
  await p.click('#menu-btn');
  await p.click('#menu-settings');
  await p.fill('#set-volume', '30');
  await p.check('#set-reduced');
  await p.fill('#set-service', 'Service Prova');
  await p.press('#set-service', 'Tab');
  // il logo cambiato dalle impostazioni si vede subito
  await p.click('#set-logo-btn');
  await p.click('#logo-shapes [data-shape="esagono"]');
  check(/polygon points="50,3 91,26/.test(await p.innerHTML('#service-logo')), 'logo in testata non aggiornato subito');
  await p.click('#logo-done');
  await p.click('#settings-back');
  await p.click('#menu-resume');
  check(/^SERVICE PROVA/.test(await p.textContent('#service-tag')), 'rinomina non applicata');
  // reputazione: il collaudo è una fase completata (+5) e conta una volta
  // sola; un guasto gestito male la fa scendere, ma mai sotto lo 0;
  // un apparecchio rotto non conta (non è colpa del giocatore)
  const gains = await ev(() => {
    const g = [addRecord(), addRecord()];
    g.push(addReputation(REP.faultFixedFast, 'guasto risolto in fretta'));
    g.push(addReputation(REP.deviceBroken, 'finale rotto'));
    g.push(addReputation(REP.faultByJanitor, 'guasto trovato dal bidello'));
    return { g, total: reputation(), log: Profile.data.reputation.log.length };
  });
  check(JSON.stringify(gains) === JSON.stringify({ g: [5, 0, 3, 0, -5], total: 3, log: 4 }), 'reputazione sbagliata: ' + JSON.stringify(gains));
  const floor = await ev(() => { const d = addReputation(REP.feedback, 'larsen'); return { d, total: reputation() }; });
  check(floor.d === -3 && floor.total === 0, 'la reputazione va sotto lo 0: ' + JSON.stringify(floor));
  await ev(() => addReputation(REP.beerRefused, 'birra rifiutata'));
  check(await ev(() => REP.slowChange) === -5, 'manca la regola del cambio palco lento');
  check(await p.textContent('#service-tag') === 'SERVICE PROVA · REPUTAZIONE 5', 'reputazione non in testata: ' + await p.textContent('#service-tag'));
  await p.waitForTimeout(1500);          // un po' di tempo di gioco e il salvataggio differito

  // ---- ricarica: Continua riporta tutto com'era
  await open();
  check(await p.isVisible('#menu-resume'), 'dopo la ricarica manca Continua');
  check(/Service Prova · ★ 5/.test(await p.textContent('#menu-resume')), 'Continua non dice nome e reputazione: ' + await p.textContent('#menu-resume'));
  await p.click('#menu-resume');
  const after = await ev(() => ({ placed: Object.keys(gameState.placed).sort(), edges: gameState.edges.length, on: placedOfType('mixer')[0].on, prot: { ...findQuadro().prot, tripped: undefined }, tests: gameState.stats.tests, failed: gameState.stats.failedTests, playMs: gameState.stats.playMs, vol: SFX.volume, reduced: reducedFx(), undo: el('#undo-btn').disabled, conn: el('#conn-val').textContent, logo: Profile.data.logo }));
  await p.waitForFunction(() => window.__scene.livery && window.__scene.livery.name === 'SERVICE PROVA');
  check(JSON.stringify(after.placed) === JSON.stringify(before.placed), 'pezzi diversi dopo la ricarica: ' + after.placed);
  check(after.edges === before.edges, 'cavi diversi dopo la ricarica');
  check(after.on === true, 'mixer spento dopo la ricarica');
  check(JSON.stringify(after.prot) === JSON.stringify(before.prot), 'protezioni del Quadro diverse dopo la ricarica');
  check(after.tests === 1 && after.failed === 1 && after.playMs >= 1000, 'statistiche perse: ' + JSON.stringify(after));
  check(after.vol === 0.3 && after.reduced, 'impostazioni perse');
  check(after.undo, 'dopo la ricarica si può annullare oltre il salvataggio');
  check(after.logo.shape === 'esagono' && after.logo.bg === '#3b7bff', 'logo perso dopo la ricarica: ' + JSON.stringify(after.logo));

  // ---- Nuova partita: livello da capo, impostazioni e record restano
  await p.click('#menu-btn');
  await p.click('#menu-new');
  check(await p.isVisible('#new-warning'), 'manca l\'avviso prima di ricominciare');
  await p.fill('#service-input', 'Service Nuovo');
  await p.click('#new-start');
  const fresh = await ev(() => ({ placed: Object.keys(gameState.placed), edges: gameState.edges.length, tests: gameState.stats.tests, vol: SFX.volume, recs: (Profile.data.records[LEVEL_ID] || []).length, rep: reputation() }));
  check(fresh.placed.length === 1 && fresh.edges === 0 && fresh.tests === 0, 'Nuova partita non azzera il livello: ' + JSON.stringify(fresh));
  check(fresh.vol === 0.3 && fresh.recs === 2, 'Nuova partita perde impostazioni o record: ' + JSON.stringify(fresh));
  check(fresh.rep === 0, 'il nuovo service non parte da reputazione 0');

  // ---- salvataggio della versione 1 (reputazione 100-150 per livello): si converte
  // (prima si lascia finire il salvataggio in corso e si spegne quello
  // all'uscita dalla pagina, che altrimenti riscriverebbe il profilo attuale)
  await p.waitForTimeout(400);
  await ev(() => { Profile.flush = () => {}; localStorage.setItem('scs-save', JSON.stringify({ v: 1, service: 'Vecchio', settings: { volume: 0.5 }, level: null, records: {}, reputation: { total: 150, byLevel: { 1: 150 } } })); });
  await open();
  const conv = await ev(() => ({ v: Profile.data.v, rep: reputation(), once: Profile.data.reputation.earned['L1:collaudo'], vol: SFX.volume, again: (gameActive = true, addRecord()) }));
  check(JSON.stringify(conv) === JSON.stringify({ v: 2, rep: 5, once: 5, vol: 0.5, again: 0 }), 'conversione dalla versione 1 sbagliata: ' + JSON.stringify(conv));

  console.log('PROBLEMI:', JSON.stringify(problems, null, 1));
  console.log('ERRORI JS:', errs);
  await b.close();
  const ok = !problems.length && !errs.length;
  console.log(ok ? 'SALVATAGGIO OK' : 'SALVATAGGIO FALLITO');
  process.exit(ok ? 0 : 1);
})();
