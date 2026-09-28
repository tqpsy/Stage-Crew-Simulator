/* La posa dei cavi dentro il gioco: finito lo show del primo collaudo si
   apre posa-cavi.html in un iframe con la pianta vera del montaggio (pezzi
   posati, cavi tra basi diverse, DMX e PowerCON dei PAR uniti); la posa si
   risolve, Gerry promuove, il risultato torna al gioco: stelle in
   reputazione una volta sola, scaletta aggiornata, niente seconda posa.
   Poi una partita nuova la salta dalla scaletta.

   Uso:  node tests/posa-cavi-gioco.js
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
  await ev(() => startNewGame('Posatore', serviceOffers([])[0]));
  await p.waitForFunction(() => !menuOpen);
  await ev(() => { closeSchedule(); finishScarico({ skipped: true }); settings().bossTips = false; });

  // montaggio completo, cablato dai pannelli come farebbe il giocatore
  const wired = await ev(() => {
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
    wire('xlr', one('mic'), 'out', MX, 'in_1');
    pars.forEach((id, i) => { if (i === 0) wire('dmx', CT, 'dmx_1', id, 'dmx_in'); else wire('dmx', pars[i - 1], 'dmx_thru', id, 'dmx_in'); });
    return { fails, edges: gameState.edges.length };
  });
  check(!wired.fails.length, 'montaggio non cablato: ' + wired.fails.join(' | '));

  // la pianta che il gioco manda alla posa
  const lay = await ev(() => Object.assign(posaLayout(), { mounted: [placedOfType('mixer')[0].id, placedOfType('par')[0].id] }));
  const ids = Object.keys(lay.devices);
  check(ids.includes('allaccio') && !lay.mounted.some(id => lay.devices[id]),
    'nella pianta mancano le basi o ci sono i pezzi montati: ' + ids.join(','));
  const kinds = lay.lines.map(l => l.kind);
  // PAR in catena: tra un PAR e l'altro DMX e PowerCON fanno la stessa strada
  // (3 coppie); il primo prende il DMX dalla regia e la corrente dal Quadro
  check(kinds.filter(k => k === 'dmx').length === 3 && kinds.filter(k => k === 'data').length === 1, 'DMX e PowerCON dei PAR non uniti come si deve: ' + JSON.stringify(lay.lines.map(l => l.name + ':' + l.kind)));
  check(kinds.filter(k => k === 'speaker').length === 2 && kinds.includes('mic'), 'mancano Speakon o microfono: ' + kinds.join(','));
  check(!lay.lines.some(l => l.from === l.to), 'un cavo tra due pezzi dello stesso tavolo è finito per terra');

  // finito lo show del primo collaudo si apre la posa
  await ev(() => { addReputation(REP.phaseDone, 'Collaudo del livello ' + LEVEL_ID, 'L' + LEVEL_ID + ':collaudo'); const s = window.__scene; s.caviAfterShow = true; s.afterShow(); });
  await p.waitForSelector('#cavi-frame');
  check(await ev(() => schedulePhaseState('cavi')) === 'now', 'in scaletta la posa non è "Adesso"');
  const frame = await (await p.$('#cavi-frame')).contentFrame();
  await frame.waitForFunction(() => S.key === 'gioco' && !document.querySelector('#btn-start').disabled, null, { timeout: 10000 });
  const inside = await frame.evaluate(() => ({ lines: S.scen.lines.length, tape: S.scen.tape, ramps: S.scen.ramps, lens: S.scen.lines.map(l => l.len) }));
  check(inside.lines === lay.lines.length, `la posa ha ${inside.lines} cavi, il montaggio ${lay.lines.length}`);
  // si parte dai cavi come li disegna il montaggio: tutti stesi, lungo la loro linea
  const start = await frame.evaluate(() => S.scen.lines.map(l => {
    const pp = S.paths[l.id], g = l.guide;
    const far = pp && g ? Math.max(...pp.map(([i, j]) => { const x = (i + .5) * CELL_M, y = (j + .5) * CELL_M; return Math.min(...g.map(q => Math.hypot(q[0] - x, q[1] - y)), ...g.slice(1).map((q, k) => { const a = g[k], dx = q[0] - a[0], dy = q[1] - a[1], L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)); return Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y); })); })) : 99;
    return { id: l.id, name: l.name, laid: !!pp, guide: !!g, far };
  }));
  const off = start.filter(x => !x.laid || !x.guide || x.far > 1.6);
  check(!off.length, 'cavi della posa lontani da come li disegna il montaggio: ' + JSON.stringify(off));
  await frame.click('#btn-start');
  // la stessa posa valida che usa la pagina per tararsi: Gerry promuove al primo giro
  const res = await frame.evaluate(() => {
    const sol = autoRoute();
    const bad = S.scen.lines.map(l => [l.id, layPath(l.id, sol[l.id])]).filter(x => x[1] !== true);
    rampRows(sol).forEach(k => { const [pid, j] = k.split(':'); const ps = PASSAGES.find(x => x.id === pid); toggleRamp(ps.r[0], +j); });
    const issues = analyze().map(i => i.type + ': ' + i.text);
    inspect();
    return { bad, issues, stars: S.result && S.result.stars };
  });
  check(!res.bad.length && !res.issues.length && res.stars === 3, 'la posa del montaggio non passa: ' + JSON.stringify(res));
  await frame.click('#btn-open');
  await p.waitForFunction(() => !document.querySelector('#cavi-frame'));
  const after = await ev(() => ({ cavi: Profile.data.cavi, rep: Profile.data.reputation.earned['L1:cavi'], open: caviOpen, row: (renderSchedule(), [...document.querySelectorAll('.sched-row')].find(r => /cavi/.test(r.textContent)).textContent) }));
  check(after.cavi && after.cavi.stars === 3 && after.rep === 5, 'risultato della posa non salvato: ' + JSON.stringify(after));
  check(/Fatto/.test(after.row) && /primo giro/.test(after.row), 'scaletta senza il riassunto della posa: ' + after.row);
  // una sola volta: un altro show o la scaletta non la riaprono
  await ev(() => { const s = window.__scene; s.caviAfterShow = true; s.afterShow(); openSchedule(false); });
  check(await p.textContent('#schedule-go') === 'Torna al palco', 'la scaletta propone di nuovo la posa');
  await ev(() => closeSchedule());
  check(!(await p.$('#cavi-frame')), 'la posa si riapre dopo averla fatta');
  // resta dopo la ricarica
  await ev(() => Profile.flush());
  await p.reload();
  await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  check(await ev(() => caviDone() && Profile.data.reputation.earned['L1:cavi'] === 5), 'la posa si perde ricaricando');

  // partita nuova: collaudo fatto, la posa si apre dalla scaletta e si salta
  await ev(() => startNewGame('Saltatore', serviceOffers([])[0]));
  await p.waitForFunction(() => !menuOpen);
  await ev(() => { closeSchedule(); finishScarico({ skipped: true }); addReputation(REP.phaseDone, 'Collaudo', 'L' + LEVEL_ID + ':collaudo'); openSchedule(false); });
  check(await p.textContent('#schedule-go') === 'Stendi i cavi', 'dopo il collaudo la scaletta non porta alla posa');
  await p.click('#schedule-go');
  await p.waitForSelector('#cavi-frame');
  const fr2 = p.frameLocator('#cavi-frame');
  await fr2.locator('#btn-skip').click();
  await p.waitForFunction(() => !document.querySelector('#cavi-frame'));
  const sk = await ev(() => ({ cavi: Profile.data.cavi, rep: 'L1:cavi' in Profile.data.reputation.earned, input: !caviOpen }));
  check(sk.cavi && sk.cavi.skipped && !sk.rep && sk.input, 'posa saltata male: ' + JSON.stringify(sk));

  check(errs.length === 0, 'errori JS: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('posa-cavi nel gioco: tutto ok', JSON.stringify(inside));
})();
