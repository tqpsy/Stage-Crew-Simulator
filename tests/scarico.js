/* Lo scarico dentro il gioco: dopo la scaletta si apre il minigioco
   (scarico.html in un iframe), si gioca davvero (i case vengono messi a
   posto da qui, ma rotture e fine sono quelle del gioco), e il risultato
   torna al gioco: i pezzi rotti mancano al montaggio, il Test impianto
   chiede i PAR arrivati sani, la reputazione cambia una volta sola, la
   scaletta racconta com'è andata e tutto resta dopo la ricarica.

   Uso:  node tests/scarico.js
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js e
   MATTER_PATH=/percorso/matter.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
  if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
  if (process.env.MATTER_PATH) await p.route('**/matter.min.js', r => r.fulfill({ path: process.env.MATTER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const problems = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const open = async () => {
    await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
    await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  };

  await open();
  await ev(() => startNewGame('Scaricatore', serviceOffers([])[0]));
  await p.waitForFunction(() => !menuOpen);
  await p.click('#schedule-go');
  await p.waitForSelector('#scarico-frame');
  const fr = p.frameLocator('#scarico-frame');
  const frame = await (await p.$('#scarico-frame')).contentFrame();
  await fr.locator('#btn-start').click();
  await frame.waitForFunction(() => G && G.mode === 'play', null, { timeout: 10000 });
  const van = await frame.evaluate(() => SERVICE);
  check(van === (await ev(() => serviceName())).slice(0, 28), 'sul furgone non c\'è il nome del service: ' + van);

  // danni veri: case PAR preso male (2 PAR rotti) e borsa stativi rotta;
  // poi tutto al suo posto e lo scarico finisce da solo
  await frame.evaluate(() => {
    const c = id => G.cases.find(x => x.def.id === id);
    damage(c('par'), 30); damage(c('par'), 25);
    damage(c('stativi'), 90);
    damage(c('rack'), 70);        // difettoso: il finale va controllato al montaggio
    // i bauli dei cavi sono già nelle loro zone (niente fisica): difettoso a mano
    G.stowed.find(x => x.def.id === 'segnale').integrity = 15;   // cavi aggrovigliati nel baule
    // Macio fermo (al telefono) e i due tecnici in cortile, poi ogni case al suo posto
    for (const w of G.workers) release(w);
    for (const w of G.workers) { w.job = null; w.jobs = []; }
    // portellone aperto, rampa giù, cinghie e freni tolti
    G.van.open = true; G.van.anim = { what: 'ramp', t: 0.8 }; vanStep(0.01);
    G.straps.forEach((_, i) => releaseStrap(i)); G.cases.forEach(releaseBrake);
    macio('phone'); G.macio.ai.t = -999;
    Matter.Body.setPosition(G.player.body, { x: 700, y: 500 }); Matter.Body.setPosition(G.macio.body, { x: 700, y: 600 });
    const spots = { corrente: [1225, 210, 0], distro: [1225, 330, 0], ricambio: [1380, 420, 0],
      segnale: [1455, 720, 0], tavolo: [1320, 710, 0], rack: [1400, 620, 0], valigetta: [1400, 700, 0],
      stativi: [1530, 230, 0], par: [1560, 310, 0],
      sub1: [1550, 400, 0], sub2: [1550, 480, 0], top1: [1550, 560, 0], top2: [1550, 620, 0] };
    for (const ce of G.cases) {
      if (!spots[ce.def.id]) continue;
      const [x, y, r] = spots[ce.def.id];
      Matter.Body.setPosition(ce.body, { x, y }); Matter.Body.setAngle(ce.body, r * Math.PI / 2); Matter.Body.setVelocity(ce.body, { x: 0, y: 0 });
    }
  });
  // finito il lavoro, una pausa breve: la telecamera passa sulle zone e Macio parla
  await frame.waitForFunction(() => G.mode === 'wrap', null, { timeout: 8000 }).catch(() => {});
  const wrap = await frame.evaluate(() => ({ mode: G.mode, pad: $('#cmd').hidden }));
  check(wrap.mode === 'wrap' && wrap.pad, 'dopo il 100% non c\'è la pausa prima della bolla: ' + JSON.stringify(wrap));
  await frame.waitForFunction(() => G.wrap && G.wrap.said === 2, null, { timeout: 9000 }).catch(() => {});
  check(/possiamo cominciare/.test(await frame.evaluate(() => $('#hint-txt').textContent)), 'Macio non chiude lo scarico');
  await frame.waitForFunction(() => G.mode === 'end', null, { timeout: 6000 }).catch(() => {});
  const inGame = await frame.evaluate(() => ({ mode: G.mode, r: G.result, pars: G.cases.find(x => x.def.id === 'par').pars, zones: G.cases.filter(c => c.zone !== c.def.zone).map(c => c.def.id) }));
  check(inGame.mode === 'end', 'lo scarico non finisce con tutti i case a posto: fuori zona ' + inGame.zones);
  check(inGame.pars === 2, 'PAR rotti sbagliati nel minigioco: ' + inGame.pars + ' sani');
  check(await fr.locator('#btn-again').textContent() === 'Al montaggio', 'nella bolla manca "Al montaggio"');
  await fr.locator('#btn-again').click();
  await p.waitForFunction(() => !document.querySelector('#scarico-frame'));
  // cartello del passaggio, poi il montaggio
  check(/MONTAGGIO/.test(await ev(() => (el('#phase-sign') || {}).textContent || '')), 'manca il cartello del montaggio');
  await p.waitForFunction(() => !document.querySelector('#phase-sign'), null, { timeout: 4000 });

  // al montaggio: 2 PAR rotti, uno lo rimpiazza il case ricambi; lo stativo
  // piegato lo rimpiazza lo stesso case
  const st = await ev(() => ({ s: Profile.data.scarico, par: gameState.stock.par, stativo: gameState.stock.stativo, req: parsRequired(),
    lights: buildExpectedConnections().filter(x => x.cat === 'lights').length, rep: reputation(), earned: 'L1:scarico' in Profile.data.reputation.earned,
    toast: el('#toast').textContent, input: window.__scene.input.enabled }));
  check(JSON.stringify(st.s.lost) === JSON.stringify({ par: 1, stativo: 0 }), 'pezzi mancanti sbagliati: ' + JSON.stringify(st.s.lost));
  check(st.par === 3 && st.stativo === 4 && st.req === 3 && st.lights === 3, 'dotazione o Test impianto sbagliati: ' + JSON.stringify(st));
  check(st.earned && st.rep === 0, 'reputazione dello scarico sbagliata: ' + st.rep);
  check(/manca un PAR/.test(st.toast) && /sono le 1[67]:\d\d/.test(st.toast) && !/difettos/.test(st.toast), 'il messaggio del montaggio non dice cosa manca o che ore sono: ' + st.toast);
  check(st.input, 'dopo lo scarico la scena resta bloccata');
  // i case scaricati restano gli stessi: nome, zona dove li hai lasciati, stato
  const rack = st.s.cases.find(c => c.id === 'rack'), seg = st.s.cases.find(c => c.id === 'segnale');
  check(st.s.cases.length === 13 && rack.at === 'foh' && rack.state === 'difettoso' && rack.dents > 0 && seg.at === 'foh',
    'i case dello scarico non arrivano al montaggio: ' + JSON.stringify(st.s.cases));
  const sched = await ev(() => { renderSchedule(); return { now: el('#schedule-list .sched-row.now').textContent, first: el('#schedule-list .sched-row').textContent }; });
  check(/Montaggio/.test(sched.now), 'la scaletta non passa al montaggio');
  check(/2 PAR rotti/.test(sched.first) && /🍺/.test(sched.first), 'la scaletta non racconta lo scarico: ' + sched.first);
  // luci con 3 PAR: bastano due frontali e un taglio (il giro luci si può finire)
  const luci = await ev(() => {
    const S = window.__scene, P = (ty, gx, gy) => { const w = gridToScreen(gx + .5, gy + .5); S.placeComponentAt(ty, w.x, w.y); };
    const mount = st => { const v = S.compVisuals[st.id].container; S.placeComponentAt('par', v.x, v.y); };
    P('stativo', 2, 9); P('stativo', 6, 9);
    placedOfType('stativo').forEach(mount);
    const soloFrontali = lightingCheck() && lightingCheck().msg;
    P('stativo', 0, 6); mount(placedOfType('stativo').find(x => !x.hasPar));
    return { soloFrontali, ok: lightingCheck(), plan: lightsPlan(), pars: placedOfType('par').length, left: gameState.stock.par };
  });
  check(luci.soloFrontali === 'manca il taglio a un lato del palco.' && luci.ok === null && luci.plan === 'Due frontali nel Pit e un taglio a lato' && luci.pars === 3 && luci.left === 0,
    'luci con 3 PAR sbagliate: ' + JSON.stringify(luci));
  // un "Reset livello" non restituisce i pezzi rotti
  await ev(() => window.__scene.resetLevel(true));
  check(await ev(() => gameState.stock.par) === 3, 'il reset del livello ridà il PAR rotto');
  await p.waitForTimeout(600);

  // birre dello scarico in testata (in orario sì, senza rotture no)
  const beers = await ev(() => ({ n: Profile.data.beers, btn: el('#beer-n').textContent, shown: !el('#beer-btn').hidden }));
  check(beers.n === 1 && beers.btn === '1' && beers.shown, 'birre dello scarico sbagliate: ' + JSON.stringify(beers));
  // pezzi difettosi: il finale col segno arancione blocca il giro audio finché non lo sistemi
  const f1 = await ev(() => {
    const S = window.__scene, P = (ty, gx, gy) => { const w = gridToScreen(gx + .5, gy + .5); S.placeComponentAt(ty, w.x, w.y); };
    P('tavolo', 7, 5);
    const v = S.compVisuals[placedOfType('tavolo')[0].id].container; S.placeComponentAt('ampli', v.x, v.y);
    const amp = placedOfType('ampli')[0];
    const item = giroChecks(1).find(x => x.kind === 'fault');
    openRearPanel(amp.id);
    return { counts: faultCounts(), faulty: amp && isFaulty(amp.id), item: item && item.ok, marks: (S.faultMarks || []).length, box: !el('#rear-fault').hidden, id: amp && amp.id,
      origin: el('#rear-origin').hidden ? '' : el('#rear-origin').textContent, opened: el('#toast').textContent };
  });
  check(/CASE RACK REGIA/.test(f1.origin) && /Off Stage/.test(f1.origin) && /ammaccatur/.test(f1.origin) && /CASE RACK REGIA.*botta/.test(f1.opened),
    'il finale non si riconosce come quello del rack scaricato: ' + JSON.stringify([f1.origin, f1.opened]));
  check(f1.counts.ampli === 1 && f1.counts['baule:segnale'] === 1 && f1.faulty && f1.item === false && f1.marks >= 4 && f1.box,
    'finale difettoso non segnalato: ' + JSON.stringify(f1));
  await p.click('#rear-fault .fault-fix');
  await p.waitForTimeout(1500);
  const f2 = await ev(id => ({ faulty: isFaulty(id), item: giroChecks(1).find(x => x.kind === 'fault').ok, box: !el('#rear-fault').hidden }), f1.id);
  check(!f2.faulty && f2.item && !f2.box, 'il finale non si sistema: ' + JSON.stringify(f2));
  await ev(() => closeRearPanel());
  // baule SEGNALE aggrovigliato: prima si sbroglia, poi si prendono i cavi
  await ev(() => openCase('segnale'));
  await ev(() => pickCable('xlr'));
  check(await ev(() => gameState.selectedCable) == null && /sbroglia/.test(await ev(() => el('#toast').textContent)), 'dal baule aggrovigliato si prendono cavi');
  await p.click('#case-fault .fault-fix');
  await p.waitForTimeout(1500);
  await ev(() => pickCable('xlr'));
  check(await ev(() => gameState.selectedCable) === 'xlr', 'dopo averlo sbrogliato il baule non dà i cavi');
  await ev(() => { closeCase(); window.__scene.resetLevel(true); });
  await p.waitForTimeout(400);

  // ricarica: Continua tiene lo scarico e la dotazione, e non lo rifà
  await open();
  await p.click('#menu-resume');
  await p.waitForTimeout(300);
  const back = await ev(() => ({ par: gameState.stock.par, req: parsRequired(), frame: !!document.querySelector('#scarico-frame'), sched: scheduleOpen }));
  check(back.par === 3 && back.req === 3 && !back.frame && !back.sched, 'dopo la ricarica lo scarico non è rimasto: ' + JSON.stringify(back));

  // partita interrotta durante lo scarico: Continua riparte dalla scaletta
  await ev(() => { startNewGame('Interrotto', serviceOffers([])[0]); });
  await p.waitForFunction(() => !menuOpen);
  await p.click('#schedule-go');
  await p.waitForSelector('#scarico-frame');
  await p.waitForTimeout(600);
  await open();
  await p.click('#menu-resume');
  await p.waitForTimeout(300);
  check(await ev(() => scheduleOpen && !scaricoDone()), 'una partita ferma allo scarico non riparte dalla scaletta');
  await p.click('#schedule-go');
  check(await p.isVisible('#scarico-frame'), 'dopo la scaletta lo scarico non riparte');

  // impostazione "Salta lo scarico": niente iframe
  await ev(() => { document.querySelector('#scarico-frame').remove(); scaricoOpen = false; startNewGame('Saltatore', serviceOffers([])[0]); });
  await p.waitForFunction(() => !menuOpen);
  // la prima volta l'impostazione non vale: lo scarico è il tutorial
  await ev(() => { settings().skipScarico = true; });
  await p.click('#schedule-go');
  const first = await ev(() => !!document.querySelector('#scarico-frame'));
  check(first, 'il primo scarico si salta con l\'impostazione');
  const fskip = await (await p.$('#scarico-frame')).contentFrame();
  await fskip.waitForSelector('#btn-start');
  check(await fskip.evaluate(() => document.getElementById('btn-skip').hidden), 'al primo scarico c\'è il tasto Salta');
  // giocato una volta, dalla volta dopo l'impostazione vale
  await ev(() => { document.querySelector('#scarico-frame').remove(); scaricoOpen = false; Profile.data.scaricoPlayed = true; openScarico(); });
  const skipped = await ev(() => ({ frame: !!document.querySelector('#scarico-frame'), sk: Profile.data.scarico && Profile.data.scarico.skipped, par: gameState.stock.par }));
  check(!skipped.frame && skipped.sk && skipped.par === 4, 'l\'impostazione "Salta lo scarico" non funziona: ' + JSON.stringify(skipped));

  console.log('PROBLEMI:', JSON.stringify(problems, null, 1));
  console.log('ERRORI JS:', errs);
  await b.close();
  const ok = !problems.length && !errs.length;
  console.log(ok ? 'SCARICO OK' : 'SCARICO FALLITO');
  process.exit(ok ? 0 : 1);
})();
