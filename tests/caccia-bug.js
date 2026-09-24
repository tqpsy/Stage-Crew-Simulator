/* Caccia ai bug: un giocatore "scimmia" fa migliaia di azioni a caso
   (posa, sposta, cancella, cavi giusti e sbagliati, scollega, Quadro,
   accensioni, annulla/ripeti, reset, salvataggio e ripristino) e dopo OGNI
   azione si controlla che lo stato del gioco resti coerente:

   - i cavi collegano pezzi e prese che esistono, un OUT con un IN, con un
     cavo adatto a entrambe le prese, una sola spina per presa (tranne le
     uscite multiple del Quadro), niente anelli;
   - magazzino + pezzi posati = dotazione del livello;
   - celle occupate, pezzi disegnati e pezzi montati (top su sub, PAR su
     stativo, …) coerenti in entrambi i versi;
   - contatori in testata uguali a quello che il gioco calcola;
   - chi "va" è anche alimentato;
   - annulla + ripeti riporta esattamente allo stesso stato;
   - salvataggio + ripristino riporta esattamente allo stesso stato;
   - nessun errore JavaScript.

   Uso:  node tests/caccia-bug.js [partite] [azioni] [seme]   (default 20 150 1)
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
const N = parseInt(process.argv[2] || '20', 10);
const STEPS = parseInt(process.argv[3] || '150', 10);
const SEED0 = parseInt(process.argv[4] || '1', 10);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 1000 } });
  if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  const t0 = Date.now();
  const res = await p.evaluate(async ({ N, STEPS, SEED0 }) => {
    const S = window.__scene;
    const out = { games: 0, actions: {}, bugs: {} };
    const bug = (kind, detail) => { const l = out.bugs[kind] = out.bugs[kind] || []; if (l.length < 5) l.push(detail); };
    // stato "pulito" da confrontare: niente campi di disegno (_pts, …)
    const clean = o => JSON.parse(JSON.stringify(o, (k, v) => k.startsWith('_') ? undefined : v));
    const snap = () => JSON.stringify(clean({ placed: gameState.placed, edges: gameState.edges, stock: gameState.stock }));
    // primo punto in cui due stati (in JSON) differiscono
    const diff = (a, b, at = '') => {
      if (JSON.stringify(a) === JSON.stringify(b)) return null;
      if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return at + ': ' + JSON.stringify(a) + ' → ' + JSON.stringify(b);
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = diff(a[k], b[k], at + '.' + k); if (d) return d; }
      return null;
    };
    const cableOK = (cable, sig) => CABLE_TYPES[cable] && CABLE_TYPES[cable].endpoints.includes(sig);

    const check = (seed, step, act) => {
      const at = seed + '/' + step + ' dopo ' + act;
      const P = gameState.placed;
      // --- cavi
      const used = {};
      gameState.edges.forEach(e => {
        const A = P[e.a], B = P[e.b];
        if (!A || !B) return bug('cavo verso un pezzo che non c\'è', at + ': ' + JSON.stringify(e));
        const pa = getPortDef(e.a, e.aPort), pb = getPortDef(e.b, e.bPort);
        if (!pa || !pb) return bug('cavo su una presa che non esiste', at + ': ' + JSON.stringify(e));
        if (pa.dir !== 'out' || pb.dir !== 'in') bug('cavo non va da OUT a IN', at + ': ' + e.a + '.' + e.aPort + '(' + pa.dir + ') -> ' + e.b + '.' + e.bPort + '(' + pb.dir + ')');
        if (!cableOK(e.signal, pa.signal) || !cableOK(e.signal, pb.signal)) bug('cavo che non entra nella presa', at + ': ' + e.signal + ' ' + pa.signal + '->' + pb.signal);
        // le uscite del Quadro (multi) accettano più cavi per scelta di gioco
        [[e.a, e.aPort, pa], [e.b, e.bPort, pb]].forEach(([c, pt, def]) => { if (def.multi) return; const k = c + '.' + pt; used[k] = (used[k] || 0) + 1; });
      });
      Object.entries(used).filter(([, n]) => n > 1).forEach(([k, n]) => bug('due spine nella stessa presa', at + ': ' + k + ' x' + n + ' ' + JSON.stringify(clean(gameState.edges.filter(e => e.a + '.' + e.aPort === k || e.b + '.' + e.bPort === k)))));
      const ids = gameState.edges.map(e => e.id);
      if (new Set(ids).size !== ids.length) bug('id di cavo doppio', at);
      if (gameState.edges.some(e => e.id > gameState.edgeSeq)) bug('edgeSeq indietro rispetto ai cavi', at);
      // anelli per famiglia (corrente / audio / dmx)
      const fams = {};
      gameState.edges.forEach(e => { const f = cableFamily(e.signal); (fams[f] = fams[f] || []).push(e); });
      Object.entries(fams).forEach(([f, es]) => {
        const adj = {}; es.forEach(e => (adj[e.a] = adj[e.a] || []).push(e.b));
        const state = {};
        const dfs = n => { state[n] = 1; for (const m of adj[n] || []) { if (state[m] === 1) return true; if (!state[m] && dfs(m)) return true; } state[n] = 2; return false; };
        if (Object.keys(adj).some(n => !state[n] && dfs(n))) bug('anello di cavi', at + ': famiglia ' + f);
      });
      // --- magazzino
      Object.entries(AVAILABLE_STOCK).forEach(([ty, n]) => {
        const posati = Object.values(P).filter(c => c.type === ty).length;
        if (gameState.stock[ty] + posati !== n) bug('magazzino sballato', at + ': ' + ty + ' stock=' + gameState.stock[ty] + ' posati=' + posati + ' dotazione=' + n);
        if (gameState.stock[ty] < 0) bug('magazzino negativo', at + ': ' + ty);
      });
      // --- celle, disegni, montaggi
      Object.values(P).forEach(c => {
        if (/NaN|undefined|null/.test(c.id) || gameState.placed[c.id] !== c) bug('id di pezzo non valido', at + ': ' + c.id);
        (c.cells || []).forEach(k => { if (S.occupied[k] !== c.id) bug('cella del pezzo non segnata come occupata', at + ': ' + c.id + ' ' + k + ' -> ' + S.occupied[k]); });
        if (c.type !== 'allaccio' && !S.compVisuals[c.id]) bug('pezzo posato senza disegno', at + ': ' + c.id);
        const m = MOUNTS[c.type];
        if (m) {
          const base = P[c[m.back]];
          if (base && base[m.link] !== c.id) bug('montaggio a senso unico', at + ': ' + c.id + ' su ' + base.id + ' che regge ' + base[m.link]);
        }
        const t = MOUNT_ON[c.type];
        if (t && c[MOUNTS[t].link]) {
          const top = P[c[MOUNTS[t].link]];
          if (!top) bug('base che regge un pezzo sparito', at + ': ' + c.id + ' -> ' + c[MOUNTS[t].link]);
          else if (top[MOUNTS[t].back] !== c.id) bug('montaggio a senso unico', at + ': ' + c.id + ' regge ' + top.id + ' che sta su ' + top[MOUNTS[t].back]);
        }
      });
      Object.entries(S.occupied).forEach(([k, id]) => {
        if (!P[id]) bug('cella occupata da un pezzo che non c\'è', at + ': ' + k + ' -> ' + id);
        else if (!(P[id].cells || []).includes(k)) bug('cella occupata non del pezzo', at + ': ' + k + ' -> ' + id);
      });
      Object.keys(S.compVisuals).forEach(id => { if (!P[id]) bug('disegno di un pezzo che non c\'è', at + ': ' + id); });
      // --- testata
      const r = runValidation();
      if (el('#conn-val').textContent !== r.madeCount + ' / ' + r.totalCount) bug('contatore cablaggi non aggiornato', at + ': mostra ' + el('#conn-val').textContent + ', vale ' + r.madeCount + ' / ' + r.totalCount);
      if (r.madeCount > r.totalCount) bug('cablaggi oltre il totale', at);
      const kw = (totalPowerUsedW() / 1000).toFixed(2).replace('.', ',');
      if (!el('#power-val').textContent.startsWith(kw + ' ')) bug('potenza in testata non aggiornata', at + ': mostra ' + el('#power-val').textContent + ', vale ' + kw);
      // --- corrente
      Object.keys(P).forEach(id => { if (isRunning(id) && !isPowered(id)) bug('acceso senza corrente', at + ': ' + id); });
    };

    for (let g = 0; g < N; g++) {
      const seed = SEED0 + g;
      let st = seed * 2654435761 >>> 0;
      const rng = () => { st = (st + 0x6D2B79F5) >>> 0; let x = st; x = Math.imul(x ^ x >>> 15, x | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return ((x ^ x >>> 14) >>> 0) / 4294967296; };
      const pick = a => a[Math.floor(rng() * a.length)];
      S.resetLevel(true);
      out.games++;
      const placedIds = () => Object.keys(gameState.placed).filter(id => gameState.placed[id].type !== 'allaccio');
      const cell = () => gridToScreen(Math.floor(rng() * VENUE_W) + .5, Math.floor(rng() * VENUE_H) + .5);
      const allPorts = () => Object.values(gameState.placed).flatMap(c => (COMPONENT_TYPES[c.type].ports || []).map(pt => ({ c: c.id, pt })));
      const actions = {
        place: () => {
          const tys = Object.keys(gameState.stock).filter(t => gameState.stock[t] > 0);
          if (!tys.length) return;
          const ty = pick(tys), n0 = gameState.stock[ty];
          // qualche tentativo: molte celle a caso sono fuori dalla zona del pezzo
          for (let i = 0; i < 12 && gameState.stock[ty] === n0; i++) { const w = cell(); S.placeComponentAt(ty, w.x, w.y); }
        },
        mount: () => {
          // top su un sub libero, PAR su uno stativo libero (e simili)
          const bases = Object.values(gameState.placed).filter(c => MOUNT_ON[c.type] && !c[MOUNTS[MOUNT_ON[c.type]].link] && gameState.stock[MOUNT_ON[c.type]] > 0);
          if (!bases.length) return;
          const base = pick(bases), v = S.compVisuals[base.id].container;
          S.placeComponentAt(MOUNT_ON[base.type], v.x, v.y);
        },
        remove: () => { const ids = placedIds(); if (ids.length) S.deleteComponent(pick(ids)); },
        move: () => {
          const ids = placedIds(); if (!ids.length) return;
          const id = pick(ids);
          if (COMPONENT_TYPES[gameState.placed[id].type].zone === 'fixed') return;
          S.enterAssembly(id, true); S.moveSelected = id;
          const w = cell(); S.attemptMoveTo(w.x, w.y); S.exitAssembly();
        },
        wire: () => {
          // una presa a caso e, metà delle volte, una presa compatibile
          const ports = allPorts(); if (ports.length < 2) return;
          const A = pick(ports);
          const cables = Object.keys(CABLE_TYPES).filter(k => cableOK(k, A.pt.signal));
          const cable = pick(cables.length ? cables : Object.keys(CABLE_TYPES));
          const fits = ports.filter(x => x !== A && x.pt.dir !== A.pt.dir && cableOK(cable, x.pt.signal));
          const B = rng() < 0.5 && fits.length ? pick(fits) : pick(ports);
          const leads = CABLE_TYPES[cable] && (A.pt.lead || B.pt.lead);
          if (!leads) selectCable(cable);
          for (const x of rng() < 0.5 ? [A, B] : [B, A]) { openRearPanel(x.c); onRearPortClick(x.c, x.pt.id); }
          if (rearPanelId) closeRearPanel();
          S.cancelPending();
        },
        unwire: () => { if (!gameState.edges.length) return; S.selectedEdgeId = pick(gameState.edges).id; S.deleteSelectedEdge(); },
        power: () => { const sw = Object.values(gameState.placed).filter(c => SWITCHABLE.has(c.type)); if (sw.length) toggleDevicePower(pick(sw).id); },
        quadro: () => { if (findQuadro()) toggleProtection(pick(['main', 'rcd', 'L1', 'L2', 'L3'])); },
        dmx: () => { const pars = placedOfType('par'); if (pars.length) { pick(pars).dmx = { addr: 1 + Math.floor(rng() * 512), mode: Math.floor(rng() * 3) }; S.pushHistory(); } },
        test: () => { S.runSystemTest(); },
        undoRedo: () => {
          // annulla e ripeti devono tornare allo stesso identico stato
          const before = snap();
          if (S.historyIndex <= 0) return;
          S.undo(); S.redo();
          const after = snap();
          if (after !== before) bug('annulla + ripeti cambia lo stato', seed + ': ' + diff(JSON.parse(before), JSON.parse(after)));
        },
        undo: () => S.undo(),
        saveLoad: () => {
          // salvataggio + ripristino devono tornare allo stesso stato
          const before = snap();
          const lv = JSON.parse(JSON.stringify({ id: LEVEL_ID, placed: gameState.placed, edges: gameState.edges, stock: gameState.stock, nextIndex: gameState.nextIndex, edgeSeq: gameState.edgeSeq, trips: gameState.trips || 0, rcdTrips: gameState.rcdTrips || 0, procErrors: gameState.procErrors || [], stats: gameState.stats }));
          S.loadLevel(lv);
          const after = snap();
          if (after !== before) bug('salva + ripristina cambia lo stato', seed + ': ' + diff(JSON.parse(before), JSON.parse(after)));
        },
        reset: () => { if (rng() < 0.2) S.resetLevel(true); }
      };
      const weights = { place: 14, mount: 6, remove: 4, move: 6, wire: 30, unwire: 6, power: 8, quadro: 6, dmx: 3, test: 3, undoRedo: 5, undo: 3, saveLoad: 3, reset: 1 };
      const bag = Object.entries(weights).flatMap(([k, w]) => Array(w).fill(k));
      for (let s = 0; s < STEPS; s++) {
        const act = pick(bag);
        out.actions[act] = (out.actions[act] || 0) + 1;
        const e0 = gameState.edges.length;
        try { actions[act](); }
        catch (e) { bug('eccezione in ' + act, seed + '/' + s + ': ' + e.message); }
        if (typeof S.stopFx === 'function') S.stopFx();
        check(seed, s, act + (gameState.edges.length > e0 ? ' (+cavo ' + JSON.stringify(gameState.edges[gameState.edges.length - 1]) + ')' : ''));
        if (s % 25 === 0) await new Promise(r => setTimeout(r, 0));
      }
    }
    return out;
  }, { N, STEPS, SEED0 });
  console.log(JSON.stringify(res, null, 1));
  console.log('ERRORI JS:', errs.slice(0, 10), errs.length > 10 ? '(e altri ' + (errs.length - 10) + ')' : '');
  console.log('tempo: ' + Math.round((Date.now() - t0) / 1000) + ' s');
  await b.close();
  const kinds = Object.keys(res.bugs);
  if (kinds.length || errs.length) { console.log('CACCIA: trovati ' + kinds.length + ' tipi di bug'); process.exit(1); }
  console.log('CACCIA OK: ' + res.games + ' partite x ' + STEPS + ' azioni, nessuna incoerenza');
})();
