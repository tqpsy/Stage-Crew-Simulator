/* Il cambio palco per il DJ: dopo la posa dei cavi il foglio propone il
   cambio, la carta del DJ dice cosa collegare, la scheda DJ dà la consolle,
   la prova PRONTI boccia con l'indizio giusto finché manca qualcosa e
   promuove quando consolle → DI → mixer suona e il resto dell'impianto è
   ancora a posto. Poi: reputazione, scaletta, salvataggio; la pazienza del
   pubblico che finisce, il microfono spostato di canale e le partite
   salvate prima della DI nella dotazione.

   Uso:  node tests/cambio-dj.js
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
      return { fails, giro, status, stock: Object.entries(gameState.stock).filter(([, v]) => v > 0).map(([k]) => k).sort().join(',') };
    });
    check(!r.fails.length && r.giro === 3 && r.status === 'IMPIANTO OK', 'impianto di partenza non collaudato: ' + JSON.stringify(r));
    // la DI e la consolle del DJ restano: non servono al montaggio
    check(/\bdi\b/.test(r.stock) && /\bdj\b/.test(r.stock), 'DI o consolle usate al montaggio: ' + r.stock);
  };
  const pronti = () => ev(() => { window.__scene.runCambioTest(); return { toast: el('#toast').textContent, done: cambioDjDone() }; });

  await open();
  await nuovaSerata();

  // ---- dopo la posa: il foglio propone il cambio, la scaletta pure
  await p.waitForSelector('#foglio-cambio');
  check(!(await p.isVisible('.tab-btn[data-tab="dj"]')), 'la scheda DJ si vede prima del cambio palco');
  const sched = await ev(() => { renderSchedule(); return [...document.querySelectorAll('#schedule-list .sched-row')].map(r => r.className.split(' ')[1] + ':' + r.querySelector('b').textContent); });
  check(sched.includes('done:Discorso del Preside Tramp') && sched.includes('now:Cambio palco: arriva il DJ') && sched.includes('soon:Notte fuori controllo'), 'scaletta dopo la posa: ' + sched.join(' | '));
  await p.click('#schedule-btn');
  check(await p.textContent('#schedule-go') === 'Inizia il cambio palco', 'la scaletta non porta al cambio palco: ' + await p.textContent('#schedule-go'));
  await p.click('#schedule-close');
  await p.click('#foglio-cambio');
  check(await p.isVisible('#cambio-modal'), 'la carta del DJ non si apre');
  check(/Musa/.test(await p.textContent('#cambio-text')) && /CH 1/.test(await p.textContent('#cambio-text')), 'la carta non dice del microfono per Musa sul CH 1: ' + await p.textContent('#cambio-text'));
  check((await p.$$('#cambio-list li')).length === 6, 'la carta non ha le sei voci');
  // con la carta aperta la pazienza non scende
  await p.waitForTimeout(1300);
  check(await ev(() => cambioDj().ms) === 0, 'la pazienza scende con la carta ancora aperta');
  await p.click('#cambio-go');
  check(!(await p.isVisible('#cambio-modal')), 'la carta resta aperta');
  check(await p.isVisible('.tab-btn[data-tab="dj"].active'), 'dopo la carta non si apre la scheda DJ');
  check(await p.textContent('#run-btn') === '▶ PRONTI: TOCCA AL DJ', 'il tasto non è PRONTI: ' + await p.textContent('#run-btn'));
  check(await p.isVisible('#foglio .patience'), 'sul foglio manca la pazienza del pubblico');
  await p.waitForTimeout(2200);
  check(await ev(() => cambioDj().ms) >= 1000, 'la pazienza non scende durante il cambio');

  // ---- PRONTI a metà lavoro: bocciato con l'indizio giusto
  let t = await pronti();
  check(!t.done && /non può attaccare: manca ancora un pezzo/.test(t.toast), 'senza consolle: ' + t.toast);
  const posa = await ev(() => {
    const S = window.__scene;
    const P = (ty, gx, gy) => { const w = gridToScreen(gx + .5, gy + .5); S.placeComponentAt(ty, w.x, w.y); };
    P('dj', 4, 6); P('di', 5, 7);
    const dj = placedOfType('dj')[0], di = placedOfType('di')[0];
    return { dj: dj && isStageCoreCell(dj.gx, dj.gy), di: !!di && isStageCell(di.gx, di.gy), foot: dj && dj.foot.join('x') };
  });
  check(posa.dj && posa.di && posa.foot === '2x1', 'consolle o DI non posate sul palco: ' + JSON.stringify(posa));
  t = await pronti();
  check(!t.done && /non ha corrente/.test(t.toast), 'consolle senza corrente: ' + t.toast);
  await ev(() => window.__wire('cee_schuko', placedOfType('quadro')[0].id, 'out_1', 'dj_1', 'power'));
  t = await pronti();
  check(!t.done && /spenta/.test(t.toast), 'consolle spenta: ' + t.toast);
  // al terzo tentativo il pezzo colpevole è acceso in rosso
  check(await ev(() => window.__scene.compVisuals.dj_1.glow.alpha === 1), 'consolle non evidenziata in rosso');
  await ev(() => toggleDevicePower('dj_1'));
  t = await pronti();
  check(!t.done && /non arriva al mixer/.test(t.toast), 'consolle scollegata: ' + t.toast);
  await ev(() => { const w = window.__wire; w('jack', 'dj_1', 'out_L', 'di_1', 'in_1'); w('jack', 'dj_1', 'out_R', 'di_1', 'in_2'); });
  t = await pronti();
  check(!t.done && /non arriva al mixer/.test(t.toast), 'DI non collegata al mixer: ' + t.toast);
  // la DI accesa dal segnale della consolle
  check(await ev(() => isLedOn('di_1')), 'il LED della DI non si accende col segnale della consolle');
  // un cavo del collaudo staccato nel cambio: la prova lo scopre
  await ev(() => { const S = window.__scene; const e = gameState.edges.find(x => x.a === placedOfType('scheda')[0].id && x.aPort === 'out_L'); S.selectedEdgeId = e.id; S.deleteSelectedEdge(); });
  await ev(() => { const w = window.__wire; w('xlr', 'di_1', 'out_1', 'mixer_1', 'in_2'); w('xlr', 'di_1', 'out_2', 'mixer_1', 'in_3'); });
  t = await pronti();
  check(!t.done && /si è perso qualcosa dell'impianto/.test(t.toast), 'impianto rotto nel cambio non scoperto: ' + t.toast);
  await ev(() => window.__wire('jack', placedOfType('scheda')[0].id, 'out_L', 'mixer_1', 'in_5'));
  const fg = await ev(() => { foglioOpen = true; updateFoglio(); return { head: el('#foglio .fg-head').textContent, ok: document.querySelectorAll('#foglio .fg-list li.ok').length, all: document.querySelectorAll('#foglio .fg-list li').length, ch: el('#foglio .fg-list').textContent }; });
  check(fg.ok === 7 && fg.all === 7 && /7\/7/.test(fg.head) && /CH 2 e CH 3/.test(fg.ch), 'foglio del cambio non spuntato: ' + JSON.stringify(fg));
  check(await ev(() => window.__fails.length) === 0, 'cavi del cambio non collegati: ' + await ev(() => window.__fails.join(' | ')));

  // ---- PRONTI: il DJ attacca
  const rep0 = await ev(() => reputation());
  await p.click('#run-btn');
  const fine = await ev(() => ({ done: cambioDjDone(), toast: el('#toast').textContent, rep: reputation(), btn: el('#run-btn').textContent, head: el('#foglio .fg-head').textContent, status: el('#circuit-text').textContent }));
  check(fine.done && /Pronti!/.test(fine.toast) && /Reputazione \+3/.test(fine.toast), 'cambio non promosso: ' + fine.toast);
  check(fine.rep === rep0 + 3, 'reputazione del cambio: ' + rep0 + ' -> ' + fine.rep);
  check(fine.btn === '▶ TEST IMPIANTO' && /Cambio palco fatto/.test(fine.head) && fine.status === 'IMPIANTO OK', 'dopo il cambio: ' + JSON.stringify(fine));
  const sched2 = await ev(() => { renderSchedule(); return el('#schedule-list').textContent; });
  check(/Finito in \d+:\d\d, prima dei fischi/.test(sched2), 'la scaletta non segna il cambio fatto');
  // rifarlo non vale altro
  check(await ev(() => { window.__scene.runCambioTest(); return reputation(); }) === fine.rep, 'il cambio conta due volte');

  // ---- ricarica: tutto com'era
  await ev(() => Profile.flush());
  await open();
  await p.click('#menu-resume');
  const back = await ev(() => ({ done: cambioDjDone(), dj: !!gameState.placed.dj_1, di: !!gameState.placed.di_1, tab: !document.querySelector('.tab-btn[data-tab="dj"]').hidden, stock: gameState.stock.dj }));
  check(back.done && back.dj && back.di && back.tab && back.stock === 0, 'dopo la ricarica: ' + JSON.stringify(back));
  // partita salvata prima che la DI entrasse nella dotazione (scorta a 0)
  const mig = await ev(() => { const lv = { ...Profile.data.level, stock: { ...Profile.data.level.stock, di: 0 } }; delete lv.stockV; window.__scene.loadLevel(lv); return gameState.stock.di; });
  check(mig === 0, 'DI posata contata due volte nella scorta: ' + mig);
  const mig2 = await ev(() => { window.__scene.deleteComponent('di_1'); const lv = { ...Profile.data.level, stock: { ...Profile.data.level.stock, di: 0 } }; delete lv.stockV; window.__scene.loadLevel(lv); return gameState.stock.di; });
  check(mig2 === 1, 'partita vecchia senza DI nella scorta: ' + mig2);

  // ---- seconda serata: il pubblico perde la pazienza e il microfono si sposta
  await nuovaSerata();
  await ev(() => { startCambioDj(); closeCambioCard(); cambioDj().patienceMs = 2000; });
  await p.waitForTimeout(3300);
  const slow = await ev(() => ({ slow: cambioDj().slow, toast: el('#toast').textContent, rep: reputation(), log: Profile.data.reputation.log[0].reason, bar: el('#foglio .patience').className }));
  check(slow.slow && /perso la pazienza/.test(slow.toast) && /lento/.test(slow.log) && /over/.test(slow.bar), 'pazienza finita: ' + JSON.stringify(slow));
  const lento = await ev(() => {
    const S = window.__scene, w = window.__wire;
    const P = (ty, gx, gy) => { const p = gridToScreen(gx + .5, gy + .5); S.placeComponentAt(ty, p.x, p.y); };
    P('dj', 3, 5); P('di', 5, 5);
    const dj = placedOfType('dj')[0].id, di = placedOfType('di')[0].id, mx = placedOfType('mixer')[0].id, mic = placedOfType('mic')[0].id;
    w('cee_schuko', placedOfType('quadro')[0].id, 'out_2', dj, 'power'); toggleDevicePower(dj);
    w('jack', dj, 'out_L', di, 'in_2'); w('jack', dj, 'out_R', di, 'in_1');
    w('xlr', di, 'out_1', mx, 'in_3');
    // il microfono spostato sul CH 4, la DI sui CH 1 e 3
    const e = gameState.edges.find(x => x.a === mic); S.selectedEdgeId = e.id; S.deleteSelectedEdge();
    w('xlr', mic, 'out', mx, 'in_4'); w('xlr', di, 'out_2', mx, 'in_1');
    const before = reputation();
    S.runCambioTest();
    return { done: cambioDjDone(), toast: el('#toast').textContent, delta: reputation() - before, moved: cambioDj().micMoved, earned: Object.keys(Profile.data.reputation.earned).filter(k => /cambio/.test(k)).sort().join(',') };
  });
  check(lento.done && lento.moved && /aspettato troppo/.test(lento.toast) && /non è più sul CH 1/.test(lento.toast), 'cambio lento col microfono spostato: ' + JSON.stringify(lento));
  check(lento.earned === 'L1:cambio-dj:lento,L1:cambio-dj:mic', 'reputazione del cambio lento: ' + lento.earned);

  // ---- telefono: la carta del DJ ci sta
  await p.setViewportSize({ width: 390, height: 844 });
  await ev(() => { Profile.data.cambioDj = null; startCambioDj(); });
  const box = await p.$eval('.cambio-box', e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
  check(box.l >= 0 && box.r <= box.w, 'la carta esce dallo schermo del telefono: ' + JSON.stringify(box));
  await p.screenshot({ path: process.env.SHOT || '/tmp/cambio-dj.png' });

  check(errs.length === 0, 'errori JS: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('cambio-dj: tutto ok');
})();
