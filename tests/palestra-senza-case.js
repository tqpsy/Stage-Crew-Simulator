/* Palestra senza case: dopo lo scarico i case non si disegnano più in
   palestra (resta il furgone), ma i loro dati restano. Si verifica che:
   nella scena non ci siano case né etichette; i pulsanti SEGNALE e CORRENTE
   aprano il baule giusto; un cavo si prenda, si rimetta e si colleghi; il
   baule aggrovigliato abbia il segno sul pulsante e si sbrogli; i pezzi
   difettosi restino tali; la riga del case compaia; la dotazione tenga
   conto dei pezzi rotti; reset, annulla/ripristina, scarico saltato e
   salvataggio vecchio senza case vadano senza errori.

   Uso:  node tests/palestra-senza-case.js
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 1000 } });
  if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const problems = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  await ev(() => startNewGame('Palestra', serviceOffers([])[0]));
  await p.waitForFunction(() => !menuOpen);

  // scarico giocato: due PAR rotti (il case ricambi sano ne rimpiazza uno),
  // rack e baule CORRENTE difettosi, il Sub 1 ammaccato
  await ev(() => {
    closeSchedule();
    const c = (id, name, zone, at, state, dents) => ({ id, name, short: name, what: '', zone, at, state, dents });
    finishScarico({ minutes: 5, parsBroken: 2, ricOk: true, faultyIds: ['rack', 'corrente'], faulty: ['finale'], cases: [
      c('corrente', 'Generico CORRENTE', 'back', 'back', 'difettoso', 0), c('segnale', 'Generico SEGNALE', 'foh', 'foh', 'integro', 0),
      c('rack', 'Rack', 'foh', 'foh', 'difettoso', 1), c('sub1', 'Sub 1', 'pit', 'palco', 'ammaccato', 3), c('sub2', 'Sub 2', 'pit', 'pit', 'integro', 0),
      c('par', 'Case PAR', 'pit', 'pit', 'rotto', 2), c('ricambio', 'Accessori', 'palco', 'palco', 'integro', 0)
    ] });
    settings().bossTips = false;
  });
  await sleep(300);
  await ev(() => { const s = el('#phase-sign'); if (s) s.dispatchEvent(new PointerEvent('pointerdown')); });
  await sleep(500);

  // 1. nessun case in palestra: niente etichette dei case né oggetti della vecchia scena
  const scene = await ev(() => {
    const S = window.__scene;
    // (QUADRO no: è anche la scritta a terra del posto del Quadro in Backstage)
    const labels = ['CORRENTE', 'SEGNALE', 'SUB 1', 'SUB 2', 'TESTA 1', 'TESTA 2', 'RACK', 'PC', 'PAR', 'STATIVI', 'ACCESSORI'];
    const texts = S.children.list.filter(o => o.type === 'Text').map(o => o.text.replace(' · aperto', ''));
    return { found: texts.filter(t => labels.includes(t)), dock: S.dockCases !== undefined, pos: S.casePos !== undefined, van: !!S.van,
      cases: (Profile.data.scarico.cases || []).length, sub1: scaricoCase('sub1') };
  });
  check(!scene.found.length, 'etichette dei case ancora in palestra: ' + scene.found.join(', '));
  check(!scene.dock && !scene.pos, 'riferimenti alla vecchia scena dei case');
  check(scene.van, 'il furgone non c\'è più');
  check(scene.cases === 7 && scene.sub1 && scene.sub1.at === 'palco' && scene.sub1.dents === 3 && scene.sub1.state === 'ammaccato', 'dati dei case persi: ' + JSON.stringify(scene));

  // 2. dotazione: 2 PAR rotti, uno rimpiazzato dal case ricambi
  const st = await ev(() => ({ par: levelStock().par, full: AVAILABLE_STOCK.par, req: parsRequired(), stock: gameState.stock.par }));
  check(st.par === st.full - 1 && st.stock === st.par, 'dotazione PAR sbagliata: ' + JSON.stringify(st));

  // 3. pulsanti dei bauli: aprono il baule giusto, il CORRENTE aggrovigliato ha il segno
  await ev(() => document.querySelector('.tab-btn[data-tab="cavi"]').click());
  const marks = await ev(() => ({ corrente: document.querySelector('.case-btn[data-case="corrente"]').classList.contains('faulty'),
    segnale: document.querySelector('.case-btn[data-case="segnale"]').classList.contains('faulty') }));
  check(marks.corrente && !marks.segnale, 'segno del baule aggrovigliato: ' + JSON.stringify(marks));
  await p.click('.case-btn[data-case="segnale"]');
  const seg = await ev(() => ({ title: el('#case-title').textContent, show: el('#case-modal').classList.contains('show'), origin: el('#case-origin').textContent, tangled: el('#case-svg').classList.contains('tangled') }));
  check(seg.show && seg.title === 'Baule SEGNALE' && !seg.tangled && /GENERICO SEGNALE/.test(seg.origin), 'baule SEGNALE: ' + JSON.stringify(seg));
  await ev(() => closeCase());
  await p.click('.case-btn[data-case="corrente"]');
  const cor = await ev(() => ({ title: el('#case-title').textContent, tangled: el('#case-svg').classList.contains('tangled'), fault: !el('#case-fault').hidden }));
  check(cor.title === 'Baule CORRENTE' && cor.tangled && cor.fault, 'baule CORRENTE: ' + JSON.stringify(cor));
  // aggrovigliato: il cavo non si prende; sbrogliato sì
  const tang = await ev(() => { const coil = el('#case-svg .cc-coil'); coil.dispatchEvent(new MouseEvent('click')); return { sel: gameState.selectedCable }; });
  check(!tang.sel, 'cavo preso da un baule aggrovigliato');
  await ev(() => { closeCase(); fixFault('baule:corrente'); });
  check(!(await ev(() => document.querySelector('.case-btn[data-case="corrente"]').classList.contains('faulty'))), 'il segno resta dopo lo sbroglio');

  // 4. cavo preso, rimesso nel baule, poi preso e collegato (allaccio -> Quadro)
  const wire = await ev(() => {
    const S = window.__scene;
    const w = gridToScreen(4.5, 2.5); S.placeComponentAt('quadro', w.x, w.y);
    const Q = placedOfType('quadro')[0].id;
    const box = Object.keys(CABLE_CASES).find(k => CABLE_CASES[k].items.some(it => it.cable === 'cee_tri'));
    const take = () => { openCase(box); el('#case-svg .cc-coil[data-cable="cee_tri"]').dispatchEvent(new MouseEvent('click')); };
    take(); const held = gameState.selectedCable;
    take(); const back = gameState.selectedCable;
    take();
    const n = gameState.edges.length;
    openRearPanel('allaccio'); onRearPortClick('allaccio', 'out');
    openRearPanel(Q); onRearPortClick(Q, 'in');
    if (rearPanelId) closeRearPanel();
    return { box, held, back, added: gameState.edges.length - n };
  });
  check(wire.box === 'corrente' && wire.held === 'cee_tri' && !wire.back && wire.added === 1, 'cavo: ' + JSON.stringify(wire));

  // 5. pezzi dai case: finale difettoso dal rack, riga del case sul sub ammaccato
  const pieces = await ev(() => {
    const S = window.__scene;
    let w = gridToScreen(7.5, 5.5); S.placeComponentAt('tavolo', w.x, w.y);
    const v = S.compVisuals[placedOfType('tavolo')[0].id].container; S.placeComponentAt('ampli', v.x, v.y);
    const am = placedOfType('ampli')[0].id;
    w = gridToScreen(1.5, 8.5); S.placeComponentAt('sub', w.x, w.y);
    const sub = placedOfType('sub')[0].id;
    openRearPanel(sub);
    const origin = (el('#rear-origin') || {}).textContent || '';
    closeRearPanel();
    const marks = S.faultMarks.length;
    return { faulty: isFaulty(am), from: (caseOfPiece(am) || {}).id, sub: (caseOfPiece(sub) || {}).id, origin, marks, toast: el('#toast').textContent };
  });
  check(pieces.faulty && pieces.from === 'rack' && pieces.sub === 'sub1' && pieces.marks >= 2, 'pezzi dai case: ' + JSON.stringify(pieces));
  check(/SUB 1/.test(pieces.origin) || /CASE SUB 1/.test(pieces.toast), 'riga del case assente: ' + JSON.stringify(pieces));
  const fixed = await ev(() => { fixFault('ampli'); return isFaulty(placedOfType('ampli')[0].id); });
  check(!fixed, 'il finale non si ripara');

  // 6. annulla, ripristina, reset: niente errori, segni coerenti
  const hist = await ev(() => {
    const S = window.__scene;
    S.undo(); S.undo(); S.redo();
    S.resetLevel();
    S.resetLevel(true);
    return { placed: Object.keys(gameState.placed).length, opened: S.casesOpened, marks: S.faultMarks.length };
  });
  check(hist.opened === null, 'reset: case aperti non azzerati');

  // 7. scarico saltato: nessun case, nessun segno, montaggio come prima
  const skip = await ev(() => {
    finishScarico({ skipped: true });
    const S = window.__scene;
    const w = gridToScreen(1.5, 8.5); S.placeComponentAt('sub', w.x, w.y);
    const id = placedOfType('sub')[0].id;
    openCase('corrente'); const t = el('#case-title').textContent; closeCase();
    return { from: caseOfPiece(id), faulty: isFaulty(id), par: levelStock().par === AVAILABLE_STOCK.par, t,
      marks: [...document.querySelectorAll('.case-btn.faulty')].length };
  });
  check(skip.from === null && !skip.faulty && skip.par && skip.t === 'Baule CORRENTE' && !skip.marks, 'scarico saltato: ' + JSON.stringify(skip));

  // 8. salvataggio vecchio: scarico senza "cases" (e baule difettoso)
  const old = await ev(() => {
    Profile.data.scarico = { skipped: false, parsBroken: 0, ricOk: true, faulty: [], faultyIds: ['segnale'], fixed: {}, wrong: [], kidHits: 0, lost: {} };
    const S = window.__scene; S.resetLevel(true); S.refreshFaultMarks();
    openCase('segnale'); const o = { title: el('#case-title').textContent, origin: el('#case-origin').hidden, tangled: el('#case-svg').classList.contains('tangled') }; closeCase();
    o.mark = document.querySelector('.case-btn[data-case="segnale"]').classList.contains('faulty');
    return o;
  });
  check(old.title === 'Baule SEGNALE' && old.origin && old.tangled && old.mark, 'salvataggio vecchio: ' + JSON.stringify(old));

  check(!errs.length, 'errori nella pagina: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('palestra senza case: ok');
})().catch(e => { console.error(e); process.exit(1); });
