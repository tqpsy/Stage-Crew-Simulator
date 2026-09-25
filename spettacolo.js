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

  /* ---------- avvisi della regia: schede in alto sul bordo del palco (non
     sono parole del preside); sul palco resta solo un segnale su chi ha il
     problema ---------- */
  const WHO = { preside: 'Preside', 'spk-l': 'Cassa sinistra', 'spk-r': 'Cassa destra' };
  const bubbleEls = new Map();
  const layer = $('#show-alerts');
  function renderBubbles () {
    const live = new Set();
    S.events.filter(e => e.live).forEach(e => {
      live.add(e);
      let el = bubbleEls.get(e);
      if (!el) {
        el = document.createElement('div'); el.className = 'alert'; el.setAttribute('role', 'button');
        el.innerHTML = '<span class="al-ico"></span><div class="al-txt"><b></b><small></small></div><span class="al-who"></span><i class="al-bar"></i>';
        el.addEventListener('pointerdown', ev => { ev.stopPropagation(); tapBubble(e); });
        el.querySelector('.al-ico').textContent = e.icon;
        el.querySelector('b').textContent = e.text;
        el.querySelector('.al-who').textContent = WHO[e.target] || '';
        layer.appendChild(el); bubbleEls.set(e, el);
      }
      const sm = el.querySelector('small'); sm.textContent = hints ? e.hint : ''; sm.hidden = !hints;
      const timed = e.win < 90;
      const left = timed ? Math.max(0, (e.deadline - S.t) / e.win) : Math.max(0, 1 - (S.t - e.at) / e.dur);
      const bar = el.querySelector('.al-bar');
      bar.style.width = (left * 100).toFixed(1) + '%';
      bar.style.background = left > 0.5 ? '#f2c53d' : '#e0503f';
    });
    bubbleEls.forEach((el, e) => { if (!live.has(e)) { el.remove(); bubbleEls.delete(e); } });
  }
  function clearBubbles () { bubbleEls.forEach(el => el.remove()); bubbleEls.clear(); }
  // toccare l'avviso indica il comando da usare (solo coi suggerimenti)
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
   un canvas in stile cartone animato (colori piatti, contorni spessi, a
   metà tra South Park e i Simpson). I PAR sono fari fissi (due tagli sugli
   stativi ai lati del palco, due frontali nel pit): fasci fermi, netti e
   simmetrici, che cambiano solo colore e intensità. La luce fa una pozza
   sul pavimento e sul sipario, colora il preside e ne proietta l'ombra.
   --------------------------------------------------------------------- */
const View = (() => {
  const W = 1000, VIS_W = 800, VIS = [40, 600];   // mondo; parte che deve restare in vista
  const HOME = 500, FEET = 446, WALL = 360;       // il preside all'asta; piede del sipario
  const SPK = { l: 100, r: 900 };                  // casse (x) ai lati, davanti al palco
  const WALK = { l: 300, r: 700 };                // fin dove arriva il preside verso una cassa
  const PRES_H = 196, PRES_K = PRES_H / 200;      // altezza del preside nel mondo / nel disegno
  const MOUTH = [60, 93];                         // bocca nel disegno
  const INK = '#1b1410', NIGHT = 'rgba(10,12,34,0.5)';
  const PARS = [
    { kind: 'taglio', lens: [200, 300], end: [860, 352], r: 100 },
    { kind: 'front', lens: [340, 572], aim: [540, 292], r: 150 },
    { kind: 'front', lens: [660, 572], aim: [460, 292], r: 150 },
    { kind: 'taglio', lens: [800, 300], end: [140, 352], r: 100 }
  ];
  const COLORS = { bianco: '#f4f1ea', rosso: '#e0503f', blu: '#3f7fe0', verde: '#49b06a', ambra: '#f2a541', viola: '#b36bff' };
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  // colore visto di sera: più scuro e un po' più blu
  const dim = (hex, f = 0.5) => { const c = rgb(hex); return `rgb(${Math.round(c[0] * f + 8)},${Math.round(c[1] * f + 10)},${Math.round(c[2] * f + 26)})`; };

  const cv = document.getElementById('show-canvas');
  const ctx = cv.getContext('2d');
  let cw = 0, ch = 0, dpr = 1, s = 1, ox = 0, oy = 0;
  let bg = null, sprites = null, crowd = [], cheerAt = null;

  /* ---------- il preside, in stile cartone: testa grande, occhi a palla,
     ciuffo giallo, abbronzatura arancio e cravatta rossa lunghissima ---------- */
  const TRAMP = [
    ['#1c2440', 'M40 158 h16 v32 h-16 Z M64 158 h16 v32 h-16 Z'],
    ['#141414', 'M28 194 a16 7 0 1 0 32 0 a16 7 0 1 0 -32 0 Z M60 194 a16 7 0 1 0 32 0 a16 7 0 1 0 -32 0 Z'],
    ['#243a6b', 'M26 118 Q12 140 16 162 L28 162 Q28 142 38 124 Z M94 118 Q108 140 104 162 L92 162 Q92 142 82 124 Z'],
    ['#f3a052', 'M22 166 a8 8 0 1 0 0.1 0 Z M98 166 a8 8 0 1 0 0.1 0 Z'],
    ['#243a6b', 'M24 168 Q20 120 38 104 L82 104 Q100 120 96 168 Z'],
    ['#f7f3ea', 'M48 104 L60 126 L72 104 Z'],
    ['#d8332a', 'M55 110 L65 110 L69 176 L60 186 L51 176 Z'],
    ['#f3a052', 'M20 62 Q20 18 60 18 Q100 18 100 62 Q100 106 60 108 Q20 106 20 62 Z'],
    ['#f7f3ea', 'M34 62 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 Z M62 62 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 Z'],
    ['#1b1410', 'M45 64 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z M69 64 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z'],
    ['#e08a3e', 'M54 78 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 Z'],
    ['#f7d13c', 'M16 58 Q10 10 62 10 Q110 12 104 50 Q92 30 68 36 Q46 26 30 44 Q22 50 16 58 Z'],
    ['#f7d13c', 'M60 12 Q92 0 112 28 Q98 20 82 24 Z']
  ].map(([c, d]) => [c, new Path2D(d)]);

  function makeCanvas (w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  // disegni del preside alla scala giusta: di sera, colorato da ogni luce, sagoma per l'ombra
  function buildSprites () {
    const k = PRES_K * s * dpr;
    const base = makeCanvas(124 * k, 204 * k), b = base.getContext('2d');
    b.scale(k, k); b.translate(2, 2);
    b.lineJoin = 'round'; b.lineCap = 'round'; b.strokeStyle = INK; b.lineWidth = 2.6;
    TRAMP.forEach(([c, p]) => { b.fillStyle = c; b.fill(p); b.stroke(p); });
    // sopracciglia e rughe da cartone
    b.lineWidth = 2.2; b.beginPath(); b.moveTo(36, 46); b.lineTo(54, 50); b.moveTo(84, 46); b.lineTo(66, 50); b.stroke();
    const variant = fn => { const c = makeCanvas(base.width, base.height), g = c.getContext('2d'); g.drawImage(base, 0, 0); fn(g, c); return c; };
    const cover = (g, c, style, op) => { g.globalCompositeOperation = op; g.fillStyle = style; g.fillRect(0, 0, c.width, c.height); };
    const out = {
      k, base,
      dark: variant((g, c) => cover(g, c, 'rgba(10,12,34,0.55)', 'source-atop')),
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
      const gr = g.createLinearGradient(side === 'l' ? 0 : c.width, 0, side === 'l' ? c.width * 0.5 : c.width * 0.5, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalCompositeOperation = 'destination-in'; g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
      return (out.rim[key] = c);
    };
    return out;
  }

  // traccia con contorno spesso da cartone
  const inked = (g, path, fill, lw = 3) => { g.fillStyle = fill; g.fill(path); g.strokeStyle = INK; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(path); };
  const rectP = (x, y, w, h) => { const p = new Path2D(); p.rect(x, y, w, h); return p; };
  const circP = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, Math.PI * 2); return p; };

  /* ---------- fondo fisso: sipario, bandierine, striscione, pedana, casse ---------- */
  function buildBg () {
    const c = makeCanvas(cw * dpr, ch * dpr), g = c.getContext('2d');
    g.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);
    const x0 = -ox / s - 10, x1 = (cw - ox) / s + 10, y0 = -oy / s - 10, y1 = (ch - oy) / s + 10;
    g.lineCap = 'round'; g.lineJoin = 'round';
    // sipario rosso del palco della scuola, a pieghe
    g.fillStyle = '#a3262d'; g.fillRect(x0, y0, x1 - x0, WALL - y0);
    for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) {
      g.fillStyle = '#841c23'; g.fillRect(x + 26, y0, 18, WALL - y0);
      g.fillStyle = '#b8363b'; g.fillRect(x + 8, y0, 6, WALL - y0);
      g.strokeStyle = '#4a0f14'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 44, y0); g.lineTo(x + 44, WALL); g.stroke();
    }
    // mantovana a festoni con il bordo dorato
    g.fillStyle = '#7a1a20';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y0); g.lineTo(x1, 14);
    for (let x = x1; x > x0 - 60; x -= 60) g.quadraticCurveTo(x - 30, 44, x - 60, 14);
    g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
    g.strokeStyle = '#d9a63a'; g.lineWidth = 3; g.beginPath();
    for (let x = x1; x > x0 - 60; x -= 60) { g.moveTo(x, 10); g.quadraticCurveTo(x - 30, 38, x - 60, 10); }
    g.stroke();
    // bandierine da festa
    const flags = ['#e0503f', '#f2c53d', '#3f7fe0', '#49b06a'];
    for (let row = 0; row < 2; row++) {
      const yA = 48 + row * 16, sag = 30;
      g.strokeStyle = INK; g.lineWidth = 2;
      g.beginPath(); g.moveTo(170, yA); g.quadraticCurveTo(500, yA + sag * 2, 830, yA); g.stroke();
      for (let i = 0; i < 15; i++) {
        const t = (i + 0.5) / 15, x = 170 + 660 * t, y = yA + sag * 2 * 2 * t * (1 - t);
        const p = new Path2D(); p.moveTo(x - 12, y); p.lineTo(x + 12, y); p.lineTo(x, y + 22); p.closePath();
        inked(g, p, flags[(i + row * 2) % flags.length], 2);
      }
    }
    // striscione di stoffa appeso con due corde, dipinto a mano dai ragazzi
    g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.moveTo(322, 36); g.lineTo(322, 124); g.moveTo(678, 36); g.lineTo(678, 118); g.stroke();
    g.save(); g.translate(500, 156); g.rotate(-0.02);
    inked(g, new Path2D('M-184 -36 Q0 -28 184 -36 L186 38 Q0 50 -186 38 Z'), '#f2ead2', 3.5);
    g.fillStyle = '#e0503f'; g.fillRect(-168, 25, 336, 6);
    g.fillStyle = '#1e3570'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = 60;
    do { g.font = '700 ' + fs + 'px "Barlow Condensed", "Arial Narrow", sans-serif'; fs -= 2; } while (fs > 14 && g.measureText('FESTA DELLA SCUOLA').width > 340);
    g.fillText('FESTA DELLA SCUOLA', 0, -3);
    g.restore();
    // pedana di legno in prospettiva
    const floor = new Path2D('M230 360 L770 360 L870 470 L130 470 Z');
    inked(g, floor, '#b07a44', 3.5);
    g.strokeStyle = '#8a5c30'; g.lineWidth = 2;
    for (let i = 1; i < 10; i++) { const t = i / 10; g.beginPath(); g.moveTo(230 + 540 * t, WALL + 2); g.lineTo(130 + 740 * t, 468); g.stroke(); }
    inked(g, rectP(130, 470, 740, 34), '#7a4f28', 3.5);
    g.fillStyle = '#141416'; g.fillRect(x0, 506, x1 - x0, y1 - 506);
    // stativi dei tagli, ai lati del palco
    [200, 800].forEach(x => {
      g.strokeStyle = INK; g.lineWidth = 8;
      g.beginPath(); g.moveTo(x, 454); g.lineTo(x, 300); g.moveTo(x, 452); g.lineTo(x - 24, 470); g.moveTo(x, 452); g.lineTo(x + 24, 470); g.stroke();
      g.strokeStyle = '#6a6d75'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(x, 454); g.lineTo(x, 300); g.moveTo(x, 452); g.lineTo(x - 24, 470); g.moveTo(x, 452); g.lineTo(x + 24, 470); g.stroke();
      inked(g, rectP(x - 18, 286, 36, 28), '#2c2d33', 3);
    });
    // casse: sub a terra e testa sul palo
    [SPK.l, SPK.r].forEach(x => {
      g.strokeStyle = INK; g.lineWidth = 9; g.beginPath(); g.moveTo(x, 470); g.lineTo(x, 398); g.stroke();
      g.strokeStyle = '#6a6d75'; g.lineWidth = 5; g.beginPath(); g.moveTo(x, 470); g.lineTo(x, 398); g.stroke();
      inked(g, rectP(x - 42, 468, 84, 92), '#2c2d33', 3.5);
      inked(g, circP(x, 514, 27), '#4a4c54', 3); inked(g, circP(x, 514, 9), '#2c2d33', 2.5);
      inked(g, rectP(x - 32, 300, 64, 100), '#2c2d33', 3.5);
      inked(g, circP(x, 366, 20), '#4a4c54', 3); inked(g, circP(x, 366, 7), '#2c2d33', 2.5);
      inked(g, circP(x, 322, 9), '#4a4c54', 2.5);
    });
    // asta del microfono (il preside ci sta dietro)
    g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(506, 458); g.lineTo(506, 380); g.moveTo(506, 458); g.lineTo(486, 472); g.moveTo(506, 458); g.lineTo(526, 472); g.stroke();
    g.strokeStyle = '#8a8d95'; g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(506, 458); g.lineTo(506, 380); g.moveTo(506, 458); g.lineTo(486, 472); g.moveTo(506, 458); g.lineTo(526, 472); g.stroke();
    // è sera: tutto un po' più scuro e blu, poi ci pensano le luci
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = NIGHT; g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // pubblico di spalle, a cartone: capelli, cappellini col pompon, codini
  function buildCrowd () {
    crowd = [];
    let seed = 11;
    const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const pick = a => a[Math.floor(r() * a.length)];
    const HAIR = ['#2a1d12', '#5a3a1e', '#c9962e', '#1a1a1a', '#8a3b1c', '#e8d38a'];
    const SHIRT = ['#3f7fe0', '#e0503f', '#49b06a', '#f2c53d', '#9b5de5', '#e87a2e', '#2ec4e0'];
    const yEnd = (ch - oy) / s + 60;
    for (let y = 582, row = 0; y < yEnd; y += 34, row++) {
      for (let x = -ox / s - 40 + (row % 2) * 24; x < (cw - ox) / s + 40; x += 50 + r() * 6) {
        const style = pick(['short', 'short', 'long', 'pony', 'bald', 'beanie', 'spiky']);
        crowd.push({ x: x + (r() - 0.5) * 8, y, rad: 17 + r() * 3 + row * 1.5, ph: r() * 6, arms: r() < 0.4,
          style, hair: dim(pick(HAIR), 0.55), shirt: dim(pick(SHIRT), 0.5), hat: dim(pick(SHIRT), 0.55), skin: dim('#f0b27a', 0.55) });
      }
    }
  }
  function drawPerson (g, q, y, lightCol, la, cheering) {
    const r = q.rad, x = q.x;
    g.lineWidth = 2.5; g.strokeStyle = INK; g.lineJoin = 'round';
    if (cheering && q.arms) {
      [-1, 1].forEach(sd => {
        g.strokeStyle = INK; g.lineWidth = r * 0.55; g.beginPath(); g.moveTo(x + sd * r * 0.9, y + r * 1.4); g.lineTo(x + sd * r * 1.3, y - r * 1.4); g.stroke();
        g.strokeStyle = q.shirt; g.lineWidth = r * 0.36; g.stroke();
        g.fillStyle = q.skin; g.beginPath(); g.arc(x + sd * r * 1.3, y - r * 1.5, r * 0.3, 0, Math.PI * 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
      });
    }
    // spalle
    g.fillStyle = q.shirt; g.strokeStyle = INK; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(x - r * 1.8, y + 200); g.lineTo(x - r * 1.8, y + r * 1.9); g.quadraticCurveTo(x - r * 1.7, y + r * 0.9, x, y + r * 0.9);
    g.quadraticCurveTo(x + r * 1.7, y + r * 0.9, x + r * 1.8, y + r * 1.9); g.lineTo(x + r * 1.8, y + 200); g.fill(); g.stroke();
    // orecchie e testa vista da dietro
    g.fillStyle = q.skin;
    [-1, 1].forEach(sd => { g.beginPath(); g.arc(x + sd * r * 0.95, y + r * 0.1, r * 0.25, 0, Math.PI * 2); g.fill(); g.stroke(); });
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
    if (q.style !== 'bald') {
      g.fillStyle = q.style === 'beanie' ? q.hat : q.hair;
      g.beginPath();
      if (q.style === 'beanie') { g.arc(x, y, r, Math.PI * 1.02, -0.02); g.lineTo(x + r, y + r * 0.1); g.lineTo(x - r, y + r * 0.1); }
      else if (q.style === 'spiky') { g.moveTo(x - r, y + r * 0.3); for (let i = 0; i <= 6; i++) { const a = Math.PI + (i / 6) * Math.PI; g.lineTo(x + Math.cos(a) * r * (i % 2 ? 1.35 : 0.95), y + Math.sin(a) * r * (i % 2 ? 1.35 : 0.95)); } g.lineTo(x + r, y + r * 0.3); }
      else g.arc(x, y, r * (q.style === 'long' ? 1.05 : 1), Math.PI * 0.85, Math.PI * 2.15);
      g.closePath(); g.fill(); g.stroke();
      if (q.style === 'long') { g.beginPath(); g.rect(x - r * 1.02, y, r * 2.04, r * 1.2); g.fill(); g.stroke(); }
      if (q.style === 'pony') { g.beginPath(); g.ellipse(x, y + r * 1.1, r * 0.3, r * 0.6, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
      if (q.style === 'beanie') { g.fillStyle = '#e8e2d0'; g.beginPath(); g.arc(x, y - r * 1.05, r * 0.3, 0, Math.PI * 2); g.fill(); g.stroke(); }
    }
    // bordo illuminato dal palco
    if (la > 0.02) { g.strokeStyle = rgba(lightCol, la); g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, r + 1, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
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
  // da punto del mondo a pixel del riquadro del palco
  const toStage = (x, y) => [ox + x * s, oy + y * s];
  const anchorW = (target, S) => target === 'spk-l' ? [SPK.l, 280] : target === 'spk-r' ? [SPK.r, 280] : [presX(S), FEET - PRES_H - 18];

  function draw (S, now) {
    if (!bg || !S) return;
    const g = ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.drawImage(bg, 0, 0);
    g.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const t = S.t, px = presX(S), d = S.dimmer;
    const cols = S.pars.map(c => rgb(COLORS[c]));
    const light = PARS.map((p, i) => ({ p, c: cols[i], a: d }));
    const fall = (x, w) => Math.exp(-(((px - x) / w) ** 2));

    // pozze di luce sul sipario e sul pavimento
    g.globalCompositeOperation = 'lighter';
    g.save(); g.beginPath(); g.rect(-2000, -2000, 5000, 2000 + WALL); g.clip();
    light.forEach(({ p, c, a }) => {
      if (p.kind !== 'front' || a < 0.01) return;
      const [x, y] = p.aim, gr = g.createRadialGradient(x, y, 0, x, y, p.r);
      gr.addColorStop(0, rgba(c, 0.34 * a)); gr.addColorStop(0.85, rgba(c, 0.26 * a)); gr.addColorStop(0.97, rgba(c, 0.22 * a)); gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, p.r, 0, Math.PI * 2); g.fill();
    });
    g.restore();
    light.forEach(({ p, c, a }) => {
      if (a < 0.01) return;
      const x = p.kind === 'front' ? p.aim[0] : HOME, rx = p.kind === 'front' ? 190 : 150;
      g.save(); g.translate(x, FEET); g.scale(1, 0.16);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, rgba(c, (p.kind === 'front' ? 0.34 : 0.2) * a)); gr.addColorStop(0.8, rgba(c, (p.kind === 'front' ? 0.2 : 0.1) * a)); gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
      g.restore();
    });

    // ombre del preside sul sipario, morbide, una per ogni frontale
    g.globalCompositeOperation = 'source-over';
    const sp = sprites, sw = sp.base.width / (s * dpr), sh = sp.base.height / (s * dpr);
    g.save(); g.beginPath(); g.rect(-2000, -2000, 5000, 2000 + WALL); g.clip();
    if ('filter' in g) g.filter = 'blur(' + (3 * s * dpr).toFixed(1) + 'px)';
    light.forEach(({ p, a }) => {
      if (p.kind !== 'front' || a < 0.01) return;
      const k = 1.1, sx = px + (px - p.lens[0]) * 0.2;
      g.globalAlpha = 0.3 * a * fall(p.aim[0], 260);
      g.drawImage(sp.shadow, sx - sw * k / 2, WALL + 30 - sh * k, sw * k, sh * k);
    });
    g.restore(); g.globalAlpha = 1;

    // i fasci: coni netti che passano dietro al preside
    g.globalCompositeOperation = 'lighter';
    light.forEach(({ p, c, a }) => {
      if (a < 0.01) return;
      const [lx, ly] = p.lens, [tx, ty] = p.kind === 'front' ? p.aim : p.end;
      const dx = tx - lx, dy = ty - ly, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
      const gr = g.createLinearGradient(lx, ly, tx, ty);
      gr.addColorStop(0, rgba(c, 0.3 * a)); gr.addColorStop(0.4, rgba(c, 0.14 * a)); gr.addColorStop(1, rgba(c, (p.kind === 'front' ? 0.06 : 0) * a));
      g.fillStyle = gr; g.beginPath();
      g.moveTo(lx + nx * 8, ly + ny * 8); g.lineTo(tx + nx * p.r, ty + ny * p.r); g.lineTo(tx - nx * p.r, ty - ny * p.r); g.lineTo(lx - nx * 8, ly - ny * 8);
      g.closePath(); g.fill();
      g.strokeStyle = rgba(c, 0.22 * a); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(lx + nx * 8, ly + ny * 8); g.lineTo(tx + nx * p.r, ty + ny * p.r);
      g.moveTo(lx - nx * 8, ly - ny * 8); g.lineTo(tx - nx * p.r, ty - ny * p.r); g.stroke();
    });

    // il preside, colorato dai fari che lo prendono
    g.globalCompositeOperation = 'source-over';
    const talk = S.running && !S.paused && t > 4 && t < 82 && !S.jingle;
    const bob = talk ? Math.abs(Math.sin(t * 4)) * 2 : 0;
    const X = px - sw / 2, Y = FEET - sh + 4 - bob;
    g.drawImage(sp.dark, X, Y, sw, sh);
    let lit = 0;
    light.forEach(({ p, a }, i) => {
      if (p.kind !== 'front' || a < 0.01) return;
      const al = Math.min(1, 0.75 * a * fall(p.aim[0], 190));
      lit += al;
      g.globalAlpha = al; g.drawImage(sp.litOf(S.pars[i]), X, Y, sw, sh);
    });
    g.globalCompositeOperation = 'lighter';
    light.forEach(({ p, a }, i) => {
      if (p.kind !== 'taglio' || a < 0.01) return;
      g.globalAlpha = Math.min(1, 0.7 * a * fall(HOME, 260));
      g.drawImage(sp.rimOf(S.pars[i], p.lens[0] < 500 ? 'l' : 'r'), X, Y, sw, sh);
    });
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // la bocca segue la voce: aperta a scatti, come nei cartoni
    const mx = X + (MOUTH[0] + 2) * PRES_K, my = Y + (MOUTH[1] + 2) * PRES_K;
    const open = talk && S.micOk ? Math.abs(Math.sin(t * 11) * Math.sin(t * 4.3)) : 0;
    g.strokeStyle = INK; g.lineWidth = 2.2;
    if (open > 0.15) {
      g.fillStyle = lit > 0.4 ? '#5a1d14' : '#2e120d';
      g.beginPath(); g.ellipse(mx, my, 9 * PRES_K, (3 + open * 9) * PRES_K, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    } else { g.beginPath(); g.moveTo(mx - 8 * PRES_K, my + 1); g.quadraticCurveTo(mx, my - 3, mx + 8 * PRES_K, my + 1); g.stroke(); }
    // giraffa e microfono appena sotto la bocca (la bocca resta in vista)
    g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(506, 380); g.lineTo(492, 366); g.stroke();
    g.strokeStyle = '#8a8d95'; g.lineWidth = 3; g.stroke();
    g.save(); g.translate(488, 362); g.rotate(0.7);
    g.fillStyle = '#2c2d33'; g.beginPath(); g.ellipse(0, 0, 4.5, 8, 0, 0, Math.PI * 2); g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
    g.fillStyle = '#9a9da5'; g.beginPath(); g.arc(0, -7, 5, 0, Math.PI * 2); g.fill(); g.stroke();
    g.restore();

    // pubblico di spalle: ondeggia se è contento, salta agli applausi
    const mix = [0, 1, 2].map(k => cols.reduce((sum, cc) => sum + cc[k], 0) / cols.length);
    const mood = S.grad / 100, moving = S.running && !S.paused && !reducedFx();
    const cheering = cheerAt != null ? Math.max(0, 1 - (now - cheerAt) / 6) : 0;
    crowd.forEach(q => {
      let y = q.y + (moving ? Math.sin(t * (2 + mood * 3) + q.ph) * mood * 3 : 0);
      if (cheering && !reducedFx()) y -= Math.abs(Math.sin(now * 7 + q.ph)) * 12 * cheering * (0.4 + mood);
      drawPerson(g, q, y, mix, 0.2 + 0.45 * d, cheering && mood >= 0.4);
    });

    // i frontali nel pit (visti da dietro, sopra le teste) e le lenti accese dei tagli
    light.forEach(({ p, c, a }) => {
      const [lx, ly] = p.lens;
      g.globalCompositeOperation = 'source-over';
      if (p.kind === 'front') {
        g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.moveTo(lx, ly + 14); g.lineTo(lx, ly + 90); g.stroke();
        g.strokeStyle = '#6a6d75'; g.lineWidth = 4; g.stroke();
        inked(g, rectP(lx - 18, ly - 14, 36, 28), dim('#2c2d33', 0.8), 3);
      }
      if (a < 0.01) return;
      g.globalCompositeOperation = 'lighter';
      const cx = p.kind === 'front' ? lx : lx + (lx < 500 ? 18 : -18), cy = p.kind === 'front' ? ly - 16 : ly;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 30);
      gr.addColorStop(0, rgba([255, 255, 255], 0.85 * a)); gr.addColorStop(0.3, rgba(c, 0.6 * a)); gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 30, 0, Math.PI * 2); g.fill();
    });
    g.globalCompositeOperation = 'source-over';

    // segnale su chi ha il problema (l'avviso vero sta in alto, dalla regia)
    const seen = new Set();
    S.events.forEach(e => {
      if (!e.live || seen.has(e.target)) return;
      seen.add(e.target);
      const [x, y] = anchorW(e.target, S), jump = Math.abs(Math.sin(now * 5)) * 6;
      inked(g, circP(x, y - jump, 13), '#f2c53d', 3);
      g.fillStyle = INK; g.font = '700 20px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('!', x, y - jump + 1);
    });

    // larsen: onde gialle dalla cassa più vicina al preside
    if (S.ring > 0.02) {
      const x = Math.abs(px - SPK.l) < Math.abs(px - SPK.r) ? SPK.l : SPK.r, dir = x < 500 ? 1 : -1;
      [22, 36, 50].forEach((rr, k) => {
        g.strokeStyle = rgba([242, 197, 61], S.ring * (1 - k * 0.25)); g.lineWidth = 5;
        g.beginPath(); g.arc(x + dir * 30, 350, rr, dir > 0 ? -0.9 : Math.PI - 0.9, dir > 0 ? 0.9 : Math.PI + 0.9); g.stroke();
      });
    }
    g.globalAlpha = 1;
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
    // dove sta, nel riquadro del palco, chi ha il problema
    anchor (target, S) { return toStage(...anchorW(target, S)); }
  };
})();

/* impianto di prova (?prova): montato, cablato, acceso e col microfono sul CH1 */
const PROVA_LEVEL = {"id":1,"placed":{"allaccio":{"id":"allaccio","type":"allaccio","gx":null,"gy":null,"screen":{"x":1159,"y":455},"zone":"ground"},"sub_1":{"id":"sub_1","type":"sub","gx":1.5,"gy":8.5,"foot":[1,1],"cells":["3,17"],"screen":{"x":496,"y":437.5},"zone":"ground","hasTop":"top_1","on":true},"sub_2":{"id":"sub_2","type":"sub","gx":7.5,"gy":8.5,"foot":[1,1],"cells":["15,17"],"screen":{"x":802,"y":647.5},"zone":"ground","hasTop":"top_2","on":true},"top_1":{"id":"top_1","type":"top","parentSubId":"sub_1","zone":"ground","screen":{"x":496,"y":372.5}},"top_2":{"id":"top_2","type":"top","parentSubId":"sub_2","zone":"ground","screen":{"x":802,"y":582.5}},"mixer_1":{"id":"mixer_1","type":"mixer","gx":7.5,"gy":5,"foot":[1,2],"cells":["15,10","15,11"],"screen":{"x":967.75,"y":533.75},"zone":"stage","on":true},"ampli_1":{"id":"ampli_1","type":"ampli","gx":6.5,"gy":4,"foot":[1,2],"cells":["13,8","13,9"],"screen":{"x":967.75,"y":463.75},"zone":"stage","on":true},"controller_1":{"id":"controller_1","type":"controller","gx":7.5,"gy":7.5,"foot":[1,1],"cells":["15,15"],"screen":{"x":853,"y":612.5},"zone":"stage","on":true},"stativo_1":{"id":"stativo_1","type":"stativo","gx":6.5,"gy":6.5,"foot":[1,1],"cells":["13,13"],"screen":{"x":853,"y":542.5},"zone":"stage","hasPar":"par_4"},"stativo_2":{"id":"stativo_2","type":"stativo","gx":2.5,"gy":9.5,"foot":[1,1],"cells":["5,19"],"screen":{"x":496,"y":507.5},"zone":"ground","hasPar":"par_3"},"stativo_3":{"id":"stativo_3","type":"stativo","gx":0.5,"gy":6.5,"foot":[1,1],"cells":["1,13"],"screen":{"x":547,"y":332.5},"zone":"ground","hasPar":"par_1"},"stativo_4":{"id":"stativo_4","type":"stativo","gx":9.5,"gy":9.5,"foot":[1,1],"cells":["19,19"],"screen":{"x":853,"y":752.5},"zone":"ground","hasPar":"par_2"},"par_1":{"id":"par_1","type":"par","parentStandId":"stativo_3","zone":"ground","screen":{"x":547,"y":249},"dmx":{"addr":81,"mode":2}},"par_2":{"id":"par_2","type":"par","parentStandId":"stativo_4","zone":"ground","screen":{"x":853,"y":669},"dmx":{"addr":81,"mode":2}},"par_3":{"id":"par_3","type":"par","parentStandId":"stativo_2","zone":"ground","screen":{"x":496,"y":424},"dmx":{"addr":81,"mode":2}},"par_4":{"id":"par_4","type":"par","parentStandId":"stativo_1","zone":"stage","screen":{"x":853,"y":459},"dmx":{"addr":81,"mode":2}},"asta_1":{"id":"asta_1","type":"asta","gx":4.5,"gy":6.5,"foot":[1,1],"cells":["9,13"],"screen":{"x":751,"y":472.5},"zone":"stage","hasMic":"mic_1"},"mic_1":{"id":"mic_1","type":"mic","parentAstaId":"asta_1","zone":"stage","screen":{"x":758,"y":409.082}},"quadro_1":{"id":"quadro_1","type":"quadro","gx":4.5,"gy":2,"foot":[1,2],"cells":["9,4","9,5"],"screen":{"x":967.75,"y":323.75},"zone":"ground","prot":{"main":true,"rcd":true,"L1":true,"L2":true,"L3":true,"tripped":{}}},"ciabatta_cee_1":{"id":"ciabatta_cee_1","type":"ciabatta_cee","gx":6.5,"gy":2,"foot":[1,3],"cells":["13,4","13,5","13,6"],"screen":{"x":1057,"y":402.5},"zone":"ground","on":true},"ciabatta_1":{"id":"ciabatta_1","type":"ciabatta","gx":3.5,"gy":14,"foot":[1,2],"cells":["7,28","7,29"],"screen":{"x":304.75,"y":708.75},"zone":"ground"},"pc_1":{"id":"pc_1","type":"pc","gx":4.5,"gy":14,"foot":[1,1],"cells":["9,28"],"screen":{"x":368.5,"y":735},"zone":"ground","on":true},"scheda_1":{"id":"scheda_1","type":"scheda","gx":5.5,"gy":14,"foot":[1,1],"cells":["11,28"],"screen":{"x":419.5,"y":770},"zone":"ground"}},"edges":[{"id":0,"a":"allaccio","aPort":"out","b":"quadro_1","bPort":"in","signal":"cee_tri"},{"id":1,"a":"quadro_1","aPort":"out_1","b":"ciabatta_cee_1","bPort":"in","signal":"cee_mono"},{"id":2,"a":"ciabatta_cee_1","aPort":"out_1","b":"pc_1","bPort":"power","signal":"schuko"},{"id":3,"a":"quadro_1","aPort":"out_1","b":"mixer_1","bPort":"power","signal":"cee_powercon"},{"id":4,"a":"ciabatta_cee_1","aPort":"out_4","b":"controller_1","bPort":"power","signal":"schuko_powercon"},{"id":5,"a":"quadro_1","aPort":"out_3","b":"ampli_1","bPort":"power","signal":"cee_powercon"},{"id":6,"a":"ciabatta_cee_1","aPort":"out_3","b":"sub_1","bPort":"power","signal":"schuko_powercon"},{"id":7,"a":"ciabatta_cee_1","aPort":"out_2","b":"sub_2","bPort":"power","signal":"schuko_powercon"},{"id":8,"a":"quadro_1","aPort":"out_3","b":"par_1","bPort":"power_in","signal":"cee_powercon"},{"id":9,"a":"par_1","aPort":"power_thru","b":"par_2","bPort":"power_in","signal":"powercon"},{"id":10,"a":"quadro_1","aPort":"out_2","b":"par_3","bPort":"power_in","signal":"cee_powercon"},{"id":11,"a":"quadro_1","aPort":"out_2","b":"par_4","bPort":"power_in","signal":"cee_powercon"},{"id":12,"a":"pc_1","aPort":"usb","b":"scheda_1","bPort":"usb","signal":"usbc"},{"id":13,"a":"scheda_1","aPort":"out_L","b":"mixer_1","bPort":"in_5","signal":"jack"},{"id":14,"a":"scheda_1","aPort":"out_R","b":"mixer_1","bPort":"in_6","signal":"jack"},{"id":15,"a":"mixer_1","aPort":"main_L","b":"ampli_1","bPort":"in_L","signal":"xlr"},{"id":16,"a":"mixer_1","aPort":"main_R","b":"ampli_1","bPort":"in_R","signal":"xlr"},{"id":17,"a":"ampli_1","aPort":"out_L","b":"sub_1","bPort":"spk_in","signal":"speakon"},{"id":18,"a":"ampli_1","aPort":"out_R","b":"sub_2","bPort":"spk_in","signal":"speakon"},{"id":19,"a":"sub_1","aPort":"spk_thru","b":"top_1","bPort":"spk_in","signal":"speakon"},{"id":20,"a":"sub_2","aPort":"spk_thru","b":"top_2","bPort":"spk_in","signal":"speakon"},{"id":21,"a":"mic_1","aPort":"out","b":"mixer_1","bPort":"in_1","signal":"xlr"},{"id":22,"a":"controller_1","aPort":"dmx_2","b":"par_2","bPort":"dmx_in","signal":"dmx"},{"id":23,"a":"par_2","aPort":"dmx_thru","b":"par_1","bPort":"dmx_in","signal":"dmx"},{"id":24,"a":"par_1","aPort":"dmx_thru","b":"par_4","bPort":"dmx_in","signal":"dmx"},{"id":25,"a":"par_4","aPort":"dmx_thru","b":"par_3","bPort":"dmx_in","signal":"dmx"}],"stock":{"sub":0,"top":0,"mixer":0,"asta":0,"mic":0,"stativo":0,"par":0,"controller":0,"ampli":0,"quadro":0,"ciabatta":0,"ciabatta_cee":0,"pc":0,"scheda":0,"di":0},"nextIndex":{"sub":3,"top":3,"mixer":2,"asta":2,"mic":2,"stativo":5,"par":5,"controller":2,"ampli":2,"quadro":2,"ciabatta":2,"ciabatta_cee":2,"pc":2,"scheda":2,"di":1},"edgeSeq":26,"trips":0,"rcdTrips":0,"procErrors":[],"stats":{"playMs":0,"tests":0,"failedTests":0}};
if (window.SCS_PROVA || /[?&#]prova\b/.test(location.search + location.hash)) Show.prova();
