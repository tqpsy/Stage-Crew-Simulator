/* La vita del cortile nello scarico: i bambini e Gerry (il bidello col
   carrello delle pulizie) non spingono contro gli ostacoli e non costringono
   il tecnico a girargli intorno.
   A  bambino con un case a terra sulla strada: rallenta, gira di lato, arriva
   B  le mete dei bambini non sono mai dentro panchina, moka o un case
   C  bambino fermo sulla corsia: si sposta quando arrivi col case in mano
   D  Gerry con un case sulla sua strada: si ferma, si sposta di lato, passa
   E  Gerry col tecnico fermo davanti: non lo spinge via
   F  Gerry e il carrello a due ruote: non ci passa attraverso

   Uso:  node tests/scarico-npc.js
   Richiede Playwright. Senza rete, MATTER_PATH=/percorso/matter.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const problems = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  const errs = [];
  const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
  if (process.env.MATTER_PATH) await p.route('**/matter.min.js', r => r.fulfill({ path: process.env.MATTER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'scarico.html'));
  await p.click('#btn-start');
  await p.waitForFunction(() => G && G.mode === 'play', null, { timeout: 10000 });
  const ev = (fn, arg) => p.evaluate(fn, arg);

  // passi fissi, joystick finto, tutto il furgone aperto; bambini e Gerry li mettiamo noi
  await ev(() => {
    paused = true;
    window.C = id => G.cases.find(x => x.def.id === id);
    window.run = (n, dir, each) => { inp.stick = dir || { x: 0, y: 0 }; for (let i = 0; i < n; i++) { stepSim(); if (each) each(i); } inp.stick = { x: 0, y: 0 }; };
    window.put = (x, y, f) => { const w = G.player; Matter.Body.setPosition(w.body, { x, y }); Matter.Body.setVelocity(w.body, { x: 0, y: 0 }); w.vel = { x: 0, y: 0 }; if (f !== undefined) w.facing = f; };
    window.moveCase = (ce, x, y, a) => { Matter.Body.setPosition(ce.body, { x, y }); Matter.Body.setAngle(ce.body, a || 0); };
    window.depth = (a, o) => { const c = Matter.Collision.collides(a, o); return c ? c.depth : 0; };
    window.away = () => { for (const k of G.kids) { Matter.Body.setPosition(k.body, { x: 1800, y: 820 }); Matter.Body.setVelocity(k.body, { x: 0, y: 0 }); k.target = { x: 1800, y: 820 }; k.wait = 999; k.block = 0; } };
    window.kidAt = (k, x, y, tx, ty) => { Matter.Body.setPosition(k.body, { x, y }); Matter.Body.setVelocity(k.body, { x: 0, y: 0 }); k.target = { x: tx, y: ty }; k.wait = 0; k.block = 0; };
    // senza il cambio di meta a caso (0,2% a passo): così si misura solo l'ostacolo
    window.steady = fn => { const r0 = Math.random; Math.random = () => 0.002 + r0() * 0.998; try { return fn(); } finally { Math.random = r0; } };
    window.gerry = () => { G.events.bidello = false; G.at.bidello = 0; scriptEvents(); G.at.bidello = 9999; return G.cart; };
    G.van.open = true; G.van.ramp = true; G.van.rampK = 1; G.doorsOpen = 1; G.van.anim = null;
    Matter.Composite.remove(G.world, G.doorWall); G.statics = G.statics.filter(s => s !== G.doorWall);
    G.straps.forEach((_, i) => { G.straps[i] = false; }); for (const c of G.cases) c.brake = false;
    macio('phone'); G.macio.ai.t = -999; Matter.Body.setPosition(G.macio.body, { x: 1700, y: 300 });
    G.at = { passante1: 9999, bidello: 9999, telefono: 9999, passante2: 9999 };
    away(); put(1700, 700);
  });

  /* ---- A: un case a terra fra il bambino e la sua meta ---- */
  const A = await ev(() => {
    const k = G.kids[0], ce = C('distro'); moveCase(ce, 950, 500);
    const c0 = { x: ce.body.position.x, y: ce.body.position.y };
    kidAt(k, 880, 500, 1050, 500);
    let push = 0, arrived = -1;
    steady(() => run(600, null, i => {
      if (Matter.Collision.collides(k.body, ce.body)) push++;
      if (arrived < 0 && k.body.position.x > 1000) arrived = i;
    }));
    const moved = Math.hypot(ce.body.position.x - c0.x, ce.body.position.y - c0.y);
    moveCase(ce, 1700, 450); away();
    return { push, arrived, moved };
  });
  check(A.push < 30 && A.arrived >= 0 && A.arrived < 360 && A.moved < 1, 'A: il bambino spinge contro il case invece di girarci intorno: ' + JSON.stringify(A));

  /* ---- B: le mete dei bambini ---- */
  const B = await ev(() => {
    const k = G.kids[0], ce = C('distro'); moveCase(ce, 1000, 700);
    const bench = G.statics.find(s => s.bounds.min.x === BENCH.x && s.bounds.min.y === BENCH.y);
    const blocks = [bench, ce.body, ...G.statics.filter(s => s.bounds.min.x > DOOR_X + 10 && s.bounds.max.x < GYM_X - 15 && s.bounds.min.y > 95 && s.bounds.max.y < 905)];
    const probe = Matter.Bodies.circle(0, 0, 13);
    let bad = 0, n = 0;
    kidAt(k, 900, 400, 900, 400);
    for (let i = 0; i < 400; i++) {
      k.target = { x: k.body.position.x, y: k.body.position.y }; k.wait = 0;
      updateKids(1 / 60); n++;
      Matter.Body.setPosition(probe, k.target);
      if (blocks.some(o => o && depth(probe, o) > 2)) bad++;
    }
    moveCase(ce, 1700, 450); away();
    return { bad, n };
  });
  check(B.bad === 0, 'B: mete dei bambini dentro panchina, moka o case: ' + JSON.stringify(B));

  /* ---- C: col case in mano verso un bambino fermo sulla corsia ---- */
  const C2 = await ev(() => {
    const k = G.kids[0], ce = C('stativi');
    kidAt(k, 1030, 500, 1030, 500); k.wait = 99;
    moveCase(ce, 900, 500, 0); put(900 - ce.def.w / 2 - 23, 500, 0);
    pressGrab(); const held = G.player.grab === ce;
    const h0 = G.kidHits; let stuck = 0, minGap = 99;
    run(150, { x: 1, y: 0 }, () => {
      if (G.player.spd < 0.5) stuck++;
      minGap = Math.min(minGap, Matter.Collision.collides(k.body, ce.body) ? 0 : 99);
    });
    const out = { held, x: Math.round(G.player.body.position.x), stuck, hits: G.kidHits - h0, touched: minGap === 0 };
    release(G.player); moveCase(ce, 1700, 380); away(); put(1700, 700);
    return out;
  });
  check(C2.held && C2.x > 1080 && C2.hits === 0 && C2.stuck < 20, 'C: il bambino non si sposta davanti a chi porta un case: ' + JSON.stringify(C2));

  /* ---- D: Gerry con un case a terra sulla sua strada ---- */
  const D = await ev(() => {
    const ce = C('distro'); moveCase(ce, 1010, 520);
    const c0 = { x: ce.body.position.x, y: ce.body.position.y };
    const g = gerry(); let maxD = 0, waited = 0, i = 0;
    while (G.cart && i < 1800) { run(1); i++; if (G.cart) { maxD = Math.max(maxD, depth(g.body, ce.body)); if (len(g.body.velocity) < 0.1) waited++; } }
    const moved = Math.hypot(ce.body.position.x - c0.x, ce.body.position.y - c0.y);
    const out = { gone: !G.cart, frames: i, maxD: Math.round(maxD * 10) / 10, waited, moved: Math.round(moved), y: g.body.position.y > 870 };
    if (G.cart) { Matter.Composite.remove(G.world, G.cart.body); G.cart = null; }
    moveCase(ce, 1700, 450);
    return out;
  });
  check(D.gone && D.y && D.maxD < 2 && D.moved < 1 && D.waited < 600, 'D: Gerry resta incastrato o passa attraverso il case: ' + JSON.stringify(D));

  /* ---- E: il tecnico fermo sulla strada di Gerry ---- */
  const E = await ev(() => {
    put(1010, 420); const p0 = { x: 1010, y: 420 };
    const g = gerry(); let maxShift = 0, i = 0;
    while (G.cart && i < 1800) {
      run(1); i++;
      maxShift = Math.max(maxShift, Math.hypot(G.player.body.position.x - p0.x, G.player.body.position.y - p0.y));
    }
    const out = { gone: !G.cart, frames: i, maxShift: Math.round(maxShift), y: g.body.position.y > 870 };
    if (G.cart) { Matter.Composite.remove(G.world, G.cart.body); G.cart = null; }
    put(1700, 700);
    return out;
  });
  check(E.gone && E.y && E.maxShift < 4, 'E: Gerry spinge via il tecnico o non passa: ' + JSON.stringify(E));

  /* ---- F: il carrello a due ruote parcheggiato sulla strada di Gerry ---- */
  const F = await ev(() => {
    if (!G.trolley) spawnTrolley();
    const t = G.trolley; Matter.Body.setPosition(t.body, { x: 1010, y: 650 }); Matter.Body.setAngle(t.body, 0);
    const g = gerry(); let maxD = 0, i = 0;
    while (G.cart && i < 1800) { run(1); i++; if (G.cart) maxD = Math.max(maxD, depth(g.body, t.body)); }
    const out = { gone: !G.cart, frames: i, maxD: Math.round(maxD * 10) / 10 };
    if (G.cart) { Matter.Composite.remove(G.world, G.cart.body); G.cart = null; }
    return out;
  });
  check(F.gone && F.maxD < 2, 'F: Gerry passa attraverso il carrello o resta fermo: ' + JSON.stringify(F));

  console.log('A', JSON.stringify(A)); console.log('B', JSON.stringify(B)); console.log('C', JSON.stringify(C2));
  console.log('D', JSON.stringify(D)); console.log('E', JSON.stringify(E)); console.log('F', JSON.stringify(F));
  console.log('PROBLEMI:', JSON.stringify(problems, null, 1));
  console.log('ERRORI JS:', errs);
  await b.close();
  const ok = !problems.length && !errs.length;
  console.log(ok ? 'OK cortile dello scarico: bambini e Gerry si adattano agli ostacoli' : 'CORTILE DELLO SCARICO FALLITO');
  process.exit(ok ? 0 : 1);
})();
