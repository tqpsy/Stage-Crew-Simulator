/* Aiuti del livello 1: segni di nastro sul pavimento, "Segui il segnale"
   e la scheda "cos'è" dei pezzi. Nastri e Segui il segnale si tolgono dalle
   impostazioni; Segui il segnale deve indicare il primo anello rotto giusto.

   Uso:  node tests/aiuti.js
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 1000 } });
  if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  await p.evaluate(() => startNewGame('Aiuti', serviceOffers([])[0]));
  await p.waitForFunction(() => !menuOpen);
  await p.evaluate(() => { closeSchedule(); finishScarico({ skipped: true }); settings().bossTips = false; });   // lo scarico ha il suo test
  const res = await p.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const S = window.__scene, out = [];
    const check = (ok, what) => { if (!ok) out.push(what); };
    // ---- nastri: ci sono nel livello 1 e si tolgono dalle impostazioni
    check(S.tapeObjs.length > TAPE_MARKS.length, 'segni di nastro non disegnati');
    const zones = { QUADRO: isBackstageCell, SUB: isPitCell, 'FRONT.': isPitCell, TAGLIO: ZONE_PREDICATES.stativo, ASTA: isStageCoreCell };
    TAPE_MARKS.filter(m => !m.w).forEach(m => check(zones[m.text](Math.floor(m.gx / CELL) * CELL, Math.floor(m.gy / CELL) * CELL), 'nastro ' + m.text + ' fuori dalla sua zona'));
    const R = TAPE_MARKS.find(m => m.w);
    for (let x = R.gx; x < R.gx + R.w; x += CELL) for (let y = R.gy; y < R.gy + R.h; y += CELL) check(isOffStageCell(x, y), 'nastro della regia fuori da Off Stage');
    openMenu('settings');                     // le caselle si leggono dalle impostazioni
    el('#set-tapemarks').click();
    check(settings().tapeMarks === false && !S.tapeObjs.length, 'i nastri non si tolgono dalle impostazioni');
    el('#set-tapemarks').click();
    check(S.tapeObjs.length > 0, 'i nastri non tornano');
    closeMenu();

    // ---- segui il segnale
    const P = (ty, gx, gy) => { const w = gridToScreen(gx + .5, gy + .5); S.placeComponentAt(ty, w.x, w.y); };
    const onBase = (ty, base) => { const v = S.compVisuals[base].container; S.placeComponentAt(ty, v.x, v.y); };
    const W = (c, a, ap, bb, bp) => { if (c) selectCable(c); openRearPanel(a); onRearPortClick(a, ap); if (rearPanelId) closeRearPanel(); openRearPanel(bb); onRearPortClick(bb, bp); if (rearPanelId) closeRearPanel(); };
    const broken = id => { const t = traceChain(id); const x = t.steps.find(s => !s.ok); return x ? x.label + ' ' + x.why : 'ok'; };
    S.resetLevel(true);
    check(broken('allaccio') === 'ok', 'allaccio da solo: ' + broken('allaccio'));
    P('quadro', 4, 2); P('tavolo', 7, 5); ['mixer', 'ampli', 'pc', 'scheda'].forEach(t => onBase(t, 'tavolo_1'));
    check(broken('mixer_1') === 'PC 1 non collegato alla corrente', 'PC scollegato: ' + broken('mixer_1'));
    check(broken('quadro_1') === 'ALLACCIO manca il cavo verso QUADRO 1', 'quadro senza allaccio: ' + broken('quadro_1'));
    W('cee_tri', 'allaccio', 'out', 'quadro_1', 'in');
    check(broken('quadro_1') === 'QUADRO 1 generale abbassato', 'quadro non armato: ' + broken('quadro_1'));
    ['mixer_1', 'ampli_1'].forEach(d => W('cee_powercon', 'quadro_1', 'out_1', d, 'power'));
    W('cee_schuko', 'quadro_1', 'out_1', 'pc_1', 'power');
    ['main', 'rcd'].forEach(k => toggleProtection(k));
    check(broken('mixer_1') === 'PC 1 senza corrente', 'fase spenta: ' + broken('mixer_1'));
    toggleProtection('L1');
    check(broken('mixer_1') === 'PC 1 spento', 'PC spento: ' + broken('mixer_1'));
    toggleDevicePower('pc_1');
    check(broken('mixer_1') === 'SCHEDA 1 senza USB dal PC', 'scheda senza USB: ' + broken('mixer_1'));
    W(null, 'scheda_1', 'usb', 'pc_1', 'usb');
    toggleDevicePower('mixer_1');
    // il segnale si ferma nel cavo tra la scheda e il mixer (acceso)
    check(broken('mixer_1') === 'jack il segnale si ferma qui, tra SCHEDA e MIX 1: guarda il cavo e le prese ai due capi', 'mixer senza jack: ' + broken('mixer_1'));
    W('jack', 'scheda_1', 'out_L', 'mixer_1', 'in_5');
    check(broken('mixer_1') === 'FINALE 1 spento', 'finale spento: ' + broken('mixer_1'));
    toggleDevicePower('ampli_1');
    check(broken('mixer_1') === 'XLR il segnale si ferma qui, tra MIX e FINALE 1: guarda il cavo e le prese ai due capi', 'finale senza XLR: ' + broken('mixer_1'));
    W('xlr', 'mixer_1', 'main_L', 'ampli_1', 'in_L');
    check(broken('mixer_1') === 'SUB da posare', 'sub da posare: ' + broken('mixer_1'));
    // il pulsante nel pannello illumina la catena; si toglie dalle impostazioni
    openRearPanel('mixer_1');
    check(!el('#rear-trace').hidden, 'pulsante Segui il segnale nascosto');
    el('#rear-trace').click();
    check(!rearPanelId && el('#toast').textContent.startsWith('Musica: PC 1 ✓') && S.traceIds.includes('mixer_1'), 'Segui il segnale non mostra la catena: ' + el('#toast').textContent);
    openMenu('settings'); el('#set-trace').click(); closeMenu();
    openRearPanel('mixer_1');
    check(el('#rear-trace').hidden, 'il pulsante non si toglie dalle impostazioni');
    closeRearPanel();
    openMenu('settings'); el('#set-trace').click(); closeMenu();
    check(settings().traceSignal === true, 'il pulsante non torna');
    // luci
    P('stativo', 6, 6); onBase('par', 'stativo_1'); onBase('controller', 'tavolo_1');
    check(broken('par_1') === 'CTRL 1 non collegato alla corrente', 'consolle scollegata: ' + broken('par_1'));
    W('cee_powercon', 'quadro_1', 'out_2', 'controller_1', 'power');
    toggleDevicePower('controller_1');
    toggleProtection('L2');
    check(broken('par_1') === 'PAR 1 non collegato alla corrente', 'PAR scollegato: ' + broken('par_1'));

    // ---- indizi a scalare nel Test impianto: vago, poi il pezzo in rosso, poi il capo legge il foglio
    P('sub', 1, 8); P('sub', 7, 8);           // posati ma senza corrente: il colpevole è un pezzo che si vede
    gameState.giro = GIRO_COLLAUDO; gameState.giroFails[GIRO_COLLAUDO] = 0;
    const glowing = () => Object.keys(S.compVisuals).filter(id => S.compVisuals[id].glow.alpha > 0);
    const sysTest = () => { S.runSystemTest(); return { red: glowing(), msg: el('#toast').textContent }; };
    const t1 = sysTest(), t2 = sysTest(), t3 = sysTest();
    check(!t1.red.length && !/ti indica il foglio/.test(t1.msg), 'collaudo, primo tentativo: indizio troppo preciso: ' + t1.msg + ' ' + t1.red);
    check(t2.red.join() === 'sub_1' && !/ti indica il foglio/.test(t2.msg), 'collaudo, secondo tentativo: in rosso ' + t2.red + ' invece di sub_1: ' + t2.msg);
    check(/ti indica il foglio: «.+»/.test(t3.msg), 'collaudo, terzo tentativo: il capo non legge il foglio: ' + t3.msg);
    check(gameState.giroFails[GIRO_COLLAUDO] === 3, 'tentativi del collaudo non contati');
    S.stopFx();

    // ---- scheda "cos'è": ogni pezzo della barra ne ha una, e la pressione lunga non arma il pezzo
    document.querySelectorAll('.piece').forEach(pc => check(PIECE_INFO[pc.dataset.type], 'manca la scheda cos\'è di ' + pc.dataset.type));
    document.querySelector('.tab-btn[data-tab="corrente"]').click();
    const pc = document.querySelector('.piece[data-type="ciabatta"]'), r = pc.getBoundingClientRect();
    const o = { pointerId: 9, clientX: r.left + 5, clientY: r.top + 5, bubbles: true };
    pc.dispatchEvent(new PointerEvent('pointerdown', o)); await sleep(LONG_PRESS_MS + 150); document.dispatchEvent(new PointerEvent('pointerup', o));
    check(el('#piece-info').classList.contains('show') && !gameState.selectedPieceType, 'pressione lunga: scheda non mostrata o pezzo armato');
    // spiegazioni a due livelli: CREW di partenza, PRO con un tasto o dalle impostazioni
    document.querySelectorAll('.piece').forEach(pc => check(PIECE_CREW[pc.dataset.type], 'manca la spiegazione CREW di ' + pc.dataset.type));
    check(el('#piece-info p').textContent === PIECE_CREW.ciabatta && /CREW/.test(el('#piece-info .pi-lvl').textContent), 'la scheda non parte in CREW');
    el('#piece-info .pi-other').click();
    check(el('#piece-info').classList.contains('show') && el('#piece-info p').textContent === PIECE_INFO.ciabatta[0], 'il tasto non passa a PRO');
    check(proWhy('dmx') === '', 'perché PRO senza le spiegazioni PRO');
    settings().proInfo = true;
    check(/^ PRO: /.test(proWhy('wire', 'luci')) && /THRU/.test(proWhy('wire', 'luci')), 'perché PRO mancante');
    settings().proInfo = false;
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    check(!el('#piece-info').classList.contains('show'), 'la scheda cos\'è non si chiude');
    pc.dispatchEvent(new PointerEvent('pointerdown', o)); document.dispatchEvent(new PointerEvent('pointerup', o));
    check(gameState.selectedPieceType === 'ciabatta', 'tocco breve: il pezzo non si arma');
    return out;
  });
  console.log('PROBLEMI:', JSON.stringify(res, null, 1)); console.log('ERRORI JS:', errs);
  await b.close();
  const ok = !res.length && !errs.length;
  console.log(ok ? 'AIUTI OK' : 'AIUTI FALLITO');
  process.exit(ok ? 0 : 1);
})();
