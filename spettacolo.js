/* =====================================================================
   SPETTACOLO — fase 1 del livello 1: il discorso del Preside Tramp.
   Dopo il Test impianto, col microfono collegato, il preside sale sul palco
   (la stessa scena isometrica del montaggio, di notte). Il giocatore segue
   la sua voce dal banco regia (MIXER e LUCI) e reagisce agli imprevisti
   annunciati dai fumetti. Logica e ritmo vengono dal prototipo
   prototipi/spettacolo-preside.html.
   Questa è una PRIMA PROVA: niente guasti, niente reputazione e niente
   salvataggio dello spettacolo; il resto della fase arriva dopo.
   Con ?prova nell'indirizzo si parte da un impianto già montato e collaudato.
   ===================================================================== */
const Show = (() => {
  const $ = s => document.querySelector(s);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = v => Math.max(0, Math.min(100, v));

  const DURATION = 90;            // secondi reali = 15 minuti di discorso (21:00 → 21:15)
  const SPEECH = [4, 82];         // quando parla
  const ZONE = [0.5, 0.8];        // zona verde sui meter
  const PC = 'pc';                // la musica di sala arriva dal PC (scheda sugli ingressi 5/6)
  const CHANNELS = [1, 2, 3, 4, PC];
  const COLORS = { bianco: '#f4f1ea', rosso: '#e0503f', blu: '#3f7fe0', verde: '#49b06a', ambra: '#f2a541', viola: '#b36bff' };
  const COLOR_KEYS = Object.keys(COLORS);
  // cosa dice (la voce dice solo "Tramp", i sottotitoli lo traducono)
  const LINES = [
    'Benvenuti alla festa della scuola più grande, la più bella. Tremenda.',
    'Abbiamo i banchi migliori. Tutti mi chiedono: come fa ad avere questi banchi?',
    'La mensa? Fantastica. Gli spaghetti più lunghi della storia.',
    'Costruiremo una palestra enorme. E la pagherà il liceo di fronte.',
    'I voti quest\'anno sono altissimi. Record. Nessuno ha mai visto voti così.',
    'Qualcuno dice che il discorso è lungo. Fake news. È perfetto.',
    'E ora vi lascio alla musica. Musica bellissima, l\'ho scelta io.'
  ];
  const HINTS_KEY = 'scs-tramp-hints';
  const store = {
    get (k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* memoria non disponibile */ } }
  };
  let hints = store.get(HINTS_KEY, true);

  let S = null;          // stato dello spettacolo in corso
  let active = false;    // vista spettacolo aperta
  let manual = false;    // i test fanno avanzare il tempo a mano

  function fresh () {
    const ch = micChannel() || 1;
    return {
      t: 0, running: false, paused: false, grad: 60,
      fad: { 1: 0, 2: 0, 3: 0, 4: 0, pc: 0.7 }, mute: { 1: false, 2: false, 3: false, 4: false, pc: false },
      micCh: ch, micOk: true,
      dimmer: 0.3, pars: ['viola', 'blu', 'blu', 'viola'], mem: 2,
      voiceK: 1, drift: 1, driftTo: 1, walk: 0, walkTo: 0, side: null, ring: 0, ringCool: 0,
      jingle: false, larsens: 0, pops: 0, notes: [], events: [],
      mems: {
        1: { name: 'Bianco', pars: ['bianco', 'bianco', 'bianco', 'bianco'], dimmer: 1 },
        2: { name: 'Festa', pars: ['viola', 'blu', 'blu', 'viola'], dimmer: 0.3 },
        3: { name: 'Caldo', pars: ['ambra', 'ambra', 'ambra', 'ambra'], dimmer: 0.8 },
        4: { name: 'Buio', pars: ['bianco', 'bianco', 'bianco', 'bianco'], dimmer: 0 }
      }
    };
  }

  /* ---------- segnali ---------- */
  const speaking = () => S.t > SPEECH[0] && S.t < SPEECH[1] && !S.jingle;
  function micSignal () {
    if (!speaking() || !S.micOk) return 0;
    const syll = 0.88 + 0.12 * Math.sin(S.t * 9.1) * Math.sin(S.t * 3.3);
    return 0.62 * S.voiceK * S.drift * syll;
  }
  function chOut (ch) {
    if (S.mute[ch]) return 0;
    const sig = ch === PC ? 0.55 : (ch === S.micCh ? micSignal() : 0);
    return sig * S.fad[ch] * 1.9;
  }
  const voiceOut = () => chOut(S.micCh);
  const inZone = o => o >= ZONE[0] && o <= ZONE[1];
  const lightsWhite = () => S.pars.every(p => p === 'bianco') && S.dimmer >= 0.6;
  function hit (d, msg) { S.grad = clamp(S.grad + d); showToast(msg); sfx.boo(); }

  /* ---------- copione: apertura e finale fissi, in mezzo 4 imprevisti
     pescati a caso, a tempi variabili, che verso la fine si accavallano.
     I suggerimenti dei fumetti indicano la direzione, non la soluzione. ---------- */
  const POOL = {
    piano: () => ({ win: 7, dur: 12, target: 'preside', icon: '🔉', text: 'Si allontana dal microfono', hint: 'in fondo non lo sentono', tab: 'mixer',
      start () { S.voiceK = rnd(0.55, 0.65); }, end () { S.voiceK = 1; }, hold: 1,
      ok: () => inZone(voiceOut()), fail: () => hit(-8, 'In fondo alla palestra non si sentiva niente.') }),
    mangia: () => ({ win: 6, dur: 12, target: 'preside', icon: '📢', text: 'Si mangia il microfono', hint: 'la voce distorce', tab: 'mixer',
      start () { S.voiceK = rnd(1.6, 1.9); }, end () { S.voiceK = 1; }, hold: 1,
      ok: () => inZone(voiceOut()), fail: () => hit(-8, 'Voce distorta: la gente si tappa le orecchie.') }),
    casse: () => {
      const side = pick(['l', 'r']);
      return { win: 99, dur: 11, target: 'spk-' + side, icon: '🚶', text: 'Va verso la cassa ' + (side === 'l' ? 'sinistra' : 'destra'), hint: 'occhio al fischio, ma lui deve sentirsi', tab: 'mixer',
        start () { S.side = side; S.walkTo = 1; }, end () { S.walkTo = 0; },
        ok: () => false, fail () {},
        done () { if (!this.larsen) { S.grad = clamp(S.grad + 4); showToast('Niente larsen. Pulito!', 'ok'); sfx.ok(); } } };
    },
    tap: () => ({ win: 3.5, dur: 5, target: 'preside', icon: '👊', text: 'Batte sul microfono per provarlo', hint: 'proteggi le casse, poi ridagli voce', tab: 'mixer',
      ok: () => S.mute[S.micCh] || voiceOut() < 0.2,
      fail () { S.pops++; sfx.pop(); hit(-8, 'BUM BUM nelle casse.'); }, after: 'Ora ridagli voce!' }),
    sigla: () => ({ win: 5, dur: 8, target: 'preside', icon: '🎺', text: 'Vuole la sua sigla musicale', hint: 'la musica è sul PC', tab: 'mixer',
      start () { S.jingle = true; }, end () { S.jingle = false; }, hold: 0.5,
      ok: () => chOut(PC) >= 0.55, fail: () => hit(-6, 'Niente sigla: il preside è offeso.') }),
    volume: () => ({ win: 99, dur: 7, target: 'preside', icon: '😠', text: 'Ti fa segno: vuole più volume', hint: 'accontentarlo o no? scegli tu', tab: 'mixer',
      ok: () => false, fail () {},
      done () {
        if (voiceOut() > 0.85) { S.notes.push('Hai accontentato il preside: lui felice, il pubblico si è tappato le orecchie.'); S.grad = clamp(S.grad - 5); showToast('Il preside è felice. Il pubblico meno.', 'ok'); }
        else { S.notes.push('Non hai alzato il volume al preside: il pubblico ti ringrazia, lui ti guarda malissimo.'); S.grad = clamp(S.grad + 3); showToast('Il preside ti guarda malissimo.'); }
      } })
  };
  function script () {
    const ids = Object.keys(POOL).sort(() => Math.random() - 0.5).slice(0, 4);
    const evs = [{ id: 'apertura', at: 1, win: 9, target: 'preside', icon: '🎤', text: 'Sale sul palco', hint: 'vuole luce e voce, senza musica sotto', tab: 'luci',
      ok: () => lightsWhite() && S.fad[S.micCh] >= 0.3 && !S.mute[S.micCh] && chOut(PC) < 0.3, hold: 0.3,
      fail: () => hit(-10, 'Il preside ha cominciato al buio e sopra la musica.') }];
    let at = rnd(13, 16);
    ids.forEach((id, i) => {
      evs.push(Object.assign({ id, at }, POOL[id]()));
      at += i >= 2 ? rnd(7, 11) : rnd(12, 16);    // verso la fine si accavallano
      at = Math.min(at, 72);
    });
    evs.push({ id: 'finale', at: 82, win: 7, target: 'preside', icon: '🎉', text: 'Ha finito il discorso', hint: 'è ora di festa', tab: 'luci',
      ok: () => !S.pars.every(p => p === 'bianco') && S.dimmer >= 0.25 && chOut(PC) >= 0.5, hold: 0.3,
      fail: () => hit(-6, 'Finale muto e spento.') });
    return evs;
  }

  /* ---------- banco regia: memorie e PAR in alto, sotto la fila dei fader
     (CH1-4, PC e il dimmer delle luci), tutto nella stessa schermata ---------- */
  function makeFader (parent, get, set, meter) {
    const wrap = document.createElement('div'); wrap.className = 'fadewrap';
    const f = document.createElement('div'); f.className = 'fader'; f.tabIndex = 0; f.setAttribute('role', 'slider');
    f.setAttribute('aria-valuemin', 0); f.setAttribute('aria-valuemax', 100);
    f.innerHTML = '<div class="track"></div><div class="knob"></div>';
    wrap.appendChild(f);
    let m = null;
    if (meter) {
      m = document.createElement('div'); m.className = 'sd-meter';
      m.innerHTML = `<div class="zone" style="bottom:${ZONE[0] * 100}%;height:${(ZONE[1] - ZONE[0]) * 100}%"></div><i></i>`;
      wrap.appendChild(m);
    }
    parent.appendChild(wrap);
    const knob = f.querySelector('.knob');
    const paint = () => { knob.style.top = `calc(6px + (100% - 12px) * ${1 - get()})`; f.setAttribute('aria-valuenow', Math.round(get() * 100)); };
    const fromY = y => { const r = f.getBoundingClientRect(); set(Math.max(0, Math.min(1, 1 - (y - r.top - 6) / (r.height - 12)))); paint(); };
    f.addEventListener('pointerdown', e => { f.setPointerCapture(e.pointerId); fromY(e.clientY); });
    f.addEventListener('pointermove', e => { if (f.hasPointerCapture(e.pointerId)) fromY(e.clientY); });
    f.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp') set(Math.min(1, get() + 0.05)); else if (e.key === 'ArrowDown') set(Math.max(0, get() - 0.05)); else return;
      e.preventDefault(); paint();
    });
    paint();
    return { el: f, paint, meter: m && m.querySelector('i') };
  }

  const TRAMP_FACE = n => `<span class="face-mini"><svg viewBox="12 10 76 76" width="${n}" height="${n}"><use href="#tramp"/></svg></span>`;
  // i PAR come li vede il pubblico, da sinistra a destra
  const PAR_NAMES = ['Taglio sx', 'Front sx', 'Front dx', 'Taglio dx'];
  const chF = {};
  let dimmerF, dimPct;
  function buildDesk () {
    const mx = $('#sd-mixer'); mx.textContent = '';
    CHANNELS.forEach(n => {
      const d = document.createElement('div'); d.className = 'sd-strip'; d.id = 'sd-strip-' + n;
      d.innerHTML = `<div class="sd-name">${n === S.micCh ? TRAMP_FACE(20) : ''}${n === PC ? 'PC ♪' : 'CH' + n}</div>`;
      mx.appendChild(d);
      chF[n] = makeFader(d, () => S.fad[n], v => { S.fad[n] = v; }, true);
      chF[n].el.setAttribute('aria-label', n === PC ? 'Fader PC' : 'Fader CH' + n);
      const m = document.createElement('button'); m.className = 'sd-mute'; m.textContent = 'MUTE'; m.id = 'sd-mute-' + n;
      m.setAttribute('aria-pressed', 'false');
      m.addEventListener('click', () => { S.mute[n] = !S.mute[n]; m.setAttribute('aria-pressed', S.mute[n]); });
      d.appendChild(m);
    });
    // il dimmer delle luci sta in fila con i fader, dove la mano c'è già
    const dd = document.createElement('div'); dd.className = 'sd-strip sd-dim'; dd.id = 'sd-strip-dim';
    dd.innerHTML = '<div class="sd-name">DIMMER</div>';
    mx.appendChild(dd);
    dimmerF = makeFader(dd, () => S.dimmer, v => { S.dimmer = v; S.mem = null; paintLights(); }, false);
    dimmerF.el.setAttribute('aria-label', 'Dimmer delle luci');
    dimPct = document.createElement('div'); dimPct.className = 'sd-pct'; dd.appendChild(dimPct);

    const pb = $('#sd-pars'); pb.textContent = '';
    S.pars.forEach((_, i) => {
      const b = document.createElement('button'); b.className = 'sd-par'; b.id = 'sd-par-' + i;
      b.title = 'Tocca per cambiare colore';
      b.innerHTML = `<span class="dot"></span>${PAR_NAMES[i]}`;
      b.addEventListener('click', () => { S.pars[i] = COLOR_KEYS[(COLOR_KEYS.indexOf(S.pars[i]) + 1) % COLOR_KEYS.length]; S.mem = null; paintLights(); });
      pb.appendChild(b);
    });
    const ms = $('#sd-mems'); ms.textContent = '';
    [1, 2, 3, 4].forEach(n => {
      const b = document.createElement('button'); b.className = 'sd-mem'; b.id = 'sd-mem-' + n;
      let timer = null, saved = false;
      b.addEventListener('pointerdown', () => {
        saved = false;
        timer = setTimeout(() => { saved = true; S.mems[n] = { name: 'Mia ' + n, pars: [...S.pars], dimmer: S.dimmer }; S.mem = n; paintLights(); showToast('Memoria ' + n + ' salvata.', 'ok'); }, 600);
      });
      b.addEventListener('pointerup', () => { clearTimeout(timer); if (!saved) recall(n); });
      b.addEventListener('pointerleave', () => clearTimeout(timer));
      b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); recall(n); } });
      b.addEventListener('contextmenu', e => e.preventDefault());
      ms.appendChild(b);
    });
    paintLights();
  }
  function recall (n) { const m = S.mems[n]; S.pars = [...m.pars]; S.dimmer = m.dimmer; S.mem = n; dimmerF.paint(); paintLights(); }
  function paintLights () {
    S.pars.forEach((c, i) => { const d = $('#sd-par-' + i + ' .dot'); d.style.background = COLORS[c]; d.style.color = COLORS[c]; d.style.opacity = 0.35 + 0.65 * S.dimmer; });
    [1, 2, 3, 4].forEach(n => {
      const m = S.mems[n], b = $('#sd-mem-' + n);
      b.innerHTML = `<b>${m.name}</b><span class="sw4">${m.pars.map(c => `<i style="background:${COLORS[c]};opacity:${0.3 + 0.7 * m.dimmer}"></i>`).join('')}</span>`;
      b.setAttribute('aria-pressed', S.mem === n);
    });
    if (dimPct) dimPct.textContent = Math.round(S.dimmer * 100) + '%';
  }

  /* ---------- fumetti: HTML sopra il palco, agganciati ai punti del mondo ---------- */
  const bubbleEls = new Map();
  const layer = $('#show-bubbles');
  function renderBubbles () {
    const live = new Set();
    S.events.filter(e => e.live).forEach(e => {
      live.add(e);
      let el = bubbleEls.get(e);
      if (!el) {
        el = document.createElement('div'); el.className = 'bub'; el.setAttribute('role', 'button');
        el.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="10" fill="none" stroke="#ddd" stroke-width="4"/><circle class="arc" cx="13" cy="13" r="10" fill="none" stroke-width="4" transform="rotate(-90 13 13)"/></svg><div><b></b><small></small></div>';
        el.addEventListener('pointerdown', ev => { ev.stopPropagation(); tapBubble(e); });
        layer.appendChild(el); bubbleEls.set(e, el);
      }
      el.querySelector('b').textContent = e.icon + ' ' + e.text;
      const sm = el.querySelector('small'); sm.textContent = hints ? e.hint : ''; sm.hidden = !hints;
      const timed = e.win < 90;
      const left = timed ? Math.max(0, (e.deadline - S.t) / e.win) : Math.max(0, 1 - (S.t - e.at) / e.dur);
      const arc = el.querySelector('.arc');
      arc.setAttribute('stroke', left > 0.5 ? '#d9a21b' : '#e0503f');
      arc.setAttribute('stroke-dasharray', `${(left * 62.8).toFixed(1)} 70`);
      const [px, py] = View.anchor(e.target, S);
      const W = layer.clientWidth, bw = el.offsetWidth, bh = el.offsetHeight;
      // i fumetti che partono insieme si mettono uno sopra l'altro
      const stack = [...live].filter(o => o !== e && o.target === e.target && o.at < e.at).length;
      const lx = Math.max(6, Math.min(W - bw - 6, px - bw / 2));
      el.style.left = lx + 'px';
      el.style.top = Math.max(4, py - bh - 10 - stack * (bh + 6)) + 'px';
      el.style.setProperty('--tail', Math.max(16, Math.min(bw - 16, px - lx)) + 'px');
    });
    bubbleEls.forEach((el, e) => { if (!live.has(e)) { el.remove(); bubbleEls.delete(e); } });
  }
  function clearBubbles () { bubbleEls.forEach(el => el.remove()); bubbleEls.clear(); }
  // toccare il fumetto indica il comando da usare (solo coi suggerimenti)
  function tapBubble (e) {
    if (!hints) return;
    if (e.tab === 'mixer') pulse($('#sd-strip-' + (e.id === 'sigla' ? PC : S.micCh)));
    else pulse($('#sd-lights'));
  }
  function pulse (el) { if (!el) return; el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }

  /* ---------- header ---------- */
  function paintHeader () {
    $('#sh-tl').style.width = Math.min(100, S.t / DURATION * 100) + '%';
    $('#sh-clock').textContent = '21:' + String(Math.min(15, Math.floor(S.t / DURATION * 15))).padStart(2, '0');
    const gb = $('#sh-grad'); gb.style.width = S.grad + '%';
    gb.style.background = S.grad < 35 ? 'var(--red)' : S.grad < 65 ? '#f2c53d' : 'var(--green)';
  }
  function setPaused (p) {
    if (!S || !S.running) return;
    S.paused = p;
    $('#show-pause').hidden = !p;
    $('#sh-pause').textContent = p ? '▶' : '⏸';
    if (p) { voice.silence(); sfx.music(0); sfx.ring(0); }
  }
  $('#sh-pause').addEventListener('click', () => { SFX.button(); setPaused(!S.paused); });
  $('#sh-exit').addEventListener('click', () => { SFX.button(); exit(); });

  /* ---------- ciclo ---------- */
  let last = 0, raf = 0;
  function tick (now) {
    raf = 0;
    if (!active) return;
    const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    if (S.running && !S.paused && !manual && !menuOpen) step(dt);
    else if (active) View.draw(S, now / 1000);
    raf = requestAnimationFrame(tick);
  }
  function step (dt) {
    if (!S || !S.running) return;
    S.t += dt;

    // il preside non parla mai uguale: il volume va e viene da solo
    if (Math.abs(S.drift - S.driftTo) < 0.02) S.driftTo = rnd(0.8, 1.2);
    S.drift += (S.driftTo - S.drift) * dt * 0.4;

    // camminata verso una cassa e larsen che cresce con volume × vicinanza
    S.walk += (S.walkTo - S.walk) * Math.min(1, dt * 1.6);
    const near = View.speakerNear(S);
    const loop = voiceOut() * near * 1.2;
    S.ringCool = Math.max(0, S.ringCool - dt);
    if (loop > 0.55 && !S.ringCool) S.ring = Math.min(1, S.ring + dt * (loop - 0.45) * 2.2);
    else S.ring = Math.max(0, S.ring - dt * 1.2);
    if (S.ring >= 1) {
      S.ring = 0; S.ringCool = 3; S.larsens++; sfx.larsen();
      const w = S.events.find(e => e.id === 'casse' && e.live); if (w) w.larsen = true;
      hit(-20, 'LARSEN! Fischio in tutta la palestra.');
    }
    sfx.ring(S.ring);

    // imprevisti: partono, si risolvono, scadono
    S.events.forEach(e => {
      if (!e.started && S.t >= e.at) { e.started = true; e.live = true; e.deadline = S.t + e.win; if (e.start) e.start(); sfx.ding(); }
      if (e.live) {
        if (e.ok()) {
          e.held = (e.held || 0) + dt;
          if (e.held > (e.hold || 0.15)) { e.live = false; e.solved = true; S.grad = clamp(S.grad + 4); showToast('Fatto! ' + (e.after || ''), 'ok'); sfx.ok(); }
        } else e.held = 0;
        if (e.live && e.win < 90 && S.t > e.deadline) { e.live = false; e.failed = true; e.fail(); }
      }
      if (e.started && !e.ended && S.t >= e.at + (e.dur || e.win)) {
        e.ended = true; if (e.end) e.end();
        // finito il tempo: chi ha un esito proprio lo decide, gli altri sono mancati
        if (e.live) { e.live = false; if (e.done) e.done.call(e); else { e.failed = true; e.fail(); } }
      }
    });

    // gradimento continuo
    const o = voiceOut();
    let d = 0;
    if (speaking()) {
      if (S.mute[S.micCh]) d -= 3; else if (o < 0.3) d -= 2.5; else if (o > 0.9) d -= 2.5; else if (inZone(o)) d += 1.2; else d += 0.2;
      if (chOut(PC) > 0.3) d -= 1.5;               // musica sopra il discorso
      if (S.t > 10 && !lightsWhite()) d -= 0.8;
    }
    S.grad = clamp(S.grad + d * dt);

    // sottotitoli: più piccoli se si sente poco, più grandi se è troppo forte
    const li = Math.min(LINES.length - 1, Math.floor(S.t / (SPEECH[1] / LINES.length)));
    const cap = $('#show-caption');
    if (S.jingle) cap.innerHTML = '<b>♪ La sigla del preside ♪</b>';
    else if (!speaking()) cap.innerHTML = '';
    else if (o < 0.05) cap.innerHTML = '<b>(il preside parla ma non si sente niente)</b>';
    else cap.innerHTML = `<b style="font-size:${o > 0.9 ? 16 : o < 0.3 ? 11 : 13}px">«${LINES[li]}»</b>${o > 0.9 ? '<small>(troppo forte: distorce)</small>' : o < 0.3 ? '<small>(si sente appena)</small>' : ''}`;

    CHANNELS.forEach(n => {
      const v = chOut(n), m = chF[n].meter;
      m.style.height = Math.min(100, v * 100) + '%';
      m.style.background = v > 0.9 ? 'var(--red)' : inZone(v) ? 'var(--green)' : '#f2c53d';
      chF[n].paint();
    });
    voice.say(speaking() && S.micOk ? o : 0);
    sfx.music(S.jingle ? chOut(PC) : chOut(PC) * 0.5);
    View.draw(S, performance.now() / 1000);
    renderBubbles(); paintHeader();
    if (S.t >= DURATION) finish();
  }

  function finish () {
    S.running = false; voice.silence(); sfx.music(0); sfx.ring(0); sfx.applause(S.grad);
    clearBubbles(); $('#show-caption').innerHTML = '';
    View.applause(S);
    let beers = 0; const notes = [];
    if (!S.larsens && !S.pops) { beers++; notes.push('🍺 Nessun larsen e nessun colpo nelle casse.'); }
    else notes.push([S.larsens ? 'Larsen: ' + S.larsens + '.' : '', S.pops ? 'Colpi nelle casse: ' + S.pops + '.' : ''].join(' ').trim());
    if (S.grad >= 70) { beers++; notes.push('🍺 Pubblico contento (almeno 70%).'); }
    if (S.micCh !== 1) notes.push('Il microfono era sul CH' + S.micCh + ': di solito la voce di chi parla va sul CH1.');
    notes.push(...S.notes);
    notes.push('Questa è una prova: la reputazione non cambia.');
    $('#show-outro-title').textContent = S.grad >= 70 ? 'Il miglior tecnico della storia!' : S.grad >= 40 ? 'Applausi tiepidi.' : 'Siete licenziati!';
    $('#show-r-grad').textContent = Math.round(S.grad) + '%';
    $('#show-r-beer').textContent = '+' + beers;
    $('#show-r-rep').textContent = '—';
    const ul = $('#show-r-notes'); ul.textContent = '';
    notes.forEach(n => { const li = document.createElement('li'); li.textContent = n; ul.appendChild(li); });
    Show.result = { grad: S.grad, beers, larsens: S.larsens, pops: S.pops };
    setTimeout(() => { if (active) $('#show-outro').classList.add('show'); }, manual ? 0 : 1800);
  }

  /* ---------- entrata e uscita ---------- */
  const ready = () => !!gameState.testOk && micChannel() != null;
  function refreshButton () {
    const b = $('#show-btn');
    if (b) b.hidden = !ready() || active;
  }
  // a fine show del collaudo: se il microfono è pronto arriva il preside
  function offer () {
    refreshButton();
    if (!ready() || active || menuOpen) return;
    paintHints();
    $('#show-intro').classList.add('show');
  }
  function enter () {
    if (active) return;
    active = true;
    document.body.classList.add('in-show');
    $('#show-head').hidden = false; $('#show-desk').hidden = false;
    refreshButton();
    closeRearPanel && rearPanelId && closeRearPanel();
    setSceneInput(false);
    window.__scene.stopFx();
    View.open();
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    window.addEventListener('resize', onResize);
  }
  const onResize = () => { if (active) View.fit(); };
  function start () {
    $('#show-intro').classList.remove('show');
    $('#show-outro').classList.remove('show');
    enter();
    S = fresh(); S.events = script();
    clearBubbles(); buildDesk();
    $('#show-pause').hidden = true; $('#sh-pause').textContent = '⏸';
    sfx.init(); voice.init();
    S.running = true;
    View.reset();
    paintHeader();
  }
  function exit () {
    if (S) { S.running = false; }
    voice.silence(); sfx.music(0); sfx.ring(0);
    clearBubbles(); $('#show-caption').innerHTML = '';
    $('#show-intro').classList.remove('show'); $('#show-outro').classList.remove('show');
    if (!active) return;
    active = false;
    window.removeEventListener('resize', onResize);
    document.body.classList.remove('in-show');
    $('#show-head').hidden = true; $('#show-desk').hidden = true; $('#show-pause').hidden = true;
    View.close();
    window.__scene.scale.refresh();
    setSceneInput(!menuOpen);
    refreshButton();
  }
  const paintHints = () => $('#show-hints').setAttribute('aria-pressed', hints);
  $('#show-hints').addEventListener('click', () => { hints = !hints; store.set(HINTS_KEY, hints); paintHints(); });
  $('#show-start').addEventListener('click', () => { SFX.button(); start(); });
  $('#show-later').addEventListener('click', () => { SFX.button(); $('#show-intro').classList.remove('show'); });
  $('#show-again').addEventListener('click', () => { SFX.button(); $('#show-outro').classList.remove('show'); paintHints(); $('#show-intro').classList.add('show'); });
  $('#show-back').addEventListener('click', () => { SFX.button(); exit(); });
  $('#show-btn').addEventListener('click', () => { SFX.button(); offer(); });

  /* ---------- la voce del preside: sintesi vocale che dice solo "Tramp",
     col volume che esce dal mixer. Se il browser non ha voci, un ronzio. ---------- */
  const voice = (() => {
    const ss = window.speechSynthesis;
    let alive = false, tried = false, lastSay = 0;
    return {
      init () {
        if (!ss || tried) return;
        try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; u.onstart = () => { alive = true; }; ss.speak(u); tried = true; } catch (e) { /* niente voci */ }
        setTimeout(() => { if (!alive) sfx.hum(true); }, 2500);
      },
      say (level) {
        const vol = settings().volume;
        if (!ss || !tried) { sfx.hum(true); sfx.humLevel(level); return; }
        if (!alive) sfx.humLevel(level);
        if (level < 0.05 || !vol) { if (ss.speaking) ss.cancel(); return; }
        const now = performance.now();
        if (ss.speaking || ss.pending || now - lastSay < 120) return;
        lastSay = now;
        const n = 1 + Math.floor(Math.random() * 3);
        const loud = level > 0.9 || S.voiceK > 1.4;
        const words = Array.from({ length: n }, () => loud ? 'TRAMP' : pick(['tramp', 'tramp', 'Tramp', 'TRAMP']));
        const u = new SpeechSynthesisUtterance(words.join(', ') + (Math.random() < 0.3 ? '!' : ''));
        u.lang = 'en-US'; u.rate = rnd(1.05, 1.4); u.pitch = loud ? rnd(1.2, 1.5) : rnd(0.6, 0.95);
        u.volume = Math.min(1, level) * vol;
        u.onstart = () => { alive = true; };
        ss.speak(u);
      },
      silence () { if (ss) ss.cancel(); sfx.humLevel(0); }
    };
  })();

  /* ---------- suoni dello spettacolo (sintetizzati, col volume delle impostazioni) ---------- */
  const sfx = (() => {
    let ac, master, hum, humG, ringO, ringG, musO, musG, noiseBuf, humOn = false;
    const on = () => ac && settings().volume > 0;
    const env = (g, a, peak, rel, t0) => { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + rel); };
    const tone = (f, dur, type, vol) => { if (!on()) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'sine'; o.frequency.value = f; o.connect(g).connect(master); env(g, 0.01, vol || 0.15, dur, ac.currentTime); o.start(); o.stop(ac.currentTime + dur + 0.05); };
    const noise = (dur, vol, fl) => { if (!on()) return; const s = ac.createBufferSource(); s.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fl || 1500; const g = ac.createGain(); s.connect(f).connect(g).connect(master); env(g, 0.3, vol, dur, ac.currentTime); s.start(); s.stop(ac.currentTime + dur + 0.4); };
    const osc = (type, f, dest) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; const g = ac.createGain(); g.gain.value = 0; o.connect(g).connect(dest || master); o.start(); return [o, g]; };
    return {
      init () {
        if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
        try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
        master = ac.createGain(); master.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 2; f.connect(master);
        [hum, humG] = osc('sawtooth', 120, f);
        [ringO, ringG] = osc('sine', 2750);
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.connect(master);
        [musO, musG] = osc('square', 110, lp);
      },
      tickVolume () { if (master) master.gain.value = settings().volume; },
      hum (v) { humOn = v; },
      humLevel (level) { if (!ac || !humOn) return; const t = ac.currentTime, s = Math.max(0, Math.sin(t * 11) * Math.sin(t * 2.7)); humG.gain.setTargetAtTime(Math.min(0.12, level * 0.09) * s, t, 0.03); },
      ring (r) { if (!ac) return; this.tickVolume(); ringG.gain.setTargetAtTime(r * r * 0.12, ac.currentTime, 0.05); ringO.frequency.setTargetAtTime(2600 + r * 400, ac.currentTime, 0.1); },
      music (level) { if (!ac) return; const t = ac.currentTime; musO.frequency.setValueAtTime([110, 138.6, 164.8, 220][Math.floor(t * 4) % 4], t); musG.gain.setTargetAtTime(level * 0.05, t, 0.05); },
      larsen () { if (!on()) return; const [o, g] = osc('sine', 2750); g.gain.setValueAtTime(0.001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.2, ac.currentTime + 0.4); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 2.2); o.stop(ac.currentTime + 2.3); },
      pop () { tone(55, 0.25, 'sine', 0.5); setTimeout(() => tone(55, 0.25, 'sine', 0.5), 280); },
      ding () { tone(880, 0.15, 'triangle', 0.08); },
      ok () { tone(660, 0.1, 'triangle', 0.08); setTimeout(() => tone(990, 0.15, 'triangle', 0.08), 90); },
      boo () { noise(0.9, 0.12, 300); },
      applause (g) { noise(2.5, 0.05 + g / 100 * 0.25, 2500); }
    };
  })();

  // prova veloce: impianto già montato, cablato e acceso; si collauda da sé
  function prova () {
    whenScene(scene => {
      closeMenu();
      scene.loadLevel(JSON.parse(JSON.stringify(PROVA_LEVEL)));
      scene.refreshLive();
      showToast('Prova dello spettacolo: l\'impianto è già montato. Collaudo in corso…', 'ok');
      scene.time.delayedCall(900, () => scene.runSystemTest());
    });
  }

  return {
    get active () { return active; },
    get state () { return S; },
    result: null,
    refreshButton, offer, start, exit, prova, setPaused,
    // per i test: il tempo avanza solo quando lo dicono loro
    manualTime (on) { manual = on; },
    step (dt) { step(dt); }
  };
})();
window.Show = Show;

/* ---------------------------------------------------------------------
   Vista dello spettacolo: il palco come lo vede il pubblico, disegnato in
   un canvas. I PAR sono fari fissi (due tagli sugli stativi ai lati del
   palco, due frontali nel pit): fasci fermi, netti e simmetrici, che
   cambiano solo colore e intensità. La luce si vede nella foschia, fa una
   pozza sul pavimento e sul fondale, colora il preside e ne proietta
   l'ombra sul fondale.
   --------------------------------------------------------------------- */
const View = (() => {
  const W = 1000, VIS_W = 800, VIS = [40, 600];   // mondo; parte che deve restare in vista
  const HOME = 500, FEET = 442, WALL = 360;       // il preside all'asta; piede del fondale
  const SPK = { l: 100, r: 900 };                  // casse (x) ai lati, davanti al palco
  const WALK = { l: 300, r: 700 };                // fin dove arriva il preside verso una cassa
  const PRES_H = 190, PRES_K = PRES_H / 235;      // altezza del preside nel mondo / nel disegno
  const PARS = [
    { kind: 'taglio', lens: [200, 300], end: [860, 352], r: 100 },
    { kind: 'front', lens: [340, 572], aim: [540, 292], r: 150 },
    { kind: 'front', lens: [660, 572], aim: [460, 292], r: 150 },
    { kind: 'taglio', lens: [800, 300], end: [140, 352], r: 100 }
  ];
  const COLORS = { bianco: '#f4f1ea', rosso: '#e0503f', blu: '#3f7fe0', verde: '#49b06a', ambra: '#f2a541', viola: '#b36bff' };
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

  const cv = document.getElementById('show-canvas');
  const ctx = cv.getContext('2d');
  let cw = 0, ch = 0, dpr = 1, s = 1, ox = 0, oy = 0;
  let bg = null, sprites = null, crowd = [], cheerAt = null;

  /* ---------- il preside: la caricatura del ritratto, a figura intera ---------- */
  const TRAMP = [
    ['#121a2e', 'M24 134 L24 226 L47 226 L49 150 L51 150 L53 226 L76 226 L76 134 Z'],
    ['#0b0b0d', 'M18 222 Q18 234 34 234 L49 234 L49 222 Z M51 222 L51 234 L66 234 Q82 234 82 222 Z'],
    ['#1d2b4a', 'M14 140 L20 92 Q50 78 80 92 L86 140 Z'],
    ['#1d2b4a', 'M14 96 Q6 120 10 150 L19 150 L22 104 Z M86 96 Q94 120 90 150 L81 150 L78 104 Z'],
    ['#f0a35a', 'M14.5 154 a5 5 0 1 0 0.1 0 Z M85.5 154 a5 5 0 1 0 0.1 0 Z'],
    ['#f4f1ea', 'M40 88 L50 104 L60 88 Z'],
    ['#d6392f', 'M47 92 L53 92 L57 172 L50 180 L43 172 Z'],
    ['#e8964f', 'M42 72 h16 v16 h-16 Z'],
    ['#f0a35a', 'M26 52 a24 28 0 1 0 48 0 a24 28 0 1 0 -48 0 Z'],
    ['#f7d7b0', 'M32 54 a6 4 0 1 0 12 0 a6 4 0 1 0 -12 0 Z M56 54 a6 4 0 1 0 12 0 a6 4 0 1 0 -12 0 Z'],
    ['#2a1d12', 'M37 54 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 Z M59 54 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 Z'],
    ['#f4d35e', 'M22 44 Q20 16 52 18 Q84 18 80 40 Q70 26 54 30 Q40 24 30 34 Q26 38 22 44 Z'],
    ['#e9c23f', 'M48 20 Q70 12 84 26 Q78 22 66 24 Z']
  ].map(([c, d]) => [c, new Path2D(d)]);
  const BROWS = new Path2D('M32 47 Q38 43 44 46 M56 46 Q62 43 68 47');

  function makeCanvas (w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  // disegni del preside alla scala giusta: normale, al buio, colorato da ogni luce, sagoma per l'ombra
  function buildSprites () {
    const k = PRES_K * s * dpr;
    const base = makeCanvas(100 * k, 236 * k), b = base.getContext('2d');
    b.scale(k, k);
    TRAMP.forEach(([c, p]) => { b.fillStyle = c; b.fill(p); });
    b.strokeStyle = '#e9d27a'; b.lineWidth = 2.5; b.lineCap = 'round'; b.stroke(BROWS);
    const variant = (fn) => { const c = makeCanvas(base.width, base.height), g = c.getContext('2d'); g.drawImage(base, 0, 0); fn(g, c); return c; };
    const cover = (g, c, style, op) => { g.globalCompositeOperation = op; g.fillStyle = style; g.fillRect(0, 0, c.width, c.height); };
    const out = {
      k, base,
      dark: variant((g, c) => cover(g, c, 'rgba(6,8,16,0.8)', 'source-atop')),
      shadow: variant((g, c) => cover(g, c, '#000', 'source-in')),
      lit: {}, rim: {}
    };
    out.litOf = col => out.lit[col] || (out.lit[col] = variant((g, c) => {
      cover(g, c, COLORS[col], 'multiply');
      g.globalCompositeOperation = 'destination-in'; g.drawImage(base, 0, 0);
    }));
    // luce di taglio: accende solo il bordo dalla parte del faro
    out.rimOf = (col, side) => {
      const key = col + side;
      if (out.rim[key]) return out.rim[key];
      const c = makeCanvas(base.width, base.height), g = c.getContext('2d');
      g.drawImage(out.litOf(col), 0, 0);
      const gr = g.createLinearGradient(side === 'l' ? 0 : c.width, 0, side === 'l' ? c.width * 0.55 : c.width * 0.45, 0);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalCompositeOperation = 'destination-in'; g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
      return (out.rim[key] = c);
    };
    return out;
  }

  /* ---------- fondo fisso: fondale, striscione, pedana, casse, stativi ---------- */
  function buildBg () {
    const c = makeCanvas(cw * dpr, ch * dpr), g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0b0d15'; g.fillRect(0, 0, cw, ch);
    g.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);
    const x0 = -ox / s, x1 = (cw - ox) / s, y0 = -oy / s, y1 = (ch - oy) / s;
    // fondale: tenda con le pieghe
    for (let x = Math.floor(x0 / 28) * 28; x < x1; x += 28) {
      const gr = g.createLinearGradient(x, 0, x + 28, 0);
      gr.addColorStop(0, '#141a2c'); gr.addColorStop(0.5, '#1d2540'); gr.addColorStop(1, '#121728');
      g.fillStyle = gr; g.fillRect(x, y0, 28.5, WALL - y0);
    }
    const shade = g.createLinearGradient(0, WALL - 120, 0, WALL);
    shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = shade; g.fillRect(x0, WALL - 120, x1 - x0, 120);
    // striscione della festa, appeso al fondale
    g.fillStyle = '#3a3528'; g.fillRect(318, 64, 364, 70);
    g.strokeStyle = '#4a4434'; g.lineWidth = 2; g.strokeRect(318, 64, 364, 70);
    g.fillStyle = '#6d2a22'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = 36;
    do { g.font = fs + 'px "Permanent Marker", "Comic Sans MS", cursive'; fs -= 2; } while (fs > 12 && g.measureText('FESTA DELLA SCUOLA').width > 330);
    g.fillText('FESTA DELLA SCUOLA', 500, 101);
    g.strokeStyle = '#2a2b30'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(330, 64); g.lineTo(330, y0); g.moveTo(670, 64); g.lineTo(670, y0); g.stroke();
    // pedana in prospettiva, con le assi che vanno verso il fondo
    g.fillStyle = '#2b2119';
    g.beginPath(); g.moveTo(230, WALL); g.lineTo(770, WALL); g.lineTo(870, 470); g.lineTo(130, 470); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
    for (let i = 1; i < 12; i++) { const t = i / 12; g.beginPath(); g.moveTo(230 + 540 * t, WALL); g.lineTo(130 + 740 * t, 470); g.stroke(); }
    g.fillStyle = '#17110c'; g.fillRect(130, 470, 740, 34);
    g.fillStyle = '#060709'; g.fillRect(x0, 504, x1 - x0, y1 - 504);
    // stativi dei tagli, ai lati del palco
    [200, 800].forEach(x => {
      g.strokeStyle = '#3a3d45'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(x, 452); g.lineTo(x, 300); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.moveTo(x, 452); g.lineTo(x - 22, 468); g.moveTo(x, 452); g.lineTo(x + 22, 468); g.moveTo(x, 452); g.lineTo(x, 470); g.stroke();
      g.fillStyle = '#1b1c21'; g.fillRect(x - 16, 288, 32, 24);
    });
    // casse: sub a terra e testa sul palo, davanti ai lati del palco
    [SPK.l, SPK.r].forEach(x => {
      g.fillStyle = '#101114'; g.fillRect(x - 42, 468, 84, 92);
      g.fillStyle = '#07080a'; g.beginPath(); g.arc(x, 514, 28, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#26282e'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = '#3a3d45'; g.lineWidth = 5; g.beginPath(); g.moveTo(x, 468); g.lineTo(x, 400); g.stroke();
      g.fillStyle = '#131418'; g.fillRect(x - 32, 300, 64, 100);
      g.fillStyle = '#07080a'; g.beginPath(); g.arc(x, 368, 20, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x, 322, 9, 0, Math.PI * 2); g.fill();
    });
    // asta del microfono (il preside ci sta dietro): treppiede e palo
    g.strokeStyle = '#4a4d55'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(506, 456); g.lineTo(506, 336); g.moveTo(506, 456); g.lineTo(488, 468); g.moveTo(506, 456); g.lineTo(524, 468); g.stroke();
    return c;
  }

  // pubblico di spalle, file che arrivano fino al bordo in basso
  function buildCrowd () {
    crowd = [];
    let seed = 11;
    const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const yEnd = (ch - oy) / s + 40;
    for (let y = 578, row = 0; y < yEnd; y += 30, row++) {
      for (let x = -ox / s - 40 + (row % 2) * 22; x < (cw - ox) / s + 40; x += 44 + r() * 6) {
        crowd.push({ x: x + (r() - 0.5) * 8, y, rad: 15 + r() * 4 + row * 1.2, ph: r() * 6, arms: r() < 0.35 });
      }
    }
  }

  function fit () {
    const box = cv.parentElement.getBoundingClientRect();
    cw = Math.max(1, box.width); ch = Math.max(1, box.height); dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    s = Math.min(cw / VIS_W, ch / (VIS[1] - VIS[0]));
    ox = cw / 2 - (W / 2) * s; oy = ch / 2 - ((VIS[0] + VIS[1]) / 2) * s;
    bg = buildBg(); sprites = buildSprites(); buildCrowd();
  }

  const presX = S => { const t = S.side ? WALK[S.side] : HOME; return HOME + (t - HOME) * S.walk; };
  // da punto del mondo a pixel del riquadro del palco (per i fumetti)
  const toStage = (x, y) => [ox + x * s, oy + y * s];

  function draw (S, now) {
    if (!bg || !S) return;
    const g = ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.drawImage(bg, 0, 0);
    g.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);
    const t = S.t, px = presX(S), d = S.dimmer;
    const cols = S.pars.map(c => rgb(COLORS[c]));
    const light = PARS.map((p, i) => ({ p, c: cols[i], a: d }));
    const fall = (x, w) => Math.exp(-(((px - x) / w) ** 2));

    // pozze di luce sul fondale e sul pavimento
    g.globalCompositeOperation = 'lighter';
    g.save(); g.beginPath(); g.rect(-2000, -2000, 5000, 2000 + WALL); g.clip();
    light.forEach(({ p, c, a }) => {
      if (p.kind !== 'front' || a < 0.01) return;
      const [x, y] = p.aim, gr = g.createRadialGradient(x, y, 0, x, y, p.r);
      gr.addColorStop(0, rgba(c, 0.42 * a)); gr.addColorStop(0.7, rgba(c, 0.26 * a)); gr.addColorStop(0.97, rgba(c, 0.2 * a)); gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, p.r, 0, Math.PI * 2); g.fill();
    });
    g.restore();
    light.forEach(({ p, c, a }) => {
      if (a < 0.01) return;
      const x = p.kind === 'front' ? p.aim[0] : HOME, rx = p.kind === 'front' ? 190 : 150;
      g.save(); g.translate(x, FEET); g.scale(1, 0.16);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, rgba(c, (p.kind === 'front' ? 0.34 : 0.2) * a)); gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
      g.restore();
    });

    // ombre del preside sul fondale, una per ogni frontale
    g.globalCompositeOperation = 'source-over';
    const sp = sprites, sw = sp.base.width / (s * dpr), sh = sp.base.height / (s * dpr);
    light.forEach(({ p, a }) => {
      if (p.kind !== 'front' || a < 0.01) return;
      const k = 1.12, sx = px + (px - p.lens[0]) * 0.22;
      g.save(); g.beginPath(); g.rect(-2000, -2000, 5000, 2000 + WALL); g.clip();
      g.globalAlpha = 0.4 * a * fall(p.aim[0], 260);
      g.drawImage(sp.shadow, sx - sw * k / 2, WALL - 6 - sh * k + 34, sw * k, sh * k);
      g.restore();
    });
    g.globalAlpha = 1;

    // il preside, illuminato dai fari che lo prendono
    const bob = S.running && !S.paused && t > 4 && t < 82 ? Math.sin(t * 4) * 1.2 : 0;
    const X = px - sw / 2, Y = FEET - sh + bob;
    g.drawImage(sp.dark, X, Y, sw, sh);
    light.forEach(({ p, a }, i) => {
      if (p.kind !== 'front' || a < 0.01) return;
      g.globalAlpha = Math.min(1, 0.62 * a * fall(p.aim[0], 190));
      g.drawImage(sp.litOf(S.pars[i]), X, Y, sw, sh);
    });
    g.globalCompositeOperation = 'lighter';
    light.forEach(({ p, a }, i) => {
      if (p.kind !== 'taglio' || a < 0.01) return;
      g.globalAlpha = Math.min(1, 0.9 * a * fall(HOME, 260));
      g.drawImage(sp.rimOf(S.pars[i], p.lens[0] < 500 ? 'l' : 'r'), X, Y, sw, sh);
    });
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // la bocca segue la voce
    const talk = S.running && !S.paused && t > 4 && t < 82 && !S.jingle && S.micOk;
    const open = talk ? 0.5 + Math.abs(Math.sin(t * 13) * Math.sin(t * 5.3)) * 1.6 : 0.5;
    g.fillStyle = '#5a2418'; g.beginPath(); g.ellipse(px, Y + 69 * PRES_K, 4.6 * PRES_K, 2.6 * PRES_K * open, 0, 0, Math.PI * 2); g.fill();
    // giraffa e microfono davanti alla bocca
    g.strokeStyle = '#555861'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(506, 336); g.lineTo(500, 318); g.stroke();
    g.fillStyle = '#1a1b1f'; g.beginPath(); g.ellipse(499, 313, 4.5, 7, -0.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6a6d75'; g.beginPath(); g.ellipse(498, 309, 4, 4, 0, 0, Math.PI * 2); g.fill();

    // i fasci nella foschia: coni netti, più forti vicino al faro
    g.globalCompositeOperation = 'lighter';
    light.forEach(({ p, c, a }) => {
      if (a < 0.01) return;
      const [lx, ly] = p.lens, [tx, ty] = p.kind === 'front' ? p.aim : p.end;
      const dx = tx - lx, dy = ty - ly, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
      const cone = (r, al0, al1) => {
        const gr = g.createLinearGradient(lx, ly, tx, ty);
        gr.addColorStop(0, rgba(c, al0)); gr.addColorStop(0.35, rgba(c, al0 * 0.45)); gr.addColorStop(1, rgba(c, al1));
        g.fillStyle = gr; g.beginPath();
        g.moveTo(lx + nx * 7, ly + ny * 7); g.lineTo(tx + nx * r, ty + ny * r); g.lineTo(tx - nx * r, ty - ny * r); g.lineTo(lx - nx * 7, ly - ny * 7);
        g.closePath(); g.fill();
      };
      const fadeEnd = p.kind === 'front' ? 0.05 : 0;
      cone(p.r * 1.12, 0.07 * a, 0);                  // alone morbido
      cone(p.r, 0.26 * a, fadeEnd * a);                // fascio
      g.strokeStyle = rgba(c, 0.16 * a); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(lx + nx * 7, ly + ny * 7); g.lineTo(tx + nx * p.r, ty + ny * p.r);
      g.moveTo(lx - nx * 7, ly - ny * 7); g.lineTo(tx - nx * p.r, ty - ny * p.r); g.stroke();
    });

    // pubblico: di spalle, bordato dalla luce del palco; ondeggia se è contento
    g.globalCompositeOperation = 'source-over';
    const mix = [0, 1, 2].map(k => cols.reduce((sum, cc) => sum + cc[k], 0) / cols.length);
    const mood = S.grad / 100, moving = S.running && !S.paused && !reducedFx();
    const cheering = cheerAt != null ? Math.max(0, 1 - (now - cheerAt) / 6) : 0;
    const back = moving ? mood : 0;
    crowd.forEach(q => {
      let y = q.y + (moving ? Math.sin(t * (2 + mood * 3) + q.ph) * back * 3 : 0);
      if (cheering && !reducedFx()) y -= Math.abs(Math.sin(now * 7 + q.ph)) * 12 * cheering * (0.4 + mood);
      const r = q.rad;
      g.fillStyle = mood < 0.35 ? '#101117' : '#16171e';
      if (cheering && q.arms && mood >= 0.4) {
        g.strokeStyle = '#16171e'; g.lineWidth = r * 0.45; g.lineCap = 'round';
        g.beginPath(); g.moveTo(q.x - r * 0.9, y + r * 1.2); g.lineTo(q.x - r * 1.3, y - r * 1.6); g.moveTo(q.x + r * 0.9, y + r * 1.2); g.lineTo(q.x + r * 1.3, y - r * 1.6); g.stroke();
      }
      g.beginPath(); g.ellipse(q.x, y + r * 2.1, r * 1.9, r * 1.4, 0, Math.PI, 0); g.fill();
      g.fillRect(q.x - r * 1.9, y + r * 2.1, r * 3.8, 200);
      g.beginPath(); g.arc(q.x, y, r, 0, Math.PI * 2); g.fill();
      {
        g.strokeStyle = rgba(mix, 0.12 + 0.4 * d); g.lineWidth = 2;
        g.beginPath(); g.arc(q.x, y, r - 1, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      }
    });

    // lenti accese dei PAR (i frontali si vedono da dietro, sopra le teste)
    g.globalCompositeOperation = 'lighter';
    light.forEach(({ p, c, a }) => {
      const [lx, ly] = p.lens;
      if (p.kind === 'front') {
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#1b1c21'; g.fillRect(lx - 17, ly - 14, 34, 28);
        g.strokeStyle = '#3a3d45'; g.lineWidth = 4; g.beginPath(); g.moveTo(lx, ly + 14); g.lineTo(lx, ly + 90); g.stroke();
        g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(lx, ly - 14, 0, lx, ly - 14, 40);
        gr.addColorStop(0, rgba(c, 0.5 * a)); gr.addColorStop(1, rgba(c, 0));
        g.fillStyle = gr; g.beginPath(); g.arc(lx, ly - 14, 40, 0, Math.PI * 2); g.fill();
        return;
      }
      const gr = g.createRadialGradient(lx, ly, 0, lx, ly, 34);
      gr.addColorStop(0, rgba([255, 255, 255], 0.9 * a)); gr.addColorStop(0.25, rgba(c, 0.7 * a)); gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(lx + (lx < 500 ? 16 : -16), ly, 34, 0, Math.PI * 2); g.fill();
    });

    // larsen: onde gialle dalla cassa più vicina al preside
    g.globalCompositeOperation = 'source-over';
    if (S.ring > 0.02) {
      const x = Math.abs(px - SPK.l) < Math.abs(px - SPK.r) ? SPK.l : SPK.r, dir = x < 500 ? 1 : -1;
      [22, 36, 50].forEach((rr, k) => {
        g.strokeStyle = rgba([242, 197, 61], S.ring * (1 - k * 0.25)); g.lineWidth = 4;
        g.beginPath(); g.arc(x + dir * 30, 350, rr, dir > 0 ? -0.9 : Math.PI - 0.9, dir > 0 ? 0.9 : Math.PI + 0.9); g.stroke();
      });
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }

  return {
    open () {
      cv.hidden = false; fit(); cheerAt = null;
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!cv.hidden) fit(); });
    },
    close () { cv.hidden = true; bg = null; },
    fit () { if (!cv.hidden) fit(); },
    reset () { cheerAt = null; },
    draw,
    applause () { cheerAt = performance.now() / 1000; },
    // quanto il preside è vicino a una cassa (0 lontano, 1 addosso)
    speakerNear (S) { const px = presX(S); return Math.max(0, Math.min(1, 1 - (Math.min(Math.abs(px - SPK.l), Math.abs(px - SPK.r)) - 150) / 250)); },
    anchor (target, S) {
      if (target === 'spk-l') return toStage(SPK.l + 20, 296);
      if (target === 'spk-r') return toStage(SPK.r - 20, 296);
      return toStage(presX(S), FEET - PRES_H - 6);
    }
  };
})();

/* impianto di prova (?prova): montato, cablato, acceso e col microfono sul CH1 */
const PROVA_LEVEL = {"id":1,"placed":{"allaccio":{"id":"allaccio","type":"allaccio","gx":null,"gy":null,"screen":{"x":1159,"y":455},"zone":"ground"},"sub_1":{"id":"sub_1","type":"sub","gx":1.5,"gy":8.5,"foot":[1,1],"cells":["3,17"],"screen":{"x":496,"y":437.5},"zone":"ground","hasTop":"top_1","on":true},"sub_2":{"id":"sub_2","type":"sub","gx":7.5,"gy":8.5,"foot":[1,1],"cells":["15,17"],"screen":{"x":802,"y":647.5},"zone":"ground","hasTop":"top_2","on":true},"top_1":{"id":"top_1","type":"top","parentSubId":"sub_1","zone":"ground","screen":{"x":496,"y":372.5}},"top_2":{"id":"top_2","type":"top","parentSubId":"sub_2","zone":"ground","screen":{"x":802,"y":582.5}},"mixer_1":{"id":"mixer_1","type":"mixer","gx":7.5,"gy":5,"foot":[1,2],"cells":["15,10","15,11"],"screen":{"x":967.75,"y":533.75},"zone":"stage","on":true},"ampli_1":{"id":"ampli_1","type":"ampli","gx":6.5,"gy":4,"foot":[1,2],"cells":["13,8","13,9"],"screen":{"x":967.75,"y":463.75},"zone":"stage","on":true},"controller_1":{"id":"controller_1","type":"controller","gx":7.5,"gy":7.5,"foot":[1,1],"cells":["15,15"],"screen":{"x":853,"y":612.5},"zone":"stage","on":true},"stativo_1":{"id":"stativo_1","type":"stativo","gx":6.5,"gy":6.5,"foot":[1,1],"cells":["13,13"],"screen":{"x":853,"y":542.5},"zone":"stage","hasPar":"par_4"},"stativo_2":{"id":"stativo_2","type":"stativo","gx":2.5,"gy":9.5,"foot":[1,1],"cells":["5,19"],"screen":{"x":496,"y":507.5},"zone":"ground","hasPar":"par_3"},"stativo_3":{"id":"stativo_3","type":"stativo","gx":0.5,"gy":6.5,"foot":[1,1],"cells":["1,13"],"screen":{"x":547,"y":332.5},"zone":"ground","hasPar":"par_1"},"stativo_4":{"id":"stativo_4","type":"stativo","gx":9.5,"gy":9.5,"foot":[1,1],"cells":["19,19"],"screen":{"x":853,"y":752.5},"zone":"ground","hasPar":"par_2"},"par_1":{"id":"par_1","type":"par","parentStandId":"stativo_3","zone":"ground","screen":{"x":547,"y":249},"dmx":{"addr":81,"mode":2}},"par_2":{"id":"par_2","type":"par","parentStandId":"stativo_4","zone":"ground","screen":{"x":853,"y":669},"dmx":{"addr":81,"mode":2}},"par_3":{"id":"par_3","type":"par","parentStandId":"stativo_2","zone":"ground","screen":{"x":496,"y":424},"dmx":{"addr":81,"mode":2}},"par_4":{"id":"par_4","type":"par","parentStandId":"stativo_1","zone":"stage","screen":{"x":853,"y":459},"dmx":{"addr":81,"mode":2}},"asta_1":{"id":"asta_1","type":"asta","gx":4.5,"gy":6.5,"foot":[1,1],"cells":["9,13"],"screen":{"x":751,"y":472.5},"zone":"stage","hasMic":"mic_1"},"mic_1":{"id":"mic_1","type":"mic","parentAstaId":"asta_1","zone":"stage","screen":{"x":758,"y":409.082}},"quadro_1":{"id":"quadro_1","type":"quadro","gx":4.5,"gy":2,"foot":[1,2],"cells":["9,4","9,5"],"screen":{"x":967.75,"y":323.75},"zone":"ground","prot":{"main":true,"rcd":true,"L1":true,"L2":true,"L3":true,"tripped":{}}},"ciabatta_cee_1":{"id":"ciabatta_cee_1","type":"ciabatta_cee","gx":6.5,"gy":2,"foot":[1,3],"cells":["13,4","13,5","13,6"],"screen":{"x":1057,"y":402.5},"zone":"ground","on":true},"ciabatta_1":{"id":"ciabatta_1","type":"ciabatta","gx":3.5,"gy":14,"foot":[1,2],"cells":["7,28","7,29"],"screen":{"x":304.75,"y":708.75},"zone":"ground"},"pc_1":{"id":"pc_1","type":"pc","gx":4.5,"gy":14,"foot":[1,1],"cells":["9,28"],"screen":{"x":368.5,"y":735},"zone":"ground","on":true},"scheda_1":{"id":"scheda_1","type":"scheda","gx":5.5,"gy":14,"foot":[1,1],"cells":["11,28"],"screen":{"x":419.5,"y":770},"zone":"ground"}},"edges":[{"id":0,"a":"allaccio","aPort":"out","b":"quadro_1","bPort":"in","signal":"cee_tri"},{"id":1,"a":"quadro_1","aPort":"out_1","b":"ciabatta_cee_1","bPort":"in","signal":"cee_mono"},{"id":2,"a":"ciabatta_cee_1","aPort":"out_1","b":"pc_1","bPort":"power","signal":"schuko"},{"id":3,"a":"quadro_1","aPort":"out_1","b":"mixer_1","bPort":"power","signal":"cee_powercon"},{"id":4,"a":"ciabatta_cee_1","aPort":"out_4","b":"controller_1","bPort":"power","signal":"schuko_powercon"},{"id":5,"a":"quadro_1","aPort":"out_3","b":"ampli_1","bPort":"power","signal":"cee_powercon"},{"id":6,"a":"ciabatta_cee_1","aPort":"out_3","b":"sub_1","bPort":"power","signal":"schuko_powercon"},{"id":7,"a":"ciabatta_cee_1","aPort":"out_2","b":"sub_2","bPort":"power","signal":"schuko_powercon"},{"id":8,"a":"quadro_1","aPort":"out_3","b":"par_1","bPort":"power_in","signal":"cee_powercon"},{"id":9,"a":"par_1","aPort":"power_thru","b":"par_2","bPort":"power_in","signal":"powercon"},{"id":10,"a":"quadro_1","aPort":"out_2","b":"par_3","bPort":"power_in","signal":"cee_powercon"},{"id":11,"a":"quadro_1","aPort":"out_2","b":"par_4","bPort":"power_in","signal":"cee_powercon"},{"id":12,"a":"pc_1","aPort":"usb","b":"scheda_1","bPort":"usb","signal":"usbc"},{"id":13,"a":"scheda_1","aPort":"out_L","b":"mixer_1","bPort":"in_5","signal":"jack"},{"id":14,"a":"scheda_1","aPort":"out_R","b":"mixer_1","bPort":"in_6","signal":"jack"},{"id":15,"a":"mixer_1","aPort":"main_L","b":"ampli_1","bPort":"in_L","signal":"xlr"},{"id":16,"a":"mixer_1","aPort":"main_R","b":"ampli_1","bPort":"in_R","signal":"xlr"},{"id":17,"a":"ampli_1","aPort":"out_L","b":"sub_1","bPort":"spk_in","signal":"speakon"},{"id":18,"a":"ampli_1","aPort":"out_R","b":"sub_2","bPort":"spk_in","signal":"speakon"},{"id":19,"a":"sub_1","aPort":"spk_thru","b":"top_1","bPort":"spk_in","signal":"speakon"},{"id":20,"a":"sub_2","aPort":"spk_thru","b":"top_2","bPort":"spk_in","signal":"speakon"},{"id":21,"a":"mic_1","aPort":"out","b":"mixer_1","bPort":"in_1","signal":"xlr"},{"id":22,"a":"controller_1","aPort":"dmx_2","b":"par_2","bPort":"dmx_in","signal":"dmx"},{"id":23,"a":"par_2","aPort":"dmx_thru","b":"par_1","bPort":"dmx_in","signal":"dmx"},{"id":24,"a":"par_1","aPort":"dmx_thru","b":"par_4","bPort":"dmx_in","signal":"dmx"},{"id":25,"a":"par_4","aPort":"dmx_thru","b":"par_3","bPort":"dmx_in","signal":"dmx"}],"stock":{"sub":0,"top":0,"mixer":0,"asta":0,"mic":0,"stativo":0,"par":0,"controller":0,"ampli":0,"quadro":0,"ciabatta":0,"ciabatta_cee":0,"pc":0,"scheda":0,"di":0},"nextIndex":{"sub":3,"top":3,"mixer":2,"asta":2,"mic":2,"stativo":5,"par":5,"controller":2,"ampli":2,"quadro":2,"ciabatta":2,"ciabatta_cee":2,"pc":2,"scheda":2,"di":1},"edgeSeq":26,"trips":0,"rcdTrips":0,"procErrors":[],"stats":{"playMs":0,"tests":0,"failedTests":0}};
if (window.SCS_PROVA || /[?&#]prova\b/.test(location.search + location.hash)) Show.prova();
