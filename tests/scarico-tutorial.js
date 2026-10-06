/* Lo scarico come tutorial giocato (scarico.html aperto da solo): i comandi
   compaiono quando servono, il furgone si svuota dal davanti (ACCESSO
   BLOCCATO), i case da due non si muovono da soli e si chiama Macio, il
   carrello arriva dopo due consegne a mano e porta 3 case, il fragile
   sbattuto costa reputazione, l'efficienza compare a metà e finisce nella
   bolla, e alla fine salta fuori il baule SEGNALE sotto il telo.

   Uso:  node tests/scarico-tutorial.js
   Richiede Playwright. Senza rete, MATTER_PATH=/percorso/matter.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const problems = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  const errs = [];
  const page = async (opts) => {
    const p = await b.newPage(opts);
    if (process.env.MATTER_PATH) await p.route('**/matter.min.js', r => r.fulfill({ path: process.env.MATTER_PATH, contentType: 'application/javascript' }));
    await p.route(/fonts\./, r => r.abort());
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.join(__dirname, '..', 'scarico.html'));
    return p;
  };

  const p = await page({ viewport: { width: 1300, height: 900 } });
  check(await p.isVisible('#btn-start'), 'manca il pulsante per aprire il portellone');
  await p.click('#btn-start');
  await p.waitForFunction(() => G && G.mode === 'play', null, { timeout: 10000 });
  const ev = (fn, arg) => p.evaluate(fn, arg);
  // un avviso nella barra d'aiuto (gli avvisi vicini si mettono in fila)
  const saw = re => p.waitForFunction(r => new RegExp(r).test($('#hint-txt').textContent), re.source, { timeout: 9000 }).then(() => true, () => false);
  // aiutanti: case per id, giocatore (e quello che ha in mano) spostato di peso
  await ev(() => {
    window.C = id => G.cases.find(x => x.def.id === id);
    window.moveTo = (x, y) => {
      const P = G.player; Matter.Body.setPosition(P.body, { x, y }); Matter.Body.setVelocity(P.body, { x: 0, y: 0 });
      if (P.grab && P.mode === 'carry') {
        const f = { x: Math.cos(P.facing), y: Math.sin(P.facing) };
        Matter.Body.setPosition(P.grab.body, { x: x + f.x * P.carry.dist, y: y + f.y * P.carry.dist }); Matter.Body.setVelocity(P.grab.body, { x: 0, y: 0 });
      }
    };
    window.besideOf = (ce, side) => { const b = ce.body.bounds; return side === 'right' ? { x: b.max.x + 17, y: ce.body.position.y } : { x: ce.body.position.x, y: b.max.y + 17 }; };
    macio('phone'); G.macio.ai.t = -999;   // Macio fermo: lo chiamiamo noi
  });

  const start = await ev(() => ({ help: !document.querySelector('#keys [data-k="help"]').hidden, cart: !$('#h-cart').hidden, eff: !$('#h-eff-w').hidden,
    dmg: !$('#h-dmg-w').hidden, del: $('#h-del').textContent, hint: hintGoal, hidden: C('segnale').hidden }));
  check(!start.help && !start.cart && !start.eff && !start.dmg, 'all\'inizio si vedono già comandi o strumenti che servono dopo: ' + JSON.stringify(start));
  check(start.del === '0/11' && start.hidden, 'all\'inizio il baule sotto il telo si conta: ' + start.del);
  check(/portellone/.test(start.hint), 'la barra d\'aiuto non dice da dove cominciare: ' + start.hint);

  // ordine: il rack (il mixer) sta dietro al distro e al case PAR
  const bl = await ev(() => {
    const r = C('rack'), at = besideOf(r, 'right'); moveTo(at.x, at.y);
    const ids = blockers(r).map(c => c.def.id);
    pressGrab();
    return { ids, grabbed: !!G.player.grab, flash: G.blockFlash && G.blockFlash.ids.length, n: G.stats.blocked };
  });
  bl.hint = await saw(/bloccato/i);
  check(bl.ids.includes('distro') && bl.ids.includes('par') && !bl.grabbed && bl.flash >= 2 && bl.n === 1 && bl.hint,
    'il rack dietro due case si prende lo stesso: ' + JSON.stringify(bl));

  // due case a mano: il carrello arriva
  const deliver = (id, x, y) => ev(([id, x, y]) => {
    const c = C(id), at = besideOf(c, c.body.position.x < 400 ? 'right' : 'below'); moveTo(at.x, at.y);
    pressGrab(); const ok = G.player.grab === c;
    moveTo(x, y); pressGrab();
    return ok;
  }, [id, x, y]);
  check(await deliver('top1', 1545, 420), 'il Top 1 davanti non si prende');
  await p.waitForTimeout(500);
  check(await deliver('top2', 1545, 560), 'il Top 2 davanti non si prende');
  await p.waitForTimeout(600);
  const tr = await ev(() => ({ t: !!G.trolley, chip: !$('#h-cart').hidden, del: $('#h-del').textContent, hd: G.stats.handDeliv }));
  check(tr.t && tr.chip && tr.del === '2/11', 'dopo due consegne a mano il carrello non arriva: ' + JSON.stringify(tr));

  // carrello: ricambi e stativi sopra, un viaggio, si scaricano nelle zone
  const cart = await ev(() => {
    const t = G.trolley, out = {};
    for (const id of ['ricambio', 'stativi']) {
      const c = C(id), at = besideOf(c, c.body.position.x < 400 ? 'right' : 'below'); moveTo(at.x, at.y);
      pressGrab();
      moveTo(t.body.position.x - 50, t.body.position.y); G.player.facing = 0; pressGrab();
    }
    out.load = t.load.map(c => c.def.id);
    pressGrab(); out.push = G.player.grab === t;
    return out;
  });
  await p.waitForTimeout(300);   // un attimo di gioco col carrello in mano, fuori dalla palestra
  cart.chip = await ev(() => $('#h-cart').innerText.replace(/\s+/g, ' ').toUpperCase());
  check(cart.load.length === 2 && cart.chip === 'CARRELLO 2/3' && cart.push, 'il carrello non si carica o non si spinge: ' + JSON.stringify(cart));
  await ev(() => { const t = G.trolley; Matter.Body.setPosition(t.body, { x: 1710, y: 470 }); moveTo(1660, 470); });
  await p.waitForTimeout(300);
  const un = await ev(() => {
    const t = G.trolley; pressGrab();       // lascia il carrello
    pressGrab();                            // sei nel Palco: scarica gli stativi
    const first = G.player.grab && G.player.grab.def.id;
    G.player.facing = 0; moveTo(1700, 600); pressGrab();
    moveTo(1665, 420); pressGrab();          // ora i ricambi
    const second = G.player.grab && G.player.grab.def.id;
    G.player.facing = 0; moveTo(1700, 220); pressGrab();
    return { first, second, load: t.load.length, trips: G.stats.trips, cartTrips: G.stats.cartTrips, cartCases: G.stats.cartCases };
  });
  await p.waitForTimeout(600);
  const un2 = await ev(() => ({ sta: C('stativi').zone, ric: C('ricambio').zone }));
  check(un.first === 'stativi' && un.second === 'ricambio' && un.load === 0 && un.cartTrips === 1 && un.cartCases === 2 && un2.sta === 'palco' && un2.ric === 'back',
    'dal carrello non si scarica nelle zone: ' + JSON.stringify(un) + JSON.stringify(un2));

  // case da due: da solo non si muove, poi arriva Macio
  const solo = await ev(() => {
    macio('idle');
    const c = C('corrente'), at = besideOf(c, 'right'); moveTo(at.x, at.y);
    window.x0 = c.body.position.x;
    pressGrab();
    inp.keys.add('KeyA');
    return { grabbed: G.player.grab === c, help: !$('#b-help').hidden || !document.querySelector('#keys [data-k="help"]').hidden };
  });
  await p.waitForTimeout(2800);
  const solo2 = await ev(() => { inp.keys.delete('KeyA'); const c = C('corrente'); return { moved: Math.abs(c.body.position.x - x0), solo: G.stats.solo, hint: $('#hint-txt').textContent }; });
  solo2.hint = await saw(/2 PERSONE/);
  check(solo.grabbed && solo.help && solo2.moved < 25 && solo2.solo === 1 && solo2.hint,
    'il case da due si muove da solo o non chiede il collega: ' + JSON.stringify(solo) + JSON.stringify(solo2));
  await ev(() => { Matter.Body.setPosition(G.macio.body, { x: 300, y: 430 }); pressHelp(); });
  await p.waitForFunction(() => G.macio.grab === C('corrente'), null, { timeout: 8000 }).catch(() => {});
  const team = await ev(() => ({ team: G.team, macio: G.macio.grab && G.macio.grab.def.id, pushers: C('corrente').grabbers.length }));
  check(team.team && team.macio === 'corrente' && team.pushers === 2, 'Macio non arriva a spingere il baule: ' + JSON.stringify(team));
  await ev(() => { for (const w of G.workers) release(w); macio('phone'); G.macio.ai.t = -999; });

  // fragile sbattuto: movimentazione brusca, −1 reputazione
  const rough = await ev(() => {
    const v = C('valigetta');
    hitCase(v, null, 6, G.statics[0]);
    return { rough: G.stats.rough, hint: $('#hint-txt').textContent, dmg: !$('#h-dmg-w').hidden || true };
  });
  rough.hint = await saw(/Movimentazione brusca.*reputazione/);
  check(rough.rough === 1 && rough.hint, 'il fragile sbattuto non si fa notare: ' + JSON.stringify(rough));
  await p.waitForTimeout(300);
  check(await ev(() => !$('#h-dmg-w').hidden), 'dopo il primo danno non compare il contatore dei danni');

  // efficienza: compare a metà
  await ev(() => { G.t = Math.max(G.t, 171); });
  await p.waitForTimeout(400);
  const eff = await ev(() => ({ shown: !$('#h-eff-w').hidden, txt: $('#h-eff').textContent }));
  check(eff.shown && /^\d+%$/.test(eff.txt), 'l\'efficienza non compare: ' + JSON.stringify(eff));

  // tutto il resto a posto: 100%, poi la sorpresa del baule SEGNALE
  await ev(() => {
    for (const w of G.workers) release(w);
    moveTo(700, 500);
    const spots = { corrente: [1675, 230, 1], distro: [1808, 250, 0], sub1: [1545, 640, 0], sub2: [1545, 480, 0], par: [1740, 560, 0], rack: [1260, 750, 0], valigetta: [1340, 750, 0] };
    for (const id in spots) {
      const [x, y, r] = spots[id], c = C(id);
      Matter.Body.setPosition(c.body, { x, y }); Matter.Body.setAngle(c.body, r * Math.PI / 2); Matter.Body.setVelocity(c.body, { x: 0, y: 0 });
    }
  });
  await p.waitForFunction(() => G.surprise, null, { timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(200);
  const s1 = await ev(() => ({ s: !!G.surprise, del: $('#h-del').textContent, hint: hintGoal, mode: G.mode }));
  check(s1.s && s1.del === '100%' && /100%/.test(s1.hint) && s1.mode === 'play', 'a materiale scaricato non c\'è il 100% o finisce subito: ' + JSON.stringify(s1));
  await p.waitForFunction(() => G.surprise && G.surprise.revealed, null, { timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(200);
  const s2 = await ev(() => ({ hidden: C('segnale').hidden, del: $('#h-del').textContent, hint: hintGoal, blocked: blockers(C('segnale')).length, mode: G.mode }));
  check(!s2.hidden && s2.del === '11/12' && /SEGNALE/.test(s2.hint) && !s2.blocked && s2.mode === 'play', 'il baule sotto il telo non salta fuori: ' + JSON.stringify(s2));
  await ev(() => { const c = C('segnale'); Matter.Body.setPosition(c.body, { x: 1740, y: 380 }); Matter.Body.setVelocity(c.body, { x: 0, y: 0 }); });
  await p.waitForFunction(() => G.mode === 'end', null, { timeout: 6000 }).catch(() => {});
  const end = await ev(() => ({ mode: G.mode, r: G.result, html: $('#end').innerText }));
  check(end.mode === 'end' && Number.isFinite(end.r.eff) && end.r.rough === 1 && end.r.cartTrips === 1, 'il risultato non porta efficienza e movimentazioni: ' + JSON.stringify(end.r));
  check(/EFFICIENZA/.test(end.html) && /Baule SEGNALE recuperato/.test(end.html) && /movimentazione brusca/i.test(end.html) && /col carrello/.test(end.html),
    'la bolla non racconta come hai lavorato: ' + end.html.slice(0, 400));
  await p.close();

  // telefono: cartello d'arrivo corto, pulsante visibile, scena sopra i comandi
  const m = await page({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true });
  const btn = await m.$('#btn-start'), bb = await btn.boundingBox();
  check(bb && bb.y + bb.height <= 760, 'sul telefono il pulsante per partire è fuori schermo: ' + JSON.stringify(bb));
  await m.tap('#btn-start');
  await m.waitForFunction(() => G && G.mode === 'play', null, { timeout: 10000 });
  const lay = await m.evaluate(() => {
    const cv = $('#cv').getBoundingClientRect(), hb = $('#hintbar').getBoundingClientRect(), pad = $('#pad').getBoundingClientRect();
    return { cvBottom: cv.bottom, hbTop: hb.top, hbBottom: hb.bottom, padTop: pad.top, help: $('#b-help').hidden, grab: !$('#b-grab').hidden, keys: $('#keys').hidden };
  });
  check(lay.cvBottom <= lay.hbTop + 1 && lay.hbBottom <= lay.padTop + 1 && lay.help && lay.grab && lay.keys,
    'sul telefono la scena finisce sotto la barra o i comandi, o ci sono comandi in più: ' + JSON.stringify(lay));
  await m.close();

  console.log('PROBLEMI:', JSON.stringify(problems, null, 1));
  console.log('ERRORI JS:', errs);
  await b.close();
  const ok = !problems.length && !errs.length;
  console.log(ok ? 'SCARICO TUTORIAL OK' : 'SCARICO TUTORIAL FALLITO');
  process.exit(ok ? 0 : 1);
})();
