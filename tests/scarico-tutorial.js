/* Lo scarico come tutorial giocato (scarico.html aperto da solo): furgone
   chiuso (portellone, rampa, cinghie, freni), i comandi compaiono quando
   servono, il furgone si svuota dal davanti (ACCESSO BLOCCATO), Macio tira
   fuori il carrello a due ruote (tre posti, un pesante ne prende due), i
   case da due non si muovono da soli e si chiama Macio, il fragile
   sbattuto costa reputazione, e alla fine il riepilogo SCARICO COMPLETATO.

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
  // un avviso nella barra d'aiuto (gli avvisi vicini si mettono in fila)
  const saw = re => p.waitForFunction(r => new RegExp(r).test($('#hint-txt').textContent), re.source, { timeout: 9000 }).then(() => true, () => false);
  // aiutanti: case per id, giocatore (e quello che ha in mano) spostato di peso
  await ev(() => {
    window.C = id => G.cases.find(x => x.def.id === id);
    window.moveTo = (x, y) => {
      const P = G.player; Matter.Body.setPosition(P.body, { x, y }); Matter.Body.setVelocity(P.body, { x: 0, y: 0 });
      if (P.grab && P.mode === 'carry') {
        const f = { x: Math.cos(P.facing), y: Math.sin(P.facing) };
        Matter.Body.setPosition(P.grab.body, { x: x + f.x * P.carry.dist, y: y + f.y * P.carry.dist }); Matter.Body.setVelocity(P.grab.body, { x: 0, y: 0 });
      }
    };
    window.besideOf = (ce, side) => { const b = ce.body.bounds; return side === 'right' ? { x: b.max.x + 17, y: ce.body.position.y } : { x: ce.body.position.x, y: b.max.y + 17 }; };
    macio('phone'); G.macio.ai.t = -999;   // Macio fermo: lo chiamiamo noi
  });

  const start = await ev(() => ({ help: !document.querySelector('#keys [data-k="help"]').hidden, cart: !$('#h-cart').hidden, eff: !$('#h-eff-w').hidden,
    dmg: !$('#h-dmg-w').hidden, del: $('#h-del').textContent, hint: hintGoal, names: G.cases.map(c => c.def.name + ' ' + c.def.short).join(' ') }));
  check(!start.help && !start.cart && !start.eff && !start.dmg, 'all\'inizio si vedono già comandi o strumenti che servono dopo: ' + JSON.stringify(start));
  check(start.del === '0/13', 'all\'inizio il materiale da scaricare non è 13: ' + start.del);
  check(/portellone/.test(start.hint), 'la barra d\'aiuto non dice da dove cominciare: ' + start.hint);
  check(!/\bTOP\b|\bTop\b/.test(start.names) && /Testa 1/.test(start.names) && /Generico CORRENTE/.test(start.names) && /Generico SEGNALE/.test(start.names),
    'nomi del materiale sbagliati (TESTA, non TOP; due generici dei cavi): ' + start.names);
  // il carico come da specifica: davanti i generici, in fondo sub, teste e rack
  const load = await ev(() => { const x = id => C(id).body.position.x; return { cor: x('corrente'), seg: x('segnale'), tav: x('tavolo'), sub: x('sub1'), testa: x('top1'), rack: x('rack') }; });
  check(load.cor > load.tav && load.seg > load.tav && load.tav > load.testa && load.tav > load.sub && load.tav > load.rack, 'il carico del furgone non va dal leggero al pesante: ' + JSON.stringify(load));

  // furgone chiuso: APRI il portellone, giù la RAMPA, poi cinghie e freni
  const van0 = await ev(() => { moveTo(DOOR_X + 40, 500); const a = vanAction(G.player); pressGrab(); return { a, grab: !!G.player.grab, statics: G.cases.filter(c => c.body.isStatic).length }; });
  await p.waitForFunction(() => G.van.open, null, { timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(200);
  const van1 = await ev(() => ({ a: vanAction(G.player), lab: $('#b-grab').textContent + ' ' + (document.querySelector('#keys [data-k="grab"]') || {}).textContent }));
  await ev(() => pressGrab());
  await p.waitForFunction(() => G.van.ramp, null, { timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(1600);   // il case accessori scivola giù dalla rampa
  const van2 = await ev(() => {
    const c = C('stativi'), at = besideOf(c, 'right'); moveTo(at.x, at.y);
    const a = vanAction(G.player); pressGrab();
    return { ramp: G.van.ramp, a, grab: !!G.player.grab, strap: strapOn(c), free: !c.body.isStatic };
  });
  check(van0.a === 'doors' && !van0.grab && van0.statics >= 12 && van1.a === 'ramp' && /RAMPA/.test(van1.lab) && van2.ramp && van2.a === 'strap' && !van2.grab && !van2.strap && van2.free,
    'il furgone non si apre con portellone, rampa e cinghie: ' + JSON.stringify([van0, van1, van2]));
  // Macio tira fuori il carrello a due ruote
  await p.waitForFunction(() => !!G.trolley, null, { timeout: 5000 }).catch(() => {});
  const tr = await ev(() => ({ t: !!G.trolley, chip: !$('#h-cart').hidden }));
  check(tr.t && tr.chip, 'Macio non tira fuori il carrello dopo la rampa: ' + JSON.stringify(tr));
  const van3 = await ev(() => {
    const out = { braked: G.cases.filter(c => c.brake).map(c => c.def.id).sort().join() };
    G.straps.forEach((_, i) => releaseStrap(i)); for (const c of G.cases) releaseBrake(c);
    out.statics = G.cases.filter(c => c.body.isStatic && !c.hidden).map(c => c.def.id);
    return out;
  });
  check(van3.braked === 'corrente,rack,segnale,sub1,sub2' && !van3.statics.length, 'freni o cinghie non si tolgono: ' + JSON.stringify(van3));

  // ordine: il rack sta in fondo, dietro testa, tavolo, quadro e generico
  const bl = await ev(() => {
    const r = C('rack'), at = besideOf(r, 'right'); moveTo(at.x - 30, at.y);   // allungando il braccio fra i case
    const ids = blockers(r).map(c => c.def.id);
    G.player.grab = null; grab(G.player, r);
    return { ids, grabbed: G.player.grab === r, flash: G.blockFlash && G.blockFlash.ids.length, n: G.stats.blocked };
  });
  bl.hint = await saw(/bloccato/i);
  check(bl.ids.includes('top1') && bl.ids.includes('tavolo') && !bl.grabbed && bl.flash >= 2 && bl.n === 1 && bl.hint,
    'il rack in fondo si prende lo stesso: ' + JSON.stringify(bl));

  // due case a mano nel Pit
  const deliver = (id, x, y) => ev(([id, x, y]) => {
    const c = C(id), at = besideOf(c, 'right'); moveTo(at.x, at.y);
    pressGrab(); const ok = G.player.grab === c;
    G.player.facing = 0; moveTo(x, y); pressGrab();
    return ok;
  }, [id, x, y]);
  check(await deliver('stativi', 1510, 230), 'la borsa stativi davanti non si prende');
  await p.waitForTimeout(500);
  check(await deliver('par', 1510, 330), 'il case PAR davanti non si prende');
  await p.waitForTimeout(600);
  check(await ev(() => $('#h-del').textContent) === '2/13', 'due case consegnati a mano non si contano');

  // carrello: il generico CORRENTE spinto sopra (un pesante, due posti) e il case accessori
  const cart = await ev(() => {
    const t = G.trolley, out = {};
    Matter.Body.setPosition(t.body, { x: 600, y: 650 }); Matter.Body.setAngle(t.body, 0); Matter.Body.setVelocity(t.body, { x: 0, y: 0 });
    const cor = C('corrente');
    Matter.Body.setPosition(cor.body, { x: 600, y: 758 }); Matter.Body.setVelocity(cor.body, { x: 0, y: 0 });
    moveTo(600, 692); G.player.facing = Math.PI / 2;
    pressGrab(); out.pushing = G.player.grab === cor && G.player.mode;
    pressGrab();
    const r = C('ricambio'); Matter.Body.setPosition(r.body, { x: 480, y: 650 }); Matter.Body.setAngle(r.body, 0); Matter.Body.setVelocity(r.body, { x: 0, y: 0 });
    moveTo(480 + 20 + 17, 650); pressGrab(); out.carry = G.player.grab === r;
    moveTo(t.body.position.x - 50, t.body.position.y); G.player.facing = 0; pressGrab();
    out.load = t.load.map(c => c.def.id);
    pressGrab(); out.push = G.player.grab === t;
    return out;
  });
  await p.waitForTimeout(300);
  cart.chip = await ev(() => $('#h-cart').innerText.replace(/\s+/g, ' ').toUpperCase());
  check(cart.pushing === 'push' && cart.load.join() === 'corrente,ricambio' && cart.chip === 'CARRELLO 3/3' && cart.push,
    'il carrello a due ruote non si carica o non si spinge: ' + JSON.stringify(cart));
  await ev(() => { const t = G.trolley; Matter.Body.setPosition(t.body, { x: 1230, y: 330 }); moveTo(1230, 390); });
  await p.waitForTimeout(300);
  const un = await ev(() => {
    const t = G.trolley; pressGrab();       // lascia il carrello
    pressGrab();                            // sei in Backstage: scarica il generico CORRENTE
    const first = G.player.grab && G.player.grab.def.id;
    pressGrab();
    Matter.Body.setPosition(C('corrente').body, { x: 1225, y: 215 }); Matter.Body.setVelocity(C('corrente').body, { x: 0, y: 0 });
    moveTo(1230, 390); G.player.facing = -Math.PI / 2; pressGrab();          // ora gli accessori
    const second = G.player.grab && G.player.grab.def.id;
    G.player.facing = 0; moveTo(1360, 420); pressGrab();                      // sul palco
    return { first, second, load: t.load.length, cartTrips: G.stats.cartTrips, cartCases: G.stats.cartCases };
  });
  await p.waitForTimeout(600);
  const un2 = await ev(() => ({ cor: C('corrente').zone, ric: C('ricambio').zone }));
  check(un.first === 'corrente' && un.second === 'ricambio' && un.load === 0 && un.cartTrips === 1 && un.cartCases === 2 && un2.cor === 'back' && un2.ric === 'palco',
    'dal carrello non si scarica nelle zone: ' + JSON.stringify(un) + JSON.stringify(un2));

  // case da due (il tavolo regia): da solo non si muove, poi arriva Macio
  const solo = await ev(() => {
    macio('idle'); G.macio.ai.t = -999;   // non viene da solo: lo chiamiamo con AIUTO
    const c = C('tavolo');
    Matter.Body.setPosition(c.body, { x: 700, y: 330 }); Matter.Body.setVelocity(c.body, { x: 0, y: 0 });
    const at = besideOf(c, 'right'); moveTo(at.x, at.y);
    window.x0 = c.body.position.x;
    pressGrab();
    inp.keys.add('KeyA');
    return { grabbed: G.player.grab === c };
  });
  await p.waitForTimeout(2800);
  const solo2 = await ev(() => { inp.keys.delete('KeyA'); const c = C('tavolo'); return { moved: Math.abs(c.body.position.x - x0), solo: G.stats.solo,
    help: !document.querySelector('#keys [data-k="help"]').hidden, lift: !document.querySelector('#keys [data-k="lift"]').hidden }; });
  solo2.hint = await saw(/2 PERSONE/);
  check(solo.grabbed && solo2.help && !solo2.lift && solo2.moved < 25 && solo2.solo === 1 && solo2.hint,
    'il case da due si muove da solo o non chiede il collega: ' + JSON.stringify(solo) + JSON.stringify(solo2));
  await ev(() => { Matter.Body.setPosition(G.macio.body, { x: 700, y: 200 }); pressHelp(); });
  await p.waitForFunction(() => G.macio.grab === C('tavolo'), null, { timeout: 8000 }).catch(() => {});
  const team = await ev(() => ({ team: G.team, macio: G.macio.grab && G.macio.grab.def.id, pushers: C('tavolo').grabbers.length }));
  check(team.team && team.macio === 'tavolo' && team.pushers === 2, 'Macio non arriva a spingere il tavolo: ' + JSON.stringify(team));
  await ev(() => { for (const w of G.workers) release(w); });

  // Macio libero dà una mano da solo quando spingi un case pesante
  await ev(() => {
    macio('idle'); const c = C('sub1');
    Matter.Body.setPosition(c.body, { x: 700, y: 620 }); Matter.Body.setVelocity(c.body, { x: 0, y: 0 });
    const at = besideOf(c, 'right'); moveTo(at.x, at.y); pressGrab();
  });
  await p.waitForFunction(() => G.macio.ai.state === 'help' || G.macio.grab === C('sub1'), null, { timeout: 4000 }).catch(() => {});
  const auto = await ev(() => ({ st: G.macio.ai.state, g: G.macio.grab && G.macio.grab.def.id, mine: G.player.grab && G.player.grab.def.id }));
  check(auto.mine === 'sub1' && (auto.st === 'help' || auto.g === 'sub1'), 'Macio non aiuta da solo col sub: ' + JSON.stringify(auto));
  await ev(() => { for (const w of G.workers) release(w); macio('phone'); G.macio.ai.t = -999; });

  // gradino della palestra: il case si ferma, compare OH-ISSA; un tocco e Macio conta, il case passa
  await ev(() => {
    const c = C('sub2');
    Matter.Body.setPosition(c.body, { x: GYM_X - 60, y: 500 }); Matter.Body.setAngle(c.body, 0); Matter.Body.setVelocity(c.body, { x: 0, y: 0 });
    moveTo(GYM_X - 60 - 35 - 17, 500); G.player.facing = 0;
    pressGrab(); inp.keys.add('KeyD');
  });
  await p.waitForFunction(() => !document.querySelector('#keys [data-k="lift"]').hidden, null, { timeout: 5000 }).catch(() => {});
  const st1 = await ev(() => ({ lift: !document.querySelector('#keys [data-k="lift"]').hidden, x: C('sub2').body.position.x, grab: G.player.grab && G.player.grab.def.id }));
  await ev(() => pressLift());
  await p.waitForTimeout(2600);
  const st2 = await ev(() => { inp.keys.delete('KeyD'); const x = C('sub2').body.position.x; return { x, qte: !!G.qte }; });
  check(st1.lift && st1.x < 1160 && st2.x > 1160 && !st2.qte, 'OH-ISSA al gradino non va con un tocco: ' + JSON.stringify([st1, st2]));
  await ev(() => { for (const w of G.workers) release(w); });

  // fragile sbattuto: movimentazione brusca, −1 reputazione
  const rough = await ev(() => {
    G.stats.rough = 0; G.stats.hits = 0;   // si conta da qui
    const v = C('valigetta');
    hitCase(v, null, 6, G.statics[0]);
    return { rough: G.stats.rough };
  });
  rough.hint = await saw(/Movimentazione brusca.*reputazione/);
  check(rough.rough === 1 && rough.hint, 'il fragile sbattuto non si fa notare: ' + JSON.stringify(rough));
  await p.waitForTimeout(300);
  check(await ev(() => !$('#h-dmg-w').hidden), 'dopo il primo danno non compare il contatore dei danni');

  // efficienza: compare a metà
  await ev(() => { G.t = Math.max(G.t, 171); });
  await p.waitForTimeout(400);
  const eff = await ev(() => ({ shown: !$('#h-eff-w').hidden, txt: $('#h-eff').textContent }));
  check(eff.shown && /^(Ottimo|Buono|Sufficiente)$/.test(eff.txt), 'la barra del lavoro non compare: ' + JSON.stringify(eff));

  // tutto il resto al suo posto: 100%, pausa con Macio, poi il riepilogo
  await ev(() => {
    for (const w of G.workers) release(w);
    moveTo(700, 500);
    const spots = { distro: [1225, 330, 0], tavolo: [1320, 710, 0], rack: [1400, 620, 0], valigetta: [1400, 700, 0], segnale: [1455, 720, 0],
      sub1: [1550, 400, 0], sub2: [1550, 480, 0], top1: [1550, 560, 0], top2: [1550, 620, 0] };
    for (const id in spots) {
      const [x, y, r] = spots[id], c = C(id);
      Matter.Body.setPosition(c.body, { x, y }); Matter.Body.setAngle(c.body, r * Math.PI / 2); Matter.Body.setVelocity(c.body, { x: 0, y: 0 });
    }
  });
  const done = await p.waitForFunction(() => G.surprise, null, { timeout: 6000 }).then(() => true, () => false);
  // pausa finale: la telecamera va sulle zone, Macio guarda il materiale; un tocco la accorcia
  await p.waitForFunction(() => G.mode === 'wrap' && G.wrap.t > 4.5, null, { timeout: 12000 }).catch(() => {});
  const w = await ev(() => ({ mode: G.mode, cx: G.cam.x, hint: $('#hint-txt').textContent, out: G.cases.filter(c => c.zone !== c.def.zone).map(c => c.def.id + ':' + c.zone) }));
  check(done && w.mode === 'wrap' && w.cx > 1200 && /tutto giù|possiamo cominciare/.test(w.hint), 'a materiale scaricato non c\'è la pausa con le zone: ' + JSON.stringify(w));
  await p.mouse.click(300, 300);
  await p.waitForFunction(() => G.mode === 'end', null, { timeout: 3000 }).catch(() => {});
  const end = await ev(() => ({ mode: G.mode, r: G.result, html: $('#end').innerText, li: document.querySelectorAll('#end .lavoro li').length }));
  check(end.mode === 'end' && Number.isFinite(end.r.eff) && end.r.rough === 1 && end.r.cartTrips === 1, 'il risultato non porta efficienza e movimentazioni: ' + JSON.stringify(end.r));
  check(/SCARICO COMPLETATO/.test(end.html) && /Materiale scaricato\s*13\/13/.test(end.html) && /Viaggi effettuati\s*\d+/.test(end.html) && /Uso del carrello\s*(corretto|non ottimale)/.test(end.html)
    && /Organizzazione/.test(end.html) && /Efficienza/.test(end.html) && /★/.test(end.html) && !/\d+%/.test(end.html)
    && /Generico SEGNALE in Off Stage/.test(end.html) && /movimentazione brusca/i.test(end.html) && end.li === 3 && !/\bTOP\b|\bTop\b/.test(end.html),
    'il riepilogo dello scarico non è completo: ' + end.html.slice(0, 600));
  await p.close();

  // telefono: cartello d'arrivo corto, pulsante visibile, scena sopra i comandi
  const m = await page({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true });
  const btn = await m.$('#btn-start'), bb = await btn.boundingBox();
  check(bb && bb.y + bb.height <= 760, 'sul telefono il pulsante per partire è fuori schermo: ' + JSON.stringify(bb));
  await m.tap('#btn-start');
  await m.waitForFunction(() => G && G.mode === 'play', null, { timeout: 10000 });
  const lay = await m.evaluate(() => {
    const cv = $('#cv').getBoundingClientRect(), hb = $('#hintbar').getBoundingClientRect(), pad = $('#pad').getBoundingClientRect();
    return { cvBottom: cv.bottom, hbTop: hb.top, hbBottom: hb.bottom, padTop: pad.top, help: $('#b-help').hidden, grab: !$('#b-grab').hidden, keys: $('#keys').hidden };
  });
  check(lay.cvBottom <= lay.hbTop + 1 && lay.hbBottom <= lay.padTop + 1 && lay.help && lay.grab && lay.keys,
    'sul telefono la scena finisce sotto la barra o i comandi, o ci sono comandi in più: ' + JSON.stringify(lay));
  await m.close();

  console.log('PROBLEMI:', JSON.stringify(problems, null, 1));
  console.log('ERRORI JS:', errs);
  await b.close();
  const ok = !problems.length && !errs.length;
  console.log(ok ? 'SCARICO TUTORIAL OK' : 'SCARICO TUTORIAL FALLITO');
  process.exit(ok ? 0 : 1);
})();
