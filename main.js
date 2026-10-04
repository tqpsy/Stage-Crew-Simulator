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
  const want = def.shape === 'quadro' ? quadroFront(cx, cy) : isFohCell(cx, cy) ? '-a' : '+b';
  if (def.front === want) return 0;
  return def.front === '+b' ? 1 : 3;
}

/* il Quadro si appoggia di schiena alla parete che ha dietro, con le prese
   verso il palco: nella fila contro la parete dietro al palco (anche
   nell'angolo) le prese guardano il palco (-a, girato di un quarto); contro
   la parete laterale (gx = 0) guardano +gx (+b, il disegno); lontano dai
   muri guardano comunque il palco */
function quadroFront (cx, cy) { return cy >= CARICO_ROWS + CELL && cx < CELL ? '+b' : '-a'; }
/* solido del Quadro già girato e appoggiato al muro che ha dietro.
   isoFrame centra il disegno intero (altezza compresa), così la base
   finirebbe mezza altezza più avanti della cella: qui la base si rimette
   sulla cella e, contro un muro, si spinge fino a toccarlo (la cella è di
   50 cm, il quadro è profondo 27) */
function quadroFrame (x, y) {
  const { cx, cy } = screenToCell(x, y);
  const rot = orientK(COMPONENT_TYPES.quadro, x, y);
  const P0 = rotFrame(QUADRO_ISO, rot);
  const d = (TILE_W * CELL - QUADRO_ISO.B) / 2 - 0.5;
  // verso il muro di fondo: +a sul pavimento; verso quello laterale: -b
  const back = cy < CARICO_ROWS + CELL, side = !back && cx < CELL;
  let dx = back ? d * 0.5 : side ? -d * 0.5 : 0, dy = -QUADRO_ISO.Z / 2 - (back || side ? d * ISO_K : 0);
  // nell'angolo si accosta anche alla parete laterale
  if (back && cx < CELL) { const e = (TILE_W * CELL - QUADRO_ISO.A) / 2 - 0.5; dx -= e * 0.5; dy -= e * ISO_K; }
  const P = (a, b, z = 0) => { const p = P0(a, b, z); return { x: p.x + dx, y: p.y + dy }; };
  P.A = P0.A; P.B = P0.B; P.Z = P0.Z; P.k = P0.k;
  return P;
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
const RACK_ISO  = isoFrame(96, 60, 30);   // flight case rack 2U del finale, fronte sulla faccia b=B
/* tavolo regia (la plancia): lungo il fianco del palco (a), il tecnico sta sul
   lato +b e guarda il palco. Sopra mixer, consolle luci, PC e scheda audio;
   sotto il piano il rack del finale. Ogni posto: centro (a, b) e quota z. */
// con Z = 0 i piedi stanno sul punto di posa: il piano è alto, altrimenti
// le gambe scenderebbero sotto il pavimento del palco
const TAVOLO_ISO = isoFrame(300, 80, 0);
const TAVOLO_TOP = 40;
const TAVOLO_SLOTS = {
  controller: [34, 40, TAVOLO_TOP],
  mixer:      [130, 40, TAVOLO_TOP],
  pc:         [214, 44, TAVOLO_TOP],
  scheda:     [264, 40, TAVOLO_TOP],  // accanto al PC, non dietro
  ampli:      [150, 42, 0]            // sotto il piano, a terra
};
// altezza del solido di ogni apparecchio del tavolo (il container sta al suo centro)
const TAVOLO_ITEM_Z = { controller: 10, mixer: 24, pc: 22, scheda: 12, ampli: 30 };
function tavoloSlotOffset (type) {
  const [a, b, z] = TAVOLO_SLOTS[type];
  const q = TAVOLO_ISO(a, b, z);
  return { x: q.x, y: q.y - TAVOLO_ITEM_Z[type] / 2 };
}
const CTRL_ISO  = isoFrame(56, 34, 10);   // consolle luci da tavolo, piano inclinato
// combinazione prese da evento in gomma piena, come le EverGUM di Mennekes,
// in scala con gli altri pezzi (102 unità = 1 m): 32 cm di fronte, 30 di
// fondo, 33 di altezza, impilabile, maniglia sul tetto
const QUADRO_ISO = isoFrame(33, 31, 34); // prese sul fronte b=B
const QUADRO_PHASE_A = [6, 16.5, 27];     // prese CEE 16A L1-L3 lungo il fronte
// moduli su guida DIN dietro la finestra del fronte: centro lungo a e
// mezza larghezza; generale e salvavita a sinistra, poi un magnetotermico
// sopra ogni presa
const QUADRO_MODULES = [['main', 5.2, 2.7], ['rcd', 11, 2.7], ['L1', 17.4, 1.9], ['L2', 21.7, 1.9], ['L3', 26, 1.9]];
const ALL_ISO   = isoFrame(26, 26, 30);   // cassetta dell'allaccio della venue
const CIAB_ISO  = isoFrame(104, 16, 8);   // ciabatta civile: barra lunga e bassa, 3 prese sul piano
const CIABCEE_ISO = isoFrame(134, 16, 8); // ciabatta con spina CEE: 4 prese
const PC_ISO    = isoFrame(26, 34, 22);   // laptop aperto
const DI_ISO    = isoFrame(30, 26, 14);   // DI passiva doppia, scatolina d'acciaio
const INTF_ISO  = isoFrame(46, 30, 12);   // scheda audio USB da tavolo
// consolle del DJ: flight case a banco largo lungo b (fronte a=0 verso il
// pubblico, il DJ sta dietro, sul lato +a), sopra due lettori e il mixer DJ
const DJ_ISO    = isoFrame(46, 96, 30);
/* stativo luci del DJ (lo porta lui, già montato): treppiede, asta più alta
   di quella del service e una barra orizzontale lunga (lungo b) con sopra
   quattro PAR LED cinesi e una strobo LED in mezzo, rivolti al pubblico
   (-a). I fari sono già cablati tra loro sulla barra: si danno una spina
   Schuko e un solo DMX. */
const DJLUCI_ISO  = isoFrame(40, 40, 3);
const DJLUCI_POLE = 80;                     // px: asta fino alla barra
const DJLUCI_HEADS = [-36, -21, 21, 36];    // b dei 4 PAR rispetto al centro della barra
// centro della lente di un faro della barra (db: spostamento lungo la barra)
function djLuciLens (db) { return DJLUCI_ISO(DJLUCI_ISO.A / 2 - 4, DJLUCI_ISO.B / 2 + db, DJLUCI_POLE + 7); }

// la testa sta sul sub: il fondo del suo palo tocca il centro del piano del sub
function isoDepth (screenY) { return 10 + screenY / 10000; }

// il PAR poggia con la sua piastra sulla barra a T in cima allo stativo
// asta microfonica con giraffa: treppiede, asta fino a ASTA_POLE e giraffa che
// sale verso il fondo del palco (+a, -b: dritta in su sullo schermo), dove sta
// chi parla girato verso il pubblico. Il microfono si monta sulla punta.
const ASTA_ISO = isoFrame(40, 40, 3);
const ASTA_POLE = 46;                     // alla scala dello stativo luci (barra a T a 64)
const ASTA_TIP = [40, 14, 56];           // punta della giraffa (a, b, z): bocca di chi parla
function micOffset () { const t = ASTA_ISO(...ASTA_TIP), c = ASTA_ISO(20, 20, 0); return { x: t.x - c.x, y: t.y }; }

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
    body: { w: 78, h: 82, fill: 0x2a2c32, accent: 0x8a8e98 },
    ledPos: RACK_ISO(14, 60, 20),
    // il finale sta in un flight case rack 2U sotto il tavolo regia: i
    // connettori sono sul retro del rack (faccia b=0), da lì partono i cavi
    ports: [
      { id: 'power', signal: 'powercon', dir: 'in',  ...isoPort(RACK_ISO, 84, 0, 15) },
      { id: 'in_L',  signal: 'xlr',      dir: 'in',  ...isoPort(RACK_ISO, 14, 0, 15) },
      { id: 'in_R',  signal: 'xlr',      dir: 'in',  ...isoPort(RACK_ISO, 28, 0, 15) },
      { id: 'out_L', signal: 'speakon',  dir: 'out', ...isoPort(RACK_ISO, 50, 0, 15) },
      { id: 'out_R', signal: 'speakon',  dir: 'out', ...isoPort(RACK_ISO, 64, 0, 15) }
    ]
  },
  // tavolo regia (plancia): si posa in Off Stage, nessuna presa. Sopra ci
  // vanno mixer, consolle luci, PC e scheda audio, sotto il rack del finale
  tavolo: {
    label: 'TAVOLO', category: 'strutture', powerW: 0, zone: 'offstage', shape: 'tavolo',
    // oy: il disegno sta sopra il punto di posa (vedi TAVOLO_ISO)
    body: { w: 190, h: 170, oy: -24, fill: 0x1c1d22, accent: 0x55585f },
    ports: []
  },
  // asta microfonica con giraffa: si posa sul palco, nessuna presa; ci si
  // monta sopra il microfono
  asta: {
    label: 'ASTA', category: 'audio', powerW: 0, zone: 'stage', shape: 'asta',
    body: { w: 40, h: 30, fill: 0x1c1d22, accent: 0x55585f },
    ports: []
  },
  // microfono dinamico da voce: sulla punta della giraffa, uscita XLR verso
  // un ingresso MIC del mixer. Non serve corrente.
  mic: {
    label: 'MIC', category: 'audio', powerW: 0, zone: 'stage', shape: 'mic',
    body: { w: 22, h: 22, fill: 0x1c1d22, accent: 0x9aa0aa },
    ports: [
      { id: 'out', signal: 'xlr', dir: 'out', dx: -9, dy: 7 }
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
    body: { w: 36, h: 60, oy: -20, fill: 0xe9eaed, accent: 0x4a4f5a },
    // prese sul fronte +b del disegno; si gira verso il palco (vedi quadroFront)
    frame: QUADRO_ISO, front: '+b',
    ledIso: [28, 27, 34],
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
      // (girato contro la parete di fondo l'ingresso passa sul fianco a=A,
      // l'unico che resta in vista: vedi drawComponentBody)
      { id: 'in',    signal: 'cee_tri',  dir: 'in',  iso: [0, 15.5, 13], isoTurned: [QUADRO_ISO.A, 15.5, 13] },
      { id: 'out_1', signal: 'cee_mono', dir: 'out', iso: [QUADRO_PHASE_A[0], 31, 9.5], phase: 'L1', multi: true },
      { id: 'out_2', signal: 'cee_mono', dir: 'out', iso: [QUADRO_PHASE_A[1], 31, 9.5], phase: 'L2', multi: true },
      { id: 'out_3', signal: 'cee_mono', dir: 'out', iso: [QUADRO_PHASE_A[2], 31, 9.5], phase: 'L3', multi: true }
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
  // consolle del DJ (la porta lui al cambio palco): due lettori e il mixer
  // DJ su un banco in flight case. Spina Schuko già attaccata (la sua
  // ciabattina), uscite MASTER L/R in jack verso una DI, che le porta al
  // mixer di sala in XLR. Consuma poco: lettori, mixer e le lucine del banco.
  dj: {
    label: 'CONSOLLE DJ', category: 'dj', powerW: 250, zone: 'stage', shape: 'dj',
    body: { w: 74, h: 80, fill: 0x17181c, accent: 0xff3fb4 },
    ledPos: DJ_ISO(0, 88, 24),
    ports: [
      { id: 'power', signal: 'schuko', dir: 'in',  lead: true, ...isoPort(DJ_ISO, 36, 96, 8) },
      { id: 'out_L', signal: 'jack',   dir: 'out', ...isoPort(DJ_ISO, 10, 96, 20) },
      { id: 'out_R', signal: 'jack',   dir: 'out', ...isoPort(DJ_ISO, 20, 96, 20) }
    ]
  },
  // stativo luci del DJ: 4 PAR LED e la strobo sulla barra, già montati,
  // indirizzati e collegati tra loro (corrente e DMX in catena sulla barra).
  // Dal fondo dell'asta escono la spina Schuko e l'unico DMX IN.
  djluci: {
    label: 'LUCI DJ', category: 'dj', powerW: 220, zone: 'stage', shape: 'djluci',
    body: { w: 60, h: 40, fill: 0x17181c, accent: 0xff3fb4 },
    ledPos: DJLUCI_ISO(20, 20, 30),
    ports: [
      { id: 'power',  signal: 'schuko', dir: 'in', lead: true, ...isoPort(DJLUCI_ISO, 20, 26, 8) },
      { id: 'dmx_in', signal: 'dmx',    dir: 'in', ...isoPort(DJLUCI_ISO, 20, 14, 8) }
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

// la DI non serve al montaggio (il PC entra nel mixer dalla scheda audio):
// la usa il DJ al cambio palco. La consolle DJ non è del service, la porta
// il DJ: si vede nella scheda DJ solo da quando parte il cambio palco.
// Anche il suo stativo luci (4 PAR e la strobo sulla barra) è suo.
const AVAILABLE_STOCK = { sub: 2, top: 2, mixer: 1, asta: 1, mic: 1, stativo: 4, par: 4, controller: 1, ampli: 1, quadro: 1, ciabatta: 1, ciabatta_cee: 1, pc: 1, scheda: 1, di: 1, tavolo: 1, dj: 1, djluci: 1 };

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
    done: baseId => 'PAR montato su ' + compLabel(baseId) + ': si punta da solo verso il palco.' },
  mic: { base: 'asta', link: 'hasMic', back: 'parentAstaId', offsetY: () => micOffset().y, offsetX: () => micOffset().x,
    missing: 'Posa il microfono sopra un\'asta microfonica libera: si monta sulla punta della giraffa.',
    done: baseId => 'Microfono montato su ' + compLabel(baseId) + ': collegalo con un XLR a un ingresso MIC del mixer.' }
};
// la regia sta sul tavolo: ogni apparecchio ha il suo posto (TAVOLO_SLOTS)
const TAVOLO_WHERE = { mixer: 'al centro del piano', controller: 'sul piano, verso il pubblico', pc: 'sul piano, verso il fondo',
  scheda: 'sul piano, accanto al PC', ampli: 'nel rack sotto il piano' };
Object.keys(TAVOLO_SLOTS).forEach((type, i) => {
  MOUNTS[type] = {
    base: 'tavolo', link: 'slot_' + type, back: 'tavoloId',
    offsetX: () => tavoloSlotOffset(type).x, offsetY: () => tavoloSlotOffset(type).y,
    // il rack sta sotto il piano (dietro il tavolo), gli altri sopra
    depth: type === 'ampli' ? -0.0005 : 0.001 + i * 0.0001,
    missing: 'Posa prima il tavolo regia (scheda Strutture) in Off Stage: ' + COMPONENT_TYPES[type].label + ' va ' + TAVOLO_WHERE[type] + '.',
    done: baseId => COMPONENT_TYPES[type].label + ' ' + TAVOLO_WHERE[type] + ' di ' + compLabel(baseId) + '.'
  };
});
// base -> tipi che ci si montano sopra
const MOUNT_ON = { sub: ['top'], stativo: ['par'], asta: ['mic'], tavolo: Object.keys(TAVOLO_SLOTS) };
// figli montati su una base
function mountedAll (base) {
  const ts = (base && MOUNT_ON[base.type]) || [];
  return ts.map(t => gameState.placed[base[MOUNTS[t].link]]).filter(Boolean);
}
// figlio montato su una base (o null): per le basi da un solo pezzo
function mountedOn (base) { return mountedAll(base)[0] || null; }
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
   lato). Se allo scarico si è rotto qualche PAR se ne chiedono meno, prima
   i frontali (il preside non deve restare al buio): 3 PAR = due frontali e
   un taglio, 2 = i due frontali, 1 = un frontale.
   Restituisce null se va bene, altrimenti messaggio e pezzi in rosso */
function lightsPlan () {
  return ['Niente PAR da montare', 'Un frontale nel Pit', 'Due frontali nel Pit', 'Due frontali nel Pit e un taglio a lato', 'Due frontali nel Pit e due tagli ai lati'][parsRequired()];
}
function lightingCheck () {
  const mid = STAGE_ORIGIN_X + STAGE_W / 2;
  const onStand = placedOfType('par').map(p => ({ p, s: mountBase(p) })).filter(x => x.s);
  const front = onStand.filter(x => standRole(x.s) === 'front');
  const fl = front.filter(x => compCenter(x.s).gx < mid).length, fr = front.length - fl;
  const tl = onStand.filter(x => standRole(x.s) === 'left').length;
  const tr = onStand.filter(x => standRole(x.s) === 'right').length;
  const ids = onStand.map(x => x.s.id);
  const n = parsRequired(), needFront = Math.min(2, n), needSide = Math.max(0, n - 2);
  if (needFront && !front.length) return { msg: 'manca il frontale davanti al palco: il preside resterebbe al buio.', ids };
  if (needFront === 2 && (!fl || !fr)) return { msg: 'i frontali vanno uno a sinistra e uno a destra del palco.', ids };
  if (needSide === 2 && (!tl || !tr)) return { msg: 'mancano i tagli, uno per lato del palco.', ids };
  if (needSide === 1 && !tl && !tr) return { msg: 'manca il taglio a un lato del palco.', ids };
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

/* Dotazione che arriva davvero al montaggio: quello che si è rotto allo
   scarico manca (il case ricambi, se è arrivato sano, ha già rimpiazzato un
   PAR e uno stativo). Senza scarico giocato è la dotazione piena. Il Test
   impianto chiede i PAR arrivati sani, uno per stativo, fino a 4. */
function levelStock () {
  const s = { ...AVAILABLE_STOCK }, lost = (Profile.data.scarico && Profile.data.scarico.lost) || {};
  Object.entries(lost).forEach(([t, n]) => { if (t in s) s[t] = Math.max(0, s[t] - n); });
  return s;
}
function parsRequired () { const s = levelStock(); return Math.min(4, s.par, s.stativo); }

/* Pezzi arrivati difettosi dallo scarico (case in stato "difettoso").
   Sul pezzo posato compare un segno arancione: si tocca il pezzo e nel suo
   pannello si preme "Controlla e sistema" (lo stativo si sistema col solo
   tocco, i bauli dei cavi si sbrogliano quando si aprono). Il giro del
   pezzo non passa la prova finché non è sistemato. Quali pezzi: i primi
   posati del tipo; quelli sistemati si contano in scarico.fixed. */
const FAULT_BY_CASE = { rack: 'ampli', sub1: 'sub', sub2: 'sub', top1: 'top', top2: 'top', distro: 'quadro',
  valigetta: 'pc', par: 'par', stativi: 'stativo', corrente: 'baule:corrente', segnale: 'baule:segnale' };
const FAULTS = {
  ampli:   { what: 'il finale va in protezione appena lo accendi', fix: 'Hai aperto il rack e rimesso a posto il connettore del finale: niente più protezione.' },
  sub:     { what: 'la cassa vibra: una vite della griglia si è allentata', fix: 'Viti della griglia strette: il sub non vibra più.' },
  top:     { what: 'il tweeter gracchia: il connettore Speakon ha preso un colpo', fix: 'Connettore della testa rimesso a posto: niente più gracchi.' },
  quadro:  { what: 'il quadro scatta alla prima accensione: un morsetto si è mosso', fix: 'Morsetto stretto: il quadro tiene.' },
  pc:      { what: 'il PC non parte al primo colpo: la batteria si è staccata', fix: 'Batteria riagganciata: il PC parte.' },
  par:     { what: 'le lenti del PAR sono sporche e una è fuori posto', fix: 'Lenti pulite e rimesse in sede: il PAR fa di nuovo il suo fascio.' },
  stativo: { what: 'lo stativo è duro da aprire', fix: 'Lo stativo era duro da aprire: un colpo di mano e un po\' di grasso, sistemato.' },
  'baule:corrente': { what: 'i cavi sono aggrovigliati', fix: 'Cavi sbrogliati e riarrotolati: il baule CORRENTE è in ordine.' },
  'baule:segnale':  { what: 'i cavi sono aggrovigliati', fix: 'Cavi sbrogliati e riarrotolati: il baule SEGNALE è in ordine.' }
};
function faultCounts () {
  const out = {}, s = Profile.data.scarico;
  ((s && s.faultyIds) || []).forEach(id => { const t = FAULT_BY_CASE[id]; if (t) out[t] = (out[t] || 0) + 1; });
  return out;
}
function faultsLeft (t) {
  const s = Profile.data.scarico;
  return Math.max(0, (faultCounts()[t] || 0) - ((s && s.fixed && s.fixed[t]) || 0));
}
function isFaulty (id) {
  const c = gameState.placed[id];
  const n = c ? faultsLeft(c.type) : 0;
  return n > 0 && placedOfType(c.type).slice(0, n).some(x => x.id === id);
}
function fixFault (t) {
  const s = Profile.data.scarico;
  if (!s || !faultsLeft(t)) return;
  s.fixed = s.fixed || {};
  s.fixed[t] = (s.fixed[t] || 0) + 1;
  Profile.save();
  SFX.success();
  showToast(FAULTS[t].fix, 'ok');
  if (window.__scene) window.__scene.refreshFaultMarks();
  updateFoglio();
}
// il pulsante "Controlla e sistema" aspetta un attimo: si sta lavorando
function faultBox (box, t, onDone) {
  box.hidden = false;
  box.innerHTML = '<span><b>⚠ Arrivato difettoso dallo scarico:</b> ' + escapeHtml(FAULTS[t].what) + '.</span>'
    + '<button type="button" class="fault-fix">' + (t.startsWith('baule:') ? 'Sbroglia i cavi' : 'Controlla e sistema') + '</button>';
  const b = box.querySelector('.fault-fix');
  b.addEventListener('click', () => {
    b.disabled = true; b.textContent = t.startsWith('baule:') ? 'Sbrogli…' : 'Controlli…';
    SFX.button();
    setTimeout(() => { fixFault(t); box.hidden = true; box.innerHTML = ''; if (onDone) onDone(); }, 1200);
  });
}

/* Microfono pronto per il discorso del preside: montato sull'asta e collegato
   con un XLR a un ingresso MIC del mixer. Restituisce il numero del canale
   (1-4) o null. Non conta per il Test impianto: serve dopo, per lo spettacolo. */
function micChannel () {
  const mic = placedOfType('mic').find(m => mountBase(m));
  if (!mic) return null;
  const e = gameState.edges.find(x => x.a === mic.id && x.aPort === 'out' && x.signal === 'xlr' &&
    (gameState.placed[x.b] || {}).type === 'mixer' && /^in_[1-4]$/.test(x.bPort));
  return e ? parseInt(e.bPort.slice(3), 10) : null;
}

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
  // giro del montaggio in cui si fa (vedi GIRI): la corrente di ogni
  // apparecchio va col giro del suo impianto
  let cat = 'power', giro = 'corrente';
  const slot = (ok, what, ...cs) => ({ ok: !!ok, what, cat, giro, ids: cs.filter(Boolean).map(c => c.id) });
  const list = [];
  const mixer = one('mixer'), ampli = one('ampli'), pc = one('pc'), scheda = one('scheda');

  // corrente
  const allaccio = one('allaccio'), quadro = one('quadro');
  list.push(slot(allaccio && quadro && portEdgeExists(allaccio.id, 'out', quadro.id, 'in', 'cee_tri'),
    quadro ? 'Allaccio → ' + L(quadro) + ' (CEE 400V)' : missing('quadro'), quadro));
  Object.entries({ ...REQUIRED_POWER, par: parsRequired() }).forEach(([t, n]) => {
    giro = t === 'controller' || t === 'par' ? 'luci' : 'audio';
    const cs = placedOfType(t);
    for (let i = 0; i < n; i++) list.push(slot(cs[i] && wiredToQuadro(cs[i].id), cs[i] ? 'corrente a ' + L(cs[i]) : missing(t), cs[i]));
  });

  // audio: PC -> scheda
  cat = 'audio'; giro = 'audio';
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
  cat = 'lights'; giro = 'luci';
  const pars = placedOfType('par');
  for (let i = 0; i < parsRequired(); i++) list.push(slot(pars[i] && dmxUniverse(pars[i].id) != null, pars[i] ? 'DMX dalla consolle a ' + L(pars[i]) : missing('par'), pars[i]));

  // finale -> ogni Sub, ogni Sub -> la testa agganciata sopra
  cat = 'audio'; giro = 'audio';
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
  nextIndex: Object.fromEntries(Object.keys(AVAILABLE_STOCK).map(t => [t, 1])),
  edges: [],              // { id, a, aPort, b, bPort, signal }
  edgeSeq: 0,
  selectedCable: null,
  pendingPort: null,      // { componentId, portId }
  selectedPieceType: null, // tipo di pezzo "armato" in attesa di un tocco sulla pedana
  visibleSignals: { powercon: true, xlr: true, speakon: true, dmx: true, schuko: true, cee_tri: true, cee_mono: true, jack: true, usbc: true }
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
  function beat (bpm, beats, level) {
    const out = ctx.createGain(); out.gain.value = (level || 1.6) * volume;
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

  // musica di prova del montaggio: lo stesso beat, piano, a blocchi di 16
  // battiti rimessi in coda finché non la si ferma
  let loop = null;
  function testLoop (on) {
    if (!on || !volume) {
      if (loop) { clearTimeout(loop.timer); if (loop.stop) loop.stop(); loop = null; }
      return;
    }
    if (loop) return;
    play(() => {
      const bpm = 124, beats = 16, ms = 60 / bpm * beats * 1000;
      loop = {};
      const tick = () => { if (!loop) return; loop.stop = beat(bpm, beats, 0.3); loop.timer = setTimeout(tick, ms); };
      tick();
    });
  }

  return {
    get muted () { return !volume; },
    testLoop,
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
      if (!volume) testLoop(false);
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
const SWITCHABLE = new Set(['sub', 'mixer', 'ampli', 'controller', 'pc', 'ciabatta', 'ciabatta_cee', 'dj']);
// corrente di spunto: all'accensione finali e sub chiedono per un attimo un
// multiplo del loro consumo (si caricano i condensatori dell'alimentatore)
const INRUSH_FACTOR = { ampli: 5, sub: 4 };
const INRUSH_MS = 700;

// kW con la virgola decimale, all'italiana
function fmtKW (w, digits) { return (w / 1000).toFixed(digits).replace('.', ','); }

function findQuadro () { return Object.values(gameState.placed).find(c => c.type === 'quadro'); }
// stato delle protezioni del Quadro: tutte abbassate finché non le si arma
function quadroProt (q) {
  if (!q.prot) q.prot = { main: false, rcd: false, L1: false, L2: false, L3: false, tripped: {} };
  if (!q.prot.tripped) q.prot.tripped = {};
  return q.prot;
}
// il Quadro è in tensione: arriva corrente dall'allaccio, generale e salvavita armati
function quadroLive () {
  const q = findQuadro();
  if (!q || !isPowered(q.id)) return false;
  const prot = quadroProt(q);
  return !!(prot.main && prot.rcd);
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
    showToast('TUMP! Mixer acceso o spento con i finali già accesi: il colpo è finito nelle casse. I finali si accendono per ultimi e si spengono per primi.', 'bad');
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
    : 'Magnetotermico scattato (' + kw + ' su ' + fmtKW(PHASE_BUDGET_W, 1) + ' kW): la fase è spenta. Togli carico o spostalo su un\'altra fase, spegni finali e sub, poi riarma dal Quadro e riaccendili uno alla volta.', 'bad');
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
  showToast('Salvavita scattato: hai collegato o scollegato un cavo di corrente sotto carico, con un apparecchio acceso. Spegni prima di staccare o attaccare, poi riarma il salvavita dal Quadro.', 'bad');
  if (window.__scene) {
    window.__scene.sparkAtPort(edge.a, edge.aPort);
    window.__scene.sparkQuadro([]);
  }
  return true;
}

// ogni manovra entra nella cronologia, così annulla/ripeti restano coerenti
function saveHistory () { if (window.__scene) window.__scene.pushHistory(); }

/* CAPO SQUADRA TUTOR (solo livello 1) — la prima volta che un'azione sta per
   causare un errore di procedura, il capo la ferma e spiega perché. Una
   volta sola per tipo di errore e per tecnico: se il giocatore la rifà, la
   fa davvero, con le sue conseguenze. Si spegne dalle impostazioni. */
const TUTOR_LEVELS = new Set([1]);
/* Ogni frase deve essere vera in OGNI caso in cui compare (vedi le
   condizioni in predictToggle e wouldArc, le stesse di applyPowerAction,
   checkOverloads e checkLiveCableChange): tests/capo.js le controlla. */
const TUTOR_TIPS = {
  // presa a monte in tensione e, a valle, qualcosa che assorbe corrente
  live: 'Fermo! Da una parte c\'è tensione e dall\'altra c\'è qualcosa che assorbe corrente: attaccare o staccare così fa l\'arco e salta il salvavita. Prima togli tensione: spegni l\'apparecchio o, se non ha interruttore come i PAR, abbassa la sua fase sul Quadro.',
  // un finale acceso resta acceso mentre il mixer cambia stato
  pop: 'Aspetta! Il finale è acceso: se adesso il mixer si accende o si spegne, il colpo finisce dritto nelle casse. Spegni prima il finale e riaccendilo per ultimo.',
  // si accende il finale mentre il mixer non va (spento o senza corrente)
  ampliFirst: 'Il finale per ultimo! Il mixer non è ancora in funzione (spento o senza corrente): quando partirà col finale già acceso, il colpo finirà nelle casse. Prima il mixer, poi finale e sub.',
  // picco oltre PHASE_PEAK_W: nel livello 1 un solo avvio non basta, servono due pesanti insieme
  inrush: 'Piano! Così su questa fase partono insieme più apparecchi pesanti (finale, sub) e il picco di accensione fa saltare il magnetotermico. Accendili uno alla volta, con un attimo tra l\'uno e l\'altro.',
  // carico a regime oltre PHASE_BUDGET_W
  overload: 'Questa fase è già carica: con anche questo supera i ' + fmtKW(PHASE_BUDGET_W, 0) + ' kW e salta il magnetotermico. Spostalo su un\'altra fase del Quadro.'
};
const tutorOn = () => gameActive && TUTOR_LEVELS.has(LEVEL_ID) && settings().bossTips !== false;
function bossName () {
  const b = Profile.data.serviceInfo && Profile.data.serviceInfo.boss;
  return b ? b.split(' ')[0] : 'Il capo';
}
// true se il capo ha fermato l'azione (la prima volta)
function tutorWarn (key) {
  if (!tutorOn()) return false;
  const seen = Profile.data.tutorSeen = Profile.data.tutorSeen || {};
  if (seen[key]) return false;
  seen[key] = true;
  Profile.save();
  SFX.button();
  showToast(bossName() + ': «' + TUTOR_TIPS[key] + '» (Se lo rifai, lo fai davvero.)', 'boss');
  return true;
}
/* cosa succederebbe accendendo o spegnendo un apparecchio: si prova
   l'azione, si guarda e si rimette tutto com'era */
function predictToggle (c) {
  const before = runningSet();
  const was = c.on;   // si rimette esattamente com'era (anche "mai toccato")
  c.on = !c.on;
  const after = runningSet();
  const steady = livePhaseLoads(false), peak = livePhaseLoads(true);
  after.forEach(id => {
    if (before.has(id)) return;
    const k = INRUSH_FACTOR[gameState.placed[id].type], ph = phaseOf(id);
    if (k && ph) peak[ph] += COMPONENT_TYPES[gameState.placed[id].type].powerW * (k - 1);
  });
  if (was === undefined) delete c.on; else c.on = was;
  const q = findQuadro(), prot = q ? quadroProt(q) : {};
  const types = set => [...set].map(id => gameState.placed[id].type);
  const ampsOn = [...after].some(id => gameState.placed[id].type === 'ampli' && before.has(id));
  const mixerFlip = Object.values(gameState.placed).some(x => x.type === 'mixer' && before.has(x.id) !== after.has(x.id));
  const phases = ['L1', 'L2', 'L3'].filter(ph => prot[ph]);
  return {
    pop: ampsOn && mixerFlip,
    ampliFirst: c.type === 'ampli' && after.has(c.id) && !before.has(c.id) && placedOfType('mixer').length > 0 && !types(after).includes('mixer'),
    overload: phases.some(ph => steady[ph] > PHASE_BUDGET_W),
    inrush: phases.some(ph => steady[ph] <= PHASE_BUDGET_W && peak[ph] > PHASE_PEAK_W)
  };
}
// un cavo di corrente attaccato (adding) o staccato farebbe l'arco?
function wouldArc (edge, adding) {
  if (!POWER_CABLE_IDS.has(edge.signal) || edge.a === 'allaccio') return false;
  if (adding) gameState.edges.push(edge);
  const risk = portEnergized(edge.a, edge.aPort) && loadRunningDownstream(edge.b);
  if (adding) gameState.edges.pop();
  return !!risk;
}

function toggleDevicePower (compId) {
  const c = gameState.placed[compId];
  if (!c) return;
  if (tutorOn()) {
    const risk = predictToggle(c);
    // il guaio più grave per primo: il capo ne dice uno solo alla volta
    if (['overload', 'inrush', 'pop', 'ampliFirst'].some(k => risk[k] && tutorWarn(k))) return;
  }
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
/* le luci del DJ sono già indirizzate da lui e non si toccano: 4 PAR da 3
   canali (RGB) dall'indirizzo 1 e la strobo (dimmer e velocità) in fondo,
   canali 1-14. Vanno su un universo dove nessun PAR del service li pesta:
   di solito il secondo, libero. */
const DJ_LUCI_DMX = { from: 1, to: 14 };
// PAR del service che si accavallano con la barra del DJ (stesso universo)
function djLuciClashes (bar) {
  const u = bar && dmxUniverse(bar.id);
  if (u == null) return [];
  return placedOfType('par').filter(c => {
    const d = parDmx(c), n = parseInt(PAR_MODES[d.mode].id, 10);
    return dmxUniverse(c.id) === u && d.addr <= DJ_LUCI_DMX.to && DJ_LUCI_DMX.from <= d.addr + n - 1;
  });
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
  // sul telefono l'etichetta dice già kW: si scrive solo il numero
  const used = usedKw.toFixed(2).replace('.', ','), lim = POWER_LIMIT_KW.toFixed(1).replace('.', ',');
  el('#power-val').textContent = window.innerWidth < 700 ? `${used}/${lim}` : `${used} / ${lim} kW`;
  const pct = Math.min(100, (usedKw / POWER_LIMIT_KW) * 100);
  const fill = el('#power-fill');
  fill.style.width = pct + '%';
  fill.classList.toggle('over', usedKw > POWER_LIMIT_KW);
}

// views: false quando foglio e flusso del segnale li ha appena ridisegnati refreshLive
function updateConnectionCounter (views = true) {
  const result = runValidation();
  const val = el('#conn-val');
  if (val) val.textContent = `${result.madeCount} / ${result.totalCount}`;
  const fill = el('#conn-fill');
  if (fill) fill.style.width = Math.min(100, (result.madeCount / result.totalCount) * 100) + '%';
  if (!views) return;
  if (typeof updateFoglio === 'function') updateFoglio();
  if (window.__scene) window.__scene.updateSignalFlow();
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
let toastHeld = false;
function hideToast () {
  clearTimeout(toastTimer);
  el('#toast').classList.remove('show');
}
function showToast (msg, kind) {
  const toast = el('#toast');
  toastHeld = false; toast.classList.remove('hold');
  el('#toast-msg').textContent = msg;
  // di base è un avviso neutro; 'ok' per i successi, 'bad' solo per i guasti veri
  toast.classList.remove('ok', 'bad', 'boss');
  if (kind === 'ok' || kind === 'bad' || kind === 'boss') toast.classList.add(kind);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  // i messaggi lunghi restano più a lungo: il tempo di leggerli
  toastTimer = setTimeout(() => toast.classList.remove('show'), Math.max(3200, msg.length * 60));
}
// il messaggio resta scritto ma nascosto finché finisce lo show, poi si legge con calma
function holdToast () {
  toastHeld = true;
  clearTimeout(toastTimer);
  el('#toast').classList.add('hold');
}
function releaseToast () {
  if (!toastHeld) return;
  const toast = el('#toast');
  showToast(toast.textContent, ['ok', 'bad', 'boss'].find(k => toast.classList.contains(k)));
}
el('#toast-x').addEventListener('click', hideToast);

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
  if (typeof updateDrawerSubs === 'function') updateDrawerSubs();
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
   PARTITA — il tecnico (nome) e il service per cui lavora, scelto tra
   tre offerte; salvataggio automatico, impostazioni e
   record. Tutto sta in un solo oggetto nella memoria del browser, con un
   numero di versione: se un giorno il formato cambia si converte, invece
   di perdere la partita. Le partite stanno in SLOT_COUNT slot: "Nuova
   partita" ne occupa uno vuoto; impostazioni e record sono comuni a tutti.
   Ogni partita si può esportare in un file e reimportare.
   Il valore principale del tecnico è la REPUTAZIONE (vedi addReputation):
   è sua, non del service. Parte da 0, sale con le fasi completate, i
   guasti gestiti bene e le birre rifiutate, scende se un guasto è gestito
   male. Un nuovo tecnico (Nuova partita) riparte da zero.
   I record preparano gli highscore: per ogni collaudo riuscito si tengono
   i dati grezzi (tempo di gioco, test fatti e falliti, scatti, colpi nelle
   casse).
   --------------------------------------------------------------------- */
const SAVE_KEY = 'scs-save';
const SAVE_VERSION = 5;
const LEVEL_ID = 1;
const RECORDS_KEEP = 20;       // record tenuti per livello
const NAME_MAX = 24;           // caratteri del nome del tecnico
const SERVICE_NAME_MAX = 28;   // caratteri del nome (inventato) di un service
const USED_SERVICES_KEEP = 400; // nomi di service già proposti, da non riproporre

const SLOT_COUNT = 3;           // partite salvate (slot)
const SAVE_FILE_KIND = 'stage-crew-simulator';   // firma del file esportato
// cosa è comune a tutti gli slot: impostazioni, record (la classifica
// delle proprie partite) e nomi di service già proposti
const SHARED_KEYS = ['settings', 'records', 'usedServices'];

function defaultProfile () {
  return { v: SAVE_VERSION, player: '', service: '', serviceInfo: null, usedServices: [], settings: { volume: 0.8, reducedFx: false, skipShow: false, skipScarico: false, testMusic: true, bossTips: true, tapeMarks: true, traceSignal: true }, tutorSeen: {}, logo: null, level: null, scarico: null, cavi: null, preside: null, cambioDj: null, dj: null, karaoke: null, carico: null, beers: 0, assistant: defaultAssistant(), fatigue: 0, records: {}, reputation: { total: 0, earned: {}, log: [] }, levelsSeen: 1, savedAt: 0 };
}
// l'assistente della serata (dal livello 2, vedi ASSISTANTS): chi è e
// quanti favori ha già fatto nel set in corso. Le partite salvate prima
// dell'assistente non lo hanno: fillSlot le parte con nessuno assunto.
function defaultAssistant () { return { id: null, favors: 0 }; }
// solo la partita (senza le parti comuni): è quello che va in uno slot
function slotPart (d) {
  const s = { ...d };
  SHARED_KEYS.concat('v').forEach(k => delete s[k]);
  return s;
}
// uno slot contiene una partita se c'è un service o un livello avviato
const slotUsed = s => !!(s && (s.service || s.level));

/* conversioni dei salvataggi a un solo slot (versioni 1-4): tutte portano
   alla versione 4, l'ultima a slot unico. Restituisce null se non sa
   leggere l'oggetto. */
function upgradeSingle (d) {
  if (!d || typeof d !== 'object' || !Number.isInteger(d.v)) return null;
  d = JSON.parse(JSON.stringify(d));
  try {
    // versione 1: la reputazione era 100-150 per livello collaudato; ora
    // un collaudo è una fase completata e vale REP.phaseDone
    if (d && d.v === 1) {
      const done = Object.keys((d.reputation && d.reputation.byLevel) || {}).filter(l => d.reputation.byLevel[l] > 0);
      d.reputation = { total: done.length * 5, earned: Object.fromEntries(done.map(l => ['L' + l + ':collaudo', 5])), log: [] };
      d.v = 2;
    }
    // versione 2: il giocatore era il titolare del service (nome e logo
    // scelti da lui); ora è un tecnico che lavora per un service e la
    // reputazione è la sua. Il vecchio service resta come datore di lavoro.
    if (d && d.v === 2) {
      d.player = '';
      d.serviceInfo = null;
      d.usedServices = d.service ? [d.service] : [];
      d.v = 3;
    }
    // versione 3: lo scarico non esisteva. Una partita già avviata lo conta
    // come saltato (tutto arrivato sano); senza partita si gioca alla prossima.
    if (d && d.v === 3) {
      d.scarico = d.level ? { skipped: true, lost: {}, delay: 0, beers: 0 } : null;
      d.v = 4;
    }
  } catch (e) { return null; }
  return d.v === 4 ? d : null;
}

/* versione 5: più slot. Le parti comuni (impostazioni, record, service già
   proposti) stanno fuori dagli slot; la partita a slot unico diventa il
   primo slot, niente si perde. */
function upgradeSave (d) {
  if (d && d.v >= 1 && d.v <= 4) {
    const one = upgradeSingle(d);
    if (!one) return null;
    const root = { v: 5, active: 0, settings: one.settings || {}, records: one.records || {}, usedServices: one.usedServices || [], slots: Array(SLOT_COUNT).fill(null) };
    if (slotUsed(one)) root.slots[0] = slotPart(one);
    return root;
  }
  return d && d.v === SAVE_VERSION ? d : null;
}

// una partita letta dalla memoria o da un file: campi mancanti dai valori
// di partenza, parti comuni dal salvataggio
function fillSlot (s, root) {
  const def = defaultProfile();
  return { ...def, ...(s || {}), v: SAVE_VERSION,
    settings: { ...def.settings, ...root.settings },
    records: root.records || {}, usedServices: root.usedServices || [],
    reputation: { ...def.reputation, ...((s && s.reputation) || {}) },
    assistant: { ...def.assistant, ...((s && s.assistant) || {}) } };
}

/* file esportato: una partita (uno slot) con firma e versione. Si legge
   anche un vecchio salvataggio a slot unico (versioni 1-4, per esempio
   copiato a mano dalla memoria del browser). Restituisce la partita o un
   errore da mostrare al giocatore. */
function exportSlotFile (slot) {
  return JSON.stringify({ kind: SAVE_FILE_KIND, v: SAVE_VERSION, exportedAt: Date.now(), slot: slotPart(slot) }, null, 1);
}
// il montaggio di un file importato: solo pezzi e cavi che il gioco conosce,
// con i campi che servono a disegnarli (un tipo sconosciuto romperebbe la scena)
function validLevel (lv) {
  const num = v => typeof v === 'number' && Number.isFinite(v);
  const placed = Object.entries(lv.placed);
  const pieceOk = ([id, c]) => c && typeof c === 'object' && c.id === id && COMPONENT_TYPES[c.type]
    && (c.gx == null || (num(c.gx) && num(c.gy))) && (!c.cells || (Array.isArray(c.cells) && c.cells.every(k => typeof k === 'string')))
    && c.screen && num(c.screen.x) && num(c.screen.y);
  const edgeOk = e => e && typeof e === 'object' && lv.placed[e.a] && lv.placed[e.b]
    && typeof e.aPort === 'string' && typeof e.bPort === 'string' && CABLE_TYPES[e.signal];
  return placed.every(pieceOk) && lv.edges.every(edgeOk);
}

function readSlotFile (text) {
  let d;
  try { d = JSON.parse(text); } catch (e) { return { error: 'Il file non è un salvataggio di Stage Crew Simulator.' }; }
  if (!d || typeof d !== 'object' || !Number.isInteger(d.v)) return { error: 'Il file non è un salvataggio di Stage Crew Simulator.' };
  if (d.v > SAVE_VERSION) return { error: 'Il salvataggio viene da una versione più nuova del gioco: aggiorna la pagina e riprova.' };
  let slot;
  if (d.kind === SAVE_FILE_KIND && d.v === SAVE_VERSION) slot = d.slot;
  else if (d.v >= 1 && d.v <= 4 && !d.kind) { const one = upgradeSingle(d); slot = one && slotPart(one); }
  const ok = slot && typeof slot === 'object' && typeof (slot.service || '') === 'string' && typeof (slot.player || '') === 'string'
    && (!slot.reputation || typeof slot.reputation.total === 'number')
    && (!slot.level || (typeof slot.level === 'object' && slot.level.placed && typeof slot.level.placed === 'object' && Array.isArray(slot.level.edges) && validLevel(slot.level)));
  if (!ok || !slotUsed(slot)) return { error: 'Il file è rovinato o non contiene una partita.' };
  // il file può venire da chiunque: logo e service solo con valori ammessi
  // (i colori del logo finiscono dentro l'SVG)
  const lg = slot.logo && typeof slot.logo === 'object' ? slot.logo : null;
  const color = c => typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : undefined;
  const key = (k, set) => typeof k === 'string' && (k === 'iniziali' || k in set) ? k : undefined;
  const info = slot.serviceInfo && typeof slot.serviceInfo === 'object' ? slot.serviceInfo : null;
  const as = slot.assistant && typeof slot.assistant === 'object' ? slot.assistant : null;
  slot = { ...slot, player: String(slot.player || '').slice(0, NAME_MAX), service: String(slot.service || '').slice(0, SERVICE_NAME_MAX),
    logo: lg ? JSON.parse(JSON.stringify({ shape: key(lg.shape, LOGO_SHAPES), icon: key(lg.icon, LOGO_ICONS), bg: color(lg.bg), fg: color(lg.fg), style: key(lg.style, BRAND_STYLES) })) : null,
    serviceInfo: info ? { kind: key(info.kind, SERVICE_KINDS) || null, boss: String(info.boss || '').slice(0, NAME_MAX * 2) } : null,
    assistant: as ? { id: typeof as.id === 'string' ? as.id.slice(0, NAME_MAX) : null, favors: Number.isInteger(as.favors) && as.favors >= 0 ? as.favors : 0 } : undefined,
    fatigue: Math.min(100, Math.max(0, +slot.fatigue || 0)) };
  return { slot };
}

const Profile = (() => {
  let root = { v: SAVE_VERSION, active: 0, settings: {}, records: {}, usedServices: [], slots: Array(SLOT_COUNT).fill(null) };
  let data = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const d = upgradeSave(raw ? JSON.parse(raw) : null);
    if (d) {
      root = { ...root, ...d };
      root.slots = Array.from({ length: SLOT_COUNT }, (_, i) => (d.slots && slotUsed(d.slots[i])) ? d.slots[i] : null);
      if (!(root.active >= 0 && root.active < SLOT_COUNT)) root.active = 0;
    } else if (!raw && localStorage.getItem('scs-muted') === '1') root.settings = { volume: 0 };   // vecchio tasto muto
  } catch (e) { /* memoria non disponibile o salvataggio illeggibile: si parte da zero */ }
  data = fillSlot(root.slots[root.active], root);
  let timer = null;
  // riporta la partita in gioco nel suo slot (solo se è una partita vera)
  const sync = () => {
    SHARED_KEYS.forEach(k => { root[k] = data[k]; });
    if (slotUsed(data)) {
      if (gameActive || !data.savedAt) data.savedAt = Date.now();   // data dell'ultima partita giocata
      root.slots[root.active] = slotPart(data);
    }
  };
  const write = () => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(root)); } catch (e) { /* memoria piena o non disponibile: si gioca senza salvare */ }
  };
  const flush = () => { clearTimeout(timer); timer = null; sync(); write(); };
  return {
    get data () { return data; },
    get active () { return root.active; },
    // salvataggio a raffica ma scritto una volta sola, poco dopo l'ultima azione
    save () { clearTimeout(timer); timer = setTimeout(() => Profile.flush(), 250); },
    flush,
    // le partite negli slot (null = vuoto); quella in gioco è aggiornata
    slots () { if (slotUsed(data)) root.slots[root.active] = slotPart(data); return root.slots.slice(); },
    firstFree () { return this.slots().findIndex(s => !s); },
    // passa a un altro slot (vuoto: una partita nuova ancora da iniziare)
    select (i) {
      if (i === root.active) return;
      clearTimeout(timer); timer = null; sync();
      root.active = i;
      data = fillSlot(root.slots[i], root);
      write();
    },
    remove (i) {
      root.slots[i] = null;
      if (i === root.active) { clearTimeout(timer); timer = null; SHARED_KEYS.forEach(k => { root[k] = data[k]; }); data = fillSlot(null, root); }
      write();
    },
    exportSlot (i) { const s = this.slots()[i]; return s ? exportSlotFile(s) : null; },
    // mette una partita letta da file in uno slot vuoto
    importSlot (i, text) {
      if (this.slots()[i]) return { error: 'Lo slot è occupato: cancella prima la partita che c\'è.' };
      const r = readSlotFile(text);
      if (r.error) return r;
      root.slots[i] = r.slot;
      if (i === root.active) data = fillSlot(r.slot, root);
      write();
      return r;
    }
  };
})();
window.addEventListener('pagehide', () => Profile.flush());

const settings = () => Profile.data.settings;
const reducedFx = () => !!settings().reducedFx;
const serviceName = () => Profile.data.service || 'Il service';
const playerName = () => Profile.data.player || 'Tecnico';

/* ---------------- logo del service ----------------
   Ogni service proposto a inizio partita ha il suo logo, inventato dal
   nome: forma, simbolo e due colori. È un disegno vettoriale (SVG), quindi
   resta nitido a ogni misura: in testata, nel menù e dipinto sulla
   fiancata del furgone. */
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
  fader: '<rect x="26" y="18" width="6" height="64" rx="3"/><rect x="47" y="18" width="6" height="64" rx="3"/><rect x="68" y="18" width="6" height="64" rx="3"/><rect x="19" y="56" width="20" height="11" rx="2"/><rect x="40" y="30" width="20" height="11" rx="2"/><rect x="61" y="46" width="20" height="11" rx="2"/>',
  // simboli delle parole dei nomi dei service (vedi NAME_HINTS.icon)
  microfono: '<rect x="38" y="10" width="24" height="40" rx="12"/><rect x="41" y="21" width="18" height="3" fill="BG"/><rect x="41" y="28" width="18" height="3" fill="BG"/><rect x="41" y="35" width="18" height="3" fill="BG"/><path d="M28 40 V46 A22 22 0 0 0 72 46 V40" fill="none" stroke="FG" stroke-width="6"/><rect x="47" y="67" width="6" height="13"/><rect x="33" y="79" width="34" height="7" rx="3"/>',
  nastro: '<circle cx="44" cy="46" r="34"/><circle cx="44" cy="46" r="15" fill="BG"/><polygon points="44,70 86,70 91,74 86,77 91,80 44,80"/>',
  fumo: '<circle cx="32" cy="60" r="15"/><circle cx="52" cy="48" r="20"/><circle cx="70" cy="62" r="13"/><rect x="28" y="60" width="48" height="16" rx="8"/><circle cx="74" cy="30" r="7"/><circle cx="86" cy="18" r="4"/>',
  coriandoli: '<rect x="16" y="18" width="10" height="18" rx="2" transform="rotate(-25 21 27)"/><rect x="66" y="14" width="10" height="18" rx="2" transform="rotate(35 71 23)"/><rect x="40" y="62" width="10" height="18" rx="2" transform="rotate(60 45 71)"/><rect x="74" y="58" width="10" height="18" rx="2" transform="rotate(-40 79 67)"/><circle cx="46" cy="20" r="6"/><circle cx="20" cy="66" r="6"/><circle cx="84" cy="42" r="5"/><polygon points="50,34 56,46 69,48 59,57 62,70 50,63 38,70 41,57 31,48 44,46"/>',
  sipario: '<rect x="10" y="12" width="80" height="12" rx="3"/><path d="M13 24 H45 C40 50 33 70 44 88 H13 Z"/><path d="M87 24 H55 C60 50 67 70 56 88 H87 Z"/><path d="M24 26 C22 50 20 70 23 86 M76 26 C78 50 80 70 77 86" fill="none" stroke="BG" stroke-width="2.5"/>',
  spina: '<rect x="37" y="12" width="7" height="24" rx="2"/><rect x="56" y="12" width="7" height="24" rx="2"/><rect x="28" y="32" width="44" height="34" rx="9"/><path d="M50 66 V76 C50 88 70 90 78 82" fill="none" stroke="FG" stroke-width="7" stroke-linecap="round"/>',
  palla: '<rect x="48" y="8" width="4" height="16"/><circle cx="50" cy="54" r="30"/><path d="M20 54 H80 M24 40 H76 M24 68 H76 M50 24 V84 M36 28 C29 44 29 64 36 80 M64 28 C71 44 71 64 64 80" fill="none" stroke="BG" stroke-width="3"/><polygon points="84,14 86,21 93,23 86,25 84,32 82,25 75,23 82,21"/>',
  nota: '<ellipse cx="32" cy="74" rx="12" ry="9" transform="rotate(-20 32 74)"/><ellipse cx="72" cy="64" rx="12" ry="9" transform="rotate(-20 72 64)"/><rect x="38" y="24" width="6" height="50"/><rect x="78" y="14" width="6" height="50"/><polygon points="38,24 84,12 84,26 38,38"/>',
  chitarra: '<path d="M52 52 L80 20" fill="none" stroke="FG" stroke-width="8" stroke-linecap="round"/><rect x="74" y="8" width="16" height="12" rx="3" transform="rotate(45 82 14)"/><circle cx="38" cy="68" r="21"/><circle cx="54" cy="52" r="14"/><circle cx="44" cy="62" r="7" fill="BG"/><rect x="24" y="72" width="14" height="4" rx="2" fill="BG" transform="rotate(-45 31 74)"/>',
  tamburo: '<path d="M28 10 L48 30 M72 10 L52 30" fill="none" stroke="FG" stroke-width="5" stroke-linecap="round"/><path d="M16 40 V70 A34 11 0 0 0 84 70 V40 Z"/><ellipse cx="50" cy="40" rx="34" ry="11"/><ellipse cx="50" cy="40" rx="30" ry="8" fill="none" stroke="BG" stroke-width="3"/><polyline points="20,52 32,74 44,54 56,76 68,54 80,72" fill="none" stroke="BG" stroke-width="3"/>',
  applauso: '<rect x="24" y="30" width="22" height="52" rx="11" transform="rotate(-18 35 56)"/><rect x="54" y="30" width="22" height="52" rx="11" transform="rotate(18 65 56)"/><path d="M50 8 V20 M32 12 L38 23 M68 12 L62 23" fill="none" stroke="FG" stroke-width="5" stroke-linecap="round"/>',
  ciak: '<g transform="rotate(-14 16 40)"><rect x="16" y="26" width="68" height="12" rx="2"/><polygon points="30,26 39,26 32,38 23,38" fill="BG"/><polygon points="50,26 59,26 52,38 43,38" fill="BG"/><polygon points="70,26 79,26 72,38 63,38" fill="BG"/></g><rect x="16" y="42" width="68" height="44" rx="3"/><rect x="22" y="56" width="56" height="3" fill="BG"/><rect x="22" y="70" width="56" height="3" fill="BG"/>',
  flightcase: '<rect x="40" y="16" width="20" height="9" rx="3"/><rect x="14" y="24" width="72" height="56" rx="5"/><rect x="14" y="49" width="72" height="3" fill="BG"/><g fill="none" stroke="BG" stroke-width="2.5"><rect x="17" y="27" width="11" height="11" rx="2"/><rect x="72" y="27" width="11" height="11" rx="2"/><rect x="17" y="66" width="11" height="11" rx="2"/><rect x="72" y="66" width="11" height="11" rx="2"/></g><rect x="36" y="45" width="7" height="11" rx="1" fill="BG"/><rect x="57" y="45" width="7" height="11" rx="1" fill="BG"/>',
  spia: '<polygon points="10,80 90,80 90,58 30,28 10,40"/><circle cx="54" cy="60" r="13" fill="BG"/><circle cx="54" cy="60" r="5"/>',
  americana: '<rect x="8" y="30" width="84" height="6" rx="2"/><rect x="8" y="64" width="84" height="6" rx="2"/><path d="M12 36 L26 64 L40 36 L54 64 L68 36 L82 64 L88 36" fill="none" stroke="FG" stroke-width="4" stroke-linejoin="round"/>',
  scaletta: '<rect x="24" y="12" width="52" height="76" rx="4"/><rect x="32" y="26" width="36" height="4" fill="BG"/><rect x="32" y="38" width="28" height="4" fill="BG"/><rect x="32" y="50" width="34" height="4" fill="BG"/><rect x="32" y="62" width="22" height="4" fill="BG"/><rect x="32" y="74" width="30" height="4" fill="BG"/>',
  cassetta: '<rect x="10" y="24" width="80" height="52" rx="6"/><rect x="24" y="34" width="52" height="18" rx="9" fill="BG"/><circle cx="36" cy="43" r="6"/><circle cx="64" cy="43" r="6"/><polygon points="28,76 72,76 66,62 34,62" fill="BG"/>',
  biglietto: '<path d="M10 28 H90 V43 A7 7 0 0 0 90 57 V72 H10 V57 A7 7 0 0 0 10 43 Z"/><path d="M66 31 V69" fill="none" stroke="BG" stroke-width="3" stroke-dasharray="4 4"/><polygon points="38,36 42,46 53,46 44,52 48,63 38,56 28,63 32,52 23,46 34,46" fill="BG"/>'
};
const LOGO_COLORS = ['#f2a541', '#e0503f', '#3b7bff', '#49b06a', '#9b5de5', '#f2c53d', '#eee9df', '#1c1d22'];
const defaultLogo = () => ({ shape: 'cerchio', icon: 'cassa', bg: '#1c1d22', fg: '#f2a541', style: 'tour' });
// iniziali delle prime due parole vere del nome (senza "Service", "&",
// "Srl", "S.p.A."…)
function serviceInitials (name) {
  const words = String(name || '').split(/\s+/).filter(w => /^[a-zà-ú]/i.test(w) && !/^(service|srl|snc|spa|s\.[a-z.]+)$/i.test(w));
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
  // un simbolo per ogni parola dei nomi dei service (SERVICE_WORDS), più
  // qualche parola comune; vince la prima parola del nome che ne ha uno
  icon: [
    ['microfono', ['micro', 'mic', 'karaoke', 'prova', 'canta', 'voce', 'vocal', 'soundcheck']],
    ['onda', ['wave', 'onda', 'onde', 'freq', 'echo', 'vibe', 'radio', 'sonic', 'sonor', 'eco', 'larsen', 'feedback', 'riverber', 'fili']],
    ['cassa', ['sound', 'suon', 'audio', 'acust', 'bass', 'boom', 'speaker', 'cassa', 'casse', 'woof', 'subwoof', 'decibel', 'rumor', 'noise', 'volume', 'assordant', 'botto']],
    ['faro', ['luc', 'light', 'lux', 'lamp', 'fari', 'faro', 'faret', 'spot', 'beam', 'ragg', 'lumen', 'controluc', 'occhio', 'ribalta']],
    ['fulmine', ['power', 'elettr', 'volt', 'energ', 'thunder', 'fulmin', 'spark', 'watt', 'ampere', 'flash', 'saetta', 'strobo', 'atomic']],
    ['fader', ['mix', 'fader', 'studio', 'console', 'regia']],
    ['nastro', ['gaffer', 'nastro', 'tape', 'sistem']],
    ['fumo', ['fumo', 'fumog', 'fog', 'smoke', 'nebbi']],
    ['coriandoli', ['coriand', 'confett', 'paillett', 'glitter', 'festa', 'party']],
    ['sipario', ['sipari', 'teatr', 'palco', 'pedana', 'stage', 'scena']],
    ['spina', ['spina', 'ciabatt', 'prolung', 'jack', 'cavi', 'cavo', 'presa', 'stacca']],
    ['palla', ['palla', 'disco', 'balera', 'dance', 'coreograf', 'club']],
    ['nota', ['nota', 'note', 'ritornell', 'tono', 'levare', 'fanfar', 'music', 'melod', 'bis', 'stecca']],
    ['chitarra', ['chitarr', 'guitar', 'rock', 'band']],
    ['tamburo', ['tambur', 'grancass', 'drum', 'batter']],
    ['applauso', ['applaus', 'claque']],
    ['ciak', ['ciak', 'buona', 'take', 'film']],
    ['flightcase', ['flight', 'case', 'roadie', 'carico', 'furgon', 'truck', 'tourn']],
    ['spia', ['spia', 'monitor']],
    ['americana', ['americana', 'truss']],
    ['scaletta', ['scalett', 'setlist', 'scaletta']],
    ['cassetta', ['playback', 'registrat', 'cassett', 'nastrin']],
    ['biglietto', ['esaurit', 'fila', 'bigliett', 'ticket', 'sold']],
    ['stella', ['star', 'stell', 'galax', 'galatt', 'cosmic', 'nova', 'super', 'vip', 'diva', 'groupie']]
  ],
  bg: [
    ['#e0503f', ['ross', 'red', 'fuoco', 'fire', 'rock', 'inferno', 'lava', 'rubin', 'fiamm', 'bollent']],
    ['#3b7bff', ['blu', 'blue', 'azzurr', 'mare', 'sea', 'sky', 'ciel', 'ice', 'ghiacc', 'ocean', 'elettric']],
    ['#49b06a', ['verd', 'green', 'bosc', 'forest', 'smerald', 'lime']],
    ['#f2c53d', ['oro', 'gold', 'sole', 'sun', 'giall', 'yellow', 'ambra', 'dorat']],
    ['#9b5de5', ['viola', 'purple', 'magic', 'mistic', 'lilla', 'violet']],
    ['#1c1d22', ['nero', 'nera', 'black', 'dark', 'night', 'nott', 'buio', 'shadow', 'ombra', 'mezzanott']],
    ['#eee9df', ['bianc', 'white', 'neve', 'snow', 'luna', 'moon']],
    ['#f2a541', ['arancio', 'orange', 'tramont', 'sunset']]
  ],
  style: [
    ['neon', ['neon', 'night', 'nott', 'club', 'disco', 'dance', 'electro', 'balera', 'mezzanott']],
    ['led', ['led', 'digit', 'pixel', 'tech', 'screen', 'video', 'matrix']],
    ['tour', ['rock', 'metal', 'tour', 'band', 'star', 'road']],
    ['stencil', ['crew', 'case', 'stage', 'palco', 'work', 'tecnic', 'truck', 'camion', 'furgon']],
    ['fasci', ['luc', 'light', 'show', 'lux', 'gold', 'oro', 'festa', 'party', 'event']],
    ['gaffer', ['garage', 'nastro', 'tape', 'gaffer', 'artigian', 'bottega', 'fai da te']]
  ]
};
const FIRM_WORDS = new Set(['srl', 'snc', 'spa', 'productions', 'group', 'live', 'eventi', 'entertainment',
  'international', 'soci', 'figli', 'sound', 'brothers', 'show', 'fratelli', 'sorelle']);
function logoFromName (name, variant) {
  variant = variant || 0;
  // parole del nome, senza accenti e senza la parola "service" (la hanno tutti);
  // una parola chiave vale se una parola del nome comincia così ("luc" → Luci)
  const words = String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/).filter(w => w && w !== 'service');
  // il simbolo racconta una parola vera del nome: la prima che ne ha uno,
  // saltando le parole da ditta ("Srl", "Productions", "Live"…)
  const iconFor = w => (NAME_HINTS.icon.find(([, keys]) => keys.some(k => w.startsWith(k))) || [])[0];
  const nameIcon = words.filter(w => w.length > 1 && !FIRM_WORDS.has(w)).map(iconFor).find(Boolean);
  const rand = seededRand(words.join(' ') + '#' + variant);
  const pickHint = list => {
    const hit = list.filter(([, keys]) => keys.some(k => words.some(w => w.startsWith(k))));
    return hit.length ? hit[variant % hit.length][0] : null;
  };
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const icon = nameIcon || (variant % 2 ? pick(Object.keys(LOGO_ICONS)) : 'iniziali');
  const bg = pickHint(NAME_HINTS.bg) || pick(LOGO_COLORS.filter(c => c !== '#eee9df'));
  const fg = logoFg(bg, pick);
  const style = pickHint(NAME_HINTS.style) || pick(Object.keys(BRAND_STYLES));
  return { shape: pick(Object.keys(LOGO_SHAPES)), icon, bg, fg, style };
}
// simbolo in contrasto col fondo: su fondo scuro un colore acceso,
// su fondo acceso il bianco o il nero
function logoFg (bg, pick) {
  const dark = bg === '#1c1d22' || bg === '#9b5de5' || bg === '#3b7bff' || bg === '#e0503f';
  return bg === '#1c1d22' ? pick(['#f2a541', '#f2c53d', '#49b06a', '#3b7bff', '#e0503f'])
    : dark ? pick(['#eee9df', '#f2c53d'].filter(c => c !== bg)) : pick(['#1c1d22', '#1c1d22', '#e0503f'].filter(c => c !== bg));
}

/* ---------------- i service che cercano un tecnico ----------------
   A ogni Nuova partita il tecnico riceve tre offerte di lavoro da tre
   service con nomi assurdi presi dal mondo dello spettacolo. I nomi si
   compongono a caso da questi pezzi (migliaia di combinazioni) e un nome
   già proposto in una partita precedente non torna più (usedServices). */
const SERVICE_WORDS = {
  // parole dello spettacolo, col genere per accordare l'aggettivo
  nouns: [
    ['Larsen', 'm'], ['Feedback', 'm'], ['Riverbero', 'm'], ['Faretto', 'm'], ['Fader', 'm'],
    ['Subwoofer', 'm'], ['Gaffer', 'm'], ['Coriandolo', 'm'], ['Mixer', 'm'], ['Jack', 'm'],
    ['Sipario', 'm'], ['Microfono', 'm'], ['Applauso', 'm'], ['Soundcheck', 'm'], ['Decibel', 'm'],
    ['Controluce', 'm'], ['Occhio di Bue', 'm'], ['Stroboscopio', 'm'], ['Fumogeno', 'm'], ['Karaoke', 'm'],
    ['Playback', 'm'], ['Ritornello', 'm'], ['Roadie', 'm'], ['Flight Case', 'm'], ['Tamburello', 'm'],
    ['Paillette', 'f'], ['Ciabatta', 'f'], ['Macchina del Fumo', 'f'], ['Spia', 'f'], ['Palla Stroboscopica', 'f'],
    ['Prolunga', 'f'], ['Diva', 'f'], ['Groupie', 'f'], ['Fanfara', 'f'], ['Balera', 'f'],
    ['Scaletta', 'f'], ['Pedana', 'f'], ['Americana', 'f'], ['Stecca', 'f'], ['Rockstar', 'f'],
    ['Claque', 'f'], ['Coreografia', 'f'], ['Grancassa', 'f'], ['Chitarra Elettrica', 'f']
  ],
  // aggettivi [maschile, femminile]
  adjectives: [
    ['Furioso', 'Furiosa'], ['Ribelle', 'Ribelle'], ['Stonato', 'Stonata'], ['Cosmico', 'Cosmica'],
    ['Ruggente', 'Ruggente'], ['Bollente', 'Bollente'], ['Selvaggio', 'Selvaggia'], ['Imperiale', 'Imperiale'],
    ['Leggendario', 'Leggendaria'], ['Instancabile', 'Instancabile'], ['Scatenato', 'Scatenata'], ['Stellare', 'Stellare'],
    ['Magnifico', 'Magnifica'], ['Distratto', 'Distratta'], ['Nervoso', 'Nervosa'], ['Tamarro', 'Tamarra'],
    ['Glorioso', 'Gloriosa'], ['Sudato', 'Sudata'], ['Elettrico', 'Elettrica'], ['Volante', 'Volante'],
    ['Disperato', 'Disperata'], ['Galattico', 'Galattica'], ['Sgangherato', 'Sgangherata'], ['Irresistibile', 'Irresistibile'],
    ['Mondiale', 'Mondiale'], ['Atomico', 'Atomica'], ['Assordante', 'Assordante'], ['Dorato', 'Dorata']
  ],
  // complementi che vanno bene con ogni parola
  tails: [
    'a Palla', 'in Fiamme', 'senza Frontiere', 'di Mezzanotte', 'col Botto', 'da Stadio', 'al Neon',
    'a Tutto Volume', 'fuori Tempo', "all'Ultimo Minuto", 'negli Occhi', 'sotto Pressione', 'in Tournée',
    'del Sabato Sera', 'a Ruota Libera', 'senza Fili', 'in Prima Fila', 'in Diretta', 'di Periferia',
    'da Balera', 'in Saldo', 'in Mutande', 'a Gettoni', 'fino all\'Alba'
  ],
  // nomi fatti, già buffi da soli
  whole: [
    'Prova Prova Sa Sa', 'Fumo negli Occhi', 'Mic Drop', 'Palco Morto', 'Uno Due Tre Prova', 'Tutto Esaurito',
    'Luci della Ribalta', 'Cavi e Cavalli', 'Buona la Prima', 'Ultima Fila', 'Staccami la Spina',
    'Applausi Registrati', 'Bis e Tris', 'Canta che ti Passa', 'Nastro Americano', 'Spina Staccata',
    'Mezzo Tono Sotto', 'Sempre in Levare', 'Ci Vediamo al Carico', 'Tanto Lo Sistemiamo'
  ],
  // forme societarie e parole da ditta
  firms: ['Srl', 'S.n.c.', 'S.p.A.', 'Service', 'Productions', '& Figli', 'Group', 'Live', 'Eventi',
    'Entertainment', 'International', '& Soci', 'Sound', 'Brothers', 'Show']
};
// quello che il service fa di solito: tre specialità diverse per le tre
// offerte. Per ora è il carattere della ditta; con più livelli sceglierà
// che lavori arrivano (sagre, teatri, concerti).
const SERVICE_KINDS = {
  piazza: 'Sagre, piazze e feste di paese',
  teatro: 'Teatri, convention e matrimoni',
  concerti: 'Concerti, club e festival'
};
const SERVICE_BOSSES = {
  names: ['Gianni', 'Mirella', 'Sandro', 'Loredana', 'Tonino', 'Rita', 'Bruno', 'Ornella', 'Franco',
    'Patrizia', 'Walter', 'Katia', 'Enzo', 'Moira', 'Dario', 'Gigliola', 'Nando', 'Samantha'],
  nicknames: ['Cinque Minuti', 'Due Fasi', 'Tanto Lo Sistemiamo', 'Nastro Americano', 'Prova Prova',
    'Sempre in Ritardo', 'Mixer Umano', 'Quello del Furgone', 'Occhio di Bue', 'Senza Scaletta',
    'Mai Una Gioia', 'Trifase', 'Ultimo a Smontare', 'Decibel', 'Ci Pensa Lui', 'Salvavita']
};
const randItem = (arr, rand) => arr[Math.floor((rand || Math.random)() * arr.length)];
const serviceKey = name => String(name).toLowerCase().replace(/[^a-z0-9àèéìòù]+/g, ' ').trim();
function randomServiceName (rand) {
  const W = SERVICE_WORDS, r = rand || Math.random;
  const [noun, g] = randItem(W.nouns, r);
  const firm = () => randItem(W.firms, r);
  switch (Math.floor(r() * 5)) {
    case 0: return noun + ' ' + randItem(W.adjectives, r)[g === 'f' ? 1 : 0] + ' ' + firm();
    case 1: return noun + ' ' + randItem(W.tails, r) + (r() < 0.5 ? ' ' + firm() : '');
    case 2: { const other = randItem(W.nouns.filter(n => n[0] !== noun), r)[0]; return noun + ' & ' + other; }
    case 3: return (r() < 0.5 ? 'Fratelli ' : 'Sorelle ') + noun + (r() < 0.4 ? ' ' + firm() : '');
    default: return randItem(W.whole, r) + ' ' + firm();
  }
}
/* tre offerte con nomi mai visti (né tra loro né nelle partite prima),
   parole di testa diverse, specialità, capi e colori del marchio diversi */
function serviceOffers (used, rand) {
  const r = rand || Math.random;
  const seen = new Set((used || []).map(serviceKey));
  const kinds = Object.keys(SERVICE_KINDS).sort(() => r() - 0.5);
  const bgs = [], heads = new Set(), bossWords = new Set(), offers = [];
  for (let tries = 0; offers.length < 3 && tries < 500; tries++) {
    const name = randomServiceName(r);
    const head = serviceKey(name).split(' ').filter(w => !/^(fratelli|sorelle)$/.test(w))[0];
    if (name.length > SERVICE_NAME_MAX || seen.has(serviceKey(name)) || heads.has(head)) continue;
    seen.add(serviceKey(name)); heads.add(head);
    const logo = logoFromName(name);
    if (bgs.includes(logo.bg)) {
      logo.bg = randItem(LOGO_COLORS.filter(c => c !== '#eee9df' && !bgs.includes(c)), r);
      logo.fg = logoFg(logo.bg, arr => randItem(arr, r));
    }
    bgs.push(logo.bg);
    const bossName = randItem(SERVICE_BOSSES.names.filter(n => !bossWords.has(n)), r);
    const nick = randItem(SERVICE_BOSSES.nicknames.filter(n => !bossWords.has(n)), r);
    bossWords.add(bossName); bossWords.add(nick);
    offers.push({ name, logo, kind: kinds[offers.length], boss: bossName + ' «' + nick + '»' });
  }
  return offers;
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
  const tx = pad * 2 + ls, tw = W - tx - pad, text = (name || serviceName()).toUpperCase();
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

// un cavo senza la linea disegnata (_pts), che si ricalcola: non va salvata
function edgeData (e) { const { _pts, ...rest } = e; return rest; }

function saveLevel () {
  if (!gameActive) return;
  Profile.data.level = {
    id: LEVEL_ID,
    placed: gameState.placed, edges: gameState.edges.map(edgeData), stock: gameState.stock,
    nextIndex: gameState.nextIndex, edgeSeq: gameState.edgeSeq,
    trips: gameState.trips || 0, rcdTrips: gameState.rcdTrips || 0,
    procErrors: gameState.procErrors || [], stats: gameState.stats,
    giro: gameState.giro, giroFails: gameState.giroFails,
    stockV: 2   // 2: la DI è nella dotazione (prima era a 0)
  };
  Profile.save();
}

/* REPUTAZIONE — misura la professionalità, non la sfortuna:
   - sale: fase completata, guasto gestito bene, birra rifiutata;
   - scende: guasto gestito male (risolto dal bidello, larsen, microfono
     lasciato sull'ingresso sbagliato) o cambio palco così lento da finire
     la pazienza del pubblico;
   - apparecchio rotto: 0, non è colpa del giocatore.
   Parte da 0 e non va sotto lo 0. Ogni fase (e ogni richiesta extra) conta
   una volta sola per tecnico: rifarla non aggiunge altro. I numeri sono
   quelli del documento di design; la reputazione del discorso del preside
   la calcola preside.html con gli stessi numeri. */
const REP = {
  phaseDone: 5,        // fase completata (oggi: il collaudo dell'impianto)
  faultFixedFast: 3,   // guasto risolto in fretta
  beerRefused: 5,      // birra rifiutata in una richiesta extra
  faultByJanitor: -5,  // guasto trovato dal bidello al posto tuo
  feedback: -5,        // larsen
  wrongInput: -2,      // microfono lasciato su un altro ingresso
  slowChange: -5,      // pazienza del pubblico finita per un cambio palco lento
  changeDone: 3,       // cambio palco finito prima che il pubblico perda la pazienza
  deviceBroken: 0,     // apparecchio rotto: non è colpa del giocatore
  scaricoClean: 3,     // scarico senza nessun danno
  scaricoBroken: -2,   // ogni pezzo rotto allo scarico (lì è colpa della crew)
  scaricoKid: -1,      // ogni bambino urtato con un case
  cavi: { 3: 5, 2: 3, 1: 1 }   // posa dei cavi, per stelle (Gerry promuove al 1°, 2°, 3°+ giro)
};
const REP_LOG_KEEP = 50;
const reputation = () => Profile.data.reputation.total;

/* LIVELLI — si aprono a soglie di reputazione (con mezzi, materiale e
   venue più grandi). Oggi si gioca solo il livello 1 (ready): gli altri
   si vedono nella scelta del livello, bloccati con la loro soglia, e
   seguono i cinque scenari di docs/minigioco-scarico.md. Il livello 1
   vale circa 25-30 di reputazione giocato bene: la soglia del 2 si
   raggiunge finendo bene il primo. Le soglie sono una proposta. */
const LEVELS = [
  { id: 1, name: 'Festa della scuola', venue: 'Palestra della scuola', vehicle: 'furgone', rep: 0, ready: true,
    // i sottolivelli (le fasi della serata già nel gioco), da una partita salvata
    phases: [
      { title: 'Arrivo e scarico', done: s => !!s.scarico },
      { title: 'Montaggio e test impianto', done: s => ('L1:collaudo') in ((s.reputation && s.reputation.earned) || {}) },
      { title: 'Messa in sicurezza dei cavi', done: s => !!s.cavi },
      { title: 'Discorso del preside', done: s => !!s.preside },
      { title: 'Cambio palco per il DJ', done: s => !!(s.cambioDj && s.cambioDj.done) },
      { title: 'DJ set', done: s => !!s.dj },
      { title: 'Karaoke di Macio', done: s => !!s.karaoke },
      { title: 'Carico del furgone', done: s => !!s.carico }
    ] },
  { id: 2, name: 'Sagra in piazza', venue: 'Piazza con i sampietrini', vehicle: 'camion', rep: 20 },
  { id: 3, name: 'Matrimonio in villa', venue: 'Giardino di una villa, sotto la pioggia', vehicle: 'camion', rep: 60 },
  { id: 4, name: 'Teatro comunale', venue: 'Teatro con la sponda idraulica guasta', vehicle: 'camion', rep: 110 },
  { id: 5, name: 'Concerto al palazzetto', venue: 'Palazzetto dello sport', vehicle: 'bilico', rep: 180 }
];
const VEHICLE_NAMES = { furgone: 'furgone', camion: 'camion', bilico: 'bilico' };
const levelInfo = id => LEVELS.find(l => l.id === id) || LEVELS[0];
const levelUnlocked = (lv, rep) => rep >= lv.rep;
// quanti livelli sono aperti con questa reputazione
const unlockedCount = rep => LEVELS.filter(l => levelUnlocked(l, rep)).length;

// aggiunge (o toglie) reputazione e dice di quanto è cambiata davvero;
// con onceKey un evento conta una volta sola (es. 'L1:collaudo')
function addReputation (amount, reason, onceKey) {
  const R = Profile.data.reputation;
  if (onceKey && onceKey in R.earned) return 0;
  const before = R.total;
  R.total = Math.max(0, R.total + amount);
  const delta = R.total - before;
  if (onceKey) R.earned[onceKey] = delta;
  R.log = [{ at: Date.now(), amount: delta, reason }].concat(R.log || []).slice(0, REP_LOG_KEEP);
  Profile.save();
  applySettings();
  return delta;
}

// un collaudo riuscito entra nei record del livello (i migliori per primi:
// meno errori, poi meno tempo) e, la prima volta, vale una fase completata;
// restituisce quanta reputazione ha portato
function addRecord () {
  const st = gameState.stats;
  const rec = {
    at: Date.now(), player: Profile.data.player, service: Profile.data.service,
    playMs: st.playMs, tests: st.tests, failedTests: st.failedTests,
    trips: gameState.trips || 0, rcdTrips: gameState.rcdTrips || 0,
    pops: (gameState.procErrors || []).filter(x => x === 'pop').length
  };
  const slips = r => r.failedTests + r.trips + r.rcdTrips + r.pops;
  Profile.data.records[LEVEL_ID] = (Profile.data.records[LEVEL_ID] || []).concat(rec)
    .sort((a, b) => slips(a) - slips(b) || a.playMs - b.playMs)
    .slice(0, RECORDS_KEEP);
  Profile.save();
  return addReputation(REP.phaseDone, 'Collaudo del livello ' + LEVEL_ID, 'L' + LEVEL_ID + ':collaudo');
}

/* ASSISTENTE (dal livello 2) — dove c'è il capo tutor (TUTOR_LEVELS) il
   favore nei guasti grossi lo fa lui; negli altri livelli si assume un
   assistente per la serata. La reputazione è una soglia (non si spende),
   i favori si pagano in birre. Ognuno ha il suo carattere: quante note
   manca alle luci, quanto ci mette, quali guasti sa sistemare, quanti
   favori per set. Design in docs/assistente.md; lo spettacolo che li usa
   non c'è ancora. */
const ASSISTANTS = {
  nico:   { name: 'Nico «Cavetto»',       rep: 10, beers: 1, missEvery: 2, fixS: 25, fixes: ['fase'],        favors: 2,
            line: 'Stagista, tanta voglia e poca pratica: alle luci ne manca una su due, il DMX non lo tocca.' },
  sabri:  { name: 'Sabri «Nastro Nero»',  rep: 20, beers: 1, missEvery: 3, fixS: 15, fixes: ['fase', 'dmx'], favors: 2,
            line: 'Brava quanto il capo: una nota su tre alle luci, sistema fasi e DMX.' },
  tonino: { name: 'Tonino «Ventennale»',  rep: 35, beers: 2, missEvery: 5, fixS: 10, fixes: ['fase', 'dmx'], favors: 3,
            line: 'Vent\'anni di palchi: ne manca una su cinque, velocissimo, ma costa due birre a favore.' }
};
const assistantLevel = (level = LEVEL_ID) => !TUTOR_LEVELS.has(level);
const assistantUnlocked = id => Object.hasOwn(ASSISTANTS, id) && reputation() >= ASSISTANTS[id].rep;
const assistant = () => Object.hasOwn(ASSISTANTS, Profile.data.assistant.id) ? ASSISTANTS[Profile.data.assistant.id] : null;
// assume per la serata (o con null resta da solo); vale solo nei livelli
// senza capo e con la reputazione che basta
function hireAssistant (id, level = LEVEL_ID) {
  if (!assistantLevel(level) || (id !== null && !assistantUnlocked(id))) return false;
  Profile.data.assistant = { id, favors: 0 };
  Profile.save();
  return true;
}
// nuovo set: i favori ripartono da zero, l'assistente resta
function assistantNewSet () { Profile.data.assistant.favors = 0; Profile.save(); }
// l'assistente può andare a sistemare questo guasto grosso ('fase', 'dmx')?
function assistantCanFix (fault) {
  const a = assistant();
  return !!a && a.fixes.includes(fault) && Profile.data.assistant.favors < a.favors && (Profile.data.beers || 0) >= a.beers;
}
// ci va l'assistente: paga le birre e conta il favore; false se non può
function assistantFavor (fault) {
  if (!assistantCanFix(fault)) return false;
  const a = assistant();
  Profile.data.beers -= a.beers;
  Profile.data.assistant.favors++;
  Profile.save();
  applySettings();
  return true;
}

/* STANCHEZZA del tecnico — il tempo della serata si sente addosso.
   Un valore solo, da 0 (riposato) a 100, salvato nel profilo
   (Profile.data.fatigue) e mostrato sotto il tasto 🍺 in testata:
   - sale col tempo di gioco (FATIGUE.perMinute) e con le azioni: ogni
     pezzo posato e ogni cavo collegato (FATIGUE.perAction);
   - scende bevendo una birra dal tasto 🍺 (FATIGUE.beer). La birra bevuta
     non conta più nel punteggio finale: è una scelta, per questo il tasto
     chiede conferma;
   - effetti leggeri, il livello 1 perdona: da FATIGUE.slipFrom in su ogni
     tanto il connettore scivola di mano (il cavo resta in mano, si
     riprova). Nel discorso del preside fader più tremolanti e tempo limite
     del guasto più corto: li calcola preside.html dalla stanchezza che
     riceve, e alla fine la restituisce.
   Nuova partita = tecnico riposato. */
const FATIGUE = { max: 100, perMinute: 1, perAction: 0.25, beer: 30, slipFrom: 70, slipMax: 0.15, confirmMs: 4000 };
const fatigue = () => Profile.data.fatigue || 0;
// quiet: senza salvare subito (il tempo che passa ogni secondo si salva con
// la prossima azione o all'uscita dalla pagina)
function setFatigue (v, quiet) {
  const f = Math.round(Math.max(0, Math.min(FATIGUE.max, +v || 0)) * 100) / 100;
  if (f === fatigue()) return;
  Profile.data.fatigue = f;
  if (!quiet) Profile.save();
  paintBeerBtn();
}
const tireOut = (amount, quiet) => { if (gameActive) setFatigue(fatigue() + amount, quiet); };
// probabilità che un connettore scivoli di mano: 0 fino a slipFrom, poi sale fino a slipMax
const slipChance = () => fatigue() <= FATIGUE.slipFrom ? 0 : FATIGUE.slipMax * (fatigue() - FATIGUE.slipFrom) / (FATIGUE.max - FATIGUE.slipFrom);
const fatigueSlip = () => Math.random() < slipChance();
const fatigueWord = () => { const f = fatigue(); return f < 30 ? 'riposato' : f < 60 ? 'un po\' stanco' : f < 80 ? 'stanco' : 'stanchissimo'; };
function paintBeerBtn () {
  const b = el('#beer-btn');
  if (!b) return;
  b.hidden = !gameActive;
  el('#beer-n').textContent = Profile.data.beers || 0;
  const fill = el('#fat-fill');
  fill.style.width = fatigue() + '%';
  fill.classList.toggle('high', fatigue() >= FATIGUE.slipFrom);
  b.title = 'Stanchezza ' + Math.round(fatigue()) + '% (' + fatigueWord() + ') · birre in tasca: ' + (Profile.data.beers || 0)
    + '. Tocca per bere: stanchezza −' + FATIGUE.beer + ', una birra in meno nel punteggio.';
}
let beerAskAt = 0;
function drinkBeer () {
  if (!gameActive || minigameOpen()) return;
  const f = Math.round(fatigue());
  if (!Profile.data.beers) { showToast('Stanchezza ' + f + '% (' + fatigueWord() + '). Niente birre in tasca: si guadagnano lavorando bene.'); return; }
  if (f < 1) { showToast('Sei riposato: tieni la birra per dopo.'); return; }
  if (Date.now() - beerAskAt > FATIGUE.confirmMs) {
    beerAskAt = Date.now();
    showToast('Stanchezza ' + f + '% (' + fatigueWord() + '). Tocca ancora 🍺 per bere: −' + FATIGUE.beer + ' di stanchezza, ma una birra in meno nel punteggio finale.');
    return;
  }
  beerAskAt = 0;
  Profile.data.beers--;
  setFatigue(fatigue() - FATIGUE.beer);
  applySettings();
  showToast('Glu glu. Stanchezza giù: ' + Math.round(fatigue()) + '%.', 'ok');
}

// tempo di gioco: conta solo con la pagina in vista e il menù chiuso. Nel
// discorso del preside la stanchezza la tiene preside.html
setInterval(() => {
  if (gameActive && !menuOpen && !document.hidden) {
    gameState.stats.playMs += 1000; cambioTick(1000);
    if (!presideOpen) tireOut(FATIGUE.perMinute / 60, true);
  }
}, 1000);

function applySettings () {
  SFX.setVolume(settings().volume);
  paintBeerBtn();
  const tag = el('#service-tag');
  if (tag) tag.textContent = gameActive || Profile.data.service
    ? (playerName() + ' · ' + serviceName()).toUpperCase() + ' · REPUTAZIONE ' + reputation()
    : 'STAGE CREW SIMULATOR';
  const logo = el('#service-logo');
  if (logo) logo.innerHTML = gameActive || Profile.data.service ? logoSVG(serviceLogo(), Profile.data.service, 30) : '';
  // la reputazione ha aperto un livello non ancora visto: puntino sul menù
  const news = slotUsed(Profile.data) && unlockedCount(reputation()) > (Profile.data.levelsSeen || 1);
  ['#menu-btn', '#menu-levels'].forEach(s => { const b = el(s); if (b) b.classList.toggle('news', news); });
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
// nuova partita in preparazione: nome del tecnico, le tre offerte e quella scelta
let draft = { player: '', offers: [], pick: null };

function showMenuPage (page, keep) {
  document.querySelectorAll('#menu-modal .menu-page').forEach(p => { p.hidden = p.dataset.page !== page; });
  const canResume = gameActive || !!Profile.data.level;
  el('#menu-resume').hidden = !canResume;
  el('#menu-resume').textContent = gameActive ? 'Riprendi' : 'Continua · ' + playerName() + ' · ' + serviceName() + ' · ★ ' + reputation();
  el('#menu-new').classList.toggle('primary', !canResume);
  const lv = levelInfo((Profile.data.level && Profile.data.level.id) || LEVEL_ID);
  el('#menu-title').textContent = 'Livello ' + lv.id + ': ' + lv.name;
  el('#set-player-row').hidden = !gameActive;
  if (page !== 'slots') { slotConfirm = null; if (!keep) slotMsg(''); }
  if (page === 'slots') renderSlots();
  if (page === 'levels') renderLevels();
  if (page === 'new' && !keep) {
    if (newSlot == null || Profile.slots()[newSlot]) newSlot = Profile.firstFree();
    // le altre partite restano: la nuova va in uno slot vuoto
    const others = Profile.slots().filter(Boolean).length;
    el('#new-warning').hidden = !others;
    el('#new-warning').textContent = 'La nuova partita va nello slot ' + (newSlot + 1) + ' e il nuovo tecnico parte da reputazione 0. '
      + (others === 1 ? 'L\'altra partita resta salvata' : 'Le altre partite restano salvate') + '; impostazioni e record sono comuni a tutte.';
    draft = { player: Profile.data.player, offers: serviceOffers(Profile.data.usedServices), pick: null };
    const i = el('#player-input');
    i.value = draft.player; setTimeout(() => i.focus(), 30);
    renderOffers();
  }
  if (page === 'settings') {
    el('#set-volume').value = Math.round(settings().volume * 100);
    el('#set-reduced').checked = !!settings().reducedFx;
    el('#set-skipshow').checked = !!settings().skipShow;
    el('#set-skipscarico').checked = !!settings().skipScarico;
    el('#set-testmusic').checked = settings().testMusic !== false;
    el('#set-bosstips').checked = settings().bossTips !== false;
    el('#set-tapemarks').checked = settings().tapeMarks !== false;
    el('#set-trace').checked = settings().traceSignal !== false;
    el('#set-player').value = Profile.data.player;
  }
}

/* le tre offerte di lavoro: marchio del service, che lavori fa e chi è il
   capo. Si tocca quella che si vuole; Inizia vuole anche il nome. */
function renderOffers () {
  const list = el('#service-offers');
  list.innerHTML = '';
  draft.offers.forEach((o, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'offer-card'; b.dataset.offer = i;
    b.innerHTML = '<span class="logo-preview"></span>'
      + '<span class="offer-kind">' + escapeHtml(SERVICE_KINDS[o.kind]) + '</span>'
      + '<span class="offer-boss">Capo: ' + escapeHtml(o.boss) + '</span>';
    b.addEventListener('click', () => { SFX.button(); draft.pick = i; updateNewForm(); });
    list.appendChild(b);
    brandPreview(b.querySelector('.logo-preview'), o.logo, o.name, 300, 72);
  });
  updateNewForm();
}
function updateNewForm () {
  document.querySelectorAll('#service-offers .offer-card').forEach(b => b.classList.toggle('sel', +b.dataset.offer === draft.pick));
  el('#new-start').disabled = !cleanName(draft.player) || draft.pick == null;
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
  setSceneInput(!scheduleOpen && !minigameOpen());
  sceneKeyboard(!minigameOpen());
}
const cleanName = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);

// nuovo tecnico: reputazione da costruire, al lavoro per il service scelto;
// i nomi delle tre offerte non verranno più proposti
function startNewGame (player, offer, offers) {
  // nello slot scelto (vuoto): la partita in corso resta salvata nel suo
  const slot = newSlot != null && !Profile.slots()[newSlot] ? newSlot : Profile.firstFree();
  if (slot >= 0 && slot !== Profile.active) { saveLevel(); Profile.select(slot); }
  newSlot = null;
  Profile.data.player = cleanName(player);
  Profile.data.service = offer.name;
  Profile.data.logo = { ...offer.logo };
  Profile.data.serviceInfo = { kind: offer.kind, boss: offer.boss };
  Profile.data.usedServices = (offers || [offer]).map(o => o.name).concat(Profile.data.usedServices || []).slice(0, USED_SERVICES_KEEP);
  Profile.data.reputation = defaultProfile().reputation;
  Profile.data.scarico = null;
  Profile.data.cavi = null;
  Profile.data.caviGiri = 0;
  Profile.data.preside = null;
  Profile.data.dj = null;
  Profile.data.carico = null;
  Profile.data.cambioDj = null;
  Profile.data.karaoke = null;
  // uno show del DJ o un karaoke ancora aperto o in arrivo della partita vecchia
  clearTimeout(djTimer);
  if (el('#dj-frame')) el('#dj-frame').remove();
  djOpen = false;
  clearTimeout(karaokeTimer);
  if (el('#karaoke-frame')) el('#karaoke-frame').remove();
  karaokeOpen = false;
  Profile.data.beers = 0;
  Profile.data.assistant = defaultAssistant();   // il nuovo tecnico non ha ancora nessuno
  Profile.data.fatigue = 0;      // la serata comincia: tecnico riposato
  Profile.data.tutorSeen = {};   // il nuovo tecnico non ha ancora sentito i consigli del capo
  whenScene(scene => {
    gameActive = true;
    scene.resetLevel(true);      // azzera livello e statistiche e salva
    applySettings();
    closeMenu();
    openSchedule(true);          // prima dei cavi, la scaletta della serata
  });
}
function continueGame () {
  if (gameActive) { closeMenu(); return; }
  whenScene(scene => {
    gameActive = true;
    if (Profile.data.level && Profile.data.level.id === LEVEL_ID) scene.loadLevel(Profile.data.level);
    applySettings();
    closeMenu();
    if (!scaricoDone()) openSchedule(true);   // la partita si era fermata allo scarico
  });
}

/* ---------------- partite salvate (slot) ----------------
   Ogni slot mostra il service (nome e logo), il tecnico, il livello e la
   fase raggiunti, la reputazione e la data dell'ultima partita. Da qui si
   gioca, si esporta in un file, si cancella (con conferma); negli slot
   vuoti si inizia una partita nuova o se ne importa una da file. */
let newSlot = null;        // slot della nuova partita in preparazione
let slotConfirm = null;    // slot di cui si sta chiedendo la conferma per cancellare
let importSlot = null;     // slot vuoto in cui importare il file scelto
const CONTINUE_FLAG = 'scs-continue';   // dopo il cambio di slot a partita in corso

// a che punto è una partita: livello e prima fase non ancora fatta
function slotProgress (s) {
  const lv = levelInfo((s.level && s.level.id) || LEVEL_ID);
  const phases = lv.phases || [];
  const next = phases.find(p => !p.done(s));
  return { level: lv, phase: next ? next.title : 'Serata finita', done: phases.filter(p => p.done(s)).length, of: phases.length };
}
const fmtDate = t => t ? new Date(t).toLocaleString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

function slotMsg (text, kind) {
  const m = el('#slot-msg');
  m.textContent = text || ''; m.hidden = !text;
  m.classList.toggle('bad', kind === 'bad'); m.classList.toggle('ok', kind === 'ok');
}
function renderSlots () {
  const list = el('#slot-list');
  list.innerHTML = '';
  const act = (a, label, cls) => '<button type="button" class="menu-btn' + (cls ? ' ' + cls : '') + '" data-act="' + a + '">' + label + '</button>';
  Profile.slots().forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'slot-card' + (s ? '' : ' empty') + (s && i === Profile.active ? ' active' : '');
    card.dataset.slot = i;
    const num = '<span class="slot-num">Slot ' + (i + 1) + (s && i === Profile.active && gameActive ? ' · in gioco' : '') + '</span>';
    if (!s) {
      card.innerHTML = '<div class="slot-top"><span class="slot-logo none">＋</span><span class="slot-text">' + num
        + '<span class="slot-service">Vuoto</span></span></div>'
        + '<div class="slot-actions">' + act('new', 'Nuova partita') + act('import', 'Importa file') + '</div>';
    } else {
      const pr = slotProgress(s);
      const rep = (s.reputation && s.reputation.total) || 0;
      const text = '<span class="slot-text">' + num
        + '<span class="slot-service">' + escapeHtml(s.service || 'Il service') + '</span>'
        + '<span class="slot-line">Tecnico: <b>' + escapeHtml(s.player || 'Tecnico') + '</b></span>'
        + '<span class="slot-line">Livello <b>' + pr.level.id + ' · ' + escapeHtml(pr.level.name) + '</b>: ' + escapeHtml(pr.phase) + ' (' + pr.done + '/' + pr.of + ')</span>'
        + '<span class="slot-line">Reputazione <b>★ ' + rep + '</b>' + (s.beers ? ' · 🍺 ' + s.beers : '') + '</span>'
        + '<span class="slot-line">Ultima partita: ' + fmtDate(s.savedAt) + '</span></span>';
      card.innerHTML = '<div class="slot-top"><span class="slot-logo">' + (s.logo ? logoSVG(s.logo, s.service, 40) : '') + '</span>' + text + '</div>'
        + (slotConfirm === i
          ? '<p class="slot-confirm">Cancellare la partita di ' + escapeHtml(s.player || 'Tecnico') + '? Non si può annullare.</p>'
            + '<div class="slot-actions">' + act('del-yes', 'Sì, cancella', 'danger primary') + act('del-no', 'No') + '</div>'
          : '<div class="slot-actions">' + act('play', i === Profile.active && gameActive ? 'Riprendi' : 'Gioca', 'primary') + act('export', 'Esporta') + act('del', 'Cancella', 'danger') + '</div>');
      if (!s.logo) card.querySelector('.slot-logo').classList.add('none');
    }
    list.appendChild(card);
  });
}

// gioca la partita di uno slot; a partita in corso si ricarica la pagina,
// così la scena riparte pulita, e la partita scelta si apre da sola
function playSlot (i) {
  if (i === Profile.active) { continueGame(); return; }
  if (gameActive) {
    gameActive = false;            // da qui niente scrive il livello in gioco nello slot nuovo
    Profile.select(i);
    try { sessionStorage.setItem(CONTINUE_FLAG, '1'); } catch (e) { /* senza: si sceglie Continua a mano */ }
    location.reload();
    return;
  }
  Profile.select(i);
  applySettings();
  continueGame();
}
function deleteSlot (i) {
  const wasPlaying = i === Profile.active && gameActive;
  Profile.remove(i);
  slotConfirm = null;
  if (wasPlaying) { gameActive = false; location.reload(); return; }
  applySettings();
  slotMsg('Partita cancellata: lo slot ' + (i + 1) + ' è libero.', 'ok');
  showMenuPage('slots', true);
}
const fileSlug = s => String(s || 'partita').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'partita';
function exportSlot (i) {
  const text = Profile.exportSlot(i);
  if (!text) return;
  const s = Profile.slots()[i];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = 'stage-crew-' + fileSlug(s.service) + '-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  slotMsg('Salvataggio esportato: tienilo da parte e ricaricalo con «Importa file» in uno slot vuoto.', 'ok');
}
function importSlotText (i, text) {
  const r = Profile.importSlot(i, text);
  if (r.error) slotMsg(r.error, 'bad');
  else slotMsg('Partita di ' + (r.slot.player || 'Tecnico') + ' (' + r.slot.service + ') importata nello slot ' + (i + 1) + '.', 'ok');
  showMenuPage('slots', true);
  return r;
}
// Nuova partita: nel primo slot vuoto; se sono tutti pieni se ne cancella uno
function goNewGame (slot) {
  const free = slot != null ? slot : Profile.firstFree();
  if (free < 0) {
    slotMsg('Tutti e ' + SLOT_COUNT + ' gli slot sono occupati: cancella una partita (magari dopo averla esportata) per iniziarne una nuova.', 'bad');
    showMenuPage('slots', true);
    return;
  }
  newSlot = free;
  showMenuPage('new');
}

/* ---------------- scelta del livello ----------------
   I livelli si aprono a soglie di reputazione (LEVELS). Quelli bloccati
   mostrano la soglia e quanto manca; il livello 1 mostra le sue fasi. */
function renderLevels () {
  const game = slotUsed(Profile.data);
  const rep = game ? reputation() : 0;
  el('#levels-intro').textContent = game
    ? 'Reputazione di ' + playerName() + ': ★ ' + rep + '. Con più reputazione si aprono livelli con mezzi, materiale e venue più grandi.'
    : 'Inizia una partita: i livelli si aprono con la reputazione del tecnico.';
  const list = el('#level-list');
  list.innerHTML = '';
  const cur = (Profile.data.level && Profile.data.level.id) || LEVEL_ID;
  LEVELS.forEach(l => {
    const open = levelUnlocked(l, rep);
    const card = document.createElement('div');
    card.className = 'level-card' + (open ? '' : ' locked') + (game && open && l.id === cur ? ' current' : '');
    card.dataset.level = l.id;
    let html = '<span class="slot-num">Livello ' + l.id + (open ? '' : ' · bloccato') + '</span>'
      + '<span class="level-name">' + (open ? '' : '🔒 ') + escapeHtml(l.name) + '</span>'
      + '<span class="slot-line">' + escapeHtml(l.venue) + ' · mezzo: ' + VEHICLE_NAMES[l.vehicle] + '</span>';
    if (!open) {
      html += '<span class="level-lock">Si apre con ★ ' + l.rep + (game ? ' (ti mancano ' + (l.rep - rep) + ')' : '') + '</span>'
        + '<span class="level-bar"><i style="width:' + Math.round(100 * Math.min(1, rep / l.rep)) + '%"></i></span>';
    } else if (!l.ready) {
      html += '<span class="level-lock">Aperto: arriva nelle prossime versioni del gioco.</span>';
    } else {
      if (l.phases) html += '<ul class="level-phases">' + l.phases.map((p, k) => {
        const st = !game ? '' : p.done(Profile.data) ? 'done' : l.phases.findIndex(q => !q.done(Profile.data)) === k ? 'now' : '';
        return '<li class="' + st + '">' + (st === 'done' ? '✓ ' : st === 'now' ? '▶ ' : '· ') + escapeHtml(p.title) + '</li>';
      }).join('') + '</ul>';
      html += '<div class="slot-actions"><button type="button" class="menu-btn primary" data-act="play-level">' + (game ? (gameActive ? 'Riprendi' : 'Continua') : 'Nuova partita') + '</button></div>';
    }
    card.innerHTML = html;
    list.appendChild(card);
  });
  // i livelli nuovi ora sono stati visti: via il puntino dal menù
  if (game && unlockedCount(rep) !== Profile.data.levelsSeen) { Profile.data.levelsSeen = unlockedCount(rep); Profile.save(); applySettings(); }
}

/* ---------------- scaletta della serata ----------------
   Il foglio di lavoro del livello: chi ti manda, dove, e gli orari della
   serata dal carico allo smontaggio. Si apre all'inizio di una nuova
   partita (prima di mettere mano ai cavi) e si riapre dal tasto 📋.
   Le fasi senza "phase" non sono ancora nel gioco: si vedono come
   "in arrivo", così il giocatore sa dove va a finire la serata. Quelle
   "fuori programma" non sono sul foglio: compaiono solo quando arrivano. */
const SCHEDULE = [
  { time: '16:00', title: 'Arrivo e scarico', text: 'Il furgone accosta al cortile: tu e Macio portate i case nella palestra prima delle 16:30.', phase: 'scarico' },
  { time: '16:30', title: 'Montaggio impianto', text: 'Corrente dal Quadro, PC → scheda → mixer → finale → casse, i PAR in DMX dalla consolle.', phase: 'montaggio' },
  { time: '19:30', title: 'Test impianto', text: 'Il collaudo: tutto acceso senza scatti né colpi nelle casse, audio e luci a posto.', phase: 'collaudo', rep: REP.phaseDone },
  { time: '20:00', title: 'Messa in sicurezza dei cavi', text: 'I cavi stesi al montaggio come si deve: via di fuga libera, passaggi attraversati dritti, niente cavi in mezzo alla scena, segnale lontano dalla corrente. Gerry, il bidello, controlla prima di aprire.', phase: 'cavi' },
  { time: '20:30', title: 'Apertura porte', text: 'Entrano famiglie e studenti; musica di sottofondo dal PC.', phase: 'porte' },
  { time: '21:00', title: 'Discorso del Preside Tramp', text: 'Microfono su asta sul palco, cablato a un ingresso MIC del mixer: ricordati quale. Vuole essere sentito fino al parcheggio.', phase: 'preside' },
  { time: '21:10', title: 'Cambio palco: arriva il DJ', text: 'DJ Inestimabile porta la sua consolle: corrente, uscite nella DI e dalla DI al mixer. Il microfono resta dov\'è, per Musa Esistenziale. Il pubblico aspetta: non metterci troppo.', phase: 'cambio-dj', rep: REP.changeDone },
  { time: '21:15', title: 'Notte fuori controllo', text: 'DJ Inestimabile in consolle e Musa Esistenziale al microfono: mixer DJ → DI → mixer di sala, il microfono del vocalist, luci colorate al drop. E tanti guasti da inseguire.', poster: 'img/locandina-dj.svg', phase: 'dj' },
  { time: '22:00', title: 'Fuori programma: il karaoke di Macio', text: 'Gerry ha cacciato il DJ. Macio prende il microfono e salva la serata con una canzone scritta lì per lì: tu mandi avanti il testo e tieni la sua voce nel verde.', phase: 'karaoke', surprise: true },
  { time: '23:00', title: 'Smontaggio e carico', text: 'Tutto nei case e i case nel furgone: Macio li porta fuori, tu li incastri e li leghi con tre cinghie. Gerry chiude il cancello alle 23:30.', phase: 'carico' }
];
const collaudoDone = () => ('L' + LEVEL_ID + ':collaudo') in Profile.data.reputation.earned;
function schedulePhaseState (phase) {
  if (!phase) return 'soon';
  if (phase === 'scarico') return scaricoDone() ? 'done' : 'now';
  if (phase === 'montaggio') return collaudoDone() ? 'done' : scaricoDone() ? 'now' : 'next';
  if (phase === 'cavi') return caviDone() ? 'done' : collaudoDone() ? 'now' : 'next';
  if (phase === 'porte') return caviDone() ? 'done' : 'next';
  if (phase === 'preside') return presideDone() ? 'done' : caviDone() ? 'now' : 'next';
  if (phase === 'cambio-dj') return cambioDjDone() ? 'done' : presideDone() ? 'now' : 'next';
  if (phase === 'dj') return djDone() ? 'done' : cambioDjDone() ? 'now' : 'next';
  if (phase === 'karaoke') return karaokeDone() ? 'done' : djDone() ? 'now' : 'next';
  // il carico chiude la serata: dopo il karaoke di Macio
  if (phase === 'carico') return caricoDone() ? 'done' : karaokeDone() ? 'now' : 'next';
  return collaudoDone() ? 'done' : 'next';
}
const SCHEDULE_STATE_LABEL = { done: 'Fatto', now: 'Adesso', next: 'Da fare', soon: 'In arrivo' };

function renderSchedule () {
  const info = Profile.data.serviceInfo;
  const rows = [
    ['Cliente', 'Scuola · festa di fine anno'],
    ['Dove', 'Palestra: palco 4×4 m, allaccio CEE 400V trifase'],
    ['Service', serviceName() + (info && info.boss ? ' · capo: ' + info.boss : '')],
    ['Tecnico', playerName()]
  ];
  el('#schedule-info').innerHTML = rows.map(([k, v]) => '<dt>' + k + '</dt><dd>' + escapeHtml(v) + '</dd>').join('');
  el('#schedule-list').innerHTML = SCHEDULE.filter(s => !s.surprise || djDone()).map(s => {
    const st = schedulePhaseState(s.phase);
    return '<li class="sched-row ' + st + '">'
      + '<span class="sched-time">' + (s.phase === 'montaggio' && scaricoDone() ? montaggioTime() : s.time) + '</span>'
      + '<span class="sched-body"><b>' + escapeHtml(s.title) + '</b>'
      + (s.rep ? ' <span class="sched-rep">+' + s.rep + ' reputazione</span>' : '')
      + '<small>' + escapeHtml(s.phase === 'scarico' && scaricoDone() ? scaricoSummary()
        : s.phase === 'cavi' && caviDone() ? caviSummary()
        : s.phase === 'preside' && presideDone() ? presideSummary()
        : s.phase === 'cambio-dj' && cambioDjDone() ? cambioSummary()
        : s.phase === 'dj' && djDone() ? djSummary()
        : s.phase === 'karaoke' && karaokeDone() ? karaokeSummary()
        : s.phase === 'carico' && caricoDone() ? caricoSummary()
        : s.phase === 'montaggio' ? s.text.replace('i PAR', parsRequired() + ' PAR') : s.text) + '</small>'
      + (s.poster ? '<button class="sched-poster" type="button" data-poster="' + s.poster + '">🎟️ Guarda la locandina</button>' : '')
      + '</span>'
      + '<span class="sched-state">' + SCHEDULE_STATE_LABEL[st] + '</span></li>';
  }).join('');
}
// first: aperta dalla nuova partita; chiudendola si parte col montaggio.
// scheduleNext: la fase che il tasto della scaletta apre (posa, discorso o cambio palco)
let scheduleOpen = false, scheduleFirst = false, scheduleNext = null;
function openSchedule (first) {
  scheduleOpen = true;
  scheduleFirst = !!first;
  renderSchedule();
  // dopo il collaudo la scaletta porta alla posa dei cavi, poi al discorso
  // del preside, poi al cambio palco per il DJ
  scheduleNext = first ? null : schedulePhaseState('cavi') === 'now' ? 'cavi' : schedulePhaseState('preside') === 'now' ? 'preside'
    : schedulePhaseState('cambio-dj') === 'now' && !cambioDj() ? 'cambio-dj' : schedulePhaseState('dj') === 'now' ? 'dj'
    : schedulePhaseState('karaoke') === 'now' ? 'karaoke' : schedulePhaseState('carico') === 'now' ? 'carico' : null;
  el('#schedule-go').textContent = first ? 'Al lavoro!' : { cavi: 'Chiama Gerry', preside: 'Il preside sale sul palco', 'cambio-dj': 'Inizia il cambio palco', dj: 'Via al DJ set', karaoke: 'Macio prende il microfono', carico: 'Carica il furgone' }[scheduleNext] || 'Torna al palco';
  el('#schedule-modal').classList.add('show');
  setSceneInput(false);
}
function closeSchedule () {
  if (!scheduleOpen) return;
  scheduleOpen = false;
  el('#schedule-modal').classList.remove('show');
  if (scheduleFirst) { if (scaricoDone()) showToast(montaggioMessage(), 'ok'); else openScarico(); }
  setTimeout(() => { if (!sceneCovered()) setSceneInput(true); }, 0);
  scheduleFirst = false;
}

/* ---------------- lo scarico (16:00) ----------------
   Minigioco a sé (scarico.html, con la fisica di Matter.js), aperto a
   tutto schermo in un iframe sopra il gioco appena si chiude la prima
   scaletta. Quando finisce manda il risultato con postMessage: quello che
   si è rotto manca al montaggio (levelStock), il ritardo sposta l'inizio
   del montaggio, birre e reputazione restano nel salvataggio. Si può
   saltare (dalle impostazioni o dalla sua schermata iniziale): tutto arriva
   sano, ma niente birre. */
let scaricoOpen = false;
// volume ed «Effetti ridotti» delle impostazioni, passati ai minigiochi nell'indirizzo dell'iframe
function minigameQuery () { return '&vol=' + settings().volume + (reducedFx() ? '&rfx=1' : ''); }
// un messaggio vale solo se arriva davvero dall'iframe di quel minigioco
const fromFrame = (ev, id) => { const f = el('#' + id); return !!f && ev.source === f.contentWindow; };
const scaricoDone = () => !!Profile.data.scarico;
function openScarico () {
  if (scaricoOpen) return;
  if (settings().skipScarico) { finishScarico({ skipped: true }); return; }
  scaricoOpen = true;
  setSceneInput(false);
  sceneKeyboard(false);
  const f = document.createElement('iframe');
  f.id = 'scarico-frame';
  f.title = 'Lo scarico';
  const logo = serviceLogo();
  f.src = 'scarico.html?embed=1&service=' + encodeURIComponent(serviceName()) + '&bg=' + encodeURIComponent(logo.bg) + '&fg=' + encodeURIComponent(logo.fg) + minigameQuery();
  f.addEventListener('load', () => { try { f.contentWindow.focus(); } catch (e) { /* niente fuoco: si clicca */ } });
  document.body.appendChild(f);
}
window.addEventListener('message', ev => {
  const d = ev.data;
  if (scaricoOpen && d && d.type === 'scarico-fine' && fromFrame(ev, 'scarico-frame')) finishScarico(d.result || { skipped: true });
});
function finishScarico (r) {
  const f = el('#scarico-frame');
  if (f) f.remove();
  scaricoOpen = false;
  const parsBroken = r.parsBroken || 0, staBroken = r.staBroken ? 1 : 0, ricOk = r.ricOk !== false;
  // il case ricambi sano rimpiazza un PAR e uno stativo
  const lost = { par: Math.max(0, parsBroken - (ricOk && parsBroken ? 1 : 0)), stativo: Math.max(0, staBroken - (ricOk && staBroken ? 1 : 0)) };
  Profile.data.scarico = {
    skipped: !!r.skipped, lost, parsBroken, staBroken: !!staBroken, ricOk,
    delay: r.skipped ? 0 : (r.minutes || 0), beers: r.skipped ? 0 : (r.beers || 0),
    endClock: r.endClock || '16:30', faulty: r.faulty || [], faultyIds: r.faultyIds || [], fixed: {},
    wrong: r.wrong || [], kidHits: r.kidHits || 0
  };
  Profile.data.beers = (Profile.data.beers || 0) + Profile.data.scarico.beers;
  if (!r.skipped) {
    const rotti = parsBroken + staBroken + (ricOk ? 0 : 1);
    const rep = (r.clean ? REP.scaricoClean : 0) + rotti * REP.scaricoBroken + (r.kidHits || 0) * REP.scaricoKid;
    if (rep) addReputation(rep, 'Scarico della festa della scuola', 'L' + LEVEL_ID + ':scarico');
  }
  Profile.save();
  whenScene(scene => {
    scene.resetLevel(true);          // la dotazione senza i pezzi rotti
    sceneKeyboard(true);
    if (!sceneCovered()) setSceneInput(true);
    applySettings();
    showToast(montaggioMessage(), 'ok');
  });
}
// ora d'inizio del montaggio: 16:30 più il ritardo dello scarico
function montaggioTime () {
  const m = 30 + ((Profile.data.scarico && Profile.data.scarico.delay) || 0);
  return (16 + Math.floor(m / 60)) + ':' + String(m % 60).padStart(2, '0');
}
function montaggioMessage () {
  const s = Profile.data.scarico;
  let msg = 'Ciao ' + playerName() + ', ' + serviceName() + ' ti manda alla festa della scuola: sono le ' + montaggioTime() + ', monta l\'impianto. Il collaudo è alle 19:30.';
  const miss = [];
  if (s && s.lost && s.lost.par) miss.push(s.lost.par === 1 ? 'un PAR' : s.lost.par + ' PAR');
  if (s && s.lost && s.lost.stativo) miss.push(s.lost.stativo === 1 ? 'uno stativo' : s.lost.stativo + ' stativi');
  const many = miss.length > 1 || (s && s.lost && (s.lost.par > 1 || s.lost.stativo > 1));
  if (miss.length) msg += ' Allo scarico si è rotto qualcosa: ' + (many ? 'mancano ' : 'manca ') + miss.join(' e ') + '.';
  const nf = ((s && s.faultyIds) || []).filter(id => FAULT_BY_CASE[id]).length;
  if (nf) msg += nf === 1 ? ' Un pezzo è arrivato difettoso: ha il segno arancione, toccalo e sistemalo.' : ' ' + nf + ' pezzi sono arrivati difettosi: hanno il segno arancione, toccali e sistemali.';
  return msg;
}
function scaricoSummary () {
  const s = Profile.data.scarico;
  if (s.skipped) return 'Saltato: tutto arrivato sano.';
  const bits = ['Finito alle ' + s.endClock];
  if (s.parsBroken) bits.push(s.parsBroken + ' PAR rott' + (s.parsBroken > 1 ? 'i' : 'o'));
  if (s.staBroken) bits.push('uno stativo piegato');
  if (!s.ricOk) bits.push('case ricambi perso');
  if (s.faulty.length) bits.push('da sistemare: ' + s.faulty.join(', '));
  if (s.delay) bits.push('montaggio alle ' + montaggioTime());
  bits.push(s.beers ? '🍺'.repeat(s.beers) : 'nessuna birra');
  return bits.join(' · ') + '.';
}
/* ---------------- la posa dei cavi (20:00) ----------------
   Minigioco a sé (posa-cavi.html), in un iframe sopra il gioco alla fine
   dello show del primo collaudo riuscito, o dalla scaletta. La pagina
   chiede la pianta: i pezzi posati (le basi: il PAR sta sul suo stativo,
   la regia sul tavolo) e i cavi collegati al montaggio tra basi diverse,
   uniti quando fanno la stessa strada (DMX e PowerCON dei PAR). Gli errori
   li trova solo Gerry; le stelle diventano reputazione, una volta sola. */
const caviDone = () => !!Profile.data.cavi;
const CAVI_LOOK = { sub: 'sub', stativo: 'par', asta: 'asta', tavolo: 'tavolo', quadro: 'quadro', allaccio: 'allaccio' };
// la base di un pezzo montato (PAR → stativo, regia → tavolo, mic → asta)
function posaBase (c) { let b = c; for (let k = 0; k < 3 && b && MOUNTS[b.type]; k++) b = mountBase(b); return b; }
// dove sta una base: se cambia, il percorso steso alla posa non vale più
function posaBaseKey (b) { return b ? b.id + ':' + (b.cells ? b.cells.join(' ') : 'fisso') : ''; }
let caviLines = [];   // i cavi mandati alla posa, con gli id dei cavi del montaggio che raccolgono
function posaLayout () {
  const P = gameState.placed;
  const baseOf = posaBase;
  const devices = {};
  Object.values(P).forEach(c => {
    if (MOUNTS[c.type]) return;
    let r;
    if (c.type === 'allaccio') r = [17, 5, 1, 1];
    else if (c.gx == null) return;
    else {
      // le celle occupate davvero (chiavi "i,j" da 50 cm), come la posa
      const cs = (c.cells || [cellKey(c.gx, c.gy)]).map(k => k.split(',').map(Number));
      const i0 = Math.min(...cs.map(x => x[0])), j0 = Math.min(...cs.map(x => x[1]));
      r = [i0, j0, Math.max(...cs.map(x => x[0])) - i0 + 1, Math.max(...cs.map(x => x[1])) - j0 + 1];
    }
    const top = mountedOn(c);
    const label = c.type === 'tavolo' ? 'REGIA' : c.type === 'stativo' && top ? compLabel(top.id) : compLabel(c.id);
    devices[c.id] = { label, r, look: CAVI_LOOK[c.type] || 'box' };
  });
  const groups = new Map();
  gameState.edges.forEach(e => {
    const a = baseOf(P[e.a]), b = baseOf(P[e.b]);
    if (!a || !b || a.id === b.id || !devices[a.id] || !devices[b.id]) return;
    const k = [a.id, b.id].sort().join('|');
    if (!groups.has(k)) groups.set(k, { from: a.id, to: b.id, cables: [] });
    groups.get(k).cables.push(e);
  });
  const lines = [];
  const lenOf = sig => { const it = cableItem(sig); const m = it && /(\d+) m/.exec(it.info); return m ? +m[1] : 5; };
  const nameOf = sig => { const it = cableItem(sig); return it ? it.name : sig === 'usbc' ? 'USB-C' : 'Corrente'; };
  groups.forEach(g => {
    const cls = { power: [], dmx: [], speaker: [], sig: [] };
    g.cables.forEach(e => (POWER_CABLE_IDS.has(e.signal) || !cableItem(e.signal) && e.signal !== 'usbc' ? cls.power
      : e.signal === 'dmx' ? cls.dmx : e.signal === 'speakon' ? cls.speaker : cls.sig).push(e));
    const mic = [g.from, g.to].some(id => P[id].type === 'asta');
    const add = (kind, es) => {
      if (!es.length) return;
      const names = [...new Set(es.map(e => nameOf(e.signal)))].join(' + ');
      // la linea con cui il montaggio disegna il cavo (e._pts, sullo
      // schermo), riportata in metri: la posa parte da lì
      const pts = es[0]._pts, sgn = baseOf(P[es[0].a]).id === g.from ? 1 : -1;
      const guide = pts && pts.map(pt => {
        const rx = (pt.x - ORIGIN_X) / (TILE_W / 2), ry = (pt.y - ORIGIN_Y) / (TILE_H / 2);
        return [(rx + ry) / 2, (ry - rx) / 2];
      });
      lines.push({ id: 'l' + lines.length, from: g.from, to: g.to, kind, len: Math.min(...es.map(e => lenOf(e.signal))),
        name: names + ' · ' + devices[g.to].label, guide: guide && (sgn > 0 ? guide : guide.reverse()), edges: es.map(e => e.id) });
    };
    if (cls.power.length && cls.dmx.length) { add('dmx', cls.power.concat(cls.dmx)); cls.power = []; cls.dmx = []; }
    add('power', cls.power); add('data', cls.dmx); add('speaker', cls.speaker); add(mic ? 'mic' : 'signal', cls.sig);
  });
  caviLines = lines;
  return { title: 'Festa della scuola', sub: 'La tua regia · Gerry controlla alle 20:30', devices, lines };
}
/* GERRY AL MONTAGGIO — i cavi si stendono già al montaggio (StageScene.
   startLay); alle 20:00 Gerry, il bidello, passa e li controlla con le
   regole della posa (docs/minigioco-posa-cavi.md). Celle da 50 cm come la
   posa: i = gx / CELL, j = gy / CELL. Passacavi e nastro li mette la crew
   da sola: si guarda solo da dove passano i cavi. */
const GERRY_PASSAGES = [
  { id: 'artisti', label: 'passaggio degli artisti', r: [13, 4, 2, 4] },
  { id: 'corridoio', label: 'corridoio del pubblico', r: [9, 20, 2, 12] }
];
const GERRY_EXITS = [{ id: 'fuga', label: 'via di fuga', r: [0, 22, 3, 3] }];
const gInRect = (r, i, j) => i >= r[0] && i < r[0] + r[2] && j >= r[1] && j < r[1] + r[3];
// in mezzo alla pedana (il bordo largo 50 cm resta per i cavi)
const gInterior = (i, j) => i >= 5 && i <= 10 && j >= 9 && j <= 14;
// passaggi e via di fuga, senza quelli dove è già stato posato un pezzo
function gerryZones () {
  const busy = new Set();
  Object.values(gameState.placed).forEach(c => (c.cells || []).forEach(k => busy.add(k)));
  const clear = z => { for (let i = z.r[0]; i < z.r[0] + z.r[2]; i++) for (let j = z.r[1]; j < z.r[1] + z.r[3]; j++) if (busy.has(i + ',' + j)) return false; return true; };
  return { passages: GERRY_PASSAGES.filter(clear), exits: GERRY_EXITS.filter(clear) };
}
const GERRY_SENSITIVE = new Set(['xlr', 'jack']);
function gerryCableName (e) {
  const it = cableItem(e.signal);
  return (it ? it.name : cableName(e.signal)) + ' ' + compLabel(e.a) + ' → ' + compLabel(e.b);
}
// le celle che un cavo tocca per terra, con la direzione (h: lungo gx, v: lungo gy)
function gerryCells (e, scene) {
  const f = scene.edgeFloor(e);
  if (!f) return null;
  const P = gameState.placed, own = new Set();
  [posaBase(P[e.a]), posaBase(P[e.b])].forEach(b => (b && b.cells || []).forEach(k => own.add(k)));
  const out = [], seen = new Set(), pts = f.smooth;
  // ogni 25 cm lungo il cavo: la cella e da che parte va (h: lungo gx, v: lungo gy)
  let carry = 0;
  for (let s = 0; s < pts.length - 1; s++) {
    const a = pts[s], b = pts[s + 1], L = Math.hypot(b.gx - a.gx, b.gy - a.gy);
    if (L < 1e-9) continue;
    const dir = Math.abs(b.gx - a.gx) > Math.abs(b.gy - a.gy) ? 'h' : 'v';
    let t = carry;
    for (; t < L; t += CELL / 2) {
      const x = a.gx + (b.gx - a.gx) * t / L, y = a.gy + (b.gy - a.gy) * t / L;
      const i = Math.floor(x / CELL), j = Math.floor(y / CELL), k = i + ',' + j;
      if (own.has(k) || seen.has(k + dir)) continue;
      seen.add(k + dir);
      out.push({ i, j, dir });
    }
    carry = t - L;
  }
  return { cells: out, base: [posaBase(P[e.a]), posaBase(P[e.b])] };
}
function gerryIssues () {
  const scene = window.__scene;
  if (!scene) return [];
  const { passages, exits } = gerryZones();
  const issues = [];
  const add = (type, ids, cells, text) => issues.push({ type, ids, cells, text });
  const use = new Map();
  const nearInterior = b => (b && b.cells || []).some(k => { const [i, j] = k.split(',').map(Number); return [-1, 0, 1].some(di => [-1, 0, 1].some(dj => gInterior(i + di, j + dj))); });
  gameState.edges.forEach(e => {
    const g = gerryCells(e, scene);
    if (!g) return;
    const name = gerryCableName(e);
    const mic = g.base.some(b => b && b.type === 'asta') || g.base.some(nearInterior);
    const fuga = [], open = [], along = [], scena = [];
    g.cells.forEach(c => {
      const k = c.i + ',' + c.j;
      if (!use.has(k)) use.set(k, []);
      use.get(k).push({ e, dir: c.dir });
      if (exits.some(z => gInRect(z.r, c.i, c.j))) fuga.push(c);
      const ps = passages.find(z => gInRect(z.r, c.i, c.j));
      if (ps && c.dir === 'v') along.push(Object.assign({ ps }, c));
      if (!mic && gInterior(c.i, c.j)) scena.push(c);
    });
    if (fuga.length) add('fuga', [e.id], fuga, name + ' passa sulla via di fuga: lì per terra non ci deve essere niente.');
    if (along.length) add('lungo', [e.id], along, name + ' corre lungo il ' + along[0].ps.label + ': i passaggi si attraversano dritti, di traverso.');
    if (scena.length) add('scena', [e.id], scena, name + ' passa in mezzo alla scena: il preside ci inciampa. Sul palco solo il microfono, gli altri lungo i bordi.');
  });
  // ronzio: segnale debole affiancato alla corrente per almeno 1 m
  const pairs = new Map();
  use.forEach((list, k) => {
    list.filter(u => GERRY_SENSITIVE.has(u.e.signal)).forEach(s => list.filter(u => POWER_CABLE_IDS.has(u.e.signal)).forEach(pw => {
      if (s.dir !== pw.dir) return;
      const pk = s.e.id + '|' + pw.e.id;
      if (!pairs.has(pk)) pairs.set(pk, { s: s.e, pw: pw.e, cells: [] });
      pairs.get(pk).cells.push({ i: +k.split(',')[0], j: +k.split(',')[1] });
    }));
  });
  pairs.forEach(({ s, pw, cells }) => {
    if (cells.length < 2) return;
    add('ronzio', [s.id], cells, gerryCableName(s) + ' corre accanto a ' + gerryCableName(pw) + ' per ' + fmtM(cells.length * CELL) + ': ronzio nelle casse. Il segnale incrocia la corrente, non ci va affiancato.');
  });
  return issues;
}
// metri di cavo per terra, nastro (palco, Pit e platea, non lungo i muri) e passacavi
function gerryStats () {
  const scene = window.__scene, { passages } = gerryZones();
  let cableM = 0;
  const tape = new Set(), ramps = new Set();
  gameState.edges.forEach(e => {
    const f = scene && scene.edgeFloor(e);
    if (!f) return;
    cableM += layLength(f.smooth);
    gerryCells(e, scene).cells.forEach(c => {
      const ps = passages.find(z => gInRect(z.r, c.i, c.j));
      if (ps) { ramps.add(ps.id + ':' + c.j); return; }
      const gx = c.i * CELL, gy = c.j * CELL;
      if ((isStageCoreCell(gx, gy) || isPitCell(gx, gy) || isPlateaCell(gx, gy)) && c.i > 0 && c.i < VENUE_W / CELL - 1) tape.add(c.i + ',' + c.j);
    });
  });
  return { cableM, tapeM: tape.size * CELL, ramps: ramps.size };
}
let gerryOpen = false;
// alle 20:00 (o dalla scaletta) Gerry fa il suo giro
function openCavi () {
  if (gerryOpen || caviDone()) return;
  if (window.__scene) window.__scene.endLay(true);
  Profile.data.caviGiri = (Profile.data.caviGiri || 0) + 1;
  Profile.save();
  const issues = gerryIssues();
  gerryOpen = true;
  setSceneInput(false);
  const giro = Profile.data.caviGiri;
  const box = el('#gerry-text'), list = el('#gerry-list');
  if (!issues.length) {
    const stars = Math.max(1, 4 - giro);
    el('#gerry-title').textContent = 'Cavi a posto';
    box.innerHTML = '<p>' + { 3: 'Perfetto al primo giro. Neanche io l\'avrei fatto meglio, e io i cavi li scavalco da trent\'anni!', 2: 'Adesso sì. Si può aprire!', 1: 'Finalmente. Apro le porte, ma la prossima volta pensaci prima.' }[stars] + '</p>'
      + '<p class="gerry-stars">' + '★'.repeat(stars) + '<span>' + '★'.repeat(3 - stars) + '</span></p>';
    list.innerHTML = '';
    el('#gerry-fix').hidden = true;
    el('#gerry-go').textContent = 'Apri le porte';
    el('#gerry-go').onclick = () => { SFX.button(); finishCavi(Object.assign({ stars, inspections: giro }, gerryStats())); };
  } else {
    el('#gerry-title').textContent = ['Fermi tutti!', 'Ancora no, ragazzi.', 'Ci siamo quasi…'][Math.min(2, giro - 1)];
    box.innerHTML = '<p>Prima di aprire le porte qui va sistemato (i punti sono segnati in rosso sul pavimento):</p>';
    list.innerHTML = issues.slice(0, 5).map(i => '<li>' + escapeHtml(i.text) + '</li>').join('')
      + (issues.length > 5 ? '<li class="more">…e altre ' + (issues.length - 5) + ' cose.</li>' : '');
    el('#gerry-fix').hidden = false;
    el('#gerry-go').textContent = 'Apri così';
    el('#gerry-go').onclick = () => {
      SFX.button();
      finishCavi(Object.assign({ late: true, inspections: giro, left: issues.map(i => ({ type: i.type })) }, gerryStats()));
    };
  }
  if (window.__scene) window.__scene.gerryMarks = issues;
  if (window.__scene) window.__scene.redrawEdges();
  el('#gerry-modal').classList.add('show');
}
function closeGerry () {
  if (!gerryOpen) return;
  gerryOpen = false;
  el('#gerry-modal').classList.remove('show');
  setTimeout(() => { if (!sceneCovered()) setSceneInput(true); }, 0);
}
el('#gerry-fix').addEventListener('click', () => {
  SFX.button();
  closeGerry();
  showToast('Sistema i cavi segnati in rosso (tocca un cavo per prenderlo), poi richiama Gerry dalla scaletta.');
});
function finishCavi (r) {
  closeGerry();
  if (window.__scene) window.__scene.gerryMarks = null;
  // late: alle 20:30 Gerry ha aperto con i cavi ancora in giro (nessuna stella)
  const late = !r.skipped && !!r.late;
  const stars = r.skipped || late ? 0 : Math.max(1, Math.min(3, r.stars || 1));
  Profile.data.cavi = { skipped: !!r.skipped, late, stars, inspections: r.inspections || 0, cableM: r.cableM || 0, tapeM: r.tapeM || 0,
    routes: caviRoutes(r.routes), left: late ? (r.left || []) : [] };
  const rep = stars ? addReputation(REP.cavi[stars], 'Posa dei cavi alla festa della scuola', 'L' + LEVEL_ID + ':cavi') : 0;
  Profile.save();
  sceneKeyboard(true);
  if (!sceneCovered()) setSceneInput(true);
  applySettings();
  whenScene(scene => scene.redrawEdges());   // i cavi seguono le pieghe della posa
  const missing = presideReady();
  showToast((r.skipped ? 'Posa dei cavi saltata: Gerry apre le porte, ma la reputazione non cambia.'
    : late ? 'Gerry apre le porte con i cavi ancora in giro. La reputazione non cambia.'
    : 'Cavi a posto, Gerry apre le porte! ' + '★'.repeat(stars) + (rep ? ' Reputazione +' + rep + '.' : ''))
    + (missing ? ' Alle 21:00 parla il preside: ' + missing : ' Alle 21:00 il preside sale sul palco.'), 'ok');
  updateFoglio();
  if (!missing) presideSoon();
}
/* I cavi piegati alla posa restano così anche nell'isometrico: per ogni
   cavo del montaggio le pieghe in metri (dal capo a verso il capo b) e dove
   stavano le due basi. Se una base si sposta, o il cavo si rifà, torna il
   percorso automatico. */
function caviRoutes (routes) {
  const out = {};
  if (!routes) return out;
  caviLines.forEach(l => {
    const pts = routes[l.id];
    if (!pts) return;
    (l.edges || []).forEach(id => {
      const e = gameState.edges.find(x => x.id === id);
      if (!e) return;
      const a = posaBase(gameState.placed[e.a]), b = posaBase(gameState.placed[e.b]);
      const m = pts.map(([i, j]) => [(i + .5) * CELL, (j + .5) * CELL]);
      out[id] = { pts: a && a.id === l.from ? m : m.slice().reverse(), key: posaBaseKey(a) + '|' + posaBaseKey(b) };
    });
  });
  return out;
}
// il percorso della posa di un cavo, sullo schermo (o null)
function caviRoute (e) {
  const r = Profile.data.cavi && Profile.data.cavi.routes && Profile.data.cavi.routes[e.id];
  if (!r) return null;
  const P = gameState.placed;
  if (r.key !== posaBaseKey(posaBase(P[e.a])) + '|' + posaBaseKey(posaBase(P[e.b]))) return null;
  return r.pts.map(([gx, gy]) => {
    const p = gridToScreen(gx, gy);
    // sulla pedana (palco e Off Stage) il cavo sta sopra il rialzo
    return isStageCell(gx - CELL / 2, gy - CELL / 2) ? { x: p.x, y: p.y - PLATFORM_HEIGHT } : p;
  });
}
/* Cosa lo show troverà ancora per terra (la posa finita col tempo): il
   discorso del preside lo fa sentire (preside.html, vedi openPreside). passaggio: qualcuno inciampa nel cavo e lo
   strappa dal mixer; ronzio: 50 Hz nelle casse; scena: il preside inciampa. */
const CAVI_LEFT = { passaggio: 'passaggio', lungo: 'passaggio', fuga: 'passaggio', ronzio: 'ronzio', scena: 'scena' };
const CAVI_LEFT_TEXT = { passaggio: 'qualcuno inciamperà in un cavo nel passaggio', ronzio: 'nelle casse ci sarà ronzio', scena: 'il preside inciamperà in un cavo sul palco' };
function caviLeftovers () {
  const c = Profile.data.cavi;
  return [...new Set(((c && c.left) || []).map(x => CAVI_LEFT[x.type]).filter(Boolean))];
}
function caviSummary () {
  const c = Profile.data.cavi;
  if (c.skipped) return 'Saltata: niente reputazione.';
  if (c.late) {
    const left = caviLeftovers().map(k => CAVI_LEFT_TEXT[k]);
    return 'Porte aperte con i cavi in giro: niente reputazione.' + (left.length ? ' Durante lo show ' + left.join(', ') + '.' : '');
  }
  return '★'.repeat(c.stars) + '☆'.repeat(3 - c.stars) + ' · ' + (c.inspections === 1 ? 'promossa al primo giro di Gerry' : c.inspections + ' giri di Gerry')
    + ' · ' + String(Math.round(c.tapeM * 10) / 10).replace('.', ',') + ' m di nastro.';
}

/* ---------------- il discorso del preside (21:00) ----------------
   La prima fase di spettacolo (preside.html), in un iframe sopra il gioco
   dopo la posa dei cavi, o dalla scaletta. Serve il microfono montato
   sull'asta e collegato a un ingresso MIC del mixer acceso: la pagina riceve
   quell'ingresso (la risposta a «in che ingresso era?» quando si guasta), i
   PAR montati coi loro ruoli, i cavi lasciati dalla posa, le birre in
   tasca e la stanchezza del tecnico. L'esito torna al gioco: reputazione
   una volta sola, birre, stanchezza a fine discorso. */
let presideOpen = false, presideTimer = null;
let djOpen = false;              // lo spettacolo del DJ (openDj, più sotto)
let karaokeOpen = false;         // il karaoke di Macio (openKaraoke, più sotto)
let caricoOpen = false;          // il carico del furgone (openCarico, più sotto)
const presideDone = () => !!Profile.data.preside;
const minigameOpen = () => scaricoOpen || gerryOpen || presideOpen || djOpen || karaokeOpen || caricoOpen;
// una finestra del gioco sopra la scena (menù, scaletta, pannello posteriore, baule)
const panelOpen = () => scheduleOpen || menuOpen || !!rearPanelId || !!openCaseName;
// qualcosa copre la scena: i tocchi non le arrivano finché non si chiude tutto
const sceneCovered = () => panelOpen() || minigameOpen() || cambioCardOpen;
// cosa manca perché il preside possa parlare (null se è tutto pronto)
function presideReady () {
  const asta = placedOfType('asta')[0], mic = placedOfType('mic').find(m => mountBase(m));
  if (!asta || !mic) return 'monta l\'asta sul palco e il microfono sulla giraffa, poi collegalo con un XLR a un ingresso MIC del mixer.';
  if (!micChannel()) return 'collega il microfono con un XLR a un ingresso MIC (1-4) del mixer.';
  const mx = placedOfType('mixer')[0];
  if (!mx || !isRunning(mx.id)) return 'il mixer è spento: accendi l\'impianto.';
  return null;
}
// i PAR montati sugli stativi, da sinistra a destra: taglio, frontali, taglio
function presidePars () {
  const side = { left: 0, front: 1, right: 2 };
  return placedOfType('par').map(p => ({ p, s: mountBase(p) })).filter(x => x.s)
    .sort((a, b) => side[standRole(a.s)] - side[standRole(b.s)] || compCenter(a.s).gx - compCenter(b.s).gx)
    .map(x => ({ label: compLabel(x.p.id), role: standRole(x.s) === 'front' ? 'frontale' : 'taglio' }));
}
function openPreside () {
  clearTimeout(presideTimer);
  if (presideOpen || presideDone() || !caviDone() || scaricoOpen || gerryOpen) return;
  const missing = presideReady();
  if (missing) { showToast('Il preside aspetta dietro le quinte: ' + missing); return; }
  presideOpen = true;
  setSceneInput(false);
  sceneKeyboard(false);
  if (window.__scene) window.__scene.stopFx();
  const f = document.createElement('iframe');
  f.id = 'preside-frame';
  f.className = 'minigame-frame';
  f.title = 'Il discorso del preside';
  f.src = 'preside.html?embed=1' + minigameQuery();
  f.addEventListener('load', () => { try { f.contentWindow.focus(); } catch (e) { /* niente fuoco: si tocca */ } });
  document.body.appendChild(f);
}
// finita la posa, o appena il microfono è pronto: il preside sale da solo
// poco dopo (il tempo di leggere l'avviso), se nel frattempo non si è aperto altro
function presideSoon () {
  clearTimeout(presideTimer);
  presideTimer = setTimeout(() => {
    if (!panelOpen() && !presideReady()) openPreside();
  }, 3000);
}
// un XLR appena collegato può rendere pronto il microfono (l'avviso arriva
// dopo il «Collegato» del pannello, che altrimenti lo coprirebbe)
function presideMicHint () {
  if (!gameActive || presideOpen || schedulePhaseState('preside') !== 'now' || presideReady()) return;
  setTimeout(() => showToast('Microfono pronto sul CH ' + micChannel() + ': il preside sale sul palco!', 'ok'), 0);
  presideSoon();
}
window.addEventListener('message', ev => {
  const d = ev.data, f = el('#preside-frame');
  if (!presideOpen || !d || !f || ev.source !== f.contentWindow) return;
  if (d.type === 'preside-pronto') f.contentWindow.postMessage({ type: 'preside-dati', wired: micChannel(), left: caviLeftovers(), beers: Profile.data.beers || 0, fatigue: fatigue(), pars: presidePars() }, '*');
  if (d.type === 'preside-fine') finishPreside(d.result || { skipped: true });
});
function finishPreside (r) {
  const f = el('#preside-frame');
  if (f) f.remove();
  presideOpen = false;
  const skipped = !!r.skipped;
  const num = (v, d) => Number.isFinite(+v) ? Math.round(+v) : d;
  const beers = skipped ? 0 : Math.max(0, num(r.beers, 0)), drunk = skipped ? 0 : Math.max(0, num(r.drunk, 0));
  Profile.data.preside = { skipped, grad: skipped ? 0 : num(r.grad, 0), rep: skipped ? 0 : num(r.rep, 0), beers, drunk,
    larsens: skipped ? 0 : num(r.larsens, 0), fault: !skipped && !!r.fault };
  Profile.data.beers = Math.max(0, (Profile.data.beers || 0) - drunk + beers);
  // la stanchezza a fine discorso (salito col tempo, sceso con le birre bevute)
  if (!skipped && Number.isFinite(+r.fatigue)) setFatigue(+r.fatigue);
  const rep = skipped ? 0 : addReputation(Profile.data.preside.rep, 'Discorso del preside alla festa della scuola', 'L' + LEVEL_ID + ':preside');
  Profile.save();
  sceneKeyboard(true);
  if (!sceneCovered()) setSceneInput(true);
  applySettings();
  const p = Profile.data.preside;
  showToast(skipped ? 'Discorso saltato: il preside ha parlato lo stesso, ma la reputazione non cambia.'
    : 'Il preside ha finito: pubblico al ' + p.grad + '%.' + (rep ? ' Reputazione ' + (rep > 0 ? '+' : '') + rep + '.' : '')
      + (beers ? ' 🍺 +' + beers + '.' : ''), skipped || p.grad >= 40 ? 'ok' : undefined);
  // dopo il preside tocca al DJ: il cambio palco parte dal foglio (o dalla
  // scaletta), appena letto il messaggio del discorso
  updateFoglio();
  setTimeout(() => {
    if (!cambioDj() && presideDone()) showToast('Alle 21:10 il cambio palco per il DJ: parte dal foglio in alto a sinistra o dalla scaletta 📋.', 'ok');
  }, Math.max(3200, el('#toast').textContent.length * 60) + 300);
}
function presideSummary () {
  const p = Profile.data.preside;
  if (p.skipped) return 'Saltato: niente reputazione.';
  const ch = (cambioDj() && cambioDj().micCh) || micChannel();
  return 'Pubblico al ' + p.grad + '%' + (p.larsens ? ' · larsen: ' + p.larsens : ' · niente larsen')
    + (p.beers ? ' · 🍺 +' + p.beers : '') + ' · reputazione ' + (p.rep >= 0 ? '+' : '') + p.rep + '.'
    + (ch ? ' Il suo microfono resta sul CH ' + ch + ' per il vocalist del DJ.' : '');
}

/* ---------------- il cambio palco per il DJ (21:10) ----------------
   Dopo il discorso del preside (anche saltato) tocca a «Notte fuori
   controllo». Il cambio si fa
   nella vista montaggio: DJ Inestimabile porta la sua consolle (scheda DJ),
   il service ci mette la DI (scheda Regia) e i cavi. La carta del DJ dice
   cosa collegare, il foglio lo spunta mentre si lavora e intanto la
   pazienza del pubblico scende (conta solo il tempo di gioco). Si chiude
   col tasto PRONTI: in tempo vale REP.changeDone, a pazienza finita si è già
   perso REP.slowChange. Il microfono del preside resta sul suo canale:
   passa a Musa Esistenziale, e spostarlo costa REP.wrongInput. */
const CAMBIO_DJ_MS = 4 * 60 * 1000;
const cambioDj = () => Profile.data.cambioDj || null;
const cambioDjOn = () => !!(cambioDj() && !cambioDj().done);
const cambioDjDone = () => !!(cambioDj() && cambioDj().done);
let cambioCardOpen = false;

// dove arriva un'uscita della consolle: la DI in cui entra e il canale MIC
// del mixer in cui esce quel canale della DI (o null)
function djRoute (dj, side) {
  const e1 = dj && gameState.edges.find(x => x.a === dj.id && x.aPort === 'out_' + side && x.signal === 'jack');
  const di = e1 && gameState.placed[e1.b];
  if (!di || di.type !== 'di') return { di: null, ch: null };
  const e2 = gameState.edges.find(x => x.a === di.id && x.aPort === 'out_' + e1.bPort.slice(3) && x.signal === 'xlr');
  const m = e2 && gameState.placed[e2.b];
  return { di, ch: m && m.type === 'mixer' && /^in_[1-4]$/.test(e2.bPort) ? parseInt(e2.bPort.slice(3), 10) : null };
}
// la carta del DJ voce per voce: { ok, what, ids, kind }
function cambioChecks () {
  const dj = placedOfType('dj')[0], dis = placedOfType('di'), mixer = placedOfType('mixer')[0];
  const ids = cs => cs.filter(Boolean).map(c => c.id);
  const L = djRoute(dj, 'L'), R = djRoute(dj, 'R');
  const fed = !!(dj && wiredToQuadro(dj.id));
  const mic = micChannel();
  // le luci del DJ: stativo con 4 PAR e la strobo, una spina e un DMX
  const bar = placedOfType('djluci')[0], ctrl = placedOfType('controller')[0];
  const barFed = !!(bar && wiredToQuadro(bar.id)), u = bar ? dmxUniverse(bar.id) : null, clash = djLuciClashes(bar);
  const list = [
    { ok: !!dj, what: 'Consolle del DJ sul palco', ids: [], kind: 'place' },
    { ok: fed && isRunning(dj.id), what: 'Corrente alla consolle, accesa', ids: ids([dj]), kind: fed ? 'on' : 'power' },
    { ok: dis.length > 0, what: 'Una DI accanto alla consolle', ids: [], kind: 'place' },
    { ok: !!(L.di && R.di), what: 'MASTER L e R della consolle nella DI (jack)', ids: ids([dj, ...dis]), kind: 'wire' },
    { ok: !!(L.ch && R.ch), what: 'Dalla DI due XLR nel mixer' + (L.ch && R.ch ? ' (CH ' + L.ch + ' e CH ' + R.ch + ')' : ', negli ingressi MIC liberi'), ids: ids([...dis, mixer]), kind: 'wire' },
    { ok: !!bar, what: 'Stativo luci del DJ sul palco (4 PAR e strobo)', ids: [], kind: 'place' },
    { ok: barFed && isRunning(bar.id), what: 'Corrente alle luci del DJ', ids: ids([bar]), kind: 'lpower' },
    { ok: u != null && !clash.length, what: 'DMX dalla consolle luci alle luci del DJ' + (u != null ? ' (universo ' + u + ')' : ''),
      ids: ids([bar, u != null ? null : ctrl, ...clash]), kind: clash.length ? 'laddr' : 'ldmx' },
    { ok: !!mic, what: 'Microfono per Musa Esistenziale' + (mic ? ' (CH ' + mic + ')' : ' collegato al mixer'), ids: ids(placedOfType('mic')), kind: 'mic' }
  ];
  // nel cambio non si deve rompere quello che il collaudo ha promosso
  const broken = GIRI.findIndex((g, i) => !giroPasses(i));
  const v = runValidation();
  const lost = broken >= 0 ? giroChecks(broken).find(x => !x.ok) : null;
  list.push({ ok: broken < 0 && v.pass, what: 'Impianto del collaudo ancora a posto', ids: lost ? lost.ids : [], kind: 'rig', lost: lost ? lost.what : v.overPhase ? 'una fase del Quadro è troppo carica' : null });
  return list;
}
function mmss (ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function patienceHtml () {
  const c = cambioDj();
  const left = Math.max(0, c.patienceMs - c.ms), f = left / c.patienceMs;
  const cls = c.slow ? 'over' : f < 0.25 ? 'low' : f < 0.5 ? 'mid' : '';
  return '<div class="patience ' + cls + '"><span>Pazienza del pubblico</span><span class="bar"><span class="fill" style="width:'
    + (f * 100).toFixed(1) + '%"></span></span><span>' + (c.slow ? 'fischi!' : mmss(left)) + '</span></div>';
}
// il tempo del cambio: solo a montaggio finito, con la carta chiusa e senza
// scaletta aperta (menù e pagina nascosta li esclude già il chiamante)
function cambioTick (ms) {
  const c = cambioDj();
  if (!cambioDjOn() || cambioCardOpen || scheduleOpen || gameState.giro < GIRO_COLLAUDO) return;
  c.ms += ms;
  if (!c.slow && c.ms >= c.patienceMs) {
    c.slow = true;
    const d = addReputation(REP.slowChange, 'Cambio palco lento: il pubblico ha perso la pazienza', 'L' + LEVEL_ID + ':cambio-dj:lento');
    showToast('Il pubblico ha perso la pazienza: fischi e «DJ! DJ!» dalla platea.' + (d ? ' Reputazione ' + d + '.' : '') + ' Finisci il cambio e premi PRONTI.', 'bad');
    updateFoglio();
  }
  Profile.save();
  const box = el('#foglio .fg-patience');
  if (box) box.innerHTML = patienceHtml();
}
function startCambioDj () {
  if (!presideDone() || cambioDjDone()) return;
  if (!cambioDj()) {
    Profile.data.cambioDj = { ms: 0, patienceMs: CAMBIO_DJ_MS, micCh: micChannel(), slow: false, done: false, fails: 0 };
    Profile.save();
  }
  openCambioCard();
}
function openCambioCard () {
  const c = cambioDj();
  cambioCardOpen = true;
  el('#cambio-text').innerHTML = '<p><span class="who">DJ Inestimabile</span> arriva con la consolle sotto il braccio, dietro di lui <span class="who">Musa Esistenziale</span>, già a petto nudo, con in spalla lo stativo delle luci del DJ: quattro PAR e una strobo già montati sulla barra. «Dove la metto? Voglio la corrente, il mio suono nell\'impianto e le mie luci sul DMX, subito!»</p>'
    + '<p>Hai ' + Math.round(c.patienceMs / 60000) + ' minuti prima che il pubblico perda la pazienza. '
    + (c.micCh ? 'Il microfono del preside resta sul CH ' + c.micCh + ': ora è di Musa.' : 'Il microfono va collegato al mixer: serve a Musa.') + '</p>';
  el('#cambio-list').innerHTML = [
    'Posa la consolle sul palco (scheda DJ)',
    'Dalle corrente: ha la sua spina Schuko',
    'Una DI accanto alla consolle (scheda Regia)',
    'MASTER L e R nei due ingressi della DI, con due jack',
    'Dalla DI due XLR in due ingressi MIC liberi del mixer',
    'Il suo stativo luci sul palco (4 PAR e la strobo già sulla barra): una spina Schuko',
    'Un DMX dalla consolle luci alla barra: è indirizzata dal ' + DJ_LUCI_DMX.from + ' al ' + DJ_LUCI_DMX.to + ', non pestare i PAR',
    'Accendi la consolle e premi PRONTI'
  ].map(t => '<li>' + escapeHtml(t) + '</li>').join('');
  el('#cambio-modal').classList.add('show');
  setSceneInput(false);
}
function closeCambioCard () {
  if (!cambioCardOpen) return;
  cambioCardOpen = false;
  el('#cambio-modal').classList.remove('show');
  if (!sceneCovered()) setSceneInput(true);
  updateGiroUI();
  const tab = document.querySelector('.tab-btn[data-tab="dj"]');
  if (tab && gameState.stock.dj > 0) tab.click();
  foglioOpen = true;
  updateFoglio();
}
// il cambio è a posto: il DJ attacca
function finishCambioDj () {
  const c = cambioDj();
  c.done = true;
  const mic = micChannel();
  c.micMoved = !!(c.micCh && mic !== c.micCh);
  let rep = 0;
  if (!c.slow) rep += addReputation(REP.changeDone, 'Cambio palco per il DJ', 'L' + LEVEL_ID + ':cambio-dj');
  if (c.micMoved) rep += addReputation(REP.wrongInput, 'Microfono spostato di canale nel cambio palco', 'L' + LEVEL_ID + ':cambio-dj:mic');
  Profile.save();
  SFX.success();
  setCircuitStatus('ok');
  saveLevel();
  updateGiroUI();
  showToast('Pronti! DJ Inestimabile alza il volume e Musa Esistenziale urla nel microfono: si parte. '
    + (c.slow ? 'Il pubblico però ha aspettato troppo. ' : 'Cambio fatto in ' + mmss(c.ms) + '. ')
    + (c.micMoved ? 'Il microfono non è più sul CH ' + c.micCh + ': Musa dovrà cercarselo. ' : '')
    + (rep ? 'Reputazione ' + (rep > 0 ? '+' : '') + rep + '. ' : '')
    + 'Tra poco si accendono le luci del set.', 'ok');
  djSoon(6000);
}
function cambioSummary () {
  const c = cambioDj();
  return (c.slow ? 'Finito a pazienza esaurita: il pubblico ha fischiato.' : 'Finito in ' + mmss(c.ms) + ', prima dei fischi.')
    + (c.micMoved ? ' Microfono spostato dal CH ' + c.micCh + '.' : '');
}
/* ---------------- lo spettacolo del DJ (21:15) ----------------
   «Notte fuori controllo» (dj.html), in un iframe sopra il gioco dopo il
   cambio palco, o dalla scaletta e dal foglio. Il tecnico fa le luci a ritmo
   del brano e insegue i guasti del DJ; per il guasto grosso sceglie se andarci
   lui, pagare una birra al capo o lasciarlo a Gerry. La pagina riceve le
   birre in tasca, il nome del capo e i PAR montati; l'esito torna al gioco:
   reputazione una volta sola, birre bevute e guadagnate. */
let djTimer = null;
const djDone = () => !!Profile.data.dj;
function openDj () {
  clearTimeout(djTimer);
  if (djOpen || djDone() || !cambioDjDone() || minigameOpen()) return;
  djOpen = true;
  setSceneInput(false);
  sceneKeyboard(false);
  if (window.__scene) window.__scene.stopFx();
  const f = document.createElement('iframe');
  f.id = 'dj-frame';
  f.className = 'minigame-frame';
  f.title = 'Notte fuori controllo';
  f.allow = 'autoplay';
  f.src = 'dj.html?embed=1' + minigameQuery();
  f.addEventListener('load', () => { try { f.contentWindow.focus(); } catch (e) { /* niente fuoco: si tocca */ } });
  document.body.appendChild(f);
}
// finito il cambio palco il DJ attacca da solo, appena letto l'avviso
function djSoon (ms) {
  clearTimeout(djTimer);
  djTimer = setTimeout(() => {
    if (!panelOpen() && !cambioCardOpen) openDj();
  }, ms || 3000);
}
window.addEventListener('message', ev => {
  const d = ev.data, f = el('#dj-frame');
  if (!djOpen || !d || !f || ev.source !== f.contentWindow) return;
  if (d.type === 'dj-pronto') {
    const info = Profile.data.serviceInfo;
    f.contentWindow.postMessage({ type: 'dj-dati', beers: Profile.data.beers || 0, boss: info && info.boss ? info.boss : '', pars: presidePars().map(p => p.label), fatigue: fatigue() }, '*');
  }
  if (d.type === 'dj-fine') finishDj(d.result || { skipped: true });
});
function finishDj (r) {
  const f = el('#dj-frame');
  if (f) f.remove();
  djOpen = false;
  const skipped = !!r.skipped;
  const num = (v, d) => Number.isFinite(+v) ? Math.round(+v) : d;
  const beers = skipped ? 0 : Math.max(0, num(r.beers, 0)), drunk = skipped ? 0 : Math.max(0, num(r.drunk, 0));
  const paid = skipped || r.fase !== 'capo' ? 0 : 1;          // la birra pagata al capo
  Profile.data.dj = { skipped, grad: skipped ? 0 : num(r.grad, 0), rep: skipped ? 0 : num(r.rep, 0), beers, drunk: drunk + paid,
    stars: skipped ? 0 : num(r.stars, 0), larsens: skipped ? 0 : num(r.larsens, 0), fase: skipped ? null : (['tu', 'capo', 'gerry'].includes(r.fase) ? r.fase : null) };
  Profile.data.beers = Math.max(0, (Profile.data.beers || 0) - drunk - paid + beers);
  const rep = skipped ? 0 : addReputation(Profile.data.dj.rep, 'Notte fuori controllo: le luci del DJ set', 'L' + LEVEL_ID + ':dj');
  Profile.save();
  sceneKeyboard(true);
  if (!sceneCovered()) setSceneInput(true);
  applySettings();
  const p = Profile.data.dj;
  showToast(skipped ? 'DJ set saltato: la musica c\'è stata lo stesso, ma la reputazione non cambia.'
    : 'Il bidello ha cacciato via i musicisti: la festa è rimasta senza musica. Pubblico al ' + p.grad + '%.' + (rep ? ' Reputazione ' + (rep > 0 ? '+' : '') + rep + '.' : '')
      + (beers ? ' 🍺 +' + beers + '.' : '') + ' Macio prende il microfono: «Ci penso io!»', skipped || p.grad >= 40 ? 'ok' : undefined);
  updateFoglio();
  // fuori programma: Macio sale sul palco appena letto il messaggio
  karaokeSoon(Math.max(3200, el('#toast').textContent.length * 60) + 300);
}
function djSummary () {
  const p = Profile.data.dj;
  if (p.skipped) return 'Saltato: niente reputazione.';
  const who = { tu: 'la fase l\'hai riarmata tu', capo: 'la fase l\'ha riarmata il capo (una birra)', gerry: 'la fase l\'ha riarmata Gerry' }[p.fase];
  return '★'.repeat(p.stars) + '☆'.repeat(5 - p.stars) + ' · pubblico al ' + p.grad + '%' + (p.larsens ? ' · larsen: ' + p.larsens : ' · niente larsen')
    + (who ? ' · ' + who : '') + (p.beers ? ' · 🍺 +' + p.beers : '') + ' · reputazione ' + (p.rep >= 0 ? '+' : '') + p.rep + '.';
}

/* ---------------- il karaoke di Macio (fuori programma, dopo il DJ) ----------------
   Gerry ha cacciato il DJ: Macio, il collega dello scarico, salva la serata
   con un karaoke improvvisato (karaoke.html, in un iframe sopra il gioco).
   Non è sul foglio né sulla locandina: arriva da solo dopo il DJ set, o dalla
   scaletta e dal foglio. Serve il microfono ancora collegato al mixer
   acceso. La pagina riceve birre, stanchezza, nome del capo e canale del
   microfono; l'esito torna al gioco: reputazione una volta sola, birre,
   stanchezza. Dopo viene il carico del furgone (openCarico). */
let karaokeTimer = null;
const karaokeDone = () => !!Profile.data.karaoke;
// cosa manca perché Macio possa cantare (null se è tutto pronto)
function karaokeReady () {
  if (!micChannel()) return 'il microfono non è più collegato: un XLR dal microfono a un ingresso MIC (1-4) del mixer.';
  const mx = placedOfType('mixer')[0];
  if (!mx || !isRunning(mx.id)) return 'il mixer è spento: accendi l\'impianto.';
  return null;
}
function openKaraoke () {
  clearTimeout(karaokeTimer);
  if (karaokeOpen || karaokeDone() || !djDone() || minigameOpen()) return;
  const missing = karaokeReady();
  if (missing) { showToast('Macio aspetta col microfono in mano: ' + missing); updateFoglio(); return; }
  karaokeOpen = true;
  setSceneInput(false);
  sceneKeyboard(false);
  if (window.__scene) window.__scene.stopFx();
  const f = document.createElement('iframe');
  f.id = 'karaoke-frame';
  f.className = 'minigame-frame';
  f.title = 'Il karaoke di Macio';
  f.allow = 'autoplay';
  f.src = 'karaoke.html?embed=1' + minigameQuery();
  f.addEventListener('load', () => { try { f.contentWindow.focus(); } catch (e) { /* niente fuoco: si tocca */ } });
  document.body.appendChild(f);
}
function karaokeSoon (ms) {
  clearTimeout(karaokeTimer);
  karaokeTimer = setTimeout(() => {
    if (!panelOpen() && !cambioCardOpen) openKaraoke();
  }, ms || 3000);
}
window.addEventListener('message', ev => {
  const d = ev.data, f = el('#karaoke-frame');
  if (!karaokeOpen || !d || !f || ev.source !== f.contentWindow) return;
  if (d.type === 'karaoke-pronto') {
    const info = Profile.data.serviceInfo;
    f.contentWindow.postMessage({ type: 'karaoke-dati', beers: Profile.data.beers || 0, boss: info && info.boss ? info.boss : '', mic: micChannel() || 0, fatigue: fatigue() }, '*');
  }
  if (d.type === 'karaoke-fine') finishKaraoke(d.result || { skipped: true });
});
function finishKaraoke (r) {
  const f = el('#karaoke-frame');
  if (f) f.remove();
  karaokeOpen = false;
  const skipped = !!r.skipped;
  const num = (v, d) => Number.isFinite(+v) ? Math.round(+v) : d;
  const beers = skipped ? 0 : Math.max(0, num(r.beers, 0)), drunk = skipped ? 0 : Math.max(0, num(r.drunk, 0));
  Profile.data.karaoke = { skipped, grad: skipped ? 0 : num(r.grad, 0), rep: skipped ? 0 : num(r.rep, 0), beers, drunk,
    stars: skipped ? 0 : Math.max(0, Math.min(5, num(r.stars, 0))), larsens: skipped ? 0 : Math.max(0, num(r.larsens, 0)) };
  Profile.data.beers = Math.max(0, (Profile.data.beers || 0) - drunk + beers);
  if (!skipped && Number.isFinite(+r.fatigue)) setFatigue(+r.fatigue);
  const rep = skipped ? 0 : addReputation(Profile.data.karaoke.rep, 'Il karaoke di Macio alla festa della scuola', 'L' + LEVEL_ID + ':karaoke');
  Profile.save();
  sceneKeyboard(true);
  if (!sceneCovered()) setSceneInput(true);
  applySettings();
  const p = Profile.data.karaoke;
  showToast(skipped ? 'Karaoke saltato: Macio ha cantato lo stesso, ma la reputazione non cambia.'
    : (p.grad >= 45 ? 'Macio ha salvato la serata!' : 'Macio ci ha provato.') + ' Pubblico al ' + p.grad + '%.' + (rep ? ' Reputazione ' + (rep > 0 ? '+' : '') + rep + '.' : '')
      + (beers ? ' 🍺 +' + beers + '.' : '') + ' Ora si smonta e si carica il furgone.', skipped || p.grad >= 40 ? 'ok' : undefined);
  updateFoglio();
}
function karaokeSummary () {
  const p = Profile.data.karaoke;
  if (p.skipped) return 'Saltato: niente reputazione.';
  return '★'.repeat(p.stars) + '☆'.repeat(5 - p.stars) + ' · pubblico al ' + p.grad + '%' + (p.larsens ? ' · larsen: ' + p.larsens : ' · niente larsen')
    + (p.beers ? ' · 🍺 +' + p.beers : '') + ' · reputazione ' + (p.rep >= 0 ? '+' : '') + p.rep + '.';
}

/* ---------------- il carico del furgone (23:00) ----------------
   Minigioco a sé (carico.html, vedi docs/minigioco-carico.md), in un iframe
   sopra il gioco dopo il karaoke di Macio, dalla scaletta o dal foglio. Macio porta
   fuori i case, il tecnico li incastra nel furgone, li lega con tre cinghie
   e si parte: quello che è slegato scivola e sbatte. L'esito torna al gioco:
   reputazione una volta sola (la calcola la pagina dalle stelle) e birre. */
const caricoDone = () => !!Profile.data.carico;
function openCarico () {
  if (caricoOpen || caricoDone() || !karaokeDone() || minigameOpen()) return;
  caricoOpen = true;
  setSceneInput(false);
  sceneKeyboard(false);
  if (window.__scene) window.__scene.stopFx();
  const f = document.createElement('iframe');
  f.id = 'carico-frame';
  f.className = 'minigame-frame';
  f.title = 'Il carico';
  const logo = serviceLogo();
  const info = Profile.data.serviceInfo;
  f.src = 'carico.html?embed=1&service=' + encodeURIComponent(serviceName()) + '&bg=' + encodeURIComponent(logo.bg) + '&fg=' + encodeURIComponent(logo.fg)
    + (info && info.boss ? '&boss=' + encodeURIComponent(info.boss) : '') + minigameQuery();
  f.addEventListener('load', () => { try { f.contentWindow.focus(); } catch (e) { /* niente fuoco: si tocca */ } });
  document.body.appendChild(f);
}
window.addEventListener('message', ev => {
  const d = ev.data;
  if (caricoOpen && d && d.type === 'carico-fine' && fromFrame(ev, 'carico-frame')) finishCarico(d.result || { skipped: true });
});
function finishCarico (r) {
  const f = el('#carico-frame');
  if (f) f.remove();
  caricoOpen = false;
  const skipped = !!r.skipped;
  const num = (v, d) => Number.isFinite(+v) ? Math.round(+v) : d;
  const stars = skipped ? 0 : Math.max(0, Math.min(5, num(r.stars, 0)));
  const list = v => Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 14) : [];
  Profile.data.carico = { skipped, stars, rep: skipped ? 0 : Math.max(-5, Math.min(5, num(r.rep, 0))), beers: skipped ? 0 : Math.max(0, Math.min(1, num(r.beers, 0))),
    depart: skipped ? null : String(r.depart || '23:00').slice(0, 5), late: !skipped && !!r.late, order: !skipped && !!r.order, coffee: !skipped && !!r.coffee, damaged: skipped ? [] : list(r.damaged), taken: skipped ? [] : list(r.taken) };
  const c = Profile.data.carico;
  Profile.data.beers = (Profile.data.beers || 0) + c.beers;
  const rep = skipped ? 0 : addReputation(c.rep, 'Carico del furgone a fine serata', 'L' + LEVEL_ID + ':carico');
  Profile.save();
  sceneKeyboard(true);
  if (!sceneCovered()) setSceneInput(true);
  applySettings();
  showToast(skipped ? 'Carico saltato: il furgone è partito, ma la reputazione non cambia.'
    : 'Furgone carico, si torna a casa. ' + '★'.repeat(stars) + '☆'.repeat(5 - stars) + (rep ? ' Reputazione ' + (rep > 0 ? '+' : '') + rep + '.' : '') + (c.beers ? ' 🍺 +' + c.beers + '.' : ''), skipped || stars >= 3 ? 'ok' : undefined);
  updateFoglio();
}
function caricoSummary () {
  const c = Profile.data.carico;
  if (c.skipped) return 'Saltato: niente reputazione.';
  return '★'.repeat(c.stars) + '☆'.repeat(5 - c.stars) + ' · partiti alle ' + c.depart + (c.late ? ' (dopo la chiusura)' : '')
    + (c.damaged.length ? ' · rovinati: ' + c.damaged.join(', ') : ' · tutto integro')
    + (c.taken.length ? ' · portati via per sbaglio: ' + c.taken.join(', ') : '')
    + (c.order ? ' · PAR e PC al portellone' : '') + (c.coffee ? ' · caffè di Gerry' : '')
    + (c.beers ? ' · 🍺 +' + c.beers : '') + ' · reputazione ' + (c.rep >= 0 ? '+' : '') + c.rep + '.';
}

el('#cambio-go').addEventListener('click', () => { SFX.button(); closeCambioCard(); });
el('#cambio-close').addEventListener('click', () => { SFX.button(); closeCambioCard(); });

el('#schedule-btn').addEventListener('click', () => { SFX.button(); openSchedule(false); });
el('#beer-btn').addEventListener('click', () => { SFX.button(); drinkBeer(); });
el('#schedule-go').addEventListener('click', () => {
  SFX.button();
  const next = scheduleNext;
  closeSchedule();
  if (next === 'cavi') openCavi(); else if (next === 'preside') openPreside(); else if (next === 'cambio-dj') startCambioDj(); else if (next === 'dj') openDj(); else if (next === 'karaoke') openKaraoke(); else if (next === 'carico') openCarico();
});
el('#schedule-close').addEventListener('click', () => { SFX.button(); closeSchedule(); });
el('#schedule-modal').addEventListener('click', ev => { if (ev.target.id === 'schedule-modal') closeSchedule(); });
// locandina di una fase della scaletta: si apre sopra la scaletta, un tocco la chiude
el('#schedule-list').addEventListener('click', ev => {
  const b = ev.target.closest('.sched-poster');
  if (!b) return;
  SFX.button();
  el('#poster-img').src = b.dataset.poster;
  el('#poster-modal').classList.add('show');
});
el('#poster-modal').addEventListener('click', () => { SFX.button(); el('#poster-modal').classList.remove('show'); });

el('#menu-btn').addEventListener('click', () => { SFX.button(); openMenu('main'); });
el('#menu-resume').addEventListener('click', () => { SFX.button(); continueGame(); });
el('#menu-new').addEventListener('click', () => { SFX.button(); goNewGame(); });
el('#menu-slots').addEventListener('click', () => { SFX.button(); showMenuPage('slots'); });
el('#menu-levels').addEventListener('click', () => { SFX.button(); showMenuPage('levels'); });
el('#slots-back').addEventListener('click', () => { SFX.button(); showMenuPage('main'); });
el('#levels-back').addEventListener('click', () => { SFX.button(); showMenuPage('main'); });
el('#slot-list').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-act]');
  if (!b) return;
  SFX.button();
  const i = +b.closest('.slot-card').dataset.slot, a = b.dataset.act;
  if (a === 'play') playSlot(i);
  else if (a === 'new') goNewGame(i);
  else if (a === 'export') exportSlot(i);
  else if (a === 'import') { importSlot = i; el('#slot-file').value = ''; el('#slot-file').click(); }
  else if (a === 'del') { slotConfirm = i; slotMsg(''); renderSlots(); }
  else if (a === 'del-no') { slotConfirm = null; renderSlots(); }
  else if (a === 'del-yes') deleteSlot(i);
});
el('#slot-file').addEventListener('change', ev => {
  const f = ev.target.files && ev.target.files[0];
  if (!f || importSlot == null) return;
  const i = importSlot;
  if (f.size > 5e6) { slotMsg('Il file è troppo grande per essere un salvataggio.', 'bad'); return; }
  f.text().then(t => importSlotText(i, t), () => slotMsg('Non riesco a leggere il file.', 'bad'));
});
el('#level-list').addEventListener('click', ev => {
  if (!ev.target.closest('button[data-act="play-level"]')) return;
  SFX.button();
  if (slotUsed(Profile.data)) continueGame(); else goNewGame();
});
el('#menu-settings').addEventListener('click', () => { SFX.button(); showMenuPage('settings'); });
el('#new-cancel').addEventListener('click', () => { SFX.button(); showMenuPage('main'); });
el('#new-form').addEventListener('submit', ev => {
  ev.preventDefault();
  if (el('#new-start').disabled) return;
  SFX.button(); startNewGame(draft.player, draft.offers[draft.pick], draft.offers);
});
el('#player-input').addEventListener('input', ev => { draft.player = ev.target.value; updateNewForm(); });
el('#settings-back').addEventListener('click', () => { SFX.button(); Profile.flush(); showMenuPage('main'); });
el('#set-volume').addEventListener('input', ev => { settings().volume = ev.target.value / 100; SFX.setVolume(settings().volume); Profile.save(); });
el('#set-volume').addEventListener('change', () => SFX.button());
el('#set-reduced').addEventListener('change', ev => { settings().reducedFx = ev.target.checked; Profile.save(); });
el('#set-skipshow').addEventListener('change', ev => { settings().skipShow = ev.target.checked; Profile.save(); });
el('#set-skipscarico').addEventListener('change', ev => { settings().skipScarico = ev.target.checked; Profile.save(); });
el('#set-bosstips').addEventListener('change', ev => { settings().bossTips = ev.target.checked; Profile.save(); });
el('#set-tapemarks').addEventListener('change', ev => { settings().tapeMarks = ev.target.checked; Profile.save(); if (window.__scene) window.__scene.drawTapeMarks(); });
el('#set-trace').addEventListener('change', ev => { settings().traceSignal = ev.target.checked; Profile.save(); });
el('#set-testmusic').addEventListener('change', ev => { settings().testMusic = ev.target.checked; Profile.save(); if (window.__scene) window.__scene.updateSignalFlow(); });
el('#set-player').addEventListener('change', ev => {
  const name = cleanName(ev.target.value);
  if (name) Profile.data.player = name;
  ev.target.value = Profile.data.player;
  applySettings(); Profile.save();
});
applySettings();
// all'avvio: la partita dell'ultimo slot usato; senza, le partite salvate
// (se ce ne sono) o direttamente una nuova. Dopo un cambio di slot a
// partita in corso la partita scelta riparte da sola.
{
  let resume = false;
  try { resume = sessionStorage.getItem(CONTINUE_FLAG) === '1'; sessionStorage.removeItem(CONTINUE_FLAG); } catch (e) { /* niente sessione */ }
  if (Profile.data.level) openMenu('main');
  else if (Profile.slots().some(Boolean)) openMenu('slots');
  else { newSlot = Profile.firstFree(); openMenu('new'); }
  if (resume && slotUsed(Profile.data)) continueGame();
}

/* Reset */
el('#reset-btn').addEventListener('click', () => {
  closeMenu();
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
  mic: { style: 'round', serial: 'MICROFONO DINAMICO DA VOCE  ·  CARDIOIDE',
    sections: [['USCITA', [['out', 'XLR OUT']]]] },
  controller: { style: 'desk', accent: true, power: true, serial: 'DMX CONTROLLER  ·  2 UNIVERSI  ·  1024 CH',
    sections: [['DMX OUT', [['dmx_1', 'UNIVERSO 1'], ['dmx_2', 'UNIVERSO 2']]], ['POWER', [['power', 'POWER IN']]]] },
  // sopra le protezioni su guida DIN, sotto ingresso e prese
  quadro: { style: 'cabinet', serial: 'COMBINAZIONE PRESE IN GOMMA  ·  3F+N 16A  ·  IP44',
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
    sections: [['INPUT', [['in_1', 'CH1 IN'], ['in_2', 'CH2 IN']]], ['OUTPUT', [['out_1', 'CH1 OUT'], ['out_2', 'CH2 OUT']]]] },
  // retro del mixer DJ: uscite master e la spina della ciabattina del DJ
  dj: { style: 'desk', accent: true, power: true, serial: 'DJ MIXER 2 CANALI + 2 LETTORI  ·  «NOTTE FUORI CONTROLLO»',
    sections: [['MASTER OUT', [['out_L', 'MASTER L'], ['out_R', 'MASTER R']]], ['ALIMENTAZIONE', [['power', 'SPINA']]]] },
  // piede dello stativo luci del DJ: la spina e il DMX del primo faro della barra
  djluci: { style: 'desk', accent: true, serial: 'T-BAR  ·  4 × LED PAR 18 × 3 W RGB + STROBO LED  ·  DMX ' + DJ_LUCI_DMX.from + '–' + DJ_LUCI_DMX.to,
    sections: [['ALIMENTAZIONE', [['power', 'SPINA']]], ['DMX 512', [['dmx_in', 'DMX IN']]]] }
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
  // solo i PAR hanno un indirizzo: il microfono usa lo stesso pannello tondo
  // ma non deve ricevere un DMX (sfuggirebbe ad annulla/ripeti)
  if (!comp.dmx) { if (comp.type !== 'par') return { addr: 1, mode: 1 }; comp.dmx = { addr: 1, mode: 1 }; }
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
    // leve come quelle vere: generale rossa, salvavita blu, magnetotermici
    // nere; la finestrella sopra fa vedere i contatti (rossa I chiusi, verde O aperti)
    const lever = key === 'rcd' ? '#2f6fd6' : key === 'main' ? '#c4302b' : '#1c1d22';
    const cx = mx + w / 2;
    svg += `<g class="rp-brk" data-brk="${key}" style="cursor:pointer">
      <text x="${cx}" y="${y0 + 32}" font-size="14" font-weight="700" fill="${st.ink}" text-anchor="middle">${label}</text>
      <rect x="${mx}" y="${y0 + 44}" width="${w}" height="150" rx="4" fill="#f7f7f8" stroke="#9a9da3" stroke-width="1.5"/>
      <rect x="${mx + 8}" y="${y0 + 60}" width="${w - 16}" height="122" rx="3" fill="#ececee" stroke="#b5b8bd"/>
      ${[y0 + 52, y0 + 188].map(yy => [0.3, 0.7].map(f => `<circle cx="${mx + w * f}" cy="${yy}" r="4" fill="#c9ccd1" stroke="#7d828c"/><line x1="${mx + w * f - 2.5}" y1="${yy}" x2="${mx + w * f + 2.5}" y2="${yy}" stroke="#7d828c"/>`).join('')).join('')}
      <rect x="${cx - 14}" y="${y0 + 65}" width="28" height="15" rx="2" fill="${on ? '#d6392f' : '#2f9e4f'}" stroke="#55585f"/>
      <text x="${cx}" y="${y0 + 77}" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">${on ? 'I' : 'O'}</text>
      <text x="${cx}" y="${y0 + 93}" font-size="9" font-weight="700" fill="#2a2c32" text-anchor="middle">I ON</text>
      <rect x="${cx - 17}" y="${y0 + 97}" width="34" height="56" rx="4" fill="#b9bcc1" stroke="#8a8e98"/>
      <rect x="${cx - 14}" y="${y0 + 100}" width="28" height="50" rx="3" fill="#d9dbde"/>
      ${on
        ? `<rect x="${cx - 13}" y="${y0 + 124}" width="26" height="6" fill="#00000033"/>`
        : `<rect x="${cx - 13}" y="${y0 + 120}" width="26" height="6" fill="#00000033"/>`}
      <rect x="${cx - 13}" y="${on ? y0 + 101 : y0 + 125}" width="26" height="24" rx="3" fill="${lever}" stroke="#0e0f12"/>
      ${[0, 1, 2].map(i => `<line x1="${cx - 8}" x2="${cx + 8}" y1="${(on ? y0 + 104 : y0 + 138) + i * 3.5}" y2="${(on ? y0 + 104 : y0 + 138) + i * 3.5}" stroke="#ffffff" stroke-opacity=".35" stroke-width="1.5"/>`).join('')}
      <text x="${cx}" y="${y0 + 164}" font-size="9" font-weight="700" fill="#2a2c32" text-anchor="middle">O OFF</text>
      <text x="${cx}" y="${y0 + 177}" font-size="9.5" fill="#5f646d" text-anchor="middle">${spec}</text>`;
    const status = on ? 'ARMATO' : (tripped ? 'SCATTATO' : 'ABBASSATO');
    const sc = on ? '#1f7a40' : (tripped ? '#e0503f' : st.sub);
    svg += `<rect x="${cx - w / 2 + 2}" y="${y0 + 202}" width="${w - 4}" height="22" rx="11" fill="${tripped && !on ? '#e0503f22' : 'transparent'}" stroke="${tripped && !on ? '#e0503f' : 'none'}"/>
      <text x="${cx}" y="${y0 + 217}" font-size="11" font-weight="700" fill="${sc}" text-anchor="middle">${status}</text></g>`;
    if (key === 'rcd') {
      svg += `<g class="rp-brk" data-brk="rcd_test" style="cursor:pointer">
        <circle cx="${mx + w - 22}" cy="${y0 + 125}" r="9" fill="#f2c53d" stroke="#8a5f1f"/>
        <text x="${mx + w - 22}" y="${y0 + 129}" font-size="11" font-weight="700" fill="#2a2c32" text-anchor="middle">T</text></g>`;
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
/* ordine dei pannelli nella vista della regia (tavolo): da sinistra a destra
   sul piano, poi il rack sotto */
const TAVOLO_PANEL_ORDER = ['controller', 'mixer', 'pc', 'scheda', 'ampli'];
const rearIsTable = () => (gameState.placed[rearPanelId] || {}).type === 'tavolo';

function renderRearPanel () {
  const id = rearPanelId;
  const comp = gameState.placed[id];
  if (!comp) { closeRearPanel(); return; }
  const box = el('#rear-svg');
  if (comp.type === 'tavolo') {
    // vista della regia: i pannelli posteriori di tutto quello che sta sul
    // tavolo, uno sotto l'altro, per cablare la regia senza uscire
    const devs = mountedAll(comp).sort((a, b) => TAVOLO_PANEL_ORDER.indexOf(a.type) - TAVOLO_PANEL_ORDER.indexOf(b.type));
    if (!devs.length) { closeRearPanel(); return; }
    el('#rear-title').textContent = compLabel(id) + '  —  la regia da dietro';
    el('#rear-trace').hidden = true;
    box.classList.add('table-view');
    box.innerHTML = devs.map(d => '<div class="rear-block" data-id="' + d.id + '"><div class="rear-block-head">'
      + escapeHtml(compLabel(d.id)) + (d.type === 'ampli' ? ' · nel rack sotto il piano' : '') + '</div>'
      + rearPanelSvg(d.id) + '</div>').join('');
    devs.forEach(d => bindRearSvg(box.querySelector('.rear-block[data-id="' + d.id + '"]'), d.id));
    renderRearHand();
    return;
  }
  box.classList.remove('table-view');
  el('#rear-trace').hidden = settings().traceSignal === false;
  el('#rear-title').textContent = COMPONENT_TYPES[comp.type].label + '  ·  ' + id.replace(/_/g, ' ') + '  —  pannello posteriore';
  box.innerHTML = rearPanelSvg(id);
  bindRearSvg(box, id);
  renderRearHand();
}

// disegno del pannello posteriore di un dispositivo (stringa SVG)
function rearPanelSvg (id) {
  const comp = gameState.placed[id];
  const def = COMPONENT_TYPES[comp.type];
  const panel = REAR_PANELS[comp.type];
  const st = REAR_STYLES[panel.style];
  const pending = gameState.pendingPort;
  const loads = comp.type === 'quadro' ? livePhaseLoads(false) : null;
  const planned = comp.type === 'quadro' ? computePhaseLoads() : null;
  // telefono: pannelli impaginati stretti, scritte più grandi
  const compact = el('#rear-svg').clientWidth < REAR_COMPACT_BELOW;
  const ctx = { id, def, st, pending, loads, planned, compact, fs: compact ? 1.35 : 1 };

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
  return svg;
}

// prese, tasti e interruttori di un pannello disegnato dentro root
function bindRearSvg (root, id) {
  const comp = gameState.placed[id];
  root.querySelectorAll('.rp-port').forEach(node => {
    node.addEventListener('click', () => onRearPortClick(id, node.dataset.port));
  });
  root.querySelectorAll('.rp-btn').forEach(node => {
    node.addEventListener('click', () => onParButton(comp, node.dataset.act));
  });
  root.querySelectorAll('.rp-switch').forEach(node => {
    node.addEventListener('click', () => toggleDevicePower(id));
  });
  root.querySelectorAll('.rp-brk').forEach(node => {
    node.addEventListener('click', () => node.dataset.brk === 'rcd_test' ? testRcd() : toggleProtection(node.dataset.brk));
  });
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

/* i cavi dei bauli che entrano in una presa, come pulsanti nel pannello:
   toccarne uno lo prende e ne infila subito un capo nella presa */
function cablesFor (signal) {
  return Object.values(CABLE_CASES).flatMap(c => c.items.map(it => ({ ...it, caseTitle: c.title })))
    .filter(it => CABLE_TYPES[it.cable].endpoints.includes(signal));
}
function showCableChoice (compId, portId) {
  const p = getPortDef(compId, portId);
  const box = el('#rear-detail');
  const items = cablesFor(p.signal);
  const held = gameState.selectedCable;
  box.innerHTML = '<div class="rear-detail-head">' + escapeHtml(portLabel(compId, portId)) + ' · ' + escapeHtml(SIGNAL_LABEL[p.signal])
    + (held ? ' — il cavo ' + escapeHtml(cableName(held)) + ' non entra qui. Prendi' : ' — prendi') + ' un cavo dal baule:</div>'
    + '<div class="rear-picks">' + items.map(it => '<button class="rear-pick" data-cable="' + it.cable + '"><span class="tape-fluo" style="background:' + tapeColorOf(it.cable) + '">'
      + escapeHtml(it.tape) + '</span><small>' + escapeHtml(it.info) + ' · baule ' + escapeHtml(it.caseTitle) + '</small></button>').join('') + '</div>';
  box.scrollIntoView({ block: 'nearest', behavior: reducedFx() ? 'auto' : 'smooth' });
  box.querySelectorAll('.rear-pick').forEach(b => b.addEventListener('click', () => {
    SFX.pick();
    selectCable(b.dataset.cable);
    box.innerHTML = '';
    onRearPortClick(compId, portId);
  }));
}

/* SEGNI DI NASTRO — la pianta del capo per il livello 1, in metri: croci
   (centro) o angoli di un ingombro (gx, gy, w, h). Dal livello 2 niente. */
const TAPE_LEVELS = new Set([1]);
const TAPE_MARKS = [
  { text: 'QUADRO', gx: 4.75, gy: 2.75, color: '#ff9b21' },
  { text: 'SUB', gx: 1.5, gy: 8.5, color: '#eaff2b' },
  { text: 'SUB', gx: 7.5, gy: 8.5, color: '#eaff2b' },
  { text: 'FRONT.', gx: 2.5, gy: 9.5, color: '#4dff73' },
  { text: 'FRONT.', gx: 6.5, gy: 9.5, color: '#4dff73' },
  { text: 'TAGLIO', gx: 1.25, gy: 5.75, color: '#4dff73' },
  { text: 'TAGLIO', gx: 6.25, gy: 7.25, color: '#4dff73' },
  { text: 'ASTA', gx: 4.25, gy: 6.75, color: '#ff4fb4' },
  { text: 'REGIA', gx: 7, gy: 4.5, w: 1, h: 3, color: '#ff9b21' }
];

/* MUSICA DI PROVA — fin dove arriva il segnale del PC: dal PC acceso alla
   scheda (USB-C), dalla scheda al mixer (jack), dal mixer al finale (XLR),
   dal finale ai sub e dai sub alle teste (Speakon). Ogni apparecchio attivo
   deve essere acceso; la testa è passiva e suona se le arriva il segnale. */
const MUSIC_CABLES = new Set(['usbc', 'jack', 'xlr', 'speakon']);
function musicReach () {
  const reach = new Set();
  const pc = placedOfType('pc').find(c => isRunning(c.id));
  if (!pc) return reach;
  reach.add(pc.id);
  const queue = [pc.id];
  while (queue.length) {
    const id = queue.shift();
    gameState.edges.forEach(e => {
      if (e.a !== id || !MUSIC_CABLES.has(e.signal) || reach.has(e.b)) return;
      const b = gameState.placed[e.b];
      if (!b || !(b.type === 'top' || isRunning(b.id))) return;
      reach.add(b.id);
      queue.push(b.id);
    });
  }
  return reach;
}

/* SEGUI IL SEGNALE — la catena di un dispositivo, anello per anello, fino
   al primo che non va: la musica per l'audio (PC → scheda → mixer → finale
   → sub → testa), il DMX per le luci (consolle → PAR), la corrente per
   Quadro e ciabatte (allaccio → Quadro → ciabatta). Ogni anello: { ids, label,
   ok, why }; la catena si ferma al primo rotto. */
const TRACE_AUDIO = ['pc', 'scheda', 'mixer', 'ampli', 'sub', 'top'];
const TRACE_LIGHTS = ['controller', 'par'];
function whyDown (c) {
  const def = COMPONENT_TYPES[c.type];
  if (def.busPowered) return 'senza USB dal PC';
  if (!powerInPort(def)) return null;
  if (!isPowered(c.id)) return feedingPowerEdge(c.id) ? 'senza corrente' : 'non collegato alla corrente';
  if (SWITCHABLE.has(c.type) && !c.on) return 'spento';
  return null;
}
function traceChain (compId) {
  const comp = gameState.placed[compId];
  if (!comp) return null;
  const steps = [];
  const typeLabel = t => COMPONENT_TYPES[t].label;
  const add = (ids, label, ok, why) => { steps.push({ ids, label, ok, why }); return ok; };
  if (TRACE_AUDIO.includes(comp.type)) {
    const reach = musicReach();
    TRACE_AUDIO.every((t, i) => {
      const cs = placedOfType(t);
      if (!cs.length) return add([], typeLabel(t), false, 'da posare');
      const bad = cs.find(c => !reach.has(c.id));
      if (!bad) return add(cs.map(c => c.id), cs.length > 1 ? typeLabel(t) + ' ×' + cs.length : compLabel(cs[0].id), true);
      return add([bad.id], compLabel(bad.id), false, whyDown(bad) || (i ? 'non gli arriva la musica da ' + typeLabel(TRACE_AUDIO[i - 1]) : 'spento'));
    });
    return { title: 'Musica', steps };
  }
  if (TRACE_LIGHTS.includes(comp.type)) {
    const ct = placedOfType('controller')[0];
    if (!ct) add([], typeLabel('controller'), false, 'da posare');
    else if (add([ct.id], compLabel(ct.id), isRunning(ct.id), whyDown(ct))) {
      const pars = placedOfType('par');
      if (!pars.length) add([], typeLabel('par'), false, 'da posare');
      else {
        const bad = pars.find(p => !isRunning(p.id) || dmxUniverse(p.id) == null);
        if (!bad) add(pars.map(p => p.id), 'PAR ×' + pars.length, true);
        else add([bad.id], compLabel(bad.id), false, whyDown(bad) || 'non sente la consolle (DMX)');
      }
    }
    return { title: 'DMX', steps };
  }
  // la musica del DJ: consolle → DI → due ingressi MIC del mixer
  if (comp.type === 'dj' || comp.type === 'di') {
    const dj = placedOfType('dj')[0];
    if (!dj) add([], typeLabel('dj'), false, 'da posare');
    else if (add([dj.id], compLabel(dj.id), isRunning(dj.id), whyDown(dj))) {
      const L = djRoute(dj, 'L'), R = djRoute(dj, 'R');
      const di = L.di || R.di || placedOfType('di')[0];
      const mx = placedOfType('mixer')[0];
      if (!di) add([], typeLabel('di'), false, 'da posare');
      else if (add([di.id], compLabel(di.id), !!(L.di && R.di), 'non le arrivano MASTER L e R della consolle')) {
        add(mx ? [mx.id] : [], mx ? compLabel(mx.id) : typeLabel('mixer'), !!(L.ch && R.ch), 'la DI non arriva in due ingressi MIC');
      }
    }
    return { title: 'DJ', steps };
  }
  // le luci del DJ: corrente alla barra, poi il DMX dalla consolle luci
  if (comp.type === 'djluci') {
    const ct = placedOfType('controller')[0];
    if (add([comp.id], compLabel(comp.id), isRunning(comp.id), whyDown(comp))) {
      if (!ct) add([], typeLabel('controller'), false, 'da posare');
      else if (add([ct.id], compLabel(ct.id), isRunning(ct.id), whyDown(ct))) {
        const clash = djLuciClashes(comp);
        if (add([comp.id], 'DMX', dmxUniverse(comp.id) != null, 'la barra non sente la consolle luci'))
          add(clash.map(c => c.id), 'Indirizzi', !clash.length, 'canali ' + DJ_LUCI_DMX.from + '-' + DJ_LUCI_DMX.to + ' già usati dai PAR su questo universo');
      }
    }
    return { title: 'Luci DJ', steps };
  }
  // corrente: dal dispositivo si risale fino all'allaccio
  const up = [];
  for (let c = comp, n = 0; c && n < 10; n++) {
    up.unshift(c);
    const e = c.type === 'quadro' ? edgeInto(c.id, 'in', 'cee_tri') : feedingPowerEdge(c.id);
    c = e ? gameState.placed[e.a] : null;
    if (!e) break;
  }
  if (up[0].type !== 'allaccio') add([], 'ALLACCIO', false, 'manca il cavo verso ' + compLabel(up[0].id));
  up.forEach(c => {
    if (steps.length && !steps[steps.length - 1].ok) return;
    if (c.type === 'allaccio') return add([c.id], 'ALLACCIO', true);
    if (c.type === 'quadro') {
      const prot = quadroProt(c);
      const next = up[up.indexOf(c) + 1], e = next && feedingPowerEdge(next.id);
      const ph = e && e.a === c.id ? (COMPONENT_TYPES.quadro.ports.find(p => p.id === e.aPort) || {}).phase : null;
      const why = !prot.main ? 'generale abbassato' : !prot.rcd ? 'salvavita abbassato' : ph && !prot[ph] ? 'fase ' + ph + ' abbassata' : null;
      return add([c.id], compLabel(c.id), !why, why);
    }
    const why = whyDown(c);
    return add([c.id], compLabel(c.id), !why, why);
  });
  return { title: 'Corrente', steps };
}

// seleziona un cavo come farebbe il suo pulsante nella scheda Cavi
function selectCable (cableId) {
  gameState.selectedCable = cableId;
  updateCableHand();
}

/* Spina o cavo di corrente in mano e nessuna presa adatta libera in giro:
   non manca niente, le prese del Quadro accettano più cavi. Si dice come
   arrivarci (chi resta senza ciabatte pensava di dover rubare corrente). */
function noFreeSocketHint (signal) {
  if ((signal !== 'schuko' && signal !== 'powercon') || !window.__scene || window.__scene.compatibleTargets().length) return '';
  const adapter = signal === 'schuko' ? 'cee_schuko' : 'cee_powercon';
  return 'Nessuna presa ' + SIGNAL_LABEL[signal] + ' libera? Non manca niente: le prese del Quadro accettano più cavi. ' +
    'Prendi l\'adattatore ' + cableName(adapter) + ' dal baule (scheda Cavi) e collegalo al Quadro' +
    (signal === 'powercon' ? ', oppure usa il passante PowerCON di un PAR.' : '.');
}
const CIABATTE_FINITE = 'Ciabatte finite: non ne servono altre. Le prese del Quadro accettano più cavi, e con gli adattatori del baule (CEE / Schuko, CEE / PowerCON) ci colleghi qualunque spina.';
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
  // niente cavo in mano (o uno che qui non entra, senza capi in sospeso):
  // si propongono i cavi dei bauli che entrano in questa presa
  const heldFits = gameState.selectedCable && CABLE_TYPES[gameState.selectedCable].endpoints.includes(p.signal);
  if (!gameState.pendingPort && !heldFits) { showCableChoice(compId, portId); return; }
  el('#rear-detail').innerHTML = '';
  const edgesBefore = gameState.edges.length;
  const rcdBefore = gameState.rcdTrips || 0;
  scene.handlePortClick(compId, portId, p.signal);
  const arced = (gameState.rcdTrips || 0) > rcdBefore;   // il salvavita ha già il suo messaggio
  const connected = gameState.edges.length > edgesBefore;
  const picked = !pending && gameState.pendingPort;
  if ((connected || picked) && rearIsTable()) {
    // vista della regia: si resta qui, l'altro capo può essere sul tavolo
    if (picked) showToast('Cavo in mano da ' + compLabel(compId) + ': scegli qui l\'altra presa, o chiudi e tocca il dispositivo da collegare.', 'ok');
    else if (!arced) showToast('Collegato: ' + compLabel(compId) + ' · ' + portLabel(compId, portId) + '.', 'ok');
    renderRearPanel();
    return;
  }
  if (connected || picked) {
    // cavo collegato, o primo capo scelto: si torna alla scena
    closeRearPanel();
    const noSocket = picked && noFreeSocketHint(p.signal);
    if (noSocket) showToast(noSocket);
    else if (picked && p.lead) showToast('Spina in mano: tocca il dispositivo con la presa ' + SIGNAL_LABEL[p.signal] + ' dove infilarla (quelli in verde hanno una presa adatta libera).', 'ok');
    else if (picked) showToast('Cavo in mano: ora tocca il dispositivo da collegare (quelli in verde hanno una presa adatta libera).', 'ok');
    else if (!arced) showToast('Collegato: ' + compLabel(compId) + ' · ' + portLabel(compId, portId) + '.', 'ok');
    // il cavo appena collegato resta in mano: si stende per terra
    if (connected) scene.startLay(gameState.edges[gameState.edges.length - 1].id);
    return;
  }
  renderRearPanel();
}

// mentre il popup è aperto la scena non deve ricevere i tocchi: Phaser
// ascolta il puntatore anche fuori dal canvas, e un tocco sul popup verrebbe
// letto come un tocco sul pavimento (che annulla il cavo in mano)
function setSceneInput (on) {
  const scene = window.__scene;
  // si apre un pannello o un menù: il cavo in mano resta come è stato steso
  if (!on && scene && scene.lay) scene.endLay(true);
  if (scene && scene.input) scene.input.enabled = on;
}
function openRearPanel (compId) {
  const t = (gameState.placed[compId] || {}).type;
  if (t === 'stativo' && isFaulty(compId)) { SFX.button(); fixFault('stativo'); return; }
  if (t === 'stativo') {
    const par = mountedOn(gameState.placed[compId]);
    showToast(par ? compLabel(compId) + ' regge ' + compLabel(par.id) + ': tocca il faro per il suo pannello.'
      : compLabel(compId) + ': monta un PAR sulla barra a T (scheda Luci, poi tocca lo stativo).');
    return;
  }
  if (t === 'tavolo' && !mountedAll(gameState.placed[compId]).length) {
    showToast(compLabel(compId) + ': sopra vanno mixer, consolle luci, PC e scheda audio, sotto il rack del finale (schede Audio, Regia e Luci, poi tocca il tavolo).');
    return;
  }
  if (t === 'asta') {
    const mic = mountedOn(gameState.placed[compId]);
    showToast(mic ? compLabel(compId) + ' regge ' + compLabel(mic.id) + ': tocca il microfono per la sua presa.'
      : compLabel(compId) + ': monta il microfono sulla giraffa (scheda Audio, poi tocca l\'asta).');
    return;
  }
  if (!REAR_PANELS[t] && t !== 'tavolo') return;
  rearPanelId = compId;
  el('#rear-detail').innerHTML = '';
  const fb = el('#rear-fault');
  fb.hidden = true; fb.innerHTML = '';
  if (isFaulty(compId)) faultBox(fb, t);
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
  setTimeout(() => { if (!sceneCovered()) setSceneInput(true); }, 0);
}
el('#rear-close').addEventListener('click', closeRearPanel);
el('#rear-trace').addEventListener('click', () => {
  const id = rearPanelId;
  SFX.button();
  closeRearPanel();
  if (window.__scene && id) window.__scene.showTrace(id);
});
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
// barra del cavo in mano da stendere (vedi StageScene.startLay)
el('#lay-done').addEventListener('click', () => { SFX.button(); if (window.__scene) window.__scene.endLay(true); });
el('#lay-add').addEventListener('click', () => { SFX.button(); if (window.__scene) window.__scene.layAddBend(); });
el('#lay-auto').addEventListener('click', () => { SFX.button(); if (window.__scene) window.__scene.layReset(); });
el('#lay-del').addEventListener('click', () => { if (window.__scene) window.__scene.layDelete(); });
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
  const fb = el('#case-fault'), key = 'baule:' + name;
  fb.hidden = true; fb.innerHTML = '';
  el('#case-svg').classList.toggle('tangled', faultsLeft(key) > 0);
  if (faultsLeft(key)) faultBox(fb, key, () => el('#case-svg').classList.remove('tangled'));
  el('#case-modal').classList.add('show');
  setSceneInput(false);
  SFX.caseOpen();
}
function closeCase () {
  openCaseName = null;
  el('#case-modal').classList.remove('show');
  setTimeout(() => { if (!sceneCovered()) setSceneInput(true); }, 0);
}
el('#case-close').addEventListener('click', closeCase);
el('#case-modal').addEventListener('click', ev => { if (ev.target.id === 'case-modal') closeCase(); });
document.querySelectorAll('.case-btn').forEach(btn => btn.addEventListener('click', () => openCase(btn.dataset.case)));

// prende (o rimette nel baule) un cavo
function pickCable (cableId) {
  if (openCaseName && faultsLeft('baule:' + openCaseName)) { showToast('Prima sbroglia i cavi: sono tutti aggrovigliati.'); return; }
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
  closeDrawerIfNarrow();
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
   SCHERMATA A — la scena è a tutto schermo; le schede sono il flight case
   in basso e ognuna apre il suo cassetto coi pezzi. Il cassetto si chiude
   col ✕, ritoccando la scheda, quando si sceglie un pezzo o un cavo e (sul
   telefono, dove copre la scena) toccando la scena.
   --------------------------------------------------------------------- */
const toolbarEl = el('#toolbar');
const NARROW_PX = 1000;
function tabName (btn) { const b = btn && btn.querySelector('b'); return (b || btn).textContent.trim(); }
function openDrawer () { toolbarEl.classList.add('open'); document.body.classList.add('drawer-open'); }
// chiuso il cassetto, sotto il dito compaiono PROVA, zoom e annulla: il
// "click" che il telefono manda dopo il tocco non deve finire su di loro
let drawerClosedAt = -1e9;
document.addEventListener('click', ev => {
  if (performance.now() - drawerClosedAt < 350 && !(ev.target.closest && ev.target.closest('.tabs'))) { ev.stopPropagation(); ev.preventDefault(); }
}, true);
function closeDrawer () {
  if (toolbarEl.classList.contains('open')) drawerClosedAt = performance.now();
  toolbarEl.classList.remove('open');
  document.body.classList.remove('drawer-open');
  document.querySelectorAll('.tab-panel.help').forEach(p => p.classList.remove('help'));
  document.querySelectorAll('.dr-help.on').forEach(b => b.classList.remove('on'));
}
function closeDrawerIfNarrow () { if (window.innerWidth < NARROW_PX) closeDrawer(); }
// un pezzo si arma al rilascio del dito, ma il telefono manda il "click"
// subito dopo: il cassetto si chiude solo quando quel click è arrivato
function closeDrawerAfterTap () {
  if (window.innerWidth >= NARROW_PX) return;
  let done = false;
  const fin = () => { if (done) return; done = true; document.removeEventListener('click', fin, true); setTimeout(closeDrawer, 0); };
  document.addEventListener('click', fin, true);
  setTimeout(fin, 450);
}
document.querySelectorAll('.tab-panel').forEach(panel => {
  const btn = document.querySelector('.tab-btn[data-tab="' + panel.dataset.panel + '"]');
  const head = document.createElement('div');
  head.className = 'dr-head';
  head.innerHTML = '<span class="tape">' + escapeHtml(tabName(btn)) + '</span><span class="sub"></span>'
    + '<button type="button" class="rb dr-help" title="Come si usa" aria-label="Come si usa">?</button>'
    + '<button type="button" class="rb dr-close" title="Chiudi" aria-label="Chiudi">✕</button>';
  panel.prepend(head);
  const help = head.querySelector('.dr-help');
  help.addEventListener('click', () => { help.classList.toggle('on', panel.classList.toggle('help')); });
  head.querySelector('.dr-close').addEventListener('click', closeDrawer);
});
// sotto il nome del cassetto: quanti pezzi restano da posare
function updateDrawerSubs () {
  document.querySelectorAll('.tab-panel').forEach(panel => {
    const sub = panel.querySelector('.dr-head .sub');
    if (!sub) return;
    if (panel.dataset.panel === 'cavi') { sub.textContent = 'Apri un baule e prendi un cavo'; return; }
    const left = [...panel.querySelectorAll('.piece')].filter(p => !p.classList.contains('depleted')).length;
    sub.textContent = left ? left + (left === 1 ? ' pezzo da posare' : ' pezzi da posare') : 'Tutto posato';
  });
}
// la scheda apre il suo cassetto; ritoccata col cassetto aperto lo chiude
// (fase di cattura: si guarda com'era prima che la scheda diventi attiva)
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('locked')) return;
    if (btn.classList.contains('active') && toolbarEl.classList.contains('open')) closeDrawer();
    else openDrawer();
  }, true);
});
// sul telefono il cassetto copre la scena: un tocco sulla scena lo chiude
el('#stage-wrap').addEventListener('pointerdown', ev => { if (ev.target && ev.target.tagName === 'CANVAS') closeDrawerIfNarrow(); });
// strati: quali cavi si vedono, dal pulsante sopra lo zoom
el('#layers-btn').addEventListener('click', () => {
  el('#layers-btn').classList.toggle('on', document.body.classList.toggle('show-layers'));
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

/* SCHEDA "COS'È" — tenendo premuto un pezzo nella barra: cos'è e dove va */
const PIECE_INFO = {
  quadro: ['Quadro elettrico di distribuzione: prende i 400 V trifase dall\'allaccio e li divide in tre prese da 230 V (fasi L1, L2, L3), ognuna col suo magnetotermico, più generale e salvavita.', 'Va in Backstage.'],
  ciabatta: ['Ciabatta civile con interruttore: spina Schuko e 3 prese Schuko. Porta la corrente dove serve, per esempio al PC.', 'Sul palco, in Off Stage o in FOH.'],
  ciabatta_cee: ['Ciabatta con interruttore, spina CEE blu 230 V (entra nelle prese del Quadro) e 4 prese Schuko.', 'Sul palco, in Off Stage, in FOH o in Backstage.'],
  tavolo: ['Tavolo regia pieghevole: la postazione del tecnico. Sopra mixer, consolle luci, PC e scheda audio; sotto il finale nel suo rack.', 'Va in Off Stage.'],
  stativo: ['Stativo luci: treppiede con asta e barra a T su cui si monta un PAR.', '2 davanti al palco nel Pit (frontali), 2 ai lati del palco (tagli).'],
  sub: ['Subwoofer: la cassa dei bassi. Riceve il segnale dal finale (Speakon), ha la sua alimentazione e lo passa alla testa dall\'uscita LINK.', 'Va nel Pit, uno per lato.'],
  top: ['Testa: la cassa dei medi e degli alti, sul palo del sub. Prende il segnale dal sub (Speakon LINK).', 'Si monta sopra un sub.'],
  mixer: ['Mixer: raccoglie microfoni (CH 1-4, XLR) e musica del PC (CH 5-6, jack), li regola e li manda al finale dalle uscite MAIN L/R.', 'Va sul tavolo regia.'],
  asta: ['Asta microfonica con giraffa: regge il microfono all\'altezza di chi parla.', 'Va sul palco.'],
  mic: ['Microfono dinamico da voce: col cavo XLR va a un ingresso MIC del mixer (CH 1-4).', 'Si monta sull\'asta.'],
  ampli: ['Finale (amplificatore) in rack 2U: rende il segnale del mixer abbastanza forte da muovere le casse. Si accende per ultimo e si spegne per primo.', 'Sotto il tavolo regia.'],
  pc: ['Computer portatile: suona la musica della serata. L\'audio esce dalla USB-C verso la scheda audio.', 'Va sul tavolo regia.'],
  scheda: ['Scheda audio USB: trasforma l\'audio del PC in due uscite jack (L e R) per i CH 5-6 del mixer. Si alimenta dal PC.', 'Va sul tavolo regia, accanto al PC.'],
  par: ['Faro PAR a LED: prende corrente (PowerCON) e comandi (DMX) e li passa al faro dopo, in catena.', 'Si monta su uno stativo.'],
  controller: ['Consolle luci DMX: comanda i PAR col cavo DMX, su due universi.', 'Va sul tavolo regia.'],
  di: ['DI box passiva a 2 canali: trasforma due uscite jack (sbilanciate) in due XLR bilanciati per gli ingressi MIC del mixer. Al montaggio non serve: la usa il DJ.', 'Sul palco accanto a chi suona, in Off Stage o in FOH.'],
  dj: ['La consolle di DJ Inestimabile: due lettori e il mixer DJ. Ha la sua spina Schuko; le uscite MASTER L e R (jack) vanno in una DI, e dalla DI due XLR al mixer di sala.', 'Va sul palco.'],
  djluci: ['Lo stativo luci del DJ: quattro PAR LED cinesi e una strobo LED in mezzo, già montati sulla barra e collegati tra loro. Servono una spina Schuko e un solo DMX dalla consolle luci; i fari sono già indirizzati (canali ' + DJ_LUCI_DMX.from + '-' + DJ_LUCI_DMX.to + ').', 'Va sul palco, dietro la consolle.']
};
function showPieceInfo (type, pieceEl) {
  const info = PIECE_INFO[type];
  if (!info) return false;
  const box = el('#piece-info');
  box.innerHTML = '<b>' + escapeHtml(COMPONENT_TYPES[type].label) + '</b><p>' + escapeHtml(info[0]) + '</p><small>' + escapeHtml(info[1]) + '</small>';
  box.classList.add('show');
  const r = pieceEl.getBoundingClientRect(), bw = box.offsetWidth, bh = box.offsetHeight;
  box.style.left = Math.max(8, Math.min(window.innerWidth - bw - 8, r.left + r.width / 2 - bw / 2)) + 'px';
  box.style.top = Math.max(8, r.top - bh - 10) + 'px';
  if (navigator.vibrate) navigator.vibrate(15);
  return true;
}
function hidePieceInfo () { el('#piece-info').classList.remove('show'); }
document.addEventListener('pointerdown', ev => { if (!ev.target.closest || !ev.target.closest('#piece-info')) hidePieceInfo(); }, true);

function disarmPiece () {
  gameState.selectedPieceType = null;
  document.querySelectorAll('.piece').forEach(p => p.classList.remove('armed'));
  if (window.__scene) { window.__scene.clearDropPreview(); window.__scene.showZoneHint(null); }
}

function armPiece (type, pieceEl) {
  if (gameState.selectedPieceType === type) { disarmPiece(); showToast('Selezione annullata.'); return; }
  if (window.__scene) { window.__scene.clearMoveSelection(); window.__scene.clearEdgeSelection(); window.__scene.cancelPending(); }
  gameState.selectedPieceType = type;
  document.querySelectorAll('.piece').forEach(p => p.classList.toggle('armed', p === pieceEl));
  closeDrawerAfterTap();
  const free = window.__scene ? window.__scene.showZoneHint(type) : 1;
  const m = MOUNTS[type];
  if (m && !free) showToast(m.missing);
  else showToast(m ? 'Pezzo selezionato: tocca ' + (m.base === 'tavolo' ? 'il tavolo regia' : 'una base libera cerchiata in verde') + ' per montarlo (tocca di nuovo il pezzo per annullare).'
    : 'Pezzo selezionato: tocca una delle celle verdi per posarlo (tocca di nuovo il pezzo per annullare).');
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
    // pressione lunga senza muoversi: la scheda "cos'è" (e niente posa)
    const pd = pieceDown;
    pd.infoTimer = setTimeout(() => { if (pieceDown === pd && !pd.dragging) pd.info = showPieceInfo(pd.type, pd.pieceEl); }, LONG_PRESS_MS);
  });
});

document.addEventListener('pointermove', ev => {
  if (!pieceDown || ev.pointerId !== pieceDown.pointerId) return;
  const dist = Math.hypot(ev.clientX - pieceDown.startX, ev.clientY - pieceDown.startY);

  if (!pieceDown.dragging && !pieceDown.info && dist > DRAG_THRESHOLD) {
    clearTimeout(pieceDown.infoTimer);
    pieceDown.dragging = true;
    window.__draggedType = pieceDown.type;
    const ghost = pieceDown.pieceEl.cloneNode(true);
    ghost.classList.add('drag-ghost');
    document.body.appendChild(ghost);
    pieceDown.ghost = ghost;
    closeDrawerIfNarrow();
    if (window.__scene) window.__scene.showZoneHint(pieceDown.type);
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
  const { type, pieceEl, dragging, ghost, info, infoTimer } = pieceDown;
  pieceDown = null;
  clearTimeout(infoTimer);
  if (info) return;   // era la scheda "cos'è": il pezzo non si arma

  if (dragging) {
    ghost.remove();
    stageWrap.classList.remove('drag-over');
    if (window.__scene) { window.__scene.clearDropPreview(); window.__scene.showZoneHint(gameState.selectedPieceType); }
    const { over } = stagePointFromClient(ev.clientX, ev.clientY);
    if (over && window.__scene) {
      if (gameState.stock[type] <= 0) showToast(/^ciabatta/.test(type) ? CIABATTE_FINITE : 'Esaurito in questo livello: ' + COMPONENT_TYPES[type].label + '.');
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
    if (window.__scene) { window.__scene.clearDropPreview(); window.__scene.showZoneHint(gameState.selectedPieceType); }
  }
  window.__draggedType = null;
  pieceDown = null;
});

/* ---------------------------------------------------------------------
   GIRI DEL MONTAGGIO — come una squadra vera, il livello 1 si monta in tre
   giri: prima la corrente, poi l'audio, poi le luci. Ogni giro ha la sua
   prova; le schede del giro dopo si aprono quando la prova passa. Dopo le
   luci resta il Test impianto: il collaudo completo con lo show.
   Il foglio di montaggio (in basso a sinistra sopra la scena) mostra cosa
   chiede il giro in corso e si spunta da solo mentre si lavora.
   --------------------------------------------------------------------- */
const GIRI = [
  { id: 'corrente', title: 'Corrente', tabs: ['corrente', 'cavi'], button: 'PROVA CORRENTE' },
  { id: 'audio', title: 'Audio', tabs: ['strutture', 'audio', 'regia'], button: 'PROVA AUDIO' },
  { id: 'luci', title: 'Luci', tabs: ['luci'], button: 'PROVA LUCI' }
];
const GIRO_COLLAUDO = GIRI.length;   // tutti i giri fatti: si collauda
gameState.giro = 0;
gameState.giroFails = [0, 0, 0];

// schede aperte fino al giro indicato (compreso)
function unlockedTabs (giro) {
  return GIRI.slice(0, Math.min(giro, GIRI.length - 1) + 1).flatMap(g => g.tabs);
}

/* cosa chiede un giro: i collegamenti del suo impianto (dall'elenco del
   Test impianto) più quello che non è un cavo (quadro armato, apparecchi
   accesi, stereo, frontali e tagli). Ogni voce: { ok, what, ids, kind }
   dove kind dice che indizio dare se manca. */
function giroChecks (giro) {
  const g = GIRI[giro];
  if (!g) return [];
  const list = buildExpectedConnections().filter(x => x.giro === g.id)
    .map(x => ({ ok: x.ok, what: x.what, ids: x.ids, kind: / da (posare|montare)/.test(x.what) ? 'place' : 'wire' }));
  const running = types => {
    const cs = types.flatMap(t => placedOfType(t));
    return { ok: cs.length > 0 && cs.every(c => isRunning(c.id)), ids: cs.filter(c => !isRunning(c.id)).map(c => c.id) };
  };
  if (g.id === 'corrente') {
    const q = findQuadro(), prot = q && quadroProt(q);
    list.push({ ok: !!(prot && prot.main && prot.rcd), what: 'Quadro armato: generale e salvavita', ids: q ? [q.id] : [], kind: 'arm' });
  } else if (g.id === 'audio') {
    const r = running(['mixer', 'pc', 'scheda', 'ampli', 'sub']);
    list.push({ ok: r.ok, what: 'Accesi: mixer, PC, finale e sub (finale e sub per ultimi)', ids: r.ids, kind: 'on' });
    const wired = list.every(x => x.ok);
    const swapped = stereoCheck();
    list.push({ ok: wired && !swapped, what: 'Cassa sinistra a sinistra, destra a destra', ids: swapped || [], kind: 'stereo' });
  } else if (g.id === 'luci') {
    const r = running(['controller', 'par']);
    list.push({ ok: r.ok && placedOfType('par').length >= parsRequired(), what: 'Accesi: consolle luci e PAR', ids: r.ids, kind: 'on' });
    const lights = lightingCheck();
    list.push({ ok: !lights && placedOfType('par').length >= parsRequired(), what: lightsPlan(), ids: lights ? lights.ids : [], kind: 'lights' });
    const ov = dmxOverlaps();
    list.push({ ok: !ov.length, what: 'Indirizzi DMX senza sovrapposizioni', ids: [], kind: 'dmx' });
  }
  // pezzi arrivati difettosi dallo scarico, per il giro a cui appartengono
  const faultTypes = { corrente: ['quadro'], audio: ['ampli', 'sub', 'top', 'pc'], luci: ['par', 'stativo'] }[g.id];
  if (faultTypes.some(t => faultCounts()[t])) {
    const bad = Object.keys(gameState.placed).filter(id => faultTypes.includes(gameState.placed[id].type) && isFaulty(id));
    list.push({ ok: faultTypes.every(t => !faultsLeft(t)), what: 'Pezzi difettosi dello scarico controllati', ids: bad, kind: 'fault' });
  }
  return list;
}

// il giro in corso è già a posto? (senza effetti: serve a ricaricare le
// partite salvate prima dei giri)
const giroPasses = giro => giroChecks(giro).every(x => x.ok);

function updateGiroUI () {
  const giro = gameState.giro;
  // la scheda DJ c'è da quando il DJ è arrivato col cambio palco
  const open = unlockedTabs(giro).concat(cambioDj() ? ['dj'] : []);
  const djTab = document.querySelector('.tab-btn[data-tab="dj"]');
  if (djTab) djTab.hidden = !cambioDj();
  document.querySelectorAll('.tab-btn').forEach(b => {
    const locked = !open.includes(b.dataset.tab);
    b.classList.toggle('locked', locked);
    b.title = locked ? 'Si apre con un giro successivo del montaggio' : '';
  });
  // la scheda aperta si è appena chiusa (reset): si torna alla corrente
  const active = document.querySelector('.tab-btn.active');
  if (active && active.classList.contains('locked')) document.querySelector('.tab-btn[data-tab="corrente"]').click();
  const btn = el('#run-btn');
  if (btn) btn.textContent = '▶ ' + (giro < GIRO_COLLAUDO ? GIRI[giro].button : cambioDjOn() ? 'PRONTI: TOCCA AL DJ' : 'TEST IMPIANTO');
  updateFoglio();
}

// foglio di montaggio: il giro in corso, voce per voce
// aperto di partenza solo sugli schermi larghi: su tablet e telefoni
// coprirebbe le celle dove vanno i pezzi (si apre toccandolo)
let foglioOpen = window.innerWidth >= 1100;
function updateFoglio () {
  const box = el('#foglio');
  if (!box) return;
  const giro = gameState.giro;
  const steps = GIRI.map((g, i) => '<span class="fg-step ' + (i < giro ? 'done' : i === giro ? 'now' : '') + '">'
    + (i < giro ? '✓ ' : '') + g.title + '</span>').join('<span class="fg-sep">›</span>');
  let head, body = '', icon = '📝 ', patience = false;
  if (giro < GIRO_COLLAUDO) {
    const list = giroChecks(giro);
    const done = list.filter(x => x.ok).length;
    head = 'Giro ' + GIRI[giro].title + ' · ' + done + '/' + list.length;
    body = '<ul class="fg-list">' + list.map(x => '<li class="' + (x.ok ? 'ok' : '') + '">' + (x.ok ? '✓' : '○') + ' ' + escapeHtml(x.what) + '</li>').join('') + '</ul>';
  } else if (cambioDjOn()) {
    // cambio palco: la carta del DJ, voce per voce, e la pazienza del pubblico
    const list = cambioChecks();
    icon = '🎧 ';
    head = 'Cambio palco · DJ · ' + list.filter(x => x.ok).length + '/' + list.length;
    body = '<ul class="fg-list">' + list.map(x => '<li class="' + (x.ok ? 'ok' : '') + '">' + (x.ok ? '✓' : '○') + ' ' + escapeHtml(x.what) + '</li>').join('') + '</ul>'
      + '<p class="fg-note">Quando è tutto a posto premi PRONTI: tocca al DJ.</p>';
    patience = true;
  } else if (cambioDjDone() && !djDone()) {
    icon = '🎧 ';
    head = 'Prossimo: Notte fuori controllo';
    body = '<p class="fg-note">DJ Inestimabile e Musa Esistenziale sono pronti. Tu vai alla consolle luci: le memorie si suonano a tempo col brano.</p>'
      + '<button type="button" class="fg-go" id="foglio-dj">Via al DJ set</button>';
  } else if (djDone() && !karaokeDone()) {
    // fuori programma: il karaoke di Macio, col microfono che c'è già
    const missing = karaokeReady();
    icon = '🎤 ';
    head = 'Fuori programma: il karaoke di Macio';
    body = '<p class="fg-note">' + escapeHtml('Il bidello ha cacciato via i musicisti: la festa è rimasta senza musica. Macio: «Ci penso io!». '
      + (missing ? 'Prima però: ' + missing : 'Il microfono è sul CH ' + micChannel() + '.')) + '</p>'
      + (missing ? '' : '<button type="button" class="fg-go" id="foglio-karaoke">Macio prende il microfono</button>');
  } else if (karaokeDone()) {
    icon = '🎤 ';
    head = 'Karaoke finito';
    body = '<p class="fg-note">' + escapeHtml('Karaoke di Macio: ' + karaokeSummary()) + '</p>'
      + (caricoDone() ? '<p class="fg-note">Carico: ' + escapeHtml(caricoSummary()) + '</p>'
        : '<button type="button" class="fg-go" id="foglio-carico">Smonta e carica il furgone</button>');
  } else if (caviDone() && !presideDone()) {
    // il discorso del preside: pronto se il microfono è cablato
    const missing = presideReady();
    icon = '🎤 ';
    head = 'Prossimo: discorso del preside';
    body = '<p class="fg-note">' + escapeHtml(missing ? 'Alle 21:00 parla il preside: ' + missing : 'Microfono pronto sul CH ' + micChannel() + ': il preside aspetta dietro le quinte.') + '</p>'
      + (missing ? '' : '<button type="button" class="fg-go" id="foglio-preside">Il preside sale sul palco</button>');
  } else if (presideDone()) {
    icon = '🎧 ';
    head = 'Prossimo: cambio palco per il DJ';
    body = '<p class="fg-note">Il preside ha finito di parlare: alle 21:10 arriva DJ Inestimabile con la sua consolle. Appena parti, il pubblico comincia ad aspettare.</p>'
      + '<button type="button" class="fg-go" id="foglio-cambio">Inizia il cambio palco</button>';
  } else {
    head = 'Montaggio finito · Test impianto';
    body = '<p class="fg-note">Tutti i giri sono passati. Il collaudo prova tutto insieme: se hai toccato qualcosa nel frattempo, lo scopre.</p>';
  }
  box.innerHTML = '<button class="fg-head" id="foglio-toggle">' + icon + head + '<span class="fg-caret">' + (foglioOpen ? '▾' : '▸') + '</span></button>'
    + (patience ? '<div class="fg-patience">' + patienceHtml() + '</div>' : '')
    + (foglioOpen ? '<div class="fg-body">' + (giro < GIRO_COLLAUDO || !caviDone() ? '<div class="fg-steps">' + steps + '</div>' : '') + body + '</div>' : '');
  el('#foglio-toggle').addEventListener('click', () => { foglioOpen = !foglioOpen; SFX.button(); updateFoglio(); });
  const go = el('#foglio-cambio');
  if (go) go.addEventListener('click', () => { SFX.button(); startCambioDj(); });
  const pr = el('#foglio-preside');
  if (pr) pr.addEventListener('click', () => { SFX.button(); openPreside(); });
  const dg = el('#foglio-dj');
  if (dg) dg.addEventListener('click', () => { SFX.button(); openDj(); });
  const kg = el('#foglio-karaoke');
  if (kg) kg.addEventListener('click', () => { SFX.button(); openKaraoke(); });
  const cg = el('#foglio-carico');
  if (cg) cg.addEventListener('click', () => { SFX.button(); openCarico(); });
}

// cambio di scheda verso una chiusa: si spiega perché
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', ev => {
    if (!btn.classList.contains('locked')) return;
    ev.stopImmediatePropagation();
    const g = GIRI.find(x => x.tabs.includes(btn.dataset.tab));
    showToast('La scheda ' + tabName(btn) + ' si apre col giro ' + (g ? g.title : '') + ': prima finisci il giro ' + GIRI[gameState.giro].title + ' e fai la sua prova.');
  }, true);
});

/* Run button: la prova del giro in corso, o il Test impianto a montaggio finito */
el('#run-btn').addEventListener('click', () => {
  if (!window.__scene) return;
  window.__scene.endLay(true);
  if (gameState.giro < GIRO_COLLAUDO) window.__scene.runGiroTest();
  else if (cambioDjOn()) window.__scene.runCambioTest();
  else window.__scene.runSystemTest();
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
const __containerRatio = Math.min(2.2, Math.max(0.45, __rawRatio)); // limite di sicurezza
const GAME_H = Math.round(GAME_W * __containerRatio);

const ORIGIN_X = 853;
const TILE_W = 102, TILE_H = 70;
const VENUE_W = 10, VENUE_H = 16;     // intera area di lavoro (locale), raddoppiata in profondità
// ORIGIN_Y centra la venue nel nuovo GAME_H, qualunque esso sia
const ORIGIN_Y = Math.round((GAME_H - (VENUE_W + VENUE_H) * TILE_H / 2) / 2);

const ZOOM_MIN = 0.5, ZOOM_MAX = 4;
const DEFAULT_ZOOM = 1.05;
// passi di Annulla tenuti in memoria (ogni passo è una fotografia di tutto il montaggio)
const HISTORY_MAX = 200;
// pixel di schermo per unità di mondo a cui si avvicina la scena quando un
// tocco cade in mezzo a più dispositivi (su telefono a zoom base è ≈ 0,3)
const CROWD_SCALE = 0.6;
const SHOW_ZOOM = 2;         // zoom dello show finale: palco e Pit a tutto schermo
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
  sub: [1, 1], mixer: [1, 2], ampli: [1, 2], tavolo: [2, 6], controller: [1, 1], quadro: [1, 1],
  ciabatta: [1, 2], ciabatta_cee: [1, 3], pc: [1, 1], scheda: [1, 1], di: [1, 1], stativo: [1, 1], asta: [1, 1], dj: [2, 1], djluci: [1, 1]
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
// il quadro della palestra è appeso alla parete dietro al palco
function allaccioPos () { return gridToScreen(3.3, CARICO_ROWS + 0.25); }
/* le coordinate di schermo dei pezzi dipendono dall'altezza del canvas, misurata
   all'apertura della pagina (telefono dritto o girato, finestra del computer):
   una partita salvata con un'altra misura le ha spostate, quindi alla ripresa
   si rifanno dalla griglia (pezzi a terra), dalla parete (quadro della palestra)
   e dalla base (pezzi montati, anche uno sopra l'altro) */
function alignScreens (placed) {
  Object.values(placed).forEach(c => {
    if (c.type === 'allaccio') c.screen = allaccioPos();
    else if (c.gx != null) { const m = compCenter(c); c.screen = gridToScreen(m.gx, m.gy); }
  });
  for (let pass = 0; pass < 3; pass++) {
    Object.values(placed).forEach(c => {
      const m = MOUNTS[c.type], base = m && placed[c[m.back]];
      if (base && base.screen) c.screen = { x: base.screen.x + (m.offsetX ? m.offsetX() : 0), y: base.screen.y + m.offsetY() };
    });
  }
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
  // il tavolo regia sta a lato palco, in Off Stage
  tavolo: isOffStageCell,
  // stativi luci: davanti al palco (frontale) o ai suoi lati (taglio)
  stativo: (cx, cy) => isPitCell(cx, cy) ||
    (cy >= STAGE_ORIGIN_Y && cy < STAGE_ORIGIN_Y + STAGE_H && (cx < STAGE_ORIGIN_X || isOffStageCell(cx, cy))),
  sub: isPitCell,
  // l'asta del microfono sta sulla pedana, dove parla o canta qualcuno
  asta: isStageCoreCell,
  quadro: isBackstageCell,
  // le ciabatte portano corrente dove serve: sul palco, in Regia di palco
  // (Off Stage) e in Regia di sala (FOH). Quella CEE può restare anche in
  // Backstage accanto al Quadro, da cui prende la linea.
  ciabatta: (cx, cy) => isStageCell(cx, cy) || isFohCell(cx, cy),
  ciabatta_cee: (cx, cy) => isStageCell(cx, cy) || isFohCell(cx, cy) || isBackstageCell(cx, cy),
  // il PC può stare sia in Regia di sala (FOH) sia in Regia di palco
  // (Off Stage, accanto al mixer di palco) — due postazioni plausibili.
  pc: (cx, cy) => isFohCell(cx, cy) || isOffStageCell(cx, cy),
  // la DI sta accanto a chi suona (sul palco, vicino alla consolle del DJ)
  // o accanto al PC, in FOH oppure in Off Stage
  di: (cx, cy) => isStageCell(cx, cy) || isFohCell(cx, cy),
  // la consolle del DJ sta sulla pedana, dove suona
  dj: isStageCoreCell,
  // anche il suo stativo luci, alle spalle della consolle
  djluci: isStageCoreCell,
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

/* ---------------------------------------------------------------------
   5b) POSA AL MONTAGGIO: un cavo per terra va dal pezzo A al pezzo B
       passando per le sue pieghe (route.bends, [gx, gy] in metri). Tra due
       pieghe va dritto, e a ogni piega curva morbido, come un cavo vero.
       Le pieghe si trascinano col dito e scattano sui centri delle celle
       da 50 cm, mettendosi in riga con quelle accanto (tratti paralleli ai
       muri). Nessuna piega nasce da sola: si aggiunge con «+ Piega».
   --------------------------------------------------------------------- */
// punto dello schermo -> metri sul pavimento (senza pedana)
function screenToMeters (px, py) {
  const rx = (px - ORIGIN_X) / (TILE_W / 2), ry = (py - ORIGIN_Y) / (TILE_H / 2);
  return { gx: (rx + ry) / 2, gy: (ry - rx) / 2 };
}
// come sopra, ma se il punto cade sulla pedana tiene conto del rialzo
function worldToFloor (px, py) {
  const up = screenToMeters(px, py + PLATFORM_HEIGHT);
  return isStageCell(up.gx, up.gy) ? up : screenToMeters(px, py);
}
const laySnap = v => Math.round((v - CELL / 2) / CELL) * CELL + CELL / 2;
const LAY_RADIUS = 0.9;     // raggio delle curve, in metri
const LAY_MAX_BENDS = 5;
const LAY_REMOVE_MS = 650;  // tenendo fermo un pallino così a lungo, lasciandolo si toglie
// i punti fermi del cavo: capo A, pieghe, capo B
function layCorners (route, A, B) {
  return [{ gx: A.gx, gy: A.gy }, ...route.bends.map(([gx, gy]) => ({ gx, gy })), { gx: B.gx, gy: B.gy }];
}
// il cavo come si posa: dritto tra i punti, curva morbida a ogni piega
function laySmooth (pts) {
  if (pts.length < 3) return pts.slice();
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1], c = pts[i], n = pts[i + 1];
    const d1 = Math.hypot(c.gx - p.gx, c.gy - p.gy), d2 = Math.hypot(n.gx - c.gx, n.gy - c.gy);
    const r = Math.min(LAY_RADIUS, d1 / 2, d2 / 2);
    if (r < 0.05) { out.push(c); continue; }
    const a = { gx: c.gx + (p.gx - c.gx) / d1 * r, gy: c.gy + (p.gy - c.gy) / d1 * r };
    const b = { gx: c.gx + (n.gx - c.gx) / d2 * r, gy: c.gy + (n.gy - c.gy) / d2 * r };
    for (let k = 0; k <= 8; k++) {
      const t = k / 8, u = 1 - t;
      out.push({ gx: u * u * a.gx + 2 * u * t * c.gx + t * t * b.gx, gy: u * u * a.gy + 2 * u * t * c.gy + t * t * b.gy });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function layLength (pts) {
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) s += Math.hypot(pts[i + 1].gx - pts[i].gx, pts[i + 1].gy - pts[i].gy);
  return s;
}
// quanti tratti attraversano la pedana dello spettacolo (lì i cavi non vanno)
function layCrossesStage (pts) {
  let n = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.abs(b.gx - a.gx) + Math.abs(b.gy - a.gy);
    for (let t = CELL / 2; t < L; t += CELL / 2) {
      const x = a.gx + (b.gx - a.gx) * t / L, y = a.gy + (b.gy - a.gy) * t / L;
      if (isStageCoreCell(x, y)) { n++; break; }
    }
  }
  return n;
}
// toglie le pieghe che non servono: sopra un'altra o in riga con le vicine
function layClean (bends, A, B) {
  const out = bends.map(b => b.slice());
  for (let guard = 0; guard < 10; guard++) {
    const pts = layCorners({ bends: out }, A, B);
    let k = -1;
    for (let i = 1; i < pts.length - 1 && k < 0; i++) {
      const p = pts[i - 1], c = pts[i], n = pts[i + 1];
      const near = Math.hypot(c.gx - p.gx, c.gy - p.gy) < 0.1 || Math.hypot(n.gx - c.gx, n.gy - c.gy) < 0.1;
      const cross = (c.gx - p.gx) * (n.gy - c.gy) - (c.gy - p.gy) * (n.gx - c.gx);
      const ahead = (c.gx - p.gx) * (n.gx - c.gx) + (c.gy - p.gy) * (n.gy - c.gy) > 0;
      if (near || (Math.abs(cross) < 1e-6 && ahead)) k = i - 1;
    }
    if (k < 0) break;
    out.splice(k, 1);
  }
  return out;
}
// percorso automatico: il più corto a L o a Z, girando intorno alla pedana
function layAutoRoute (A, B) {
  const onStage = isStageCoreCell(A.gx, A.gy) || isStageCoreCell(B.gx, B.gy);
  const sx0 = STAGE_ORIGIN_X - CELL / 2, sx1 = STAGE_ORIGIN_X + STAGE_W + CELL / 2;
  const sy0 = STAGE_ORIGIN_Y - CELL / 2, sy1 = STAGE_ORIGIN_Y + STAGE_H + CELL / 2;
  const cands = [[[B.gx, A.gy]], [[A.gx, B.gy]]];
  [laySnap((A.gx + B.gx) / 2), sx0, sx1].forEach(x => cands.push([[x, A.gy], [x, B.gy]]));
  [laySnap((A.gy + B.gy) / 2), sy0, sy1].forEach(y => cands.push([[A.gx, y], [B.gx, y]]));
  let best = null, bestScore = Infinity;
  cands.forEach(c => {
    const bends = layClean(c, A, B), pts = layCorners({ bends }, A, B);
    const score = layLength(pts) + (onStage ? 0 : layCrossesStage(pts) * 100) + bends.length * 0.01;
    if (score < bestScore) { bestScore = score; best = bends; }
  });
  return { bends: best };
}
// i percorsi salvati prima delle pieghe (tratti a quote): diventano pieghe
function layFromRails (r, A, B) {
  const rails = r.rails.slice(), n = rails.length, h = i => (i % 2 === 0) === (r.o0 === 'h');
  rails[0] = h(0) ? A.gy : A.gx; rails[n - 1] = h(n - 1) ? B.gy : B.gx;
  const bends = [];
  for (let i = 0; i < n - 1; i++) bends.push(h(i) ? [rails[i + 1], rails[i]] : [rails[i], rails[i + 1]]);
  return { bends: layClean(bends, A, B) };
}
// metri sul pavimento -> schermo, con lo scalino della pedana
function layToScreen (pts) {
  const out = [];
  const up = (x, y) => { const p = gridToScreen(x, y); return isStageCell(x, y) ? { x: p.x, y: p.y - PLATFORM_HEIGHT } : p; };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.abs(b.gx - a.gx) + Math.abs(b.gy - a.gy);
    out.push(up(a.gx, a.gy));
    let prev = isStageCell(a.gx, a.gy);
    for (let t = CELL / 4; t < L; t += CELL / 4) {
      const x = a.gx + (b.gx - a.gx) * t / L, y = a.gy + (b.gy - a.gy) * t / L;
      const s = isStageCell(x, y);
      if (s !== prev) { out.push(up(x, y)); prev = s; }
    }
  }
  const z = pts[pts.length - 1];
  out.push(up(z.gx, z.gy));
  return out;
}
// lunghezza del cavo del baule (null: spina della ciabatta, cavo suo)
function layMaxLen (e) {
  const pd = getPortDef(e.b, e.bPort);
  if (pd && pd.lead) return null;
  const it = cableItem(e.signal), m = it && /(\d+) m/.exec(it.info);
  return m ? +m[1] : null;
}
const fmtM = v => (Math.round(v * 2) / 2).toLocaleString('it-IT') + ' m';

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

    this.occupied = {}; this.blockSceneryCells();
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
    this.zoneGraphics = this.add.graphics().setDepth(5.5);

    this.drawGround();
    this.drawZoneOutlines();
    this.drawLoadingDock();
    this.drawStagePlatform();
    this.drawTapeMarks();
    this.drawAllaccio();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' });
    this.input.keyboard.on('keydown-DELETE', () => { if (this.lay) this.layDelete(); else if (this.selectedEdgeId != null) this.deleteSelectedEdge(); });
    this.input.keyboard.on('keydown-BACKSPACE', () => { if (this.lay) this.layDelete(); else if (this.selectedEdgeId != null) this.deleteSelectedEdge(); });
    this.input.keyboard.on('keydown-ENTER', () => { if (this.lay) this.endLay(true); });
    this.input.keyboard.on('keydown-Z', event => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.shiftKey) this.redo(); else this.undo();
    });
    this.input.keyboard.on('keydown-Y', event => { if (event.ctrlKey || event.metaKey) this.redo(); });

    this.setupCameraControls();
    this.resetView();
    this.makePieceIcons();

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
    // la rotella ingrandisce dove sta il puntatore
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      this.adjustZoom(deltaY > 0 ? -0.12 : 0.12, pointer.x, pointer.y);
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
        // il pizzico ingrandisce fra le due dita, non al centro dello schermo
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this.lastPinchDist) this.adjustZoom((dist - this.lastPinchDist) * 0.004, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
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
    if (pendKey !== this.pendingKey) { this.pendingKey = pendKey; updateCableBanner(); this.highlightTargets(); }
    // le note della musica di prova seguono il loro dispositivo
    if (this.signalFx) Object.values(this.signalFx).forEach(f => { if (f.note) this.placeSignalNote(f); });
    // i pallini del cavo in mano restano grandi come un dito a ogni zoom
    if (this.lay && this.layZoom !== cam.zoom) { this.layZoom = cam.zoom; this.drawLay(); }
    const speed = (420 * (delta / 1000)) / cam.zoom;
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= speed;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dx += speed;
    if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= speed;
    if (this.cursors.down.isDown || this.wasd.down.isDown) dy += speed;
    if (dx || dy) { cam.scrollX += dx; cam.scrollY += dy; }
  }

  /* zoom; con un punto (in pixel del gioco) quel punto resta fermo sotto
     il dito o il puntatore, come nelle mappe */
  adjustZoom (delta, ax, ay) {
    const cam = this.cameras.main, z0 = cam.zoom;
    const z1 = Phaser.Math.Clamp(z0 + delta, ZOOM_MIN, ZOOM_MAX);
    cam.setZoom(z1);
    if (ax == null || z1 === z0) return;
    cam.scrollX += (ax - cam.width / 2) * (1 / z0 - 1 / z1);
    cam.scrollY += (ay - cam.height / 2) * (1 / z0 - 1 / z1);
  }
  /* tocco su più dispositivi vicini con la scena piccola (telefono):
     oltre al menu "Quale?" la scena si avvicina lì, così il tocco dopo
     prende quello giusto senza dover zoomare a mano */
  zoomToCrowd (wx, wy) {
    const cam = this.cameras.main, rc = this.game.canvas.getBoundingClientRect();
    const k = cam.zoom * (rc.width / GAME_W);
    if (k >= CROWD_SCALE) return;
    cam.zoomTo(Math.min(ZOOM_MAX, CROWD_SCALE * GAME_W / rc.width), 250, 'Sine.easeOut');
    cam.pan(wx, wy, 250, 'Sine.easeOut');
  }

  /* vista intera: tutta la palestra dentro la parte di schermo libera tra
     l'HUD in alto e il flight case in basso (la scena è a tutto schermo) */
  resetView () {
    const cam = this.cameras.main, rc = this.game.canvas.getBoundingClientRect();
    if (!rc.width || !rc.height) { cam.setZoom(DEFAULT_ZOOM); cam.centerOn(GAME_W / 2, GAME_H / 2); return; }
    const k = rc.width / GAME_W;   // pixel di schermo per pixel di gioco a zoom 1
    const hud = el('header.hud'), bar = el('#toolbar');
    const top = Math.max(0, (hud ? hud.getBoundingClientRect().bottom : rc.top) + 8 - rc.top);
    // sul telefono dritto anche zoom, annulla e PROVA stanno sopra il flight case
    const lows = [bar].concat(window.innerWidth < 700 && window.innerHeight > 500 ? [el('.zoom-controls'), el('header.hud .history'), el('#run-bar')] : [])
      .filter(e => e && e.offsetParent !== null).map(e => e.getBoundingClientRect().top);
    const bot = Math.max(0, rc.bottom - (lows.length ? Math.min(...lows) : rc.bottom) + 8);
    const visW = (rc.width - 16) / k, visH = Math.max(120, rc.height - top - bot) / k;
    const x0 = gridToScreen(0, VENUE_H).x, x1 = gridToScreen(VENUE_W, CARICO_ROWS).x;
    const y0 = gridToScreen(0, CARICO_ROWS).y - 150, y1 = gridToScreen(VENUE_W, VENUE_H).y + 20;
    const z = Phaser.Math.Clamp(Math.min(visW / (x1 - x0), visH / (y1 - y0)), ZOOM_MIN, 1.6);
    cam.setZoom(z);
    cam.centerOn((x0 + x1) / 2, (y0 + y1) / 2 - (top - bot) / 2 / k / z);
  }

  /* icone dei pezzi nel cassetto: lo stesso disegno della scena, fotografato
     una volta all'avvio (così ogni pezzo nuovo ha la sua icona da solo) */
  makePieceIcons () {
    const K = 2, S = 220;
    document.querySelectorAll('.piece[data-type]').forEach(piece => {
      const type = piece.dataset.type, def = COMPONENT_TYPES[type];
      const sw = piece.querySelector('.swatch');
      if (!def || !sw || sw.querySelector('.pz-img')) return;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      try { this.drawComponentBody(g, def, 0, type + '_icona'); } catch (e) { g.destroy(); return; }
      const rt = this.make.renderTexture({ width: S * K, height: S * K }, false);
      g.setScale(K);
      rt.draw(g, S * K / 2, S * K * 0.62);
      g.destroy();
      rt.snapshot(img => {
        rt.destroy();
        // si ritaglia il disegno dal fondo trasparente
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        const a = x.getImageData(0, 0, c.width, c.height).data;
        let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
        for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) {
          if (a[(yy * c.width + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
        }
        if (x1 < 0) return;
        const o = document.createElement('canvas'); o.width = x1 - x0 + 9; o.height = y1 - y0 + 9;
        o.getContext('2d').drawImage(c, x0 - 4, y0 - 4, o.width, o.height, 0, 0, o.width, o.height);
        const im = document.createElement('img');
        im.className = 'pz-img'; im.alt = ''; im.draggable = false; im.src = o.toDataURL('image/png');
        sw.prepend(im);
      });
    });
  }

  /* ---------------- disegno venue: terreno, zone, pedana ---------------- */
  drawGround () {
    const g = this.add.graphics().setDepth(0);
    const p0 = gridToScreen(0, 0), p1 = gridToScreen(VENUE_W, 0),
          p2 = gridToScreen(VENUE_W, VENUE_H), p3 = gridToScreen(0, VENUE_H);
    // rettangolo di pavimento da (x0, y0) a (x1, y1), in metri
    const quad = (x0, y0, x1, y1, color, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.fillPoints([gridToScreen(x0, y0), gridToScreen(x1, y0), gridToScreen(x1, y1), gridToScreen(x0, y1)], true);
    };
    // generatore fisso: lo stesso pavimento a ogni partita
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    // cortile di carico, fuori dalla palestra: di notte si vede solo dai
    // finestroni della parete di fondo, quindi resta quasi nero
    // (tagliato in diagonale a destra, così non sporge oltre la parete)
    g.fillStyle(0x202226, 1);
    g.fillPoints([gridToScreen(0, 0), gridToScreen(VENUE_W - CARICO_ROWS, 0), gridToScreen(VENUE_W, CARICO_ROWS), gridToScreen(0, CARICO_ROWS)], true);
    for (let i = 0; i < 160; i++) {
      const x = rnd() * (VENUE_W - CARICO_ROWS), y = rnd() * CARICO_ROWS, q = gridToScreen(x, y);
      g.fillStyle(rnd() < 0.5 ? 0x2a2c31 : 0x18191c, 0.9); g.fillCircle(q.x, q.y, 1 + rnd() * 1.2);
    }

    // backstage: cemento a lastre
    quad(0, CARICO_ROWS, VENUE_W, STAGE_ORIGIN_Y, 0x3a3c42);
    for (let x = 2; x < VENUE_W; x += 2) {
      const a = gridToScreen(x, CARICO_ROWS), b = gridToScreen(x, STAGE_ORIGIN_Y);
      g.lineStyle(1, 0x2c2e33, 0.9); g.lineBetween(a.x, a.y, b.x, b.y);
    }

    // palestra: parquet a doghe, dal palco fino in fondo
    const woods = [0x4b3a29, 0x523f2c, 0x473726, 0x4e3c2a];
    for (let x = 0, k = 0; x < VENUE_W - 0.01; x += 0.25, k++) {
      let y = STAGE_ORIGIN_Y - (k % 4) * 0.6;
      while (y < VENUE_H) {
        const y0 = Math.max(STAGE_ORIGIN_Y, y), y1 = Math.min(VENUE_H, y + 2.4);
        quad(x, y0, x + 0.25, y1, woods[Math.floor(rnd() * woods.length)]);
        y += 2.4;
      }
      const a = gridToScreen(x, STAGE_ORIGIN_Y), b = gridToScreen(x, VENUE_H);
      g.lineStyle(1, 0x2e2318, 0.55); g.lineBetween(a.x, a.y, b.x, b.y);
    }
    // righe del campo da basket, sbiadite
    const pitStart = STAGE_ORIGIN_Y + STAGE_H, fohStart = pitStart + PIT_ROWS + PLATEA_ROWS;
    const line = (pts, color, alpha) => { g.lineStyle(3, color, alpha); g.strokePoints(pts.map(([x, y]) => gridToScreen(x, y)), false); };
    line([[0.5, pitStart + 0.5], [0.5, VENUE_H - 0.4], [VENUE_W - 0.5, VENUE_H - 0.4], [VENUE_W - 0.5, pitStart + 0.5]], 0xe9e4d6, 0.22);
    const circ = []; for (let a = 0; a <= Math.PI; a += Math.PI / 24) circ.push([VENUE_W / 2 + Math.cos(a) * 1.8, VENUE_H - 0.4 - Math.sin(a) * 1.8]);
    line(circ, 0xe9e4d6, 0.22);
    line([[VENUE_W / 2 - 1.2, VENUE_H - 0.4], [VENUE_W / 2 - 1.2, VENUE_H - 2.6], [VENUE_W / 2 + 1.2, VENUE_H - 2.6], [VENUE_W / 2 + 1.2, VENUE_H - 0.4]], 0xd6392f, 0.28);
    // Pit: fascia più scura davanti al palco, dove stanno le casse
    quad(0, pitStart, VENUE_W, pitStart + PIT_ROWS, 0x000000, 0.18);

    // griglia di posa appena accennata (un metro), per orientarsi
    for (let x = 1; x < VENUE_W; x += 1) {
      const a = gridToScreen(x, CARICO_ROWS), b = gridToScreen(x, VENUE_H);
      g.lineStyle(1, 0xffffff, 0.045); g.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let y = CARICO_ROWS + 1; y < VENUE_H; y += 1) {
      const a = gridToScreen(0, y), b = gridToScreen(VENUE_W, y);
      g.lineStyle(1, 0xffffff, 0.045); g.lineBetween(a.x, a.y, b.x, b.y);
    }
    g.lineStyle(2, 0x0c0d10, 0.9);
    g.strokePoints([gridToScreen(0, CARICO_ROWS), gridToScreen(VENUE_W, CARICO_ROWS), p2, p3], true);
    this.drawGymWalls();
    this.drawGymDetails();
    this.drawWorkLights();

    g.setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_W, GAME_H), Phaser.Geom.Rectangle.Contains);
    g.on('pointerdown', pointer => {
      if (pointer.rightButtonDown()) return;
      // Phaser sente anche i tocchi sui pulsanti sopra la scena (zoom, ⤢):
      // non sono tocchi sul pavimento e non devono far cadere il cavo in mano
      if (pointer.downElement && pointer.downElement !== this.game.canvas) return;
      // cavo in mano: un tocco sul cavo ne prende il tratto (niente pan)
      if (this.lay && this.layPointerDown(pointer)) return;
      this.floorDown = { x: pointer.x, y: pointer.y, moved: false };
    });
    g.on('pointerup', pointer => {
      if (!this.floorDown) return;
      const moved = this.floorDown.moved;
      this.floorDown = null;
      if (moved) return;

      // cavo in mano: un tocco sul pavimento lo lascia così com'è
      if (this.lay) { this.endLay(true); return; }
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
        // un cavo per terra si prende in mano per sistemarlo; quelli sul
        // tavolo della regia (niente pavimento) si selezionano e basta
        if (this.startLay(hitEdge.id)) return;
        if (this.selectedEdgeId === hitEdge.id) this.clearEdgeSelection();
        else this.selectEdge(hitEdge);
        return;
      }
      this.clearEdgeSelection();
      this.cancelPending();
    });
    this.floorGraphics = g;
  }

  // celle dove sta la scenografia (i case nel backstage): lì non si posa niente
  blockSceneryCells () {
    for (let cx = 0; cx < 2; cx += CELL) for (let cy = VENUE_H - 1; cy < VENUE_H; cy += CELL) this.occupied[cellKey(cx, cy)] = 'scenografia';
    for (let cx = 0; cx < 1; cx += CELL) for (let cy = VENUE_H - 2; cy < VENUE_H - 1; cy += CELL) this.occupied[cellKey(cx, cy)] = 'scenografia';
  }

  /* parete di fondo della palestra, lungo il lato sinistro (gx = 0): finestre
     alte, spalliere, l'uscita di sicurezza e lo striscione della festa.
     Sta dietro a tutto, quindi non copre mai i dispositivi. */
  drawGymWalls () {
    const g = this.add.graphics().setDepth(0.5);
    const H = 190, gy0 = CARICO_ROWS, gy1 = VENUE_H;
    // punto della parete: gy lungo il muro, h altezza in px
    const wp = (gy, h) => { const q = gridToScreen(0, gy); return { x: q.x, y: q.y - h }; };
    const face = (ya, yb, ha, hb, color, alpha = 1) => { g.fillStyle(color, alpha); g.fillPoints([wp(ya, ha), wp(yb, ha), wp(yb, hb), wp(ya, hb)], true); };
    face(gy0, gy1, 0, H, 0x4a4f5a);
    face(gy0, gy1, 0, 74, 0x2f4356);
    face(gy0, gy1, 74, 79, 0xf2a541, 0.55);
    face(gy0, gy1, H - 6, H, 0x5d636f);
    // ombra del muro sul pavimento
    g.fillStyle(0x000000, 0.28);
    g.fillPoints([gridToScreen(0, gy0), gridToScreen(0, gy1), gridToScreen(0.45, gy1), gridToScreen(0.45, gy0)], true);
    // finestre alte
    for (let y = gy0 + 4.3; y < gy1 - 1; y += 2.1) {
      if (y < 12.5 && y + 1.5 > 11) continue;   // lì c'è la seconda uscita
      face(y, y + 1.5, 112, 170, 0x1a2738);
      face(y, y + 1.5, 112, 116, 0x6b7180);
      g.lineStyle(1.5, 0x6d8fb3, 0.35);
      const a = wp(y + 0.3, 120), b = wp(y + 0.75, 162); g.lineBetween(a.x, a.y, b.x, b.y);
      const m0 = wp(y + 0.75, 112), m1 = wp(y + 0.75, 170); g.lineStyle(2, 0x6b7180, 1); g.lineBetween(m0.x, m0.y, m1.x, m1.y);
    }
    // spalliere
    for (let y = 12.9; y <= 14.3; y += 0.35) { const a = wp(y, 0), b = wp(y, 150); g.lineStyle(3, 0x8a6a45, 1); g.lineBetween(a.x, a.y, b.x, b.y); }
    for (let h = 10; h <= 150; h += 14) { const a = wp(12.9, h), b = wp(14.3, h); g.lineStyle(2, 0x9c7a50, 0.9); g.lineBetween(a.x, a.y, b.x, b.y); }
    // spigolo del muro verso il cortile
    { const a = wp(gy0, 0), b = wp(gy0, H); g.lineStyle(3, 0x6b7180, 1); g.lineBetween(a.x, a.y, b.x, b.y); }
    // uscita di sicurezza verso il backstage
    face(2.5, 3.6, 0, 105, 0x1b1d21);
    face(2.5, 3.6, 105, 109, 0x6b7180);
    face(2.75, 3.35, 116, 134, 0x2fa35a);
    // seconda uscita di sicurezza, in fondo alla via di fuga della sala
    face(11.2, 12.3, 0, 105, 0x1b1d21);
    face(11.7, 11.72, 0, 105, 0x0f1013);
    face(11.2, 12.3, 105, 109, 0x6b7180);
    face(11.45, 12.05, 116, 134, 0x2fa35a);
    // striscione della festa
    face(5.2, 9.6, 118, 150, 0xe9e4d6);
    face(5.2, 9.6, 118, 123, 0xd6392f);
    face(5.2, 9.6, 145, 150, 0xd6392f);
    const c = wp(7.4, 134);
    const ang = Phaser.Math.RadToDeg(Math.atan2(TILE_H / 2, -TILE_W / 2)) + 180;
    this.add.text(c.x, c.y, 'FESTA DI FINE ANNO', { fontFamily: FONT_MARKER, fontSize: '15px', color: '#2b5fb0' })
      .setOrigin(0.5).setAngle(ang).setDepth(0.55);
    this.drawBackWall(H);
    const ex = wp(3.05, 125);
    [ex, wp(11.75, 125)].forEach(q => this.add.text(q.x, q.y, 'USCITA', { fontFamily: 'Inter, sans-serif', fontStyle: 'bold', fontSize: '8px', color: '#ffffff' })
      .setOrigin(0.5).setAngle(ang).setDepth(0.55));
  }

  /* rifiniture della palestra: ombre morbide ai piedi dei muri, spessore
     in cima alle pareti, luce della luna dalle finestre, canestro e
     tabellone. Solo scenografia: nessuna cella occupata. */
  drawGymDetails () {
    const H = 190, y0 = CARICO_ROWS;
    const g = this.add.graphics().setDepth(0.45);
    const floorQuad = (x0, ya, x1, yb, color, alpha) => {
      g.fillStyle(color, alpha);
      g.fillPoints([gridToScreen(x0, ya), gridToScreen(x1, ya), gridToScreen(x1, yb), gridToScreen(x0, yb)], true);
    };
    // ombra morbida lungo i due muri (si allarga e sfuma verso la sala)
    [[0.45, 0.9, 0.1], [0.9, 1.5, 0.05]].forEach(([a, b, al]) => {
      floorQuad(a, y0, b, VENUE_H, 0x000000, al);
      floorQuad(0, y0 + a, VENUE_W, y0 + b, 0x000000, al);
    });
    // luna dalle finestre della parete laterale: chiazze fredde sul parquet
    const moon = this.add.graphics().setDepth(0.46).setBlendMode(Phaser.BlendModes.ADD);
    for (let y = y0 + 4.3; y < VENUE_H - 1; y += 2.1) {
      if (y + 1.5 < STAGE_ORIGIN_Y + STAGE_H + 0.5 || y + 3 > VENUE_H) continue;   // palco già illuminato; non fuori sala
      moon.fillStyle(0x7f9ccc, 0.07);
      moon.fillPoints([gridToScreen(0.7, y + 0.9), gridToScreen(2.1, y + 1.5), gridToScreen(2.1, y + 3.0), gridToScreen(0.7, y + 2.4)], true);
    }

    const w = this.add.graphics().setDepth(1.16);
    // spessore in cima alle pareti: si capisce che sono muri veri
    const top = (pts, color) => { w.fillStyle(color, 1); w.fillPoints(pts.map(([x, y]) => { const q = gridToScreen(x, y); return { x: q.x, y: q.y - H }; }), true); };
    top([[-0.22, y0 - 0.22], [0, y0], [0, VENUE_H], [-0.22, VENUE_H]], 0x767c89);
    top([[-0.22, y0 - 0.22], [VENUE_W, y0 - 0.22], [VENUE_W, y0], [0, y0]], 0x767c89);
    { const a = gridToScreen(VENUE_W, y0 - 0.22), b = gridToScreen(VENUE_W, y0); w.fillStyle(0x3a3e47, 1);
      w.fillPoints([{ x: a.x, y: a.y - H }, { x: b.x, y: b.y - H }, { x: b.x, y: b.y }, { x: a.x, y: a.y }], true); }
    { const a = gridToScreen(0, VENUE_H), b = gridToScreen(-0.22, VENUE_H); w.fillStyle(0x3a3e47, 1);
      w.fillPoints([{ x: a.x, y: a.y - H }, { x: b.x, y: b.y - H }, { x: b.x, y: b.y }, { x: a.x, y: a.y }], true); }

    // tabellone segnapunti sulla parete di fondo, sopra la porta del carico
    const bp = (gx, h) => { const q = gridToScreen(gx, y0); return { x: q.x, y: q.y - h }; };
    const bface = (xa, xb, ha, hb, color) => { w.fillStyle(color, 1); w.fillPoints([bp(xa, ha), bp(xb, ha), bp(xb, hb), bp(xa, hb)], true); };
    bface(3.05, 4.15, 112, 158, 0x0d0e11);
    bface(3.05, 4.15, 112, 114, 0x5d636f);
    const ang = Phaser.Math.RadToDeg(Math.atan2(TILE_H / 2, TILE_W / 2));
    const sc = bp(3.6, 144), sl = bp(3.28, 124), sr = bp(3.92, 124);
    const digit = { fontFamily: 'Barlow Condensed, sans-serif', fontStyle: 'bold', color: '#ff5a3c' };
    this.add.text(sc.x, sc.y, '20:30', { ...digit, fontSize: '13px', color: '#ffb23c' }).setOrigin(0.5).setAngle(ang).setDepth(1.17);
    this.add.text(sl.x, sl.y, 'CASA 12', { ...digit, fontSize: '7px' }).setOrigin(0.5).setAngle(ang).setDepth(1.17);
    this.add.text(sr.x, sr.y, 'OSPITI 9', { ...digit, fontSize: '7px' }).setOrigin(0.5).setAngle(ang).setDepth(1.17);

    // canestro laterale sulla parete sinistra, sopra l'angolo dei case
    const lp = (gy, h, gx = 0) => { const q = gridToScreen(gx, gy); return { x: q.x, y: q.y - h }; };
    const c = this.add.graphics().setDepth(0.55);
    c.fillStyle(0x9aa0ab, 1); c.fillPoints([lp(14.95, 120), lp(15.25, 120), lp(15.25, 128, 0.35), lp(14.95, 128, 0.35)], true);
    c.fillStyle(0xf4f2ec, 1); c.fillPoints([lp(14.45, 128, 0.35), lp(15.75, 128, 0.35), lp(15.75, 178, 0.35), lp(14.45, 178, 0.35)], true);
    c.lineStyle(2, 0xd6392f, 1); c.strokePoints([lp(14.8, 132, 0.35), lp(15.4, 132, 0.35), lp(15.4, 152, 0.35), lp(14.8, 152, 0.35)], true);
    const rim = lp(15.1, 132, 0.75);
    c.lineStyle(2.5, 0xf06a1f, 1); c.strokeEllipse(rim.x, rim.y, 30, 14);
    for (let i = -2; i <= 2; i++) { c.lineStyle(1, 0xe9e4d6, 0.6); c.lineBetween(rim.x + i * 6, rim.y + 3, rim.x + i * 3.5, rim.y + 20); }
    c.lineStyle(1, 0xe9e4d6, 0.5); c.strokeEllipse(rim.x, rim.y + 12, 18, 7);
  }

  /* parete dietro al palco (gy = CARICO_ROWS): chiude la palestra. Dai
     finestroni alti si intravede il cortile di notte col furgone del service.
     Sta sopra il cortile e sotto tutto ciò che è dentro. */
  drawBackWall (H) {
    const g = this.add.graphics().setDepth(1.15);
    const y = CARICO_ROWS;
    const wp = (gx, h) => { const q = gridToScreen(gx, y); return { x: q.x, y: q.y - h }; };
    const face = (xa, xb, ha, hb, color, alpha = 1) => { g.fillStyle(color, alpha); g.fillPoints([wp(xa, ha), wp(xb, ha), wp(xb, hb), wp(xa, hb)], true); };
    const W0 = 66, W1 = 172;                     // davanzale e architrave dei finestroni
    const wins = [[0.35, 2.85], [5.7, 7.6], [7.9, 9.7]];
    // muro pieno sotto, sopra e fra i finestroni (i vetri restano aperti sul cortile)
    face(0, VENUE_W, 0, W0, 0x464b56);
    face(0, VENUE_W, W1, H, 0x464b56);
    let x = 0;
    wins.forEach(([a, b]) => { face(x, a, W0, W1, 0x464b56); x = b; });
    face(x, VENUE_W, W0, W1, 0x464b56);
    face(0, VENUE_W, 0, 56, 0x2f4356);
    face(0, VENUE_W, 56, 60, 0xf2a541, 0.55);
    face(0, VENUE_W, H - 6, H, 0x5d636f);
    // vetri: notte fuori, riflessi e montanti
    wins.forEach(([a, b]) => {
      face(a, b, W0, W1, 0x0e1622, 0.35);
      face(a, b, W0 - 4, W0, 0x6b7180);
      face(a, b, W1, W1 + 4, 0x6b7180);
      for (let m = a; m <= b + 0.001; m += (b - a) / Math.max(2, Math.round((b - a) / 0.8))) {
        const p0 = wp(m, W0), p1 = wp(m, W1); g.lineStyle(3, 0x6b7180, 1); g.lineBetween(p0.x, p0.y, p1.x, p1.y);
      }
      const h0 = wp(a, (W0 + W1) / 2), h1 = wp(b, (W0 + W1) / 2); g.lineStyle(2, 0x6b7180, 1); g.lineBetween(h0.x, h0.y, h1.x, h1.y);
      g.lineStyle(2, 0x9fb6d3, 0.22);
      const r0 = wp(a + 0.2, W0 + 8), r1 = wp(a + 0.6, W1 - 6); g.lineBetween(r0.x, r0.y, r1.x, r1.y);
    });
    // porta del carico, da dove sono entrati i case
    face(4.3, 5.4, 0, 100, 0x2a2d33);
    face(4.85, 4.87, 0, 100, 0x14161a);
    face(4.3, 5.4, 100, 104, 0x6b7180);
    // ombra del muro sul pavimento del backstage
    g.fillStyle(0x000000, 0.25);
    g.fillPoints([gridToScreen(0, y), gridToScreen(VENUE_W, y), gridToScreen(VENUE_W, y + 0.4), gridToScreen(0, y + 0.4)], true);
    // spigolo con la parete laterale
    { const a = wp(0, 0), b = wp(0, H); g.lineStyle(3, 0x5d636f, 1); g.lineBetween(a.x, a.y, b.x, b.y); }
  }

  /* luci di servizio: pozze calde sul palco e in regia, buio ai bordi */
  drawWorkLights () {
    if (!this.textures.exists('pool')) {
      const tex = this.textures.createCanvas('pool', 256, 256), ctx = tex.getContext();
      const gr = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, 256, 256); tex.refresh();
    }
    const pool = (gx, gy, sx, color, alpha) => {
      const q = gridToScreen(gx, gy);
      this.add.image(q.x, q.y, 'pool').setScale(sx, sx * 0.62).setTint(color).setAlpha(alpha)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(0.9);
    };
    pool(1.8, 0.6, 2.2, 0xffd28a, 0.35);
    pool(0.6, 3.05, 0.5, 0x2fa35a, 0.35);  // luce verde delle uscite
    pool(0.6, 11.75, 0.5, 0x2fa35a, 0.35);   // lampione del cortile, si vede dai finestroni
    pool(STAGE_ORIGIN_X + 2, STAGE_ORIGIN_Y + 2, 2.6, 0xffc98a, 0.22);
    pool(7.5, 6, 1.6, 0xffe2b8, 0.16);
    pool(5, 2.6, 2.4, 0xbfd4ff, 0.12);
    pool(5, 13.5, 2.6, 0xffd9a0, 0.10);
  }

  // confine di zona: una striscia di nastro bianco sul pavimento
  drawZoneOutline (corners, label, at) {
    const g = this.add.graphics().setDepth(1);
    const [[x0, y0], , [x1, y1]] = corners;
    g.fillStyle(0xe9e4d6, 0.28);
    if (y0 > 0) g.fillPoints([gridToScreen(x0, y0 - 0.03), gridToScreen(x1, y0 - 0.03), gridToScreen(x1, y0 + 0.03), gridToScreen(x0, y0 + 0.03)], true);
    if (label) this.floorSticker(at ? at[0] : x0 + 0.9, at ? at[1] : (y0 + y1) / 2, label);
  }

  // etichetta di zona: un pezzo di nastro scritto a pennarello, sempre leggibile
  floorSticker (gx, gy, text, color = '#d9d4c7') {
    const p = gridToScreen(gx, gy);
    const t = this.add.text(0, 0, text, { fontFamily: FONT_MARKER, fontSize: '15px', color: '#1b1b1b' }).setOrigin(0.5);
    const w = t.width + 18, h = t.height + 2;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.35); bg.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
    bg.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 0.92);
    bg.fillPoints([{ x: -w / 2, y: -h / 2 + 1 }, { x: w / 2, y: -h / 2 }, { x: w / 2 - 3, y: 0 }, { x: w / 2, y: h / 2 },
      { x: -w / 2 + 1, y: h / 2 - 1 }, { x: -w / 2 + 4, y: 0 }], true);
    return this.add.container(p.x, p.y, [bg, t]).setDepth(1.2).setAngle(-4).setAlpha(0.92);
  }

  drawZoneOutlines () {
    const pitStart = STAGE_ORIGIN_Y + STAGE_H;
    const plateaStart = pitStart + PIT_ROWS;
    const fohStart = plateaStart + PLATEA_ROWS;
    this.drawZoneOutline([[0, 0], [VENUE_W, 0], [VENUE_W, CARICO_ROWS], [0, CARICO_ROWS]], null);
    this.drawZoneOutline([[0, CARICO_ROWS], [VENUE_W, CARICO_ROWS], [VENUE_W, STAGE_ORIGIN_Y], [0, STAGE_ORIGIN_Y]], 'BACKSTAGE', [1.2, 3.1]);
    this.drawZoneOutline([[0, pitStart], [VENUE_W, pitStart], [VENUE_W, plateaStart], [0, plateaStart]], 'PIT', [4.6, pitStart + 1.1]);
    this.drawZoneOutline([[0, plateaStart], [VENUE_W, plateaStart], [VENUE_W, fohStart], [0, fohStart]], 'PLATEA', [4.6, plateaStart + 2]);
    this.drawZoneOutline([[0, fohStart], [VENUE_W, fohStart], [VENUE_W, VENUE_H], [0, VENUE_H]], 'REGIA FOH', [4.6, fohStart + 1.2]);
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

    // i due bauli dei cavi e un case di ricambio, dentro la palestra:
    // nell'angolo dietro la regia FOH, contro la parete (celle occupate)
    const caseSpots = [[0.55, 15.45, 'segnale'], [1.55, 15.45, 'corrente'], [0.55, 14.5, null]];
    caseSpots.forEach(([gx, gy, caseName], i) => {
      const p = gridToScreen(gx, gy);
      const cg = this.add.graphics().setDepth(isoDepth(p.y) - 0.0005).setPosition(p.x, p.y);
      const tape = caseName === 'segnale' ? 0xeaff2b : caseName === 'corrente' ? 0xff4fb4 : null;
      this.drawFlightCase(cg, CASE_ISO, tape);
      if (!caseName) return;
      this.casePos = this.casePos || {};
      this.casePos[caseName] = p;
      this.add.text(p.x, p.y - 34, CABLE_CASES[caseName].title, {
        fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#e6e8eb'
      }).setOrigin(0.5).setDepth(isoDepth(p.y));
      const hit = this.add.rectangle(p.x, p.y - 6, 58, 58, 0xffffff, 0.001).setDepth(isoDepth(p.y) + 0.0001)
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
    sides.fillStyle(0x1a1a1d, 1);
    sides.beginPath();
    sides.moveTo(rightV.x, rightV.y); sides.lineTo(bottomV.x, bottomV.y);
    sides.lineTo(bottomV.x, bottomV.y + PLATFORM_HEIGHT); sides.lineTo(rightV.x, rightV.y + PLATFORM_HEIGHT);
    sides.closePath(); sides.fillPath();
    sides.fillStyle(0x131315, 1);
    sides.beginPath();
    sides.moveTo(bottomV.x, bottomV.y); sides.lineTo(leftV.x, leftV.y);
    sides.lineTo(leftV.x, leftV.y + PLATFORM_HEIGHT); sides.lineTo(bottomV.x, bottomV.y + PLATFORM_HEIGHT);
    sides.closePath(); sides.fillPath();

    // gonnellino nero del palco, a pieghe
    for (let i = 0.25; i < totalW; i += 0.25) { const a = gridToScreen(gx0 + i, gy0 + H); sides.lineStyle(1, 0x2a2a2e, 0.9); sides.lineBetween(a.x, a.y + 2, a.x, a.y + PLATFORM_HEIGHT); }
    for (let j = 0.25; j < H; j += 0.25) { const a = gridToScreen(gx0 + totalW, gy0 + j); sides.lineStyle(1, 0x2a2a2e, 0.9); sides.lineBetween(a.x, a.y + 2, a.x, a.y + PLATFORM_HEIGHT); }
    const top = this.add.graphics().setDepth(3);
    top.fillStyle(0x2c2721, 1);
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
        top.fillStyle(0x36302a, 0.35);
        top.beginPath();
        top.moveTo(p0.x, p0.y); top.lineTo(p1.x, p1.y); top.lineTo(p2.x, p2.y); top.lineTo(p3.x, p3.y);
        top.closePath(); top.fillPath();
      }
    }

    // nastro bianco di sicurezza sul bordo del palco
    top.fillStyle(0xe9e4d6, 0.7);
    top.fillPoints([gridToScreen(gx0, gy0 + H - 0.06), gridToScreen(gx0 + totalW, gy0 + H - 0.06), gridToScreen(gx0 + totalW, gy0 + H), gridToScreen(gx0, gy0 + H)], true);
    top.fillPoints([gridToScreen(gx0, gy0), gridToScreen(gx0 + 0.06, gy0), gridToScreen(gx0 + 0.06, gy0 + H), gridToScreen(gx0, gy0 + H)], true);
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
    this.floorSticker(STAGE_ORIGIN_X + STAGE_W + OFFSTAGE_W / 2, STAGE_ORIGIN_Y + 0.6, 'OFF STAGE', '#8b8e98').setDepth(3.1);
    this.floorSticker(STAGE_ORIGIN_X + 0.9, STAGE_ORIGIN_Y + 0.5, 'PALCO', '#f2a541').setDepth(3.1);

    this.stageBox = {
      minX: Math.min(topV.x, rightV.x, bottomV.x, leftV.x),
      maxX: Math.max(topV.x, rightV.x, bottomV.x, leftV.x),
      minY: Math.min(topV.y, rightV.y, bottomV.y, leftV.y),
      maxY: Math.max(topV.y, rightV.y, bottomV.y, leftV.y) + PLATFORM_HEIGHT
    };
  }

  drawAllaccio () {
    const pos = allaccioPos();
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
    // misura vera e fissa: non cresce più col carico
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
    // leva di ogni protezione dietro la finestra: su (armata, verde) o giù
    // (abbassata grigia, scattata rossa), con la spia sopra dello stesso colore
    const prot = quadroProt(gameState.placed[quadroId]);
    const P = qv.frame, k = this.isoKit(g, P), B = QUADRO_ISO.B;
    QUADRO_MODULES.forEach(([key, a, hw]) => {
      const on = !!prot[key];
      const c = on ? 0x49b06a : (prot.tripped[key] ? 0xe0503f : 0x2a2c32);
      const lw = hw - 0.8;
      const [z0, z1] = on ? [25.6, 28.4] : [22.8, 25.6];
      k.quadB(B, a - lw, a + lw, z0, z1, c);
      k.quadB(B, a - lw, a + lw, on ? z1 - 0.7 : z0, on ? z1 : z0 + 0.7, 0xffffff, 0.45);   // punta della leva
    });
    // coperchio trasparente incernierato, con un riflesso
    k.quadB(B, 2, QUADRO_ISO.A - 2, 20, 30.5, 0x9fb7c9, 0.12);
    const r0 = P(QUADRO_ISO.A * 0.55, B, 30.5), r1 = P(QUADRO_ISO.A * 0.55 + 5, B, 20);
    g.lineStyle(1, 0xffffff, 0.18); g.lineBetween(r0.x, r0.y, r1.x, r1.y);
    // barra subito sotto ogni presa di fase
    const barW = 5, barH = 1.5;
    def.ports.filter(p => p.phase).forEach(p => {
      const q = qv.portPos[p.id], barY = q.dy + 4;
      const frac = Math.min(1, loads[p.phase] / PHASE_BUDGET_W);
      const color = frac >= 1 ? 0xe0503f : (frac >= 0.75 ? 0xf2a541 : 0x49b06a);
      g.fillStyle(0x000000, 0.6);
      g.fillRect(q.dx - barW / 2, barY, barW, barH);
      g.fillStyle(color, 1);
      g.fillRect(q.dx - barW / 2, barY, barW * frac, barH);
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
  drawComponentBody (g, def, rot, id, frame) {
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
      case 'asta': {
        // asta microfonica: treppiede, asta nera, snodo e giraffa col contrappeso
        const P = ASTA_ISO, k = this.isoKit(g, P);
        const A = P.A / 2, B = P.B / 2, c0 = P(A, B, 0);
        const line = (p, q, w, col) => { g.lineStyle(w, col, 1); g.lineBetween(p.x, p.y, q.x, q.y); };
        k.discZ(0, A, B, 16, 0x000000, 0.25);                                       // ombra
        [[A - 15, B], [A + 8, B - 13], [A + 8, B + 13]].forEach(([a, b]) => {
          const f = P(a, b, 0); line(P(A, B, 14), f, 2.6, 0x1c1d22);                // gambe
          g.fillStyle(0x0c0d10, 1); g.fillCircle(f.x, f.y, 1.8);
        });
        g.fillStyle(0x2a2c32, 1); g.fillRect(c0.x - 2, c0.y - ASTA_POLE, 4, ASTA_POLE - 12);   // asta
        g.fillStyle(0x5d6068, 1); g.fillRect(c0.x - 2, c0.y - ASTA_POLE, 1.1, ASTA_POLE - 12);
        g.fillStyle(0x3a3d45, 1); g.fillRect(c0.x - 3.5, c0.y - 18, 7, 4);             // serraggio altezza
        const top = P(A, B, ASTA_POLE), tip = P(...ASTA_TIP), back = P(A - 8, B + 8, ASTA_POLE - 5);
        line(back, tip, 2.6, 0x26282d);                                            // giraffa
        g.fillStyle(0x3a3d45, 1); g.fillCircle(back.x, back.y, 2.6);              // contrappeso
        g.fillCircle(top.x, top.y, 2.8);                                           // snodo
        g.fillStyle(0x6a6e78, 1); g.fillCircle(top.x - 0.8, top.y - 0.8, 1);
        break;
      }
      case 'mic': {
        // microfono dinamico sulla punta della giraffa, nello stesso verso:
        // impugnatura nera verso l'asta (e il cavo), griglia argentata verso
        // chi parla, in fondo al palco
        g.lineStyle(4.4, 0x1c1d22, 1); g.lineBetween(-7, 4.8, 1, -0.7);
        g.fillStyle(0x1c1d22, 1); g.fillCircle(-7, 4.8, 2.2);
        g.lineStyle(1.8, 0x3a3d45, 1); g.lineBetween(-0.4, 1.4, 1.8, -1.6);          // ghiera
        g.fillStyle(0x9aa0aa, 1); g.fillCircle(3.6, -2.5, 4);                        // griglia
        g.fillStyle(0xd8dbe0, 1); g.fillCircle(2.4, -3.8, 1.6);
        g.lineStyle(0.6, 0x5d6068, 0.8); g.strokeCircle(3.6, -2.5, 4);
        break;
      }
      case 'par': {
        // PAR LED: fusto cilindrico ("lattina") puntato davvero verso dove
        // illumina (vedi parAim), inclinato in giù, tenuto da una forcella a U
        // sulla piastra dello stativo. Se la lente guarda lontano da chi
        // osserva si vedono il retro e le alette di raffreddamento.
        const P = PAR_ISO, k = this.isoKit(g, P);
        const stand = id && mountBase(gameState.placed[id]), aim = id && parAim(id);
        let [da, db] = rotDir(rot, -1, 0);
        if (stand && aim) { const sc = compCenter(stand); da = -(aim.gy - sc.gy); db = aim.gx - sc.gx; }
        // un filo girato verso chi guarda (-a, +b): la lente resta tonda e
        // leggibile anche quando il faro punta di lato
        // (o via da chi guarda, se il faro gli dà le spalle: si vede tondo il retro)
        let hl = Math.hypot(da, db) || 1; da /= hl; db /= hl;
        const sg = -da + db >= 0 ? 1 : -1; da -= 0.4 * sg; db += 0.4 * sg;
        hl = Math.hypot(da, db) || 1;
        const tilt = 0.12;                                           // appena verso il basso
        const d = [da / hl * Math.cos(tilt), db / hl * Math.cos(tilt), -Math.sin(tilt)];
        const cross = (x, y) => [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
        const norm = x => { const l = Math.hypot(...x) || 1; return x.map(c => c / l); };
        const u = norm(cross(d, [0, 0, 1])), v = norm(cross(u, d));  // u orizzontale, v "in su" sulla lente
        const C = [19, 17, 25], r = 12.5;
        const at = (c, t, rad) => P(c[0] + rad * (Math.cos(t) * u[0] + Math.sin(t) * v[0]),
          c[1] + rad * (Math.cos(t) * u[1] + Math.sin(t) * v[1]), c[2] + rad * (Math.cos(t) * u[2] + Math.sin(t) * v[2]));
        const along = s0 => C.map((c, n) => c + d[n] * s0);
        const ring = (s0, rad, n = 36) => Array.from({ length: n }, (_, i) => at(along(s0), i / n * Math.PI * 2, rad));
        const F = 11, Bk = -13;                                         // lente davanti, tappo dietro
        // verso chi guarda (vedi isoFrame): -a, +b, +z
        const facing = -d[0] + d[1] + 0.686 * d[2] > 0;
        // forcella: piastra sulla barra a T e due bracci fino ai perni sui fianchi
        k.box(8, 30, 6, 28, 0, 2.5, ISO_GREY);
        const pivots = [1, -1].map(sg => P(C[0] + u[0] * (r + 2.5) * sg, C[1] + u[1] * (r + 2.5) * sg, C[2]));
        const feet = [1, -1].map(sg => P(19 + u[0] * (r + 2.5) * sg, 17 + u[1] * (r + 2.5) * sg, 2.5));
        const arm = n => { g.lineStyle(3.2, 0x55585f, 1); g.lineBetween(feet[n].x, feet[n].y, pivots[n].x, pivots[n].y); };
        // il braccio più lontano va dietro al fusto
        const far = pivots[0].y < pivots[1].y ? 0 : 1;
        arm(far);
        // fusto: sagoma dei due cerchi, poi la metà in luce (dall'alto a sinistra)
        const front = ring(F, r), back = ring(Bk, r);
        k.poly(convexHull(front.concat(back)), 0x17181c);
        const lit = t => Math.sin(t) * 0.9 - Math.cos(t) * 0.35 > 0.25;
        const litPts = [];
        for (let i = 0; i < 36; i++) { const t = i / 36 * Math.PI * 2; if (lit(t)) litPts.push(at(along(F), t, r), at(along(Bk), t, r)); }
        if (litPts.length > 2) k.poly(convexHull(litPts), 0x2b2d34);
        // alette di raffreddamento sul fusto
        g.lineStyle(1, 0x0c0d10, 0.9);
        [-9, -5, -1, 3].forEach(s0 => g.strokePoints(ring(s0, r + 0.3), true));
        if (facing) {
          k.poly(ring(F, r + 0.6), 0x0c0d10);                            // ghiera frontale
          k.poly(ring(F + 0.3, r - 1.6), 0x3b3423);                      // lente
          k.poly(ring(F + 0.4, r - 4.5), 0x4a412b);
          [[0, 0], [5.8, 0], [-5.8, 0], [2.9, 5], [-2.9, 5], [2.9, -5], [-2.9, -5]].forEach(([x, y]) => {
            const t = Math.atan2(y, x), rad = Math.hypot(x, y);
            const c0 = rad ? at(along(F + 0.5), t, rad) : P(...along(F + 0.5));
            g.fillStyle(0xf6e7a8, 1); g.fillCircle(c0.x, c0.y, 1.7);
          });
          g.lineStyle(1.4, def.body.accent, 0.9); g.strokePoints(ring(F, r + 0.6), true);
        } else {
          k.poly(ring(Bk, r), 0x222429);                                   // tappo posteriore
          g.lineStyle(1, 0x3a3d45, 1); g.strokePoints(ring(Bk, r), true);
          k.poly(ring(Bk - 0.2, 4.5), 0x2e3037);                           // passacavo
        }
        arm(1 - far);
        pivots.forEach(pv => { g.fillStyle(0x8a8e98, 1); g.fillCircle(pv.x, pv.y, 3); g.fillStyle(0x3a3d45, 1); g.fillCircle(pv.x, pv.y, 1.4); });
        break;
      }
      case 'ampli': {
        // flight case rack 2U coi coperchi tolti: guscio nero con angolari e
        // maniglie, dentro le guide rack il frontale del finale (manopole di
        // livello, LED di stato, interruttore)
        const P = RACK_ISO, k = this.isoKit(g, P);
        const { A, B, Z } = P;
        k.discZ(0, A / 2, B / 2, 44, 0x000000, 0.22);                    // ombra
        // i due coperchi tolti, in piedi contro il fianco del case (dietro)
        [[A + 3, A + 7], [A + 8, A + 12]].forEach(([a0, a1], i) => {
          k.box(a0, a1, 4 + i * 3, B - 4 + i * 3, 0, Z - 2, { top: 0x3a3d45, left: 0x24262b, right: 0x1a1b1f });
          const e0 = P(a0, 4 + i * 3, Z - 2), e1 = P(a0, B - 4 + i * 3, Z - 2);
          g.lineStyle(1, 0x9aa0aa, 0.8); g.lineBetween(e0.x, e0.y, e1.x, e1.y);
        });
        k.box(0, A, 0, B, 0, Z, { top: 0x2c2e34, left: 0x202227, right: 0x16171b });
        k.quadB(B, 4, A - 4, 3, Z - 3, 0x08090b);                        // bocca del rack
        [[4, 9], [A - 9, A - 4]].forEach(([a0, a1]) => k.quadB(B, a0, a1, 3, Z - 3, 0x9aa0aa)); // guide rack
        [[4, 9], [A - 9, A - 4]].forEach(([a0, a1]) => [7, Z - 7].forEach(z => k.discB(B, (a0 + a1) / 2, z, 1.1, 0x2a2c33)));
        const f0 = 10, f1 = A - 10, zm = Z / 2;                          // frontale del finale
        k.quadB(B, f0, f1, 6, Z - 6, 0x1a1b20);
        k.discB(B, f0 + 10, zm, 3.6, 0x0c0d10); k.discB(B, f0 + 10, zm, 2.8, 0x8a8e98);
        k.discB(B, f0 + 20, zm, 3.6, 0x0c0d10); k.discB(B, f0 + 20, zm, 2.8, 0x8a8e98);
        [0x49b06a, 0x49b06a, 0xf2c53d, 0x2a2c33].forEach((c, i) => k.quadB(B, f0 + 30 + i * 4, f0 + 33 + i * 4, zm + 1.5, zm + 4, c));
        [0x49b06a, 0x49b06a, 0x2a2c33, 0x2a2c33].forEach((c, i) => k.quadB(B, f0 + 30 + i * 4, f0 + 33 + i * 4, zm - 4, zm - 1.5, c));
        k.quadB(B, f1 - 12, f1 - 4, zm - 2.5, zm + 2.5, 0xd6392f);       // interruttore
        // angolari a sfera e bordi in alluminio
        [[0, 0], [A, 0], [A, Z], [0, Z]].forEach(([a, z]) => k.discB(B, Math.min(A - 2.5, Math.max(2.5, a)), Math.min(Z - 2.5, Math.max(2.5, z)), 2.6, 0xc9ccd1));
        [0, Z].forEach(z => { const e0 = P(0, B, z), e1 = P(A, B, z); g.lineStyle(1.2, 0x9aa0aa, 0.8); g.lineBetween(e0.x, e0.y, e1.x, e1.y); });
        k.quadA(0, B / 2 - 9, B / 2 + 9, zm - 3, zm + 3, 0x0c0d10);        // maniglia a scomparsa sul fianco
        k.quadA(0, B / 2 - 7, B / 2 + 7, zm - 1.5, zm + 1.5, 0x9aa0aa);
        break;
      }
      case 'tavolo': {
        // tavolo regia pieghevole: piano nero su quattro gambe in acciaio,
        // bordo in alluminio verso il tecnico, un rotolo di nastro sul piano
        const P = TAVOLO_ISO, k = this.isoKit(g, P);
        const { A, B } = P, H = TAVOLO_TOP;
        k.discZ(0, A / 2, B / 2, 60, 0x000000, 0.18);                    // ombra
        const legs = [[6, 6], [A - 6, 6], [6, B - 6], [A - 6, B - 6]];
        legs.forEach(([a, b]) => k.box(a - 2, a + 2, b - 2, b + 2, 0, H - 4, ISO_GREY));
        // traverse tra le gambe sui fianchi corti
        [6, A - 6].forEach(a => { const e0 = P(a, 6, 10), e1 = P(a, B - 6, 10); g.lineStyle(2, 0x7d828c, 1); g.lineBetween(e0.x, e0.y, e1.x, e1.y); });
        k.box(0, A, 0, B, H - 4, H, { top: 0x2b2d33, left: 0x1d1e22, right: 0x141518 });
        const e0 = P(0, B, H), e1 = P(A, B, H); g.lineStyle(1.2, 0x9aa0aa, 0.7); g.lineBetween(e0.x, e0.y, e1.x, e1.y);
        k.discZ(H, A - 14, B - 12, 6, 0xd9d9d9); k.discZ(H, A - 14, B - 12, 3, 0x2b2d33);   // nastro telato
        break;
      }
      case 'quadro': {
        // combinazione prese da evento in gomma piena nera (tipo EverGUM):
        // spigoli smussati e piedini per impilarle, maniglia sul tetto; sul
        // fronte, sotto il coperchio trasparente con la chiusura inox, i
        // moduli su guida DIN (generale, salvavita, un magnetotermico per
        // fase: le leve le disegna updateQuadroPhaseBars) e sotto le tre
        // prese CEE 16A blu col coperchietto; sul fianco l'ingresso rosso
        const P = frame || rotFrame(QUADRO_ISO, rot), k = this.isoKit(g, P);
        const { A, B, Z } = P;
        // fianco con l'ingresso: a=0, o a=A se girato (l'altro è nascosto)
        const sa = rot ? A : 0;
        const rubber = { top: 0x34363c, left: 0x24262b, right: 0x1a1b1f };
        [[3, 3], [A - 3, 3], [3, B - 3], [A - 3, B - 3]].forEach(([a, b]) => k.box(a - 2, a + 2, b - 2, b + 2, 0, 2, ISO_BLACK)); // piedini
        k.box(0, A, 0, B, 2, Z - 2, rubber);
        k.box(1.5, A - 1.5, 1.5, B - 1.5, Z - 2, Z, rubber);           // tetto smussato
        // incavo sul tetto per impilarle e maniglia stampata
        k.quadZ(Z, 6, A - 6, 6, B - 6, 0x2a2c31);
        k.box(9, 12, B / 2 - 2, B / 2 + 2, Z, Z + 3.5, ISO_BLACK);
        k.box(A - 12, A - 9, B / 2 - 2, B / 2 + 2, Z, Z + 3.5, ISO_BLACK);
        k.box(9, A - 9, B / 2 - 2, B / 2 + 2, Z + 3.5, Z + 5, ISO_BLACK);
        // nervature di gomma sul fronte, ai lati
        [0.8, A - 0.8].forEach(a => k.quadB(B, a - 0.5, a + 0.5, 3, Z - 3, 0x2e3035));
        // vano interruttori: fondo, guida DIN e moduli bianchi
        k.quadB(B, 2, A - 2, 20, 30.5, 0x3a3d45);
        k.quadB(B, 2.6, A - 2.6, 20.6, 29.9, 0x1d1e22);
        k.quadB(B, 2.6, A - 2.6, 25, 26.2, 0x8a8e98);
        QUADRO_MODULES.forEach(([key, a, hw]) => {
          k.quadB(B, a - hw + 0.2, a + hw - 0.2, 21.4, 29.2, 0xf2f2ef);
          k.quadB(B, a - hw + 0.6, a + hw - 0.6, 22.6, 28.6, 0xd5d7da); // incavo della leva
        });
        k.discB(B, 11 + 1.9, 28.6, 0.5, 0xf2c53d);                     // tasto T del salvavita
        k.quadB(B, A / 2 - 3, A / 2 + 3, 30.8, 32, 0xc9ccd1);          // chiusura rapida inox
        // targhetta delle linee sopra le prese
        k.quadB(B, 1.5, A - 1.5, 16.6, 18.8, 0xf7f7f4);
        // prese CEE 16A blu col coperchietto a molla
        QUADRO_PHASE_A.forEach(a => {
          k.discB(B, a, 9.5, 4, 0x1d4a9a); k.discB(B, a, 9.5, 3.1, 0x2f6fd6);
          k.quadB(B, a - 3.6, a + 3.6, 13.2, 14.6, 0x3a7fe0);
        });
        // fianco: nervature e ingresso CEE 32A rosso
        for (let z = 22; z <= 30; z += 2.5) k.quadA(sa, 4, B - 4, z, z + 0.8, 0x2e3035);
        k.discA(sa, 15.5, 13, 5.2, 0x9e2820); k.discA(sa, 15.5, 13, 4.2, 0xd6392f);
        k.quadA(sa, 11, 20, 18.8, 20.3, 0xd6392f);                      // coperchietto dell'ingresso
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
      case 'dj': {
        // consolle del DJ: banco in flight case con il telo nero e le strisce
        // al neon verso il pubblico (faccia a=0); sopra i due lettori con i
        // piatti e in mezzo il mixer DJ coi fader. Connettori sul fianco b=B.
        const P = DJ_ISO, k = this.isoKit(g, P);
        const { A, B, Z } = P;
        k.box(0, A, 0, B, 0, Z, ISO_BLACK);
        k.quadA(0, 1, B - 1, Z - 2, Z, 0x9aa0aa);                         // profilo in alluminio
        k.quadA(0, 5, B - 5, 3, Z - 4, 0x1c0f24);                        // telo del banco
        k.quadA(0, 8, B - 8, Z - 9, Z - 7.5, def.body.accent);           // neon magenta
        k.quadA(0, 8, B - 8, 6, 7.5, 0x3fd9ff);                          // neon azzurro
        k.quadB(B, 3, A - 3, 3, Z - 3, 0x22242a);                        // piastra connettori
        [18, 78].forEach(bc => {
          // lettore: scocca, piatto, etichetta e perno
          k.box(6, 38, bc - 12, bc + 12, Z, Z + 3, { top: 0x2a2c32, left: 0x1c1d22, right: 0x141519 });
          k.discZ(Z + 3, 23, bc, 9.5, 0x0c0d10);
          k.discZ(Z + 3, 23, bc, 7.5, 0x3a3d45);
          k.discZ(Z + 3, 23, bc, 2.6, def.body.accent);
          k.discZ(Z + 3, 23, bc, 0.9, 0xdcdfe4);
          k.quadZ(Z + 3, 9, 12, bc + 7, bc + 10, 0x6fd08c);              // play
        });
        // mixer DJ: due canali coi fader, manopole e il crossfader davanti
        k.box(6, 40, 36, 60, Z, Z + 4, ISO_BLACK);
        [43, 53].forEach(bc => {
          k.quadZ(Z + 4, 12, 24, bc - 0.5, bc + 0.5, 0x0c0d10);
          k.quadZ(Z + 4, 16, 18.5, bc - 2, bc + 2, 0xdcdfe4);
          [28, 32, 36].forEach(a => k.discZ(Z + 4, a, bc, 1.4, a === 36 ? def.body.accent : 0x9aa0aa));
        });
        k.quadZ(Z + 4, 8, 9, 42, 54, 0x0c0d10);
        k.quadZ(Z + 4, 7.5, 9.5, 47, 49, 0xdcdfe4);                      // crossfader
        break;
      }
      case 'djluci': {
        // stativo luci del DJ: treppiede, asta alta e barra lunga con sopra
        // quattro PAR LED (scatolette nere con la lente) e la strobo in mezzo,
        // tutti verso il pubblico (faccia a=0). I cavi scendono lungo l'asta.
        const P = DJLUCI_ISO, k = this.isoKit(g, P);
        const A = P.A / 2, B = P.B / 2, H = DJLUCI_POLE;
        const c0 = P(A, B, 0);
        k.discZ(0, A, B, 20, 0x000000, 0.25);                                     // ombra
        g.lineStyle(3, 0x1c1d22, 1);
        [[A, 0], [0, P.B], [P.A, P.B]].forEach(([a, b]) => {
          const f = P(a, b, 0);
          g.lineBetween(c0.x, c0.y - 14, f.x, f.y);                               // gambe
          g.fillStyle(0x0c0d10, 1); g.fillCircle(f.x, f.y, 2.2);
        });
        g.fillStyle(0x2a2c32, 1); g.fillRect(c0.x - 2.5, c0.y - H, 5, H - 12);   // asta
        g.fillStyle(0x55585f, 1); g.fillRect(c0.x - 2.5, c0.y - H, 1.4, H - 12);
        g.fillStyle(0x3a3d45, 1); g.fillRect(c0.x - 4, c0.y - 32, 8, 5);          // serraggio
        g.lineStyle(1.4, 0x0c0d10, 0.9); g.lineBetween(c0.x + 2.5, c0.y - H + 2, c0.x + 3.5, c0.y - 10); // cavi lungo l'asta
        const b0 = P(A, B - 44, H), b1 = P(A, B + 44, H);                         // barra
        g.lineStyle(4, 0x1c1d22, 1); g.lineBetween(b0.x, b0.y, b1.x, b1.y);
        g.lineStyle(1, 0x6a6e78, 1); g.lineBetween(b0.x, b0.y - 1.5, b1.x, b1.y - 1.5);
        // i fari: prima quelli lontani (b piccolo), così i vicini li coprono
        DJLUCI_HEADS.forEach(db => {
          const bc = B + db;
          k.box(A - 4, A + 5, bc - 1, bc + 1, H, H + 3, ISO_GREY);                // staffa
          k.box(A - 4, A + 6, bc - 5.5, bc + 5.5, H + 1.5, H + 12.5, ISO_BLACK);
          k.discA(A - 4, bc, H + 7, 4.6, 0x0c0d10);                               // ghiera
          k.discA(A - 4, bc, H + 7, 3.6, 0x3b3423);                               // lente coi LED
          [[0, 0], [1.8, 1], [-1.8, 1], [0, -1.9]].forEach(([x, z]) => {
            const q = P(A - 4, bc + x, H + 7 + z);
            g.fillStyle(0xf6e7a8, 0.9); g.fillCircle(q.x, q.y, 0.7);
          });
        });
        // strobo LED: scatola larga e bassa, pannello bianco lattiginoso
        k.box(A - 3, A + 5, B - 9, B + 9, H + 1.5, H + 9, ISO_BLACK);
        k.quadA(A - 3, B - 8, B + 8, H + 2.5, H + 8, 0xd8dbe0);
        g.lineStyle(0.6, 0x9aa0aa, 0.8);
        [-4, 0, 4].forEach(x => { const q0 = P(A - 3, B + x, H + 2.5), q1 = P(A - 3, B + x, H + 8); g.lineBetween(q0.x, q0.y, q1.x, q1.y); });
        k.quadA(A - 3, B + 5, B + 8, H + 9, H + 9.8, def.body.accent);           // marchio sul bordo
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
    // punti di aggancio dei cavi e LED, ruotati insieme al dispositivo
    const frame = def.shape === 'quadro' ? quadroFrame(x, y) : def.frame ? rotFrame(def.frame, rot) : null;
    this.drawComponentBody(body, def, rot, id, frame);
    const portPos = {};
    def.ports.forEach(p => {
      const q = (frame && p.iso) ? frame(...(rot && p.isoTurned || p.iso)) : { x: p.dx, y: p.dy };
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
    if (compType !== 'allaccio' && compType !== 'mic' && def.ports.length) {   // il microfono non ha spie
      led = this.add.graphics();
      c.add(led);
      this.drawLed(led, def, false, ledPos);
    }

    // sotto il dispositivo solo il conteggio delle prese collegate (es. "2/4"):
    // il nome si legge nel pannello, in scena sarebbe una scritta in più
    const idLabel = this.add.text(0, (def.body.oy || 0) + def.body.h / 2 + 12, '', {
      fontFamily: 'Inter, sans-serif', fontStyle: 'bold', fontSize: '10px', color: '#8b8e98',
      backgroundColor: 'rgba(12,13,16,0.82)', padding: { x: 5, y: 1 }
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
      hitArea: new Phaser.Geom.Rectangle(-def.body.w / 2 - pad, (def.body.oy || 0) - def.body.h / 2 - pad, def.body.w + pad * 2, def.body.h + pad * 2),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true
    });
    // tocco breve = pannello posteriore; pressione lunga = montaggio
    // (vedi onDevicePress / onScenePointerMove / onScenePointerUp)
    body.on('pointerdown', (pointer, lx, ly, event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      if (pointer.rightButtonDown()) return;
      // cavo in mano: i dispositivi non rispondono, si prende solo il cavo
      if (this.lay) { if (!this.layPointerDown(pointer)) this.layLocked(); return; }
      // un pezzo "armato" dalla barra si posa anche toccando sopra un dispositivo
      if (gameState.selectedPieceType) { this.placeArmedPieceAt(pointer.worldX, pointer.worldY); return; }
      this.onDevicePress(this.pickDeviceAt(pointer.worldX, pointer.worldY, 0) || id, pointer);
    });

    let phaseBars = null;
    if (isRealQuadro) {
      phaseBars = this.add.graphics();
      c.add(phaseBars);
      // sigla della fase sulla targhetta, sopra la sua presa
      QUADRO_MODULES.filter(([key]) => key[0] === 'L').forEach(([key, a]) => {
        const at = frame(QUADRO_PHASE_A[+key[1] - 1], QUADRO_ISO.B, 17.7);
        const tag = this.add.text(at.x, at.y, key, {
          fontFamily: 'Inter, sans-serif', fontSize: '3px', fontStyle: 'bold', color: '#1c1d22', resolution: 8
        }).setOrigin(0.5);
        c.add(tag);
      });

      // pulsante sempre visibile, ancorato al Quadro stesso: molto più diretto
      // di un bottone in header slegato dall'oggetto a cui si riferisce.
      // Ha una hit area propria "sopra" quella del corpo (stesso meccanismo
      // delle porte, incluso stopPropagation) così non fa scattare
      // spostamento/cablaggio quando viene toccato.
      const badgeX = def.body.w / 2 - 2, badgeY = (def.body.oy || 0) - def.body.h / 2 - 2;
      const badgeBg = this.add.circle(badgeX, badgeY, 11, 0x1c1d22, 1)
        .setStrokeStyle(2, 0xf2a541, 1)
        .setInteractive({ useHandCursor: true });
      const badgeIcon = this.add.text(badgeX, badgeY, '🔍', { fontSize: '11px' }).setOrigin(0.5);
      badgeBg.on('pointerdown', (pointer, lx, ly, event) => {
        if (event && event.stopPropagation) event.stopPropagation();
        if (this.lay) { if (!this.layPointerDown(pointer)) this.layLocked(); return; }
        renderQuadroModal();
        el('#quadro-modal').classList.add('show');
      });
      c.add(badgeBg); c.add(badgeIcon);
    }

    return { container: c, glow, idLabel, def, phaseBars, led, portPos, ledPos, rot, frame };
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
      v.glow.strokeRoundedRect(-v.def.body.w / 2 - 4, (v.def.body.oy || 0) - v.def.body.h / 2 - 4, v.def.body.w + 8, v.def.body.h + 8, 8);
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

  /* posa guidata: con un pezzo in mano si colorano le celle libere della sua
     zona (o si cerchiano le basi libere, per i pezzi che si montano sopra un
     altro). Restituisce quante ce ne sono; null spegne tutto. */
  showZoneHint (type) {
    const g = this.zoneGraphics;
    if (!g) return 0;
    g.clear();
    if (!type || !COMPONENT_TYPES[type] || gameState.stock[type] <= 0) return 0;
    const m = MOUNTS[type];
    if (m) {
      const bases = Object.values(gameState.placed).filter(c => c.type === m.base && !c[m.link]);
      g.lineStyle(3, 0x49b06a, 0.9);
      bases.forEach(b => {
        const v = this.compVisuals[b.id];
        if (!v) return;
        const oy = (v.def.body.oy || 0);
        g.strokeEllipse(v.container.x, v.container.y + oy, Math.max(56, v.def.body.w * 0.9), Math.max(40, v.def.body.h * 0.7));
      });
      return bases.length;
    }
    const pred = ZONE_PREDICATES[type] || (() => true);
    let n = 0;
    // il resto del locale si abbassa: resta in luce solo dove il pezzo può andare
    g.fillStyle(0x07080a, 0.45);
    g.fillPoints([gridToScreen(0, 0), gridToScreen(VENUE_W, 0), gridToScreen(VENUE_W, VENUE_H), gridToScreen(0, VENUE_H)], true);
    g.fillStyle(0x49b06a, 0.3);
    g.lineStyle(1, 0x7fe0a0, 0.55);
    for (let cx = 0; cx < VENUE_W; cx += CELL) {
      for (let cy = 0; cy < VENUE_H; cy += CELL) {
        if (!pred(cx, cy) || this.occupied[cellKey(cx, cy)]) continue;
        const i = 0.04;
        const p0 = gridToScreen(cx + i, cy + i), p1 = gridToScreen(cx + CELL - i, cy + i),
              p2 = gridToScreen(cx + CELL - i, cy + CELL - i), p3 = gridToScreen(cx + i, cy + CELL - i);
        g.fillPoints([p0, p1, p2, p3], true);
        g.strokePoints([p0, p1, p2, p3], true);
        n++;
      }
    }
    return n;
  }

  /* ---------------- piazzamento componenti ---------------- */
  handleExternalDrop (type, clientX, clientY) {
    this.clearDropPreview();
    const world = this.clientToWorld(clientX, clientY);
    this.placeComponentAt(type, world.x, world.y);
  }

  /* piazza un componente in una posizione di mondo: usata sia dal trascinamento
     (via handleExternalDrop) sia dal tocco-e-tocco (via placeArmedPieceAt) */
  placeComponentAt (type, worldX, worldY) {
    if (gameState.stock[type] <= 0) { showToast(/^ciabatta/.test(type) ? CIABATTE_FINITE : type.toUpperCase() + ' esaurito per questo livello.'); return; }

    if (MOUNTS[type]) { this.attachToNearestBase(type, { x: worldX, y: worldY }); return; }

    const spot = this.findSpot(type, worldX, worldY, null);
    if (!spot) { showToast('Non c\'è più posto per ' + COMPONENT_TYPES[type].label + ' nella sua zona: libera un po\' di spazio.'); return; }
    const cx = spot.gx, cy = spot.gy;

    const idx = gameState.nextIndex[type] = gameState.nextIndex[type] || 1;
    gameState.nextIndex[type]++;
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
    (MOUNT_ON[type] || []).forEach(t => { gameState.placed[id][MOUNTS[t].link] = null; });   // base libera
    updatePowerMeter();   // ora il pezzo conta nella potenza impegnata
    this.compVisuals[id] = this.buildComponentVisual(id, def, pos.x, pos.y);

    this.updateQuadroVisual();
    setCircuitStatus('untested');
    this.pushHistory();
    tireOut(FATIGUE.perAction);
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
    else this.showZoneHint(type);   // le celle appena occupate non sono più verdi
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
    const m = MOUNTS[type];
    return { x: bv.container.x + (m.offsetX ? m.offsetX() : 0), y: bv.container.y + m.offsetY(), depth: isoDepth(bv.container.y) + (m.depth != null ? m.depth : 0.001) };
  }

  attachToNearestBase (type, world) {
    const m = MOUNTS[type];
    const base = this.nearestFreeBase(type, world);
    if (!base) { showToast(m.missing); return; }

    const idx = gameState.nextIndex[type] = gameState.nextIndex[type] || 1;
    gameState.nextIndex[type]++;
    const id = type + '_' + idx;
    gameState.stock[type]--;
    updateStockUI();

    const at = this.mountPos(type, base);
    const pos = { x: at.x, y: at.y };
    base[m.link] = id;
    gameState.placed[id] = { id, type, [m.back]: base.id, zone: base.zone, screen: pos };
    if (type === 'par') gameState.placed[id].dmx = { addr: 1, mode: 1 };   // indirizzo/modalità DMX dal display
    updatePowerMeter();   // ora il pezzo conta nella potenza impegnata
    const visual = this.buildComponentVisual(id, COMPONENT_TYPES[type], pos.x, pos.y);
    visual.container.setDepth(at.depth);
    this.compVisuals[id] = visual;

    this.updateQuadroVisual();
    setCircuitStatus('untested');
    SFX.place();
    showToast(m.done(base.id), 'ok');
    this.pushHistory();
    tireOut(FATIGUE.perAction);
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
      id: gameState.edgeSeq,
      a: outSide.componentId, aPort: outSide.portId,
      b: inSide.componentId, bPort: inSide.portId,
      signal: gameState.selectedCable
    };
    // il capo ferma il primo collegamento sotto carico (il cavo resta in mano)
    if (tutorOn() && wouldArc(edge, true) && tutorWarn('live')) return;
    // tecnico stanco: ogni tanto il connettore scivola di mano (il cavo
    // resta in mano, basta riprovare). Vedi FATIGUE.
    if (fatigueSlip()) { showToast('Sei stanco: il connettore ti scivola di mano. Riprova (una 🍺 ti rimette in sesto).'); return; }
    gameState.edgeSeq++;
    // collegare sotto tensione fa scattare il salvavita; altrimenti il
    // dispositivo appena alimentato (se già acceso) parte davvero
    const rcdBefore = gameState.rcdTrips || 0;
    applyPowerAction(() => { gameState.edges.push(edge); checkLiveCableChange(edge); });
    if ((gameState.rcdTrips || 0) === rcdBefore) SFX.cableIn(signal);
    this.redrawEdges();

    this.highlightPending(pending.componentId, pending.portId, false);
    gameState.pendingPort = null;
    setCircuitStatus('untested');
    this.pushHistory();
    tireOut(FATIGUE.perAction);
    if (edge.signal === 'xlr') presideMicHint();
  }

  redrawEdges () {
    this.edgeGraphics.clear();
    const anySelected = this.selectedEdgeId != null || !!this.lay;
    gameState.edges.forEach(e => {
      const cableKind = CABLE_TYPES[e.signal];
      if (!gameState.visibleSignals[cableKind.layer]) { e._pts = null; return; }
      const from = this.getPortScreenPos(e.a, e.aPort);
      const to = this.getPortScreenPos(e.b, e.bPort);
      if (!from || !to) { e._pts = null; return; }
      const zoneA = gameState.placed[e.a] && gameState.placed[e.a].zone;
      const zoneB = gameState.placed[e.b] && gameState.placed[e.b].zone;
      const isSelected = e.id === this.selectedEdgeId || (this.lay && this.lay.id === e.id);
      const color = isSelected ? 0xf2a541 : cableKind.color;
      const width = isSelected ? 5 : 3;
      // con un cavo selezionato, tutti gli altri si "spengono" per farlo
      // risaltare nella matassa; senza selezione restano tutti a piena vista
      const alpha = anySelected ? (isSelected ? 1 : 0.16) : 1;
      // i cavi per terra: quelli piegati alla posa delle 20:00, se no il
      // percorso steso al montaggio (o quello automatico) a tratti dritti
      const route = caviRoute(e);
      const floor = route ? null : this.edgeFloor(e);
      // sub e testa sullo stesso palo: il cavetto va dritto dall'uno all'altra
      const baseA = posaBase(gameState.placed[e.a]);
      const sameBase = baseA && baseA === posaBase(gameState.placed[e.b]);
      const pts = route ? [from, ...route, to]
        : floor ? [from, ...layToScreen(floor.smooth), to]
        : (sameBase || (zoneA === 'stage' && zoneB === 'stage')) ? [from, to]
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
    this.drawGerryFloor();
    if (this.lay || this.layGraphics) this.drawLay();
    this.updateConnectionBadges();
    this.refreshLive();
    updateConnectionCounter(false);
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
      if (tutorOn() && wouldArc(edge, false) && tutorWarn('live')) return;
      applyPowerAction(() => { arced = checkLiveCableChange(edge); gameState.edges.splice(gameState.edges.indexOf(edge), 1); });
      if (!arced) SFX.cableOut(CABLE_TYPES[edge.signal].endpoints[0]);
    }
    this.selectedEdgeId = null;
    this.redrawEdges();
    setCircuitStatus('untested');
    if (!arced) showToast('Cavo eliminato.', 'ok');
    this.pushHistory();
  }

  /* ---------------- posa del cavo al montaggio ----------------
     Appena collegato (o toccandolo), il cavo resta "in mano": gli altri si
     spengono, i dispositivi non rispondono ai tocchi, e i suoi tratti si
     trascinano col dito scattando sulla griglia. Fatto (o un tocco sul
     pavimento) lo lascia così; il percorso si salva sul cavo (e.route). */
  edgeEnds (e) {
    const P = gameState.placed, a = posaBase(P[e.a]), b = posaBase(P[e.b]);
    if (!a || !b || a.id === b.id) return null;
    const at = c => {
      if (c.gx != null) return compCenter(c);
      const v = this.compVisuals[c.id];
      return v ? worldToFloor(v.container.x, v.container.y) : null;
    };
    const A = at(a), B = at(b);
    return A && B ? { A, B, key: posaBaseKey(a) + '|' + posaBaseKey(b) } : null;
  }

  edgeFloor (e) {
    const ends = this.edgeEnds(e);
    if (!ends) return null;
    let route;
    if (this.lay && this.lay.id === e.id) route = this.lay.route;
    else if (e.route && e.route.key === ends.key) route = e.route.bends ? { bends: e.route.bends.map(b => b.slice()) } : layFromRails(e.route, ends.A, ends.B);
    else route = layAutoRoute(ends.A, ends.B);
    const pts = layCorners(route, ends.A, ends.B);
    return { ...ends, route, pts, smooth: laySmooth(pts) };
  }

  // pixel di schermo per unità di mondo (per tenere i pallini grandi come un dito)
  screenScale () {
    const rc = this.game.canvas.getBoundingClientRect();
    return this.cameras.main.zoom * (rc.width / GAME_W);
  }

  startLay (edgeId) {
    const e = gameState.edges.find(x => x.id === edgeId);
    const f = e && this.edgeFloor(e);
    if (!f) return false;
    this.endLay(true);
    this.clearMoveSelection();
    this.exitAssembly();
    this.cancelPending();
    this.selectedEdgeId = null;
    if (this.edgeDeleteBtn) { this.edgeDeleteBtn.destroy(); this.edgeDeleteBtn = null; }
    this.lay = { id: edgeId, route: { bends: f.route.bends.map(b => b.slice()) }, start: JSON.stringify(f.route.bends), drag: null, cam: null };
    // sul telefono la scena è piccola: ci si avvicina al cavo, poi si torna
    if (this.screenScale() < CROWD_SCALE) {
      const sp = layToScreen(f.smooth);
      const xs = sp.map(p => p.x), ys = sp.map(p => p.y);
      const bw = Math.max(80, Math.max(...xs) - Math.min(...xs)), bh = Math.max(60, Math.max(...ys) - Math.min(...ys));
      const cam = this.cameras.main;
      const z = Math.min(2.2, GAME_W * 0.65 / bw, GAME_H * 0.5 / bh);
      if (z > cam.zoom * 1.1) {
        this.lay.cam = { zoom: cam.zoom, x: cam.midPoint.x, y: cam.midPoint.y };
        this.camGlide(z, (Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2 + GAME_H * 0.06 / z);
      }
    }
    el('#lay-bar').classList.add('show');
    this.redrawEdges();
    return true;
  }

  // la vista scivola a uno zoom e a un centro (in coordinate del mondo)
  camGlide (z, x, y) {
    const cam = this.cameras.main, z0 = cam.zoom, x0 = cam.midPoint.x, y0 = cam.midPoint.y;
    if (this.camTween) this.camTween.stop();
    this.camTween = this.tweens.addCounter({
      from: 0, to: 1, duration: 250, ease: 'Sine.easeOut',
      onUpdate: tw => { const t = tw.getValue(); cam.setZoom(z0 + (z - z0) * t); cam.centerOn(x0 + (x - x0) * t, y0 + (y - y0) * t); }
    });
  }

  // save: il percorso resta sul cavo; altrimenti si lascia com'era
  endLay (save) {
    const L = this.lay;
    if (!L) return;
    if (L.drag && L.drag.timer) clearTimeout(L.drag.timer);
    this.lay = null;
    el('#lay-bar').classList.remove('show');
    if (this.layGraphics) this.layGraphics.clear();
    const e = gameState.edges.find(x => x.id === L.id);
    const ends = e && this.edgeEnds(e);
    // si salva solo un percorso cambiato (con il suo passo di Annulla)
    if (save && e && ends && JSON.stringify(L.route.bends) !== L.start) {
      e.route = { bends: L.route.bends.map(b => b.slice()), key: ends.key };
      SFX.place();
      this.pushHistory();
    }
    if (L.cam) {
      this.camGlide(L.cam.zoom, L.cam.x, L.cam.y);
    }
    this.redrawEdges();
  }

  // dove stanno i pallini (le pieghe) sullo schermo
  layHandles (f) {
    return f.route.bends.map(([gx, gy]) => layToScreen([{ gx, gy }, { gx, gy }])[0]);
  }

  // un tocco su un pallino lo prende; tenuto fermo un attimo diventa rosso
  // e, lasciato lì, la piega si toglie (se il dito si muove, si trascina)
  layPointerDown (pointer) {
    const L = this.lay;
    if (!L || (pointer.downElement && pointer.downElement !== this.game.canvas)) return false;
    const e = gameState.edges.find(x => x.id === L.id);
    const f = e && this.edgeFloor(e);
    if (!f) return false;
    const tol = 30 / this.screenScale();
    let best = -1, bestD = tol;
    this.layHandles(f).forEach((h, i) => {
      const d = Math.hypot(pointer.worldX - h.x, pointer.worldY - h.y);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best < 0) return false;
    const drag = L.drag = { k: best, x: pointer.x, y: pointer.y, moved: false, armed: false, timer: null };
    drag.timer = setTimeout(() => {
      if (this.lay !== L || L.drag !== drag || drag.moved) return;
      drag.armed = true;
      if (navigator.vibrate) navigator.vibrate(30);
      this.redrawEdges();
    }, LAY_REMOVE_MS);
    if (navigator.vibrate) navigator.vibrate(10);
    this.redrawEdges();
    return true;
  }

  layDragMove (pointer) {
    const L = this.lay, e = gameState.edges.find(x => x.id === L.id);
    const ends = e && this.edgeEnds(e);
    if (!ends) return;
    const d = L.drag;
    if (!d.moved) {
      if (Math.hypot(pointer.x - d.x, pointer.y - d.y) < 8) return;
      d.moved = true; d.armed = false;
      if (d.timer) { clearTimeout(d.timer); d.timer = null; }
    }
    const m = worldToFloor(pointer.worldX, pointer.worldY);
    const pts = layCorners(L.route, ends.A, ends.B), prev = pts[d.k], next = pts[d.k + 2];
    let gx = laySnap(m.gx), gy = laySnap(m.gy);
    // in riga con la piega o il capo accanto: tratti dritti, paralleli ai muri
    [prev, next].forEach(q => {
      if (Math.abs(m.gx - q.gx) < CELL * 0.8) gx = q.gx;
      if (Math.abs(m.gy - q.gy) < CELL * 0.8) gy = q.gy;
    });
    gx = Math.min(VENUE_W - CELL / 2, Math.max(CELL / 2, gx));
    gy = Math.min(VENUE_H - CELL / 2, Math.max(CELL / 2, gy));
    const cur = L.route.bends[d.k];
    if (Math.abs(cur[0] - gx) < 1e-6 && Math.abs(cur[1] - gy) < 1e-6) return;
    const bends = L.route.bends.map(b => b.slice());
    bends[d.k] = [gx, gy];
    const max = layMaxLen(e);
    const len = layLength(laySmooth(layCorners({ bends }, ends.A, ends.B))), was = layLength(laySmooth(pts));
    if (max && len > max + 1e-6 && len > was) {
      // il cavo è teso: non si allunga oltre la sua misura
      if (!L.taut) { L.taut = true; this.updateLayBar(e, was, max); if (navigator.vibrate) navigator.vibrate([15, 40, 15]); }
      return;
    }
    L.taut = false;
    L.route.bends = bends;
    this.redrawEdges();
  }

  layDragEnd () {
    const L = this.lay, e = gameState.edges.find(x => x.id === L.id);
    const ends = e && this.edgeEnds(e);
    const d = L.drag;
    if (d && d.timer) clearTimeout(d.timer);
    L.drag = null; L.taut = false;
    // pallino tenuto premuto e lasciato lì: la piega si toglie
    if (d && d.armed && !d.moved) { L.route.bends.splice(d.k, 1); SFX.cableOut('xlr'); }
    // una piega messa in riga con le vicine non serve più: sparisce
    if (ends) L.route.bends = layClean(L.route.bends, ends.A, ends.B);
    this.redrawEdges();
  }

  // + Piega: una piega nuova a metà del tratto più lungo
  layAddBend () {
    const L = this.lay, e = L && gameState.edges.find(x => x.id === L.id);
    const ends = e && this.edgeEnds(e);
    if (!ends) return;
    if (L.route.bends.length >= LAY_MAX_BENDS) { showToast('Bastano ' + LAY_MAX_BENDS + ' pieghe: spostale, o tienine premuta una per toglierla.'); return; }
    const pts = layCorners(L.route, ends.A, ends.B);
    let k = 0, best = -1;
    for (let i = 0; i < pts.length - 1; i++) {
      const l = Math.hypot(pts[i + 1].gx - pts[i].gx, pts[i + 1].gy - pts[i].gy);
      if (l > best) { best = l; k = i; }
    }
    const a = pts[k], b = pts[k + 1];
    L.route.bends.splice(k, 0, [laySnap((a.gx + b.gx) / 2), laySnap((a.gy + b.gy) / 2)]);
    this.redrawEdges();
  }

  layReset () {
    const L = this.lay, e = L && gameState.edges.find(x => x.id === L.id);
    const ends = e && this.edgeEnds(e);
    if (!ends) return;
    L.route = layAutoRoute(ends.A, ends.B);
    this.redrawEdges();
  }

  updateLayBar (e, len, max) {
    const name = (cableItem(e.signal) || {}).name || cableName(e.signal);
    const over = max && len > max + 1e-6;
    el('#lay-text').innerHTML = `<b>${escapeHtml(name)}</b> · <span class="${over || this.lay.taut ? 'lay-over' : ''}">${fmtM(len)}${max ? ' / ' + max + ' m' : ''}</span>`
      + (this.layIssue && !this.lay.taut ? `<small class="lay-over">${escapeHtml(this.layIssue.text)}</small>`
        : `<small>${this.lay.taut ? 'Il cavo è teso: non arriva più in là.' : over ? 'Troppo corto: cerca una strada più breve.'
          : this.lay.drag && this.lay.drag.armed ? 'Lascia il dito: la piega si toglie (oppure trascinala).'
          : this.lay.route.bends.length ? 'Trascina un pallino per piegare il cavo; tienilo premuto e lascia per toglierlo.' : 'Il cavo va dritto: con «+ Piega» lo pieghi dove vuoi.'}</small>`);
  }

  /* via di fuga e passaggi sul pavimento (le regole di Gerry), e i punti
     dei cavi che Gerry boccerebbe: quelli del cavo in mano mentre lo si
     stende, tutti dopo un giro di Gerry finché non apre le porte */
  drawGerryFloor () {
    if (!this.gerryGraphics) {
      this.gerryGraphics = this.add.graphics().setDepth(1.6);
      this.gerryMarkGraphics = this.add.graphics().setDepth(5.8);
      this.gerryLabels = {};
    }
    const g = this.gerryGraphics, mg = this.gerryMarkGraphics;
    g.clear(); mg.clear();
    const { passages, exits } = gerryZones();
    const quad = (x0, y0, x1, y1) => [gridToScreen(x0, y0), gridToScreen(x1, y0), gridToScreen(x1, y1), gridToScreen(x0, y1)];
    const fillQuad = (q, color, alpha) => { g.fillStyle(color, alpha); g.fillPoints(q, true); };
    const label = (id, text, q, color) => {
      let t = this.gerryLabels[id];
      if (!t) t = this.gerryLabels[id] = this.add.text(0, 0, text, { fontFamily: 'Inter, sans-serif', fontSize: '10px', fontStyle: 'bold', color }).setOrigin(0.5).setDepth(1.7);
      t.setPosition((q[0].x + q[2].x) / 2, (q[0].y + q[2].y) / 2).setVisible(true);
    };
    Object.values(this.gerryLabels).forEach(t => t.setVisible(false));
    exits.forEach(z => {
      const [i, j, w, h] = z.r, q = quad(i * CELL, j * CELL, (i + w) * CELL, (j + h) * CELL);
      fillQuad(q, 0xe0503f, 0.22);
      // strisce rosse in diagonale, come il nastro a terra
      for (let k = 0; k < w + h; k++) {
        const a = gridToScreen(Math.min(i + k, i + w) * CELL, (j + Math.max(0, k - w)) * CELL);
        const b = gridToScreen(Math.max(i, i + k - h) * CELL, (j + Math.min(k, h)) * CELL);
        g.lineStyle(2, 0xe0503f, 0.7); g.lineBetween(a.x, a.y, b.x, b.y);
      }
      g.lineStyle(2, 0xe0503f, 0.9); g.strokePoints(q, true);
      label(z.id, 'VIA DI FUGA', q, '#ff8b7d');
    });
    passages.forEach(z => {
      const [i, j, w, h] = z.r;
      // strisce pedonali: si attraversa dritti (lungo gx)
      for (let k = 0; k < h; k++) if (k % 2 === 0) fillQuad(quad(i * CELL, (j + k) * CELL, (i + w) * CELL, (j + k + 1) * CELL), 0xf2c53d, 0.2);
      const q = quad(i * CELL, j * CELL, (i + w) * CELL, (j + h) * CELL);
      g.lineStyle(1.5, 0xf2c53d, 0.6); g.strokePoints(q, true);
      label(z.id, 'PASSAGGIO', q, '#f2c53d');
    });
    // i punti da sistemare
    let issues = [];
    if (this.gerryMarks || this.lay) {
      issues = gerryIssues();
      if (!this.gerryMarks) issues = issues.filter(x => x.ids.includes(this.lay.id));
    }
    issues.forEach(is => is.cells.forEach(c => {
      const q = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([di, dj]) => {
        const x = (c.i + di) * CELL, y = (c.j + dj) * CELL, p = gridToScreen(x, y);
        return isStageCell(c.i * CELL, c.j * CELL) ? { x: p.x, y: p.y - PLATFORM_HEIGHT } : p;
      });
      mg.fillStyle(0xe0503f, 0.35); mg.fillPoints(q, true);
      mg.lineStyle(1.5, 0xe0503f, 0.95); mg.strokePoints(q, true);
    }));
    this.layIssue = this.lay ? (issues.find(x => x.ids.includes(this.lay.id)) || null) : null;
  }

  // pallini sui tratti del cavo in mano e il cavo che avanza, arrotolato
  drawLay () {
    if (!this.layGraphics) this.layGraphics = this.add.graphics().setDepth(7);
    const g = this.layGraphics;
    g.clear();
    const L = this.lay, e = L && gameState.edges.find(x => x.id === L.id);
    const f = e && this.edgeFloor(e);
    if (!f) return;
    const k = this.screenScale(), r = 12 / k;
    const max = layMaxLen(e), len = layLength(f.smooth);
    // un pallino per piega: si trascina (o si tiene premuto per toglierla)
    this.layHandles(f).forEach((h, i) => {
      const on = L.drag && L.drag.k === i, armed = on && L.drag.armed;
      const col = armed ? 0xe0503f : 0xf2a541;
      g.fillStyle(on ? col : 0x1c1d22, 1);
      g.lineStyle(2.5 / k, col, 1);
      g.fillCircle(h.x, h.y, on ? r * 1.3 : r);
      g.strokeCircle(h.x, h.y, on ? r * 1.3 : r);
      if (armed) {
        // ✕: lasciandolo qui la piega si toglie
        g.lineStyle(3 / k, 0xffffff, 1);
        g.lineBetween(h.x - r * 0.5, h.y - r * 0.5, h.x + r * 0.5, h.y + r * 0.5);
        g.lineBetween(h.x - r * 0.5, h.y + r * 0.5, h.x + r * 0.5, h.y - r * 0.5);
      } else {
        g.fillStyle(on ? 0x1c1d22 : 0xf2a541, 1);
        g.fillCircle(h.x, h.y, r * 0.32);
      }
    });
    // quello che avanza si arrotola a otto accanto al pezzo di arrivo
    if (max && max - len >= 1) {
      const B = layToScreen([f.B, f.B])[0], s = Math.min(1.6, 0.6 + (max - len) / 10);
      g.lineStyle(2, 0x17181b, 1);
      g.strokeEllipse(B.x + 14 * s, B.y + 6, 12 * s, 7 * s);
      g.strokeEllipse(B.x + 24 * s, B.y + 6, 12 * s, 7 * s);
      g.lineStyle(1, CABLE_TYPES[e.signal].color, 1);
      g.strokeEllipse(B.x + 14 * s, B.y + 6, 12 * s, 7 * s);
      g.strokeEllipse(B.x + 24 * s, B.y + 6, 12 * s, 7 * s);
    }
    this.updateLayBar(e, len, max);
  }

  // Togli: il cavo in mano torna nel baule
  layDelete () {
    const L = this.lay;
    if (!L) return;
    this.endLay(false);
    this.selectedEdgeId = L.id;
    this.deleteSelectedEdge();
  }

  // un tocco su un dispositivo mentre si stende un cavo: non succede niente
  layLocked () {
    showToast('Stai sistemando un cavo: tocca Fatto (o il pavimento) prima di passare ad altro.');
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
  /* dove può finire l'altro capo del cavo in mano: i dispositivi con una
     presa libera adatta (il segnale giusto, la direzione opposta) */
  compatibleTargets () {
    const pend = gameState.pendingPort, cable = CABLE_TYPES[gameState.selectedCable];
    const pdef = pend && getPortDef(pend.componentId, pend.portId);
    if (!pdef || !cable) return [];
    // un adattatore collega due connettori diversi
    const want = cable.endpoints.length === 2 ? cable.endpoints.filter(x => x !== pdef.signal) : cable.endpoints;
    return Object.keys(gameState.placed).filter(id => id !== pend.componentId &&
      COMPONENT_TYPES[gameState.placed[id].type].ports.some(pt => want.includes(pt.signal) && pt.dir !== pdef.dir &&
        (pt.multi || !portHasConnection(id, pt.id))));
  }
  highlightTargets () {
    const pend = gameState.pendingPort;
    (this.targetIds || []).forEach(id => {
      const v = this.compVisuals[id];
      if (v && !(pend && id === pend.componentId) && id !== this.assemblyId) this.setGlow(v, false);
    });
    this.targetIds = this.compatibleTargets();
    this.targetIds.forEach(id => { const v = this.compVisuals[id]; if (v) this.setGlow(v, true, 0x49b06a); });
  }

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
      const cy = c.y + (v.def.body.oy || 0) * Math.abs(c.scaleY);
      const dx = Math.max(0, Math.abs(wx - c.x) - hw), dy = Math.max(0, Math.abs(wy - cy) - hh);
      const edge = Math.hypot(dx, dy) * k;
      if (edge <= slopPx) out.push({ id, edge, center: Math.hypot(wx - c.x, wy - cy) * k });
    });
    // il tavolo è grande e sta sotto la regia: se il tocco prende anche un
    // apparecchio, vince l'apparecchio
    const devs = out.filter(x => gameState.placed[x.id].type !== 'tavolo');
    return (devs.length ? devs : out).sort((x, y) => x.edge - y.edge || x.center - y.center);
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
    this.zoomToCrowd(wx, wy);
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
      setTimeout(() => { if (!sceneCovered()) setSceneInput(true); }, 0);
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
    if (this.lay && this.lay.drag) {
      // due dita: si zooma, il cavo resta dov'è
      const p2 = this.input.pointer2;
      if (p2 && p2.isDown) { this.layDragEnd(); return false; }
      if (pointer.isDown) this.layDragMove(pointer);
      return true;
    }
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
    if (this.lay && this.lay.drag) { this.layDragEnd(); return; }
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
    const hy = v.container.y + ((v.def.body.oy || 0) - v.def.body.h / 2) * v.container.scaleY - 11 * hs;
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
      ? 'Montaggio: tocca la ✕ per togliere ' + compLabel(id) + (mountBase(comp) ? ' da ' + compLabel(mountBase(comp).id) : '') + '. Tocca il pavimento per finire.'
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
    const base = mountBase(comp);
    mountedAll(comp).forEach(ch => ids.push(ch.id));                // col sub va via la testa, con lo stativo il PAR, col tavolo la regia
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
    // (il Quadro anche quando cambia muro: si riappoggia)
    if (def.front && (comp.type === 'quadro' || orientK(def, pos.x, pos.y) !== this.compVisuals[id].rot)) {
      this.compVisuals[id].container.destroy();
      this.compVisuals[id] = this.buildComponentVisual(id, def, pos.x, pos.y);
      if (comp.type === 'quadro') this.updateQuadroVisual();
    }

    mountedAll(comp).forEach(child => {
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
    });

    this.clearMoveSelection();
    this.redrawEdges();
    setCircuitStatus('untested');
    SFX.place();
    showToast('Dispositivo spostato.', 'ok');
    this.pushHistory();
  }

  /* ---------------- PROVA DEL GIRO: controlla solo quello che chiede il
     giro in corso (vedi GIRI) e fa vedere e sentire l'esito, come il Test
     impianto. Gli indizi crescono coi tentativi andati male nello stesso
     giro: prima vago, poi il pezzo colpevole in rosso, poi il capo dice
     esattamente cosa manca. ---------------- */
  runGiroTest () {
    this.stopFx();
    const giro = gameState.giro;
    const g = GIRI[giro];
    if (!g) return;
    Object.values(this.compVisuals).forEach(v => this.setGlow(v, false));
    this.refreshLive();
    const list = giroChecks(giro);
    const result = runValidation();
    const miss = list.find(x => !x.ok);
    gameState.stats.tests++;
    if (!miss && !result.overPhase && !result.overBudget) {
      gameState.giro++;
      gameState.giroFails[giro] = 0;
      SFX.success();
      const next = GIRI[gameState.giro];
      const msg = {
        corrente: 'Prova corrente superata: il Quadro è sotto tensione.',
        audio: 'Prova audio superata: la musica del PC esce dalle casse! Per le luci usa una fase libera del Quadro: cabla con quella fase spenta e armala alla fine.',
        luci: 'Prova luci superata: i PAR rispondono alla consolle.'
      }[g.id];
      const names = next ? next.tabs.map(t => t[0].toUpperCase() + t.slice(1)) : [];
      const opens = names.length > 1 ? 'si aprono le schede ' + names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1] : 'si apre la scheda ' + names[0];
      showToast(msg + (next ? ' Adesso il giro ' + next.title + ': ' + opens + '.'
        : ' Il montaggio è finito: fai il Test impianto, il collaudo di tutto insieme.'), 'ok');
      saveLevel();
      updateGiroUI();
      return;
    }
    gameState.stats.failedTests++;
    const n = ++gameState.giroFails[giro];
    const boss = bossName();
    let hint;
    if (result.overPhase) hint = 'una fase del Quadro è troppo carica.';
    else if (result.overBudget) hint = 'chiedi troppa potenza.';
    else hint = {
      place: 'manca ancora un pezzo da posare.',
      wire: g.id === 'corrente' ? 'il Quadro non riceve corrente dall\'allaccio.' : g.id === 'luci' ? 'qualche PAR non sente la consolle o non ha corrente.' : 'il segnale (o la corrente) si perde per strada.',
      arm: 'il Quadro è davvero armato?',
      on: 'qualcosa è ancora spento.',
      stereo: 'destra e sinistra si sono scambiate.',
      lights: (lightingCheck() || {}).msg || 'le luci non sono al loro posto.',
      dmx: 'due PAR si pestano i piedi sull\'indirizzo.',
      fault: 'un pezzo arrivato difettoso dallo scarico va ancora controllato: toccalo (ha il segno arancione).'
    }[miss.kind];
    // secondo tentativo: il pezzo colpevole in rosso; dal terzo parla il capo
    if (miss && n >= 2) miss.ids.forEach(id => { const v = this.compVisuals[id]; if (v) this.setGlow(v, true); });
    const exact = miss && n >= 3 ? ' ' + boss + ' ti indica il foglio: «' + miss.what + '».' : '';
    setCircuitStatus('error');
    saveLevel();
    if (g.id === 'corrente') { showToast('Niente corrente: ' + hint + exact, 'bad'); this.fxSparks(); }
    else if (g.id === 'audio') { showToast('Le casse restano mute: ' + hint + exact, 'bad'); this.fxCrackle(); }
    else { showToast('Le luci non rispondono: ' + hint + exact, 'bad'); this.fxLightsTilt(); }
  }

  /* ---------------- PRONTI: la prova del cambio palco per il DJ ----------------
     Come la prova di un giro: dice cosa manca con un indizio, al secondo
     tentativo accende in rosso il pezzo colpevole, dal terzo il capo legge
     la voce della carta. */
  runCambioTest () {
    this.stopFx();
    const c = cambioDj();
    if (!c || c.done) return;
    Object.values(this.compVisuals).forEach(v => this.setGlow(v, false));
    this.refreshLive();
    const miss = cambioChecks().find(x => !x.ok);
    gameState.stats.tests++;
    if (!miss) { finishCambioDj(); return; }
    gameState.stats.failedTests++;
    const n = c.fails = (c.fails || 0) + 1;
    Profile.save();
    const hint = {
      place: 'manca ancora un pezzo sul palco.',
      power: 'la consolle non ha corrente.',
      on: 'la consolle è spenta: accendila dal suo pannello.',
      wire: 'la sua musica non arriva al mixer: segui i cavi dalla consolle alla DI e dalla DI al mixer.',
      lpower: 'le sue luci sono spente: la barra non ha corrente.',
      ldmx: 'le sue luci non sentono la consolle luci: manca il DMX alla barra.',
      laddr: 'le sue luci impazziscono insieme ai PAR: sono sullo stesso universo e negli stessi canali.',
      mic: 'Musa Esistenziale non ha un microfono collegato al mixer.',
      rig: 'nel cambio si è perso qualcosa dell\'impianto' + (miss.lost ? ': ' + miss.lost + '.' : '.')
    }[miss.kind];
    if (n >= 2) miss.ids.forEach(id => { const v = this.compVisuals[id]; if (v) this.setGlow(v, true); });
    const exact = n >= 3 && miss.kind !== 'rig' ? ' ' + bossName() + ' ti indica il foglio: «' + miss.what + '».' : '';
    setCircuitStatus('error');
    saveLevel();
    showToast('DJ Inestimabile non può attaccare: ' + hint + exact, 'bad');
    if (miss.kind === 'wire' || miss.kind === 'mic') this.fxCrackle();
    else if (miss.kind === 'power' || miss.kind === 'lpower') this.fxSparks();
    else if (miss.kind === 'laddr') this.fxLightsTilt();
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
    /* indizi a scalare, come nelle prove dei giri: al primo test andato male
       solo l'indizio vago; dal secondo di fila il pezzo colpevole in rosso;
       dal terzo il capo legge la voce del foglio che manca. La voce è il
       primo collegamento che manca dell'impianto che ha fallito, se no la
       prima voce che non va nel suo giro (quadro armato, accesi, stereo…). */
    const fail = (kind, hint) => {
      gameState.stats.failedTests++;
      const n = gameState.giroFails[GIRO_COLLAUDO] = (gameState.giroFails[GIRO_COLLAUDO] || 0) + 1;
      const giro = { power: 0, audio: 1, lights: 2 }[kind];
      const miss = result.overPhase || result.overBudget ? null
        : buildExpectedConnections().find(x => !x.ok && x.cat === kind) || giroChecks(giro).find(x => !x.ok);
      saveLevel();
      setCircuitStatus('error');
      const exact = miss && n >= 3 ? ' ' + bossName() + ' ti indica il foglio: «' + miss.what + '».' : '';
      if (kind === 'power') { showToast((quadroLive() ? 'Scintille! ' : 'Tutto spento: ') + hint + exact, 'bad'); this.fxSparks(); }
      else if (kind === 'audio') { showToast('L\'impianto gracchia: ' + hint + exact, 'bad'); this.fxCrackle(); }
      else { showToast('Le luci vanno in tilt: ' + hint + exact, 'bad'); this.fxLightsTilt(); }
      // dopo gli effetti, così il rosso non viene spento da chi li ferma
      if (miss && n >= 2) miss.ids.forEach(id => { const v = this.compVisuals[id]; if (v) this.setGlow(v, true); });
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
    gameState.giroFails[GIRO_COLLAUDO] = 0;
    // la procedura conta: un solo suggerimento, il primo inciampo
    const pops = (gameState.procErrors || []).filter(x => x === 'pop').length;
    const tip = gameState.trips ? 'la prossima volta accendi i pesanti uno alla volta.'
      : gameState.rcdTrips ? 'la prossima volta cabla a impianto spento.'
      : pops ? 'la prossima volta accendi finali e sub per ultimi.'
      : null;
    // prossimo obiettivo: il microfono per il discorso del preside
    const ch = micChannel();
    const next = ch ? ' Microfono pronto sul CH ' + ch + ': il preside può salire sul palco.'
      : ' Prossimo: arriva il preside. Monta l\'asta sul palco, il microfono sulla giraffa e collegalo con un XLR a un ingresso MIC del mixer.';
    this.repGain = gameActive ? addRecord() : 0;
    this.caviAfterShow = gameActive && !caviDone();
    showToast('Impianto collaudato, si va in scena! ' + (tip ? 'Piccolo consiglio: ' + tip : 'Procedura perfetta.')
      + (this.repGain ? ' Reputazione +' + this.repGain + '.' : gameActive ? ' Fase già completata: la reputazione non cambia.' : '') + next, 'ok');
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
    this.updateSignalFlow();   // durante lo show o i guasti la musica di prova tace
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
    this.updateSignalFlow();
    this.drawLiveBeams();
  }
  fxDead () {
    this.fxStart();
    SFX.button();
    const q = findQuadro();
    const v = q && this.compVisuals[q.id];
    if (!v) { this.fxEvery(400, 1, () => {}, () => this.stopFx()); return; }
    this.fxHold(v);
    this.fxEvery(260, 6, i => this.setGlow(v, i % 2 === 0, 0x8a8e98), () => this.stopFx());
  }
  visualsOf (...types) {
    return Object.values(gameState.placed).filter(c => types.includes(c.type)).map(c => this.compVisuals[c.id]).filter(Boolean);
  }

  // corrente: raffica di scintille dal Quadro (o dall'allaccio, se manca).
  // Le scintille vogliono tensione: col Quadro senza corrente o non armato
  // non succede niente, resta tutto spento e il Quadro lampeggia grigio
  fxSparks () {
    if (!quadroLive()) { this.fxDead(); return; }
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
    // luci del DJ con corrente e DMX: i quattro PAR accesi coi loro colori
    // (la strobo resta ferma finché non la comanda l'operatore luci)
    placedOfType('djluci').filter(c => isRunning(c.id) && dmxUniverse(c.id) != null && this.compVisuals[c.id]).forEach(c => {
      const v = this.compVisuals[c.id].container;
      [0xff3fb4, 0x3b8bff, 0x3bffb0, 0xffb13b].forEach((col, i) => {
        const q = djLuciLens(DJLUCI_HEADS[i]);
        g.fillStyle(col, 0.25); g.fillCircle(v.x + q.x, v.y + q.y, 8);
        g.fillStyle(col, 0.7); g.fillCircle(v.x + q.x, v.y + q.y, 3.4);
      });
    });
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
  // posizione speculare: 0 per i PAR più esterni, poi verso il centro
  parMirrorIndex (geo) {
    const order = geo.map((b, i) => i).sort((i, j) => geo[i].x - geo[j].x);
    const m = [];
    order.forEach((gi, k) => { m[gi] = Math.min(k, order.length - 1 - k); });
    return m;
  }
  /* durante lo show la consolle comanda gli INDIRIZZI, non i singoli fari:
     i PAR con stesso universo, indirizzo e modalità ricevono gli stessi
     canali, quindi fanno per forza la stessa cosa (colore e accensione).
     Restituisce per ogni PAR il numero del suo gruppo, numerando i gruppi
     dall'esterno verso il centro (e da sinistra a parità). */
  parDmxGroups (geo) {
    const mirror = this.parMirrorIndex(geo);
    const byKey = new Map();
    geo.forEach((b, i) => {
      const d = parDmx(b.c);
      const key = dmxUniverse(b.c.id) + ':' + d.addr + ':' + d.mode;
      if (!byKey.has(key)) byKey.set(key, { rank: mirror[i], x: b.x, members: [] });
      const g = byKey.get(key);
      g.rank = Math.min(g.rank, mirror[i]); g.x = Math.min(g.x, b.x);
      g.members.push(i);
    });
    const groups = [...byKey.values()].sort((a, b) => a.rank - b.rank || a.x - b.x);
    const idx = [];
    groups.forEach((g, n) => g.members.forEach(i => { idx[i] = n; }));
    return { idx, count: groups.length };
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

  /* ---------------- segni di nastro sul pavimento (livello 1) ----------------
     Il capo ha già fatto la pianta: croci di nastro fluo dove vanno i pezzi
     e gli angoli del tavolo regia. Stanno sotto i pezzi; si tolgono dalle
     impostazioni. */
  drawTapeMarks () {
    (this.tapeObjs || []).forEach(o => o.destroy());
    this.tapeObjs = [];
    if (!TAPE_LEVELS.has(LEVEL_ID) || settings().tapeMarks === false) return;
    const g = this.add.graphics().setDepth(3.5);
    this.tapeObjs.push(g);
    // striscia di nastro da (x0, y0) a (x1, y1) in metri, larga w
    const strip = (x0, y0, x1, y1, w, color) => {
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = -dy / l * w / 2, ny = dx / l * w / 2;
      g.fillStyle(color, 0.85);
      g.fillPoints([gridToScreen(x0 + nx, y0 + ny), gridToScreen(x1 + nx, y1 + ny), gridToScreen(x1 - nx, y1 - ny), gridToScreen(x0 - nx, y0 - ny)], true);
    };
    const label = (gx, gy, text, color) => {
      const p = gridToScreen(gx, gy);
      const t = this.add.text(p.x, p.y, text, { fontFamily: FONT_MARKER, fontSize: '12px', color: '#141414', backgroundColor: color, padding: { x: 5, y: 0 } }).setOrigin(0.5).setDepth(3.6).setAlpha(0.88).setAngle(-4);
      this.tapeObjs.push(t);
    };
    TAPE_MARKS.forEach(m => {
      const color = Phaser.Display.Color.HexStringToColor(m.color).color;
      if (m.w) {
        // angoli a L di un ingombro (tavolo regia)
        const x0 = m.gx, y0 = m.gy, x1 = m.gx + m.w, y1 = m.gy + m.h, L = 0.3, W = 0.06;
        [[x0, y0, 1, 1], [x1, y0, -1, 1], [x1, y1, -1, -1], [x0, y1, 1, -1]].forEach(([x, y, sx, sy]) => {
          strip(x, y, x + sx * L, y, W, color);
          strip(x, y, x, y + sy * L, W, color);
        });
        label(m.gx + m.w + 0.25, m.gy + m.h / 2, m.text, m.color);
      } else {
        const r = 0.22;
        strip(m.gx - r, m.gy - r, m.gx + r, m.gy + r, 0.08, color);
        strip(m.gx - r, m.gy + r, m.gx + r, m.gy - r, 0.08, color);
        label(m.gx + 0.05, m.gy + 0.5, m.text, m.color);
      }
    });
  }

  /* ---------------- musica di prova: fin dove arriva il segnale ----------------
     Sugli apparecchi raggiunti sale una nota; le casse pulsano a tempo e,
     appena ne suona una, parte piano la musica di prova (si spegne dalle
     impostazioni). Durante gli effetti del Test impianto tace. */
  updateSignalFlow () {
    const reach = this.fx ? new Set() : musicReach();
    this.signalFx = this.signalFx || {};
    const still = reducedFx();
    Object.keys(this.signalFx).forEach(id => {
      const f = this.signalFx[id], v = this.compVisuals[id];
      if (reach.has(id) && v && v.container === f.container) return;
      if (f.tween) f.tween.stop();
      if (f.pump) f.pump.stop();
      if (f.note && f.note.scene) f.note.destroy();
      if (f.container.scene && f.speaker) f.container.setScale(1);
      delete this.signalFx[id];
    });
    reach.forEach(id => {
      const v = this.compVisuals[id];
      if (!v || this.signalFx[id]) return;
      const type = gameState.placed[id].type;
      const f = { container: v.container, speaker: type === 'sub' || type === 'top' };
      if (f.speaker) {
        if (!still) f.pump = this.tweens.add({ targets: v.container, scaleX: 1.035, scaleY: 1.035, duration: 60000 / 124 / 2, yoyo: true, repeat: -1, ease: 'Sine.easeOut' });
      }
      {
        // una croma disegnata (testa, gambo e bandierina: nessun font da cui
        // dipendere), sopra tutta la scena così non la copre il vicino; la
        // posizione segue il dispositivo a ogni fotogramma (vedi update)
        f.dx = v.def.body.w / 2 - 6;
        f.dy = (v.def.body.oy || 0) - v.def.body.h / 2 - 4;
        if (type === 'ampli') f.dy -= 30;   // il rack sta sotto il tavolo: la nota esce dal piano
        f.note = this.add.graphics().setDepth(50).setScale(1.5);
        f.note.fillStyle(0x0c0d10, 0.65); f.note.fillCircle(0, 1, 9);
        f.note.fillStyle(0x7fe0a0, 1);
        f.note.fillEllipse(-1.5, 4, 7, 5); f.note.fillRect(1.2, -7, 1.8, 11);
        f.note.fillTriangle(3, -7, 7.5, -3, 3, -2.5);
        f.anim = { t: 0 };
        if (!still) f.tween = this.tweens.add({ targets: f.anim, t: 1, duration: 60000 / 124 * 2, repeat: -1 });
        this.placeSignalNote(f);
      }
      this.signalFx[id] = f;
    });
    const speakers = [...reach].some(id => this.signalFx[id] && this.signalFx[id].speaker);
    SFX.testLoop(gameActive && speakers && settings().testMusic !== false);
  }

  // segui il segnale: la catena in verde, il primo anello rotto in rosso
  showTrace (compId) {
    const tr = traceChain(compId);
    if (!tr) return;
    this.clearTrace();
    const broken = tr.steps.find(x => !x.ok);
    this.traceIds = tr.steps.flatMap(x => x.ids);
    tr.steps.forEach(x => x.ids.forEach(id => { const v = this.compVisuals[id]; if (v) this.setGlow(v, true, x.ok ? 0x49b06a : 0xe0503f); }));
    const text = tr.steps.map(x => x.label + (x.ok ? ' ✓' : ' ✗ ' + x.why)).join('  →  ');
    showToast(tr.title + ': ' + text + (broken ? '' : '  —  tutto a posto.'), broken ? 'bad' : 'ok');
    this.traceTimer = this.time.delayedCall(Math.max(4000, text.length * 60), () => this.clearTrace());
  }
  clearTrace () {
    if (this.traceTimer) { this.traceTimer.remove(false); this.traceTimer = null; }
    (this.traceIds || []).forEach(id => { const v = this.compVisuals[id]; if (v && id !== this.assemblyId) this.setGlow(v, false); });
    this.traceIds = [];
  }

  placeSignalNote (f) {
    const c = f.container;
    f.note.setPosition(c.x + f.dx, c.y + f.dy - 16 * f.anim.t).setAlpha(1 - 0.85 * f.anim.t).setVisible(c.visible);
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
    updateFoglio();
    this.updateSignalFlow();
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
    // gli oggetti fissi sullo schermo (scrollFactor 0) risentono comunque dello
    // zoom della telecamera: il contenitore lo compensa, così scritta e
    // marchio stanno sempre per intero nello schermo, qualunque sia lo zoom
    const cam = this.cameras.main;
    const box = this.fxObj(this.add.container(GAME_W / 2, GAME_H / 2).setDepth(100).setScrollFactor(0).setScale(1 / cam.zoom));
    const W = GAME_W - 120;
    const title = this.add.text(0, brand ? -150 : 0, 'IMPIANTO COLLAUDATO' + (brand ? '' : '\n' + serviceName().toUpperCase()), {
      fontFamily: 'Barlow Condensed, sans-serif', fontSize: '64px', fontStyle: 'bold',
      color: '#f2a541', align: 'center', lineSpacing: 2, wordWrap: { width: W },
      stroke: '#141519', strokeThickness: 8
    }).setOrigin(0.5).setAlpha(0).setScale(0.85);
    box.add(title);
    const pop = [title];
    let img = null, bottom = 40;
    if (brand) {
      // il marchio del service entra in grande, con un lampo di luce
      img = this.add.image(0, 10, this.brandKey).setAlpha(0);
      const fit = Math.min(1, W / img.width);
      img.setScale(fit * 0.6);
      box.add(img);
      // la scritta sopra il marchio, la reputazione sotto: senza sovrapporsi
      const half = img.height * fit / 2;
      title.setY(10 - half - 50); bottom = 10 + half;
      this.fxTween({ targets: img, alpha: 1, scale: fit, duration: 520, ease: 'Back.Out' });
      if (!reducedFx()) {
        const flash = this.add.rectangle(0, 10, img.width * fit, img.height * fit, 0xffffff, 0).setBlendMode(Phaser.BlendModes.ADD);
        box.add(flash);
        this.fxTween({ targets: flash, fillAlpha: { from: 0.55, to: 0 }, delay: 300, duration: 450 });
      }
    }
    if (this.repGain) {
      const rep = this.add.text(0, bottom + 45, '+' + this.repGain + ' REPUTAZIONE', {
        fontFamily: 'Barlow Condensed, sans-serif', fontSize: '48px', fontStyle: 'bold', color: '#49b06a',
        stroke: '#141519', strokeThickness: 6
      }).setOrigin(0.5).setAlpha(0);
      box.add(rep); pop.push(rep);
    }
    this.fxTween({ targets: pop, alpha: 1, scale: 1, duration: 380, ease: 'Back.Out' });
    this.fxTween({ targets: box, alpha: 0, delay: 2200, duration: 400 });
    // se intanto la telecamera torna indietro, la scritta resta della stessa misura
    this.fxEvery(33, 85, () => box.setScale(1 / cam.zoom));
  }

  // zoom dello show: palco e Pit riempiono la larghezza dello schermo
  playSuccessSequence () {
    this.fxStart();
    SFX.success();
    holdToast();
    this.fx.restore.push(() => releaseToast());
    // show saltato dalle impostazioni: solo la scritta
    if (settings().skipShow) {
      this.showBanner();
      this.fxLater(2600, () => { this.stopFx(); this.afterShow(); });
      return;
    }
    const BPM = 120, BEATS = 14, BEAT_MS = 60000 / BPM;
    const T_LIGHTS = 1300, T_BEAT = 2300, T_END = T_BEAT + BEATS * BEAT_MS, T_DAY = T_END + 250;

    // la telecamera va sul palco per lo show e poi torna dov'era
    const cam = this.cameras.main;
    const view = { x: cam.midPoint.x, y: cam.midPoint.y, z: cam.zoom };
    const stage = gridToScreen(STAGE_ORIGIN_X + STAGE_W / 2, STAGE_ORIGIN_Y + STAGE_H / 2 + 1);
    cam.pan(stage.x, stage.y, 1200, 'Sine.easeInOut');
    cam.zoomTo(Math.max(view.z, SHOW_ZOOM), 1200, 'Sine.easeInOut');
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
    // un colore diverso per ogni gruppo DMX (fino a 4 gruppi, poi si ripete)
    const PALETTE = [
      [0xff3b6b, 0x3b8bff, 0xffb13b, 0x3bffb0], [0xffb13b, 0xff3bd1, 0x3bfff2, 0xffffff],
      [0x3bffb0, 0x3b8bff, 0xff3b6b, 0xffe13b], [0xffffff, 0xffb13b, 0xb03bff, 0x3bffb0],
      [0xb03bff, 0x3bfff2, 0xffb13b, 0xff3b6b]
    ];
    const pars = this.parBeamGeometry(placedOfType('par').filter(c => isRunning(c.id) && this.compVisuals[c.id]));
    // stesso indirizzo = stesso comando: colore e accensione vanno per gruppo
    const group = this.parDmxGroups(pars).idx;
    pars.forEach(b => { b.k = 0; });
    const speakers = this.visualsOf('sub', 'top').map(v => ({ v, s: this.fxHold(v) }));
    const st = { kick: 0, beat: 0, flash: 0 };

    // i PAR si accendono un gruppo DMX alla volta, dall'esterno verso il centro
    pars.forEach((b, i) => this.fxTween({ targets: b, k: 1, delay: T_LIGHTS + group[i] * 350, duration: 300 }));
    this.fxTween({ targets: pars, k: 0, delay: T_END, duration: 600 });

    // disegno a ~30 fps: i fasci non si muovono, pulsano col beat e
    // cambiano colore ogni due battute
    this.fxEvery(33, Math.ceil((T_DAY + 1300) / 33), () => {
      st.kick *= 0.86; st.flash *= 0.8;
      beams.clear();
      const colors = PALETTE[Math.floor(st.beat / 2) % PALETTE.length];
      const pulse = 0.55 + 0.45 * st.kick;
      pars.forEach((b, i) => {
        const col = st.flash > 0.3 ? 0xffffff : colors[group[i] % colors.length];
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
    this.fxLater(T_DAY + 1300, () => { this.stopFx(); this.afterShow(); });
  }
  // finito lo show del primo collaudo si stendono i cavi (se lo show si
  // interrompe, la posa resta in scaletta)
  afterShow () {
    if (!this.caviAfterShow) return;
    this.caviAfterShow = false;
    if (!caviDone() && !menuOpen) openCavi();
  }

  /* ---------------- reset ---------------- */
  resetLevel (quiet) {
    // giro e conti di prima: un Annulla subito dopo il reset li rimette
    const before = { giro: gameState.giro || 0, giroFails: (gameState.giroFails || [0, 0, 0]).slice(), stats: { ...freshStats(), ...gameState.stats }, trips: gameState.trips || 0, rcdTrips: gameState.rcdTrips || 0, procErrors: (gameState.procErrors || []).slice() };
    this.stopFx();
    this.clearEdgeSelection();
    this.clearMoveSelection();
    this.cancelPending();
    disarmPiece();

    Object.values(this.compVisuals).forEach(v => v.container.destroy());
    this.compVisuals = {};
    this.occupied = {}; this.blockSceneryCells();
    this.edgeGraphics.clear();

    gameState.placed = {};
    gameState.stock = levelStock();   // senza i pezzi rotti allo scarico
    // un contatore per ogni pezzo della dotazione (anche quelli aggiunti poi: asta, mic…)
    gameState.nextIndex = Object.fromEntries(Object.keys(AVAILABLE_STOCK).map(t => [t, 1]));
    gameState.edges = [];
    gameState.edgeSeq = 0;
    gameState.selectedCable = null;
    gameState.pendingPort = null;
    closeRearPanel();
    gameState.trips = 0; gameState.rcdTrips = 0; gameState.procErrors = []; gameState.inrush = [];
    gameState.stats = freshStats();
    gameState.giro = 0; gameState.giroFails = [0, 0, 0];
    updateGiroUI();

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
    this.history[this.historyIndex].resetFrom = before;
  }
  // giro e conti che un reset azzera: tornano con l'Annulla, si riazzerano col Ripeti
  applyResetCounters (c) {
    gameState.giro = c.giro; gameState.giroFails = c.giroFails.slice();
    gameState.stats = { ...c.stats };
    gameState.trips = c.trips; gameState.rcdTrips = c.rcdTrips; gameState.procErrors = c.procErrors.slice();
    updateGiroUI();
    saveLevel();
  }

  /* ---------------- cronologia: indietro/avanti tramite snapshot dello stato ----------------
     Approccio a "fotografia" dell'intero stato (più semplice e affidabile che tracciare
     l'azione inversa per ogni tipo di operazione): ogni azione di gioco salva un clone dei
     dati; indietro/avanti ricostruiscono la scena da zero a partire dal clone. */
  pushHistory () {
    this.history = (this.history || []).slice(0, this.historyIndex + 1);
    this.history.push({
      placed: JSON.parse(JSON.stringify(gameState.placed)),
      edges: JSON.parse(JSON.stringify(gameState.edges.map(edgeData))),
      stock: { ...gameState.stock },
      nextIndex: { ...gameState.nextIndex },
      edgeSeq: gameState.edgeSeq
    });
    // gli ultimi HISTORY_MAX passi bastano: la memoria non cresce per tutta la partita
    if (this.history.length > HISTORY_MAX) this.history.splice(0, this.history.length - HISTORY_MAX);
    this.historyIndex = this.history.length - 1;
    this.updateHistoryButtons();
    saveLevel();
  }

  undo () {
    if (this.historyIndex <= 0) return;
    const from = this.history[this.historyIndex];
    this.historyIndex--;
    this.restoreSnapshot(this.history[this.historyIndex]);
    if (from.resetFrom) this.applyResetCounters(from.resetFrom);
  }

  redo () {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    const to = this.history[this.historyIndex];
    this.restoreSnapshot(to);
    if (to.resetFrom) this.applyResetCounters({ giro: 0, giroFails: [0, 0, 0], stats: freshStats(), trips: 0, rcdTrips: 0, procErrors: [] });
  }

  restoreSnapshot (snap) {
    if (this.lay) { this.lay = null; el('#lay-bar').classList.remove('show'); }
    this.stopFx();
    this.clearEdgeSelection();
    this.clearMoveSelection();
    this.cancelPending();

    Object.values(this.compVisuals).forEach(v => v.container.destroy());
    this.compVisuals = {};
    this.occupied = {}; this.blockSceneryCells();

    gameState.placed = JSON.parse(JSON.stringify(snap.placed));
    alignScreens(gameState.placed);
    gameState.edges = JSON.parse(JSON.stringify(snap.edges));
    gameState.stock = { ...snap.stock };
    // partita salvata prima di un pezzo nuovo (es. il tavolo regia): la sua
    // scorta è la dotazione meno quelli già posati
    Object.keys(AVAILABLE_STOCK).forEach(t => {
      if (gameState.stock[t] == null) gameState.stock[t] = AVAILABLE_STOCK[t] - Object.values(snap.placed).filter(c => c.type === t).length;
    });
    gameState.nextIndex = { ...snap.nextIndex };
    gameState.edgeSeq = snap.edgeSeq;

    Object.values(gameState.placed).forEach(c => {
      const def = COMPONENT_TYPES[c.type];
      if (!def) return;
      const visual = this.buildComponentVisual(c.id, def, c.screen.x, c.screen.y);
      // (ripristino da annulla/ripeti) il pezzo montato resta davanti alla sua base
      const base = mountBase(c);
      if (base) visual.container.setDepth(isoDepth(base.screen.y) + (MOUNTS[c.type].depth != null ? MOUNTS[c.type].depth : 0.001));
      this.compVisuals[c.id] = visual;
      (c.cells || []).forEach(k => { this.occupied[k] = c.id; });
    });

    this.updateQuadroVisual();
    this.applyLayerVisibility();
    updateStockUI();
    updatePowerMeter();
    setCircuitStatus('untested');
    this.updateHistoryButtons();
    this.updateSignalFlow();
    saveLevel();
  }

  /* partita salvata: l'impianto com'era, con scatti, procedura e tempo di
     gioco; la cronologia di annulla/ripeti riparte da qui */
  loadLevel (lv) {
    // partita salvata quando la DI non era nella dotazione: la sua scorta
    // si ricalcola da quelle posate
    if (!lv.stockV && lv.stock) lv = { ...lv, stock: { ...lv.stock, di: AVAILABLE_STOCK.di - Object.values(lv.placed || {}).filter(c => c.type === 'di').length } };
    this.restoreSnapshot(lv);
    gameState.trips = lv.trips || 0;
    gameState.rcdTrips = lv.rcdTrips || 0;
    gameState.procErrors = (lv.procErrors || []).slice();
    gameState.stats = { ...freshStats(), ...lv.stats };
    gameState.giroFails = (lv.giroFails || [0, 0, 0]).slice();
    if (typeof lv.giro === 'number') gameState.giro = lv.giro;
    else {
      // partita salvata prima dei giri: si riparte dal primo giro non ancora a posto
      gameState.giro = 0;
      while (gameState.giro < GIRO_COLLAUDO && giroPasses(gameState.giro)) gameState.giro++;
    }
    updateGiroUI();
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
    this.refreshFaultMarks();
  }

  // segno arancione "!" sopra i pezzi (e i bauli) arrivati difettosi dallo scarico
  refreshFaultMarks () {
    (this.faultMarks || []).forEach(o => o.destroy());
    this.faultMarks = [];
    const mark = (x, y) => {
      const g = this.add.graphics().setDepth(9000);
      g.fillStyle(0x141519, 0.9); g.fillCircle(x, y, 11);
      g.lineStyle(2.5, 0xf2843d, 1); g.strokeCircle(x, y, 11);
      const t = this.add.text(x, y, '!', { fontFamily: 'Inter, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#f2843d' }).setOrigin(0.5).setDepth(9001);
      this.faultMarks.push(g, t);
    };
    Object.keys(gameState.placed).filter(isFaulty).forEach(id => {
      const v = this.compVisuals[id];
      if (v) mark(v.container.x, v.container.y - 44);
    });
    Object.entries(this.casePos || {}).forEach(([name, p]) => { if (faultsLeft('baule:' + name)) mark(p.x + 22, p.y - 44); });
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
updateGiroUI();
