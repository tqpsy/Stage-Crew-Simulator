/* Menù di gioco e salvataggio: nuova partita col nome del tecnico e la
   scelta tra tre service dai nomi assurdi (sempre nuovi),
   salvataggio automatico, ricarica della pagina e Continua, impostazioni
   che restano, Nuova partita in un altro slot che tiene impostazioni
   e record (i dati per i futuri highscore). Slot: elenco con service,
   logo, livello, reputazione e data; cambio di slot, cancellazione con
   conferma, esporta/importa (con controllo di formato e versione), slot
   pieni. Scelta del livello con le soglie di reputazione. Conversioni dei
   vecchi salvataggi a slot unico (versioni 1-4): la partita diventa il
   primo slot.

   Uso:  node tests/salvataggio.js
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 }, acceptDownloads: true });
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
  check(await p.textContent('#schedule-list .sched-row.now') !== null && /scarico/.test(await p.textContent('#schedule-list .sched-row.now')), 'la scaletta non dice che adesso si scarica');
  check((await p.$$('#schedule-list .sched-row.done')).length === 0, 'la scaletta segna fatte fasi non giocate');
  await p.click('#schedule-go');
  check(!(await p.isVisible('#schedule-modal')), 'la scaletta resta aperta dopo Al lavoro');
  check(await p.isVisible('#scarico-frame'), 'dopo la scaletta non parte lo scarico');
  check(!(await ev(() => window.__scene.input.enabled)), 'durante lo scarico la scena prende i tocchi');
  // lo scarico si apre sopra il gioco: qui si salta dal suo tasto
  await p.waitForSelector('#scarico-frame');
  await p.frameLocator('#scarico-frame').locator('#btn-skip').click();
  await p.waitForFunction(() => !document.querySelector('#scarico-frame'));
  const sk = await ev(() => ({ s: Profile.data.scarico, par: gameState.stock.par, req: parsRequired(), rep: reputation() }));
  check(sk.s && sk.s.skipped && sk.s.beers === 0 && sk.par === 4 && sk.req === 4 && sk.rep === 0, 'scarico saltato sbagliato: ' + JSON.stringify(sk));
  check(await ev(() => { renderSchedule(); return /Montaggio/.test(el('#schedule-list .sched-row.now').textContent) && document.querySelectorAll('#schedule-list .sched-row.done').length === 1; }), 'dopo lo scarico la scaletta non passa al montaggio');
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
    P('quadro', 4, 2); P('tavolo', 7, 5); { const v = S.compVisuals.tavolo_1.container; S.placeComponentAt('mixer', v.x, v.y); } P('par', 2, 5);
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

  // ---- Nuova partita: in un altro slot, livello da capo, impostazioni e record restano
  await ev(() => { Profile.data.assistant = { id: 'nico', favors: 1 }; });
  await p.click('#menu-btn');
  await p.click('#menu-new');
  check(await p.isVisible('#new-warning') && /slot 2/.test(await p.textContent('#new-warning')), 'manca l\'avviso con lo slot della nuova partita: ' + await p.textContent('#new-warning'));
  const offers2 = await ev(() => draft.offers.map(o => o.name));
  check(offers2.every(n => !offers.some(o => o.name === n)), 'la nuova partita ripropone un service già visto: ' + offers2);
  check(await p.inputValue('#player-input') === 'Marco', 'il nome del tecnico non è proposto di nuovo');
  await p.fill('#player-input', 'Nuova Tecnica');
  await p.click('#service-offers [data-offer="0"]');
  await p.click('#new-start');
  await p.click('#schedule-go');
  // lo scarico si apre sopra il gioco: qui si salta dal suo tasto
  await p.waitForSelector('#scarico-frame');
  await p.frameLocator('#scarico-frame').locator('#btn-skip').click();
  await p.waitForFunction(() => !document.querySelector('#scarico-frame'));
  const fresh = await ev(() => ({ placed: Object.keys(gameState.placed), edges: gameState.edges.length, tests: gameState.stats.tests, vol: SFX.volume, recs: (Profile.data.records[LEVEL_ID] || []).length, rep: reputation(), assistant: Profile.data.assistant }));
  check(JSON.stringify(fresh.assistant) === JSON.stringify({ id: null, favors: 0 }), 'il nuovo tecnico si trova l\'assistente del vecchio: ' + JSON.stringify(fresh.assistant));
  check(fresh.placed.length === 1 && fresh.edges === 0 && fresh.tests === 0, 'Nuova partita non azzera il livello: ' + JSON.stringify(fresh));
  check(fresh.vol === 0.3 && fresh.recs === 2, 'Nuova partita perde impostazioni o record: ' + JSON.stringify(fresh));
  check(fresh.rep === 0, 'il nuovo tecnico non parte da reputazione 0');

  // ---- partite salvate: ogni slot mostra service (con logo), tecnico,
  // livello e fase raggiunti, reputazione e data dell'ultima partita
  await p.waitForTimeout(400);
  await p.click('#menu-btn');
  await p.click('#menu-slots');
  const slotCards = () => p.$$eval('#slot-list .slot-card', cs => cs.map(c => ({ empty: c.classList.contains('empty'), active: c.classList.contains('active'), text: c.textContent, logo: !!c.querySelector('.slot-logo svg') })));
  const cards = await slotCards();
  check(cards.length === 3, 'non ci sono tre slot: ' + cards.length);
  check(!cards[0].empty && cards[0].text.includes(pick.name) && cards[0].text.includes('Marco') && cards[0].logo
    && /Livello 1 · Festa della scuola: Messa in sicurezza dei cavi \(2\/8\)/.test(cards[0].text) && /★ 5/.test(cards[0].text)
    && /Ultima partita: \d/.test(cards[0].text), 'slot 1 incompleto: ' + cards[0].text);
  check(cards[1].active && cards[1].text.includes('Nuova Tecnica') && /in gioco/.test(cards[1].text) && /Montaggio e test impianto \(1\/8\)/.test(cards[1].text) && /★ 0/.test(cards[1].text), 'slot 2 sbagliato: ' + cards[1].text);
  check(cards[2].empty, 'lo slot 3 non è vuoto');

  // ---- scelta del livello: il livello 1 aperto con le sue fasi, gli altri
  // bloccati con la soglia di reputazione e quanto manca
  await p.click('#slots-back');
  await p.click('#menu-levels');
  const levelCards = () => p.$$eval('#level-list .level-card', cs => cs.map(c => ({ locked: c.classList.contains('locked'), text: c.textContent })));
  const lv = await levelCards();
  check(lv.length === 5 && !lv[0].locked && lv.slice(1).every(l => l.locked), 'livelli aperti o bloccati sbagliati: ' + JSON.stringify(lv.map(l => l.locked)));
  check(/Si apre con ★ 20 \(ti mancano 20\)/.test(lv[1].text) && /camion/.test(lv[1].text), 'soglia del livello 2 non mostrata: ' + lv[1].text);
  check(/✓ Arrivo e scarico/.test(lv[0].text) && /▶ Montaggio e test impianto/.test(lv[0].text), 'fasi del livello 1 sbagliate: ' + lv[0].text);
  const thresholds = await ev(() => LEVELS.map(l => l.rep));
  check(thresholds.every((r, i) => !i || r > thresholds[i - 1]), 'soglie non crescenti: ' + thresholds);
  // superata la soglia si apre il livello 2 (in arrivo): puntino sul menù finché non lo si guarda
  await ev(() => addReputation(20, 'prova della soglia'));
  check(await p.$eval('#menu-levels', b => b.classList.contains('news')) && await p.$eval('#menu-btn', b => b.classList.contains('news')), 'nessun segnale del livello appena aperto');
  await p.click('#levels-back');
  await p.click('#menu-levels');
  const lv2 = await levelCards();
  check(!lv2[1].locked && /prossime versioni/.test(lv2[1].text) && lv2[2].locked, 'il livello 2 non si apre a reputazione 20: ' + lv2[1].text);
  check(!(await p.$eval('#menu-btn', b => b.classList.contains('news'))), 'il puntino resta dopo aver visto i livelli');
  await p.click('#levels-back');

  // ---- esporta: un file con firma, versione e solo la partita
  await p.click('#menu-slots');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#slot-list [data-slot="0"] [data-act="export"]')]);
  const file = path.join(os.tmpdir(), 'scs-export-' + process.pid + '.json');
  await dl.saveAs(file);
  const exp = JSON.parse(fs.readFileSync(file, 'utf8'));
  check(exp.kind === 'stage-crew-simulator' && exp.v === 5 && exp.slot.service === pick.name && exp.slot.player === 'Marco' && exp.slot.level && !exp.slot.settings && !exp.slot.records, 'file esportato sbagliato: ' + JSON.stringify(exp).slice(0, 200));
  check(/^stage-crew-.+\.json$/.test(dl.suggestedFilename()), 'nome del file esportato: ' + dl.suggestedFilename());

  // ---- cancella: chiede conferma; "No" non tocca niente
  await p.click('#slot-list [data-slot="0"] [data-act="del"]');
  check(await p.isVisible('#slot-list [data-slot="0"] [data-act="del-yes"]') && /Non si può annullare/.test(await p.textContent('#slot-list [data-slot="0"]')), 'Cancella non chiede conferma');
  await p.click('#slot-list [data-slot="0"] [data-act="del-no"]');
  check(await ev(() => !!Profile.slots()[0]), '"No" ha cancellato la partita');
  await p.click('#slot-list [data-slot="0"] [data-act="del"]');
  await p.click('#slot-list [data-slot="0"] [data-act="del-yes"]');
  check(await ev(() => !Profile.slots()[0] && Profile.active === 1 && gameActive && Profile.data.player === 'Nuova Tecnica'), 'cancellazione sbagliata');
  check((await slotCards())[0].empty, 'lo slot cancellato non risulta vuoto');

  // ---- importa: la partita esportata torna nello slot vuoto
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#slot-list [data-slot="0"] [data-act="import"]')]);
  await fc.setFiles(file);
  await p.waitForFunction(() => !!Profile.slots()[0]);
  fs.unlinkSync(file);
  const imp = await ev(() => { const s = Profile.slots()[0]; return { service: s.service, player: s.player, rep: s.reputation.total, placed: Object.keys(s.level.placed).sort(), logo: s.logo, msg: el('#slot-msg').textContent }; });
  check(imp.service === pick.name && imp.player === 'Marco' && imp.rep === 5 && JSON.stringify(imp.placed) === JSON.stringify(before.placed) && JSON.stringify(imp.logo) === JSON.stringify(pick.logo), 'importazione sbagliata: ' + JSON.stringify(imp));
  check(/importata nello slot 1/.test(imp.msg), 'manca il messaggio dell\'importazione: ' + imp.msg);
  // file sbagliati: non un salvataggio, versione più nuova, rovinato, slot occupato
  const bad = await ev(() => [
    importSlotText(2, 'ciao'),
    importSlotText(2, JSON.stringify({ kind: 'stage-crew-simulator', v: 99, slot: { service: 'X' } })),
    importSlotText(2, JSON.stringify({ kind: 'stage-crew-simulator', v: 5, slot: { service: 'X', level: { placed: 3 } } })),
    importSlotText(2, JSON.stringify({ kind: 'stage-crew-simulator', v: 5, slot: { service: '' } })),
    importSlotText(0, JSON.stringify({ kind: 'stage-crew-simulator', v: 5, slot: { service: 'X' } }))
  ].map(r => r.error || ''));
  check(/non è un salvataggio/.test(bad[0]) && /più nuova/.test(bad[1]) && /rovinato/.test(bad[2]) && /rovinato/.test(bad[3]) && /occupato/.test(bad[4]), 'errori di importazione sbagliati: ' + JSON.stringify(bad));
  check(await ev(() => !Profile.slots()[2] && el('#slot-msg').classList.contains('bad')), 'un file sbagliato ha riempito lo slot o manca l\'errore');
  // un file da fuori non porta codice nel logo: valori non ammessi tornano quelli di base
  const evil = await ev(() => { const r = readSlotFile(JSON.stringify({ kind: 'stage-crew-simulator', v: 5, slot: { service: 'Evil', level: null, logo: { bg: '"/><script>x()</script>', fg: '#fff', icon: 'nope', shape: 'scudo' }, serviceInfo: { kind: '<b>', boss: 'Gino' } } })); return { logo: r.slot.logo, kind: r.slot.serviceInfo.kind, svg: /script/.test(logoSVG(r.slot.logo, 'Evil', 40)) }; });
  check(JSON.stringify(evil) === JSON.stringify({ logo: { shape: 'scudo', fg: '#fff' }, kind: null, svg: false }), 'logo importato non ripulito: ' + JSON.stringify(evil));
  // si importa anche un vecchio salvataggio a slot unico: si converte
  await ev(() => importSlotText(2, JSON.stringify({ v: 3, player: 'Anna', service: 'Service Vecchio', settings: { volume: 0.1 }, level: { id: 1, placed: {}, edges: [] }, records: {}, reputation: { total: 7, earned: {}, log: [] } })));
  const old = await ev(() => { const s = Profile.slots()[2]; return s && { service: s.service, sk: s.scarico && s.scarico.skipped, rep: s.reputation.total, vol: settings().volume }; });
  check(JSON.stringify(old) === JSON.stringify({ service: 'Service Vecchio', sk: true, rep: 7, vol: 0.3 }), 'vecchio salvataggio importato male: ' + JSON.stringify(old));

  // ---- slot tutti pieni: Nuova partita manda a cancellarne uno
  await p.click('#slots-back');
  await p.click('#menu-new');
  check(await p.isVisible('#slot-list') && /occupati/.test(await p.textContent('#slot-msg')), 'con gli slot pieni Nuova partita non avvisa');

  // ---- cambio di slot a partita in corso: la pagina si ricarica e la
  // partita scelta riparte da sola; l'altra resta salvata
  await Promise.all([p.waitForEvent('load'), p.click('#slot-list [data-slot="0"] [data-act="play"]')]);
  await p.waitForFunction(() => window.__scene && gameActive, null, { timeout: 20000 });
  const sw = await ev(() => ({ active: Profile.active, player: Profile.data.player, placed: Object.keys(gameState.placed).sort(), menu: menuOpen, other: Profile.slots()[1] && [Profile.slots()[1].player, Profile.slots()[1].reputation.total] }));
  check(sw.active === 0 && sw.player === 'Marco' && JSON.stringify(sw.placed) === JSON.stringify(before.placed) && !sw.menu, 'cambio di slot sbagliato: ' + JSON.stringify(sw));
  check(JSON.stringify(sw.other) === JSON.stringify(['Nuova Tecnica', 20]), 'la partita lasciata non è salvata: ' + JSON.stringify(sw.other));
  check(/^MARCO · /.test(await p.textContent('#service-tag')), 'testata non aggiornata dopo il cambio di slot');
  await p.waitForTimeout(400);
  await open();
  check((await p.textContent('#menu-resume')).startsWith('Continua · Marco'), 'alla ricarica non si continua l\'ultimo slot giocato');

  // ---- salvataggio della versione 1 (reputazione 100-150 per livello): si converte
  // (prima si lascia finire il salvataggio in corso e si spegne quello
  // all'uscita dalla pagina, che altrimenti riscriverebbe il profilo attuale)
  await p.waitForTimeout(400);
  await ev(() => { Profile.flush = () => {}; localStorage.setItem('scs-save', JSON.stringify({ v: 1, service: 'Vecchio', settings: { volume: 0.5 }, level: null, records: {}, reputation: { total: 150, byLevel: { 1: 150 } } })); });
  await open();
  const conv = await ev(() => ({ v: Profile.data.v, rep: reputation(), once: Profile.data.reputation.earned['L1:collaudo'], vol: SFX.volume, again: (gameActive = true, addRecord()) }));
  check(JSON.stringify(conv) === JSON.stringify({ v: 5, rep: 5, once: 5, vol: 0.5, again: 0 }), 'conversione dalla versione 1 sbagliata: ' + JSON.stringify(conv));

  // ---- salvataggio della versione 2 (giocatore titolare del service): il
  // service diventa il datore di lavoro, la reputazione resta al tecnico
  await p.waitForTimeout(400);
  await ev(() => { Profile.flush = () => {}; localStorage.setItem('scs-save', JSON.stringify({ v: 2, service: 'Service Rossi', logo: { shape: 'scudo', icon: 'faro', bg: '#e0503f', fg: '#eee9df', style: 'tour' }, settings: { volume: 0.5 }, level: null, records: {}, reputation: { total: 12, earned: {}, log: [] } })); });
  await open();
  const conv2 = await ev(() => ({ v: Profile.data.v, rep: reputation(), service: serviceName(), player: playerName(), used: Profile.data.usedServices, bg: serviceLogo().bg }));
  check(JSON.stringify(conv2) === JSON.stringify({ v: 5, rep: 12, service: 'Service Rossi', player: 'Tecnico', used: ['Service Rossi'], bg: '#e0503f' }), 'conversione dalla versione 2 sbagliata: ' + JSON.stringify(conv2));

  // ---- salvataggio della versione 3 (prima dello scarico): una partita già
  // avviata conta lo scarico come saltato, senza partita si gioca
  await p.waitForTimeout(400);
  await ev(() => { Profile.flush = () => {}; localStorage.setItem('scs-save', JSON.stringify({ v: 3, player: 'Anna', service: 'Service Rossi', settings: { volume: 0.5 }, level: { id: 1, placed: {}, edges: [] }, records: {}, reputation: { total: 7, earned: {}, log: [] } })); });
  await open();
  const conv3 = await ev(() => ({ v: Profile.data.v, sk: Profile.data.scarico && Profile.data.scarico.skipped, skipSet: settings().skipScarico, rep: reputation() }));
  check(JSON.stringify(conv3) === JSON.stringify({ v: 5, sk: true, skipSet: false, rep: 7 }), 'conversione dalla versione 3 sbagliata: ' + JSON.stringify(conv3));

  // ---- salvataggio della versione 4 (un solo slot): la partita diventa
  // il primo slot (il tecnico riprende riposato), impostazioni, record e service già proposti restano comuni
  await p.waitForTimeout(400);
  await ev(() => { Profile.flush = () => {}; localStorage.setItem('scs-save', JSON.stringify({ v: 4, player: 'Bruno', service: 'Faro Matto', logo: { shape: 'scudo', icon: 'faro', bg: '#e0503f', fg: '#eee9df', style: 'tour' }, serviceInfo: { kind: 'feste', boss: 'Gino' }, usedServices: ['Faro Matto', 'Altro Service'], settings: { volume: 0.4 }, tutorSeen: {}, level: { id: 1, placed: {}, edges: [] }, scarico: { skipped: true, lost: {}, delay: 0, beers: 0 }, cavi: null, preside: null, cambioDj: null, beers: 2, records: { 1: [{ at: 1, player: 'Bruno', service: 'Faro Matto', playMs: 1000, tests: 1, failedTests: 0, trips: 0, rcdTrips: 0, pops: 0 }] }, reputation: { total: 9, earned: { 'L1:collaudo': 5 }, log: [] } })); });
  await open();
  const conv4 = await ev(() => { Profile.flush(); const saved = JSON.parse(localStorage.getItem('scs-save')); return { v: Profile.data.v, active: Profile.active, slots: Profile.slots().map(s => s && s.player), rep: reputation(), beers: Profile.data.beers, fat: Profile.data.fatigue, recs: Profile.data.records[1].length, vol: settings().volume, used: Profile.data.usedServices.length, savedV: saved.v, savedSlot: Object.keys(saved.slots[0]).includes('settings'), savedVol: saved.settings.volume, savedRecs: saved.records[1].length }; });
  check(JSON.stringify(conv4) === JSON.stringify({ v: 5, active: 0, slots: ['Bruno', null, null], rep: 9, beers: 2, fat: 0, recs: 1, vol: 0.4, used: 2, savedV: 5, savedSlot: false, savedVol: 0.4, savedRecs: 1 }), 'conversione dalla versione 4 sbagliata: ' + JSON.stringify(conv4));
  check((await p.textContent('#menu-resume')) === 'Continua · Bruno · Faro Matto · ★ 9', 'dopo la conversione manca Continua: ' + await p.textContent('#menu-resume'));

  // ---- sul telefono (360 px): la schermata degli slot entra senza scorrere di lato
  await p.setViewportSize({ width: 360, height: 640 });
  await p.click('#menu-slots');
  const fit = await ev(() => {
    const box = document.querySelector('.menu-box').getBoundingClientRect();
    const over = [...document.querySelectorAll('#slot-list .slot-card, #slot-list .menu-btn')].filter(e => { const r = e.getBoundingClientRect(); return r.right > box.right + 0.5 || r.left < box.left - 0.5 || e.scrollWidth > e.clientWidth + 1; }).length;
    return { box: box.right <= innerWidth && box.left >= 0, over, text: document.querySelector('#slot-list .slot-card').textContent };
  });
  check(fit.box && fit.over === 0 && /Faro Matto/.test(fit.text) && /★ 9/.test(fit.text) && /Messa in sicurezza dei cavi/.test(fit.text), 'slot che non entrano a 360 px: ' + JSON.stringify(fit));
  await p.click('#slots-back');
  await p.click('#menu-levels');
  check(await ev(() => document.querySelector('#level-list').scrollWidth <= document.querySelector('#level-list').clientWidth + 1), 'i livelli escono di lato a 360 px');

  console.log('PROBLEMI:', JSON.stringify(problems, null, 1));
  console.log('ERRORI JS:', errs);
  await b.close();
  const ok = !problems.length && !errs.length;
  console.log(ok ? 'SALVATAGGIO OK' : 'SALVATAGGIO FALLITO');
  process.exit(ok ? 0 : 1);
})();
