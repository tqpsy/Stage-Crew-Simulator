/* Lo scarico a ordini, pratico e fluido: i comandi sul telefono (zone tutte
   in vista, il carrello accanto a chi lavora, il tocco che non deve centrare
   il case, la telecamera che torna sul furgone), Macio che rifiuta subito
   l'elettronica delicata, i movimenti (si gira camminando, niente avanti e
   indietro), il carrello caricato accanto alla rampa, il collega fermo che
   si sposta, Gerry che non trascina nessuno, la zona piena detta subito.

   Uso:  node tests/scarico-fluido.js
   Richiede Playwright. Senza rete, MATTER_PATH=/percorso/matter.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const problems = [], errs = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  // seed: lo stesso giro ogni volta (bambini, Gerry, telefonata)
  const page = async (opts, seed) => {
    const ctx = await b.newContext(opts);
    const p = await ctx.newPage();
    if (seed) await p.addInitScript(s => { let x = s; Math.random = () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; }, seed);
    if (process.env.MATTER_PATH) await p.route('**/matter.min.js', r => r.fulfill({ path: process.env.MATTER_PATH, contentType: 'application/javascript' }));
    await p.route(/fonts\./, r => r.abort());
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.join(__dirname, '..', 'scarico.html'));
    return p;
  };
  const toScreen = (p, w) => p.evaluate(w => {
    const r = document.querySelector('canvas').getBoundingClientRect();
    return { x: r.left + (w.x - G.cam.x) * G.cam.scale + W / 2, y: r.top + (w.y - G.cam.y) * G.cam.scale + H / 2 };
  }, w);
  const waitIdle = (p, ms) => p.waitForFunction(() => !busy(G.player) && !busy(G.macio) && !G.van.anim, null, { timeout: ms || 30000 });

  /* 1. TELEFONO: comandi in vista, tocco largo, telecamera, Macio e i PAR */
  {
    const p = await page({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, 4242);
    await p.tap('#btn-start');
    await p.waitForFunction(() => G && G.mode === 'play');
    for (let i = 0; i < 3; i++) { await p.waitForSelector('#cmd-act button.van', { timeout: 20000 }); await p.tap('#cmd-act button.van'); await p.waitForTimeout(300); await waitIdle(p); }
    await p.waitForFunction(() => !!G.trolley, null, { timeout: 20000 });
    await p.waitForTimeout(900);
    // la borsa stativi: il tocco 10 px fuori dal bordo la sceglie lo stesso
    const edge = await p.evaluate(() => { const c = G.cases.find(x => x.def.id === 'stativi'), bb = c.body.bounds; return { x: bb.max.x + 10 / G.cam.scale, y: c.body.position.y }; });
    const es = await toScreen(p, edge);
    await p.touchscreen.tap(es.x, es.y);
    await p.waitForTimeout(400);
    check(await p.evaluate(() => G.sel.ce && G.sel.ce.def.id === 'stativi'), 'col tocco appena fuori dal bordo la borsa stativi non si sceglie');
    // zone tutte dentro lo schermo, il carrello in alto accanto a chi lavora
    const lay = await p.evaluate(() => {
      const r = el => el && el.getBoundingClientRect();
      const zs = [...document.querySelectorAll('#cmd-act button.zone')].map(b => { const q = r(b); return { z: b.dataset.z, l: q.left, r: q.right, t: q.top }; });
      const cart = r(document.querySelector('#cmd-how [data-a="cart"]')), who = r(document.querySelector('#cmd .who[data-w="0"]'));
      return { zs, cart: cart && { l: cart.left, r: cart.right, t: cart.top }, who: who && { t: who.top }, vw: innerWidth };
    });
    check(lay.zs.length === 4 && lay.zs.every(z => z.l >= 0 && z.r <= lay.vw + 0.5), 'sul telefono qualche zona esce dallo schermo: ' + JSON.stringify(lay.zs));
    check(lay.cart && Math.abs(lay.cart.t - lay.who.t) < 4 && lay.cart.r <= lay.vw + 0.5 && lay.cart.t < lay.zs[0].t, 'il pulsante CARRELLO non sta in alto accanto a TU e MACIO: ' + JSON.stringify(lay));
    // dato l'ordine, la telecamera torna sul furgone (il prossimo case) e non segue Tu in palestra
    await p.tap('#cmd-act button.zone[data-z="pit"]');
    await p.waitForTimeout(2500);
    const cam = await p.evaluate(() => ({ x: G.cam.x, px: G.player.body.position.x, par: (() => { const c = G.cases.find(x => x.def.id === 'par').body.position; return { x: c.x, y: c.y }; })() }));
    const ps = await toScreen(p, cam.par);
    check(ps.x > 0 && ps.x < 390 && ps.y > 60 && ps.y < 700, 'dopo l\'ordine il furgone non si vede (bisogna trascinare): PAR a ' + JSON.stringify(ps));
    // Macio scelto, tocco sui PAR: dice di no subito e l'ordine passa a Tu
    await p.evaluate(() => { window.SAID = []; const _b = bubble; window.bubble = (e, m, d) => { SAID.push((e === G.macio ? 'Macio: ' : '') + m); return _b(e, m, d); }; });
    await p.tap('#cmd .who[data-w="1"]');
    await p.waitForTimeout(900);
    const pc = await toScreen(p, cam.par);
    await p.touchscreen.tap(pc.x, pc.y);
    await p.waitForTimeout(400);
    const mp = await p.evaluate(() => ({ sel: G.sel.ce && G.sel.ce.def.id, who: G.sel.who.name, said: SAID.join(' | '), on: document.querySelector('#cmd .who.on b').textContent }));
    check(mp.sel === 'par' && mp.who === 'Tu' && mp.on === 'TU' && /Macio: I PAR\? No no/.test(mp.said), 'con Macio scelto i PAR non passano subito a Tu col suo no: ' + JSON.stringify(mp));
    await p.close();
  }

  /* 2. TUTTO LO SCARICO, tre giri diversi: fluido, senza ordini falliti */
  const SEQ = [['P', 'stativi', 'pit'], ['P', 'par', 'pit'], ['M', 'ricambio', 'palco'], ['P', 'tavolo', 'foh'], ['P', 'valigetta', 'foh'], ['M', 'distro', 'back'],
    ['M', 'top1', 'pit', true, 'top2'], ['P', 'sub1', 'pit'], ['M', 'sub2', 'pit'], ['P', 'rack', 'foh']];
  for (const seed of [12345, 20264, 40083]) {
    const p = await page({ viewport: { width: 1300, height: 900 } }, seed);
    const r = await p.evaluate(SEQ => {
      document.querySelector('#btn-start').click(); paused = true;
      for (let i = 0; i < 600 && G.mode !== 'play'; i++) stepSim();
      const C = id => G.cases.find(x => x.def.id === id), P = G.player, M = G.macio, log = [];
      const run = (n, cond) => { for (let i = 0; i < n; i++) { stepSim(); if (cond && cond()) return i; } return -1; };
      const _t = toast; window.toast = (m, k) => { log.push(m); _t(m, k); };
      G.at.telefono = 9999;
      for (let i = 0; i < 3; i++) { vanOrder(); run(900, () => !busy(P) && !G.van.anim); }
      const ord = (w, id, zone, cart, top) => { selectWorker(w); selectCase(C(id)); if (G.sel.ce !== C(id)) return false; if (cart) toggleCart(); if (top) { startPickTop(); selectCase(C(top)); } sendTo({ zone }); return true; };
      const seq = SEQ.map(([w, ...x]) => [w === 'P' ? P : M, ...x]);
      const jobs = new Map(); let i = 0, maxPlan = 0;
      const _plan = plan; window.plan = (g, gl, av) => { const a = performance.now(); const res = _plan(g, gl, av); maxPlan = Math.max(maxPlan, performance.now() - a); return res; };
      let pushed = 0, cartGap = 0;
      for (let n = 0; n < 60 * 300 && G.mode === 'play'; n++) {
        if (i < seq.length && n % 30 === 0) { const [w, id] = seq[i]; const ce = C(id); if (!busy(w) && (!blockers(ce).length || blockers(ce).every(x => x.job))) { if (ord(...seq[i])) i++; } }
        const pre = G.workers.map(w => ({ x: w.body.position.x, y: w.body.position.y, f: w.facing }));
        stepSim();
        G.workers.forEach((w, k) => {
          const j = w.job; if (!j || j.kind === 'clear' || j.kind === 'help') return;
          let J = jobs.get(j); if (!J) { J = { what: j.kind + ':' + j.ce.def.id, kind: j.kind, hand: j.kind === 'move' && carriable(j.ce), stops: 0, turnInPlace: 0, moving: false, steps: new Set() }; jobs.set(j, J); }
          const st = j.steps && j.steps[j.si]; if (st) J.steps.add(st.k);
          const d = Math.hypot(w.body.position.x - pre[k].x, w.body.position.y - pre[k].y), df = Math.abs(angDiff(w.facing, pre[k].f));
          if (w.grab && d < 0.05 && df > 0.001) J.turnInPlace += 1 / 60;
          // le fermate per un bambino o per Gerry che passano sono giuste: non contano
          const npc = st && st.hit && st.hit.plugin && st.hit.plugin.ent && /kid|cart/.test(st.hit.plugin.ent.kind);
          const mv = d > 0.3; if (J.moving && !mv && !npc) J.stops++; J.moving = mv;
          // chi spinge il carrello non se ne stacca, e nessuno viene spostato da un urto
          if (w.grab && w.grab === G.trolley) { const t = G.trolley, hp = Matter.Vector.add(t.body.position, Matter.Vector.rotate({ x: -(t.def.w / 2 + w.r + 2), y: 0 }, t.body.angle)); cartGap = Math.max(cartGap, Math.hypot(hp.x - w.body.position.x, hp.y - w.body.position.y)); }
          if (!w.grab && d > w.vmax * 1.6) pushed++;
        });
      }
      run(60 * 12, () => G.mode === 'end');
      const J = [...jobs.values()].map(x => ({ ...x, steps: [...x.steps].join(',') }));
      return { mode: G.mode, given: i, fails: log.filter(m => /non passa|non ci arrivo|non si |non c'è/.test(m)), maxPlan: Math.round(maxPlan), pushed, cartGap: Math.round(cartGap * 10) / 10,
        stops: J.reduce((a, x) => a + x.stops, 0), hand: J.filter(x => x.hand).map(x => x.what + ':' + x.stops + ':' + x.turnInPlace.toFixed(1)), cart: J.find(x => x.kind === 'cart') };
    }, SEQ);
    const tag = 'giro ' + seed + ': ';
    check(r.given === 10 && r.mode !== 'play' && !r.fails.length, tag + 'lo scarico non arriva in fondo o ci sono ordini falliti: ' + JSON.stringify({ given: r.given, mode: r.mode, fails: r.fails }));
    // prima (PR #77 com'era): 200-800 fermate e ripartenze a giro, la valigetta da sola fino a 161
    check(r.stops < 150, tag + 'troppe fermate e ripartenze: ' + r.stops);
    check(r.hand.every(h => +h.split(':')[2] < 15 && +h.split(':')[3] < 1.5), tag + 'chi porta a mano si ferma o gira sul posto troppo: ' + r.hand.join(' '));
    // il carrello: carico accanto alla rampa (il case dritto sulla pala, niente appoggio a terra prima)
    check(r.cart && /toBase/.test(r.cart.steps) && !/haul|toLoad/.test(r.cart.steps), tag + 'il carrello non si carica dalla rampa: ' + (r.cart && r.cart.steps));
    check(r.cartGap < 1.5, tag + 'il carrello si stacca da chi lo spinge: ' + r.cartGap);
    check(r.pushed === 0, tag + 'qualcuno viene trascinato da un urto: ' + r.pushed);
    console.log(tag + 'fermate ' + r.stops + ', percorso più lungo da calcolare ' + r.maxPlan + ' ms');
    await p.close();
  }

  /* 3. INTOPPI: collega fermo in mezzo, Gerry sulla strada, zona piena */
  {
    const p = await page({ viewport: { width: 1300, height: 900 } }, 777);
    const r = await p.evaluate(() => {
      document.querySelector('#btn-start').click(); paused = true;
      for (let i = 0; i < 600 && G.mode !== 'play'; i++) stepSim();
      const C = id => G.cases.find(x => x.def.id === id), P = G.player, M = G.macio, log = [], said = [];
      const run = (n, cond) => { for (let i = 0; i < n; i++) { stepSim(); if (cond && cond()) return i; } return -1; };
      const _t = toast; window.toast = (m, k) => { log.push(m); _t(m, k); };
      const _b = bubble; window.bubble = (e, m, d) => { said.push((e === G.player ? 'Tu: ' : e === G.macio ? 'Macio: ' : '') + m); return _b(e, m, d); };
      G.at = { passante1: 9999, bidello: 9999, telefono: 9999, passante2: 9999 };
      for (let i = 0; i < 3; i++) { vanOrder(); run(900, () => !busy(P) && !G.van.anim); }
      // Tu fermo davanti alla porta della palestra; Macio porta gli stativi nel Pit
      Matter.Body.setPosition(P.body, { x: GYM_X - 70, y: 500 });
      selectWorker(M); selectCase(C('stativi')); sendTo({ zone: 'pit' });
      const p0 = { ...P.body.position };
      run(60 * 40, () => C('stativi').zone === 'pit' && !busy(M));
      const mate = { zone: C('stativi').zone, asked: said.some(m => m === 'Macio: Permesso!'), moved: Math.hypot(P.body.position.x - p0.x, P.body.position.y - p0.y) > 20 };
      // Gerry scende col carrello delle pulizie proprio dove passa Tu col PAR
      selectWorker(P); selectCase(C('par')); sendTo({ zone: 'pit' });
      run(60 * 2.5);
      const gx = P.body.position.x, gy = Math.max(110, P.body.position.y - 160);
      const gb = Matter.Bodies.rectangle(gx, gy, 56, 80, { frictionAir: 0, collisionFilter: { category: CAT.NPC, mask: CAT.CASE | CAT.WORKER | CAT.NPC } });
      Matter.Body.setMass(gb, 150); Matter.Body.setInertia(gb, Infinity);
      G.cart = { kind: 'cart', body: gb, pv: { x: 0, y: 1.1 } }; gb.plugin.ent = G.cart; Matter.Composite.add(G.world, gb);
      let shoved = 0; const ps = [];
      for (let n = 0; n < 60 * 40 && !(C('par').zone === 'pit' && !busy(P)); n++) {
        const a = { ...P.body.position }; stepSim();
        if (Math.hypot(P.body.position.x - a.x, P.body.position.y - a.y) > P.vmax * 1.6) shoved++;
      }
      const gerry = { zone: C('par').zone, shoved, polite: said.includes('Tu: Prego, Gerry!') || !said.some(m => /Gerry/.test(m)), left: !G.cart || G.cart.body.position.y > P.body.position.y };
      // il Palco pieno (una pedana in mezzo): l'ordine non parte e si dice perché
      const z = ZONES.palco, full = Matter.Bodies.rectangle(z.x + z.w / 2, z.y + z.h / 2, z.w, z.h, { isStatic: true });
      G.statics.push(full);
      selectWorker(M); selectCase(C('ricambio')); sendTo({ zone: 'palco' });
      const fullZ = { job: busy(M), msg: log[log.length - 1] || '' };
      G.statics.pop();
      return { mate, gerry, fullZ };
    });
    check(r.mate.zone === 'pit' && r.mate.asked && r.mate.moved, 'col collega fermo in mezzo Macio non chiede permesso o Tu non si sposta: ' + JSON.stringify(r.mate));
    check(r.gerry.zone === 'pit' && r.gerry.shoved === 0, 'con Gerry sulla strada il PAR non arriva o Tu viene spinto via: ' + JSON.stringify(r.gerry));
    check(!r.fullZ.job && /Palco non c'è più posto/.test(r.fullZ.msg), 'con il Palco pieno l\'ordine parte lo stesso o non si dice perché: ' + JSON.stringify(r.fullZ));
    await p.close();
  }

  console.log('PROBLEMI:', JSON.stringify(problems, null, 1));
  console.log('ERRORI JS:', errs);
  await b.close();
  const ok = !problems.length && !errs.length;
  console.log(ok ? 'SCARICO FLUIDO OK' : 'SCARICO FLUIDO FALLITO');
  process.exit(ok ? 0 : 1);
})();
