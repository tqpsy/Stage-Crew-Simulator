/* La stanchezza del tecnico: un valore solo (0-100) nel salvataggio,
   mostrato sotto il tasto 🍺 in testata. Sale col tempo di gioco e con le
   azioni (pezzi posati, cavi collegati), scende con la pausa del tasto 🍺:
   caffè (poco, tre a serata) o seduto sul case (molto, ma passano 5
   minuti; non durante il cambio palco). Le birre non si bevono: sono il
   premio della crew. Da stanco ogni
   tanto il connettore scivola di mano: il cavo resta in mano e si riprova.
   Resta dopo la ricarica; una nuova partita riparte riposata.
   Il passaggio al discorso del preside è in tests/preside-gioco.js.

   Uso:  node tests/stanchezza.js
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
  if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const problems = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  // il tempo di gioco intanto corre (1 al minuto): i confronti hanno un piccolo margine
  const near = (a, b) => Math.abs(a - b) < 0.1;
  // dopo qualche secondo: il tempo di gioco stanca anche mentre il test aspetta (1 punto al minuto)
  const nearT = (a, b) => Math.abs(a - b) < 0.5;
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const open = async () => {
    await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
    await p.waitForFunction(() => window.__scene, null, { timeout: 20000 });
  };

  await open();
  check(await p.isHidden('#beer-btn'), 'il tasto 🍺 si vede senza partita');
  await ev(() => startNewGame('Stanco', serviceOffers([])[0]));
  await p.waitForFunction(() => !menuOpen);
  await ev(() => { closeSchedule(); finishScarico({ skipped: true }); settings().bossTips = false; });
  const start = await ev(() => ({ f: fatigue(), shown: !el('#beer-btn').hidden, n: el('#beer-n').textContent }));
  check(near(start.f, 0) && start.shown && start.n === '0', 'a inizio partita: ' + JSON.stringify(start));

  // le azioni stancano: un pezzo posato
  const placed = await ev(() => { const f = fatigue(), w = gridToScreen(4.5, 2.5); window.__scene.placeComponentAt('quadro', w.x, w.y); return fatigue() - f; });
  check(near(placed, 0.25), 'posare un pezzo non stanca: ' + placed);
  // anche il tempo di gioco (1 al minuto: un paio di secondi bastano a vederlo)
  const t0 = await ev(() => fatigue());
  await p.waitForTimeout(2300);
  const t1 = await ev(() => fatigue());
  check(t1 > t0 && t1 - t0 < 0.1, 'il tempo non stanca, o stanca troppo: ' + JSON.stringify({ t0, t1 }));
  // ma non col menù aperto
  await ev(() => openMenu());
  const m0 = await ev(() => fatigue());
  await p.waitForTimeout(2300);
  check(await ev(() => fatigue()) === m0, 'la stanchezza sale col menù aperto');
  await ev(() => closeMenu());

  // barra e descrizione nel tasto
  await ev(() => setFatigue(75));
  const bar = await ev(() => ({ w: el('#fat-fill').style.width, high: el('#fat-fill').classList.contains('high'), title: el('#beer-btn').title }));
  check(nearT(parseFloat(bar.w), 75) && bar.high && /Stanchezza 75% \(stanco\)/.test(bar.title), 'tasto 🍺 sbagliato: ' + JSON.stringify(bar));

  // la pausa: le birre non si toccano, il caffè toglie poco e finisce,
  // seduti sul case si recupera molto ma il tempo passa
  await ev(() => { Profile.data.beers = 2; applySettings(); });
  check(await p.textContent('#beer-n') === '2', 'le birre non sono nel tasto');
  await p.click('#beer-btn');
  check(await ev(() => pausaOpen && el('#pausa-modal').classList.contains('show')), 'il tasto 🍺 non apre la pausa');
  check(/2 birre della crew/.test(await p.textContent('#pausa-beer')), 'la pausa non parla delle birre');
  await p.click('#pausa-coffee');
  const cof = await ev(() => ({ f: fatigue(), n: Profile.data.beers, c: Profile.data.coffees, open: pausaOpen }));
  check(nearT(cof.f, 63) && cof.n === 2 && cof.c === 1 && !cof.open, 'caffè sbagliato: ' + JSON.stringify(cof));
  await ev(() => { Profile.data.coffees = 3; openPausa(); });
  check(await ev(() => el('#pausa-coffee').disabled && /vuoto/.test(el('#pausa-coffee-n').textContent)), 'il thermos non finisce');
  const ms0 = await ev(() => gameState.stats.playMs);
  await p.click('#pausa-sit');
  const sit = await ev(() => ({ f: fatigue(), ms: gameState.stats.playMs, open: pausaOpen }));
  check(nearT(sit.f, 28) && sit.ms - ms0 >= 300000 && !sit.open, 'pausa seduto sbagliata: ' + JSON.stringify(sit));
  await ev(() => { Profile.data.cambioDj = { at: Date.now(), done: false }; openPausa(); });
  check(await ev(() => el('#pausa-sit').disabled && /pubblico/.test(el('#pausa-sit-n').textContent)), 'ci si siede col pubblico che aspetta');
  await ev(() => { closePausa(); Profile.data.cambioDj = null; setFatigue(45); });

  // da stanco il connettore scivola: il cavo resta in mano, si riprova
  const wire = () => {
    const q = placedOfType('quadro')[0].id;
    if (!gameState.pendingPort) { selectCable('cee_tri'); openRearPanel('allaccio'); onRearPortClick('allaccio', 'out'); }
    openRearPanel(q); onRearPortClick(q, 'in'); if (rearPanelId) closeRearPanel();
    return { edges: gameState.edges.length, pending: !!gameState.pendingPort, toast: el('#toast').textContent };
  };
  await ev(() => { window.__rnd = Math.random; Math.random = () => 0; setFatigue(60); });
  check(await ev(() => slipChance()) === 0, 'sotto la soglia il connettore scivola');
  await ev(() => setFatigue(100));
  const slip = await ev(`(${wire})()`);
  check(slip.edges === 0 && slip.pending && /scivola/.test(slip.toast), 'da stanchi il connettore non scivola: ' + JSON.stringify(slip));
  const f0 = await ev(() => fatigue());
  const again = await ev(`Math.random = () => 0.99, (${wire})()`);
  check(again.edges === 1 && !again.pending && near(await ev(() => fatigue()), f0), 'riprovando non si collega: ' + JSON.stringify(again));
  await ev(() => { Math.random = window.__rnd; });
  check(await ev(() => slipChance()) === 0.15, 'probabilità massima di scivolare sbagliata');

  // resta dopo la ricarica
  await ev(() => { setFatigue(42.5); Profile.flush(); });
  await open();
  await ev(() => continueGame());
  await p.waitForFunction(() => !menuOpen);
  const reload = await ev(() => ({ f: fatigue(), n: el('#beer-n').textContent, shown: !el('#beer-btn').hidden }));
  check(reload.f >= 42.5 && reload.f < 43 && reload.n === '2' && reload.shown, 'stanchezza persa ricaricando: ' + JSON.stringify(reload));

  // nuova partita: tecnico riposato
  await ev(() => startNewGame('Riposato', serviceOffers([])[0]));
  await p.waitForFunction(() => !menuOpen);
  check(near(await ev(() => fatigue()), 0) && await ev(() => Profile.data.coffees) === 0, 'la nuova partita non riparte riposata');

  check(errs.length === 0, 'errori JS: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('stanchezza: tutto ok');
})();
