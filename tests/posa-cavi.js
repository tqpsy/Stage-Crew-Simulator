/* Prototipo della posa dei cavi (prototipi/posa-cavi.html): ogni scenario
   si può risolvere con i cavi, il nastro e i passacavi che dà; Gerry
   promuove una posa giusta e boccia ogni errore col suo motivo (passaggio
   senza passacavi, cavo lungo il passaggio, cavo in scena, ronzio, nastro
   finito); la via di fuga e la lunghezza del cavo fermano il dito; il
   trascinamento col mouse stende davvero il cavo.

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
  await p.goto('file://' + path.join(__dirname, '..', 'prototipi', 'posa-cavi.html'));
  await p.click('#btn-start');

  /* risolutore: Dijkstra cella per cella con le regole di Gerry. Prima
     microfono e multipolare, poi la corrente che non tocca le loro celle,
     poi gli altri. Il nastro costa, così i cavi si raccolgono in fasci. */
  const solve = () => {
    const sc = S.scen, used = new Map();   // cella -> Set(tipi)
    const rank = l => KINDS[l.kind].sensitive ? 0 : KINDS[l.kind].power ? 1 : 2;
    const order = sc.lines.slice().sort((a, b) => rank(a) - rank(b));
    const out = {};
    for (const l of order) {
      const from = dev(l.from).r, to = dev(l.to).r;
      const sens = KINDS[l.kind].sensitive;
      const ok = (i, j) => i >= 0 && i < COLS && j >= J0 && j < ROWS && !isExit(i, j) && !devAt(i, j) &&
        (KINDS[l.kind].scene || !isInterior(i, j)) &&
        !(used.has(key(i, j)) && [...used.get(key(i, j))].some(k => KINDS[k].sensitive ? KINDS[l.kind].power : KINDS[k].power && sens));
      const dist = new Map(), prev = new Map(), q = [];
      for (let i = 0; i < COLS; i++) for (let j = J0; j < ROWS; j++) if (touches(from, i, j) && ok(i, j)) { dist.set(key(i, j), 1); q.push([1, i, j]); }
      let end = null;
      while (q.length) {
        q.sort((a, b) => a[0] - b[0]);
        const [d, i, j] = q.shift();
        if (d > dist.get(key(i, j))) continue;
        if (touches(to, i, j)) { end = [i, j]; break; }
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = i + di, nj = j + dj;
          if (!ok(ni, nj)) continue;
          const pa = passageAt(i, j), pb = passageAt(ni, nj);
          if (pa && pa === pb && dj) continue;   // nel passaggio solo di traverso
          const tape = needsTape(ni, nj) && !used.has(key(ni, nj)) ? 0.6 : 0;
          const nd = d + 1 + tape + (pb ? 0.5 : 0);
          if (nd < (dist.get(key(ni, nj)) ?? Infinity)) { dist.set(key(ni, nj), nd); prev.set(key(ni, nj), [i, j]); q.push([nd, ni, nj]); }
        }
      }
      if (!end) { out[l.id] = null; continue; }
      const cells = [end];
      while (prev.has(key(...cells[0]))) cells.unshift(prev.get(key(...cells[0])));
      cells.forEach(([i, j]) => { const k = key(i, j); if (!used.has(k)) used.set(k, new Set()); used.get(k).add(l.kind); });
      out[l.id] = cells;
    }
    return out;
  };

  for (const scen of ['festa', 'sala']) {
    const res = await p.evaluate(({ scen, solveSrc }) => {
      start(scen);
      const sol = eval('(' + solveSrc + ')')();
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
    }, { scen, solveSrc: solve.toString() });
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
    // via di fuga e pezzi fermano il dito
    const d = { line: lineById('c'), fromDev: 'quadro', toDev: 'subsx', path: [] };
    r.exit = stepTo({ line: lineById('c'), fromDev: 'quadro', toDev: 'subsx', path: [[1, 21]] }, [1, 22]);
    r.device = stepTo({ line: lineById('c'), fromDev: 'quadro', toDev: 'subsx', path: [[2, 11]] }, [3, 11]) && stepTo({ line: lineById('c'), fromDev: 'quadro', toDev: 'subsx', path: [[3, 11]] }, [3, 12]);
    r.jump = stepTo(d, [5, 10]);
    // il cavo finisce: dal Quadro verso il muro e poi giù lungo il muro
    const long = { line: lineById('c'), fromDev: 'quadro', toDev: 'subsx', path: [] };
    const walk = [];
    for (let i = 8; i >= 1; i--) walk.push([i, 6]);
    for (let j = 7; j < 22; j++) walk.push([1, j]);
    let last = true;
    for (const c of walk) { last = stepTo(long, c); if (last !== true) break; }
    r.len = last; r.lenCells = long.path.length;
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
  check(/Via di fuga/.test(bad.exit), 'la via di fuga non ferma il cavo: ' + bad.exit);
  check(/TAGLIO SX/.test(bad.device), 'un pezzo in mezzo non ferma il cavo: ' + bad.device);
  check(bad.jump === 'salto', 'il primo passo può partire lontano dal pezzo: ' + bad.jump);
  check(/Cavo finito/.test(bad.len) && bad.lenCells === 19, `il cavo da 10 m non si ferma a 19 celle: ${bad.len} (${bad.lenCells})`);
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

  // col mouse: il cavo H (regia → taglio DX) trascinato davvero
  await p.evaluate(() => start('festa'));
  const px = await p.evaluate(() => { const b = cv.getBoundingClientRect(); const c = (i, j) => [b.left + cx(i) + cs / 2, b.top + cy(j) + cs / 2]; return { a: c(14, 14), m: c(13, 14), z: c(12, 14) }; });
  await p.click('.chip[data-id="h"]');
  await p.mouse.move(...px.a); await p.mouse.down();
  await p.mouse.move(...px.m, { steps: 4 }); await p.mouse.move(...px.z, { steps: 4 }); await p.mouse.up();
  const drag = await p.evaluate(() => S.paths.h);
  check(JSON.stringify(drag) === '[[13,14]]', 'il trascinamento non stende il cavo: ' + JSON.stringify(drag));
  // da un pezzo con più cavi senza sceglierne uno non parte niente
  await p.evaluate(() => { S.sel = null; render(); });
  const q = await p.evaluate(() => { const b = cv.getBoundingClientRect(); return [b.left + cx(9) + cs / 2, b.top + cy(5) + cs / 2]; });
  await p.mouse.move(...q); await p.mouse.down(); await p.mouse.move(q[0] + 30, q[1]); await p.mouse.up();
  check(await p.evaluate(() => !S.drag && Object.keys(S.paths).length === 1), 'dal Quadro parte un cavo senza averlo scelto');
  check(/partono 4 cavi/.test(await p.textContent('#toast')), 'nessun avviso sui cavi del Quadro');

  check(errs.length === 0, 'errori JS: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('posa-cavi: tutto ok');
})();
