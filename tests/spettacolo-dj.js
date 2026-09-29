/* Lo show del DJ set (prototipi/spettacolo-dj.html): le luci si suonano a
   tempo come in Guitar Hero. Controlla la mappa (note sulla griglia, mai più
   di due tasti insieme, lo strobo su ogni drop, la VOCE sulle frasi di Musa),
   poi gioca con un orologio finto: la demo prende tutte le note, il pubblico
   salta ai drop e sta fermo nel break, Musa apre la bocca solo quando nel
   brano c'è la voce; chi non tocca niente svuota il pubblico; tasti, note
   tenute mollate e colpi fuori tempo.

   Uso:  node tests/spettacolo-dj.js
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
    await p.goto('file://' + path.join(__dirname, '..', 'prototipi', 'spettacolo-dj.html'));
    await p.waitForFunction(() => window.__dj);
    await ev(() => { try { localStorage.clear(); } catch (e) {} __dj.virtual(true); });
  };
  // l'orologio finto va solo avanti
  const goTo = async t => { const d = await ev(t => t - __dj.state().t, t); if (d < 0) throw new Error('il test torna indietro a ' + t); await ev(d => __dj.advance(d), d); };

  await open();

  // ---- la mappa ----
  const m = await ev(() => {
    const M = __dj.mappa, beat = 60 / M.bpm, T = b => M.t0 + b * beat;
    const out = { bpm: M.bpm, n: M.note.length, bad: [], maxTogether: 0, dropsNoStrobe: [], voiceUncovered: [] };
    const sorted = M.note.every((n, i) => !i || M.note[i - 1][0] <= n[0]);
    if (!sorted) out.bad.push('note non in ordine');
    M.note.forEach(([b, l, len]) => {
      if (Math.abs(b * 4 - Math.round(b * 4)) > 1e-6) out.bad.push('fuori griglia ' + b);
      if (T(b + len) > M.durata) out.bad.push('oltre la fine ' + b);
      if (l < 0 || l > 3) out.bad.push('corsia ' + l);
    });
    // quanti tasti servono insieme in ogni istante (tenute in corso + tocchi)
    M.note.forEach(([b]) => {
      const k = M.note.filter(([c, , len]) => c === b || (len && c < b && b < c + len)).length;
      out.maxTogether = Math.max(out.maxTogether, k);
    });
    // due tenute sulla stessa corsia non si accavallano, un tocco non cade dentro una tenuta
    M.note.forEach(([b, l, len], i) => M.note.forEach(([c, k, len2], j) => {
      if (i !== j && l === k && len && c > b && c < b + len) out.bad.push('accavallata corsia ' + l + ' a ' + c);
    }));
    M.sezioni.filter(s => s[2] === 'DROP').forEach(([a]) => { if (!M.note.some(([b, l]) => b === a * 4 && l === 3)) out.dropsNoStrobe.push(a); });
    // ogni frase lunga del vocalist ha la sua nota VOCE che parte con la frase
    M.voce.forEach(([a, e]) => {
      if (e - a < beat) return;
      if (!M.note.some(([b, l]) => l === 2 && Math.abs(T(b) - a) < beat * 0.2)) out.voiceUncovered.push(a);
    });
    out.drops = M.sezioni.filter(s => s[2] === 'DROP').length;
    out.bocca = M.bocca.length / 25 - M.durata;
    return out;
  });
  check(m.bpm === 130, 'bpm della mappa: ' + m.bpm);
  check(m.n > 200, 'poche note: ' + m.n);
  check(!m.bad.length, 'note sbagliate: ' + m.bad.slice(0, 5).join(', '));
  check(m.maxTogether <= 2, 'servono ' + m.maxTogether + ' tasti insieme (sul telefono si hanno due pollici)');
  check(!m.dropsNoStrobe.length, 'drop senza strobo alle battute ' + m.dropsNoStrobe.join(', '));
  check(!m.voiceUncovered.length, 'frasi della voce senza nota VOCE a ' + m.voiceUncovered.join(', '));
  check(m.drops === 5, 'drop nella mappa: ' + m.drops);
  check(Math.abs(m.bocca) < 0.1, 'la bocca non copre il brano: ' + m.bocca);

  // ---- la demo: il capo suona tutte le note ----
  await ev(() => __dj.start(true));
  const M = await ev(() => ({ t0: __dj.mappa.t0, bpm: __dj.mappa.bpm, voce: __dj.mappa.voce, durata: __dj.mappa.durata }));
  const T = (bar, beat) => M.t0 + (bar * 4 + beat) * 60 / M.bpm;
  const crowd = () => ev(() => [...document.querySelectorAll('#crowd > g, #crowd2 > g')].map(g => +g.getAttribute('transform').match(/translate\(([-\d.]+) ([-\d.]+)\)/)[2]));
  const musa = () => ev(() => ({ singing: __dj.state().singing, ry: +document.querySelector('#mouth').getAttribute('ry'), bub: +document.querySelector('#voice-bub').getAttribute('opacity') }));

  // nel break (battuta 20) il pubblico non salta
  await goTo(T(20, 1.5));
  let ys = await crowd();
  check(ys.every(y => y > -1), 'nel break qualcuno salta: ' + Math.min(...ys));
  // al drop (battuta 33, a metà battito) il pubblico è in aria
  await goTo(T(33, 1.5));
  ys = await crowd();
  const up = ys.filter(y => y < -4).length;
  check(up >= ys.length * 0.6, 'al drop saltano in ' + up + ' su ' + ys.length);
  const g1 = await ev(() => __dj.state().grad);
  check(g1 > 70, 'con la demo il pubblico al primo drop è al ' + Math.round(g1) + '%');
  // Musa: bocca chiusa quando nel brano la voce non c'è, aperta nella frase
  // lunga del vocalist (che arriva dopo il primo drop)
  await goTo(T(34, 1));   // drop 1: niente voce
  let mu = await musa();
  check(!mu.singing && mu.ry < 2 && mu.bub === 0, 'Musa canta senza voce nel brano: ' + JSON.stringify(mu));
  const longest = M.voce.reduce((a, v) => v[1] - v[0] > a[1] - a[0] ? v : a);
  // frontali su Musa mentre canta (la demo tiene VOCE)
  await goTo(longest[0] + 0.3);
  const lit = await ev(() => +document.querySelectorAll('#beams path')[1].getAttribute('opacity'));
  check(lit > 0.3, 'con VOCE tenuta i frontali restano spenti: ' + lit);
  await goTo((longest[0] + longest[1]) / 2);
  mu = await musa();
  // a metà frase si può cadere in una pausa tra due parole: si guarda un tratto
  let sang = mu.singing, maxRy = mu.ry;
  for (let i = 0; i < 20 && !sang; i++) { await goTo((longest[0] + longest[1]) / 2 + 0.05 * (i + 1)); mu = await musa(); sang = mu.singing; maxRy = Math.max(maxRy, mu.ry); }
  check(sang && maxRy > 3 && mu.bub === 1, 'Musa non canta nella frase di ' + longest.join('-') + ' s: ' + JSON.stringify(mu));

  await goTo(M.durata + 1);
  const R = await ev(() => ({ r: __dj.results(), s: (({ miss, stray, perfect, good, dropHit, drops, darkVoice, holdsBroken, over, grad }) => ({ miss, stray, perfect, good, dropHit, drops, darkVoice, holdsBroken, over, grad }))(__dj.state()) }));
  check(R.s.over, 'la demo non finisce');
  check(R.s.miss === 0 && R.s.stray === 0 && R.s.holdsBroken === 0, 'la demo sbaglia: ' + JSON.stringify(R.s));
  check(R.r.acc > 0.999 && R.r.stars === 5, 'la demo non fa 5 stelle: ' + JSON.stringify(R.r));
  check(R.s.dropHit === 5 && R.s.drops === 5, 'drop presi dalla demo: ' + R.s.dropHit + '/' + R.s.drops);
  check(R.s.darkVoice < 1, 'con la demo Musa canta al buio per ' + R.s.darkVoice.toFixed(1) + ' s');
  check(R.s.grad >= 90, 'pubblico a fine demo: ' + Math.round(R.s.grad));
  await p.waitForSelector('#outro:not([hidden])', { timeout: 3000 }).catch(() => problems.push('niente scheda finale'));

  // ---- chi non tocca niente ----
  await open();
  await ev(() => __dj.start(false));
  await goTo(T(40, 0));
  const idle = await ev(() => ({ grad: __dj.state().grad, miss: __dj.state().miss, dark: __dj.state().darkVoice }));
  check(idle.grad < 25, 'senza toccare niente il pubblico resta al ' + Math.round(idle.grad) + '%');
  check(idle.miss > 50, 'note mancate senza toccare: ' + idle.miss);
  check(idle.dark > 10, 'Musa al buio senza VOCE: ' + idle.dark);
  // col pubblico spento al drop saltano in pochi
  await goTo(T(41, 1.5));
  ys = await crowd();
  check(ys.filter(y => y < -4).length < ys.length * 0.3, 'col pubblico spento saltano in ' + ys.filter(y => y < -4).length);

  // ---- tasti: una nota presa con la tastiera, un colpo fuori tempo, una tenuta mollata ----
  await open();
  await ev(() => __dj.start(false));
  const firstPulse = await ev(() => __dj.state().notes.find(n => n.lane === 0 && !n.hold && n.t > 20));
  await goTo(firstPulse.t);
  await p.keyboard.down('d'); await p.keyboard.up('d');
  let st = await ev(i => ({ state: __dj.state().notes[i].state, perfect: __dj.state().perfect }), firstPulse.i);
  check(st.state === 'hit' && st.perfect === 1, 'la D a tempo non prende la nota: ' + JSON.stringify(st));
  // fuori tempo: a metà tra due battiti, dove non c'è nessuna nota
  await goTo(firstPulse.t + 60 / M.bpm * 0.5);
  const stray0 = await ev(() => __dj.state().stray);
  await p.keyboard.down('d'); await p.keyboard.up('d');
  check(await ev(() => __dj.state().stray) === stray0 + 1, 'il colpo fuori tempo non conta');
  const hold = await ev(t => __dj.state().notes.find(n => n.hold && n.lane === 2 && n.t > t && n.end - n.t > 1.2), firstPulse.t);
  await goTo(hold.t + 0.03);
  await p.keyboard.down('j');
  await goTo((hold.t + hold.end) / 2);
  check(await ev(() => __dj.state().light[2]) > 0.9, 'VOCE tenuta non accende i frontali');
  await p.keyboard.up('j');
  st = await ev(i => ({ state: __dj.state().notes[i].state, broken: __dj.state().holdsBroken }), hold.i);
  check(st.state === 'broken' && st.broken === 1, 'la tenuta mollata a metà non si rompe: ' + JSON.stringify(st));

  // ---- facile: meno note, solo quelle marcate ----
  await open();
  await ev(() => document.querySelector('#diff-pick [data-d=facile]').click());
  await ev(() => __dj.start(false));
  const nf = await ev(() => ({ n: __dj.state().notes.length, all: __dj.mappa.note.length, easy: __dj.mappa.note.filter(n => n[3]).length }));
  check(nf.n === nf.easy && nf.n < nf.all * 0.8, 'facile: ' + JSON.stringify(nf));

  // ---- a colpo d'occhio: la pagina sta nello schermo del telefono ----
  // sul telefono tre file di pubblico stanno dietro la pista
  check(await ev(() => document.querySelectorAll('#crowd2 > g').length === 51 && !document.querySelector('#crowd-far').hasAttribute('hidden')), 'il pubblico non scende dietro la pista');
  const fit = await ev(() => ({ w: document.documentElement.scrollWidth, pads: document.querySelector('#pads').getBoundingClientRect().bottom, h: innerHeight }));
  check(fit.w <= 390 && fit.pads <= fit.h, 'non sta in 390×844: ' + JSON.stringify(fit));

  check(!errs.length, 'errori nella pagina: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('spettacolo-dj: tutto ok (' + m.n + ' note, ' + m.drops + ' drop)');
})();
