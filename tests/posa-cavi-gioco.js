/* La posa dei cavi dentro il gioco: i cavi si stendono al montaggio (il
   cavo appena collegato resta in mano, a tratti dritti) e finito lo show
   del primo collaudo passa Gerry, il bidello, con le regole della posa: via
   di fuga, passaggi, scena, ronzio. Un cavo sulla via di fuga lo boccia;
   sistemato, Gerry promuove al secondo giro: stelle in reputazione una
   volta sola, scaletta aggiornata, niente secondo giro. Poi una partita
   nuova apre le porte con i cavi in giro.

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

  // il cavo appena collegato dal pannello resta in mano da stendere
  const lay = await ev(() => { const S = window.__scene; const r = { id: S.lay && S.lay.id, last: gameState.edges[gameState.edges.length - 1].id, bar: el('#lay-bar').classList.contains('show') }; S.endLay(true); r.after = !!S.lay; return r; });
  check(lay.id === lay.last && lay.bar && !lay.after, 'il cavo collegato non resta in mano, o Fatto non lo lascia: ' + JSON.stringify(lay));
  // per terra solo i cavi tra basi diverse, a tratti dritti paralleli ai muri
  const floor = await ev(() => {
    const S = window.__scene, out = { floor: 0, table: 0, bent: [] };
    gameState.edges.forEach(e => {
      const f = S.edgeFloor(e);
      if (!f) { out.table++; return; }
      out.floor++;
      f.pts.slice(1).forEach((q, k) => { const a = f.pts[k]; if (Math.abs(q.gx - a.gx) > 1e-6 && Math.abs(q.gy - a.gy) > 1e-6) out.bent.push(e.id); });
    });
    return out;
  });
  check(floor.floor > 10 && floor.table > 3 && !floor.bent.length, 'cavi per terra sbagliati: ' + JSON.stringify(floor));
  // il percorso automatico di questo montaggio va già bene a Gerry
  check(await ev(() => gerryIssues().length) === 0, 'il percorso automatico ha errori: ' + JSON.stringify(await ev(() => gerryIssues().map(i => i.text))));
  // + Piega aggiunge una piega e basta; messa in riga con le vicine sparisce
  const bend = await ev(() => {
    const S = window.__scene, e = gameState.edges.find(x => x.signal === 'speakon');
    S.startLay(e.id);
    const n0 = S.lay.route.bends.length;
    S.layAddBend();
    const n1 = S.lay.route.bends.length;
    S.lay.drag = { k: n1 - 1 }; S.layDragEnd();
    const n2 = S.lay.route.bends.length;
    S.endLay(true);
    return { n0, n1, n2, saved: !!e.route };
  });
  check(bend.n1 === bend.n0 + 1 && bend.n2 === bend.n0 && !bend.saved, 'pieghe aggiunte o tolte male: ' + JSON.stringify(bend));
  // uno Speakon steso sulla via di fuga (sul pavimento a strisce rosse)
  const bad = await ev(() => {
    const S = window.__scene, sub = subsLeftToRight()[0].id;
    const e = gameState.edges.find(x => x.b === sub && x.signal === 'speakon');
    S.startLay(e.id);
    // giù fino alla platea, a sinistra lungo il muro e su fino al sub
    const { A, B } = S.edgeEnds(e);
    S.lay.route = { bends: [[A.gx, 11.75], [0.75, 11.75], [0.75, B.gy]] };
    S.redrawEdges();
    const live = el('#lay-text').textContent;
    S.endLay(true);
    return { id: e.id, live, issues: gerryIssues().map(i => i.type), saved: !!e.route };
  });
  check(bad.saved && JSON.stringify(bad.issues) === '["fuga"]' && /via di fuga/.test(bad.live), 'cavo sulla via di fuga non segnalato: ' + JSON.stringify(bad));

  // finito lo show del primo collaudo passa Gerry e lo trova
  await ev(() => { addReputation(REP.phaseDone, 'Collaudo del livello ' + LEVEL_ID, 'L' + LEVEL_ID + ':collaudo'); const s = window.__scene; s.caviAfterShow = true; s.afterShow(); });
  await p.waitForSelector('#gerry-modal.show');
  check(await ev(() => schedulePhaseState('cavi')) === 'now', 'in scaletta la posa non è "Adesso"');
  const g1 = await ev(() => ({ title: el('#gerry-title').textContent, list: el('#gerry-list').textContent }));
  check(g1.title === 'Fermi tutti!' && /via di fuga/.test(g1.list), 'Gerry non trova il cavo sulla via di fuga: ' + JSON.stringify(g1));
  await p.click('#gerry-fix');
  check(await ev(() => !gerryOpen && !caviDone() && window.__scene.input.enabled), 'Sistemo non torna al montaggio');
  // sistemato (Com'era), dalla scaletta Gerry ripassa e promuove al secondo giro
  await ev(() => { const S = window.__scene; S.startLay(gameState.edges.find(x => x.b === subsLeftToRight()[0].id && x.signal === 'speakon').id); S.layReset(); S.endLay(true); openSchedule(false); });
  check(await p.textContent('#schedule-go') === 'Chiama Gerry', 'la scaletta non richiama Gerry');
  await p.click('#schedule-go');
  await p.waitForSelector('#gerry-modal.show');
  check(await ev(() => el('#gerry-title').textContent) === 'Cavi a posto', 'Gerry non promuove dopo la sistemazione');
  await p.click('#gerry-go');
  const after = await ev(() => ({ cavi: Profile.data.cavi, rep: Profile.data.reputation.earned['L1:cavi'], open: gerryOpen, row: (renderSchedule(), [...document.querySelectorAll('.sched-row')].find(r => /cavi/.test(r.textContent)).textContent) }));
  check(after.cavi && after.cavi.stars === 2 && after.cavi.inspections === 2 && after.rep === 3 && !after.open && after.cavi.cableM > 20, 'risultato di Gerry non salvato: ' + JSON.stringify(after));
  check(/Fatto/.test(after.row) && /2 giri di Gerry/.test(after.row), 'scaletta senza il riassunto della posa: ' + after.row);
  // una sola volta: un altro show o la scaletta non lo richiamano
  await ev(() => { const s = window.__scene; s.caviAfterShow = true; s.afterShow(); openSchedule(false); });
  check(await p.textContent('#schedule-go') === 'Il preside sale sul palco', 'la scaletta propone di nuovo Gerry, o non porta al discorso');
  await ev(() => closeSchedule());
  check(await ev(() => !gerryOpen), 'Gerry ripassa dopo aver aperto le porte');
  // i percorsi stesi restano dopo la ricarica; spostando una base quel cavo torna automatico
  await ev(() => { const S = window.__scene, e = gameState.edges.find(x => x.signal === 'xlr' && x.a === placedOfType('mic')[0].id); S.startLay(e.id); const { A, B } = S.edgeEnds(e); S.lay.route = { bends: [[5.75, A.gy], [5.75, B.gy]] }; S.endLay(true); });
  await ev(() => Profile.flush());
  await p.reload();
  await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  check(await ev(() => caviDone() && Profile.data.reputation.earned['L1:cavi'] === 3), 'la posa si perde ricaricando');
  await ev(() => continueGame());
  await p.waitForFunction(() => !menuOpen && placedOfType('sub').length === 2);
  const kept = await ev(() => {
    const S = window.__scene, e = gameState.edges.find(x => x.signal === 'xlr' && x.a === placedOfType('mic')[0].id);
    const f1 = S.edgeFloor(e), r = e.route;
    const asta = placedOfType('asta')[0], cells = asta.cells;
    asta.cells = cells.map(k => k.replace(/^(\d+)/, m => String(+m + 1)));
    const moved = JSON.stringify(S.edgeFloor(e).route.bends) !== JSON.stringify(f1.route.bends);
    asta.cells = cells;
    return { r: !!r, bends: f1.route.bends, moved };
  });
  check(kept.r && kept.bends.some(b => b[0] === 5.75) && kept.moved, 'percorso perso dopo la ricarica o rimasto dopo aver spostato il pezzo: ' + JSON.stringify(kept));

  // partita nuova: Gerry dalla scaletta, e si aprono le porte con i cavi in giro
  await ev(() => startNewGame('Frettoloso', serviceOffers([])[0]));
  await p.waitForFunction(() => !menuOpen);
  await ev(() => { closeSchedule(); finishScarico({ skipped: true }); addReputation(REP.phaseDone, 'Collaudo', 'L' + LEVEL_ID + ':collaudo'); });
  await ev(() => {
    const S = window.__scene;
    const P = (ty, gx, gy) => { const w = gridToScreen(gx + .5, gy + .5); S.placeComponentAt(ty, w.x, w.y); };
    P('quadro', 4, 2); P('stativo', 0, 8); const st = placedOfType('stativo')[0]; const v = S.compVisuals[st.id].container; S.placeComponentAt('par', v.x, v.y);
    const Q = placedOfType('quadro')[0].id, par = placedOfType('par')[0].id;
    selectCable('cee_powercon'); openRearPanel(Q); onRearPortClick(Q, 'out_1'); openRearPanel(par); onRearPortClick(par, 'power_in');
    const { A, B } = S.edgeEnds(gameState.edges[gameState.edges.length - 1]);
    S.lay.route = { bends: [[A.gx, 11.75], [B.gx, 11.75]] };
    S.endLay(true);
    openSchedule(false);
  });
  check(await p.textContent('#schedule-go') === 'Chiama Gerry', 'dopo il collaudo la scaletta non porta a Gerry');
  await p.click('#schedule-go');
  await p.waitForSelector('#gerry-modal.show');
  await p.click('#gerry-go');
  const late = await ev(() => {
    renderSchedule();
    return { cavi: Profile.data.cavi, rep: 'L1:cavi' in Profile.data.reputation.earned, toast: el('#toast').textContent, show: caviLeftovers(),
      row: [...document.querySelectorAll('.sched-row')].find(r => /cavi/.test(r.textContent)).textContent };
  });
  check(late.cavi && late.cavi.late && late.cavi.stars === 0 && !late.rep && /cavi ancora in giro/.test(late.toast) && /Porte aperte con i cavi in giro/.test(late.row), 'porte aperte con i cavi in giro gestite male: ' + JSON.stringify(late));
  // la corrente scende dal Quadro attraverso la scena e finisce sulla via di fuga
  check(JSON.stringify(late.show) === '["passaggio","scena"]' && /Durante lo show/.test(late.row), 'errori rimasti non passati allo show: ' + JSON.stringify(late.show) + ' ' + late.row);

  check(errs.length === 0, 'errori JS: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('posa-cavi nel gioco: tutto ok', JSON.stringify(floor));
})();
