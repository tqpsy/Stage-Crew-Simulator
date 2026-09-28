/* Prototipo della posa dei cavi (posa-cavi.html): ogni scenario
   si può risolvere con i cavi, il nastro e i passacavi che dà; Gerry
   promuove una posa giusta e boccia ogni errore col suo motivo (passaggio
   senza passacavi, cavo lungo il passaggio, cavo in scena, ronzio, nastro
   finito); la via di fuga e la lunghezza del cavo fermano il dito; il
   cavo preso a metà col mouse si piega davvero. All'inizio i cavi
   sono già stesi come tirati al montaggio e «Com'era» li rimette così.

   Uso:  node tests/posa-cavi.js
   Richiede Playwright. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 420, height: 860 } });
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const problems = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  await p.goto('file://' + path.join(__dirname, '..', 'posa-cavi.html'));
  await p.click('#btn-start');

  // la posa valida la trova la pagina stessa (autoRoute, la usa per tarare la pianta del gioco)
  for (const scen of ['festa', 'sala']) {
    const res = await p.evaluate(scen => {
      start(scen);
      const sol = autoRoute();
      const lay = {};
      const lens = {};
      for (const l of S.scen.lines) {
        if (!sol[l.id]) { lay[l.id] = 'nessuna strada'; continue; }
        lens[l.id] = pathLen(sol[l.id]) + '/' + l.len;
        lay[l.id] = layPath(l.id, sol[l.id]);
      }
      // un passacavi per ogni riga di passaggio attraversata
      const rows = new Set();
      Object.values(S.paths).forEach(pp => pp.forEach(([i, j]) => { const ps = passageAt(i, j); if (ps) rows.add(ps.id + ':' + j + ':' + i); }));
      [...rows].forEach(r => { const [, j, i] = r.split(':'); const ps = passageAt(+i, +j); if (!S.ramps.has(ps.id + ':' + j)) toggleRamp(+i, +j); });
      const issues = analyze();
      return { lay, lens, issues: issues.map(i => i.type + ': ' + i.text), tape: tapeUsed(), tapeStock: S.scen.tape, ramps: S.ramps.size, rampStock: S.scen.ramps };
    }, scen);
    console.log(scen, JSON.stringify({ lens: res.lens, tape: res.tape + '/' + res.tapeStock, ramps: res.ramps + '/' + res.rampStock }));
    Object.entries(res.lay).forEach(([id, r]) => check(r === true, `${scen}: il cavo ${id} non si posa: ${r}`));
    check(res.issues.length === 0, `${scen}: la posa del risolutore non passa: ${res.issues.join(' | ')}`);
    check(res.ramps <= res.rampStock, `${scen}: servono ${res.ramps} passacavi, ce ne sono ${res.rampStock}`);
    check(res.tape <= res.tapeStock * 0.85, `${scen}: nastro troppo stretto (${res.tape} su ${res.tapeStock}): serve margine per chi non fa il percorso perfetto`);
    check(res.tape >= res.tapeStock * 0.45, `${scen}: nastro troppo largo (${res.tape} su ${res.tapeStock}): non costringe mai a fare fasci`);
    // Gerry promuove al primo giro: tre stelle e risultato per il gioco
    const end = await p.evaluate(() => { inspect(); return S.result; });
    check(end && end.stars === 3 && end.inspections === 1, `${scen}: la posa giusta non vale tre stelle: ${JSON.stringify(end)}`);
    check(await p.isVisible('#end'), `${scen}: manca la scheda finale`);
    await p.evaluate(() => { document.querySelector('#end').hidden = true; });
  }

  // errori, uno per uno (livello 1)
  const bad = await p.evaluate(() => {
    const r = {};
    start('festa');
    // la corda: una piega che va contro un pezzo si ferma, la corda tesa
    // non si allunga, vicino all'altra piega o al capo ci si mette in riga
    const l = lineById('c');
    setPts('c', fixAnchors(l, [[0, 0], [5, 6], [0, 0]]));
    r.device = moveHandle('c', 1, [3, 12]);
    r.devicePts = S.pts.c.map(p => p.join(',')).join(' ');
    setPts('c', fixAnchors(l, [[0, 0], [5, 6], [0, 0]]));
    r.len = moveHandle('c', 1, [19, 31]);
    r.lenOk = lineLen('c') <= l.len;
    setPts('c', fixAnchors(l, [[0, 0], [5, 6], [0, 0]]));
    moveHandle('c', 1, [1, 10]);
    r.snap = S.pts.c.map(p => p.slice());
    // la via di fuga non ferma il cavo: la trova Gerry
    start('sala');
    setPts('c', fixAnchors(lineById('c'), [[0, 0], [1, 23], [0, 0]]));
    r.exit = analyze().map(i => i.type + ':' + i.ids.join(','));
    start('festa');
    // il cavo delle casse in mezzo alla scena
    layPath('e', [[13, 13], [12, 13], [11, 13], [10, 13], [9, 13], [9, 14], [9, 15], [8, 15], [7, 15], [6, 15], [5, 15], [4, 15], [3, 15]]);
    // microfono affiancato per 1 m alla corrente dei PAR (H: regia → taglio DX lungo la riga 12)
    r.h = layPath('h', [[13, 12], [12, 12], [11, 12], [11, 13], [11, 14]]);
    r.g = layPath('g', [[9, 13], [9, 12], [10, 12], [11, 12], [12, 12], [13, 12]]);
    // allaccio → quadro nel passaggio artisti: prima senza passacavi, poi lungo il passaggio
    layPath('a', [[16, 4], [15, 4], [14, 4], [13, 4], [12, 4], [11, 4], [10, 4], [9, 4]]);
    r.issues1 = analyze().map(i => i.type + ':' + i.ids.join(','));
    layPath('a', [[16, 4], [15, 4], [14, 4], [14, 5], [13, 5], [12, 5], [11, 5], [10, 5]]);
    toggleRamp(13, 5);
    r.issues2 = analyze().map(i => i.type + ':' + i.ids.join(','));
    // nastro finito: tutto il Pit e la platea attraversati a zig-zag
    S.scen = Object.assign({}, S.scen, { tape: 1 });
    r.issues3 = analyze().map(i => i.type);
    return r;
  });
  check(bad.exit.includes('fuga:c'), 'cavo sulla via di fuga non bocciato: ' + bad.exit);
  check(/TAGLIO SX/.test(bad.device) && !/3,12/.test(bad.devicePts), 'una piega entra in un pezzo: ' + bad.device + ' ' + bad.devicePts);
  check(/Cavo tirato/.test(bad.len) && bad.lenOk, 'la corda tesa si allunga oltre il cavo: ' + bad.len);
  check(bad.snap[1][0] === bad.snap[2][0], 'la piega non si mette in riga col capo vicino: ' + JSON.stringify(bad.snap));
  check(bad.issues1.includes('scena:e'), 'Speakon in scena non bocciato: ' + bad.issues1);
  check(!bad.issues1.some(i => i.startsWith('scena:g')), 'il microfono in scena è bocciato: ' + bad.issues1);
  check(bad.h === true && bad.g === true, 'posa di prova rifiutata: ' + bad.h + ' / ' + bad.g);
  check(bad.issues1.includes('ronzio:g'), 'microfono accanto alla corrente dei PAR senza ronzio: ' + bad.issues1);
  check(bad.issues1.includes('passaggio:a'), 'passaggio senza passacavi non bocciato: ' + bad.issues1);
  check(bad.issues2.includes('lungo:a') && !bad.issues2.includes('passaggio:a'), 'cavo lungo il passaggio non bocciato (o bocciato due volte): ' + bad.issues2);
  check(bad.issues3.includes('nastro'), 'nastro finito non bocciato');

  // Gerry: tre giri → una stella; i cavi segnati si sbloccano rifacendoli
  const gerry = await p.evaluate(() => {
    start('festa');
    layPath('e', [[13, 13], [12, 13], [11, 13], [10, 13], [9, 13], [9, 14], [9, 15], [8, 15], [7, 15], [6, 15], [5, 15], [4, 15], [3, 15]]);
    S.scen.lines.forEach(l => { if (!S.paths[l.id]) S.paths[l.id] = [[0, 4]]; });   // tutto "steso" per far passare Gerry
    inspect(); const first = S.inspections;
    return { first, flagged: Object.keys(S.flagged).length > 0, open: !document.querySelector('#gerry').hidden };
  });
  check(gerry.first === 1 && gerry.flagged && gerry.open, 'Gerry non segnala gli errori: ' + JSON.stringify(gerry));
  await p.click('#btn-fix');

  // all'inizio i cavi sono come tirati al montaggio: tutti stesi, da un
  // pezzo all'altro, lunghi quanto basta; Gerry ha da ridire; «Com'era»
  // rimette il percorso del montaggio
  const drop = await p.evaluate(() => {
    const out = {};
    for (const k of ['festa', 'sala']) {
      start(k);
      const bad = S.scen.lines.filter(l => { const pp = S.paths[l.id]; return !pp || !touches(dev(l.from).r, ...pp[0]) || !touches(dev(l.to).r, ...pp[pp.length - 1]) || lineLen(l.id) > l.len || isMoved(l.id); }).map(l => l.id);
      out[k] = { bad, issues: analyze().map(i => i.type) };
    }
    start('festa');
    const before = JSON.stringify(S.paths.g);
    layPath('g', [[9, 13], [9, 12], [10, 12], [11, 12], [12, 12], [13, 12]]);
    const moved = isMoved('g');
    S.sel = 'g'; render();
    const btn = !document.querySelector('#t-redo').disabled;
    document.querySelector('#t-redo').click();
    out.back = { moved, btn, same: JSON.stringify(S.paths.g) === before && !isMoved('g') };
    return out;
  });
  ['festa', 'sala'].forEach(k => {
    check(!drop[k].bad.length, `${k}: cavi del montaggio non stesi bene all'inizio: ${drop[k].bad}`);
    check(drop[k].issues.length > 0, `${k}: i cavi tirati al montaggio passano già il controllo di Gerry`);
  });
  check(drop.back.moved && drop.back.btn && drop.back.same, "«Com'era» non rimette il cavo del montaggio: " + JSON.stringify(drop.back));

  // col mouse: si prende il cavo del microfono a metà e si tira su di due
  // metri: nasce una piega; un tocco sul pavimento lo lascia
  await p.evaluate(() => start('festa'));
  await p.click('.chip[data-id="g"]');
  const px = await p.evaluate(() => { const b = cv.getBoundingClientRect(); const c = (i, j) => [b.left + cx(i) + cs / 2, b.top + cy(j) + cs / 2]; const pts = S.pts.g; const m = pts[0]; return { a: c(m[0] + 2, m[1]), z: c(m[0] + 2, m[1] - 3) }; });
  await p.mouse.move(...px.a); await p.mouse.down();
  await p.mouse.move(...px.z, { steps: 8 }); await p.mouse.up();
  const drag = await p.evaluate(() => ({ pts: S.pts.g, moved: isMoved('g'), sel: S.sel }));
  check(drag.moved && drag.pts.length === 3 && drag.sel === 'g', 'tirando il cavo non nasce la piega: ' + JSON.stringify(drag));
  const floor = await p.evaluate(() => { const b = cv.getBoundingClientRect(); return [b.left + cx(17) + cs / 2, b.top + cy(26) + cs / 2]; });
  await p.mouse.click(...floor);
  check(await p.evaluate(() => S.sel === null), 'un tocco sul pavimento non lascia il cavo');

  check(errs.length === 0, 'errori JS: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('posa-cavi: tutto ok');
})();
