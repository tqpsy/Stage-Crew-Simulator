/* =====================================================================
   DIAGNOSTICA — gli attrezzi per trovare il cavo sbagliato PRIMA del
   Test impianto, senza riaprire il pannello di ogni pezzo:
   - PATCH SHEET (pulsante nell'HUD): una tabella con tutto l'impianto,
     Dispositivo | Canale mixer / DMX | Fase | Stato. Si aggiorna dal vivo;
     toccando una riga si apre il pannello di quel pezzo.
   - TESTER CAVI / MULTIMETRO (nel baule): si sceglie una linea stesa e
     dice continuità, tensione o segnale, il canale L/R che porta e
     l'universo DMX. Funziona anche a impianto spento (la continuità).
   - VU METER sul pannello del mixer (6 canali + MAIN L/R) e della scheda
     audio (OUT L/R): si vede subito dove arriva la musica del PC.
   Usa lo stato e le funzioni di main.js (caricato prima).
   ===================================================================== */

// colori reali dei conduttori di fase (L1 marrone, L2 nero, L3 grigio)
const PHASE_COLORS = { L1: '#8b5a2b', L2: '#111214', L3: '#8f949c' };
function phaseChip (ph) {
  return ph ? '<span class="ph-chip"><i style="background:' + PHASE_COLORS[ph] + '"></i>' + ph + '</span>' : '<span class="dg-mute">—</span>';
}

/* ---------------------------------------------------------------------
   VU METER — livello (0..1) di ogni canale; null = strumento spento
   --------------------------------------------------------------------- */
const AUDIO_TYPES = new Set(['pc', 'scheda', 'mixer', 'ampli', 'sub', 'top', 'mic', 'dj', 'di']);
// livello di quello che esce da un dispositivo verso un ingresso di linea
function sourceLevel (srcId, reach) {
  const src = gameState.placed[srcId];
  if (!src) return 0;
  // microfono dinamico in una palestra vuota: solo il rumore di fondo
  if (src.type === 'mic') return 0.18;
  if (src.type === 'di') {
    const dj = placedOfType('dj')[0];
    return dj && isRunning(dj.id) && (djRoute(dj, 'L').di === src || djRoute(dj, 'R').di === src) ? 0.8 : 0;
  }
  if (src.type === 'dj') return isRunning(src.id) ? 0.8 : 0;
  return reach.has(srcId) ? 0.72 : 0;
}
function vuChannels (compId) {
  const c = gameState.placed[compId];
  if (!c) return null;
  const reach = musicReach();
  if (c.type === 'scheda') {
    const on = isRunning(c.id);
    return { on, off: 'senza USB dal PC: la scheda è spenta', chans: ['out_L', 'out_R'].map(p => {
      const e = gameState.edges.find(x => x.a === c.id && x.aPort === p);
      return { name: 'OUT ' + p.slice(-1), src: e ? '→ ' + compLabel(e.b) + ' ' + portLabel(e.b, e.bPort) : 'libera', level: on && reach.has(c.id) ? 0.72 : 0 };
    }) };
  }
  if (c.type === 'mixer') {
    const on = isRunning(c.id);
    const chans = [1, 2, 3, 4, 5, 6].map(n => {
      const e = edgeInto(c.id, 'in_' + n);
      const src = e && gameState.placed[e.a];
      return { name: 'CH ' + n, src: src ? compLabel(e.a) + (src.type === 'scheda' || src.type === 'di' ? ' ' + portLabel(e.a, e.aPort) : '') : '—', level: on && e ? sourceLevel(e.a, reach) : 0 };
    });
    // CH 5 va a sinistra e CH 6 a destra (vedi stereoCheck); i MIC al centro
    const mics = Math.max(...chans.slice(0, 4).map(ch => ch.level)) * 0.85;
    chans.push({ name: 'MAIN L', src: 'uscita', level: on ? Math.max(chans[4].level, mics) : 0, main: true });
    chans.push({ name: 'MAIN R', src: 'uscita', level: on ? Math.max(chans[5].level, mics) : 0, main: true });
    return { on, off: whyDown(c) ? 'mixer ' + whyDown(c) + ': i meter sono spenti' : '', chans };
  }
  return null;
}
const VU_SEGS = 12;
function vuBarHtml (ch, on) {
  let s = '<div class="vu-ch' + (ch.main ? ' main' : '') + '"><div class="vu-bar" data-level="' + (on ? ch.level : 0) + '">';
  for (let i = VU_SEGS - 1; i >= 0; i--) s += '<i class="' + (i >= VU_SEGS - 2 ? 'r' : i >= VU_SEGS - 4 ? 'y' : 'g') + '"></i>';
  return s + '</div><b>' + escapeHtml(ch.name) + '</b><small>' + escapeHtml(ch.src) + '</small></div>';
}
// sotto il titolo del pannello posteriore del mixer e della scheda
function renderRearVu () {
  const box = el('#rear-vu');
  if (!box) return;
  const comp = rearPanelId && gameState.placed[rearPanelId];
  // sul tavolo regia si vedono insieme quelli di mixer e scheda
  const ids = !comp ? [] : comp.type === 'tavolo' ? mountedAll(comp).filter(c => c.type === 'mixer' || c.type === 'scheda').map(c => c.id) : [comp.id];
  const blocks = ids.map(id => ({ id, vu: vuChannels(id) })).filter(b => b.vu);
  if (!blocks.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = blocks.map(({ id, vu }) => '<div class="vu-block"><div class="vu-head">VU ' + escapeHtml(compLabel(id))
    + (vu.on ? '' : ' <span class="dg-mute">· ' + escapeHtml(vu.off) + '</span>') + '</div>'
    + '<div class="vu-row' + (vu.on ? '' : ' off') + '">' + vu.chans.map(ch => vuBarHtml(ch, vu.on)).join('') + '</div></div>').join('');
  animateVu();
}
// i segmenti ballano intorno al livello, finché un VU è a schermo
let vuTimer = null;
function animateVu () {
  const tick = () => {
    const bars = [...document.querySelectorAll('.vu-bar')].filter(b => b.offsetParent);
    if (!bars.length) { clearInterval(vuTimer); vuTimer = null; return; }
    bars.forEach(b => {
      const lv = parseFloat(b.dataset.level) || 0;
      const jit = lv && !reducedFx() ? (Math.random() - 0.5) * 0.28 : 0;
      const lit = lv ? Math.max(1, Math.round((lv + jit) * VU_SEGS)) : 0;
      [...b.children].forEach((seg, i) => seg.classList.toggle('on', VU_SEGS - 1 - i < lit));
    });
  };
  tick();
  if (!vuTimer) vuTimer = setInterval(tick, 110);
}

/* ---------------------------------------------------------------------
   PATCH SHEET
   --------------------------------------------------------------------- */
const PATCH_GROUPS = [
  ['Corrente', ['quadro', 'ciabatta', 'ciabatta_cee']],
  ['Audio', ['pc', 'scheda', 'mixer', 'ampli', 'sub', 'top', 'mic', 'dj', 'di']],
  ['Luci', ['controller', 'par', 'djluci']]
];
let patchIsOpen = false;
// i collegamenti di segnale di un dispositivo, una riga ciascuno
// (nell'ordine delle prese sul pannello: sul mixer CH 1 … CH 6, poi le uscite)
function signalLinks (c) {
  const order = COMPONENT_TYPES[c.type].ports.map(p => p.id);
  const out = [];
  gameState.edges.forEach(e => {
    if (POWER_CABLE_IDS.has(e.signal)) return;
    if (e.a === c.id) out.push({ i: order.indexOf(e.aPort), t: portLabel(c.id, e.aPort) + ' → ' + compLabel(e.b) + ' ' + portLabel(e.b, e.bPort) });
    else if (e.b === c.id) out.push({ i: order.indexOf(e.bPort), t: portLabel(c.id, e.bPort) + ' ← ' + compLabel(e.a) + ' ' + portLabel(e.a, e.aPort) });
  });
  return out.sort((x, y) => x.i - y.i).map(x => x.t);
}
const pad3 = n => String(n).padStart(3, '0');
// colonna "Canale mixer / DMX": righe di testo, quelle che non vanno in rosso
function patchRoute (c, overlaps) {
  const lines = [];
  const add = (txt, bad) => lines.push({ txt, bad: !!bad });
  if (c.type === 'par') {
    const u = dmxUniverse(c.id), d = parDmx(c), n = parseInt(PAR_MODES[d.mode].id, 10);
    if (u == null) add('DMX: non arriva dalla consolle', true);
    else add('U' + u + ' · ' + pad3(d.addr) + '–' + pad3(d.addr + n - 1) + ' · ' + PAR_MODES[d.mode].id);
    const clash = overlaps.filter(p => p.includes(c.id)).map(p => compLabel(p[0] === c.id ? p[1] : p[0]));
    if (clash.length) add('si accavalla con ' + clash.join(', '), true);
    return lines;
  }
  if (c.type === 'djluci') {
    const u = dmxUniverse(c.id), clash = djLuciClashes(c);
    if (u == null) add('DMX: non arriva dalla consolle', true);
    else add('U' + u + ' · ' + pad3(DJ_LUCI_DMX.from) + '–' + pad3(DJ_LUCI_DMX.to) + ' (del DJ)');
    if (clash.length) add('pestata da ' + clash.map(p => compLabel(p.id)).join(', '), true);
    return lines;
  }
  if (c.type === 'controller') {
    [1, 2].forEach(u => {
      const n = placedOfType('par').filter(p => dmxUniverse(p.id) === u).length
        + placedOfType('djluci').filter(p => dmxUniverse(p.id) === u).length;
      add('U' + u + ': ' + (n ? n + (n === 1 ? ' faro' : ' fari') : 'libero'));
    });
    return lines;
  }
  if (c.type === 'quadro' || /^ciabatta/.test(c.type)) return lines;
  signalLinks(c).forEach(t => add(t));
  if (!lines.length && AUDIO_TYPES.has(c.type)) add('nessun cavo di segnale', true);
  // le casse: quale canale del PC suonano, e se è quello del loro lato
  if (c.type === 'sub' || c.type === 'top') {
    const sub = c.type === 'top' ? placedOfType('sub').find(s => s.hasTop === c.id) : c;
    const side = sub && lineSide(edgeInto(sub.id, 'spk_in', 'speakon')), pos = speakerSide(c.id);
    if (side) add('suona il canale ' + SIDE_WORD[side] + (pos && pos !== side ? ' ma sta a ' + (pos === 'L' ? 'sinistra' : 'destra') : ''), pos && pos !== side);
  }
  return lines;
}
// colonna "Stato accensione": { txt, cls }
function patchState (c, reach) {
  const def = COMPONENT_TYPES[c.type];
  if (c.type === 'quadro') {
    if (!isPowered(c.id)) return { txt: 'senza corrente dall\'allaccio', cls: 'bad' };
    const p = quadroProt(c);
    if (!p.main || !p.rcd) return { txt: 'da armare', cls: 'warn' };
    const down = ['L1', 'L2', 'L3'].filter(k => !p[k]);
    return { txt: down.length ? 'armato · ' + down.join(' ') + ' giù' : 'armato', cls: down.length ? 'warn' : 'ok' };
  }
  const music = reach.has(c.id) && c.type !== 'pc' ? ' · ♪' : '';
  if (def.busPowered) return isRunning(c.id) ? { txt: 'accesa (USB)' + music, cls: 'ok' } : { txt: 'senza USB dal PC', cls: 'bad' };
  if (!powerInPort(def)) {
    if (c.type === 'mic') return { txt: 'passivo', cls: 'mute' };
    return isLedOn(c.id) ? { txt: 'segnale' + music, cls: 'ok' } : { txt: 'nessun segnale', cls: 'mute' };
  }
  const why = whyDown(c);
  if (!why) return { txt: 'acceso' + music, cls: 'ok' };
  return { txt: why, cls: why === 'spento' ? 'warn' : 'bad' };
}
function renderPatch () {
  const body = el('#patch-body');
  if (!body) return;
  const overlaps = dmxOverlaps(), reach = musicReach();
  let rows = '';
  PATCH_GROUPS.forEach(([title, types]) => {
    const cs = types.flatMap(t => placedOfType(t));
    if (!cs.length) return;
    rows += '<tr class="pt-group"><th colspan="4">' + title + '</th></tr>';
    cs.forEach(c => {
      const def = COMPONENT_TYPES[c.type];
      const ph = c.type === 'quadro' ? null : phaseOf(c.id);
      const phase = c.type === 'quadro' ? ['L1', 'L2', 'L3'].map(phaseChip).join(' ')
        : def.busPowered ? '<span class="dg-mute">USB</span>' : powerInPort(def) ? phaseChip(ph) : '<span class="dg-mute">—</span>';
      const route = patchRoute(c, overlaps);
      const st = patchState(c, reach);
      const bad = route.some(r => r.bad) || st.cls === 'bad';
      rows += '<tr class="pt-row' + (bad ? ' bad' : '') + '" data-id="' + c.id + '">'
        + '<td class="pt-dev">' + escapeHtml(compLabel(c.id)) + '</td>'
        + '<td class="pt-route">' + (route.length ? route.map(r => '<div' + (r.bad ? ' class="pt-bad"' : '') + '>' + escapeHtml(r.txt) + '</div>').join('') : '<span class="dg-mute">—</span>') + '</td>'
        + '<td class="pt-phase">' + phase + '</td>'
        + '<td class="pt-state ' + st.cls + '">' + escapeHtml(st.txt) + '</td></tr>';
    });
  });
  if (!rows) {
    body.innerHTML = '<p class="dg-empty">Ancora niente da segnare: posa i pezzi e collegali, il foglio si compila da solo.</p>';
    return;
  }
  // carico previsto di ogni fase con tutto acceso
  const loads = computePhaseLoads();
  const foot = ['L1', 'L2', 'L3'].map(k => '<span class="' + (loads[k] > PHASE_BUDGET_W ? 'pt-bad' : '') + '">' + phaseChip(k) + ' ' + fmtKW(loads[k], 2) + ' kW</span>').join('');
  body.innerHTML = '<table class="patch-table"><thead><tr><th>Dispositivo</th><th>Canale mixer / DMX</th><th>Fase</th><th>Stato</th></tr></thead><tbody>'
    + rows + '</tbody></table>'
    + '<div class="patch-foot"><span class="dg-mute">Carico con tutto acceso (max ' + fmtKW(PHASE_BUDGET_W, 1) + ' kW per fase):</span>' + foot + '</div>';
  body.querySelectorAll('.pt-row').forEach(tr => tr.addEventListener('click', () => {
    const id = tr.dataset.id;
    SFX.button();
    closePatch();
    openRearPanel(id);
  }));
}
function openPatch () {
  patchIsOpen = true;
  renderPatch();
  el('#patch-modal').classList.add('show');
  setSceneInput(false);
  SFX.button();
}
function closePatch () {
  patchIsOpen = false;
  el('#patch-modal').classList.remove('show');
  setTimeout(() => { if (!sceneCovered()) setSceneInput(true); }, 0);
}
el('#patch-btn').addEventListener('click', openPatch);
el('#patch-close').addEventListener('click', closePatch);
el('#patch-modal').addEventListener('click', ev => { if (ev.target.id === 'patch-modal') closePatch(); });

/* ---------------------------------------------------------------------
   TESTER CAVI / MULTIMETRO
   --------------------------------------------------------------------- */
let testerIsOpen = false, testerEdge = null;
// i poli che il tester controlla, per tipo di connettore
const TESTER_POLES = { xlr: 'pin 1-2-3', dmx: 'pin 1-2-3', jack: 'punta-anello-manicotto', speakon: '1+ 1−', usbc: 'dati + 5 V',
  cee_tri: 'L1 L2 L3 N PE', cee_mono: 'L N PE', powercon: 'L N PE', schuko: 'L N PE', cee_powercon: 'L N PE', cee_schuko: 'L N PE', schuko_powercon: 'L N PE' };
// canale del PC (L/R) che porta un cavo audio, risalendo la catena; null se non si sa
function lineSide (e, depth) {
  if (!e || (depth || 0) > 8) return null;
  const a = gameState.placed[e.a];
  if (!a) return null;
  const up = port => lineSide(edgeInto(a.id, port), (depth || 0) + 1);
  if (a.type === 'scheda' || a.type === 'dj') return e.aPort.slice(-1);
  if (a.type === 'di') return up('in_' + e.aPort.slice(-1));
  if (a.type === 'mixer') {
    if (!/^main_/.test(e.aPort)) return null;
    // MAIN L porta il CH 5, MAIN R il CH 6
    return up(e.aPort === 'main_L' ? 'in_5' : 'in_6');
  }
  if (a.type === 'ampli') return up(e.aPort === 'out_L' ? 'in_L' : 'in_R');
  if (a.type === 'sub') return up('spk_in');
  return null;
}
// la cassa dove finisce un cavo Speakon: a sinistra o a destra per chi guarda dalla platea
function speakerSide (compId) {
  const c = gameState.placed[compId];
  if (!c) return null;
  const sub = c.type === 'top' ? placedOfType('sub').find(s => s.hasTop === c.id) : c.type === 'sub' ? c : null;
  const subs = subsLeftToRight();
  const i = sub ? subs.indexOf(sub) : -1;
  return subs.length === 2 && i >= 0 ? (i === 0 ? 'L' : 'R') : null;
}
// perché non arriva niente da una sorgente
function upstreamWhy (srcId, srcPort) {
  const s = gameState.placed[srcId];
  if (!s) return '';
  if (s.type === 'quadro') {
    if (!isPowered(s.id)) return 'al Quadro non arriva corrente dall\'allaccio';
    const p = quadroProt(s), port = COMPONENT_TYPES.quadro.ports.find(q => q.id === srcPort);
    if (!p.main) return 'generale del Quadro abbassato';
    if (!p.rcd) return 'salvavita del Quadro abbassato';
    if (port && port.phase && !p[port.phase]) return 'fase ' + port.phase + ' abbassata sul Quadro';
    return '';
  }
  const why = whyDown(s);
  return why ? compLabel(s.id) + ' ' + why : '';
}
const SIDE_WORD = { L: 'SINISTRO', R: 'DESTRO' };
// la lettura del tester su una linea: righe { k, v, cls }
function testLine (e) {
  const out = [];
  const row = (k, v, cls) => out.push({ k, v, cls: cls || '' });
  const sig = e.signal;
  row('Continuità', '✓ ' + (TESTER_POLES[sig] || 'ok'), 'ok');
  if (POWER_CABLE_IDS.has(sig)) {
    const live = portEnergized(e.a, e.aPort);
    const src = gameState.placed[e.a];
    const ph = src && src.type === 'quadro' ? (COMPONENT_TYPES.quadro.ports.find(q => q.id === e.aPort) || {}).phase : phaseOf(e.b);
    if (sig === 'cee_tri') row('Tensione', live ? '400 V trifase' : '0 V', live ? 'ok' : 'warn');
    else row('Tensione', live ? '230 V' + (ph ? ' · fase ' + ph : '') : '0 V', live ? 'ok' : 'warn');
    if (!live) { const why = upstreamWhy(e.a, e.aPort); if (why) row('Perché', why, 'warn'); }
    if (sig !== 'cee_tri') {
      const w = downstreamPowerLoad(e.b, new Set([e.a]));
      row('Carico a valle', w ? w + ' W con tutto acceso' : 'nessuno');
    }
    return out;
  }
  if (sig === 'dmx') {
    const a = gameState.placed[e.a];
    const u = a && a.type === 'controller' ? (e.aPort === 'dmx_2' ? 2 : 1) : a ? dmxUniverse(a.id) : null;
    const ct = placedOfType('controller')[0];
    if (u == null) row('DMX', 'nessun dato: la catena non parte dalla consolle', 'bad');
    else if (!ct || !isRunning(ct.id)) row('DMX', 'universo ' + u + ' · nessun dato: consolle ' + (ct ? whyDown(ct) || 'spenta' : 'assente'), 'warn');
    else row('DMX', 'universo ' + u + ' · dati presenti', 'ok');
    // i fari a valle, coi loro indirizzi
    const down = [];
    const overlaps = dmxOverlaps();
    for (let id = e.b, n = 0; id && n < 12; n++) {
      const c = gameState.placed[id];
      if (!c) break;
      if (c.type === 'par') {
        const d = parDmx(c), k = parseInt(PAR_MODES[d.mode].id, 10);
        const clash = overlaps.some(p => p.includes(c.id));
        down.push({ t: compLabel(c.id) + ' ' + pad3(d.addr) + '–' + pad3(d.addr + k - 1), bad: clash });
      } else if (c.type === 'djluci') down.push({ t: compLabel(c.id) + ' ' + pad3(DJ_LUCI_DMX.from) + '–' + pad3(DJ_LUCI_DMX.to), bad: djLuciClashes(c).length > 0 });
      const nx = gameState.edges.find(x => x.a === id && x.signal === 'dmx');
      id = nx ? nx.b : null;
    }
    if (down.length) row('Fari a valle', down.map(d => d.t + (d.bad ? ' ⚠' : '')).join(' · '), down.some(d => d.bad) ? 'bad' : '');
    if (down.some(d => d.bad)) row('Attenzione', 'indirizzi che si accavallano sullo stesso universo', 'bad');
    return out;
  }
  if (sig === 'usbc') {
    const pc = gameState.placed[e.a].type === 'pc' ? e.a : e.b;
    const on = isRunning(pc);
    row('USB', on ? '5 V · audio digitale dal PC' : 'nessun segnale', on ? 'ok' : 'warn');
    if (!on) row('Perché', compLabel(pc) + ' ' + (whyDown(gameState.placed[pc]) || 'spento'), 'warn');
    return out;
  }
  // audio: jack, XLR, Speakon
  const a = gameState.placed[e.a];
  if (a && a.type === 'mic') { row('Segnale', 'microfono dinamico: segnale debole, normale', 'ok'); return out; }
  const lv = sourceLevel(e.a, musicReach());
  const side = lineSide(e);
  if (lv) {
    const what = a.type === 'dj' || a.type === 'di' ? 'musica del DJ' : 'musica del PC';
    row('Segnale', '♪ ' + what + (sig === 'speakon' ? ' · amplificato' : ' · livello linea'), 'ok');
  } else {
    row('Segnale', 'nessuno', 'warn');
    const why = a ? (whyDown(a) ? compLabel(a.id) + ' ' + whyDown(a) : 'a ' + compLabel(a.id) + ' non arriva la musica') : '';
    if (why) row('Perché', why, 'warn');
  }
  if (side) row('Canale', SIDE_WORD[side] + ' (' + side + ')');
  const spk = sig === 'speakon' ? speakerSide(e.b) : null;
  if (spk) {
    row('Cassa', (spk === 'L' ? 'a sinistra' : 'a destra') + ' del palco, vista dalla platea');
    if (side && side !== spk) row('Attenzione', 'canale ' + SIDE_WORD[side] + ' sulla cassa di ' + (spk === 'L' ? 'sinistra' : 'destra'), 'bad');
  }
  return out;
}
const LINE_GROUPS = [
  ['Corrente', e => POWER_CABLE_IDS.has(e.signal)],
  ['Audio', e => ['jack', 'xlr', 'speakon', 'usbc'].includes(e.signal)],
  ['DMX', e => e.signal === 'dmx']
];
const lineName = e => compLabel(e.a) + ' ' + portLabel(e.a, e.aPort) + ' → ' + compLabel(e.b) + ' ' + portLabel(e.b, e.bPort);
function cableColor (sig) { return CABLE_TYPES[sig] ? hex(CABLE_TYPES[sig].color) : '#9aa0aa'; }
function renderTester () {
  const lcd = el('#tester-lcd'), list = el('#tester-lines');
  const e = testerEdge != null && gameState.edges.find(x => x.id === testerEdge);
  if (!e) {
    testerEdge = null;
    lcd.innerHTML = '<div class="lcd-idle">' + (gameState.edges.length ? 'Scegli una linea da provare' : 'Nessun cavo steso da provare') + '</div>';
  } else {
    lcd.innerHTML = '<div class="lcd-title"><span class="tape-fluo" style="background:' + tapeColorOf(e.signal) + '">' + escapeHtml((cableItem(e.signal) || {}).tape || cableName(e.signal)) + '</span> '
      + escapeHtml(lineName(e)) + '</div>'
      + testLine(e).map(r => '<div class="lcd-row ' + r.cls + '"><b>' + escapeHtml(r.k) + '</b><span>' + escapeHtml(r.v) + '</span></div>').join('');
  }
  let s = '';
  LINE_GROUPS.forEach(([title, f]) => {
    const es = gameState.edges.filter(f);
    if (!es.length) return;
    s += '<div class="tl-group">' + title + '</div>';
    es.forEach(x => {
      s += '<button type="button" class="tl-line' + (x.id === testerEdge ? ' sel' : '') + '" data-edge="' + x.id + '"><i style="background:' + cableColor(x.signal) + '"></i>'
        + '<span>' + escapeHtml(lineName(x)) + '</span><small>' + escapeHtml(cableName(x.signal)) + '</small></button>';
    });
  });
  list.innerHTML = s;
  list.querySelectorAll('.tl-line').forEach(b => b.addEventListener('click', () => {
    testerEdge = parseInt(b.dataset.edge, 10);
    renderTester();
    const ok = !testLine(gameState.edges.find(x => x.id === testerEdge)).some(r => r.cls === 'bad');
    SFX.beep(ok);
  }));
}
function openTester () {
  if (openCaseName) closeCase();
  testerIsOpen = true;
  renderTester();
  el('#tester-modal').classList.add('show');
  setSceneInput(false);
  SFX.pick();
}
function closeTester () {
  testerIsOpen = false;
  el('#tester-modal').classList.remove('show');
  setTimeout(() => { if (!sceneCovered()) setSceneInput(true); }, 0);
}
el('#tester-close').addEventListener('click', closeTester);
el('#tester-modal').addEventListener('click', ev => { if (ev.target.id === 'tester-modal') closeTester(); });

// il tester nel suo scomparto del baule (disegnato da renderCase)
function testerCell (cx, cy) {
  return `<g class="cc-tester" style="cursor:pointer">
    <rect x="${cx - 92}" y="${cy - 90}" width="184" height="180" rx="8" fill="transparent"/>
    <path d="M ${cx + 26} ${cy + 40} C ${cx + 60} ${cy + 46}, ${cx + 64} ${cy + 10}, ${cx + 50} ${cy - 20}" fill="none" stroke="#c0392b" stroke-width="5"/>
    <path d="M ${cx + 26} ${cy + 46} C ${cx + 70} ${cy + 58}, ${cx + 78} ${cy + 18}, ${cx + 66} ${cy - 10}" fill="none" stroke="#111" stroke-width="5"/>
    <rect x="${cx + 46}" y="${cy - 50}" width="8" height="32" rx="3" fill="#c0392b"/><rect x="${cx + 62}" y="${cy - 40}" width="8" height="32" rx="3" fill="#2a2c32"/>
    <rect x="${cx - 46}" y="${cy - 62}" width="76" height="112" rx="12" fill="#f2c53d" stroke="#8a6d12" stroke-width="2"/>
    <rect x="${cx - 38}" y="${cy - 54}" width="60" height="96" rx="8" fill="#2a2c32"/>
    <rect x="${cx - 32}" y="${cy - 48}" width="48" height="24" rx="3" fill="#9fb39a"/>
    <text x="${cx - 8}" y="${cy - 31}" font-size="13" font-weight="700" fill="#1d2a1b" text-anchor="middle" font-family="monospace">230V</text>
    <circle cx="${cx - 8}" cy="${cy + 2}" r="15" fill="#3a3d45" stroke="#6a6e78" stroke-width="2"/><rect x="${cx - 9.5}" y="${cy - 12}" width="3" height="12" fill="#e6e8eb"/>
    <circle cx="${cx - 22}" cy="${cy + 30}" r="4" fill="#c0392b"/><circle cx="${cx + 6}" cy="${cy + 30}" r="4" fill="#111" stroke="#6a6e78"/>
    ${fluoTape(cx - 4, cy - 76, 120, 30, '#f2c53d', 'TESTER', 3)}
    <text x="${cx}" y="${cy + 70}" font-size="15" font-weight="700" fill="#e6e8eb" text-anchor="middle">Tester cavi</text>
    <text x="${cx}" y="${cy + 86}" font-size="13" fill="#b4b8c0" text-anchor="middle">continuità · tensione · segnale</text>
  </g>`;
}

// i due pannelli sono finestre del gioco: coprono la scena come gli altri
function diagOpen () { return patchIsOpen || testerIsOpen; }
// dal vivo: cavi, interruttori e protezioni ridisegnano anche il foglio
function refreshDiag () {
  if (patchIsOpen) renderPatch();
  if (testerIsOpen) renderTester();
}
