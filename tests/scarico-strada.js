/* La strada disegnata col dito nello scarico: scelto un case la scena si
   allarga su case e zone; trascinando dal case si disegna la strada, il
   tempo resta fermo finché non si dice VAI; chi porta passa dai punti della
   linea (un giro largo verso l'albero) e posa il case nella zona.
   Prova col mouse sul computer e coi tocchi veri sul telefono.

   Uso:  node tests/scarico-strada.js
   Richiede Playwright. Senza rete, MATTER_PATH=/percorso/matter.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const problems = [], errs = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  const WPS = [{ x: 880, y: 500 }, { x: 960, y: 820 }, { x: 1100, y: 820 }, { x: 1100, y: 500 }, { x: 1260, y: 500 }];
  for (const tel of [false, true]) {
    const ctx = await b.newContext(tel ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1300, height: 900 } });
    const p = await ctx.newPage();
    if (process.env.MATTER_PATH) await p.route('**/matter.min.js', r => r.fulfill({ path: process.env.MATTER_PATH, contentType: 'application/javascript' }));
    await p.route(/fonts\./, r => r.abort());
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.join(__dirname, '..', 'scarico.html'));
    await p.click('#btn-start');
    await p.waitForFunction(() => G && G.mode === 'play');
    const waitIdle = () => p.waitForFunction(() => !busy(G.player) && !busy(G.macio) && !G.van.anim, null, { timeout: 60000 });
    for (let i = 0; i < 3; i++) { await p.waitForSelector('#cmd-act button.van', { timeout: 20000 }); await p.click('#cmd-act button.van'); await p.waitForTimeout(300); await waitIdle(); }
    const cdp = tel && await ctx.newCDPSession(p);
    const down = async (x, y) => tel ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }) : (await p.mouse.move(x, y), p.mouse.down());
    const move = async (x, y) => tel ? cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }) : p.mouse.move(x, y);
    const up = async () => tel ? cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) : p.mouse.up();
    const scr = (w, z) => p.evaluate(([w, z]) => { const r = document.querySelector('canvas').getBoundingClientRect(); const s = worldToScreen(w, z); return { x: r.left + s.x, y: r.top + s.y }; }, [w, z || 0]);
    const caseScr = () => p.evaluate(() => { const c = G.cases.find(x => x.def.id === 'stativi'), r = document.querySelector('canvas').getBoundingClientRect(), s = worldToScreen(c.body.position, caseZ(c) + caseH(c) / 2); return { x: r.left + s.x, y: r.top + s.y }; });
    const z0 = await p.evaluate(() => G.cam.zoom);
    let c = await caseScr();
    await down(c.x, c.y); await up();
    await p.waitForTimeout(300);
    const v = await p.evaluate(() => {
      const r = document.querySelector('canvas').getBoundingClientRect(), pts = [];
      for (const k in ZONES) { const z = ZONES[k]; pts.push({ x: z.x, y: z.y }, { x: z.x + z.w, y: z.y + z.h }); }
      return { sel: G.sel.ce && G.sel.ce.def.id, zoom: G.cam.zoom, inView: pts.every(q => { const s = worldToScreen(q); return s.x > 0 && s.x < r.width && s.y > 0 && s.y < r.height; }) };
    });
    check(v.sel === 'stativi', (tel ? 'telefono' : 'computer') + ': la borsa stativi non si sceglie');
    check(v.zoom <= z0 && v.inView, (tel ? 'telefono' : 'computer') + ': scelto il case la scena non mostra tutte le zone: ' + JSON.stringify(v));
    // il disegno: dal case, un giro largo verso l'albero, poi in Pit
    c = await caseScr();
    const zone = await p.evaluate(() => { const z = ZONES.pit; return { x: z.x + z.w / 2, y: z.y + z.h / 2 }; });
    await down(c.x, c.y);
    let prev = await p.evaluate(() => ({ x: G.sel.ce.body.position.x, y: G.sel.ce.body.position.y }));
    for (const w of [...WPS, zone]) { for (let t = 0.1; t <= 1.001; t += 0.1) { const q = await scr({ x: prev.x + (w.x - prev.x) * t, y: prev.y + (w.y - prev.y) * t }); await move(q.x, q.y); await p.waitForTimeout(10); } prev = w; }
    const t0 = await p.evaluate(() => G.t);
    await up(); await p.waitForTimeout(400);
    const pl = await p.evaluate(() => ({ plan: !!G.plan, zone: G.plan && G.plan.dest.zone, t: G.t, busy: busy(G.player), btn: $('#cmd-act').textContent }));
    check(pl.plan && pl.zone === 'pit' && /VAI IN PIT/.test(pl.btn) && /RIDISEGNA/.test(pl.btn), (tel ? 'telefono' : 'computer') + ': finito il disegno non c\'è VAI IN PIT: ' + JSON.stringify(pl));
    check(pl.t === t0 && !pl.busy, (tel ? 'telefono' : 'computer') + ': con la strada da confermare il tempo va avanti o si parte da soli');
    await p.click('#cmd-act button.go');
    let maxY = 0;
    for (let i = 0; i < 600 && await p.evaluate(() => busy(G.player)); i++) { maxY = Math.max(maxY, await p.evaluate(() => G.player.body.position.y)); await p.waitForTimeout(100); }
    const end = await p.evaluate(() => ({ zone: G.cases.find(x => x.def.id === 'stativi').zone, zoom: G.cam.zoom }));
    check(end.zone === 'pit', (tel ? 'telefono' : 'computer') + ': la borsa stativi non è finita in Pit: ' + end.zone);
    check(maxY > 650, (tel ? 'telefono' : 'computer') + ': non ha fatto il giro disegnato (y massima ' + Math.round(maxY) + ')');
    check(Math.abs(end.zoom - z0) < 1e-6, (tel ? 'telefono' : 'computer') + ': dopo l\'ordine lo zoom non è tornato com\'era');
    await ctx.close();
  }
  await b.close();
  console.log('PROBLEMI:', problems);
  console.log('ERRORI JS:', errs);
  if (problems.length || errs.length) process.exit(1);
  console.log('STRADA DISEGNATA OK');
})();
