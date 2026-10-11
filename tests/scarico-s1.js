/* Lo scarico nella vista S1 (dall'alto inclinata): cambia solo il disegno.
   Prova che i case si scelgono toccando il coperchio e la faccia davanti
   (non solo l'impronta per terra), che le persone si scelgono toccando la
   testa, che schermo e pianta tornano uno nell'altro, che le persone sono
   le figure dell'atlante (Topsy e Macio dal loro modello 3D, Macio con la
   sua maglietta nera, senza tinta) e che senza atlante c'è il ripiego (la foto di Topsy), senza errori.

   Uso:  node tests/scarico-s1.js
   Richiede Playwright. Senza rete, MATTER_PATH=/percorso/matter.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const problems = [], errs = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  const page = async (opts, noPhoto) => {
    const ctx = await b.newContext(opts);
    const p = await ctx.newPage();
    if (process.env.MATTER_PATH) await p.route('**/matter.min.js', r => r.fulfill({ path: process.env.MATTER_PATH, contentType: 'application/javascript' }));
    if (noPhoto) { await p.route('**/topsy-s1.png', r => r.abort()); await p.route('**/*-atlante.webp', r => r.abort()); }
    await p.route(/fonts\./, r => r.abort());
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.join(__dirname, '..', 'scarico.html'));
    await p.click('#btn-start');
    await p.waitForFunction(() => G && G.mode === 'play');
    return p;
  };
  const waitIdle = p => p.waitForFunction(() => !busy(G.player) && !busy(G.macio) && !G.van.anim, null, { timeout: 30000 });
  // un punto del mondo (a un'altezza z) sullo schermo, con la telecamera ferma lì
  const at = async (p, id, z) => {
    await p.evaluate(id => { const c = G.cases.find(x => x.def.id === id).body.position; G.cam.manual = { x: c.x, y: c.y }; }, id);
    await p.waitForTimeout(500);
    return p.evaluate(([id, z]) => {
      const c = G.cases.find(x => x.def.id === id), r = document.querySelector('canvas').getBoundingClientRect();
      const s = worldToScreen(c.body.position, z === 'top' ? caseZ(c) + caseH(c) : z);
      return { x: r.left + s.x, y: r.top + s.y };
    }, [id, z]);
  };

  /* 1. COMPUTER: coperchio, faccia davanti, testa */
  {
    const p = await page({ viewport: { width: 1300, height: 900 } });
    for (let i = 0; i < 3; i++) { await p.waitForSelector('#cmd-act button.van', { timeout: 20000 }); await p.click('#cmd-act button.van'); await p.waitForTimeout(300); await waitIdle(p); }
    // quale case prende il tocco (anche se è ancora bloccato da quelli davanti)
    await p.evaluate(() => { window.selectCase = ce => { window.tapped = ce.def.id; }; });
    const tapped = () => p.evaluate(() => { const t = window.tapped; window.tapped = null; return t; });
    // andata e ritorno schermo ↔ pianta, a varie altezze
    const rt = await p.evaluate(() => [0, 50, 120].every(z => { const q = { x: 900, y: 500 }, s = screenToWorld(worldToScreen(q, z), z); return Math.abs(s.x - q.x) < 1e-6 && Math.abs(s.y - q.y) < 1e-6; }));
    check(rt, 'schermo e pianta non tornano uno nell\'altro');
    // il rack (alto 96 cm): toccato sul coperchio, che a schermo sta sopra l'impronta
    const top = await at(p, 'rack', 'top'), base = await at(p, 'rack', 0);
    check(base.y - top.y > 30, 'il coperchio del rack non sta più in alto della sua impronta: ' + JSON.stringify([top, base]));
    await p.mouse.click(top.x, top.y + 4);
    check(await tapped() === 'rack', 'toccando il coperchio del rack non si sceglie il rack');
    // il case PAR: toccato a metà della faccia davanti
    const par = await p.evaluate(() => { const c = G.cases.find(x => x.def.id === 'par'), r = document.querySelector('canvas').getBoundingClientRect(); const s = worldToScreen({ x: c.body.position.x, y: c.body.position.y + c.def.h / 2 - 2 }, caseH(c) / 2); return { x: r.left + s.x, y: r.top + s.y }; });
    await p.mouse.click(par.x, par.y);
    check(await tapped() === 'par', 'toccando la faccia davanti del case PAR non si sceglie');
    // Macio: toccato sulla testa
    const head = await p.evaluate(() => { G.cam.manual = { x: G.macio.body.position.x, y: G.macio.body.position.y }; return true; });
    await p.waitForTimeout(500);
    const hs = await p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(), s = worldToScreen(G.macio.body.position, 150); return { x: r.left + s.x, y: r.top + s.y }; });
    await p.mouse.click(hs.x, hs.y);
    check(head && await p.evaluate(() => G.sel.who === G.macio), 'toccando la testa di Macio non si sceglie Macio');
    // le persone sono le figure dell'atlante, 8 direzioni × (fermo + passi) per ogni posa
    const atl = await p.evaluate(() => ['topsy', 'macio', 'gerry', 'kid', 'kid2'].map(w => {
      const f = figAtlas(w); if (!f) return w + ': non pronto';
      const bad = Object.entries(f.A.poses).filter(([, d]) => d.length !== 8 || d.some(r => r.length !== FIG_ATLAS.WALK + 1)).map(([k]) => k);
      return bad.length ? w + ': pose incomplete ' + bad : '';
    }).filter(Boolean));
    check(!atl.length, 'atlanti delle figure: ' + atl.join('; '));
    check(await p.evaluate(() => ['giu', 'avanti', 'porta'].every(k => FIG_ATLAS.figs.topsy.poses[k] && FIG_ATLAS.figs.macio.poses[k])), 'mancano pose di Topsy o di Macio');
    // Macio viene dal suo modello 3D: niente maschera da tingere, l'atlante è l'immagine così com'è
    check(await p.evaluate(() => !FIG_ATLAS.figs.macio.mask && figAtlas('macio').img instanceof HTMLImageElement), 'Macio non è la figura del suo modello 3D');
    // si disegna davvero dall'atlante: un fotogramma passa da drawAtlas
    check(await p.evaluate(() => { let n = 0; const f = window.drawAtlas; window.drawAtlas = function () { n++; return f.apply(this, arguments); }; render(); window.drawAtlas = f; return n >= 2; }), 'Topsy e Macio non si disegnano dall\'atlante');
    // il ripiego c'è sempre: la foto di Topsy
    check(await p.evaluate(() => TOPSY_IMG.complete && TOPSY_IMG.naturalWidth > 0), 'la foto di Topsy non si carica');
    await p.close();
  }

  /* 2. TELEFONO senza la foto: il ripiego, nessun errore, il tocco va */
  {
    const p = await page({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, true);
    for (let i = 0; i < 3; i++) { await p.waitForSelector('#cmd-act button.van', { timeout: 20000 }); await p.tap('#cmd-act button.van'); await p.waitForTimeout(300); await waitIdle(p); }
    await p.waitForTimeout(600);
    check(await p.evaluate(() => !(TOPSY_IMG.naturalWidth > 0)), 'la foto di Topsy c\'è anche se bloccata');
    check(await p.evaluate(() => !figAtlas('topsy') && !figAtlas('macio')), 'l\'atlante c\'è anche se bloccato');
    await p.evaluate(() => render());
    const top = await at(p, 'stativi', 'top');
    await p.touchscreen.tap(top.x, top.y + 3);
    check(await p.evaluate(() => G.sel.ce && G.sel.ce.def.id === 'stativi'), 'sul telefono toccando il coperchio della borsa stativi non si sceglie');
    await p.close();
  }

  await b.close();
  console.log('PROBLEMI:', JSON.stringify(problems));
  console.log('ERRORI JS:', JSON.stringify(errs));
  if (problems.length || errs.length) process.exit(1);
  console.log('SCARICO S1 OK');
})();
