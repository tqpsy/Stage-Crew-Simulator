/* Menù di gioco e salvataggio: nuova partita col nome del tecnico e la
   scelta tra tre service dai nomi assurdi (sempre nuovi),
   salvataggio automatico, ricarica della pagina e Continua, impostazioni
   che restano, Nuova partita che azzera il livello ma tiene impostazioni
   e record (i dati per i futuri highscore).

   Uso:  node tests/salvataggio.js
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 } });
  const p = await ctx.newPage();
  if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const problems = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  const open = async () => {
    await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
    await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  };
  const ev = (fn, arg) => p.evaluate(fn, arg);

  // ---- primo avvio: niente salvataggio, si chiede il nome del tecnico
  // e si sceglie tra tre service
  await open();
  check(await p.isVisible('#player-input'), 'al primo avvio manca il campo del nome');
  check(!(await p.isVisible('#menu-resume')), 'al primo avvio c\'è Continua senza partita');
  check(await p.$$eval('#service-offers .offer-card', cs => cs.length) === 3, 'non ci sono tre offerte di lavoro');
  const offers = await ev(() => draft.offers);
  check(new Set(offers.map(o => o.name)).size === 3, 'due service con lo stesso nome: ' + offers.map(o => o.name));
  check(new Set(offers.map(o => o.logo.bg)).size === 3, 'due service con lo stesso colore: ' + offers.map(o => o.logo.bg));
  check(new Set(offers.map(o => o.kind)).size === 3, 'due service con la stessa specialità');
  check(offers.every(o => o.name.length <= 28 && o.boss), 'offerta incompleta: ' + JSON.stringify(offers));
  check(new Set(offers.map(o => o.boss.split(' ')[0])).size === 3, 'due capi con lo stesso nome: ' + offers.map(o => o.boss));
  check(await p.$$eval('#service-offers canvas', cs => cs.every(c => c.width > 0)), 'manca l\'anteprima di un marchio');
  // tanti sorteggi di fila: mai un nome già proposto prima
  const many = await ev(() => { let used = []; for (let i = 0; i < 150; i++) used = serviceOffers(used).map(o => o.name).concat(used); return { n: used.length, uniq: new Set(used.map(serviceKey)).size }; });
  check(many.n === 450 && many.uniq === 450, 'nomi di service ripetuti: ' + JSON.stringify(many));
  check(await ev(() => logoFromName('Service Rossi').bg) === '#e0503f', '"Rossi" non dà il rosso');
  check(await ev(() => logoFromName('Power').icon) === 'fulmine', '"Power" non dà il fulmine');
  // il simbolo del logo racconta una parola del nome, sempre
  const noIcon = await ev(() => SERVICE_WORDS.nouns.map(n => n[0]).concat(SERVICE_WORDS.whole).filter(w => !LOGO_ICONS[logoFromName(w).icon]));
  check(!noIcon.length, 'parole senza simbolo nel logo: ' + noIcon);
  check(offers.every(o => o.logo.icon !== 'iniziali'), 'un service proposto ha le iniziali invece di un simbolo: ' + offers.map(o => o.name + '=' + o.logo.icon));
  const icons = await ev(() => ['Fratelli Gaffer Srl', 'Karaoke & Riverbero', 'Macchina del Fumo Live', 'Tutto Esaurito Sound', 'Subwoofer Ruggente S.p.A.'].map(n => logoFromName(n).icon));
  check(JSON.stringify(icons) === JSON.stringify(['nastro', 'microfono', 'fumo', 'biglietto', 'cassa']), 'simbolo che non segue il nome: ' + icons);
  check(await ev(() => serviceInitials('Larsen & Diva S.n.c.')) === 'LD', 'iniziali sbagliate');
  // senza nome o senza service non si parte
  check(await p.$eval('#new-start', b => b.disabled), 'si può iniziare senza nome né service');
  await p.type('#player-input', 'Wasd');      // W, A, S, D non devono sparire
  check(await p.inputValue('#player-input') === 'Wasd', 'nel nome non si scrivono tutte le lettere: ' + await p.inputValue('#player-input'));
  check(await p.$eval('#new-start', b => b.disabled), 'si può iniziare senza scegliere il service');
  await p.click('#service-offers [data-offer="1"]');
  check(await p.$eval('#service-offers [data-offer="1"]', b => b.classList.contains('sel')), 'service scelto non evidenziato');
  await p.click('#new-start');
  check(!(await p.isVisible('#menu-modal')), 'il menù resta aperto dopo Inizia');
  // prima del montaggio la scaletta della serata: si parte dal montaggio,
  // lo spettacolo è ancora da venire; si riapre dal tasto in testata
  check(await p.isVisible('#schedule-modal'), 'dopo Inizia manca la scaletta della serata');
  check(await p.textContent('#schedule-list .sched-row.now') !== null && /Montaggio/.test(await p.textContent('#schedule-list .sched-row.now')), 'la scaletta non dice che adesso si monta');
  check((await p.$$('#schedule-list .sched-row.done')).length === 1, 'la scaletta segna fatte fasi non giocate');
  await p.click('#schedule-go');
  check(!(await p.isVisible('#schedule-modal')), 'la scaletta resta aperta dopo Al lavoro');
  check(await ev(() => window.__scene.input.enabled), 'la scena resta bloccata dopo la scaletta');
  await p.click('#schedule-btn');
  check(await p.isVisible('#schedule-modal') && (await p.textContent('#schedule-go')) === 'Torna al palco', 'il tasto in testata non riapre la scaletta');
  await p.click('#schedule-close');
  const pick = offers[1], svc = pick.name.toUpperCase();
  const prof = await ev(() => ({ player: Profile.data.player, service: Profile.data.service, logo: Profile.data.logo, info: Profile.data.serviceInfo, used: Profile.data.usedServices }));
  check(prof.player === 'Wasd' && prof.service === pick.name && JSON.stringify(prof.logo) === JSON.stringify(pick.logo), 'tecnico o service non salvati: ' + JSON.stringify(prof));
  check(prof.info.kind === pick.kind && prof.info.boss === pick.boss, 'specialità o capo non salvati');
  check(offers.every(o => prof.used.includes(o.name)), 'i nomi proposti non sono segnati come già usati');
  check(await p.innerHTML('#service-logo') !== '', 'logo non in testata');
  check(await p.textContent('#service-tag') === 'WASD · ' + svc + ' · REPUTAZIONE 0', 'tecnico, service o reputazione non in testata: ' + await p.textContent('#service-tag'));
  await p.waitForFunction(n => window.__scene.livery && window.__scene.livery.name === n, svc);
  check(await ev(() => window.__scene.livery.logo.bg) === pick.logo.bg, 'logo non sul furgone');
  await p.waitForFunction(() => window.__scene.brandKey && window.__scene.textures.exists(window.__scene.brandKey));

  // ---- un po' di impianto: pezzi, un cavo, Quadro armato, mixer acceso
  await ev(() => {
    const S = window.__scene;
    const P = (ty, gx, gy) => { const w = gridToScreen(gx + .5, gy + .5); S.placeComponentAt(ty, w.x, w.y); };
    P('quadro', 4, 2); P('mixer', 7, 5); P('par', 2, 5);
    const q = placedOfType('quadro')[0].id;
    selectCable('cee_tri'); openRearPanel('allaccio'); onRearPortClick('allaccio', 'out'); openRearPanel(q); onRearPortClick(q, 'in'); if (rearPanelId) closeRearPanel();
    selectCable('cee_powercon'); openRearPanel(q); onRearPortClick(q, 'out_1'); const m = placedOfType('mixer')[0].id; openRearPanel(m); onRearPortClick(m, 'power'); if (rearPanelId) closeRearPanel();
    ['main', 'rcd', 'L1'].forEach(k => toggleProtection(k));
    toggleDevicePower(m);
    S.runSystemTest();                    // fallisce: un test in più nelle statistiche
  });
  const before = await ev(() => ({ placed: Object.keys(gameState.placed).sort(), edges: gameState.edges.length, on: placedOfType('mixer')[0].on, prot: { ...findQuadro().prot, tripped: undefined }, tests: gameState.stats.tests, failed: gameState.stats.failedTests }));
  check(before.edges === 2 && before.on && before.tests === 1 && before.failed === 1, 'preparazione non riuscita: ' + JSON.stringify(before));

  // ---- impostazioni dal menù: il nome del tecnico si può correggere
  await p.click('#menu-btn');
  await p.click('#menu-settings');
  await p.fill('#set-volume', '30');
  await p.check('#set-reduced');
  await p.fill('#set-player', 'Marco');
  await p.press('#set-player', 'Tab');
  await p.click('#settings-back');
  await p.click('#menu-resume');
  check(/^MARCO · /.test(await p.textContent('#service-tag')), 'rinomina non applicata');
  // reputazione: il collaudo è una fase completata (+5) e conta una volta
  // sola; un guasto gestito male la fa scendere, ma mai sotto lo 0;
  // un apparecchio rotto non conta (non è colpa del giocatore)
  const gains = await ev(() => {
    const g = [addRecord(), addRecord()];
    g.push(addReputation(REP.faultFixedFast, 'guasto risolto in fretta'));
    g.push(addReputation(REP.deviceBroken, 'finale rotto'));
    g.push(addReputation(REP.faultByJanitor, 'guasto trovato dal bidello'));
    return { g, total: reputation(), log: Profile.data.reputation.log.length };
  });
  check(JSON.stringify(gains) === JSON.stringify({ g: [5, 0, 3, 0, -5], total: 3, log: 4 }), 'reputazione sbagliata: ' + JSON.stringify(gains));
  const floor = await ev(() => { const d = addReputation(REP.feedback, 'larsen'); return { d, total: reputation() }; });
  check(floor.d === -3 && floor.total === 0, 'la reputazione va sotto lo 0: ' + JSON.stringify(floor));
  await ev(() => addReputation(REP.beerRefused, 'birra rifiutata'));
  check(await ev(() => REP.slowChange) === -5, 'manca la regola del cambio palco lento');
  // dopo il collaudo la scaletta segna fatti montaggio e test impianto
  check(await ev(() => { renderSchedule(); return document.querySelectorAll('#schedule-list .sched-row.done').length; }) === 3, 'la scaletta non segna il collaudo fatto');
  check(await p.textContent('#service-tag') === 'MARCO · ' + svc + ' · REPUTAZIONE 5', 'reputazione non in testata: ' + await p.textContent('#service-tag'));
  await p.waitForTimeout(1500);          // un po' di tempo di gioco e il salvataggio differito

  // ---- ricarica: Continua riporta tutto com'era
  await open();
  check(await p.isVisible('#menu-resume'), 'dopo la ricarica manca Continua');
  check((await p.textContent('#menu-resume')) === 'Continua · Marco · ' + pick.name + ' · ★ 5', 'Continua non dice nome, service e reputazione: ' + await p.textContent('#menu-resume'));
  await p.click('#menu-resume');
  const after = await ev(() => ({ placed: Object.keys(gameState.placed).sort(), edges: gameState.edges.length, on: placedOfType('mixer')[0].on, prot: { ...findQuadro().prot, tripped: undefined }, tests: gameState.stats.tests, failed: gameState.stats.failedTests, playMs: gameState.stats.playMs, vol: SFX.volume, reduced: reducedFx(), undo: el('#undo-btn').disabled, conn: el('#conn-val').textContent, logo: Profile.data.logo }));
  await p.waitForFunction(n => window.__scene.livery && window.__scene.livery.name === n, svc);
  check(JSON.stringify(after.placed) === JSON.stringify(before.placed), 'pezzi diversi dopo la ricarica: ' + after.placed);
  check(after.edges === before.edges, 'cavi diversi dopo la ricarica');
  check(after.on === true, 'mixer spento dopo la ricarica');
  check(JSON.stringify(after.prot) === JSON.stringify(before.prot), 'protezioni del Quadro diverse dopo la ricarica');
  check(after.tests === 1 && after.failed === 1 && after.playMs >= 1000, 'statistiche perse: ' + JSON.stringify(after));
  check(after.vol === 0.3 && after.reduced, 'impostazioni perse');
  check(after.undo, 'dopo la ricarica si può annullare oltre il salvataggio');
  check(JSON.stringify(after.logo) === JSON.stringify(pick.logo), 'logo perso dopo la ricarica: ' + JSON.stringify(after.logo));

  // ---- Nuova partita: livello da capo, impostazioni e record restano
  await p.click('#menu-btn');
  await p.click('#menu-new');
  check(await p.isVisible('#new-warning'), 'manca l\'avviso prima di ricominciare');
  const offers2 = await ev(() => draft.offers.map(o => o.name));
  check(offers2.every(n => !offers.some(o => o.name === n)), 'la nuova partita ripropone un service già visto: ' + offers2);
  check(await p.inputValue('#player-input') === 'Marco', 'il nome del tecnico non è proposto di nuovo');
  await p.fill('#player-input', 'Nuova Tecnica');
  await p.click('#service-offers [data-offer="0"]');
  await p.click('#new-start');
  await p.click('#schedule-go');
  const fresh = await ev(() => ({ placed: Object.keys(gameState.placed), edges: gameState.edges.length, tests: gameState.stats.tests, vol: SFX.volume, recs: (Profile.data.records[LEVEL_ID] || []).length, rep: reputation() }));
  check(fresh.placed.length === 1 && fresh.edges === 0 && fresh.tests === 0, 'Nuova partita non azzera il livello: ' + JSON.stringify(fresh));
  check(fresh.vol === 0.3 && fresh.recs === 2, 'Nuova partita perde impostazioni o record: ' + JSON.stringify(fresh));
  check(fresh.rep === 0, 'il nuovo tecnico non parte da reputazione 0');

  // ---- salvataggio della versione 1 (reputazione 100-150 per livello): si converte
  // (prima si lascia finire il salvataggio in corso e si spegne quello
  // all'uscita dalla pagina, che altrimenti riscriverebbe il profilo attuale)
  await p.waitForTimeout(400);
  await ev(() => { Profile.flush = () => {}; localStorage.setItem('scs-save', JSON.stringify({ v: 1, service: 'Vecchio', settings: { volume: 0.5 }, level: null, records: {}, reputation: { total: 150, byLevel: { 1: 150 } } })); });
  await open();
  const conv = await ev(() => ({ v: Profile.data.v, rep: reputation(), once: Profile.data.reputation.earned['L1:collaudo'], vol: SFX.volume, again: (gameActive = true, addRecord()) }));
  check(JSON.stringify(conv) === JSON.stringify({ v: 3, rep: 5, once: 5, vol: 0.5, again: 0 }), 'conversione dalla versione 1 sbagliata: ' + JSON.stringify(conv));

  // ---- salvataggio della versione 2 (giocatore titolare del service): il
  // service diventa il datore di lavoro, la reputazione resta al tecnico
  await p.waitForTimeout(400);
  await ev(() => { Profile.flush = () => {}; localStorage.setItem('scs-save', JSON.stringify({ v: 2, service: 'Service Rossi', logo: { shape: 'scudo', icon: 'faro', bg: '#e0503f', fg: '#eee9df', style: 'tour' }, settings: { volume: 0.5 }, level: null, records: {}, reputation: { total: 12, earned: {}, log: [] } })); });
  await open();
  const conv2 = await ev(() => ({ v: Profile.data.v, rep: reputation(), service: serviceName(), player: playerName(), used: Profile.data.usedServices, bg: serviceLogo().bg }));
  check(JSON.stringify(conv2) === JSON.stringify({ v: 3, rep: 12, service: 'Service Rossi', player: 'Tecnico', used: ['Service Rossi'], bg: '#e0503f' }), 'conversione dalla versione 2 sbagliata: ' + JSON.stringify(conv2));

  console.log('PROBLEMI:', JSON.stringify(problems, null, 1));
  console.log('ERRORI JS:', errs);
  await b.close();
  const ok = !problems.length && !errs.length;
  console.log(ok ? 'SALVATAGGIO OK' : 'SALVATAGGIO FALLITO');
  process.exit(ok ? 0 : 1);
})();
