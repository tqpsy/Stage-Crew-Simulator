/* Il karaoke di Macio (karaoke.html), la pagina da sola. Controlla la
   canzone (sillabe in ordine e senza accavallarsi, note lunghe da tenere,
   testo che si legge giusto), poi gioca con un orologio finto:
   - la demo arriva in fondo con tutte le sillabe, voce sempre nel verde,
     niente larsen, cinque stelle;
   - la zona verde scende un tempo prima che Macio urli e risale dopo;
     quando va verso una cassa scende la zona rossa e, a voce alta, parte
     il larsen (una volta, poi c'è un attimo di tregua);
   - chi non tocca niente perde tutte le sillabe e il pubblico;
   - fuori tempo, nota lunga mollata, voce troppo bassa quando canta bene;
   - Macio dimentica la parola: compaiono tre parole, quella scelta finisce
     nel verso (la giusta fa rima, la buffa fa ridere, se non scegli è «ehm»);
   - il ponte: il CORO in tempo sulle bolle «OH!», fuori tempo no;
   - Gerry stacca la spina: compare il bottone, il pubblico cala, tre tocchi
     la riattaccano;
   - stanchezza che stringe la finestra, la birra che la riallarga, Facile
     più largo; la pausa ferma il tempo.

   Uso:  node tests/karaoke.js
   Richiede Playwright. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const problems = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const open = async () => {
    await p.goto('file://' + path.join(__dirname, '..', 'karaoke.html'));
    await p.waitForFunction(() => window.__karaoke);
    await ev(() => { try { localStorage.clear(); } catch (e) {} __karaoke.virtual(true); });
  };
  const goTo = t => ev(t => __karaoke.advance(t - __karaoke.state().t), t);

  await open();
  // ---- la canzone ----
  const song = await ev(() => {
    const K = __karaoke, N = K.notes, out = { n: N.length, bad: [], holds: N.filter(n => n.hold).length, lines: K.lines.length, text: [] };
    N.forEach((n, i) => {
      if (i && N[i - 1].t + N[i - 1].len > n.t + 1e-6) out.bad.push('accavallate ' + N[i - 1].text + '/' + n.text);
      if (Math.abs(n.t / (K.beat / 2) - Math.round(n.t / (K.beat / 2))) > 1e-6) out.bad.push('fuori griglia ' + n.text);
      if (n.t + n.len > K.dur) out.bad.push('oltre la fine ' + n.text);
    });
    K.lines.forEach(l => { if (!l.notes[l.notes.length - 1].hold) out.bad.push('verso senza nota lunga in fondo: ' + l.i); });
    out.text = [...document.querySelectorAll('#ly-nxt')].map(e => e.textContent);
    return out;
  });
  check(!song.bad.length, 'canzone: ' + song.bad.join(', '));
  check(song.lines === 12 && song.n > 80 && song.holds >= 12, 'canzone: ' + JSON.stringify(song));
  check(song.text[0] === 'Gerry ha spento tutto quanto', 'il primo verso non si legge giusto: ' + song.text[0]);

  // ---- la demo ----
  await ev(() => __karaoke.start(true));
  const BAR = await ev(() => __karaoke.bar);
  await goTo(3.5 * BAR);
  const ly = await ev(() => ({ cur: document.querySelector('#ly-cur').textContent, sung: document.querySelectorAll('#ly-cur .s.sung, #ly-cur .s.held').length }));
  check(/Gerry ha spento tutto quanto/.test(ly.cur.replace(/ /g, ' ')) && ly.sung > 3, 'lo schermo del karaoke non segue il testo: ' + JSON.stringify(ly));
  await ev(() => { for (let i = 0; i < 40 && !__karaoke.state().over; i++) __karaoke.advance(5); });
  const demo = await ev(() => { const s = __karaoke.state(); return { over: s.over, miss: s.miss, larsens: s.larsens, r: __karaoke.result(), phones: s.phones }; });
  check(demo.over && demo.miss === 0 && demo.larsens === 0, 'la demo non arriva in fondo pulita: ' + JSON.stringify(demo));
  check(demo.r && demo.r.stars === 5 && demo.r.zone >= 95 && demo.r.grad >= 90 && demo.r.beers === 2, 'esito della demo: ' + JSON.stringify(demo.r));
  check(demo.r && demo.r.rime === 4 && demo.r.coro === 8 && demo.r.spina < 1.5, 'la demo non sceglie le rime, non fa il coro o non riattacca la spina: ' + JSON.stringify(demo.r));
  check(demo.phones > 0.5, 'nel ritornello finale il pubblico non accende i telefoni');
  await p.waitForSelector('#outro:not([hidden])');
  check(/salvato la serata/.test(await p.textContent('#outro-msg')), 'la scheda finale non dice che Macio ha salvato la serata');

  // ---- le zone ----
  const z = await ev(() => {
    const K = __karaoke, B = K.bar, BEAT = K.beat, [a, , ] = K.urla[1], [wa] = K.walk[0];
    const zt = t => K.zoneTarget(t);
    return { tune: zt(3 * B), before: zt(a * B - BEAT * 0.5), off: zt(a * B + 0.5), walk: zt(wa * B + 1), walkFree: zt(4 * B) };
  });
  check(z.tune.lo > 0.5 && z.off.hi < 0.45, 'zona verde: normale ' + JSON.stringify(z.tune) + ', urla ' + JSON.stringify(z.off));
  check(z.before.hi < 0.45, 'la zona non scende un tempo prima che Macio urli: ' + JSON.stringify(z.before));
  check(z.walk.red < 0.6 && z.walkFree.red > 0.9 && z.walk.hi < z.walk.red, 'zona rossa del larsen: ' + JSON.stringify(z));

  // ---- chi non tocca niente ----
  await open();
  await ev(() => __karaoke.start(false));
  await ev(() => { __karaoke.setFader(0.7); for (let i = 0; i < 40 && !__karaoke.state().over; i++) __karaoke.advance(5); });
  const idle = await ev(() => { const s = __karaoke.state(); return { miss: s.miss, n: s.notes.length, r: __karaoke.result(), larsens: s.larsens, picks: s.picks.map(p => p.kind), spina: s.spina.on }; });
  check(idle.picks.length === 4 && idle.picks.every(k => k === 'nessuna'), 'senza scegliere le parole: ' + idle.picks);
  check(idle.miss === idle.n && idle.r.grad < 25 && idle.r.stars <= 2 && idle.r.rep < 5, 'chi non tocca niente: ' + JSON.stringify({ ...idle, r: { grad: idle.r.grad, stars: idle.r.stars, rep: idle.r.rep } }));
  check(idle.larsens >= 2, 'con la voce a 70% verso le casse non parte il larsen: ' + idle.larsens);

  // ---- tocchi: in tempo, fuori tempo, nota lunga mollata ----
  await open();
  await ev(() => __karaoke.start(false));
  const t1 = await ev(() => __karaoke.notes[0].t);
  await goTo(t1);
  const hit = await ev(() => { __karaoke.press(); __karaoke.release(); const s = __karaoke.state(); return { perfect: s.perfect, st: s.notes[0].state }; });
  check(hit.perfect === 1 && hit.st === 'hit', 'sillaba in tempo: ' + JSON.stringify(hit));
  // la seconda sillaba arriva 0,6 s dopo la prima: a metà strada è fuori tempo
  const s2 = await ev(() => { __karaoke.advance(0.3); __karaoke.press(); __karaoke.release(); return __karaoke.state().stray; });
  check(s2 === 1, 'premuto fuori tempo: ' + s2);
  const hold = await ev(() => __karaoke.notes.find(n => n.hold));
  await goTo(hold.t);
  const br = await ev(() => { __karaoke.press(); __karaoke.advance(0.3); __karaoke.release(); const s = __karaoke.state(); return { broken: s.holdsBroken, st: s.notes[__karaoke.notes.find(n => n.hold).i].state }; });
  check(br.broken === 1 && br.st === 'broken', 'nota lunga mollata subito: ' + JSON.stringify(br));
  const next = await ev(() => __karaoke.notes.filter(n => n.hold)[1]);
  await goTo(next.t);
  const held = await ev(() => { __karaoke.press(); const n = __karaoke.notes.filter(n => n.hold)[1]; __karaoke.advance(n.end - __karaoke.state().t + 0.05); __karaoke.release(); return __karaoke.state().notes[n.i].state; });
  check(held === 'done', 'nota lunga tenuta fino in fondo: ' + held);

  // ---- voce troppo bassa quando canta bene: il pubblico cala ----
  await open();
  await ev(() => __karaoke.start(true));
  await goTo(3.5 * BAR);
  const low = await ev(() => { const g0 = __karaoke.state().grad; const s = __karaoke.state(); s.auto = false; for (let i = 0; i < 60; i++) { __karaoke.setFader(0.1); __karaoke.advance(1 / 60); } return { g0, g1: __karaoke.state().grad, low: __karaoke.state().lowTime }; });
  check(low.low > 0.5, 'voce bassa non contata: ' + JSON.stringify(low));

  // ---- le parole da scegliere ----
  await open();
  await ev(() => __karaoke.start(false));
  const ch = await ev(() => { const K = __karaoke, [li] = K.scelte[0], L = K.lines[li]; return { t0: L.t0, nt: L.choice.t, i: L.choice.i, li }; });
  await goTo(ch.t0 - 0.5);
  const box = await ev(() => ({ vis: !document.querySelector('#choices').hidden, words: [...document.querySelectorAll('#choices button')].map(b => b.firstChild.textContent), ly: document.querySelector('#ly-cur').textContent + '|' + document.querySelector('#ly-nxt').textContent }));
  check(box.vis && box.words.length === 3 && box.words.includes('panino') && /\?\?\?/.test(box.ly), 'le parole da scegliere non compaiono: ' + JSON.stringify(box));
  const k = box.words.indexOf('panino') + 1;
  await p.keyboard.press('Digit' + k);
  const picked = await ev(i => { const s = __karaoke.state(); return { hidden: document.querySelector('#choices').hidden, text: s.notes[i].text, clip: s.notes[i].clip, picks: s.picks }; }, ch.i);
  check(picked.hidden && picked.text.trim() === 'panino' && picked.clip === 'opt-' + ch.li + '-1' && picked.picks[0].kind === 'buffa', 'scelta della parola: ' + JSON.stringify(picked));
  await goTo(ch.nt);
  const sung = await ev(i => { __karaoke.press(); __karaoke.advance(0.1); return { st: __karaoke.state().notes[i].state, ly: document.querySelector('#ly-cur').textContent }; }, ch.i);
  check(sung.st === 'holding' && /panino/.test(sung.ly), 'la parola scelta non si canta: ' + JSON.stringify(sung));
  await ev(() => __karaoke.release());

  // ---- la spina e il coro del ponte ----
  const sp = await ev(() => { const K = __karaoke; K.advance(K.spinaT - K.state().t + 0.05); const s = K.state(); s.grad = 50; return { on: s.spina.on, vis: !document.querySelector('#spina').hidden, g0: s.grad }; });
  check(sp.on && sp.vis, 'Gerry non stacca la spina: ' + JSON.stringify(sp));
  const g1 = await ev(() => { __karaoke.advance(0.5); return __karaoke.state().grad; });
  check(g1 < sp.g0 - 1.5, 'a spina staccata il pubblico non cala: ' + sp.g0 + ' -> ' + g1);
  for (let i = 0; i < 3; i++) await p.click('#spina');
  const fixed = await ev(() => { const s = __karaoke.state(); return { on: s.spina.on, done: s.spina.done, vis: !document.querySelector('#spina').hidden }; });
  check(!fixed.on && fixed.done && !fixed.vis, 'la spina non si riattacca con tre tocchi: ' + JSON.stringify(fixed));
  const coro = await ev(() => {
    const K = __karaoke, c = K.notes.filter(n => n.kind === 'coro');
    K.advance(c[0].t - K.state().t); K.pressCoro(); K.releaseCoro();
    const s = K.state(), hit = s.coroHit, st = s.notes[c[0].i].state;
    K.advance((c[1].t - s.t) / 2); K.pressCoro(); K.releaseCoro();
    return { hit, st, stray: K.state().stray, n: c.length };
  });
  check(coro.n === 8 && coro.hit === 1 && coro.st === 'hit' && coro.stray === 1, 'il coro del ponte: ' + JSON.stringify(coro));

  // ---- stanchezza, birra, facile, pausa ----
  await open();
  const w = await ev(() => {
    __karaoke.start(false);
    const s = __karaoke.state(); s.fatigue = 90; const tired = __karaoke.windows()[1];
    __karaoke.advance(0.1); const b0 = s.beers; __karaoke.drinkBeer(); const after = __karaoke.windows()[1];
    return { tired, after, b0, b1: s.beers, drunk: s.drunk };
  });
  check(w.after > w.tired && w.b1 === w.b0 - 1 && w.drunk === 1, 'birra e stanchezza: ' + JSON.stringify(w));
  await p.click('#pause-btn');
  check(await ev(() => __karaoke.state().paused) && await p.isVisible('#pausa'), 'la pausa non si mette');
  await open();
  await p.click('#diff-pick button[data-d="facile"]');
  const fac = await ev(() => { __karaoke.start(false); return __karaoke.windows()[1]; });
  await open();
  await p.click('#diff-pick button[data-d="normale"]');
  const nor = await ev(() => { __karaoke.start(false); return __karaoke.windows()[1]; });
  check(fac > nor * 1.2, 'Facile non allarga la finestra: ' + fac + ' / ' + nor);

  check(errs.length === 0, 'errori JS: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('karaoke: tutto ok');
})();
