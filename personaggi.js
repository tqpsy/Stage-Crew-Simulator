/* =====================================================================
   PERSONAGGI — chiave di stile "Stencil · Manifesto".
   Ogni personaggio è una SCHEDA: corporatura, viso, capelli, vestito,
   accessori, gesti e i colori base dei suoi materiali. La chiave ricava da
   ogni colore base quattro toni (luce, base, ombra, ombra profonda) e
   disegna tutti i personaggi con la stessa logica: forme piatte, tagli
   netti, niente contorni, luce principale davanti a sinistra.
   Un personaggio nuovo si aggiunge scrivendo solo la sua scheda.

   Uso:  Personaggi.disegna(ctx, scheda, stato, luce)
     stato: { t, parla (0..1), gesto (numero: parte intera = gesto, decimali =
              passaggio al successivo), batte (palpebre giù) }
     luce:  facoltativa { chiave: [r,g,b], intensita: 0..1, taglio: [r,g,b] | null }
   Il personaggio è disegnato coi piedi nell'origine, alto ~250 unità.
   ===================================================================== */
const Personaggi = (() => {
  const P = d => new Path2D(d);

  /* ---------- colori: da un colore base, i quattro toni dello stencil ---------- */
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  function toHsl ([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
    return [h, s, l];
  }
  function hslCss (h, s, l) { return `hsl(${h.toFixed(1)},${(Math.max(0, Math.min(1, s)) * 100).toFixed(1)}%,${(Math.max(0, Math.min(1, l)) * 100).toFixed(1)}%)`; }
  const toneCache = new Map();
  // le ombre scendono di luminosità e girano un po' verso il blu, le luci verso il caldo
  function toni (hex) {
    if (toneCache.has(hex)) return toneCache.get(hex);
    const [h, s, l] = toHsl(hexRgb(hex));
    const cool = (h + (h > 60 && h < 240 ? 8 : -10) + 360) % 360, warm = (h + (h > 60 && h < 240 ? -6 : 6) + 360) % 360;
    const t = {
      l: hslCss(warm, s * 0.95, l + (1 - l) * 0.32),
      b: hex,
      s: hslCss(cool, s * (l > 0.55 ? 0.8 : 1), l * (l > 0.55 ? 0.8 : 0.7)),
      d: hslCss(cool, s * (l > 0.55 ? 0.85 : 1.05), l * (l > 0.55 ? 0.6 : 0.45))
    };
    toneCache.set(hex, t);
    return t;
  }

  /* ---------- forme di base ---------- */
  const ell = (x, y, rx, ry) => P(`M${x - rx} ${y} a${rx} ${ry} 0 1 0 ${rx * 2} 0 a${rx} ${ry} 0 1 0 ${-rx * 2} 0 Z`);
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  // arto rastremato (spalla, gomito, polso) con spessori diversi e gomito morbido
  function limb (a, b, c, w0, w1, w2) {
    const n = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
    const n1 = n(a, b), n2 = n(b, c), nm = [(n1[0] + n2[0]) / 2, (n1[1] + n2[1]) / 2], lm = Math.hypot(...nm) || 1;
    const m = [nm[0] / lm, nm[1] / lm];
    const p = new Path2D();
    p.moveTo(a[0] + n1[0] * w0, a[1] + n1[1] * w0);
    p.quadraticCurveTo(b[0] + m[0] * w1 * 1.15, b[1] + m[1] * w1 * 1.15, c[0] + n2[0] * w2, c[1] + n2[1] * w2);
    p.lineTo(c[0] - n2[0] * w2, c[1] - n2[1] * w2);
    p.quadraticCurveTo(b[0] - m[0] * w1 * 1.15, b[1] - m[1] * w1 * 1.15, a[0] - n1[0] * w0, a[1] - n1[1] * w0);
    p.closePath();
    return p;
  }
  // la metà in ombra (lato destro) di un arto
  function limbShade (a, b, c, w0, w1, w2) {
    const n = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
    const n1 = n(a, b), n2 = n(b, c), nm = [(n1[0] + n2[0]) / 2, (n1[1] + n2[1]) / 2];
    // il lato in ombra è quello con la normale che punta a destra
    const side = (n1[0] + n2[0]) >= 0 ? 1 : -1;
    const p = new Path2D();
    p.moveTo(a[0] + side * n1[0] * w0, a[1] + side * n1[1] * w0);
    p.quadraticCurveTo(b[0] + side * nm[0] * w1 * 1.1, b[1] + side * nm[1] * w1 * 1.1, c[0] + side * n2[0] * w2, c[1] + side * n2[1] * w2);
    p.lineTo(c[0] + side * n2[0] * w2 * 0.2, c[1] + side * n2[1] * w2 * 0.2);
    p.quadraticCurveTo(b[0] + side * nm[0] * w1 * 0.25, b[1] + side * nm[1] * w1 * 0.25, a[0] + side * n1[0] * w0 * 0.25, a[1] + side * n1[1] * w0 * 0.25);
    p.closePath();
    return p;
  }

  // mani piccole, coi gesti: pinza, dito alzato, aperta, pugno, pollice su
  function mano (kind, x, y, dir) {
    const d = dir || 1;   // 1 = mano destra (a destra dello schermo)
    switch (kind) {
      case 'dito': return { base: P(`M${x - 6} ${y + 2} Q${x - 8} ${y - 8} ${x - 1} ${y - 10} L${x - 1} ${y - 24} Q${x + 3} ${y - 27} ${x + 4} ${y - 23} L${x + 5} ${y - 9} Q${x + 8} ${y - 4} ${x + 5} ${y + 3} Q${x} ${y + 6} ${x - 6} ${y + 2} Z`),
        ombra: P(`M${x + 1} ${y - 24} Q${x + 3} ${y - 27} ${x + 4} ${y - 23} L${x + 5} ${y - 9} Q${x + 8} ${y - 4} ${x + 5} ${y + 3} Q${x + 3} ${y - 4} ${x + 2} ${y - 9} Z`) };
      case 'pinza': return { base: P(`M${x - 7} ${y + 2} Q${x - 10} ${y - 9} ${x - 3} ${y - 12} Q${x + 3} ${y - 16} ${x + 5} ${y - 10} Q${x + 9} ${y - 7} ${x + 6} ${y + 1} Q${x} ${y + 6} ${x - 7} ${y + 2} Z`),
        ombra: P(`M${x + 5} ${y - 10} Q${x + 9} ${y - 7} ${x + 6} ${y + 1} Q${x + 2} ${y + 3} ${x + 1} ${y - 3} Z`), buco: ell(x - 1, y - 7, 2.2, 2) };
      case 'pugno': return { base: P(`M${x - 8} ${y} Q${x - 9} ${y - 12} ${x} ${y - 13} Q${x + 9} ${y - 13} ${x + 8} ${y} Q${x} ${y + 5} ${x - 8} ${y} Z`),
        ombra: P(`M${x + 1} ${y - 13} Q${x + 9} ${y - 13} ${x + 8} ${y} Q${x + 4} ${y + 3} ${x + 2} ${y + 2} Z`) };
      case 'pollice': return { base: P(`M${x - 8} ${y + 1} Q${x - 9} ${y - 10} ${x - 1} ${y - 11} L${x - 3} ${y - 22} Q${x + 2} ${y - 25} ${x + 4} ${y - 19} L${x + 7} ${y - 10} Q${x + 9} ${y - 1} ${x} ${y + 3} Z`),
        ombra: P(`M${x + 2} ${y - 11} L${x + 7} ${y - 10} Q${x + 9} ${y - 1} ${x} ${y + 3} Q${x + 3} ${y - 3} ${x + 2} ${y - 11} Z`) };
      default: return { base: P(`M${x - 7} ${y + 2} L${x - 12 * d} ${y - 10} Q${x - 11 * d} ${y - 13} ${x - 8 * d} ${y - 11} L${x - 5} ${y - 16} Q${x - 2} ${y - 19} ${x} ${y - 15} L${x + 2} ${y - 17} Q${x + 6} ${y - 18} ${x + 6} ${y - 13} L${x + 7} ${y - 3} Q${x + 3} ${y + 5} ${x - 7} ${y + 2} Z`),
        ombra: P(`M${x + 2} ${y - 17} Q${x + 6} ${y - 18} ${x + 6} ${y - 13} L${x + 7} ${y - 3} Q${x + 4} ${y + 2} ${x + 2} ${y - 2} Z`) };
    }
  }

  /* =====================================================================
     SCHEDE
     ===================================================================== */
  // Confermato: solo il Preside Tramp. Le altre schede sono esempi che mostrano
  // la chiave, da confermare.
  const SCHEDE = {
    tramp: {
      confermato: true,
      nome: 'Preside Tramp', firma: 'ciuffo e cravatta',
      vestito: 'abito', spalle: 62, orlo: -92, mento: -180, viso: { w: 47, h: 60, mascella: 0.9 },
      capelli: 'onda', occhi: 'fessura', sopracciglia: 'chiare', naso: 'corto', bocca: 'o', accessori: ['spilla'],
      colori: { abito: '#23355a', pantaloni: '#23355a', camicia: '#efe6d2', cravatta: '#d7263d', pelle: '#e8793f', capelli: '#f1d27e', scarpe: '#18181b', occhi: '#221612', bocca: '#4a1612', accessorio: '#d9b04a' },
      corpo: { x: 1.14, y: 0.9 }, curvo: 0,
      gesti: [{ gomito: [66, -126], polso: [38, -150], mano: 'pinza', testa: -0.04, dietro: 'tasca' }, { gomito: [70, -150], polso: [62, -196], mano: 'dito', testa: 0.05, dietro: 'fianco' }, { gomito: [62, -128], polso: [72, -150], mano: 'aperta', testa: 0, dietro: 'tasca' }]
    },
    einstein: {
      nome: 'DJ E=mc²', firma: 'capelli elettrici e cuffie',
      vestito: 'maglione', spalle: 50, orlo: -96, mento: -178, viso: { w: 44, h: 56, mascella: 0.4 },
      capelli: 'nuvola', occhi: 'stanchi', sopracciglia: 'folte', naso: 'patata', bocca: 'baffi', accessori: ['cuffie', 'scritta'],
      colori: { abito: '#5b5d66', pantaloni: '#2e2922', camicia: '#5b5d66', scritta: '#efe6d2', pelle: '#efc19a', capelli: '#f2efe8', scarpe: '#18181b', occhi: '#221612', bocca: '#4a1a14', accessorio: '#d7263d' },
      corpo: { x: 0.94, y: 0.84 }, curvo: 6,
      gesti: [{ gomito: [60, -140], polso: [40, -170], mano: 'pugno', testa: 0.06, dietro: 'orecchio' }, { gomito: [66, -150], polso: [58, -204], mano: 'aperta', testa: -0.05, dietro: 'fianco' }, { gomito: [58, -122], polso: [68, -142], mano: 'dito', testa: 0.02, dietro: 'orecchio' }]
    },
    dante: {
      nome: 'Dante unplugged', firma: 'cappuccio rosso e alloro',
      vestito: 'tonaca', spalle: 50, orlo: -6, mento: -182, viso: { w: 38, h: 58, mascella: 0.1 },
      capelli: 'cappuccio', occhi: 'severi', sopracciglia: 'pesanti', naso: 'aquilino', bocca: 'broncio', accessori: ['alloro'],
      colori: { abito: '#b3202c', camicia: '#efe6d2', cappello: '#b3202c', pelle: '#e2b28a', scarpe: '#2a1a12', occhi: '#221612', bocca: '#5a2018', accessorio: '#5f8f3a', cintura: '#2e1d14' },
      corpo: { x: 0.9, y: 1.06 }, curvo: 0,
      gesti: [{ gomito: [64, -150], polso: [76, -196], mano: 'aperta', testa: 0.04, dietro: 'fianco' }, { gomito: [62, -130], polso: [44, -150], mano: 'aperta', testa: -0.03, dietro: 'anca' }, { gomito: [70, -148], polso: [86, -178], mano: 'dito', testa: 0.06, dietro: 'fianco' }]
    },
    gerry: {
      nome: 'Bidello Gerry', firma: 'occhiali, sorriso e scopa',
      vestito: 'camice', spalle: 52, orlo: -60, mento: -184, viso: { w: 42, h: 64, mascella: 0.5 },
      capelli: 'ordinati', occhi: 'felici', sopracciglia: 'arcuate', naso: 'lungo', bocca: 'sorriso', accessori: ['occhiali', 'scopa', 'penna'],
      colori: { abito: '#2f5e9e', pantaloni: '#2a2d33', camicia: '#efe6d2', pelle: '#efb48a', capelli: '#bdbab2', scarpe: '#18181b', occhi: '#221612', bocca: '#4a1a14', denti: '#ffffff', montatura: '#141417', legno: '#a4733c', setole: '#d9b45a', penna: '#d7263d' },
      corpo: { x: 0.86, y: 1.12 }, curvo: 0,
      gesti: [{ gomito: [64, -130], polso: [58, -168], mano: 'pollice', testa: 0.05, dietro: 'fianco' }, { gomito: [62, -128], polso: [40, -150], mano: 'aperta', testa: -0.03, dietro: 'fianco' }, { gomito: [68, -150], polso: [64, -194], mano: 'aperta', testa: 0.04, dietro: 'fianco' }]
    }
  };

  /* =====================================================================
     COSTRUZIONE: dalla scheda ai pezzi. Ogni pezzo ha un materiale e un
     tono (l luce, b base, s ombra, d ombra profonda). L'ordine conta.
     ===================================================================== */
  function costruisci (C, st) {
    const L = [];
    const add = (mat, tono, p, extra) => { if (p) L.push(Object.assign({ mat, tono, p, gruppo: 'corpo' }, extra)); };
    const addMano = (m, ancora, tono) => { add('pelle', tono || 'b', m.base, { gruppo: 'mano', ancora }); add('pelle', 's', m.ombra, { gruppo: 'mano', ancora }); if (m.buco) add('pelle', 'd', m.buco, { gruppo: 'mano', ancora }); };
    const espr = st.espressione || 'normale';
    const S = C.spalle, orlo = C.orlo, mento = C.mento, fw = C.viso.w, fh = C.viso.h, top = mento - fh;
    // gesto del braccio davanti, con passaggio morbido al successivo
    const g0 = Math.floor(st.gesto), f = st.gesto - g0, i = ((g0 % 3) + 3) % 3, j = (i + 1) % 3;
    const k = f < 0.65 ? 0 : (f - 0.65) / 0.35, e = k * k * (3 - 2 * k);
    const G = C.gesti[i], H = C.gesti[j];
    const gomito = mix(G.gomito, H.gomito, e), polso = mix(G.polso, H.polso, e);
    const tipoMano = e < 0.5 ? G.mano : H.mano;
    const inclina = G.testa + (H.testa - G.testa) * e + (st.parla > 0.1 ? Math.sin(st.t * 7) * 0.012 : 0);

    // ---- gambe e scarpe
    if (C.vestito !== 'tonaca') {
      add('pantaloni', 'b', P(`M-30 ${orlo - 8} L-1 ${orlo - 8} L-6 -9 L-30 -9 Z M3 ${orlo - 8} L30 ${orlo - 8} L37 -9 L12 -9 Z`));
      add('pantaloni', 's', P(`M-12 ${orlo - 8} L-1 ${orlo - 8} L-6 -9 L-14 -9 Z M20 ${orlo - 8} L30 ${orlo - 8} L37 -9 L26 -9 Z`));
      add('pantaloni', 'd', P(`M-1 ${orlo - 8} L3 ${orlo - 8} L2 ${orlo + 10} Z`));
      add('pantaloni', 'l', P(`M-26 ${orlo - 6} L-23 ${orlo - 6} L-26 -12 L-29 -12 Z`));
    }
    add('scarpe', 'b', P('M-38 0 L-37 -9 Q-30 -14 -5 -12 L-4 0 Z M11 0 L12 -12 Q38 -14 46 -6 L46 0 Z'));
    add('scarpe', 'l', P('M-34 -9 Q-28 -12 -14 -11 L-14 -9 Q-26 -10 -33 -7 Z M16 -11 Q30 -12 38 -8 L37 -7 Q28 -10 16 -9 Z'));
    add('scarpe', 'd', P('M-38 0 L-38 -3 L-4 -3 L-4 0 Z M11 0 L11 -3 L46 -3 L46 0 Z'));

    // ---- braccio dietro: lungo il fianco, in tasca, pugno sul fianco, mano sulla cuffia
    const eyW = top + fh * 0.4;
    const DIETRO = {
      fianco: { e: [-S + 1, -124], w: [-S + 8, orlo + 8], mano: 'giu' },
      tasca: { e: [-S - 6, -130], w: [-S + 16, -106], mano: null },
      anca: { e: [-S - 22, -132], w: [-S + 2, -104], mano: 'pugno' },
      orecchio: { e: [-S - 16, -150], w: [-fw / 2 - 12, eyW + 22], mano: 'aperta' }
    };
    const D0 = DIETRO[G.dietro || 'fianco'], D1 = DIETRO[H.dietro || 'fianco'];
    const bs = [-S + 12, -166], be = mix(D0.e, D1.e, e), bp = mix(D0.w, D1.w, e);
    const posaDietro = e < 0.5 ? (G.dietro || 'fianco') : (H.dietro || 'fianco');
    const dietroDavanti = posaDietro === 'orecchio' ? 'testa' : posaDietro === 'fianco' ? null : 'corpo';
    function dietroBraccio () {
      const davanti = !!dietroDavanti;
      add('abito', davanti ? 'b' : 's', limb(bs, be, bp, 12, 10, 8));
      add('abito', davanti ? 's' : 'd', limbShade(bs, be, bp, 12, 10, 8));
      const kind = e < 0.5 ? D0.mano : D1.mano;
      if (kind === 'giu') addMano({ base: P(`M${bp[0] - 7} ${bp[1] + 1} Q${bp[0] - 9} ${bp[1] + 12} ${bp[0]} ${bp[1] + 14} Q${bp[0] + 8} ${bp[1] + 13} ${bp[0] + 7} ${bp[1]} Z`), ombra: P(`M${bp[0] + 2} ${bp[1] + 1} L${bp[0] + 7} ${bp[1]} Q${bp[0] + 8} ${bp[1] + 13} ${bp[0]} ${bp[1] + 14} Q${bp[0] + 4} ${bp[1] + 8} ${bp[0] + 2} ${bp[1] + 1} Z`) }, bp, davanti ? 'b' : 's');
      else if (kind === 'pugno') addMano(mano('pugno', bp[0], bp[1] + 6, -1), [bp[0], bp[1] + 6]);
      else if (kind === 'aperta') addMano(mano('aperta', bp[0], bp[1] + 2, -1), [bp[0], bp[1] + 2]);
      else { add('abito', 'd', P(`M${bp[0] - 9} ${bp[1] - 2} L${bp[0] + 9} ${bp[1] - 4} L${bp[0] + 9} ${bp[1] + 1} L${bp[0] - 9} ${bp[1] + 3} Z`)); }   // la mano sparisce in tasca
    }
    if (!dietroDavanti) dietroBraccio();
    if (C.accessori.includes('scopa')) {
      const sx = -S + 8, sy = orlo + 8;
      add('legno', 'b', P(`M${sx - 2} -238 L${sx + 2} -238 L${sx + 3} -26 L${sx - 3} -26 Z`));
      add('legno', 's', P(`M${sx + 0.5} -238 L${sx + 2} -238 L${sx + 3} -26 L${sx + 1} -26 Z`));
      add('setole', 'b', P(`M${sx - 22} 0 L${sx - 14} -26 L${sx + 14} -26 L${sx + 22} 0 Z`));
      add('setole', 's', P(`M${sx + 4} -26 L${sx + 14} -26 L${sx + 22} 0 L${sx + 8} 0 Z`));
      add('setole', 'd', P(`M${sx - 15} -28 L${sx + 15} -28 L${sx + 14} -20 L${sx - 14} -20 Z`));
      addMano({ base: P(`M${sx - 7} ${sy + 2} Q${sx - 9} ${sy + 10} ${sx} ${sy + 12} Q${sx + 8} ${sy + 10} ${sx + 7} ${sy + 2} Z`), ombra: P(`M${sx + 2} ${sy + 2} L${sx + 7} ${sy + 2} Q${sx + 8} ${sy + 10} ${sx} ${sy + 12} Z`) }, [sx, sy + 6]);
    }

    // ---- il corpo, secondo il vestito
    const corpo = {
      abito: `M${-S + 12} -176 Q${-S - 2} -172 ${-S - 2} -152 L${-S + 2} ${orlo} L-12 ${orlo + 4} L-2 -132 L4 -132 L14 ${orlo + 4} L${S - 2} ${orlo} L${S} -154 Q${S} -172 ${S - 14} -176 Q0 -188 ${-S + 12} -176 Z`,
      maglione: `M${-S + 10} -178 Q${-S - 4} -172 ${-S - 6} -150 L${-S} ${orlo} Q0 ${orlo + 8} ${S} ${orlo} L${S + 4} -150 Q${S + 2} -172 ${S - 10} -178 Q0 -186 ${-S + 10} -178 Z`,
      tonaca: `M${-S + 10} -178 Q${-S - 4} -172 ${-S - 6} -148 L${-S - 18} -6 Q0 2 ${S + 18} -6 L${S + 6} -148 Q${S + 4} -172 ${S - 10} -178 Q0 -186 ${-S + 10} -178 Z`,
      camice: `M${-S + 10} -178 Q${-S - 4} -172 ${-S - 6} -150 L${-S - 8} ${orlo} L${S + 8} ${orlo} L${S + 6} -150 Q${S + 4} -172 ${S - 10} -178 Q0 -188 ${-S + 10} -178 Z`
    }[C.vestito];
    add('abito', 'b', P(corpo));
    // ombra sul fianco destro e sotto il braccio che gesticola
    const basso = C.vestito === 'tonaca' ? -6 : orlo;
    const fx = C.vestito === 'tonaca' ? S + 18 : C.vestito === 'camice' ? S + 8 : C.vestito === 'maglione' ? S : S - 2;
    add('abito', 's', P(`M${S - 16} -176 Q${S} -172 ${S + (C.vestito === 'abito' ? 0 : 4)} -152 L${fx} ${basso} L${fx - 20} ${basso} Q${S - 12} -120 ${S - 20} -160 Z`));
    // luce sulla spalla sinistra
    add('abito', 'l', P(`M${-S + 12} -176 Q${-S - 2} -172 ${-S - 2} -154 Q${-S + 4} -168 ${-S + 22} -178 Z`));
    if (C.vestito === 'abito') {
      add('camicia', 'b', P(`M-14 -180 L14 -180 L0 -132 Z M-2 -132 L4 -132 L14 ${orlo + 4} L-12 ${orlo + 4} Z`));
      add('camicia', 's', P(`M4 -132 L14 ${orlo + 4} L6 ${orlo + 4} Z M6 -180 L14 -180 L3 -150 Z`));
      add('cravatta', 'b', P(`M-6 -178 L6 -178 L4 -169 L-4 -169 Z M-4 -169 L4 -169 L10 ${orlo + 16} L1 ${orlo + 28} L-9 ${orlo + 16} Z`));
      add('cravatta', 's', P(`M1 -169 L4 -169 L10 ${orlo + 16} L1 ${orlo + 28} Z M-6 -172 L6 -172 L5 -169 L-5 -169 Z`));
      add('cravatta', 'l', P(`M-3 -166 L-1 -166 L-5 ${orlo + 14} L-7 ${orlo + 14} Z`));
      add('abito', 'd', P('M-14 -180 L-27 -176 L-7 -136 L-3 -146 Z'));
      add('abito', 's', P('M14 -180 L27 -176 L7 -136 L3 -146 Z'));
      add('abito', 'l', P('M-27 -176 L-25 -176 L-7 -138 L-8 -136 Z'));
      // tasche con le patte e il bottone
      add('abito', 'd', P(`M${-S + 10} -114 L${-S + 32} -116 L${-S + 32} -112 L${-S + 10} -110 Z M${S - 32} -116 L${S - 10} -114 L${S - 10} -110 L${S - 32} -112 Z`));
      add('abito', 'd', ell(1, -128, 2.2, 2.2));
      if (C.accessori.includes('spilla')) add('accessorio', 'b', ell(-17, -160, 2.6, 2.6));
    } else if (C.vestito === 'maglione') {
      add('abito', 'd', P(`M-16 -180 Q0 -170 16 -180 L14 -175 Q0 -166 -14 -175 Z`));
      // coste in fondo al maglione
      add('abito', 's', P(`M${-S} ${orlo - 8} Q0 ${orlo} ${S} ${orlo - 8} L${S} ${orlo} Q0 ${orlo + 8} ${-S} ${orlo} Z`));
      for (let x = -S + 6; x < S; x += 7) add('abito', 'd', P(`M${x} ${orlo - 6 + Math.abs(x) * 0.03} h1.4 v7 h-1.4 Z`));
    } else if (C.vestito === 'tonaca') {
      add('camicia', 'b', P('M-12 -181 Q0 -174 12 -181 L10 -176 Q0 -170 -10 -176 Z'));
      // pieghe della tonaca: ombre e luci verticali
      add('abito', 's', P('M-8 -96 L-3 -96 L-10 -5 L-17 -5 Z M12 -96 L17 -96 L27 -5 L20 -5 Z'));
      add('abito', 'd', P('M17 -96 L21 -96 L34 -5 L27 -5 Z'));
      add('abito', 'l', P('M-30 -96 L-27 -96 L-40 -6 L-44 -6 Z M1 -96 L3 -96 L0 -5 L-3 -5 Z'));
      add('cintura', 'b', P(`M${-S - 8} -106 L${S + 8} -106 L${S + 9} -97 L${-S - 9} -97 Z`));
      add('cintura', 's', P(`M${S - 10} -106 L${S + 8} -106 L${S + 9} -97 L${S - 10} -97 Z`));
      add('accessorio', 'b', P('M-5 -107 h10 v11 h-10 Z'));
    } else if (C.vestito === 'camice') {
      add('camicia', 'b', P('M-12 -180 L12 -180 L0 -158 Z'));
      add('abito', 'd', P(`M-12 -180 L-24 -176 L-4 -150 L0 -158 Z M-1 -150 L1 -150 L1 ${orlo} L-1 ${orlo} Z`));
      add('abito', 's', P('M12 -180 L24 -176 L4 -150 L0 -158 Z'));
      add('abito', 's', P(`M${S - 30} -114 L${S - 8} -114 L${S - 8} -96 L${S - 30} -96 Z M${-S + 6} -84 L${-S + 26} -84 L${-S + 26} -68 L${-S + 6} -68 Z`));
      add('abito', 'd', P(`M${S - 30} -114 L${S - 8} -114 L${S - 8} -111 L${S - 30} -111 Z`));
      [-140, -118, -96, -74].forEach(y => add('abito', 'd', ell(4, y, 2.2, 2.2)));
      if (C.accessori.includes('penna')) { add('penna', 'b', P(`M${S - 24} -122 h3 v12 h-3 Z`)); add('penna', 's', P(`M${S - 22.5} -122 h1.5 v12 h-1.5 Z`)); }
    }
    if (C.accessori.includes('scritta')) L.push({ mat: 'scritta', tono: 'b', testo: 'E=mc²', x: -2, y: -128, size: 20 });

    if (dietroDavanti === 'corpo') dietroBraccio();

    // ---- testa (con l'inclinazione del gesto)
    const piv = [0, mento + 6];
    const T = (x, y) => { const c = Math.cos(inclina), s = Math.sin(inclina), dx = x - piv[0], dy = y - piv[1]; return [piv[0] + dx * c - dy * s, piv[1] + dx * s + dy * c]; };
    const head = []; const addH = (mat, tono, p, extra) => { if (p) head.push(Object.assign({ mat, tono, p, gruppo: 'testa' }, extra)); };
    // collo, con l'ombra portata dal mento
    add('pelle', 's', P(`M-10 ${mento - 6} L10 ${mento - 6} L11 ${mento + 4} L-11 ${mento + 4} Z`));
    add('pelle', 'd', P(`M-10 ${mento - 2} Q0 ${mento + 4} 10 ${mento - 2} L10 ${mento - 6} L-10 ${mento - 6} Z`));
    const jw = fw * (0.26 + 0.2 * C.viso.mascella);
    const viso = `M${-fw / 2} ${top + fh * 0.45} C${-fw / 2} ${top + fh * 0.08} ${-fw * 0.26} ${top} 0 ${top} C${fw * 0.26} ${top} ${fw / 2} ${top + fh * 0.08} ${fw / 2} ${top + fh * 0.45} C${fw / 2} ${top + fh * 0.78} ${jw} ${mento} 0 ${mento} C${-jw} ${mento} ${-fw / 2} ${top + fh * 0.78} ${-fw / 2} ${top + fh * 0.45} Z`;
    const ey = top + fh * 0.4, ex = fw * 0.21;
    // orecchie
    addH('pelle', 'b', P(`M${-fw / 2 + 1} ${ey + 1} Q${-fw / 2 - 7} ${ey + 3} ${-fw / 2 - 5} ${ey + 12} Q${-fw / 2 - 3} ${ey + 16} ${-fw / 2 + 1} ${ey + 14} Z`));
    addH('pelle', 's', P(`M${fw / 2 - 1} ${ey + 1} Q${fw / 2 + 7} ${ey + 3} ${fw / 2 + 5} ${ey + 12} Q${fw / 2 + 3} ${ey + 16} ${fw / 2 - 1} ${ey + 14} Z`));
    addH('pelle', 's', P(`M${-fw / 2 - 1} ${ey + 5} Q${-fw / 2 - 4} ${ey + 7} ${-fw / 2 - 3} ${ey + 11} L${-fw / 2} ${ey + 10} Z`));
    addH('pelle', 'b', P(viso));
    // ombra del viso: lato destro, sotto gli zigomi, sotto il mento
    addH('pelle', 's', P(viso), { clip: [fw * 0.2, top - 10, fw, fh + 20] });
    addH('pelle', 's', P(`M${-fw * 0.3} ${mento - fh * 0.14} Q0 ${mento - fh * 0.06} ${fw * 0.3} ${mento - fh * 0.14} Q${fw * 0.2} ${mento + 1} 0 ${mento + 0.5} Q${-fw * 0.2} ${mento + 1} ${-fw * 0.3} ${mento - fh * 0.14} Z`));
    // luce su zigomo e fronte a sinistra
    addH('pelle', 'l', P(`M${-fw * 0.36} ${ey + 8} Q${-fw * 0.3} ${ey + 4} ${-fw * 0.2} ${ey + 8} Q${-fw * 0.28} ${ey + 12} ${-fw * 0.36} ${ey + 8} Z M${-fw * 0.3} ${top + fh * 0.16} Q${-fw * 0.15} ${top + fh * 0.07} 0 ${top + fh * 0.1} Q${-fw * 0.15} ${top + fh * 0.13} ${-fw * 0.3} ${top + fh * 0.2} Z`));
    // occhi
    if (C.occhi === 'fessura') addH('pelle', 'l', P(`M${-ex - 8} ${ey} Q${-ex} ${ey - 5} ${-ex + 7} ${ey + 1} Q${-ex} ${ey + 6} ${-ex - 8} ${ey + 3} Z M${ex - 7} ${ey + 1} Q${ex} ${ey - 5} ${ex + 8} ${ey} Q${ex + 8} ${ey + 4} ${ex} ${ey + 6} Q${ex - 5} ${ey + 5} ${ex - 7} ${ey + 1} Z`));
    const tipoOcchi = espr === 'sorpreso' ? 'tondi' : espr === 'contento' ? 'felici' : espr === 'arrabbiato' ? (C.occhi === 'fessura' ? 'fessura' : 'severi') : C.occhi;
    if (tipoOcchi === 'tondi' && !st.batte) {
      addH('bianco', 'b', P(`M${-ex - 6} ${ey} a6 5.5 0 1 0 12 0 a6 5.5 0 1 0 -12 0 Z M${ex - 6} ${ey} a6 5.5 0 1 0 12 0 a6 5.5 0 1 0 -12 0 Z`));
    }
    const occhi = st.batte ? `M${-ex - 5} ${ey} h10 v1.3 h-10 Z M${ex - 5} ${ey} h10 v1.3 h-10 Z` : {
      tondi: `M${-ex - 2.4} ${ey} a2.4 2.8 0 1 0 4.8 0 a2.4 2.8 0 1 0 -4.8 0 Z M${ex - 2.4} ${ey} a2.4 2.8 0 1 0 4.8 0 a2.4 2.8 0 1 0 -4.8 0 Z`,
      fessura: `M${-ex - 5} ${ey} Q${-ex} ${ey - 3} ${-ex + 5} ${ey} Q${-ex} ${ey + 1.6} ${-ex - 5} ${ey} Z M${ex - 5} ${ey} Q${ex} ${ey - 3} ${ex + 5} ${ey} Q${ex} ${ey + 1.6} ${ex - 5} ${ey} Z`,
      stanchi: `M${-ex - 4} ${ey - 1} Q${-ex} ${ey - 4} ${-ex + 4} ${ey + 1} Q${-ex} ${ey + 3} ${-ex - 4} ${ey - 1} Z M${ex - 4} ${ey + 1} Q${ex} ${ey - 4} ${ex + 4} ${ey - 1} Q${ex} ${ey + 3} ${ex - 4} ${ey + 1} Z`,
      severi: `M${-ex - 5} ${ey - 1} L${-ex + 5} ${ey + 1} L${-ex + 4} ${ey + 2.6} L${-ex - 5} ${ey + 1} Z M${ex - 5} ${ey + 1} L${ex + 5} ${ey - 1} L${ex + 5} ${ey + 1} L${ex - 4} ${ey + 2.6} Z`,
      felici: `M${-ex - 5} ${ey + 1} Q${-ex} ${ey - 5} ${-ex + 5} ${ey + 1} L${-ex + 4} ${ey + 2} Q${-ex} ${ey - 2} ${-ex - 4} ${ey + 2} Z M${ex - 5} ${ey + 1} Q${ex} ${ey - 5} ${ex + 5} ${ey + 1} L${ex + 4} ${ey + 2} Q${ex} ${ey - 2} ${ex - 4} ${ey + 2} Z`
    }[tipoOcchi];
    addH('occhi', 'b', P(occhi));
    if (tipoOcchi === 'stanchi') addH('pelle', 's', P(`M${-ex - 5} ${ey + 3} Q${-ex} ${ey + 7} ${-ex + 5} ${ey + 3} Q${-ex} ${ey + 5} ${-ex - 5} ${ey + 3} Z M${ex - 5} ${ey + 3} Q${ex} ${ey + 7} ${ex + 5} ${ey + 3} Q${ex} ${ey + 5} ${ex - 5} ${ey + 3} Z`));
    // sopracciglia
    const soprM = C.sopracciglia === 'pesanti' ? 'occhi' : 'capelli', soprT = C.sopracciglia === 'pesanti' ? 'b' : 's';
    const tipoSopr = espr === 'arrabbiato' ? 'aggrottate' : espr === 'sorpreso' ? 'alzate' : C.sopracciglia;
    addH(soprM, soprT, P({
      aggrottate: `M${-ex - 10} ${ey - 11} L${-ex + 7} ${ey - 5} L${-ex + 6} ${ey - 1.5} L${-ex - 9} ${ey - 7.5} Z M${ex - 7} ${ey - 5} L${ex + 10} ${ey - 11} L${ex + 9} ${ey - 7.5} L${ex - 6} ${ey - 1.5} Z`,
      alzate: `M${-ex - 9} ${ey - 10} Q${-ex} ${ey - 19} ${-ex + 8} ${ey - 11} L${-ex + 7} ${ey - 8.5} Q${-ex} ${ey - 15} ${-ex - 8} ${ey - 7.5} Z M${ex + 9} ${ey - 10} Q${ex} ${ey - 19} ${ex - 8} ${ey - 11} L${ex - 7} ${ey - 8.5} Q${ex} ${ey - 15} ${ex + 8} ${ey - 7.5} Z`,
      chiare: `M${-ex - 9} ${ey - 7} L${-ex + 6} ${ey - 10} L${-ex + 6} ${ey - 7} L${-ex - 8} ${ey - 4} Z M${ex - 6} ${ey - 10} L${ex + 9} ${ey - 7} L${ex + 8} ${ey - 4} L${ex - 6} ${ey - 7} Z`,
      folte: `M${-ex - 11} ${ey - 5} Q${-ex - 6} ${ey - 16} ${-ex + 7} ${ey - 9} Q${-ex} ${ey - 7} ${-ex - 11} ${ey - 5} Z M${ex + 11} ${ey - 5} Q${ex + 6} ${ey - 16} ${ex - 7} ${ey - 9} Q${ex} ${ey - 7} ${ex + 11} ${ey - 5} Z`,
      pesanti: `M${-ex - 8} ${ey - 8} L${-ex + 7} ${ey - 4} L${-ex + 6} ${ey - 1} L${-ex - 8} ${ey - 5} Z M${ex - 7} ${ey - 4} L${ex + 8} ${ey - 8} L${ex + 8} ${ey - 5} L${ex - 6} ${ey - 1} Z`,
      arcuate: `M${-ex - 8} ${ey - 5} Q${-ex} ${ey - 13} ${-ex + 7} ${ey - 6} L${-ex + 6} ${ey - 4} Q${-ex} ${ey - 10} ${-ex - 7} ${ey - 3} Z M${ex + 8} ${ey - 5} Q${ex} ${ey - 13} ${ex - 7} ${ey - 6} L${ex - 6} ${ey - 4} Q${ex} ${ey - 10} ${ex + 7} ${ey - 3} Z`
    }[tipoSopr]));
    // naso: ombra a destra e luce sul dorso
    addH('pelle', 's', P({
      corto: `M1 ${ey} L6 ${ey + 15} L-1 ${ey + 17} Z`,
      patata: `M1 ${ey} L5 ${ey + 12} Q8 ${ey + 18} 0 ${ey + 19} Q4 ${ey + 13} 1 ${ey} Z`,
      aquilino: `M-1 ${ey - 2} Q8 ${ey + 8} 7 ${ey + 18} Q3 ${ey + 22} -3 ${ey + 18} L2 ${ey + 14} Z`,
      lungo: `M0 ${ey} L6 ${ey + 20} Q2 ${ey + 23} -3 ${ey + 20} Z`
    }[C.naso]));
    addH('pelle', 'l', P(`M-1 ${ey + 1} L0 ${ey + 1} L-1 ${ey + (C.naso === 'lungo' ? 18 : 13)} L-2 ${ey + (C.naso === 'lungo' ? 18 : 13)} Z`));
    if (C.naso === 'patata') addH('pelle', 's', ell(-4, ey + 16, 4, 3.5));
    // bocca
    const my = ey + (C.naso === 'lungo' ? 30 : 24), ap = st.parla, mo = 2 + ap * 4;
    const tipoBocca = espr === 'sorpreso' ? 'stupore' : espr === 'arrabbiato' ? 'ringhio' : espr === 'contento' && C.bocca !== 'sorriso' ? 'soddisfatto' : C.bocca;
    if (tipoBocca === 'stupore') addH('bocca', 'b', ell(0, my + 2, 5.5 + ap, 6.5 + ap * 2));
    if (tipoBocca === 'ringhio') {
      addH('bocca', 'b', P(`M-10 ${my + 1} Q0 ${my - 4} 10 ${my + 1} L9 ${my + 6 + ap * 2} Q0 ${my + 3 + ap * 2} -9 ${my + 6 + ap * 2} Z`));
      addH('denti', 'b', P(`M-8 ${my} Q0 ${my - 3} 8 ${my} L8 ${my + 2} Q0 ${my - 1} -8 ${my + 2} Z`));
    }
    if (tipoBocca === 'soddisfatto') addH('bocca', 'b', P(`M-10 ${my - 1} Q0 ${my + 7 + ap * 5} 10 ${my - 1} Q0 ${my + 3} -10 ${my - 1} Z`));
    if (espr === 'contento') addH('guance', 'b', P(`M${-fw * 0.42} ${ey + 13} a5 3 0 1 0 10 0 a5 3 0 1 0 -10 0 Z M${fw * 0.42 - 10} ${ey + 13} a5 3 0 1 0 10 0 a5 3 0 1 0 -10 0 Z`));
    if (espr === 'arrabbiato') addH('guance', 's', P(`M${-fw * 0.2} ${ey - 13} l3 3 l-3 3 M${fw * 0.2 - 4} ${ey - 16} h1`));
    if (tipoBocca === 'o') addH('bocca', 'b', ap > 0.1 ? ell(0, my, 4.5, mo / 2 + 1) : P(`M-6 ${my} Q0 ${my - 3} 6 ${my} L6 ${my + 1.5} Q0 ${my - 1} -6 ${my + 1.5} Z`));
    if (tipoBocca === 'broncio') addH('bocca', 'b', ap > 0.1 ? ell(0, my + 1, 5, mo / 2 + 0.5) : P(`M-7 ${my + 3} Q0 ${my - 2} 7 ${my + 3} L7 ${my + 4.5} Q0 ${my} -7 ${my + 4.5} Z`));
    if (tipoBocca === 'sorriso') {
      const h = 5 + ap * 4;
      addH('bocca', 'b', P(`M-12 ${my - 2} Q0 ${my + h + 4} 12 ${my - 2} Q0 ${my + 2} -12 ${my - 2} Z`));
      addH('denti', 'b', P(`M-10 ${my - 1} Q0 ${my + 3} 10 ${my - 1} L9 ${my + 2} Q0 ${my + 5} -9 ${my + 2} Z`));
      addH('pelle', 's', P(`M-14 ${my - 4} Q-16 ${my} -13 ${my + 3} L-12 ${my + 2} Q-14 ${my} -12 ${my - 3} Z M14 ${my - 4} Q16 ${my} 13 ${my + 3} L12 ${my + 2} Q14 ${my} 12 ${my - 3} Z`));
    }
    if (C.bocca === 'baffi') {
      if (ap > 0.1 && tipoBocca === 'baffi') addH('bocca', 'b', ell(0, my + 5, 4, mo / 2));
      addH('capelli', 'b', P(`M-15 ${my + 2} Q-11 ${my - 7} 0 ${my - 5} Q11 ${my - 7} 15 ${my + 2} Q8 ${my + 1} 0 ${my + 1} Q-8 ${my + 1} -15 ${my + 2} Z`));
      addH('capelli', 's', P(`M2 ${my - 5} Q11 ${my - 7} 15 ${my + 2} Q8 ${my + 1} 2 ${my + 1} Z`));
    }
    // capelli o copricapo
    const hw = fw / 2;
    if (C.capelli === 'onda') {
      addH('capelli', 'b', P(`M${hw} ${top + 26} C${hw + 7} ${top + 12} ${hw + 6} ${top - 6} ${hw - 10} ${top - 14} C${hw - 26} ${top - 21} ${-hw - 3} ${top - 16} ${-hw - 11} ${top - 2} C${-hw - 16} ${top + 6} ${-hw - 14} ${top + 14} ${-hw - 8} ${top + 18} C${-hw - 8} ${top + 10} ${-hw - 1} ${top + 6} ${-hw + 9} ${top + 7} C${-hw + 21} ${top + 7} ${hw - 11} ${top + 9} ${hw - 4} ${top + 16} L${hw} ${top + 26} Z M${hw} ${top + 26} L${hw + 3} ${top + 38} L${hw - 1} ${top + 37} Z`));
      addH('capelli', 's', P(`M${-hw - 8} ${top + 18} C${-hw - 8} ${top + 10} ${-hw - 1} ${top + 6} ${-hw + 9} ${top + 7} C${-hw + 21} ${top + 7} ${hw - 11} ${top + 9} ${hw - 4} ${top + 16} L${hw} ${top + 26} C${hw + 2} ${top + 14} ${hw - 6} ${top + 2} ${-hw + 25} ${top} C${-hw + 9} ${top - 1} ${-hw - 5} ${top + 4} ${-hw - 8} ${top + 18} Z`));
      addH('capelli', 'l', P(`M${-hw - 6} ${top - 4} C${-hw + 2} ${top - 14} ${hw - 16} ${top - 16} ${hw - 4} ${top - 8} C${hw - 18} ${top - 11} ${-hw + 4} ${top - 9} ${-hw - 6} ${top - 4} Z M${-hw + 2} ${top - 10} C${-hw + 12} ${top - 18} ${hw - 20} ${top - 21} ${hw - 10} ${top - 15} C${hw - 22} ${top - 17} ${-hw + 12} ${top - 15} ${-hw + 2} ${top - 10} Z`));
      addH('capelli', 'd', P(`M${hw} ${top + 26} L${hw + 3} ${top + 38} L${hw + 1} ${top + 38} L${hw - 2} ${top + 22} Z`));
    } else if (C.capelli === 'nuvola') {
      let seed = 11; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const n = 11, pts = [];
      for (let a = 0; a <= n; a++) {
        const t = Math.PI * (0.9 + (a / n) * 1.2), side = Math.abs(Math.cos(t));
        pts.push([Math.cos(t) * (hw + 10 + side * 16), top + fh * 0.42 + Math.sin(t) * (fh * 0.5 + 8 - side * 4)]);
      }
      let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let a = 1; a < pts.length; a++) {
        const [x0, y0] = pts[a - 1], [x1, y1] = pts[a], mx = (x0 + x1) / 2, mmy = (y0 + y1) / 2;
        const ox = mx, oy = mmy - (top + fh * 0.42), l = Math.hypot(ox, oy) || 1, bump = 7 + r() * 11;
        d += ` Q${(mx + ox / l * bump).toFixed(1)} ${(mmy + oy / l * bump).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
      }
      d += ` L${hw - 1} ${top + fh * 0.46} C${hw - 4} ${top + 10} ${hw - 14} ${top + 12} ${hw - 20} ${top + 14} Q0 ${top + 2} ${-hw + 18} ${top + 13} C${-hw + 10} ${top + 12} ${-hw + 3} ${top + 12} ${-hw + 1} ${top + fh * 0.46} Z`;
      addH('capelli', 'b', P(d));
      addH('capelli', 's', P(d), { clip: [hw + 4, top - 60, 80, 120] });
      addH('capelli', 'd', P(`M${hw + 4} ${top + fh * 0.62} Q${hw + 24} ${top + fh * 0.58} ${hw + 22} ${top + fh * 0.34} Q${hw + 14} ${top + fh * 0.5} ${hw + 2} ${top + fh * 0.46} Z`));
      addH('capelli', 's', P(`M${-hw - 4} ${top + fh * 0.6} Q${-hw - 22} ${top + fh * 0.52} ${-hw - 20} ${top + fh * 0.3} Q${-hw - 12} ${top + fh * 0.46} ${-hw - 2} ${top + fh * 0.44} Z M-6 ${top - 6} Q0 ${top - 16} 10 ${top - 12} Q2 ${top - 8} -2 ${top - 2} Z`));
    } else if (C.capelli === 'cappuccio') {
      const cap = `M${-hw - 7} ${mento - 4} C${-hw - 12} ${top + fh * 0.4} ${-hw - 10} ${top - 12} 4 ${top - 16} C${hw + 16} ${top - 18} ${hw + 12} ${top + fh * 0.4} ${hw + 7} ${mento - 4} L${hw - 2} ${mento - 12} C${hw + 1} ${top + fh * 0.5} ${hw} ${top + 8} 0 ${top + 6} C${-hw} ${top + 8} ${-hw - 1} ${top + fh * 0.5} ${-hw + 2} ${mento - 12} Z M${hw + 6} ${top - 10} Q${hw + 22} ${top - 8} ${hw + 24} ${top + 12} Q${hw + 14} ${top} ${hw + 4} ${top} Z`;
      addH('cappello', 'b', P(cap));
      addH('cappello', 's', P(cap), { clip: [hw * 0.3, top - 30, 60, fh + 40] });
      addH('cappello', 'd', P(`M${hw + 7} ${mento - 4} L${hw - 2} ${mento - 12} C${hw + 1} ${top + fh * 0.5} ${hw} ${top + 8} ${hw - 8} ${top + 7} C${hw + 8} ${top + 6} ${hw + 12} ${top + fh * 0.4} ${hw + 7} ${mento - 4} Z`));
      addH('cappello', 'l', P(`M${-hw - 8} ${top + fh * 0.5} C${-hw - 10} ${top + 4} ${-hw} ${top - 10} 0 ${top - 12} C${-hw + 2} ${top - 6} ${-hw - 5} ${top + 6} ${-hw - 5} ${top + fh * 0.5} Z`));
    } else if (C.capelli === 'ordinati') {
      addH('capelli', 'b', P(`M${-hw - 2} ${top + 22} C${-hw - 4} ${top + 2} ${-hw + 8} ${top - 8} 4 ${top - 8} C${hw + 2} ${top - 8} ${hw + 4} ${top + 6} ${hw + 1} ${top + 22} L${hw - 3} ${top + 14} C${hw - 6} ${top + 6} -6 ${top + 5} -8 ${top + 4} L${-hw + 3} ${top + 14} Z`));
      addH('capelli', 's', P(`M8 ${top - 8} C${hw + 2} ${top - 8} ${hw + 4} ${top + 6} ${hw + 1} ${top + 22} L${hw - 3} ${top + 14} C${hw - 5} ${top + 6} 10 ${top + 4} 6 ${top + 3} Z`));
      addH('capelli', 'l', P(`M${-hw + 2} ${top + 6} C${-hw + 6} ${top - 4} -8 ${top - 7} -4 ${top - 7} L-6 ${top - 4} C-12 ${top - 3} ${-hw + 6} ${top} ${-hw + 2} ${top + 6} Z`));
      addH('capelli', 'd', P(`M-8 ${top + 4} L-4 ${top - 7} L-2 ${top - 7} L-5 ${top + 4} Z`));
    }
    // accessori della testa
    if (C.accessori.includes('alloro')) {
      for (let a = 0; a < 7; a++) {
        const t = Math.PI * (1.08 + a * 0.14), x = Math.cos(t) * (hw + 4), y = top + 14 + Math.sin(t) * 12;
        addH('accessorio', a % 2 ? 'b' : 's', P(`M${x - 6} ${y} Q${x} ${y - 7} ${x + 6} ${y} Q${x} ${y + 5} ${x - 6} ${y} Z`));
        addH('accessorio', 'l', P(`M${x - 4} ${y - 1} Q${x} ${y - 5} ${x + 3} ${y - 2} Q${x} ${y - 3} ${x - 4} ${y - 1} Z`));
      }
    }
    if (C.accessori.includes('cuffie')) {
      addH('accessorio', 's', P(`M${-hw - 8} ${ey + 8} C${-hw - 12} ${top - 30} ${hw + 12} ${top - 30} ${hw + 8} ${ey + 8} L${hw + 3} ${ey + 8} C${hw + 6} ${top - 23} ${-hw - 6} ${top - 23} ${-hw - 3} ${ey + 8} Z`));
      addH('accessorio', 'b', P(`M${-hw - 15} ${ey - 5} h13 v24 h-13 Z`));
      addH('accessorio', 's', P(`M${hw + 2} ${ey - 5} h13 v24 h-13 Z`));
      addH('accessorio', 'l', P(`M${-hw - 13} ${ey - 3} h3 v20 h-3 Z`));
      addH('accessorio', 'd', P(`M${hw + 11} ${ey - 5} h4 v24 h-4 Z`));
    }
    if (C.accessori.includes('occhiali')) {
      addH('montatura', 'b', P(`M${-ex - 10} ${ey - 7} h19 v14 h-19 Z M${-ex - 8} ${ey - 5} v10 h15 v-10 Z M${ex - 9} ${ey - 7} h19 v14 h-19 Z M${ex - 7} ${ey - 5} v10 h15 v-10 Z M-4 ${ey - 3} h8 v2 h-8 Z`), { rule: 'evenodd' });
      addH('vetro', 'b', P(`M${-ex - 7} ${ey - 4} l5 0 l-4 8 l-2 0 Z M${ex - 6} ${ey - 4} l5 0 l-4 8 l-2 0 Z`), { colore: 'rgba(255,255,255,0.45)' });
    }
    L.push(...head);
    if (dietroDavanti === 'testa') dietroBraccio();

    // ---- braccio che gesticola, davanti
    const ps = [S - 12, -166];
    add('abito', 'b', limb(ps, gomito, polso, 14, 12, 9));
    add('abito', 's', limbShade(ps, gomito, polso, 14, 12, 9));
    add('camicia', 'b', ell(polso[0], polso[1], 7, 4.5));
    const hy = polso[1] - (polso[1] < -140 ? 2 : -10);
    addMano(mano(tipoMano, polso[0], hy, 1), [polso[0], hy]);
    return { pezzi: L, perno: piv, inclina, corpo: C.corpo || { x: 1, y: 1 }, mento, curvo: C.curvo || 0 };
  }

  /* =====================================================================
     DISEGNO: la chiave "Stencil · Manifesto"
     ===================================================================== */
  const buffers = new Map();
  function buffer (key, w, h) {
    let b = buffers.get(key);
    if (!b || b.width !== w || b.height !== h) { b = document.createElement('canvas'); b.width = w; b.height = h; buffers.set(key, b); }
    return b;
  }
  const EXTRA = { denti: '#f7f3ea', bianco: '#f4efe4', guance: '#e0503f' };
  function mixHex (a, b, t) { const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
  function colore (C, pezzo, st) {
    if (pezzo.colore) return pezzo.colore;
    if (pezzo.mat === 'guance') return pezzo.tono === 's' ? null : 'rgba(224,80,63,0.3)';
    let base = C.colori[pezzo.mat] || EXTRA[pezzo.mat];
    if (base && pezzo.mat === 'pelle' && st && st.espressione === 'arrabbiato') base = mixHex(base, '#d7263d', 0.32);
    return base ? toni(base)[pezzo.tono] : null;
  }
  // ogni pezzo al suo posto: il corpo con le proporzioni della scheda, la
  // testa (che resta grande, come nelle caricature) sul collo e inclinata,
  // le mani ingrandite sul polso come nei manifesti
  const MANO = 1.3;
  function piazza (g, pz, fig) {
    const { x: bx, y: by } = fig.corpo;
    if (pz.gruppo === 'testa') {
      g.translate(0, (by - 1) * fig.mento + fig.curvo);
      g.translate(fig.perno[0], fig.perno[1]); g.rotate(fig.inclina); g.translate(-fig.perno[0], -fig.perno[1]);
    } else if (pz.gruppo === 'mano') {
      const [ax, ay] = pz.ancora;
      g.translate(ax * bx, ay * by); g.scale(MANO, MANO); g.translate(-ax, -ay);
    } else g.scale(bx, by);
  }
  function stendi (g, C, fig, st) {
    fig.pezzi.forEach(pz => {
      const col = colore(C, pz, st); if (!col) return;
      g.save(); piazza(g, pz, fig);
      g.fillStyle = col;
      if (pz.testo) { g.font = `700 ${pz.size}px "Barlow Condensed","Arial Narrow",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(pz.testo, pz.x, pz.y); }
      else { if (pz.clip) { g.beginPath(); g.rect(...pz.clip); g.clip(); } g.fill(pz.p, pz.rule || 'nonzero'); }
      g.restore();
    });
  }
  // la sagoma intera in un solo colore (per il bordo di luce dei tagli e per le ombre)
  function sagoma (g, fig, col) {
    g.fillStyle = col;
    fig.pezzi.forEach(pz => {
      if (!pz.p || pz.colore || pz.mat === 'guance') return;
      g.save(); piazza(g, pz, fig); g.fill(pz.p, pz.rule || 'nonzero'); g.restore();
    });
  }

  /* disegna(g, scheda, stato, luce, scala): scala = pixel per unità.
     Con la luce, il personaggio va su un livello a parte: si tinge col colore
     della luce principale, si scurisce se è debole, e i tagli gli accendono
     il bordo sui due lati. */
  function disegna (g, C, st, luce) {
    const fig = costruisci(C, st);
    // leggero ondeggiare del corpo sui piedi
    const sway = Math.sin(st.t * 1.3) * 0.008 + (st.parla > 0.1 ? Math.sin(st.t * 5) * 0.004 : 0);
    if (!luce) { g.save(); g.rotate(sway); stendi(g, C, fig, st); g.restore(); return; }
    const m = g.getTransform(), W = g.canvas.width, H = g.canvas.height;
    const lay = buffer('lay', W, H), lg = lay.getContext('2d');
    lg.setTransform(1, 0, 0, 1, 0, 0); lg.clearRect(0, 0, W, H);
    lg.setTransform(m); lg.rotate(sway);
    // bordo di luce dei tagli: la sagoma spostata a sinistra e a destra, sotto il personaggio
    if (luce.taglio) {
      const [r, gg, b] = luce.taglio, a = 0.9 * (luce.intensitaTaglio ?? 1);
      lg.save(); lg.translate(-2.2, -0.6); sagoma(lg, fig, `rgba(${r},${gg},${b},${a})`); lg.restore();
      lg.save(); lg.translate(2.2, -0.6); sagoma(lg, fig, `rgba(${r},${gg},${b},${a})`); lg.restore();
    }
    // il personaggio, tinto dalla luce principale
    const pl = buffer('pl', W, H), pg = pl.getContext('2d');
    pg.setTransform(1, 0, 0, 1, 0, 0); pg.clearRect(0, 0, W, H);
    pg.setTransform(m); pg.rotate(sway); stendi(pg, C, fig, st);
    pg.setTransform(1, 0, 0, 1, 0, 0);
    const mask = buffer('mask', W, H), mg = mask.getContext('2d');
    mg.globalCompositeOperation = 'copy'; mg.drawImage(pl, 0, 0);
    const [kr, kg, kb] = luce.chiave, I = luce.intensita ?? 1;
    pg.globalCompositeOperation = 'multiply'; pg.fillStyle = `rgb(${kr},${kg},${kb})`; pg.fillRect(0, 0, W, H);
    pg.globalCompositeOperation = 'source-atop'; pg.fillStyle = `rgba(6,8,22,${(1 - I) * 0.85})`; pg.fillRect(0, 0, W, H);
    pg.globalCompositeOperation = 'destination-in'; pg.drawImage(mask, 0, 0);
    pg.globalCompositeOperation = 'source-over';
    lg.setTransform(1, 0, 0, 1, 0, 0); lg.drawImage(pl, 0, 0);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(lay, 0, 0); g.restore();
  }

  // ritratto a mezzo busto in un canvas (header, carte, mixer): la testa riempie il riquadro
  function ritratto (cv, C, espressione) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    const by = C.corpo ? C.corpo.y : 1, cy = C.mento * by + (C.curvo || 0) - C.viso.h * 0.42, k = H / 100;
    g.translate(W / 2, H * 0.5 - cy * k); g.scale(k, k);
    disegna(g, C, { t: 0.4, gesto: 0.15, parla: 0, batte: false, espressione: espressione || 'normale' });
  }

  return { SCHEDE, toni, costruisci, disegna, ritratto, ESPRESSIONI: ['normale', 'arrabbiato', 'sorpreso', 'contento'] };
})();
if (typeof window !== 'undefined') window.Personaggi = Personaggi;
