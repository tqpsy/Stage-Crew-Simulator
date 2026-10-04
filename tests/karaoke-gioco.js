/* Il karaoke di Macio dentro il gioco: montaggio collaudato, posa,
   discorso e cambio palco fatti, DJ set finito (Gerry ha cacciato il DJ).
   Prima il karaoke non c'è sulla scaletta (è fuori programma); finito il DJ
   set compare come «adesso», il foglio lo propone e si apre da solo in un
   iframe con le birre in tasca e il canale del microfono. L'esito torna al
   gioco: reputazione una volta sola, birre, stanchezza, scaletta e foglio
   aggiornati, niente secondo karaoke. Senza microfono collegato Macio
   aspetta; saltarlo non dà reputazione.

   Uso:  node tests/karaoke-gioco.js
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
  // lo show del DJ ha i suoi test: qui si chiude da fuori
  await p.route(/dj\.html/, r => r.fulfill({ body: '<!doctype html><title>dj</title>', contentType: 'text/html' }));
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
  // il DJ set finito: Gerry ha cacciato il DJ
  const djFinito = () => ev(() => {
    djOpen = true;
    finishDj({ type: 'dj', grad: 70, rep: 6, beers: 1, drunk: 0, stars: 4, larsens: 0, fase: 'tu' });
  });
  const rows = () => ev(() => { renderSchedule(); return [...document.querySelectorAll('#schedule-list .sched-row')].map(r => r.className.split(' ')[1] + ':' + r.querySelector('b').textContent); });
  const frame = async () => {
    await p.waitForSelector('#karaoke-frame', { timeout: 15000 });
    const h = await p.$('#karaoke-frame');
    const f = await h.contentFrame();
    await f.waitForFunction(() => window.__karaoke && !document.querySelector('#start').disabled, null, { timeout: 10000 });
    return f;
  };

  await open();
  await nuovaSerata();
  await ev(() => { Profile.data.beers = 2; });
  await cambio();
  const prima = await rows();
  check(!prima.some(r => /karaoke/i.test(r)) && !prima.some(r => /Dante/.test(r)), 'prima del DJ il karaoke è già sulla scaletta (o c\'è ancora Dante): ' + prima.join(' | '));
  await djFinito();
  const dopo = await rows();
  check(dopo.includes('now:Fuori programma: il karaoke di Macio'), 'finito il DJ il karaoke non è «adesso»: ' + dopo.join(' | '));
  check(await ev(() => /karaoke di Macio/.test(el('#foglio .fg-head').textContent) && !!el('#foglio-karaoke')), 'il foglio non propone il karaoke');

  // ---- si apre da solo, coi dati del gioco
  const f = await frame();
  const dati = await f.evaluate(() => ({ beers: __karaoke.state().beers, skip: !document.querySelector('#skip').hidden, demo: !document.querySelector('#demo').hidden }));
  check(dati.beers === 3 && dati.skip && !dati.demo, 'dati nel karaoke: ' + JSON.stringify(dati));
  check(await ev(() => minigameOpen() && karaokeOpen), 'con il karaoke aperto il gioco non lo sa');

  await f.evaluate(() => { __karaoke.virtual(true); __karaoke.start(true); });
  await f.evaluate(() => { for (let i = 0; i < 40 && !__karaoke.state().over; i++) __karaoke.advance(5); });
  const res = await f.evaluate(() => __karaoke.result());
  check(res && res.type === 'karaoke' && res.stars === 5, 'esito del karaoke: ' + JSON.stringify(res));
  const rep0 = await ev(() => reputation());
  await f.waitForSelector('#outro:not([hidden])');
  check(await f.textContent('#again') === 'Torna al palco', 'nel gioco il tasto finale non torna al palco');
  await f.click('#again');
  await p.waitForFunction(() => !document.querySelector('#karaoke-frame'));
  const g = await ev(() => ({ k: Profile.data.karaoke, rep: reputation(), beers: Profile.data.beers, fat: fatigue(), open: karaokeOpen, toast: el('#toast').textContent, earned: Object.keys(Profile.data.reputation.earned).filter(k => /:karaoke$/.test(k)) }));
  check(g.k && g.k.grad === res.grad && g.k.stars === res.stars, 'esito non salvato: ' + JSON.stringify(g.k));
  check(g.rep === rep0 + res.rep && g.earned.length === 1, 'reputazione del karaoke: ' + rep0 + ' -> ' + g.rep + ' (esito ' + res.rep + ')');
  check(g.beers === 3 - res.drunk + res.beers, 'birre dopo il karaoke: ' + g.beers);
  check(Math.round(g.fat) === res.fatigue, 'stanchezza dopo il karaoke: ' + g.fat + ' / ' + res.fatigue);
  check(!g.open && /salvato la serata/.test(g.toast), 'dopo il karaoke: ' + g.toast);
  const fine = await rows();
  check(fine.includes('done:Fuori programma: il karaoke di Macio'), 'la scaletta non segna il karaoke fatto: ' + fine.join(' | '));
  check(await ev(() => /Serata finita/.test(el('#foglio .fg-head').textContent)), 'il foglio non dice serata finita');
  check(await ev(() => LEVELS[0].phases.some(ph => /Karaoke/.test(ph.title) && ph.done(Profile.data))), 'il karaoke non è tra le fasi del livello');
  await ev(() => openKaraoke());
  check(!(await p.$('#karaoke-frame')) && await ev(() => reputation()) === g.rep, 'il karaoke si rifà');

  // ---- ricarica: resta fatto
  await ev(() => Profile.flush());
  await open();
  await p.click('#menu-resume');
  check(await ev(() => karaokeDone() && Profile.data.karaoke.stars === 5), 'dopo la ricarica il karaoke non risulta fatto');

  // ---- seconda serata: senza microfono Macio aspetta, poi saltarlo non dà reputazione
  await nuovaSerata();
  await cambio();
  await ev(() => { const mic = placedOfType('mic')[0].id; gameState.edges = gameState.edges.filter(e => e.a !== mic && e.b !== mic); });
  await djFinito();
  await p.waitForFunction(() => /Macio aspetta/.test(el('#toast').textContent), null, { timeout: 15000 }).catch(() => {});
  const senza = await ev(() => ({ frame: !!el('#karaoke-frame'), toast: el('#toast').textContent, foglio: el('#foglio').textContent, go: !!el('#foglio-karaoke') }));
  check(!senza.frame && /Macio aspetta/.test(senza.toast) && /microfono/.test(senza.foglio) && !senza.go, 'senza microfono: ' + JSON.stringify(senza));
  await ev(() => { window.__wire('xlr', placedOfType('mic')[0].id, 'out', placedOfType('mixer')[0].id, 'in_1'); openKaraoke(); });
  const f3 = await frame();
  const rep3 = await ev(() => reputation());
  await f3.click('#skip');
  await p.waitForFunction(() => !document.querySelector('#karaoke-frame'));
  const g3 = await ev(() => ({ k: Profile.data.karaoke, rep: reputation(), toast: el('#toast').textContent }));
  check(g3.k && g3.k.skipped && g3.rep === rep3 && /saltato/.test(g3.toast), 'karaoke saltato: ' + JSON.stringify(g3));

  check(errs.length === 0, 'errori JS: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('karaoke-gioco: tutto ok');
})();
