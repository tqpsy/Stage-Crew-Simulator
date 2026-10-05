/* Partita completa su telefono, solo con tocchi veri (come un giocatore):
   i tre giri del montaggio (corrente, audio, luci) con la loro prova, posa
   dai pulsanti, cavi dai bauli, prese dai pannelli, quadro, accensioni e
   Test impianto, col percorso più corto. Conta i tocchi e segnala ogni
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
  let taps = 0, menus = 0, zoomResets = 0, lays = 0, quicks = 0, chained = 0; const log = []; const problems = [];
  // menù iniziale: nome del tecnico, un service tra i tre e via
  await p.locator('#player-input').fill('Tecnico Telefono');
  taps++; await p.locator('#service-offers .offer-card').first().tap();
  taps++; await p.locator('#new-start').tap(); await p.waitForTimeout(150);
  // la scaletta della serata, poi al lavoro
  taps++; await p.locator('#schedule-go').tap(); await p.waitForTimeout(150);
  // lo scarico (minigioco a parte, tests/scarico.js): qui si salta
  await p.waitForSelector('#scarico-frame');
  taps++; await p.frameLocator('#scarico-frame').locator('#btn-skip').tap();
  await p.waitForFunction(() => !document.querySelector('#scarico-frame'));
  const toast = () => p.evaluate(() => el('#toast').textContent);
  const shot = n => OUT ? p.screenshot({ path: path.join(OUT, 'telefono-' + n + '.png') }) : null;
  // mondo -> pagina
  // un tocco affollato avvicina la scena (zoomToCrowd): se il punto è finito
  // fuori dallo schermo si torna alla vista intera col pulsante, come farebbe
  // un giocatore
  const w2p0 = (wx, wy) => p.evaluate(([wx, wy]) => { const s = window.__scene, cam = s.cameras.main, r = s.game.canvas.getBoundingClientRect();
    const x = r.left + (wx - cam.worldView.x) * cam.zoom * r.width / GAME_W, y = r.top + (wy - cam.worldView.y) * cam.zoom * r.height / GAME_H;
    const e = document.elementFromPoint(x, y);   // fuori schermo, o sotto una barra sopra la scena
    return { x, y, out: x < r.left + 12 || x > r.right - 12 || y < r.top + 12 || y > r.bottom - 12 || (e && e.tagName !== 'CANVAS') }; }, [wx, wy]);
  const w2p = async (wx, wy) => {
    await p.waitForFunction(() => { const c = window.__scene.cameras.main; return !c.panEffect.isRunning && !c.zoomEffect.isRunning; });
    { const f = await p.evaluate(() => window.__scene.game.loop.frame); await p.waitForFunction(f => window.__scene.game.loop.frame > f + 1, f); }
    let pt = await w2p0(wx, wy);
    // con un pannello aperto il pulsante è coperto: il tocco va comunque al pannello
    if (pt.out && !(await p.evaluate(() => document.querySelector('.modal-overlay.show')))) {
      zoomResets++; taps++; await p.locator('#zoom-reset').tap();
      // worldView si aggiorna solo al disegno: si aspettano due fotogrammi
      const f = await p.evaluate(() => window.__scene.game.loop.frame);
      await p.waitForFunction(f => window.__scene.game.loop.frame > f + 1, f);
      pt = await w2p0(wx, wy);
    }
    return pt;
  };
  const tapAt = async pt => { taps++; await p.touchscreen.tap(pt.x, pt.y); await p.waitForTimeout(120); };
  const tapSel = async sel => { taps++; await p.locator(sel).first().tap(); await p.waitForTimeout(120); };
  // la scheda si tocca se non è quella attiva o se il suo cassetto è chiuso
  const tab = async t => { if (!(await p.evaluate(t => document.querySelector('.tab-btn[data-tab="' + t + '"]').classList.contains('active') && el('#toolbar').classList.contains('open'), t))) await tapSel('.tab-btn[data-tab="' + t + '"]'); };
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
  // quick: con un cavo in mano il tocco può collegare subito (una sola presa adatta)
  const openDev = async (id, quick) => {
    const n0 = await p.evaluate(() => gameState.edges.length);
    const pre = await p.evaluate(() => ({ input: window.__scene.input.enabled, modal: el('#rear-modal').classList.contains('show'), casem: el('#case-modal').classList.contains('show'), cam: [window.__scene.cameras.main.zoom, Math.round(window.__scene.cameras.main.scrollX), Math.round(window.__scene.cameras.main.scrollY)] }));
    const dp = await devPt(id);
    const hit = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.id || e.className || e.tagName) : null; }, [dp.x, dp.y]);
    if (hit !== 'CANVAS') problems.push('sopra ' + id + ' c\'è ' + hit);
    await tapAt(dp);
    await p.waitForTimeout(80);
    const menu = await p.evaluate(() => { const m = document.getElementById('pick-menu'); return m && m.classList.contains('show') ? [...m.querySelectorAll('.pick-opt')].map(b => b.dataset.id) : null; });
    if (menu) { menus++; if (!menu.includes(id)) problems.push('menu Quale? senza ' + id + ': ' + menu); await tapSel('#pick-menu .pick-opt[data-id="' + (menu.includes(id) ? id : menu[0]) + '"]'); }
    const opened = await p.evaluate(() => el('#rear-modal').classList.contains('show') && rearPanelId);
    if (quick && !opened && await p.evaluate(() => gameState.edges.length) === n0 + 1) return 'quick';
    if (opened !== id) { problems.push('tocco su ' + id + ' ha aperto ' + opened + ' pre=' + JSON.stringify(pre) + ' pt=' + JSON.stringify(dp) + ' el=' + hit + ' dopo=' + JSON.stringify(await p.evaluate(() => ({ input: window.__scene.input.enabled, asm: window.__scene.assemblyId, toast: el('#toast').textContent, pend: gameState.pendingPort })))); if (opened) await p.evaluate(() => closeRearPanel()); await p.evaluate(id => openRearPanel(id), id); }
  };
  const port = async (id, pid) => { await openDev(id); await tapSel('#rear-svg .rp-port[data-port="' + pid + '"]'); };
  const take = async cable => {
    if (await p.evaluate(c => gameState.selectedCable === c, cable)) return;
    await tab('cavi');
    const cs = await p.evaluate(c => Object.keys(CABLE_CASES).find(k => CABLE_CASES[k].items.some(i => i.cable === c)), cable);
    await tapSel('.case-btn[data-case="' + cs + '"]'); await tapSel('#case-svg .cc-coil[data-cable="' + cable + '"]');
  };
  const layShown = () => p.evaluate(() => el('#lay-bar').classList.contains('show'));
  const wire = async (cable, a, ap, bb, bp) => {
    const n = await p.evaluate(() => gameState.edges.length);
    if (cable) await take(cable);
    // catena: il cavo è già pronto nel THRU del dispositivo di prima
    const ready = await p.evaluate(([a, ap]) => { const q = gameState.pendingPort; return !!q && q.componentId === a && q.portId === ap; }, [a, ap]);
    if (ready) chained++;
    else {
      if (await layShown()) { lays++; await tapSel('#lay-done'); }
      await port(a, ap);
    }
    if (await openDev(bb, true) === 'quick') quicks++;
    else await tapSel('#rear-svg .rp-port[data-port="' + bp + '"]');
    const n2 = await p.evaluate(() => gameState.edges.length);
    const last = await p.evaluate(() => { const e = gameState.edges[gameState.edges.length - 1]; return e && [e.a, e.aPort, e.b, e.bPort].join('.'); });
    if (n2 === n + 1 && !last.includes(bb + '.' + bp)) problems.push('collegato alla presa sbagliata: ' + last + ' invece di ' + bb + '.' + bp);
    // il cavo collegato resta in mano da stendere: qui va bene com'è (con
    // la catena pronta si tocca direttamente il prossimo)
    if (await layShown() && !(await p.evaluate(() => gameState.pendingPort && gameState.pendingPort.auto))) { lays++; await tapSel('#lay-done'); }
    if (await p.evaluate(() => el('#rear-modal').classList.contains('show'))) { problems.push('pannello rimasto aperto dopo ' + a + '->' + bb); await p.evaluate(() => closeRearPanel()); }
    if (n2 !== n + 1) { problems.push('cavo ' + cable + ' ' + a + '.' + ap + ' -> ' + bb + '.' + bp + ' NON collegato: ' + await toast()); await shot('fail-' + a + '-' + bb); }
  };
  // prova del giro in corso (il pulsante in basso) e controllo del giro dopo
  const prova = async (giro) => {
    await tapSel('#run-btn');
    const now = await p.evaluate(() => gameState.giro);
    log.push('prova giro ' + giro + ': ' + await toast());
    if (now !== giro + 1) { problems.push('prova del giro ' + giro + ' non superata: ' + await toast()); await p.evaluate(g => { gameState.giro = g; updateGiroUI(); }, giro + 1); }
  };
  const brk = async keys => { await openDev('quadro_1'); for (const k of keys) await tapSel('#rear-svg .rp-brk[data-brk="' + k + '"]'); await tapSel('#rear-close'); };
  const switchOn = async ids => { for (const id of ids) { await openDev(id); await tapSel('#rear-svg .rp-switch'); await tapSel('#rear-close'); await p.waitForTimeout(750); } };
  // all'inizio si possono aprire solo Corrente e Cavi
  if (!(await p.evaluate(() => document.querySelector('.tab-btn[data-tab="audio"]').classList.contains('locked')))) problems.push('scheda Audio aperta prima del giro audio');
  // ---------- giro 1: corrente
  await place('corrente', 'quadro', [[4, 2]]);
  await wire('cee_tri', 'allaccio', 'out', 'quadro_1', 'in');
  await brk(['main', 'rcd']);
  await prova(0);
  // ---------- giro 2: audio (posa, cavi a fase L1 spenta, poi accensione)
  const t0 = taps;
  await place('audio', 'sub', [[1, 8], [7, 8]]);
  await place('audio', 'top', []); // la testa si tocca sopra il sub
  for (const sid of ['sub_1', 'sub_2']) { const before = await p.evaluate(() => gameState.stock.top); await tapAt(await devPt(sid)); if (await p.evaluate(() => gameState.stock.top) !== before - 1) problems.push('testa su ' + sid + ' non montata: ' + await toast()); }
  // tavolo regia in Off Stage; mixer, finale (nel rack sotto), PC e scheda
  // si posano toccando il tavolo
  await place('strutture', 'tavolo', [[7, 5]]);
  const onTable = async (tabName, type) => {
    await tab(tabName); await tapSel('.piece[data-type="' + type + '"]');
    const before = await p.evaluate(t => gameState.stock[t], type);
    await tapAt(await devPt('tavolo_1'));
    if (await p.evaluate(t => gameState.stock[t], type) !== before - 1) problems.push(type + ' sul tavolo non posato: ' + await toast());
  };
  await onTable('audio', 'mixer');
  // asta microfonica sul palco, poi il microfono si tocca sopra l'asta
  await place('audio', 'asta', [[3, 6]]);
  await place('audio', 'mic', []);
  { const before = await p.evaluate(() => gameState.stock.mic); await tapAt(await devPt('asta_1')); if (await p.evaluate(() => gameState.stock.mic) !== before - 1) problems.push('microfono su asta_1 non montato: ' + await toast()); }
  await onTable('regia', 'ampli');
  await onTable('regia', 'pc');
  await onTable('regia', 'scheda');
  for (const [d, pp] of [['mixer_1', 'power'], ['ampli_1', 'power'], ['sub_1', 'power'], ['sub_2', 'power']]) await wire('cee_powercon', 'quadro_1', 'out_1', d, pp);
  await wire('cee_schuko', 'quadro_1', 'out_1', 'pc_1', 'power');
  await wire(null, 'scheda_1', 'usb', 'pc_1', 'usb');
  await wire('jack', 'scheda_1', 'out_L', 'mixer_1', 'in_5'); await wire('jack', 'scheda_1', 'out_R', 'mixer_1', 'in_6');
  await wire('xlr', 'mixer_1', 'main_L', 'ampli_1', 'in_L'); await wire('xlr', 'mixer_1', 'main_R', 'ampli_1', 'in_R');
  await wire('speakon', 'ampli_1', 'out_L', 'sub_1', 'spk_in'); await wire('speakon', 'ampli_1', 'out_R', 'sub_2', 'spk_in');
  await wire('speakon', 'sub_1', 'spk_thru', 'top_1', 'spk_in'); await wire('speakon', 'sub_2', 'spk_thru', 'top_2', 'spk_in');
  await wire('xlr', 'mic_1', 'out', 'mixer_1', 'in_1');
  if (await p.evaluate(() => micChannel()) !== 1) problems.push('microfono non risulta sul CH 1');
  await brk(['L1']);
  await switchOn(['mixer_1', 'pc_1', 'ampli_1', 'sub_1', 'sub_2']);
  await prova(1);
  log.push('giro audio: ' + (taps - t0) + ' tocchi');
  await shot('audio');
  // ---------- giro 3: luci, su una fase libera (L2) armata alla fine
  const t1 = taps;
  // stativi: frontali nel Pit (uno per lato), tagli ai lati del palco;
  // poi il PAR si tocca sopra ogni stativo
  await place('strutture', 'stativo', [[2, 9], [6, 9], [1, 5], [6, 6]]);
  await place('luci', 'par', []);
  for (const sid of ['stativo_1', 'stativo_2', 'stativo_3', 'stativo_4']) { const before = await p.evaluate(() => gameState.stock.par); await tapAt(await devPt(sid)); if (await p.evaluate(() => gameState.stock.par) !== before - 1) problems.push('PAR su ' + sid + ' non montato: ' + await toast()); }
  await onTable('luci', 'controller');
  for (const [d, pp] of [['controller_1', 'power'], ['par_1', 'power_in']]) await wire('cee_powercon', 'quadro_1', 'out_2', d, pp);
  for (const [a, c] of [['par_1', 'par_2'], ['par_2', 'par_3'], ['par_3', 'par_4']]) await wire('powercon', a, 'power_thru', c, 'power_in');
  await wire('dmx', 'controller_1', 'dmx_1', 'par_1', 'dmx_in');
  for (const [a, c] of [['par_1', 'par_2'], ['par_2', 'par_3'], ['par_3', 'par_4']]) await wire('dmx', a, 'dmx_thru', c, 'dmx_in');
  await brk(['L2']);
  await switchOn(['controller_1']);
  await prova(2);
  log.push('giro luci: ' + (taps - t1) + ' tocchi; contatore ' + await p.evaluate(() => el('#conn-val').textContent) + ', cavi=' + await p.evaluate(() => gameState.edges.length));
  log.push('scatti=' + await p.evaluate(() => (gameState.trips || 0) + '/' + (gameState.rcdTrips || 0)) + ' pops=' + await p.evaluate(() => (gameState.procErrors || []).length));
  await shot('cavi');
  // regia e backstage fitti: ogni cavo si deve poter prendere col dito, al
  // primo tocco o dal menu "Quale?" (anche quelli che passano accanto ai
  // dispositivi)
  const edgeIds = await p.evaluate(() => gameState.edges.map(e => e.id));
  let viaMenu = 0, zooms = 0;
  for (const id of edgeIds) {
    await p.evaluate(() => { window.__scene.clearEdgeSelection(); window.__scene.resetView(); });
    // il punto del cavo più "libero" (dove un giocatore lo toccherebbe)
    const pt = await p.evaluate(id => { const s = window.__scene, e = gameState.edges.find(x => x.id === id);
      let best = null;
      for (let i = 0; e._pts && i < e._pts.length - 1; i++) for (let t = 0.1; t < 1; t += 0.1) {
        const x = e._pts[i].x + (e._pts[i + 1].x - e._pts[i].x) * t, y = e._pts[i].y + (e._pts[i + 1].y - e._pts[i].y) * t;
        const cam = s.cameras.main, r = s.game.canvas.getBoundingClientRect();
        const px = r.left + (x - cam.worldView.x) * cam.zoom * r.width / GAME_W, py = r.top + (y - cam.worldView.y) * cam.zoom * r.height / GAME_H;
        const hit = document.elementFromPoint(px, py);
        const near = s.edgesNear(x, y, TOUCH_SLOP_PX);
        if (!(hit && hit.tagName === 'CANVAS' && near.some(c => c.edge.id === id && c.px < 3))) continue;
        const n = near.length + s.devicesNear(x, y, TOUCH_SLOP_PX).length;
        if (!best || n < best.n) best = { n, wx: x, wy: y };
      }
      return best; }, id);
    if (!pt) { problems.push('cavo ' + id + ': nessun punto toccabile'); continue; }
    await tapAt(await w2p(pt.wx, pt.wy));
    if (await p.evaluate(() => el('#pick-menu').classList.contains('show'))) {
      viaMenu++;
      // troppi cavi lì: si ingrandisce e si ritocca lo stesso punto
      if (!(await p.locator('#pick-menu .pick-opt[data-edge="' + id + '"]').count())) {
        zooms++; await tapSel('#pick-menu .pick-zoom'); await p.waitForTimeout(120);
        await tapAt(await w2p(pt.wx, pt.wy));
      }
      const opt = p.locator('#pick-menu.show .pick-opt[data-edge="' + id + '"]');
      if (await opt.count()) await opt.tap();
      else if (await p.evaluate(() => el('#pick-menu').classList.contains('show'))) { problems.push('cavo ' + id + ' non nel menu Quale? nemmeno ingrandendo'); await p.evaluate(() => el('#pick-menu').click()); }
      await p.waitForTimeout(120);
    }
    // un cavo per terra si prende in mano (posa), quelli sul tavolo si selezionano
    const took = await p.evaluate(() => { const s = window.__scene, got = s.lay ? s.lay.id : s.selectedEdgeId; s.endLay(true); return got; });
    if (took !== id) {
      problems.push('cavo ' + id + ' non selezionabile col dito');
      await p.evaluate(() => { closeRearPanel(); });
    }
  }
  await p.evaluate(() => { window.__scene.clearEdgeSelection(); window.__scene.resetView(); });
  log.push('cavi presi col dito: ' + edgeIds.length + ' (dal Quale?: ' + viaMenu + ', ingrandendo: ' + zooms + ')');
  await tapSel('#run-btn');
  log.push('TEST: ' + await toast() + ' | ' + await p.evaluate(() => el('#circuit-text').textContent));
  // il collaudo riuscito entra nei record, per i futuri highscore
  const recs = await p.evaluate(() => (Profile.data.records[LEVEL_ID] || []).map(r => r.player + ' test=' + r.tests));
  log.push('record: ' + recs.join(', '));
  if (recs.length !== 1 || !/Tecnico Telefono test=4/.test(recs[0])) problems.push('record del collaudo mancante o sbagliato: ' + recs);
  // collaudo riuscito = fase completata: +5 reputazione
  const rep = await p.evaluate(() => reputation());
  log.push('reputazione: ' + rep);
  if (rep !== 5 || !/Reputazione \+5\./.test(await toast())) problems.push('reputazione del collaudo sbagliata: ' + rep);
  log.push('TOTALE tocchi: ' + taps + ' (menu Quale?: ' + menus + ', ritorni alla vista intera: ' + zoomResets + ', cavi stesi con Fatto: ' + lays + ', collegati al volo: ' + quicks + ', in catena: ' + chained + ')');
  await shot('fine');
  console.log(log.join('\n')); console.log('PROBLEMI:', JSON.stringify(problems, null, 1)); console.log('ERRORI JS:', errs);
  await b.close();
  const ok = !problems.length && !errs.length && /Procedura perfetta/.test(log.join(' '));
  console.log(ok ? 'PARTITA OK' : 'PARTITA FALLITA');
  process.exit(ok ? 0 : 1);
})();
