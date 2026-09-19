/* ======================================================================
   STAGE CREW SIMULATOR — Livello 1 "Il Pub" — MVP giocabile
   Motore: Phaser 3 (via CDN). File singolo, nessuna asset esterna:
   ogni fixture è disegnata come icona vettoriale (non foto) che ne
   richiama la forma reale (PAR rotondo, sub/top con cono, ecc.).
   ====================================================================== */

/* ---------------------------------------------------------------------
   1) CATALOGO COMPONENTI — zona di posa, forma grafica, porte
   --------------------------------------------------------------------- */
const SIGNAL_COLOR = {
  powercon: 0xe0503f,
  speakon:  0xdcdcdc,
  dmx:      0xf2c53d,
  xlr:      0x4a90e2
};

/* zone: 'stage' (sul palco) · 'ground' (a terra, libero) · 'regia' (striscia
   davanti al palco) · 'fixed' (posizione imposta, non trascinabile)
   dir: 'in' | 'out' — un cavo collega sempre un OUT a un IN, mai due porte
   della stessa direzione, e non può richiudersi in un anello. */
const COMPONENT_TYPES = {
  sub: {
    label: 'SUB', category: 'audio', powerW: 600, zone: 'ground', shape: 'sub',
    body: { w: 60, h: 46, fill: 0x232830, accent: 0x4a90e2 },
    ports: [
      { id: 'power',    signal: 'powercon', dir: 'in',  dx: 0,   dy: 27 },
      { id: 'spk_in',   signal: 'speakon',  dir: 'in',  dx: -27, dy: 2 },
      { id: 'spk_thru', signal: 'speakon',  dir: 'out', dx: 0,   dy: -27 }
    ]
  },
  top: {
    label: 'TOP', category: 'audio', powerW: 0, zone: 'ground', shape: 'top',
    body: { w: 46, h: 40, fill: 0x232830, accent: 0x4a90e2 },
    ports: [
      { id: 'spk_in', signal: 'speakon', dir: 'in', dx: 0, dy: 22 }
    ]
  },
  mixer: {
    label: 'MIX', category: 'audio', powerW: 50, zone: 'stage', shape: 'rackbox',
    body: { w: 68, h: 44, fill: 0x2a2c32, accent: 0x8a8e98 },
    ports: [
      { id: 'power',   signal: 'powercon', dir: 'in',  dx: -27, dy: -19 },
      { id: 'audio_L', signal: 'xlr',      dir: 'out', dx: -14, dy: 21 },
      { id: 'audio_R', signal: 'xlr',      dir: 'out', dx: 14,  dy: 21 }
    ]
  },
  ampli: {
    label: 'FINALE', category: 'regia', powerW: 300, zone: 'regia', shape: 'ampli',
    body: { w: 80, h: 44, fill: 0x2a2c32, accent: 0x8a8e98 },
    ports: [
      { id: 'power', signal: 'powercon', dir: 'in',  dx: -32, dy: -18 },
      { id: 'in_L',  signal: 'xlr',      dir: 'in',  dx: -30, dy: 18 },
      { id: 'in_R',  signal: 'xlr',      dir: 'in',  dx: -10, dy: 18 },
      { id: 'out_L', signal: 'speakon',  dir: 'out', dx: 12,  dy: 18 },
      { id: 'out_R', signal: 'speakon',  dir: 'out', dx: 32,  dy: 18 }
    ]
  },
  par: {
    label: 'PAR', category: 'luci', powerW: 40, zone: 'stage', shape: 'par',
    body: { w: 40, h: 44, fill: 0x2a2620, accent: 0xf2c53d },
    ports: [
      { id: 'power_in',   signal: 'powercon', dir: 'in',  dx: -16, dy: 20 },
      { id: 'power_thru', signal: 'powercon', dir: 'out', dx: 16,  dy: 20 },
      { id: 'dmx_in',     signal: 'dmx',      dir: 'in',  dx: -16, dy: -16 },
      { id: 'dmx_thru',   signal: 'dmx',      dir: 'out', dx: 16,  dy: -16 }
    ]
  },
  controller: {
    label: 'CTRL', category: 'luci', powerW: 20, zone: 'stage', shape: 'rackbox',
    body: { w: 62, h: 42, fill: 0x2a2c32, accent: 0xf2a541 },
    ports: [
      { id: 'power', signal: 'powercon', dir: 'in',  dx: -24, dy: 22 },
      { id: 'dmx',   signal: 'dmx',      dir: 'out', dx: 24,  dy: 22 }
    ]
  },
  quadro: {
    label: 'QUADRO', category: 'power', powerW: 0, zone: 'fixed', shape: 'quadro',
    body: { w: 58, h: 52, fill: 0x3a1f1f, accent: 0xe0503f },
    ports: [
      { id: 'out', signal: 'powercon', dir: 'out', dx: 0, dy: -29 }
    ]
  }
};

const AVAILABLE_STOCK = { sub: 2, top: 2, mixer: 1, par: 4, controller: 1, ampli: 1 };

const POWER_LIMIT_KW = 3.0;
const TOP_ATTACH_RADIUS = 300; // px: quanto lontano può essere trascinata una Testa da un Sub libero

/* La "soluzione" del livello: collegamenti richiesti, PORTA per PORTA (non
   solo componente-componente), così i cavi devono rispettare L/R e la
   sequenza reale della catena (mixer -> finale -> sub -> top, daisy DMX/potenza). */
function buildExpectedConnections () {
  return [
    { a: 'quadro', aPort: 'out', b: 'mixer_1',      bPort: 'power',    signal: 'powercon' },
    { a: 'quadro', aPort: 'out', b: 'controller_1', bPort: 'power',    signal: 'powercon' },
    { a: 'quadro', aPort: 'out', b: 'ampli_1',      bPort: 'power',    signal: 'powercon' },
    { a: 'quadro', aPort: 'out', b: 'sub_1',        bPort: 'power',    signal: 'powercon' },
    { a: 'quadro', aPort: 'out', b: 'sub_2',        bPort: 'power',    signal: 'powercon' },
    { a: 'quadro', aPort: 'out', b: 'par_1',        bPort: 'power_in', signal: 'powercon' },
    { a: 'par_1', aPort: 'power_thru', b: 'par_2', bPort: 'power_in', signal: 'powercon' },
    { a: 'par_2', aPort: 'power_thru', b: 'par_3', bPort: 'power_in', signal: 'powercon' },
    { a: 'par_3', aPort: 'power_thru', b: 'par_4', bPort: 'power_in', signal: 'powercon' },

    { a: 'mixer_1', aPort: 'audio_L', b: 'ampli_1', bPort: 'in_L', signal: 'xlr' },
    { a: 'mixer_1', aPort: 'audio_R', b: 'ampli_1', bPort: 'in_R', signal: 'xlr' },

    { a: 'ampli_1', aPort: 'out_L', b: 'sub_1', bPort: 'spk_in', signal: 'speakon' },
    { a: 'ampli_1', aPort: 'out_R', b: 'sub_2', bPort: 'spk_in', signal: 'speakon' },
    { a: 'sub_1', aPort: 'spk_thru', b: 'top_1', bPort: 'spk_in', signal: 'speakon' },
    { a: 'sub_2', aPort: 'spk_thru', b: 'top_2', bPort: 'spk_in', signal: 'speakon' },

    { a: 'controller_1', aPort: 'dmx', b: 'par_1', bPort: 'dmx_in', signal: 'dmx' },
    { a: 'par_1', aPort: 'dmx_thru', b: 'par_2', bPort: 'dmx_in', signal: 'dmx' },
    { a: 'par_2', aPort: 'dmx_thru', b: 'par_3', bPort: 'dmx_in', signal: 'dmx' },
    { a: 'par_3', aPort: 'dmx_thru', b: 'par_4', bPort: 'dmx_in', signal: 'dmx' }
  ];
}

/* ---------------------------------------------------------------------
   2) STATO DI GIOCO (agnostico dal motore grafico)
   --------------------------------------------------------------------- */
const gameState = {
  placed: {},
  stock: { ...AVAILABLE_STOCK },
  nextIndex: { sub: 1, top: 1, mixer: 1, par: 1, controller: 1, ampli: 1 },
  edges: [],              // { id, a, aPort, b, bPort, signal }
  edgeSeq: 0,
  selectedCable: null,
  pendingPort: null,      // { componentId, portId }
  selectedPieceType: null, // tipo di pezzo "armato" in attesa di un tocco sulla pedana
  visibleSignals: { powercon: true, xlr: true, speakon: true, dmx: true },
  tested: false
};

function totalPowerUsedW () {
  return Object.values(gameState.placed).reduce(
    (sum, c) => sum + (COMPONENT_TYPES[c.type].powerW || 0), 0
  );
}

function getPortDef (componentId, portId) {
  const comp = gameState.placed[componentId];
  if (!comp) return null;
  const def = COMPONENT_TYPES[comp.type];
  if (!def) return null;
  return def.ports.find(p => p.id === portId) || null;
}

/* Un cavo appena creato collegherebbe fromId (lato OUT) -> toId (lato IN).
   Se da toId, seguendo i cavi già esistenti (sempre in verso OUT->IN), si può
   già raggiungere fromId, quel nuovo cavo richiuderebbe un anello: rifiutato. */
function wouldCreateCycle (fromId, toId) {
  if (fromId === toId) return true;
  const visited = new Set([toId]);
  const queue = [toId];
  while (queue.length) {
    const cur = queue.shift();
    for (const e of gameState.edges) {
      if (e.a === cur && !visited.has(e.b)) {
        if (e.b === fromId) return true;
        visited.add(e.b);
        queue.push(e.b);
      }
    }
  }
  return false;
}

function portEdgeExists (a, aPort, b, bPort, signal) {
  return gameState.edges.some(e => e.signal === signal && (
    (e.a === a && e.aPort === aPort && e.b === b && e.bPort === bPort) ||
    (e.a === b && e.aPort === bPort && e.b === a && e.bPort === aPort)
  ));
}

function runValidation () {
  const expected = buildExpectedConnections();
  const failedComponents = new Set();
  let allFound = true;
  let madeCount = 0;

  expected.forEach(exp => {
    if (portEdgeExists(exp.a, exp.aPort, exp.b, exp.bPort, exp.signal)) {
      madeCount++;
    } else {
      allFound = false;
      failedComponents.add(exp.a);
      failedComponents.add(exp.b);
    }
  });

  const usedW = totalPowerUsedW();
  const overBudget = usedW > POWER_LIMIT_KW * 1000;

  return { pass: allFound && !overBudget, failedComponents, overBudget, usedW, madeCount, totalCount: expected.length };
}

function computeQuadroSpec (totalW) {
  if (totalW <= 3680) {
    const amps = Math.max(6, Math.ceil(totalW / 230));
    return { phase: 1, ampsLabel: amps + 'A', phaseLabel: 'Monofase 230V', scale: 1 + Math.min(0.35, (totalW / 3680) * 0.35) };
  }
  const amps = Math.max(16, Math.ceil(totalW / (400 * Math.sqrt(3))));
  return { phase: 3, ampsLabel: amps + 'A', phaseLabel: 'Trifase 400V', scale: 1.5 + Math.min(0.6, ((totalW - 3680) / 20000) * 0.6) };
}

/* ---------------------------------------------------------------------
   3) DOM <-> STATO: header, toolbar, toast
   --------------------------------------------------------------------- */
const el = sel => document.querySelector(sel);

function updatePowerMeter () {
  const usedW = totalPowerUsedW();
  const usedKw = usedW / 1000;
  el('#power-val').textContent = `${usedKw.toFixed(2)} / ${POWER_LIMIT_KW.toFixed(1)} kW`;
  const pct = Math.min(100, (usedKw / POWER_LIMIT_KW) * 100);
  const fill = el('#power-fill');
  fill.style.width = pct + '%';
  fill.classList.toggle('over', usedKw > POWER_LIMIT_KW);
}

function updateConnectionCounter () {
  const result = runValidation();
  const val = el('#conn-val');
  if (val) val.textContent = `${result.madeCount} / ${result.totalCount}`;
  const fill = el('#conn-fill');
  if (fill) fill.style.width = Math.min(100, (result.madeCount / result.totalCount) * 100) + '%';
}

function setCircuitStatus (state) {
  const lamp = el('#circuit-lamp');
  const text = el('#circuit-text');
  lamp.classList.remove('ok', 'error');
  if (state === 'ok') { lamp.classList.add('ok'); text.textContent = 'SHOW READY'; }
  else if (state === 'error') { lamp.classList.add('error'); text.textContent = 'GUASTO IN CATENA'; }
  else { text.textContent = 'DA TESTARE'; }
}

let toastTimer = null;
function showToast (msg, kind) {
  const toast = el('#toast');
  toast.textContent = msg;
  toast.classList.remove('ok');
  if (kind === 'ok') toast.classList.add('ok');
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function updateStockUI () {
  Object.keys(AVAILABLE_STOCK).forEach(type => {
    const remaining = gameState.stock[type];
    const countEl = el('#count-' + type);
    if (countEl) countEl.textContent = '×' + remaining;
    const piece = document.querySelector(`.piece[data-type="${type}"]`);
    if (piece) piece.classList.toggle('depleted', remaining <= 0);
  });
}

/* Tabs */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`.tab-panel[data-panel="${btn.dataset.tab}"]`).classList.add('active');
  });
});

/* Cable selectors */
document.querySelectorAll('.cable-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cable-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gameState.selectedCable = btn.dataset.cable;
    gameState.pendingPort = null;
    disarmPiece();
    if (window.__scene) window.__scene.clearPendingHighlight();
    showToast('Cavo selezionato: ' + btn.textContent.trim() + '. Clicca due porte compatibili per collegarle.');
  });
});

/* Reset */
el('#reset-btn').addEventListener('click', () => {
  if (window.__scene) window.__scene.resetLevel();
});

/* Undo/Redo */
el('#undo-btn').addEventListener('click', () => { if (window.__scene) window.__scene.undo(); });
el('#redo-btn').addEventListener('click', () => { if (window.__scene) window.__scene.redo(); });

/* Livelli: filtri di visibilità per tipo di cavo */
document.querySelectorAll('.layer-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const sig = btn.dataset.signal;
    gameState.visibleSignals[sig] = !gameState.visibleSignals[sig];
    btn.classList.toggle('active', gameState.visibleSignals[sig]);
    if (window.__scene) window.__scene.applyLayerVisibility();
  });
});

/* ---------------------------------------------------------------------
   Piazzamento pezzi — due modalità, per la massima affidabilità su
   qualunque dispositivo:
   1) TOCCA-E-TOCCA (consigliata su touch): tocco breve su un pezzo lo
      "arma" (si illumina), poi un tocco sulla pedana lo piazza — stesso
      schema già usato per selezionare un cavo o spostare un componente.
   2) TRASCINAMENTO: se il puntatore si sposta oltre una piccola soglia
      prima del rilascio, parte un "fantasma" che segue il dito/mouse.
   Entrambe passano dai Pointer Event (mouse, touch e penna unificati).
   --------------------------------------------------------------------- */
const stageWrap = el('#stage-wrap');
const DRAG_THRESHOLD = 8; // px di movimento oltre cui un tocco diventa trascinamento
let pieceDown = null; // { type, pieceEl, startX, startY, dragging, ghost, pointerId }

function stagePointFromClient (clientX, clientY) {
  const r = stageWrap.getBoundingClientRect();
  return {
    over: clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
  };
}

function disarmPiece () {
  gameState.selectedPieceType = null;
  document.querySelectorAll('.piece').forEach(p => p.classList.remove('armed'));
  if (window.__scene) window.__scene.clearDropPreview();
}

function armPiece (type, pieceEl) {
  if (gameState.selectedPieceType === type) { disarmPiece(); showToast('Selezione annullata.'); return; }
  if (window.__scene) { window.__scene.clearMoveSelection(); window.__scene.clearEdgeSelection(); window.__scene.cancelPending(); }
  gameState.selectedPieceType = type;
  document.querySelectorAll('.piece').forEach(p => p.classList.toggle('armed', p === pieceEl));
  showToast('Componente selezionato: tocca la pedana per posizionarlo (o toccalo di nuovo per annullare).');
}

document.querySelectorAll('.piece').forEach(piece => {
  piece.style.touchAction = 'none'; // evita che il browser scrolli la pagina durante il trascinamento
  piece.addEventListener('pointerdown', ev => {
    if (piece.classList.contains('depleted')) return;
    ev.preventDefault();
    pieceDown = {
      type: piece.dataset.type, pieceEl: piece,
      startX: ev.clientX, startY: ev.clientY,
      dragging: false, ghost: null, pointerId: ev.pointerId
    };
  });
});

document.addEventListener('pointermove', ev => {
  if (!pieceDown || ev.pointerId !== pieceDown.pointerId) return;
  const dist = Math.hypot(ev.clientX - pieceDown.startX, ev.clientY - pieceDown.startY);

  if (!pieceDown.dragging && dist > DRAG_THRESHOLD) {
    pieceDown.dragging = true;
    window.__draggedType = pieceDown.type;
    const ghost = pieceDown.pieceEl.cloneNode(true);
    ghost.classList.add('drag-ghost');
    document.body.appendChild(ghost);
    pieceDown.ghost = ghost;
  }
  if (pieceDown.dragging) {
    pieceDown.ghost.style.left = ev.clientX + 'px';
    pieceDown.ghost.style.top = ev.clientY + 'px';
    const { over } = stagePointFromClient(ev.clientX, ev.clientY);
    stageWrap.classList.toggle('drag-over', over);
    if (window.__scene) {
      if (over) window.__scene.previewDropCell(ev.clientX, ev.clientY);
      else window.__scene.clearDropPreview();
    }
  }
});

document.addEventListener('pointerup', ev => {
  if (!pieceDown || ev.pointerId !== pieceDown.pointerId) return;
  const { type, pieceEl, dragging, ghost } = pieceDown;
  pieceDown = null;

  if (dragging) {
    ghost.remove();
    stageWrap.classList.remove('drag-over');
    if (window.__scene) window.__scene.clearDropPreview();
    const { over } = stagePointFromClient(ev.clientX, ev.clientY);
    if (over && window.__scene) {
      if (gameState.stock[type] <= 0) showToast(type.toUpperCase() + ' esaurito per questo livello.');
      else window.__scene.handleExternalDrop(type, ev.clientX, ev.clientY);
    }
    window.__draggedType = null;
  } else {
    armPiece(type, pieceEl);
  }
});

document.addEventListener('pointercancel', ev => {
  if (!pieceDown || ev.pointerId !== pieceDown.pointerId) return;
  if (pieceDown.dragging && pieceDown.ghost) {
    pieceDown.ghost.remove();
    stageWrap.classList.remove('drag-over');
    if (window.__scene) window.__scene.clearDropPreview();
  }
  window.__draggedType = null;
  pieceDown = null;
});

/* Run button */
el('#run-btn').addEventListener('click', () => {
  if (window.__scene) window.__scene.runSoundcheck();
});

/* ---------------------------------------------------------------------
   4) GEOMETRIA DELLA VENUE: griglia isometrica estesa (palco + retropalco
      + regia + ali laterali), tutta all'interno della stessa area di lavoro
   --------------------------------------------------------------------- */
const GAME_W = 1400, GAME_H = 800;
const ORIGIN_X = 645, ORIGIN_Y = 130;
const TILE_W = 110, TILE_H = 55;
const ZOOM_MIN = 0.5, ZOOM_MAX = 2.2;
const PLATFORM_HEIGHT = 20; // px: altezza visiva della pedana rialzata

const VENUE_W = 10, VENUE_H = 8;      // intera area di lavoro (locale)
const STAGE_W = 4, STAGE_H = 4;       // pedana 4x4 m
const STAGE_ORIGIN_X = 3, STAGE_ORIGIN_Y = 2; // la pedana è centrata, con 2 righe di retropalco dietro e 2 di regia davanti

function gridToScreen (gx, gy) {
  return {
    x: ORIGIN_X + (gx - gy) * (TILE_W / 2),
    y: ORIGIN_Y + (gx + gy) * (TILE_H / 2)
  };
}

function screenToCell (px, py) {
  const relX = px - ORIGIN_X;
  const relY = py - ORIGIN_Y;
  const gxRaw = (relX / (TILE_W / 2) + relY / (TILE_H / 2)) / 2;
  const gyRaw = (relY / (TILE_H / 2) - relX / (TILE_W / 2)) / 2;
  const cx = Math.min(VENUE_W - 1, Math.max(0, Math.floor(gxRaw)));
  const cy = Math.min(VENUE_H - 1, Math.max(0, Math.floor(gyRaw)));
  return { cx, cy };
}

function isStageCell (cx, cy) {
  return cx >= STAGE_ORIGIN_X && cx < STAGE_ORIGIN_X + STAGE_W &&
         cy >= STAGE_ORIGIN_Y && cy < STAGE_ORIGIN_Y + STAGE_H;
}
function isRegiaCell (cx, cy) {
  return cy >= STAGE_ORIGIN_Y + STAGE_H && cy < VENUE_H;
}

const ZONE_PREDICATES = {
  mixer: isStageCell,
  controller: isStageCell,
  par: isStageCell,
  ampli: isRegiaCell,
  sub: (cx, cy) => !isStageCell(cx, cy)
};

/* ---------------------------------------------------------------------
   5) INSTRADAMENTO CAVI: percorso diretto sul palco, "a corridoio" con
      angoli smussati per tutto ciò che deve aggirare la pedana
   --------------------------------------------------------------------- */
function computeRoutePoints (from, to, stageBox, margin) {
  const boxMinX = stageBox.minX - margin, boxMaxX = stageBox.maxX + margin;
  const boxMinY = stageBox.minY - margin, boxMaxY = stageBox.maxY + margin;
  const segMinX = Math.min(from.x, to.x), segMaxX = Math.max(from.x, to.x);
  const segMinY = Math.min(from.y, to.y), segMaxY = Math.max(from.y, to.y);
  const overlaps = segMaxX > boxMinX && segMinX < boxMaxX && segMaxY > boxMinY && segMinY < boxMaxY;
  if (!overlaps) return [from, to];

  const midX = (from.x + to.x) / 2;
  const goLeft = Math.abs(midX - boxMinX) <= Math.abs(midX - boxMaxX);
  const railX = goLeft ? boxMinX : boxMaxX;
  return [from, { x: railX, y: from.y }, { x: railX, y: to.y }, to];
}

function strokeRoutedPath (g, pts, color, width, chamfer) {
  g.lineStyle(width, color, 1);
  if (pts.length <= 2) { g.lineBetween(pts[0].x, pts[0].y, pts[1].x, pts[1].y); return; }
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1], corner = pts[i], next = pts[i + 1];
    const d1 = Math.hypot(corner.x - prev.x, corner.y - prev.y) || 1;
    const d2 = Math.hypot(next.x - corner.x, next.y - corner.y) || 1;
    const c = Math.min(chamfer, d1 / 2, d2 / 2);
    if (c > 0.5) {
      g.lineTo(corner.x - (corner.x - prev.x) / d1 * c, corner.y - (corner.y - prev.y) / d1 * c);
      g.lineTo(corner.x + (next.x - corner.x) / d2 * c, corner.y + (next.y - corner.y) / d2 * c);
    } else {
      g.lineTo(corner.x, corner.y);
    }
  }
  g.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  g.strokePath();
}

function pointToSegmentDistance (px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function pointAlongPolyline (pts, t) {
  const segLens = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segLens.push(l); total += l;
  }
  let target = total * t;
  for (let i = 0; i < segLens.length; i++) {
    if (target <= segLens[i] || i === segLens.length - 1) {
      const ratio = segLens[i] > 0 ? Math.min(1, Math.max(0, target / segLens[i])) : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * ratio, y: pts[i].y + (pts[i + 1].y - pts[i].y) * ratio };
    }
    target -= segLens[i];
  }
  return pts[0];
}

/* ---------------------------------------------------------------------
   6) PHASER: scena unica
   --------------------------------------------------------------------- */
class StageScene extends Phaser.Scene {
  constructor () { super('stage'); }

  create () {
    window.__scene = this;

    this.occupied = {};
    this.compVisuals = {};
    this.moveSelected = null;
    this.selectedEdgeId = null;
    this.edgeDeleteBtn = null;
    this.isPanning = false;
    this.panStart = null;
    this.floorDown = null;
    this.lastPinchDist = null;

    this.edgeGraphics = this.add.graphics().setDepth(5);
    this.previewGraphics = this.add.graphics().setDepth(6);

    this.drawGround();
    this.drawZoneOutlines();
    this.drawStagePlatform();
    this.drawQuadro();
    this.updateQuadroVisual();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' });
    this.input.keyboard.on('keydown-DELETE', () => { if (this.selectedEdgeId != null) this.deleteSelectedEdge(); });
    this.input.keyboard.on('keydown-BACKSPACE', () => { if (this.selectedEdgeId != null) this.deleteSelectedEdge(); });
    this.input.keyboard.on('keydown-Z', event => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.shiftKey) this.redo(); else this.undo();
    });
    this.input.keyboard.on('keydown-Y', event => { if (event.ctrlKey || event.metaKey) this.redo(); });

    this.setupCameraControls();

    this.history = [];
    this.historyIndex = -1;
    this.pushHistory();
  }

  /* ---------------- movimento: zoom (rotellina/pizzico/pulsanti),
     pan (tasto destro o trascinamento sul vuoto), frecce/WASD ---------------- */
  setupCameraControls () {
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      this.adjustZoom(deltaY > 0 ? -0.12 : 0.12);
    });

    this.game.canvas.addEventListener('contextmenu', e => e.preventDefault());

    this.input.on('pointerdown', pointer => {
      if (pointer.rightButtonDown()) {
        this.isPanning = true;
        this.panStart = { x: pointer.x, y: pointer.y, scrollX: this.cameras.main.scrollX, scrollY: this.cameras.main.scrollY };
      }
    });

    this.input.on('pointermove', pointer => {
      const cam = this.cameras.main;

      if (this.isPanning && pointer.rightButtonDown() && this.panStart) {
        cam.scrollX = this.panStart.scrollX - (pointer.x - this.panStart.x) / cam.zoom;
        cam.scrollY = this.panStart.scrollY - (pointer.y - this.panStart.y) / cam.zoom;
      }

      if (this.floorDown && pointer.leftButtonDown()) {
        const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.floorDown.x, this.floorDown.y);
        if (dist > 6) {
          if (!this.floorDown.moved) {
            this.floorDown.panScrollX = cam.scrollX;
            this.floorDown.panScrollY = cam.scrollY;
            this.floorDown.panStartX = pointer.x;
            this.floorDown.panStartY = pointer.y;
          }
          this.floorDown.moved = true;
          cam.scrollX = this.floorDown.panScrollX - (pointer.x - this.floorDown.panStartX) / cam.zoom;
          cam.scrollY = this.floorDown.panScrollY - (pointer.y - this.floorDown.panStartY) / cam.zoom;
        }
      }

      const p1 = this.input.pointer1, p2 = this.input.pointer2;
      if (p1 && p2 && p1.isDown && p2.isDown) {
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this.lastPinchDist) this.adjustZoom((dist - this.lastPinchDist) * 0.004);
        this.lastPinchDist = dist;
      } else {
        this.lastPinchDist = null;
      }
    });

    this.input.on('pointerup', () => {
      this.isPanning = false;
      this.panStart = null;
      this.floorDown = null;
    });

    el('#zoom-in').addEventListener('click', () => this.adjustZoom(0.25));
    el('#zoom-out').addEventListener('click', () => this.adjustZoom(-0.25));
    el('#zoom-reset').addEventListener('click', () => this.resetView());
  }

  update (time, delta) {
    const cam = this.cameras.main;
    const speed = (420 * (delta / 1000)) / cam.zoom;
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= speed;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dx += speed;
    if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= speed;
    if (this.cursors.down.isDown || this.wasd.down.isDown) dy += speed;
    if (dx || dy) { cam.scrollX += dx; cam.scrollY += dy; }
  }

  adjustZoom (delta) {
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(cam.zoom + delta, ZOOM_MIN, ZOOM_MAX));
  }

  resetView () {
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);
  }

  /* ---------------- disegno venue: terreno, zone, pedana ---------------- */
  drawGround () {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x1b1c22, 1);
    const p0 = gridToScreen(0, 0), p1 = gridToScreen(VENUE_W, 0),
          p2 = gridToScreen(VENUE_W, VENUE_H), p3 = gridToScreen(0, VENUE_H);
    g.beginPath();
    g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.lineTo(p3.x, p3.y);
    g.closePath(); g.fillPath();

    g.setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_W, GAME_H), Phaser.Geom.Rectangle.Contains);
    g.on('pointerdown', pointer => {
      if (pointer.rightButtonDown()) return;
      this.floorDown = { x: pointer.x, y: pointer.y, moved: false };
    });
    g.on('pointerup', pointer => {
      if (!this.floorDown) return;
      const moved = this.floorDown.moved;
      this.floorDown = null;
      if (moved) return;
      if (gameState.selectedPieceType) { this.placeArmedPieceAt(pointer.worldX, pointer.worldY); return; }
      if (this.moveSelected) { this.attemptMoveTo(pointer.worldX, pointer.worldY); return; }
      const hitEdge = this.findEdgeAt(pointer.worldX, pointer.worldY);
      if (hitEdge) {
        if (this.selectedEdgeId === hitEdge.id) this.clearEdgeSelection();
        else this.selectEdge(hitEdge);
        return;
      }
      this.clearEdgeSelection();
      this.cancelPending();
    });
    this.floorGraphics = g;
  }

  drawZoneOutline (corners, label) {
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(1.5, 0x34363e, 0.85);
    const pts = corners.map(c => gridToScreen(c[0], c[1]));
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath(); g.strokePath();
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    this.add.text(cx, cy, label, { fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#585b64' })
      .setOrigin(0.5).setDepth(1);
  }

  drawZoneOutlines () {
    this.drawZoneOutline([[0, 0], [VENUE_W, 0], [VENUE_W, STAGE_ORIGIN_Y], [0, STAGE_ORIGIN_Y]], 'Retropalco');
    this.drawZoneOutline([[0, STAGE_ORIGIN_Y + STAGE_H], [VENUE_W, STAGE_ORIGIN_Y + STAGE_H], [VENUE_W, VENUE_H], [0, VENUE_H]], 'Regia');
  }

  drawStagePlatform () {
    const gx0 = STAGE_ORIGIN_X, gy0 = STAGE_ORIGIN_Y, W = STAGE_W, H = STAGE_H;
    const topV = gridToScreen(gx0, gy0), rightV = gridToScreen(gx0 + W, gy0),
          bottomV = gridToScreen(gx0 + W, gy0 + H), leftV = gridToScreen(gx0, gy0 + H);

    const sides = this.add.graphics().setDepth(2);
    sides.fillStyle(0x2b241c, 1);
    sides.beginPath();
    sides.moveTo(rightV.x, rightV.y); sides.lineTo(bottomV.x, bottomV.y);
    sides.lineTo(bottomV.x, bottomV.y + PLATFORM_HEIGHT); sides.lineTo(rightV.x, rightV.y + PLATFORM_HEIGHT);
    sides.closePath(); sides.fillPath();
    sides.fillStyle(0x231d17, 1);
    sides.beginPath();
    sides.moveTo(bottomV.x, bottomV.y); sides.lineTo(leftV.x, leftV.y);
    sides.lineTo(leftV.x, leftV.y + PLATFORM_HEIGHT); sides.lineTo(bottomV.x, bottomV.y + PLATFORM_HEIGHT);
    sides.closePath(); sides.fillPath();

    const top = this.add.graphics().setDepth(3);
    top.fillStyle(0x3a3226, 1);
    top.beginPath();
    top.moveTo(topV.x, topV.y); top.lineTo(rightV.x, rightV.y);
    top.lineTo(bottomV.x, bottomV.y); top.lineTo(leftV.x, leftV.y);
    top.closePath(); top.fillPath();

    top.lineStyle(1, 0x4a3f30, 0.9);
    for (let i = 0; i <= W; i++) {
      const a = gridToScreen(gx0 + i, gy0), b = gridToScreen(gx0 + i, gy0 + H);
      top.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let j = 0; j <= H; j++) {
      const a = gridToScreen(gx0, gy0 + j), b = gridToScreen(gx0 + W, gy0 + j);
      top.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let i = 0; i < W; i++) {
      for (let j = 0; j < H; j++) {
        if ((i + j) % 2 === 0) continue;
        const p0 = gridToScreen(gx0 + i, gy0 + j), p1 = gridToScreen(gx0 + i + 1, gy0 + j),
              p2 = gridToScreen(gx0 + i + 1, gy0 + j + 1), p3 = gridToScreen(gx0 + i, gy0 + j + 1);
        top.fillStyle(0x453b2c, 0.5);
        top.beginPath();
        top.moveTo(p0.x, p0.y); top.lineTo(p1.x, p1.y); top.lineTo(p2.x, p2.y); top.lineTo(p3.x, p3.y);
        top.closePath(); top.fillPath();
      }
    }
    top.lineStyle(2, 0xf2a541, 0.5);
    top.beginPath();
    top.moveTo(topV.x, topV.y); top.lineTo(rightV.x, rightV.y);
    top.lineTo(bottomV.x, bottomV.y); top.lineTo(leftV.x, leftV.y);
    top.closePath(); top.strokePath();

    this.stageBox = {
      minX: Math.min(topV.x, rightV.x, bottomV.x, leftV.x),
      maxX: Math.max(topV.x, rightV.x, bottomV.x, leftV.x),
      minY: Math.min(topV.y, rightV.y, bottomV.y, leftV.y),
      maxY: Math.max(topV.y, rightV.y, bottomV.y, leftV.y) + PLATFORM_HEIGHT
    };
  }

  drawQuadro () {
    const pos = gridToScreen(STAGE_ORIGIN_X + STAGE_W / 2, STAGE_ORIGIN_Y / 2);
    const def = COMPONENT_TYPES.quadro;
    const visual = this.buildComponentVisual('quadro', def, pos.x, pos.y);
    const specLabel = this.add.text(0, def.body.h / 2 + 24, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '9.5px', color: '#8b8e98', align: 'center'
    }).setOrigin(0.5);
    visual.container.add(specLabel);
    visual.specLabel = specLabel;
    this.compVisuals['quadro'] = visual;
    gameState.placed['quadro'] = { id: 'quadro', type: 'quadro', gx: null, gy: null, screen: pos, zone: 'ground' };
  }

  updateQuadroVisual () {
    const spec = computeQuadroSpec(totalPowerUsedW());
    const qv = this.compVisuals['quadro'];
    if (!qv) return;
    qv.container.setScale(spec.scale);
    if (qv.specLabel) qv.specLabel.setText(spec.phaseLabel + '\n' + spec.ampsLabel);
  }

  /* ---------------- disegno di un componente: forma dedicata per tipo ---------------- */
  drawComponentBody (g, def) {
    const w = def.body.w, h = def.body.h;
    switch (def.shape) {
      case 'sub': {
        g.fillStyle(def.body.fill, 1); g.lineStyle(2, def.body.accent, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 5); g.strokeRoundedRect(-w / 2, -h / 2, w, h, 5);
        const r = Math.min(w, h) * 0.34;
        g.fillStyle(0x121317, 1); g.fillCircle(0, 2, r);
        g.lineStyle(2, def.body.accent, 1); g.strokeCircle(0, 2, r);
        break;
      }
      case 'top': {
        const wTop = w * 0.55;
        g.fillStyle(def.body.fill, 1); g.lineStyle(2, def.body.accent, 1);
        g.beginPath();
        g.moveTo(-wTop / 2, -h / 2); g.lineTo(wTop / 2, -h / 2);
        g.lineTo(w / 2, h / 2); g.lineTo(-w / 2, h / 2);
        g.closePath(); g.fillPath(); g.strokePath();
        g.fillStyle(0x121317, 1); g.fillCircle(0, -h * 0.12, Math.min(w, h) * 0.18);
        break;
      }
      case 'par': {
        const r = Math.min(w, h - 10) / 2;
        g.fillStyle(0x1c1d22, 1);
        g.fillRect(-3, r - 6, 6, h / 2 - (r - 6));
        g.fillStyle(def.body.fill, 1); g.lineStyle(2, def.body.accent, 1);
        g.fillCircle(0, -4, r); g.strokeCircle(0, -4, r);
        g.fillStyle(0x121317, 1); g.fillCircle(0, -4, r * 0.5);
        g.lineStyle(1.5, def.body.accent, 0.9); g.strokeCircle(0, -4, r * 0.5);
        break;
      }
      case 'ampli': {
        g.fillStyle(def.body.fill, 1); g.lineStyle(2, def.body.accent, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 5); g.strokeRoundedRect(-w / 2, -h / 2, w, h, 5);
        [-w * 0.2, w * 0.2].forEach(mx => {
          g.lineStyle(2, def.body.accent, 0.9);
          g.beginPath();
          g.arc(mx, -2, 9, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
          g.strokePath();
          g.closePath();
          g.fillStyle(0xf2c53d, 1); g.fillCircle(mx, -2, 1.6);
        });
        break;
      }
      case 'quadro': {
        g.fillStyle(def.body.fill, 1); g.lineStyle(2.5, def.body.accent, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 5); g.strokeRoundedRect(-w / 2, -h / 2, w, h, 5);
        [-w * 0.18, w * 0.18].forEach(mx => {
          g.fillStyle(0x1c1d22, 1);
          g.fillRoundedRect(mx - 6, -h * 0.18, 12, 20, 2);
          g.fillStyle(def.body.accent, 1);
          g.fillRect(mx - 4, -h * 0.18 + 2, 8, 7);
        });
        break;
      }
      default: { // 'rackbox' — mixer, controller
        g.fillStyle(def.body.fill, 1); g.lineStyle(2, def.body.accent, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 5); g.strokeRoundedRect(-w / 2, -h / 2, w, h, 5);
        const n = 4, usableW = w * 0.68;
        for (let i = 0; i < n; i++) {
          const dx = -usableW / 2 + (usableW / (n - 1)) * i;
          g.fillStyle(def.body.accent, 0.85);
          g.fillCircle(dx, -h / 2 + 8, 2.1);
        }
      }
    }
  }

  buildComponentVisual (id, def, x, y) {
    const c = this.add.container(x, y).setDepth(10);

    const body = this.add.graphics();
    this.drawComponentBody(body, def);
    c.add(body);

    const glow = this.add.graphics();
    c.add(glow);

    const label = this.add.text(0, def.shape === 'par' || def.shape === 'top' ? -def.body.h / 2 - 8 : 0, def.label, {
      fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#eee9df'
    }).setOrigin(0.5);
    c.add(label);

    const compType = id.indexOf('_') >= 0 ? id.split('_')[0] : id;
    const idLabel = this.add.text(0, def.body.h / 2 + 11, id.replace(/_/g, ' '), {
      fontFamily: 'Inter, sans-serif', fontSize: '9.5px', color: '#8b8e98'
    }).setOrigin(0.5);
    if (compType !== 'quadro' && compType !== 'top') {
      idLabel.setInteractive({ useHandCursor: true });
      idLabel.on('pointerdown', (pointer, lx, ly, event) => {
        if (event && event.stopPropagation) event.stopPropagation();
        this.handleMoveSelect(id);
      });
    }
    c.add(idLabel);

    const portDots = {};
    def.ports.forEach(p => {
      const dot = this.add.circle(p.dx, p.dy, 7, SIGNAL_COLOR[p.signal], 1)
        .setStrokeStyle(2, 0x141519)
        .setInteractive({ useHandCursor: true });
      dot.on('pointerdown', (pointer, lx, ly, event) => {
        if (event && event.stopPropagation) event.stopPropagation();
        this.handlePortClick(id, p.id, p.signal);
      });
      c.add(dot);
      portDots[p.id] = dot;
    });

    return { container: c, glow, portDots, idLabel, def };
  }

  setGlow (v, on, color) {
    v.glow.clear();
    if (!on) { v.glow.setAlpha(0); return; }
    v.glow.setAlpha(1);
    v.glow.lineStyle(3, color || 0xe0503f, 1);
    if (v.def.shape === 'par') {
      const r = Math.min(v.def.body.w, v.def.body.h - 10) / 2;
      v.glow.strokeCircle(0, -4, r + 6);
    } else {
      v.glow.strokeRoundedRect(-v.def.body.w / 2 - 4, -v.def.body.h / 2 - 4, v.def.body.w + 8, v.def.body.h + 8, 8);
    }
  }

  /* ---------------- conversioni coordinate ---------------- */
  clientToWorld (clientX, clientY) {
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = GAME_W / rect.width, scaleY = GAME_H / rect.height;
    const localX = (clientX - rect.left) * scaleX, localY = (clientY - rect.top) * scaleY;
    return this.cameras.main.getWorldPoint(localX, localY);
  }

  nearestAllowedCell (type, wx, wy) {
    const pred = ZONE_PREDICATES[type] || (() => true);
    const raw = screenToCell(wx, wy);
    if (pred(raw.cx, raw.cy)) return raw;
    let best = null, bestDist = Infinity;
    for (let gx = 0; gx < VENUE_W; gx++) {
      for (let gy = 0; gy < VENUE_H; gy++) {
        if (!pred(gx, gy)) continue;
        const d = Math.hypot(gx - raw.cx, gy - raw.cy);
        if (d < bestDist) { bestDist = d; best = { cx: gx, cy: gy }; }
      }
    }
    return best || raw;
  }

  /* ---------------- anteprima durante il trascinamento dalla toolbar ---------------- */
  previewDropCell (clientX, clientY) {
    const type = window.__draggedType;
    const world = this.clientToWorld(clientX, clientY);
    this.previewGraphics.clear();

    if (type === 'top') {
      let bestSub = null, bestDist = Infinity;
      Object.values(gameState.placed).forEach(c => {
        if (c.type === 'sub' && !c.hasTop) {
          const v = this.compVisuals[c.id];
          const d = Phaser.Math.Distance.Between(world.x, world.y, v.container.x, v.container.y);
          if (d < bestDist) { bestDist = d; bestSub = c; }
        }
      });
      if (bestSub && bestDist < TOP_ATTACH_RADIUS) {
        const v = this.compVisuals[bestSub.id];
        this.previewGraphics.lineStyle(3, 0x49b06a, 0.9);
        this.previewGraphics.strokeCircle(v.container.x, v.container.y, 34);
      }
      return;
    }

    const { cx, cy } = type ? this.nearestAllowedCell(type, world.x, world.y) : screenToCell(world.x, world.y);
    const key = cx + ',' + cy;
    const occupied = !!this.occupied[key];
    const p0 = gridToScreen(cx, cy), p1 = gridToScreen(cx + 1, cy),
          p2 = gridToScreen(cx + 1, cy + 1), p3 = gridToScreen(cx, cy + 1);
    this.previewGraphics.fillStyle(occupied ? 0xe0503f : 0x49b06a, 0.35);
    this.previewGraphics.lineStyle(2, occupied ? 0xe0503f : 0x49b06a, 0.95);
    this.previewGraphics.beginPath();
    this.previewGraphics.moveTo(p0.x, p0.y); this.previewGraphics.lineTo(p1.x, p1.y);
    this.previewGraphics.lineTo(p2.x, p2.y); this.previewGraphics.lineTo(p3.x, p3.y);
    this.previewGraphics.closePath();
    this.previewGraphics.fillPath(); this.previewGraphics.strokePath();
  }

  clearDropPreview () { this.previewGraphics.clear(); }

  /* ---------------- piazzamento componenti ---------------- */
  handleExternalDrop (type, clientX, clientY) {
    this.clearDropPreview();
    const world = this.clientToWorld(clientX, clientY);
    this.placeComponentAt(type, world.x, world.y);
  }

  /* piazza un componente in una posizione di mondo: usata sia dal trascinamento
     (via handleExternalDrop) sia dal tocco-e-tocco (via placeArmedPieceAt) */
  placeComponentAt (type, worldX, worldY) {
    if (gameState.stock[type] <= 0) { showToast(type.toUpperCase() + ' esaurito per questo livello.'); return; }

    if (type === 'top') { this.attachTopToNearestSub({ x: worldX, y: worldY }); return; }

    const { cx, cy } = this.nearestAllowedCell(type, worldX, worldY);
    const key = cx + ',' + cy;
    if (this.occupied[key]) { showToast('Cella occupata: scegli un altro punto.'); return; }

    const idx = gameState.nextIndex[type]++;
    const id = `${type}_${idx}`;
    gameState.stock[type]--;
    updateStockUI();

    const pos = gridToScreen(cx + 0.5, cy + 0.5);
    const def = COMPONENT_TYPES[type];
    const visual = this.buildComponentVisual(id, def, pos.x, pos.y);
    this.compVisuals[id] = visual;
    this.occupied[key] = id;

    const zone = def.zone === 'stage' ? 'stage' : 'ground';
    gameState.placed[id] = { id, type, gx: cx, gy: cy, screen: pos, zone, hasTop: type === 'sub' ? null : undefined };

    this.updateQuadroVisual();
    setCircuitStatus('untested');
    gameState.tested = false;
    this.pushHistory();
  }

  /* piazza il pezzo attualmente "armato" dalla toolbar nel punto toccato sulla
     pedana; resta armato per piazzamenti multipli finché non finisce la scorta */
  placeArmedPieceAt (worldX, worldY) {
    const type = gameState.selectedPieceType;
    if (!type) return;
    this.placeComponentAt(type, worldX, worldY);
    if (gameState.stock[type] <= 0) disarmPiece();
  }

  attachTopToNearestSub (world) {
    let bestSub = null, bestDist = Infinity;
    Object.values(gameState.placed).forEach(c => {
      if (c.type === 'sub' && !c.hasTop) {
        const v = this.compVisuals[c.id];
        const d = Phaser.Math.Distance.Between(world.x, world.y, v.container.x, v.container.y);
        if (d < bestDist) { bestDist = d; bestSub = c; }
      }
    });
    if (!bestSub || bestDist > TOP_ATTACH_RADIUS) {
      showToast('Trascina la Testa sopra un Sub libero per agganciarla.');
      return;
    }

    const idx = gameState.nextIndex.top++;
    const id = 'top_' + idx;
    gameState.stock.top--;
    updateStockUI();

    const subVisual = this.compVisuals[bestSub.id];
    const subDef = COMPONENT_TYPES.sub, topDef = COMPONENT_TYPES.top;
    const offY = -(subDef.body.h / 2 + topDef.body.h / 2 + 6);
    const pos = { x: subVisual.container.x, y: subVisual.container.y + offY };

    const visual = this.buildComponentVisual(id, topDef, pos.x, pos.y);
    this.compVisuals[id] = visual;
    bestSub.hasTop = id;
    gameState.placed[id] = { id, type: 'top', parentSubId: bestSub.id, zone: 'ground', screen: pos };

    this.updateQuadroVisual();
    setCircuitStatus('untested');
    gameState.tested = false;
    showToast('Testa agganciata sopra ' + bestSub.id.replace('_', ' ') + '.', 'ok');
    this.pushHistory();
  }

  /* ---------------- wiring ---------------- */
  handlePortClick (componentId, portId, signal) {
    this.clearMoveSelection();
    this.clearEdgeSelection();
    disarmPiece();
    if (!gameState.selectedCable) { showToast('Seleziona prima un tipo di cavo nella scheda "Cavi".'); return; }
    if (signal !== gameState.selectedCable) { showToast('Questo cavo non è compatibile con questa porta.'); return; }

    if (!gameState.pendingPort) {
      gameState.pendingPort = { componentId, portId };
      this.highlightPending(componentId, portId, true);
      return;
    }
    const pending = gameState.pendingPort;
    if (pending.componentId === componentId && pending.portId === portId) { this.cancelPending(); return; }
    if (pending.componentId === componentId) { showToast('Non puoi collegare un componente a se stesso.'); return; }

    const pendingDef = getPortDef(pending.componentId, pending.portId);
    const currentDef = getPortDef(componentId, portId);
    if (!pendingDef || !currentDef) { this.cancelPending(); return; }

    if (pendingDef.dir === currentDef.dir) {
      showToast(pendingDef.dir === 'out'
        ? 'Due uscite non si collegano tra loro: serve una porta IN.'
        : 'Due ingressi non si collegano tra loro: serve una porta OUT.');
      return;
    }

    const outSide = pendingDef.dir === 'out' ? pending : { componentId, portId };
    const inSide = pendingDef.dir === 'out' ? { componentId, portId } : pending;

    if (wouldCreateCycle(outSide.componentId, inSide.componentId)) {
      showToast('Questo collegamento richiuderebbe un anello nel circuito: non è consentito.');
      return;
    }

    gameState.edges.push({
      id: gameState.edgeSeq++,
      a: outSide.componentId, aPort: outSide.portId,
      b: inSide.componentId, bPort: inSide.portId,
      signal: gameState.selectedCable
    });
    this.redrawEdges();

    this.highlightPending(pending.componentId, pending.portId, false);
    gameState.pendingPort = null;
    setCircuitStatus('untested');
    gameState.tested = false;
    this.pushHistory();
  }

  redrawEdges () {
    this.edgeGraphics.clear();
    gameState.edges.forEach(e => {
      if (!gameState.visibleSignals[e.signal]) { e._pts = null; return; }
      const from = this.getPortScreenPos(e.a, e.aPort);
      const to = this.getPortScreenPos(e.b, e.bPort);
      if (!from || !to) { e._pts = null; return; }
      const zoneA = gameState.placed[e.a] && gameState.placed[e.a].zone;
      const zoneB = gameState.placed[e.b] && gameState.placed[e.b].zone;
      const isSelected = e.id === this.selectedEdgeId;
      const color = isSelected ? 0xf2a541 : SIGNAL_COLOR[e.signal];
      const width = isSelected ? 5 : 3;
      let pts;
      if (zoneA === 'stage' && zoneB === 'stage') {
        pts = [from, to];
        this.edgeGraphics.lineStyle(width, color, 1);
        this.edgeGraphics.lineBetween(from.x, from.y, to.x, to.y);
      } else {
        pts = computeRoutePoints(from, to, this.stageBox, 30);
        strokeRoutedPath(this.edgeGraphics, pts, color, width, 18);
      }
      e._pts = pts;
    });
    this.refreshEdgeDeleteButton();
    updateConnectionCounter();
  }

  /* ---------------- selezione ed eliminazione di un cavo ---------------- */
  findEdgeAt (wx, wy) {
    let best = null, bestDist = 12;
    gameState.edges.forEach(e => {
      if (!e._pts) return;
      for (let i = 0; i < e._pts.length - 1; i++) {
        const d = pointToSegmentDistance(wx, wy, e._pts[i].x, e._pts[i].y, e._pts[i + 1].x, e._pts[i + 1].y);
        if (d < bestDist) { bestDist = d; best = e; }
      }
    });
    return best;
  }

  selectEdge (edge) {
    this.clearMoveSelection();
    this.cancelPending();
    this.selectedEdgeId = edge.id;
    this.redrawEdges();
    showToast('Cavo selezionato: clicca la ✕ per eliminarlo (o Canc), clicca altrove per deselezionare.');
  }

  clearEdgeSelection () {
    if (this.selectedEdgeId == null) return;
    this.selectedEdgeId = null;
    this.redrawEdges();
  }

  refreshEdgeDeleteButton () {
    if (this.edgeDeleteBtn) { this.edgeDeleteBtn.destroy(); this.edgeDeleteBtn = null; }
    if (this.selectedEdgeId == null) return;
    const edge = gameState.edges.find(e => e.id === this.selectedEdgeId);
    if (!edge || !edge._pts) { this.selectedEdgeId = null; return; }
    const mid = pointAlongPolyline(edge._pts, 0.5);
    const btn = this.add.container(mid.x, mid.y).setDepth(60);
    const bg = this.add.circle(0, 0, 11, 0x1c1d22, 1).setStrokeStyle(2, 0xf2a541, 1);
    const txt = this.add.text(0, 0, '✕', { fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#f2a541', fontStyle: 'bold' }).setOrigin(0.5);
    btn.add(bg); btn.add(txt);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', (pointer, lx, ly, event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      this.deleteSelectedEdge();
    });
    this.edgeDeleteBtn = btn;
  }

  deleteSelectedEdge () {
    if (this.selectedEdgeId == null) return;
    const idx = gameState.edges.findIndex(e => e.id === this.selectedEdgeId);
    if (idx >= 0) gameState.edges.splice(idx, 1);
    this.selectedEdgeId = null;
    this.redrawEdges();
    setCircuitStatus('untested');
    gameState.tested = false;
    showToast('Cavo eliminato.', 'ok');
    this.pushHistory();
  }

  /* ---------------- livelli: filtro di visibilità per tipo di cavo ---------------- */
  applyLayerVisibility () {
    this.selectedEdgeId = null;
    this.redrawEdges();
    Object.values(gameState.placed).forEach(c => {
      const def = COMPONENT_TYPES[c.type];
      const v = this.compVisuals[c.id];
      if (!v || !def) return;
      def.ports.forEach(p => {
        const dot = v.portDots[p.id];
        if (dot) dot.setAlpha(gameState.visibleSignals[p.signal] ? 1 : 0.22);
      });
    });
  }

  getPortScreenPos (componentId, portId) {
    const v = this.compVisuals[componentId];
    if (!v) return null;
    const dot = v.portDots[portId];
    if (!dot) return null;
    return { x: v.container.x + dot.x * v.container.scaleX, y: v.container.y + dot.y * v.container.scaleY };
  }

  highlightPending (componentId, portId, on) {
    const dot = this.compVisuals[componentId].portDots[portId];
    dot.setStrokeStyle(on ? 3 : 2, on ? 0xf2a541 : 0x141519);
    dot.setScale(on ? 1.3 : 1);
  }

  cancelPending () {
    if (!gameState.pendingPort) return;
    this.highlightPending(gameState.pendingPort.componentId, gameState.pendingPort.portId, false);
    gameState.pendingPort = null;
  }

  clearPendingHighlight () { this.cancelPending(); }

  /* ---------------- riposizionamento componenti già piazzati ---------------- */
  handleMoveSelect (id) {
    this.cancelPending();
    this.clearEdgeSelection();
    disarmPiece();
    if (this.moveSelected === id) { this.clearMoveSelection(); showToast('Spostamento annullato.'); return; }
    this.clearMoveSelection();
    this.moveSelected = id;
    this.setGlow(this.compVisuals[id], true, 0xf2a541);
    showToast('Componente selezionato: clicca una cella libera per spostarlo.');
  }

  clearMoveSelection () {
    if (!this.moveSelected) return;
    const v = this.compVisuals[this.moveSelected];
    if (v) this.setGlow(v, false);
    this.moveSelected = null;
  }

  attemptMoveTo (worldX, worldY) {
    const id = this.moveSelected;
    const comp = gameState.placed[id];
    if (!comp) { this.moveSelected = null; return; }

    const { cx, cy } = this.nearestAllowedCell(comp.type, worldX, worldY);
    const key = cx + ',' + cy;
    const oldKey = comp.gx + ',' + comp.gy;
    if (key !== oldKey && this.occupied[key]) { showToast('Cella occupata: scegli un punto libero.'); return; }

    delete this.occupied[oldKey];
    this.occupied[key] = id;
    comp.gx = cx; comp.gy = cy;
    const pos = gridToScreen(cx + 0.5, cy + 0.5);
    comp.screen = pos;
    this.compVisuals[id].container.setPosition(pos.x, pos.y);

    if (comp.type === 'sub' && comp.hasTop) {
      const topComp = gameState.placed[comp.hasTop];
      const subDef = COMPONENT_TYPES.sub, topDef = COMPONENT_TYPES.top;
      const offY = -(subDef.body.h / 2 + topDef.body.h / 2 + 6);
      const topPos = { x: pos.x, y: pos.y + offY };
      topComp.screen = topPos;
      this.compVisuals[topComp.id].container.setPosition(topPos.x, topPos.y);
    }

    this.clearMoveSelection();
    this.redrawEdges();
    setCircuitStatus('untested');
    gameState.tested = false;
    showToast('Componente riposizionato.', 'ok');
    this.pushHistory();
  }

  /* ---------------- SOUNDCHECK ---------------- */
  runSoundcheck () {
    const result = runValidation();
    gameState.tested = true;
    Object.values(this.compVisuals).forEach(v => this.setGlow(v, false));

    if (result.pass) {
      setCircuitStatus('ok');
      showToast('Catena di segnale e potenza integra su tutti i componenti.', 'ok');
      this.playSuccessSequence();
    } else {
      setCircuitStatus('error');
      const msg = result.overBudget
        ? 'Potenza richiesta oltre il limite disponibile.'
        : 'Circuito incompleto: componenti evidenziati in rosso non ricevono segnale o alimentazione.';
      showToast(msg);
      result.failedComponents.forEach(id => {
        const v = this.compVisuals[id];
        if (!v) return;
        this.setGlow(v, true, 0xe0503f);
        this.tweens.add({ targets: v.container, angle: { from: -2, to: 2 }, duration: 90, yoyo: true, repeat: 3 });
      });
    }
  }

  playSuccessSequence () {
    Object.entries(gameState.placed).forEach(([id, c]) => {
      const v = this.compVisuals[id];
      if (!v) return;
      if (c.type === 'top' || c.type === 'sub') {
        this.tweens.add({ targets: v.container, scale: { from: v.container.scaleX, to: v.container.scaleX * 1.1 }, yoyo: true, repeat: 4, duration: 140 });
      }
      if (c.type === 'par') {
        let n = 0;
        this.time.addEvent({
          delay: 130, repeat: 9,
          callback: () => { n++; this.setGlow(v, true, n % 2 === 0 ? 0xf2c53d : 0xffffff); }
        });
      }
    });

    this.playBeep();

    const banner = this.add.text(GAME_W / 2, GAME_H / 2, 'DOORS OPEN — SHOW STARTED!', {
      fontFamily: 'Barlow Condensed, sans-serif', fontSize: '40px', fontStyle: 'bold',
      color: '#f2a541', align: 'center', wordWrap: { width: GAME_W - 80 }
    }).setOrigin(0.5).setDepth(100).setAlpha(0).setScale(0.85).setScrollFactor(0);

    this.tweens.add({
      targets: banner, alpha: 1, scale: 1, duration: 380, ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({ targets: banner, alpha: 0, delay: 1800, duration: 500, onComplete: () => banner.destroy() });
      }
    });
  }

  playBeep () {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const notes = [440, 554, 659, 880];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.value = 0.05;
        osc.connect(gain).connect(ctx.destination);
        const t0 = ctx.currentTime + i * 0.11;
        osc.start(t0);
        gain.gain.setValueAtTime(0.06, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
        osc.stop(t0 + 0.11);
      });
    } catch (e) { /* AudioContext non disponibile: nessun suono, non bloccante */ }
  }

  /* ---------------- reset ---------------- */
  resetLevel () {
    this.clearEdgeSelection();
    this.clearMoveSelection();
    this.cancelPending();
    disarmPiece();

    Object.values(this.compVisuals).forEach(v => v.container.destroy());
    this.compVisuals = {};
    this.occupied = {};
    this.edgeGraphics.clear();

    gameState.placed = {};
    gameState.stock = { ...AVAILABLE_STOCK };
    gameState.nextIndex = { sub: 1, top: 1, mixer: 1, par: 1, controller: 1, ampli: 1 };
    gameState.edges = [];
    gameState.edgeSeq = 0;
    gameState.selectedCable = null;
    gameState.pendingPort = null;
    gameState.tested = false;

    document.querySelectorAll('.cable-btn').forEach(b => b.classList.remove('active'));
    updateStockUI();
    updatePowerMeter();
    updateConnectionCounter();
    setCircuitStatus('untested');
    this.resetView();

    this.drawQuadro();
    this.updateQuadroVisual();
    showToast('Livello resettato.');
    this.pushHistory();
  }

  /* ---------------- cronologia: indietro/avanti tramite snapshot dello stato ----------------
     Approccio a "fotografia" dell'intero stato (più semplice e affidabile che tracciare
     l'azione inversa per ogni tipo di operazione): ogni azione di gioco salva un clone dei
     dati; indietro/avanti ricostruiscono la scena da zero a partire dal clone. */
  pushHistory () {
    this.history = (this.history || []).slice(0, this.historyIndex + 1);
    this.history.push({
      placed: JSON.parse(JSON.stringify(gameState.placed)),
      edges: JSON.parse(JSON.stringify(gameState.edges)),
      stock: { ...gameState.stock },
      nextIndex: { ...gameState.nextIndex },
      edgeSeq: gameState.edgeSeq
    });
    this.historyIndex = this.history.length - 1;
    this.updateHistoryButtons();
  }

  undo () {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    this.restoreSnapshot(this.history[this.historyIndex]);
  }

  redo () {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    this.restoreSnapshot(this.history[this.historyIndex]);
  }

  restoreSnapshot (snap) {
    this.clearEdgeSelection();
    this.clearMoveSelection();
    this.cancelPending();

    Object.values(this.compVisuals).forEach(v => v.container.destroy());
    this.compVisuals = {};
    this.occupied = {};

    gameState.placed = JSON.parse(JSON.stringify(snap.placed));
    gameState.edges = JSON.parse(JSON.stringify(snap.edges));
    gameState.stock = { ...snap.stock };
    gameState.nextIndex = { ...snap.nextIndex };
    gameState.edgeSeq = snap.edgeSeq;

    Object.values(gameState.placed).forEach(c => {
      const def = COMPONENT_TYPES[c.type];
      if (!def) return;
      const visual = this.buildComponentVisual(c.id, def, c.screen.x, c.screen.y);
      this.compVisuals[c.id] = visual;
      if (c.gx != null && c.gy != null) this.occupied[c.gx + ',' + c.gy] = c.id;
      if (c.id === 'quadro') {
        const specLabel = this.add.text(0, def.body.h / 2 + 24, '', {
          fontFamily: 'Inter, sans-serif', fontSize: '9.5px', color: '#8b8e98', align: 'center'
        }).setOrigin(0.5);
        visual.container.add(specLabel);
        visual.specLabel = specLabel;
      }
    });

    this.updateQuadroVisual();
    this.applyLayerVisibility();
    updateStockUI();
    updatePowerMeter();
    setCircuitStatus('untested');
    gameState.tested = false;
    this.updateHistoryButtons();
  }

  updateHistoryButtons () {
    const undoBtn = el('#undo-btn'), redoBtn = el('#redo-btn');
    if (undoBtn) undoBtn.disabled = this.historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = this.historyIndex >= this.history.length - 1;
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#141519',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  scene: [StageScene]
};

new Phaser.Game(config);
updateStockUI();
updatePowerMeter();
updateConnectionCounter();
setCircuitStatus('untested');
