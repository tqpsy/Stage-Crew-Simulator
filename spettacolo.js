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
      dimmer: 0.3, pars: ['viola', 'blu', 'viola', 'blu'], mem: 2,
      voiceK: 1, drift: 1, driftTo: 1, walk: 0, walkTo: 0, side: null, ring: 0, ringCool: 0,
      jingle: false, larsens: 0, pops: 0, notes: [], events: [],
      mems: {
        1: { name: 'Bianco pieno', pars: ['bianco', 'bianco', 'bianco', 'bianco'], dimmer: 1 },
        2: { name: 'Festa', pars: ['viola', 'blu', 'viola', 'blu'], dimmer: 0.3 },
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

  /* ---------- banco regia ---------- */
  function showTab (which) {
    ['mixer', 'luci'].forEach(k => {
      $('#sd-tab-' + k).setAttribute('aria-selected', k === which);
      $('#sd-panel-' + k).hidden = k !== which;
    });
  }
  $('#sd-tab-mixer').addEventListener('click', () => { SFX.button(); showTab('mixer'); });
  $('#sd-tab-luci').addEventListener('click', () => { SFX.button(); showTab('luci'); });

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
  const chF = {};
  let dimmerF;
  function buildDesk () {
    const pm = $('#sd-panel-mixer'); pm.textContent = '';
    CHANNELS.forEach(n => {
      const d = document.createElement('div'); d.className = 'sd-strip'; d.id = 'sd-strip-' + n;
      d.innerHTML = `<div class="sd-name">${n === S.micCh ? TRAMP_FACE(20) : ''}${n === PC ? 'PC' : 'CH' + n}</div>`;
      pm.appendChild(d);
      chF[n] = makeFader(d, () => S.fad[n], v => { S.fad[n] = v; }, true);
      chF[n].el.setAttribute('aria-label', n === PC ? 'Fader PC' : 'Fader CH' + n);
      const m = document.createElement('button'); m.className = 'sd-mute'; m.textContent = 'MUTE'; m.id = 'sd-mute-' + n;
      m.setAttribute('aria-pressed', 'false');
      m.addEventListener('click', () => { S.mute[n] = !S.mute[n]; m.setAttribute('aria-pressed', S.mute[n]); });
      d.appendChild(m);
    });

    const pb = $('#sd-pars'); pb.textContent = '';
    S.pars.forEach((_, i) => {
      const b = document.createElement('button'); b.className = 'sd-par'; b.id = 'sd-par-' + i;
      b.innerHTML = `<span class="dot"></span>PAR ${i + 1}`;
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
    const dw = $('#sd-dimmer'); dw.textContent = '';
    dimmerF = makeFader(dw, () => S.dimmer, v => { S.dimmer = v; S.mem = null; paintLights(); }, false);
    dimmerF.el.setAttribute('aria-label', 'Dimmer');
    showTab('mixer');
    paintLights();
  }
  function recall (n) { const m = S.mems[n]; S.pars = [...m.pars]; S.dimmer = m.dimmer; S.mem = n; dimmerF.paint(); paintLights(); }
  function paintLights () {
    S.pars.forEach((c, i) => { const d = $('#sd-par-' + i + ' .dot'); d.style.background = COLORS[c]; d.style.color = COLORS[c]; d.style.opacity = 0.35 + 0.65 * S.dimmer; });
    [1, 2, 3, 4].forEach(n => {
      const b = $('#sd-mem-' + n);
      b.innerHTML = `<b>${n} · ${S.mems[n].name}</b><small>${S.mems[n].pars.join(' ')}</small>`;
      b.setAttribute('aria-pressed', S.mem === n);
    });
  }

  /* ---------- fumetti: HTML sopra il palco, agganciati ai punti del mondo ---------- */
  const bubbleEls = new Map();
  const layer = $('#show-bubbles');
  function renderBubbles () {
    const scene = window.__scene, live = new Set();
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
      const w = scene.showAnchor(e.target);
      const [px, py] = scene.worldToStage(w.x, w.y);
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
  function tapBubble (e) {
    showTab(e.tab);
    if (!hints) return;    // senza suggerimenti il fumetto apre solo il banco giusto
    if (e.tab === 'mixer') pulse($('#sd-strip-' + (e.id === 'sigla' ? PC : S.micCh)));
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
    else if (active) window.__scene.showDraw(S);
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
    const near = window.__scene.showSpeakerNear(S);
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
    window.__scene.showDraw(S);
    renderBubbles(); paintHeader();
    if (S.t >= DURATION) finish();
  }

  function finish () {
    S.running = false; voice.silence(); sfx.music(0); sfx.ring(0); sfx.applause(S.grad);
    clearBubbles(); $('#show-caption').innerHTML = '';
    window.__scene.showApplause(S);
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
    const scene = window.__scene;
    scene.showEnter();
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    window.addEventListener('resize', onResize);
  }
  const onResize = () => { if (active) window.__scene.showFit(); };
  function start () {
    $('#show-intro').classList.remove('show');
    $('#show-outro').classList.remove('show');
    enter();
    S = fresh(); S.events = script();
    clearBubbles(); buildDesk();
    $('#show-pause').hidden = true; $('#sh-pause').textContent = '⏸';
    sfx.init(); voice.init();
    S.running = true;
    window.__scene.showReset(S);
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
    window.__scene.showExit();
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
    refreshButton, offer, start, exit, prova, setPaused, showTab,
    // per i test: il tempo avanza solo quando lo dicono loro
    manualTime (on) { manual = on; },
    step (dt) { step(dt); }
  };
})();
window.Show = Show;

/* ---------------------------------------------------------------------
   Disegno dello spettacolo sulla scena isometrica: notte, fasci dei PAR
   (fari fissi: cambiano solo colore e intensità), il preside all'asta,
   il pubblico in platea e il larsen che nasce vicino alle casse.
   --------------------------------------------------------------------- */
Object.assign(StageScene.prototype, {
  showEnter () {
    this.stopFx(); this.clearEdgeSelection(); this.clearMoveSelection(); this.cancelPending();
    const cam = this.cameras.main;
    this.showView = { x: cam.midPoint.x, y: cam.midPoint.y, z: cam.zoom };
    const o = this.show = { objs: [] };
    const keep = x => { o.objs.push(x); return x; };
    o.night = keep(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W * 8, GAME_H * 8, 0x03050d, 1).setScrollFactor(0).setDepth(40).setAlpha(0));
    this.tweens.add({ targets: o.night, alpha: 0.8, duration: 900, ease: 'Sine.InOut' });
    o.beams = keep(this.add.graphics().setDepth(44).setBlendMode(Phaser.BlendModes.ADD));
    o.fg = keep(this.add.graphics().setDepth(48));
    if (this.liveBeams) this.liveBeams.clear();
    // di sera i cavi e le etichette delle prese non si vedono
    this.edgeGraphics.setVisible(false);
    Object.values(this.compVisuals).forEach(v => { if (v.idLabel) v.idLabel.setVisible(false); });

    // PAR da sinistra a destra: PAR 1-4 del banco luci
    o.pars = this.parBeamGeometry(placedOfType('par').filter(c => this.compVisuals[c.id]))
      .sort((a, b) => a.x - b.x);
    o.parOn = o.pars.map(b => isRunning(b.c.id));

    // il preside parla sotto la punta della giraffa, dove c'è il microfono
    const asta = placedOfType('asta')[0];
    const mic = mountedOn(asta);
    const av = this.compVisuals[asta.id].container;
    const mv = mic && this.compVisuals[mic.id] ? this.compVisuals[mic.id].container : { x: av.x + micOffset().x, y: av.y + micOffset().y };
    o.tip = { x: mv.x, y: mv.y };
    o.astaBase = { x: av.x, y: av.y };
    const lift = ASTA_ISO(...ASTA_TIP).y - ASTA_ISO(ASTA_TIP[0], ASTA_TIP[1], 0).y;   // altezza della punta sullo schermo
    const feet = { x: o.tip.x + 10, y: o.tip.y - lift - 7 };                          // un passo dietro al microfono
    o.home = screenToGrid(feet.x, feet.y);
    o.presScale = Math.max(0.5, (feet.y - o.tip.y) / 58);
    o.preside = keep(this.drawTramp(o.presScale));

    // casse: le teste montate sui sub, con la loro posizione sul pavimento
    o.tops = placedOfType('top').map(t => {
      const base = mountBase(t);
      const v = this.compVisuals[t.id];
      return v && base ? { v, g: compCenter(base) } : null;
    }).filter(Boolean).sort((a, b) => a.v.container.x - b.v.container.x);

    // pubblico in platea, di spalle, guardando il palco
    o.crowd = [];
    const start = STAGE_ORIGIN_Y + STAGE_H + PIT_ROWS;
    let seed = 7;
    const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const SHIRTS = [0x3b4a66, 0x6a3b3b, 0x3b6a4a, 0x5a4b72, 0x7a6a3a, 0x2f5a6a];
    const HAIR = [0x2a1d12, 0x4a3020, 0x8a6a3a, 0x1a1a1a, 0xb08a4a];
    for (let gy = start + 0.35; gy < start + PLATEA_ROWS; gy += 0.62) {
      for (let gx = 0.4; gx < VENUE_W - 0.2; gx += 0.62) {
        if (r() < 0.22) continue;
        const p = gridToScreen(gx + (r() - 0.5) * 0.25, gy + (r() - 0.5) * 0.25);
        const c = keep(this.add.container(p.x, p.y).setDepth(41 + p.y / 10000));
        const g = this.add.graphics();
        const shirt = SHIRTS[Math.floor(r() * SHIRTS.length)];
        g.fillStyle(0x000000, 0.35); g.fillEllipse(0, 0, 22, 8);
        g.fillStyle(shirt, 1); g.fillRoundedRect(-9, -34, 18, 30, 7);
        g.fillStyle(0xd9a57a, 1); g.fillCircle(0, -40, 7.5);
        g.fillStyle(HAIR[Math.floor(r() * HAIR.length)], 1); g.fillEllipse(0, -42, 15, 11);
        c.add(g);
        c.setScale(0.95 + r() * 0.2);
        o.crowd.push({ c, y0: p.y, ph: r() * 6, g });
      }
    }
    this.showFit();
    // il riquadro cambia forma col banco regia: si rifà l'inquadratura a impaginazione finita
    requestAnimationFrame(() => requestAnimationFrame(() => { if (this.show) this.showFit(); }));
  },

  // caricatura del preside in piedi, piedi in (0,0), bocca a 58 unità d'altezza
  drawTramp (scale) {
    const c = this.add.container(0, 0).setDepth(43);
    const g = this.add.graphics();
    const NAVY = 0x1d2b4a, SKIN = 0xf0a35a;
    g.fillStyle(0x000000, 0.4); g.fillEllipse(0, 0, 32, 9);
    g.fillStyle(0x121a2e, 1); g.fillRect(-9, -28, 7, 27); g.fillRect(2, -28, 7, 27);
    g.fillStyle(0x0b0b0d, 1); g.fillEllipse(-6, -1, 11, 5); g.fillEllipse(6, -1, 11, 5);
    g.fillStyle(NAVY, 1);
    g.fillPoints([{ x: -16, y: -26 }, { x: 16, y: -26 }, { x: 14, y: -51 }, { x: -14, y: -51 }], true);
    g.fillEllipse(0, -50, 32, 9);
    g.fillRect(-19, -50, 6, 22); g.fillRect(13, -50, 6, 22);
    g.fillStyle(SKIN, 1); g.fillCircle(-16, -27, 3.5); g.fillCircle(16, -27, 3.5);
    g.fillStyle(0xf4f1ea, 1); g.fillTriangle(-5, -53, 5, -53, 0, -42);
    g.fillStyle(0xd6392f, 1); g.fillPoints([{ x: -2, y: -50 }, { x: 2, y: -50 }, { x: 3.5, y: -19 }, { x: 0, y: -15 }, { x: -3.5, y: -19 }], true);
    g.fillStyle(0xe8964f, 1); g.fillRect(-4, -57, 8, 6);
    g.fillStyle(SKIN, 1); g.fillEllipse(0, -64, 19, 22);
    g.fillStyle(0xf7d7b0, 1); g.fillEllipse(-4.5, -65, 6, 3.5); g.fillEllipse(4.5, -65, 6, 3.5);
    g.fillStyle(0x2a1d12, 1); g.fillCircle(-4.2, -65, 1); g.fillCircle(4.2, -65, 1);
    g.fillStyle(0xf4d35e, 1);
    g.fillPoints([{ x: -10, y: -66 }, { x: -11, y: -73 }, { x: -5, y: -78 }, { x: 5, y: -78 }, { x: 12, y: -74 }, { x: 11, y: -68 }, { x: 6, y: -71 }, { x: -2, y: -72 }, { x: -7, y: -70 }], true);
    g.fillStyle(0xe9c23f, 1); g.fillTriangle(0, -78, 14, -75, 9, -72);
    const mouth = this.add.ellipse(0, -58, 5, 3, 0xb8573a);
    c.add([g, mouth]);
    c.setScale(scale);
    c.mouth = mouth;
    return c;
  },

  // inquadratura: palco, casse, PAR e le prime file, alla misura del riquadro
  showFit () {
    const wrap = document.getElementById('stage-wrap').getBoundingClientRect();
    if (wrap.width > 0 && wrap.height > 0) { this.scale.setGameSize(GAME_W, Math.round(GAME_W * wrap.height / wrap.width)); this.scale.refresh(); }
    const o = this.show;
    const pts = [];
    [[STAGE_ORIGIN_X, STAGE_ORIGIN_Y], [STAGE_ORIGIN_X + STAGE_W, STAGE_ORIGIN_Y], [STAGE_ORIGIN_X, STAGE_ORIGIN_Y + STAGE_H + 0.5],
      [STAGE_ORIGIN_X + STAGE_W, STAGE_ORIGIN_Y + STAGE_H + 0.5]].forEach(([gx, gy]) => pts.push(gridToScreen(gx, gy)));
    o.pars.forEach(b => pts.push({ x: b.x, y: b.y - 20 }));
    o.tops.forEach(t => pts.push({ x: t.v.container.x, y: t.v.container.y - 60 }));
    pts.push({ x: o.astaBase.x, y: o.tip.y - 30 * o.presScale });
    pts.push(gridToScreen(STAGE_ORIGIN_X + STAGE_W / 2, STAGE_ORIGIN_Y + STAGE_H + PIT_ROWS + 1.2));
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const M = 30, x0 = Math.min(...xs) - M, x1 = Math.max(...xs) + M, y0 = Math.min(...ys) - M - 40, y1 = Math.max(...ys) + M;
    const cam = this.cameras.main;
    const z = Math.min(ZOOM_MAX, cam.width / (x1 - x0), cam.height / (y1 - y0));
    cam.setZoom(z);
    cam.centerOn((x0 + x1) / 2, (y0 + y1) / 2);
  },

  // da punto del mondo a pixel dentro #stage-wrap (per i fumetti HTML)
  worldToStage (wx, wy) {
    const cam = this.cameras.main, cr = this.game.canvas.getBoundingClientRect();
    const wr = document.getElementById('stage-wrap').getBoundingClientRect();
    const k = cr.width / this.scale.width;
    return [cr.left - wr.left + (wx - cam.worldView.x) * cam.zoom * k, cr.top - wr.top + (wy - cam.worldView.y) * cam.zoom * k];
  },

  // dove sta il preside sul palco (in metri): all'asta o verso una cassa
  showPresidePos (S) {
    const o = this.show;
    const top = S.side && o.tops.length ? o.tops[S.side === 'l' ? 0 : o.tops.length - 1] : null;
    if (!top) return o.home;
    // si ferma sul bordo del palco, dalla parte della cassa
    const tx = Math.max(STAGE_ORIGIN_X + 0.3, Math.min(STAGE_ORIGIN_X + STAGE_W - 0.3, top.g.gx));
    const ty = STAGE_ORIGIN_Y + STAGE_H - 0.3;
    return { gx: o.home.gx + (tx - o.home.gx) * S.walk, gy: o.home.gy + (ty - o.home.gy) * S.walk };
  },
  // quanto è vicino a una cassa (0 lontano, 1 addosso)
  showSpeakerNear (S) {
    const p = this.showPresidePos(S);
    const d = Math.min(...this.show.tops.map(t => Math.hypot(t.g.gx - p.gx, t.g.gy - p.gy)), 99);
    return Math.max(0, 1 - d / 3);
  },
  showAnchor (target) {
    const o = this.show;
    if (target === 'spk-l' || target === 'spk-r') {
      const t = o.tops[target === 'spk-l' ? 0 : o.tops.length - 1];
      if (t) return { x: t.v.container.x, y: t.v.container.y - 70 };
    }
    return { x: o.preside.x, y: o.preside.y - 82 * o.presScale };
  },

  showReset (S) {
    const o = this.show;
    o.crowd.forEach(p => p.c.setAlpha(1));
    if (o.cheer) { o.cheer.forEach(t => t.stop()); o.cheer = null; }
    this.showDraw(S);
  },

  showDraw (S) {
    const o = this.show;
    if (!o || !S) return;
    const t = S.t, moving = S.running && !S.paused;
    // fasci dei PAR: fermi, netti e simmetrici
    const g = o.beams; g.clear();
    o.pars.forEach((b, i) => {
      if (!o.parOn[i]) return;
      const col = hexNumOf(S.pars[i % S.pars.length]);
      const a = S.dimmer;
      if (a > 0.01) {
        g.fillStyle(col, 0.12 * a);
        g.fillTriangle(b.x, b.y, b.tx + b.ex, b.ty + b.ey, b.tx - b.ex, b.ty - b.ey);
        g.fillStyle(col, 0.16 * a); g.fillEllipse(b.tx, b.ty, b.rx * 2, b.ry * 2);
        g.lineStyle(1.5, col, 0.45 * a);
        g.lineBetween(b.x, b.y, b.tx + b.ex, b.ty + b.ey); g.lineBetween(b.x, b.y, b.tx - b.ex, b.ty - b.ey);
        g.strokeEllipse(b.tx, b.ty, b.rx * 2, b.ry * 2);
      }
      g.fillStyle(col, 0.25 + 0.5 * a); g.fillCircle(b.x, b.y, 9);
      g.fillStyle(0xffffff, 0.2 + 0.7 * a); g.fillCircle(b.x, b.y, 4);
    });

    // il preside: dondola quando parla, la bocca segue la voce
    const p = gridToScreen(...Object.values(this.showPresidePos(S)));
    const speaking = moving && t > 4 && t < 82;
    o.preside.setPosition(p.x, p.y + (speaking ? Math.sin(t * 4) * 0.8 : 0));
    o.preside.setDepth(43 + p.y / 10000);
    o.preside.mouth.setScale(1, speaking && S.micOk ? 0.6 + Math.abs(Math.sin(t * 13)) * 1.4 : 0.6);

    // il microfono davanti alla sua bocca (quando è all'asta)
    const f = o.fg; f.clear();
    if (S.walk < 0.15) { f.fillStyle(0x2a2b30, 1); f.fillCircle(o.tip.x, o.tip.y, 2.6 * o.presScale); }
    // anelli del larsen sulla cassa più vicina
    if (S.ring > 0.02 && o.tops.length) {
      const pp = this.showPresidePos(S);
      const top = o.tops.reduce((a, b) => Math.hypot(a.g.gx - pp.gx, a.g.gy - pp.gy) < Math.hypot(b.g.gx - pp.gx, b.g.gy - pp.gy) ? a : b);
      const x = top.v.container.x, y = top.v.container.y - 40;
      [16, 26, 36].forEach((rr, k) => { f.lineStyle(3, 0xf2c53d, S.ring * (1 - k * 0.25)); f.beginPath(); f.arc(x, y, rr, -0.9, 0.9); f.strokePath(); f.beginPath(); f.arc(x, y, rr, Math.PI - 0.9, Math.PI + 0.9); f.strokePath(); });
    }

    // pubblico: ondeggia se è contento, si ingrigisce se si annoia
    if (!o.cheer) {
      const mood = S.grad / 100;
      o.crowd.forEach(q => {
        const bob = moving && !reducedFx() ? Math.sin(t * (2 + mood * 3) + q.ph) * mood * 2.5 : 0;
        q.c.y = q.y0 + bob;
        q.c.setAlpha(mood < 0.35 ? 0.55 : 1);
      });
    }
  },

  // fine discorso: il pubblico salta e applaude, tanto più quanto era contento
  showApplause (S) {
    const o = this.show;
    if (!o) return;
    const h = reducedFx() ? 0 : 4 + 10 * S.grad / 100;
    o.cheer = o.crowd.map((q, i) => this.tweens.add({
      targets: q.c, y: q.y0 - h, duration: 180 + (i % 5) * 30, yoyo: true, repeat: S.grad >= 40 ? 8 : 2, delay: (i % 7) * 60, ease: 'Quad.Out'
    }));
  },

  showExit () {
    const o = this.show;
    if (!o) return;
    if (o.cheer) o.cheer.forEach(t => t.stop());
    o.objs.forEach(x => { this.tweens.killTweensOf(x); x.destroy(); });
    this.show = null;
    this.edgeGraphics.setVisible(true);
    Object.values(this.compVisuals).forEach(v => { if (v.idLabel) v.idLabel.setVisible(true); });
    this.scale.setGameSize(GAME_W, GAME_H);
    requestAnimationFrame(() => this.scale.refresh());
    const v = this.showView, cam = this.cameras.main;
    cam.setZoom(v.z); cam.centerOn(v.x, v.y);
    this.drawLiveBeams();
  }
});
// punto dello schermo -> posizione sul pavimento in metri (inverso di gridToScreen)
function screenToGrid (x, y) {
  const u = (x - ORIGIN_X) / (TILE_W / 2), v = (y - ORIGIN_Y) / (TILE_H / 2);
  return { gx: (u + v) / 2, gy: (v - u) / 2 };
}
function hexNumOf (c) {
  return parseInt(({ bianco: '#f4f1ea', rosso: '#e0503f', blu: '#3f7fe0', verde: '#49b06a', ambra: '#f2a541', viola: '#b36bff' }[c] || '#ffffff').slice(1), 16);
}

/* impianto di prova (?prova): montato, cablato, acceso e col microfono sul CH1 */
const PROVA_LEVEL = {"id":1,"placed":{"allaccio":{"id":"allaccio","type":"allaccio","gx":null,"gy":null,"screen":{"x":1159,"y":455},"zone":"ground"},"sub_1":{"id":"sub_1","type":"sub","gx":1.5,"gy":8.5,"foot":[1,1],"cells":["3,17"],"screen":{"x":496,"y":437.5},"zone":"ground","hasTop":"top_1","on":true},"sub_2":{"id":"sub_2","type":"sub","gx":7.5,"gy":8.5,"foot":[1,1],"cells":["15,17"],"screen":{"x":802,"y":647.5},"zone":"ground","hasTop":"top_2","on":true},"top_1":{"id":"top_1","type":"top","parentSubId":"sub_1","zone":"ground","screen":{"x":496,"y":372.5}},"top_2":{"id":"top_2","type":"top","parentSubId":"sub_2","zone":"ground","screen":{"x":802,"y":582.5}},"mixer_1":{"id":"mixer_1","type":"mixer","gx":7.5,"gy":5,"foot":[1,2],"cells":["15,10","15,11"],"screen":{"x":967.75,"y":533.75},"zone":"stage","on":true},"ampli_1":{"id":"ampli_1","type":"ampli","gx":6.5,"gy":4,"foot":[1,2],"cells":["13,8","13,9"],"screen":{"x":967.75,"y":463.75},"zone":"stage","on":true},"controller_1":{"id":"controller_1","type":"controller","gx":7.5,"gy":7.5,"foot":[1,1],"cells":["15,15"],"screen":{"x":853,"y":612.5},"zone":"stage","on":true},"stativo_1":{"id":"stativo_1","type":"stativo","gx":6.5,"gy":6.5,"foot":[1,1],"cells":["13,13"],"screen":{"x":853,"y":542.5},"zone":"stage","hasPar":"par_4"},"stativo_2":{"id":"stativo_2","type":"stativo","gx":2.5,"gy":9.5,"foot":[1,1],"cells":["5,19"],"screen":{"x":496,"y":507.5},"zone":"ground","hasPar":"par_3"},"stativo_3":{"id":"stativo_3","type":"stativo","gx":0.5,"gy":6.5,"foot":[1,1],"cells":["1,13"],"screen":{"x":547,"y":332.5},"zone":"ground","hasPar":"par_1"},"stativo_4":{"id":"stativo_4","type":"stativo","gx":9.5,"gy":9.5,"foot":[1,1],"cells":["19,19"],"screen":{"x":853,"y":752.5},"zone":"ground","hasPar":"par_2"},"par_1":{"id":"par_1","type":"par","parentStandId":"stativo_3","zone":"ground","screen":{"x":547,"y":249},"dmx":{"addr":81,"mode":2}},"par_2":{"id":"par_2","type":"par","parentStandId":"stativo_4","zone":"ground","screen":{"x":853,"y":669},"dmx":{"addr":81,"mode":2}},"par_3":{"id":"par_3","type":"par","parentStandId":"stativo_2","zone":"ground","screen":{"x":496,"y":424},"dmx":{"addr":81,"mode":2}},"par_4":{"id":"par_4","type":"par","parentStandId":"stativo_1","zone":"stage","screen":{"x":853,"y":459},"dmx":{"addr":81,"mode":2}},"asta_1":{"id":"asta_1","type":"asta","gx":4.5,"gy":6.5,"foot":[1,1],"cells":["9,13"],"screen":{"x":751,"y":472.5},"zone":"stage","hasMic":"mic_1"},"mic_1":{"id":"mic_1","type":"mic","parentAstaId":"asta_1","zone":"stage","screen":{"x":758,"y":409.082}},"quadro_1":{"id":"quadro_1","type":"quadro","gx":4.5,"gy":2,"foot":[1,2],"cells":["9,4","9,5"],"screen":{"x":967.75,"y":323.75},"zone":"ground","prot":{"main":true,"rcd":true,"L1":true,"L2":true,"L3":true,"tripped":{}}},"ciabatta_cee_1":{"id":"ciabatta_cee_1","type":"ciabatta_cee","gx":6.5,"gy":2,"foot":[1,3],"cells":["13,4","13,5","13,6"],"screen":{"x":1057,"y":402.5},"zone":"ground","on":true},"ciabatta_1":{"id":"ciabatta_1","type":"ciabatta","gx":3.5,"gy":14,"foot":[1,2],"cells":["7,28","7,29"],"screen":{"x":304.75,"y":708.75},"zone":"ground"},"pc_1":{"id":"pc_1","type":"pc","gx":4.5,"gy":14,"foot":[1,1],"cells":["9,28"],"screen":{"x":368.5,"y":735},"zone":"ground","on":true},"scheda_1":{"id":"scheda_1","type":"scheda","gx":5.5,"gy":14,"foot":[1,1],"cells":["11,28"],"screen":{"x":419.5,"y":770},"zone":"ground"}},"edges":[{"id":0,"a":"allaccio","aPort":"out","b":"quadro_1","bPort":"in","signal":"cee_tri"},{"id":1,"a":"quadro_1","aPort":"out_1","b":"ciabatta_cee_1","bPort":"in","signal":"cee_mono"},{"id":2,"a":"ciabatta_cee_1","aPort":"out_1","b":"pc_1","bPort":"power","signal":"schuko"},{"id":3,"a":"quadro_1","aPort":"out_1","b":"mixer_1","bPort":"power","signal":"cee_powercon"},{"id":4,"a":"ciabatta_cee_1","aPort":"out_4","b":"controller_1","bPort":"power","signal":"schuko_powercon"},{"id":5,"a":"quadro_1","aPort":"out_3","b":"ampli_1","bPort":"power","signal":"cee_powercon"},{"id":6,"a":"ciabatta_cee_1","aPort":"out_3","b":"sub_1","bPort":"power","signal":"schuko_powercon"},{"id":7,"a":"ciabatta_cee_1","aPort":"out_2","b":"sub_2","bPort":"power","signal":"schuko_powercon"},{"id":8,"a":"quadro_1","aPort":"out_3","b":"par_1","bPort":"power_in","signal":"cee_powercon"},{"id":9,"a":"par_1","aPort":"power_thru","b":"par_2","bPort":"power_in","signal":"powercon"},{"id":10,"a":"quadro_1","aPort":"out_2","b":"par_3","bPort":"power_in","signal":"cee_powercon"},{"id":11,"a":"quadro_1","aPort":"out_2","b":"par_4","bPort":"power_in","signal":"cee_powercon"},{"id":12,"a":"pc_1","aPort":"usb","b":"scheda_1","bPort":"usb","signal":"usbc"},{"id":13,"a":"scheda_1","aPort":"out_L","b":"mixer_1","bPort":"in_5","signal":"jack"},{"id":14,"a":"scheda_1","aPort":"out_R","b":"mixer_1","bPort":"in_6","signal":"jack"},{"id":15,"a":"mixer_1","aPort":"main_L","b":"ampli_1","bPort":"in_L","signal":"xlr"},{"id":16,"a":"mixer_1","aPort":"main_R","b":"ampli_1","bPort":"in_R","signal":"xlr"},{"id":17,"a":"ampli_1","aPort":"out_L","b":"sub_1","bPort":"spk_in","signal":"speakon"},{"id":18,"a":"ampli_1","aPort":"out_R","b":"sub_2","bPort":"spk_in","signal":"speakon"},{"id":19,"a":"sub_1","aPort":"spk_thru","b":"top_1","bPort":"spk_in","signal":"speakon"},{"id":20,"a":"sub_2","aPort":"spk_thru","b":"top_2","bPort":"spk_in","signal":"speakon"},{"id":21,"a":"mic_1","aPort":"out","b":"mixer_1","bPort":"in_1","signal":"xlr"},{"id":22,"a":"controller_1","aPort":"dmx_2","b":"par_2","bPort":"dmx_in","signal":"dmx"},{"id":23,"a":"par_2","aPort":"dmx_thru","b":"par_1","bPort":"dmx_in","signal":"dmx"},{"id":24,"a":"par_1","aPort":"dmx_thru","b":"par_4","bPort":"dmx_in","signal":"dmx"},{"id":25,"a":"par_4","aPort":"dmx_thru","b":"par_3","bPort":"dmx_in","signal":"dmx"}],"stock":{"sub":0,"top":0,"mixer":0,"asta":0,"mic":0,"stativo":0,"par":0,"controller":0,"ampli":0,"quadro":0,"ciabatta":0,"ciabatta_cee":0,"pc":0,"scheda":0,"di":0},"nextIndex":{"sub":3,"top":3,"mixer":2,"asta":2,"mic":2,"stativo":5,"par":5,"controller":2,"ampli":2,"quadro":2,"ciabatta":2,"ciabatta_cee":2,"pc":2,"scheda":2,"di":1},"edgeSeq":26,"trips":0,"rcdTrips":0,"procErrors":[],"stats":{"playMs":0,"tests":0,"failedTests":0}};
if (window.SCS_PROVA || /[?&#]prova\b/.test(location.search + location.hash)) Show.prova();
