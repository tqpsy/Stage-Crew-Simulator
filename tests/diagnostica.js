/* Diagnostica prima del Test impianto: patch sheet, tester cavi nel baule e
   VU meter di mixer e scheda. Monta e cabla il livello 1 con qualche errore
   apposta (L/R scambiati, indirizzi DMX accavallati, catena DMX rotta) e
   controlla che gli strumenti lo dicano.

   Uso:  node tests/diagnostica.js
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
  await p.evaluate(() => startNewGame('Diagnostica', serviceOffers([])[0]));
  await p.waitForFunction(() => !menuOpen);
  await p.evaluate(() => { closeSchedule(); finishScarico({ skipped: true }); settings().bossTips = false; });   // lo scarico ha il suo test
  const res = await p.evaluate(async () => {
    const S = window.__scene, out = [];
    const check = (ok, what) => { if (!ok) out.push(what); };
    const P = (ty, gx, gy) => { const w = gridToScreen(gx + .5, gy + .5); S.placeComponentAt(ty, w.x, w.y); };
    const W = (c, a, ap, bb, bp) => { if (c) selectCable(c); openRearPanel(a); onRearPortClick(a, ap); if (rearPanelId) closeRearPanel(); openRearPanel(bb); onRearPortClick(bb, bp); if (rearPanelId) closeRearPanel(); };
    S.resetLevel(true);
    P('sub', 1, 8); P('sub', 7, 8); P('top', 1, 8); P('top', 7, 8); P('tavolo', 7, 5);
    const onTable = ty => { const v = S.compVisuals[placedOfType('tavolo')[0].id].container; S.placeComponentAt(ty, v.x, v.y); };
    ['mixer', 'ampli', 'controller', 'pc', 'scheda'].forEach(onTable);
    [[0, 9], [9, 9], [0, 4], [6, 6]].forEach(s => P('stativo', ...s));
    placedOfType('stativo').forEach(st => { const v = S.compVisuals[st.id].container; S.placeComponentAt('par', v.x, v.y); });
    P('quadro', 4, 2);
    const one = ty => placedOfType(ty)[0].id;
    const Q = one('quadro'), PC = one('pc'), SC = one('scheda'), MX = one('mixer'), AM = one('ampli'), CT = one('controller');
    const pars = placedOfType('par').map(c => c.id), subs = subsLeftToRight();
    W('cee_tri', 'allaccio', 'out', Q, 'in');
    W('cee_schuko', Q, 'out_1', PC, 'power'); W('cee_powercon', Q, 'out_1', MX, 'power');
    W('cee_powercon', Q, 'out_2', AM, 'power'); W('cee_powercon', Q, 'out_3', CT, 'power');
    subs.forEach(s => W('cee_powercon', Q, 'out_2', s.id, 'power'));
    W('cee_powercon', Q, 'out_3', pars[0], 'power_in');
    for (let i = 1; i < 4; i++) W('powercon', pars[i - 1], 'power_thru', pars[i], 'power_in');
    W(null, SC, 'usb', PC, 'usb');
    // L/R scambiati sul mixer: la cassa di sinistra suona il destro
    W('jack', SC, 'out_L', MX, 'in_6'); W('jack', SC, 'out_R', MX, 'in_5');
    W('xlr', MX, 'main_L', AM, 'in_L'); W('xlr', MX, 'main_R', AM, 'in_R');
    W('speakon', AM, 'out_L', subs[0].id, 'spk_in'); W('speakon', AM, 'out_R', subs[1].id, 'spk_in');
    subs.forEach(sb => W('speakon', sb.id, 'spk_thru', sb.hasTop, 'spk_in'));
    // DMX: PAR 4 resta fuori dalla catena, PAR 3 si accavalla con PAR 1
    W('dmx', CT, 'dmx_1', pars[0], 'dmx_in');
    for (let i = 1; i < 3; i++) W('dmx', pars[i - 1], 'dmx_thru', pars[i], 'dmx_in');
    placedOfType('par').forEach((c, i) => { c.dmx = { addr: 1 + i * 4, mode: 1 }; });
    gameState.placed[pars[2]].dmx.addr = 3;
    gameState.selectedCable = null;
    const edge = (a, ap) => gameState.edges.find(e => e.a === a && e.aPort === ap);
    const reading = e => testLine(e).map(r => r.k + ': ' + r.v).join(' | ');

    // ---- tester a impianto spento: continuità sì, tensione no e perché
    let r = reading(gameState.edges.find(e => e.b === PC && e.bPort === 'power'));
    check(/Continuità: ✓/.test(r) && /Tensione: 0 V/.test(r) && /generale del Quadro abbassato/.test(r), 'tester a quadro spento: ' + r);
    r = reading(edge(SC, 'out_L'));
    check(/Segnale: nessuno/.test(r) && /Canale: SINISTRO/.test(r), 'tester sul jack a PC spento: ' + r);
    // nel baule c'è il tester e si apre
    openCase('segnale');
    const cell = el('#case-svg .cc-tester');
    check(!!cell, 'nel baule non c\'è il tester');
    if (cell) cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    check(testerIsOpen && !openCaseName && sceneCovered(), 'il tester non si apre dal baule (o non copre la scena)');
    const lines = document.querySelectorAll('#tester-lines .tl-line');
    check(lines.length === gameState.edges.length, 'tester: ' + lines.length + ' linee invece di ' + gameState.edges.length);
    closeTester();

    // ---- si accende tutto (finali e sub uno alla volta)
    ['main', 'rcd', 'L1', 'L2', 'L3'].forEach(k => toggleProtection(k));
    Object.values(gameState.placed).filter(c => SWITCHABLE.has(c.type) && !/^ciabatta/.test(c.type)).forEach(c => { if (!c.on) { toggleDevicePower(c.id); gameState.inrush = []; } });
    check(Object.values(gameState.placed).filter(c => SWITCHABLE.has(c.type)).every(c => isRunning(c.id)), 'impianto non acceso per il test');
    r = reading(gameState.edges.find(e => e.b === PC && e.bPort === 'power'));
    check(/Tensione: 230 V · fase L1/.test(r), 'tester a quadro acceso: ' + r);
    r = reading(edge(AM, 'out_L'));
    check(/musica del PC/.test(r) && /Canale: DESTRO/.test(r) && /Attenzione: canale DESTRO sulla cassa di sinistra/.test(r), 'tester non trova L/R invertiti: ' + r);
    r = reading(edge(CT, 'dmx_1'));
    check(/universo 1 · dati presenti/.test(r) && /PAR 3 003–006 ⚠/.test(r), 'tester sul DMX: ' + r);
    r = reading(gameState.edges.find(e => e.b === pars[2] && e.signal === 'dmx'));
    check(/universo 1/.test(r), 'tester sul DMX in mezzo alla catena: ' + r);

    // ---- patch sheet
    openPatch();
    check(patchIsOpen && sceneCovered(), 'patch sheet non aperto');
    const row = id => el('#patch-body tr[data-id="' + id + '"]');
    const txt = id => (row(id) || {}).textContent || '';
    const placed = Object.values(gameState.placed).filter(c => PATCH_GROUPS.some(([, ts]) => ts.includes(c.type)));
    check(placed.every(c => row(c.id)), 'patch: mancano righe');
    check(/U1 · 001–004/.test(txt(pars[0])) && /si accavalla con PAR 3/.test(txt(pars[0])) && row(pars[0]).classList.contains('bad'), 'patch PAR 1: ' + txt(pars[0]));
    check(/non arriva dalla consolle/.test(txt(pars[3])), 'patch PAR 4 fuori catena: ' + txt(pars[3]));
    check(/L3/.test(txt(pars[3])) && /acceso/.test(txt(pars[3])), 'patch PAR 4 fase/stato: ' + txt(pars[3]));
    check(/CH 5 ← SCHEDA 1 OUT R/.test(txt(MX)) && /L1/.test(txt(MX)), 'patch mixer: ' + txt(MX));
    check(/suona il canale DESTRO ma sta a sinistra/.test(txt(subs[0].id)), 'patch sub invertito: ' + txt(subs[0].id));
    check(/U1: 3 fari/.test(txt(CT)) && /U2: libero/.test(txt(CT)), 'patch consolle: ' + txt(CT));
    // dal vivo: si spegne il mixer e il foglio lo dice
    toggleDevicePower(MX);
    check(/spento/.test(txt(MX)), 'patch non si aggiorna dal vivo: ' + txt(MX));
    // toccando una riga si apre il pannello
    row(AM).click();
    check(!patchIsOpen && rearPanelId === AM, 'dalla riga del patch non si apre il pannello');
    closeRearPanel();

    // ---- VU meter
    let vu = vuChannels(MX);
    check(vu && !vu.on, 'VU del mixer spento accesi');
    toggleDevicePower(AM); gameState.inrush = []; toggleDevicePower(MX); toggleDevicePower(AM); gameState.inrush = [];
    vu = vuChannels(MX);
    check(vu && vu.on && vu.chans[4].level > 0 && vu.chans[5].level > 0 && !vu.chans[1].level && vu.chans[6].level > 0, 'VU del mixer: ' + JSON.stringify(vu));
    openRearPanel(MX);
    check(!el('#rear-vu').hidden && el('#rear-vu').querySelectorAll('.vu-ch').length === 8, 'VU non mostrato nel pannello del mixer');
    closeRearPanel();
    openRearPanel(SC);
    check(!el('#rear-vu').hidden && el('#rear-vu').querySelectorAll('.vu-ch').length === 2, 'VU non mostrato nel pannello della scheda');
    closeRearPanel();
    openRearPanel(AM);
    check(el('#rear-vu').hidden, 'VU nel pannello del finale');
    closeRearPanel();
    openRearPanel(placedOfType('tavolo')[0].id);
    check(el('#rear-vu').querySelectorAll('.vu-block').length === 2, 'sul tavolo regia non ci sono i VU di mixer e scheda');
    closeRearPanel();
    toggleDevicePower(PC);
    vu = vuChannels(SC);
    check(vu && !vu.on, 'VU della scheda accesi col PC spento');
    return out;
  });
  console.log('PROBLEMI:', JSON.stringify(res, null, 1)); console.log('ERRORI JS:', errs);
  await b.close();
  const ok = !res.length && !errs.length;
  console.log(ok ? 'DIAGNOSTICA OK' : 'DIAGNOSTICA FALLITO');
  process.exit(ok ? 0 : 1);
})();
