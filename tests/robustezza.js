/* Robustezza del montaggio: le cose che i giocatori fanno senza pensarci.
   Frecce e WASD muovono la vista senza errori; una partita salvata col
   telefono e ripresa al computer (e viceversa) ha ogni pezzo sulla sua
   cella, anche quelli montati sopra un altro; Annulla dopo un reset rimette
   giro e prove, Ripeti li riazzera; l'Annulla tiene gli ultimi passi senza
   crescere all'infinito; un file importato con pezzi sconosciuti viene
   rifiutato; i minigiochi ricevono volume ed «Effetti ridotti»; chiudere
   il pannello posteriore sotto il menù non riattiva la scena.

   Uso:  node tests/robustezza.js
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); };
const errs = [];

async function open (b, viewport, save) {
  const ctx = await b.newContext({ viewport });
  // il salvataggio di un altro dispositivo, solo al primo caricamento
  if (save) await ctx.addInitScript(s => { if (!sessionStorage.getItem('rob')) { localStorage.setItem('scs-save', s); sessionStorage.setItem('rob', '1'); } }, save);
  const p = await ctx.newPage();
  if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL);
  await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  await p.waitForTimeout(300);
  return { p, ctx };
}
async function newGame (p) {
  await p.locator('#player-input').fill('Robusto');
  await p.locator('#service-offers .offer-card').first().click();
  await p.locator('#new-start').click();
  await p.waitForTimeout(150);
  await p.evaluate(() => { settings().skipScarico = true; });
  await p.locator('#schedule-go').click();
  await p.waitForTimeout(300);
}
// dove sta disegnato ogni pezzo e dove dovrebbe stare con la misura di adesso
const layout = p => p.evaluate(() => Object.values(gameState.placed).map(c => {
  const v = window.__scene.compVisuals[c.id], m = MOUNTS[c.type], base = m && gameState.placed[c[m.back]];
  let want;
  if (c.type === 'allaccio') want = allaccioPos();
  else if (c.gx != null) { const k = compCenter(c); want = gridToScreen(k.gx, k.gy); }
  else if (base) { const bv = window.__scene.compVisuals[base.id].container; want = { x: bv.x + (m.offsetX ? m.offsetX() : 0), y: bv.y + m.offsetY() }; }
  return { id: c.id, x: Math.round(v.container.x), y: Math.round(v.container.y), wx: Math.round(want.x), wy: Math.round(want.y) };
}));
const offCell = l => l.filter(c => Math.abs(c.x - c.wx) > 1 || Math.abs(c.y - c.wy) > 1);

(async () => {
  const b = await chromium.launch();

  // ---- frecce e WASD: la vista si sposta e il gioco continua
  {
    const { p, ctx } = await open(b, { width: 1300, height: 900 });
    await newGame(p);
    const x0 = await p.evaluate(() => window.__scene.cameras.main.scrollX);
    await p.keyboard.down('ArrowRight'); await p.waitForTimeout(300); await p.keyboard.up('ArrowRight');
    const y0 = await p.evaluate(() => window.__scene.cameras.main.scrollY);
    await p.keyboard.down('s'); await p.waitForTimeout(300); await p.keyboard.up('s');
    const f0 = await p.evaluate(() => window.__scene.game.loop.frame);
    await p.waitForTimeout(400);
    const after = await p.evaluate(() => ({ x: window.__scene.cameras.main.scrollX, y: window.__scene.cameras.main.scrollY, f: window.__scene.game.loop.frame }));
    check(after.x > x0, 'la freccia destra non sposta la vista');
    check(after.y > y0, 'S non sposta la vista');
    check(after.f > f0, 'dopo i tasti il gioco si è fermato');
    await ctx.close();
  }

  // ---- telefono → computer → telefono: ogni pezzo sulla sua cella
  {
    const { p, ctx } = await open(b, { width: 390, height: 844 });
    await newGame(p);
    await p.evaluate(() => {
      const s = window.__scene, at = (gx, gy) => gridToScreen(gx + 0.25, gy + 0.25);
      let w = at(4.5, 2.5); s.placeComponentAt('quadro', w.x, w.y);
      w = at(2.5, 8.5); s.placeComponentAt('sub', w.x, w.y);
      const sub = gameState.placed.sub_1.screen; s.placeComponentAt('top', sub.x, sub.y);
      w = at(1, 8.5); s.placeComponentAt('stativo', w.x, w.y);
      const st = Object.values(gameState.placed).find(c => c.type === 'stativo').screen; s.placeComponentAt('par', st.x, st.y);
    });
    await p.waitForTimeout(300);
    const placed = await p.evaluate(() => Object.keys(gameState.placed).sort());
    check(['par_1', 'quadro_1', 'stativo_1', 'sub_1', 'top_1'].every(id => placed.includes(id)), 'pezzi non posati per la prova: ' + placed);
    check(!offCell(await layout(p)).length, 'telefono: pezzi fuori posto già prima di salvare');
    await p.evaluate(() => Profile.flush());
    const phoneSave = await p.evaluate(() => localStorage.getItem('scs-save'));
    await ctx.close();

    const pc = await open(b, { width: 1300, height: 900 }, phoneSave);
    await pc.p.evaluate(() => continueGame());
    await pc.p.waitForTimeout(400);
    const lPc = await layout(pc.p);
    check(lPc.length >= 6, 'al computer la partita non è ripresa: ' + lPc.map(c => c.id));
    check(!offCell(lPc).length, 'al computer pezzi fuori dalla loro cella: ' + JSON.stringify(offCell(lPc)));
    await pc.p.evaluate(() => Profile.flush());
    const pcSave = await pc.p.evaluate(() => localStorage.getItem('scs-save'));
    await pc.ctx.close();

    const back = await open(b, { width: 390, height: 844 }, pcSave);
    await back.p.evaluate(() => continueGame());
    await back.p.waitForTimeout(400);
    const lBack = await layout(back.p);
    check(!offCell(lBack).length, 'di nuovo al telefono, pezzi fuori dalla loro cella: ' + JSON.stringify(offCell(lBack)));
    await back.ctx.close();
  }

  // ---- reset, Annulla, Ripeti; cronologia; import; minigiochi; scena coperta
  {
    const { p, ctx } = await open(b, { width: 1300, height: 900 });
    await newGame(p);
    await p.evaluate(() => {
      const w = gridToScreen(4.75, 2.75); window.__scene.placeComponentAt('quadro', w.x, w.y);
      gameState.giro = 2; gameState.giroFails = [1, 0, 0]; gameState.stats.tests = 3; gameState.trips = 1; updateGiroUI();
    });
    await p.locator('#reset-btn').click();
    await p.waitForTimeout(150);
    const zero = await p.evaluate(() => ({ giro: gameState.giro, tests: gameState.stats.tests, pezzi: Object.keys(gameState.placed).length }));
    check(zero.giro === 0 && zero.tests === 0 && zero.pezzi === 1, 'il reset non azzera: ' + JSON.stringify(zero));
    await p.locator('#undo-btn').click();
    await p.waitForTimeout(150);
    const undone = await p.evaluate(() => ({ giro: gameState.giro, fails: gameState.giroFails, tests: gameState.stats.tests, trips: gameState.trips, quadro: !!gameState.placed.quadro_1, saved: Profile.data.level.giro }));
    check(undone.giro === 2 && undone.fails[0] === 1 && undone.tests === 3 && undone.trips === 1 && undone.quadro, 'Annulla dopo il reset non rimette giro e prove: ' + JSON.stringify(undone));
    check(undone.saved === 2, 'il giro rimesso dall\'Annulla non è salvato: ' + undone.saved);
    await p.locator('#redo-btn').click();
    await p.waitForTimeout(150);
    const redone = await p.evaluate(() => ({ giro: gameState.giro, tests: gameState.stats.tests, quadro: !!gameState.placed.quadro_1 }));
    check(redone.giro === 0 && redone.tests === 0 && !redone.quadro, 'Ripeti del reset non riazzera: ' + JSON.stringify(redone));

    const hist = await p.evaluate(() => { const s = window.__scene; for (let i = 0; i < 350; i++) s.pushHistory(); return { n: s.history.length, i: s.historyIndex }; });
    check(hist.n === 200 && hist.i === 199, 'la cronologia non si ferma a 200 passi: ' + JSON.stringify(hist));
    const pts = await p.evaluate(() => JSON.stringify(Profile.data.level).includes('_pts') || window.__scene.history.some(h => JSON.stringify(h.edges).includes('_pts')));
    check(!pts, 'la linea disegnata dei cavi finisce nel salvataggio');

    // un file importato: buono passa, con un pezzo o un cavo sconosciuto no
    const imp = await p.evaluate(() => {
      Profile.flush();
      const good = { kind: SAVE_FILE_KIND, v: SAVE_VERSION, slot: JSON.parse(JSON.stringify(Profile.data)) };
      const bad = JSON.parse(JSON.stringify(good)); bad.slot.level.placed.razzo_1 = { id: 'razzo_1', type: 'razzo', gx: 1, gy: 9, screen: { x: 0, y: 0 } };
      const badEdge = JSON.parse(JSON.stringify(good)); badEdge.slot.level.edges.push({ id: 99, a: 'allaccio', aPort: 'x', b: 'nessuno', bPort: 'y', signal: 'xlr' });
      return [good, bad, badEdge].map(f => !!readSlotFile(JSON.stringify(f)).error);
    });
    check(!imp[0], 'un file buono viene rifiutato');
    check(imp[1], 'un file con un pezzo sconosciuto viene accettato');
    check(imp[2], 'un file con un cavo verso un pezzo che non c\'è viene accettato');

    // volume ed effetti ridotti arrivano ai minigiochi
    const q = await p.evaluate(() => { settings().volume = 0; settings().reducedFx = true; return minigameQuery(); });
    check(q === '&vol=0&rfx=1', 'impostazioni per i minigiochi sbagliate: ' + q);
    const dj = await ctx.newPage();
    await dj.goto('file://' + path.join(__dirname, '..', 'dj.html') + '?vol=0&rfx=1');
    await dj.waitForTimeout(300);
    check(await dj.evaluate(() => document.getElementById('song').volume) === 0, 'il brano del DJ suona anche a volume 0');
    check(await dj.evaluate(() => document.getElementById('strobe-btn').getAttribute('aria-pressed')) === 'false', 'con Effetti ridotti lo strobo del DJ parte vero');
    await dj.close();

    // il pannello posteriore chiuso mentre è aperto il menù: la scena resta ferma
    await p.evaluate(() => { openMenu(); rearPanelId = 'quadro_1'; closeRearPanel(); });
    await p.waitForTimeout(100);
    check(!(await p.evaluate(() => window.__scene.input.enabled)), 'chiuso il pannello sotto al menù, la scena riprende i tocchi');
    await ctx.close();
  }

  await b.close();
  console.log('PROBLEMI:', problems);
  console.log('ERRORI JS:', [...new Set(errs)]);
  if (problems.length || errs.length) { console.log('ROBUSTEZZA KO'); process.exit(1); }
  console.log('ROBUSTEZZA OK');
})().catch(e => { console.error(e); process.exit(1); });
