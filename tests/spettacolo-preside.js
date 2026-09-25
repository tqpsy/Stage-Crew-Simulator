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
      return { t: Show.state.t, sw: document.documentElement.scrollWidth, bub: [...document.querySelectorAll('.bub')].map(x => { const q = x.getBoundingClientRect(); return [q.left - wrap.left, q.right - wrap.left, wrap.width]; }) };
    });
    check(r.sw <= W, 'scorrimento orizzontale a t=' + r.t.toFixed(0));
    r.bub.forEach(([l, rr, w]) => { bubblesSeen++; check(l >= 0 && rr <= w + 1, 'fumetto fuori dal palco a t=' + r.t.toFixed(0)); });
  }
  check(bubblesSeen > 0, 'nessun fumetto visto durante il discorso');
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

  console.log('PROBLEMI:', problems);
  console.log('ERRORI JS:', errs);
  await b.close();
  const bad = problems.length || errs.length;
  console.log(bad ? 'SPETTACOLO FALLITO' : 'SPETTACOLO OK');
  process.exit(bad ? 1 : 0);
})();
