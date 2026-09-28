/* Il discorso del preside dentro il gioco: montaggio vero, Test impianto
   superato, posa dei cavi (saltata); il preside aspetta finché il microfono
   non è collegato a un ingresso MIC, poi preside.html si apre in un iframe
   con l'ingresso cablato davvero (qui MIC 3), i PAR montati e le birre in
   tasca. Finito il discorso l'esito torna al gioco: reputazione una volta
   sola, birre, scaletta aggiornata, niente secondo discorso. I cavi lasciati
   dalla posa arrivano al discorso; saltarlo non dà reputazione.

   Uso:  node tests/preside-gioco.js
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
  if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const problems = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  await ev(() => startNewGame('Fonico', serviceOffers([])[0]));
  await p.waitForFunction(() => !menuOpen);
  await ev(() => { closeSchedule(); finishScarico({ skipped: true }); settings().bossTips = false; settings().skipShow = true; Profile.data.beers = 2; });

  // montaggio completo, cablato dai pannelli; il microfono resta staccato
  const wired = await ev(async () => {
    const S = window.__scene;
    const P = (ty, gx, gy) => { const w = gridToScreen(gx + .5, gy + .5); S.placeComponentAt(ty, w.x, w.y); };
    const on = (ty, base) => { const v = S.compVisuals[base].container; S.placeComponentAt(ty, v.x, v.y); };
    P('sub', 1, 8); P('sub', 7, 8); P('top', 1, 8); P('top', 7, 8);
    P('tavolo', 7, 5);
    const T = placedOfType('tavolo')[0].id;
    ['mixer', 'ampli', 'controller', 'pc', 'scheda'].forEach(ty => on(ty, T));
    [[0, 8], [9, 9], [1, 5], [6, 6]].forEach(s => P('stativo', ...s));
    placedOfType('stativo').forEach(st => on('par', st.id));
    P('asta', 3, 5); on('mic', placedOfType('asta')[0].id);
    P('quadro', 4, 2); P('ciabatta_cee', 6, 2);
    const one = ty => placedOfType(ty)[0].id;
    const Q = one('quadro'), CC = one('ciabatta_cee'), PC = one('pc'), SC = one('scheda'), MX = one('mixer'), AM = one('ampli'), CT = one('controller');
    const fails = [];
    const wire = (cable, A, ap, B, bp, leadFirst) => {
      const n = gameState.edges.length;
      const order = leadFirst ? [[B, bp], [A, ap]] : [[A, ap], [B, bp]];
      if (cable) selectCable(cable);
      for (const [c, pp] of order) { openRearPanel(c); onRearPortClick(c, pp); }
      if (rearPanelId) closeRearPanel();
      if (gameState.edges.length !== n + 1) { fails.push(cable + ' ' + A + ' → ' + B + ': ' + el('#toast').textContent); S.cancelPending(); }
    };
    window.__wire = wire;
    wire('cee_tri', 'allaccio', 'out', Q, 'in');
    wire(null, Q, 'out_1', CC, 'in', true);
    wire(null, CC, 'out_1', PC, 'power', true);
    [MX, CT, AM].forEach((id, i) => wire('cee_powercon', Q, 'out_' + (1 + i % 3), id, 'power'));
    placedOfType('sub').forEach((c, i) => wire('cee_powercon', Q, 'out_' + (2 + i), c.id, 'power'));
    const pars = placedOfType('par').map(c => c.id);
    wire('cee_powercon', Q, 'out_3', pars[0], 'power_in');
    pars.slice(1).forEach((id, i) => wire('powercon', pars[i], 'power_thru', id, 'power_in'));
    wire(null, PC, 'usb', SC, 'usb', true);
    wire('jack', SC, 'out_L', MX, 'in_5'); wire('jack', SC, 'out_R', MX, 'in_6');
    wire('xlr', MX, 'main_L', AM, 'in_L'); wire('xlr', MX, 'main_R', AM, 'in_R');
    const subs = subsLeftToRight();
    wire('speakon', AM, 'out_L', subs[0].id, 'spk_in'); wire('speakon', AM, 'out_R', subs[1].id, 'spk_in');
    subs.forEach(sb => wire('speakon', sb.id, 'spk_thru', sb.hasTop, 'spk_in'));
    pars.forEach((id, i) => { if (i === 0) wire('dmx', CT, 'dmx_1', id, 'dmx_in'); else wire('dmx', pars[i - 1], 'dmx_thru', id, 'dmx_in'); });
    placedOfType('par').forEach((c, i) => { c.dmx = { addr: 1 + i * 8, mode: 2 }; });
    // accensione: quadro, poi i leggeri, poi i pesanti uno alla volta
    const pr = quadroProt(findQuadro());
    ['main', 'rcd', 'L1', 'L2', 'L3'].forEach(k => { if (!pr[k]) toggleProtection(k); });
    const sw = Object.values(gameState.placed).filter(c => SWITCHABLE.has(c.type) && (!/^ciabatta/.test(c.type) || gameState.edges.some(e => e.a === c.id)));
    const heavy = sw.filter(c => INRUSH_FACTOR[c.type]), light = sw.filter(c => !INRUSH_FACTOR[c.type]);
    light.sort((a, c) => (/^ciabatta/.test(c.type) ? 1 : 0) - (/^ciabatta/.test(a.type) ? 1 : 0));
    light.forEach(c => { if (!c.on) toggleDevicePower(c.id); });
    for (const c of heavy) { if (!c.on) { toggleDevicePower(c.id); await new Promise(r => setTimeout(r, 760)); } }
    return { fails, mic: micChannel() };
  });
  check(!wired.fails.length && wired.mic === null, 'montaggio non cablato: ' + JSON.stringify(wired));

  // Test impianto, poi la posa
  const test = await ev(() => { window.__scene.runSystemTest(); return { status: el('#circuit-text').textContent, msg: el('#toast').textContent }; });
  check(test.status === 'IMPIANTO OK' && /Monta l'asta|collegalo con un XLR/.test(test.msg), 'Test impianto non superato: ' + JSON.stringify(test));
  // fine dello show senza aspettare i timer di Phaser (come tests/posa-cavi-gioco.js)
  await ev(() => { const s = window.__scene; s.stopFx(); s.afterShow(); });
  await p.waitForSelector('#cavi-frame', { timeout: 10000 });
  check(await ev(() => schedulePhaseState('preside')) === 'next', 'il discorso è già "Adesso" prima della posa');
  await p.frameLocator('#cavi-frame').locator('#btn-skip').click();
  await p.waitForFunction(() => !document.querySelector('#cavi-frame'));
  // microfono staccato: il preside aspetta e l'avviso dice cosa fare
  const wait = await ev(() => ({ toast: el('#toast').textContent, state: schedulePhaseState('preside'), porte: schedulePhaseState('porte') }));
  check(/parla il preside: collega il microfono/.test(wait.toast) && wait.state === 'now' && wait.porte === 'done', 'dopo la posa, senza microfono: ' + JSON.stringify(wait));
  await ev(() => { openSchedule(false); });
  check(await p.textContent('#schedule-go') === 'Il preside sale sul palco', 'la scaletta non porta al discorso');
  await p.click('#schedule-go');
  await p.waitForTimeout(300);
  check(!(await p.$('#preside-frame')) && /Il preside aspetta/.test(await p.textContent('#toast')), 'il discorso parte senza microfono');

  // si collega il microfono a MIC 3: il preside sale da solo
  await ev(() => window.__wire('xlr', placedOfType('mic')[0].id, 'out', placedOfType('mixer')[0].id, 'in_3'));
  await p.waitForTimeout(50);
  check(/Microfono pronto sul CH 3/.test(await p.textContent('#toast')), 'nessun avviso col microfono collegato: ' + await p.textContent('#toast'));
  await p.waitForSelector('#preside-frame', { timeout: 6000 });
  const frame = await (await p.$('#preside-frame')).contentFrame();
  await frame.waitForFunction(() => !document.querySelector('#start').disabled, null, { timeout: 10000 });
  const intro = await frame.evaluate(() => ({
    wired: document.querySelector('.wired-n').textContent, fronts: document.querySelector('#front-names').textContent,
    picks: !document.querySelector('#cause-pick').hidden || !document.querySelector('#posa-pick').hidden,
    pars: [...document.querySelectorAll('#par-btns .par')].map(x => x.textContent), left: [...window.__tramp.posaLeft], beers: window.__tramp.state().beers
  }));
  check(intro.wired === '3' && !intro.picks && intro.pars.length === 4 && intro.pars.filter(t => /frontale/.test(t)).length === 2
    && /^PAR \d e PAR \d$/.test(intro.fronts) && !intro.left.length && intro.beers === 2, 'scheda del discorso sbagliata: ' + JSON.stringify(intro));
  // il discorso: si beve una birra, poi si va dritti alla fine
  await frame.click('#start');
  await frame.click('#beer');
  await frame.evaluate(() => { const S = window.__tramp.state(); S.events = []; S.grad = 80; S.t = 89.9; });
  await frame.waitForSelector('#outro:not([hidden])', { timeout: 6000 });
  const res = await frame.evaluate(() => window.__tramp.result());
  check(await frame.textContent('#again') === 'Torna al palco', 'in fondo al discorso non si torna al palco');
  await frame.click('#again');
  await p.waitForFunction(() => !document.querySelector('#preside-frame'));
  const after = await ev(() => ({ preside: Profile.data.preside, rep: Profile.data.reputation.earned['L1:preside'], beers: Profile.data.beers, open: presideOpen, toast: el('#toast').textContent,
    row: (renderSchedule(), [...document.querySelectorAll('.sched-row')].find(r => /Preside/.test(r.textContent)).textContent) }));
  check(after.preside && after.preside.grad === res.grad && after.rep === res.rep && res.rep > 0 && after.beers === 2 - 1 + res.beers && !after.open,
    'esito del discorso non salvato: ' + JSON.stringify({ after, res }));
  check(/Fatto/.test(after.row) && /Pubblico al/.test(after.row) && /pubblico al/.test(after.toast), 'scaletta o avviso senza il discorso: ' + JSON.stringify(after));
  // una volta sola
  await ev(() => { openPreside(); openSchedule(false); });
  // dopo il discorso la scaletta porta al cambio palco per il DJ (tests/cambio-dj.js)
  check(!(await p.$('#preside-frame')) && await p.textContent('#schedule-go') === 'Inizia il cambio palco', 'il discorso si riapre dopo averlo fatto, o non porta al cambio palco');
  await ev(() => closeSchedule());
  // resta dopo la ricarica
  await ev(() => Profile.flush());
  await p.reload();
  await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  check(await ev(() => presideDone() && Profile.data.reputation.earned['L1:preside'] > 0), 'il discorso si perde ricaricando');
  await ev(() => continueGame());
  await p.waitForFunction(() => !menuOpen && placedOfType('mic').length === 1);

  // i cavi lasciati dalla posa arrivano al discorso; saltarlo non dà reputazione
  const rep0 = await ev(() => { delete Profile.data.reputation.earned['L1:preside']; Profile.data.preside = null;
    Profile.data.cavi = { ...Profile.data.cavi, late: true, left: [{ type: 'fuga' }, { type: 'ronzio' }] }; openPreside(); return reputation(); });
  await p.waitForSelector('#preside-frame', { timeout: 6000 });
  const fr2 = await (await p.$('#preside-frame')).contentFrame();
  await fr2.waitForFunction(() => !document.querySelector('#start').disabled, null, { timeout: 10000 });
  check(JSON.stringify(await fr2.evaluate(() => [...window.__tramp.posaLeft])) === '["passaggio","ronzio"]', 'i cavi lasciati dalla posa non arrivano al discorso');
  await fr2.click('#skip');
  await p.waitForFunction(() => !document.querySelector('#preside-frame'));
  const sk = await ev(() => ({ preside: Profile.data.preside, rep: reputation(), earned: 'L1:preside' in Profile.data.reputation.earned }));
  check(sk.preside && sk.preside.skipped && sk.rep === rep0 && !sk.earned, 'discorso saltato male: ' + JSON.stringify(sk));

  check(errs.length === 0, 'errori JS: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('preside nel gioco: tutto ok', JSON.stringify(res));
})();
