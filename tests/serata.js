/* La valutazione della serata (fine del livello 1): con le fasi già giocate
   finto-salvate nella partita, dopo il carico si apre la scheda con stelle,
   titolo, perché e le otto voci; la valutazione entra una volta sola nei
   record; «Rigioca la serata» riparte nello stesso slot e il record resta.
   Una serata perfetta vale 5 stelle, una con tutto saltato 1, e saltare
   le fasi non conviene mai (una fase saltata vale zero, il cambio palco
   non è un guasto).

   Uso:  node tests/serata.js
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const problems = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  await ev(() => startNewGame('Valutato', serviceOffers([])[0]));
  await p.waitForFunction(() => !menuOpen);
  await ev(() => { closeSchedule(); finishScarico({ skipped: true }); });

  // serata perfetta
  const perfect = await ev(() => {
    const d = Profile.data;
    d.scarico = { skipped: false, parsBroken: 0, ricOk: true, faulty: ['finale'], faultyIds: ['rack'], fixed: { ampli: 1 }, wrong: [], kidHits: 0, lost: {}, endClock: '16:25', delay: 0, beers: 1 };
    d.collaudo = { ms: 300000, tests: 4, failedTests: 0, trips: 0, rcdTrips: 0, pops: 0 };
    d.cavi = { stars: 3, inspections: 1 };
    d.preside = { grad: 95, larsens: 0, fault: true, faultFix: 'fast' };
    d.cambioDj = { done: true, ms: 120000, slow: false };
    d.dj = { grad: 92, stars: 5, larsens: 0, fase: 'tu', faseFast: true, par: 'fast' };
    d.carico = { stars: 5, damaged: [], taken: [] };
    return serataReport();
  });
  check(perfect.stars === 5 && perfect.title === 'CREW EXCELLENT', 'serata perfetta senza 5 stelle: ' + JSON.stringify(perfect));
  check(perfect.rows.length === 9, 'le voci della valutazione non sono 9');

  // il carico chiude la serata e apre la valutazione
  await ev(() => { caricoOpen = true; finishCarico({ stars: 4, rep: 3, depart: '23:10', damaged: [], taken: [] }); });
  await p.waitForFunction(() => serataOpen, null, { timeout: 4000 }).catch(() => {});
  const st = await ev(() => ({ open: serataOpen, title: el('.serata-title') && el('.serata-title').textContent, rows: document.querySelectorAll('#serata-rows li').length,
    rec: (Profile.data.records['serata-1'] || []).length, saved: !!Profile.data.serata, record: el('#serata-record').textContent }));
  check(st.open && st.rows === 9 && st.title === 'CREW EXCELLENT', 'la valutazione non si apre dopo il carico: ' + JSON.stringify(st));
  check(st.rec === 1 && st.saved && /Prima serata/.test(st.record), 'la valutazione non entra nei record: ' + JSON.stringify(st));
  // riaperta (dalla scaletta o dal foglio): niente secondo record
  await ev(() => { closeSerata(); openSerata(); });
  check(await ev(() => Profile.data.records['serata-1'].length) === 1, 'riaprendo la valutazione si aggiunge un record');
  check(await ev(() => { closeSerata(); openSchedule(false); const t = el('#schedule-go').textContent; closeSchedule(); return t; }) === 'Com\'è andata la serata', 'la scaletta non porta alla valutazione');

  // rigioca: nuova partita nello stesso slot, il record resta
  await ev(() => openSerata());
  await p.locator('#serata-replay').click();
  const slot0 = await ev(() => Profile.active);
  await p.locator('#player-input').fill('Rigiocato');
  await p.locator('#service-offers .offer-card').first().click();
  await p.locator('#new-start').click();
  await p.waitForFunction(() => !menuOpen);
  const after = await ev(() => ({ active: Profile.active, used: Profile.slots().filter(Boolean).length, serata: Profile.data.serata, carico: Profile.data.carico, collaudo: Profile.data.collaudo,
    rec: Profile.data.records['serata-1'].length, player: Profile.data.player, rep: reputation() }));
  check(after.active === slot0 && after.used === 1 && after.player === 'Rigiocato', 'rigioca non riparte nello stesso slot: ' + JSON.stringify(after));
  check(!after.serata && !after.carico && !after.collaudo && after.rep === 0 && after.rec === 1, 'rigioca non azzera la serata o perde il record: ' + JSON.stringify(after));

  // serata tutta saltata: 1 stella, e la valutazione dice cosa migliorare
  const bad = await ev(() => {
    const d = Profile.data;
    ['preside', 'dj', 'cavi', 'carico'].forEach(k => { d[k] = { skipped: true }; });
    d.scarico = { skipped: false, parsBroken: 3, staBroken: true, ricOk: false, kidHits: 2, lost: {} };
    d.collaudo = { ms: 900000, failedTests: 6, trips: 3, rcdTrips: 1, pops: 2 };
    return serataReport();
  });
  check(bad.stars === 1 && bad.why.some(w => /Da migliorare/.test(w)), 'serata saltata senza 1 stella o senza consiglio: ' + JSON.stringify(bad));

  // saltare non conviene mai (audit P0-1): montaggio pulito e il resto saltato
  // non vale «buon lavoro», e la stessa serata giocata con qualche errore vale di più
  const salti = await ev(() => {
    const d = Profile.data;
    d.collaudo = { ms: 300000, tests: 4, failedTests: 0, trips: 0, rcdTrips: 0, pops: 0 };
    d.cavi = { stars: 3, inspections: 1 };
    d.cambioDj = { done: true, ms: 120000, slow: false };
    ['scarico', 'preside', 'dj', 'carico'].forEach(k => { d[k] = { skipped: true }; });
    const saltata = serataReport();
    d.scarico = { skipped: false, parsBroken: 1, ricOk: true, faultyIds: [], kidHits: 0, lost: {} };
    d.preside = { grad: 55, larsens: 1, fault: true, faultFix: 'ok' };
    d.dj = { grad: 50, stars: 3, larsens: 0, fase: 'capo', par: 'ok' };
    d.carico = { stars: 3, damaged: ['PAR 2'], taken: [] };
    const giocata = serataReport();
    // solo lo scarico saltato contro uno scarico con un PAR rotto
    d.scarico = { skipped: true };
    const senzaScarico = serataReport();
    return { saltata, giocata, senzaScarico };
  });
  const S = salti.saltata, G = salti.giocata;
  if (process.env.VERBOSE) console.log(JSON.stringify({ saltata: [S.score, S.stars, S.quality], giocata: [G.score, G.stars, G.quality], senzaScarico: [salti.senzaScarico.score, salti.senzaScarico.quality] }));
  check(S.stars <= 2 && S.score < 50, 'montaggio pulito e resto saltato vale ancora troppo: ' + S.score + ' punti, ' + S.stars + ' stelle');
  check(G.score > S.score + 15, 'giocare con qualche errore non vale più che saltare: ' + G.score + ' contro ' + S.score);
  check(salti.senzaScarico.score < G.score && salti.senzaScarico.quality.danni < G.quality.danni, 'saltare lo scarico conviene più che rompere un PAR: ' + JSON.stringify([salti.senzaScarico.quality, G.quality]));
  check(S.quality.danni === 0 && S.quality.guasti === 0 && S.quality.show === 0, 'le fasi saltate non contano zero: ' + JSON.stringify(S.quality));
  check(S.skipped.join() === 'scarico,preside,dj,carico' && S.why.some(w => /Non eseguito/.test(w)), 'la valutazione non dice cosa non è stato eseguito: ' + JSON.stringify(S.why));
  // il cambio palco non è un guasto risolto
  const guasti = S.rows.find(r => r[0] === 'Guasti risolti');
  check(guasti[1] === '0 su 0' && !/cambio palco/.test(S.rows.find(r => r[0] === 'Qualità del troubleshooting')[2]), 'il cambio palco conta come guasto: ' + JSON.stringify(guasti));
  check(/cambio palco in 2:00/.test(S.rows.find(r => r[0] === 'Qualità del montaggio')[2]), 'il cambio palco non sta nel montaggio');

  if (errs.length) problems.push('errori in pagina: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('serata: PROBLEMI\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('serata: tutto ok');
})();
