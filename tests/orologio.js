/* L'orologio del montaggio e le scelte che lo usano: parte alle 16:30 (più
   il ritardo dello scarico) e il collaudo è alle 19:30. Si vede sotto il
   titolo del foglio; un pezzo difettoso sistemato da te lo manda avanti di
   10 minuti, lasciato a Macio è pronto dopo 25 minuti mentre lavori; la
   pausa seduti costa 20 minuti; un reset non lo riporta indietro. Nella
   valutazione un collaudo in ritardo pesa sul montaggio. Poi il guasto del
   microfono nel discorso del preside: si può mandare il capo per una birra.

   Uso:  node tests/orologio.js
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
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  await ev(() => startNewGame('Orologio', serviceOffers([])[0]));
  await p.waitForFunction(() => !menuOpen);
  // scarico con 20 minuti di ritardo e il finale arrivato difettoso
  await ev(() => { closeSchedule(); finishScarico({ minutes: 20, faultyIds: ['rack'], faulty: ['finale'], beers: 1 }); settings().bossTips = false; });
  await sleep(300);

  // l'orologio parte dalle 16:50 e si vede nel foglio
  const c0 = await ev(() => ({ on: clockOn(), min: clockMin(), text: (el('#fg-clock') || {}).textContent || '' }));
  check(c0.on && c0.min === 16 * 60 + 50 && /16:50 · collaudo tra 2 h 40/.test(c0.text), 'orologio di partenza: ' + JSON.stringify(c0));

  // il finale difettoso: Macio lo prende, tu intanto lavori
  const m = await ev(() => {
    const S = window.__scene;
    const w = gridToScreen(7.5, 5.5); S.placeComponentAt('tavolo', w.x, w.y);
    const v = S.compVisuals[placedOfType('tavolo')[0].id].container; S.placeComponentAt('ampli', v.x, v.y);
    const id = placedOfType('ampli')[0].id;
    openRearPanel(id);
    const box = el('#rear-fault');
    const out = { id, faulty: isFaulty(id), self: !!box.querySelector('.fault-fix'), crew: (box.querySelector('.fault-crew') || {}).textContent || '' };
    box.querySelector('.fault-crew').click();
    out.job = crewJob(); out.after = box.textContent; out.ms = gameState.stats.playMs;
    closeRearPanel();
    return out;
  });
  check(m.faulty && m.self && /Lascialo a Macio/.test(m.crew) && m.job && m.job.t === 'ampli' && m.job.at === 16 * 60 + 50 + 25 && /Ci sta lavorando Macio/.test(m.after),
    'Macio non prende il finale: ' + JSON.stringify(m));
  check(await ev(() => /Macio sta sistemando il finale/.test(el('#foglio').textContent) || !foglioOpen), 'il foglio non dice che Macio ci lavora');
  // passano 25 minuti di montaggio (qui con la pausa seduti, 20, più 6 minuti)
  await ev(() => { setFatigue(50); openPausa(); });
  await p.click('#pausa-sit');
  const pz = await ev(() => ({ min: clockMin(), toast: el('#toast').textContent }));
  check(pz.min === 16 * 60 + 50 + 20 && /20 minuti seduto.*17:10/.test(pz.toast), 'la pausa non sposta l\'orologio: ' + JSON.stringify(pz));
  check(await ev(() => isFaulty(placedOfType('ampli')[0].id)), 'Macio ha finito prima del tempo');
  await ev(() => { gameState.stats.playMs += 6 * CLOCK.msPerMin; });
  await sleep(1500);
  const done = await ev(() => ({ faulty: isFaulty(placedOfType('ampli')[0].id), job: crewJob(), toast: el('#toast').textContent }));
  check(!done.faulty && !done.job && /^Macio ha finito/.test(done.toast), 'Macio non ha sistemato il finale: ' + JSON.stringify(done));

  // un altro pezzo difettoso, sistemato da te: 10 minuti sull'orologio
  const self = await ev(async () => {
    Profile.data.scarico.faultyIds.push('sub1');
    const w = gridToScreen(1.5, 8.5); window.__scene.placeComponentAt('sub', w.x, w.y);
    const id = placedOfType('sub')[0].id;
    openRearPanel(id);
    const m0 = clockMin();
    el('#rear-fault .fault-fix').click();
    await new Promise(r => setTimeout(r, 1500));
    closeRearPanel();
    return { faulty: isFaulty(id), dm: clockMin() - m0 };
  });
  check(!self.faulty && self.dm >= 10 && self.dm <= 11, 'sistemato da te: ' + JSON.stringify(self));

  // la seconda prova fallita di fila segue il segnale dalla sorgente
  const tr = await ev(() => {
    const S = window.__scene, T = placedOfType('tavolo')[0].id;
    ['mixer', 'pc', 'scheda'].forEach(t => { const v = S.compVisuals[T].container; S.placeComponentAt(t, v.x, v.y); });
    gameState.giro = 1; gameState.giroFails[1] = 0;
    S.runGiroTest(); const t1 = el('#toast').textContent;
    S.runGiroTest(); const t2 = el('#toast').textContent;
    return { t1, t2, lit: (S.traceIds || []).length };
  });
  check(!/segui il segnale/.test(tr.t1) && /segui il segnale\. Musica: PC 1 ✗\. PC 1: non collegato alla corrente/.test(tr.t2) && tr.lit > 0, 'la seconda prova non segue il segnale: ' + JSON.stringify(tr));

  // il reset ricomincia il montaggio, non l'orologio
  const rs = await ev(() => { const m0 = clockMin(); el('#reset-btn').click(); return { m0, m1: clockMin(), placed: Object.keys(gameState.placed).length }; });
  check(rs.m1 >= rs.m0 && rs.placed <= 1, 'il reset riporta indietro l\'orologio: ' + JSON.stringify(rs));

  // nella valutazione: in orario niente, in ritardo pesa sul montaggio
  const val = await ev(() => {
    const d = Profile.data;
    d.cavi = { stars: 3 }; d.carico = { damaged: [], taken: [] };
    d.collaudo = { ms: 600000, failedTests: 0, trips: 0, rcdTrips: 0, pops: 0, clock: 19 * 60 + 5 };
    const on = serataReport();
    d.collaudo.clock = 19 * 60 + 30 + 30;
    const late = serataReport();
    d.collaudo = { ms: 600000, failedTests: 0, trips: 0, rcdTrips: 0, pops: 0 };
    const old = serataReport();
    return { on: on.quality.montaggio, onRow: on.rows[0].join(' '), late: late.quality.montaggio, lateRow: late.rows[0].join(' '), lateWhy: late.rows.find(r => r[0] === 'Qualità del montaggio')[2], old: old.quality.montaggio, oldRow: old.rows[0].join(' ') };
  });
  check(val.on === 100 && /collaudo 19:05 25 min d'anticipo/.test(val.onRow), 'collaudo in orario: ' + JSON.stringify(val));
  check(val.late === 90 && /30 min di ritardo/.test(val.lateRow) && /ritardo/.test(val.lateWhy), 'collaudo in ritardo: ' + JSON.stringify(val));
  check(val.old === 100 && /^Tempo 10:00/.test(val.oldRow), 'partita di prima, senza l\'ora del collaudo: ' + JSON.stringify(val));

  // il discorso del preside da solo: guasto al mixer, si manda il capo
  await p.goto('file://' + path.join(__dirname, '..', 'preside.html'));
  await p.click('#cause-pick button[data-c="mixer"]');
  await p.click('#start');
  const pr = await ev(async () => {
    const T = window.__tramp, S = T.state();
    const e = S.events.find(x => x.id === 'cavo');
    S.events = [e]; e.at = S.t + 0.05;
    await new Promise(r => setTimeout(r, 400));
    const out = { fault: !!S.fault, beers0: S.beers, btn: !!document.querySelector('#strat .strat-capo') };
    document.querySelector('#strat .strat-capo').click();
    out.beers1 = S.beers; out.wait = document.querySelector('#strat').textContent;
    S.t = S.capoAt + 0.1;
    await new Promise(r => setTimeout(r, 600));
    out.fix = S.faultFix; out.after = !!S.fault; out.notes = S.notes.join(' | ');
    return out;
  });
  check(pr.fault && pr.btn && pr.beers1 === pr.beers0 - 1 && /sul palco/.test(pr.wait) && pr.fix === 'capo' && !pr.after && /una birra/.test(pr.notes),
    'il capo non sistema il guasto del preside: ' + JSON.stringify(pr));

  check(!errs.length, 'errori nella pagina: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('Orologio del montaggio, Macio, pausa, valutazione e capo al guasto del preside: ok');
})().catch(e => { console.error(e); process.exit(1); });
