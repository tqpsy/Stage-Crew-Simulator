/* Il tavolo regia si posa in tutto l'Off Stage: un pezzo già posato lì
   (ciabatta, ciabatta CEE, stativo del taglio) non deve impedirlo, finché
   resta un posto dove il tavolo non lo copre. E con il tavolo armato un
   tocco sul bordo dell'Off Stage, accanto al baule dei cavi, posa il tavolo
   invece di aprire il baule.

   Uso:  node tests/tavolo-regia.js
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
  if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  await p.evaluate(() => startNewGame('Tavolo', serviceOffers([])[0]));
  await p.waitForFunction(() => !menuOpen);
  await p.evaluate(() => { closeSchedule(); finishScarico({ skipped: true }); settings().bossTips = false; });
  await p.waitForTimeout(400);
  const problems = await p.evaluate(() => {
    const S = window.__scene, out = [];
    // un pezzo in ogni cella dell'Off Stage, uno alla volta: il tavolo ci sta?
    ['ciabatta', 'ciabatta_cee', 'stativo'].forEach(ty => {
      for (let gx = 6; gx < 9; gx += 0.5) for (let gy = 4; gy < 8; gy += 0.5) {
        S.resetLevel(true);
        const w = gridToScreen(gx + 0.25, gy + 0.25); S.placeComponentAt(ty, w.x, w.y);
        const c = placedOfType(ty)[0];
        if (!c || !isOffStageCell(c.gx, c.gy)) continue;
        const q = gridToScreen(7.5, 6); S.placeComponentAt('tavolo', q.x, q.y);
        const t = placedOfType('tavolo')[0];
        if (!t) out.push(ty + ' in ' + c.gx + ',' + c.gy + ': il tavolo non si posa');
        else if (S.hiddenByTable(ty, S.compVisuals[c.id].container, c.id)) out.push(ty + ' in ' + c.gx + ',' + c.gy + ': il tavolo lo copre');
      }
    });
    // tavolo armato, tocco accanto al baule dei cavi sul bordo dell'Off Stage
    S.resetLevel(true);
    gameState.giro = 1; updateGiroUI();
    armPiece('tavolo', null);
    return out;
  });
  const pt = await p.evaluate(() => {
    const S = window.__scene, w = gridToScreen(8.75, 4.6), cam = S.cameras.main;
    const r = S.game.canvas.getBoundingClientRect();
    return { x: r.left + (w.x - cam.worldView.x) * cam.zoom * r.width / GAME_W, y: r.top + (w.y - cam.worldView.y) * cam.zoom * r.height / GAME_H };
  });
  await p.mouse.click(pt.x, pt.y);
  await p.waitForTimeout(300);
  if (!(await p.evaluate(() => placedOfType('tavolo').length === 1))) problems.push('tocco accanto al baule dei cavi: il tavolo non si posa');
  await b.close();
  problems.push(...errs.map(e => 'errore: ' + e));
  if (problems.length) { console.log('PROBLEMI:\n' + problems.join('\n')); process.exit(1); }
  console.log('OK: il tavolo regia si posa in tutto l\'Off Stage');
})();
