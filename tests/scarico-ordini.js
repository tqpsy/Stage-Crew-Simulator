/* Lo scarico a ordini (niente joystick): scegli chi (Tu o Macio), cosa (un
   case) e dove (una zona), col carrello se serve; il resto lo fa il gioco.
   Prova i clic veri sul computer e i tocchi veri sul telefono, il giro
   completo degli 11 case, il carrello, Macio, i passaggi bloccati, gli
   ostacoli e quello che lo scarico passa al montaggio.

   Uso:  node tests/scarico-ordini.js
   Richiede Playwright. Senza rete, MATTER_PATH=/percorso/matter.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const problems = [], errs = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  const page = async (opts) => {
    const ctx = await b.newContext(opts);
    const p = await ctx.newPage();
    if (process.env.MATTER_PATH) await p.route('**/matter.min.js', r => r.fulfill({ path: process.env.MATTER_PATH, contentType: 'application/javascript' }));
    await p.route(/fonts\./, r => r.abort());
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.join(__dirname, '..', 'scarico.html'));
    return p;
  };
  // dove sta sullo schermo un punto del cortile
  const toScreen = (p, w) => p.evaluate(w => {
    const r = document.querySelector('canvas').getBoundingClientRect();
    const s = worldToScreen(w); return { x: r.left + s.x, y: r.top + s.y };
  }, w);
  // la telecamera sul case (come trascinando la scena), poi dove sta sullo schermo
  const caseAtScreen = async (p, id) => { await p.evaluate(id => { const c = G.cases.find(x => x.def.id === id).body.position; G.cam.manual = { x: c.x, y: c.y }; }, id); await p.waitForTimeout(700); return caseAt0(p, id); };
  const caseAt0 = async (p, id) => toScreen(p, await p.evaluate(id => { const c = G.cases.find(x => x.def.id === id).body.position; return { x: c.x, y: c.y }; }, id));
  const waitIdle = (p, ms) => p.waitForFunction(() => !busy(G.player) && !busy(G.macio) && !G.van.anim, null, { timeout: ms || 30000 });

  /* 1. COMPUTER: clic veri sul portellone, sui case, sulle zone */
  {
    const p = await page({ viewport: { width: 1300, height: 900 } });
    await p.click('#btn-start');
    await p.waitForFunction(() => G && G.mode === 'play');
    await p.waitForSelector('#cmd-act button.van');
    const s0 = await p.evaluate(() => ({ pad: !!document.querySelector('#pad'), cmd: !$('#cmd').hidden, n: G.cases.length + G.stowed.length, stowed: G.stowed.map(c => c.def.id).join(), bodies: G.stowed.some(c => c.body),
      btn: $('#cmd-act').textContent }));
    check(!s0.pad && s0.cmd, 'c\'è ancora il joystick o manca la barra degli ordini: ' + JSON.stringify(s0));
    check(s0.n === 13 && s0.stowed === 'corrente,segnale' && !s0.bodies, 'il materiale non è 13 o i bauli dei cavi hanno ancora la fisica: ' + JSON.stringify(s0));
    check(/APRI IL PORTELLONE/.test(s0.btn), 'all\'inizio non c\'è APRI IL PORTELLONE: ' + s0.btn);
    // il furgone: tre clic sullo stesso pulsante, uno per volta
    for (const what of ['APRI IL PORTELLONE', 'TIRA GIÙ LA RAMPA', 'SGANCIA LA CINGHIA']) {
      await p.waitForSelector('#cmd-act button.van', { timeout: 20000 });
      check((await p.textContent('#cmd-act button.van')) === what, 'il pulsante del furgone non dice ' + what);
      await p.click('#cmd-act button.van');
      await p.waitForTimeout(300);
      await waitIdle(p);
    }
    check(await p.evaluate(() => G.van.open && G.van.ramp && !G.straps[0]), 'il furgone non si apre coi clic');
    // Tu (già scelto) → clic sulla borsa stativi → clic su PIT
    await p.mouse.click(...Object.values(await caseAtScreen(p, 'stativi')));
    check(await p.evaluate(() => G.sel.ce && G.sel.ce.def.id === 'stativi'), 'col clic la borsa stativi non si sceglie');
    await p.waitForSelector('#cmd-act button.zone');
    const zb = await p.$$eval('#cmd-act button.zone', bs => bs.map(b => b.dataset.z));
    check(zb[0] === 'pit' && zb.length === 4, 'le zone non partono da quella del case: ' + zb);
    await p.click('#cmd-act button.zone[data-z="pit"]');
    const o1 = await p.evaluate(() => ({ job: G.player.job && G.player.job.kind, sel: !!G.sel.ce, word: document.querySelector('#cmd .who[data-w="0"] span').textContent }));
    check(o1.job === 'move' && !o1.sel && /STATIVI/i.test(o1.word), 'l\'ordine col clic non parte: ' + JSON.stringify(o1));
    await p.waitForFunction(() => G.cases.find(c => c.def.id === 'stativi').zone === 'pit' && !busy(G.player), null, { timeout: 30000 }).catch(() => {});
    check(await p.evaluate(() => G.cases.find(c => c.def.id === 'stativi').zone === 'pit'), 'col clic la borsa stativi non arriva nel Pit');
    // il PAR (davanti agli accessori): lo porti tu, sempre coi clic
    await p.mouse.click(...Object.values(await caseAtScreen(p, 'par')));
    await p.click('#cmd-act button.zone[data-z="pit"]');
    await p.waitForFunction(() => G.cases.find(c => c.def.id === 'par').zone === 'pit' && !busy(G.player), null, { timeout: 30000 }).catch(() => {});
    // Macio col clic sul suo pulsante, poi gli accessori: fumetto e risposta
    await p.evaluate(() => { window.SAID = []; const _b = bubble; window.bubble = (e, m, d) => { SAID.push((e === G.player ? 'Tu: ' : e === G.macio ? 'Macio: ' : '') + m); return _b(e, m, d); }; });
    await p.click('#cmd .who[data-w="1"]');
    check(await p.evaluate(() => G.sel.who === G.macio), 'col clic Macio non si sceglie');
    await p.mouse.click(...Object.values(await caseAtScreen(p, 'ricambio')));
    await p.click('#cmd-act button.zone[data-z="palco"]');
    await p.waitForTimeout(1200);
    const m1 = await p.evaluate(() => ({ job: G.macio.job && G.macio.job.ce && G.macio.job.ce.def.id, said: SAID.join(' | ') }));
    check(m1.job === 'ricambio', 'Macio non prende l\'ordine: ' + JSON.stringify(m1));
    check(/Tu: Macio, ACCESSORI in Palco!/.test(m1.said) && /Macio: (Porto io|Eccomi, capo|Un attimo, capo)/.test(m1.said), 'manca il fumetto dell\'ordine o la risposta di Macio: ' + m1.said);
    await p.close();
  }

  /* 2. TELEFONO: tocchi veri (touch), barra in basso dentro lo schermo */
  {
    const p = await page({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await p.tap('#btn-start');
    await p.waitForFunction(() => G && G.mode === 'play');
    const box = await (await p.$('#cmd')).boundingBox();
    check(box && box.y + box.height <= 844 && box.x >= 0 && box.x + box.width <= 390, 'sul telefono la barra degli ordini esce dallo schermo: ' + JSON.stringify(box));
    for (let i = 0; i < 3; i++) { await p.waitForSelector('#cmd-act button.van', { timeout: 20000 }); await p.tap('#cmd-act button.van'); await p.waitForTimeout(300); await waitIdle(p); }
    check(await p.evaluate(() => G.van.ramp && !G.straps[0]), 'sul telefono il furgone non si apre coi tocchi');
    await p.tap('#cmd .who[data-w="0"]');
    const sc = await caseAtScreen(p, 'stativi');
    await p.touchscreen.tap(sc.x, sc.y);
    check(await p.evaluate(() => G.sel.ce && G.sel.ce.def.id === 'stativi'), 'col tocco la borsa stativi non si sceglie');
    await p.tap('#cmd-act button.zone[data-z="pit"]');
    check(await p.evaluate(() => G.player.job && G.player.job.kind === 'move'), 'col tocco l\'ordine non parte');
    await p.close();
  }

  /* 3. TUTTO LO SCARICO a ordini, a passi fissi (senza aspettare il tempo vero) */
  {
    const p = await page({ viewport: { width: 1300, height: 900 } });
    await p.click('#btn-start');
    await p.waitForFunction(() => G && G.mode === 'play');
    const r = await p.evaluate(() => {
      paused = true;
      const C = id => G.cases.find(x => x.def.id === id), P = G.player, M = G.macio, log = [];
      const run = (n, cond) => { for (let i = 0; i < n; i++) { stepSim(); if (cond && cond()) return i; } return -1; };
      const _t = toast; window.toast = (m, k) => { log.push(m); _t(m, k); };
      G.at.telefono = 9999;          // la telefonata la prova il punto 5
      for (let i = 0; i < 3; i++) { vanOrder(); run(900, () => !busy(P) && !G.van.anim); }
      const ord = (w, id, zone, cart, top) => { selectWorker(w); selectCase(C(id)); if (G.sel.ce !== C(id)) return false; if (cart) toggleCart(); if (top) { startPickTop(); selectCase(C(top)); } sendTo({ zone }); return true; };
      let early = null;
      // delicata: Macio non la tocca
      selectWorker(M); selectCase(C('valigetta')); const refused = !G.sel.ce || (sendTo({ zone: 'foh' }), !busy(M)); cancelSel();
      const seq = [[P, 'stativi', 'pit'], [P, 'par', 'pit'], [M, 'ricambio', 'palco'], [P, 'tavolo', 'foh'], [P, 'valigetta', 'foh'], [M, 'distro', 'back'],
        [M, 'top1', 'pit', true, 'top2'], [P, 'sub1', 'pit'], [M, 'sub2', 'pit'], [P, 'rack', 'foh']];
      // a ogni passo: nessuno dentro un muro, il carrello sempre attaccato a chi lo spinge
      let worst = 0, cartGap = 0, stuck = 0, last = null, still = 0, i = 0, cartSeen = false, helped = false;
      let worstWho = '';
      // il bordo basso del pianale: un case in mano (o il tavolo in due) ci passa sopra
      const depthIn = (body, who, over) => { let d = 0; for (const s of G.statics) if (s !== G.stepBody && !(over && G.edges.includes(s)) && Matter.Bounds.overlaps(s.bounds, body.bounds)) { const c = Matter.Collision.collides(body, s); if (c && c.depth > d) { d = c.depth; if (d > worst) worstWho = who + ' @' + Math.round(body.position.x) + ',' + Math.round(body.position.y) + ' muro ' + Math.round(s.position.x) + ',' + Math.round(s.position.y) + ' t' + Math.round(G.t); } } return d; };
      for (let n = 0; n < 60 * 400 && G.mode === 'play'; n++) {
        // il quadro sta sopra la valigetta: uscito il tavolo, finché c'è lei in mano non esce
        if (!early && i === 4 && !inVan(C('tavolo')) && !busy(M)) { selectWorker(M); selectCase(C('distro')); early = { sel: !!G.sel.ce, msg: log[log.length - 1] || '' }; cancelSel(); }
        if (i < seq.length && n % 30 === 0 && (i !== 4 || early)) { const [w, id] = seq[i]; const ce = C(id); if (!busy(w) && (!blockers(ce).length || blockers(ce).every(x => x.job))) { if (ord(...seq[i])) i++; } }
        stepSim();
        for (const w of G.workers) {
          worst = Math.max(worst, depthIn(w.body, w.name));
          if (w.grab) worst = Math.max(worst, depthIn(w.grab.body, w.grab.def.id, !!(w.grab.carrier || liftedByTwo(w.grab))));
          if (w.grab && w.grab === G.trolley) { cartSeen = true; const t = G.trolley, hp = Matter.Vector.add(t.body.position, Matter.Vector.rotate({ x: -(t.def.w / 2 + w.r + 2), y: 0 }, t.body.angle)); cartGap = Math.max(cartGap, Math.hypot(hp.x - w.body.position.x, hp.y - w.body.position.y)); }
          if (w.grab && w.grab.grabbers && w.grab.grabbers.length === 2) helped = true;
        }
        // chi ha un ordine si muove: fermo più di 30 s di fila = incastrato
        const pos = G.workers.map(w => busy(w) ? Math.round(w.body.position.x / 4) + ',' + Math.round(w.body.position.y / 4) : '-').join();
        still = pos === last && /\d/.test(pos) ? still + 1 : 0; last = pos; stuck = Math.max(stuck, still);
      }
      run(60 * 12, () => G.mode === 'end');
      return { worstWho, mode: G.mode, given: i, early, refused, worst: Math.round(worst * 10) / 10, cartGap: Math.round(cartGap * 10) / 10, cartSeen, helped, stuck: Math.round(stuck / 60),
        zones: G.cases.filter(c => c.zone !== c.def.zone).map(c => c.def.id + ':' + c.zone), stats: G.stats, res: G.result && G.result.cases.map(c => c.id + '@' + c.at + ':' + c.state).join(' '),
        fails: log.filter(m => /non passa|non ci arrivo|non si/.test(m)) };
    });
    check(r.early && !r.early.sel && /Prima porta via PC/.test(r.early.msg), 'il quadro sotto la valigetta non dice cosa togliere prima: ' + JSON.stringify(r.early));
    check(r.refused, 'Macio prende la valigetta delicata');
    check(r.given === 10 && r.zones.length === 0 && r.mode === 'end', 'lo scarico a ordini non arriva in fondo: ' + JSON.stringify({ given: r.given, mode: r.mode, zones: r.zones, fails: r.fails }));
    check(r.worst < 2, 'qualcuno (o un case) entra nei muri: ' + r.worst + ' px ' + r.worstWho);
    check(r.cartSeen && r.cartGap < 1.5, 'il carrello si stacca da chi lo spinge: ' + r.cartGap + ' px');
    check(r.stats.cartTrips === 1 && r.stats.cartCases === 2, 'il viaggio col carrello (TESTA + TESTA) non si conta: ' + JSON.stringify(r.stats));
    check(r.helped, 'i case da due non si portano in due');
    check(r.stuck < 30, 'qualcuno con un ordine resta fermo ' + r.stuck + ' s');
    check(r.fails.length === 0, 'durante lo scarico ci sono ordini falliti: ' + r.fails.join(' | '));
    const want = ['corrente@back', 'segnale@foh', 'stativi@pit', 'par@pit', 'ricambio@palco', 'tavolo@foh', 'valigetta@foh', 'distro@back', 'top1@pit', 'top2@pit', 'sub1@pit', 'sub2@pit', 'rack@foh'];
    check(r.res && want.every(x => r.res.includes(x)) && r.res.split(' ').length === 13, 'il risultato per il montaggio non registra i 13 case dove sono: ' + r.res);
    await p.close();
  }

  /* 4. STRADA CHIUSA, BAMBINO IN MEZZO, TELEFONATA */
  {
    const p = await page({ viewport: { width: 1300, height: 900 } });
    await p.click('#btn-start');
    await p.waitForFunction(() => G && G.mode === 'play');
    const r = await p.evaluate(() => {
      paused = true;
      const C = id => G.cases.find(x => x.def.id === id), P = G.player, M = G.macio, log = [];
      const run = (n, cond) => { for (let i = 0; i < n; i++) { stepSim(); if (cond && cond()) return i; } return -1; };
      const _t = toast; window.toast = (m, k) => { log.push(m); _t(m, k); };
      G.at = { passante1: 9999, bidello: 9999, telefono: 9999, passante2: 9999 };
      for (let i = 0; i < 3; i++) { vanOrder(); run(900, () => !busy(P) && !G.van.anim); }
      // la porta della palestra chiusa da una transenna: non si passa
      const wall = Matter.Bodies.rectangle(GYM_X, 500, 30, 170, { isStatic: true, collisionFilter: { category: CAT.WALL } });
      Matter.Composite.add(G.world, wall); G.statics.push(wall);
      selectWorker(P); selectCase(C('stativi')); sendTo({ zone: 'pit' });
      const t0 = G.t; run(60 * 90, () => !busy(P));
      const closed = { busy: busy(P), secs: Math.round(G.t - t0), msg: log.filter(m => /non passa|non ci arrivo/.test(m)).pop() || '', zone: C('stativi').zone, held: !!P.grab };
      // ferma lì, non va avanti e indietro
      const a = { ...P.body.position }; run(120); const drift = Math.hypot(P.body.position.x - a.x, P.body.position.y - a.y);
      Matter.Composite.remove(G.world, wall); G.statics.splice(G.statics.indexOf(wall), 1);
      // riprovata con la porta libera, arriva
      selectWorker(P); selectCase(C('stativi')); sendTo({ zone: 'pit' }); run(60 * 60, () => !busy(P));
      const reopened = C('stativi').zone;
      // il passante si ferma in fondo alla rampa: permesso!, poi si passa
      passante(G.kids[0]); G.kids[0].target.y = 500; run(120);   // in mezzo alla rampa, non a caso
      let asked = false; const _b = bubble; window.bubble = (e, m, d) => { if (m === 'Permesso!') asked = true; return _b(e, m, d); };
      selectWorker(P); selectCase(C('par')); sendTo({ zone: 'pit' }); run(60 * 60, () => !busy(P));
      const kidOk = { asked, zone: C('par').zone };
      // la telefonata: Macio prende l'ordine, lo fa quando ha finito
      G.at.telefono = G.t; run(5);
      const phone = M.ai.state === 'phone';
      selectWorker(M); selectCase(C('ricambio')); sendTo({ zone: 'palco' });
      const waitWord = jobWord(M);
      run(60 * 60, () => C('ricambio').zone === 'palco' && !busy(M));
      return { closed, drift: Math.round(drift * 10) / 10, reopened, kidOk, phone, waitWord, ric: C('ricambio').zone };
    });
    check(!r.closed.busy && r.closed.secs < 60 && /Stativi.*(non passa|non ci arrivo)/i.test(r.closed.msg) && !r.closed.zone && !r.closed.held,
      'con la porta chiusa non si ferma e non dice perché: ' + JSON.stringify(r.closed));
    check(r.drift < 0.5, 'fermo, chi ha fallito si muove ancora (oscilla): ' + r.drift);
    check(r.reopened === 'pit', 'riaperta la porta, l\'ordine ripetuto non arriva');
    check(r.kidOk.asked && r.kidOk.zone === 'pit', 'col bambino in mezzo non chiede permesso o non arriva: ' + JSON.stringify(r.kidOk));
    check(r.phone && /telefono/.test(r.waitWord) && r.ric === 'palco', 'con Macio al telefono l\'ordine non aspetta o non si fa: ' + JSON.stringify(r));
    await p.close();
  }

  console.log('PROBLEMI:', JSON.stringify(problems, null, 1));
  console.log('ERRORI JS:', errs);
  await b.close();
  const ok = !problems.length && !errs.length;
  console.log(ok ? 'SCARICO A ORDINI OK' : 'SCARICO A ORDINI FALLITO');
  process.exit(ok ? 0 : 1);
})();
