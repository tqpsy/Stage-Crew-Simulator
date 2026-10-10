/* Lo scarico come tutorial giocato a ordini (scarico.html aperto da solo):
   furgone chiuso (portellone, rampa, cinghia; i freni li toglie chi va a
   prendere il case), gli strumenti compaiono quando servono, il furgone si
   svuota dal davanti (ACCESSO BLOCCATO), Macio tira fuori il carrello a due
   ruote, i case da due li portate in due, i bauli dei cavi sono già nelle
   loro zone, e alla fine il riepilogo SCARICO COMPLETATO.

   Uso:  node tests/scarico-tutorial.js
   Richiede Playwright. Senza rete, MATTER_PATH=/percorso/matter.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const problems = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  const errs = [];
  const page = async (opts) => {
    const p = await b.newPage(opts);
    if (process.env.MATTER_PATH) await p.route('**/matter.min.js', r => r.fulfill({ path: process.env.MATTER_PATH, contentType: 'application/javascript' }));
    await p.route(/fonts\./, r => r.abort());
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.join(__dirname, '..', 'scarico.html'));
    return p;
  };

  const p = await page({ viewport: { width: 1300, height: 900 } });
  check(await p.isVisible('#btn-start'), 'manca il pulsante per aprire il portellone');
  await p.click('#btn-start');
  await p.waitForFunction(() => G && G.mode === 'play', null, { timeout: 10000 });
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const saw = re => p.waitForFunction(r => new RegExp(r).test($('#hint-txt').textContent), re.source, { timeout: 9000 }).then(() => true, () => false);
  await ev(() => {
    window.C = id => G.cases.find(x => x.def.id === id);
    window.run = (n, cond) => { for (let i = 0; i < n; i++) { stepSim(); if (cond && cond()) return i; } return -1; };
    window.ord = (w, id, zone, cart, top) => { selectWorker(w); selectCase(C(id)); if (G.sel.ce !== C(id)) return false; if (cart) toggleCart(); if (top) { startPickTop(); selectCase(C(top)); } sendTo({ zone }); return true; };
  });

  const start = await ev(() => ({ cart: !$('#h-cart').hidden, eff: !$('#h-eff-w').hidden, dmg: !$('#h-dmg-w').hidden, del: $('#h-del').textContent, hint: hintGoal,
    names: [...G.stowed, ...G.cases].map(c => c.def.name + ' ' + c.def.short).join(' ') }));
  check(!start.cart && !start.eff && !start.dmg, 'all\'inizio si vedono già strumenti che servono dopo: ' + JSON.stringify(start));
  check(start.del === '0/11', 'all\'inizio il materiale da portare non è 11 (più i 2 bauli dei cavi): ' + start.del);
  check(/PORTELLONE/.test(start.hint), 'la barra d\'aiuto non dice da dove cominciare: ' + start.hint);
  check(!/\bTOP\b|\bTop\b/.test(start.names) && /Testa 1/.test(start.names) && /Generico CORRENTE/.test(start.names) && /Generico SEGNALE/.test(start.names),
    'nomi del materiale sbagliati (TESTA, non TOP; due generici dei cavi): ' + start.names);
  // il carico: davanti il leggero, in fondo sub, teste e rack
  const load = await ev(() => { const x = id => C(id).body.position.x; return { st: x('stativi'), tav: x('tavolo'), sub: x('sub1'), testa: x('top1'), rack: x('rack') }; });
  check(load.st > load.tav && load.tav > load.testa && load.testa > load.sub && load.testa > load.rack, 'il carico del furgone non va dal leggero al pesante: ' + JSON.stringify(load));

  // furgone chiuso: portellone, rampa, cinghia, un ordine alla volta
  const van = await ev(() => {
    paused = true; const out = { locked: G.cases.filter(c => locked(c)).length, braked: G.cases.filter(c => c.brake).map(c => c.def.id).sort().join() };
    selectCase(C('stativi')); out.early = !!G.sel.ce;
    for (const what of ['doors', 'ramp', 'strap']) { out[what] = vanPending() === what; vanOrder(); run(900, () => !busy(G.player) && !G.van.anim); }
    out.open = G.van.open && G.van.ramp && !G.straps[0];
    run(240, () => !!G.trolley); out.trolley = !!G.trolley; out.chip = !$('#h-cart').hidden;
    return out;
  });
  check(van.locked >= 10 && !van.early && van.doors && van.ramp && van.strap && van.open, 'il furgone non si apre con portellone, rampa e cinghia: ' + JSON.stringify(van));
  check(van.braked === 'rack,sub1,sub2', 'i case con le ruote non hanno il freno: ' + van.braked);
  check(van.trolley && van.chip, 'Macio non tira fuori il carrello dopo la rampa: ' + JSON.stringify(van));

  // il rack sta in fondo: non si sceglie, si dice cosa c'è davanti
  const bl = await ev(() => { const r = C('rack'); const ids = blockers(r).map(c => c.def.id); selectCase(r); return { ids, sel: G.sel.ce === r, n: G.stats.blocked }; });
  bl.hint = await saw(/bloccato/i);
  check(bl.ids.length >= 3 && !bl.sel && bl.n === 1 && bl.hint, 'il rack in fondo si sceglie lo stesso: ' + JSON.stringify(bl));

  // tutto lo scarico a ordini: a mano, in due, col carrello
  const all = await ev(() => {
    const P = G.player, M = G.macio;
    G.at.telefono = 9999;
    const seq = [[P, 'stativi', 'pit'], [P, 'par', 'pit'], [M, 'ricambio', 'palco'], [P, 'tavolo', 'foh'], [P, 'valigetta', 'foh'], [M, 'distro', 'back'],
      [M, 'top1', 'pit', true, 'top2'], [P, 'sub1', 'pit'], [M, 'sub2', 'pit'], [P, 'rack', 'foh']];
    let i = 0, del2 = null, brakeOff = null, effAt = null;
    for (let n = 0; n < 60 * 400 && G.mode === 'play'; n++) {
      if (i < seq.length && n % 30 === 0) { const [w, id] = seq[i]; const ce = C(id); if (!busy(w) && (!blockers(ce).length || blockers(ce).every(x => x.job)) && ord(...seq[i])) i++; }
      stepSim();
      if (!del2 && C('par').zone === 'pit') { updateHud(); del2 = $('#h-del').textContent; }
      if (brakeOff === null && C('sub1').job && !C('sub1').brake) brakeOff = true;
      if (!effAt && !$('#h-eff-w').hidden) effAt = $('#h-eff').textContent;
    }
    return { mode: G.mode, given: i, del2, brakeOff, effAt, cartTrips: G.stats.cartTrips, cartCases: G.stats.cartCases };
  });
  check(all.given === 10 && all.mode === 'wrap', 'lo scarico a ordini non arriva in fondo: ' + JSON.stringify(all));
  check(all.del2 === '2/11', 'due case consegnati non si contano: ' + all.del2);
  check(all.brakeOff, 'il freno del sub non lo toglie chi lo va a prendere');
  check(/^(Ottimo|Buono|Sufficiente|Lento)$/.test(all.effAt || ''), 'la barra del lavoro non compare: ' + all.effAt);
  check(all.cartTrips === 1 && all.cartCases === 2, 'il viaggio col carrello non si conta: ' + JSON.stringify(all));

  // pausa finale con le zone, poi il riepilogo
  await ev(() => { paused = false; });
  await p.waitForFunction(() => G.mode === 'wrap' && G.wrap.t > 4.5, null, { timeout: 12000 }).catch(() => {});
  const w = await ev(() => ({ mode: G.mode, cx: G.cam.x, hint: $('#hint-txt').textContent, cmd: $('#cmd').hidden }));
  check(w.mode === 'wrap' && w.cx > 1200 && w.cmd && /tutto giù|possiamo cominciare/.test(w.hint), 'a materiale scaricato non c\'è la pausa con le zone: ' + JSON.stringify(w));
  await p.mouse.click(300, 300);
  await p.waitForFunction(() => G.mode === 'end', null, { timeout: 4000 }).catch(() => {});
  const end = await ev(() => ({ mode: G.mode, r: G.result, html: $('#end').innerText, li: document.querySelectorAll('#end .lavoro li').length }));
  check(end.mode === 'end' && Number.isFinite(end.r.eff) && end.r.cartTrips === 1 && end.r.cases.length === 13, 'il risultato non porta efficienza, carrello e 13 case: ' + JSON.stringify(end.r && { eff: end.r.eff, ct: end.r.cartTrips, n: end.r.cases.length }));
  check(/SCARICO COMPLETATO/.test(end.html) && /Materiale scaricato\s*11\/11/.test(end.html) && /li apri al montaggio/.test(end.html) && /Viaggi effettuati\s*\d+/.test(end.html) && /Uso del carrello\s*(corretto|non ottimale)/.test(end.html)
    && /Organizzazione/.test(end.html) && /Efficienza/.test(end.html) && /★/.test(end.html) && !/\d+%/.test(end.html)
    && /Generico SEGNALE/.test(end.html) && !/\bTOP\b|\bTop\b/.test(end.html),
    'il riepilogo dello scarico non è completo: ' + end.html.slice(0, 700));
  await p.close();

  // telefono: pulsante visibile, scena sopra la barra d'aiuto e quella degli ordini
  const m = await page({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true });
  const btn = await m.$('#btn-start'), bb = await btn.boundingBox();
  check(bb && bb.y + bb.height <= 760, 'sul telefono il pulsante per partire è fuori schermo: ' + JSON.stringify(bb));
  await m.tap('#btn-start');
  await m.waitForFunction(() => G && G.mode === 'play', null, { timeout: 10000 });
  const lay = await m.evaluate(() => {
    const cv = $('#cv').getBoundingClientRect(), hb = $('#hintbar').getBoundingClientRect(), cmd = $('#cmd').getBoundingClientRect();
    return { cvBottom: cv.bottom, hbTop: hb.top, hbBottom: hb.bottom, cmdTop: cmd.top, cmdBottom: cmd.bottom, pad: !!document.querySelector('#pad'), keys: $('#keys').hidden };
  });
  check(lay.cvBottom <= lay.hbTop + 1 && lay.hbBottom <= lay.cmdTop + 1 && lay.cmdBottom <= 761 && !lay.pad && lay.keys,
    'sul telefono la scena finisce sotto le barre o c\'è ancora il joystick: ' + JSON.stringify(lay));
  await m.close();

  console.log('PROBLEMI:', JSON.stringify(problems, null, 1));
  console.log('ERRORI JS:', errs);
  await b.close();
  const ok = !problems.length && !errs.length;
  console.log(ok ? 'SCARICO TUTORIAL OK' : 'SCARICO TUTORIAL FALLITO');
  process.exit(ok ? 0 : 1);
})();
