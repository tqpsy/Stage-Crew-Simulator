/* ======================================================================
   STAGE CREW SIMULATOR — Livello 1 "Il Pub" — MVP giocabile
   Motore: Phaser 3 (via CDN). File singolo, nessuna asset esterna:
   ogni fixture è disegnata come icona vettoriale (non foto) che ne
   richiama la forma reale (PAR rotondo, sub/top con cono, ecc.).
   ====================================================================== */

/* ---------------------------------------------------------------------
   1) CATALOGO COMPONENTI — zona di posa, forma grafica, porte
   --------------------------------------------------------------------- */
// colori reali (norma IEC 60309 per le prese CEE): PowerCON arancione,
// CEE monofase 230V blu, CEE trifase 400V rosso. Sono segnali NATIVI di
// porta a tutti gli effetti (non solo un colore cosmetico), quindi anche la
// compatibilità dei cavi li tratta come due tipi distinti.
const SIGNAL_COLOR = {
  powercon: 0xf2954a,
  speakon:  0xf0619a, // rosa: il bianco/argento ormai è dell'XLR
  dmx:      0xf2c53d,
  xlr:      0xa3acb8, // argento: il guscio metallico dell'XLR (il blu è della CEE monofase)
  schuko:   0xc77dff,
  cee_mono: 0x2f6fd6,
  cee_tri:  0xd6392f,
  jack:     0x2ec4e0
};

// raggio (px) del corpo tondo di ogni porta
const PORT_R = 8.5;

/* genere del connettore montato sull'apparecchio, come nella realtà:
   - XLR audio: gli ingressi sono femmina, le uscite maschio;
   - DMX (XLR 5 poli): al contrario, DMX IN maschio e OUT/THRU femmina;
   - Schuko / CEE: la presa che eroga corrente è femmina, la vaschetta
     d'ingresso (inlet) dell'apparecchio è maschio;
   - Speakon, PowerCON e jack da pannello hanno la stessa faccia sia in
     ingresso sia in uscita (il PowerCON si riconosce dal colore: blu/grigio). */
const CONNECTOR_GENDER = {
  xlr:      { in: 'female', out: 'male' },
  dmx:      { in: 'male',   out: 'female' },
  schuko:   { in: 'male',   out: 'female' },
  cee_mono: { in: 'male',   out: 'female' },
  cee_tri:  { in: 'male',   out: 'female' },
  speakon:  { in: 'female', out: 'female' },
  powercon: { in: 'male',   out: 'male' },
  jack:     { in: 'female', out: 'female' }
};

/* colore REALE del corpo del connettore da pannello (guscio metallico
   dell'XLR, plastica nera di Speakon/PowerCON/Schuko, blu e rosso delle CEE).
   Il colore del segnale resta sull'anello esterno della porta, così la porta
   si abbina sempre al cavo giusto. */
const CONNECTOR_BODY = {
  xlr:      0xb4bac3,
  dmx:      0xb4bac3,
  speakon:  0x1c1d22,
  powercon: 0x1c1d22,
  schuko:   0x2a2c32,
  cee_mono: 0x2f6fd6,
  cee_tri:  0xd6392f,
  jack:     0x1c1d22
};
// corpi scuri: i fori di una femmina non si vedrebbero, serve un inserto grigio
const DARK_BODY = new Set(['speakon', 'powercon', 'schuko', 'jack']);

// nomi leggibili per l'etichetta che compare sopra una porta
const SIGNAL_LABEL = {
  xlr: 'XLR 3 poli', dmx: 'DMX 5 poli', speakon: 'Speakon', powercon: 'PowerCON',
  schuko: 'Schuko', cee_mono: 'CEE 16A monofase', cee_tri: 'CEE 16A trifase', jack: 'Jack 6,35'
};

/* Geometria del mixer in "unità banco" (a = lungo i canali, b = dal retro
   al fronte operatore, z = altezza), proiettata con la stessa inclinazione
   della griglia di gioco (TILE_H/TILE_W = 70/102). Usata sia dal disegno
   sia per ancorare le porte sul retro, così restano sempre allineate. */
const MIXER_GEO = {
  La: 112, Lb: 42,       // lunghezza (canali) e profondità del banco
  Bd: 10, bt: 4,         // dove la plancia incontra il ponte, profondità del cappello del ponte
  zF: 5, zR: 10, Hb: 24, // altezza bordo anteriore, posteriore e del ponte meter/schermo
  cx: 0.5, cy: 0.343,
  offX: 38.5, offY: -24 // centra il bounding box sull'origine del container
};
// banco ruotato di -90° sul pavimento: i canali corrono verso il fondo
// (in alto a destra) e il fronte operatore guarda in basso a destra
function mixerIso (a, b, z) {
  const m = MIXER_GEO;
  return { x: (a + b) * m.cx - m.offX, y: (b - a) * m.cy - z - m.offY };
}
// le porte stanno sul pannello posteriore, appena dietro al ponte: da lì
// escono davvero i cavi di un banco reale
function mixerRearPort (a) {
  const p = mixerIso(a, -6, MIXER_GEO.Hb + 3);
  return { dx: Math.round(p.x), dy: Math.round(p.y) };
}

/* Catalogo dei CAVI selezionabili (scheda "Cavi") — diverso dal catalogo delle
   PORTE (SIGNAL_COLOR): una porta ha sempre un solo segnale nativo, ma un
   cavo può essere un ADATTATORE tra due segnali diversi (endpoints con 2
   valori). "layer" dice quale interruttore del pannello Livelli lo nasconde. */
const CABLE_TYPES = {
  powercon:        { endpoints: ['powercon'],            layer: 'powercon', color: 0xf2954a },
  schuko:          { endpoints: ['schuko'],               layer: 'schuko',   color: 0xc77dff },
  cee_tri:         { endpoints: ['cee_tri'],              layer: 'cee_tri',  color: 0xd6392f },
  cee_mono:        { endpoints: ['cee_mono'],             layer: 'cee_mono', color: 0x2f6fd6 },
  xlr:             { endpoints: ['xlr'],                  layer: 'xlr',      color: 0xa3acb8 },
  dmx:             { endpoints: ['dmx'],                  layer: 'dmx',      color: 0xf2c53d },
  speakon:         { endpoints: ['speakon'],              layer: 'speakon',  color: 0xf0619a },
  jack:            { endpoints: ['jack'],                  layer: 'jack',     color: 0x2ec4e0 },
  // adattatori: il lato CEE è sempre monofase (mai trifase — si adatta un
  // singolo ramo di fase, non l'intero allaccio a monte del Quadro).
  cee_powercon:    { endpoints: ['cee_mono', 'powercon'], layer: 'cee_mono', color: 0xd9773f },
  schuko_powercon: { endpoints: ['schuko', 'powercon'],   layer: 'schuko',   color: 0xcf7fcf },
  cee_schuko:      { endpoints: ['cee_mono', 'schuko'],   layer: 'cee_mono', color: 0xd996c0 }
};

// carica reale (powercon/schuko/cee, anche via adattatore): usato per capire
// quali cavi contano come "elettrici" nel calcolo del carico per fase.
const POWER_CABLE_IDS = new Set(['powercon', 'schuko', 'cee_tri', 'cee_mono', 'cee_powercon', 'schuko_powercon', 'cee_schuko']);

/* zone: chiave usata per sapere DOVE si può piazzare un componente (vedi
   ZONE_PREDICATES sopra) · 'fixed' = posizione imposta, non trascinabile.
   dir: 'in' | 'out' — un cavo collega sempre un OUT a un IN, mai due porte
   della stessa direzione, e non può richiudersi in un anello. */
const COMPONENT_TYPES = {
  sub: {
    label: 'SUB', category: 'audio', powerW: 600, zone: 'pit', shape: 'sub',
    body: { w: 60, h: 46, fill: 0x232830, accent: 0x4a90e2 },
    ports: [
      { id: 'power',    signal: 'powercon', dir: 'in',  dx: 0,   dy: 27 },
      { id: 'spk_in',   signal: 'speakon',  dir: 'in',  dx: -27, dy: 2 },
      { id: 'spk_thru', signal: 'speakon',  dir: 'out', dx: 0,   dy: -27 }
    ]
  },
  top: {
    label: 'TOP', category: 'audio', powerW: 0, zone: 'pit', shape: 'top',
    body: { w: 46, h: 40, fill: 0x232830, accent: 0x4a90e2 },
    ports: [
      { id: 'spk_in', signal: 'speakon', dir: 'in', dx: 0, dy: 22 }
    ]
  },
  mixer: {
    label: 'MIX', category: 'audio', powerW: 50, zone: 'offstage', shape: 'mixer',
    body: { w: 77, h: 77, fill: 0x2a2c32, accent: 0x8a8e98 },
    // etichetta nell'angolo libero in basso a destra (al centro coprirebbe i
    // fader) e LED di alimentazione sul ponte, come su un banco vero
    labelPos: { x: 30, y: 26 },
    ledPos: mixerIso(3.5, 7, 17),
    ports: [
      { id: 'power',   signal: 'powercon', dir: 'in',  ...mixerRearPort(14) },
      { id: 'in_pc',   signal: 'xlr',      dir: 'in',  ...mixerRearPort(44) },
      { id: 'audio_L', signal: 'xlr',      dir: 'out', ...mixerRearPort(74) },
      { id: 'audio_R', signal: 'xlr',      dir: 'out', ...mixerRearPort(104) }
    ]
  },
  ampli: {
    label: 'FINALE', category: 'regia', powerW: 300, zone: 'offstage', shape: 'ampli',
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
    label: 'PAR', category: 'luci', powerW: 40, zone: 'stagecore', shape: 'par',
    body: { w: 40, h: 44, fill: 0x2a2620, accent: 0xf2c53d },
    ports: [
      { id: 'power_in',   signal: 'powercon', dir: 'in',  dx: -16, dy: 20 },
      { id: 'power_thru', signal: 'powercon', dir: 'out', dx: 16,  dy: 20 },
      { id: 'dmx_in',     signal: 'dmx',      dir: 'in',  dx: -16, dy: -16 },
      { id: 'dmx_thru',   signal: 'dmx',      dir: 'out', dx: 16,  dy: -16 }
    ]
  },
  controller: {
    label: 'CTRL', category: 'luci', powerW: 20, zone: 'offstage', shape: 'controller',
    body: { w: 62, h: 42, fill: 0x2a2c32, accent: 0xf2a541 },
    ports: [
      { id: 'power', signal: 'powercon', dir: 'in',  dx: -24, dy: 22 },
      { id: 'dmx',   signal: 'dmx',      dir: 'out', dx: 24,  dy: 22 }
    ]
  },
  quadro: {
    label: 'QUADRO', category: 'power', powerW: 0, zone: 'backstage', shape: 'quadro',
    // cabinet bianco/metallo, come un vero armadio elettrico da evento —
    // non più una scatola tinta a caso (vedi drawComponentBody per i dettagli).
    body: { w: 92, h: 54, fill: 0xe9eaed, accent: 0x4a4f5a },
    // 3 prese, una per fase (L1/L2/L3): a differenza degli altri componenti,
    // ogni presa può ricevere PIÙ cavi (multi:true) — non è il singolo cavo a
    // contare, ma il carico totale che finisce su quella fase (vedi
    // computePhaseLoads/PHASE_BUDGET_W): sta al giocatore distribuirlo bene.
    ports: [
      // sia l'ingresso (dall'Allaccio) sia le 3 uscite sono CEE industriale:
      // un quadro trifase non ha prese PowerCON incorporate. Ogni utenza a
      // valle (PowerCON o Schuko) richiede l'adattatore giusto in scheda Cavi.
      { id: 'in',    signal: 'cee_tri',  dir: 'in',  dx: 0,   dy: 25 },
      { id: 'out_1', signal: 'cee_mono', dir: 'out', dx: -27, dy: -25, phase: 'L1', multi: true },
      { id: 'out_2', signal: 'cee_mono', dir: 'out', dx: 0,   dy: -25, phase: 'L2', multi: true },
      { id: 'out_3', signal: 'cee_mono', dir: 'out', dx: 27,  dy: -25, phase: 'L3', multi: true }
    ]
  },
  allaccio: {
    label: 'ALLACCIO', category: 'power', powerW: 0, zone: 'fixed', shape: 'quadro',
    body: { w: 50, h: 44, fill: 0x1f2a1f, accent: 0x49b06a },
    ports: [
      { id: 'out', signal: 'cee_tri', dir: 'out', dx: 0, dy: -27 }
    ]
  },
  ciabatta: {
    label: 'CIABATTA', category: 'regia', powerW: 0, zone: 'foh', shape: 'ciabatta',
    body: { w: 74, h: 24, fill: 0x2a2c32, accent: 0xc77dff },
    ports: [
      { id: 'in',    signal: 'powercon', dir: 'in',  dx: -30, dy: 0 },
      { id: 'out_1', signal: 'schuko',   dir: 'out', dx: -8,  dy: 0 },
      { id: 'out_2', signal: 'schuko',   dir: 'out', dx: 11,  dy: 0 },
      { id: 'out_3', signal: 'schuko',   dir: 'out', dx: 30,  dy: 0 }
    ]
  },
  pc: {
    label: 'PC', category: 'regia', powerW: 150, zone: 'foh', shape: 'pc',
    // stile "Mac": scocca in alluminio chiaro, non più il rackbox scuro
    // generico — vedi drawComponentBody per lo schermo/trackpad/notch.
    body: { w: 40, h: 34, fill: 0xd7dadd, accent: 0x9a9da3 },
    ports: [
      { id: 'power',     signal: 'schuko', dir: 'in',  dx: 0,  dy: 22 },
      // uscita audio (jack, non bilanciata): va in una DI prima di entrare
      // nel mixer, che vuole un ingresso bilanciato XLR.
      { id: 'audio_out', signal: 'jack',   dir: 'out', dx: 19, dy: 4 }
    ]
  },
  // DI passiva: converte l'uscita jack del PC (sbilanciata) in un segnale
  // XLR bilanciato adatto a un ingresso mixer — nessuna alimentazione
  // richiesta, sta accanto al PC (Regia di sala o Off Stage).
  di: {
    label: 'DI', category: 'regia', powerW: 0, zone: 'foh', shape: 'di',
    body: { w: 30, h: 24, fill: 0x232830, accent: 0x8a8e98 },
    ports: [
      { id: 'in',  signal: 'jack', dir: 'in',  dx: -11, dy: 0 },
      { id: 'out', signal: 'xlr',  dir: 'out', dx: 11,  dy: 0 }
    ]
  },
  // splitter industriale: smista una linea CEE del Quadro su più uscite CEE.
  // Non è richiesta dal collegamento attuale del Livello 1 (che passa diretto
  // dal Quadro alla Ciabatta Schuko via adattatore), ma è già disponibile per
  // quando servirà distribuire un carico più grande su più rami.
  ciabatta_cee: {
    label: 'CIAB.CEE', category: 'corrente', powerW: 0, zone: 'backstage', shape: 'ciabatta',
    body: { w: 74, h: 24, fill: 0x2a2c32, accent: 0x2f6fd6 },
    // splitta UNA fase (monofase) su più prese: non tocca mai il trifase,
    // quello resta solo tra Allaccio e Quadro.
    ports: [
      { id: 'in',    signal: 'cee_mono', dir: 'in',  dx: -30, dy: 0 },
      { id: 'out_1', signal: 'cee_mono', dir: 'out', dx: -8,  dy: 0 },
      { id: 'out_2', signal: 'cee_mono', dir: 'out', dx: 11,  dy: 0 },
      { id: 'out_3', signal: 'cee_mono', dir: 'out', dx: 30,  dy: 0 }
    ]
  }
};

const AVAILABLE_STOCK = { sub: 2, top: 2, mixer: 1, par: 4, controller: 1, ampli: 1, quadro: 1, ciabatta: 1, ciabatta_cee: 1, pc: 1, di: 1 };

const POWER_LIMIT_KW = 3.0;
const TOP_ATTACH_RADIUS = 300; // px: quanto lontano può essere trascinata una Testa da un Sub libero

/* Il quadro del livello è forzato Trifase (16A, 3 prese: una per fase) anche se
   il carico reale resterebbe sotto la soglia Monofase — scelta didattica, per
   far esercitare da subito il bilanciamento delle fasi. */
const FORCE_TRIFASE = true;

// budget per fase: 3kW ciascuna (coerente con un 16A monofase per fase su un
// quadro trifase, 16A×230V≈3680W con un margine di sicurezza tondo a 3000W).
const PHASE_BUDGET_W = 3000;

/* La "soluzione" del livello: collegamenti richiesti, PORTA per PORTA (non
   solo componente-componente), così i cavi devono rispettare L/R e la
   sequenza reale della catena (mixer -> finale -> sub -> top, daisy DMX/potenza). */
function buildExpectedConnections () {
  const list = [
    // aPort: null = "una qualunque presa/fase del Quadro" — non importa su quale
    // delle 3 fasi finisca il cavo, conta solo che la connessione esista (il
    // bilanciamento del carico tra le fasi è controllato a parte, vedi runValidation).
    // il Quadro esce in CEE su tutte e 3 le fasi: ogni utenza qui sotto ha
    // porte PowerCON, quindi il cavo che serve è l'adattatore CEE/PowerCON.
    { a: 'allaccio', aPort: 'out', b: 'quadro_1',      bPort: 'in',       signal: 'cee_tri' },
    { a: 'quadro_1', aPort: null, b: 'mixer_1',      bPort: 'power',    signal: 'cee_powercon' },
    { a: 'quadro_1', aPort: null, b: 'controller_1', bPort: 'power',    signal: 'cee_powercon' },
    { a: 'quadro_1', aPort: null, b: 'ampli_1',      bPort: 'power',    signal: 'cee_powercon' },
    { a: 'quadro_1', aPort: null, b: 'sub_1',        bPort: 'power',    signal: 'cee_powercon' },
    { a: 'quadro_1', aPort: null, b: 'sub_2',        bPort: 'power',    signal: 'cee_powercon' },
    { a: 'quadro_1', aPort: null, b: 'par_1',        bPort: 'power_in', signal: 'cee_powercon' },
    { a: 'quadro_1', aPort: null, b: 'ciabatta_1',   bPort: 'in',       signal: 'cee_powercon' },
    { a: 'ciabatta_1', aPort: null, b: 'pc_1', bPort: 'power', signal: 'schuko' },
    { a: 'par_1', aPort: 'power_thru', b: 'par_2', bPort: 'power_in', signal: 'powercon' },
    { a: 'par_2', aPort: 'power_thru', b: 'par_3', bPort: 'power_in', signal: 'powercon' },
    { a: 'par_3', aPort: 'power_thru', b: 'par_4', bPort: 'power_in', signal: 'powercon' },

    { a: 'mixer_1', aPort: 'audio_L', b: 'ampli_1', bPort: 'in_L', signal: 'xlr' },
    { a: 'mixer_1', aPort: 'audio_R', b: 'ampli_1', bPort: 'in_R', signal: 'xlr' },

    // il PC entra nel mixer passando da una DI: l'uscita jack (sbilanciata)
    // va convertita in XLR bilanciato prima di arrivare all'ingresso mixer.
    { a: 'pc_1', aPort: 'audio_out', b: 'di_1', bPort: 'in', signal: 'jack' },
    { a: 'di_1', aPort: 'out', b: 'mixer_1', bPort: 'in_pc', signal: 'xlr' },

    { a: 'controller_1', aPort: 'dmx', b: 'par_1', bPort: 'dmx_in', signal: 'dmx' },
    { a: 'par_1', aPort: 'dmx_thru', b: 'par_2', bPort: 'dmx_in', signal: 'dmx' },
    { a: 'par_2', aPort: 'dmx_thru', b: 'par_3', bPort: 'dmx_in', signal: 'dmx' },
    { a: 'par_3', aPort: 'dmx_thru', b: 'par_4', bPort: 'dmx_in', signal: 'dmx' }
  ];

  // finale -> sub: L/R assegnati in base alla posizione FISICA sullo schermo
  // (il Sub più a sinistra va con out_L), non all'ordine in cui sono stati
  // piazzati — così il giocatore collega in base a quello che vede. Sono
  // sempre 2 "posti" nel conteggio totale, anche se un Sub non è ancora
  // stato piazzato (in quel caso usiamo un id segnaposto che nessun cavo
  // reale potrà mai soddisfare, così il totale resta fisso a 19 durante
  // tutta la costruzione del livello, invece di scendere e risalire).
  const subs = Object.values(gameState.placed)
    .filter(c => c.type === 'sub')
    .sort((a, b) => (a.screen ? a.screen.x : 0) - (b.screen ? b.screen.x : 0));
  const leftSub = subs[0] || null;
  const rightSub = subs[1] || null;
  list.push({ a: 'ampli_1', aPort: 'out_L', b: leftSub ? leftSub.id : '__sub_L_non_piazzato__', bPort: 'spk_in', signal: 'speakon' });
  list.push({ a: 'ampli_1', aPort: 'out_R', b: rightSub ? rightSub.id : '__sub_R_non_piazzato__', bPort: 'spk_in', signal: 'speakon' });

  // sub -> testa: stesso principio, 2 posti fissi (uno per il Sub di sinistra,
  // uno per quello di destra), risolti verso LA testa realmente agganciata a
  // quel Sub specifico, qualunque id essa abbia.
  list.push({
    a: leftSub ? leftSub.id : '__sub_L_non_piazzato__', aPort: 'spk_thru',
    b: (leftSub && leftSub.hasTop) ? leftSub.hasTop : '__top_L_non_agganciata__', bPort: 'spk_in', signal: 'speakon'
  });
  list.push({
    a: rightSub ? rightSub.id : '__sub_R_non_piazzato__', aPort: 'spk_thru',
    b: (rightSub && rightSub.hasTop) ? rightSub.hasTop : '__top_R_non_agganciata__', bPort: 'spk_in', signal: 'speakon'
  });

  return list;
}

/* ---------------------------------------------------------------------
   2) STATO DI GIOCO (agnostico dal motore grafico)
   --------------------------------------------------------------------- */
const gameState = {
  placed: {},
  stock: { ...AVAILABLE_STOCK },
  nextIndex: { sub: 1, top: 1, mixer: 1, par: 1, controller: 1, ampli: 1, quadro: 1, ciabatta: 1, ciabatta_cee: 1, pc: 1, di: 1 },
  edges: [],              // { id, a, aPort, b, bPort, signal }
  edgeSeq: 0,
  selectedCable: null,
  pendingPort: null,      // { componentId, portId }
  selectedPieceType: null, // tipo di pezzo "armato" in attesa di un tocco sulla pedana
  visibleSignals: { powercon: true, xlr: true, speakon: true, dmx: true, schuko: true, cee_tri: true, cee_mono: true, jack: true },
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

/* Somma il consumo di componentId + tutto ciò che pende elettricamente a
   valle (seguendo i cavi in uscita, di qualunque segnale — powercon o
   schuko: una Ciabatta non ha un consumo proprio, ma tutto quello che vi si
   collega pesa comunque sulla fase a monte). Usata per capire quanto pesa
   davvero una singola presa del Quadro, non solo il primo anello. */
function downstreamPowerLoad (componentId, visited) {
  visited = visited || new Set();
  if (visited.has(componentId)) return 0;
  visited.add(componentId);
  const comp = gameState.placed[componentId];
  if (!comp) return 0;
  const def = COMPONENT_TYPES[comp.type];
  let total = def ? (def.powerW || 0) : 0;
  // solo i cavi che trasportano davvero corrente (anche tramite adattatore)
  // continuano il circuito elettrico: Speakon/XLR/DMX sono segnale, non
  // alimentazione, e non vanno sommati al carico della fase a monte.
  gameState.edges.forEach(e => {
    if (e.a === componentId && POWER_CABLE_IDS.has(e.signal)) {
      total += downstreamPowerLoad(e.b, visited);
    }
  });
  return total;
}

/* Carico reale di ciascuna fase del Quadro: somma di downstreamPowerLoad per
   ogni dispositivo collegato direttamente a una presa di quella fase. */
function computePhaseLoads () {
  const quadroEntry = Object.values(gameState.placed).find(c => c.type === 'quadro');
  const loads = { L1: 0, L2: 0, L3: 0 };
  if (!quadroEntry) return loads;
  const def = COMPONENT_TYPES.quadro;
  gameState.edges.forEach(e => {
    if (e.a !== quadroEntry.id) return;
    const portDef = def.ports.find(p => p.id === e.aPort);
    if (!portDef || !portDef.phase) return;
    loads[portDef.phase] += downstreamPowerLoad(e.b, new Set([quadroEntry.id]));
  });
  return loads;
}

/* Il LED di un dispositivo: risale dalla sua porta "critica" (l'ingresso di
   potenza, se ce l'ha; altrimenti il suo primo ingresso — è il caso di una DI
   passiva, che non ha alimentazione ma ha bisogno del segnale) fino a una
   sorgente viva (l'Allaccio). Non si accontenta che un cavo sia collegato:
   se un anello della catena è spezzato più a monte, il LED resta spento —
   esattamente come un vero dispositivo senza corrente/segnale reale. */
function isComponentLive (componentId, visited) {
  visited = visited || new Set();
  if (visited.has(componentId)) return false;
  visited.add(componentId);

  const comp = gameState.placed[componentId];
  if (!comp) return false;
  if (comp.type === 'allaccio') return true;

  const def = COMPONENT_TYPES[comp.type];
  if (!def) return false;
  const criticalPort = def.ports.find(p => p.dir === 'in' && POWER_CABLE_IDS.has(p.signal))
    || def.ports.find(p => p.dir === 'in');
  if (!criticalPort) return true;

  const feedingEdge = gameState.edges.find(e => e.b === componentId && e.bPort === criticalPort.id);
  if (!feedingEdge) return false;
  return isComponentLive(feedingEdge.a, visited);
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

/* aPort/bPort possono essere null: significa "una qualunque porta", usato per le
   linee del Quadro/Ciabatta, dove non importa quale uscita fisica si usi. */
function portEdgeExists (a, aPort, b, bPort, signal) {
  return gameState.edges.some(e => e.signal === signal && (
    (e.a === a && e.b === b && (aPort == null || e.aPort === aPort) && (bPort == null || e.bPort === bPort)) ||
    (e.a === b && e.b === a && (aPort == null || e.bPort === aPort) && (bPort == null || e.aPort === bPort))
  ));
}

/* vincolo realistico: una porta fisica accetta un solo cavo alla volta */
function portHasConnection (componentId, portId) {
  return gameState.edges.some(e =>
    (e.a === componentId && e.aPort === portId) || (e.b === componentId && e.bPort === portId)
  );
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

  // sicurezza: senza tutti i Sub e le Teste piazzati (2+2) le connessioni
  // dinamiche corrispondenti non esistono nemmeno nell'elenco atteso, quindi
  // senza questo controllo il livello potrebbe risultare "superato" a torto
  const allSubsTopsPlaced = gameState.stock.sub === 0 && gameState.stock.top === 0;

  const phaseLoads = computePhaseLoads();
  const overloadedPhases = Object.keys(phaseLoads).filter(ph => phaseLoads[ph] > PHASE_BUDGET_W);
  const overPhase = overloadedPhases.length > 0;

  return {
    pass: allFound && !overBudget && allSubsTopsPlaced && !overPhase,
    failedComponents, overBudget, usedW, madeCount, totalCount: expected.length,
    phaseLoads, overloadedPhases, overPhase
  };
}

function computeQuadroSpec (totalW) {
  if (totalW <= 3680 && !FORCE_TRIFASE) {
    const amps = Math.max(6, Math.ceil(totalW / 230));
    return { phase: 1, ampsLabel: amps + 'A', phaseLabel: 'Monofase 230V', scale: 1 + Math.min(0.35, (totalW / 3680) * 0.35) };
  }
  const amps = Math.max(16, Math.ceil(totalW / (400 * Math.sqrt(3))));
  const growth = Math.max(0, Math.min(0.4, ((totalW - 3680) / 20000) * 0.4));
  return { phase: 3, ampsLabel: amps + 'A', phaseLabel: 'Trifase 400V', scale: 1.1 + growth };
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
  if (state === 'ok') { lamp.classList.add('ok'); text.textContent = 'IMPIANTO OK'; }
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

/* Tabs — sono anche l'interruttore tra fase di POSA e fase di CABLAGGIO:
   sulla scheda "Cavi" toccare un componente lo collega; su ogni altra scheda
   toccarlo lo sposta. Le due modalità non si mescolano mai. */
function isWiringTabActive () {
  const active = document.querySelector('.tab-btn.active');
  return !!active && active.dataset.tab === 'cavi';
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const enteringWiring = btn.dataset.tab === 'cavi';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`.tab-panel[data-panel="${btn.dataset.tab}"]`).classList.add('active');

    if (window.__scene) {
      if (enteringWiring) {
        // si entra in modalità cablaggio: niente più spostamenti in sospeso
        window.__scene.clearMoveSelection();
        disarmPiece();
      } else {
        // si torna alla posa: niente più cavi/porte in sospeso
        window.__scene.cancelPending();
        window.__scene.clearEdgeSelection();
      }
    }
  });
});

/* Gruppi di cavi "a tendina" (Trifase/Monofase/Segnale): un solo gruppo
   aperto alla volta, per tenere la scheda Cavi il più compatta possibile. */
document.querySelectorAll('.cable-group-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const group = btn.closest('.cable-group');
    const wasOpen = group.classList.contains('open');
    document.querySelectorAll('.cable-group').forEach(g => g.classList.remove('open'));
    if (!wasOpen) group.classList.add('open');
  });
});

/* Cable selectors */
document.querySelectorAll('.cable-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    gameState.pendingPort = null;
    if (window.__scene) window.__scene.clearPendingHighlight();

    if (gameState.selectedCable === btn.dataset.cable) {
      // tocca di nuovo lo stesso cavo già attivo -> lo deseleziona,
      // tornando alla modalità "sposta" per toccare i componenti
      btn.classList.remove('active');
      gameState.selectedCable = null;
      showToast('Cavo deselezionato: ora toccando un componente lo sposti.');
      return;
    }

    document.querySelectorAll('.cable-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gameState.selectedCable = btn.dataset.cable;
    disarmPiece();
    showToast('Cavo selezionato: ' + btn.textContent.trim() + '. Tocca due componenti da collegare (o lo stesso cavo per deselezionarlo).');
    // il gruppo si richiude da solo una volta scelto il cavo: da qui in poi
    // si tocca il palco, non serve più tenere aperta la lista dei cavi
    const group = btn.closest('.cable-group');
    if (group) group.classList.remove('open');
  });
});

/* Reset */
el('#reset-btn').addEventListener('click', () => {
  if (window.__scene) window.__scene.resetLevel();
});

/* Undo/Redo */
el('#undo-btn').addEventListener('click', () => { if (window.__scene) window.__scene.undo(); });
el('#redo-btn').addEventListener('click', () => { if (window.__scene) window.__scene.redo(); });

/* ---------------------------------------------------------------------
   Pop-up diagnostico del Quadro — sola visualizzazione: mostra il carico di
   ogni fase (L1/L2/L3) rispetto a PHASE_BUDGET_W e chi vi è collegato. Il
   cablaggio resta sempre sul palco, nella scheda "Cavi": questa finestra
   non introduce un secondo modo di collegare i cavi.
   --------------------------------------------------------------------- */
function renderQuadroModal () {
  const body = el('#quadro-modal-body');
  const quadroEntry = Object.values(gameState.placed).find(c => c.type === 'quadro');
  if (!quadroEntry) {
    body.innerHTML = '<p class="modal-hint">Il Quadro non è ancora stato piazzato in Backstage.</p>';
    return;
  }
  const def = COMPONENT_TYPES.quadro;
  const loads = computePhaseLoads();
  const phasePorts = def.ports.filter(p => p.phase);
  const spec = computeQuadroSpec(totalPowerUsedW());

  const summaryHtml = `
    <div class="quadro-summary">
      <span>Quadro ${spec.phaseLabel}</span>
      <span class="amount">${spec.ampsLabel}</span>
    </div>`;

  body.innerHTML = summaryHtml + phasePorts.map(portDef => {
    const phase = portDef.phase;
    const load = loads[phase] || 0;
    const pct = Math.min(100, (load / PHASE_BUDGET_W) * 100);
    const over = load > PHASE_BUDGET_W;
    const warn = !over && load > PHASE_BUDGET_W * 0.75;

    const devicesHtml = gameState.edges
      .filter(e => e.a === quadroEntry.id && e.aPort === portDef.id)
      .map(e => `<li>${e.b.replace(/_/g, ' ')} — ${downstreamPowerLoad(e.b, new Set([quadroEntry.id]))} W</li>`)
      .join('') || '<li class="modal-empty">Nessun dispositivo collegato</li>';

    return `
      <div class="phase-card ${over ? 'over' : ''}">
        <div class="phase-card-head">
          <span>Fase ${phase}</span>
          <span class="amount">${load} / ${PHASE_BUDGET_W} W</span>
        </div>
        <div class="phase-bar"><div class="phase-bar-fill ${over ? 'over' : (warn ? 'warn' : '')}" style="width:${pct}%"></div></div>
        <ul class="phase-devices">${devicesHtml}</ul>
      </div>`;
  }).join('');
}

el('#quadro-modal-close').addEventListener('click', () => el('#quadro-modal').classList.remove('show'));
el('#quadro-modal').addEventListener('click', ev => {
  if (ev.target.id === 'quadro-modal') el('#quadro-modal').classList.remove('show');
});

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
  if (window.__scene) window.__scene.runSystemTest();
});

/* ---------------------------------------------------------------------
   4) GEOMETRIA DELLA VENUE: griglia isometrica estesa (palco + retropalco
      + regia + ali laterali), tutta all'interno della stessa area di lavoro
   --------------------------------------------------------------------- */
const GAME_W = 1400;
// GAME_H non è più un numero fisso "indovinato": si misura la vera proporzione
// del contenitore di gioco al caricamento della pagina, così il canvas
// riempie sempre esattamente lo spazio disponibile su qualunque schermo,
// senza bande vuote né ai lati né sopra/sotto.
const __stageWrapEl = document.getElementById('stage-wrap');
const __rawRatio = (__stageWrapEl && __stageWrapEl.clientWidth && __stageWrapEl.clientHeight)
  ? __stageWrapEl.clientHeight / __stageWrapEl.clientWidth
  : 1.3; // valore di riserva se la misura non fosse disponibile
const __containerRatio = Math.min(2.2, Math.max(0.75, __rawRatio)); // limite di sicurezza
const GAME_H = Math.round(GAME_W * __containerRatio);

const ORIGIN_X = 853;
const TILE_W = 102, TILE_H = 70;
const VENUE_W = 10, VENUE_H = 16;     // intera area di lavoro (locale), raddoppiata in profondità
// ORIGIN_Y centra la venue nel nuovo GAME_H, qualunque esso sia
const ORIGIN_Y = Math.round((GAME_H - (VENUE_W + VENUE_H) * TILE_H / 2) / 2);

const ZOOM_MIN = 0.5, ZOOM_MAX = 4;
const DEFAULT_ZOOM = 1.05;
const PLATFORM_HEIGHT = 26; // px: altezza visiva della pedana rialzata

const STAGE_W = 4, STAGE_H = 4;       // pedana 4x4 m (area spettacolo, sempre visibile)
const OFFSTAGE_W = 2;                 // fascia laterale del palco, STESSA quota ma "nascosta":
                                       // mixer di palco, finali, consolle luci
const STAGE_ORIGIN_X = 2, STAGE_ORIGIN_Y = 4;

// bande dal retro del locale verso il pubblico (righe di griglia, gy crescente)
const CARICO_ROWS = 2;      // gy 0-1: carico e scarico (furgone, case — solo scenografia)
const BACKSTAGE_ROWS = 2;   // gy 2-3: allaccio venue + quadro elettrico
// palco: gy STAGE_ORIGIN_Y .. +STAGE_H (righe 4-7)
const PIT_ROWS = 2;         // subito davanti al palco: impianto audio principale
const PLATEA_ROWS = 4;      // pubblico
// regia di sala (FOH): tutte le righe restanti fino al fondo del locale

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

function isStageCoreCell (cx, cy) {
  return cx >= STAGE_ORIGIN_X && cx < STAGE_ORIGIN_X + STAGE_W &&
         cy >= STAGE_ORIGIN_Y && cy < STAGE_ORIGIN_Y + STAGE_H;
}
function isOffStageCell (cx, cy) {
  return cx >= STAGE_ORIGIN_X + STAGE_W && cx < STAGE_ORIGIN_X + STAGE_W + OFFSTAGE_W &&
         cy >= STAGE_ORIGIN_Y && cy < STAGE_ORIGIN_Y + STAGE_H;
}
// "sul palco" in senso ampio: pedana spettacolo + fascia off stage (stessa quota, stesso rialzo)
function isStageCell (cx, cy) {
  return isStageCoreCell(cx, cy) || isOffStageCell(cx, cy);
}
function isBackstageCell (cx, cy) {
  return cy >= CARICO_ROWS && cy < CARICO_ROWS + BACKSTAGE_ROWS;
}
function isPitCell (cx, cy) {
  return cy >= STAGE_ORIGIN_Y + STAGE_H && cy < STAGE_ORIGIN_Y + STAGE_H + PIT_ROWS;
}
function isPlateaCell (cx, cy) {
  const start = STAGE_ORIGIN_Y + STAGE_H + PIT_ROWS;
  return cy >= start && cy < start + PLATEA_ROWS;
}
function isFohCell (cx, cy) {
  return cy >= STAGE_ORIGIN_Y + STAGE_H + PIT_ROWS + PLATEA_ROWS && cy < VENUE_H;
}

const ZONE_PREDICATES = {
  mixer: isOffStageCell,
  controller: isOffStageCell,
  ampli: isOffStageCell,
  par: isStageCoreCell,
  sub: isPitCell,
  quadro: isBackstageCell,
  // le ciabatte portano corrente dove serve: sul palco, in Regia di palco
  // (Off Stage) e in Regia di sala (FOH). Quella CEE può restare anche in
  // Backstage accanto al Quadro, da cui prende la linea.
  ciabatta: (cx, cy) => isStageCell(cx, cy) || isFohCell(cx, cy),
  ciabatta_cee: (cx, cy) => isStageCell(cx, cy) || isFohCell(cx, cy) || isBackstageCell(cx, cy),
  // il PC può stare sia in Regia di sala (FOH) sia in Regia di palco
  // (Off Stage, accanto al mixer di palco) — due postazioni plausibili.
  pc: (cx, cy) => isFohCell(cx, cy) || isOffStageCell(cx, cy),
  // la DI segue il PC: accanto a lui in FOH oppure in Off Stage
  di: (cx, cy) => isFohCell(cx, cy) || isOffStageCell(cx, cy)
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

function strokeRoutedPath (g, pts, color, width, chamfer, alpha) {
  g.lineStyle(width, color, alpha == null ? 1 : alpha);
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
    this.drawLoadingDock();
    this.drawStagePlatform();
    this.drawAllaccio();

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
    this.cameras.main.setZoom(DEFAULT_ZOOM);
    this.cameras.main.centerOn(GAME_W / 2, GAME_H / 2);

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
    this.cameras.main.setZoom(DEFAULT_ZOOM);
    this.cameras.main.centerOn(GAME_W / 2, GAME_H / 2);
  }

  /* ---------------- disegno venue: terreno, zone, pedana ---------------- */
  drawGround () {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x383b45, 1);
    const p0 = gridToScreen(0, 0), p1 = gridToScreen(VENUE_W, 0),
          p2 = gridToScreen(VENUE_W, VENUE_H), p3 = gridToScreen(0, VENUE_H);
    g.beginPath();
    g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.lineTo(p3.x, p3.y);
    g.closePath(); g.fillPath();
    g.lineStyle(2, 0x484c58, 0.9);
    g.beginPath();
    g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.lineTo(p3.x, p3.y);
    g.closePath(); g.strokePath();

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

      if (isWiringTabActive()) {
        const hitEdge = this.findEdgeAt(pointer.worldX, pointer.worldY);
        if (hitEdge) {
          if (this.selectedEdgeId === hitEdge.id) this.clearEdgeSelection();
          else this.selectEdge(hitEdge);
          return;
        }
        this.clearEdgeSelection();
        this.cancelPending();
        return;
      }

      // fase di posa
      if (gameState.selectedPieceType) { this.placeArmedPieceAt(pointer.worldX, pointer.worldY); return; }
      if (this.moveSelected) { this.attemptMoveTo(pointer.worldX, pointer.worldY); return; }
      this.clearMoveSelection();
    });
    this.floorGraphics = g;
  }

  drawZoneOutline (corners, label) {
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(1.5, 0x565a68, 0.85);
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
    const pitStart = STAGE_ORIGIN_Y + STAGE_H;
    const plateaStart = pitStart + PIT_ROWS;
    const fohStart = plateaStart + PLATEA_ROWS;
    this.drawZoneOutline([[0, 0], [VENUE_W, 0], [VENUE_W, CARICO_ROWS], [0, CARICO_ROWS]], 'Carico e scarico');
    this.drawZoneOutline([[0, CARICO_ROWS], [VENUE_W, CARICO_ROWS], [VENUE_W, STAGE_ORIGIN_Y], [0, STAGE_ORIGIN_Y]], 'Backstage');
    this.drawZoneOutline([[0, pitStart], [VENUE_W, pitStart], [VENUE_W, plateaStart], [0, plateaStart]], 'Pit');
    this.drawZoneOutline([[0, plateaStart], [VENUE_W, plateaStart], [VENUE_W, fohStart], [0, fohStart]], 'Platea');
    this.drawZoneOutline([[0, fohStart], [VENUE_W, fohStart], [VENUE_W, VENUE_H], [0, VENUE_H]], 'Regia di sala (FOH)');
  }

  /* scenografia non interattiva in Carico e Scarico: un furgone e alcuni case,
     disegnati con più dettaglio (non solo scatole) per leggersi a colpo
     d'occhio come "furgone da service" e "flight case", pur restando
     un'icona vettoriale piatta come tutto il resto del gioco. */
  drawLoadingDock () {
    const g = this.add.graphics().setDepth(1);
    const van = gridToScreen(2.2, 0.9);
    const vw = 104, vh = 40;
    const cargoW = vw * 0.66;
    const cabX = van.x - vw / 2 + cargoW;

    // paraurti/base scura, ruote
    g.fillStyle(0x1c1d22, 1);
    g.fillRoundedRect(van.x - vw / 2, van.y + vh * 0.32, vw, 7, 3);
    g.fillStyle(0x121317, 1);
    g.fillCircle(van.x - vw * 0.28, van.y + vh / 2, 8);
    g.fillCircle(cabX + vw * 0.09, van.y + vh / 2, 8);
    g.fillStyle(0x54575f, 1);
    g.fillCircle(van.x - vw * 0.28, van.y + vh / 2, 3);
    g.fillCircle(cabX + vw * 0.09, van.y + vh / 2, 3);

    // cassone di carico (bianco)
    g.fillStyle(0xd8dadd, 1); g.lineStyle(1.5, 0x9a9da3, 1);
    g.fillRoundedRect(van.x - vw / 2, van.y - vh / 2, cargoW, vh, 5);
    g.strokeRoundedRect(van.x - vw / 2, van.y - vh / 2, cargoW, vh, 5);
    // striscia di livrea
    g.fillStyle(0xf2a541, 1);
    g.fillRect(van.x - vw / 2, van.y + vh * 0.06, cargoW, 4);
    // linea del portellone laterale
    g.lineStyle(1, 0x9a9da3, 0.7);
    g.lineBetween(van.x - vw * 0.06, van.y - vh / 2 + 3, van.x - vw * 0.06, van.y + vh * 0.3);
    // fanale posteriore
    g.fillStyle(0xe0503f, 1);
    g.fillRoundedRect(van.x - vw / 2 + 3, van.y - vh * 0.12, 4, 9, 1);

    // cabina di guida (muso spiovente + parabrezza)
    g.fillStyle(0xc9cad1, 1);
    g.beginPath();
    g.moveTo(cabX, van.y - vh * 0.12);
    g.lineTo(cabX + vw * 0.22, van.y - vh * 0.12);
    g.lineTo(cabX + vw * 0.3, van.y + vh / 2 - 4);
    g.lineTo(cabX, van.y + vh / 2 - 4);
    g.closePath(); g.fillPath();
    g.lineStyle(1.3, 0x9a9da3, 1); g.strokePath();
    g.fillStyle(0x3c4451, 0.9);
    g.fillRoundedRect(cabX + 3, van.y - vh * 0.08, vw * 0.15, vh * 0.26, 2);

    const caseSpots = [[6.2, 1.3], [6.9, 1.6], [6.4, 0.7]];
    caseSpots.forEach(([gx, gy]) => {
      const p = gridToScreen(gx, gy);
      const cw = 34, ch = 24, corner = 5;
      g.fillStyle(0x232428, 1);
      g.fillRoundedRect(p.x - cw / 2, p.y - ch / 2, cw, ch, 3);
      g.lineStyle(1.2, 0x54575f, 0.9);
      g.strokeRoundedRect(p.x - cw / 2, p.y - ch / 2, cw, ch, 3);
      // venatura orizzontale del pannello
      g.lineStyle(0.8, 0x18191d, 0.7);
      g.lineBetween(p.x - cw / 2 + 3, p.y - ch * 0.22, p.x + cw / 2 - 3, p.y - ch * 0.22);
      g.lineBetween(p.x - cw / 2 + 3, p.y + ch * 0.22, p.x + cw / 2 - 3, p.y + ch * 0.22);
      // angoli metallici (i tipici rinforzi da flight case)
      g.fillStyle(0x9a9da3, 1);
      g.fillRect(p.x - cw / 2, p.y - ch / 2, corner, corner);
      g.fillRect(p.x + cw / 2 - corner, p.y - ch / 2, corner, corner);
      g.fillRect(p.x - cw / 2, p.y + ch / 2 - corner, corner, corner);
      g.fillRect(p.x + cw / 2 - corner, p.y + ch / 2 - corner, corner, corner);
      // maniglia incassata
      g.fillStyle(0x0c0d10, 1);
      g.fillRoundedRect(p.x - 7, p.y - 2, 14, 4, 1.5);
    });
  }

  drawStagePlatform () {
    const gx0 = STAGE_ORIGIN_X, gy0 = STAGE_ORIGIN_Y, H = STAGE_H;
    const totalW = STAGE_W + OFFSTAGE_W; // l'intero complesso palco, un'unica quota

    // il rialzo (bordo 3D) copre TUTTO il complesso: pedana + Off Stage
    const topV = gridToScreen(gx0, gy0), rightV = gridToScreen(gx0 + totalW, gy0),
          bottomV = gridToScreen(gx0 + totalW, gy0 + H), leftV = gridToScreen(gx0, gy0 + H);

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

    // griglia + scacchiera SOLO sulla pedana spettacolo (area core, tono ambra)
    top.lineStyle(1, 0x4a3f30, 0.9);
    for (let i = 0; i <= STAGE_W; i++) {
      const a = gridToScreen(gx0 + i, gy0), b = gridToScreen(gx0 + i, gy0 + H);
      top.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let j = 0; j <= H; j++) {
      const a = gridToScreen(gx0, gy0 + j), b = gridToScreen(gx0 + STAGE_W, gy0 + j);
      top.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let i = 0; i < STAGE_W; i++) {
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

    // contorno della sola pedana spettacolo (ambra, ben visibile: "qui suona la band")
    const coreRightV = gridToScreen(gx0 + STAGE_W, gy0), coreBottomV = gridToScreen(gx0 + STAGE_W, gy0 + H);
    top.lineStyle(2, 0xf2a541, 0.5);
    top.beginPath();
    top.moveTo(topV.x, topV.y); top.lineTo(coreRightV.x, coreRightV.y);
    top.lineTo(coreBottomV.x, coreBottomV.y); top.lineTo(leftV.x, leftV.y);
    top.closePath(); top.strokePath();

    // fascia OFF STAGE: stessa quota del palco ma tinta scura/neutra — zona
    // tecnici, "nascosta" allo sguardo del pubblico (mixer di palco, finale,
    // consolle luci)
    top.fillStyle(0x1c1d22, 0.55);
    top.beginPath();
    top.moveTo(coreRightV.x, coreRightV.y); top.lineTo(rightV.x, rightV.y);
    top.lineTo(bottomV.x, bottomV.y); top.lineTo(coreBottomV.x, coreBottomV.y);
    top.closePath(); top.fillPath();
    top.lineStyle(1.5, 0x4a4c56, 0.6);
    top.beginPath();
    top.moveTo(coreRightV.x, coreRightV.y); top.lineTo(rightV.x, rightV.y);
    top.lineTo(bottomV.x, bottomV.y); top.lineTo(coreBottomV.x, coreBottomV.y);
    top.closePath(); top.strokePath();

    const offCx = (coreRightV.x + rightV.x + bottomV.x + coreBottomV.x) / 4;
    const offCy = (coreRightV.y + rightV.y + bottomV.y + coreBottomV.y) / 4;
    this.add.text(offCx, offCy, 'Off stage', {
      fontFamily: 'Inter, sans-serif', fontSize: '10px', color: '#6b6e78'
    }).setOrigin(0.5).setDepth(3);

    this.stageBox = {
      minX: Math.min(topV.x, rightV.x, bottomV.x, leftV.x),
      maxX: Math.max(topV.x, rightV.x, bottomV.x, leftV.x),
      minY: Math.min(topV.y, rightV.y, bottomV.y, leftV.y),
      maxY: Math.max(topV.y, rightV.y, bottomV.y, leftV.y) + PLATFORM_HEIGHT
    };
  }

  drawAllaccio () {
    const pos = gridToScreen(8.5, CARICO_ROWS + 0.5);
    const def = COMPONENT_TYPES.allaccio;
    const visual = this.buildComponentVisual('allaccio', def, pos.x, pos.y);
    this.compVisuals['allaccio'] = visual;
    gameState.placed['allaccio'] = { id: 'allaccio', type: 'allaccio', gx: null, gy: null, screen: pos, zone: 'ground' };
  }

  /* aggiorna la dimensione/etichetta del Quadro in base al carico collegato;
     non fa nulla se il Quadro non è ancora stato piazzato */
  updateQuadroVisual () {
    const quadroEntry = Object.values(gameState.placed).find(c => c.type === 'quadro');
    if (!quadroEntry) return;
    const qv = this.compVisuals[quadroEntry.id];
    if (!qv) return;
    const spec = computeQuadroSpec(totalPowerUsedW());
    qv.container.setScale(spec.scale);
    if (qv.specLabel) qv.specLabel.setText(spec.phaseLabel + '\n' + spec.ampsLabel);
    this.updateQuadroPhaseBars(quadroEntry.id);
  }

  /* barra verde->rosso sotto ogni presa: quanto di PHASE_BUDGET_W è già
     impegnato su quella fase. Chiamata ogni volta che cambia un cavo o si
     piazza/sposta/toglie un componente, non solo alla pressione di Test. */
  updateQuadroPhaseBars (quadroId) {
    const qv = this.compVisuals[quadroId];
    if (!qv || !qv.phaseBars) return;
    const def = COMPONENT_TYPES.quadro;
    const loads = computePhaseLoads();
    const g = qv.phaseBars;
    g.clear();
    const barW = 22, barH = 4;
    const barY = -def.body.h / 2 + 8 + def.body.h * 0.35 - 7;
    def.ports.filter(p => p.phase).forEach(p => {
      const frac = Math.min(1, loads[p.phase] / PHASE_BUDGET_W);
      const color = frac >= 1 ? 0xe0503f : (frac >= 0.75 ? 0xf2a541 : 0x49b06a);
      g.fillStyle(0x000000, 0.6);
      g.fillRect(p.dx - barW / 2, barY, barW, barH);
      g.fillStyle(color, 1);
      g.fillRect(p.dx - barW / 2, barY, barW * frac, barH);
    });
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
        // cabinet chiaro con bordo grigio-blu — un vero armadio elettrico da
        // evento, non più una scatola tinta. Striscia di sicurezza
        // gialla/nera in alto e maniglia sul lato per la resa realistica.
        g.fillStyle(def.body.fill, 1); g.lineStyle(2.5, def.body.accent, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 6); g.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);

        const stripeY = -h / 2 + 2, stripeH = 4;
        g.fillStyle(0xf2c53d, 1);
        g.fillRect(-w / 2 + 3, stripeY, w - 6, stripeH);
        g.lineStyle(1, 0x1c1d22, 0.8);
        for (let x = -w / 2 + 3; x < w / 2 - 3; x += 6) {
          g.lineBetween(x, stripeY + stripeH, x + stripeH, stripeY);
        }

        g.fillStyle(def.body.accent, 1);
        g.fillRoundedRect(w / 2 - 6, -5, 4, 10, 1.5);

        // un interruttore per ogni fase reale (solo il vero Quadro ha porte con
        // .phase; l'Allaccio condivide questa forma ma resta una scatola liscia)
        const outs = def.ports.filter(p => p.phase);
        outs.forEach(p => {
          g.fillStyle(0x2a2c32, 1);
          g.fillRoundedRect(p.dx - 7, -h / 2 + 8, 14, h * 0.35, 2);
          g.fillStyle(0x49b06a, 1);
          g.fillRect(p.dx - 4, -h / 2 + 11, 8, 5);
        });
        break;
      }
      case 'ciabatta': {
        g.fillStyle(def.body.fill, 1); g.lineStyle(2, def.body.accent, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
        g.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
        break;
      }
      case 'pc': {
        // laptop in alluminio chiaro, non un rackbox generico: base con
        // trackpad + schermo con notch fotocamera — un cenno riconoscibile
        // a un Mac, restando comunque un'icona vettoriale come tutto il resto.
        const baseH = h * 0.16;
        g.fillStyle(def.body.fill, 1); g.lineStyle(1.5, def.body.accent, 1);
        g.fillRoundedRect(-w / 2, h / 2 - baseH, w, baseH, 2);
        g.strokeRoundedRect(-w / 2, h / 2 - baseH, w, baseH, 2);
        g.fillStyle(def.body.accent, 0.55);
        g.fillRoundedRect(-w * 0.14, h / 2 - baseH + 2, w * 0.28, baseH - 4, 1);

        const screenH = h - baseH;
        g.fillStyle(def.body.fill, 1); g.lineStyle(1.5, def.body.accent, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, screenH, 3);
        g.strokeRoundedRect(-w / 2, -h / 2, w, screenH, 3);
        g.fillStyle(0x1c1d22, 1);
        g.fillRoundedRect(-w * 0.42, -h / 2 + 3, w * 0.84, screenH - 6, 2);
        g.fillStyle(0x0c0d10, 1);
        g.fillRoundedRect(-w * 0.06, -h / 2 + 3, w * 0.12, 3, 1);
        break;
      }
      case 'di': {
        // piccola scatola metallica passiva: due connettori (jack IN, XLR
        // OUT) e un piccolo interruttore ground-lift, come una DI reale.
        g.fillStyle(def.body.fill, 1); g.lineStyle(2, def.body.accent, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 4); g.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);
        g.fillStyle(0x1c1d22, 1);
        g.fillRoundedRect(-4, -h / 2 + 4, 8, 5, 1);
        g.fillStyle(def.body.accent, 0.9);
        g.fillRect(-2.5, -h / 2 + 5.5, 5, 2);
        break;
      }
      case 'mixer': {
        // banco compatto in vera prospettiva isometrica (vedi MIXER_GEO):
        // plancia leggermente inclinata verso l'operatore, ponte posteriore
        // rialzato con meter LED e schermo, e per ogni canale la striscia
        // reale dal fondo al fronte: ingresso XLR, gain, EQ, pan, mute, fader.
        const m = MIXER_GEO, P = mixerIso;
        const zTop = b => m.zR - (m.zR - m.zF) * (b - m.Bd) / (m.Lb - m.Bd);
        const T = (a, b, dz = 0) => P(a, b, zTop(b) + dz);
        // punto sulla faccia inclinata del ponte: t=0 base, t=1 cima
        const F = (a, t) => P(a, m.Bd + (m.bt - m.Bd) * t, m.zR + (m.Hb - m.zR) * t);
        const fill = (pts, color, alpha = 1) => { g.fillStyle(color, alpha); g.fillPoints(pts, true); };
        // cerchio disteso sulla plancia -> ellisse isometrica
        const isoDisc = (a, b, r, color, dz = 0) => {
          const c = T(a, b, dz);
          g.fillStyle(color, 1);
          g.fillEllipse(c.x, c.y, r * 1.414, r * 0.97);
        };
        const knob = (a, b, cap) => {
          isoDisc(a, b, 2.4, 0x0c0d10);
          isoDisc(a, b, 2.0, cap, 1.3);
          const c = T(a, b, 1.3), tip = T(a - 0.6, b - 1.6, 1.3);
          g.lineStyle(0.8, 0xf4f1ea, 0.9); g.lineBetween(c.x, c.y, tip.x, tip.y);
        };
        const quad = (a0, a1, b0, b1, dz, color, alpha) =>
          fill([T(a0, b0, dz), T(a1, b0, dz), T(a1, b1, dz), T(a0, b1, dz)], color, alpha);

        // --- corpo: fronte, fianco sinistro, plancia, ponte ---
        fill([P(0, m.Lb, 0), P(m.La, m.Lb, 0), P(m.La, m.Lb, m.zF), P(0, m.Lb, m.zF)], 0x17181c);
        fill([P(0, 0, 0), P(0, m.Lb, 0), P(0, m.Lb, m.zF), P(0, m.Bd, m.zR),
              P(0, m.bt, m.Hb), P(0, 0, m.Hb)], 0x24262c);
        fill([P(0, m.Bd, m.zR), P(m.La, m.Bd, m.zR), P(m.La, m.Lb, m.zF), P(0, m.Lb, m.zF)], 0x3a3d45);
        fill([P(0, m.Bd, m.zR), P(m.La, m.Bd, m.zR), F(m.La, 1), F(0, 1)], 0x2a2c33);
        fill([P(0, 0, m.Hb), P(m.La, 0, m.Hb), P(m.La, m.bt, m.Hb), P(0, m.bt, m.Hb)], 0x4a4d56);

        // spigoli illuminati (luce dall'alto a sinistra)
        g.lineStyle(1, 0x6a6e78, 0.9);
        let e0 = P(0, m.Lb, m.zF), e1 = P(m.La, m.Lb, m.zF); g.lineBetween(e0.x, e0.y, e1.x, e1.y);
        e0 = F(0, 1); e1 = F(m.La, 1); g.lineBetween(e0.x, e0.y, e1.x, e1.y);
        g.lineStyle(1, 0x0c0d10, 0.7);
        e0 = P(0, m.Bd, m.zR); e1 = P(m.La, m.Bd, m.zR); g.lineBetween(e0.x, e0.y, e1.x, e1.y);

        // porte frontali: cuffie + USB
        [[92, 0xa0a4ad], [101, 0x5a5e68]].forEach(([a, col]) => {
          const c = P(a, m.Lb, m.zF / 2);
          g.fillStyle(0x0c0d10, 1); g.fillCircle(c.x, c.y, 1.4);
          g.fillStyle(col, 1); g.fillCircle(c.x, c.y, 0.6);
        });

        // --- 6 canali mono ---
        const nCh = 6, chW = 12, chStart = 7;
        const faderPos = [0.35, 0.55, 0.2, 0.6, 0.45, 0.7];
        const meterLvl = [4, 3, 5, 2, 3, 1];
        const meterCols = [0x49b06a, 0x49b06a, 0x49b06a, 0xf2c53d, 0xe0503f];
        g.lineStyle(0.6, 0x0c0d10, 0.35);
        for (let i = 0; i <= nCh; i++) {
          const a = chStart + chW * i;
          const s0 = T(a, m.Bd + 1), s1 = T(a, m.Lb - 1);
          g.lineBetween(s0.x, s0.y, s1.x, s1.y);
        }
        for (let i = 0; i < nCh; i++) {
          const a = chStart + chW * (i + 0.5);

          // meter LED sul ponte
          for (let s = 0; s < 5; s++) {
            const t0 = 0.14 + s * 0.14, t1 = t0 + 0.1;
            const lit = s < meterLvl[i];
            fill([F(a - 1.6, t0), F(a + 1.6, t0), F(a + 1.6, t1), F(a - 1.6, t1)],
              lit ? meterCols[s] : 0x15161a, lit ? 1 : 1);
          }

          // ingresso XLR (anello metallico + foro)
          isoDisc(a, 13.5, 3.6, 0x9aa0aa);
          isoDisc(a, 13.5, 2.7, 0x0c0d10);
          // gain, EQ, pan
          knob(a, 19, 0xc8483c);
          knob(a, 23.5, 0x4a90e2);
          knob(a, 27.5, 0xcfd2d8);
          // mute (il canale 3 è in mute: tasto acceso)
          quad(a - 2.4, a + 2.4, 30.3, 31.8, 0.6, i === 2 ? 0xe0503f : 0x1c1d22);

          // fader: guida + cursore in rilievo
          const f0 = T(a, 33), f1 = T(a, 40.5);
          g.lineStyle(1.2, 0x0c0d10, 1); g.lineBetween(f0.x, f0.y, f1.x, f1.y);
          const fb = 33 + 7.5 * faderPos[i];
          fill([T(a - 2.8, fb + 1.2, 0), T(a + 2.8, fb + 1.2, 0), T(a + 2.8, fb + 1.2, 2), T(a - 2.8, fb + 1.2, 2)], 0x6a6e78);
          quad(a - 2.8, a + 2.8, fb - 1.2, fb + 1.2, 2, 0xdcdfe4);
          const l0 = T(a - 2.8, fb, 2), l1 = T(a + 2.8, fb, 2);
          g.lineStyle(0.6, 0x1c1d22, 1); g.lineBetween(l0.x, l0.y, l1.x, l1.y);
        }

        // --- sezione master ---
        const mA = chStart + chW * nCh + 3;
        g.lineStyle(0.8, 0x0c0d10, 0.6);
        e0 = T(mA - 2, m.Bd + 1); e1 = T(mA - 2, m.Lb - 1); g.lineBetween(e0.x, e0.y, e1.x, e1.y);
        // encoder grande + tasti funzione retroilluminati
        isoDisc(mA + 9, 15.5, 5.2, 0x0c0d10);
        isoDisc(mA + 9, 15.5, 4.4, 0x5a5e68, 1.5);
        isoDisc(mA + 9, 15.5, 2.0, 0x8a8e98, 1.8);
        const keyCols = [0x49b06a, 0x1c1d22, 0xf2a541, 0x1c1d22, 0x2ec4e0, 0x1c1d22];
        keyCols.forEach((col, k) => {
          const ka = mA + 17 + (k % 3) * 5, kb = 13 + Math.floor(k / 3) * 3.6;
          quad(ka - 1.8, ka + 1.8, kb - 1.2, kb + 1.2, 0.6, col);
        });
        knob(mA + 5, 24.5, 0xcfd2d8);
        knob(mA + 13, 24.5, 0xcfd2d8);
        knob(mA + 21, 24.5, 0xf2a541);
        // due fader master (L/R) con cursore rosso
        [mA + 7, mA + 15].forEach(a => {
          const f0 = T(a, 30.5), f1 = T(a, 40.5);
          g.lineStyle(1.2, 0x0c0d10, 1); g.lineBetween(f0.x, f0.y, f1.x, f1.y);
          const fb = 33;
          fill([T(a - 3, fb + 1.2, 0), T(a + 3, fb + 1.2, 0), T(a + 3, fb + 1.2, 2), T(a - 3, fb + 1.2, 2)], 0x7a2a22);
          quad(a - 3, a + 3, fb - 1.2, fb + 1.2, 2, 0xd6392f);
        });

        // --- schermo sul ponte, sopra la sezione master ---
        const sA0 = mA - 4, sA1 = m.La - 4;
        fill([F(sA0, 0.1), F(sA1, 0.1), F(sA1, 0.9), F(sA0, 0.9)], 0x0c0d10);
        fill([F(sA0 + 1.5, 0.2), F(sA1 - 1.5, 0.2), F(sA1 - 1.5, 0.8), F(sA0 + 1.5, 0.8)], 0x1d4f86);
        // barra di stato + mini meter a colonne + riga di testo sullo schermo
        fill([F(sA0 + 1.5, 0.7), F(sA1 - 1.5, 0.7), F(sA1 - 1.5, 0.8), F(sA0 + 1.5, 0.8)], 0x7fb8f0);
        for (let k = 0; k < 8; k++) {
          const ba = sA0 + 4 + k * 3, top = 0.28 + ((k * 37) % 5) * 0.07;
          fill([F(ba, 0.26), F(ba + 1.6, 0.26), F(ba + 1.6, top), F(ba, top)], k < 6 ? 0x6fe39a : 0xf2c53d);
        }
        e0 = F(sA0 + 4, 0.6); e1 = F(sA1 - 5, 0.6);
        g.lineStyle(0.7, 0xcfe4ff, 0.8); g.lineBetween(e0.x, e0.y, e1.x, e1.y);
        // riflesso sul vetro
        fill([F(sA0 + 1.5, 0.8), F(sA0 + 9, 0.8), F(sA0 + 5, 0.2), F(sA0 + 1.5, 0.2)], 0xffffff, 0.08);

        // contorno complessivo
        g.lineStyle(1, 0x0c0d10, 0.85);
        g.strokePoints([P(m.La, 0, m.Hb), P(0, 0, m.Hb), P(0, 0, 0), P(0, m.Lb, 0),
          P(m.La, m.Lb, 0), P(m.La, m.Lb, m.zF), P(m.La, m.Bd, m.zR), F(m.La, 1)], true);
        break;
      }
      case 'controller': {
        // consolle luci: piccolo display in alto + griglia di pulsanti/scene
        // sotto — diversa a colpo d'occhio dai fader del mixer.
        g.fillStyle(def.body.fill, 1); g.lineStyle(2, def.body.accent, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 5); g.strokeRoundedRect(-w / 2, -h / 2, w, h, 5);
        g.fillStyle(0x1c1d22, 1);
        g.fillRoundedRect(-w * 0.36, -h * 0.36, w * 0.72, h * 0.26, 2);
        g.fillStyle(def.body.accent, 0.55);
        g.fillRect(-w * 0.3, -h * 0.31, w * 0.5, h * 0.05);
        const cols = 5, rows = 2, gridW = w * 0.74, gridTop = h * 0.02, gridH = h * 0.28;
        for (let r = 0; r < rows; r++) {
          for (let ci = 0; ci < cols; ci++) {
            const bx = -gridW / 2 + (gridW / (cols - 1)) * ci;
            const by = gridTop + (gridH / (rows - 1)) * r;
            g.fillStyle(def.body.accent, 0.75);
            g.fillRoundedRect(bx - 2, by - 2, 4, 4, 1);
          }
        }
        break;
      }
      default: {
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

    const compType = id.indexOf('_') >= 0 ? id.split('_')[0] : id;
    // 'allaccio' condivide shape:'quadro' con il vero Quadro (stesso stile
    // grafico), ma qui sotto contano solo le regole del Quadro vero e proprio.
    const isRealQuadro = compType === 'quadro';

    // LED di stato: spento finché non si preme Test Impianto, poi verde solo
    // se arriva davvero corrente (o segnale, per un dispositivo passivo come
    // la DI) fino in fondo alla catena — vedi isComponentLive/runSystemTest.
    // L'Allaccio è la sorgente fissa: non ha bisogno di un proprio LED.
    let led = null;
    if (compType !== 'allaccio') {
      led = this.add.graphics();
      c.add(led);
      this.drawLed(led, def, false);
    }

    const labelX = def.labelPos ? def.labelPos.x : 0;
    const labelY = def.labelPos ? def.labelPos.y
      : ((def.shape === 'par' || def.shape === 'top' || def.shape === 'ciabatta' || def.shape === 'di' || isRealQuadro) ? -def.body.h / 2 - 8 : 0);
    const label = this.add.text(labelX, labelY, def.label, {
      fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#eee9df'
    }).setOrigin(0.5);
    c.add(label);
    const idLabel = this.add.text(0, def.body.h / 2 + 12, id.replace(/_/g, ' '), {
      fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#8b8e98'
    }).setOrigin(0.5);
    c.add(idLabel);

    // Bersaglio per interagire col componente: l'INTERO corpo (con un margine
    // extra), non la sola etichetta o le minuscole porte — molto più facile
    // da toccare su schermi piccoli. Il comportamento dipende dalla modalità:
    //  - un cavo è selezionato (modalità cablaggio) -> il tocco collega alla
    //    porta più vicina al punto toccato, su QUALUNQUE componente (anche
    //    Quadro e Testa, che non si spostano ma vanno comunque cablati);
    //  - nessun cavo selezionato -> il tocco seleziona il componente per
    //    spostarlo (solo per i tipi che si possono spostare).
    // Così, mentre si cablano i cavi, toccare un componente non fa MAI
    // scattare per sbaglio lo spostamento.
    const movable = compType !== 'allaccio' && compType !== 'top';
    const pad = 8;
    body.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-def.body.w / 2 - pad, -def.body.h / 2 - pad, def.body.w + pad * 2, def.body.h + pad * 2),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true
    });
    body.on('pointerdown', (pointer, lx, ly, event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      if (isWiringTabActive()) {
        let nearest = null, nearestDist = Infinity;
        def.ports.forEach(p => {
          const d = Math.hypot(lx - p.dx, ly - p.dy);
          if (d < nearestDist) { nearestDist = d; nearest = p; }
        });
        if (nearest) this.handlePortClick(id, nearest.id, nearest.signal);
        return;
      }
      if (movable) { this.handleMoveSelect(id); return; }
      // Quadro/Testa: non si spostano, ma un tocco qui non deve comunque
      // "perdersi" — si comporta come un tocco sul pavimento sottostante.
      if (gameState.selectedPieceType) { this.placeArmedPieceAt(pointer.worldX, pointer.worldY); return; }
      this.clearEdgeSelection();
      this.cancelPending();
    });

    const portDots = {};
    const portMarkers = {};
    def.ports.forEach(p => {
      // ogni porta è la FACCIA del connettore reale (vedi drawPortGlyph):
      // corpo del colore vero del connettore, anello esterno del colore del
      // cavo che ci va, contatti disegnati sopra.
      const dot = this.add.circle(p.dx, p.dy, PORT_R, CONNECTOR_BODY[p.signal] || SIGNAL_COLOR[p.signal], 1)
        .setStrokeStyle(2.4, SIGNAL_COLOR[p.signal])
        .setInteractive({ useHandCursor: true });
      dot.on('pointerover', () => this.showPortLabel(id, p));
      dot.on('pointerout', () => this.hidePortLabel());
      dot.on('pointerdown', (pointer, lx, ly, event) => {
        if (event && event.stopPropagation) event.stopPropagation();
        // su touch non c'è il passaggio del mouse: l'etichetta compare al tocco
        if (pointer && pointer.wasTouch) this.showPortLabel(id, p, 1800);
        if (isWiringTabActive()) { this.handlePortClick(id, p.id, p.signal); return; }
        if (movable) { this.handleMoveSelect(id); return; }
      });
      c.add(dot);
      portDots[p.id] = dot;
      const marker = this.drawPortGlyph(p);
      c.add(marker);
      portMarkers[p.id] = marker;
    });

    let phaseBars = null;
    if (isRealQuadro) {
      phaseBars = this.add.graphics();
      c.add(phaseBars);
      const breakerBottom = -def.body.h / 2 + 8 + def.body.h * 0.35;
      def.ports.filter(p => p.phase).forEach(p => {
        const tag = this.add.text(p.dx, breakerBottom + 7, p.phase, {
          fontFamily: 'Inter, sans-serif', fontSize: '9px', fontStyle: 'bold', color: '#8b8e98'
        }).setOrigin(0.5);
        c.add(tag);
      });

      // pulsante sempre visibile, ancorato al Quadro stesso: molto più diretto
      // di un bottone in header slegato dall'oggetto a cui si riferisce.
      // Ha una hit area propria "sopra" quella del corpo (stesso meccanismo
      // delle porte, incluso stopPropagation) così non fa scattare
      // spostamento/cablaggio quando viene toccato.
      const badgeX = def.body.w / 2 - 2, badgeY = -def.body.h / 2 - 2;
      const badgeBg = this.add.circle(badgeX, badgeY, 11, 0x1c1d22, 1)
        .setStrokeStyle(2, 0xf2a541, 1)
        .setInteractive({ useHandCursor: true });
      const badgeIcon = this.add.text(badgeX, badgeY, '🔍', { fontSize: '11px' }).setOrigin(0.5);
      badgeBg.on('pointerdown', (pointer, lx, ly, event) => {
        if (event && event.stopPropagation) event.stopPropagation();
        renderQuadroModal();
        el('#quadro-modal').classList.add('show');
      });
      c.add(badgeBg); c.add(badgeIcon);
    }

    return { container: c, glow, portDots, portMarkers, idLabel, def, phaseBars, led };
  }

  /* faccia del connettore reale, disegnata sopra il corpo tondo della porta:
     numero e disposizione dei contatti come nella realtà, e il genere
     (vedi CONNECTOR_GENDER): MASCHIO = inserto scuro con pin metallici
     chiari, FEMMINA = fori neri (su un inserto grigio se il corpo è scuro).
     In più una freccetta sul bordo dice il verso del segnale:
     verde che ENTRA nella presa = IN, arancione che ESCE = OUT. */
  drawPortGlyph (p) {
    const g = this.add.graphics({ x: p.dx, y: p.dy });
    const gender = (CONNECTOR_GENDER[p.signal] || {})[p.dir] || 'female';
    const male = gender === 'male';
    const PIN = 0xe4dfd2, HOLE = 0x0b0c0e;
    const insert = (r, color) => { g.fillStyle(color || 0x141519, 1); g.fillCircle(0, 0, r); };
    // fondo della faccia: inserto scuro per i pin, grigio per i fori su un
    // corpo scuro, nessuno (si vede il corpo) per i fori su un corpo chiaro
    const face = (r) => {
      if (male) insert(r);
      else if (DARK_BODY.has(p.signal)) insert(r, 0x6a6e77);
    };
    // un contatto: pin metallico (maschio) o foro (femmina)
    const contact = (x, y, r) => {
      g.fillStyle(male ? PIN : HOLE, 1);
      g.fillCircle(x, y, r || 1.25);
    };
    const latch = () => { g.fillStyle(male ? PIN : HOLE, 1); g.fillRect(-1, -PORT_R + 0.6, 2, 2); };
    const deg = Math.PI / 180;

    // contorno scuro sottile attorno all'anello colorato, stacca dal fondo
    g.lineStyle(1, 0x0c0d10, 1);
    g.strokeCircle(0, 0, PORT_R + 1.7);

    switch (p.signal) {
      case 'xlr': {
        // XLR 3 poli: due contatti affiancati in alto, il terzo in basso
        // leggermente spostato; tacca del fermo sul bordo superiore
        face(5.8);
        contact(-2.6, -1.6); contact(2.6, -1.6); contact(0.9, 2.8);
        latch();
        break;
      }
      case 'dmx': {
        // XLR 5 poli: i cinque contatti su un SEMICERCHIO (arco di 180°),
        // aperto verso la tacca del fermo — nessun contatto al centro
        face(5.8);
        for (let i = 0; i < 5; i++) {
          const a = (180 - i * 45) * deg;
          contact(Math.cos(a) * 3.7, Math.sin(a) * 3.7 - 1.2, 1.1);
        }
        latch();
        break;
      }
      case 'speakon': {
        // Speakon da pannello: corpo nero, anello bianco, perno centrale e
        // due chiavi di bloccaggio — il genere non cambia tra ingresso e link
        g.lineStyle(1.3, 0xeeeeee, 1); g.strokeCircle(0, 0, 5.6);
        g.fillStyle(0x3a3d44, 1); g.fillCircle(0, 0, 2.6);
        g.fillStyle(0xeeeeee, 1);
        g.fillRect(-0.9, -6.4, 1.8, 2); g.fillRect(-0.9, 4.4, 1.8, 2);
        break;
      }
      case 'powercon': {
        // PowerCON: corpo nero, anello interno del colore reale del
        // connettore da pannello — BLU = power in, GRIGIO = power out
        g.lineStyle(1.6, p.dir === 'in' ? 0x3d7fe0 : 0xcfd2d6, 1);
        g.strokeCircle(0, 0, 5.1);
        g.fillStyle(PIN, 1);
        [0, 120, 240].forEach(d => {
          const a = (d - 90) * deg;
          g.fillCircle(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 1.1);
        });
        break;
      }
      case 'schuko': {
        // Schuko: due poli affiancati + contatti di terra laterali (sopra e
        // sotto); la presa (femmina) ha i fori, la spina (maschio) i pin
        face(6.2);
        contact(-2.9, 0, 1.5); contact(2.9, 0, 1.5);
        g.fillStyle(PIN, 1);
        g.fillRect(-1.6, -6.4, 3.2, 1.6); g.fillRect(-1.6, 4.8, 3.2, 1.6);
        break;
      }
      case 'cee_mono': {
        // CEE 2P+T (blu): due poli + terra più grossa in basso
        face(5.8);
        contact(-3.3, -1.2); contact(3.3, -1.2); contact(0, 3.3, 1.8);
        latch();
        break;
      }
      case 'cee_tri': {
        // CEE 3P+N+T (rossa): quattro contatti sulla corona + terra più grossa
        face(5.8);
        for (let i = 0; i < 4; i++) {
          const a = (150 + i * 80) * deg;
          contact(Math.cos(a) * 3.9, Math.sin(a) * 3.9);
        }
        contact(0, 3.9, 1.7);
        latch();
        break;
      }
      case 'jack': {
        // presa jack: ghiera metallica filettata con il foro al centro
        g.fillStyle(0xb8bcc4, 1); g.fillCircle(0, 0, 5.4);
        g.lineStyle(1, 0x7d828c, 1); g.strokeCircle(0, 0, 4.2);
        g.fillStyle(HOLE, 1); g.fillCircle(0, 0, 2.2);
        break;
      }
      default:
        contact(0, 0, 2);
    }

    // freccia di direzione sul bordo in alto a destra
    const bx = PORT_R * 0.8, by = -PORT_R * 0.8;
    const isIn = p.dir === 'in';
    const tip = isIn ? { x: bx - 2.6, y: by + 2.6 } : { x: bx + 3.4, y: by - 3.4 };
    const ux = isIn ? -0.7071 : 0.7071, uy = isIn ? 0.7071 : -0.7071; // verso della freccia
    const back = { x: tip.x - ux * 5.5, y: tip.y - uy * 5.5 };
    const px = -uy * 3.2, py = ux * 3.2;
    g.fillStyle(isIn ? 0x49b06a : 0xf2a541, 1);
    g.lineStyle(1.2, 0x141519, 1);
    g.fillTriangle(tip.x, tip.y, back.x + px, back.y + py, back.x - px, back.y - py);
    g.strokeTriangle(tip.x, tip.y, back.x + px, back.y + py, back.x - px, back.y - py);
    return g;
  }

  /* etichetta sopra una porta: tipo di connettore, verso e genere
     (es. "DMX 5 poli · IN · maschio"), più la fase per le prese del Quadro */
  showPortLabel (componentId, p, autoHideMs) {
    const v = this.compVisuals[componentId];
    if (!v) return;
    const gender = (CONNECTOR_GENDER[p.signal] || {})[p.dir] === 'male' ? 'maschio' : 'femmina';
    const parts = [SIGNAL_LABEL[p.signal] || p.signal, p.dir === 'in' ? 'IN' : 'OUT', gender];
    if (p.phase) parts.push(p.phase);
    const pos = this.getPortScreenPos(componentId, p.id);
    if (!this.portLabel) {
      this.portLabel = this.add.text(0, 0, '', {
        fontFamily: 'Inter, sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#eee9df',
        backgroundColor: '#1c1d22', padding: { x: 8, y: 4 }, resolution: 2
      }).setOrigin(0.5, 1).setDepth(80);
    }
    this.portLabel.setText(parts.join(' · '));
    this.portLabel.setPosition(pos.x, pos.y - PORT_R - 6);
    // sempre leggibile, qualunque sia lo zoom della camera
    this.portLabel.setScale(1 / this.cameras.main.zoom);
    this.portLabel.setVisible(true);
    if (this.portLabelTimer) { this.portLabelTimer.remove(); this.portLabelTimer = null; }
    if (autoHideMs) this.portLabelTimer = this.time.delayedCall(autoHideMs, () => this.hidePortLabel());
  }

  hidePortLabel () {
    if (this.portLabel) this.portLabel.setVisible(false);
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

  /* piccolo LED nell'angolo in alto a sinistra di ogni dispositivo (tranne
     l'Allaccio): spento/grigio scuro di default, verde acceso quando
     runSystemTest verifica che corrente/segnale arrivano davvero. */
  drawLed (g, def, on) {
    const x = def.ledPos ? def.ledPos.x : -def.body.w / 2 + 7;
    const y = def.ledPos ? def.ledPos.y : -def.body.h / 2 + 9;
    g.clear();
    g.lineStyle(1, 0x0c0d10, 1);
    g.fillStyle(on ? 0x49b06a : 0x3a1414, 1);
    g.fillCircle(x, y, 3.5);
    g.strokeCircle(x, y, 3.5);
    if (on) {
      g.fillStyle(0x49b06a, 0.3);
      g.fillCircle(x, y, 6.5);
    }
  }

  setLed (v, on) {
    if (!v.led) return;
    this.drawLed(v.led, v.def, on);
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

    if (type === 'quadro') {
      const specLabel = this.add.text(0, def.body.h / 2 + 24, '', {
        fontFamily: 'Inter, sans-serif', fontSize: '9.5px', color: '#8b8e98', align: 'center'
      }).setOrigin(0.5);
      visual.container.add(specLabel);
      visual.specLabel = specLabel;
    }

    // "sul palco" (instradamento cavi diretto) vale per QUALSIASI cella del
    // complesso palco, non solo la pedana spettacolo — include quindi anche
    // la fascia Off Stage, che è alla stessa quota.
    const zone = isStageCell(cx, cy) ? 'stage' : 'ground';
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
    // 36px (non un valore più piccolo): con un distacco minore le porte
    // sub.spk_thru e top.spk_in finiscono a meno di 18px l'una dall'altra
    // (somma dei due raggi) e si sovrappongono, rendendo quel collegamento
    // impossibile da cliccare — vedi cronologia del 2° livello per il bug esatto.
    const offY = -(subDef.body.h / 2 + topDef.body.h / 2 + 36);
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
    const cableKind = CABLE_TYPES[gameState.selectedCable];
    if (!cableKind.endpoints.includes(signal)) { showToast('Questo cavo non è compatibile con questa porta.'); return; }

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

    // un adattatore (2 endpoint diversi, es. CEE/PowerCON) collega solo
    // connettori DIVERSI tra loro: due porte uguali vogliono il cavo semplice.
    if (cableKind.endpoints.length === 2 && pendingDef.signal === currentDef.signal) {
      showToast('Questo è un adattatore: collega due connettori diversi. Per due porte uguali serve il cavo semplice.');
      return;
    }

    if (pendingDef.dir === currentDef.dir) {
      showToast(pendingDef.dir === 'out'
        ? 'Due uscite non si collegano tra loro: serve una porta IN.'
        : 'Due ingressi non si collegano tra loro: serve una porta OUT.');
      return;
    }

    const outSide = pendingDef.dir === 'out' ? pending : { componentId, portId };
    const inSide = pendingDef.dir === 'out' ? { componentId, portId } : pending;
    const outDef = pendingDef.dir === 'out' ? pendingDef : currentDef;
    const inDef = pendingDef.dir === 'out' ? currentDef : pendingDef;

    // le prese del Quadro (multi:true) accettano più cavi: lì il vincolo non è
    // "una porta, un cavo" ma il carico per fase, controllato al Test Impianto.
    if ((!outDef.multi && portHasConnection(outSide.componentId, outSide.portId)) ||
        (!inDef.multi && portHasConnection(inSide.componentId, inSide.portId))) {
      showToast('Questa porta è già impegnata da un altro cavo: scegline una libera.');
      return;
    }

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
    const anySelected = this.selectedEdgeId != null;
    gameState.edges.forEach(e => {
      const cableKind = CABLE_TYPES[e.signal];
      if (!gameState.visibleSignals[cableKind.layer]) { e._pts = null; return; }
      const from = this.getPortScreenPos(e.a, e.aPort);
      const to = this.getPortScreenPos(e.b, e.bPort);
      if (!from || !to) { e._pts = null; return; }
      const zoneA = gameState.placed[e.a] && gameState.placed[e.a].zone;
      const zoneB = gameState.placed[e.b] && gameState.placed[e.b].zone;
      const isSelected = e.id === this.selectedEdgeId;
      const color = isSelected ? 0xf2a541 : cableKind.color;
      const width = isSelected ? 5 : 3;
      // con un cavo selezionato, tutti gli altri si "spengono" per farlo
      // risaltare nella matassa; senza selezione restano tutti a piena vista
      const alpha = anySelected ? (isSelected ? 1 : 0.16) : 1;
      let pts;
      pts = (zoneA === 'stage' && zoneB === 'stage')
        ? [from, to]
        : computeRoutePoints(from, to, this.stageBox, 30);
      // cavo in neoprene nero (come quelli veri), con un bordo appena più
      // chiaro per staccarlo dal pavimento e un filetto centrale del colore
      // del tipo di cavo per riconoscerlo. Il cavo selezionato resta arancione.
      if (isSelected) {
        strokeRoutedPath(this.edgeGraphics, pts, color, width, 18, alpha);
      } else {
        strokeRoutedPath(this.edgeGraphics, pts, 0x55585f, 5.5, 18, alpha);
        strokeRoutedPath(this.edgeGraphics, pts, 0x17181b, 4, 18, alpha);
        strokeRoutedPath(this.edgeGraphics, pts, color, 1.4, 18, alpha);
      }
      e._pts = pts;
      // verso del cavo: freccia a metà percorso, dall'OUT (a) all'IN (b).
      // Sul cavo selezionato al suo posto c'è il pulsante ✕.
      if (!isSelected) this.drawFlowArrow(pts, color, alpha);
    });
    this.refreshEdgeDeleteButton();
    updateConnectionCounter();
    this.updateQuadroVisual();
    const modal = el('#quadro-modal');
    if (modal && modal.classList.contains('show')) renderQuadroModal();
  }

  drawFlowArrow (pts, color, alpha) {
    const p0 = pointAlongPolyline(pts, 0.47);
    const p1 = pointAlongPolyline(pts, 0.53);
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const mid = pointAlongPolyline(pts, 0.5);
    const tri = [[7, 0], [-5, -5.5], [-5, 5.5]].map(([x, y]) => ({
      x: mid.x + x * Math.cos(ang) - y * Math.sin(ang),
      y: mid.y + x * Math.sin(ang) + y * Math.cos(ang)
    }));
    const g = this.edgeGraphics;
    g.fillStyle(color, alpha);
    g.lineStyle(1.5, 0x141519, alpha);
    g.fillTriangle(tri[0].x, tri[0].y, tri[1].x, tri[1].y, tri[2].x, tri[2].y);
    g.strokeTriangle(tri[0].x, tri[0].y, tri[1].x, tri[1].y, tri[2].x, tri[2].y);
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
        const marker = v.portMarkers[p.id];
        const a = gameState.visibleSignals[p.signal] ? 1 : 0.22;
        if (dot) dot.setAlpha(a);
        if (marker) marker.setAlpha(a);
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
    const v = this.compVisuals[componentId];
    const dot = v.portDots[portId];
    const portDef = getPortDef(componentId, portId);
    dot.setStrokeStyle(on ? 3 : 2.4, on ? 0xf2a541 : SIGNAL_COLOR[portDef.signal]);
    dot.setScale(on ? 1.3 : 1);
    const marker = v.portMarkers[portId];
    if (marker) marker.setScale(on ? 1.3 : 1);
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
      const offY = -(subDef.body.h / 2 + topDef.body.h / 2 + 36);
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

  /* ---------------- TEST IMPIANTO: collaudo tecnico (potenza + segnale + PC di
     regia), prima ancora che arrivino i musicisti. Il vero soundcheck con gli
     strumenti è una fase successiva, separata da questa. ---------------- */
  runSystemTest () {
    const result = runValidation();
    gameState.tested = true;
    Object.values(this.compVisuals).forEach(v => this.setGlow(v, false));

    let trippedIds = new Set();
    if (result.overPhase) {
      trippedIds = this.triggerPhaseTrip(result.overloadedPhases);
    }

    // LED per ogni dispositivo (tranne l'Allaccio, che è la sorgente):
    // verde solo se corrente/segnale arrivano davvero fino in fondo alla
    // catena E la fase che lo alimenta non è saltata per sovraccarico.
    Object.keys(gameState.placed).forEach(id => {
      if (gameState.placed[id].type === 'allaccio') return;
      const v = this.compVisuals[id];
      if (!v) return;
      this.setLed(v, isComponentLive(id) && !trippedIds.has(id));
    });

    if (result.pass) {
      setCircuitStatus('ok');
      showToast('Impianto collaudato: alimentazione e segnale integri su tutta la linea.', 'ok');
      this.playSuccessSequence();
      return;
    }

    setCircuitStatus('error');

    if (result.overPhase) {
      showToast('Sovraccarico sulla fase ' + result.overloadedPhases.join(', ') + ': la protezione è scattata.');
    } else {
      const msg = result.overBudget
        ? 'Potenza richiesta oltre il limite disponibile.'
        : 'Circuito incompleto: componenti evidenziati in rosso non ricevono segnale o alimentazione.';
      showToast(msg);
    }

    result.failedComponents.forEach(id => {
      const v = this.compVisuals[id];
      if (!v) return;
      this.setGlow(v, true, 0xe0503f);
      this.tweens.add({ targets: v.container, angle: { from: -2, to: 2 }, duration: 90, yoyo: true, repeat: 3 });
    });
  }

  /* ---------------- sovraccarico di fase: distacco + scintille ---------------- */
  triggerPhaseTrip (overloadedPhases) {
    const tripped = new Set();
    const quadroEntry = Object.values(gameState.placed).find(c => c.type === 'quadro');
    if (!quadroEntry) return tripped;
    const def = COMPONENT_TYPES.quadro;
    this.cameras.main.shake(220, 0.006);

    overloadedPhases.forEach(phase => {
      const portDef = def.ports.find(p => p.phase === phase);
      if (!portDef) return;
      const pos = this.getPortScreenPos(quadroEntry.id, portDef.id);
      if (pos) this.spawnSparks(pos.x, pos.y);
      gameState.edges
        .filter(e => e.a === quadroEntry.id && e.aPort === portDef.id)
        .forEach(e => this.markSubtreeTripped(e.b, new Set([quadroEntry.id]), tripped));
    });
    return tripped;
  }

  /* spegne (glow rosso + scossone) l'intero ramo a valle di una presa in
     sovraccarico: non solo il primo dispositivo, ma tutto ciò che vi pende.
     Gli id raccolti in "tripped" servono poi a runSystemTest per spegnere
     anche il LED di questi dispositivi (topologicamente "collegati", ma la
     corrente non arriva comunque perché la protezione è scattata a monte). */
  markSubtreeTripped (componentId, visited, tripped) {
    if (visited.has(componentId)) return;
    visited.add(componentId);
    tripped.add(componentId);
    const v = this.compVisuals[componentId];
    if (v) {
      this.setGlow(v, true, 0xe0503f);
      this.tweens.add({ targets: v.container, angle: { from: -3, to: 3 }, duration: 80, yoyo: true, repeat: 4 });
    }
    // solo a valle elettricamente: un Sub/Top non va marcato come "in
    // blackout" solo perché è collegato via Speakon a un finale che sta su
    // una fase saltata — lui potrebbe benissimo essere su un'altra fase.
    gameState.edges.forEach(e => {
      if (e.a === componentId && POWER_CABLE_IDS.has(e.signal)) {
        this.markSubtreeTripped(e.b, visited, tripped);
      }
    });
  }

  /* piccola scarica di scintille disegnata a mano (nessun asset esterno,
     stesso linguaggio grafico vettoriale del resto del gioco) */
  spawnSparks (x, y) {
    const flash = this.add.circle(x, y, 16, 0xffffff, 0.9).setDepth(89);
    this.tweens.add({ targets: flash, alpha: 0, scale: 2.2, duration: 220, onComplete: () => flash.destroy() });

    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 14 + Math.random() * 22;
      const spark = this.add.rectangle(x, y, 3, 3, Math.random() < 0.5 ? 0xffffff : 0xf2c53d, 1).setDepth(90);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: 260 + Math.random() * 160,
        ease: 'Cubic.Out',
        onComplete: () => spark.destroy()
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

    const banner = this.add.text(GAME_W / 2, GAME_H / 2, 'IMPIANTO COLLAUDATO', {
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
    gameState.nextIndex = { sub: 1, top: 1, mixer: 1, par: 1, controller: 1, ampli: 1, quadro: 1, ciabatta: 1, ciabatta_cee: 1, pc: 1, di: 1 };
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

    this.drawAllaccio();
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
      if (c.type === 'quadro') {
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
