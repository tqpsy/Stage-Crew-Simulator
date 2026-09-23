/* Collaudo automatico del livello 1: genera a caso cablaggi VALIDI (catene
   PAR e DMX in qualunque ordine, fasi a scelta, ciabatte sì o no, PC dal
   Quadro con l'adattatore, due universi, L/R scambiati un numero pari di
   volte, pezzi tolti e rimessi, giocatore che accende tutto prima di cablare
   e poi rimedia) e verifica che il Test impianto li promuova tutti; poi
   introduce un errore alla volta e verifica che venga bocciato col messaggio
   giusto.

   Uso:  node tests/collaudo-livello1.js [partite] [seme]
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
const N = parseInt(process.argv[2] || '40', 10), SEED0 = parseInt(process.argv[3] || '1', 10);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 1000 } });
  if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  const res = await p.evaluate(async ({ N, SEED0 }) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const out = { valid: 0, validFail: [], mut: {}, mutBad: [], wireFail: [] };
    for (let t = 0; t < N; t++) {
      const seed = SEED0 + t;
      let st = seed * 2654435761 >>> 0;
      const rng = () => { st = (st + 0x6D2B79F5) >>> 0; let x = st; x = Math.imul(x ^ x >>> 15, x | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return ((x ^ x >>> 14) >>> 0) / 4294967296; };
      const pick = a => a[Math.floor(rng() * a.length)];
      const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const S = window.__scene;
      S.resetLevel();
      const P = (ty, gx, gy) => { const w = gridToScreen(gx + .5, gy + .5); S.placeComponentAt(ty, w.x, w.y); };
      const subSpots = shuffle([[1, 8], [7, 8]]);
      P('sub', ...subSpots[0]); P('sub', ...subSpots[1]); P('top', 1, 8); P('top', 7, 8);
      P('mixer', 7, 5); P('ampli', 6, 4); P('controller', 7, 7);
      shuffle([[2, 5], [3, 5], [4, 5], [5, 5]]).forEach(s => P('par', ...s));
      P('quadro', 4, 2); P('ciabatta_cee', 6, 2); P('ciabatta', 3, 13); P('pc', 4, 13); P('scheda', 5, 13);
      if (rng() < 0.5) {
        const ty = pick(['par', 'mixer', 'pc', 'scheda', 'ampli', 'controller']);
        const c = pick(placedOfType(ty)); const g = [c.gx, c.gy];
        S.deleteComponent(c.id); P(ty, g[0], g[1]);
      }
      const left = Object.entries(gameState.stock).filter(([k, v]) => v > 0);
      if (left.length) { out.wireFail.push(seed + ' stock ' + JSON.stringify(left)); continue; }
      const one = ty => placedOfType(ty)[0].id;
      const Q = one('quadro'), CC = one('ciabatta_cee'), CV = one('ciabatta'), PC = one('pc'), SC = one('scheda'), MX = one('mixer'), AM = one('ampli'), CT = one('controller');
      let ok = true;
      const wire = (cable, A, ap, B, bp, leadFirst) => {
        const n = gameState.edges.length;
        let order = rng() < 0.5 ? [[A, ap], [B, bp]] : [[B, bp], [A, ap]];
        if (leadFirst) order = [[B, bp], [A, ap]];
        if (cable) selectCable(cable);
        for (const [c, pp] of order) { openRearPanel(c); onRearPortClick(c, pp); }
        if (rearPanelId) closeRearPanel();
        if (gameState.edges.length !== n + 1) {
          ok = false;
          out.wireFail.push(seed + ' ' + cable + ' ' + A + '.' + ap + ' -> ' + B + '.' + bp + ': ' + el('#toast').textContent);
          S.cancelPending();
        }
      };
      const desc = [];
      wire('cee_tri', 'allaccio', 'out', Q, 'in');
      // giocatore disordinato: arma il Quadro e accende tutto PRIMA di cablare
      const chaos = rng() < 0.3;
      if (chaos) {
        desc.push('disordinato');
        ['main', 'rcd', 'L1', 'L2', 'L3'].forEach(k => toggleProtection(k));
        Object.values(gameState.placed).filter(c => SWITCHABLE.has(c.type)).forEach(c => toggleDevicePower(c.id));
      }
      // ---- corrente
      const qOut = () => pick(['out_1', 'out_2', 'out_3']);
      const schukoFree = [];
      const loadsOnStrip = [];
      const useCee = rng() < 0.6, useCiv = rng() < 0.5;
      // PC: da una ciabatta o dal Quadro con l'adattatore
      const pcFrom = pick(['q', ...(useCee ? ['cee'] : []), ...(useCiv ? ['civ'] : [])]);
      if (useCee) { wire(null, Q, qOut(), CC, 'in', true); for (let i = 1; i <= 4; i++) schukoFree.push([CC, 'out_' + i]); }
      if (useCiv) {
        if (useCee && rng() < 0.5) { const o = schukoFree.splice(Math.floor(rng() * schukoFree.length), 1)[0]; wire(null, o[0], o[1], CV, 'in', true); desc.push('civ<-cee'); }
        else { wire('cee_schuko', Q, qOut(), CV, 'in'); desc.push('civ<-Q'); }
        for (let i = 1; i <= 3; i++) schukoFree.push([CV, 'out_' + i]);
      }
      const takeSchuko = pref => { const i = schukoFree.findIndex(x => !pref || x[0] === pref); return i >= 0 ? schukoFree.splice(i, 1)[0] : null; };
      if (pcFrom === 'q') wire('cee_schuko', Q, qOut(), PC, 'power');
      else { const o = takeSchuko(pcFrom === 'cee' ? CC : CV); wire(null, o[0], o[1], PC, 'power', true); }
      desc.push('pc<-' + pcFrom);
      // strip used only if something is on it: if a strip was placed in use but got no load, give it one below
      const feed = (id, port) => {
        const o = schukoFree.length && rng() < 0.4 ? schukoFree.splice(Math.floor(rng() * schukoFree.length), 1)[0] : null;
        if (o) wire('schuko_powercon', o[0], o[1], id, port); else wire('cee_powercon', Q, qOut(), id, port);
      };
      [MX, CT, AM, ...placedOfType('sub').map(c => c.id)].forEach(id => feed(id, 'power'));
      const pars = shuffle(placedOfType('par').map(c => c.id));
      const nch = 1 + Math.floor(rng() * 3);
      const cuts = new Set(shuffle([1, 2, 3]).slice(0, nch - 1));
      let prev = null;
      pars.forEach((id, i) => { if (i === 0 || cuts.has(i)) feed(id, 'power_in'); else wire('powercon', prev, 'power_thru', id, 'power_in'); prev = id; });
      // una ciabatta collegata ma senza nulla sopra? allora la si scollega (resta posata)
      [CC, CV].forEach(id => {
        const hasLoad = gameState.edges.some(e => e.a === id);
        const plugged = gameState.edges.find(e => e.b === id);
        if (plugged && !hasLoad) { S.selectedEdgeId = plugged.id; S.deleteSelectedEdge(); }
      });
      // ---- audio (L/R scambiati un numero pari di volte)
      wire(null, PC, 'usb', SC, 'usb', true);
      const s1 = rng() < 0.3, s2 = rng() < 0.3, s3 = s1 !== s2;
      wire('jack', SC, 'out_L', MX, s1 ? 'in_6' : 'in_5'); wire('jack', SC, 'out_R', MX, s1 ? 'in_5' : 'in_6');
      wire('xlr', MX, 'main_L', AM, s2 ? 'in_R' : 'in_L'); wire('xlr', MX, 'main_R', AM, s2 ? 'in_L' : 'in_R');
      const subs = subsLeftToRight();
      wire('speakon', AM, s3 ? 'out_R' : 'out_L', subs[0].id, 'spk_in'); wire('speakon', AM, s3 ? 'out_L' : 'out_R', subs[1].id, 'spk_in');
      subs.forEach(sb => wire('speakon', sb.id, 'spk_thru', sb.hasTop, 'spk_in'));
      desc.push('swap' + (+s1) + (+s2) + (+s3));
      // ---- DMX: 1 o 2 catene (una per universo)
      const dp = shuffle(placedOfType('par').map(c => c.id));
      const two = rng() < 0.5; const cut = two ? 1 + Math.floor(rng() * 3) : 99;
      const u1 = pick(['dmx_1', 'dmx_2']), u2 = u1 === 'dmx_1' ? 'dmx_2' : 'dmx_1';
      dp.forEach((id, i) => { if (i === 0) wire('dmx', CT, u1, id, 'dmx_in'); else if (i === cut) wire('dmx', CT, u2, id, 'dmx_in'); else wire('dmx', dp[i - 1], 'dmx_thru', id, 'dmx_in'); });
      // indirizzi: per universo in fila o a gruppi identici
      const byU = {};
      placedOfType('par').forEach(c => { const u = dmxUniverse(c.id); (byU[u] = byU[u] || []).push(c); });
      Object.values(byU).forEach(list => {
        const mode = Math.floor(rng() * 3), n = [3, 4, 8][mode];
        const grouped = rng() < 0.25; let addr = 1 + Math.floor(rng() * 100);
        list.forEach(c => { c.dmx = { addr, mode: grouped ? mode : Math.floor(rng() * 3) }; if (!grouped) addr += [3, 4, 8][c.dmx.mode] + Math.floor(rng() * 3); });
        if (grouped) list.forEach(c => c.dmx.mode = mode);
      });
      if (!ok) continue;
      // ---- accensione: quadro (fasi usate, le altre a caso), poi apparecchi, i pesanti uno alla volta
      const used = new Set(Object.keys(gameState.placed).map(id => phaseOf(id)).filter(Boolean));
      const pr0 = quadroProt(findQuadro());
      ['main', 'rcd', 'L1', 'L2', 'L3'].forEach(k => { if (k.startsWith('L') && !used.has(k) && rng() < 0.5) return; if (!pr0[k]) toggleProtection(k); });
      const sw = Object.values(gameState.placed).filter(c => SWITCHABLE.has(c.type) && (!/^ciabatta/.test(c.type) || gameState.edges.some(e => e.a === c.id)));
      const heavy = sw.filter(c => INRUSH_FACTOR[c.type]), light = sw.filter(c => !INRUSH_FACTOR[c.type]);
      light.sort((a, b) => (/^ciabatta/.test(b.type) ? 1 : 0) - (/^ciabatta/.test(a.type) ? 1 : 0));
      const lightsFirst = rng() < 0.8;
      light.sort((a, b) => (/^ciabatta/.test(b.type) ? 1 : 0) - (/^ciabatta/.test(a.type) ? 1 : 0));
      if (lightsFirst) light.forEach(c => { if (!c.on) toggleDevicePower(c.id); });
      for (const c of shuffle(heavy)) { if (!c.on) { toggleDevicePower(c.id); await sleep(760); } }
      if (!lightsFirst) light.forEach(c => { if (!c.on) toggleDevicePower(c.id); });
      await sleep(50);
      const test = () => { S.runSystemTest(); return { status: el('#circuit-text').textContent, msg: el('#toast').textContent }; };
      let r = test();
      if (r.status !== 'IMPIANTO OK' && gameState.trips) {
        // si rimedia come dice il messaggio: spegni i pesanti, riarma, riaccendi uno alla volta
        desc.push('recupero');
        heavy.forEach(c => { if (c.on) toggleDevicePower(c.id); });
        const q = findQuadro(); const pr = quadroProt(q);
        ['main', 'rcd', 'L1', 'L2', 'L3'].forEach(k => { if (!pr[k] && (k === 'main' || k === 'rcd' || used.has(k))) toggleProtection(k); });
        light.forEach(c => { if (!c.on) toggleDevicePower(c.id); });
        for (const c of heavy) { toggleDevicePower(c.id); await sleep(760); }
        r = test();
        out.recovered = (out.recovered || 0) + (r.status === 'IMPIANTO OK' ? 1 : 0);
      }
      out.rcd = (out.rcd || 0) + (gameState.rcdTrips ? 1 : 0);
      if (r.status !== 'IMPIANTO OK') { out.validFail.push(seed + ' [' + desc.join(' ') + '] ' + r.msg + ' | trips=' + gameState.trips + ' conta=' + el('#conn-val').textContent); continue; }
      if (el('#conn-val').textContent !== '24 / 24') out.validFail.push(seed + ' contatore ' + el('#conn-val').textContent);
      out.valid++;
      // ---- una mutazione
      const muts = ['cut', 'stereo', 'off', 'overlap', 'group', 'mcbUsed', 'mcbUnused', 'otherUni'];
      const m = pick(muts);
      let expect = 'fail', expectMsg = null;
      if (m === 'cut') { const e = pick(gameState.edges); S.selectedEdgeId = e.id; S.deleteSelectedEdge(); }
      else if (m === 'stereo') {
        gameState.edges.filter(e => e.a === SC && e.signal === 'jack').forEach(e => { S.selectedEdgeId = e.id; S.deleteSelectedEdge(); });
        wire('jack', SC, 'out_L', MX, s1 ? 'in_5' : 'in_6'); wire('jack', SC, 'out_R', MX, s1 ? 'in_6' : 'in_5'); expectMsg = /Stereo invertito/;
      } else if (m === 'off') { toggleDevicePower(pick(sw).id); expectMsg = /spenti o senza corrente|salvavita|TUMP/; }
      else if (m === 'overlap' || m === 'group') {
        const list = Object.values(byU).find(l => l.length >= 2);
        if (!list) continue;
        const [a, c] = list;
        if (m === 'overlap') { c.dmx = { addr: a.dmx.addr + 1, mode: a.dmx.mode }; expectMsg = /sovrapposti/; }
        else { c.dmx = { addr: a.dmx.addr, mode: a.dmx.mode }; list.forEach(x => { if (x !== a && x !== c) x.dmx.addr = 300 + list.indexOf(x) * 10; }); expect = 'pass'; }
      } else if (m === 'otherUni') {
        const us = Object.values(byU); if (us.length < 2) continue;
        us[1][0].dmx = { addr: us[0][0].dmx.addr + 1, mode: us[0][0].dmx.mode };
        us[1].forEach((x, i) => { if (i) x.dmx.addr = 400 + i * 10; });
        expect = 'pass';
      } else if (m === 'mcbUsed') { toggleProtection(pick([...used])); }
      else if (m === 'mcbUnused') { const un = ['L1', 'L2', 'L3'].filter(x => !used.has(x)); if (!un.length) continue; const q = findQuadro(); un.forEach(x => { if (quadroProt(q)[x]) toggleProtection(x); }); expect = 'pass'; }
      const r2 = test();
      const passed = r2.status === 'IMPIANTO OK';
      out.mut[m] = (out.mut[m] || 0) + 1;
      if ((expect === 'pass') !== passed || (expectMsg && !passed && !expectMsg.test(r2.msg))) out.mutBad.push(seed + ' ' + m + ' atteso ' + expect + ': ' + r2.status + ' / ' + r2.msg);
    }
    return out;
  }, { N, SEED0 });
  console.log(JSON.stringify(res, null, 1));
  console.log('ERRORI JS:', errs);
  await b.close();
  const bad = res.validFail.length + res.mutBad.length + res.wireFail.length + errs.length;
  console.log(bad ? 'COLLAUDO FALLITO' : 'COLLAUDO OK: ' + res.valid + ' cablaggi validi promossi, ' + Object.values(res.mut).reduce((a, b) => a + b, 0) + ' errori bocciati');
  process.exit(bad ? 1 : 0);
})();
