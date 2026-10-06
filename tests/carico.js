/* Il carico del furgone (carico.html), da solo e dentro il gioco.
   Da solo: Macio porta i case sul marciapiede (tre posti al massimo), un
   case si trascina nel furgone col dito, un tocco lo gira, la roba della
   scuola va a Gerry e la nostra no, un case che sporge non entra. Nella
   prova su strada un case slegato con spazio davanti scivola e si rovina,
   lo stesso case legato no.
   Nel gioco: dopo il DJ set (fine festa) la scaletta porta al carico, il risultato torna
   indietro (stelle, reputazione una volta sola, birra), la scaletta e il
   foglio lo raccontano, resta dopo la ricarica e non si rifà. Saltarlo non
   dà reputazione.

   Uso:  node tests/carico.js
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
// un carico completo e stretto (7 × 11 quadretti, passaruota compresi)
const SOL = { corrente: [0, 0, 4, 2], segnale: [4, 0, 2, 4], sub1: [0, 2, 3, 3], sub2: [3, 4, 3, 3], rack: [1, 5, 2, 2], distro: [1, 7, 2, 2],
  stativi: [6, 0, 1, 4], top1: [3, 7, 2, 2], top2: [0, 9, 2, 2], valigetta: [5, 7, 1, 2], par: [2, 9, 2, 2], ricambio: [4, 9, 2, 2], cavo: [6, 4, 1, 1] };
(async () => {
  const b = await chromium.launch();
  const problems = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  const errs = [];

  /* ---- da solo, su un telefono ---- */
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    p.on('pageerror', e => errs.push('carico: ' + e.message));
    await p.route(/fonts\./, r => r.abort());
    await p.goto('file://' + path.join(__dirname, '..', 'carico.html'));
    await p.click('#btn-start');
    await p.waitForFunction(() => __carico().slots.every(s => s != null), null, { timeout: 15000 });
    await p.waitForTimeout(2200);
    check(await p.evaluate(() => __carico().pieces.filter(x => x.loc === 'slot').length) === 3, 'sul marciapiede non ci sono tre case');
    check(await p.evaluate(() => !__carico().arriving), 'Macio porta un quarto case col marciapiede pieno');
    // il primo case del marciapiede nel furgone, trascinato col mouse
    const at = (fn, arg) => p.evaluate(fn, arg);
    const drag = async (a, z) => { await p.mouse.move(...a); await p.mouse.down(); await p.mouse.move(a[0] + 15, a[1] + 15, { steps: 3 }); await p.mouse.move(...z, { steps: 8 }); await p.mouse.up(); };
    const ptOf = (id) => at(id => { const q = __carico().pieces.find(x => x.def.id === id), R = pieceRect(q), c = cv.getBoundingClientRect(); return [c.left + R.x + R.w / 2, c.top + R.y + R.h / 2]; }, id);
    const cellPt = (cc) => at(([c, r, w, h]) => { const R = cellRect(c, r, w, h), b = cv.getBoundingClientRect(); return [b.left + R.x + R.w / 2, b.top + R.y + R.h / 2]; }, cc);
    // la roba della scuola: se non è arrivata, la si fa arrivare
    await at(() => {
      const G = __carico();
      ['leggio', 'valigetta'].forEach((id, s) => {
        const q = G.pieces.find(x => x.def.id === id);
        if (q.loc === 'slot') G.slots[q.slot] = null;
        G.queue = G.queue.filter(i => i !== q.i);
        if (G.slots[s] != null && G.slots[s] !== q.i) { const o = G.pieces[G.slots[s]]; o.loc = 'queue'; o.slot = -1; G.queue.unshift(o.i); }
        q.loc = 'slot'; q.slot = s; G.slots[s] = q.i;
      });
    });
    const pc = await at(() => { const q = __carico().pieces.find(x => x.def.id === 'valigetta'); return [q.w, q.h]; });
    await drag(await ptOf('valigetta'), await cellPt([2, 0, pc[0], pc[1]]));
    check(await at(() => { const q = __carico().pieces.find(x => x.def.id === 'valigetta'); return q.loc === 'van' && q.r === 0; }), 'la valigetta trascinata non è entrata nel furgone');
    // un tocco la gira
    const before = await at(() => { const q = __carico().pieces.find(x => x.def.id === 'valigetta'); return q.w + 'x' + q.h; });
    const t = await ptOf('valigetta');
    await p.mouse.click(...t);
    const after = await at(() => { const q = __carico().pieces.find(x => x.def.id === 'valigetta'); return q.w + 'x' + q.h; });
    check(before !== after, 'un tocco non gira il case (' + before + ' → ' + after + ')');
    // la nostra valigetta a Gerry no, il leggio sì
    const gerry = await at(() => { const G = L.gerry, c = cv.getBoundingClientRect(); return [c.left + G.x + G.w / 2, c.top + G.y + G.h / 2]; });
    await drag(await ptOf('valigetta'), gerry);
    check(await at(() => __carico().pieces.find(x => x.def.id === 'valigetta').loc) === 'van', 'la valigetta del service è finita a Gerry');
    check(/roba del service/.test(await p.textContent('#say-text')), 'nessun avviso dando a Gerry un case del service');
    await drag(await ptOf('leggio'), gerry);
    check(await at(() => __carico().pieces.find(x => x.def.id === 'leggio').loc) === 'gerry', 'il leggio non è andato a Gerry');
    // un case che sporge dal portellone non entra
    const sp = await at(() => { const q = __carico().pieces.find(x => x.loc === 'slot'); return q ? { id: q.def.id, w: q.w, h: q.h } : null; });
    if (sp) {
      await drag(await ptOf(sp.id), await cellPt([1, 10, sp.w, sp.h]));
      check(await at(id => __carico().pieces.find(x => x.def.id === id).loc, sp.id) === 'slot', 'un case che sporge è entrato nel furgone');
    }
    // finché manca qualcosa non si passa alle cinghie
    check(await p.isDisabled('#b-next'), 'si passa alle cinghie con case ancora fuori');

    // prova su strada: la valigetta slegata con lo spazio intorno si rovina; legata no
    const prova = (legato) => at(([SOL, legato]) => {
      newGame(); const G = __carico(); G.paused = false; G.queue = []; G.slots.fill(null);
      // solo il baule CORRENTE contro la cabina e la valigetta sul portellone: davanti ha il corridoio
      for (const q of G.pieces) q.loc = 'gerry';
      const co = G.pieces.find(x => x.def.id === 'corrente'); co.loc = 'van'; [co.c, co.r, co.w, co.h] = SOL.corrente;
      const pc = G.pieces.find(x => x.def.id === 'valigetta'); pc.loc = 'van'; [pc.c, pc.r, pc.w, pc.h] = [3, 9, 1, 2];
      const bad = G.pieces.filter(q => q.loc === 'van' && !fits(q, q.c, q.r, q.w, q.h)).map(q => q.def.id);
      G.mode = 'strap'; if (legato) G.straps.add(9);
      startDrive(); G.drive.wait = 0;
      for (let i = 0; i < 3000 && G.mode !== 'end'; i++) tick(0.05);
      return { bad, pc: G.result && G.result.states.valigetta };
    }, [SOL, legato]);
    const loose = await prova(false), tied = await prova(true);
    check(!loose.bad.length && !tied.bad.length, 'la prova parte da case sovrapposti: ' + loose.bad.concat(tied.bad));
    check(loose.pc && loose.pc !== 'integro', 'la valigetta slegata col corridoio davanti è arrivata ' + loose.pc);
    check(tied.pc === 'integro', 'la valigetta legata è arrivata ' + tied.pc);

    // il freno: un sub sfrenato rotola più lontano in frenata; il tocco sulla ruota lo frena
    const roll = await at(() => {
      const out = {};
      for (const brake of [false, true]) {
        newGame(); const G = __carico(); G.queue = [];
        for (const q of G.pieces) q.loc = 'gerry';
        const sb = G.pieces.find(x => x.def.id === 'sub1'); sb.loc = 'van'; [sb.c, sb.r] = [2, 8]; sb.brake = brake;
        simulateEvent(DRIVE[0]); out[brake] = 8 - sb.r;
      }
      return out;
    });
    check(roll.false === roll.true + 3, 'il sub senza freno non rotola più lontano: ' + JSON.stringify(roll));
    await at(() => { newGame(); const G = __carico(); G.paused = false; G.queue = []; for (const q of G.pieces) q.loc = 'gerry'; const r = G.pieces.find(x => x.def.id === 'rack'); r.loc = 'van'; [r.c, r.r] = [2, 4]; });
    const wb = await at(() => { const q = __carico().pieces.find(x => x.def.id === 'rack'), b = wheelBadge(q, pieceRect(q)), c = cv.getBoundingClientRect(); return [c.left + b.x, c.top + b.y]; });
    await p.mouse.click(...wb);
    check(await at(() => __carico().pieces.find(x => x.def.id === 'rack').brake), 'un tocco sulla ruota non tira il freno');
    check(await at(() => { const q = __carico().pieces.find(x => x.def.id === 'rack'); return q.c === 2 && q.r === 4 && q.w === 2; }), 'il tocco sulla ruota ha anche spostato o girato il case');

    // il cavo dimenticato: con 8 case dentro Gerry lo porta, e prima non si passa alle cinghie
    const cavo = await at(() => {
      newGame(); const G = __carico(); G.paused = false;
      const list = ['corrente', 'segnale', 'sub1', 'sub2', 'rack', 'distro', 'stativi', 'top1'];
      const SOL = { corrente: [0, 0, 4, 2], segnale: [4, 0, 2, 4], sub1: [0, 2, 3, 3], sub2: [3, 4, 3, 3], rack: [1, 5, 2, 2], distro: [1, 7, 2, 2], stativi: [6, 0, 1, 4], top1: [3, 7, 2, 2] };
      for (const id of list) { const q = G.pieces.find(x => x.def.id === id); G.queue = G.queue.filter(i => i !== q.i); q.loc = 'van'; [q.c, q.r, q.w, q.h] = SOL[id]; }
      const before = G.cavoSaid; tick(0.01);
      return { before, after: G.cavoSaid, next: G.pieces[G.queue[0]].def.id, said: document.getElementById('say-who').textContent, n: document.getElementById('h-in').textContent };
    });
    check(!cavo.before && cavo.after && cavo.next === 'cavo' && cavo.said === 'GERRY' && cavo.n === '8/13', 'il cavo dimenticato non arriva: ' + JSON.stringify(cavo));
    // l'ordine del capo: PAR e PC nelle ultime tre file
    const ord = await at(() => { const G = __carico(); const pa = G.pieces.find(x => x.def.id === 'par'), pc = G.pieces.find(x => x.def.id === 'valigetta');
      pa.loc = 'van'; [pa.c, pa.r, pa.w, pa.h] = [2, 9, 2, 2]; pc.loc = 'van'; [pc.c, pc.r, pc.w, pc.h] = [3, 2, 1, 2]; const a = orderOk(); [pc.c, pc.r] = [5, 7]; return [a, orderOk()]; });
    check(!ord[0] && ord[1], 'l\'ordine del capo non si riconosce: ' + ord);
    await p.close();
  }

  /* ---- dentro il gioco ---- */
  {
    const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
    if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
    await p.route(/fonts\./, r => r.abort());
    p.on('pageerror', e => errs.push('gioco: ' + e.message));
    const ev = (fn, arg) => p.evaluate(fn, arg);
    const open = async () => {
      await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
      await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
    };
    await open();
    await ev(() => { startNewGame('Carico', serviceOffers([])[0]); });
    await p.waitForFunction(() => !menuOpen);
    // prima del DJ set il carico non si apre
    await ev(() => { closeSchedule(); finishScarico({ skipped: true }); settings().bossTips = false; openCarico(); });
    check(!(await p.$('#carico-frame')), 'il carico si apre prima del DJ set');
    await ev(() => finishDj({ skipped: true }));
    const rep0 = await ev(() => Profile.data.reputation.total), beer0 = await ev(() => Profile.data.beers || 0);
    await ev(() => openSchedule(false));
    check((await p.textContent('#schedule-go')) === 'Carica il furgone', 'la scaletta dopo il DJ set non porta al carico: ' + await p.textContent('#schedule-go'));
    await p.click('#schedule-go');
    await p.waitForSelector('#carico-frame');
    const frame = await (await p.$('#carico-frame')).contentFrame();
    await frame.waitForSelector('#btn-start');
    check((await frame.evaluate(() => SERVICE)) === (await ev(() => serviceName())).slice(0, 28), 'sul furgone non c\'è il nome del service');
    await frame.click('#btn-start');
    await frame.evaluate(SOL => {
      const G = __carico(); G.queue = []; G.arriving = null; G.slots.fill(null); G.cavoSaid = true;
      for (const q of G.pieces) { const s = SOL[q.def.id]; if (s) { q.loc = 'van'; [q.c, q.r, q.w, q.h] = s; } else q.loc = 'gerry'; }
      updateHud();
    }, SOL);
    await frame.click('#b-next');
    await frame.evaluate(() => { __carico().straps.add(0); __carico().straps.add(9); });
    await frame.click('#b-next');
    await frame.waitForSelector('#end:not([hidden])', { timeout: 20000 });
    const res = await frame.evaluate(() => __carico().result);
    check(res.stars === 5 && res.order, 'il carico stretto, legato e in ordine non prende 5 stelle: ' + JSON.stringify(res));
    await frame.click('#btn-home');
    await p.waitForFunction(() => !document.querySelector('#carico-frame'));
    const c = await ev(() => Profile.data.carico);
    check(c && c.stars === 5 && !c.skipped, 'il risultato del carico non è tornato al gioco: ' + JSON.stringify(c));
    check(await ev(() => Profile.data.reputation.earned['L1:carico']) === 5, 'reputazione del carico sbagliata');
    check(await ev(() => Profile.data.reputation.total) === rep0 + 5, 'la reputazione totale non è cresciuta di 5');
    check(await ev(() => Profile.data.beers || 0) === beer0 + 1, 'la birra del capo non è arrivata');
    await ev(() => openSchedule(false));
    const row = await p.textContent('#schedule-list li:last-child');
    check(/Fatto/.test(row) && /★★★★★/.test(row), 'la scaletta non racconta il carico: ' + row);
    // a serata finita la scaletta porta alla valutazione, non al carico già fatto
    check((await p.textContent('#schedule-go')) === 'Com\'è andata la serata', 'la scaletta riporta al carico già fatto');
    await ev(() => closeSchedule());
    await ev(() => openCarico());
    check(!(await p.$('#carico-frame')), 'il carico si rifà');
    await ev(() => Profile.flush && Profile.flush());
    await open();
    check(await ev(() => !!(Profile.data.carico && Profile.data.carico.stars === 5)), 'il carico non resta dopo la ricarica');
    check(await ev(() => levelInfo(1).phases.slice(-1)[0].done(Profile.data)), 'il sottolivello del carico non risulta fatto');

    // saltarlo non dà reputazione
    await ev(() => { startNewGame('Salta', serviceOffers([])[0]); });
    await p.waitForFunction(() => !menuOpen);
    await ev(() => { closeSchedule(); finishScarico({ skipped: true }); finishDj({ skipped: true }); openCarico(); });
    await p.waitForSelector('#carico-frame');
    const f2 = await (await p.$('#carico-frame')).contentFrame();
    await f2.click('#btn-skip');
    await p.waitForFunction(() => !document.querySelector('#carico-frame'));
    check(await ev(() => Profile.data.carico && Profile.data.carico.skipped), 'saltato ma non segnato come saltato');
    check(await ev(() => !('L1:carico' in Profile.data.reputation.earned)), 'saltare il carico dà reputazione');
    await p.close();
  }

  check(!errs.length, 'errori nella pagina: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('carico: tutto ok');
})().catch(e => { console.error(e); process.exit(1); });
