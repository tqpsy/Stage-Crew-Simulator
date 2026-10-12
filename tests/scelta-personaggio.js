/* Scelta del personaggio a inizio partita: Topsy (di serie) o La Sissi.
   La scelta resta nello slot (anche dopo la ricarica), le partite di prima
   sono di Topsy, l'import accetta solo personaggi veri e lo scarico
   disegna il giocatore con la figura scelta.

   Uso:  node tests/scelta-personaggio.js
   Richiede Playwright. Senza rete, PHASER_PATH e MATTER_PATH. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 1000 } });
  if (process.env.PHASER_PATH) await p.route('**/phaser.min.js', r => r.fulfill({ path: process.env.PHASER_PATH, contentType: 'application/javascript' }));
  if (process.env.MATTER_PATH) await p.route('**/matter.min.js', r => r.fulfill({ path: process.env.MATTER_PATH, contentType: 'application/javascript' }));
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const problems = []; const check = (ok, what) => { if (!ok) problems.push(what); };
  const open = async () => { await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForFunction(() => window.__scene, null, { timeout: 20000 }); };
  await open();
  check(await p.$$eval('#char-pick .char-card', cs => cs.map(c => c.dataset.char).join()) === 'topsy,sissi', 'mancano le due figure da scegliere');
  check(await p.$eval('#char-pick .char-card.sel', c => c.dataset.char) === 'topsy', 'di serie non è scelto Topsy');
  check(await p.$$eval('#char-pick img', is => is.every(i => i.complete && i.naturalWidth > 0)), 'manca un\'immagine della scelta');
  await p.click('#char-pick [data-char="sissi"]');
  check(await p.$eval('#char-pick .char-card.sel', c => c.dataset.char) === 'sissi', 'La Sissi non si seleziona');
  await p.type('#player-input', 'Prova');
  await p.click('#service-offers .offer-card');
  await p.click('#new-start');
  await p.waitForTimeout(300);
  check(await p.evaluate(() => Profile.data.character) === 'sissi', 'la partita non è della Sissi');
  check(await p.evaluate(() => { Profile.flush(); const r = JSON.parse(localStorage.getItem(SAVE_KEY)); return r.slots[r.active].character; }) === 'sissi', 'la scelta non è nel salvataggio');
  await open();
  check(await p.evaluate(() => playerCharacter()) === 'sissi', 'dopo la ricarica non è più La Sissi');
  // lo scarico parte con lei
  check(await p.evaluate(() => { openScarico(); const f = document.querySelector('#scarico-frame'); return f && f.src.includes('chi=sissi'); }), 'lo scarico non sa chi si gioca');
  // vecchie partite e file importati: Topsy, o la figura scritta se esiste
  check(await p.evaluate(() => fillSlot({ service: 'X', player: 'Y' }, { settings: {} }).character) === 'topsy', 'una partita di prima non è di Topsy');
  const imp = await p.evaluate(() => [readSlotFile(JSON.stringify({ kind: SAVE_FILE_KIND, v: SAVE_VERSION, slot: { service: 'A', player: 'B', character: 'sissi' } })).slot.character,
    readSlotFile(JSON.stringify({ kind: SAVE_FILE_KIND, v: SAVE_VERSION, slot: { service: 'A', player: 'B', character: '<script>' } })).slot.character]);
  check(imp.join() === 'sissi,topsy', 'import del personaggio sbagliato: ' + imp);
  // nello scarico il giocatore è disegnato con l'atlante scelto (e quello dell'altro non si carica)
  const q = await b.newPage({ viewport: { width: 900, height: 700 } });
  if (process.env.MATTER_PATH) await q.route('**/matter.min.js', r => r.fulfill({ path: process.env.MATTER_PATH, contentType: 'application/javascript' }));
  await q.route(/fonts\./, r => r.abort());
  q.on('pageerror', e => errs.push('scarico: ' + e.message));
  await q.goto('file://' + path.join(__dirname, '..', 'scarico.html') + '?chi=sissi');
  await q.waitForFunction(() => typeof FIG !== 'undefined' && FIG.sissi && FIG.sissi.ready, null, { timeout: 20000 });
  check(await q.evaluate(() => PLAYER_FIG === 'sissi' && !FIG.topsy), 'nello scarico non c\'è solo La Sissi come giocatore');
  await q.goto('file://' + path.join(__dirname, '..', 'scarico.html'));
  await q.waitForFunction(() => typeof FIG !== 'undefined' && FIG.topsy, null, { timeout: 20000 });
  check(await q.evaluate(() => PLAYER_FIG === 'topsy' && !FIG.sissi), 'senza scelta lo scarico non è di Topsy');
  check(!errs.length, 'errori: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('Scelta del personaggio: tutto ok');
})();
