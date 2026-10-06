/* Lo spettacolo del DJ dentro il gioco: montaggio collaudato, posa e
   discorso finiti, cambio palco promosso (con lo stativo luci del DJ). Il DJ set (dj.html) si apre da solo
   in un iframe dopo il cambio, con le birre in tasca, il nome del capo e i
   PAR montati. L'esito torna al gioco: reputazione una volta sola, birre
   bevute, pagate al capo e guadagnate, scaletta e foglio aggiornati (poi
   fine festa e carico: tests/fine-festa.js), niente secondo set. Saltarlo non dà reputazione.

   Uso:  node tests/dj-gioco.js
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 } });
  const p = await ctx.newPage();
  if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  await p.route(/posa-cavi\.html/, r => r.fulfill({ body: '<!doctype html><title>posa</title>', contentType: 'text/html' }));
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const problems = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const open = async () => {
    await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
    await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  };

  // una partita nuova con l'impianto del livello 1 montato, collaudato e
  // coi cavi stesi (la posa si chiude da qui: ha i suoi test)
  const nuovaSerata = async () => {
    await ev(() => { startNewGame('Cambio', serviceOffers([])[0]); });
    await p.waitForFunction(() => !menuOpen);
    await ev(() => { closeSchedule(); finishScarico({ skipped: true }); settings().bossTips = false; settings().skipShow = true; });
    const r = await ev(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const S = window.__scene;
      const P = (ty, gx, gy) => { const w = gridToScreen(gx + .5, gy + .5); S.placeComponentAt(ty, w.x, w.y); };
      P('sub', 1, 8); P('sub', 7, 8); P('top', 1, 8); P('top', 7, 8);
      P('tavolo', 7, 5);
      const onTable = ty => { const v = S.compVisuals[placedOfType('tavolo')[0].id].container; S.placeComponentAt(ty, v.x, v.y); };
      ['mixer', 'ampli', 'controller', 'pc', 'scheda'].forEach(onTable);
      [[0, 8], [5, 9], [0, 4], [6, 5]].forEach(s => P('stativo', ...s));
      placedOfType('stativo').forEach(st => { const v = S.compVisuals[st.id].container; S.placeComponentAt('par', v.x, v.y); });
      P('asta', 2, 4);
      { const v = S.compVisuals[placedOfType('asta')[0].id].container; S.placeComponentAt('mic', v.x, v.y); }
      P('quadro', 4, 2);
      const one = ty => placedOfType(ty)[0].id;
      const Q = one('quadro'), PC = one('pc'), SC = one('scheda'), MX = one('mixer'), AM = one('ampli'), CT = one('controller');
      const fails = [];
      const wire = (cable, A, ap, B, bp) => {
        const n = gameState.edges.length;
        if (cable) selectCable(cable);
        openRearPanel(A); onRearPortClick(A, ap); openRearPanel(B); onRearPortClick(B, bp);
        if (rearPanelId) closeRearPanel();
        if (gameState.edges.length !== n + 1) { fails.push(A + '.' + ap + ' -> ' + B + '.' + bp + ': ' + el('#toast').textContent); S.cancelPending(); }
      };
      window.__wire = wire; window.__fails = fails;
      wire('cee_tri', 'allaccio', 'out', Q, 'in');
      const subs = subsLeftToRight();
      wire('cee_powercon', Q, 'out_1', subs[0].id, 'power');
      wire('cee_powercon', Q, 'out_1', MX, 'power');
      wire('cee_powercon', Q, 'out_2', subs[1].id, 'power');
      wire('cee_powercon', Q, 'out_2', CT, 'power');
      wire('cee_powercon', Q, 'out_3', AM, 'power');
      wire('cee_schuko', Q, 'out_3', PC, 'power');
      const pars = placedOfType('par').map(c => c.id);
      wire('cee_powercon', Q, 'out_3', pars[0], 'power_in');
      for (let i = 1; i < pars.length; i++) wire('powercon', pars[i - 1], 'power_thru', pars[i], 'power_in');
      wire(null, SC, 'usb', PC, 'usb');
      wire('jack', SC, 'out_L', MX, 'in_5'); wire('jack', SC, 'out_R', MX, 'in_6');
      wire('xlr', MX, 'main_L', AM, 'in_L'); wire('xlr', MX, 'main_R', AM, 'in_R');
      wire('speakon', AM, 'out_L', subs[0].id, 'spk_in'); wire('speakon', AM, 'out_R', subs[1].id, 'spk_in');
      subs.forEach(sb => wire('speakon', sb.id, 'spk_thru', sb.hasTop, 'spk_in'));
      wire('xlr', one('mic'), 'out', MX, 'in_1');
      wire('dmx', CT, 'dmx_1', pars[0], 'dmx_in');
      for (let i = 1; i < pars.length; i++) wire('dmx', pars[i - 1], 'dmx_thru', pars[i], 'dmx_in');
      placedOfType('par').forEach((c, i) => { c.dmx = { addr: 1 + i * 8, mode: 2 }; });
      ['main', 'rcd', 'L1', 'L2', 'L3'].forEach(k => toggleProtection(k));
      [MX, CT, PC].concat(pars).forEach(id => { if (SWITCHABLE.has(gameState.placed[id].type) && !gameState.placed[id].on) toggleDevicePower(id); });
      for (const id of [AM, ...subs.map(c => c.id)]) { toggleDevicePower(id); await sleep(760); }
      for (let i = 0; i < 3; i++) S.runGiroTest();
      const giro = gameState.giro;
      S.runSystemTest();
      const status = el('#circuit-text').textContent;
      await sleep(300);
      finishCavi({ stars: 3, inspections: 1, cableM: 40, tapeM: 3 });
      // il discorso del preside (preside.html, vedi tests/preside-gioco.js) finito
      presideOpen = true;
      finishPreside({ type: 'preside', grad: 75, rep: 6, beers: 1, drunk: 0, larsens: 0 });
      return { fails, giro, status, stock: Object.entries(gameState.stock).filter(([, v]) => v > 0).map(([k]) => k).sort().join(',') };
    });
    check(!r.fails.length && r.giro === 3 && r.status === 'IMPIANTO OK', 'impianto di partenza non collaudato: ' + JSON.stringify(r));
    // la DI e la consolle del DJ restano: non servono al montaggio
    check(/\bdi\b/.test(r.stock) && /\bdj\b/.test(r.stock), 'DI o consolle usate al montaggio: ' + r.stock);
  };
  // il cambio palco fatto in fretta: consolle, corrente, DI, due XLR, PRONTI
  const cambio = () => ev(() => {
    const S = window.__scene, w = window.__wire;
    startCambioDj(); closeCambioCard();
    const P = (ty, gx, gy) => { const g = gridToScreen(gx + .5, gy + .5); S.placeComponentAt(ty, g.x, g.y); };
    P('dj', 4, 6); P('di', 5, 7);
    const dj = placedOfType('dj')[0].id, di = placedOfType('di')[0].id, mx = placedOfType('mixer')[0].id;
    w('cee_schuko', placedOfType('quadro')[0].id, 'out_1', dj, 'power'); toggleDevicePower(dj);
    w('jack', dj, 'out_L', di, 'in_1'); w('jack', dj, 'out_R', di, 'in_2');
    w('xlr', di, 'out_1', mx, 'in_2'); w('xlr', di, 'out_2', mx, 'in_3');
    // lo stativo luci del DJ: spina a linea spenta (niente interruttore) e DMX sull'universo 2
    P('djluci', 3, 5);
    const lu = placedOfType('djluci')[0].id;
    toggleProtection('L2'); w('cee_schuko', placedOfType('quadro')[0].id, 'out_2', lu, 'power'); toggleProtection('L2');
    w('dmx', placedOfType('controller')[0].id, 'dmx_2', lu, 'dmx_in');
    S.runCambioTest();
    return { done: cambioDjDone(), fails: window.__fails.slice() };
  });
  const frame = async () => {
    await p.waitForSelector('#dj-frame', { timeout: 12000 });
    const h = await p.$('#dj-frame');
    const f = await h.contentFrame();
    await f.waitForFunction(() => window.__dj && !document.querySelector('#start').disabled, null, { timeout: 10000 });
    return f;
  };

  await open();
  await nuovaSerata();
  await ev(() => { Profile.data.beers = 3; });
  const c = await cambio();
  check(c.done && !c.fails.length, 'cambio palco non promosso: ' + JSON.stringify(c));
  const sched = await ev(() => { renderSchedule(); return [...document.querySelectorAll('#schedule-list .sched-row')].map(r => r.className.split(' ')[1] + ':' + r.querySelector('b').textContent); });
  check(sched.includes('now:Notte fuori controllo'), 'dopo il cambio lo show non è «adesso»: ' + sched.join(' | '));
  check(await ev(() => /Notte fuori controllo/.test(el('#foglio .fg-head').textContent) && !!el('#foglio-dj')), 'il foglio non propone il DJ set');

  // ---- lo show si apre da solo, coi dati del montaggio
  const f = await frame();
  const dati = await f.evaluate(() => ({ beers: __dj.state().beers, pars: [...document.querySelectorAll('#pars text')].map(t => t.textContent).filter(t => /PAR|par/.test(t) || t.length > 1), skip: !document.querySelector('#skip').hidden, demo: !document.querySelector('#demo').hidden }));
  check(dati.beers === 3, 'le birre in tasca non arrivano allo show: ' + dati.beers);
  check(dati.skip && !dati.demo, 'nel gioco: salta sì, demo no ' + JSON.stringify(dati));
  check(await ev(() => minigameOpen() && djOpen), 'con lo show aperto il gioco non lo sa');

  // si gioca col capo alle luci (orologio finto): guasti gestiti, poi «Torna al palco»
  await f.evaluate(() => { __dj.virtual(true); __dj.start(true); });
  await f.evaluate(() => { for (let i = 0; i < 40 && !__dj.state().over; i++) __dj.advance(5); });
  const res = await f.evaluate(() => __dj.result());
  check(res && res.type === 'dj' && res.fase === 'tu', 'esito dello show: ' + JSON.stringify(res));
  const rep0 = await ev(() => reputation());
  await f.waitForSelector('#outro:not([hidden])');
  check(await f.textContent('#again') === 'Torna al palco', 'nel gioco il tasto finale non torna al palco');
  await f.click('#again');
  await p.waitForFunction(() => !document.querySelector('#dj-frame'));
  const g = await ev(() => ({ dj: Profile.data.dj, rep: reputation(), beers: Profile.data.beers, open: djOpen, toast: el('#toast').textContent, earned: Object.keys(Profile.data.reputation.earned).filter(k => /:dj$/.test(k)) }));
  check(g.dj && g.dj.grad === res.grad && g.dj.stars === res.stars && g.dj.fase === 'tu', 'esito non salvato: ' + JSON.stringify(g.dj));
  check(g.rep === rep0 + res.rep && g.earned.length === 1, 'reputazione dello show: ' + rep0 + ' -> ' + g.rep + ' (esito ' + res.rep + ')');
  check(g.beers === 3 - res.drunk + res.beers, 'birre dopo lo show: ' + g.beers + ' (esito ' + JSON.stringify({ drunk: res.drunk, beers: res.beers }) + ')');
  check(!g.open && /cacciato via i musicisti.*senza musica/.test(g.toast), 'dopo lo show: ' + JSON.stringify({ open: g.open, toast: g.toast }));
  const sched2 = await ev(() => { renderSchedule(); return el('#schedule-list').textContent; });
  check(/done/.test(await ev(() => document.querySelectorAll('#schedule-list .sched-row')[7].className)) && /★/.test(sched2), 'la scaletta non segna il DJ set fatto: ' + sched2);
  check(await ev(() => /Fine festa/.test(el('#foglio .fg-head').textContent)), 'dopo il DJ set il foglio non dice fine festa');
  // niente secondo set, e la reputazione non raddoppia
  await ev(() => openDj());
  check(!(await p.$('#dj-frame')) && await ev(() => reputation()) === g.rep, 'il DJ set si rifà');

  // ---- ricarica: resta fatto
  await ev(() => Profile.flush());
  await open();
  await p.click('#menu-resume');
  check(await ev(() => djDone() && Profile.data.dj.fase === 'tu'), 'dopo la ricarica lo show non risulta fatto');

  // ---- seconda serata: la birra pagata al capo, poi saltarlo non dà reputazione
  await nuovaSerata();
  await ev(() => { Profile.data.beers = 1; });
  await cambio();
  const f2 = await frame();
  await f2.evaluate(() => { __dj.virtual(true); __dj.start(false); });
  await f2.evaluate(() => { const M = __dj.mappa; __dj.advance(M.t0 + 17 * 4 * 60 / M.bpm + 0.2 - __dj.state().t); document.querySelector('#opt-capo').click(); });
  await f2.evaluate(() => { for (let i = 0; i < 40 && !__dj.state().over; i++) __dj.advance(5); });
  const r2 = await f2.evaluate(() => __dj.result());
  await f2.waitForSelector('#outro:not([hidden])');
  await f2.click('#again');
  await p.waitForFunction(() => !document.querySelector('#dj-frame'));
  const g2 = await ev(() => ({ beers: Profile.data.beers, dj: Profile.data.dj }));
  check(r2.fase === 'capo' && g2.dj.fase === 'capo' && g2.beers === 1 - 1 - r2.drunk + r2.beers, 'birra pagata al capo: ' + JSON.stringify({ r2, g2 }));

  await nuovaSerata();
  await cambio();
  const f3 = await frame();
  const rep3 = await ev(() => reputation());
  await f3.click('#skip');
  await p.waitForFunction(() => !document.querySelector('#dj-frame'));
  const g3 = await ev(() => ({ dj: Profile.data.dj, rep: reputation(), toast: el('#toast').textContent }));
  check(g3.dj && g3.dj.skipped && g3.rep === rep3 && /saltato/.test(g3.toast), 'show saltato: ' + JSON.stringify(g3));

  check(errs.length === 0, 'errori JS: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('dj-gioco: tutto ok');
})();
