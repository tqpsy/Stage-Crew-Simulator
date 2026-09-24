/* Partita completa su telefono, solo con tocchi veri (come un giocatore):
   posa dai pulsanti, cavi dai bauli, prese dai pannelli, quadro, accensioni
   e Test impianto, col percorso più corto. Conta i tocchi e segnala ogni
   tocco che non apre il dispositivo giusto o che cade su qualcosa che
   copre la scena.

   Uso:  node tests/partita-telefono.js [larghezza] [altezza]   (default 390 844)
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
const OUT = process.env.SHOTS || null;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +(process.argv[2] || 390), height: +(process.argv[3] || 844) }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  await p.waitForTimeout(300);
  let taps = 0, menus = 0; const log = []; const problems = [];
  // menù iniziale: nome del service e via
  await p.locator('#service-input').fill('Service Telefono');
  taps++; await p.locator('#new-start').tap(); await p.waitForTimeout(150);
  const toast = () => p.evaluate(() => el('#toast').textContent);
  const shot = n => OUT ? p.screenshot({ path: path.join(OUT, 'telefono-' + n + '.png') }) : null;
  // mondo -> pagina
  const w2p = (wx, wy) => p.evaluate(([wx, wy]) => { const s = window.__scene, cam = s.cameras.main, r = s.game.canvas.getBoundingClientRect();
    return { x: r.left + (wx - cam.worldView.x) * cam.zoom * r.width / GAME_W, y: r.top + (wy - cam.worldView.y) * cam.zoom * r.height / GAME_H }; }, [wx, wy]);
  const tapAt = async pt => { taps++; await p.touchscreen.tap(pt.x, pt.y); await p.waitForTimeout(120); };
  const tapSel = async sel => { taps++; await p.locator(sel).first().tap(); await p.waitForTimeout(120); };
  const tab = async t => { if (!(await p.evaluate(t => document.querySelector('.tab-btn[data-tab="' + t + '"]').classList.contains('active'), t))) await tapSel('.tab-btn[data-tab="' + t + '"]'); };
  const cell = async (gx, gy) => { const w = await p.evaluate(([a, b]) => gridToScreen(a + .5, b + .5), [gx, gy]); return w2p(w.x, w.y); };
  const place = async (tabName, type, cells) => {
    await tab(tabName); await tapSel('.piece[data-type="' + type + '"]');
    for (const c of cells) {
      const before = await p.evaluate(t => gameState.stock[t], type);
      await tapAt(await cell(...c));
      const after = await p.evaluate(t => gameState.stock[t], type);
      if (after !== before - 1) problems.push('posa ' + type + ' in ' + c + ' fallita: ' + await toast());
    }
  };
  const devPt = async id => { const c = await p.evaluate(id => { const v = window.__scene.compVisuals[id].container; return { x: v.x, y: v.y }; }, id); return w2p(c.x, c.y); };
  const openDev = async id => {
    const pre = await p.evaluate(() => ({ input: window.__scene.input.enabled, modal: el('#rear-modal').classList.contains('show'), casem: el('#case-modal').classList.contains('show'), cam: [window.__scene.cameras.main.zoom, Math.round(window.__scene.cameras.main.scrollX), Math.round(window.__scene.cameras.main.scrollY)] }));
    const dp = await devPt(id);
    const hit = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.id || e.className || e.tagName) : null; }, [dp.x, dp.y]);
    if (hit !== 'CANVAS') problems.push('sopra ' + id + ' c\'è ' + hit);
    await tapAt(dp);
    await p.waitForTimeout(80);
    const menu = await p.evaluate(() => { const m = document.getElementById('pick-menu'); return m && m.classList.contains('show') ? [...m.querySelectorAll('.pick-opt')].map(b => b.dataset.id) : null; });
    if (menu) { menus++; if (!menu.includes(id)) problems.push('menu Quale? senza ' + id + ': ' + menu); await tapSel('#pick-menu .pick-opt[data-id="' + (menu.includes(id) ? id : menu[0]) + '"]'); }
    const opened = await p.evaluate(() => el('#rear-modal').classList.contains('show') && rearPanelId);
    if (opened !== id) { problems.push('tocco su ' + id + ' ha aperto ' + opened + ' pre=' + JSON.stringify(pre) + ' pt=' + JSON.stringify(dp) + ' el=' + hit + ' dopo=' + JSON.stringify(await p.evaluate(() => ({ input: window.__scene.input.enabled, asm: window.__scene.assemblyId, toast: el('#toast').textContent, pend: gameState.pendingPort })))); if (opened) await p.evaluate(() => closeRearPanel()); await p.evaluate(id => openRearPanel(id), id); }
  };
  const port = async (id, pid) => { await openDev(id); await tapSel('#rear-svg .rp-port[data-port="' + pid + '"]'); };
  const take = async cable => {
    if (await p.evaluate(c => gameState.selectedCable === c, cable)) return;
    await tab('cavi');
    const cs = await p.evaluate(c => Object.keys(CABLE_CASES).find(k => CABLE_CASES[k].items.some(i => i.cable === c)), cable);
    await tapSel('.case-btn[data-case="' + cs + '"]'); await tapSel('#case-svg .cc-coil[data-cable="' + cable + '"]');
  };
  const wire = async (cable, a, ap, bb, bp) => {
    const n = await p.evaluate(() => gameState.edges.length);
    if (cable) await take(cable);
    await port(a, ap); await port(bb, bp);
    const n2 = await p.evaluate(() => gameState.edges.length);
    if (await p.evaluate(() => el('#rear-modal').classList.contains('show'))) { problems.push('pannello rimasto aperto dopo ' + a + '->' + bb); await p.evaluate(() => closeRearPanel()); }
    if (n2 !== n + 1) { problems.push('cavo ' + cable + ' ' + a + '.' + ap + ' -> ' + bb + '.' + bp + ' NON collegato: ' + await toast()); await shot('fail-' + a + '-' + bb); }
  };
  // ---------- posa
  await place('corrente', 'quadro', [[4, 2]]);
  await place('audio', 'sub', [[1, 8], [7, 8]]);
  await place('audio', 'top', []); // la testa si tocca sopra il sub
  for (const sid of ['sub_1', 'sub_2']) { const before = await p.evaluate(() => gameState.stock.top); await tapAt(await devPt(sid)); if (await p.evaluate(() => gameState.stock.top) !== before - 1) problems.push('testa su ' + sid + ' non montata: ' + await toast()); }
  await place('audio', 'mixer', [[7, 5]]);
  await place('regia', 'ampli', [[6, 4]]);
  await place('regia', 'pc', [[4, 13]]);
  await place('regia', 'scheda', [[5, 13]]);
  // stativi: frontali nel Pit (uno per lato), tagli ai lati del palco;
  // poi il PAR si tocca sopra ogni stativo
  await place('luci', 'stativo', [[2, 9], [6, 9], [1, 5], [6, 6]]);
  await place('luci', 'par', []);
  for (const sid of ['stativo_1', 'stativo_2', 'stativo_3', 'stativo_4']) { const before = await p.evaluate(() => gameState.stock.par); await tapAt(await devPt(sid)); if (await p.evaluate(() => gameState.stock.par) !== before - 1) problems.push('PAR su ' + sid + ' non montato: ' + await toast()); }
  await place('luci', 'controller', [[7, 7]]);
  log.push('posa: ' + taps + ' tocchi, stock=' + JSON.stringify(await p.evaluate(() => Object.fromEntries(Object.entries(gameState.stock).filter(([k, v]) => v)))));
  await shot('posa');
  const t0 = taps;
  // ---------- cavi (minimo: niente ciabatte, PC dal Quadro con l'adattatore)
  await wire('cee_tri', 'allaccio', 'out', 'quadro_1', 'in');
  for (const [d, pp] of [['mixer_1', 'power'], ['controller_1', 'power'], ['ampli_1', 'power'], ['sub_1', 'power'], ['sub_2', 'power'], ['par_1', 'power_in']]) await wire('cee_powercon', 'quadro_1', 'out_1', d, pp);
  await wire('cee_schuko', 'quadro_1', 'out_1', 'pc_1', 'power');
  for (const [a, c] of [['par_1', 'par_2'], ['par_2', 'par_3'], ['par_3', 'par_4']]) await wire('powercon', a, 'power_thru', c, 'power_in');
  await wire('dmx', 'controller_1', 'dmx_1', 'par_1', 'dmx_in');
  for (const [a, c] of [['par_1', 'par_2'], ['par_2', 'par_3'], ['par_3', 'par_4']]) await wire('dmx', a, 'dmx_thru', c, 'dmx_in');
  await wire(null, 'scheda_1', 'usb', 'pc_1', 'usb');
  await wire('jack', 'scheda_1', 'out_L', 'mixer_1', 'in_5'); await wire('jack', 'scheda_1', 'out_R', 'mixer_1', 'in_6');
  await wire('xlr', 'mixer_1', 'main_L', 'ampli_1', 'in_L'); await wire('xlr', 'mixer_1', 'main_R', 'ampli_1', 'in_R');
  await wire('speakon', 'ampli_1', 'out_L', 'sub_1', 'spk_in'); await wire('speakon', 'ampli_1', 'out_R', 'sub_2', 'spk_in');
  await wire('speakon', 'sub_1', 'spk_thru', 'top_1', 'spk_in'); await wire('speakon', 'sub_2', 'spk_thru', 'top_2', 'spk_in');
  log.push('cavi: ' + (taps - t0) + ' tocchi, contatore ' + await p.evaluate(() => el('#conn-val').textContent) + ', cavi=' + await p.evaluate(() => gameState.edges.length));
  await shot('cavi');
  // ---------- accensione
  const t1 = taps;
  await openDev('quadro_1');
  for (const k of ['main', 'rcd', 'L1']) await tapSel('#rear-svg .rp-brk[data-brk="' + k + '"]');
  await tapSel('#rear-close');
  for (const id of ['mixer_1', 'controller_1', 'pc_1', 'ampli_1', 'sub_1', 'sub_2']) {
    await openDev(id); await tapSel('#rear-svg .rp-switch'); await tapSel('#rear-close'); await p.waitForTimeout(750);
  }
  log.push('accensione: ' + (taps - t1) + ' tocchi; scatti=' + await p.evaluate(() => (gameState.trips || 0) + '/' + (gameState.rcdTrips || 0)) + ' pops=' + await p.evaluate(() => (gameState.procErrors || []).length));
  await tapSel('#run-btn');
  log.push('TEST: ' + await toast() + ' | ' + await p.evaluate(() => el('#circuit-text').textContent));
  // il collaudo riuscito entra nei record, per i futuri highscore
  const recs = await p.evaluate(() => (Profile.data.records[LEVEL_ID] || []).map(r => r.service + ' test=' + r.tests));
  log.push('record: ' + recs.join(', '));
  if (recs.length !== 1 || !/Service Telefono test=1/.test(recs[0])) problems.push('record del collaudo mancante o sbagliato: ' + recs);
  // procedura perfetta al primo test: reputazione piena
  const rep = await p.evaluate(() => reputation());
  log.push('reputazione: ' + rep);
  if (rep !== 150 || !/Reputazione \+150/.test(await toast())) problems.push('reputazione del collaudo perfetto sbagliata: ' + rep);
  log.push('TOTALE tocchi: ' + taps + ' (menu Quale?: ' + menus + ')');
  await shot('fine');
  console.log(log.join('\n')); console.log('PROBLEMI:', JSON.stringify(problems, null, 1)); console.log('ERRORI JS:', errs);
  await b.close();
  const ok = !problems.length && !errs.length && /Procedura perfetta/.test(log.join(' '));
  console.log(ok ? 'PARTITA OK' : 'PARTITA FALLITA');
  process.exit(ok ? 0 : 1);
})();
