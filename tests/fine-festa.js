/* Fine festa nel livello 1: il DJ set è il gran finale. Montaggio
   collaudato, posa, discorso e cambio palco fatti, DJ set finito (Gerry ha
   cacciato il DJ): niente karaoke di Macio (tolto dal livello 1, la pagina
   karaoke.html resta per altri livelli e ha il suo test tests/karaoke.js).
   La scaletta segna «Fine festa e smontaggio» fatta e il carico «adesso»,
   il foglio dice fine festa e porta al carico, e il carico si apre da lì.

   Uso:  node tests/fine-festa.js
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
  await open();
  await nuovaSerata();
  await cambio();
  const prima = await rows();
  check(!prima.some(r => /karaoke/i.test(r)) && !prima.some(r => /Dante/.test(r)), 'sulla scaletta c\'è ancora il karaoke (o Dante): ' + prima.join(' | '));
  check(prima.includes('next:Fine festa e smontaggio') && prima.includes('next:Smontaggio e carico'), 'prima del DJ la fine festa o il carico non sono «da fare»: ' + prima.join(' | '));
  check(await ev(() => !LEVELS[0].phases.some(ph => /Karaoke/i.test(ph.title))), 'il karaoke è ancora tra le fasi del livello 1');
  await djFinito();
  await p.waitForTimeout(4000);
  const dopo = await rows();
  check(dopo.includes('done:Fine festa e smontaggio') && dopo.includes('now:Smontaggio e carico'), 'finito il DJ la scaletta non porta a fine festa e carico: ' + dopo.join(' | '));
  const g = await ev(() => ({ frames: [...document.querySelectorAll('iframe')].map(f => f.id), toast: el('#toast').textContent, head: el('#foglio .fg-head').textContent, go: !!el('#foglio-carico'), done: LEVELS[0].phases.find(ph => /Fine festa/.test(ph.title)).done(Profile.data) }));
  check(!g.frames.length, 'dopo il DJ si apre ancora un minigioco da solo: ' + g.frames.join(','));
  check(/Fine festa/.test(g.toast) && /Fine festa/.test(g.head) && g.go && g.done, 'dopo il DJ niente fine festa nel foglio: ' + JSON.stringify(g));
  check(await ev(() => typeof openKaraoke === 'undefined'), 'il karaoke si può ancora aprire dal livello 1');
  await ev(() => openSchedule(false));
  check((await p.textContent('#schedule-go')) === 'Carica il furgone', 'la scaletta dopo il DJ non porta al carico: ' + await p.textContent('#schedule-go'));
  await ev(() => closeSchedule());
  await p.route(/carico\.html/, r => r.fulfill({ body: '<!doctype html><title>carico</title>', contentType: 'text/html' }));
  await ev(() => el('#foglio-carico').click());
  check(!!(await p.$('#carico-frame')), 'il foglio a fine festa non apre il carico');

  check(errs.length === 0, 'errori JS: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('fine-festa: tutto ok');
})();
