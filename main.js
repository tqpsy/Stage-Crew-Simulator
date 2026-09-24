/* ======================================================================
   STAGE CREW SIMULATOR — Livello 1 "Festa della scuola" — MVP giocabile
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
  jack:     0x2ec4e0,
  usbc:     0x6fd08c
};


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
  jack:     { in: 'female', out: 'female' },
  usbc:     { in: 'female', out: 'female' }   // le prese sono femmine, il cavo è maschio ai due capi
};

// nomi leggibili dei connettori (pannello posteriore)
const SIGNAL_LABEL = {
  xlr: 'XLR 3 poli', dmx: 'DMX 5 poli', speakon: 'Speakon', powercon: 'PowerCON',
  schuko: 'Schuko', cee_mono: 'CEE 230V', cee_tri: 'CEE 400V', jack: 'Jack 6,35', usbc: 'USB-C'
};

/* Geometria del mixer in "unità banco" (a = lungo i canali, b = dal retro
   al fronte operatore, z = altezza), proiettata con la stessa inclinazione
   della griglia di gioco (TILE_H/TILE_W = 70/102). Usata sia dal disegno
   sia per ancorare le porte sul retro, così restano sempre allineate. */
const MIXER_GEO = {
  La: 112, Lb: 42,       // lunghezza (canali) e profondità del banco
  Bd: 10, bt: 4,         // dove la plancia incontra il ponte, profondità del cappello del ponte
  zF: 5, zR: 10, Hb: 24  // altezza bordo anteriore, posteriore e del ponte meter/schermo
};
// le porte stanno sul pannello posteriore, appena dietro al ponte: da lì
// escono davvero i cavi di un banco reale
function mixerRearIso (a) { return [a, -6, MIXER_GEO.Hb + 3]; }

/* Proiezione isometrica comune a TUTTI gli apparecchi (la stessa del mixer e
   della griglia di gioco, TILE_H/TILE_W = 70/102): a = asse che sale verso il
   fondo a destra, b = asse che scende verso destra, z = altezza. Delle facce
   di un solido se ne vedono tre: il piano superiore, la faccia a=0 (guarda in
   basso a sinistra, verso il pubblico) e la faccia b=B (in basso a destra).
   isoFrame centra il solido A×B×Z sull'origine del container. */
const ISO_K = 0.343;
function isoFrame (A, B, Z) {
  const ox = -(A + B) / 4;
  const oy = -((B - A) * ISO_K - Z) / 2;
  const P = (a, b, z = 0) => ({ x: (a + b) * 0.5 + ox, y: (b - a) * ISO_K - z + oy });
  P.A = A; P.B = B; P.Z = Z;
  return P;
}
// il banco del mixer nella proiezione comune, così può girarsi verso il
// palco quando sta in FOH (vedi orientK)
const MIXER_ISO = isoFrame(MIXER_GEO.La, MIXER_GEO.Lb, MIXER_GEO.Hb);
/* stesso solido ruotato di k quarti di giro sul pavimento (per i dispositivi
   che cambiano verso a seconda di dove stanno, vedi orientK). Le coordinate
   locali (a, b, z) restano quelle del disegno: cambia solo dove finiscono. */
function rotDir (k, da, db) {
  switch (((k % 4) + 4) % 4) {
    case 1: return [-db, da];      // +b -> -a
    case 2: return [-da, -db];
    case 3: return [db, -da];      // -a -> +b
    default: return [da, db];
  }
}
function rotFrame (base, k) {
  if (!k) return base;
  const { A, B, Z } = base;
  const odd = k % 2 === 1;
  const W = isoFrame(odd ? B : A, odd ? A : B, Z);
  const P = (a, b, z = 0) => {
    const [ra, rb] = rotDir(k, a - A / 2, b - B / 2);
    return W(ra + (odd ? B : A) / 2, rb + (odd ? A : B) / 2, z);
  };
  P.A = A; P.B = B; P.Z = Z; P.k = k;
  return P;
}
/* verso del dispositivo: tutti guardano come il mixer (fronte verso +b, il
   tecnico in quinta), tranne quelli in Regia di sala (FOH), che hanno il
   retro verso il palco e il fronte verso il fonico (-a). def.front dice
   dove guarda il fronte nel disegno. */
function orientK (def, x, y) {
  if (!def.front) return 0;
  const { cx, cy } = screenToCell(x, y);
  const want = isFohCell(cx, cy) ? '-a' : '+b';
  if (def.front === want) return 0;
  return def.front === '+b' ? 1 : 3;
}

// posizione di una porta ancorata a un punto del solido
function isoPort (P, a, b, z) {
  const p = P(a, b, z);
  return { dx: Math.round(p.x), dy: Math.round(p.y) };
}

// tinte delle tre facce visibili (piano, fianco sinistro, fianco destro)
const ISO_BLACK = { top: 0x3a3d45, left: 0x26282e, right: 0x17181c };
const ISO_GREY  = { top: 0x9aa0aa, left: 0x7d828c, right: 0x5f646d };

// inviluppo convesso (monotone chain) — per la sagoma di un cilindro
function convexHull (pts) {
  const p = pts.slice().sort((u, v) => u.x - v.x || u.y - v.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [], upper = [];
  p.forEach(q => { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); });
  p.slice().reverse().forEach(q => { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); });
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

const SUB_ISO   = isoFrame(48, 56, 46);   // cassa sub: baffle con il woofer sulla faccia a=0
const TOP_ISO   = isoFrame(32, 36, 48);   // testa a due vie, su palo sopra il sub
const TOP_POLE  = 18;                     // px: palo tra sub e testa
const PAR_ISO   = isoFrame(38, 34, 42);   // PAR LED su staffa (lente sulla faccia a=0)
const STAND_ISO = isoFrame(46, 46, 3);    // stativo luci: treppiede a terra
const STAND_POLE = 64;                    // px: asta dello stativo fino alla barra a T
const AMP_ISO   = isoFrame(80, 46, 16);   // finale a rack, pannello frontale sulla faccia b=B
const CTRL_ISO  = isoFrame(56, 34, 10);   // consolle luci da tavolo, piano inclinato
const QUADRO_ISO = isoFrame(112, 34, 46); // armadio di distribuzione, prese sul fronte b=B
const QUADRO_PHASE_A = [22, 56, 90];      // posizione lungo il fronte di prese/interruttori L1-L3
const ALL_ISO   = isoFrame(26, 26, 30);   // cassetta dell'allaccio della venue
const CIAB_ISO  = isoFrame(104, 16, 8);   // ciabatta civile: barra lunga e bassa, 3 prese sul piano
const CIABCEE_ISO = isoFrame(134, 16, 8); // ciabatta con spina CEE: 4 prese
const PC_ISO    = isoFrame(26, 34, 22);   // laptop aperto
const DI_ISO    = isoFrame(30, 26, 14);   // DI passiva doppia, scatolina d'acciaio
const INTF_ISO  = isoFrame(46, 30, 12);   // scheda audio USB da tavolo

// la testa sta sul sub: il fondo del suo palo tocca il centro del piano del sub
function isoDepth (screenY) { return 10 + screenY / 10000; }

// il PAR poggia con la sua piastra sulla barra a T in cima allo stativo
function standBarY () { return STAND_ISO(STAND_ISO.A / 2, STAND_ISO.B / 2, 0).y - STAND_POLE; }
function parOffsetY () { return standBarY() - PAR_ISO(19, 17, 0).y; }

function topOffsetY () {
  const subTop = SUB_ISO(SUB_ISO.A / 2, SUB_ISO.B / 2, SUB_ISO.Z);
  const topBottom = TOP_ISO(TOP_ISO.A / 2, TOP_ISO.B / 2, 0);
  return subTop.y - topBottom.y - TOP_POLE;
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
  usbc:            { endpoints: ['usbc'],                  layer: 'usbc',     color: 0x6fd08c },
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
    body: { w: 52, h: 82, fill: 0x232830, accent: 0x4a90e2 },
    ledPos: SUB_ISO(4, 56, 43),
    // pannello connettori sul fianco (faccia b=B): Speakon in/link in alto,
    // PowerCON in basso
    ports: [
      { id: 'power',    signal: 'powercon', dir: 'in',  ...isoPort(SUB_ISO, 24, 56, 8) },
      { id: 'spk_in',   signal: 'speakon',  dir: 'in',  ...isoPort(SUB_ISO, 9, 56, 33) },
      { id: 'spk_thru', signal: 'speakon',  dir: 'out', ...isoPort(SUB_ISO, 41, 56, 33) }
    ]
  },
  top: {
    label: 'TOP', category: 'audio', powerW: 0, zone: 'pit', shape: 'top',
    body: { w: 34, h: 72, fill: 0x232830, accent: 0x4a90e2 },
    ledPos: TOP_ISO(3, 36, 45),
    ports: [
      { id: 'spk_in', signal: 'speakon', dir: 'in', ...isoPort(TOP_ISO, 16, 36, 12) }
    ]
  },
  mixer: {
    label: 'MIX', category: 'audio', powerW: 50, zone: 'offstage', shape: 'mixer',
    body: { w: 77, h: 77, fill: 0x2a2c32, accent: 0x8a8e98 },
    // LED di alimentazione sul ponte, come su un banco vero
    frame: MIXER_ISO, front: '+b',
    ledIso: [3.5, 7, 17],
    // retro del ponte (livello 1): 4 ingressi microfonici XLR, 2 ingressi di
    // linea jack, uscite MAIN L/R, 2 mandate AUX per i monitor e
    // l'alimentazione (i canali cresceranno coi livelli)
    ports: [
      ...[1, 2, 3, 4].map(n => ({ id: 'in_' + n, signal: 'xlr', dir: 'in', iso: mixerRearIso(-2 + n * 10) })),
      ...[5, 6].map(n => ({ id: 'in_' + n, signal: 'jack', dir: 'in', iso: mixerRearIso(-2 + n * 10) })),
      { id: 'main_L', signal: 'xlr',      dir: 'out', iso: mixerRearIso(68) },
      { id: 'main_R', signal: 'xlr',      dir: 'out', iso: mixerRearIso(78) },
      // mandate monitor in jack, come sui banchi piccoli veri
      { id: 'aux_1',  signal: 'jack',     dir: 'out', iso: mixerRearIso(88) },
      { id: 'aux_2',  signal: 'jack',     dir: 'out', iso: mixerRearIso(98) },
      { id: 'power',  signal: 'powercon', dir: 'in',  iso: mixerRearIso(108) }
    ]
  },
  ampli: {
    label: 'FINALE', category: 'regia', powerW: 300, zone: 'offstage', shape: 'ampli',
    body: { w: 64, h: 60, fill: 0x2a2c32, accent: 0x8a8e98 },
    ledPos: AMP_ISO(6, 46, 12),
    // connettori sul coperchio, su due file come sul pannello posteriore:
    // dietro alimentazione e ingressi XLR, davanti le uscite Speakon
    ports: [
      { id: 'power', signal: 'powercon', dir: 'in',  ...isoPort(AMP_ISO, 68, 8, 16) },
      { id: 'in_L',  signal: 'xlr',      dir: 'in',  ...isoPort(AMP_ISO, 14, 8, 16) },
      { id: 'in_R',  signal: 'xlr',      dir: 'in',  ...isoPort(AMP_ISO, 41, 8, 16) },
      { id: 'out_L', signal: 'speakon',  dir: 'out', ...isoPort(AMP_ISO, 26, 38, 16) },
      { id: 'out_R', signal: 'speakon',  dir: 'out', ...isoPort(AMP_ISO, 53, 38, 16) }
    ]
  },
  // stativo luci con barra a T: nessuna presa, ci si monta sopra un PAR
  stativo: {
    label: 'STATIVO', category: 'luci', powerW: 0, zone: 'stativo', shape: 'stativo',
    body: { w: 44, h: 30, fill: 0x1c1d22, accent: 0x55585f },
    ports: []
  },
  par: {
    label: 'PAR', category: 'luci', powerW: 40, zone: 'stativo', shape: 'par',
    body: { w: 60, h: 54, fill: 0x1c1d22, accent: 0xf2c53d },
    ledPos: PAR_ISO(22, 31, 3),
    // connettori sul retro, a destra del fusto: la lente resta libera.
    // Colonna sinistra ingressi, destra uscite (thru); sopra DMX, sotto corrente
    ports: [
      { id: 'power_in',   signal: 'powercon', dir: 'in',  dx: 8,  dy: 14 },
      { id: 'power_thru', signal: 'powercon', dir: 'out', dx: 27, dy: 14 },
      { id: 'dmx_in',     signal: 'dmx',      dir: 'in',  dx: 8,  dy: -7 },
      { id: 'dmx_thru',   signal: 'dmx',      dir: 'out', dx: 27, dy: -7 }
    ]
  },
  controller: {
    label: 'CTRL', category: 'luci', powerW: 20, zone: 'offstage', shape: 'controller',
    body: { w: 62, h: 42, fill: 0x2a2c32, accent: 0xf2a541 },
    frame: CTRL_ISO, front: '+b',
    ledIso: [52, 30, 10],
    // alimentazione PowerCON e due universi DMX in uscita, sul retro (lato
    // alto della consolle), da dove partono i cavi di una consolle vera
    ports: [
      { id: 'power', signal: 'powercon', dir: 'in',  iso: [8, -3, 13] },
      { id: 'dmx_1', signal: 'dmx',      dir: 'out', iso: [34, -3, 13] },
      { id: 'dmx_2', signal: 'dmx',      dir: 'out', iso: [46, -3, 13] }
    ]
  },
  quadro: {
    label: 'QUADRO', category: 'power', powerW: 0, zone: 'backstage', shape: 'quadro',
    // cabinet bianco/metallo, come un vero armadio elettrico da evento —
    // non più una scatola tinta a caso (vedi drawComponentBody per i dettagli).
    body: { w: 76, h: 94, fill: 0xe9eaed, accent: 0x4a4f5a },
    ledPos: QUADRO_ISO(4, 34, 43),
    // 3 prese, una per fase (L1/L2/L3): a differenza degli altri componenti,
    // ogni presa può ricevere PIÙ cavi (multi:true) — non è il singolo cavo a
    // contare, ma il carico totale che finisce su quella fase (vedi
    // computePhaseLoads/PHASE_BUDGET_W): sta al giocatore distribuirlo bene.
    ports: [
      // sia l'ingresso (dall'Allaccio) sia le 3 uscite sono CEE industriale:
      // un quadro trifase non ha prese PowerCON incorporate. Ogni utenza a
      // valle (PowerCON o Schuko) richiede l'adattatore giusto in scheda Cavi.
      // ingresso trifase sul fianco (faccia a=0), le 3 prese in fila sul
      // fronte (faccia b=B), ognuna sotto il proprio interruttore
      { id: 'in',    signal: 'cee_tri',  dir: 'in',  ...isoPort(QUADRO_ISO, 0, 17, 14) },
      { id: 'out_1', signal: 'cee_mono', dir: 'out', ...isoPort(QUADRO_ISO, QUADRO_PHASE_A[0], 34, 12), phase: 'L1', multi: true },
      { id: 'out_2', signal: 'cee_mono', dir: 'out', ...isoPort(QUADRO_ISO, QUADRO_PHASE_A[1], 34, 12), phase: 'L2', multi: true },
      { id: 'out_3', signal: 'cee_mono', dir: 'out', ...isoPort(QUADRO_ISO, QUADRO_PHASE_A[2], 34, 12), phase: 'L3', multi: true }
    ]
  },
  allaccio: {
    label: 'ALLACCIO', category: 'power', powerW: 0, zone: 'fixed', shape: 'allaccio',
    body: { w: 30, h: 50, fill: 0x2c3a2c, accent: 0x49b06a },
    ports: [
      { id: 'out', signal: 'cee_tri', dir: 'out', ...isoPort(ALL_ISO, 13, 26, 14) }
    ]
  },
  // ciabatta "civile": cavo con spina Schuko già attaccato (si collega a una
  // presa Schuko) e 3 prese Schuko. Il cavo fa parte della ciabatta: non si
  // sceglie nella scheda Cavi, si prende la spina dal pannello (lead: true).
  ciabatta: {
    label: 'CIABATTA', category: 'corrente', powerW: 0, zone: 'foh', shape: 'ciabatta',
    body: { w: 64, h: 50, fill: 0x2a2c32, accent: 0xc77dff },
    iso: CIAB_ISO,
    ledPos: CIAB_ISO(16, 3, 8),
    ports: [
      { id: 'in',    signal: 'schuko', dir: 'in',  lead: true, ...isoPort(CIAB_ISO, 0, 8, 4) },
      { id: 'out_1', signal: 'schuko', dir: 'out', ...isoPort(CIAB_ISO, 32, 8, 8) },
      { id: 'out_2', signal: 'schuko', dir: 'out', ...isoPort(CIAB_ISO, 62, 8, 8) },
      { id: 'out_3', signal: 'schuko', dir: 'out', ...isoPort(CIAB_ISO, 92, 8, 8) }
    ]
  },
  pc: {
    label: 'PC', category: 'regia', powerW: 150, zone: 'foh', shape: 'pc',
    // stile "Mac": scocca in alluminio chiaro, non più il rackbox scuro
    // generico — vedi drawComponentBody per lo schermo/trackpad/notch.
    body: { w: 34, h: 44, fill: 0xd7dadd, accent: 0x9a9da3 },
    // nel disegno lo schermo guarda verso -a (il fonico in FOH); in quinta si
    // gira verso +b come il mixer (vedi orientK)
    frame: PC_ISO, front: '-a',
    ledIso: [2, 30, 2],
    ports: [
      // cavo di alimentazione già attaccato, con spina Schuko: come per le
      // ciabatte si prende la spina dal pannello, senza scegliere un cavo
      { id: 'power',   signal: 'schuko', dir: 'in',  lead: true, iso: [18, 32, 2] },
      // l'audio esce in digitale dalla porta USB-C verso la scheda audio
      { id: 'usb',     signal: 'usbc',   dir: 'out', iso: [18, 25, 2] }
    ]
  },
  // scheda audio USB: prende l'audio dal PC via USB-C (da cui è anche
  // alimentata, niente presa né interruttore) e lo manda al mixer su due
  // uscite di linea jack bilanciate (TRS), verso i CH 5-6 LINE IN
  scheda: {
    label: 'SCHEDA', category: 'regia', powerW: 0, zone: 'foh', shape: 'scheda',
    body: { w: 46, h: 40, fill: 0x8e2a22, accent: 0x6fd08c },
    busPowered: true,
    // il fronte coi comandi guarda +b come il mixer; in FOH si gira verso il fonico
    frame: INTF_ISO, front: '+b',
    ledIso: [6, 30, 9],
    ports: [
      // cavo USB-C già attaccato alla scheda: la spina si prende dal suo
      // pannello e si infila nella porta USB-C del PC
      { id: 'usb',   signal: 'usbc', dir: 'in',  lead: true, iso: [40, 3, 12] },
      { id: 'out_L', signal: 'jack', dir: 'out', iso: [26, 3, 12] },
      { id: 'out_R', signal: 'jack', dir: 'out', iso: [16, 3, 12] }
    ]
  },
  // DI passiva doppia: converte le due uscite jack del PC (sbilanciate) in
  // due segnali XLR bilanciati per gli ingressi del mixer — nessuna
  // alimentazione richiesta, sta accanto al PC (Regia di sala o Off Stage).
  di: {
    label: 'DI', category: 'regia', powerW: 0, zone: 'foh', shape: 'di',
    body: { w: 36, h: 32, fill: 0x2a2d33, accent: 0x8a8e98 },
    ledPos: DI_ISO(15, 3, 14),
    ports: [
      { id: 'in_1',  signal: 'jack', dir: 'in',  ...isoPort(DI_ISO, 0, 8, 7) },
      { id: 'in_2',  signal: 'jack', dir: 'in',  ...isoPort(DI_ISO, 0, 18, 7) },
      { id: 'out_1', signal: 'xlr',  dir: 'out', ...isoPort(DI_ISO, 10, 26, 7) },
      { id: 'out_2', signal: 'xlr',  dir: 'out', ...isoPort(DI_ISO, 22, 26, 7) }
    ]
  },
  // ciabatta con spina CEE 230V blu già attaccata (va in una presa del
  // Quadro) e 4 prese Schuko. Anche qui il cavo fa parte della ciabatta.
  ciabatta_cee: {
    label: 'CIAB.CEE', category: 'corrente', powerW: 0, zone: 'backstage', shape: 'ciabatta',
    body: { w: 78, h: 58, fill: 0x2a2c32, accent: 0x2f6fd6 },
    iso: CIABCEE_ISO,
    ledPos: CIABCEE_ISO(16, 3, 8),
    ports: [
      { id: 'in',    signal: 'cee_mono', dir: 'in',  lead: true, ...isoPort(CIABCEE_ISO, 0, 8, 4) },
      { id: 'out_1', signal: 'schuko',   dir: 'out', ...isoPort(CIABCEE_ISO, 32, 8, 8) },
      { id: 'out_2', signal: 'schuko',   dir: 'out', ...isoPort(CIABCEE_ISO, 62, 8, 8) },
      { id: 'out_3', signal: 'schuko',   dir: 'out', ...isoPort(CIABCEE_ISO, 92, 8, 8) },
      { id: 'out_4', signal: 'schuko',   dir: 'out', ...isoPort(CIABCEE_ISO, 122, 8, 8) }
    ]
  }
};

// la DI resta nel catalogo per gli strumenti sul palco dei livelli successivi,
// ma nel livello 1 non serve: il PC entra nel mixer dalla scheda audio
const AVAILABLE_STOCK = { sub: 2, top: 2, mixer: 1, stativo: 4, par: 4, controller: 1, ampli: 1, quadro: 1, ciabatta: 1, ciabatta_cee: 1, pc: 1, scheda: 1, di: 0 };

const POWER_LIMIT_KW = 3.0;
const TOP_ATTACH_RADIUS = 300; // px: quanto lontano può essere trascinata una Testa da un Sub libero

/* pezzi che si montano sopra un altro: la testa sul palo del sub, il PAR
   sulla barra a T dello stativo. base = tipo che lo regge, link = campo
   della base col figlio montato, back = campo del figlio con la base. */
const MOUNTS = {
  top: { base: 'sub', link: 'hasTop', back: 'parentSubId', offsetY: () => topOffsetY(),
    missing: 'Posa la testa sopra un sub libero per montarla sul palo.',
    done: baseId => 'Testa montata sul palo di ' + compLabel(baseId) + '.' },
  par: { base: 'stativo', link: 'hasPar', back: 'parentStandId', offsetY: () => parOffsetY(),
    missing: 'Posa il PAR sopra uno stativo libero: si monta sulla barra a T.',
    done: baseId => 'PAR montato su ' + compLabel(baseId) + ': si punta da solo verso il palco.' }
};
const MOUNT_ON = { sub: 'top', stativo: 'par' };   // base -> tipo che ci si monta sopra
// figlio montato su una base (o null)
function mountedOn (base) {
  const t = base && MOUNT_ON[base.type];
  return t ? (gameState.placed[base[MOUNTS[t].link]] || null) : null;
}
// base che regge un pezzo montato (o null)
function mountBase (comp) {
  const m = comp && MOUNTS[comp.type];
  return m ? (gameState.placed[comp[m.back]] || null) : null;
}

/* ruolo di uno stativo luci dalla sua posizione: davanti al palco (Pit) fa
   il frontale, ai lati del palco (a sinistra o in Off Stage) fa il taglio */
function standRole (stand) {
  if (!stand) return null;
  if (isPitCell(stand.gx, stand.gy)) return 'front';
  return stand.gx < STAGE_ORIGIN_X ? 'left' : 'right';
}
// verso del PAR sullo stativo: la lente guarda il palco
function parRot (parId) {
  const role = standRole(mountBase(gameState.placed[parId]));
  return role === 'front' ? 2 : role === 'left' ? 3 : role === 'right' ? 1 : 0;
}
// dove punta il PAR: il frontale sul proscenio incrociando al centro, i
// tagli sul centro del palco alla loro altezza
function parAim (parId) {
  const stand = mountBase(gameState.placed[parId]);
  const role = standRole(stand);
  const mid = STAGE_ORIGIN_X + STAGE_W / 2;
  const sc = stand && compCenter(stand);
  if (role === 'front') return { gx: mid - (sc.gx - mid) * 0.3, gy: STAGE_ORIGIN_Y + STAGE_H - 1.3 };
  if (role === 'left' || role === 'right') return { gx: mid + (role === 'left' ? 0.5 : -0.5), gy: sc.gy };
  return null;
}
/* luci del livello 1: due frontali (uno per lato) e due tagli (uno per
   lato). Restituisce null se va bene, altrimenti messaggio e pezzi in rosso */
function lightingCheck () {
  const mid = STAGE_ORIGIN_X + STAGE_W / 2;
  const onStand = placedOfType('par').map(p => ({ p, s: mountBase(p) })).filter(x => x.s);
  const front = onStand.filter(x => standRole(x.s) === 'front');
  const fl = front.filter(x => compCenter(x.s).gx < mid).length, fr = front.length - fl;
  const tl = onStand.filter(x => standRole(x.s) === 'left').length;
  const tr = onStand.filter(x => standRole(x.s) === 'right').length;
  const ids = onStand.map(x => x.s.id);
  if (!fl || !fr) return { msg: front.length ? 'i frontali vanno uno a sinistra e uno a destra del palco.' : 'manca il frontale davanti al palco: il preside resterebbe al buio.', ids };
  if (!tl || !tr) return { msg: 'mancano i tagli, uno per lato del palco.', ids };
  return null;
}

/* Il quadro del livello è forzato Trifase (16A, 3 prese: una per fase) anche se
   il carico reale resterebbe sotto la soglia Monofase — scelta didattica, per
   far esercitare da subito il bilanciamento delle fasi. */
const FORCE_TRIFASE = true;

// budget per fase: 3kW ciascuna (coerente con un 16A monofase per fase su un
// quadro trifase, 16A×230V≈3680W con un margine di sicurezza tondo a 3000W).
const PHASE_BUDGET_W = 3000;
// i picchi di accensione (finali e sub) durano meno di un secondo: un
// magnetotermico da 16A li regge, a meno che più apparecchi pesanti partano
// insieme sulla stessa fase. Acceso uno alla volta, il livello non scatta mai.
const PHASE_PEAK_W = 4600;

/* Cosa deve essere cablato nel livello: 24 collegamenti che servono,
   fissi. Non c'è un unico schema giusto: conta che l'impianto funzioni come
   nella realtà, qualunque strada si scelga.
   - corrente (11): il Quadro dall'allaccio, e ogni utenza che arriva al
     Quadro da una sua presa qualunque, da una ciabatta o dal passante di un
     altro PAR. Le ciabatte sono un mezzo, non un obbligo: il PC può anche
     andare al Quadro con l'adattatore CEE/Schuko;
   - audio (9): PC -> scheda, le due uscite della scheda nei due ingressi
     jack del mixer, MAIN L/R nei due ingressi del finale, un'uscita del
     finale per Sub, ogni Sub alla SUA testa. Se L/R vengono scambiati due
     volte il suono arriva giusto e va bene; se no lo dice stereoCheck;
   - DMX (4): ogni PAR arriva alla consolle, in qualunque ordine e su
     qualunque dei due universi.
   I dispositivi si cercano per tipo e non per id, così un pezzo tolto e
   rimesso (che prende un id nuovo) conta come prima. */
const REQUIRED_POWER = { mixer: 1, controller: 1, ampli: 1, sub: 2, par: 4, pc: 1 };

function placedOfType (type) {
  return Object.values(gameState.placed)
    .filter(c => c.type === type)
    .sort((a, b) => parseInt(a.id.split('_').pop(), 10) - parseInt(b.id.split('_').pop(), 10));
}
// l'ingresso di corrente risale, cavo dopo cavo, fino a una presa del Quadro?
function wiredToQuadro (compId, visited) {
  visited = visited || new Set();
  if (visited.has(compId)) return false;
  visited.add(compId);
  const e = feedingPowerEdge(compId);
  const src = e && gameState.placed[e.a];
  if (!src) return false;
  return src.type === 'quadro' || wiredToQuadro(src.id, visited);
}
// universo DMX (1 o 2) da cui arriva il PAR risalendo la catena, o null
function dmxUniverse (parId, visited) {
  visited = visited || new Set();
  if (visited.has(parId)) return null;
  visited.add(parId);
  const e = gameState.edges.find(x => x.b === parId && x.bPort === 'dmx_in' && x.signal === 'dmx');
  const src = e && gameState.placed[e.a];
  if (!src) return null;
  if (src.type === 'controller') return e.aPort === 'dmx_2' ? 2 : 1;
  return src.type === 'par' ? dmxUniverse(src.id, visited) : null;
}
// cavo che entra in una porta (o null)
function edgeInto (compId, portId, signal) {
  return gameState.edges.find(e => e.b === compId && e.bPort === portId && (!signal || e.signal === signal)) || null;
}
// i due Sub ordinati da sinistra a destra per chi guarda il palco dalla
// platea (asse X della griglia; a parità, la posizione sullo schermo)
function subsLeftToRight () {
  const key = c => (c.gx != null ? c.gx : 0) * 1000 + (c.screen ? c.screen.x : 0) / 1000;
  return placedOfType('sub').sort((a, b) => key(a) - key(b));
}

function buildExpectedConnections () {
  const one = t => placedOfType(t)[0] || null;
  const L = c => c ? compLabel(c.id) : null;
  const missing = t => COMPONENT_TYPES[t].label + ' da posare';
  // ogni posto dice a parole cosa serve e a quale impianto appartiene
  // (corrente, audio, luci): il Test impianto reagisce in modo diverso
  let cat = 'power';
  const slot = (ok, what, ...cs) => ({ ok: !!ok, what, cat, ids: cs.filter(Boolean).map(c => c.id) });
  const list = [];
  const mixer = one('mixer'), ampli = one('ampli'), pc = one('pc'), scheda = one('scheda');

  // corrente
  const allaccio = one('allaccio'), quadro = one('quadro');
  list.push(slot(allaccio && quadro && portEdgeExists(allaccio.id, 'out', quadro.id, 'in', 'cee_tri'),
    quadro ? 'Allaccio → ' + L(quadro) + ' (CEE 400V)' : missing('quadro'), quadro));
  Object.entries(REQUIRED_POWER).forEach(([t, n]) => {
    const cs = placedOfType(t);
    for (let i = 0; i < n; i++) list.push(slot(cs[i] && wiredToQuadro(cs[i].id), cs[i] ? 'corrente a ' + L(cs[i]) : missing(t), cs[i]));
  });

  // audio: PC -> scheda
  cat = 'audio';
  list.push(slot(pc && scheda && portEdgeExists(pc.id, 'usb', scheda.id, 'usb', 'usbc'),
    pc && scheda ? 'USB-C da ' + L(scheda) + ' a ' + L(pc) : missing(pc ? 'scheda' : 'pc'), pc, scheda));
  // scheda out L/R -> un ingresso jack del mixer ciascuna
  ['out_L', 'out_R'].forEach(out => {
    const e = scheda && gameState.edges.find(x => x.a === scheda.id && x.aPort === out && x.signal === 'jack');
    list.push(slot(e && mixer && e.b === mixer.id,
      scheda && mixer ? L(scheda) + ' OUT ' + out.slice(-1) + ' → ' + L(mixer) + ' (jack)' : missing(scheda ? 'mixer' : 'scheda'), scheda, mixer));
  });
  // MAIN L/R -> un ingresso del finale ciascuna
  ['main_L', 'main_R'].forEach(out => {
    const e = mixer && gameState.edges.find(x => x.a === mixer.id && x.aPort === out && x.signal === 'xlr');
    list.push(slot(e && ampli && e.b === ampli.id,
      mixer && ampli ? L(mixer) + ' MAIN ' + out.slice(-1) + ' → ' + L(ampli) + ' (XLR)' : missing(mixer ? 'ampli' : 'mixer'), mixer, ampli));
  });

  // DMX: ogni PAR in catena dalla consolle
  cat = 'lights';
  const pars = placedOfType('par');
  for (let i = 0; i < 4; i++) list.push(slot(pars[i] && dmxUniverse(pars[i].id) != null, pars[i] ? 'DMX dalla consolle a ' + L(pars[i]) : missing('par'), pars[i]));

  // finale -> ogni Sub, ogni Sub -> la testa agganciata sopra
  cat = 'audio';
  const subs = subsLeftToRight();
  for (let i = 0; i < 2; i++) {
    const sub = subs[i];
    const e = sub && edgeInto(sub.id, 'spk_in', 'speakon');
    list.push(slot(e && ampli && e.a === ampli.id, sub ? (ampli ? L(ampli) : 'finale') + ' → ' + L(sub) + ' (Speakon)' : missing('sub'), ampli, sub));
    const top = sub && sub.hasTop ? gameState.placed[sub.hasTop] : null;
    list.push(slot(sub && top && portEdgeExists(sub.id, 'spk_thru', top.id, 'spk_in', 'speakon'),
      sub && top ? L(sub) + ' LINK → ' + L(top) + ' (Speakon)' : (sub ? 'testa da montare su ' + L(sub) : missing('sub')), sub, top));
  }

  return list;
}

/* Stereo: seguendo i cavi all'indietro, la cassa di sinistra deve suonare il
   canale sinistro del PC e quella di destra il destro. Il mixer manda il CH5
   a sinistra e il CH6 a destra; il finale manda IN L su OUT L e IN R su OUT R.
   Restituisce null se è giusto, altrimenti il lato che risulta invertito. */
function stereoCheck () {
  const mixer = placedOfType('mixer')[0], ampli = placedOfType('ampli')[0], scheda = placedOfType('scheda')[0];
  if (!mixer || !ampli || !scheda) return null;
  const chSide = { in_5: 'L', in_6: 'R' };
  const wrong = [];
  subsLeftToRight().forEach((sub, i) => {
    const want = i === 0 ? 'L' : 'R';
    const e1 = edgeInto(sub.id, 'spk_in', 'speakon');                    // finale OUT x -> sub
    if (!e1 || e1.a !== ampli.id) return;
    const e2 = edgeInto(ampli.id, e1.aPort === 'out_L' ? 'in_L' : 'in_R', 'xlr'); // mixer MAIN y -> finale IN x
    if (!e2 || e2.a !== mixer.id) return;
    const bus = e2.aPort === 'main_L' ? 'L' : 'R';
    const e3 = gameState.edges.find(x => x.a === scheda.id && x.b === mixer.id && chSide[x.bPort] === bus && x.signal === 'jack');
    if (!e3) return;
    const got = e3.aPort === 'out_L' ? 'L' : 'R';
    if (got !== want) wrong.push(sub.id);
  });
  return wrong.length ? wrong : null;
}

/* ---------------------------------------------------------------------
   2) STATO DI GIOCO (agnostico dal motore grafico)
   --------------------------------------------------------------------- */
const gameState = {
  placed: {},
  stock: { ...AVAILABLE_STOCK },
  nextIndex: { sub: 1, top: 1, mixer: 1, stativo: 1, par: 1, controller: 1, ampli: 1, quadro: 1, ciabatta: 1, ciabatta_cee: 1, pc: 1, scheda: 1, di: 1 },
  edges: [],              // { id, a, aPort, b, bPort, signal }
  edgeSeq: 0,
  selectedCable: null,
  pendingPort: null,      // { componentId, portId }
  selectedPieceType: null, // tipo di pezzo "armato" in attesa di un tocco sulla pedana
  visibleSignals: { powercon: true, xlr: true, speakon: true, dmx: true, schuko: true, cee_tri: true, cee_mono: true, jack: true, usbc: true },
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

/* ---------------------------------------------------------------------
   2c) SUONI — sintetizzati al volo con Web Audio (nessun file esterno):
       ogni tipo di connettore ha il suo inserimento/estrazione, ogni
       apparecchio la sua accensione, più protezioni, test e montaggio.
   --------------------------------------------------------------------- */
const SFX = (() => {
  let ctx = null, master = null, noiseBuf = null;
  let volume = 0.8;   // 0..1, dalle impostazioni della partita (0 = muto)

  function ac () {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.55 * volume; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // colpo di rumore filtrato (scatti, strisciate, scintille)
  function noise (t, dur, freq, q, gain, type) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + t;
    g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
  }
  // nota con inviluppo (tonfi, bip, ronzii), con glissato opzionale
  function tone (t, freq, dur, gain, type, freqEnd, attack) {
    const o = ctx.createOscillator(); o.type = type || 'sine';
    const g = ctx.createGain();
    const t0 = ctx.currentTime + t;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + (attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  const click = (t, gain, freq) => noise(t, 0.012, freq || 4000, 2, gain, 'highpass');
  const play = fn => { if (!volume) return; try { if (ac()) fn(); } catch (e) { /* audio non disponibile */ } };

  // famiglia di connettore per un segnale (gli adattatori usano il loro capo)
  const family = sig => ({ xlr: 'xlr', dmx: 'xlr', jack: 'jack', speakon: 'twist', powercon: 'twist', schuko: 'schuko',
    cee_mono: 'cee', cee_tri: 'cee', usbc: 'usb' }[sig] || 'xlr');

  const plugIn = {
    // XLR / DMX: il fermo metallico che scatta
    xlr: () => { click(0, 0.5, 3500); tone(0.004, 2600, 0.05, 0.07, 'triangle'); click(0.055, 0.4, 5000); },
    // jack: il "tunk" della spina che entra, con un filo di fruscio
    jack: () => { noise(0, 0.05, 1400, 1.5, 0.18); tone(0.03, 200, 0.09, 0.3, 'sine', 90); noise(0.05, 0.08, 3000, 1, 0.05); },
    // Speakon / PowerCON: si infila e si ruota fino allo scatto di blocco
    twist: () => { tone(0, 150, 0.07, 0.28, 'sine', 90); [0.1, 0.14, 0.18].forEach(t => click(t, 0.22, 3500)); click(0.25, 0.5, 2500); },
    // Schuko: strisciata dei contatti e tonfo della spina
    schuko: () => { noise(0, 0.1, 900, 2, 0.2); tone(0.07, 110, 0.12, 0.35, 'sine', 70); },
    // CEE: colpo pesante e coperchio a molla che si richiude sulla spina
    cee: () => { noise(0, 0.12, 700, 1.5, 0.22); tone(0.08, 85, 0.18, 0.45, 'sine', 55); click(0.24, 0.45, 2200); tone(0.245, 1500, 0.04, 0.06, 'triangle'); },
    // USB-C: clic leggero
    usb: () => { click(0, 0.3, 6000); click(0.03, 0.2, 7000); }
  };
  const plugOut = {
    xlr: () => { click(0, 0.35, 3000); noise(0.02, 0.12, 1800, 1.2, 0.12); },
    jack: () => { tone(0, 320, 0.05, 0.2, 'sine', 120); noise(0.01, 0.06, 2500, 1, 0.08); },
    twist: () => { click(0, 0.4, 2500); [0.05, 0.09].forEach(t => click(t, 0.18, 3500)); noise(0.12, 0.1, 1500, 1.2, 0.1); },
    schuko: () => { tone(0, 130, 0.06, 0.2, 'sine', 90); noise(0.03, 0.12, 900, 2, 0.16); },
    cee: () => { noise(0, 0.14, 700, 1.5, 0.18); click(0.14, 0.45, 2200); tone(0.145, 1400, 0.04, 0.05, 'triangle'); },
    usb: () => { click(0, 0.25, 5500); }
  };

  // accensione: bilanciere + il suono tipico di ogni apparecchio
  const rocker = () => { click(0, 0.45, 2600); tone(0.002, 900, 0.03, 0.05, 'square'); };
  const startup = {
    ampli: () => { click(0.35, 0.5, 1800); tone(0.36, 100, 0.6, 0.06, 'sawtooth', 100, 0.2); },
    sub: () => { click(0.3, 0.45, 1600); tone(0.32, 45, 0.35, 0.35, 'sine', 40); },
    mixer: () => { tone(0.25, 1320, 0.08, 0.1, 'sine'); tone(0.36, 1760, 0.1, 0.1, 'sine'); },
    controller: () => { tone(0.2, 880, 0.09, 0.1, 'square'); },
    pc: () => { [523, 659, 784, 1047].forEach((f, i) => tone(0.3 + i * 0.09, f, 0.5, 0.08, 'sine')); },
    par: () => { tone(0, 2400, 0.05, 0.03, 'sine'); },
    scheda: () => { tone(0, 1175, 0.07, 0.07, 'sine'); tone(0.08, 1568, 0.09, 0.07, 'sine'); }
  };

  /* beat da concerto per il collaudo riuscito: cassa dritta, rullante sul 2
     e sul 4, charleston in levare e un basso che gira su quattro note, a
     tutto volume su un'uscita propria (così si può zittire di colpo) */
  function beat (bpm, beats) {
    const out = ctx.createGain(); out.gain.value = 1.6 * volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 6;
    out.connect(comp); comp.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.05, step = 60 / bpm / 4;
    const env = (node, t, gain, dur) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      node.connect(g); g.connect(out);
      return g;
    };
    const hit = (t, freq, dur, gain, type, filt, q) => {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
      src.connect(f); env(f, t, gain, dur);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    };
    const riff = [55, 55, 65.4, 49];   // La, La, Do, Sol
    for (let i = 0; i < beats * 4; i++) {
      const t = t0 + i * step, bar = Math.floor(i / 16), s16 = i % 16;
      if (s16 % 4 === 0) {                                    // cassa
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        env(o, t, 1.0, 0.32); o.start(t); o.stop(t + 0.34);
        hit(t, 3000, 0.012, 0.25, 'highpass');
      }
      if (s16 === 4 || s16 === 12) { hit(t, 1800, 0.18, 0.55, 'bandpass', 0.8); hit(t, 180, 0.08, 0.35, 'lowpass'); } // rullante
      hit(t, 8000, s16 % 4 === 2 ? 0.09 : 0.03, s16 % 4 === 2 ? 0.22 : 0.09, 'highpass');                            // charleston
      if (s16 % 4 === 2 || s16 % 8 === 7) {                   // basso in levare
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = riff[bar % riff.length];
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 6;
        o.connect(f); env(f, t, 0.5, step * 1.8); o.start(t); o.stop(t + step * 2);
      }
    }
    return () => {
      try { out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(0, ctx.currentTime, 0.03); } catch (e) { /* già chiuso */ }
      setTimeout(() => { try { comp.disconnect(); } catch (e) { /* già staccato */ } }, 200);
    };
  }

  return {
    get muted () { return !volume; },
    // restituisce la funzione che lo zittisce (anche se non è mai partito)
    beat: (bpm, beats) => { let stop = () => {}; play(() => { stop = beat(bpm, beats); }); return stop; },
    // impianto che gracchia: scariche, ronzio di massa e fischio che va e viene
    crackle: dur => play(() => {
      tone(0, 50, dur, 0.35, 'square', 50, 0.02);
      tone(0, 100, dur, 0.15, 'sawtooth', 100, 0.02);
      for (let i = 0; i < dur * 22; i++) noise(Math.random() * dur, 0.02 + Math.random() * 0.07, 800 + Math.random() * 5000, 0.7, 0.3 + Math.random() * 0.5);
      tone(dur * 0.3, 2900, dur * 0.4, 0.05, 'sine', 3300, 0.2);
    }),
    // PAR impazziti: ticchettio dei flash
    strobe: dur => play(() => { for (let t = 0; t < dur; t += 0.07) if (Math.random() < 0.6) click(t, 0.12, 6000); }),
    get volume () { return volume; },
    setVolume (v) {
      volume = Math.max(0, Math.min(1, v));
      if (master) master.gain.value = 0.55 * volume;
    },
    cableIn: sig => play(plugIn[family(sig)]),
    cableOut: sig => play(plugOut[family(sig)]),
    powerOn: type => play(() => { rocker(); if (startup[type]) startup[type](); }),
    powerOff: () => play(() => { rocker(); tone(0.05, 600, 0.2, 0.05, 'sine', 200); }),
    // un apparecchio parte perché gli arriva corrente (PAR, scheda audio)
    wake: type => play(() => { if (startup[type]) startup[type](); }),
    breaker: on => play(() => { noise(0, 0.03, 2200, 1, 0.5); tone(0.005, on ? 220 : 160, 0.05, 0.25, 'square'); }),
    trip: () => play(() => {
      noise(0, 0.05, 2500, 0.8, 0.7); tone(0, 90, 0.2, 0.5, 'sine', 50);
      for (let i = 0; i < 12; i++) click(0.04 + Math.random() * 0.4, 0.2 + Math.random() * 0.3, 3000 + Math.random() * 4000);
    }),
    rcd: () => play(() => { noise(0, 0.04, 1800, 1, 0.6); tone(0.01, 140, 0.12, 0.35, 'square', 90); for (let i = 0; i < 6; i++) click(0.03 + Math.random() * 0.2, 0.25, 4000); }),
    tump: () => play(() => { tone(0, 55, 0.35, 0.8, 'sine', 35); noise(0, 0.08, 200, 1, 0.3, 'lowpass'); }),
    success: () => play(() => { [523, 659, 784, 1047].forEach((f, i) => tone(i * 0.11, f, 0.45, 0.1, 'triangle')); }),
    caseOpen: () => play(() => { click(0, 0.45, 2000); click(0.08, 0.45, 2200); noise(0.14, 0.3, 300, 0.8, 0.12, 'lowpass'); }),
    pick: () => play(() => { noise(0, 0.18, 1200, 0.7, 0.1); }),
    place: () => play(() => { tone(0, 120, 0.1, 0.3, 'sine', 70); noise(0, 0.05, 600, 1, 0.1); }),
    lift: () => play(() => { tone(0, 300, 0.12, 0.08, 'sine', 600); }),
    remove: () => play(() => { noise(0, 0.25, 800, 0.6, 0.15); tone(0, 500, 0.2, 0.06, 'sine', 150); }),
    button: () => play(() => { click(0, 0.25, 3000); })
  };
})();

/* ---------------------------------------------------------------------
   2b) CORRENTE DAL VIVO — interruttori dei dispositivi, protezioni del
       Quadro (generale, salvavita, magnetotermici di fase), carico reale
       delle fasi e corrente di spunto all'accensione. Si cabla a impianto
       spento, poi si accende dal pannello di ogni dispositivo.
   --------------------------------------------------------------------- */
// pressione lunga su un dispositivo per entrare in montaggio
const LONG_PRESS_MS = 450;

// dispositivi con l'interruttore di accensione sul pannello (i PAR si
// accendono appena arriva corrente, Testa e DI non si alimentano)
const SWITCHABLE = new Set(['sub', 'mixer', 'ampli', 'controller', 'pc', 'ciabatta', 'ciabatta_cee']);
// corrente di spunto: all'accensione finali e sub chiedono per un attimo un
// multiplo del loro consumo (si caricano i condensatori dell'alimentatore)
const INRUSH_FACTOR = { ampli: 5, sub: 4 };
const INRUSH_MS = 700;
const PROTECTIONS = ['main', 'rcd', 'L1', 'L2', 'L3'];

// kW con la virgola decimale, all'italiana
function fmtKW (w, digits) { return (w / 1000).toFixed(digits).replace('.', ','); }

function findQuadro () { return Object.values(gameState.placed).find(c => c.type === 'quadro'); }
// stato delle protezioni del Quadro: tutte abbassate finché non le si arma
function quadroProt (q) {
  if (!q.prot) q.prot = { main: false, rcd: false, L1: false, L2: false, L3: false, tripped: {} };
  if (!q.prot.tripped) q.prot.tripped = {};
  return q.prot;
}
function powerInPort (def) {
  return def.ports.find(p => p.dir === 'in' && POWER_CABLE_IDS.has(p.signal));
}
function feedingPowerEdge (compId) {
  const comp = gameState.placed[compId];
  const pin = comp && powerInPort(COMPONENT_TYPES[comp.type]);
  if (!pin) return null;
  return gameState.edges.find(e => e.b === compId && e.bPort === pin.id && POWER_CABLE_IDS.has(e.signal)) || null;
}

// il dispositivo riceve corrente al suo ingresso di alimentazione?
function isPowered (compId, visited) {
  visited = visited || new Set();
  if (visited.has(compId)) return false;
  visited.add(compId);
  const comp = gameState.placed[compId];
  if (!comp) return false;
  if (comp.type === 'allaccio') return true;
  const e = feedingPowerEdge(compId);
  return !!e && portEnergized(e.a, e.aPort, visited);
}
// una presa di USCITA sta erogando corrente in questo momento?
function portEnergized (compId, portId, visited) {
  const comp = gameState.placed[compId];
  if (!comp) return false;
  if (comp.type === 'allaccio') return true;
  if (comp.type === 'quadro') {
    const prot = quadroProt(comp);
    const p = COMPONENT_TYPES.quadro.ports.find(q => q.id === portId);
    return isPowered(compId, visited) && prot.main && prot.rcd && !!(p && prot[p.phase]);
  }
  // prese delle ciabatte (accese) e PowerCON passante dei PAR
  return isPowered(compId, visited) && (!SWITCHABLE.has(comp.type) || !!comp.on);
}
// il dispositivo sta funzionando (alimentato e, se ha l'interruttore, acceso)
function isRunning (compId) {
  const comp = gameState.placed[compId];
  if (!comp) return false;
  const def = COMPONENT_TYPES[comp.type];
  if (comp.type === 'allaccio') return true;
  if (def.busPowered) {
    // alimentata dal cavo USB: funziona se il PC a monte funziona
    const e = gameState.edges.find(x => x.b === compId && x.signal === 'usbc');
    return !!e && isRunning(e.a);
  }
  if (!powerInPort(def)) return false;
  return isPowered(compId) && (!SWITCHABLE.has(comp.type) || !!comp.on);
}
// LED: acceso se il dispositivo funziona; Testa e DI (senza alimentazione)
// si accendono quando ricevono il segnale da un dispositivo che funziona
function isLedOn (compId) {
  const comp = gameState.placed[compId];
  if (!comp) return false;
  const def = COMPONENT_TYPES[comp.type];
  if (powerInPort(def) || def.busPowered || comp.type === 'allaccio') return isRunning(compId);
  const inPort = def.ports.find(p => p.dir === 'in');
  const e = inPort && gameState.edges.find(x => x.b === compId && x.bPort === inPort.id);
  return !!e && (isRunning(e.a) || isLedOn(e.a));
}
// fase del Quadro da cui arriva la corrente di un dispositivo (o null)
function phaseOf (compId, visited) {
  visited = visited || new Set();
  if (visited.has(compId)) return null;
  visited.add(compId);
  const e = feedingPowerEdge(compId);
  if (!e) return null;
  const src = gameState.placed[e.a];
  if (!src) return null;
  if (src.type === 'quadro') {
    const p = COMPONENT_TYPES.quadro.ports.find(q => q.id === e.aPort);
    return p ? p.phase : null;
  }
  return phaseOf(e.a, visited);
}
// carico reale di ogni fase: solo i dispositivi che stanno funzionando,
// più gli eventuali picchi di accensione ancora in corso
function livePhaseLoads (withInrush) {
  const loads = { L1: 0, L2: 0, L3: 0 };
  Object.values(gameState.placed).forEach(c => {
    const w = COMPONENT_TYPES[c.type].powerW || 0;
    if (!w || !isRunning(c.id)) return;
    const ph = phaseOf(c.id);
    if (ph) loads[ph] += w;
  });
  if (withInrush) {
    const now = Date.now();
    // il picco dura finché l'apparecchio sta davvero partendo: se nel
    // frattempo è rimasto senza corrente o è stato spento, non conta più
    gameState.inrush = (gameState.inrush || []).filter(s => s.until > now && (!s.id || isRunning(s.id)));
    gameState.inrush.forEach(s => { loads[s.phase] += s.w; });
  }
  return loads;
}
function runningSet () {
  return new Set(Object.keys(gameState.placed).filter(isRunning));
}

/* esegue un'azione sull'impianto (interruttore, protezione, cavo) e ne
   applica le conseguenze reali: spunto dei finali appena partiti, "tump"
   nelle casse se il mixer cambia stato coi finali accesi, sovraccarichi */
function applyPowerAction (action) {
  const before = runningSet();
  action();
  const after = runningSet();
  const now = Date.now();
  const scene = window.__scene;
  after.forEach(id => {
    if (before.has(id)) return;
    const c = gameState.placed[id];
    const k = INRUSH_FACTOR[c.type];
    const ph = phaseOf(id);
    if (k && ph) {
      gameState.inrush = gameState.inrush || [];
      gameState.inrush.push({ id, phase: ph, w: COMPONENT_TYPES[c.type].powerW * (k - 1), until: now + INRUSH_MS });
    }
  });
  // il mixer si accende o si spegne mentre i finali sono già accesi: il
  // colpo passa amplificato nelle casse
  const ampsOn = [...after].some(id => gameState.placed[id].type === 'ampli' && before.has(id));
  const mixerFlip = Object.values(gameState.placed).some(c => c.type === 'mixer' && before.has(c.id) !== after.has(c.id));
  if (ampsOn && mixerFlip) {
    gameState.procErrors = gameState.procErrors || [];
    gameState.procErrors.push('pop');
    showToast('TUMP! Mixer acceso o spento con i finali già accesi: il colpo è finito nelle casse. I finali si accendono per ultimi e si spengono per primi.');
    if (scene) scene.popSpeakers();
    SFX.tump();
  }
  const woke = new Set();
  after.forEach(id => { if (!before.has(id)) woke.add(gameState.placed[id].type); });
  ['par', 'scheda'].forEach(t => { if (woke.has(t)) SFX.wake(t); });
  checkOverloads();
  if (scene) {
    scene.refreshLive();
    // a fine picco si ricontrolla e si ridisegna
    if (gameState.inrush && gameState.inrush.length) {
      scene.time.delayedCall(INRUSH_MS + 30, () => scene.refreshLive());
    }
  }
}

// una fase oltre il limite fa scattare il suo magnetotermico
function checkOverloads () {
  const q = findQuadro();
  if (!q) return;
  const prot = quadroProt(q);
  const steady = livePhaseLoads(false);
  const loads = livePhaseLoads(true);
  const tripped = ['L1', 'L2', 'L3'].filter(ph => prot[ph] && (steady[ph] > PHASE_BUDGET_W || loads[ph] > PHASE_PEAK_W));
  if (!tripped.length) return;
  const byPeak = tripped.every(ph => steady[ph] <= PHASE_BUDGET_W);
  tripped.forEach(ph => { prot[ph] = false; prot.tripped[ph] = true; });
  gameState.trips = (gameState.trips || 0) + tripped.length;
  SFX.trip();
  const kw = tripped.map(ph => ph + ' ' + fmtKW(loads[ph], 1) + ' kW').join(', ');
  showToast(byPeak
    ? 'Magnetotermico scattato per il picco di accensione (' + kw + '): sono partiti insieme più apparecchi pesanti sulla stessa fase (anche accendendo la ciabatta a cui sono attaccati). Spegni finali e sub, riarma dal Quadro e riaccendili uno alla volta.'
    : 'Magnetotermico scattato (' + kw + ' su ' + fmtKW(PHASE_BUDGET_W, 1) + ' kW): la fase è spenta. Togli carico o spostalo su un\'altra fase, spegni finali e sub, poi riarma dal Quadro e riaccendili uno alla volta.');
  if (window.__scene) window.__scene.sparkQuadro(tripped);
}

// c'è un utilizzatore acceso (che assorbe corrente) a valle di un dispositivo?
function loadRunningDownstream (compId, visited) {
  visited = visited || new Set();
  if (visited.has(compId)) return false;
  visited.add(compId);
  const c = gameState.placed[compId];
  if (!c) return false;
  if ((COMPONENT_TYPES[c.type].powerW || 0) > 0 && isRunning(compId)) return true;
  return gameState.edges.some(e => e.a === compId && POWER_CABLE_IDS.has(e.signal) && loadRunningDownstream(e.b, visited));
}

// cavo di corrente collegato o scollegato SOTTO CARICO (presa a monte in
// tensione e un utilizzatore acceso a valle): fa l'arco e il salvavita
// scatta, spegnendo tutto l'impianto. Una presa viva senza carico no.
function checkLiveCableChange (edge) {
  if (!POWER_CABLE_IDS.has(edge.signal) || edge.a === 'allaccio') return false;
  if (!portEnergized(edge.a, edge.aPort) || !loadRunningDownstream(edge.b)) return false;
  const q = findQuadro();
  if (!q) return false;
  const prot = quadroProt(q);
  prot.rcd = false;
  prot.tripped.rcd = true;
  gameState.rcdTrips = (gameState.rcdTrips || 0) + 1;
  SFX.rcd();
  showToast('Salvavita scattato: hai collegato o scollegato un cavo di corrente sotto carico, con un apparecchio acceso. Spegni prima di staccare o attaccare, poi riarma il salvavita dal Quadro.');
  if (window.__scene) {
    window.__scene.sparkAtPort(edge.a, edge.aPort);
    window.__scene.sparkQuadro([]);
  }
  return true;
}

// ogni manovra entra nella cronologia, così annulla/ripeti restano coerenti
function saveHistory () { if (window.__scene) window.__scene.pushHistory(); }

function toggleDevicePower (compId) {
  const c = gameState.placed[compId];
  if (!c) return;
  applyPowerAction(() => { c.on = !c.on; });
  if (c.on) SFX.powerOn(c.type); else SFX.powerOff();
  saveHistory();
}
function toggleProtection (key) {
  const q = findQuadro();
  if (!q) return;
  const prot = quadroProt(q);
  applyPowerAction(() => {
    prot[key] = !prot[key];
    if (prot[key]) delete prot.tripped[key];
  });
  SFX.breaker(prot[key]);
  saveHistory();
}

// indirizzi DMX dei PAR sullo stesso universo: non devono accavallarsi.
// Due PAR con lo stesso indirizzo E la stessa modalità vanno bene (si
// comandano insieme, in gruppo, come si fa spesso); una sovrapposizione
// parziale invece fa fare cose sbagliate ai fari.
function dmxOverlaps () {
  const ranges = placedOfType('par').map(c => {
    const d = parDmx(c);
    const n = parseInt(PAR_MODES[d.mode].id, 10);
    return { id: c.id, u: dmxUniverse(c.id), mode: d.mode, from: d.addr, to: d.addr + n - 1 };
  }).filter(r => r.u != null);
  const clashes = [];
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const r = ranges[i], q = ranges[j];
      if (r.u !== q.u) continue;
      if (r.from === q.from && r.mode === q.mode) continue;
      if (r.from <= q.to && q.from <= r.to) clashes.push([r.id, q.id]);
    }
  }
  return clashes;
}

/* Un cavo appena creato collegherebbe fromId (lato OUT) -> toId (lato IN).
   Se da toId, seguendo i cavi già esistenti (sempre in verso OUT->IN), si può
   già raggiungere fromId, quel nuovo cavo richiuderebbe un anello: rifiutato. */
// famiglia di un cavo: la corrente, il DMX e l'audio sono reti separate, un
// anello conta solo dentro la stessa rete (la catena DMX dei PAR può andare
// nel verso opposto a quella della corrente)
function cableFamily (signal) {
  if (POWER_CABLE_IDS.has(signal)) return 'power';
  return signal === 'dmx' ? 'dmx' : 'audio';
}
function wouldCreateCycle (fromId, toId, signal) {
  if (fromId === toId) return true;
  const fam = signal ? cableFamily(signal) : null;
  const visited = new Set([toId]);
  const queue = [toId];
  while (queue.length) {
    const cur = queue.shift();
    for (const e of gameState.edges) {
      if (fam && cableFamily(e.signal) !== fam) continue;
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

// "a; b; c e altri 2"
function listShort (items, max) {
  if (items.length <= max) return items.join('; ');
  return items.slice(0, max).join('; ') + ' e altri ' + (items.length - max);
}

function runValidation () {
  const expected = buildExpectedConnections();
  const failedComponents = new Set();
  let allFound = true;
  let madeCount = 0;

  const missingList = [];
  const missingCats = new Set(), toPlaceCats = new Set();
  expected.forEach(exp => {
    if (exp.ok) madeCount++;
    else {
      allFound = false;
      missingList.push(exp.what);
      missingCats.add(exp.cat);
      if (/ da (posare|montare)/.test(exp.what)) toPlaceCats.add(exp.cat);
      exp.ids.forEach(i => failedComponents.add(i));
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
    failedComponents, missingList, missingCats, toPlaceCats, allSubsTopsPlaced, overBudget, usedW, madeCount, totalCount: expected.length,
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
  el('#power-val').textContent = `${usedKw.toFixed(2).replace('.', ',')} / ${POWER_LIMIT_KW.toFixed(1).replace('.', ',')} kW`;
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
  else {
    text.textContent = 'DA TESTARE';
    // l'impianto è cambiato: qualunque effetto del test in corso si ferma
    if (window.__scene && window.__scene.stopFx) window.__scene.stopFx();
  }
}

let toastTimer = null;
function showToast (msg, kind) {
  const toast = el('#toast');
  toast.textContent = msg;
  toast.classList.remove('ok');
  if (kind === 'ok') toast.classList.add('ok');
  toast.classList.add('show');
  clearTimeout(toastTimer);
  // i messaggi lunghi restano più a lungo: il tempo di leggerli
  toastTimer = setTimeout(() => toast.classList.remove('show'), Math.max(3200, msg.length * 60));
}

function updateStockUI () {
  // la potenza impegnata segue i pezzi posati: si aggiorna a ogni posa
  updatePowerMeter();
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

/* ---------------------------------------------------------------------
   PARTITA — nome del service, salvataggio automatico, impostazioni e
   record. Tutto sta in un solo oggetto nella memoria del browser, con un
   numero di versione: se un giorno il formato cambia si converte, invece
   di perdere la partita. "Nuova partita" azzera il livello ma tiene
   impostazioni e record.
   Il valore principale del service è la REPUTAZIONE, che non cala mai:
   ogni livello porta la reputazione del suo miglior collaudo, quindi
   rifare un livello non la gonfia, ma rifarlo meglio la fa crescere della
   differenza. Un nuovo service (Nuova partita) riparte da zero.
   I record preparano gli highscore: per ogni collaudo riuscito si tengono
   i dati grezzi (tempo di gioco, test fatti e falliti, scatti, colpi nelle
   casse) e la reputazione che vale.
   --------------------------------------------------------------------- */
const SAVE_KEY = 'scs-save';
const SAVE_VERSION = 1;
const LEVEL_ID = 1;
const RECORDS_KEEP = 20;       // record tenuti per livello
const SERVICE_MAX = 24;        // caratteri del nome del service

function defaultProfile () {
  return { v: SAVE_VERSION, service: '', settings: { volume: 0.8, reducedFx: false, skipShow: false }, logo: null, level: null, records: {}, reputation: { total: 0, byLevel: {} } };
}
const Profile = (() => {
  let data = defaultProfile();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const d = raw ? JSON.parse(raw) : null;
    if (d && d.v === SAVE_VERSION) data = { ...defaultProfile(), ...d, settings: { ...defaultProfile().settings, ...d.settings }, reputation: { ...defaultProfile().reputation, ...d.reputation } };
    else if (!raw && localStorage.getItem('scs-muted') === '1') data.settings.volume = 0;   // vecchio tasto muto
  } catch (e) { /* memoria non disponibile o salvataggio illeggibile: si parte da zero */ }
  let timer = null;
  const flush = () => {
    clearTimeout(timer); timer = null;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* memoria piena o non disponibile: si gioca senza salvare */ }
  };
  return {
    get data () { return data; },
    // salvataggio a raffica ma scritto una volta sola, poco dopo l'ultima azione
    save () { clearTimeout(timer); timer = setTimeout(flush, 250); },
    flush
  };
})();
window.addEventListener('pagehide', () => Profile.flush());

const settings = () => Profile.data.settings;
const reducedFx = () => !!settings().reducedFx;
const serviceName = () => Profile.data.service || 'Il tuo service';

/* ---------------- logo del service ----------------
   Si sceglie uno dei loghi pronti o se ne crea uno: forma, simbolo e due
   colori. È un disegno vettoriale (SVG), quindi resta nitido a ogni
   misura: in testata, nel menù e dipinto sulla fiancata del furgone. */
const LOGO_SHAPES = {
  cerchio: '<circle cx="50" cy="50" r="46"/>',
  quadrato: '<rect x="5" y="5" width="90" height="90" rx="18"/>',
  scudo: '<path d="M50 3 L93 17 V48 C93 73 74 90 50 97 C26 90 7 73 7 48 V17 Z"/>',
  esagono: '<polygon points="50,3 91,26 91,74 50,97 9,74 9,26"/>'
};
const LOGO_ICONS = {
  iniziali: null,   // le iniziali del nome del service
  cassa: '<rect x="30" y="20" width="40" height="60" rx="5"/><circle cx="50" cy="36" r="7" fill="BG"/><circle cx="50" cy="60" r="13" fill="BG"/><circle cx="50" cy="60" r="5"/>',
  faro: '<circle cx="50" cy="42" r="22"/><circle cx="50" cy="42" r="12" fill="BG"/><circle cx="50" cy="42" r="5"/><rect x="46" y="63" width="8" height="12"/><rect x="32" y="74" width="36" height="7" rx="3"/>',
  fulmine: '<polygon points="57,12 27,56 47,56 41,88 73,42 53,42"/>',
  onda: '<path d="M18 50 C24 26 30 26 36 50 S48 74 54 50 S66 26 72 50 S80 66 84 58" fill="none" stroke="FG" stroke-width="8" stroke-linecap="round"/>',
  stella: '<polygon points="50,14 59,39 86,39 64,55 72,81 50,65 28,81 36,55 14,39 41,39"/>',
  fader: '<rect x="26" y="18" width="6" height="64" rx="3"/><rect x="47" y="18" width="6" height="64" rx="3"/><rect x="68" y="18" width="6" height="64" rx="3"/><rect x="19" y="56" width="20" height="11" rx="2"/><rect x="40" y="30" width="20" height="11" rx="2"/><rect x="61" y="46" width="20" height="11" rx="2"/>'
};
const LOGO_COLORS = ['#f2a541', '#e0503f', '#3b7bff', '#49b06a', '#9b5de5', '#f2c53d', '#eee9df', '#1c1d22'];
const LOGO_PRESETS = [
  { shape: 'cerchio', icon: 'cassa', bg: '#1c1d22', fg: '#f2a541', style: 'tour' },
  { shape: 'scudo', icon: 'fulmine', bg: '#e0503f', fg: '#eee9df', style: 'stencil' },
  { shape: 'esagono', icon: 'faro', bg: '#3b7bff', fg: '#f2c53d', style: 'fasci' },
  { shape: 'quadrato', icon: 'fader', bg: '#1c1d22', fg: '#49b06a', style: 'led' },
  { shape: 'cerchio', icon: 'onda', bg: '#9b5de5', fg: '#eee9df', style: 'neon' },
  { shape: 'scudo', icon: 'iniziali', bg: '#f2a541', fg: '#1c1d22', style: 'gaffer' }
];
const defaultLogo = () => ({ ...LOGO_PRESETS[0] });
function serviceInitials (name) {
  const words = String(name || '').split(/\s+/).filter(w => w && !/^service$/i.test(w));
  const ini = words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return ini || 'SC';
}
function logoSVG (logo, name, px) {
  const lg = { ...defaultLogo(), ...logo };
  const shape = LOGO_SHAPES[lg.shape] || LOGO_SHAPES.cerchio;
  const ini = serviceInitials(name);
  const icon = lg.icon === 'iniziali' || !LOGO_ICONS[lg.icon]
    ? `<text x="50" y="53" text-anchor="middle" dominant-baseline="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="${ini.length > 1 ? 46 : 56}">${escapeHtml(ini)}</text>`
    : LOGO_ICONS[lg.icon].replace(/BG/g, lg.bg).replace(/FG/g, lg.fg);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}">`
    + `<g fill="${lg.bg}">${shape}</g>`
    + `<g fill="none" stroke="${lg.fg}" stroke-width="3" transform="translate(50 50) scale(.86) translate(-50 -50)">${shape}</g>`
    + `<g fill="${lg.fg}" transform="translate(50 50) scale(.8) translate(-50 -50)">${icon}</g></svg>`;
}
const serviceLogo = () => Profile.data.logo || defaultLogo();

/* ---------------- marchio del service: logo + scritta del nome ----------------
   La scritta ha gli stili del mondo dei service e dei concerti. Si disegna
   su canvas (così usa i caratteri della pagina ed effetti di luce veri) e
   la stessa funzione serve per il menù, la fiancata del furgone e la
   scritta finale dello show. */
const BRAND_STYLES = {
  tour: 'Tour',
  neon: 'Neon',
  stencil: 'Stencil',
  led: 'LED wall',
  gaffer: 'Gaffer',
  fasci: 'Fasci di luce'
};
const FONT_DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
const FONT_MARKER = '"Permanent Marker", "Comic Sans MS", cursive';
const BRAND_TAGLINE = 'AUDIO · LUCI · SERVICE';
let brandFontsReady = null;
// i caratteri della pagina vanno caricati prima di disegnare sul canvas
function brandFonts () {
  if (!brandFontsReady) {
    const load = document.fonts ? Promise.all([
      document.fonts.load('700 40px "Barlow Condensed"'), document.fonts.load('40px "Permanent Marker"')
    ]).catch(() => {}) : Promise.resolve();
    brandFontsReady = Promise.race([load, new Promise(r => setTimeout(r, 1500))]);
  }
  return brandFontsReady;
}
// colore di punta del marchio: il più acceso dei due colori del logo
// (a parità, quello del simbolo), mai il nero
function colorPop (hex) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (Math.max(r, g, b) - Math.min(r, g, b)) + Math.max(r, g, b) * 0.2;
}
const brandAccent = logo => {
  if (logo.fg === '#1c1d22') return logo.bg;
  if (logo.bg === '#1c1d22') return logo.fg;
  return colorPop(logo.bg) > colorPop(logo.fg) ? logo.bg : logo.fg;
};
// casuale ma sempre uguale per lo stesso nome (spruzzi, strappi del nastro)
function seededRand (text) {
  let st = 2166136261;
  for (const ch of String(text)) st = Math.imul(st ^ ch.charCodeAt(0), 16777619);
  return () => { st = Math.imul(st ^ (st >>> 15), 2246822507) >>> 0; st ^= st >>> 13; return (st >>> 0) / 4294967296; };
}
// dimensione del carattere perché il testo stia in larghezza e altezza
function fitFont (ctx, text, font, h, maxW) {
  let size = h;
  ctx.font = font(size);
  const w = ctx.measureText(text).width;
  if (w > maxW) { size *= maxW / w; ctx.font = font(size); }
  return size;
}

// carattere 5×7 dei pannelli LED: 7 righe, 5 bit per riga (il più a sinistra in alto)
const LED_FONT = {
  'A': [0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11], 'B': [0x1E, 0x11, 0x11, 0x1E, 0x11, 0x11, 0x1E], 'C': [0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E], 'D': [0x1E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1E],
  'E': [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F], 'F': [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x10], 'G': [0x0E, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0F], 'H': [0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
  'I': [0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E], 'J': [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0C], 'K': [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11], 'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F],
  'M': [0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11], 'N': [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11], 'O': [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E], 'P': [0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10],
  'Q': [0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D], 'R': [0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11], 'S': [0x0F, 0x10, 0x10, 0x0E, 0x01, 0x01, 0x1E], 'T': [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E], 'V': [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04], 'W': [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0A], 'X': [0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11],
  'Y': [0x11, 0x11, 0x11, 0x0A, 0x04, 0x04, 0x04], 'Z': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F], '0': [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E], '1': [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
  '2': [0x0E, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1F], '3': [0x1F, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0E], '4': [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02], '5': [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
  '6': [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E], '7': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08], '8': [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E], '9': [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
  '-': [0x00, 0x00, 0x00, 0x1F, 0x00, 0x00, 0x00], '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x0C], "'": [0x0C, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00], '&': [0x0C, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0D],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04], '?': [0x0E, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04]
};
/* la scritta del nome, centrata in (cx, cy), alta al massimo h e larga al
   massimo maxW, nello stile scelto */
function drawStyledName (ctx, style, text, cx, cy, maxW, h, accent) {
  const rand = seededRand(text + style);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const bold = s => `700 ${s}px ${FONT_DISPLAY}`;
  if (style === 'neon') {
    // tubi di luce: alone largo del colore, poi il tubo, poi l'anima bianca
    const size = fitFont(ctx, text, s => `600 ${s}px ${FONT_DISPLAY}`, h * 0.9, maxW * 0.94);
    ctx.lineJoin = 'round';
    [[size * 0.5, 0.35], [size * 0.25, 0.6]].forEach(([blur, a]) => {
      ctx.shadowColor = accent; ctx.shadowBlur = blur; ctx.globalAlpha = a;
      ctx.strokeStyle = accent; ctx.lineWidth = size * 0.09; ctx.strokeText(text, cx, cy);
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = size * 0.12;
    ctx.strokeStyle = accent; ctx.lineWidth = size * 0.07; ctx.strokeText(text, cx, cy);
    ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = size * 0.022; ctx.strokeText(text, cx, cy);
  } else if (style === 'stencil') {
    // lettering da flight case: pieno, taglio orizzontale dello stencil e
    // spruzzi di vernice intorno
    const size = fitFont(ctx, text, bold, h * 0.92, maxW * 0.96);
    const w = ctx.measureText(text).width;
    const layer = document.createElement('canvas');
    layer.width = Math.ceil(w + size); layer.height = Math.ceil(size * 1.4);
    const lc = layer.getContext('2d');
    lc.font = bold(size); lc.textAlign = 'center'; lc.textBaseline = 'middle'; lc.fillStyle = accent;
    const lx = layer.width / 2, ly = layer.height / 2;
    lc.fillText(text, lx, ly);
    lc.globalCompositeOperation = 'destination-out';
    lc.fillRect(0, ly - size * 0.04, layer.width, size * 0.08);
    for (let i = 0; i < text.length * 3; i++) lc.fillRect(lx - w / 2 + rand() * w, ly - size * 0.5 + rand() * size, size * 0.03, size * 0.03);
    lc.globalCompositeOperation = 'source-over'; lc.fillStyle = accent;
    for (let i = 0; i < text.length * 14; i++) {
      const x = lx - w / 2 - size * 0.1 + rand() * (w + size * 0.2), y = ly + (rand() - 0.5) * size * 1.15;
      lc.globalAlpha = 0.15 + rand() * 0.4; lc.beginPath(); lc.arc(x, y, size * (0.006 + rand() * 0.014), 0, Math.PI * 2); lc.fill();
    }
    ctx.drawImage(layer, cx - lx, cy - ly);
  } else if (style === 'led') {
    // LED wall: carattere a matrice 5×7 come i pannelli veri, LED accesi
    // col bagliore e quelli spenti appena visibili sul fondo nero
    const chars = [...text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
    const cols = chars.reduce((n, ch) => n + (ch === ' ' ? 3 : 6), 0) - 1;
    const pitch = Math.min(maxW / (cols + 2), h / 9);
    const W = (cols + 2) * pitch, H = 9 * pitch, x0 = cx - W / 2, y0 = cy - H / 2;
    ctx.fillStyle = '#07080b'; ctx.fillRect(x0, y0, W, H);
    const lit = new Set();
    let col = 1;
    chars.forEach(ch => {
      if (ch === ' ') { col += 3; return; }
      const rows = LED_FONT[ch.toUpperCase()] || LED_FONT['?'];
      rows.forEach((bits, r) => { for (let c = 0; c < 5; c++) if (bits & (16 >> c)) lit.add((col + c) + ',' + (r + 1)); });
      col += 6;
    });
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < cols + 2; c++) {
        const on = lit.has(c + ',' + r);
        ctx.globalAlpha = on ? 1 : 0.14;
        ctx.fillStyle = on ? accent : '#5a5e66';
        ctx.shadowColor = accent; ctx.shadowBlur = on ? pitch * 0.9 : 0;
        ctx.beginPath(); ctx.arc(x0 + (c + 0.5) * pitch, y0 + (r + 0.5) * pitch, pitch * 0.38, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (style === 'gaffer') {
    // nastro gaffer nero, strappato a mano, scritto a pennarello
    const size = fitFont(ctx, text, s => `${s}px ${FONT_MARKER}`, h * 0.62, maxW * 0.82);
    const w = Math.min(maxW, ctx.measureText(text).width + size * 1.2), th = h * 0.92;
    ctx.translate(cx, cy); ctx.rotate(-0.035);
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = h * 0.12; ctx.shadowOffsetY = h * 0.05;
    ctx.fillStyle = '#23242a';
    ctx.beginPath();
    const tear = (x, dir) => { for (let y = -th / 2; y <= th / 2; y += th / 6) ctx.lineTo(x + dir * rand() * th * 0.08, y); };
    ctx.moveTo(-w / 2, -th / 2); ctx.lineTo(w / 2, -th / 2); tear(w / 2, 1);
    ctx.lineTo(-w / 2, th / 2);
    for (let y = th / 2; y >= -th / 2; y -= th / 6) ctx.lineTo(-w / 2 - rand() * th * 0.08, y);
    ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
    for (let x = -w / 2; x < w / 2; x += Math.max(2, th / 14)) { ctx.beginPath(); ctx.moveTo(x, -th / 2); ctx.lineTo(x + th * 0.1, th / 2); ctx.stroke(); }
    ctx.fillStyle = '#f4f2ea';
    ctx.font = `${size}px ${FONT_MARKER}`;
    ctx.fillText(text, 0, size * 0.04);
  } else if (style === 'fasci') {
    // fasci di luce dietro le lettere e scritta dorata
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const ox = cx, oy = cy + h * 0.9, n = 9;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.24, len = h * 2.2, spread = 0.05;
      const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
      g.addColorStop(0, accent); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(a - spread) * len, oy + Math.sin(a - spread) * len);
      ctx.lineTo(ox + Math.cos(a + spread) * len, oy + Math.sin(a + spread) * len);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    const size = fitFont(ctx, text, bold, h * 0.95, maxW * 0.94);
    const g = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
    g.addColorStop(0, '#fffbe6'); g.addColorStop(0.45, '#f2c53d'); g.addColorStop(0.55, '#b07a12'); g.addColorStop(1, '#f7d56a');
    ctx.lineJoin = 'round';
    ctx.shadowColor = accent; ctx.shadowBlur = size * 0.35;
    ctx.strokeStyle = '#1a1206'; ctx.lineWidth = size * 0.1; ctx.strokeText(text, cx, cy);
    ctx.shadowBlur = 0; ctx.fillStyle = g; ctx.fillText(text, cx, cy);
  } else {
    // tour: cromato, inclinato, bordo scuro, sottolineatura di colore e scintilla
    const size = fitFont(ctx, text, bold, h * 0.95, maxW * 0.9);
    const w = ctx.measureText(text).width;
    ctx.translate(cx, cy); ctx.transform(1, 0, -0.2, 1, 0, 0);
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowOffsetY = size * 0.06; ctx.shadowBlur = size * 0.08;
    ctx.strokeStyle = '#0e0f12'; ctx.lineWidth = size * 0.13; ctx.strokeText(text, 0, 0);
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = accent; ctx.lineWidth = size * 0.04; ctx.strokeText(text, 0, 0);
    const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.46, '#cfd3da'); g.addColorStop(0.5, '#4a4f58'); g.addColorStop(0.56, '#eef0f3'); g.addColorStop(1, '#8e949e');
    ctx.fillStyle = g; ctx.fillText(text, 0, 0);
    // sottolineatura a colpo di pennello, che si assottiglia
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.moveTo(-w / 2, size * 0.5); ctx.lineTo(w / 2 + size * 0.2, size * 0.46); ctx.lineTo(w / 2 + size * 0.2, size * 0.5); ctx.lineTo(-w / 2 + size * 0.1, size * 0.58); ctx.closePath(); ctx.fill();
    // scintilla sul primo carattere
    const sx = -w / 2 + size * 0.12, sy = -size * 0.36, r = size * 0.22;
    ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = size * 0.2;
    ctx.beginPath(); ctx.moveTo(sx, sy - r); ctx.lineTo(sx + r * 0.16, sy - r * 0.16); ctx.lineTo(sx + r, sy); ctx.lineTo(sx + r * 0.16, sy + r * 0.16);
    ctx.lineTo(sx, sy + r); ctx.lineTo(sx - r * 0.16, sy + r * 0.16); ctx.lineTo(sx - r, sy); ctx.lineTo(sx - r * 0.16, sy - r * 0.16); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/* logo coerente col nome: le parole del nome scelgono simbolo, colore e
   stile della scritta ("Luci" → faro, "Power" → fulmine, "Rossi" → rosso,
   "Neon" → scritta al neon…). Quello che il nome non dice lo decide il
   nome stesso in modo fisso, così lo stesso nome dà sempre lo stesso logo;
   "variant" propone altre idee sulla stessa base. */
const NAME_HINTS = {
  icon: [
    ['fulmine', ['power', 'elettr', 'volt', 'energ', 'thunder', 'fulmin', 'spark', 'watt', 'ampere', 'flash', 'saetta']],
    ['faro', ['luc', 'light', 'lux', 'lamp', 'fari', 'faro', 'spot', 'beam', 'ragg', 'lumen']],
    ['cassa', ['sound', 'suon', 'audio', 'acust', 'bass', 'boom', 'speaker', 'cass', 'woof', 'decibel', 'rumor', 'noise', 'volume']],
    ['onda', ['wave', 'onda', 'onde', 'freq', 'echo', 'vibe', 'radio', 'sonic', 'sonor', 'eco']],
    ['stella', ['star', 'stell', 'show', 'galax', 'nova', 'super', 'vip', 'gold', 'oro', 'festa', 'party']],
    ['fader', ['mix', 'fader', 'live', 'studio', 'console', 'regia', 'tech', 'pro', 'sistem', 'system']]
  ],
  bg: [
    ['#e0503f', ['ross', 'red', 'fuoco', 'fire', 'rock', 'inferno', 'lava', 'rubin']],
    ['#3b7bff', ['blu', 'blue', 'azzurr', 'mare', 'sea', 'sky', 'ciel', 'ice', 'ghiacc', 'ocean']],
    ['#49b06a', ['verd', 'green', 'bosc', 'forest', 'smerald', 'lime']],
    ['#f2c53d', ['oro', 'gold', 'sole', 'sun', 'giall', 'yellow', 'ambra']],
    ['#9b5de5', ['viola', 'purple', 'magic', 'mistic', 'lilla', 'violet']],
    ['#1c1d22', ['ner', 'black', 'dark', 'night', 'nott', 'buio', 'shadow', 'ombra']],
    ['#eee9df', ['bianc', 'white', 'neve', 'snow', 'luna', 'moon']],
    ['#f2a541', ['arancio', 'orange', 'tramont', 'sunset']]
  ],
  style: [
    ['neon', ['neon', 'night', 'nott', 'club', 'disco', 'dance', 'electro']],
    ['led', ['led', 'digit', 'pixel', 'tech', 'screen', 'video', 'matrix']],
    ['tour', ['rock', 'metal', 'tour', 'band', 'star', 'road']],
    ['stencil', ['crew', 'case', 'stage', 'palco', 'work', 'tecnic', 'truck', 'camion', 'furgon']],
    ['fasci', ['luc', 'light', 'show', 'lux', 'gold', 'oro', 'festa', 'party', 'event']],
    ['gaffer', ['garage', 'nastro', 'tape', 'gaffer', 'artigian', 'bottega', 'fai da te']]
  ]
};
function logoFromName (name, variant) {
  variant = variant || 0;
  // parole del nome, senza accenti e senza la parola "service" (la hanno tutti);
  // una parola chiave vale se una parola del nome comincia così ("luc" → Luci)
  const words = String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/).filter(w => w && w !== 'service');
  const rand = seededRand(words.join(' ') + '#' + variant);
  const pickHint = list => {
    const hit = list.filter(([, keys]) => keys.some(k => words.some(w => w.startsWith(k))));
    return hit.length ? hit[variant % hit.length][0] : null;
  };
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const icon = pickHint(NAME_HINTS.icon) || (variant % 2 ? pick(Object.keys(LOGO_ICONS)) : 'iniziali');
  const bg = pickHint(NAME_HINTS.bg) || pick(LOGO_COLORS.filter(c => c !== '#eee9df'));
  // simbolo in contrasto col fondo: su fondo scuro un colore acceso,
  // su fondo acceso il bianco o il nero
  const dark = bg === '#1c1d22' || bg === '#9b5de5' || bg === '#3b7bff' || bg === '#e0503f';
  const fg = bg === '#1c1d22' ? pick(['#f2a541', '#f2c53d', '#49b06a', '#3b7bff', '#e0503f'])
    : dark ? pick(['#eee9df', '#f2c53d'].filter(c => c !== bg)) : pick(['#1c1d22', '#1c1d22', '#e0503f'].filter(c => c !== bg));
  const style = pickHint(NAME_HINTS.style) || pick(Object.keys(BRAND_STYLES));
  return { shape: pick(Object.keys(LOGO_SHAPES)), icon, bg, fg, style };
}

// immagine del logo (SVG) pronta per il canvas, con una piccola memoria
const logoImages = new Map();
function logoImage (logo, name) {
  const svg = logoSVG(logo, name, 256);
  if (!logoImages.has(svg)) {
    logoImages.set(svg, new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img); img.onerror = () => resolve(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }));
    if (logoImages.size > 60) logoImages.delete(logoImages.keys().next().value);
  }
  return logoImages.get(svg);
}

/* marchio completo su un canvas W×H: logo a sinistra, nome nello stile
   scelto e sotto la riga AUDIO · LUCI · SERVICE */
async function renderBrand (canvas, logo, name, W, H) {
  const lg = { ...defaultLogo(), ...logo };
  const [img] = await Promise.all([logoImage(lg, name), brandFonts()]);
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const ls = H * 0.84, pad = H * 0.08;
  if (img) {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = H * 0.08; ctx.shadowOffsetY = H * 0.03;
    ctx.drawImage(img, pad, (H - ls) / 2, ls, ls); ctx.restore();
  }
  const tx = pad * 2 + ls, tw = W - tx - pad, text = (name || 'Il tuo service').toUpperCase();
  const accent = brandAccent(lg);
  drawStyledName(ctx, lg.style || 'tour', text, tx + tw / 2, H * 0.42, tw, H * 0.5, accent);
  ctx.save();
  ctx.fillStyle = 'rgba(238,233,223,.75)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const ts = fitFont(ctx, BRAND_TAGLINE, s => `600 ${s}px ${FONT_DISPLAY}`, H * 0.12, tw * 0.8);
  if ('letterSpacing' in ctx) ctx.letterSpacing = (ts * 0.25) + 'px';
  ctx.fillText(BRAND_TAGLINE, tx + tw / 2, H * 0.84);
  ctx.restore();
  return canvas;
}
// anteprima del marchio in un elemento del menù, nitida anche sugli schermi densi
function brandPreview (box, logo, name, w, h) {
  let c = box.querySelector('canvas');
  if (!c) { box.innerHTML = ''; c = document.createElement('canvas'); box.appendChild(c); }
  c.style.width = w + 'px'; c.style.height = h + 'px';
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  return renderBrand(c, logo, name, Math.round(w * dpr), Math.round(h * dpr));
}

// la partita è "in corso" dopo Nuova partita o Continua: prima non si salva
// niente, così la schermata iniziale non sovrascrive il salvataggio
let gameActive = false;

function freshStats () { return { playMs: 0, tests: 0, failedTests: 0 }; }
gameState.stats = freshStats();

function saveLevel () {
  if (!gameActive) return;
  Profile.data.level = {
    id: LEVEL_ID,
    placed: gameState.placed, edges: gameState.edges, stock: gameState.stock,
    nextIndex: gameState.nextIndex, edgeSeq: gameState.edgeSeq,
    trips: gameState.trips || 0, rcdTrips: gameState.rcdTrips || 0,
    procErrors: gameState.procErrors || [], stats: gameState.stats
  };
  Profile.save();
}

/* reputazione di un collaudo riuscito: 100 per l'impianto che funziona,
   più fino a 50 per la procedura pulita (ogni test fallito, scatto del
   Quadro o del salvavita costa 10, ogni colpo nelle casse 5) */
const REP_BASE = 100, REP_CLEAN = 50;
function collaudoReputation (r) {
  const slips = (r.failedTests + r.trips + r.rcdTrips) * 10 + r.pops * 5;
  return REP_BASE + Math.max(0, REP_CLEAN - slips);
}
const reputation = () => Profile.data.reputation.total;

// un collaudo riuscito entra nei record del livello (i migliori per primi)
// e fa crescere la reputazione se batte il miglior collaudo del livello;
// restituisce quanta reputazione ha guadagnato (0 se non ha fatto meglio)
function addRecord () {
  const st = gameState.stats;
  const rec = {
    at: Date.now(), service: Profile.data.service,
    playMs: st.playMs, tests: st.tests, failedTests: st.failedTests,
    trips: gameState.trips || 0, rcdTrips: gameState.rcdTrips || 0,
    pops: (gameState.procErrors || []).filter(x => x === 'pop').length
  };
  rec.reputation = collaudoReputation(rec);
  const list = (Profile.data.records[LEVEL_ID] || []).concat(rec)
    .sort((a, b) => b.reputation - a.reputation || a.playMs - b.playMs)
    .slice(0, RECORDS_KEEP);
  Profile.data.records[LEVEL_ID] = list;
  const R = Profile.data.reputation, best = R.byLevel[LEVEL_ID] || 0;
  const gain = Math.max(0, rec.reputation - best);
  R.byLevel[LEVEL_ID] = best + gain;
  R.total += gain;
  Profile.save();
  applySettings();
  return gain;
}

// tempo di gioco: conta solo con la pagina in vista e il menù chiuso
setInterval(() => {
  if (gameActive && !menuOpen && !document.hidden) gameState.stats.playMs += 1000;
}, 1000);

function applySettings () {
  SFX.setVolume(settings().volume);
  const tag = el('#service-tag');
  if (tag) tag.textContent = gameActive || Profile.data.service
    ? (Profile.data.service || serviceName()).toUpperCase() + ' · REPUTAZIONE ' + reputation()
    : 'STAGE CREW SIMULATOR';
  const logo = el('#service-logo');
  if (logo) logo.innerHTML = gameActive || Profile.data.service ? logoSVG(serviceLogo(), Profile.data.service, 30) : '';
  if (window.__scene) window.__scene.paintServiceName();
}

/* ---------------- menù di gioco ----------------
   All'avvio: Continua (se c'è una partita salvata), Nuova partita,
   Impostazioni. Durante il gioco si apre col tasto ☰ in alto. */
let menuOpen = false;
// col menù aperto la tastiera serve ai campi di testo: la scena non deve
// catturare frecce, WASD o Canc (altrimenti nel nome non si scrive la S)
function sceneKeyboard (on) {
  const kb = window.__scene && window.__scene.input.keyboard;
  if (!kb) return;
  kb.enabled = on;
  if (on) kb.enableGlobalCapture(); else kb.disableGlobalCapture();
}
function whenScene (fn) {
  if (window.__scene) fn(window.__scene); else setTimeout(() => whenScene(fn), 50);
}
// nuova partita in preparazione (nome e logo non ancora confermati) e
// logo che si sta modificando nella pagina del logo
// auto: il logo segue il nome mentre lo si scrive (finché non lo si ritocca a mano)
let draft = { name: '', logo: defaultLogo(), auto: true, variant: 0 };
let logoEdit = null;

function showMenuPage (page, keep) {
  document.querySelectorAll('#menu-modal .menu-page').forEach(p => { p.hidden = p.dataset.page !== page; });
  const canResume = gameActive || !!Profile.data.level;
  el('#menu-resume').hidden = !canResume;
  el('#menu-resume').textContent = gameActive ? 'Riprendi' : 'Continua · ' + serviceName() + ' · ★ ' + reputation();
  el('#menu-new').classList.toggle('primary', !canResume);
  el('#new-warning').hidden = !Profile.data.level;
  el('#set-service-row').hidden = !gameActive;
  el('#set-logo-row').hidden = !gameActive;
  if (page === 'new') {
    const i = el('#service-input');
    if (!keep) {
      const auto = !Profile.data.service;
      draft = { name: Profile.data.service, logo: auto ? logoFromName('') : { ...serviceLogo() }, auto, variant: 0 };
      i.value = draft.name; setTimeout(() => i.focus(), 30);
    }
    brandPreview(el('#new-logo'), draft.logo, draft.name, 300, 90);
  }
  if (page === 'logo') renderLogoEditor();
  if (page === 'settings') {
    el('#set-volume').value = Math.round(settings().volume * 100);
    el('#set-reduced').checked = !!settings().reducedFx;
    el('#set-skipshow').checked = !!settings().skipShow;
    el('#set-service').value = Profile.data.service;
    brandPreview(el('#set-logo'), serviceLogo(), Profile.data.service, 300, 90);
  }
}

/* pagina del logo: loghi pronti, forma, simbolo e colori. Fondo e simbolo
   non possono avere lo stesso colore: se succede si scambiano. */
function renderLogoEditor () {
  const { logo } = logoEdit, name = logoEdit.name();
  brandPreview(el('#logo-preview'), logo, name, 300, 96);
  const opt = (html, sel, fn, extra) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'logo-opt' + (sel ? ' sel' : '') + (extra ? ' ' + extra : '');
    b.innerHTML = html;
    b.addEventListener('click', () => { SFX.button(); fn(); if (logoEdit.back === 'new') draft.auto = false; logoChanged(); });
    return b;
  };
  const fill = (id, items) => { const row = el(id); row.innerHTML = ''; items.forEach(b => row.appendChild(b)); };
  const same = (a, b) => ['shape', 'icon', 'bg', 'fg', 'style'].every(k => (a[k] || 'tour') === (b[k] || 'tour'));
  fill('#logo-presets', LOGO_PRESETS.map((pr, i) => {
    const b = opt(logoSVG(pr, name, 38), same(pr, logo), () => Object.assign(logo, pr));
    b.dataset.preset = i; return b;
  }));
  fill('#logo-shapes', Object.keys(LOGO_SHAPES).map(k => {
    const b = opt(logoSVG({ ...logo, shape: k }, name, 38), logo.shape === k, () => { logo.shape = k; });
    b.title = k; b.dataset.shape = k; return b;
  }));
  fill('#logo-icons', Object.keys(LOGO_ICONS).map(k => {
    const b = opt(logoSVG({ ...logo, icon: k }, name, 38), logo.icon === k, () => { logo.icon = k; });
    b.title = k; b.dataset.icon = k; return b;
  }));
  // stili della scritta: ognuno con l'anteprima del nome
  const text = (name || 'Il tuo service').toUpperCase();
  fill('#logo-styles', Object.entries(BRAND_STYLES).map(([k, label]) => {
    const b = opt('', (logo.style || 'tour') === k, () => { logo.style = k; }, 'style-opt');
    b.dataset.style = k;
    const c = document.createElement('canvas'), dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = 136 * dpr; c.height = 40 * dpr; c.style.width = '136px'; c.style.height = '40px';
    b.appendChild(c);
    const cap = document.createElement('span'); cap.textContent = label; b.appendChild(cap);
    brandFonts().then(() => drawStyledName(c.getContext('2d'), k, text, c.width / 2, c.height / 2, c.width * 0.94, c.height * 0.72, brandAccent(logo)));
    return b;
  }));
  const setColor = (key, other, c) => { if (logo[other] === c) logo[other] = logo[key]; logo[key] = c; };
  ['bg', 'fg'].forEach(key => fill('#logo-' + key, LOGO_COLORS.map(c => {
    const b = opt('', logo[key] === c, () => setColor(key, key === 'bg' ? 'fg' : 'bg', c), 'swatch');
    b.style.background = c; b.dataset.color = c; return b;
  })));
}
// logo dal nome: la prima idea, o una nuova a ogni tocco di "Un'altra idea"
function logoFromNameInEditor (next) {
  logoEdit.variant = next ? (logoEdit.variant || 0) + 1 : 0;
  Object.assign(logoEdit.logo, logoFromName(logoEdit.name(), logoEdit.variant));
  if (logoEdit.back === 'new') { draft.auto = !next; draft.variant = logoEdit.variant; }
  logoChanged();
}
function logoChanged () {
  renderLogoEditor();
  // dalle impostazioni il logo cambia subito anche in testata e sul furgone
  if (logoEdit.live) { Profile.save(); applySettings(); }
}
function openMenu (page) {
  menuOpen = true;
  setSceneInput(false);
  sceneKeyboard(false);
  if (window.__scene) window.__scene.stopFx();
  showMenuPage(page || 'main');
  el('#menu-modal').classList.add('show');
}
function closeMenu () {
  menuOpen = false;
  el('#menu-modal').classList.remove('show');
  setSceneInput(true);
  sceneKeyboard(true);
}
const cleanName = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, SERVICE_MAX);

function startNewGame (name, logo) {
  Profile.data.service = cleanName(name);
  Profile.data.logo = { ...(logo || logoFromName(Profile.data.service)) };
  Profile.data.reputation = defaultProfile().reputation;   // nuovo service, reputazione da costruire
  whenScene(scene => {
    gameActive = true;
    scene.resetLevel(true);      // azzera livello e statistiche e salva
    applySettings();
    closeMenu();
    showToast('Benvenuti, ' + serviceName() + ': montate l\'impianto per la festa della scuola.', 'ok');
  });
}
function continueGame () {
  if (gameActive) { closeMenu(); return; }
  whenScene(scene => {
    gameActive = true;
    if (Profile.data.level && Profile.data.level.id === LEVEL_ID) scene.loadLevel(Profile.data.level);
    applySettings();
    closeMenu();
  });
}

el('#menu-btn').addEventListener('click', () => { SFX.button(); openMenu('main'); });
el('#menu-resume').addEventListener('click', () => { SFX.button(); continueGame(); });
el('#menu-new').addEventListener('click', () => { SFX.button(); showMenuPage('new'); });
el('#menu-settings').addEventListener('click', () => { SFX.button(); showMenuPage('settings'); });
el('#new-cancel').addEventListener('click', () => { SFX.button(); showMenuPage('main'); });
el('#new-form').addEventListener('submit', ev => { ev.preventDefault(); SFX.button(); startNewGame(el('#service-input').value, draft.logo); });
el('#service-input').addEventListener('input', ev => {
  draft.name = ev.target.value;
  if (draft.auto) draft.logo = logoFromName(draft.name, draft.variant);
  brandPreview(el('#new-logo'), draft.logo, draft.name, 300, 90);   // nome e iniziali seguono quello che si scrive
});
el('#new-logo-btn').addEventListener('click', () => {
  SFX.button();
  logoEdit = { logo: draft.logo, name: () => draft.name, back: 'new', variant: draft.variant };
  showMenuPage('logo');
});
el('#set-logo-btn').addEventListener('click', () => {
  SFX.button();
  Profile.data.logo = { ...serviceLogo() };
  logoEdit = { logo: Profile.data.logo, name: () => Profile.data.service, back: 'settings', live: true };
  showMenuPage('logo');
});
el('#logo-from-name').addEventListener('click', () => { SFX.button(); logoFromNameInEditor(false); });
el('#logo-another').addEventListener('click', () => { SFX.button(); logoFromNameInEditor(true); });
el('#logo-done').addEventListener('click', () => { SFX.button(); showMenuPage(logoEdit.back, true); });
el('#settings-back').addEventListener('click', () => { SFX.button(); Profile.flush(); showMenuPage('main'); });
el('#set-volume').addEventListener('input', ev => { settings().volume = ev.target.value / 100; SFX.setVolume(settings().volume); Profile.save(); });
el('#set-volume').addEventListener('change', () => SFX.button());
el('#set-reduced').addEventListener('change', ev => { settings().reducedFx = ev.target.checked; Profile.save(); });
el('#set-skipshow').addEventListener('change', ev => { settings().skipShow = ev.target.checked; Profile.save(); });
el('#set-service').addEventListener('change', ev => {
  Profile.data.service = cleanName(ev.target.value);
  ev.target.value = Profile.data.service;
  applySettings(); Profile.save();
});
applySettings();
openMenu(Profile.data.level ? 'main' : 'new');

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
      .map(e => `<li>${compLabel(e.b)} — ${downstreamPowerLoad(e.b, new Set([quadroEntry.id]))} W</li>`)
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

/* ---------------------------------------------------------------------
   3b) CONNETTORI REALI (SVG) — la faccia del connettore da pannello così
      com'è nella realtà, disegnata in un riquadro 120×120. Usati dal popup
      del pannello posteriore (vedi openRearPanel).
   --------------------------------------------------------------------- */
const CONN_CX = 60, CONN_CY = 62;   // centro della presa nel riquadro

// flangia Neutrik "D" (26×31 mm): nera, con due fori di fissaggio in diagonale
function svgDFlange () {
  return `
    <rect x="21" y="13" width="78" height="96" rx="9" fill="#1b1c20" stroke="#3a3d45" stroke-width="1.5"/>
    <rect x="23" y="15" width="74" height="92" rx="8" fill="none" stroke="#000" stroke-opacity=".35"/>
    <circle cx="31" cy="23" r="4.2" fill="#0a0a0c" stroke="#55585f" stroke-width="1.2"/>
    <circle cx="89" cy="99" r="4.2" fill="#0a0a0c" stroke="#55585f" stroke-width="1.2"/>`;
}
// contatto: pin (maschio) in ottone nichelato, o foro (femmina) nell'inserto
function svgPin (x, y, r) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#e8e2d0" stroke="#8a8578" stroke-width=".8"/>
          <circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.35}" fill="#fff" fill-opacity=".7"/>`;
}
function svgHole (x, y, r) {
  return `<circle cx="${x}" cy="${y}" r="${r + 1.2}" fill="#2a2c33"/>
          <circle cx="${x}" cy="${y}" r="${r}" fill="#030304"/>`;
}
function svgNum (x, y, n) {
  return `<text x="${x}" y="${y}" font-size="6.5" fill="#8b8e98" text-anchor="middle" font-family="Inter,sans-serif">${n}</text>`;
}

// XLR (3 poli audio, 5 poli DMX) — femmina NC3FD-L con tasto PUSH, maschio NC3MD-L
function svgXlr (n, male) {
  let s = svgDFlange();
  // anello metallico del guscio
  s += `<circle cx="${CONN_CX}" cy="${CONN_CY}" r="26" fill="#c9ccd1" stroke="#7d828c" stroke-width="1.2"/>
        <circle cx="${CONN_CX}" cy="${CONN_CY}" r="23.5" fill="#9aa0aa"/>`;
  const pts = n === 3
    ? (male ? [[-10, -5, 1], [10, -5, 2], [0, 11, 3]] : [[10, -5, 1], [-10, -5, 2], [0, 11, 3]])
    : [0, 1, 2, 3, 4].map(i => {
        const a = (180 - i * 45) * Math.PI / 180;
        const x = Math.cos(a) * 13 * (male ? 1 : -1), y = Math.sin(a) * 13 - 2;
        return [x, y, i + 1];
      });
  if (male) {
    // incavo del guscio con la scanalatura di guida in alto, isolante e pin
    s += `<circle cx="${CONN_CX}" cy="${CONN_CY}" r="21.5" fill="#0e0f12"/>
          <rect x="${CONN_CX - 3}" y="${CONN_CY - 24}" width="6" height="6" fill="#0e0f12"/>
          <circle cx="${CONN_CX}" cy="${CONN_CY}" r="18.5" fill="#23252b"/>`;
    pts.forEach(([x, y, k]) => { s += svgPin(CONN_CX + x, CONN_CY + y, n === 3 ? 3.6 : 3) + svgNum(CONN_CX + x, CONN_CY + y + (y > 0 ? 10 : -6), k); });
  } else {
    // inserto nero pieno con i fori, e il fermo metallico in alto
    s += `<circle cx="${CONN_CX}" cy="${CONN_CY}" r="21.5" fill="#141519"/>`;
    pts.forEach(([x, y, k]) => { s += svgHole(CONN_CX + x, CONN_CY + y, n === 3 ? 3.4 : 2.9) + svgNum(CONN_CX + x, CONN_CY + y + (y > 0 ? 10 : -6), k); });
    s += `<rect x="${CONN_CX - 5}" y="${CONN_CY - 26}" width="10" height="7" rx="1.5" fill="#dcdfe4" stroke="#7d828c"/>
          <text x="${CONN_CX}" y="${CONN_CY - 30}" font-size="7" font-weight="700" fill="#cfd2d6" text-anchor="middle" font-family="Inter,sans-serif">PUSH</text>`;
  }
  return s;
}

// Speakon da pannello NL4MP: presa nera con anello, perno centrale e chiavi
function svgSpeakon () {
  return svgDFlange() + `
    <circle cx="${CONN_CX}" cy="${CONN_CY}" r="27" fill="#26282e" stroke="#4a4d56" stroke-width="1.5"/>
    <circle cx="${CONN_CX}" cy="${CONN_CY}" r="22" fill="#0e0f12"/>
    <rect x="${CONN_CX - 4}" y="${CONN_CY - 24}" width="8" height="6" fill="#26282e"/>
    <rect x="${CONN_CX - 4}" y="${CONN_CY + 18}" width="8" height="6" fill="#26282e"/>
    <circle cx="${CONN_CX}" cy="${CONN_CY}" r="10" fill="#33363d" stroke="#55585f"/>
    <rect x="${CONN_CX - 1.5}" y="${CONN_CY - 10}" width="3" height="20" fill="#17181c"/>
    <text x="${CONN_CX - 16}" y="${CONN_CY - 13}" font-size="6.5" fill="#cfd2d6" text-anchor="middle" font-family="Inter,sans-serif">1+</text>
    <text x="${CONN_CX + 16}" y="${CONN_CY - 13}" font-size="6.5" fill="#cfd2d6" text-anchor="middle" font-family="Inter,sans-serif">1−</text>`;
}

// PowerCON: NAC3MPA blu = power IN, NAC3MPB grigio chiaro = power OUT
function svgPowercon (isIn) {
  const body = isIn ? '#2f6fd6' : '#cfd2d6', dark = isIn ? '#1d4a9a' : '#9aa0aa';
  return svgDFlange() + `
    <circle cx="${CONN_CX}" cy="${CONN_CY}" r="27" fill="${body}" stroke="${dark}" stroke-width="1.5"/>
    <circle cx="${CONN_CX}" cy="${CONN_CY}" r="21" fill="#141519"/>
    <circle cx="${CONN_CX}" cy="${CONN_CY}" r="11" fill="${dark}"/>
    <circle cx="${CONN_CX}" cy="${CONN_CY}" r="7" fill="#23252b"/>
    ${[0, 120, 240].map(d => {
      const a = (d - 90) * Math.PI / 180;
      return `<rect x="${CONN_CX + Math.cos(a) * 15.5 - 2}" y="${CONN_CY + Math.sin(a) * 15.5 - 4}" width="4" height="8" rx="1"
        fill="#e8e2d0" transform="rotate(${d} ${CONN_CX + Math.cos(a) * 15.5} ${CONN_CY + Math.sin(a) * 15.5})"/>`;
    }).join('')}
    <rect x="${CONN_CX + 18}" y="${CONN_CY - 6}" width="7" height="12" rx="2" fill="${dark}"/>
    <text x="${CONN_CX}" y="${CONN_CY + 36}" font-size="7" font-weight="700" fill="${isIn ? '#9cc0ff' : '#e6e8eb'}" text-anchor="middle" font-family="Inter,sans-serif">${isIn ? 'POWER IN' : 'POWER OUT'}</text>`;
}

// jack 6,35 da pannello: ghiera esagonale e boccola filettata
function svgJack () {
  const hex = [0, 1, 2, 3, 4, 5].map(i => {
    const a = (i * 60 + 30) * Math.PI / 180;
    return `${CONN_CX + Math.cos(a) * 20},${CONN_CY + Math.sin(a) * 20}`;
  }).join(' ');
  return svgDFlange() + `
    <polygon points="${hex}" fill="#9aa0aa" stroke="#6a6e78" stroke-width="1.2"/>
    <circle cx="${CONN_CX}" cy="${CONN_CY}" r="14" fill="#c9ccd1" stroke="#7d828c"/>
    ${[11.5, 9.5].map(r => `<circle cx="${CONN_CX}" cy="${CONN_CY}" r="${r}" fill="none" stroke="#8a8e98" stroke-width="1"/>`).join('')}
    <circle cx="${CONN_CX}" cy="${CONN_CY}" r="6" fill="#030304"/>`;
}

// Schuko: placca quadrata nera, invaso tondo, due poli e lamelle di terra
function svgSchuko (male) {
  let s = `<rect x="12" y="12" width="96" height="96" rx="10" fill="#1c1d22" stroke="#3a3d45" stroke-width="1.5"/>
           <circle cx="${CONN_CX}" cy="${CONN_CY - 2}" r="36" fill="#141519" stroke="#2e3037"/>
           <circle cx="${CONN_CX}" cy="${CONN_CY - 2}" r="33" fill="#191a1f"/>
           <rect x="${CONN_CX - 7}" y="${CONN_CY - 36}" width="14" height="6" rx="1" fill="#c9ccd1"/>
           <rect x="${CONN_CX - 7}" y="${CONN_CY + 26}" width="14" height="6" rx="1" fill="#c9ccd1"/>`;
  s += male ? svgPin(CONN_CX - 16, CONN_CY - 2, 4.6) + svgPin(CONN_CX + 16, CONN_CY - 2, 4.6)
            : svgHole(CONN_CX - 16, CONN_CY - 2, 5) + svgHole(CONN_CX + 16, CONN_CY - 2, 5);
  return s;
}

// CEE (IEC 60309): presa da quadro (femmina) con coperchio a molla aperto,
// oppure spina fissa da apparecchio (maschio) con il manicotto e i pin.
// Blu = 230V monofase 2P+T, rosso = 400V trifase 3P+N+T; la terra è il
// contatto più grosso, in basso (posizione "6 h").
function svgCee (tri, male) {
  const body = tri ? '#d6392f' : '#2f6fd6', dark = tri ? '#9e2820' : '#1d4a9a', light = tri ? '#ee6a60' : '#5d8fe6';
  const poles = tri
    ? [[-20, 6], [-15, -14], [15, -14], [20, 6]]
    : [[-17, -6], [17, -6]];
  let s = '';
  if (!male) {
    // coperchio incernierato, aperto verso l'alto
    s += `<path d="M 26 20 L 94 20 L 88 6 L 32 6 Z" fill="${light}" stroke="${dark}" stroke-width="1.2"/>
          <rect x="30" y="18" width="60" height="5" rx="2" fill="${dark}"/>`;
  }
  s += `<rect x="16" y="20" width="88" height="90" rx="10" fill="${body}" stroke="${dark}" stroke-width="1.5"/>
        <circle cx="${CONN_CX}" cy="${CONN_CY + 4}" r="34" fill="${dark}"/>`;
  if (male) {
    s += `<circle cx="${CONN_CX}" cy="${CONN_CY + 4}" r="31" fill="#0e0f12"/>
          <circle cx="${CONN_CX}" cy="${CONN_CY + 4}" r="27" fill="${body}" fill-opacity=".35"/>
          <rect x="${CONN_CX - 4}" y="${CONN_CY - 30}" width="8" height="7" fill="${dark}"/>`;
    poles.forEach(([x, y]) => { s += svgPin(CONN_CX + x, CONN_CY + 4 + y, 4); });
    s += svgPin(CONN_CX, CONN_CY + 4 + 20, 5.4);
  } else {
    s += `<circle cx="${CONN_CX}" cy="${CONN_CY + 4}" r="30" fill="${body}"/>
          <circle cx="${CONN_CX}" cy="${CONN_CY + 4}" r="30" fill="#000" fill-opacity=".12"/>
          <rect x="${CONN_CX - 4}" y="${CONN_CY - 27}" width="8" height="7" fill="${dark}"/>`;
    poles.forEach(([x, y]) => { s += svgHole(CONN_CX + x, CONN_CY + 4 + y, 4.2); });
    s += svgHole(CONN_CX, CONN_CY + 4 + 20, 5.6);
  }
  s += `<text x="${CONN_CX}" y="${CONN_CY + 44}" font-size="7" font-weight="700" fill="#fff" fill-opacity=".85" text-anchor="middle" font-family="Inter,sans-serif">${tri ? '400V 16A' : '230V 16A'}</text>`;
  return s;
}

// presa USB-C: fessura a "stadio" col guscio metallico e la linguetta dei
// contatti al centro, reversibile; sopra il simbolo USB serigrafato
function svgUsbC () {
  const cx = CONN_CX, cy = CONN_CY;
  return `<rect x="${cx - 36}" y="${cy - 30}" width="72" height="60" rx="10" fill="#000" fill-opacity=".12"/>
    <path d="M ${cx - 8} ${cy - 16} L ${cx + 8} ${cy - 16} M ${cx} ${cy - 22} L ${cx} ${cy - 12} M ${cx - 8} ${cy - 16} L ${cx - 8} ${cy - 20} M ${cx + 8} ${cy - 16} L ${cx + 8} ${cy - 12}"
      stroke="#8b8e98" stroke-width="1.6" fill="none"/>
    <rect x="${cx - 24}" y="${cy - 7}" width="48" height="18" rx="9" fill="#c9ccd1" stroke="#7d828c" stroke-width="1.2"/>
    <rect x="${cx - 20}" y="${cy - 4}" width="40" height="12" rx="6" fill="#0e0f12"/>
    <rect x="${cx - 13}" y="${cy}" width="26" height="4" rx="1.5" fill="#d9d4c7"/>
    ${Array.from({ length: 6 }, (_, i) => `<rect x="${cx - 11 + i * 4.2}" y="${cy + 0.6}" width="1.6" height="2.8" fill="#b8a36a"/>`).join('')}
    <text x="${cx}" y="${cy + 26}" font-size="7" font-weight="700" fill="#8b8e98" text-anchor="middle" font-family="Inter,sans-serif">USB-C</text>`;
}

function connectorSVG (signal, dir) {
  const male = (CONNECTOR_GENDER[signal] || {})[dir] === 'male';
  switch (signal) {
    case 'xlr':      return svgXlr(3, male);
    case 'dmx':      return svgXlr(5, male);
    case 'speakon':  return svgSpeakon();
    case 'powercon': return svgPowercon(dir === 'in');
    case 'jack':     return svgJack();
    case 'schuko':   return svgSchuko(male);
    case 'cee_mono': return svgCee(false, male);
    case 'cee_tri':  return svgCee(true, male);
    case 'usbc':     return svgUsbC();
    default:         return `<circle cx="${CONN_CX}" cy="${CONN_CY}" r="20" fill="#555"/>`;
  }
}

/* ---------------------------------------------------------------------
   3c) PANNELLO POSTERIORE — in modalità cablaggio, toccando un dispositivo
      si apre il suo retro con i connettori reali: si sceglie lì la presa.
      Nella scena non ci sono più porte da centrare col dito.
   --------------------------------------------------------------------- */
/* per ogni dispositivo: stile del pannello, sezioni serigrafate con le prese
   (id porta + scritta), decorazioni a sinistra/destra e targhetta */
const REAR_PANELS = {
  sub: { style: 'cabinet', left: 'vents', power: true, serial: 'ACTIVE SUBWOOFER 18"  ·  1200 W',
    sections: [['SPEAKER', [['spk_in', 'INPUT'], ['spk_thru', 'LINK']]], ['POWER', [['power', 'MAINS IN']]]] },
  top: { style: 'cabinet', serial: '2-WAY 12" + 1"  ·  8 Ω',
    sections: [['SPEAKER', [['spk_in', 'INPUT']]]] },
  // retro del ponte del mixer: su due file, sopra i 6 ingressi, sotto uscite e corrente
  mixer: { style: 'desk', power: true, serial: 'DIGITAL MIXER  ·  4 MIC + 2 LINE  ·  2 AUX',
    rows: [
      [['MIC IN', [1, 2, 3, 4].map(n => ['in_' + n, 'CH ' + n])], ['LINE IN', [5, 6].map(n => ['in_' + n, 'CH ' + n])]],
      [['MAIN OUT', [['main_L', 'MAIN L'], ['main_R', 'MAIN R']]], ['AUX · MONITOR', [['aux_1', 'AUX 1'], ['aux_2', 'AUX 2']]], ['POWER', [['power', 'POWER']]]]
    ] },
  ampli: { style: 'rack', left: 'fan', right: 'fuse', power: true, serial: 'CLASS-D POWER AMPLIFIER  ·  2 × 500 W @ 4 Ω',
    sections: [['INPUT', [['in_L', 'IN A (L)'], ['in_R', 'IN B (R)']]], ['OUTPUT', [['out_L', 'OUT CH1'], ['out_R', 'OUT CH2']]], ['POWER ~230V', [['power', 'MAINS IN']]]] },
  par: { style: 'round', serial: 'LED PAR 7 × 10 W RGBW',
    sections: [['POWER', [['power_in', 'POWER IN'], ['power_thru', 'POWER OUT']]], ['DMX 512', [['dmx_in', 'DMX IN'], ['dmx_thru', 'DMX THRU']]]] },
  controller: { style: 'desk', accent: true, power: true, serial: 'DMX CONTROLLER  ·  2 UNIVERSI  ·  1024 CH',
    sections: [['DMX OUT', [['dmx_1', 'UNIVERSO 1'], ['dmx_2', 'UNIVERSO 2']]], ['POWER', [['power', 'POWER IN']]]] },
  // sopra le protezioni su guida DIN, sotto ingresso e prese
  quadro: { style: 'white', serial: 'QUADRO DI DISTRIBUZIONE  ·  3F+N 16A  ·  IP44',
    rows: [
      [['__PROT__', []]],
      [['INGRESSO', [['in', '400V TRIFASE']]], ['USCITE 230V', [['out_1', 'L1'], ['out_2', 'L2'], ['out_3', 'L3']]]]
    ] },
  allaccio: { style: 'green', serial: 'ALLACCIO VENUE  ·  400V 16A',
    sections: [['USCITA', [['out', '400V TRIFASE']]]] },
  // ciabatte: barra vista dall'alto con le prese a 45° e il cavo con la spina
  ciabatta: { style: 'strip', serial: 'CIABATTA 3 PRESE  ·  SPINA SCHUKO  ·  16A',
    sections: [['SPINA', [['in', 'SPINA']]], ['PRESE', [['out_1', 'PRESA 1'], ['out_2', 'PRESA 2'], ['out_3', 'PRESA 3']]]] },
  ciabatta_cee: { style: 'strip', serial: 'CIABATTA 4 PRESE  ·  SPINA CEE 230V 16A',
    sections: [['SPINA', [['in', 'SPINA']]], ['PRESE', [['out_1', 'PRESA 1'], ['out_2', 'PRESA 2'], ['out_3', 'PRESA 3'], ['out_4', 'PRESA 4']]]] },
  pc: { style: 'laptop', power: true, serial: 'LAPTOP  ·  lato sinistro',
    sections: [['ALIMENTAZIONE', [['power', 'SPINA']]], ['USB', [['usb', 'USB-C']]]] },
  scheda: { style: 'scheda', left: 'kensington', serial: 'USB AUDIO INTERFACE  ·  2 IN / 2 OUT  ·  24 bit / 192 kHz  ·  alimentata via USB',
    sections: [['USB', [['usb', 'CAVO USB-C']]], ['LINE OUTPUTS (bilanciate)', [['out_L', 'OUT L'], ['out_R', 'OUT R']]]] },
  di: { style: 'steel', right: 'lift', serial: 'PASSIVE DI BOX  ·  2 CANALI',
    sections: [['INPUT', [['in_1', 'CH1 IN'], ['in_2', 'CH2 IN']]], ['OUTPUT', [['out_1', 'CH1 OUT'], ['out_2', 'CH2 OUT']]]] }
};
// tutte le sezioni di un pannello, qualunque sia la disposizione
function panelSections (panel) { return panel.rows ? panel.rows.flat() : panel.sections; }

// modalità DMX del faro: quante canali occupa ciascuna
const PAR_MODES = [
  { id: '3CH', name: '3CH · RGB' },
  { id: '4CH', name: '4CH · RGBW' },
  { id: '8CH', name: '8CH · RGBW + dimmer + strobo' }
];
function parDmx (comp) {
  if (!comp.dmx) comp.dmx = { addr: 1, mode: 1 };
  return comp.dmx;
}
let parMenuField = 'addr';   // cosa si sta regolando sul display: indirizzo o modalità

const REAR_STYLES = {
  rack:    { bg: '#2e3037', edge: '#4a4d56', ink: '#cfd2d6', sub: '#8b8e98' },
  cabinet: { bg: '#1b1c20', edge: '#33363d', ink: '#cfd2d6', sub: '#8b8e98', plate: '#2a2c33' },
  desk:    { bg: '#26282e', edge: '#3a3d45', ink: '#cfd2d6', sub: '#8b8e98' },
  round:   { bg: '#1c1d22', edge: '#3a3d45', ink: '#cfd2d6', sub: '#8b8e98' },
  white:   { bg: '#e9eaed', edge: '#b9bcc1', ink: '#2a2c32', sub: '#5f646d' },
  green:   { bg: '#2c3a2c', edge: '#49b06a', ink: '#e6efe6', sub: '#9fb89f' },
  strip:   { bg: '#1c1d22', edge: '#3a3d45', ink: '#cfd2d6', sub: '#8b8e98' },
  laptop:  { bg: '#d7dadd', edge: '#9a9da3', ink: '#2a2c32', sub: '#5f646d' },
  steel:   { bg: '#39424f', edge: '#5b6676', ink: '#e1e6ee', sub: '#a4adba' },
  scheda: { bg: '#8e2a22', edge: '#b8463b', ink: '#f6e9e6', sub: '#e6bcb5' }
};

let rearPanelId = null;   // dispositivo il cui pannello è aperto

function compLabel (id) {
  const c = gameState.placed[id];
  if (!c) return id;
  const n = id.indexOf('_') >= 0 ? ' ' + id.replace(/^.*_/, '') : '';
  return COMPONENT_TYPES[c.type].label + n;
}
function portLabel (compId, portId) {
  const c = gameState.placed[compId];
  const panel = c && REAR_PANELS[c.type];
  if (panel) {
    for (const [, ports] of panelSections(panel)) {
      const hit = ports.find(([pid]) => pid === portId);
      if (hit) return hit[1];
    }
  }
  return portId;
}
function edgesOnPort (compId, portId) {
  return gameState.edges.filter(e => (e.a === compId && e.aPort === portId) || (e.b === compId && e.bPort === portId));
}
function escapeHtml (s) { return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }

function rearDeco (kind, x, h, st) {
  switch (kind) {
    case 'fan': {
      const cx = x + 70, cy = h / 2;
      return `<circle cx="${cx}" cy="${cy}" r="58" fill="#17181c" stroke="#4a4d56" stroke-width="2"/>
        ${[18, 34, 50].map(r => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#4a4d56" stroke-width="2"/>`).join('')}
        <line x1="${cx - 58}" y1="${cy}" x2="${cx + 58}" y2="${cy}" stroke="#4a4d56" stroke-width="2"/>
        <line x1="${cx}" y1="${cy - 58}" x2="${cx}" y2="${cy + 58}" stroke="#4a4d56" stroke-width="2"/>
        <circle cx="${cx}" cy="${cy}" r="9" fill="#2e3037"/>`;
    }
    case 'vents':
      return Array.from({ length: 6 }, (_, i) => `<rect x="${x + 20 + i * 18}" y="${h / 2 - 70}" width="8" height="140" rx="4" fill="#0e0f12"/>`).join('');
    case 'fuse':
      return `<rect x="${x + 25}" y="${h / 2 - 22}" width="50" height="44" rx="6" fill="#0e0f12"/>
        <rect x="${x + 36}" y="${h / 2 - 5}" width="28" height="10" fill="#8a8e98"/>
        <text x="${x + 50}" y="${h / 2 + 42}" font-size="12" fill="${st.sub}" text-anchor="middle">FUSE T6.3A</text>`;
    case 'kensington':
      // retro della scheda audio: slot antifurto e piedini in gomma
      return `<rect x="${x + 40}" y="${h / 2 - 9}" width="22" height="14" rx="3" fill="#0e0f12"/>
        <text x="${x + 51}" y="${h / 2 + 24}" font-size="11" fill="${st.sub}" text-anchor="middle">K-SLOT</text>
        <rect x="${x + 16}" y="${h - 40}" width="26" height="8" rx="4" fill="#1c1d22"/>
        <rect x="${x + 70}" y="${h - 40}" width="26" height="8" rx="4" fill="#1c1d22"/>`;
    case 'lift':
      return `<rect x="${x + 35}" y="${h / 2 - 30}" width="30" height="60" rx="6" fill="#0e0f12"/>
        <rect x="${x + 42}" y="${h / 2 - 24}" width="16" height="24" rx="3" fill="#c9ccd1"/>
        <text x="${x + 50}" y="${h / 2 + 48}" font-size="12" fill="${st.sub}" text-anchor="middle">GND LIFT</text>`;
    default: return '';
  }
}

// spina volante (sul cavo della ciabatta), vista di fronte: corpo tondo con
// l'impugnatura zigrinata e i contatti maschi
function svgPlug (signal) {
  const ribs = n => Array.from({ length: n }, (_, i) => {
    const a = i / n * Math.PI * 2;
    return `<line x1="${CONN_CX + Math.cos(a) * 34}" y1="${CONN_CY + Math.sin(a) * 34}" x2="${CONN_CX + Math.cos(a) * 40}" y2="${CONN_CY + Math.sin(a) * 40}" stroke="#000" stroke-opacity=".35" stroke-width="2"/>`;
  }).join('');
  if (signal === 'usbc') {
    // spina USB-C: guscio nero sovrastampato e la linguetta metallica
    return `<rect x="${CONN_CX - 30}" y="${CONN_CY - 20}" width="60" height="40" rx="12" fill="#1c1d22" stroke="#3a3d45" stroke-width="2"/>
      <rect x="${CONN_CX - 20}" y="${CONN_CY - 7}" width="40" height="14" rx="7" fill="#c9ccd1" stroke="#7d828c"/>
      <rect x="${CONN_CX - 15}" y="${CONN_CY - 3}" width="30" height="6" rx="3" fill="#0e0f12"/>
      <text x="${CONN_CX}" y="${CONN_CY + 34}" font-size="7" font-weight="700" fill="#8b8e98" text-anchor="middle" font-family="Inter,sans-serif">USB-C</text>`;
  }
  if (signal === 'cee_mono') {
    return `<circle cx="${CONN_CX}" cy="${CONN_CY}" r="42" fill="#2f6fd6" stroke="#1d4a9a" stroke-width="2"/>${ribs(28)}
      <circle cx="${CONN_CX}" cy="${CONN_CY}" r="31" fill="#1d4a9a"/>
      <circle cx="${CONN_CX}" cy="${CONN_CY}" r="27" fill="#0e0f12"/>
      <rect x="${CONN_CX - 4}" y="${CONN_CY - 32}" width="8" height="7" fill="#1d4a9a"/>
      ${svgPin(CONN_CX - 15, CONN_CY - 5, 4)}${svgPin(CONN_CX + 15, CONN_CY - 5, 4)}${svgPin(CONN_CX, CONN_CY + 15, 5.4)}
      <text x="${CONN_CX}" y="${CONN_CY + 52}" font-size="7" font-weight="700" fill="#9cc0ff" text-anchor="middle" font-family="Inter,sans-serif">230V 16A</text>`;
  }
  // spina Schuko: corpo nero, due spinotti e le scanalature laterali di terra
  return `<circle cx="${CONN_CX}" cy="${CONN_CY}" r="40" fill="#1c1d22" stroke="#3a3d45" stroke-width="2"/>${ribs(24)}
    <circle cx="${CONN_CX}" cy="${CONN_CY}" r="30" fill="#26282e"/>
    <rect x="${CONN_CX - 33}" y="${CONN_CY - 7}" width="8" height="14" rx="2" fill="#c9ccd1"/>
    <rect x="${CONN_CX + 25}" y="${CONN_CY - 7}" width="8" height="14" rx="2" fill="#c9ccd1"/>
    ${svgPin(CONN_CX - 13, CONN_CY, 4.8)}${svgPin(CONN_CX + 13, CONN_CY, 4.8)}`;
}

/* connettore del CAVO inserito nella presa, visto da dietro: corpo della
   spina (zigrinato, del colore reale), pressacavo con l'anello colorato del
   tipo di cavo e il cavo che esce. Si sovrappone alla faccia della presa. */
function svgMated (signal, dir, cableColor) {
  const cx = CONN_CX, cy = CONN_CY;
  const ribs = (r0, r1, n, op) => Array.from({ length: n }, (_, i) => {
    const a = i / n * Math.PI * 2;
    return `<line x1="${cx + Math.cos(a) * r0}" y1="${cy + Math.sin(a) * r0}" x2="${cx + Math.cos(a) * r1}" y2="${cy + Math.sin(a) * r1}" stroke="#000" stroke-opacity="${op || 0.3}" stroke-width="2"/>`;
  }).join('');
  const boot = r => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#1c1d22" stroke="#0c0d10"/>
    <circle cx="${cx}" cy="${cy}" r="${r - 4}" fill="none" stroke="${cableColor}" stroke-width="3.5"/>
    <circle cx="${cx}" cy="${cy}" r="${r - 8}" fill="#0c0d10"/>
    <circle cx="${cx - 2}" cy="${cy - 2}" r="${Math.max(2, r - 13)}" fill="#26282e"/>`;
  const shadow = r => `<circle cx="${cx + 3}" cy="${cy + 4}" r="${r}" fill="#000" fill-opacity=".35"/>`;
  switch (signal) {
    case 'xlr':
    case 'dmx':
      // spina XLR Neutrik: guscio metallico con le scanalature, pressacavo nero
      return shadow(27) + `<circle cx="${cx}" cy="${cy}" r="27" fill="#c3c7ce" stroke="#7d828c" stroke-width="1.5"/>
        ${ribs(21, 27, 18, 0.25)}<circle cx="${cx}" cy="${cy}" r="21" fill="#9aa0aa"/>` + boot(17);
    case 'speakon':
      // Speakon NL4FX: corpo nero con la ghiera di bloccaggio zigrinata
      return shadow(30) + `<circle cx="${cx}" cy="${cy}" r="30" fill="#1c1d22" stroke="#3a3d45" stroke-width="1.5"/>
        ${ribs(24, 30, 26, 0.6)}<circle cx="${cx}" cy="${cy}" r="24" fill="#2a2c32"/>` + boot(17);
    case 'powercon': {
      // PowerCON volante: blu verso un ingresso, grigio chiaro verso un'uscita
      const body = dir === 'in' ? '#2f6fd6' : '#cfd2d6', dark = dir === 'in' ? '#1d4a9a' : '#9aa0aa';
      return shadow(30) + `<circle cx="${cx}" cy="${cy}" r="30" fill="${body}" stroke="${dark}" stroke-width="1.5"/>
        ${ribs(24, 30, 22, 0.3)}<rect x="${cx + 24}" y="${cy - 7}" width="10" height="14" rx="3" fill="${dark}"/>` + boot(17);
    }
    case 'jack':
      return shadow(18) + `<circle cx="${cx}" cy="${cy}" r="18" fill="#c9ccd1" stroke="#7d828c" stroke-width="1.5"/>
        ${ribs(14, 18, 14, 0.3)}` + boot(14);
    case 'schuko':
      // spina Schuko infilata: corpo nero tondo con l'impugnatura
      return shadow(38) + `<circle cx="${cx}" cy="${cy}" r="38" fill="#1c1d22" stroke="#3a3d45" stroke-width="1.5"/>
        ${ribs(31, 38, 28, 0.6)}<circle cx="${cx}" cy="${cy}" r="31" fill="#23252b"/>` + boot(16);
    case 'cee_mono':
    case 'cee_tri': {
      // spina CEE volante: corpo blu (230V) o rosso (400V) con la ghiera
      const body = signal === 'cee_tri' ? '#d6392f' : '#2f6fd6', dark = signal === 'cee_tri' ? '#9e2820' : '#1d4a9a';
      return shadow(40) + `<circle cx="${cx}" cy="${cy + 4}" r="40" fill="${body}" stroke="${dark}" stroke-width="2"/>
        <circle cx="${cx}" cy="${cy + 4}" r="31" fill="${dark}"/>
        ${ribs(31, 40, 30, 0.3)}` + boot(18);
    }
    case 'usbc':
      // spina USB-C: guscio sovrastampato nero, con il cavo che esce al centro
      return `<rect x="${cx - 27}" y="${cy - 11}" width="60" height="30" rx="10" fill="#000" fill-opacity=".35"/>
        <rect x="${cx - 30}" y="${cy - 14}" width="60" height="28" rx="10" fill="#1c1d22" stroke="#3a3d45" stroke-width="1.5"/>
        <rect x="${cx - 24}" y="${cy - 9}" width="48" height="18" rx="7" fill="#26282e"/>
        <circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="${cableColor}" stroke-width="3"/>
        <circle cx="${cx}" cy="${cy}" r="5" fill="#0c0d10"/>`;
    default:
      return shadow(24) + `<circle cx="${cx}" cy="${cy}" r="24" fill="#26282e"/>` + boot(16);
  }
}

/* una presa del pannello: scritta, tipo e genere sopra, il connettore reale,
   il badge IN/OUT, la spina inserita se occupata e la targhetta di stato.
   y0 = bordo superiore dello spazio della presa (alto REAR_FRAME_H). */
const REAR_SLOT = 150, REAR_PADX = 18, REAR_FRAME_H = 234;
function rearSlot (ctx, cx, y0, pid, label) {
  const { id, def, st, pending, loads, planned, bottom, plugOnly, tilt } = ctx;
  const fs = ctx.fs || 1;
  const p = def.ports.find(q => q.id === pid);
  if (!p) return '';
  const yb = y0 + REAR_FRAME_H;
  const cTop = y0 + 56;                                  // riquadro 120×120 del connettore
  const gender = (CONNECTOR_GENDER[p.signal] || {})[p.dir] === 'male' ? 'maschio' : 'femmina';
  const busy = edgesOnPort(id, pid);
  const inHand = pending && pending.componentId === id && pending.portId === pid;
  const sigColor = '#' + SIGNAL_COLOR[p.signal].toString(16).padStart(6, '0');
  const phaseLoad = loads && p.phase;
  // spina volante già infilata: al suo posto si disegna la presa con la spina
  // dentro (più sotto), non la faccia della spina libera
  const face = p.lead ? (busy.length ? '' : svgPlug(p.signal)) : connectorSVG(p.signal, p.dir);
  const rot = tilt && p.dir === 'out' ? ` rotate(45 ${CONN_CX} ${CONN_CY})` : '';
  let svg = `<g class="rp-port" data-port="${pid}" style="cursor:pointer">
    <rect x="${cx - REAR_SLOT / 2 + 4}" y="${y0 + 14}" width="${REAR_SLOT - 8}" height="${REAR_FRAME_H - 28}" fill="transparent"/>
    <text x="${cx}" y="${y0 + 32}" font-size="${16 * fs}" font-weight="700" fill="${st.ink}" text-anchor="middle">${escapeHtml(label)}</text>
    <text x="${cx}" y="${y0 + 50 + 3 * (fs - 1) * 4}" font-size="${Math.min(11.5 * fs, 13.5)}" fill="${st.sub}" text-anchor="middle">${escapeHtml(SIGNAL_LABEL[p.signal] || p.signal)} · ${gender}</text>
    <g transform="translate(${cx - 60} ${cTop})${rot}">${face}</g>`;
  if (busy.length) {
    // connettore collegato: si vede il connettore del cavo infilato nella
    // presa, col cavo in neoprene che scende (filetto del tipo di cavo). Sulle
    // prese del Quadro sotto c'è la barra del carico, e dove le file sono
    // impilate il cavo coprirebbe quella sotto: lì solo un tratto corto.
    // Per una spina volante (ciabatte, PC) si vede la spina infilata nella
    // presa dell'altro dispositivo.
    const cable = '#' + CABLE_TYPES[busy[0].signal].color.toString(16).padStart(6, '0');
    const yc = cTop + CONN_CY;
    const yEnd = (phaseLoad || plugOnly) ? yc + 58 : bottom;
    if (p.lead) svg += `<g transform="translate(${cx - 60} ${cTop})">${connectorSVG(p.signal, 'out')}</g>`;
    svg += `<line x1="${cx}" y1="${yc}" x2="${cx}" y2="${yEnd}" stroke="#17181b" stroke-width="12" stroke-linecap="round"/>
      <line x1="${cx}" y1="${yc}" x2="${cx}" y2="${yEnd}" stroke="${cable}" stroke-width="3"/>
      <g transform="translate(${cx - 60} ${cTop})">${svgMated(p.signal, p.lead ? 'out' : p.dir, cable)}</g>`;
  }
  svg += `<g transform="translate(${cx + 46} ${cTop + 14})">
      <rect x="-15" y="-9" width="30" height="18" rx="4" fill="${p.dir === 'in' ? '#1f5a33' : '#6b4413'}"/>
      <text x="0" y="4.5" font-size="11" font-weight="700" fill="${p.dir === 'in' ? '#7fe0a0' : '#ffc27a'}" text-anchor="middle">${p.dir === 'in' ? 'IN' : 'OUT'}</text></g>`;
  if (inHand) svg += `<circle cx="${cx}" cy="${cTop + CONN_CY}" r="${p.lead ? 50 : 46}" fill="none" stroke="#f2a541" stroke-width="4" stroke-dasharray="8 5"/>`;
  let status;
  if (inHand) status = p.lead ? 'spina in mano' : 'cavo in mano da qui';
  else if (busy.length === 1) {
    const e = busy[0];
    const otherId = e.a === id ? e.b : e.a, otherPort = e.a === id ? e.bPort : e.aPort;
    status = '→ ' + compLabel(otherId) + ' · ' + portLabel(otherId, otherPort);
  } else if (busy.length > 1) status = busy.length + ' cavi collegati';
  else status = p.lead ? 'prendi la spina' : 'libera';
  const maxLen = fs > 1 ? 17 : 23;                                // deve stare nella targhetta
  if (status.length > maxLen) status = status.slice(0, maxLen - 1) + '…';
  svg += `<rect x="${cx - REAR_SLOT / 2 + 6}" y="${yb - 24}" width="${REAR_SLOT - 12}" height="22" rx="11"
      fill="${busy.length ? '#1c1d22' : 'transparent'}" stroke="${busy.length ? sigColor : 'none'}"/>
    <text x="${cx}" y="${yb - 8}" font-size="${11.5 * Math.min(fs, 1.25)}" fill="${busy.length ? '#eee9df' : st.sub}" text-anchor="middle">${escapeHtml(status)}</text>`;
  if (phaseLoad) {
    // carico della fase, subito sotto la presa
    const frac = Math.min(1, loads[p.phase] / PHASE_BUDGET_W);
    const col = frac >= 1 ? '#e0503f' : (frac >= 0.75 ? '#f2a541' : '#49b06a');
    svg += `<rect x="${cx - 50}" y="${cTop + 130}" width="100" height="7" rx="3" fill="#00000033"/>
      <rect x="${cx - 50}" y="${cTop + 130}" width="${100 * frac}" height="7" rx="3" fill="${col}"/>
      <text x="${cx}" y="${cTop + 150}" font-size="10.5" font-weight="600" fill="${st.sub}" text-anchor="middle">${fmtKW(loads[p.phase], 2)} kW (a regime ${fmtKW(planned[p.phase], 2)})</text>`;
  }
  return svg + `</g>`;
}

// sezione serigrafata: riquadro con il titolo e le sue prese in fila
function rearSection (ctx, x, y0, title, ports) {
  const { st } = ctx;
  const fs = ctx.fs || 1;
  const w = ports.length * REAR_SLOT + REAR_PADX * 2;
  let svg = `<rect x="${x}" y="${y0}" width="${w}" height="${REAR_FRAME_H}" rx="4" fill="none" stroke="${st.ink}" stroke-opacity=".45" stroke-width="1.5"/>
    <rect x="${x + 12}" y="${y0 - 10}" width="${Math.min(w - 24, title.length * 10 * fs + 18)}" height="22" fill="${st.bg}"/>
    <text x="${x + 21}" y="${y0 + 6}" font-size="${15 * Math.min(fs, 1.2)}" font-weight="700" fill="${st.ink}">${escapeHtml(title)}</text>`;
  ports.forEach(([pid, label], pi) => {
    svg += rearSlot(ctx, x + REAR_PADX + pi * REAR_SLOT + REAR_SLOT / 2, y0, pid, label);
  });
  return { svg, w };
}
const sectionWidth = ports => ports.length * REAR_SLOT + REAR_PADX * 2;

/* interruttore di accensione del dispositivo (bilanciere I/O illuminato) */
function rearPowerSwitch (comp, x, yMid, st) {
  const on = !!comp.on, powered = isPowered(comp.id);
  const status = on ? (powered ? 'ACCESO' : 'ACCESO · senza corrente') : 'SPENTO';
  const col = on ? (powered ? '#7fe0a0' : '#ffc27a') : st.sub;
  return `<g class="rp-switch" style="cursor:pointer">
    <rect x="${x}" y="${yMid - 100}" width="130" height="200" fill="transparent"/>
    <text x="${x + 65}" y="${yMid - 78}" font-size="15" font-weight="700" fill="${st.ink}" text-anchor="middle">POWER</text>
    <rect x="${x + 33}" y="${yMid - 58}" width="64" height="104" rx="8" fill="#0e0f12" stroke="#55585f"/>
    <rect x="${x + 40}" y="${yMid - 51}" width="50" height="90" rx="5" fill="${on && powered ? '#e0503f' : '#6b1d17'}"/>
    <rect x="${x + 40}" y="${on ? yMid - 51 : yMid - 6}" width="50" height="45" rx="5" fill="#000" fill-opacity=".28"/>
    ${on && powered ? `<rect x="${x + 36}" y="${yMid - 55}" width="58" height="98" rx="7" fill="none" stroke="#ff7a6a" stroke-opacity=".6" stroke-width="3"/>` : ''}
    <text x="${x + 65}" y="${yMid - 22}" font-size="18" font-weight="700" fill="#fff" fill-opacity=".85" text-anchor="middle">I</text>
    <text x="${x + 65}" y="${yMid + 24}" font-size="16" font-weight="700" fill="#fff" fill-opacity=".85" text-anchor="middle">O</text>
    <text x="${x + 65}" y="${yMid + 70}" font-size="12" font-weight="700" fill="${col}" text-anchor="middle">${status}</text>
  </g>`;
}

/* protezioni del Quadro su guida DIN: generale, salvavita (con tasto di
   prova T) e un magnetotermico per fase. Leva su = armato. */
const PROT_MODULES = [
  ['main', 'GENERALE', '4P 40A', 120],
  ['rcd', 'SALVAVITA', 'Idn 30 mA', 120],
  ['L1', 'L1', 'C16', 80],
  ['L2', 'L2', 'C16', 80],
  ['L3', 'L3', 'C16', 80]
];
const PROT_GAP = 14;
const PROT_W = REAR_PADX * 2 + PROT_MODULES.reduce((s, m) => s + m[3], 0) + PROT_GAP * (PROT_MODULES.length - 1);
function rearProtections (ctx, comp, x, y0) {
  const { st } = ctx;
  const prot = quadroProt(comp);
  let svg = `<rect x="${x}" y="${y0}" width="${PROT_W}" height="${REAR_FRAME_H}" rx="4" fill="none" stroke="${st.ink}" stroke-opacity=".45" stroke-width="1.5"/>
    <rect x="${x + 12}" y="${y0 - 10}" width="128" height="22" fill="${st.bg}"/>
    <text x="${x + 21}" y="${y0 + 6}" font-size="15" font-weight="700" fill="${st.ink}">PROTEZIONI</text>
    <rect x="${x + 10}" y="${y0 + 112}" width="${PROT_W - 20}" height="12" fill="#b9bcc1"/>`;   // guida DIN
  let mx = x + REAR_PADX;
  PROT_MODULES.forEach(([key, label, spec, w]) => {
    const on = !!prot[key], tripped = !!prot.tripped[key];
    const lever = key === 'rcd' ? '#2f6fd6' : '#1c1d22';
    const cx = mx + w / 2;
    svg += `<g class="rp-brk" data-brk="${key}" style="cursor:pointer">
      <text x="${cx}" y="${y0 + 32}" font-size="14" font-weight="700" fill="${st.ink}" text-anchor="middle">${label}</text>
      <rect x="${mx}" y="${y0 + 44}" width="${w}" height="150" rx="4" fill="#f7f7f8" stroke="#9a9da3" stroke-width="1.5"/>
      ${[y0 + 54, y0 + 184].map(yy => [0.3, 0.7].map(f => `<circle cx="${mx + w * f}" cy="${yy}" r="4" fill="#c9ccd1" stroke="#7d828c"/>`).join('')).join('')}
      <rect x="${cx - 16}" y="${y0 + 78}" width="32" height="76" rx="3" fill="#2a2c32"/>
      <rect x="${cx - 12}" y="${on ? y0 + 82 : y0 + 116}" width="24" height="34" rx="3" fill="${lever}" stroke="#55585f"/>
      <text x="${cx}" y="${y0 + 72}" font-size="9" font-weight="700" fill="#2a2c32" text-anchor="middle">I ON</text>
      <text x="${cx}" y="${y0 + 166}" font-size="9" font-weight="700" fill="#2a2c32" text-anchor="middle">O OFF</text>
      <text x="${cx}" y="${y0 + 178}" font-size="9.5" fill="#5f646d" text-anchor="middle">${spec}</text>`;
    const status = on ? 'ARMATO' : (tripped ? 'SCATTATO' : 'ABBASSATO');
    const sc = on ? '#1f7a40' : (tripped ? '#e0503f' : st.sub);
    svg += `<rect x="${cx - w / 2 + 2}" y="${y0 + 202}" width="${w - 4}" height="22" rx="11" fill="${tripped && !on ? '#e0503f22' : 'transparent'}" stroke="${tripped && !on ? '#e0503f' : 'none'}"/>
      <text x="${cx}" y="${y0 + 217}" font-size="11" font-weight="700" fill="${sc}" text-anchor="middle">${status}</text></g>`;
    if (key === 'rcd') {
      svg += `<g class="rp-brk" data-brk="rcd_test" style="cursor:pointer">
        <circle cx="${mx + w - 18}" cy="${y0 + 100}" r="10" fill="#f2c53d" stroke="#8a5f1f"/>
        <text x="${mx + w - 18}" y="${y0 + 104}" font-size="11" font-weight="700" fill="#2a2c32" text-anchor="middle">T</text></g>`;
    }
    mx += w + PROT_GAP;
  });
  return svg;
}

function testRcd () {
  const q = findQuadro();
  if (!q) return;
  const prot = quadroProt(q);
  if (!prot.rcd) { showToast('Il salvavita è già abbassato: armalo prima di provarlo.'); return; }
  applyPowerAction(() => { prot.rcd = false; prot.tripped.rcd = true; });
  SFX.rcd();
  saveHistory();
  showToast('Prova del salvavita: è scattato come deve. Riarmalo per ridare corrente.', 'ok');
}

/* retro TONDO del faro PAR: disco con la forcella ai lati, display con i
   tasti MENU / UP / DOWN / ENTER per indirizzo e modalità DMX, e le prese in
   due file serigrafate direttamente sul disco (niente riquadri) */
function renderRoundPanel (ctx, comp, panel) {
  const { st } = ctx;
  const D = 760, R = D / 2, ARM = 70;
  const W = D + ARM * 2, H = D + 20;
  const cx = W / 2, cy = R + 10;
  const dmx = parDmx(comp);
  const mode = PAR_MODES[dmx.mode];
  const chCount = parseInt(mode.id, 10);
  // display acceso solo se il faro è alimentato
  const powered = isPowered(comp.id);
  const shown = !powered ? '' : (parMenuField === 'addr' ? 'A' + String(dmx.addr).padStart(3, '0') : mode.id);
  // sul telefono si inquadra solo il centro del disco (display e prese):
  // il bordo tondo resta visibile sopra e sotto
  const vb = ctx.compact ? `${cx - 210} 44 420 ${H - 64}` : `0 0 ${W} ${H}`;
  let svg = `<svg class="rear-svg round${ctx.compact ? ' compact' : ''}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" font-family="Inter,sans-serif">
    ${[6, W - 50].map(x => `<rect x="${x}" y="${cy - 40}" width="44" height="${R + 60}" rx="8" fill="#6a6e78" stroke="#4a4d56" stroke-width="2"/>
      <circle cx="${x + 22}" cy="${cy}" r="26" fill="#2a2c32" stroke="#8a8e98" stroke-width="3"/>
      ${[0, 60, 120, 180, 240, 300].map(d => { const a = d * Math.PI / 180; return `<circle cx="${x + 22 + Math.cos(a) * 17}" cy="${cy + Math.sin(a) * 17}" r="4" fill="#8a8e98"/>`; }).join('')}`).join('')}
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="${st.bg}" stroke="${st.edge}" stroke-width="3"/>
    <circle cx="${cx}" cy="${cy}" r="${R - 14}" fill="none" stroke="#0e0f12" stroke-width="10" stroke-dasharray="3 9"/>
    <circle cx="${cx}" cy="${cy}" r="${R - 30}" fill="none" stroke="${st.edge}" stroke-width="1.5"/>
    <rect x="${cx - 150}" y="${cy - R + 52}" width="120" height="48" rx="6" fill="#0e0f12" stroke="#3a3d45"/>
    <text x="${cx - 90}" y="${cy - R + 86}" font-size="28" font-weight="700" fill="#e0503f" text-anchor="middle" font-family="monospace">${shown}</text>
    ${[['menu', 'MENU'], ['up', '▲'], ['down', '▼'], ['enter', 'ENTER']].map(([act, l], i) => `
      <g class="rp-btn" data-act="${act}" style="cursor:pointer">
        <rect x="${cx - 18 + i * 44}" y="${cy - R + 60}" width="40" height="32" rx="6" fill="#3a3d45" stroke="#55585f"/>
        <text x="${cx + 2 + i * 44}" y="${cy - R + 81}" font-size="${act === 'up' || act === 'down' ? 14 : 9.5}" font-weight="700" fill="#cfd2d6" text-anchor="middle">${l}</text></g>`).join('')}
    ${!powered ? `<text x="${cx}" y="${cy - R + 124}" font-size="13" fill="#ffc27a" text-anchor="middle">Display spento: il faro non riceve corrente</text>` : ''}
    <text x="${cx}" y="${cy - R + 124}" font-size="13" fill="#cfd2d6" text-anchor="middle" opacity="${powered ? 1 : 0}">Indirizzo <tspan font-weight="700" fill="${parMenuField === 'addr' ? '#f2a541' : '#eee9df'}">${String(dmx.addr).padStart(3, '0')}</tspan> · Modalità <tspan font-weight="700" fill="${parMenuField === 'mode' ? '#f2a541' : '#eee9df'}">${escapeHtml(mode.name)}</tspan></text>
    <text x="${cx}" y="${cy - R + 142}" font-size="11.5" fill="${st.sub}" text-anchor="middle" opacity="${powered ? 1 : 0}">occupa i canali ${dmx.addr}–${dmx.addr + chCount - 1} · MENU cambia voce, ▲▼ regolano</text>`;
  let y0 = cy - R + 176;
  panel.sections.forEach(([title, ports]) => {
    const w = sectionWidth(ports);
    const x = cx - w / 2;
    // titolo serigrafato con due filetti ai lati, direttamente sul disco
    svg += `<line x1="${x + 20}" y1="${y0}" x2="${cx - 50}" y2="${y0}" stroke="${st.ink}" stroke-opacity=".4"/>
      <line x1="${cx + 50}" y1="${y0}" x2="${x + w - 20}" y2="${y0}" stroke="${st.ink}" stroke-opacity=".4"/>
      <text x="${cx}" y="${y0 + 5}" font-size="14" font-weight="700" fill="${st.ink}" text-anchor="middle">${escapeHtml(title)}</text>`;
    ports.forEach(([pid, label], pi) => { svg += rearSlot(ctx, x + REAR_PADX + pi * REAR_SLOT + REAR_SLOT / 2, y0 - 4, pid, label); });
    y0 += REAR_FRAME_H + 18;
  });
  svg += `<text x="${cx}" y="${cy + R - 40}" font-size="12" fill="${st.sub}" text-anchor="middle" letter-spacing="1">${escapeHtml(panel.serial)}</text>`;
  return svg + `</svg>`;
}

/* ciabatta vista dall'alto: a sinistra la spina sul suo cavo (si prende da
   qui per collegare la ciabatta, il cavo fa già parte della ciabatta), a
   destra la barra nera con interruttore e prese Schuko inclinate a 45° */
function renderStripPanel (ctx, comp, def, panel) {
  const { st } = ctx;
  const outs = panelSections(panel).find(([t]) => t === 'PRESE')[1];
  // sul telefono: spina sopra a sinistra, barra con interruttore e prese sotto
  const compact = ctx.compact;
  const plugX = 125, barX = compact ? 14 : 260;
  const y1 = compact ? 250 : 0;                    // di quanto scende la barra
  const H = 330 + y1;
  const W = compact ? Math.max(outs.length * REAR_SLOT + 150, 560) : barX + 120 + outs.length * REAR_SLOT + 30;
  const accent = '#' + def.body.accent.toString(16).padStart(6, '0');
  const y0 = 48;
  const yb = y0 + y1;
  // cavo della spina: di lato verso la barra, oppure giù verso la barra sotto
  const cablePath = compact
    ? `M ${plugX} ${y0 + 176} C ${plugX} ${y0 + 236}, ${barX + 20} ${yb + 60}, ${barX + 60} ${yb + 60}`
    : `M ${plugX + 44} ${y0 + 118} C ${plugX + 90} ${y0 + 118}, ${barX - 60} ${y0 + 150}, ${barX + 6} ${y0 + 150}`;
  let svg = `<svg class="rear-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Inter,sans-serif">
    ${[['#0c0d10', 16], ['#26282e', 10]].map(([c, w]) => `<path d="${cablePath}" fill="none" stroke="${c}" stroke-width="${w}"/>`).join('')}
    <rect x="${barX}" y="${yb + 52}" width="${W - barX - 14}" height="148" rx="26" fill="${st.bg}" stroke="${st.edge}" stroke-width="2"/>
    <rect x="${barX + 16}" y="${yb + 186}" width="${W - barX - 46}" height="6" rx="3" fill="${accent}"/>
    <g class="rp-switch" style="cursor:pointer">
      <rect x="${barX + 24}" y="${yb + 84}" width="74" height="100" fill="transparent"/>
      <rect x="${barX + 30}" y="${yb + 94}" width="62" height="64" rx="8" fill="#0e0f12"/>
      <rect x="${barX + 38}" y="${yb + 102}" width="46" height="48" rx="5" fill="${comp.on && isPowered(comp.id) ? '#ff5a4a' : '#7a2019'}"/>
      <rect x="${barX + 38}" y="${comp.on ? yb + 102 : yb + 128}" width="46" height="22" rx="5" fill="#000" fill-opacity=".3"/>
      <text x="${barX + 61}" y="${yb + 176}" font-size="11" font-weight="700" fill="${comp.on ? (isPowered(comp.id) ? '#7fe0a0' : '#ffc27a') : st.sub}" text-anchor="middle">${comp.on ? (isPowered(comp.id) ? 'ACCESA' : 'ACCESA · no corrente') : 'I / O · SPENTA'}</text>
    </g>`;
  svg += rearSlot(ctx, plugX, y0, 'in', 'SPINA');
  outs.forEach(([pid, label], i) => {
    svg += rearSlot({ ...ctx, tilt: true }, barX + 120 + REAR_SLOT / 2 + i * REAR_SLOT, yb, pid, label);
  });
  svg += `<text x="${(barX + W) / 2}" y="${H - 22}" font-size="12" fill="${st.sub}" text-anchor="middle" letter-spacing="1">${escapeHtml(panel.serial)}</text>`;
  return svg + `</svg>`;
}

// sotto questa larghezza (px) del riquadro il pannello si impagina "stretto"
// (telefono): sezioni a capo entro REAR_COMPACT_W unità e scritte più grandi
const REAR_COMPACT_BELOW = 640, REAR_COMPACT_W = 700;
function renderRearPanel () {
  const id = rearPanelId;
  const comp = gameState.placed[id];
  if (!comp) { closeRearPanel(); return; }
  const def = COMPONENT_TYPES[comp.type];
  const panel = REAR_PANELS[comp.type];
  const st = REAR_STYLES[panel.style];
  const pending = gameState.pendingPort;
  const loads = comp.type === 'quadro' ? livePhaseLoads(false) : null;
  const planned = comp.type === 'quadro' ? computePhaseLoads() : null;
  // telefono: pannelli impaginati stretti, scritte più grandi
  const compact = el('#rear-svg').clientWidth < REAR_COMPACT_BELOW;
  const ctx = { id, def, st, pending, loads, planned, compact, fs: compact ? 1.35 : 1 };

  el('#rear-title').textContent = def.label + '  ·  ' + id.replace(/_/g, ' ') + '  —  pannello posteriore';

  let svg;
  if (panel.style === 'round') {
    svg = renderRoundPanel({ ...ctx, plugOnly: true }, comp, panel);
  } else if (panel.style === 'strip') {
    svg = renderStripPanel({ ...ctx, plugOnly: true }, comp, def, panel);
  } else {
    // una o più file di sezioni affiancate. Sul telefono (compact) le
    // sezioni vanno a capo quando non c'è più posto, l'interruttore POWER
    // diventa un blocco come le altre e le decorazioni laterali spariscono:
    // il pannello entra tutto nello schermo, senza scorrere
    const compact = ctx.compact;
    const GAP = compact ? 14 : 26, MARGIN = 36, ROW_H = REAR_FRAME_H + 34;
    const secW = ([title, ports]) => title === '__PROT__' ? PROT_W : sectionWidth(ports);
    let rows;
    if (compact) {
      const items = panelSections(panel).map(sec => ({ sec, w: secW(sec) }));
      if (panel.power) items.push({ power: true, w: 130 });
      rows = [[]];
      let cw = 0;
      items.forEach(it => {
        const row = rows[rows.length - 1];
        if (row.length && cw + GAP + it.w > REAR_COMPACT_W) { rows.push([it]); cw = it.w; }
        else { cw += (row.length ? GAP : 0) + it.w; row.push(it); }
      });
    } else {
      rows = (panel.rows || [panel.sections]).map(r => r.map(sec => ({ sec, w: secW(sec) })));
    }
    const leftW = !compact && panel.left ? 140 : 0;
    const rightW = compact ? 0 : (panel.right ? 140 : 0) + (panel.power ? 140 : 0);
    const rowW = rows.map(r => r.reduce((sum, it) => sum + it.w, 0) + GAP * (r.length - 1));
    const W = MARGIN * 2 + leftW + rightW + Math.max(...rowW);
    const H = 48 + rows.length * ROW_H + 48;
    const plugOnly = rows.length > 1;
    svg = `<svg class="rear-svg${rows.length > 1 ? ' tall' : ''}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Inter,sans-serif">`;
    // telaio del pannello con la forma e i colori del dispositivo
    if (panel.style === 'rack') {
      svg += `<rect x="30" y="8" width="${W - 60}" height="${H - 16}" fill="${st.bg}" stroke="${st.edge}" stroke-width="2"/>
        <rect x="30" y="8" width="${W - 60}" height="10" fill="#3a3d45"/><rect x="30" y="${H - 18}" width="${W - 60}" height="10" fill="#3a3d45"/>
        ${[2, W - 32].map(x => `<rect x="${x}" y="8" width="30" height="${H - 16}" fill="#4a4d56"/>
          <rect x="${x + 9}" y="40" width="12" height="28" rx="6" fill="#0e0f12"/><rect x="${x + 9}" y="${H - 68}" width="12" height="28" rx="6" fill="#0e0f12"/>`).join('')}`;
    } else if (panel.style === 'cabinet') {
      svg += `<rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="6" fill="${st.bg}" stroke="${st.edge}" stroke-width="2"/>
        <rect x="22" y="22" width="${W - 44}" height="${H - 44}" rx="8" fill="${st.plate}" stroke="#44474f" stroke-width="1.5"/>
        ${[[32, 32], [W - 32, 32], [32, H - 32], [W - 32, H - 32]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#55585f"/>`).join('')}`;
    } else if (panel.style === 'white') {
      svg += `<rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="10" fill="${st.bg}" stroke="${st.edge}" stroke-width="2"/>
        <rect x="4" y="4" width="${W - 8}" height="14" rx="6" fill="#f2c53d"/>
        ${Array.from({ length: Math.floor(W / 16) }, (_, i) => `<line x1="${8 + i * 16}" y1="18" x2="${18 + i * 16}" y2="4" stroke="#1c1d22" stroke-width="3"/>`).join('')}`;
    } else if (panel.style === 'laptop') {
      // fianco del laptop: lastra in alluminio con lo spigolo smussato
      svg += `<path d="M 14 30 L ${W - 14} 30 Q ${W - 4} 30 ${W - 4} 44 L ${W - 4} ${H - 30} Q ${W - 4} ${H - 12} ${W - 22} ${H - 12} L 22 ${H - 12} Q 4 ${H - 12} 4 ${H - 30} L 4 44 Q 4 30 14 30 Z"
          fill="${st.bg}" stroke="${st.edge}" stroke-width="2"/>
        <rect x="10" y="30" width="${W - 20}" height="6" rx="3" fill="#ffffff" fill-opacity=".35"/>`;
    } else if (panel.style === 'scheda') {
      // retro della scheda: guscio in alluminio anodizzato, bordi arrotondati
      svg += `<rect x="4" y="16" width="${W - 8}" height="${H - 32}" rx="22" fill="${st.bg}" stroke="${st.edge}" stroke-width="2"/>
        <rect x="16" y="24" width="${W - 32}" height="6" rx="3" fill="#ffffff" fill-opacity=".12"/>
        ${[[26, 40], [W - 26, 40], [26, H - 40], [W - 26, H - 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#5e1b16" stroke="#c4574b"/>`).join('')}`;
    } else if (panel.style === 'desk') {
      // retro di un banco (mixer, consolle): scocca scura col bordo del ponte
      svg += `<rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="12" fill="${st.bg}" stroke="${st.edge}" stroke-width="2"/>
        <rect x="4" y="4" width="${W - 8}" height="16" rx="8" fill="#4a4d56"/>
        ${panel.accent ? `<rect x="20" y="${H - 16}" width="${W - 40}" height="5" rx="2.5" fill="${'#' + def.body.accent.toString(16).padStart(6, '0')}"/>` : ''}`;
    } else {
      svg += `<rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="16" fill="${st.bg}" stroke="${st.edge}" stroke-width="2"/>`;
    }
    if (leftW) svg += rearDeco(panel.left, MARGIN, H, st);
    rows.forEach((row, ri) => {
      const y0 = 48 + ri * ROW_H;
      let x = MARGIN + leftW + (Math.max(...rowW) - rowW[ri]) / 2;
      row.forEach(it => {
        if (it.power) svg += rearPowerSwitch(comp, x, y0 + REAR_FRAME_H / 2, st);
        else {
          const [title, ports] = it.sec;
          svg += title === '__PROT__'
            ? rearProtections(ctx, comp, x, y0)
            : rearSection({ ...ctx, plugOnly, bottom: H - 8 }, x, y0, title, ports).svg;
        }
        x += it.w + GAP;
      });
    });
    if (!compact) {
      let rx = W - MARGIN - rightW + 10;
      if (panel.power) { svg += rearPowerSwitch(comp, rx, H / 2, st); rx += 140; }
      if (panel.right) svg += rearDeco(panel.right, rx, H, st);
    }
    if (panel.serial) svg += `<text x="${W / 2}" y="${H - 22}" font-size="12" fill="${st.sub}" text-anchor="middle" letter-spacing="1">${escapeHtml(panel.serial)}</text>`;
    svg += `</svg>`;
  }

  el('#rear-svg').innerHTML = svg;
  el('#rear-svg').querySelectorAll('.rp-port').forEach(node => {
    node.addEventListener('click', () => onRearPortClick(id, node.dataset.port));
  });
  el('#rear-svg').querySelectorAll('.rp-btn').forEach(node => {
    node.addEventListener('click', () => onParButton(comp, node.dataset.act));
  });
  el('#rear-svg').querySelectorAll('.rp-switch').forEach(node => {
    node.addEventListener('click', () => toggleDevicePower(id));
  });
  el('#rear-svg').querySelectorAll('.rp-brk').forEach(node => {
    node.addEventListener('click', () => node.dataset.brk === 'rcd_test' ? testRcd() : toggleProtection(node.dataset.brk));
  });
  renderRearHand();
}

// tasti del display del PAR: MENU passa da indirizzo a modalità, ▲▼ regolano
function onParButton (comp, act) {
  SFX.button();
  if (!isPowered(comp.id)) { showToast('Il PAR non è alimentato: il display è spento. Dagli corrente per impostarlo.'); return; }
  const dmx = parDmx(comp);
  if (act === 'menu') parMenuField = parMenuField === 'addr' ? 'mode' : 'addr';
  else if (act === 'up' || act === 'down') {
    const d = act === 'up' ? 1 : -1;
    if (parMenuField === 'addr') dmx.addr += d;
    else dmx.mode = (dmx.mode + d + PAR_MODES.length) % PAR_MODES.length;
    // come sui fari veri, i canali devono stare dentro i 512 dell'universo
    dmx.addr = Math.min(513 - parseInt(PAR_MODES[dmx.mode].id, 10), Math.max(1, dmx.addr));
  } else if (act === 'enter') {
    showToast(compLabel(comp.id) + ': indirizzo ' + String(dmx.addr).padStart(3, '0') + ', modalità ' + PAR_MODES[dmx.mode].id + '.', 'ok');
    if (window.__scene) window.__scene.pushHistory();
  }
  renderRearPanel();
}

// riga "cavo in mano" in testa al popup
function renderRearHand () {
  const box = el('#rear-hand');
  const pending = gameState.pendingPort;
  const cable = gameState.selectedCable;
  const pdef = pending && getPortDef(pending.componentId, pending.portId);
  if (pdef && pdef.lead) {
    box.innerHTML = `Spina <b>${escapeHtml(SIGNAL_LABEL[pdef.signal])}</b> di <b>${escapeHtml(compLabel(pending.componentId))}</b> in mano — scegli la presa dove infilarla.`;
  } else if (pending) {
    box.innerHTML = `Cavo <b>${escapeHtml(cableName(cable))}</b> in mano da <b>${escapeHtml(compLabel(pending.componentId))} · ${escapeHtml(portLabel(pending.componentId, pending.portId))}</b> — scegli la presa dove collegarlo.`;
  } else if (cable) {
    box.innerHTML = `Cavo selezionato: <b>${escapeHtml(cableName(cable))}</b> — scegli la presa da cui partire.`;
  } else {
    box.innerHTML = `Nessun cavo in mano: prendilo da un baule (scheda <b>Cavi</b>). Le spine di ciabatte, PC e scheda si prendono da qui.`;
  }
}

function cableName (cableId) {
  const it = cableItem(cableId);
  return it ? it.name : (SIGNAL_LABEL[cableId] || String(cableId || ''));
}

function showRearDetail (compId, portId) {
  const box = el('#rear-detail');
  const busy = edgesOnPort(compId, portId);
  if (!busy.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="rear-detail-head">${escapeHtml(portLabel(compId, portId))} — cavi collegati</div>` + busy.map(e => {
    const otherId = e.a === compId ? e.b : e.a, otherPort = e.a === compId ? e.bPort : e.aPort;
    return `<div class="rear-detail-row"><span>${escapeHtml(cableName(e.signal))} → ${escapeHtml(compLabel(otherId))} · ${escapeHtml(portLabel(otherId, otherPort))}</span>
      <button class="rear-unplug" data-edge="${e.id}">Scollega</button></div>`;
  }).join('');
  box.querySelectorAll('.rear-unplug').forEach(b => b.addEventListener('click', () => {
    const scene = window.__scene;
    if (!scene) return;
    scene.selectedEdgeId = Number(b.dataset.edge);
    scene.deleteSelectedEdge();
    box.innerHTML = '';
    renderRearPanel();
  }));
}

// seleziona un cavo come farebbe il suo pulsante nella scheda Cavi
function selectCable (cableId) {
  gameState.selectedCable = cableId;
  updateCableHand();
}

function onRearPortClick (compId, portId) {
  const scene = window.__scene;
  if (!scene) return;
  const p = getPortDef(compId, portId);
  const busy = edgesOnPort(compId, portId);
  const pending = gameState.pendingPort;
  const isPendingPort = pending && pending.componentId === compId && pending.portId === portId;

  // spine già attaccate (ciabatte, PC, scheda): il cavo è il loro. Con un
  // adattatore in mano (es. CEE / Schuko) la spina si infila nella sua presa
  // e l'adattatore va nella presa di tipo diverso, come dal vero.
  const held = gameState.selectedCable && CABLE_TYPES[gameState.selectedCable];
  const isAdapter = c => !!c && c.endpoints.length === 2;
  const pendDef0 = pending && getPortDef(pending.componentId, pending.portId);
  if (p.lead && !busy.length && !isPendingPort) {
    if (pending) {
      const bridges = isAdapter(held) && !!pendDef0 && pendDef0.signal !== p.signal &&
        held.endpoints.includes(p.signal) && held.endpoints.includes(pendDef0.signal);
      if (!bridges) {
        if (!pendDef0 || pendDef0.signal !== p.signal || pendDef0.dir === p.dir) {
          showToast('La spina ' + SIGNAL_LABEL[p.signal] + ' va infilata in una presa ' + SIGNAL_LABEL[p.signal] + ' libera.');
          return;
        }
        selectCable(p.signal);
      }
    } else if (!(isAdapter(held) && held.endpoints.includes(p.signal))) {
      selectCable(p.signal);
    }
  }
  // spina in mano: nella presa del suo tipo col suo cavo, in una di tipo
  // diverso solo con l'adattatore giusto
  const pendLead = pendDef0;
  if (pendLead && pendLead.lead && !isPendingPort && (!busy.length || p.multi)) {
    if (p.signal === pendLead.signal) {
      if (gameState.selectedCable !== pendLead.signal) selectCable(pendLead.signal);
    } else if (!(isAdapter(held) && held.endpoints.includes(p.signal) && held.endpoints.includes(pendLead.signal))) {
      const adapter = Object.keys(CABLE_TYPES).find(k => isAdapter(CABLE_TYPES[k]) && CABLE_TYPES[k].endpoints.includes(p.signal) && CABLE_TYPES[k].endpoints.includes(pendLead.signal));
      showToast('La spina ' + SIGNAL_LABEL[pendLead.signal] + ' di ' + compLabel(pending.componentId) + ' va in una presa ' + SIGNAL_LABEL[pendLead.signal] + '.' +
        (adapter ? ' Qui serve l\'adattatore ' + cableName(adapter) + ': prendilo dal baule e riprova.' : ''));
      return;
    }
  }

  // presa occupata (e non è una presa multipla del Quadro con un cavo in
  // mano): si mostrano i cavi collegati, con la possibilità di scollegarli
  if (busy.length && !isPendingPort && !(p.multi && gameState.selectedCable)) {
    showRearDetail(compId, portId);
    return;
  }
  el('#rear-detail').innerHTML = '';
  const edgesBefore = gameState.edges.length;
  const rcdBefore = gameState.rcdTrips || 0;
  scene.handlePortClick(compId, portId, p.signal);
  const arced = (gameState.rcdTrips || 0) > rcdBefore;   // il salvavita ha già il suo messaggio
  const connected = gameState.edges.length > edgesBefore;
  const picked = !pending && gameState.pendingPort;
  if (connected || picked) {
    // cavo collegato, o primo capo scelto: si torna alla scena
    closeRearPanel();
    if (picked && p.lead) showToast('Spina in mano: tocca il dispositivo con la presa ' + SIGNAL_LABEL[p.signal] + ' dove infilarla.', 'ok');
    else if (picked) showToast('Cavo in mano: ora tocca il dispositivo da collegare.', 'ok');
    else if (!arced) showToast('Collegato: ' + compLabel(compId) + ' · ' + portLabel(compId, portId) + '.', 'ok');
    return;
  }
  renderRearPanel();
}

// mentre il popup è aperto la scena non deve ricevere i tocchi: Phaser
// ascolta il puntatore anche fuori dal canvas, e un tocco sul popup verrebbe
// letto come un tocco sul pavimento (che annulla il cavo in mano)
function setSceneInput (on) {
  const scene = window.__scene;
  if (scene && scene.input) scene.input.enabled = on;
}
function openRearPanel (compId) {
  const t = (gameState.placed[compId] || {}).type;
  if (t === 'stativo') {
    const par = mountedOn(gameState.placed[compId]);
    showToast(par ? compLabel(compId) + ' regge ' + compLabel(par.id) + ': tocca il faro per il suo pannello.'
      : compLabel(compId) + ': monta un PAR sulla barra a T (scheda Luci, poi tocca lo stativo).');
    return;
  }
  if (!REAR_PANELS[t]) return;
  rearPanelId = compId;
  el('#rear-detail').innerHTML = '';
  // prima visibile, poi disegnato: serve la larghezza vera del riquadro
  el('#rear-modal').classList.add('show');
  renderRearPanel();
  setSceneInput(false);
}
function closeRearPanel () {
  rearPanelId = null;
  el('#rear-modal').classList.remove('show');
  // riattivato al giro successivo: il rilascio del tocco che ha chiuso il
  // popup non deve arrivare alla scena
  setTimeout(() => { if (!rearPanelId && !openCaseName) setSceneInput(true); }, 0);
}
el('#rear-close').addEventListener('click', closeRearPanel);
el('#rear-modal').addEventListener('click', ev => { if (ev.target.id === 'rear-modal') closeRearPanel(); });

// barra "cavo in mano" sopra la scena, finché il secondo capo non è collegato
function updateCableBanner () {
  const bar = el('#cable-banner');
  const pending = gameState.pendingPort;
  if (!pending) { bar.classList.remove('show'); return; }
  const pdef = getPortDef(pending.componentId, pending.portId);
  el('#cable-banner-text').innerHTML = pdef && pdef.lead
    ? `Spina <b>${escapeHtml(SIGNAL_LABEL[pdef.signal])}</b> di <b>${escapeHtml(compLabel(pending.componentId))}</b> in mano → tocca il dispositivo con la presa dove infilarla`
    : `Cavo <b>${escapeHtml(cableName(gameState.selectedCable))}</b> in mano da <b>${escapeHtml(compLabel(pending.componentId))} · ${escapeHtml(portLabel(pending.componentId, pending.portId))}</b> → tocca il dispositivo da collegare`;
  bar.classList.add('show');
}
el('#cable-banner-cancel').addEventListener('click', () => {
  if (window.__scene) window.__scene.cancelPending();
});

/* ---------------------------------------------------------------------
   3d) BAULI DEI CAVI — i cavi si prendono dai due flight case, come in un
       service: SEGNALE (XLR, DMX, jack, Speakon) e CORRENTE (PowerCON,
       Schuko, CEE e adattatori). Ogni cavo è una matassa col velcro, i due
       connettori veri ai capi e l'etichetta di nastro fluo.
   --------------------------------------------------------------------- */
const CABLE_CASES = {
  segnale: {
    title: 'SEGNALE',
    items: [
      { cable: 'xlr',     tape: 'XLR',     name: 'XLR',     info: '10 m · XLR F ↔ XLR M',       ends: ['xlr_f', 'xlr_m'] },
      { cable: 'dmx',     tape: 'DMX',     name: 'DMX',     info: '10 m · XLR5 F ↔ XLR5 M',     ends: ['dmx_f', 'dmx_m'] },
      { cable: 'jack',    tape: 'JACK',    name: 'Jack',    info: '3 m · jack ↔ jack',          ends: ['jack', 'jack'] },
      { cable: 'speakon', tape: 'SPEAKON', name: 'Speakon', info: '15 m · NL4 ↔ NL4',           ends: ['speakon', 'speakon'] }
    ]
  },
  corrente: {
    title: 'CORRENTE',
    items: [
      { cable: 'powercon',        tape: 'POWERCON', name: 'PowerCON',          info: '5 m · link blu ↔ grigio',         ends: ['pc_blue', 'pc_grey'] },
      { cable: 'schuko',          tape: 'PROLUNGA', name: 'Schuko',            info: '10 m · Schuko M ↔ F',             ends: ['schuko_m', 'schuko_f'] },
      { cable: 'cee_mono',        tape: 'CEE 16A',  name: 'CEE Monofase',      info: '10 m · CEE blu M ↔ F',            ends: ['cee_m', 'cee_f'] },
      { cable: 'cee_tri',         tape: 'CEE 400V', name: 'CEE Trifase',       info: '10 m · CEE rossa 5 poli M ↔ F',   ends: ['cee_m_red', 'cee_f_red'] },
      { cable: 'cee_powercon',    tape: 'CEE>PCON', name: 'CEE / PowerCON',    info: 'adattatore · CEE M ↔ PowerCON',   ends: ['cee_m', 'pc_blue'] },
      { cable: 'cee_schuko',      tape: 'CEE>SCH',  name: 'CEE / Schuko',      info: 'adattatore · CEE M ↔ Schuko F',   ends: ['cee_m', 'schuko_f'] },
      { cable: 'schuko_powercon', tape: 'SCH>PCON', name: 'Schuko / PowerCON', info: 'adattatore · Schuko M ↔ PowerCON', ends: ['schuko_m', 'pc_blue'] }
    ]
  }
};
function cableItem (cableId) {
  for (const c of Object.values(CABLE_CASES)) {
    const it = c.items.find(i => i.cable === cableId);
    if (it) return it;
  }
  return null;
}
const hex = n => '#' + n.toString(16).padStart(6, '0');

// connettore del cavo visto di lato, puntato a destra; (x, y) = attacco col cavo
function cableHead (kind, x, y, tape) {
  const boot = (w, h) => `<path d="M ${x} ${y - h * 0.35} L ${x + w} ${y - h / 2} L ${x + w} ${y + h / 2} L ${x} ${y + h * 0.35} Z" fill="#26282e" stroke="#0c0d10"/>`;
  const grooves = (gx, w, h, n, c) => Array.from({ length: n }, (_, i) => `<line x1="${gx + (i + 1) * w / (n + 1)}" y1="${y - h / 2 + 1}" x2="${gx + (i + 1) * w / (n + 1)}" y2="${y + h / 2 - 1}" stroke="${c}" stroke-width="1.2"/>`).join('');
  switch (kind) {
    case 'xlr_m': case 'xlr_f': case 'dmx_m': case 'dmx_f': {
      let s = boot(12, 14) + `<rect x="${x + 12}" y="${y - 9}" width="26" height="18" rx="3" fill="#c3c7ce" stroke="#7d828c"/>` + grooves(x + 12, 12, 18, 3, '#8a8e98')
        + `<rect x="${x + 12}" y="${y - 9}" width="4" height="18" fill="${tape}"/>`;
      if (kind.endsWith('_m')) s += `<rect x="${x + 38}" y="${y - 7.5}" width="7" height="15" rx="1" fill="#9aa0aa" stroke="#7d828c"/>` + [-3.5, 0, 3.5].map(d => `<line x1="${x + 40}" y1="${y + d}" x2="${x + 46}" y2="${y + d}" stroke="#e8e2d0" stroke-width="1.4"/>`).join('');
      else s += `<rect x="${x + 22}" y="${y - 12}" width="8" height="4" rx="1" fill="#dcdfe4" stroke="#7d828c"/>`;
      return s;
    }
    case 'jack':
      return boot(10, 12) + `<rect x="${x + 10}" y="${y - 6}" width="22" height="12" rx="3" fill="#34363d" stroke="#0c0d10"/><rect x="${x + 10}" y="${y - 6}" width="4" height="12" fill="${tape}"/>
        <rect x="${x + 32}" y="${y - 3}" width="18" height="6" fill="#c9ccd1" stroke="#7d828c" stroke-width=".8"/><line x1="${x + 40}" y1="${y - 3}" x2="${x + 40}" y2="${y + 3}" stroke="#1c1d22" stroke-width="1.5"/>
        <path d="M ${x + 50} ${y - 3} L ${x + 54} ${y} L ${x + 50} ${y + 3} Z" fill="#c9ccd1"/>`;
    case 'speakon':
      return boot(12, 16) + `<rect x="${x + 12}" y="${y - 11}" width="28" height="22" rx="4" fill="#2a2c32" stroke="#55585f"/>` + grooves(x + 20, 20, 22, 6, '#55585f')
        + `<rect x="${x + 12}" y="${y - 11}" width="4" height="22" fill="${tape}"/><rect x="${x + 40}" y="${y - 8}" width="6" height="16" rx="2" fill="#3a3d45"/>`;
    case 'pc_blue': case 'pc_grey': {
      const b = kind === 'pc_blue' ? '#2f6fd6' : '#cfd2d6', d = kind === 'pc_blue' ? '#1d4a9a' : '#9aa0aa';
      return boot(12, 16) + `<rect x="${x + 12}" y="${y - 11}" width="28" height="22" rx="4" fill="${b}" stroke="${d}"/>` + grooves(x + 16, 22, 22, 6, d)
        + `<rect x="${x + 22}" y="${y - 15}" width="10" height="5" rx="1.5" fill="${d}"/><rect x="${x + 40}" y="${y - 8}" width="6" height="16" rx="2" fill="#2a2c32"/>`;
    }
    case 'schuko_m':
      return boot(8, 12) + `<path d="M ${x + 8} ${y - 8} L ${x + 26} ${y - 13} L ${x + 26} ${y + 13} L ${x + 8} ${y + 8} Z" fill="#34363d" stroke="#6a6e78"/>
        <rect x="${x + 26}" y="${y - 6}" width="12" height="3.5" rx="1.5" fill="#e8e2d0"/><rect x="${x + 26}" y="${y + 2.5}" width="12" height="3.5" rx="1.5" fill="#e8e2d0"/>`;
    case 'schuko_f':
      return boot(8, 12) + `<rect x="${x + 8}" y="${y - 13}" width="30" height="26" rx="5" fill="#34363d" stroke="#6a6e78"/><rect x="${x + 36}" y="${y - 11}" width="4" height="22" rx="1.5" fill="#55585f"/>`;
    case 'cee_m': case 'cee_f': case 'cee_m_red': case 'cee_f_red': {
      const red = kind.includes('red');
      const b = red ? '#d6392f' : '#2f6fd6', d = red ? '#9e2820' : '#1d4a9a';
      let s = boot(12, 18) + `<rect x="${x + 12}" y="${y - 14}" width="30" height="28" rx="5" fill="${b}" stroke="${d}"/>` + grooves(x + 14, 18, 28, 5, d);
      if (kind.startsWith('cee_m')) s += `<rect x="${x + 42}" y="${y - 11}" width="8" height="22" rx="2" fill="${d}"/>` + [-6, 0, 6].map(dd => `<line x1="${x + 45}" y1="${y + dd}" x2="${x + 52}" y2="${y + dd}" stroke="#e8e2d0" stroke-width="2"/>`).join('');
      else s += `<path d="M ${x + 42} ${y - 14} L ${x + 50} ${y - 20} L ${x + 52} ${y - 16} L ${x + 44} ${y - 10} Z" fill="${b}" stroke="${d}"/><rect x="${x + 42}" y="${y - 12}" width="5" height="24" rx="1.5" fill="${d}"/>`;
      return s;
    }
  }
  return '';
}

// nastro fluo strappato a mano, scritto col pennarello nero: si legge anche
// sullo schermo di un telefono
const FLUO_TAPES = ['#eaff2b', '#ff4fb4', '#4dff73', '#ff9b21'];
function fluoTape (cx, cy, w, h, color, text, rot) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  // bordi corti seghettati come uno strappo
  const pts = [[x0, y0], [x1, y0]];
  for (let i = 1; i < 6; i++) pts.push([x1 - (i % 2 ? 3.5 : 0), y0 + h * i / 6]);
  pts.push([x1, y1], [x0, y1]);
  for (let i = 5; i > 0; i--) pts.push([x0 + (i % 2 ? 3.5 : 0), y0 + h * i / 6]);
  const fs = text.length <= 5 ? h * 0.78 : text.length <= 7 ? h * 0.66 : h * 0.56;
  return `<g transform="rotate(${rot} ${cx} ${cy})">
    <polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${color}" stroke="#000" stroke-opacity=".25"/>
    <rect x="${x0 + 3}" y="${y0 + 2}" width="${w - 6}" height="${h * 0.18}" fill="#fff" fill-opacity=".22"/>
    <text x="${cx}" y="${cy + fs * 0.36}" font-size="${fs.toFixed(1)}" fill="#111" text-anchor="middle"
      font-family="'Permanent Marker','Marker Felt','Comic Sans MS',cursive">${escapeHtml(text)}</text></g>`;
}

// matassa arrotolata col velcro, i due capi che escono a destra, nastro fluo
function cableCoil (cx, cy, it, selected, tapeColor) {
  const cab = hex(CABLE_TYPES[it.cable].color);
  const [len, ends] = it.info.split(' · ');
  let s = `<g class="cc-coil" data-cable="${it.cable}" style="cursor:pointer">
    <rect x="${cx - 92}" y="${cy - 90}" width="184" height="180" rx="8" fill="${selected ? '#f2a54124' : 'transparent'}" stroke="${selected ? '#f2a541' : 'none'}" stroke-width="3"/>
    <g transform="translate(0 ${selected ? -6 : 0})"><g transform="translate(0 4)">
    <ellipse cx="${cx - 18}" cy="${cy + 6}" rx="52" ry="44" fill="#000" fill-opacity=".35"/>`;
  for (let i = 0; i < 5; i++) {
    const r = 40 - i * 2.2, o = i * 1.6;
    s += `<ellipse cx="${cx - 22 + o}" cy="${cy + o * 0.6}" rx="${r}" ry="${r * 0.82}" fill="none" stroke="#17181b" stroke-width="8"/>
      <ellipse cx="${cx - 22 + o}" cy="${cy + o * 0.6}" rx="${r}" ry="${r * 0.82}" fill="none" stroke="#2e3037" stroke-width="1.2" stroke-dasharray="3 5"/>`;
  }
  s += `<ellipse cx="${cx - 22}" cy="${cy}" rx="40" ry="33" fill="none" stroke="${cab}" stroke-width="1.8" stroke-dasharray="14 10"/>
    <rect x="${cx - 70}" y="${cy - 8}" width="20" height="16" rx="3" fill="#8b2530" transform="rotate(-10 ${cx - 60} ${cy})"/>
    <path d="M ${cx + 12} ${cy - 16} C ${cx + 26} ${cy - 18}, ${cx + 26} ${cy - 24}, ${cx + 32} ${cy - 24}" fill="none" stroke="#17181b" stroke-width="7"/>
    <path d="M ${cx + 14} ${cy + 12} C ${cx + 26} ${cy + 14}, ${cx + 26} ${cy + 20}, ${cx + 32} ${cy + 20}" fill="none" stroke="#17181b" stroke-width="7"/>
    ${cableHead(it.ends[0], cx + 30, cy - 24, cab)}${cableHead(it.ends[1], cx + 30, cy + 20, cab)}</g>
    ${fluoTape(cx - 4, cy - 62, 164, 36, tapeColor, it.tape, -3)}
    <text x="${cx}" y="${cy + 64}" font-size="15" font-weight="700" fill="#e6e8eb" text-anchor="middle">${escapeHtml(len)}</text>
    <text x="${cx}" y="${cy + 82}" font-size="13" fill="#b4b8c0" text-anchor="middle">${escapeHtml(ends || '')}</text>
    </g></g>`;
  return s;
}

// il baule aperto visto dall'alto: coperchio con lo stencil, guscio nero con
// profili, angolari e chiusure a farfalla, interno in gommapiuma a scomparti
function renderCase (name) {
  const box = CABLE_CASES[name];
  // su telefono due colonne, così nastri e scritte restano grandi
  const cols = window.innerWidth < 700 ? 2 : 4, cw = 196, ch = 196;
  const rows = Math.ceil(box.items.length / cols);
  const W = cols * cw + 80, H = rows * ch + 150;
  let s = `<svg class="case-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Inter,sans-serif">
    <rect x="30" y="4" width="${W - 60}" height="40" rx="6" fill="#1b1c20" stroke="#8a8e98" stroke-width="3"/>
    <text x="${W / 2}" y="31" font-size="18" font-weight="800" fill="#e6e8eb" text-anchor="middle" letter-spacing="5" font-family="'Barlow Condensed',Impact,sans-serif">${box.title}</text>
    <rect x="10" y="50" width="${W - 20}" height="${H - 60}" rx="8" fill="#232428" stroke="#b9bcc1" stroke-width="6"/>
    ${[[10, 50], [W - 34, 50], [10, H - 34], [W - 34, H - 34]].map(([x, y]) => `<rect x="${x}" y="${y}" width="24" height="24" rx="5" fill="#d7dadd" stroke="#7d828c"/><circle cx="${x + 12}" cy="${y + 12}" r="4" fill="#9aa0aa"/>`).join('')}
    ${[W * 0.3, W * 0.7].map(x => `<rect x="${x - 18}" y="44" width="36" height="16" rx="3" fill="#c9ccd1" stroke="#6a6e78"/><circle cx="${x}" cy="52" r="5" fill="#9aa0aa" stroke="#6a6e78"/>`).join('')}
    <rect x="28" y="70" width="${W - 56}" height="${H - 96}" rx="4" fill="#111215"/>`;
  box.items.forEach((it, i) => {
    const cx = 50 + (i % cols) * cw + cw / 2, cy = 88 + Math.floor(i / cols) * ch + ch / 2;
    s += `<rect x="${cx - cw / 2 + 6}" y="${cy - ch / 2 + 6}" width="${cw - 12}" height="${ch - 12}" rx="6" fill="#1a1b1f" stroke="#26272c" stroke-width="2"/>`;
    s += cableCoil(cx, cy, it, gameState.selectedCable === it.cable, FLUO_TAPES[i % FLUO_TAPES.length]);
  });
  return s + `</svg>`;
}

let openCaseName = null;
function openCase (name) {
  openCaseName = name;
  el('#case-title').textContent = 'Baule ' + CABLE_CASES[name].title;
  el('#case-svg').innerHTML = renderCase(name);
  el('#case-svg').querySelectorAll('.cc-coil').forEach(node => {
    node.addEventListener('click', () => pickCable(node.dataset.cable));
  });
  el('#case-modal').classList.add('show');
  setSceneInput(false);
  SFX.caseOpen();
}
function closeCase () {
  openCaseName = null;
  el('#case-modal').classList.remove('show');
  setTimeout(() => { if (!openCaseName && !rearPanelId) setSceneInput(true); }, 0);
}
el('#case-close').addEventListener('click', closeCase);
el('#case-modal').addEventListener('click', ev => { if (ev.target.id === 'case-modal') closeCase(); });
document.querySelectorAll('.case-btn').forEach(btn => btn.addEventListener('click', () => openCase(btn.dataset.case)));

// prende (o rimette nel baule) un cavo
function pickCable (cableId) {
  // prima si spegne l'evidenziazione del capo in attesa, poi si azzera
  if (window.__scene) window.__scene.clearPendingHighlight();
  gameState.pendingPort = null;
  closeCase();
  if (gameState.selectedCable === cableId) {
    gameState.selectedCable = null;
    updateCableHand();
    showToast('Cavo rimesso nel baule.');
    return;
  }
  gameState.selectedCable = cableId;
  disarmPiece();
  updateCableHand();
  SFX.pick();
  showToast('Cavo preso: ' + cableName(cableId) + '. Tocca un dispositivo per aprire il suo pannello e scegliere la presa.');
}

// nella scheda Cavi: il cavo che si ha in mano, coi suoi due connettori
function tapeColorOf (cableId) {
  for (const box of Object.values(CABLE_CASES)) {
    const i = box.items.findIndex(it => it.cable === cableId);
    if (i >= 0) return FLUO_TAPES[i % FLUO_TAPES.length];
  }
  return FLUO_TAPES[0];
}
function updateCableHand () {
  const box = el('#cable-hand');
  if (!box) return;
  const it = cableItem(gameState.selectedCable);
  if (!it) {
    box.classList.remove('has');
    box.innerHTML = '<span class="ch-empty">Nessun cavo in mano: apri un baule e prendine uno</span>';
    return;
  }
  const cab = hex(CABLE_TYPES[it.cable].color);
  box.classList.add('has');
  box.innerHTML = `<svg viewBox="0 0 250 50" class="ch-svg" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(60 25) scale(-1 1) translate(-60 -25)">${cableHead(it.ends[0], 60, 25, cab)}</g>
      <line x1="60" y1="25" x2="190" y2="25" stroke="#17181b" stroke-width="7"/><line x1="60" y1="25" x2="190" y2="25" stroke="${cab}" stroke-width="2"/>
      ${cableHead(it.ends[1], 190, 25, cab)}</svg>
    <span class="ch-name"><span class="tape-fluo" style="background:${tapeColorOf(it.cable)}">${escapeHtml(it.tape)}</span><small>${escapeHtml(it.info)}</small></span>
    <button class="ch-drop" title="Rimetti nel baule">✕</button>`;
  box.querySelector('.ch-drop').addEventListener('click', () => pickCable(it.cable));
}



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
  showToast('Pezzo selezionato: tocca il pavimento per posarlo (toccalo di nuovo per annullare).');
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
      if (gameState.stock[type] <= 0) showToast('Esaurito in questo livello: ' + COMPONENT_TYPES[type].label + '.');
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
// tolleranza del tocco sui dispositivi, in pixel di schermo (un dito ≈ 40px)
const TOUCH_SLOP_PX = 22;
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

/* mezzi del service, in unità isometriche (una cella = 102): A larghezza,
   B lunghezza, Z altezza, cabina lunga cabL e alta cabZ, telaio a quota
   chassis, ruote alle posizioni wheels lungo la fiancata. Crescono coi
   livelli: il livello 1 arriva col furgone. */
const VEHICLES = {
  furgone: { A: 78, B: 210, Z: 92, chassis: 18, cabL: 56, cabZ: 70, wheels: [36, 170], wheelR: 11, sideDoor: 50 },
  camion:  { A: 96, B: 330, Z: 150, chassis: 26, cabL: 78, cabZ: 104, gap: 5, wheels: [44, 250, 290], wheelR: 15, spoiler: true, cabColor: 0xd9dbde },
  bilico:  { A: 100, B: 560, Z: 160, chassis: 30, cabL: 90, cabZ: 118, gap: 12, wheels: [48, 110, 440, 480, 520], wheelR: 16, spoiler: true, cabColor: 0xc9ccd1 }
};
const LEVEL_VEHICLE = 'furgone';
const CASE_ISO = isoFrame(46, 64, 44);   // flight case dei cavi
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

/* Posa su celle da 50 cm. Tutte le coordinate restano in METRI (zone, palco,
   gridToScreen): una cella di posa è un quadrato di CELL metri e la sua
   posizione (cx, cy) è l'angolo in metri, multiplo di CELL. */
const CELL = 0.5;
// punto dello schermo -> cella di posa che lo contiene
function screenToCell (px, py) {
  const relX = px - ORIGIN_X;
  const relY = py - ORIGIN_Y;
  const gxRaw = (relX / (TILE_W / 2) + relY / (TILE_H / 2)) / 2;
  const gyRaw = (relY / (TILE_H / 2) - relX / (TILE_W / 2)) / 2;
  const cx = Math.min(VENUE_W - CELL, Math.max(0, Math.floor(gxRaw / CELL) * CELL));
  const cy = Math.min(VENUE_H - CELL, Math.max(0, Math.floor(gyRaw / CELL) * CELL));
  return { cx, cy };
}
/* ingombro di ogni pezzo in celle da 50 cm, [lungo gx, lungo gy], dalla sua
   misura reale nel disegno; se il pezzo è girato di un quarto (in FOH) si
   scambia. I pezzi montati (testa, PAR) non occupano celle. */
const FOOTPRINT = {
  sub: [1, 1], mixer: [1, 2], ampli: [1, 2], controller: [1, 1], quadro: [1, 2],
  ciabatta: [1, 2], ciabatta_cee: [1, 3], pc: [1, 1], scheda: [1, 1], di: [1, 1], stativo: [1, 1]
};
function footprint (type, rot) {
  const f = FOOTPRINT[type] || [1, 1];
  return rot % 2 ? [f[1], f[0]] : f;
}
// chiave di una cella (indici interi, niente errori di virgola)
function cellKey (gx, gy) { return Math.round(gx / CELL) + ',' + Math.round(gy / CELL); }
function footCells (gx, gy, f) {
  const out = [];
  for (let i = 0; i < f[0]; i++) for (let j = 0; j < f[1]; j++) out.push([gx + i * CELL, gy + j * CELL]);
  return out;
}
// centro (in metri) di un pezzo posato
function compCenter (c) {
  const f = c.foot || [1, 1];
  return { gx: c.gx + f[0] * CELL / 2, gy: c.gy + f[1] * CELL / 2 };
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
  // mixer e consolle luci: in quinta (Off Stage) o in Regia di sala (FOH)
  mixer: (cx, cy) => isOffStageCell(cx, cy) || isFohCell(cx, cy),
  controller: (cx, cy) => isOffStageCell(cx, cy) || isFohCell(cx, cy),
  ampli: isOffStageCell,
  // stativi luci: davanti al palco (frontale) o ai suoi lati (taglio)
  stativo: (cx, cy) => isPitCell(cx, cy) ||
    (cy >= STAGE_ORIGIN_Y && cy < STAGE_ORIGIN_Y + STAGE_H && (cx < STAGE_ORIGIN_X || isOffStageCell(cx, cy))),
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
  di: (cx, cy) => isFohCell(cx, cy) || isOffStageCell(cx, cy),
  // la scheda audio sta sul tavolo accanto al PC
  scheda: (cx, cy) => isFohCell(cx, cy) || isOffStageCell(cx, cy)
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
    this.paintServiceName();
    // all'avvio c'è il menù davanti: la scena aspetta
    if (menuOpen) { this.input.enabled = false; sceneKeyboard(false); }
  }

  // scossone della vista, se non sono stati chiesti effetti ridotti
  shake (ms, intensity) { if (!reducedFx()) this.cameras.main.shake(ms, intensity); }

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
      if (this.onScenePointerMove(pointer)) return;

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

    this.input.on('pointerup', pointer => {
      this.onScenePointerUp(pointer);
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
    // barra "cavo in mano": si aggiorna solo quando cambia il capo in attesa
    const pend = gameState.pendingPort;
    const pendKey = pend ? pend.componentId + '/' + pend.portId + '/' + gameState.selectedCable : '';
    if (pendKey !== this.pendingKey) { this.pendingKey = pendKey; updateCableBanner(); }
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
    // griglia di posa leggera, celle da 50 cm (una linea più marcata ogni metro)
    for (let x = CELL; x < VENUE_W; x += CELL) {
      const a = gridToScreen(x, 0), b = gridToScreen(x, VENUE_H);
      g.lineStyle(1, 0x484c58, x % 1 ? 0.35 : 0.6); g.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let y = CELL; y < VENUE_H; y += CELL) {
      const a = gridToScreen(0, y), b = gridToScreen(VENUE_W, y);
      g.lineStyle(1, 0x484c58, y % 1 ? 0.35 : 0.6); g.lineBetween(a.x, a.y, b.x, b.y);
    }
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

      // un pezzo armato si posa; altrimenti un tocco su un cavo lo seleziona,
      // e un tocco sul pavimento vuoto chiude montaggio e cavo in attesa
      if (gameState.selectedPieceType) { this.placeArmedPieceAt(pointer.worldX, pointer.worldY); return; }
      if (this.assemblyId) { this.exitAssembly(); return; }
      // sul telefono i dispositivi sono piccoli: un tocco che li sfiora apre
      // comunque il pannello di quello più vicino
      if (this.devicesNear(pointer.worldX, pointer.worldY, TOUCH_SLOP_PX).length) {
        this.clearEdgeSelection();
        this.openPanelAt(pointer.worldX, pointer.worldY, null);
        return;
      }
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

  /* Carico e scarico: il mezzo del service e i flight case, nella stessa
     prospettiva isometrica dei dispositivi. Il mezzo cresce coi livelli
     (LEVEL_VEHICLE: furgone -> camion -> bilico); il retro guarda i case,
     il muso sta verso il fondo. I primi due case sono i bauli dei cavi. */
  drawLoadingDock () {
    const v = VEHICLES[LEVEL_VEHICLE];
    const vp = gridToScreen(0.5 + v.B / 204, 1.0);
    const vg = this.add.graphics().setDepth(1).setPosition(vp.x, vp.y);
    this.van = { vp, v, ...this.drawVehicle(vg, v) };

    // i due bauli dei cavi e un case di ricambio, in fila lungo la banchina
    const caseSpots = [[5.9, 0.9, 'segnale'], [7.2, 0.9, 'corrente'], [8.5, 0.9, null]];
    caseSpots.forEach(([gx, gy, caseName], i) => {
      const p = gridToScreen(gx, gy);
      const cg = this.add.graphics().setDepth(1.1 + gy / 100).setPosition(p.x, p.y);
      const tape = caseName === 'segnale' ? 0xeaff2b : caseName === 'corrente' ? 0xff4fb4 : null;
      this.drawFlightCase(cg, CASE_ISO, tape);
      if (!caseName) return;
      this.add.text(p.x, p.y - 34, CABLE_CASES[caseName].title, {
        fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#e6e8eb'
      }).setOrigin(0.5).setDepth(2);
      const hit = this.add.rectangle(p.x, p.y - 6, 58, 58, 0xffffff, 0.001).setDepth(2)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (pointer, lx, ly, event) => {
        if (event && event.stopPropagation) event.stopPropagation();
        // aprire un baule porta anche nella scheda Cavi
        const tab = document.querySelector('.tab-btn[data-tab="cavi"]');
        if (tab && !isWiringTabActive()) tab.click();
        openCase(caseName);
      });
    });
  }

  /* mezzo del service visto di tre quarti: fiancata (faccia a=0) verso il
     pubblico, retro (faccia b=B) verso i case, cabina verso il fondo (b=0).
     Stessa funzione per furgone, camion e bilico: cambiano le misure. */
  drawVehicle (g, v) {
    const P = isoFrame(v.A, v.B, v.Z), k = this.isoKit(g, P);
    const { A, B, Z } = P;
    const white = { top: 0xeef0f2, left: 0xd8dadd, right: 0xbfc2c7 };
    const cabCol = { top: 0xe4e6e9, left: v.cabColor || 0xcfd2d6, right: 0xb4b7bc };
    const glass = 0x3c4a5c;
    const zc = v.chassis;                                  // piano del telaio
    const cabEnd = v.cabL, boxStart = cabEnd + (v.gap || 0);
    const hood = zc + (v.cabZ - zc) * 0.45;                // cofano
    const ws0 = v.cabL * 0.12, ws1 = v.cabL * 0.36;        // piede e cima del parabrezza
    // si disegna da dietro in avanti: ombra, telaio, cabina (sta dietro),
    // cassone, dettagli del retro e della fiancata, ruote per ultime
    k.quadZ(0, -8, A + 8, -8, B + 10, 0x000000, 0.28);
    k.box(6, A - 6, 4, B - 2, zc - 7, zc, { top: 0x2a2c32, left: 0x1c1d22, right: 0x16171b });

    // cabina: fianco col profilo (cofano, parabrezza inclinato, tetto)
    k.poly([P(0, 0, zc), P(0, 0, hood), P(0, ws0, hood), P(0, ws1, v.cabZ), P(0, cabEnd, v.cabZ), P(0, cabEnd, zc)], cabCol.left);
    k.poly([P(0, cabEnd, zc), P(A, cabEnd, zc), P(A, cabEnd, v.cabZ), P(0, cabEnd, v.cabZ)], cabCol.right);
    k.quadZ(hood, 0, A, 0, ws0, cabCol.top);                                   // cofano
    k.poly([P(0, ws0, hood), P(A, ws0, hood), P(A, ws1, v.cabZ), P(0, ws1, v.cabZ)], glass);   // parabrezza
    k.poly([P(0, ws0, hood), P(A * 0.3, ws0, hood), P(A * 0.3, ws1, v.cabZ), P(0, ws1, v.cabZ)], 0xffffff, 0.1);
    k.quadZ(v.cabZ, 0, A, ws1, cabEnd, cabCol.top);                             // tetto
    g.lineStyle(0.8, 0x0c0d10, 0.8);
    g.strokePoints([P(0, 0, zc), P(0, 0, hood), P(0, ws0, hood), P(0, ws1, v.cabZ), P(0, cabEnd, v.cabZ), P(A, cabEnd, v.cabZ), P(A, ws1, v.cabZ), P(A, ws0, hood), P(A, 0, hood), P(0, 0, hood)], false);
    // finestrino della portiera (segue il parabrezza) e maniglia
    const wz0 = hood + 3, wz1 = v.cabZ - 4;
    const wb0 = ws0 + (ws1 - ws0) * ((wz0 - hood) / (v.cabZ - hood)) + 4;
    k.poly([P(-0.2, wb0, wz0), P(-0.2, ws1 + 2, wz1), P(-0.2, cabEnd - 5, wz1), P(-0.2, cabEnd - 5, wz0)], glass);
    k.quadA(-0.4, cabEnd - 15, cabEnd - 9, hood - 5, hood - 3, 0x55585f);
    // fari e freccia sul muso
    k.quadA(-0.3, 1, 5, hood - 9, hood - 3, 0xf4f1d0);
    k.quadA(-0.3, 1, 5, hood - 12, hood - 10, 0xf2a541);
    // specchietto sul montante
    k.box(-7, 0, ws1 - 2, ws1 + 1, hood + 4, hood + 13, { top: 0x2a2c32, left: 0x1c1d22, right: 0x16171b });
    // camion e bilico: spoiler sopra la cabina, verso il cassone più alto
    if (v.spoiler) {
      k.poly([P(0, cabEnd - 20, v.cabZ), P(0, cabEnd, Z - 8), P(0, cabEnd, v.cabZ)], 0xc9ccd1);
      k.poly([P(0, cabEnd - 20, v.cabZ), P(A, cabEnd - 20, v.cabZ), P(A, cabEnd, Z - 8), P(0, cabEnd, Z - 8)], 0xe4e6e9);
    }

    // cassone
    k.box(0, A, boxStart, B, zc, Z, white);
    // livrea: fascia arancio sulla fiancata e sul retro
    const lz = zc + (Z - zc) * 0.34;
    k.quadA(-0.2, boxStart + 4, B - 2, lz, lz + 5, 0xf2a541);
    k.quadA(-0.2, boxStart + 4, B - 2, lz + 7, lz + 8.5, 0xf2a541);
    k.quadB(B + 0.2, 2, A - 2, lz, lz + 5, 0xf2a541);
    // porta laterale scorrevole (furgone) o pannelli del cassone
    g.lineStyle(1, 0x8a8e98, 0.9);
    if (v.sideDoor) {
      [boxStart + 10, boxStart + 10 + v.sideDoor].forEach(b => { const t0 = P(0, b, zc + 3), t1 = P(0, b, Z - 4); g.lineBetween(t0.x, t0.y, t1.x, t1.y); });
      k.quadA(-0.3, boxStart + 10 + v.sideDoor - 9, boxStart + 10 + v.sideDoor - 3, zc + (Z - zc) * 0.52, zc + (Z - zc) * 0.52 + 2.5, 0x55585f);
      k.quadA(-0.3, boxStart + 12, boxStart + 8 + v.sideDoor, zc + (Z - zc) * 0.62, Z - 8, glass, 0.85);
    } else {
      for (let b = boxStart + 40; b < B - 10; b += 40) { const t0 = P(0, b, zc + 2), t1 = P(0, b, Z - 2); g.lineBetween(t0.x, t0.y, t1.x, t1.y); }
    }
    // retro: due ante con cerniere, maniglie, fanali e targa
    const mid = A / 2, rz = t => zc + (Z - zc) * t;
    const s0 = P(mid, B, zc + 2), s1 = P(mid, B, Z - 3);
    g.lineStyle(1.2, 0x7d828c, 1); g.lineBetween(s0.x, s0.y, s1.x, s1.y);
    [[3, 6], [A - 6, A - 3]].forEach(([a0, a1]) => { k.quadB(B + 0.2, a0, a1, rz(0.2), rz(0.25), 0x7d828c); k.quadB(B + 0.2, a0, a1, rz(0.75), rz(0.8), 0x7d828c); });
    k.quadB(B + 0.3, mid - 9, mid - 2, rz(0.45), rz(0.5), 0x3a3d45);
    k.quadB(B + 0.3, mid + 2, mid + 9, rz(0.45), rz(0.5), 0x3a3d45);
    [[2, 9], [A - 9, A - 2]].forEach(([a0, a1]) => { k.quadB(B + 0.3, a0, a1, zc - 7, zc + 5, 0xe0503f); k.quadB(B + 0.4, a0, a1, zc - 7, zc - 3, 0xf2a541); });
    k.quadB(B + 0.5, mid - 14, mid + 14, zc - 6, zc - 1, 0xf4f5f6);         // targa
    k.quadB(B + 0.6, mid - 14, mid - 11, zc - 6, zc - 1, 0x2f6fd6);

    // ruote e passaruota sul fianco visibile
    v.wheels.forEach(bw => {
      k.discA(-0.2, bw, zc - 3, v.wheelR + 3, 0x1c1d22);
      k.discA(-0.4, bw, v.wheelR, v.wheelR, 0x111215);
      k.discA(-0.6, bw, v.wheelR, v.wheelR * 0.52, 0x8a8e98);
      k.discA(-0.8, bw, v.wheelR, v.wheelR * 0.22, 0x3a3d45);
    });
    return { P, boxStart, lz };
  }

  /* livrea del service sulla fiancata del mezzo: il logo nel pannello dopo
     la porta scorrevole, il nome sotto la fascia arancio. Si disegnano su
     una tela già deformata come la fiancata in isometria (così sembrano
     dipinti sul furgone, non appoggiati sopra) e a risoluzione tripla, per
     restare nitidi anche con lo zoom. Si ridipinge quando cambiano nome o
     logo. */
  paintServiceName () {
    if (!this.van) return;
    const { vp, P, boxStart, lz, v } = this.van;
    const name = (Profile.data.service || '').toUpperCase();
    const logo = gameActive || Profile.data.service ? serviceLogo() : null;
    const token = this.liverySeq = (this.liverySeq || 0) + 1;
    const RES = 3;
    // fiancata: coordinate u lungo il mezzo, w dall'alto verso il basso
    const O = P(-0.5, 0, 0), ub = { x: P(-0.5, 1, 0).x - O.x, y: P(-0.5, 1, 0).y - O.y };
    const uz = { x: P(-0.5, 0, 1).x - O.x, y: P(-0.5, 0, 1).y - O.y };
    const top = { x: O.x + v.Z * uz.x, y: O.y + v.Z * uz.y };
    const corners = [[boxStart, v.chassis], [v.B, v.chassis], [boxStart, v.Z], [v.B, v.Z]].map(([b, z]) => P(-0.5, b, z));
    const bx = Math.floor(Math.min(...corners.map(c => c.x))), by = Math.floor(Math.min(...corners.map(c => c.y)));
    const bw = Math.ceil(Math.max(...corners.map(c => c.x))) - bx, bh = Math.ceil(Math.max(...corners.map(c => c.y))) - by;
    const paint = img => {
      if (token !== this.liverySeq) return;       // nel frattempo è cambiato di nuovo
      const canvas = document.createElement('canvas');
      canvas.width = bw * RES; canvas.height = bh * RES;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(RES * ub.x, RES * ub.y, -RES * uz.x, -RES * uz.y, RES * (top.x - bx), RES * (top.y - by));
      // logo nel pannello tra la porta e il retro, sopra la fascia
      if (img) {
        const u0 = boxStart + (v.sideDoor ? 16 + v.sideDoor : 8), u1 = v.B - 6;
        const w0 = 5, w1 = v.Z - (lz + 10);
        const size = Math.min(u1 - u0, w1 - w0) - 2;
        ctx.drawImage(img, (u0 + u1 - size) / 2, (w0 + w1 - size) / 2, size, size);
      }
      // nome sotto la fascia, lungo tutta la fiancata, nello stile del marchio
      if (name) {
        const u0 = boxStart + 6, u1 = v.B - 6, w0 = v.Z - (lz - 2), w1 = v.Z - (v.chassis + 12);
        const lg = logo || defaultLogo();
        // sul bianco del furgone il colore chiaro non si leggerebbe
        const accent = ['#eee9df', '#f2c53d'].includes(brandAccent(lg)) ? (lg.bg === '#eee9df' ? '#1c1d22' : lg.bg) : brandAccent(lg);
        drawStyledName(ctx, lg.style || 'tour', name, (u0 + u1) / 2, (w0 + w1) / 2, u1 - u0, w1 - w0, accent);
      }
      const key = 'livery-' + token;
      this.textures.addCanvas(key, canvas);
      const old = this.liveryImg && this.liveryImg.texture.key;
      if (!this.liveryImg) this.liveryImg = this.add.image(vp.x + bx, vp.y + by, key).setOrigin(0).setScale(1 / RES).setDepth(1.05);
      else this.liveryImg.setTexture(key);
      if (old && old !== key) this.textures.remove(old);
      this.livery = { name, logo };
    };
    Promise.all([logo ? logoImage(logo, Profile.data.service) : null, brandFonts()]).then(([img]) => paint(img));
    this.paintBrandTexture();
  }

  /* marchio grande per la scritta finale dello show, preparato in anticipo
     (il disegno è asincrono: logo e caratteri devono essere pronti) */
  paintBrandTexture () {
    const token = this.brandSeq = (this.brandSeq || 0) + 1;
    if (!gameActive && !Profile.data.service) return;
    renderBrand(document.createElement('canvas'), serviceLogo(), Profile.data.service, 960, 300).then(canvas => {
      if (token !== this.brandSeq) return;
      const key = 'brand-' + token, old = this.brandKey;
      this.textures.addCanvas(key, canvas);
      this.brandKey = key;
      // il vecchio si toglie solo quando nessuno show lo sta usando
      if (old && !this.fx) this.textures.remove(old);
    });
  }

  /* flight case da tour: guscio nero in multistrato, profili e angolari in
     alluminio, chiusure a farfalla, maniglia, ruote pivottanti e nastro
     fluo sul coperchio (lo stesso dei cavi nei bauli) */
  drawFlightCase (g, P, tape) {
    const k = this.isoKit(g, P);
    const { A, B, Z } = P;
    const alu = 0xc3c7ce, aluDk = 0x8a8e98;
    k.quadZ(0, -3, A + 3, -3, B + 3, 0x000000, 0.3);
    // ruote
    [[3, 9, B - 9, B - 3], [3, 9, 3, 9], [A - 9, A - 3, B - 9, B - 3]].forEach(([a0, a1, b0, b1]) =>
      k.box(a0, a1, b0, b1, 0, 6, { top: 0x2a2c32, left: 0x111215, right: 0x0c0d10 }));
    const z0 = 6;
    k.box(0, A, 0, B, z0, Z, { top: 0x2e3036, left: 0x232428, right: 0x1a1b1f });
    // profilo di chiusura del coperchio
    const zs = z0 + (Z - z0) * 0.7;
    k.quadA(-0.2, 0, B, zs - 1.2, zs + 1.2, alu);
    k.quadB(B + 0.2, 0, A, zs - 1.2, zs + 1.2, alu);
    // profili sugli spigoli
    k.quadA(-0.3, B - 2.5, B, z0, Z, alu);
    k.quadA(-0.3, 0, 2.5, z0, Z, aluDk);
    k.quadB(B + 0.3, A - 2.5, A, z0, Z, aluDk);
    k.quadZ(Z + 0.2, 0, A, B - 2.5, B, alu);
    k.quadZ(Z + 0.2, 0, 2.5, 0, B, alu);
    // angolari a sfera
    [[0, B], [0, 0]].forEach(([a, b]) => { k.discA(-0.5, b === 0 ? 3 : B - 3, Z - 3, 3.2, 0xdcdfe4); k.discA(-0.5, b === 0 ? 3 : B - 3, z0 + 3, 3.2, 0xdcdfe4); });
    k.discB(B + 0.5, A - 3, Z - 3, 3.2, 0xdcdfe4); k.discB(B + 0.5, A - 3, z0 + 3, 3.2, 0xdcdfe4);
    // chiusure a farfalla sul fianco e sul fronte
    [B * 0.28, B * 0.72].forEach(b => k.quadA(-0.5, b - 4, b + 4, zs - 3.5, zs + 3.5, 0xd7dadd));
    k.quadB(B + 0.5, A / 2 - 4, A / 2 + 4, zs - 3.5, zs + 3.5, 0xd7dadd);
    // maniglie incassate
    k.quadA(-0.5, B / 2 - 7, B / 2 + 7, z0 + (Z - z0) * 0.38, z0 + (Z - z0) * 0.46, 0x0c0d10);
    k.quadB(B + 0.5, A / 2 - 6, A / 2 + 6, z0 + (Z - z0) * 0.38, z0 + (Z - z0) * 0.46, 0x0c0d10);
    // nastro fluo sul coperchio
    if (tape) k.quadZ(Z + 0.4, A * 0.25, A * 0.75, B * 0.2, B * 0.8, tape);
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
    // linee ogni 50 cm (celle di posa), più marcate ogni metro
    for (let i = 0; i <= totalW; i += CELL) {
      const a = gridToScreen(gx0 + i, gy0), b = gridToScreen(gx0 + i, gy0 + H);
      top.lineStyle(1, 0x4a3f30, i % 1 ? 0.5 : 0.9); top.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let j = 0; j <= H; j += CELL) {
      const a = gridToScreen(gx0, gy0 + j), b = gridToScreen(gx0 + totalW, gy0 + j);
      top.lineStyle(1, 0x4a3f30, j % 1 ? 0.5 : 0.9); top.lineBetween(a.x, a.y, b.x, b.y);
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
    this.updateQuadroPhaseBars(quadroEntry.id);
  }

  /* barra verde->rosso sotto ogni presa: quanto di PHASE_BUDGET_W è già
     impegnato su quella fase. Chiamata ogni volta che cambia un cavo o si
     piazza/sposta/toglie un componente, non solo alla pressione di Test. */
  updateQuadroPhaseBars (quadroId) {
    const qv = this.compVisuals[quadroId];
    if (!qv || !qv.phaseBars) return;
    const def = COMPONENT_TYPES.quadro;
    const loads = livePhaseLoads(false);
    const g = qv.phaseBars;
    g.clear();
    // leva di ogni magnetotermico sul fronte: verde armato, rossa scattato,
    // grigia abbassato
    const prot = quadroProt(gameState.placed[quadroId]);
    def.ports.filter(p => p.phase).forEach(p => {
      const a = QUADRO_PHASE_A[['L1', 'L2', 'L3'].indexOf(p.phase)];
      const c = prot[p.phase] ? 0x49b06a : (prot.tripped[p.phase] ? 0xe0503f : 0x6a6e78);
      const pts = [[a - 3, 26.5], [a + 3, 26.5], [a + 3, 29], [a - 3, 29]].map(([aa, z]) => QUADRO_ISO(aa, QUADRO_ISO.B, z));
      g.fillStyle(c, 1); g.fillPoints(pts, true);
    });
    // barra subito sotto ogni presa di fase
    const barW = 14, barH = 4;
    def.ports.filter(p => p.phase).forEach(p => {
      const barY = p.dy + 7;
      const frac = Math.min(1, loads[p.phase] / PHASE_BUDGET_W);
      const color = frac >= 1 ? 0xe0503f : (frac >= 0.75 ? 0xf2a541 : 0x49b06a);
      g.fillStyle(0x000000, 0.6);
      g.fillRect(p.dx - barW / 2, barY, barW, barH);
      g.fillStyle(color, 1);
      g.fillRect(p.dx - barW / 2, barY, barW * frac, barH);
    });
  }

  /* attrezzi di disegno isometrico su una Graphics, per un solido in un
     isoFrame P: facce, quadrilateri e cerchi appoggiati sui tre piani */
  isoKit (g, P) {
    const poly = (pts, color, alpha = 1) => { g.fillStyle(color, alpha); g.fillPoints(pts, true); };
    const circ = (fn, n = 24) => Array.from({ length: n }, (_, i) => fn(i / n * Math.PI * 2));
    return {
      poly,
      // solido: faccia a=a0 (sinistra), faccia b=b1 (destra), piano z=z1
      box: (a0, a1, b0, b1, z0, z1, c) => {
        if (P.k) {
          // solido ruotato: si disegnano solo le facce laterali che ora
          // guardano verso chi osserva (-a a sinistra, +b a destra)
          const faces = [
            [[-1, 0], [P(a0, b0, z0), P(a0, b1, z0), P(a0, b1, z1), P(a0, b0, z1)]],
            [[1, 0], [P(a1, b0, z0), P(a1, b1, z0), P(a1, b1, z1), P(a1, b0, z1)]],
            [[0, -1], [P(a0, b0, z0), P(a1, b0, z0), P(a1, b0, z1), P(a0, b0, z1)]],
            [[0, 1], [P(a0, b1, z0), P(a1, b1, z0), P(a1, b1, z1), P(a0, b1, z1)]]
          ];
          faces.forEach(([n, pts]) => {
            const [wa, wb] = rotDir(P.k, n[0], n[1]);
            if (wa === -1) poly(pts, c.left);
            else if (wb === 1) poly(pts, c.right);
            else return;
            g.lineStyle(0.8, 0x0c0d10, 0.7); g.strokePoints(pts, true);
          });
          const top = [P(a0, b0, z1), P(a0, b1, z1), P(a1, b1, z1), P(a1, b0, z1)];
          poly(top, c.top);
          g.lineStyle(0.8, 0x0c0d10, 0.7); g.strokePoints(top, true);
          return;
        }
        poly([P(a0, b0, z0), P(a0, b1, z0), P(a0, b1, z1), P(a0, b0, z1)], c.left);
        poly([P(a0, b1, z0), P(a1, b1, z0), P(a1, b1, z1), P(a0, b1, z1)], c.right);
        poly([P(a0, b0, z1), P(a0, b1, z1), P(a1, b1, z1), P(a1, b0, z1)], c.top);
        g.lineStyle(0.8, 0x0c0d10, 0.85);
        g.strokePoints([P(a0, b0, z0), P(a0, b1, z0), P(a1, b1, z0), P(a1, b1, z1), P(a1, b0, z1), P(a0, b0, z1)], true);
        // spigoli illuminati (luce dall'alto a sinistra, come sul mixer)
        g.lineStyle(0.8, 0xffffff, 0.14);
        g.strokePoints([P(a0, b0, z1), P(a0, b1, z1), P(a1, b1, z1)], false);
        const e0 = P(a0, b1, z0), e1 = P(a0, b1, z1); g.lineBetween(e0.x, e0.y, e1.x, e1.y);
      },
      quadA: (a, b0, b1, z0, z1, c, al) => poly([P(a, b0, z0), P(a, b1, z0), P(a, b1, z1), P(a, b0, z1)], c, al),
      quadB: (b, a0, a1, z0, z1, c, al) => poly([P(a0, b, z0), P(a1, b, z0), P(a1, b, z1), P(a0, b, z1)], c, al),
      quadZ: (z, a0, a1, b0, b1, c, al) => poly([P(a0, b0, z), P(a1, b0, z), P(a1, b1, z), P(a0, b1, z)], c, al),
      // cerchi disegnati SUL piano indicato (diventano ellissi isometriche)
      discA: (a, bc, zc, r, c, al) => poly(circ(t => P(a, bc + r * Math.cos(t), zc + r * Math.sin(t))), c, al),
      discB: (b, ac, zc, r, c, al) => poly(circ(t => P(ac + r * Math.cos(t), b, zc + r * Math.sin(t))), c, al),
      discZ: (z, ac, bc, r, c, al) => poly(circ(t => P(ac + r * Math.cos(t), bc + r * Math.sin(t), z)), c, al)
    };
  }

  /* ---------------- disegno di un componente: forma dedicata per tipo ---------------- */
  drawComponentBody (g, def, rot) {
    const w = def.body.w, h = def.body.h;
    switch (def.shape) {
      case 'sub': {
        // cassa sub in multistrato nero: baffle con woofer da 18" e bocca
        // reflex verso il pubblico, pannello connettori sul fianco
        const P = SUB_ISO, k = this.isoKit(g, P);
        const { A, B, Z } = P;
        k.box(0, A, 0, B, 0, Z, ISO_BLACK);
        k.quadA(0, 2, B - 2, 2, Z - 2, 0x1b1c20);                    // tela/griglia del baffle
        k.discA(0, B / 2, Z / 2 + 4, 19, 0x2e3037);                  // sospensione
        k.discA(0, B / 2, Z / 2 + 4, 17, 0x0c0d10);
        k.discA(0, B / 2, Z / 2 + 4, 12, 0x17181c);                  // cono
        k.discA(0, B / 2, Z / 2 + 4, 4.5, 0x2e3037);                 // parapolvere
        k.quadA(0, 6, B - 6, 2.5, 5.5, 0x050506);                     // bocca reflex
        k.quadA(0, B - 12, B - 4, Z - 5, Z - 3.6, def.body.accent);  // logo
        k.quadB(B, 1.5, A - 1.5, 1.5, Z - 1.5, 0x22242a);            // piastra connettori
        k.quadZ(Z, A / 2 - 6, A / 2 + 6, B / 2 - 1.5, B / 2 + 1.5, 0x0c0d10); // flangia del palo
        break;
      }
      case 'top': {
        // testa a due vie: tromba in alto e woofer da 12" sul fronte, montata
        // sul palo che scende nel sub
        const P = TOP_ISO, k = this.isoKit(g, P);
        const { A, B, Z } = P;
        const foot = P(A / 2, B / 2, 0);
        g.fillStyle(0x6a6e78, 1); g.fillRect(foot.x - 1.6, foot.y - 2, 3.2, TOP_POLE + 2);
        g.fillStyle(0x9aa0aa, 1); g.fillRect(foot.x - 1.6, foot.y - 2, 1.2, TOP_POLE + 2);
        k.box(0, A, 0, B, 0, Z, ISO_BLACK);
        k.quadA(0, 2, B - 2, 2, Z - 2, 0x1b1c20);
        k.quadA(0, 5, B - 5, Z - 17, Z - 4, 0x0c0d10);               // tromba
        k.quadA(0, 11, B - 11, Z - 13, Z - 8, 0x26282e);
        k.discA(0, B / 2, 16, 12, 0x2e3037);                         // woofer
        k.discA(0, B / 2, 16, 10.5, 0x0c0d10);
        k.discA(0, B / 2, 16, 7, 0x17181c);
        k.discA(0, B / 2, 16, 2.8, 0x2e3037);
        k.quadA(0, B - 9, B - 3, 3, 4.2, def.body.accent);
        k.quadB(B, 3, A - 3, 3, 22, 0x22242a);
        break;
      }
      case 'stativo': {
        // stativo luci: treppiede a terra, asta e barra a T in cima
        const P = STAND_ISO, k = this.isoKit(g, P);
        const c0 = P(P.A / 2, P.B / 2, 0), top = c0.y - STAND_POLE;
        k.discZ(0, P.A / 2, P.B / 2, 20, 0x000000, 0.25);             // ombra
        g.lineStyle(3, 0x1c1d22, 1);
        [[P.A / 2, 0], [0, P.B], [P.A, P.B]].forEach(([a, b]) => {
          const f = P(a, b, 0);
          g.lineBetween(c0.x, c0.y - 14, f.x, f.y);                   // gambe
          g.fillStyle(0x0c0d10, 1); g.fillCircle(f.x, f.y, 2.2);
        });
        g.fillStyle(0x2a2c32, 1); g.fillRect(c0.x - 2.5, top, 5, STAND_POLE - 12);      // asta
        g.fillStyle(0x55585f, 1); g.fillRect(c0.x - 2.5, top, 1.4, STAND_POLE - 12);
        g.fillStyle(0x3a3d45, 1); g.fillRect(c0.x - 4, c0.y - 30, 8, 5);              // manopola di serraggio
        const b0 = P(P.A / 2, P.B / 2 - 16, 0), b1 = P(P.A / 2, P.B / 2 + 16, 0);     // barra a T
        g.lineStyle(4, 0x1c1d22, 1); g.lineBetween(b0.x, b0.y - STAND_POLE, b1.x, b1.y - STAND_POLE);
        g.lineStyle(1, 0x6a6e78, 1); g.lineBetween(b0.x, b0.y - STAND_POLE - 1.5, b1.x, b1.y - STAND_POLE - 1.5);
        break;
      }
      case 'par': {
        // PAR LED su staffa: corpo cilindrico nero, lente frontale con i LED,
        // forcella con le manopole. Sullo stativo gira verso il palco: se la
        // lente guarda lontano da chi osserva si vede il retro del fusto.
        const P = rotFrame(PAR_ISO, rot), k = this.isoKit(g, P);
        const zc = 24, bc = 17, r = 14, aF = 3, aR = 34;
        const lensSeen = rot === 0 || rot === 3;
        k.box(6, 32, 4, 30, 0, 2.5, ISO_GREY);                       // piastra
        k.box(17, 21, 2, 4.5, 2.5, zc + 1, ISO_GREY);                 // forcella
        const ring = (a, rad) => Array.from({ length: 32 }, (_, i) => {
          const t = i / 32 * Math.PI * 2;
          return P(a, bc + rad * Math.cos(t), zc + rad * Math.sin(t));
        });
        const lens = () => {
          k.poly(ring(aF, r), 0x0c0d10);                               // anello frontale
          k.poly(ring(aF - 0.6, r - 2), 0x3b3423);                     // lente
          [[0, 0], [5.5, 0], [-5.5, 0], [2.7, 4.8], [-2.7, 4.8], [2.7, -4.8], [-2.7, -4.8]].forEach(([db, dz]) => {
            k.discA(aF - 0.8, bc + db, zc + dz, 1.9, 0xf6e7a8);
          });
          g.lineStyle(1.4, def.body.accent, 0.9); g.strokePoints(ring(aF, r), true);
        };
        if (!lensSeen) lens();
        k.poly(convexHull(ring(aR, r).concat(ring(aF, r))), 0x1c1d22);  // fusto
        g.lineStyle(1, 0x3a3d45, 1);                                   // alette di raffreddamento
        [12, 18, 24, 30].forEach(a => { g.strokePoints(ring(a, r).slice(4, 20), false); });
        if (lensSeen) lens();
        else { k.poly(ring(aR, r), 0x26282e); g.lineStyle(1, 0x3a3d45, 1); g.strokePoints(ring(aR, r), true); }
        k.box(17, 21, 29.5, 32, 2.5, zc + 1, ISO_GREY);               // braccio destro
        k.discB(32, 19, zc, 3.2, 0x8a8e98);                            // manopola
        break;
      }
      case 'ampli': {
        // finale a rack 2U: maniglie, manopole di livello, LED di stato e
        // griglie di aerazione sul coperchio
        const P = AMP_ISO, k = this.isoKit(g, P);
        const { A, B, Z } = P;
        k.box(0, A, 0, B, 0, Z, ISO_BLACK);
        for (let a = 6; a < A - 6; a += 5) k.quadZ(Z, a, a + 2, 19, 27, 0x2a2c33);
        k.quadB(B, 1, A - 1, 1, Z - 1, 0x1a1b20);                      // pannello frontale
        [[2, 6], [A - 6, A - 2]].forEach(([a0, a1]) => k.box(a0, a1, B, B + 3, 2, Z - 2, ISO_GREY));
        k.discB(B, 18, Z / 2, 3.6, 0x0c0d10); k.discB(B, 18, Z / 2, 2.8, 0x8a8e98);
        k.discB(B, 30, Z / 2, 3.6, 0x0c0d10); k.discB(B, 30, Z / 2, 2.8, 0x8a8e98);
        [0x49b06a, 0x49b06a, 0xf2c53d, 0x2a2c33].forEach((c, i) => k.quadB(B, 42 + i * 4, 45 + i * 4, Z / 2 + 2, Z / 2 + 4.5, c));
        [0x49b06a, 0x49b06a, 0x2a2c33, 0x2a2c33].forEach((c, i) => k.quadB(B, 42 + i * 4, 45 + i * 4, Z / 2 - 3.5, Z / 2 - 1, c));
        k.quadB(B, 62, 70, Z / 2 - 2.5, Z / 2 + 2.5, 0xd6392f);         // interruttore
        break;
      }
      case 'quadro': {
        // armadio di distribuzione bianco da evento: striscia di sicurezza,
        // finestra con un interruttore per fase sopra ogni presa CEE,
        // maniglia sul fianco
        const P = QUADRO_ISO, k = this.isoKit(g, P);
        const { A, B, Z } = P;
        k.box(0, A, 0, B, 0, Z, { top: 0xf3f4f6, left: 0xd9dbdf, right: 0xc7cad0 });
        k.quadB(B, 2, A - 2, Z - 5, Z - 2, 0xf2c53d);                   // striscia gialla/nera
        g.lineStyle(1, 0x1c1d22, 0.8);
        for (let a = 4; a < A - 4; a += 6) {
          const p0 = P(a, B, Z - 5), p1 = P(a + 3, B, Z - 2);
          g.lineBetween(p0.x, p0.y, p1.x, p1.y);
        }
        k.quadB(B, 3, A - 3, 24, Z - 8, 0x3a3d45);                      // finestra interruttori
        def.ports.filter(p => p.phase).forEach(p => {
          const a = QUADRO_PHASE_A[['L1', 'L2', 'L3'].indexOf(p.phase)];
          k.quadB(B, a - 6, a + 6, 25, 31, 0x2a2c32);
          k.quadB(B, a - 3, a + 3, 26.5, 29, 0x6a6e78);
        });
        QUADRO_PHASE_A.forEach(a => {                                  // prese CEE blu
          k.discB(B, a, 12, 7.5, 0x1d4a9a); k.discB(B, a, 12, 6, 0x2f6fd6);
        });
        k.quadA(0, 5, 29, 4, 36, 0xcfd2d6);                             // sportello laterale
        k.discA(0, 17, 14, 7.5, 0x9e2820); k.discA(0, 17, 14, 6, 0xd6392f); // ingresso CEE rosso
        k.box(0, 0.1, 25, 28, 28, 34, ISO_GREY);                        // maniglia
        k.quadZ(Z, 6, A - 6, 4, B - 4, 0xe6e8eb);
        break;
      }
      case 'allaccio': {
        // cassetta dell'allaccio della venue: centralino verde con segnale di
        // pericolo e presa CEE trifase 400V
        const P = ALL_ISO, k = this.isoKit(g, P);
        const { A, B, Z } = P;
        k.box(0, A, 0, B, 0, Z, { top: 0x3f5540, left: 0x2c3a2c, right: 0x223022 });
        k.quadB(B, 3, A - 3, Z - 6, Z - 3, 0xf2c53d);
        k.quadA(0, 3, B - 3, 3, Z - 3, 0x263326);
        const t0 = P(0, B / 2 - 6, Z - 8), t1 = P(0, B / 2 + 6, Z - 8), t2 = P(0, B / 2, Z - 18);
        g.fillStyle(0xf2c53d, 1); g.fillTriangle(t0.x, t0.y, t1.x, t1.y, t2.x, t2.y);
        g.lineStyle(1, 0x1c1d22, 1); g.strokeTriangle(t0.x, t0.y, t1.x, t1.y, t2.x, t2.y);
        break;
      }
      case 'ciabatta': {
        // barra di prese: corpo nero lungo e basso, filetto colorato sul
        // fianco, interruttore rosso e le prese incassate nel piano
        const P = def.iso, k = this.isoKit(g, P);
        const { A, B, Z } = P;
        // cavo della spina che esce dalla testa della barra
        const c0 = P(0, B / 2, 3), c1 = P(-10, B / 2 + 8, 0);
        g.lineStyle(3, 0x17181b, 1); g.lineBetween(c0.x, c0.y, c1.x, c1.y);
        k.box(0, A, 0, B, 0, Z, ISO_BLACK);
        k.quadB(B, 2, A - 2, 2.5, 5, def.body.accent);
        k.quadZ(Z, 12, 20, 4, 12, 0xd6392f);
        def.ports.filter(p => p.dir === 'out').forEach((p, i) => k.discZ(Z, 32 + i * 30, B / 2, 7, 0x0c0d10));
        break;
      }
      case 'pc': {
        // laptop aperto: base in alluminio con tastiera e trackpad, schermo
        // inclinato all'indietro rivolto verso l'operatore
        const P = rotFrame(PC_ISO, rot), k = this.isoKit(g, P);
        const { B } = P;
        const alu = { top: 0xe4e6e9, left: 0xc9ccd0, right: 0xb4b7bc };
        k.box(0, 22, 0, B, 0, 2, alu);
        k.quadZ(2, 10, 20, 3, B - 3, 0x2a2c32);                          // tastiera
        g.lineStyle(0.5, 0x4a4d56, 1);
        for (let a = 12; a < 20; a += 2.5) { const p0 = P(a, 4, 2), p1 = P(a, B - 4, 2); g.lineBetween(p0.x, p0.y, p1.x, p1.y); }
        k.quadZ(2, 2.5, 8, B / 2 - 6, B / 2 + 6, 0xd3d6da);             // trackpad
        const lid = [P(22, 0, 2), P(22, B, 2), P(26, B, 22), P(26, 0, 22)];
        k.poly(lid, 0xd7dadd);
        const inset = (a, b, z) => P(a, b, z);
        k.poly([inset(22.4, 1.5, 3.8), inset(22.4, B - 1.5, 3.8), inset(25.6, B - 1.5, 20.4), inset(25.6, 1.5, 20.4)], 0x1c1d22);
        k.poly([inset(22.6, 3, 5.2), inset(22.6, B - 3, 5.2), inset(25.4, B - 3, 19), inset(25.4, 3, 19)], 0x1d4f86);
        k.poly([inset(22.6, 3, 5.2), inset(22.6, 11, 5.2), inset(25.4, 7, 19), inset(25.4, 3, 19)], 0xffffff, 0.08);
        g.lineStyle(0.8, 0x8a8e98, 1); g.strokePoints(lid, true);
        break;
      }
      case 'scheda': {
        // scheda audio USB da tavolo: guscio in alluminio anodizzato rosso,
        // sul fronte due ingressi combo XLR/jack con le manopole del gain e
        // l'anello luminoso, la grande manopola del volume monitor e la cuffia
        const P = rotFrame(INTF_ISO, rot), k = this.isoKit(g, P);
        const { A, B, Z } = P;
        k.box(0, A, 0, B, 0, Z, { top: 0xb23a2e, left: 0x8e2a22, right: 0x6f1f19 });
        k.quadZ(Z, 3, A - 3, 3, B - 3, 0xc0453a);
        k.quadZ(Z, 5, 22, B - 8, B - 5, 0x2a2c32);                     // serigrafia del marchio
        // fronte (faccia b=B): combo, gain con anello, monitor, cuffia
        [7, 17].forEach(a => {
          k.discB(B, a, Z / 2, 3.6, 0x1c1d22);
          k.discB(B, a, Z / 2, 2.4, 0x0c0d10);
          k.discB(B, a, Z / 2, 0.9, 0x6a6e78);
        });
        [26, 32].forEach(a => {
          k.discB(B, a, Z / 2 + 1, 2.8, 0x6fd08c);                      // anello del gain (verde = ok)
          k.discB(B, a, Z / 2 + 1, 2.1, 0x2a2c32);
        });
        k.discB(B, 39.5, Z / 2 + 0.5, 3.4, 0x0c0d10);                    // volume monitor
        k.discB(B, 39.5, Z / 2 + 0.5, 2.8, 0xb9bcc1);
        k.discB(B, 44, Z / 2 - 2.5, 1.2, 0x0c0d10);                      // cuffia
        break;
      }
      case 'di': {
        // DI passiva: scatolina d'acciaio verniciato con serigrafia e
        // interruttore ground-lift sul coperchio
        const P = DI_ISO, k = this.isoKit(g, P);
        const { A, B, Z } = P;
        k.box(0, A, 0, B, 0, Z, { top: 0x4a5566, left: 0x39424f, right: 0x2c333d });
        k.quadZ(Z, 6, 18, 3, 7, 0xdcdfe4, 0.5);
        k.box(14, 18, 12, 16, Z, Z + 2, ISO_GREY);
        k.quadZ(Z, 2, A - 2, B - 3, B - 2, def.body.accent, 0.6);
        break;
      }
      case 'mixer': {
        // banco compatto in vera prospettiva isometrica (vedi MIXER_GEO):
        // plancia leggermente inclinata verso l'operatore, ponte posteriore
        // rialzato con meter LED e schermo, e per ogni canale la striscia
        // reale dal fondo al fronte: ingresso XLR, gain, EQ, pan, mute, fader.
        const m = MIXER_GEO, P = rotFrame(MIXER_ISO, rot);
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
        // consolle luci da tavolo: display, griglia di tasti scena
        // retroilluminati e una fila di fader, piano leggermente inclinato
        const P = rotFrame(CTRL_ISO, rot), k = this.isoKit(g, P);
        const { A, B } = P;
        const zb = 10, zf = 5;                         // altezza retro/fronte
        const zAt = b => zb - (zb - zf) * b / B;
        const T = (a, b, dz = 0) => P(a, b, zAt(b) + dz);
        k.poly([P(0, 0, 0), P(0, B, 0), P(0, B, zf), P(0, 0, zb)], 0x26282e);
        k.poly([P(0, B, 0), P(A, B, 0), P(A, B, zf), P(0, B, zf)], 0x17181c);
        k.poly([T(0, 0), T(0, B), T(A, B), T(A, 0)], 0x3a3d45);
        const q = (a0, a1, b0, b1, c, dz = 0.3) => k.poly([T(a0, b0, dz), T(a1, b0, dz), T(a1, b1, dz), T(a0, b1, dz)], c);
        q(36, 52, 3, 11, 0x0c0d10);                    // display
        q(37.5, 50.5, 4.2, 9.8, 0x1d4f86);
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 6; c++) {
            const a = 5 + c * 5, b = 4 + r * 5;
            q(a, a + 3, b, b + 3, (r === 0 && c === 1) || (r === 1 && c === 4) ? 0xf2a541 : 0x55585f);
          }
        }
        for (let c = 0; c < 6; c++) {                  // fader
          const a = 6 + c * 5;
          const f0 = T(a + 1.5, 16), f1 = T(a + 1.5, 30);
          g.lineStyle(1, 0x0c0d10, 1); g.lineBetween(f0.x, f0.y, f1.x, f1.y);
          const fb = 18 + ((c * 5) % 9);
          q(a, a + 3, fb, fb + 2, 0xdcdfe4, 1.5);
        }
        q(38, 52, 16, 30, 0x2a2c33);
        k.discZ(zAt(23) + 0.5, 45, 23, 4.2, 0x0c0d10);  // encoder
        k.discZ(zAt(23) + 1.5, 45, 23, 3.2, 0x5a5e68);
        k.poly([P(0, B, zf), P(A, B, zf), P(A, B, zf - 1), P(0, B, zf - 1)], def.body.accent);
        g.lineStyle(1, 0x0c0d10, 0.85);
        g.strokePoints([P(0, 0, zb), P(0, 0, 0), P(0, B, 0), P(A, B, 0), P(A, B, zf), P(A, 0, zb)], true);
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
    // ordine di disegno per profondità isometrica: chi sta più in basso
    // sullo schermo è più vicino e copre chi sta dietro
    const c = this.add.container(x, y).setDepth(isoDepth(y));

    const body = this.add.graphics();
    // il PAR guarda il palco dal suo stativo; gli altri seguono orientK
    const rot = def.shape === 'par' ? parRot(id) : orientK(def, x, y);
    this.drawComponentBody(body, def, rot);
    // punti di aggancio dei cavi e LED, ruotati insieme al dispositivo
    const frame = def.frame ? rotFrame(def.frame, rot) : null;
    const portPos = {};
    def.ports.forEach(p => {
      const q = (frame && p.iso) ? frame(...p.iso) : { x: p.dx, y: p.dy };
      portPos[p.id] = { dx: Math.round(q.x), dy: Math.round(q.y) };
    });
    const ledPos = (frame && def.ledIso) ? frame(...def.ledIso) : def.ledPos;
    // punti di aggancio dei cavi: piccole prese appena accennate sul corpo,
    // la presa vera si sceglie nel pannello posteriore
    def.ports.forEach(p => {
      const q = portPos[p.id];
      body.fillStyle(0x0c0d10, 1); body.fillCircle(q.dx, q.dy, 3);
      body.lineStyle(1.2, SIGNAL_COLOR[p.signal], 0.9); body.strokeCircle(q.dx, q.dy, 3);
    });
    c.add(body);

    const glow = this.add.graphics();
    c.add(glow);

    const compType = id.indexOf('_') >= 0 ? id.split('_')[0] : id;
    // 'allaccio' condivide shape:'quadro' con il vero Quadro (stesso stile
    // grafico), ma qui sotto contano solo le regole del Quadro vero e proprio.
    const isRealQuadro = compType === 'quadro';

    // LED di stato, in tempo reale: verde solo se il dispositivo è acceso e
    // la corrente (o il segnale, per Testa e DI) arriva davvero — vedi
    // isLedOn/refreshLive.
    // L'Allaccio è la sorgente fissa: non ha bisogno di un proprio LED.
    let led = null;
    if (compType !== 'allaccio' && def.ports.length) {
      led = this.add.graphics();
      c.add(led);
      this.drawLed(led, def, false, ledPos);
    }

    // sotto il dispositivo solo il conteggio delle prese collegate (es. "2/4"):
    // il nome si legge nel pannello, in scena sarebbe una scritta in più
    const idLabel = this.add.text(0, def.body.h / 2 + 12, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#8b8e98'
    }).setOrigin(0.5);
    c.add(idLabel);

    // Bersaglio per interagire col componente: l'INTERO corpo (con un margine
    // extra), non la sola etichetta o le minuscole porte — molto più facile
    // da toccare su schermi piccoli. Il comportamento dipende dalla modalità:
    //  - modalità cablaggio -> il tocco apre il pannello posteriore del
    //    dispositivo, dove si sceglie la presa (vale per QUALUNQUE componente,
    //    anche Quadro e Testa, che non si spostano ma vanno comunque cablati);
    //  - nessun cavo selezionato -> il tocco seleziona il componente per
    //    spostarlo (solo per i tipi che si possono spostare).
    // Così, mentre si cablano i cavi, toccare un componente non fa MAI
    // scattare per sbaglio lo spostamento.
    const pad = 8;
    body.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-def.body.w / 2 - pad, -def.body.h / 2 - pad, def.body.w + pad * 2, def.body.h + pad * 2),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true
    });
    // tocco breve = pannello posteriore; pressione lunga = montaggio
    // (vedi onDevicePress / onScenePointerMove / onScenePointerUp)
    body.on('pointerdown', (pointer, lx, ly, event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      if (pointer.rightButtonDown()) return;
      // un pezzo "armato" dalla barra si posa anche toccando sopra un dispositivo
      if (gameState.selectedPieceType) { this.placeArmedPieceAt(pointer.worldX, pointer.worldY); return; }
      this.onDevicePress(this.pickDeviceAt(pointer.worldX, pointer.worldY, 0) || id, pointer);
    });

    let phaseBars = null;
    if (isRealQuadro) {
      phaseBars = this.add.graphics();
      c.add(phaseBars);
      // sigla della fase nella finestra degli interruttori, sopra la presa
      def.ports.filter(p => p.phase).forEach(p => {
        const at = QUADRO_ISO(QUADRO_PHASE_A[['L1', 'L2', 'L3'].indexOf(p.phase)], QUADRO_ISO.B, 34.5);
        const tag = this.add.text(at.x, at.y, p.phase, {
          fontFamily: 'Inter, sans-serif', fontSize: '8px', fontStyle: 'bold', color: '#eee9df'
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

    return { container: c, glow, idLabel, def, phaseBars, led, portPos, ledPos, rot };
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
  drawLed (g, def, on, pos) {
    pos = pos || def.ledPos;
    const x = pos ? pos.x : -def.body.w / 2 + 7;
    const y = pos ? pos.y : -def.body.h / 2 + 9;
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
    this.drawLed(v.led, v.def, on, v.ledPos);
  }

  /* ---------------- conversioni coordinate ---------------- */
  clientToWorld (clientX, clientY) {
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = GAME_W / rect.width, scaleY = GAME_H / rect.height;
    const localX = (clientX - rect.left) * scaleX, localY = (clientY - rect.top) * scaleY;
    return this.cameras.main.getWorldPoint(localX, localY);
  }

  /* posto per un pezzo vicino a un punto del mondo: tutte le sue celle nella
     zona giusta e libere (ignoreId: il pezzo che si sta spostando). Prima si
     prova la cella toccata, poi la più vicina. Restituisce origine, ingombro,
     verso e centro sullo schermo, o null se non c'è posto. */
  findSpot (type, wx, wy, ignoreId) {
    const def = COMPONENT_TYPES[type];
    const pred = ZONE_PREDICATES[type] || (() => true);
    const raw = screenToCell(wx, wy);
    const target = { gx: raw.cx + CELL / 2, gy: raw.cy + CELL / 2 };
    const free = k => !this.occupied[k] || this.occupied[k] === ignoreId;
    let best = null, bestDist = Infinity;
    for (let gx = 0; gx < VENUE_W; gx += CELL) {
      for (let gy = 0; gy < VENUE_H; gy += CELL) {
        // verso e ingombro dipendono da dove finisce (in FOH si gira)
        const probe = gridToScreen(gx + CELL / 2, gy + CELL / 2);
        const rot = orientK(def, probe.x, probe.y);
        const f = footprint(type, rot);
        const cells = footCells(gx, gy, f);
        if (cells.some(([x, y]) => x >= VENUE_W || y >= VENUE_H || !pred(x, y) || !free(cellKey(x, y)))) continue;
        const cgx = gx + f[0] * CELL / 2, cgy = gy + f[1] * CELL / 2;
        const d = Math.hypot(cgx - target.gx, cgy - target.gy);
        if (d < bestDist - 1e-9) { bestDist = d; best = { gx, gy, foot: f, keys: cells.map(([x, y]) => cellKey(x, y)), pos: gridToScreen(cgx, cgy) }; }
      }
    }
    return best;
  }

  /* ---------------- anteprima durante il trascinamento dalla toolbar ---------------- */
  previewDropCell (clientX, clientY) {
    this.previewCellAt(window.__draggedType, this.clientToWorld(clientX, clientY));
  }

  previewCellAt (type, world) {
    this.previewGraphics.clear();

    if (MOUNTS[type]) {
      const base = this.nearestFreeBase(type, world);
      if (base) {
        const v = this.compVisuals[base.id];
        this.previewGraphics.lineStyle(3, 0x49b06a, 0.9);
        this.previewGraphics.strokeCircle(v.container.x, v.container.y, 34);
      }
      return;
    }

    const spot = type ? this.findSpot(type, world.x, world.y, null) : null;
    const raw = screenToCell(world.x, world.y);
    const gx = spot ? spot.gx : raw.cx, gy = spot ? spot.gy : raw.cy, f = spot ? spot.foot : [1, 1];
    const p0 = gridToScreen(gx, gy), p1 = gridToScreen(gx + f[0] * CELL, gy),
          p2 = gridToScreen(gx + f[0] * CELL, gy + f[1] * CELL), p3 = gridToScreen(gx, gy + f[1] * CELL);
    this.previewGraphics.fillStyle(spot ? 0x49b06a : 0xe0503f, 0.35);
    this.previewGraphics.lineStyle(2, spot ? 0x49b06a : 0xe0503f, 0.95);
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

    if (MOUNTS[type]) { this.attachToNearestBase(type, { x: worldX, y: worldY }); return; }

    const spot = this.findSpot(type, worldX, worldY, null);
    if (!spot) { showToast('Non c\'è più posto per ' + COMPONENT_TYPES[type].label + ' nella sua zona: libera un po\' di spazio.'); return; }
    const cx = spot.gx, cy = spot.gy;

    const idx = gameState.nextIndex[type]++;
    const id = `${type}_${idx}`;
    gameState.stock[type]--;
    updateStockUI();

    const pos = spot.pos;
    const def = COMPONENT_TYPES[type];
    spot.keys.forEach(k => { this.occupied[k] = id; });


    // "sul palco" (instradamento cavi diretto) vale per QUALSIASI cella del
    // complesso palco, non solo la pedana spettacolo — include quindi anche
    // la fascia Off Stage, che è alla stessa quota.
    const zone = isStageCell(cx, cy) ? 'stage' : 'ground';
    gameState.placed[id] = { id, type, gx: cx, gy: cy, foot: spot.foot, cells: spot.keys, screen: pos, zone };
    if (MOUNT_ON[type]) gameState.placed[id][MOUNTS[MOUNT_ON[type]].link] = null;   // base libera
    this.compVisuals[id] = this.buildComponentVisual(id, def, pos.x, pos.y);

    this.updateQuadroVisual();
    setCircuitStatus('untested');
    gameState.tested = false;
    this.pushHistory();
    SFX.place();
    // la prima volta si spiega come si usa un dispositivo posato
    if (!this.gestureHintShown) {
      this.gestureHintShown = true;
      showToast('Tocca un dispositivo per aprire il suo pannello · tienilo premuto per spostarlo o toglierlo.', 'ok');
    }
  }

  /* piazza il pezzo attualmente "armato" dalla toolbar nel punto toccato sulla
     pedana; resta armato per piazzamenti multipli finché non finisce la scorta */
  placeArmedPieceAt (worldX, worldY) {
    const type = gameState.selectedPieceType;
    if (!type) return;
    this.placeComponentAt(type, worldX, worldY);
    if (gameState.stock[type] <= 0) disarmPiece();
  }

  // base libera più vicina a un punto (sub per la testa, stativo per il PAR)
  nearestFreeBase (type, world) {
    const m = MOUNTS[type];
    let best = null, bestDist = Infinity;
    Object.values(gameState.placed).forEach(c => {
      if (c.type !== m.base || c[m.link]) return;
      const v = this.compVisuals[c.id];
      const d = Phaser.Math.Distance.Between(world.x, world.y, v.container.x, v.container.y);
      if (d < bestDist) { bestDist = d; best = c; }
    });
    return best && bestDist <= TOP_ATTACH_RADIUS ? best : null;
  }
  // posizione e profondità di un pezzo montato: sopra la sua base, davanti a lei
  mountPos (type, base) {
    const bv = this.compVisuals[base.id];
    return { x: bv.container.x, y: bv.container.y + MOUNTS[type].offsetY(), depth: isoDepth(bv.container.y) + 0.001 };
  }

  attachToNearestBase (type, world) {
    const m = MOUNTS[type];
    const base = this.nearestFreeBase(type, world);
    if (!base) { showToast(m.missing); return; }

    const idx = gameState.nextIndex[type]++;
    const id = type + '_' + idx;
    gameState.stock[type]--;
    updateStockUI();

    const at = this.mountPos(type, base);
    const pos = { x: at.x, y: at.y };
    base[m.link] = id;
    gameState.placed[id] = { id, type, [m.back]: base.id, zone: base.zone, screen: pos };
    if (type === 'par') gameState.placed[id].dmx = { addr: 1, mode: 1 };   // indirizzo/modalità DMX dal display
    const visual = this.buildComponentVisual(id, COMPONENT_TYPES[type], pos.x, pos.y);
    visual.container.setDepth(at.depth);
    this.compVisuals[id] = visual;

    this.updateQuadroVisual();
    setCircuitStatus('untested');
    gameState.tested = false;
    SFX.place();
    showToast(m.done(base.id), 'ok');
    this.pushHistory();
  }

  /* ---------------- wiring ---------------- */
  handlePortClick (componentId, portId, signal) {
    this.clearMoveSelection();
    this.clearEdgeSelection();
    disarmPiece();
    if (!gameState.selectedCable) { showToast('Prendi prima un cavo da un baule (scheda Cavi).'); return; }
    const cableKind = CABLE_TYPES[gameState.selectedCable];
    if (!cableKind.endpoints.includes(signal)) { showToast('Questo cavo non entra in questa presa.'); return; }

    if (!gameState.pendingPort) {
      gameState.pendingPort = { componentId, portId };
      this.highlightPending(componentId, portId, true);
      SFX.cableIn(signal);
      return;
    }
    const pending = gameState.pendingPort;
    if (pending.componentId === componentId && pending.portId === portId) { this.cancelPending(); return; }
    if (pending.componentId === componentId) { showToast('Non puoi collegare un dispositivo a se stesso.'); return; }

    const pendingDef = getPortDef(pending.componentId, pending.portId);
    const currentDef = getPortDef(componentId, portId);
    if (!pendingDef || !currentDef) { this.cancelPending(); return; }

    // un adattatore (2 endpoint diversi, es. CEE/PowerCON) collega solo
    // connettori DIVERSI tra loro: due porte uguali vogliono il cavo semplice.
    if (cableKind.endpoints.length === 2 && pendingDef.signal === currentDef.signal) {
      showToast('Questo è un adattatore: collega due connettori diversi. Per due prese uguali serve il cavo semplice.');
      return;
    }

    if (pendingDef.dir === currentDef.dir) {
      showToast(pendingDef.dir === 'out'
        ? 'Due uscite non si collegano tra loro: serve una presa IN.'
        : 'Due ingressi non si collegano tra loro: serve una presa OUT.');
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
      showToast('Questa presa è già occupata da un altro cavo: scegline una libera.');
      return;
    }

    if (wouldCreateCycle(outSide.componentId, inSide.componentId, gameState.selectedCable)) {
      showToast('Questo collegamento richiuderebbe un anello nel circuito: non è consentito.');
      return;
    }

    const edge = {
      id: gameState.edgeSeq++,
      a: outSide.componentId, aPort: outSide.portId,
      b: inSide.componentId, bPort: inSide.portId,
      signal: gameState.selectedCable
    };
    // collegare sotto tensione fa scattare il salvavita; altrimenti il
    // dispositivo appena alimentato (se già acceso) parte davvero
    const rcdBefore = gameState.rcdTrips || 0;
    applyPowerAction(() => { gameState.edges.push(edge); checkLiveCableChange(edge); });
    if ((gameState.rcdTrips || 0) === rcdBefore) SFX.cableIn(signal);
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
      // a ogni capo del cavo la sua spina, infilata nel dispositivo
      [from, to].forEach(pt => {
        this.edgeGraphics.fillStyle(0x17181b, alpha);
        this.edgeGraphics.fillCircle(pt.x, pt.y, 4.6);
        this.edgeGraphics.lineStyle(1.8, color, alpha);
        this.edgeGraphics.strokeCircle(pt.x, pt.y, 4.6);
      });
      // verso del cavo: freccia a metà percorso, dall'OUT (a) all'IN (b).
      // Sul cavo selezionato al suo posto c'è il pulsante ✕.
      if (!isSelected) this.drawFlowArrow(pts, color, alpha);
    });
    this.refreshEdgeDeleteButton();
    this.updateConnectionBadges();
    this.refreshLive();
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

  // sotto ogni dispositivo: quante delle sue prese sono collegate (es. "2/4")
  updateConnectionBadges () {
    Object.values(gameState.placed).forEach(c => {
      const v = this.compVisuals[c.id];
      if (!v || !v.idLabel) return;
      const ports = v.def.ports;
      if (!ports.length) return;                       // stativo: niente prese
      const used = ports.filter(p => edgesOnPort(c.id, p.id).length > 0).length;
      v.idLabel.setText(used + '/' + ports.length);
      v.idLabel.setColor(used === ports.length ? '#49b06a' : '#8b8e98');
    });
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
    showToast('Cavo selezionato: tocca la ✕ per toglierlo (o premi Canc), tocca altrove per deselezionarlo.');
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
    let arced = false;
    const idx = gameState.edges.findIndex(e => e.id === this.selectedEdgeId);
    if (idx >= 0) {
      // scollegare sotto tensione fa l'arco: salvavita
      const edge = gameState.edges[idx];
      applyPowerAction(() => { arced = checkLiveCableChange(edge); gameState.edges.splice(gameState.edges.indexOf(edge), 1); });
      if (!arced) SFX.cableOut(CABLE_TYPES[edge.signal].endpoints[0]);
    }
    this.selectedEdgeId = null;
    this.redrawEdges();
    setCircuitStatus('untested');
    gameState.tested = false;
    if (!arced) showToast('Cavo eliminato.', 'ok');
    this.pushHistory();
  }

  /* ---------------- livelli: filtro di visibilità per tipo di cavo ---------------- */
  applyLayerVisibility () {
    this.selectedEdgeId = null;
    this.redrawEdges();
  }

  // punto di aggancio del cavo: la posizione della porta sul corpo isometrico
  // (non disegnata: le prese si vedono solo nel pannello posteriore)
  getPortScreenPos (componentId, portId) {
    const v = this.compVisuals[componentId];
    if (!v) return null;
    const p = v.portPos && v.portPos[portId];
    if (!p) return null;
    return { x: v.container.x + p.dx * v.container.scaleX, y: v.container.y + p.dy * v.container.scaleY };
  }

  // il dispositivo da cui parte il cavo in mano resta cerchiato in arancione
  highlightPending (componentId, portId, on) {
    const v = this.compVisuals[componentId];
    if (v) this.setGlow(v, on, 0xf2a541);
  }

  cancelPending () {
    if (!gameState.pendingPort) return;
    this.highlightPending(gameState.pendingPort.componentId, gameState.pendingPort.portId, false);
    gameState.pendingPort = null;
  }

  clearPendingHighlight () { this.cancelPending(); }

  /* ---------------- riposizionamento componenti già piazzati ---------------- */
  /* ---------------- tocco / pressione lunga su un dispositivo ---------------- */
  /* dispositivi sotto o vicino a un punto del mondo, dal più vicino:
     distanza dal loro disegno in pixel di schermo, entro slopPx */
  devicesNear (wx, wy, slopPx) {
    const cam = this.cameras.main;
    const rc = this.game.canvas.getBoundingClientRect();
    const k = cam.zoom * (rc.width / GAME_W);   // pixel CSS per unità di mondo
    const out = [];
    Object.keys(gameState.placed).forEach(id => {
      const v = this.compVisuals[id];
      if (!v || !v.def || !v.def.body) return;
      const c = v.container;
      const hw = (v.def.body.w / 2) * Math.abs(c.scaleX), hh = (v.def.body.h / 2) * Math.abs(c.scaleY);
      const dx = Math.max(0, Math.abs(wx - c.x) - hw), dy = Math.max(0, Math.abs(wy - c.y) - hh);
      const edge = Math.hypot(dx, dy) * k;
      if (edge <= slopPx) out.push({ id, edge, center: Math.hypot(wx - c.x, wy - c.y) * k });
    });
    return out.sort((x, y) => x.edge - y.edge || x.center - y.center);
  }
  pickDeviceAt (wx, wy, slopPx) {
    const c = this.devicesNear(wx, wy, slopPx + 8);
    return c.length ? c[0].id : null;
  }

  /* tocco breve: apre il pannello del dispositivo toccato. Se il dito è
     davvero a metà tra due o più dispositivi non si tira a indovinare:
     compare un menu "Quale?" con i loro nomi. */
  openPanelAt (wx, wy, fallbackId) {
    const c = this.devicesNear(wx, wy, TOUCH_SLOP_PX + 8);
    if (!c.length) { if (fallbackId) openRearPanel(fallbackId); return !!fallbackId; }
    const first = c[0];
    const close = c.filter(x => x.id !== first.id && (
      first.edge > 0 ? x.edge - first.edge < 6 : (x.edge === 0 && x.center < first.center * 1.35 + 4)));
    if (!close.length) { openRearPanel(first.id); return true; }
    this.showPickMenu([first, ...close].slice(0, 4).map(x => x.id), wx, wy);
    return true;
  }
  showPickMenu (ids, wx, wy) {
    const cam = this.cameras.main, rc = this.game.canvas.getBoundingClientRect();
    const px = rc.left + (wx - cam.worldView.x) * cam.zoom * rc.width / GAME_W;
    const py = rc.top + (wy - cam.worldView.y) * cam.zoom * rc.height / GAME_H;
    ids.forEach(id => { const v = this.compVisuals[id]; if (v) this.setGlow(v, true, 0x4aa3ff); });
    const menu = el('#pick-menu');
    const box = menu.querySelector('.pick-box');
    box.innerHTML = '<div class="pick-title">Quale?</div>' + ids.map(id =>
      `<button class="pick-opt" data-id="${id}">${escapeHtml(compLabel(id))}</button>`).join('');
    menu.classList.add('show');
    setSceneInput(false);
    const bw = box.offsetWidth, bh = box.offsetHeight;
    box.style.left = Math.max(8, Math.min(window.innerWidth - bw - 8, px - bw / 2)) + 'px';
    box.style.top = Math.max(8, Math.min(window.innerHeight - bh - 8, py - bh - 18)) + 'px';
    const done = id => {
      menu.classList.remove('show');
      ids.forEach(i => { const v = this.compVisuals[i]; if (v && i !== this.assemblyId) this.setGlow(v, false); });
      setTimeout(() => { if (!rearPanelId && !openCaseName) setSceneInput(true); }, 0);
      if (id) openRearPanel(id);
    };
    box.querySelectorAll('.pick-opt').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); SFX.button(); done(b.dataset.id); }));
    menu.onclick = ev => { if (ev.target === menu) done(null); };
  }

  onDevicePress (id, pointer) {
    if (this.press && this.press.timer) clearTimeout(this.press.timer);
    const inAssembly = this.assemblyId === id;
    this.press = { id, x: pointer.x, y: pointer.y, wx: pointer.worldX, wy: pointer.worldY, moved: false, long: inAssembly, timer: null };
    if (!inAssembly) {
      // timer del browser: non dipende dal ritmo dei fotogrammi del gioco
      this.press.timer = setTimeout(() => {
        if (!this.press || this.press.id !== id || this.press.moved) return;
        this.press.long = true;
        this.enterAssembly(id);
      }, LONG_PRESS_MS);
    }
  }

  // trascinamento di un dispositivo in montaggio: anteprima della cella
  onScenePointerMove (pointer) {
    const pr = this.press;
    if (!pr || !pointer.isDown) return false;
    if (!pr.moved && Phaser.Math.Distance.Between(pointer.x, pointer.y, pr.x, pr.y) > 8) {
      pr.moved = true;
      if (!pr.long && pr.timer) { clearTimeout(pr.timer); pr.timer = null; }
    }
    if (pr.moved && pr.long && this.assemblyId === pr.id) {
      const comp = gameState.placed[pr.id];
      if (comp && !MOUNTS[comp.type] && comp.type !== 'allaccio') {
        this.previewCellAt(comp.type, { x: pointer.worldX, y: pointer.worldY });
      }
      return true;
    }
    return false;
  }

  onScenePointerUp (pointer) {
    const pr = this.press;
    if (!pr) return;
    this.press = null;
    if (pr.timer) clearTimeout(pr.timer);
    if (pr.long) {
      // lasciato dopo averlo trascinato: si sposta nella nuova cella
      if (pr.moved && this.assemblyId === pr.id) {
        this.clearDropPreview();
        const comp = gameState.placed[pr.id];
        if (comp && !MOUNTS[comp.type] && comp.type !== 'allaccio') {
          this.moveSelected = pr.id;
          this.attemptMoveTo(pointer.worldX, pointer.worldY);
          this.enterAssembly(pr.id, true);   // resta in montaggio nella nuova posizione
        }
      }
      return;
    }
    if (pr.moved) return;
    // tocco breve: pannello posteriore (o "Quale?" se il tocco è ambiguo)
    if (this.assemblyId) this.exitAssembly();
    this.openPanelAt(pr.wx, pr.wy, pr.id);
  }

  /* modalità montaggio: il dispositivo ondeggia e mostra la ✕ per toglierlo;
     trascinandolo si sposta. Allaccio e Testa non si spostano (la Testa si
     può solo togliere). */
  enterAssembly (id, quiet) {
    const comp = gameState.placed[id];
    const v = this.compVisuals[id];
    if (!comp || !v) return;
    if (comp.type === 'allaccio') { showToast('L\'allaccio della venue è fisso: non si sposta e non si toglie.'); return; }
    this.exitAssembly();
    this.cancelPending();
    this.clearEdgeSelection();
    disarmPiece();
    this.assemblyId = id;
    this.moveSelected = null;
    if (!quiet) SFX.lift();
    this.setGlow(v, true, 0xf2a541);
    this.assemblyTween = this.tweens.add({ targets: v.container, angle: { from: -1.6, to: 1.6 }, duration: 110, yoyo: true, repeat: -1 });
    if (navigator.vibrate) navigator.vibrate(25);
    // la ✕ resta toccabile (≈26px) a qualunque zoom, appena fuori
    // dall'angolo del dispositivo così non lo copre
    const rc = this.game.canvas.getBoundingClientRect();
    const k = this.cameras.main.zoom * (rc.width / GAME_W);
    const hs = Math.max(1, 13 / (12 * k));
    const hx = v.container.x + (-v.def.body.w / 2) * v.container.scaleX - 11 * hs;
    const hy = v.container.y + (-v.def.body.h / 2) * v.container.scaleY - 11 * hs;
    const handle = this.add.container(hx, hy).setDepth(70).setScale(hs);
    const bg = this.add.circle(0, 0, 12, 0xe0503f, 1).setStrokeStyle(2, 0xffffff, 0.9).setInteractive({ useHandCursor: true });
    handle.add(bg);
    handle.add(this.add.text(0, 0, '✕', { fontFamily: 'Inter, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5));
    bg.on('pointerdown', (pointer, lx, ly, event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      this.deleteComponent(id);
    });
    this.assemblyHandle = handle;
    if (!quiet) showToast(MOUNTS[comp.type]
      ? 'Montaggio: tocca la ✕ per togliere ' + (comp.type === 'top' ? 'la testa dal palo' : 'il PAR dallo stativo') + '. Tocca il pavimento per finire.'
      : 'Montaggio: trascina per spostare, tocca la ✕ per togliere. Tocca il pavimento per finire.');
  }

  exitAssembly () {
    if (this.assemblyTween) { this.assemblyTween.stop(); this.assemblyTween = null; }
    if (this.assemblyHandle) { this.assemblyHandle.destroy(); this.assemblyHandle = null; }
    const v = this.assemblyId && this.compVisuals[this.assemblyId];
    if (v) { v.container.setAngle(0); this.setGlow(v, false); }
    this.assemblyId = null;
    this.moveSelected = null;
    this.clearDropPreview();
  }

  /* toglie un dispositivo: spariscono anche i suoi cavi (senza far scattare
     nulla) e il pezzo torna nella barra; un Sub si porta via la sua Testa,
     uno stativo il suo PAR */
  deleteComponent (id) {
    const comp = gameState.placed[id];
    if (!comp) return;
    this.exitAssembly();
    const ids = [id];
    const child = mountedOn(comp), base = mountBase(comp);
    if (child) ids.push(child.id);                                  // col sub va via la testa, con lo stativo il PAR
    if (base) base[MOUNTS[comp.type].link] = null;
    const lost = gameState.edges.filter(e => ids.includes(e.a) || ids.includes(e.b)).length;
    const name = COMPONENT_TYPES[comp.type].label;
    applyPowerAction(() => {
      gameState.edges = gameState.edges.filter(e => !ids.includes(e.a) && !ids.includes(e.b));
      ids.forEach(did => {
        const c = gameState.placed[did];
        (c.cells || []).forEach(k => { delete this.occupied[k]; });
        const v = this.compVisuals[did];
        if (v) v.container.destroy();
        delete this.compVisuals[did];
        delete gameState.placed[did];
        gameState.stock[c.type]++;
      });
    });
    updateStockUI();
    updatePowerMeter();
    this.updateQuadroVisual();
    this.redrawEdges();
    setCircuitStatus('untested');
    gameState.tested = false;
    SFX.remove();
    showToast(name + ' tolto e rimesso tra i pezzi' + (lost ? ', insieme ai suoi ' + lost + ' cavi' : '') + '.', 'ok');
    this.pushHistory();
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
    // un pezzo montato (testa, PAR) si sposta solo insieme alla sua base
    if (!comp || MOUNTS[comp.type]) { this.moveSelected = null; return; }

    const spot = this.findSpot(comp.type, worldX, worldY, id);
    if (!spot) { showToast('Lì non c\'è posto: scegli uno spazio libero nella sua zona.'); return; }
    const cx = spot.gx, cy = spot.gy;

    (comp.cells || []).forEach(k => { delete this.occupied[k]; });
    spot.keys.forEach(k => { this.occupied[k] = id; });
    comp.gx = cx; comp.gy = cy; comp.foot = spot.foot; comp.cells = spot.keys;
    comp.zone = isStageCell(cx, cy) ? 'stage' : 'ground';   // per il percorso dei cavi
    const pos = spot.pos;
    comp.screen = pos;
    this.compVisuals[id].container.setPosition(pos.x, pos.y).setDepth(isoDepth(pos.y));
    // PC e scheda audio cambiano verso tra quinta e FOH: si ridisegnano
    const def = COMPONENT_TYPES[comp.type];
    if (def.front && orientK(def, pos.x, pos.y) !== this.compVisuals[id].rot) {
      this.compVisuals[id].container.destroy();
      this.compVisuals[id] = this.buildComponentVisual(id, def, pos.x, pos.y);
    }

    const child = mountedOn(comp);
    if (child) {
      // il pezzo montato segue la sua base e sta subito davanti a lei; il
      // PAR si ridisegna perché cambia verso col ruolo dello stativo
      const at = this.mountPos(child.type, comp);
      child.screen = { x: at.x, y: at.y };
      child.zone = comp.zone;
      if (child.type === 'par') {
        this.compVisuals[child.id].container.destroy();
        this.compVisuals[child.id] = this.buildComponentVisual(child.id, COMPONENT_TYPES.par, at.x, at.y);
      }
      this.compVisuals[child.id].container.setPosition(at.x, at.y).setDepth(at.depth);
    }

    this.clearMoveSelection();
    this.redrawEdges();
    setCircuitStatus('untested');
    gameState.tested = false;
    SFX.place();
    showToast('Dispositivo spostato.', 'ok');
    this.pushHistory();
  }

  /* ---------------- TEST IMPIANTO: collaudo tecnico (potenza + segnale + PC di
     regia), prima ancora che arrivino i musicisti. Il vero soundcheck con gli
     strumenti è una fase successiva, separata da questa.
     Il test non dice più cosa manca: lo fa VEDERE e SENTIRE, con un
     piccolissimo suggerimento a parole.
     - corrente: scintille dal Quadro;
     - audio: l'impianto gracchia e le casse tremano;
     - luci: i PAR con corrente vanno in tilt (colori a caso e strobo);
     - tutto ok: cala la notte e parte lo show (10 secondi).
     L'ordine conta: senza corrente non si può giudicare il resto. ---------------- */
  runSystemTest () {
    this.stopFx();
    const result = runValidation();
    gameState.tested = true;
    Object.values(this.compVisuals).forEach(v => this.setGlow(v, false));
    this.refreshLive();

    const q = findQuadro();
    const prot = q ? quadroProt(q) : null;
    // deve funzionare tutto ciò che serve: le utenze del livello, la scheda
    // (alimentata dal PC) e le ciabatte solo se ci è attaccato qualcosa.
    // Chi ha già un cavo mancante lo dirà il suo impianto (audio o luci).
    const inUse = c => !/^ciabatta/.test(c.type) || gameState.edges.some(e => e.a === c.id && POWER_CABLE_IDS.has(e.signal));
    const notRunning = Object.values(gameState.placed)
      .filter(c => c.type !== 'allaccio' && (powerInPort(COMPONENT_TYPES[c.type]) || COMPONENT_TYPES[c.type].busPowered) && inUse(c) && !isRunning(c.id) && !result.failedComponents.has(c.id));
    // protezioni che servono davvero: generale, salvavita e le sole fasi usate
    const usedPhases = new Set(Object.keys(gameState.placed).map(id => phaseOf(id)).filter(Boolean));
    const needed = ['main', 'rcd', ...['L1', 'L2', 'L3'].filter(ph => usedPhases.has(ph))];
    const armed = !!prot && needed.every(k => prot[k]);
    const missing = cat => result.missingCats.has(cat);
    const toPlace = cat => result.toPlaceCats.has(cat);

    gameState.stats.tests++;
    const fail = (kind, hint) => {
      gameState.stats.failedTests++;
      saveLevel();
      setCircuitStatus('error');
      if (kind === 'power') { showToast('Scintille! ' + hint); this.fxSparks(); }
      else if (kind === 'audio') { showToast('L\'impianto gracchia: ' + hint); this.fxCrackle(); }
      else { showToast('Le luci vanno in tilt: ' + hint); this.fxLightsTilt(); }
    };

    // corrente
    if (result.overPhase) return fail('power', 'Una fase è troppo carica.');
    if (result.overBudget) return fail('power', 'Chiedi troppa potenza.');
    if (missing('power')) return fail('power', toPlace('power') ? 'Manca ancora un pezzo da posare.' : 'Qualcuno non arriva al Quadro.');
    if (!armed) return fail('power', 'Il Quadro è davvero armato?');
    if (notRunning.length) return fail('power', 'Qualcosa è ancora spento.');
    // audio
    if (missing('audio') || !result.allSubsTopsPlaced) return fail('audio', toPlace('audio') || !result.allSubsTopsPlaced ? 'manca ancora un pezzo da posare.' : 'il segnale si perde per strada.');
    if (stereoCheck()) return fail('audio', 'destra e sinistra si sono scambiate.');
    // luci
    if (missing('lights')) return fail('lights', toPlace('lights') ? 'manca ancora un pezzo da posare.' : 'qualche PAR non sente la consolle.');
    const lights = lightingCheck();
    if (lights) return fail('lights', lights.msg);
    if (dmxOverlaps().length) return fail('lights', 'due PAR si pestano i piedi sull\'indirizzo.');

    setCircuitStatus('ok');
    // la procedura conta: un solo suggerimento, il primo inciampo
    const pops = (gameState.procErrors || []).filter(x => x === 'pop').length;
    const tip = gameState.trips ? 'la prossima volta accendi i pesanti uno alla volta.'
      : gameState.rcdTrips ? 'la prossima volta cabla a impianto spento.'
      : pops ? 'la prossima volta accendi finali e sub per ultimi.'
      : null;
    this.repGain = gameActive ? addRecord() : 0;
    showToast('Impianto collaudato, si va in scena! ' + (tip ? 'Piccolo consiglio: ' + tip : 'Procedura perfetta.')
      + (this.repGain ? ' Reputazione +' + this.repGain + '.' : gameActive ? ' Reputazione invariata: hai già fatto di meglio.' : ''), 'ok');
    saveLevel();
    this.playSuccessSequence();
  }

  /* ---------------- effetti del Test impianto ----------------
     Tutto quello che crea un effetto (oggetti, timer, tween, suoni) passa da
     qui, così un nuovo test, un reset o una modifica all'impianto lo fermano
     di colpo e rimettono i dispositivi com'erano. */
  fxStart () {
    this.stopFx();
    this.fx = { objs: [], timers: [], tweens: [], stops: [], restore: [] };
    if (this.liveBeams) this.liveBeams.clear();
    return this.fx;
  }
  fxLater (ms, fn) { const t = this.time.delayedCall(ms, fn); this.fx.timers.push(t); return t; }
  fxEvery (ms, times, fn, onEnd) {
    let n = 0;
    const t = this.time.addEvent({ delay: ms, repeat: times - 1, callback: () => { fn(n++); if (n === times && onEnd) onEnd(); } });
    this.fx.timers.push(t); return t;
  }
  fxTween (cfg) { const t = this.tweens.add(cfg); this.fx.tweens.push(t); return t; }
  fxObj (o) { this.fx.objs.push(o); return o; }
  // un dispositivo mosso da un effetto torna al suo posto alla fine
  fxHold (v) {
    const c = v.container, s = { x: c.x, y: c.y, sx: c.scaleX, sy: c.scaleY, a: c.angle };
    this.fx.restore.push(() => {
      if (!c.scene) return;
      // se nel frattempo è stato spostato davvero, resta dov'è ora
      if (Math.abs(c.x - s.x) < 10 && Math.abs(c.y - s.y) < 10) c.setPosition(s.x, s.y);
      c.setScale(s.sx, s.sy).setAngle(s.a);
      this.setGlow(v, false);
    });
    return s;
  }
  stopFx () {
    const fx = this.fx;
    if (!fx) return;
    this.fx = null;
    fx.timers.forEach(t => t.remove(false));
    fx.tweens.forEach(t => t.stop());
    fx.objs.forEach(o => { this.tweens.killTweensOf(o); o.destroy(); });
    fx.restore.forEach(fn => fn());
    fx.stops.forEach(fn => fn());
    this.drawLiveBeams();
  }
  visualsOf (...types) {
    return Object.values(gameState.placed).filter(c => types.includes(c.type)).map(c => this.compVisuals[c.id]).filter(Boolean);
  }

  // corrente: raffica di scintille dal Quadro (o dall'allaccio, se manca)
  fxSparks () {
    this.fxStart();
    SFX.trip();
    const q = findQuadro();
    const src = q || gameState.placed.allaccio;
    const v = src && this.compVisuals[src.id];
    if (v) this.fxHold(v);
    this.shake(260, 0.007);
    this.fxEvery(170, 8, i => {
      if (!v) return;
      const ports = COMPONENT_TYPES[src.type].ports;
      const pos = q ? this.getPortScreenPos(q.id, ports[Math.floor(Math.random() * ports.length)].id) : null;
      const x = pos ? pos.x : v.container.x + (Math.random() - 0.5) * 30, y = pos ? pos.y : v.container.y - 10;
      this.spawnSparks(x, y);
      this.spawnSparks(x + (Math.random() - 0.5) * 24, y + (Math.random() - 0.5) * 16);
      this.setGlow(v, i % 2 === 0, 0xe0503f);
      if (i % 3 === 0) SFX.trip();
    }, () => this.stopFx());
  }

  // audio: le casse gracchiano, tremano e sputano scariche
  fxCrackle () {
    this.fxStart();
    const DUR = 2.4;
    SFX.crackle(DUR);
    const spk = this.visualsOf('sub', 'top').map(v => ({ v, s: this.fxHold(v) }));
    const zap = this.fxObj(this.add.graphics().setDepth(60));
    this.fxEvery(60, Math.round(DUR * 1000 / 60), () => {
      zap.clear();
      spk.forEach(({ v, s }) => {
        const c = v.container;
        c.x = s.x + (Math.random() - 0.5) * 5;
        c.angle = s.a + (Math.random() - 0.5) * 3;
        if (Math.random() < 0.55) {
          // scarica a zig-zag che esce dalla cassa
          let x = s.x + (Math.random() - 0.5) * 40, y = s.y - 20 - Math.random() * 30;
          zap.lineStyle(2, Math.random() < 0.5 ? 0xffffff : 0x9fd3ff, 0.9);
          zap.beginPath(); zap.moveTo(x, y);
          for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 22; y -= 6 + Math.random() * 10; zap.lineTo(x, y); }
          zap.strokePath();
        }
        this.setGlow(v, Math.random() < 0.3, 0x9fd3ff);
      });
    }, () => this.stopFx());
  }

  /* fasci dei PAR: sono fari FISSI (wash), non teste mobili. Ognuno punta
     dove lo manda il suo stativo (vedi parAim): i frontali sul proscenio,
     i tagli sul centro del palco. La geometria si calcola una volta sola:
     durante gli effetti cambiano solo colore e intensità. */
  parBeamGeometry (parList) {
    const R = 64;                                            // raggio della pozza (wash: larga)
    const flat = TILE_H / TILE_W;                            // cerchio a terra, in isometria
    return parList.map(c => {
      const aim = parAim(c.id);
      if (!aim) return null;
      const v = this.compVisuals[c.id];
      const x = v.container.x, y = v.container.y - 6;
      const t = gridToScreen(aim.gx, aim.gy);
      // bordi del cono: tangenti all'ellisse della pozza viste dalla lente
      const dx = t.x - x, dy = t.y - y, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len, rx = R, ry = R * flat;
      // punto dell'ellisse più lontano lungo la perpendicolare al fascio
      const k = Math.hypot(nx * rx, ny * ry);
      return { c, v, x, y, tx: t.x, ty: t.y, rx, ry, ex: rx * rx * nx / k, ey: ry * ry * ny / k };
    }).filter(Boolean);
  }
  // fasci dei PAR accesi durante il gioco: luce bianca calda, ferma, così si
  // vede cosa illumina ogni faro (durante gli effetti ci pensano loro)
  drawLiveBeams () {
    if (!this.liveBeams) this.liveBeams = this.add.graphics().setDepth(44).setBlendMode(Phaser.BlendModes.ADD);
    const g = this.liveBeams;
    g.clear();
    if (this.fx) return;
    this.parBeamGeometry(placedOfType('par').filter(c => isRunning(c.id) && this.compVisuals[c.id]))
      .forEach(b => this.drawParBeam(g, b, 0xffe9c4, 0.5));
  }
  /* fascio di un PAR LED: è un wash, luce ampia e morbida. Cono largo che
     sfuma verso i bordi (strati sovrapposti, niente contorni netti) e una
     grande pozza tonda a terra che si fonde con quelle vicine. */
  drawParBeam (g, b, col, a) {
    if (a <= 0.01) return;
    const cone = f => g.fillTriangle(b.x, b.y, b.tx + b.ex * f, b.ty + b.ey * f, b.tx - b.ex * f, b.ty - b.ey * f);
    [[1, 0.07], [0.72, 0.07], [0.45, 0.08]].forEach(([f, al]) => { g.fillStyle(col, al * a); cone(f); });
    // pozza a terra: anelli concentrici sempre più chiari verso il centro
    [[1.15, 0.07], [0.9, 0.09], [0.65, 0.11], [0.4, 0.12]].forEach(([f, al]) => {
      g.fillStyle(col, al * a); g.fillEllipse(b.tx, b.ty, b.rx * 2 * f, b.ry * 2 * f);
    });
    // lente accesa
    g.fillStyle(col, 0.3 * a); g.fillCircle(b.x, b.y, 18);
    g.fillStyle(0xffffff, 0.85 * a); g.fillCircle(b.x, b.y, 6);
  }
  // colori speculari: i PAR esterni un colore, quelli interni l'altro
  parMirrorIndex (geo) {
    const order = geo.map((b, i) => i).sort((i, j) => geo[i].x - geo[j].x);
    const m = [];
    order.forEach((gi, k) => { m[gi] = Math.min(k, order.length - 1 - k); });
    return m;
  }

  // luci: i PAR con corrente impazziscono, colori a caso e strobo
  fxLightsTilt () {
    this.fxStart();
    const DUR = 2.8;
    SFX.strobe(DUR);
    const geo = this.parBeamGeometry(placedOfType('par').filter(c => isRunning(c.id) && this.compVisuals[c.id]));
    geo.forEach(b => this.fxHold(b.v));
    const rays = this.fxObj(this.add.graphics().setDepth(45).setBlendMode(Phaser.BlendModes.ADD));
    const COLORS = [0xff2d55, 0x2dff7a, 0x2d7bff, 0xffe12d, 0xff2dff, 0x2dfff0, 0xffffff];
    // con gli effetti ridotti: colori che cambiano piano, niente lampi
    const calm = reducedFx(), STEP = calm ? 400 : 70;
    this.fxEvery(STEP, Math.round(DUR * 1000 / STEP), () => {
      rays.clear();
      const strobe = !calm && Math.random() < 0.18;   // lampo bianco di tutti insieme
      // il faro resta fermo: impazziscono solo colore, intensità e lampi
      geo.forEach(b => {
        const v = b.v, r = Math.min(v.def.body.w, v.def.body.h - 10) / 2;
        v.glow.clear();
        if (!strobe && !calm && Math.random() < 0.35) { v.glow.setAlpha(0); return; }
        const col = strobe ? 0xffffff : COLORS[Math.floor(Math.random() * COLORS.length)];
        v.glow.setAlpha(1);
        v.glow.fillStyle(col, 0.85); v.glow.fillCircle(0, -4, r + 2);
        this.drawParBeam(rays, b, col, strobe ? 1.3 : calm ? 0.7 : 0.4 + Math.random() * 0.6);
      });
    }, () => this.stopFx());
  }

  /* ---------------- corrente dal vivo: LED, fasi, pannello aperto ---------------- */
  refreshLive () {
    Object.keys(gameState.placed).forEach(id => {
      if (gameState.placed[id].type === 'allaccio') return;
      const v = this.compVisuals[id];
      if (v) this.setLed(v, isLedOn(id));
    });
    const q = findQuadro();
    if (q) this.updateQuadroPhaseBars(q.id);
    this.drawLiveBeams();
    if (rearPanelId) renderRearPanel();
  }

  // scintille sulle prese delle fasi scattate (o al centro del Quadro)
  sparkQuadro (phases) {
    const q = findQuadro();
    if (!q) return;
    this.shake(220, 0.006);
    const def = COMPONENT_TYPES.quadro;
    const targets = phases.length ? phases.map(ph => def.ports.find(p => p.phase === ph).id) : [null];
    targets.forEach(pid => {
      const v = this.compVisuals[q.id];
      const pos = pid ? this.getPortScreenPos(q.id, pid) : (v && { x: v.container.x, y: v.container.y });
      if (pos) this.spawnSparks(pos.x, pos.y);
    });
    const v = this.compVisuals[q.id];
    if (v) {
      this.setGlow(v, true, 0xe0503f);
      this.time.delayedCall(900, () => this.setGlow(v, false));
    }
  }
  sparkAtPort (compId, portId) {
    const pos = this.getPortScreenPos(compId, portId);
    if (pos) this.spawnSparks(pos.x, pos.y);
  }
  // "tump": le casse sussultano
  popSpeakers () {
    Object.values(gameState.placed).forEach(c => {
      if (c.type !== 'sub' && c.type !== 'top') return;
      const v = this.compVisuals[c.id];
      if (v) this.tweens.add({ targets: v.container, scale: { from: v.container.scaleX, to: v.container.scaleX * 1.12 }, yoyo: true, duration: 90 });
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

  /* ---------------- lo show: 10 secondi di concerto a impianto collaudato ----------------
     cala la notte sulla venue, i PAR si accendono uno alla volta e illuminano
     la scena, poi le casse partono con un beat a tutto volume: fasci che
     cambiano colore a ogni battuta, casse che pompano sulla cassa dritta.
     Alla fine torna il giorno e l'impianto resta com'era. */
  // "IMPIANTO COLLAUDATO" col nome del service sotto
  showBanner () {
    const brand = this.brandKey && this.textures.exists(this.brandKey);
    const title = this.fxObj(this.add.text(GAME_W / 2, GAME_H / 2 - (brand ? 150 : 0), 'IMPIANTO COLLAUDATO' + (brand ? '' : '\n' + serviceName().toUpperCase()), {
      fontFamily: 'Barlow Condensed, sans-serif', fontSize: '44px', fontStyle: 'bold',
      color: '#f2a541', align: 'center', lineSpacing: 2, wordWrap: { width: GAME_W - 80 }
    }).setOrigin(0.5).setDepth(100).setAlpha(0).setScale(0.85).setScrollFactor(0));
    const parts = [title];
    if (brand) {
      // il marchio del service entra in grande, con un lampo di luce
      const img = this.fxObj(this.add.image(GAME_W / 2, GAME_H / 2 + 10, this.brandKey).setDepth(100).setScrollFactor(0).setAlpha(0));
      const fit = Math.min(1, (GAME_W - 120) / img.width);
      img.setScale(fit * 0.6);
      this.fxTween({ targets: img, alpha: 1, scale: fit, duration: 520, ease: 'Back.Out' });
      if (!reducedFx()) {
        const flash = this.fxObj(this.add.rectangle(GAME_W / 2, GAME_H / 2 + 10, img.width * fit, img.height * fit, 0xffffff, 0)
          .setDepth(101).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD));
        this.fxTween({ targets: flash, fillAlpha: { from: 0.55, to: 0 }, delay: 300, duration: 450 });
      }
      parts.push(img);
    }
    if (this.repGain) {
      parts.push(this.fxObj(this.add.text(GAME_W / 2, GAME_H / 2 + (brand ? 180 : 110), '+' + this.repGain + ' REPUTAZIONE', {
        fontFamily: 'Barlow Condensed, sans-serif', fontSize: '34px', fontStyle: 'bold', color: '#49b06a'
      }).setOrigin(0.5).setDepth(100).setAlpha(0).setScrollFactor(0)));
    }
    this.fxTween({ targets: parts.filter(o => o !== parts[1] || !brand), alpha: 1, scale: 1, duration: 380, ease: 'Back.Out' });
    this.fxTween({ targets: parts, alpha: 0, delay: 1800, duration: 400 });
  }

  playSuccessSequence () {
    this.fxStart();
    SFX.success();
    // show saltato dalle impostazioni: solo la scritta
    if (settings().skipShow) {
      this.showBanner();
      this.fxLater(2600, () => this.stopFx());
      return;
    }
    const BPM = 120, BEATS = 14, BEAT_MS = 60000 / BPM;
    const T_LIGHTS = 1300, T_BEAT = 2300, T_END = T_BEAT + BEATS * BEAT_MS, T_DAY = T_END + 250;

    // la telecamera va sul palco per lo show e poi torna dov'era
    const cam = this.cameras.main;
    const view = { x: cam.midPoint.x, y: cam.midPoint.y, z: cam.zoom };
    const stage = gridToScreen(STAGE_ORIGIN_X + STAGE_W / 2, STAGE_ORIGIN_Y + STAGE_H / 2 + 1);
    cam.pan(stage.x, stage.y, 1200, 'Sine.easeInOut');
    cam.zoomTo(Math.max(view.z, DEFAULT_ZOOM * 1.7), 1200, 'Sine.easeInOut');
    this.fxLater(T_DAY, () => {
      cam.pan(view.x, view.y, 800, 'Sine.easeInOut', true);
      cam.zoomTo(view.z, 800, 'Sine.easeInOut', true);
    });
    // a fine show, o interrotto a metà (reset, modifica, nuovo test): com'era
    this.fx.restore.push(() => {
      cam.panEffect.reset(); cam.zoomEffect.reset();
      cam.setZoom(view.z); cam.centerOn(view.x, view.y);
    });

    // notte: un velo blu scuro su tutta la venue, qualunque siano zoom e pan
    const night = this.fxObj(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W * 8, GAME_H * 8, 0x03050d, 1)
      .setScrollFactor(0).setDepth(40).setAlpha(0));
    this.fxTween({ targets: night, alpha: 0.84, duration: 1200, ease: 'Sine.InOut' });
    this.fxTween({ targets: night, alpha: 0, delay: T_DAY, duration: 700, ease: 'Sine.InOut' });

    const beams = this.fxObj(this.add.graphics().setDepth(45).setBlendMode(Phaser.BlendModes.ADD));
    const waves = this.fxObj(this.add.graphics().setDepth(46));
    const PALETTE = [[0xff3b6b, 0x3b8bff], [0xffb13b, 0xff3bd1], [0x3bffb0, 0x3b8bff], [0xffffff, 0xffb13b], [0xb03bff, 0x3bfff2]];
    const pars = this.parBeamGeometry(placedOfType('par').filter(c => isRunning(c.id) && this.compVisuals[c.id]));
    const mirror = this.parMirrorIndex(pars);
    pars.forEach(b => { b.k = 0; });
    const speakers = this.visualsOf('sub', 'top').map(v => ({ v, s: this.fxHold(v) }));
    const st = { kick: 0, beat: 0, flash: 0 };

    // i PAR si accendono a coppie speculari, dall'esterno verso il centro
    pars.forEach((b, i) => this.fxTween({ targets: b, k: 1, delay: T_LIGHTS + mirror[i] * 350, duration: 300 }));
    this.fxTween({ targets: pars, k: 0, delay: T_END, duration: 600 });

    // disegno a ~30 fps: i fasci non si muovono, pulsano col beat e
    // cambiano colore ogni due battute
    this.fxEvery(33, Math.ceil((T_DAY + 1300) / 33), () => {
      st.kick *= 0.86; st.flash *= 0.8;
      beams.clear();
      const colors = PALETTE[Math.floor(st.beat / 2) % PALETTE.length];
      const pulse = 0.55 + 0.45 * st.kick;
      pars.forEach((b, i) => {
        const col = st.flash > 0.3 ? 0xffffff : colors[mirror[i] % 2];
        this.drawParBeam(beams, b, col, b.k * pulse);
      });
      // onde d'urto che escono dalle casse a ogni colpo di cassa
      waves.clear();
      if (st.kick > 0.05) speakers.forEach(({ s }) => {
        waves.lineStyle(2, 0xffffff, 0.5 * st.kick);
        waves.strokeEllipse(s.x, s.y - 10, 60 + (1 - st.kick) * 90, 30 + (1 - st.kick) * 45);
      });
    });

    // il beat: suono e movimento vanno insieme
    this.fxLater(T_BEAT, () => { this.fx.stops.push(SFX.beat(BPM, BEATS)); });
    this.fxLater(T_BEAT + 50, () => this.fxEvery(BEAT_MS, BEATS, n => {
      st.kick = 1; st.beat = n + 1;
      if (n % 4 === 0 && !reducedFx()) st.flash = 1;
      if (n % 4 === 0) this.shake(120, 0.002);
      speakers.forEach(({ v, s }) => this.fxTween({
        targets: v.container, scaleX: s.sx * 1.09, scaleY: s.sy * 1.09, duration: 70, yoyo: true, ease: 'Quad.Out'
      }));
    }));

    // finale: la scritta, poi torna il giorno
    this.fxLater(T_END - 800, () => this.showBanner());
    this.fxLater(T_DAY + 1300, () => this.stopFx());
  }

  /* ---------------- reset ---------------- */
  resetLevel (quiet) {
    this.stopFx();
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
    gameState.nextIndex = { sub: 1, top: 1, mixer: 1, stativo: 1, par: 1, controller: 1, ampli: 1, quadro: 1, ciabatta: 1, ciabatta_cee: 1, pc: 1, scheda: 1, di: 1 };
    gameState.edges = [];
    gameState.edgeSeq = 0;
    gameState.selectedCable = null;
    gameState.pendingPort = null;
    closeRearPanel();
    gameState.tested = false;
    gameState.trips = 0; gameState.rcdTrips = 0; gameState.procErrors = []; gameState.inrush = [];
    gameState.stats = freshStats();

    updateCableHand();
    updateStockUI();
    updatePowerMeter();
    updateConnectionCounter();
    setCircuitStatus('untested');
    this.resetView();

    this.drawAllaccio();
    this.updateQuadroVisual();
    if (!quiet) showToast('Livello resettato.');
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
    saveLevel();
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
    this.stopFx();
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
      // (ripristino da annulla/ripeti) il pezzo montato resta davanti alla sua base
      const base = mountBase(c);
      if (base) visual.container.setDepth(isoDepth(base.screen.y) + 0.001);
      this.compVisuals[c.id] = visual;
      (c.cells || []).forEach(k => { this.occupied[k] = c.id; });
    });

    this.updateQuadroVisual();
    this.applyLayerVisibility();
    updateStockUI();
    updatePowerMeter();
    setCircuitStatus('untested');
    gameState.tested = false;
    this.updateHistoryButtons();
    saveLevel();
  }

  /* partita salvata: l'impianto com'era, con scatti, procedura e tempo di
     gioco; la cronologia di annulla/ripeti riparte da qui */
  loadLevel (lv) {
    this.restoreSnapshot(lv);
    gameState.trips = lv.trips || 0;
    gameState.rcdTrips = lv.rcdTrips || 0;
    gameState.procErrors = (lv.procErrors || []).slice();
    gameState.stats = { ...freshStats(), ...lv.stats };
    this.history = [];
    this.historyIndex = -1;
    this.pushHistory();
    this.refreshLive();
    updateConnectionCounter();
    updateCableHand();
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
updateCableHand();
setCircuitStatus('untested');
