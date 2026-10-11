/* Zoom dello scarico: a zoom 1 la scena ha la scala della vista intera del
   montaggio sullo stesso schermo (stessi pixel per metro); i pulsanti + − 1:1,
   la rotellina e due dita lo regolano. Prova anche che col dito o il
   puntatore il punto sotto resta fermo e che a ogni zoom un tocco sceglie
   ancora il case giusto (a scena piccola, fra case vicini, il primo tocco
   avvicina la scena lì), senza errori.

   Uso:  node tests/scarico-zoom.js
   Richiede Playwright. Senza rete, MATTER_PATH=/percorso/matter.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const problems = [], errs = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  // scala del montaggio (vista intera) misurata in main.js: pixel per cm sulla diagonale di 1 m
  const MONT = { pc: 0.533, tel: 0.220 };
  for (const [name, opts] of [['pc', { viewport: { width: 1440, height: 900 } }], ['tel', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]]) {
    const ctx = await b.newContext(opts), p = await ctx.newPage();
    if (process.env.MATTER_PATH) await p.route('**/matter.min.js', r => r.fulfill({ path: process.env.MATTER_PATH, contentType: 'application/javascript' }));
    await p.route(/fonts\./, r => r.abort());
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto('file://' + path.join(__dirname, '..', 'scarico.html'));
    await p.click('#btn-start');
    await p.waitForFunction(() => G && G.mode === 'play');
    await p.waitForTimeout(400);
    const sc = () => p.evaluate(() => G.cam.scale);

    // 1. zoom 1 = scala del montaggio (entro il 6%)
    const s1 = await sc();
    check(Math.abs(s1 / MONT[name] - 1) < 0.06, name + ': a zoom 1 la scala ' + s1.toFixed(3) + ' non è quella del montaggio ' + MONT[name]);

    // 2. pulsanti
    await p.click('#zoom-in', { force: true }); await p.waitForTimeout(100);
    const s2 = await sc();
    check(Math.abs(s2 / s1 - 1.4) < 0.02, name + ': + non avvicina (' + s1.toFixed(3) + ' → ' + s2.toFixed(3) + ')');
    await p.click('#zoom-out', { force: true }); await p.waitForTimeout(100);
    check(Math.abs(await sc() / s1 - 1) < 0.02, name + ': − non torna indietro');
    for (let i = 0; i < 12; i++) await p.click('#zoom-in', { force: true });
    await p.waitForTimeout(100);
    check(Math.abs(await sc() / s1 - 4.5) < 0.05, name + ': lo zoom non si ferma a 4,5');
    await p.click('#zoom-reset', { force: true }); await p.waitForTimeout(100);
    check(Math.abs(await sc() / s1 - 1) < 0.02, name + ': 1:1 non torna alla scala del montaggio');

    // 3. il punto sotto il puntatore (rotellina) o in mezzo alle due dita resta fermo
    const fixed = await p.evaluate(() => {
      const s = { x: W * 0.3, y: H * 0.45 }, a = screenToWorld(s);
      setZoom(G.cam.zoom * 2.2, s);
      const c = screenToWorld(s);
      return Math.hypot(a.x - c.x, a.y - c.y);
    });
    check(fixed < 1, name + ': col dito il punto sotto scivola di ' + fixed.toFixed(1) + ' cm');
    if (name === 'pc') {
      const z0 = await p.evaluate(() => G.cam.zoom);
      await p.mouse.move(700, 400); await p.mouse.wheel(0, -300); await p.waitForTimeout(150);
      check(await p.evaluate(() => G.cam.zoom) > z0 * 1.2, 'pc: la rotellina non avvicina');
    } else {
      // due dita che si allargano
      const z0 = await p.evaluate(() => G.cam.zoom);
      await p.evaluate(() => {
        const r = cv.getBoundingClientRect(), ev = (t, id, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: r.left + x, clientY: r.top + y, bubbles: true, pointerType: 'touch' }));
        ev('pointerdown', 11, 150, 400); ev('pointerdown', 12, 230, 400);
        ev('pointermove', 11, 110, 400); ev('pointermove', 12, 270, 400);
        ev('pointerup', 11, 110, 400); ev('pointerup', 12, 270, 400);
      });
      await p.waitForTimeout(100);
      const z1 = await p.evaluate(() => G.cam.zoom);
      check(Math.abs(z1 / z0 - 2) < 0.05, 'tel: due dita non allargano (' + z0.toFixed(2) + ' → ' + z1.toFixed(2) + ')');
      check(await p.evaluate(() => !G.sel.ce), 'tel: due dita hanno scelto un case');
    }

    // 4. a zoom 1 e a zoom 3 un tocco sul coperchio sceglie quel case
    for (const z of [1, 3]) {
      await p.evaluate(z => { G.cam.zoom = z; cancelSel(); selectWorker(G.player); }, z);
      // portellone, rampa e cinghie: poi i case del vano si possono scegliere
      if (z === 1) for (let i = 0; i < 3; i++) { await p.waitForSelector('#cmd-act button.van', { timeout: 20000 }); await p.click('#cmd-act button.van', { force: true }); await p.waitForTimeout(300); await p.waitForFunction(() => !busy(G.player) && !busy(G.macio) && !G.van.anim, null, { timeout: 30000 }); }
      await p.evaluate(() => { const c = G.cases.find(x => x.def.id === 'par').body.position; G.cam.manual = { x: c.x, y: c.y }; });
      await p.waitForTimeout(400);
      const tap = async () => {
        const pt = await p.evaluate(() => { const c = G.cases.find(x => x.def.id === 'par'), r = cv.getBoundingClientRect(), s = worldToScreen(c.body.position, caseZ(c) + caseH(c)); return { x: r.left + s.x, y: r.top + s.y }; });
        if (name === 'tel') await p.touchscreen.tap(pt.x, pt.y); else await p.mouse.click(pt.x, pt.y);
        await p.waitForTimeout(200);
      };
      const sBefore = await sc();
      await tap();
      // scena piccola e case vicini: il primo tocco avvicina la scena lì (come nel montaggio)
      if (sBefore < 0.6 && !(await p.evaluate(() => G.sel.ce))) {
        check(await sc() >= 0.59, name + ': a zoom ' + z + ' il tocco fra case vicini non avvicina la scena');
        await tap();
      }
      const got = await p.evaluate(() => G.sel.ce && G.sel.ce.def.id);
      check(got === 'par', name + ': a zoom ' + z + ' il tocco sceglie ' + got + ' invece del PAR');
    }
    // 5. scena piccola, dito nello spazio fra due case vicini: si avvicina, non sceglie
    if (name === 'tel') {
      await p.evaluate(() => { G.cam.zoom = 1; cancelSel(); const a = G.cases.find(x => x.def.id === 'top1').body.position; G.cam.manual = { x: a.x, y: a.y }; });
      await p.waitForTimeout(400);
      // un punto dello schermo fuori da ogni case ma a un dito da almeno due
      const pt = await p.evaluate(() => {
        const r = cv.getBoundingClientRect(), m = Math.max(6, TAP_PX / G.cam.scale);
        for (let y = H * 0.25; y < H * 0.75; y += 2) for (let x = 20; x < W - 20; x += 2) {
          const d = G.cases.filter(c => !c.hidden).map(c => caseScreenDist(c, { x, y })).filter(d => d <= m);
          const wk = G.workers.every(w => { for (let z = 0; z <= 160; z += 10) if (len(sub(screenToWorld({ x, y }, z), w.body.position)) - w.r <= m) return false; return true; });
          if (d.length > 1 && Math.min(...d) > 2 && wk) return { x: r.left + x, y: r.top + y, s0: G.cam.scale };
        }
        return null;
      });
      check(pt, 'tel: nessun punto fra due case per provare l\'avvicinamento');
      if (pt) {
        await p.touchscreen.tap(pt.x, pt.y); await p.waitForTimeout(200);
        const r = await p.evaluate(() => ({ s: G.cam.scale, sel: G.sel.ce && G.sel.ce.def.id }));
        check(pt.s0 < 0.3 && r.s >= 0.59 && !r.sel, 'tel: il tocco fra due case a scena piccola non avvicina (' + JSON.stringify(r) + ')');
      }
    }
    await ctx.close();
  }
  await b.close();
  console.log('PROBLEMI:', JSON.stringify(problems));
  console.log('ERRORI JS:', JSON.stringify(errs));
  if (problems.length || errs.length) process.exit(1);
  console.log('OK');
})();
