/* La fisica dello scarico (scarico.html): persone, case presi, carrello e
   carico in un sistema solo (la PRESA). Si gioca passo per passo col
   joystick finto e si misura:
   A personaggio: parte e si ferma subito, cambia direzione, passa la porta,
     contro il muro si ferma senza rimbalzare, i case a terra non si spostano
   B case in mano: sta sempre alla stessa distanza e angolo, si ferma con te,
     lasciato resta lì, contro il muro non ci entra e non salta
   C carrello: si prende, si spinge, si tira, gira, si ferma, si lascia
   D case sul carrello: carica, va col carrello, gira, si ferma, si scarica
   E furgone: entri nel vano dalla rampa, prendi, esci, vai in palestra,
     col carrello passi la porta senza incastrarti
   F tavolo regia in due con Macio: porta, gradino (OH-ISSA), Off Stage

   Uso:  node tests/scarico-fisica.js
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

  // il gioco va avanti solo quando lo diciamo noi: passi fissi, joystick finto
  await ev(() => {
    paused = true;
    window.C = id => G.cases.find(x => x.def.id === id);
    window.P = () => G.player;
    window.pos = b => ({ x: b.position.x, y: b.position.y });
    window.run = (n, dir, each) => { inp.stick = dir || { x: 0, y: 0 }; for (let i = 0; i < n; i++) { stepSim(); if (each) each(i); } inp.stick = { x: 0, y: 0 }; };
    window.put = (x, y, f) => { const w = G.player; Matter.Body.setPosition(w.body, { x, y }); Matter.Body.setVelocity(w.body, { x: 0, y: 0 }); w.vel = { x: 0, y: 0 }; if (f !== undefined) w.facing = f; };
    window.moveCase = (ce, x, y, a) => { Matter.Body.setPosition(ce.body, { x, y }); Matter.Body.setAngle(ce.body, a || 0); };
    // davanti al case, dal lato sinistro, a contatto
    window.leftOf = ce => ({ x: ce.body.bounds.min.x - G.player.r - 4, y: ce.body.position.y });
    // furgone aperto, rampa giù, niente cinghie né freni, Macio al telefono, niente bambini in mezzo
    G.van.open = true; G.van.ramp = true; G.van.rampK = 1; G.doorsOpen = 1; G.van.anim = null;
    Matter.Composite.remove(G.world, G.doorWall); G.statics = G.statics.filter(s => s !== G.doorWall);
    G.straps.forEach((_, i) => { G.straps[i] = false; }); for (const c of G.cases) c.brake = false;
    macio('phone'); G.macio.ai.t = -999;
    for (const k of G.kids) { Matter.Body.setPosition(k.body, { x: 1800, y: 820 }); k.target = { x: 1800, y: 820 }; k.wait = 999; }
    window.initOverlap = G.cases.filter(c => overlap(c.body, [...G.statics.filter(s => s !== G.stepBody), ...G.cases.filter(o => o !== c).map(o => o.body)])).map(c => c.def.id);
    G.at = { passante1: 9999, bidello: 9999, telefono: 9999, passante2: 9999 };
  });

  const io = await ev(() => initOverlap);
  check(!io.length, 'case che all\'inizio entrano nei muri o in altri case: ' + io.join());

  /* ---- A: personaggio ---- */
  const A = await ev(() => {
    put(950, 500, 0);
    const sp = []; run(30, { x: 1, y: 0 }, () => sp.push(P().spd));
    const acc = sp.findIndex(s => s > P().vmax * 0.95);
    const x0 = P().body.position.x; const st = []; run(20, null, () => st.push(P().spd));
    const stopN = st.findIndex(s => s < 0.05), glide = P().body.position.x - x0;
    // giro di 180°: in pochi passi va dall'altra parte
    run(30, { x: 1, y: 0 }); const rv = []; run(20, { x: -1, y: 0 }, () => rv.push(P().body.velocity.x));
    const rev = rv.findIndex(v => v < -1);
    // contro il recinto in alto: si ferma lì, niente rimbalzo né compenetrazione
    put(950, 160); const ys = []; run(80, { x: 0, y: -1 }, () => ys.push(P().body.position.y));
    const wallY = 92 + P().r, minY = Math.min(...ys); run(20); const back = P().body.position.y - ys[ys.length - 1];
    // lungo il muro: spinge in diagonale e scivola di lato
    const xs0 = P().body.position.x; run(30, { x: 0.7, y: -0.7 }); const slide = P().body.position.x - xs0;
    // la porta della palestra (gradino compreso)
    put(GYM_X - 120, 500); run(120, { x: 1, y: 0 }); const inGym = P().body.position.x > GYM_X + 60;
    // un case a terra non si sposta se ci vai contro o ci giri attorno
    const ce = C('distro'); moveCase(ce, 950, 700); const c0 = pos(ce.body);
    put(890, 700); run(40, { x: 1, y: 0 }); run(60, { x: 0, y: 1 }); run(40, { x: 1, y: 0 }); run(60, { x: 0, y: -1 });
    const moved = Math.hypot(ce.body.position.x - c0.x, ce.body.position.y - c0.y);
    return { acc, stopN, glide, rev, minY, wallY, back, slide, inGym, moved };
  });
  check(A.acc >= 2 && A.acc <= 10, 'A: la partenza non è fluida né rapida (passi per arrivare a pieno: ' + A.acc + ')');
  check(A.stopN >= 1 && A.stopN <= 6 && A.glide < 12, 'A: si ferma scivolando: ' + JSON.stringify(A));
  check(A.rev >= 1 && A.rev <= 10, 'A: cambio di direzione lento o a scatto: ' + A.rev);
  check(A.minY > A.wallY - 2 && Math.abs(A.back) < 0.5, 'A: contro il muro entra o rimbalza: ' + JSON.stringify(A));
  check(A.slide > 20, 'A: contro il muro in diagonale non scivola di lato: ' + A.slide);
  check(A.inGym, 'A: non passa dalla porta della palestra');
  check(A.moved < 0.5, 'A: girando attorno a un case lo sposta: ' + A.moved);

  /* ---- B: case in mano ---- */
  const B = await ev(() => {
    const ce = C('distro'); moveCase(ce, 950, 500); const at = leftOf(ce); put(at.x, at.y, 0);
    pressGrab(); const took = P().grab === ce && P().mode === 'carry';
    const rel = () => { const d = Math.hypot(ce.body.position.x - P().body.position.x, ce.body.position.y - P().body.position.y); return { d, a: angDiff(ce.body.angle, P().facing) }; };
    const r0 = rel(); let dd = 0, da = 0, jump = 0; let last = pos(ce.body);
    let ref = r0;
    const each = () => { const r = rel(); dd = Math.max(dd, Math.abs(r.d - ref.d)); da = Math.max(da, Math.abs(angDiff(r.a, ref.a))); const c = pos(ce.body); jump = Math.max(jump, Math.hypot(c.x - last.x, c.y - last.y)); last = c; };
    run(40, { x: 1, y: 0 }, each); run(50, { x: 0, y: 1 }, each); run(50, { x: -1, y: 0 }, each);
    const turned = Math.abs(ce.body.angle) > 1;
    const s0 = pos(ce.body); run(12, null, each); const s1 = pos(ce.body); run(20, null, each); const s2 = pos(ce.body);
    const stopDrift = Math.hypot(s2.x - s1.x, s2.y - s1.y);
    pressGrab(); const rp = pos(ce.body); run(40); const after = Math.hypot(ce.body.position.x - rp.x, ce.body.position.y - rp.y);
    const free = !P().grab && !ce.carrier;
    // di nuovo, e dritto contro il recinto
    moveCase(ce, 950, 400); const ag = leftOf(ce); put(ag.x, ag.y, 0); pressGrab(); const again = P().grab === ce;
    last = pos(ce.body); ref = rel(); run(150, { x: 0, y: -1 }, each);
    const inWall = overlap(ce.body, G.statics), top = ce.body.bounds.min.y;
    pressGrab();
    return { took, again, dd, da, turned, jump, stopDrift, after, free, inWall: !!inWall, top, s0, s1 };
  });
  check(B.took && B.again && B.free, 'B: prendere / lasciare / riprendere non va: ' + JSON.stringify(B));
  check(B.dd < 0.5 && B.da < 0.01, 'B: il case in mano non resta al suo posto rispetto a te (oscilla): ' + JSON.stringify(B));
  check(B.turned, 'B: girandoti il case non gira con te');
  check(B.jump < 7, 'B: il case fa scatti (teletrasporto): ' + B.jump);
  check(B.stopDrift < 0.01 && B.after < 0.01, 'B: fermo o lasciato, il case si muove ancora: ' + JSON.stringify(B));
  check(!B.inWall && B.top >= 91, 'B: il case in mano entra nel recinto: ' + JSON.stringify(B));

  /* ---- C: carrello (si prende solo dalle maniglie) ---- */
  const Cr = await ev(() => {
    spawnTrolley(); const t = G.trolley;
    Matter.Body.setPosition(t.body, { x: 1000, y: 500 }); Matter.Body.setAngle(t.body, 0);
    put(1000, 500 - 23 - P().r - 4, Math.PI / 2); pressGrab(); const side = P().grab === t;      // di lato: no
    put(1000 + 32 + P().r + 4, 500, Math.PI); pressGrab(); const front = P().grab === t;          // dalla pala: no
    put(1000 - 32 - P().r - 4, 500, 0); pressGrab();
    const took = P().grab === t && P().mode === 'push';
    const dist = () => Math.hypot(t.body.position.x - P().body.position.x, t.body.position.y - P().body.position.y);
    const d0 = dist(); let dd = 0, jump = 0, last = pos(t.body);
    const each = () => { dd = Math.max(dd, Math.abs(dist() - d0)); const c = pos(t.body); jump = Math.max(jump, Math.hypot(c.x - last.x, c.y - last.y)); last = c; };
    const x0 = t.body.position.x; run(40, { x: 1, y: 0 }, each); const push = t.body.position.x - x0;
    const x1 = t.body.position.x; run(40, { x: -1, y: 0 }, each); const pull = x1 - t.body.position.x;
    const f0 = P().facing; run(50, { x: 0, y: 1 }, each); const turn = P().facing - f0;
    const s1 = pos(t.body); run(15, null, each); const s2 = pos(t.body); run(20, null, each); const s3 = pos(t.body);
    const glide = Math.hypot(s3.x - s2.x, s3.y - s2.y);
    pressGrab(); const rp = pos(t.body); run(30); const after = Math.hypot(t.body.position.x - rp.x, t.body.position.y - rp.y);
    return { side, front, took, push, pull, turn, dd, jump, glide, after, free: !P().grab };
  });
  check(!Cr.side && !Cr.front, 'C: il carrello si prende anche di lato o dalla pala: ' + JSON.stringify(Cr));
  check(Cr.took && Cr.free, 'C: il carrello non si prende dalle maniglie o non si lascia: ' + JSON.stringify(Cr));
  check(Cr.push > 60 && Cr.pull > 40, 'C: il carrello non si spinge o non si tira: ' + JSON.stringify(Cr));
  check(Cr.turn > 0.6, 'C: il carrello non gira: ' + Cr.turn);
  check(Cr.dd < 0.5 && Cr.jump < 6, 'C: il carrello si stacca o salta: ' + JSON.stringify(Cr));
  check(Cr.glide < 0.01 && Cr.after < 0.01, 'C: il carrello scivola da solo: ' + JSON.stringify(Cr));

  /* ---- D: case sul carrello: il carrello va al case (CARICA), un case piccolo sopra (METTI SOPRA), da fermo SCARICA ---- */
  const D = await ev(() => {
    const t = G.trolley, base = C('segnale'), top = C('valigetta');
    Matter.Body.setPosition(t.body, { x: 900, y: 500 }); Matter.Body.setAngle(t.body, 0);
    moveCase(base, 1010, 505); moveCase(top, 900, 360);
    // un case in mano sul carrello vuoto: no, prima va appoggiato e ci si va col carrello
    put(900, 360 + 15 + P().r + 4, -Math.PI / 2); pressGrab(); run(20, { x: 0, y: 1 }); const noTopFirst = !cartCmd(P()); pressGrab();
    moveCase(top, 900, 360);
    put(900 - 32 - P().r - 4, 500, 0); pressGrab();
    let cmd = null; for (let i = 0; i < 80 && !(cmd = cartCmd(P())); i++) run(1, { x: 1, y: 0 });
    const caricaLbl = cmd && cmd.label; const b0 = pos(base.body); pressCart();
    const onBase = base.onTrolley === t, slide = Math.hypot(base.body.position.x - b0.x, base.body.position.y - b0.y);
    // il secondo case: in mano, ci si avvicina, METTI SOPRA
    pressGrab(); put(900, 360 + 15 + P().r + 4, Math.PI / 2); pressGrab(); const held = P().grab === top;
    let c2 = null; for (let i = 0; i < 200 && !(c2 = cartCmd(P())); i++) { const d = sub(base.body.position, P().body.position); run(1, norm(d)); }
    const sopraLbl = c2 && c2.label; pressCart();
    const both = top.onTrolley === t && t.load.length === 2 && !P().grab;
    // si riprende dalle maniglie e si porta in giro: il carico resta fermo sul carrello
    const back = add(t.body.position, rot({ x: -32 - P().r - 4, y: 0 }, t.body.angle)); put(back.x, back.y, t.body.angle); pressGrab();
    const rel = c => { const l = rot(sub(c.body.position, t.body.position), -t.body.angle); return { x: l.x, y: l.y, a: c.body.angle - t.body.angle }; };
    const r0 = [rel(base), rel(top)]; let dev = 0, moving = null;
    const each = i => { [base, top].forEach((c, k) => { const r = rel(c); dev = Math.max(dev, Math.abs(r.x - r0[k].x), Math.abs(r.y - r0[k].y), Math.abs(r.a - r0[k].a)); }); if (i === 20) moving = cartCmd(P()); };
    run(40, { x: 0.3, y: 1 }, each); run(40, { x: 1, y: 0.2 }, each);
    run(15, null, each); const s0 = pos(base.body); run(20, null, each); const still = Math.hypot(base.body.position.x - s0.x, base.body.position.y - s0.y);
    // nell'Off Stage, da fermo: SCARICA due volte
    pressGrab(); const z = ZONES.foh, zc = { x: z.x + z.w / 2 - 20, y: z.y + z.h / 2 };
    Matter.Body.setPosition(t.body, zc); Matter.Body.setAngle(t.body, 0); placeLoad(t);
    put(zc.x - 32 - P().r - 4, zc.y, 0); pressGrab(); run(10);
    const scLbl = (cartCmd(P()) || {}).label; pressCart(); const topOff = !top.onTrolley && t.load.length === 1;
    const bp = pos(base.body); pressCart(); const baseOff = !base.onTrolley && !t.load.length;
    const baseStay = Math.hypot(base.body.position.x - bp.x, base.body.position.y - bp.y);
    run(30, { x: -1, y: 0 }); pressGrab(); run(30);
    const ov = overlap(base.body, obstacles(P(), base)) || overlap(top.body, obstacles(P(), top));
    return { noTopFirst, caricaLbl, onBase, slide, held, sopraLbl, both, moving: moving && moving.label, dev, still, scLbl, topOff, baseOff, baseStay, overlap: !!ov, zones: [base.zone, top.zone] };
  });
  check(D.noTopFirst, 'D: un case in mano va sul carrello vuoto (deve andare prima a terra)');
  check(D.caricaLbl === 'CARICA' && D.onBase && D.slide < 40, 'D: avvicinando il carrello al case non compare CARICA o il case salta: ' + JSON.stringify(D));
  check(D.held && D.sopraLbl === 'METTI SOPRA' && D.both, 'D: il secondo case non va sopra: ' + JSON.stringify(D));
  check(D.moving === undefined || D.moving === null, 'D: SCARICA compare anche mentre il carrello si muove: ' + D.moving);
  check(D.dev < 0.01 && D.still < 0.01, 'D: il carico si sposta rispetto al carrello: ' + JSON.stringify(D));
  check(D.scLbl === 'SCARICA' && D.topOff && D.baseOff && D.baseStay < 0.01, 'D: da fermo SCARICA non va: ' + JSON.stringify(D));
  check(!D.overlap && D.zones.join() === 'foh,foh', 'D: scaricati, i case non sono a posto nell\'Off Stage: ' + JSON.stringify(D));

  /* ---- E: furgone, dal vano alla palestra ---- */
  const E = await ev(() => {
    const t = G.trolley; if (t.grabbers.length) release(P());
    Matter.Body.setPosition(t.body, TROLLEY_AT); Matter.Body.setAngle(t.body, 0); placeLoad(t);
    // cammina verso un punto, come col joystick
    const go = (to, n) => { for (let i = 0; i < (n || 400); i++) { const d = sub(to, P().body.position); if (len(d) < 6) break; run(1, norm(d)); } return len(sub(to, P().body.position)); };
    put(DOOR_X + 90, 500, Math.PI);
    // il carico è tutto attaccato: prima la borsa stativi, presa dalla rampa, e portata in palestra
    const st = C('stativi');
    const r0 = go({ x: st.body.bounds.max.x + P().r + 5, y: st.body.position.y }); P().facing = Math.PI; pressGrab(); const tookSt = P().grab === st;
    const rSt = go({ x: DOOR_X + 120, y: 500 }) + go({ x: GYM_X - 60, y: 500 }) + go({ x: GYM_X + 120, y: 500 }); pressGrab();
    // poi si entra nel posto lasciato libero e si prende il PAR sotto
    const ce = C('par'), yIn = ce.body.bounds.min.y - P().r - 4;
    const r1 = go({ x: DOOR_X + 60, y: 500 }) + go({ x: DOOR_X + 40, y: yIn }) + go({ x: DOOR_X - 24, y: yIn });
    const inVan = P().body.position.x < DOOR_X - 15;
    const r2 = 0; P().facing = Math.PI / 2; pressGrab(); const took = P().grab === ce;
    window.trace = [];
    const r3 = go({ x: DOOR_X + 120, y: 500 }) + go({ x: GYM_X - 60, y: 500 }) + go({ x: GYM_X - 60, y: 500 }) + go({ x: GYM_X + 120, y: 500 });
    const inGym = P().body.position.x > GYM_X + 60 && P().grab === ce;
    pressGrab();
    // col carrello vuoto dal furgone alla palestra e ritorno, porta compresa
    put(TROLLEY_AT.x - 32 - P().r - 4, TROLLEY_AT.y, 0); pressGrab(); const tt = P().grab === t;
    const stuck0 = go({ x: TROLLEY_AT.x + 150, y: 520 }) + go({ x: GYM_X - 80, y: 500 }) + go({ x: GYM_X + 140, y: 500 }, 500);
    const tInGym = t.body.position.x > GYM_X + 20;
    return { r0, tookSt, rSt, r1, inVan, r2, took, r3, inGym, tt, stuck0, tInGym, tx: t.body.position.x };
  });
  check(E.tookSt && E.r0 < 10 && E.rSt < 30, 'E: la borsa stativi in coda non si prende dalla rampa: ' + JSON.stringify(E));
  check(E.inVan && E.r1 < 18, 'E: non si entra nel vano dalla rampa: ' + JSON.stringify(E));
  check(E.took, 'E: nel vano non si prende il PAR: ' + JSON.stringify(E));
  check(E.inGym, 'E: col PAR in mano non si arriva in palestra: ' + JSON.stringify(E));
  check(E.tt && E.tInGym, 'E: col carrello ci si incastra fra furgone e palestra: ' + JSON.stringify(E));

  /* ---- F: il tavolo regia in due, dal cortile all'Off Stage, porta e gradino compresi ---- */
  const F = await ev(() => {
    for (const w of G.workers) release(w);
    G.team = true;
    // strada libera: carrello e case delle prove precedenti via dal percorso
    Matter.Body.setPosition(G.trolley.body, { x: 1700, y: 300 }); placeLoad(G.trolley);
    moveCase(C('distro'), 1700, 420); moveCase(C('par'), 1700, 520); moveCase(C('valigetta'), 1700, 620); moveCase(C('segnale'), 1780, 420); moveCase(C('stativi'), 1780, 620);
    const t = C('tavolo'); moveCase(t, 950, 300); t.zone = null; t.liftUntil = 0;
    put(950, 300 + 65 + 23); Matter.Body.setPosition(G.macio.body, { x: 850, y: 200 }); macio('idle'); G.macio.ai.t = 5;
    pressGrab();
    for (let i = 0; i < 400 && t.grabbers.length < 2; i++) run(1);
    const two = t.grabbers.length === 2;
    const go = (to, max) => {
      for (let i = 0; i < max; i++) {
        const d = sub(to, t.body.position); if (len(d) < 20) return true;
        if (liftReady() && !G.qte) pressLift();
        run(1, norm(d));
      }
      return false;
    };
    // come farebbe un giocatore: prima gira il tavolo per il lungo (spingendo in diagonale), poi verso la porta
    for (let i = 0; i < 300 && Math.abs(Math.cos(t.body.angle)) > 0.2; i++) run(1, { x: Math.cos(P().facing + 0.6), y: Math.sin(P().facing + 0.6) });
    const z = ZONES.foh;
    const legs = [go({ x: GYM_X - 120, y: 500 }, 900), go({ x: GYM_X + 120, y: 500 }, 900), go({ x: z.x + z.w / 2, y: z.y + 70 }, 900)], ok = legs.every(Boolean);
    pressGrab(); run(30);
    return { two, ok, legs, zone: t.zone, at: pos(t.body) };
  });
  check(F.two && F.ok && F.zone === 'foh', 'F: il tavolo in due non arriva all\'Off Stage (incastrato?): ' + JSON.stringify(F));

  check(!errs.length, 'errori nella pagina: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI (' + problems.length + '):\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('OK fisica dello scarico: personaggio, case in mano, carrello, carico, furgone');
})().catch(e => { console.error(e); process.exit(1); });
