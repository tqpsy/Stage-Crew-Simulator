/* Personaggi interi per la vista S1 dello scarico (dall'alto inclinata), in
   piedi. Sono i RIPIEGHI: lo stile del gioco è l'action figure (foto vere,
   vedi personaggi/direzione-artistica.md); finché un personaggio non ha la sua
   immagine si usa il suo ritratto a caricatura di oggi (busto <symbol> 100×140
   di Gerry, Macio e Topsy), allungato con pancia, gambe e braccia.
   FIGURE_S1.svg(chi, opt, livrea) -> SVG intero, viewBox 0 0 100 228, piedi in (50, 226).
   chi: topsy | macio | gerry | kid | kid2.  opt: back (di spalle),
   arms 'giu' | 'avanti' | 'porta', step (passo -1..1). */
(function () {
  let LIV = { bg: '#1c3a5e', fg: '#f2a541' };
  const SH = 'M2 140 L6 104 Q12 92 32 88 Q50 84 68 88 Q88 92 94 104 L98 140 Z';   // spalle comuni
  const HEAD = {
    topsy: `
  <path d="M38 72 L62 72 L63 90 Q50 95 37 90 Z" fill="#d6a487"/>
  <ellipse cx="20" cy="52" rx="5" ry="8.5" fill="#d6a487"/><ellipse cx="80" cy="52" rx="5" ry="8.5" fill="#d6a487"/>
  <path d="M50 1 Q80 1 81 34 Q82 58 73 72 Q62 86 50 86 Q38 86 27 72 Q18 58 19 34 Q20 1 50 1 Z" fill="#e6b597"/>
  <path d="M50 1 Q80 1 81 34 Q82 58 73 72 Q66 80 58 84 Q74 60 74 34 Q73 8 50 1 Z" fill="#d9a184" opacity=".7"/>
  <ellipse cx="40" cy="13" rx="12" ry="5" fill="#f6d5bf" opacity=".85"/>
  <path d="M19.5 42 Q18 60 26 74 Q36 92 50 96 Q64 92 74 74 Q82 60 80.5 42 Q78 56 70 61 Q62 58.5 50 59.5 Q38 58.5 30 61 Q22 56 19.5 42 Z" fill="#1f1b1a"/>
  <path d="M43 89 Q50 97.5 57 89 Q50 92 43 89 Z" fill="#7a6b63"/>
  <path d="M43 70 Q50 73 57 70" stroke="#8a4a3c" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M28 39 L45 41 M55 41 L72 39" stroke="#2a2420" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="37" cy="48.5" rx="5" ry="3" fill="#f6efe6"/><ellipse cx="63" cy="48.5" rx="5" ry="3" fill="#f6efe6"/>
  <circle cx="38" cy="48.5" r="2.1" fill="#4a3424"/><circle cx="62" cy="48.5" r="2.1" fill="#4a3424"/>
  <path d="M48 46 Q46 56 44 60 Q47 63 50 62.5 Q53 63 56 60 Q54 56 52 46 Z" fill="#d39a7d"/>
  <g fill="none" stroke="#3f9a63" stroke-width="2.2"><circle cx="37" cy="48.5" r="8.6" fill="#ffffff14"/><circle cx="63" cy="48.5" r="8.6" fill="#ffffff14"/>
    <path d="M45.6 47.5 Q50 45 54.4 47.5 M28.4 47 L20.5 45 M71.6 47 L79.5 45"/></g>`,
    macio: `
  <path d="M38 72 L62 72 L63 90 Q50 95 37 90 Z" fill="#d9a07c"/>
  <ellipse cx="21" cy="52" rx="5" ry="8.5" fill="#d9a07c"/><ellipse cx="79" cy="52" rx="5" ry="8.5" fill="#d9a07c"/>
  <path d="M50 1 Q79 1 80 34 Q81 58 72 72 Q62 86 50 86 Q38 86 28 72 Q19 58 20 34 Q21 1 50 1 Z" fill="#e9b391"/>
  <path d="M50 1 Q79 1 80 34 Q81 58 72 72 Q66 80 58 84 Q73 60 73 34 Q72 8 50 1 Z" fill="#dba07e" opacity=".7"/>
  <ellipse cx="40" cy="13" rx="12" ry="5" fill="#f8d6bd" opacity=".85"/>
  <path d="M27 39 L45 42.5 M55 42.5 L73 39" stroke="#2a2420" stroke-width="4.2" stroke-linecap="round"/>
  <ellipse cx="37" cy="48.5" rx="5.2" ry="3" fill="#f6efe6"/><ellipse cx="63" cy="48.5" rx="5.2" ry="3" fill="#f6efe6"/>
  <circle cx="38" cy="48.5" r="2.1" fill="#4a3424"/><circle cx="62" cy="48.5" r="2.1" fill="#4a3424"/>
  <path d="M48 45 Q46 57 44 62 Q47 66 50 65 Q53 66 56 62 Q54 57 52 45 Z" fill="#d8997a"/>
  <path d="M26 75 Q32 62 50 65.5 Q68 62 74 75 Q64 69.5 50 71.5 Q36 69.5 26 75 Z" fill="#2a2420"/>`,
    gerry: `
  <rect x="34" y="76" width="32" height="14" rx="4" fill="#cf8c68"/>
  <ellipse cx="16" cy="56" rx="5" ry="8" fill="#cf8c68"/><ellipse cx="84" cy="56" rx="5" ry="8" fill="#cf8c68"/>
  <path d="M50 4 Q76 4 78 34 Q86 50 86 64 Q86 86 50 92 Q14 86 14 64 Q14 50 22 34 Q24 4 50 4 Z" fill="#e8a883"/>
  <path d="M50 4 Q76 4 78 34 Q86 50 86 64 Q86 82 62 90 Q80 70 78 52 Q74 20 50 4 Z" fill="#d9946f" opacity=".7"/>
  <ellipse cx="44" cy="17" rx="11" ry="5" fill="#f4c7a4"/>
  <path d="M34 10 Q44 3 56 5 M40 12 Q50 6 62 8" stroke="#7d7570" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  <path d="M14 58 Q8 38 16 26 Q22 20 28 20 Q22 32 22 44 Q20 52 20 58 Z" fill="#7d7570"/>
  <path d="M86 58 Q92 38 84 26 Q78 20 72 20 Q78 32 78 44 Q80 52 80 58 Z" fill="#7d7570"/>
  <path d="M28 40 Q36 33 44 38 M56 36 Q64 29 72 36" stroke="#5f5752" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M30 48 Q37 43.5 44 47.5 Q37 50 30 48 Z M56 47 Q63 42.5 70 47.5 Q63 49.5 56 47 Z" fill="#f4e8de"/>
  <circle cx="38" cy="47" r="1.9" fill="#6d8a92"/><circle cx="64" cy="46.4" r="1.9" fill="#6d8a92"/>
  <path d="M30 48 Q37 43 44 47.5 M56 47.5 Q63 42.5 70 47.5" stroke="#2a1d12" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M47 46 Q45 56 42 61 Q40 68 50 68 Q60 68 58 61 Q55 56 53 46 Z" fill="#d6926c"/>
  <path d="M38 62 Q28 68 31 79 M62 62 Q73 66 72 74" stroke="#c07e5c" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M30 75 Q48 94 73 68 Q52 77 30 75 Z" fill="#5e2220"/>
  <path d="M33 75.6 Q52 78.4 70 69.6 L68 73.6 Q52 82 35 79 Z" fill="#fbfaf5"/>`,
    kid: hair => `
  <rect x="40" y="72" width="20" height="16" rx="4" fill="#e2b08c"/>
  <ellipse cx="18" cy="54" rx="5" ry="8" fill="#e2b08c"/><ellipse cx="82" cy="54" rx="5" ry="8" fill="#e2b08c"/>
  <ellipse cx="50" cy="46" rx="32" ry="40" fill="#f0c6a2"/>
  <path d="M18 40 Q16 8 50 6 Q84 8 82 40 Q74 22 50 24 Q30 22 18 40 Z" fill="${hair}"/>
  <path d="M30 40 L44 41 M56 41 L70 40" stroke="#3a2a1f" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="38" cy="50" rx="5.5" ry="4" fill="#fff"/><ellipse cx="62" cy="50" rx="5.5" ry="4" fill="#fff"/>
  <circle cx="39" cy="50.5" r="2.4" fill="#3a2a1f"/><circle cx="61" cy="50.5" r="2.4" fill="#3a2a1f"/>
  <path d="M48 54 Q47 60 46 62 Q50 64 54 62 Q53 60 52 54 Z" fill="#dfa886"/>
  <path d="M40 70 Q50 78 60 70 Q50 73 40 70 Z" fill="#7a2a24"/>`
  };
  // retro della testa: pelle, orecchie, e quello che si vede da dietro (punte dei baffi, barba, stanghette)
  const BACK = {
    topsy: `<path d="M38 72 L62 72 L63 90 Q50 95 37 90 Z" fill="#c9967a"/><ellipse cx="20" cy="52" rx="5" ry="8.5" fill="#d6a487"/><ellipse cx="80" cy="52" rx="5" ry="8.5" fill="#d6a487"/>
      <path d="M19.5 46 Q20 64 28 76 L72 76 Q80 64 80.5 46 Z" fill="#1f1b1a"/>
      <path d="M50 1 Q80 1 81 34 Q82 58 73 72 Q62 82 50 82 Q38 82 27 72 Q18 58 19 34 Q20 1 50 1 Z" fill="#dcab8e"/>
      <path d="M27 72 Q38 80 50 80 Q62 80 73 72 Q62 76 50 76 Q38 76 27 72 Z" fill="#c9967a"/>
      <ellipse cx="44" cy="12" rx="13" ry="5" fill="#efc9b1" opacity=".8"/><path d="M20.5 45 L28 47 M79.5 45 L72 47" stroke="#3f9a63" stroke-width="2.2"/>`,
    macio: `<path d="M38 72 L62 72 L63 90 Q50 95 37 90 Z" fill="#cd946f"/><ellipse cx="21" cy="52" rx="5" ry="8.5" fill="#d9a07c"/><ellipse cx="79" cy="52" rx="5" ry="8.5" fill="#d9a07c"/>
      <path d="M50 1 Q79 1 80 34 Q81 58 72 72 Q62 84 50 84 Q38 84 28 72 Q19 58 20 34 Q21 1 50 1 Z" fill="#dfa886"/>
      <ellipse cx="44" cy="12" rx="13" ry="5" fill="#f8d6bd" opacity=".8"/><path d="M22 73 L28 70 M78 73 L72 70" stroke="#2a2420" stroke-width="4" stroke-linecap="round"/>`
  };
  // vestiti: colore maglia, ombra, pantaloni, scarpe, dettagli del busto
  const CLOTH = {
    topsy: { tee: '#141418', teeDk: '#1d1e23', pants: '#17181c', pantsDk: '#0f1013', shoe: '#2b2c30', skin: '#d6a487', glove: '#16171a' },
    macio: { tee: LIV.bg, teeDk: '#16304e', pants: '#2b2d33', pantsDk: '#212328', shoe: '#1b1c20', skin: '#d9a07c' },
    gerry: { tee: '#2f5d8a', teeDk: '#23476b', pants: '#3b3f47', pantsDk: '#2f333a', shoe: '#2a2420', skin: '#cf8c68' },
    kid:   { tee: '#ff7a59', teeDk: '#e2613f', pants: '#2f4f86', pantsDk: '#25406e', shoe: '#f4f1ea', skin: '#e2b08c' },
    kid2:  { tee: '#7ad3ff', teeDk: '#58b8e6', pants: '#3a3d46', pantsDk: '#2e3038', shoe: '#e05a4a', skin: '#c9946e' }
  };

  /* opt: back (di spalle), arms: 'giu' | 'avanti' (maniglie) | 'porta' (case davanti alla pancia), step (fase del passo -1..1) */
  function figura (who, opt = {}) {
    const kid = who.startsWith('kid'), c = CLOTH[who], back = !!opt.back;
    const step = opt.step || 0, belly = who === 'macio' ? 7 : who === 'gerry' ? 4 : 0;
    let o = '';
    // gambe (corte), con il passo
    const lx = 50 - 17, rx = 50 + 3, legTop = 168, foot = 220;
    const l1 = step * 4, l2 = -step * 4;
    o += `<path d="M${lx} ${legTop} h14 l${l1 * 0.5} ${foot - legTop - 4} h-15 Z" fill="${c.pants}"/>`;
    o += `<path d="M${rx} ${legTop} h14 l${l2 * 0.5} ${foot - legTop - 4} h-15 Z" fill="${c.pantsDk}"/>`;
    o += `<path d="M${lx - 3 + l1 * 0.5} ${foot - 6} h19 q4 0 4 5 v3 h-23 Z" fill="${c.shoe}"/>`;
    o += `<path d="M${rx - 1 + l2 * 0.5} ${foot - 6} h19 q4 0 4 5 v3 h-23 Z" fill="${c.shoe}"/>`;
    if (who === 'topsy' && !back) o += `<path d="M${lx - 3} ${legTop + 8} h9 v20 h-9 Z" fill="#0d0e10"/><path d="M${lx - 3} ${legTop + 12} h17" stroke="#26272c" stroke-width="2"/>`;   // cosciale a destra (sinistra di chi guarda)
    // braccia dietro al corpo se di spalle o tese avanti
    const arm = (side, kind) => {
      const sx = side < 0 ? 12 : 88, sy = 110;
      let ex, ey;
      if (kind === 'avanti' && side > 0) { ex = 108; ey = 128; }
      else if (kind === 'porta') { ex = side < 0 ? 16 : 84; ey = 150; }
      else { ex = side < 0 ? 6 - belly * 0.4 : 94 + belly * 0.4; ey = 160; }
      return `<path d="M${sx} ${sy} L${ex} ${ey}" stroke="${c.skin}" stroke-width="15" stroke-linecap="round"/>` +
        (who === 'topsy' ? `<circle cx="${ex}" cy="${ey + 2}" r="7.5" fill="${c.glove}"/><path d="M${ex - 4} ${ey + 7} h8" stroke="${c.skin}" stroke-width="3" stroke-linecap="round"/>` : `<circle cx="${ex}" cy="${ey + 2}" r="7" fill="${c.skin}"/>`) +
        (who === 'topsy' && side < 0 && !back ? `<path d="M${sx + (ex - sx) * 0.55 - 7} ${sy + (ey - sy) * 0.55} h14" stroke="#2a2420" stroke-width="4"/><path d="M${sx + (ex - sx) * 0.85 - 7} ${sy + (ey - sy) * 0.85} h14" stroke="#101114" stroke-width="4.5"/>` : '');
    };
    const ak = opt.arms || 'giu';
    if (back && ak === 'avanti') o += arm(-1, ak) + arm(1, ak);
    // busto: spalle del ritratto + pancia fino alla cintura
    o += `<path d="${SH}" fill="${c.tee}"/>`;
    o += `<path d="M2 138 Q${2 - belly} ${150} ${6 - belly * 0.3} 168 L${94 + belly * 0.3} 168 Q${98 + belly} 150 98 138 Z" fill="${c.tee}"/>`;
    o += `<path d="M98 138 Q${98 + belly} 150 ${94 + belly * 0.3} 168 L74 168 Q84 150 80 110 Q90 112 94 104 Z" fill="${c.teeDk}" opacity=".85"/>`;   // ombra a destra
    // maniche corte
    o += `<path d="M2 120 L6 104 Q10 96 18 93 L26 118 Z" fill="${c.teeDk}"/><path d="M98 120 L94 104 Q90 96 82 93 L74 118 Z" fill="${c.teeDk}"/>`;
    o += `<rect x="${6 - belly * 0.3}" y="163" width="${88 + belly * 0.6}" height="7" fill="${who === 'topsy' ? '#0b0c0e' : who === 'macio' ? '#15161a' : c.teeDk}"/>`;   // cintura
    if (!back) {
      if (who === 'macio') o += `<circle cx="34" cy="116" r="6.5" fill="${LIV.fg}"/><path d="M30.5 116 h7 M34 112.5 v7" stroke="${LIV.bg}" stroke-width="1.6"/><path d="M38 88 Q50 97 62 88" stroke="${CLOTH.macio.teeDk}" stroke-width="3" fill="none"/>`;
      if (who === 'topsy') o += `<path d="M37 90 Q50 99 63 90" stroke="#2b2c33" stroke-width="3.4" fill="none"/><rect x="74" y="160" width="14" height="17" rx="2" fill="#0d0e10"/>`;   // tasca alla cintura a sinistra
      if (who === 'gerry') o += `<path d="M34 88 L50 112 L66 88 L58 86 L50 98 L42 86 Z" fill="#23476b"/><path d="M40 88 L50 106 L60 88 L54 86 L50 94 L46 86 Z" fill="#a9c8e8"/><rect x="64" y="112" width="15" height="12" rx="1.5" fill="#23476b"/><rect x="67" y="108" width="2" height="8" rx="1" fill="#e9c23f"/>`;
    } else if (who === 'macio') o += `<text x="50" y="122" text-anchor="middle" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-weight="800" font-size="10" fill="${LIV.fg}">${LIV.name || "SERVICE"}</text>`;
    else if (who === 'topsy') o += `<rect x="12" y="160" width="14" height="17" rx="2" fill="#0d0e10"/>`;
    if (!back || ak !== 'avanti') o += arm(-1, ak) + arm(1, ak);
    // testa
    o += back ? (BACK[who] || HEAD[who]) : (kid ? HEAD.kid(who === 'kid' ? '#5a3a22' : '#20170f') : HEAD[who]);
    return `<g>${o}</g>`;
  }
  function svg (who, opt, liv) {
    if (liv) { LIV = liv; CLOTH.macio.tee = liv.bg; CLOTH.macio.teeDk = shade(liv.bg); }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 228" width="300" height="684">${figura(who, opt || {})}</svg>`;
  }
  // ombra della maglia: un po' più scura (o più chiara, se la maglia è quasi nera)
  function shade (hex) {
    const n = parseInt(hex.slice(1).replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3'), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const k = (r + g + b) / 3 < 50 ? 1.6 : 0.78, f = v => Math.max(0, Math.min(255, Math.round(v * k + (k > 1 ? 8 : 0))));
    return '#' + ((f(r) << 16) | (f(g) << 8) | f(b)).toString(16).padStart(6, '0');
  }
  window.FIGURE_S1 = { svg };
})();
