/* Spettacolo del preside (prima prova): da ?prova l'impianto già montato si
   collauda, arriva la carta del preside, parte il discorso e finisce col
   verbale; poi si torna al palco. Il tempo avanza a mano (Show.step), così
   il test è veloce. Controlla anche la resa sul telefono: niente scorrimento
   orizzontale, fumetti dentro lo schermo, banco regia sotto il palco.

   Uso:  node tests/spettacolo-preside.js [larghezza] [altezza]   (default 390 844)
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const W = +(process.argv[2] || 390), H = +(process.argv[3] || 844);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: W < 700, isMobile: W < 700 });
  const p = await ctx.newPage();
  if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const problems = [];
  const check = (ok, msg) => { if (!ok) problems.push(msg); };
  await p.goto('file://' + path.join(__dirname, '..', 'index.html') + '?prova');
  await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  await p.evaluate(() => { settings().skipShow = true; });
  await p.waitForFunction(() => el('#show-intro').classList.contains('show'), null, { timeout: 45000 });
  check(await p.evaluate(() => el('#circuit-text').textContent === 'IMPIANTO OK' && micChannel() === 1), 'collaudo della prova non riuscito');
  check(await p.evaluate(() => !el('#show-btn').hidden), 'tasto 🎤 Preside non visibile dopo il collaudo');

  await p.locator('#show-start').click();
  await p.evaluate(() => Show.manualTime(true));
  await p.waitForTimeout(200);
  check(await p.evaluate(() => Show.active && document.body.classList.contains('in-show')), 'la vista spettacolo non si apre');
  // apertura: senza fare niente scade e il pubblico cala
  const g0 = await p.evaluate(() => Show.state.grad);
  await p.evaluate(() => { for (let i = 0; i < 110; i++) Show.step(0.1); });
  const s1 = await p.evaluate(() => ({ grad: Show.state.grad, open: { failed: !!Show.state.events[0].failed } }));
  check(s1.open.failed && s1.grad < g0, 'apertura ignorata ma non punita: ' + JSON.stringify([g0, s1.grad, s1.open.failed]));

  // un giro nuovo, fatto bene: luce bianca dalla memoria, voce su, musica giù
  await p.evaluate(() => Show.start());
  await p.evaluate(() => Show.manualTime(true));
  await p.locator('#sd-mem-1').dispatchEvent('pointerdown');
  await p.locator('#sd-mem-1').dispatchEvent('pointerup');
  await p.evaluate(() => { const S = Show.state; S.fad[S.micCh] = 0.55; S.fad.pc = 0; for (let i = 0; i < 30; i++) Show.step(0.1); });
  check(await p.evaluate(() => Show.state.events[0].solved), 'apertura fatta bene ma non risolta');
  check(await p.evaluate(() => Show.state.pars.every(c => c === 'bianco') && Show.state.dimmer === 1), 'memoria 1 non richiamata dal banco');

  // durante il discorso: fumetti dentro lo schermo, niente scorrimento orizzontale
  let bubblesSeen = 0;
  for (let k = 0; k < 16; k++) {
    const r = await p.evaluate(() => {
      for (let i = 0; i < 40; i++) Show.step(0.1);
      const wrap = el('#stage-wrap').getBoundingClientRect();
      return { t: Show.state.t, sw: document.documentElement.scrollWidth, bub: [...document.querySelectorAll('.alert')].map(x => { const q = x.getBoundingClientRect(); return [q.left - wrap.left, q.right - wrap.left, wrap.width]; }) };
    });
    check(r.sw <= W, 'scorrimento orizzontale a t=' + r.t.toFixed(0));
    r.bub.forEach(([l, rr, w]) => { bubblesSeen++; check(l >= 0 && rr <= w + 1, 'avviso fuori dal palco a t=' + r.t.toFixed(0)); });
  }
  check(bubblesSeen > 0, 'nessun avviso visto durante il discorso');
  if (W < 700) {
    const lay = await p.evaluate(() => ({ stage: el('#stage-wrap').getBoundingClientRect().height, desk: el('#show-desk').getBoundingClientRect(), vh: innerHeight }));
    check(lay.desk.bottom <= lay.vh + 1 && lay.desk.height >= lay.vh * 0.3 && lay.stage >= lay.vh * 0.3, 'banco regia e palco non si dividono lo schermo: ' + JSON.stringify(lay));
  }
  await p.evaluate(() => { for (let i = 0; i < 400; i++) Show.step(0.1); });
  await p.waitForFunction(() => el('#show-outro').classList.contains('show'), null, { timeout: 5000 }).catch(() => problems.push('verbale finale non mostrato'));
  check(await p.evaluate(() => Show.result && Show.result.grad >= 0), 'risultato mancante');

  await p.locator('#show-back').click();
  await p.waitForTimeout(300);
  check(await p.evaluate(() => !Show.active && !document.body.classList.contains('in-show') && window.__scene.scale.height === GAME_H), 'il ritorno al palco non ripristina la vista');
  check(await p.evaluate(() => el('#circuit-text').textContent === 'IMPIANTO OK'), 'lo spettacolo ha cambiato lo stato dell\'impianto');

  // ---- guasto del cavo e reputazione, in una partita vera che parte da reputazione 0.
  // Si tengono solo apertura e finale, così il test non dipende dal caso.
  await p.evaluate(() => {
    gameActive = true; Profile.data.reputation = { total: 0, earned: {}, log: [] }; Profile.data.fasi = {};
    window.__discorso = piano => {
      Show.start(); Show.manualTime(true);
      const S = Show.state, step = sec => { for (let i = 0; i < Math.round(sec * 10); i++) Show.step(0.1); };
      S.events = S.events.filter(e => e.id === 'apertura' || e.id === 'finale');
      S.pars = ['bianco', 'bianco', 'bianco', 'bianco']; S.dimmer = 1; S.fad[S.micCh] = 0.55; S.fad.pc = 0;
      step(12);
      piano(S, step);
      step(Math.max(0, 80.5 - S.t)); S.pars = ['viola', 'blu', 'blu', 'viola']; S.dimmer = 0.3; S.fad.pc = 0.7; step(11);
      return { ...Show.result, tot: reputation(), fase: Profile.data.fasi['L1:preside'], birre: birreDelService(), note: [...document.querySelectorAll('#show-r-notes li')].map(li => li.textContent) };
    };
  });
  // A · connettore sfilato, trovato e riattaccato in fretta: +5 +3
  const A = await p.evaluate(() => __discorso((S, step) => {
    Show.guasto('mic'); step(0.3);
    Show.tocca('cavo'); step(0.2); Show.tocca('mic');            // uno alla volta: il secondo tocco non parte
    const unoAllaVolta = S.task && S.task.spot === 'cavo';
    step(1.2); const cavoOk = S.fault.stato.cavo === 'ok';
    Show.tocca('mic'); step(1.2); const trovato = S.fault.stato.mic === 'guasto';
    Show.ripara(); step(2.5);
    window.__A = { unoAllaVolta, cavoOk, trovato, risolto: !S.fault && S.guastoRapido };
  }));
  const a1 = await p.evaluate(() => window.__A);
  check(a1.unoAllaVolta && a1.cavoOk && a1.trovato && a1.risolto, 'guasto al microfono non gestito come previsto: ' + JSON.stringify(a1));
  check(A.rep === 8 && A.tot === 8, 'reputazione del discorso A sbagliata: ' + JSON.stringify({ rep: A.rep, tot: A.tot }));
  // B · cavo schiacciato, cavo nuovo collegato al CH3 e trovato tardi: +5 −2 (e sostituisce A)
  const B = await p.evaluate(() => __discorso((S, step) => {
    Show.guasto('cavo'); step(0.3);
    Show.tocca('cavo'); step(1.2); Show.ripara(); step(3.5); Show.collega(3); step(6);
    window.__B = { ancoraMuto: !!S.fault, ch: S.micCh };
    S.fad[3] = 0.55; step(2);
  }));
  const b1 = await p.evaluate(() => window.__B);
  check(b1.ancoraMuto && b1.ch === 3, 'col cavo sul CH3 a fader giù il guasto non doveva risolversi da solo: ' + JSON.stringify(b1));
  check(B.rep === 3 && B.tot === 3 && B.fase.rep === 3, 'il discorso B non prende il posto di A: ' + JSON.stringify({ rep: B.rep, tot: B.tot }));
  check(B.note.some(n => /Prende il posto del discorso precedente \(\+8/.test(n)), 'il verbale non dice che B sostituisce A');
  // C · cavo uscito dal mixer, nessuno lo trova: arriva il bidello, +5 −5
  const C = await p.evaluate(() => __discorso((S, step) => { Show.guasto('ing'); step(26); }));
  check(C.rep === 0 && C.tot === 0, 'bidello: reputazione sbagliata: ' + JSON.stringify({ rep: C.rep, tot: C.tot }));
  check(C.note.some(n => /bidello/.test(n)), 'il verbale non parla del bidello');
  // D · tocco vero sul palco: durante il guasto il dito sul microfono avvia il controllo
  const D = await p.evaluate(() => {
    Show.start(); Show.manualTime(true); const S = Show.state;
    S.events = S.events.filter(e => e.id === 'apertura'); for (let i = 0; i < 60; i++) Show.step(0.1);
    Show.guasto('mic'); Show.step(0.1);
    const r = el('#stage-wrap').getBoundingClientRect(), [x, y] = View.punto('mic');
    return { x: r.left + x, y: r.top + y };
  });
  await p.mouse.click(D.x, D.y);
  check(await p.evaluate(() => Show.state.task && Show.state.task.spot === 'mic'), 'il tocco sul microfono non avvia il controllo');
  check(await p.evaluate(() => !el('#show-fix').hidden), 'durante il controllo non compare il riquadro del lavoro');
  await p.evaluate(() => Show.exit());

  console.log('PROBLEMI:', problems);
  console.log('ERRORI JS:', errs);
  await b.close();
  const bad = problems.length || errs.length;
  console.log(bad ? 'SPETTACOLO FALLITO' : 'SPETTACOLO OK');
  process.exit(bad ? 1 : 0);
})();
