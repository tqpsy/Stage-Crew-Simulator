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
    if (S && S.running && !S.paused && !manual && !menuOpen) step(dt);
    View.draw(S, now / 1000);   // il disegno va a tempo di schermo, non a ogni passo del gioco
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
   Vista dello spettacolo: il palco come lo vede il fonico dalla regia,
   disegnato in un canvas. Illustrazione vettoriale con ombre a due toni e
   linee sottili; l'attrezzatura è quella vera del livello (satelliti su
   palo sopra i sub, PAR LED su stativo con staffa, asta a giraffa col suo
   XLR fissato col gaffer). I PAR sono fari fissi (due tagli ai lati, due
   frontali dal pit): fasci fermi, netti e simmetrici nella foschia, che
   cambiano solo colore e intensità.
   --------------------------------------------------------------------- */
const View = (() => {
  const W = 1000, VIS_W = 800, VIS = [40, 600];   // mondo; parte che deve restare in vista
  const HOME = 500, FEET = 446, WALL = 360;       // il preside all'asta; piede del sipario
  const SPK = { l: 100, r: 900 };                  // casse (x) ai lati, davanti al palco
  const WALK = { l: 300, r: 700 };                // fin dove arriva il preside verso una cassa
  const CH_H = 250, CH_W = 150, CH_K = 200 / 240; // disegno del preside (unità) e scala nel mondo
  const PARS = [
    { kind: 'taglio', lens: [214, 300], end: [860, 356], r: 92 },
    { kind: 'front', lens: [340, 528], aim: [540, 292], r: 150 },
    { kind: 'front', lens: [660, 528], aim: [460, 292], r: 150 },
    { kind: 'taglio', lens: [786, 300], end: [140, 356], r: 92 }
  ];
  const COLORS = { bianco: '#f4f1ea', rosso: '#e0503f', blu: '#3f7fe0', verde: '#49b06a', ambra: '#f2a541', viola: '#b36bff' };
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  const LINE = 'rgba(14,10,20,0.85)';

  const cv = document.getElementById('show-canvas');
  const ctx = cv.getContext('2d');
  let cw = 0, ch = 0, dpr = 1, s = 1, ox = 0, oy = 0;
  let bg = null, crowd = [], cheerAt = null, haze = null, beamLayer = null, chr = null, dmxAddr = [];
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

  // forme: poligono, ellisse, con o senza contorno
  function poly (g, pts, fill, line) {
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (line) { g.strokeStyle = line; g.stroke(); }
  }
  function ell (g, x, y, rx, ry, fill, line, rot = 0) {
    g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); } if (line) { g.strokeStyle = line; g.stroke(); }
  }
  function path (g, d, fill, line) { const p = new Path2D(d); if (fill) { g.fillStyle = fill; g.fill(p); } if (line) { g.strokeStyle = line; g.stroke(p); } }

  /* ---------- il preside: caricatura con ombre a due toni. Piedi in (0,0),
     y verso l'alto negativo; pose = quanto gesticola (0..1) ---------- */
  function drawTramp (g, pose, mouth, blink) {
    g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = 1.4;
    const NAVY = '#26375f', NAVY_D = '#18233f', NAVY_L = '#34497a';
    const SKIN = '#ee9c5a', SKIN_D = '#d27d3e', PALE = '#f7d2a4';
    // gambe e scarpe
    poly(g, [-24, -92, -4, -92, -6, -10, -24, -10], NAVY_D, LINE);
    poly(g, [4, -92, 24, -92, 24, -10, 6, -10], NAVY, LINE);
    path(g, 'M-30 -2 Q-30 -12 -20 -12 L-5 -12 L-5 0 L-28 0 Z', '#16161a', LINE);
    path(g, 'M30 -2 Q30 -12 20 -12 L5 -12 L5 0 L28 0 Z', '#16161a', LINE);
    ell(g, -18, -8, 6, 1.6, 'rgba(255,255,255,0.25)');
    ell(g, 18, -8, 6, 1.6, 'rgba(255,255,255,0.25)');
    // braccio sinistro (a riposo) dietro la giacca
    arm(g, -40, -146, 0.12 + pose * 0.04, 0.05, NAVY_D, SKIN);
    // giacca larga e lunga
    path(g, 'M-42 -150 Q-48 -118 -40 -80 L40 -80 Q48 -118 42 -150 Q0 -160 -42 -150 Z', NAVY, LINE);
    path(g, 'M-42 -150 Q-48 -118 -40 -80 L-26 -80 Q-34 -118 -30 -148 Z', NAVY_D);
    path(g, 'M18 -150 Q36 -118 30 -80 L40 -80 Q48 -118 42 -150 Z', NAVY_L);
    // camicia, revers e cravatta rossa lunghissima
    poly(g, [-13, -152, 13, -152, 0, -116], '#f4f1ea', LINE);
    poly(g, [-13, -152, -24, -148, -8, -104, -3, -118], NAVY_L, LINE);
    poly(g, [13, -152, 24, -148, 8, -104, 3, -118], NAVY_L, LINE);
    poly(g, [-6, -150, 6, -150, 4, -141, -4, -141], '#b51c24', LINE);
    poly(g, [-4, -141, 4, -141, 9, -62, 0, -54, -9, -62], '#d4262f', LINE);
    poly(g, [0, -141, 4, -141, 9, -62, 0, -54], '#b51c24');
    ell(g, 0, -100, 1.6, 1.6, '#e8c56a');
    // collo e testa, con i doppi menti
    ell(g, 0, -160, 18, 10, SKIN_D);
    ell(g, 0, -186, 30, 37, SKIN, LINE);
    path(g, 'M-28 -176 Q-30 -150 0 -150 Q30 -150 28 -176 Q20 -160 0 -160 Q-20 -160 -28 -176 Z', SKIN, LINE);
    path(g, 'M-30 -190 Q-32 -160 -10 -152 Q-26 -164 -24 -190 Z', SKIN_D);
    ell(g, -31, -184, 5, 8, SKIN, LINE); ell(g, 31, -184, 5, 8, SKIN_D, LINE);
    // il contorno occhi chiaro (gli occhialini da lampada) e gli occhi stretti
    ell(g, -12, -190, 10, 6.5, PALE); ell(g, 12, -190, 10, 6.5, PALE);
    if (blink) { g.strokeStyle = '#2a1a12'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-17, -190); g.lineTo(-7, -190); g.moveTo(7, -190); g.lineTo(17, -190); g.stroke(); g.lineWidth = 1.4; }
    else { ell(g, -12, -190, 5.2, 2.6, '#fff', LINE); ell(g, 12, -190, 5.2, 2.6, '#fff', LINE); ell(g, -11, -190, 1.7, 1.9, '#3a5a8a'); ell(g, 13, -190, 1.7, 1.9, '#3a5a8a'); }
    // sopracciglia chiare, alzate
    path(g, 'M-22 -199 Q-13 -204 -4 -199 Q-13 -201 -22 -197 Z', '#e7c46a', LINE);
    path(g, 'M22 -199 Q13 -204 4 -199 Q13 -201 22 -197 Z', '#e7c46a', LINE);
    // naso e guance
    path(g, 'M-3 -186 Q-6 -176 -5 -173 Q0 -170 5 -173 Q6 -176 3 -186', SKIN_D);
    ell(g, -18, -174, 6, 3.5, 'rgba(224,90,70,0.25)'); ell(g, 18, -174, 6, 3.5, 'rgba(224,90,70,0.25)');
    // bocca: la "O" quando parla, stretta quando tace
    if (mouth > 0.12) { ell(g, 0, -164, 5 + mouth * 2, 2.5 + mouth * 4.5, '#5a1f1a', '#b6644e'); }
    else { g.strokeStyle = '#a0503e'; g.lineWidth = 2; g.beginPath(); g.moveTo(-6, -164); g.quadraticCurveTo(0, -166, 6, -164); g.stroke(); g.lineWidth = 1.4; }
    // il ciuffo: onda bionda pettinata in avanti, con riflessi
    path(g, 'M-31 -190 Q-36 -214 -22 -226 Q-2 -240 22 -232 Q42 -226 46 -208 Q40 -214 32 -212 Q36 -204 30 -198 Q24 -212 8 -214 Q-14 -216 -24 -204 Q-28 -198 -31 -190 Z', '#f0c94f', LINE);
    path(g, 'M-20 -222 Q0 -236 24 -228 Q6 -230 -10 -220 Z', '#fbe7a0');
    path(g, 'M30 -198 Q36 -206 32 -212 Q40 -214 46 -208 Q42 -202 30 -198 Z', '#d9a93a');
    // braccio destro: gesticola col famoso gesto a pinza
    arm(g, 40, -146, 0.14 + pose * 0.3, 0.1 + pose * 2.4, NAVY, SKIN, pose > 0.4);
  }
  // braccio con manica e mano. u: apertura del braccio dal fianco; v: il
  // avambraccio (0 = giù, verso π = su verso il petto). side: +1 destro, -1 sinistro
  function arm (g, x, y, u, v, cloth, skin, pinch) {
    const side = x < 0 ? -1 : 1, L1 = 40, L2 = 36;
    const ex = x + side * Math.sin(u) * L1, ey = y + Math.cos(u) * L1;
    const hx = ex - side * Math.sin(v) * L2, hy = ey + Math.cos(v) * L2;
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = LINE; g.lineWidth = 17; g.beginPath(); g.moveTo(x, y + 4); g.lineTo(ex, ey); g.lineTo(hx, hy); g.stroke();
    g.strokeStyle = cloth; g.lineWidth = 14.2; g.stroke();
    g.lineWidth = 1.4;
    ell(g, hx, hy, 6.5, 4.5, '#f4f1ea', LINE);             // polsino
    ell(g, hx - side * 1.5, hy + (v > 1.5 ? -5 : 5), 5.5, 6, skin, LINE);   // mano piccola
    if (pinch) { g.strokeStyle = '#b86a38'; g.lineWidth = 1.3; g.beginPath(); g.arc(hx - side * 1.5, hy - 5, 2.6, 0, Math.PI * 2); g.stroke(); }
    g.lineWidth = 1.4;
  }

  /* ---------- fondo fisso ---------- */
  function buildBg () {
    const c = mk(cw * dpr, ch * dpr), g = c.getContext('2d');
    g.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);
    const x0 = -ox / s - 10, x1 = (cw - ox) / s + 10, y0 = -oy / s - 10, y1 = (ch - oy) / s + 10;
    g.lineJoin = 'round'; g.lineCap = 'round';
    // sipario di velluto: ogni piega è un cilindro, scuro ai lati e chiaro al centro
    const F = 34;
    for (let x = Math.floor(x0 / F) * F; x < x1; x += F) {
      const gr = g.createLinearGradient(x, 0, x + F, 0);
      gr.addColorStop(0, '#16050a'); gr.addColorStop(0.35, '#4a0d17'); gr.addColorStop(0.55, '#5c121d'); gr.addColorStop(1, '#1a060b');
      g.fillStyle = gr; g.fillRect(x, y0, F + 0.5, WALL - y0);
    }
    const foot = g.createLinearGradient(0, WALL - 90, 0, WALL);
    foot.addColorStop(0, 'rgba(0,0,0,0)'); foot.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = foot; g.fillRect(x0, WALL - 90, x1 - x0, 90);
    // mantovana a pieghe con la frangia dorata
    for (let x = Math.floor(x0 / 24) * 24; x < x1; x += 24) {
      const gr = g.createLinearGradient(x, 0, x + 24, 0);
      gr.addColorStop(0, '#2a070d'); gr.addColorStop(0.5, '#6a1622'); gr.addColorStop(1, '#2a070d');
      g.fillStyle = gr; g.fillRect(x, y0, 24.5, 30 - y0);
    }
    g.fillStyle = '#8a6a2a'; g.fillRect(x0, 30, x1 - x0, 4);
    g.strokeStyle = '#6a5020'; g.lineWidth = 1.2;
    for (let x = x0; x < x1; x += 4) { g.beginPath(); g.moveTo(x, 34); g.lineTo(x + 1, 42); g.stroke(); }
    // tubo con il banner in PVC, occhielli e fascette
    g.fillStyle = '#2a2b30'; g.fillRect(300, 94, 400, 5);
    g.fillStyle = '#18191c'; [300, 700].forEach(x => g.fillRect(x - 1, y0, 2, 96));
    const bx = 318, by = 104, bw = 364, bh = 74;
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(bx + 4, by + 5, bw, bh);
    const bgr = g.createLinearGradient(0, by, 0, by + bh);
    bgr.addColorStop(0, '#f1efe9'); bgr.addColorStop(1, '#d9d6cd');
    g.fillStyle = bgr; g.fillRect(bx, by, bw, bh);
    g.fillStyle = '#1e3a78'; g.fillRect(bx, by + bh - 16, bw, 16);
    g.fillStyle = '#e0503f'; g.fillRect(bx, by + bh - 19, bw, 3);
    g.fillStyle = '#1e3a78'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = 48;
    do { g.font = '700 ' + fs + 'px "Barlow Condensed", "Arial Narrow", sans-serif'; fs -= 2; } while (fs > 14 && g.measureText('FESTA DELLA SCUOLA').width > bw - 40);
    g.fillText('FESTA DELLA SCUOLA', 500, by + 28);
    g.fillStyle = '#eee9df'; g.font = '600 10px "Inter", sans-serif'; g.fillText('ANNO SCOLASTICO 2026 / 2027', 500, by + bh - 8);
    [[bx + 8, by + 7], [bx + bw - 8, by + 7], [bx + bw / 2, by + 7]].forEach(([x, y]) => {
      ell(g, x, y, 3, 3, '#b9b6ad', '#6a6860'); g.fillStyle = '#111'; g.fillRect(x - 1, y - 11, 2, 9);
    });
    // pedana: pavimento nero lucido da palcoscenico
    const fl = g.createLinearGradient(0, WALL, 0, 470);
    fl.addColorStop(0, '#0d0e12'); fl.addColorStop(1, '#1b1d23');
    g.fillStyle = fl; poly(g, [230, WALL, 770, WALL, 870, 470, 130, 470], fl);
    g.strokeStyle = 'rgba(255,255,255,0.03)'; g.lineWidth = 1;
    for (let i = 1; i < 8; i++) { const t = i / 8; g.beginPath(); g.moveTo(230 + 540 * t, WALL); g.lineTo(130 + 740 * t, 470); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(130, 470); g.lineTo(870, 470); g.stroke();
    // gonna di molleton sul fronte del palco
    for (let x = 130; x < 870; x += 14) {
      const gr = g.createLinearGradient(x, 0, x + 14, 0);
      gr.addColorStop(0, '#07070a'); gr.addColorStop(0.5, '#15161b'); gr.addColorStop(1, '#07070a');
      g.fillStyle = gr; g.fillRect(x, 471, 14.5, 36);
    }
    g.fillStyle = '#050507'; g.fillRect(x0, 507, x1 - x0, y1 - 507);
    // croce di nastro fosforescente dove va l'asta
    g.strokeStyle = 'rgba(190,255,120,0.55)'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(496, 462); g.lineTo(516, 462); g.moveTo(506, 458); g.lineTo(506, 466); g.stroke();
    // cavo del microfono: scende dall'asta e va verso il pit, fissato col gaffer
    g.strokeStyle = '#0a0a0c'; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(506, 460); g.quadraticCurveTo(560, 468, 610, 464); g.quadraticCurveTo(690, 460, 720, 470); g.stroke();
    g.fillStyle = '#5a5c62'; [[560, 466, -0.05], [640, 462, 0.02], [716, 468, 0.25]].forEach(([x, y, r]) => { g.save(); g.translate(x, y); g.rotate(r); g.fillRect(-8, -3, 16, 6); g.restore(); });
    // stativi dei tagli: treppiede, asta, staffa; cavo di corrente che scende
    [214, 786].forEach(x => {
      const dir = x < 500 ? 1 : -1;
      g.strokeStyle = '#0c0c0f'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x - 6 * dir, 310); g.quadraticCurveTo(x - 10 * dir, 390, x - 4 * dir, 452); g.stroke();
      g.strokeStyle = '#2a2c31'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, 452); g.lineTo(x, 312); g.stroke();
      g.strokeStyle = '#3c3f46'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 1, 452); g.lineTo(x - 1, 312); g.stroke();
      g.strokeStyle = '#2a2c31'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, 440); g.lineTo(x - 26, 468); g.moveTo(x, 440); g.lineTo(x + 26, 468); g.moveTo(x, 440); g.lineTo(x + 4, 472); g.stroke();
      ell(g, x, 400, 3.5, 2.5, '#4a4d55');                    // pomello di serraggio
    });
    // casse: sub a terra con griglia, palo da 35 e satellite con griglia forata
    const grille = (x, y, w, h) => {
      g.fillStyle = '#16171b'; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (let yy = y + 3; yy < y + h - 2; yy += 4) for (let xx = x + 3 + (yy % 8 ? 2 : 0); xx < x + w - 2; xx += 4) g.fillRect(xx, yy, 1.3, 1.3);
    };
    [SPK.l, SPK.r].forEach(x => {
      g.fillStyle = '#26272c'; g.fillRect(x - 44, 466, 88, 96); grille(x - 38, 472, 76, 84);
      g.strokeStyle = '#3a3c42'; g.lineWidth = 1.2; g.strokeRect(x - 44, 466, 88, 96);
      g.fillStyle = '#1b1c20'; g.fillRect(x - 4, 398, 8, 70);
      g.fillStyle = '#3a3c42'; g.fillRect(x - 3, 398, 2, 70);
      g.fillStyle = '#26272c'; g.fillRect(x - 33, 298, 66, 102);
      grille(x - 28, 303, 56, 92);
      g.strokeStyle = '#3a3c42'; g.strokeRect(x - 33, 298, 66, 102);
      g.fillStyle = '#9a9da5'; g.fillRect(x - 8, 388, 16, 4);   // targhetta del marchio
      g.strokeStyle = '#0c0c0f'; g.lineWidth = 1.6;             // Speakon che scende lungo il palo
      g.beginPath(); g.moveTo(x + 10, 400); g.quadraticCurveTo(x + 14, 440, x + 8, 466); g.stroke();
    });
    // asta a giraffa: base tonda pesante e tubo
    ell(g, 506, 462, 16, 3.5, '#17181c', '#2e3036');
    g.strokeStyle = '#1e1f24'; g.lineWidth = 4; g.beginPath(); g.moveTo(506, 462); g.lineTo(506, 372); g.stroke();
    g.strokeStyle = '#3a3c43'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(505, 462); g.lineTo(505, 372); g.stroke();
    // velo di sera
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = 'rgba(4,6,16,0.35)'; g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // foschia: macchie morbide che si muovono piano dentro i fasci
  function buildHaze () {
    const c = mk(512, 512), g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,1)'; g.fillRect(0, 0, 512, 512);
    let seed = 5; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 70; i++) {
      const x = r() * 512, y = r() * 512, rad = 40 + r() * 110, a = 0.25 + r() * 0.35;
      [0, 512].forEach(dx => [0, 512].forEach(dy => {
        const gr = g.createRadialGradient(x - dx, y - dy, 0, x - dx, y - dy, rad);
        gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
      }));
    }
    return c;
  }

  // pubblico in controluce: sagome scure, qualche telefono che riprende
  function buildCrowd () {
    crowd = [];
    let seed = 11;
    const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const yEnd = (ch - oy) / s + 60;
    for (let y = 546, row = 0; y < yEnd; y += 30, row++) {
      for (let x = -ox / s - 40 + (row % 2) * 22; x < (cw - ox) / s + 40; x += 46 + r() * 8) {
        crowd.push({ x: x + (r() - 0.5) * 10, y: y + (r() - 0.5) * 6, rad: 15 + r() * 3 + row * 1.6, ph: r() * 6,
          hair: ['short', 'short', 'long', 'bun', 'cap', 'bald', 'curly'][Math.floor(r() * 7)], phone: row < 3 && r() < 0.07, arms: r() < 0.35, tilt: (r() - 0.5) * 0.2 });
      }
    }
  }
  function drawPerson (g, q, y, rim, rimA, cheering, now) {
    const r = q.rad, x = q.x;
    g.fillStyle = '#060609';
    if (cheering && q.arms) {
      g.strokeStyle = '#060609'; g.lineWidth = r * 0.5;
      g.beginPath(); g.moveTo(x - r * 1.1, y + r * 1.4); g.lineTo(x - r * 1.4, y - r * 1.5); g.moveTo(x + r * 1.1, y + r * 1.4); g.lineTo(x + r * 1.4, y - r * 1.5); g.stroke();
    }
    // spalle e collo
    g.beginPath(); g.moveTo(x - r * 2, y + 220); g.lineTo(x - r * 2, y + r * 2.1);
    g.quadraticCurveTo(x - r * 1.9, y + r * 1.05, x - r * 0.4, y + r * 0.95); g.lineTo(x + r * 0.4, y + r * 0.95);
    g.quadraticCurveTo(x + r * 1.9, y + r * 1.05, x + r * 2, y + r * 2.1); g.lineTo(x + r * 2, y + 220); g.fill();
    g.save(); g.translate(x, y); g.rotate(q.tilt);
    ell(g, 0, 0, r * 0.9, r, '#060609');
    ell(g, -r * 0.88, r * 0.1, r * 0.2, r * 0.3, '#060609'); ell(g, r * 0.88, r * 0.1, r * 0.2, r * 0.3, '#060609');
    if (q.hair === 'long') { g.fillRect(-r * 0.95, 0, r * 1.9, r * 1.3); }
    if (q.hair === 'bun') ell(g, 0, -r * 1.05, r * 0.4, r * 0.35, '#060609');
    if (q.hair === 'cap') { ell(g, 0, -r * 0.3, r * 0.95, r * 0.75, '#060609'); g.fillRect(-r * 0.2, -r * 1.02, r * 0.4, r * 0.2); }
    if (q.hair === 'curly') for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6) * Math.PI; ell(g, Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.9, r * 0.32, r * 0.32, '#060609'); }
    g.restore();
    // il bordo acceso dalla luce del palco
    if (rimA > 0.02) {
      g.strokeStyle = rgba(rim, rimA); g.lineWidth = 1.6;
      g.beginPath(); g.ellipse(x, y, r * 0.9, r, q.tilt, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
      g.strokeStyle = rgba(rim, rimA * 0.5);
      g.beginPath(); g.moveTo(x - r * 1.9, y + r * 1.6); g.quadraticCurveTo(x - r * 1.7, y + r * 1.02, x - r * 0.5, y + r * 0.96); g.stroke();
      g.beginPath(); g.moveTo(x + r * 1.9, y + r * 1.6); g.quadraticCurveTo(x + r * 1.7, y + r * 1.02, x + r * 0.5, y + r * 0.96); g.stroke();
    }
    // chi riprende col telefono
    if (q.phone) {
      const px = x + r * 0.8, py = y - r * 1.5 + Math.sin(now * 0.7 + q.ph) * 2;
      g.strokeStyle = '#060609'; g.lineWidth = r * 0.45; g.beginPath(); g.moveTo(x + r * 1.2, y + r * 1.5); g.lineTo(px, py + 8); g.stroke();
      g.fillStyle = '#0b0b0e'; g.fillRect(px - 7, py - 11, 14, 22);
      g.fillStyle = 'rgba(170,200,255,0.85)'; g.fillRect(px - 5.5, py - 9.5, 11, 19);
      g.fillStyle = 'rgba(255,90,70,0.9)'; g.beginPath(); g.arc(px - 2.5, py - 6.5, 1.2, 0, Math.PI * 2); g.fill();
    }
  }

  function fit () {
    const box = cv.parentElement.getBoundingClientRect();
    cw = Math.max(1, box.width); ch = Math.max(1, box.height); dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    // sul telefono si stringe sul palco: le casse restano a metà sul bordo
    s = Math.min(cw / (cw < 500 ? 680 : VIS_W), ch / (VIS[1] - VIS[0]));
    ox = cw / 2 - (W / 2) * s; oy = ch / 2 - ((VIS[0] + VIS[1]) / 2) * s;
    bg = buildBg(); buildCrowd();
    if (!haze) haze = buildHaze();
    beamLayer = mk(cv.width, cv.height);
    const k = CH_K * s * dpr;
    chr = { k, base: mk(CH_W * k, CH_H * k), tint: mk(CH_W * k, CH_H * k), out: mk(CH_W * k, CH_H * k) };
    // indirizzi DMX veri dei due frontali, per il display sul retro
    const pars = placedOfType('par').map(p => ({ p, st: mountBase(p) })).filter(o => o.st && standRole(o.st) === 'front').sort((a, b) => a.st.gx - b.st.gx);
    dmxAddr = pars.map(o => 'A' + String(parDmx(o.p).addr).padStart(3, '0'));
  }

  const presX = S => { const t = S.side ? WALK[S.side] : HOME; return HOME + (t - HOME) * S.walk; };
  const toStage = (x, y) => [ox + x * s, oy + y * s];
  // dove segnalare chi ha il problema; le casse, se sono fuori quadro, sul bordo
  const edge = x => Math.max(-ox / s + 24, Math.min((cw - ox) / s - 24, x));
  const anchorW = (target, S) => target === 'spk-l' ? [edge(SPK.l), 282] : target === 'spk-r' ? [edge(SPK.r), 282] : [presX(S), FEET - 214];

  // il preside illuminato: base, poi il colore di ogni faro che lo prende
  function renderCharacter (S, t, lights, px) {
    const { k, base, tint, out } = chr, talk = S.running && !S.paused && t > 4 && t < 82 && !S.jingle;
    const bg0 = base.getContext('2d'), tg = tint.getContext('2d'), og = out.getContext('2d');
    const pose = talk ? 0.5 + 0.5 * Math.sin(t * 2.3) * Math.sin(t * 0.9 + 1) : 0;
    const mouth = talk && S.micOk ? Math.abs(Math.sin(t * 11) * Math.sin(t * 4.3)) : 0;
    const blink = (t % 3.7) < 0.12;
    bg0.setTransform(1, 0, 0, 1, 0, 0); bg0.clearRect(0, 0, base.width, base.height);
    bg0.setTransform(k, 0, 0, k, (CH_W / 2) * k, (CH_H - 4) * k);
    drawTramp(bg0, pose, mouth, blink);
    og.globalCompositeOperation = 'source-over'; og.globalAlpha = 1;
    og.clearRect(0, 0, out.width, out.height);
    og.drawImage(base, 0, 0);
    og.globalCompositeOperation = 'source-atop'; og.fillStyle = 'rgba(8,10,28,0.62)'; og.fillRect(0, 0, out.width, out.height);
    lights.forEach(L => {
      if (L.amount < 0.01) return;
      tg.globalCompositeOperation = 'source-over'; tg.globalAlpha = 1;
      tg.clearRect(0, 0, tint.width, tint.height); tg.drawImage(base, 0, 0);
      tg.globalCompositeOperation = 'multiply'; tg.fillStyle = L.hex; tg.fillRect(0, 0, tint.width, tint.height);
      tg.globalCompositeOperation = 'destination-in'; tg.drawImage(base, 0, 0);
      if (L.side) {   // taglio: solo il bordo dalla parte del faro
        const gr = tg.createLinearGradient(L.side === 'l' ? 0 : tint.width, 0, tint.width / 2, 0);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        tg.fillStyle = gr; tg.fillRect(0, 0, tint.width, tint.height);
      }
      og.globalCompositeOperation = L.side ? 'lighter' : 'source-atop'; og.globalAlpha = Math.min(1, L.amount);
      og.drawImage(tint, 0, 0);
    });
    og.globalAlpha = 1; og.globalCompositeOperation = 'source-over';
    return out;
  }

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
    const light = PARS.map((p, i) => ({ p, c: cols[i], a: d, hex: COLORS[S.pars[i]] }));
    const fall = (x, w) => Math.exp(-(((px - x) / w) ** 2));

    // pozze di luce: cerchi netti sul sipario, ellissi sul pavimento lucido
    g.globalCompositeOperation = 'lighter';
    g.save(); g.beginPath(); g.rect(-2000, -2000, 5000, 2000 + WALL); g.clip();
    light.forEach(({ p, c, a }) => {
      if (p.kind !== 'front' || a < 0.01) return;
      const [x, y] = p.aim, gr = g.createRadialGradient(x, y, 0, x, y, p.r);
      gr.addColorStop(0, rgba(c, 0.3 * a)); gr.addColorStop(0.8, rgba(c, 0.24 * a)); gr.addColorStop(0.95, rgba(c, 0.2 * a)); gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, p.r, 0, Math.PI * 2); g.fill();
    });
    g.restore();
    light.forEach(({ p, c, a }) => {
      if (a < 0.01) return;
      const x = p.kind === 'front' ? p.aim[0] : HOME, rx = p.kind === 'front' ? 180 : 140;
      g.save(); g.translate(x, FEET); g.scale(1, 0.14);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, rgba(c, (p.kind === 'front' ? 0.3 : 0.16) * a)); gr.addColorStop(0.85, rgba(c, (p.kind === 'front' ? 0.16 : 0.08) * a)); gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
      g.restore();
      // riflesso della lente del taglio sul pavimento lucido
      if (p.kind === 'taglio') {
        const [lx] = p.lens, gr2 = g.createLinearGradient(0, 448, 0, 470);
        gr2.addColorStop(0, rgba(c, 0.25 * a)); gr2.addColorStop(1, rgba(c, 0));
        g.fillStyle = gr2; g.fillRect(lx + (lx < 500 ? 8 : -20), 448, 12, 22);
      }
    });

    // ombre morbide del preside sul sipario
    const img = renderCharacter(S, t, [
      ...light.map(({ p, a, hex }) => p.kind === 'front' ? { hex, amount: 0.8 * a * fall(p.aim[0], 180) } : null).filter(Boolean),
      ...light.map(({ p, a, hex }) => p.kind === 'taglio' ? { hex, amount: 0.75 * a * fall(HOME, 260), side: p.lens[0] < 500 ? 'l' : 'r' } : null).filter(Boolean)
    ], px);
    const cwW = CH_W * CH_K, chW = CH_H * CH_K;
    g.globalCompositeOperation = 'source-over';
    g.save(); g.beginPath(); g.rect(-2000, -2000, 5000, 2000 + WALL); g.clip();
    if ('filter' in g) g.filter = 'brightness(0) blur(' + (3 * s * dpr).toFixed(1) + 'px)';
    light.forEach(({ p, a }) => {
      if (p.kind !== 'front' || a < 0.01) return;
      const k = 1.08, sx = px + (px - p.lens[0]) * 0.18;
      g.globalAlpha = 0.35 * a * fall(p.aim[0], 260);
      g.drawImage(img, sx - cwW * k / 2, WALL + 26 - chW * k, cwW * k, chW * k);
    });
    g.restore(); g.globalAlpha = 1;

    // fasci nella foschia: disegnati a parte, velati dalla foschia che si muove
    const bl = beamLayer.getContext('2d');
    bl.setTransform(1, 0, 0, 1, 0, 0); bl.globalCompositeOperation = 'source-over'; bl.clearRect(0, 0, beamLayer.width, beamLayer.height);
    bl.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);
    bl.globalCompositeOperation = 'lighter';
    light.forEach(({ p, c, a }) => {
      if (a < 0.01) return;
      const [lx, ly] = p.lens, [tx, ty] = p.kind === 'front' ? p.aim : p.end;
      const dx = tx - lx, dy = ty - ly, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
      const w0 = p.kind === 'front' ? 11 : 13;
      const gr = bl.createLinearGradient(lx, ly, tx, ty);
      gr.addColorStop(0, rgba(c, 0.55 * a)); gr.addColorStop(0.3, rgba(c, 0.26 * a)); gr.addColorStop(1, rgba(c, (p.kind === 'front' ? 0.1 : 0.02) * a));
      bl.fillStyle = gr; bl.beginPath();
      bl.moveTo(lx + nx * w0, ly + ny * w0); bl.lineTo(tx + nx * p.r, ty + ny * p.r); bl.lineTo(tx - nx * p.r, ty - ny * p.r); bl.lineTo(lx - nx * w0, ly - ny * w0);
      bl.closePath(); bl.fill();
      // bordo netto del fascio
      bl.strokeStyle = rgba(c, 0.18 * a); bl.lineWidth = 1.2;
      bl.beginPath(); bl.moveTo(lx + nx * w0, ly + ny * w0); bl.lineTo(tx + nx * p.r, ty + ny * p.r);
      bl.moveTo(lx - nx * w0, ly - ny * w0); bl.lineTo(tx - nx * p.r, ty - ny * p.r); bl.stroke();
    });
    bl.setTransform(1, 0, 0, 1, 0, 0);
    bl.globalCompositeOperation = 'destination-in';
    const hs = 900 * s * dpr / 512;
    const pat = bl.createPattern(haze, 'repeat');
    if (pat.setTransform) pat.setTransform(new DOMMatrix([hs, 0, 0, hs, -(now * 9 * s * dpr) % (512 * hs), -(now * 3 * s * dpr) % (512 * hs)]));
    bl.fillStyle = pat; bl.fillRect(0, 0, beamLayer.width, beamLayer.height);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter';
    g.drawImage(beamLayer, 0, 0);
    // un velo uniforme sotto la foschia, così il fascio resta continuo
    
    g.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);

    // il preside
    g.globalCompositeOperation = 'source-over';
    g.drawImage(img, px - cwW / 2, FEET + 4 * CH_K - chW, cwW, chW);
    // giraffa e microfono appena sotto la bocca, col suo cavo
    g.strokeStyle = '#1e1f24'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(506, 372); g.lineTo(486, 340); g.stroke();
    g.strokeStyle = '#3a3c43'; g.lineWidth = 1.2; g.stroke();
    g.save(); g.translate(484, 330); g.rotate(0.55);
    g.fillStyle = '#141417'; g.beginPath(); g.moveTo(-3, 16); g.lineTo(3, 16); g.lineTo(4.5, 0); g.lineTo(-4.5, 0); g.closePath(); g.fill();
    const mg = g.createRadialGradient(-2, -5, 1, 0, -4, 7);
    mg.addColorStop(0, '#d9dce2'); mg.addColorStop(1, '#6a6d75');
    g.fillStyle = mg; g.beginPath(); g.arc(0, -4, 6.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.6;
    for (let i = -5; i <= 5; i += 2.5) { g.beginPath(); g.moveTo(i, -10); g.lineTo(i, 2); g.stroke(); }
    g.restore();
    g.strokeStyle = '#0a0a0c'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(489, 345); g.lineTo(505, 371); g.quadraticCurveTo(510, 376, 509, 390); g.lineTo(509, 460); g.stroke();

    // frontali nel pit, visti da dietro: alette, display con l'indirizzo DMX, cavi
    light.forEach(({ p, c, a }, i) => {
      const [lx, ly] = p.lens;
      g.globalCompositeOperation = 'source-over';
      if (p.kind === 'front') {
        g.strokeStyle = '#0a0a0c'; g.lineWidth = 2; g.beginPath(); g.moveTo(lx + 10, ly + 12); g.quadraticCurveTo(lx + 16, ly + 60, lx + 8, ly + 120); g.stroke();
        g.strokeStyle = '#2a2c31'; g.lineWidth = 5; g.beginPath(); g.moveTo(lx, ly + 16); g.lineTo(lx, ly + 130); g.stroke();
        g.strokeStyle = '#1c1d21'; g.lineWidth = 3; g.beginPath(); g.moveTo(lx - 24, ly - 2); g.lineTo(lx - 24, ly + 14); g.lineTo(lx + 24, ly + 14); g.lineTo(lx + 24, ly - 2); g.stroke();
        g.fillStyle = '#1a1b1f'; g.beginPath(); g.roundRect ? g.roundRect(lx - 20, ly - 18, 40, 30, 5) : g.rect(lx - 20, ly - 18, 40, 30); g.fill();
        g.fillStyle = '#26282d'; for (let f = -16; f <= 16; f += 4) g.fillRect(lx + f - 0.8, ly - 16, 1.6, 12);
        g.fillStyle = '#0a0a0c'; g.fillRect(lx - 12, ly, 24, 8);
        g.fillStyle = a > 0.001 || d >= 0 ? '#ff3b2e' : '#400'; g.font = '700 7px "Barlow Condensed", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(dmxAddr[i === 1 ? 0 : 1] || 'A001', lx, ly + 4.3);
        // alone della luce attorno al corpo del faro
        if (a > 0.01) {
          g.globalCompositeOperation = 'lighter';
          const gr = g.createRadialGradient(lx, ly - 22, 0, lx, ly - 22, 34);
          gr.addColorStop(0, rgba(c, 0.5 * a)); gr.addColorStop(1, rgba(c, 0));
          g.fillStyle = gr; g.beginPath(); g.arc(lx, ly - 22, 34, 0, Math.PI * 2); g.fill();
        }
        return;
      }
      // tagli: PAR visto di lato sulla staffa a forcella, lente verso il centro
      const dir = lx < 500 ? 1 : -1;
      g.strokeStyle = '#2a2c31'; g.lineWidth = 3; g.beginPath(); g.moveTo(lx - dir * 14, 312); g.lineTo(lx - dir * 14, 294); g.lineTo(lx + dir * 6, 294); g.stroke();
      g.save(); g.translate(lx, ly); g.scale(dir, 1);
      const body = g.createLinearGradient(0, -15, 0, 15);
      body.addColorStop(0, '#34363d'); body.addColorStop(0.5, '#1d1e23'); body.addColorStop(1, '#101114');
      g.fillStyle = body; g.beginPath(); g.moveTo(-18, -13); g.lineTo(10, -16); g.lineTo(10, 16); g.lineTo(-18, 13); g.closePath(); g.fill();
      g.fillStyle = '#0c0c0f'; g.fillRect(-22, -9, 5, 18);
      ell(g, 11, 0, 4, 16, '#0d0d10', '#3a3c43');
      if (a > 0.01) {
        g.globalCompositeOperation = 'lighter';
        for (let k = -2; k <= 2; k++) ell(g, 12, k * 5.5, 1.8, 2.2, rgba(c, 0.9 * a));
        const gr = g.createRadialGradient(14, 0, 0, 14, 0, 30);
        gr.addColorStop(0, rgba([255, 255, 255], 0.7 * a)); gr.addColorStop(0.25, rgba(c, 0.5 * a)); gr.addColorStop(1, rgba(c, 0));
        g.fillStyle = gr; g.beginPath(); g.arc(14, 0, 30, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    });
    g.globalCompositeOperation = 'source-over';

    const mix = [0, 1, 2].map(k => cols.reduce((sum, cc) => sum + cc[k], 0) / cols.length);
    // pubblico in controluce: la luce del palco arriva sulle prime file
    const spill = g.createLinearGradient(0, 470, 0, 640);
    spill.addColorStop(0, rgba(mix, 0.05 + 0.22 * d)); spill.addColorStop(1, rgba(mix, 0));
    g.globalCompositeOperation = 'lighter'; g.fillStyle = spill; g.fillRect(-2000, 470, 5000, 170);
    g.globalCompositeOperation = 'source-over';
    const mood = S.grad / 100, moving = S.running && !S.paused && !reducedFx();
    const cheering = cheerAt != null ? Math.max(0, 1 - (now - cheerAt) / 6) : 0;
    crowd.forEach(q => {
      let y = q.y + (moving ? Math.sin(t * (2 + mood * 3) + q.ph) * mood * 2.5 : 0);
      if (cheering && !reducedFx()) y -= Math.abs(Math.sin(now * 7 + q.ph)) * 10 * cheering * (0.4 + mood);
      drawPerson(g, q, y, mix, 0.12 + 0.55 * d, cheering > 0 && mood >= 0.4, now);
    });

    g.globalCompositeOperation = 'source-over';
    // segnale su chi ha il problema (l'avviso vero arriva dalla regia, in alto)
    const seen = new Set();
    S.events.forEach(e => {
      if (!e.live || seen.has(e.target)) return;
      seen.add(e.target);
      const [x, y] = anchorW(e.target, S), jump = Math.abs(Math.sin(now * 5)) * 5;
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(x + 1, y - jump + 2, 11, 0, Math.PI * 2); g.fill();
      ell(g, x, y - jump, 11, 11, '#f2c53d', '#7a5a10');
      g.fillStyle = '#1a1206'; g.font = '700 16px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('!', x, y - jump + 1);
    });

    // larsen: onde dalla cassa più vicina al preside
    if (S.ring > 0.02) {
      const x = Math.abs(px - SPK.l) < Math.abs(px - SPK.r) ? SPK.l : SPK.r, dir = x < 500 ? 1 : -1;
      [22, 36, 50].forEach((rr, k) => {
        g.strokeStyle = rgba([242, 197, 61], S.ring * (1 - k * 0.25)); g.lineWidth = 3;
        g.beginPath(); g.arc(x + dir * 34, 350, rr, dir > 0 ? -0.9 : Math.PI - 0.9, dir > 0 ? 0.9 : Math.PI + 0.9); g.stroke();
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
    anchor (target, S) { return toStage(...anchorW(target, S)); }
  };
})();

/* impianto di prova (?prova): montato, cablato, acceso e col microfono sul CH1 */
const PROVA_LEVEL = {"id":1,"placed":{"allaccio":{"id":"allaccio","type":"allaccio","gx":null,"gy":null,"screen":{"x":1159,"y":455},"zone":"ground"},"sub_1":{"id":"sub_1","type":"sub","gx":1.5,"gy":8.5,"foot":[1,1],"cells":["3,17"],"screen":{"x":496,"y":437.5},"zone":"ground","hasTop":"top_1","on":true},"sub_2":{"id":"sub_2","type":"sub","gx":7.5,"gy":8.5,"foot":[1,1],"cells":["15,17"],"screen":{"x":802,"y":647.5},"zone":"ground","hasTop":"top_2","on":true},"top_1":{"id":"top_1","type":"top","parentSubId":"sub_1","zone":"ground","screen":{"x":496,"y":372.5}},"top_2":{"id":"top_2","type":"top","parentSubId":"sub_2","zone":"ground","screen":{"x":802,"y":582.5}},"mixer_1":{"id":"mixer_1","type":"mixer","gx":7.5,"gy":5,"foot":[1,2],"cells":["15,10","15,11"],"screen":{"x":967.75,"y":533.75},"zone":"stage","on":true},"ampli_1":{"id":"ampli_1","type":"ampli","gx":6.5,"gy":4,"foot":[1,2],"cells":["13,8","13,9"],"screen":{"x":967.75,"y":463.75},"zone":"stage","on":true},"controller_1":{"id":"controller_1","type":"controller","gx":7.5,"gy":7.5,"foot":[1,1],"cells":["15,15"],"screen":{"x":853,"y":612.5},"zone":"stage","on":true},"stativo_1":{"id":"stativo_1","type":"stativo","gx":6.5,"gy":6.5,"foot":[1,1],"cells":["13,13"],"screen":{"x":853,"y":542.5},"zone":"stage","hasPar":"par_4"},"stativo_2":{"id":"stativo_2","type":"stativo","gx":2.5,"gy":9.5,"foot":[1,1],"cells":["5,19"],"screen":{"x":496,"y":507.5},"zone":"ground","hasPar":"par_3"},"stativo_3":{"id":"stativo_3","type":"stativo","gx":0.5,"gy":6.5,"foot":[1,1],"cells":["1,13"],"screen":{"x":547,"y":332.5},"zone":"ground","hasPar":"par_1"},"stativo_4":{"id":"stativo_4","type":"stativo","gx":9.5,"gy":9.5,"foot":[1,1],"cells":["19,19"],"screen":{"x":853,"y":752.5},"zone":"ground","hasPar":"par_2"},"par_1":{"id":"par_1","type":"par","parentStandId":"stativo_3","zone":"ground","screen":{"x":547,"y":249},"dmx":{"addr":81,"mode":2}},"par_2":{"id":"par_2","type":"par","parentStandId":"stativo_4","zone":"ground","screen":{"x":853,"y":669},"dmx":{"addr":81,"mode":2}},"par_3":{"id":"par_3","type":"par","parentStandId":"stativo_2","zone":"ground","screen":{"x":496,"y":424},"dmx":{"addr":81,"mode":2}},"par_4":{"id":"par_4","type":"par","parentStandId":"stativo_1","zone":"stage","screen":{"x":853,"y":459},"dmx":{"addr":81,"mode":2}},"asta_1":{"id":"asta_1","type":"asta","gx":4.5,"gy":6.5,"foot":[1,1],"cells":["9,13"],"screen":{"x":751,"y":472.5},"zone":"stage","hasMic":"mic_1"},"mic_1":{"id":"mic_1","type":"mic","parentAstaId":"asta_1","zone":"stage","screen":{"x":758,"y":409.082}},"quadro_1":{"id":"quadro_1","type":"quadro","gx":4.5,"gy":2,"foot":[1,2],"cells":["9,4","9,5"],"screen":{"x":967.75,"y":323.75},"zone":"ground","prot":{"main":true,"rcd":true,"L1":true,"L2":true,"L3":true,"tripped":{}}},"ciabatta_cee_1":{"id":"ciabatta_cee_1","type":"ciabatta_cee","gx":6.5,"gy":2,"foot":[1,3],"cells":["13,4","13,5","13,6"],"screen":{"x":1057,"y":402.5},"zone":"ground","on":true},"ciabatta_1":{"id":"ciabatta_1","type":"ciabatta","gx":3.5,"gy":14,"foot":[1,2],"cells":["7,28","7,29"],"screen":{"x":304.75,"y":708.75},"zone":"ground"},"pc_1":{"id":"pc_1","type":"pc","gx":4.5,"gy":14,"foot":[1,1],"cells":["9,28"],"screen":{"x":368.5,"y":735},"zone":"ground","on":true},"scheda_1":{"id":"scheda_1","type":"scheda","gx":5.5,"gy":14,"foot":[1,1],"cells":["11,28"],"screen":{"x":419.5,"y":770},"zone":"ground"}},"edges":[{"id":0,"a":"allaccio","aPort":"out","b":"quadro_1","bPort":"in","signal":"cee_tri"},{"id":1,"a":"quadro_1","aPort":"out_1","b":"ciabatta_cee_1","bPort":"in","signal":"cee_mono"},{"id":2,"a":"ciabatta_cee_1","aPort":"out_1","b":"pc_1","bPort":"power","signal":"schuko"},{"id":3,"a":"quadro_1","aPort":"out_1","b":"mixer_1","bPort":"power","signal":"cee_powercon"},{"id":4,"a":"ciabatta_cee_1","aPort":"out_4","b":"controller_1","bPort":"power","signal":"schuko_powercon"},{"id":5,"a":"quadro_1","aPort":"out_3","b":"ampli_1","bPort":"power","signal":"cee_powercon"},{"id":6,"a":"ciabatta_cee_1","aPort":"out_3","b":"sub_1","bPort":"power","signal":"schuko_powercon"},{"id":7,"a":"ciabatta_cee_1","aPort":"out_2","b":"sub_2","bPort":"power","signal":"schuko_powercon"},{"id":8,"a":"quadro_1","aPort":"out_3","b":"par_1","bPort":"power_in","signal":"cee_powercon"},{"id":9,"a":"par_1","aPort":"power_thru","b":"par_2","bPort":"power_in","signal":"powercon"},{"id":10,"a":"quadro_1","aPort":"out_2","b":"par_3","bPort":"power_in","signal":"cee_powercon"},{"id":11,"a":"quadro_1","aPort":"out_2","b":"par_4","bPort":"power_in","signal":"cee_powercon"},{"id":12,"a":"pc_1","aPort":"usb","b":"scheda_1","bPort":"usb","signal":"usbc"},{"id":13,"a":"scheda_1","aPort":"out_L","b":"mixer_1","bPort":"in_5","signal":"jack"},{"id":14,"a":"scheda_1","aPort":"out_R","b":"mixer_1","bPort":"in_6","signal":"jack"},{"id":15,"a":"mixer_1","aPort":"main_L","b":"ampli_1","bPort":"in_L","signal":"xlr"},{"id":16,"a":"mixer_1","aPort":"main_R","b":"ampli_1","bPort":"in_R","signal":"xlr"},{"id":17,"a":"ampli_1","aPort":"out_L","b":"sub_1","bPort":"spk_in","signal":"speakon"},{"id":18,"a":"ampli_1","aPort":"out_R","b":"sub_2","bPort":"spk_in","signal":"speakon"},{"id":19,"a":"sub_1","aPort":"spk_thru","b":"top_1","bPort":"spk_in","signal":"speakon"},{"id":20,"a":"sub_2","aPort":"spk_thru","b":"top_2","bPort":"spk_in","signal":"speakon"},{"id":21,"a":"mic_1","aPort":"out","b":"mixer_1","bPort":"in_1","signal":"xlr"},{"id":22,"a":"controller_1","aPort":"dmx_2","b":"par_2","bPort":"dmx_in","signal":"dmx"},{"id":23,"a":"par_2","aPort":"dmx_thru","b":"par_1","bPort":"dmx_in","signal":"dmx"},{"id":24,"a":"par_1","aPort":"dmx_thru","b":"par_4","bPort":"dmx_in","signal":"dmx"},{"id":25,"a":"par_4","aPort":"dmx_thru","b":"par_3","bPort":"dmx_in","signal":"dmx"}],"stock":{"sub":0,"top":0,"mixer":0,"asta":0,"mic":0,"stativo":0,"par":0,"controller":0,"ampli":0,"quadro":0,"ciabatta":0,"ciabatta_cee":0,"pc":0,"scheda":0,"di":0},"nextIndex":{"sub":3,"top":3,"mixer":2,"asta":2,"mic":2,"stativo":5,"par":5,"controller":2,"ampli":2,"quadro":2,"ciabatta":2,"ciabatta_cee":2,"pc":2,"scheda":2,"di":1},"edgeSeq":26,"trips":0,"rcdTrips":0,"procErrors":[],"stats":{"playMs":0,"tests":0,"failedTests":0}};
if (window.SCS_PROVA || /[?&#]prova\b/.test(location.search + location.hash)) Show.prova();
