/* L'assistente da assumere dal livello 2 (docs/assistente.md): nel livello
   1 c'è il capo e non si assume nessuno; dove il capo non c'è si sceglie
   chi ha la reputazione che basta, i favori nei guasti grossi costano
   birre, ognuno sa sistemare i suoi guasti e fa un numero massimo di
   favori per set. La scelta resta nel salvataggio.

   Uso:  node tests/assistente.js
   Richiede Playwright. Senza rete, PHASER_PATH=/percorso/phaser.min.js. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
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
  await open();

  // ---- i tre assistenti: soglie crescenti, più bravi costano di più
  const list = await ev(() => Object.entries(ASSISTANTS).map(([id, a]) => ({ id, ...a })));
  check(list.length === 3, 'non ci sono tre assistenti');
  check(list.every((a, i) => !i || (a.rep > list[i - 1].rep && a.missEvery >= list[i - 1].missEvery && a.fixS <= list[i - 1].fixS)), 'soglie o bravura non crescono in ordine: ' + JSON.stringify(list));
  check(list.every(a => a.name && a.line && a.beers >= 1 && a.favors >= 1 && a.fixes.includes('fase')), 'assistente incompleto: ' + JSON.stringify(list));
  check(new Set(list.map(a => a.name.split(' ')[0])).size === 3, 'due assistenti con lo stesso nome');

  // ---- livello 1: c'è il capo, non si assume nessuno
  const l1 = await ev(() => { Profile.data.reputation.total = 50; return { lvl1: assistantLevel(1), lvl2: assistantLevel(2), here: assistantLevel(), hire: hireAssistant('sabri', 1), hireHere: hireAssistant('sabri'), id: Profile.data.assistant.id }; });
  check(JSON.stringify(l1) === JSON.stringify({ lvl1: false, lvl2: true, here: false, hire: false, hireHere: false, id: null }), 'nel livello 1 si assume un assistente: ' + JSON.stringify(l1));

  // ---- la reputazione è una soglia: senza non si assume, e non si spende
  const soglie = await ev(() => {
    Profile.data.reputation.total = 0;
    const zero = hireAssistant('nico', 2);
    Profile.data.reputation.total = 12;
    const r = { zero, nico: hireAssistant('nico', 2), sabri: hireAssistant('sabri', 2), nessuno: hireAssistant('boh', 2), id: Profile.data.assistant.id, rep: reputation() };
    return r;
  });
  check(JSON.stringify(soglie) === JSON.stringify({ zero: false, nico: true, sabri: false, nessuno: false, id: 'nico', rep: 12 }), 'soglie di reputazione sbagliate: ' + JSON.stringify(soglie));

  // ---- Nico: una birra a favore, solo la fase che scatta, due favori per set
  const nico = await ev(() => {
    Profile.data.beers = 0;
    const r = { noBeer: assistantFavor('fase') };
    Profile.data.beers = 3;
    r.dmx = assistantCanFix('dmx');
    r.f1 = assistantFavor('fase'); r.f2 = assistantFavor('fase'); r.f3 = assistantFavor('fase');
    r.beers = Profile.data.beers; r.favors = Profile.data.assistant.favors;
    assistantNewSet();
    r.again = assistantFavor('fase'); r.beersAfter = Profile.data.beers; r.id = Profile.data.assistant.id;
    return r;
  });
  check(JSON.stringify(nico) === JSON.stringify({ noBeer: false, dmx: false, f1: true, f2: true, f3: false, beers: 1, favors: 2, again: true, beersAfter: 0, id: 'nico' }), 'favori di Nico sbagliati: ' + JSON.stringify(nico));
  check((await p.textContent('#service-tag')).indexOf('🍺') < 0, 'la testata mostra ancora le birre spese');

  // ---- Tonino: due birre a favore, sistema anche il DMX, tre favori
  const tonino = await ev(() => {
    Profile.data.reputation.total = 40;
    const r = { hire: hireAssistant('tonino', 2), favors0: Profile.data.assistant.favors };
    Profile.data.beers = 1;
    r.oneBeer = assistantFavor('dmx');
    Profile.data.beers = 7;
    r.f = [assistantFavor('dmx'), assistantFavor('fase'), assistantFavor('dmx'), assistantFavor('dmx')];
    r.beers = Profile.data.beers;
    return r;
  });
  check(JSON.stringify(tonino) === JSON.stringify({ hire: true, favors0: 0, oneBeer: false, f: [true, true, true, false], beers: 1 }), 'favori di Tonino sbagliati: ' + JSON.stringify(tonino));

  // ---- da solo: nessun favore
  const solo = await ev(() => ({ hire: hireAssistant(null, 2), a: assistant(), can: assistantCanFix('fase') }));
  check(JSON.stringify(solo) === JSON.stringify({ hire: true, a: null, can: false }), 'senza assistente qualcuno fa i favori: ' + JSON.stringify(solo));

  // ---- l'assistente resta nel salvataggio (nello slot della partita)
  await ev(() => { Profile.data.service = 'Service Prova'; hireAssistant('sabri', 2); Profile.data.assistant.favors = 1; Profile.flush(); });
  await open();
  const saved = await ev(() => ({ a: Profile.data.assistant, name: assistant() && assistant().name }));
  check(JSON.stringify(saved) === JSON.stringify({ a: { id: 'sabri', favors: 1 }, name: 'Sabri «Nastro Nero»' }), 'assistente perso nel salvataggio: ' + JSON.stringify(saved));

  // ---- partita salvata prima dell'assistente (slot senza assistant): nessuno assunto
  await ev(() => { Profile.flush = () => {}; const r = JSON.parse(localStorage.getItem('scs-save')); delete r.slots[r.active].assistant; localStorage.setItem('scs-save', JSON.stringify(r)); });
  await open();
  const old = await ev(() => ({ a: Profile.data.assistant, who: assistant(), beers: Profile.data.beers }));
  check(JSON.stringify(old) === JSON.stringify({ a: { id: null, favors: 0 }, who: null, beers: 1 }), 'partita vecchia senza assistente letta male: ' + JSON.stringify(old));

  // ---- un id strano (per esempio da un file) non diventa un assistente
  const strano = await ev(() => ['constructor', '__proto__', 'toString'].map(id => { Profile.data.assistant = { id, favors: 0 }; Profile.data.reputation.total = 99; return [assistant(), assistantCanFix('fase'), assistantUnlocked(id), hireAssistant(id, 2)]; }));
  check(JSON.stringify(strano) === JSON.stringify([[null, false, false, false], [null, false, false, false], [null, false, false, false]]), 'id strano preso per assistente: ' + JSON.stringify(strano));

  // ---- file importato con un assistente rovinato: ripulito
  const file = await ev(() => readSlotFile(JSON.stringify({ kind: 'stage-crew-simulator', v: SAVE_VERSION, slot: { service: 'X', assistant: { id: { a: 1 }, favors: 'tanti' } } })).slot.assistant);
  check(JSON.stringify(file) === JSON.stringify({ id: null, favors: 0 }), 'assistente del file non ripulito: ' + JSON.stringify(file));

  console.log('PROBLEMI:', JSON.stringify(problems, null, 1));
  console.log('ERRORI JS:', errs);
  await b.close();
  const ok = !problems.length && !errs.length;
  console.log(ok ? 'ASSISTENTE OK' : 'ASSISTENTE FALLITO');
  process.exit(ok ? 0 : 1);
})();
