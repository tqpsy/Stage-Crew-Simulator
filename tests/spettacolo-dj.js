/* Lo show del DJ (dj.html): Light Operator Hero. Controlla la mappa (note
   sulla griglia, mai più di due tasti insieme, il drop come nota lunga di
   strobo, la pausa prima di ogni drop, nessuna nota dopo il taglio di
   Gerry, i drop via via più fitti), poi gioca con un
   orologio finto:
   - la demo arriva in fondo coi guasti gestiti e il rewind; verso la fine
     Gerry arriva arrabbiato e stacca la corrente: musica e luci via;
   - finestre più strette e note più veloci verso la fine;
   - il pubblico salta ai drop e sta fermo nel break, Musa apre la bocca solo
     quando nel brano c'è la voce;
   - i guasti-nota: fader DJ, MUTE (e il larsen se manca), fader MIC;
   - il PAR senza DMX spegne la corsia CHASE finché non lo sistemi;
   - il guasto grosso: ci vai tu (Quadro, errori che costano tempo, rewind,
     +5), paghi una birra al capo (0), nessuno e arriva Gerry (−5); senza birre
     il capo non si paga; il capo non si spazientisce: resta alle luci;
   - chi non tocca niente svuota il pubblico; tasti, fuori tempo, tenute.

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
  const open = async (beers) => {
    await p.goto('file://' + path.join(__dirname, '..', 'dj.html'));
    await p.waitForFunction(() => window.__dj);
    await ev(() => { try { localStorage.clear(); } catch (e) {} __dj.virtual(true); });
  };
  // l'orologio finto va solo avanti (il rewind lo porta indietro da solo)
  const goTo = async t => {
    const d = await ev(t => t - __dj.state().t, t);
    if (d < -1e-6) throw new Error('il test torna indietro a ' + t);
    // col rewind il brano torna indietro mentre si avanza: si avanza finché ci si arriva
    await ev(t => { for (let i = 0; i < 20 && __dj.state().t < t - 1e-6 && __dj.state().running && !__dj.state().over && !__dj.state().finale; i++) __dj.advance(t - __dj.state().t); }, t);
  };
  const S = fn => ev(fn);

  await open();
  const M = await ev(() => ({ t0: __dj.mappa.t0, bpm: __dj.mappa.bpm, voce: __dj.mappa.voce, durata: __dj.mappa.durata, battute: __dj.mappa.battute }));
  const T = (bar, beat = 0) => M.t0 + (bar * 4 + beat) * 60 / M.bpm;

  // ---- la mappa ----
  const m = await ev(() => {
    const M = __dj.mappa, beat = 60 / M.bpm, T = b => M.t0 + b * beat;
    const out = { bpm: M.bpm, n: M.note.length, bad: [], maxTogether: 0, dropsNoHold: [], buildsNoBlack: [], afterCut: M.note.filter(([b, , len]) => b + len > M.taglio).length, dens: [] };
    if (!M.note.every((n, i) => !i || M.note[i - 1][0] <= n[0])) out.bad.push('note non in ordine');
    M.note.forEach(([b, l, len]) => {
      if (Math.abs(b * 4 - Math.round(b * 4)) > 1e-6) out.bad.push('fuori griglia ' + b);
      if (T(b + len) > M.durata) out.bad.push('oltre la fine ' + b);
      if (l < 0 || l > 2) out.bad.push('corsia ' + l);
    });
    M.note.forEach(([b]) => {
      const k = M.note.filter(([c, , len]) => c === b || (len && c < b && b < c + len)).length;
      out.maxTogether = Math.max(out.maxTogether, k);
    });
    M.note.forEach(([b, l, len], i) => M.note.forEach(([c, k], j) => {
      if (i !== j && l === k && len && c > b && c < b + len) out.bad.push('dentro una tenuta, corsia ' + l + ' a ' + c);
    }));
    M.sezioni.forEach(([a, , k], i) => {
      if (k === 'DROP' && !M.note.some(([b, l, len]) => b === a * 4 && l === 2 && len >= 4)) out.dropsNoHold.push(a);
      // il battito prima del drop è una pausa
      if (k === 'DROP' && M.sezioni[i - 1][2] === 'BUILD' && M.note.some(([b]) => b >= a * 4 - 1 && b < a * 4)) out.buildsNoBlack.push(a);
      if (k === 'DROP') out.dens.push(M.note.filter(([b]) => b >= a * 4 && b < (M.sezioni[i][1] + 1) * 4).length / (M.sezioni[i][1] - a + 1));
    });
    out.drops = M.sezioni.filter(s => s[2] === 'DROP').length;
    return out;
  });
  check(m.bpm === 130, 'bpm della mappa: ' + m.bpm);
  check(m.n > 200, 'poche note: ' + m.n);
  check(!m.bad.length, 'note sbagliate: ' + m.bad.slice(0, 5).join(', '));
  check(m.maxTogether <= 2, 'servono ' + m.maxTogether + ' tasti insieme (sul telefono si hanno due pollici)');
  check(!m.dropsNoHold.length, 'drop senza la nota lunga di strobo alle battute ' + m.dropsNoHold.join(', '));
  check(!m.buildsNoBlack.length, 'note nel battito di pausa prima dei drop ' + m.buildsNoBlack.join(', '));
  check(!m.afterCut, 'note dopo che Gerry stacca la corrente: ' + m.afterCut);
  check(m.dens[4] > m.dens[0] + 0.5 && m.dens.every((d, i) => !i || d >= m.dens[i - 1]), 'i drop non si fanno più fitti: ' + m.dens.map(d => d.toFixed(1)).join(' '));
  check(m.drops === 5, 'drop nella mappa: ' + m.drops);

  let st;
  // ---- la demo: il capo suona e affronta i guasti ----
  await ev(() => __dj.start(true));
  const crowd = () => ev(() => [...document.querySelectorAll('#crowd > g, #crowd2 > g')].map(g => +g.getAttribute('transform').match(/translate\(([-\d.]+) ([-\d.]+)\)/)[2]));
  const musa = () => ev(() => ({ singing: __dj.state().singing, ry: +document.querySelector('#mouth').getAttribute('ry'), bub: +document.querySelector('#voice-bub').getAttribute('opacity') }));
  await goTo(T(33, 1.5));
  let ys = await crowd();
  check(ys.filter(y => y < -4).length >= ys.length * 0.6, 'al drop saltano in ' + ys.filter(y => y < -4).length + ' su ' + ys.length);
  await goTo(T(34, 1));
  let mu = await musa();
  check(!mu.singing && mu.ry < 2 && mu.bub === 0, 'Musa canta senza voce nel brano: ' + JSON.stringify(mu));
  const longest = M.voce.reduce((a, v) => v[1] - v[0] > a[1] - a[0] ? v : a);
  let sang = false, maxRy = 0;
  for (let i = 0; i < 30 && !sang; i++) { await goTo(longest[0] + 1 + 0.05 * i); mu = await musa(); sang = mu.singing; maxRy = Math.max(maxRy, mu.ry); }
  check(sang && maxRy > 3, 'Musa non canta nella frase di ' + longest.join('-') + ' s');
  // più avanti il pezzo, finestre più strette e note più veloci
  const early = await ev(() => ({ w: __dj.windows()[1], l: __dj.look(), f: __dj.state().fatigue }));
  // verso la fine Gerry arriva arrabbiato, poi stacca la corrente di botto
  const cut = await ev(() => __dj.cut);
  await goTo(T(81, 1));
  const late = await ev(() => ({ w: __dj.windows()[1], l: __dj.look(), f: __dj.state().fatigue }));
  check(late.l < early.l - 0.1 && late.w / (1 - late.f / 250) < early.w / (1 - early.f / 250) - 0.005, 'la pista non si fa più difficile: ' + JSON.stringify({ early, late }));
  st = await ev(() => ({ angry: __dj.state().gerryAngry, say: __dj.state().gerrySay, x: __dj.state().gerryX, face: +document.querySelector('#gerry-angry').getAttribute('opacity') }));
  check(st.angry && /parolacce/i.test(st.say) && st.x < 400 && st.face === 1, 'Gerry non arriva arrabbiato prima del taglio: ' + JSON.stringify(st));
  check(cut < M.durata - 2, 'Gerry stacca troppo tardi: ' + cut);
  await goTo(cut - 0.05);
  check(!(await ev(() => __dj.state().finale)), 'la corrente va via prima del taglio');
  // prima va via la musica, le luci restano un attimo; poi si spengono anche loro
  const lights = () => ev(() => ({ fin: !!__dj.state().finale, f: __dj.state().finale && __dj.state().finale.f, dark: +document.querySelector('#dark').getAttribute('opacity'), beams: [...document.querySelectorAll('#beams path')].map(b => +b.getAttribute('opacity')), pads: [...document.querySelectorAll('.pad')].length }));
  await ev(() => __dj.advance(0.15));
  st = await lights();
  check(st.fin && st.dark === 0 && st.beams.some(o => o > 0), 'al taglio le luci vanno via insieme alla musica: ' + JSON.stringify(st));
  check(st.pads === 3 && !(await p.$('.pad[data-l="3"]')), 'c\'è ancora un quarto tasto (BLACKOUT)');
  await ev(() => __dj.advance(0.8));
  st = await lights();
  check(st.dark > 0.4 && st.beams.every(o => o === 0), 'dopo la musica le luci non si spengono: ' + JSON.stringify(st));
  // il pubblico rumoreggia contro il bidello: pugni alzati; e intanto si litiga
  await ev(() => __dj.advance(1.8));
  st = await ev(() => ({ arms: [...document.querySelectorAll('#crowd > g > path, #crowd2 > g > path')].filter(a => +a.getAttribute('opacity') === 1).length, talk: __dj.state().talk, say: __dj.state().gerrySay }));
  check(st.arms > 30, 'il pubblico non rumoreggia contro il bidello: ' + st.arms + ' pugni alzati');
  check(st.talk || st.say, 'dopo il taglio nessuno litiga: ' + JSON.stringify(st));
  // in fondo il messaggio per il prossimo cambio palco, sul palco e nella scheda finale
  await ev(() => __dj.advance(4.9));
  st = await ev(() => ({ msg: !document.querySelector('#stage-msg').hidden && document.querySelector('#stage-msg').textContent, over: __dj.state().over }));
  check(st.msg && /cacciato via i musicisti.*senza musica/.test(st.msg) && !st.over, 'manca il messaggio finale sul palco: ' + JSON.stringify(st));
  await ev(() => __dj.advance(3));
  let R = await ev(() => ({ r: __dj.result(), s: (({ miss, stray, perfect, lost, dropHeld, drops, holdsBroken, over, rewinds, larsens }) => ({ miss, stray, perfect, lost, dropHeld, drops, holdsBroken, over, rewinds, larsens }))(__dj.state()) }));
  check(R.s.over && R.r, 'la demo non finisce');
  check(R.s.miss === 0 && R.s.stray === 0 && R.s.holdsBroken === 0, 'la demo sbaglia: ' + JSON.stringify(R.s));
  check(R.r && R.r.stars === 5 && R.r.acc >= 95, 'la demo non fa 5 stelle: ' + JSON.stringify(R.r));
  check(R.s.dropHeld === 5 && R.s.drops === 5, 'drop tenuti dalla demo: ' + R.s.dropHeld + '/' + R.s.drops);
  check(R.s.rewinds === 1 && R.r.fase === 'tu', 'la demo non va al Quadro col rewind: ' + JSON.stringify(R.r));
  check(R.s.larsens === 0 && R.r.beers === 2, 'la demo: larsen o birre sbagliati ' + JSON.stringify(R.r));
  check(R.r.rep === 5 + 4 + 1 + 5 + 3 + 1 + 1, 'reputazione della demo: ' + R.r.rep);
  await p.waitForSelector('#outro:not([hidden])', { timeout: 3000 }).catch(() => problems.push('niente scheda finale'));
  check(/cacciato via i musicisti/.test(await p.textContent('#outro-msg')) && /senza musica/.test(R.r.msg || ''), 'la scheda finale non dice che si ripristina il palco');

  // ---- guasti a mano: fader DJ a tempo, poi il guasto grosso: ci vai tu ----
  await open();
  await ev(() => __dj.start(false));
  await goTo(T(10, 0.5));
  st = await S(() => ({ f: __dj.state().faults.gain, pop: !document.querySelector('#pop-fader').hidden, sp: __dj.state().specials.length }));
  check(st.f && st.f.state === 'on' && st.pop && st.sp === 1, 'il gain del DJ non va in rosso a battuta 10: ' + JSON.stringify(st));
  await p.keyboard.down('v'); await p.keyboard.up('v');
  st = await S(() => ({ f: __dj.state().faults.gain.state, hot: __dj.state().djHot }));
  check(st.f === 'ok' && !st.hot, 'col fader giù il gain non torna a posto: ' + JSON.stringify(st));

  await goTo(T(17, 0.2));
  st = await S(() => ({ down: __dj.state().phaseDown, choice: !document.querySelector('#choice').hidden, dead: [...document.querySelectorAll('.pad.dead')].length }));
  check(st.down && st.choice && st.dead === 2, 'la fase non scatta a battuta 17: ' + JSON.stringify(st));
  await ev(() => document.querySelector('#opt-tu').click());
  const leftAt = await S(() => __dj.state().t);
  st = await S(() => ({ away: !!__dj.state().away, capo: __dj.state().capo, quadro: !document.querySelector('#quadro').hidden }));
  check(st.away && st.capo && st.quadro, 'ci vai tu: niente Quadro o niente capo alle luci ' + JSON.stringify(st));
  // riarmare col carico ancora su L2 fa riscattare; su L1 non ci sta
  await ev(() => __dj.quadro('arm')); await goTo(leftAt + 2);
  check(await S(() => __dj.state().phaseDown), 'riarmata col carico su L2 e non riscatta');
  await ev(() => __dj.quadro('L1')); await goTo(leftAt + 5);
  check(await S(() => (__dj.state().faults.fase.plug || 'L2') === 'L2'), 'la ciabattina è andata su L1 (col finale)');
  await ev(() => __dj.quadro('L3')); await goTo(leftAt + 7);
  const before = await S(() => ({ t: __dj.state().t, w: __dj.state().notes.filter(n => n.state === 'wait').length }));
  await ev(() => __dj.quadro('arm')); await ev(() => __dj.advance(1.6));
  st = await S(() => ({ down: __dj.state().phaseDown, away: !!__dj.state().away, t: __dj.state().t, rew: __dj.state().rewinds, w: __dj.state().notes.filter(n => n.state === 'wait').length, rep: __dj.state().repParts }));
  check(!st.down && !st.away && st.rew === 1, 'riarmata L2 ma non si torna alle luci: ' + JSON.stringify(st));
  check(st.t < before.t - 6, 'il rewind non riporta indietro il brano: ' + st.t + ' vs ' + before.t);
  check(st.w > before.w, 'col rewind le note perse non tornano');
  check(st.rep.some(([w, v]) => v === 5), 'ci sei andato tu in fretta ma niente +5: ' + JSON.stringify(st.rep));

  // ---- PAR senza DMX: la corsia CHASE si spegne finché non lo sistemi ----
  await goTo(T(42, 0.5));
  st = await S(() => ({ dead: __dj.state().dmxDead, chip: !document.querySelector('#dmx-chip').hidden, pad: document.querySelector('.pad[data-l="1"]').classList.contains('dead'), cause: __dj.state().faults.dmx.cause }));
  check(st.dead && st.chip && st.pad, 'il PAR 4 non perde il DMX a battuta 42: ' + JSON.stringify(st));
  await ev(() => document.querySelector('#dmx-chip').click());
  const right = { cavo: 'plug', indirizzo: 'a010', corrente: 'power' }[st.cause], wrong = right === 'plug' ? 'a010' : 'plug';
  await ev(k => document.querySelector(`#par-acts [data-k="${k}"]`).click(), wrong);
  check(await S(() => __dj.state().dmxDead), 'la cura sbagliata sistema il PAR');
  await goTo(T(42, 0.5) + 2);
  await ev(k => document.querySelector(`#par-acts [data-k="${k}"]`).click(), right);
  st = await S(() => ({ dead: __dj.state().dmxDead, pad: document.querySelector('.pad[data-l="1"]').classList.contains('dead') }));
  check(!st.dead && !st.pad, 'il PAR sistemato non torna: ' + JSON.stringify(st));

  // ---- larsen: senza MUTE parte ----
  await goTo(T(49, 0.5));
  check(await S(() => !document.querySelector('#pop-mute').hidden), 'niente MUTE quando Musa va verso la cassa');
  await goTo(T(52, 2));
  st = await S(() => ({ l: __dj.state().larsens, rep: __dj.state().repParts.filter(p => p[1] === -5).length }));
  check(st.l === 1 && st.rep === 1, 'senza MUTE niente larsen: ' + JSON.stringify(st));

  // ---- fader MIC a mano, trascinandolo ----
  await goTo(T(67, 0.5));
  check(await S(() => __dj.state().faults.mangia && __dj.state().faults.mangia.state === 'on'), 'Musa non si mangia il microfono a battuta 67');
  const tr = await (await p.$('#track')).boundingBox();
  await p.mouse.move(tr.x + tr.width / 2, tr.y + 5); await p.mouse.down();
  await p.mouse.move(tr.x + tr.width / 2, tr.y + tr.height * 0.7, { steps: 5 }); await p.mouse.up();
  check(await S(() => __dj.state().faults.mangia.state === 'ok'), 'trascinando il fader MIC giù il guasto resta');

  // ---- guasto grosso: una birra al capo, poi nessuno (Gerry) ----
  await open();
  await ev(() => __dj.start(false));
  await goTo(T(17, 0.2));
  await ev(() => document.querySelector('#opt-capo').click());
  st = await S(() => ({ beers: __dj.state().beers, away: !!__dj.state().away }));
  check(st.beers === 1 && !st.away, 'birra al capo: ' + JSON.stringify(st));
  await goTo(T(17, 0.2) + 7);
  st = await S(() => ({ down: __dj.state().phaseDown, rew: __dj.state().rewinds, rep: __dj.state().repParts.map(p => p[1]) }));
  check(!st.down && st.rew === 0 && !st.rep.some(v => v !== 0 && v !== 1), 'il capo non riarma, o c\'è rewind: ' + JSON.stringify(st));

  await open();
  await ev(() => __dj.start(false));
  await goTo(T(17, 0.2));
  await goTo(T(17, 0.2) + 11);    // nessuno sceglie: tocca a Gerry
  check(await S(() => __dj.state().big.who === 'gerry' && __dj.state().phaseDown), 'senza scelta non si aspetta Gerry');
  await goTo(T(17, 0.2) + 21);
  st = await S(() => ({ down: __dj.state().phaseDown, rep: __dj.state().repParts.map(p => p[1]), gx: __dj.state().gerryX }));
  check(!st.down && st.rep.includes(-5) && st.gx < 400, 'Gerry non sistema la fase, o niente −5: ' + JSON.stringify(st));

  // senza birre in tasca il capo non si paga; e se stai via a lungo il capo resta alle luci
  await open();
  await ev(() => { __dj.start(false); __dj.state().beers = 0; });
  await goTo(T(17, 0.2));
  check(await S(() => document.querySelector('#opt-capo').disabled), 'senza birre si può pagare il capo');
  await ev(() => document.querySelector('#opt-tu').click());
  await goTo(T(17, 0.2) + 31);
  st = await S(() => ({ away: !!__dj.state().away, down: __dj.state().phaseDown, rew: __dj.state().rewinds }));
  check(st.away && st.down && st.rew === 0, 'dopo 30 s il capo ti rimanda alle luci: ' + JSON.stringify(st));
  await ev(() => __dj.quadro('L3')); await ev(() => __dj.advance(1.6));
  await ev(() => __dj.quadro('arm')); await ev(() => __dj.advance(1.6));
  st = await S(() => ({ down: __dj.state().phaseDown, rep: __dj.state().repParts.filter(p => /Quadro/.test(p[0])).map(p => p[1]) }));
  check(!st.down && st.rep.length === 1 && st.rep[0] === 0, 'finire il Quadro con calma: ' + JSON.stringify(st));

  // ---- PAR che non risponde: il capo per una birra, oppure il ripiego sui tre PAR buoni ----
  await open();
  await ev(() => { __dj.start(false); __dj.state().beers = 2; });
  await goTo(T(42, 0.5));
  await ev(() => document.querySelector('#dmx-chip').click());
  await ev(() => document.querySelector('#par-acts [data-k="capo"]').click());
  st = await S(() => ({ beers: __dj.state().beers, dead: __dj.state().dmxDead, open: !document.querySelector('#pop-par').hidden }));
  check(st.beers === 1 && st.dead && !st.open, 'il capo non prende la birra per il PAR: ' + JSON.stringify(st));
  await goTo(T(42, 0.5) + 7);
  st = await S(() => ({ dead: __dj.state().dmxDead, chip: !document.querySelector('#dmx-chip').hidden, by: __dj.state().faults.dmx.byCapo }));
  check(!st.dead && !st.chip && st.by, 'il capo non sistema il PAR: ' + JSON.stringify(st));
  await open();
  await ev(() => __dj.start(false));
  await goTo(T(42, 0.5));
  await ev(() => document.querySelector('#dmx-chip').click());
  await ev(() => document.querySelector('#par-acts [data-k="ripiego"]').click());
  st = await S(() => ({ dead: __dj.state().dmxDead, off: __dj.state().par4Off, pad: document.querySelector('.pad[data-l="1"]').classList.contains('dead'), chip: !document.querySelector('#dmx-chip').hidden }));
  check(!st.dead && st.off && !st.pad && st.chip, 'il ripiego non riapre la corsia CHASE col PAR 4 spento: ' + JSON.stringify(st));
  await ev(() => document.querySelector('#dmx-chip').click());
  const fix = await S(() => ({ cavo: 'plug', indirizzo: 'a010', corrente: 'power' }[__dj.state().faults.dmx.cause]));
  await ev(k => document.querySelector(`#par-acts [data-k="${k}"]`).click(), fix);
  check(await S(() => !__dj.state().par4Off && __dj.state().faults.dmx.state !== 'on'), 'dopo il ripiego il PAR 4 non si sistema');

  // ---- chi non tocca niente ----
  await open();
  await ev(() => __dj.start(false));
  await goTo(T(16, 0));
  const idle = await S(() => ({ grad: __dj.state().grad, miss: __dj.state().miss }));
  check(idle.grad < 25 && idle.miss > 25, 'senza toccare niente il pubblico resta al ' + Math.round(idle.grad) + '% (' + idle.miss + ' mancate)');

  // ---- tasti: nota a tempo, fuori tempo, tenuta mollata, birra ----
  await open();
  await ev(() => __dj.start(false));
  const n1 = await S(() => __dj.state().notes.find(n => n.lane === 0 && !n.hold && n.t > 3));
  await goTo(n1.t);
  await p.keyboard.down('d'); await p.keyboard.up('d');
  st = await ev(i => ({ state: __dj.state().notes.find(n => n.i === i).state, perfect: __dj.state().perfect }), n1.i);
  check(st.state === 'hit' && st.perfect === 1, 'la D a tempo non prende la nota: ' + JSON.stringify(st));
  await goTo(n1.t + 60 / M.bpm * 0.5);
  await p.keyboard.down('d'); await p.keyboard.up('d');
  check(await S(() => __dj.state().stray) === 1, 'il colpo fuori tempo non conta');
  const hold = await S(() => __dj.state().notes.find(n => n.hold));
  await goTo(hold.t);
  await p.keyboard.down('j');
  await goTo((hold.t + hold.end) / 2);
  check(await S(() => __dj.state().strobe) > 0.9, 'lo strobo tenuto non si accende');
  await p.keyboard.up('j');
  const hs = await ev(i => ({ st: __dj.state().notes.find(n => n.i === i).state, t: __dj.state().t, n: __dj.state().notes.find(n => n.i === i) }), hold.i);
  check(hs.st === 'broken', 'la tenuta mollata a metà non si rompe: ' + JSON.stringify(hs));
  const f0 = await S(() => ({ f: __dj.state().fatigue, b: __dj.state().beers }));
  await p.keyboard.down('b'); await p.keyboard.up('b');
  const f1 = await S(() => ({ f: __dj.state().fatigue, b: __dj.state().beers }));
  check(f1.b === f0.b - 1 && f1.f < f0.f - 20, 'la birra non toglie stanchezza: ' + JSON.stringify([f0, f1]));

  // ---- facile: meno note ----
  await open();
  await ev(() => document.querySelector('#diff-pick [data-d=facile]').click());
  await ev(() => __dj.start(false));
  const nf = await S(() => ({ n: __dj.state().notes.length, all: __dj.mappa.note.length, easy: __dj.mappa.note.filter(n => n[3]).length }));
  check(nf.n === nf.easy && nf.n < nf.all * 0.8, 'facile: ' + JSON.stringify(nf));

  const fit = await S(() => ({ w: document.documentElement.scrollWidth, pads: document.querySelector('#pads').getBoundingClientRect().bottom, h: innerHeight, far: document.querySelectorAll('#crowd2 > g').length }));
  check(fit.w <= 390 && fit.pads <= fit.h, 'non sta in 390×844: ' + JSON.stringify(fit));
  check(fit.far === 51, 'sul telefono il pubblico non scende dietro la pista');

  check(!errs.length, 'errori nella pagina: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('spettacolo-dj: tutto ok (' + m.n + ' note, ' + m.drops + ' drop)');
})();
