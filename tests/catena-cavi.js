/* Cablaggio con meno tocchi: con un cavo in mano, toccare il dispositivo
   da collegare lo collega subito se ha una sola presa adatta libera; dopo
   un faro collegato dal suo DMX IN il cavo resta in mano nel DMX THRU, così
   la cascata DMX (o PowerCON) si fa toccando un faro dopo l'altro. Con più
   prese da scegliere (Quadro, mixer) si apre il pannello come prima.

   Uso:  node tests/catena-cavi.js
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
const OUT = process.env.SHOTS || null;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const problems = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  await ev(() => startNewGame('Catena', serviceOffers([])[0]));
  await p.waitForFunction(() => !menuOpen);
  await ev(() => { closeSchedule(); finishScarico({ skipped: true }); settings().bossTips = false; });

  const ids = await ev(() => {
    const S = window.__scene;
    const P = (ty, gx, gy) => { const w = gridToScreen(gx + .5, gy + .5); S.placeComponentAt(ty, w.x, w.y); };
    const on = (ty, base) => { const v = S.compVisuals[base].container; S.placeComponentAt(ty, v.x, v.y); };
    P('tavolo', 7, 5);
    const T = placedOfType('tavolo')[0].id;
    ['mixer', 'controller'].forEach(ty => on(ty, T));
    [[1, 9], [4, 9], [7, 9]].forEach(s => P('stativo', ...s));
    placedOfType('stativo').forEach(st => on('par', st.id));
    P('sub', 1, 6);
    return { CT: placedOfType('controller')[0].id, MX: placedOfType('mixer')[0].id, SUB: placedOfType('sub')[0].id,
      ST: placedOfType('stativo').map(c => c.id), PAR: placedOfType('par').map(c => c.id) };
  });

  // 1) primo capo dal pannello della consolle, poi un tocco sullo stativo del primo faro
  const one = await ev(({ CT, ST, PAR }) => {
    const S = window.__scene;
    selectCable('dmx');
    openRearPanel(CT); onRearPortClick(CT, 'dmx_1');
    const picked = !!gameState.pendingPort && !rearPanelId;
    tapDevice(ST[0]);
    const e = gameState.edges[gameState.edges.length - 1];
    const pend = gameState.pendingPort;
    return { picked, edge: e && [e.a, e.aPort, e.b, e.bPort], panel: el('#rear-modal').classList.contains('show'),
      lay: !!S.lay, pend: pend && [pend.componentId, pend.portId, !!pend.auto], cable: gameState.selectedCable,
      hint: el('#lay-text').textContent };
  }, ids);
  check(one.picked, 'il primo capo non resta in mano: ' + JSON.stringify(one));
  check(JSON.stringify(one.edge) === JSON.stringify([ids.CT, 'dmx_1', ids.PAR[0], 'dmx_in']), 'il tocco sul faro non collega il DMX IN: ' + JSON.stringify(one));
  check(!one.panel, 'il pannello del faro si apre anche se la presa è una sola');
  check(one.lay, 'il cavo appena collegato non resta da stendere');
  check(JSON.stringify(one.pend) === JSON.stringify([ids.PAR[0], 'dmx_thru', true]), 'il cavo non resta pronto nel DMX THRU: ' + JSON.stringify(one));
  check(one.cable === 'dmx', 'il cavo DMX non resta selezionato: ' + one.cable);
  check(/tocca il prossimo in verde/.test(one.hint), 'la barra del cavo non dice come continuare: ' + one.hint);
  if (OUT) await p.screenshot({ path: path.join(OUT, 'catena-1-dopo-primo-faro.png') });

  // 2) tocco vero sul secondo faro mentre il cavo è da stendere: continua la catena
  const pt = await ev(id => {
    const s = window.__scene, v = s.compVisuals[id].container, cam = s.cameras.main, r = s.game.canvas.getBoundingClientRect();
    return { x: r.left + (v.x - cam.worldView.x) * cam.zoom * r.width / GAME_W, y: r.top + (v.y - cam.worldView.y) * cam.zoom * r.height / GAME_H };
  }, ids.PAR[1]);
  await p.waitForTimeout(400);   // la vista che scivola sul cavo
  const pt2 = await ev(id => {
    const s = window.__scene, v = s.compVisuals[id].container, cam = s.cameras.main, r = s.game.canvas.getBoundingClientRect();
    return { x: r.left + (v.x - cam.worldView.x) * cam.zoom * r.width / GAME_W, y: r.top + (v.y - cam.worldView.y) * cam.zoom * r.height / GAME_H };
  }, ids.PAR[1]);
  await p.touchscreen.tap(pt2.x, pt2.y);
  await p.waitForTimeout(300);
  const two = await ev(() => { const e = gameState.edges[gameState.edges.length - 1], pend = gameState.pendingPort;
    return { n: gameState.edges.length, edge: e && [e.a, e.aPort, e.b, e.bPort], pend: pend && [pend.componentId, pend.portId], toast: el('#toast').textContent, lay: !!window.__scene.lay }; });
  check(two.n === 2 && JSON.stringify(two.edge) === JSON.stringify([ids.PAR[0], 'dmx_thru', ids.PAR[1], 'dmx_in']),
    'il tocco sul secondo faro non continua la cascata: ' + JSON.stringify(two));
  check(JSON.stringify(two.pend) === JSON.stringify([ids.PAR[1], 'dmx_thru']), 'il cavo non passa al THRU del secondo faro: ' + JSON.stringify(two));
  if (OUT) await p.screenshot({ path: path.join(OUT, 'catena-2-secondo-faro.png') });

  // 3) ultimo faro: collegato, e senza altri fari liberi niente cavo pronto
  const three = await ev(({ PAR }) => { window.__scene.endLay(true); tapDevice(PAR[2]); const pend = gameState.pendingPort;
    return { n: gameState.edges.length, last: gameState.edges[gameState.edges.length - 1].b, pend: !!pend }; }, ids);
  check(three.n === 3 && three.last === ids.PAR[2] && !three.pend, 'ultimo faro: ' + JSON.stringify(three));

  // 4) catena PowerCON: col cavo pronto, un cavo diverso lo fa cadere
  const four = await ev(({ PAR, MX }) => {
    const S = window.__scene; S.endLay(true);
    selectCable('powercon');
    openRearPanel(PAR[0]); onRearPortClick(PAR[0], 'power_thru');
    tapDevice(PAR[1]);
    const chained = gameState.pendingPort && gameState.pendingPort.portId === 'power_thru' && gameState.pendingPort.componentId === PAR[1];
    // dal pannello, una presa scelta a mano riparte da lì (non lega il THRU)
    const n0 = gameState.edges.length;
    openRearPanel(PAR[2]); onRearPortClick(PAR[2], 'power_in');
    const q = gameState.pendingPort;
    const fresh = gameState.edges.length === n0 && !!q && q.componentId === PAR[2] && q.portId === 'power_in' && !q.auto;
    S.cancelPending(); S.endLay(true);
    selectCable('xlr');
    const dropped = !gameState.pendingPort;
    // col cavo pronto, il pannello di un altro dispositivo riparte da lì
    selectCable('powercon'); openRearPanel(PAR[0]); onRearPortClick(PAR[0], 'power_thru');
    closeRearPanel(); S.endLay(true);
    return { chained, fresh, dropped, n: gameState.edges.length };
  }, ids);
  check(four.chained && four.fresh && four.dropped, 'catena PowerCON o cambio di cavo: ' + JSON.stringify(four));

  // 5) più prese adatte (il mixer ha tanti ingressi XLR): si apre il pannello
  const five = await ev(({ MX, SUB }) => {
    const S = window.__scene; S.cancelPending();
    selectCable('speakon');
    openRearPanel(SUB); onRearPortClick(SUB, 'spk_thru');   // dal LINK della cassa
    closeRearPanel(); S.endLay(true);
    const n = gameState.edges.length;
    selectCable('xlr');
    tapDevice(MX);   // nessun capo in mano: il pannello si apre
    const open1 = el('#rear-modal').classList.contains('show'); closeRearPanel();
    return { open1, n, after: gameState.edges.length };
  }, ids);
  check(five.open1 && five.after === five.n, 'senza capo in mano il tocco deve aprire il pannello: ' + JSON.stringify(five));

  check(!errs.length, 'errori: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('ok: cascata DMX e PowerCON con un tocco per faro');
})();
