/* I cavi lasciati dalla posa si fanno sentire nel discorso del preside
   (prototipi/spettacolo-preside.html, «Cavi lasciati dalla posa»): cavo nel
   passaggio → qualcuno ci inciampa e il guasto è l'ingresso; microfono
   accanto alla corrente → ronzio che fa calare il pubblico; cavo in scena →
   il preside inciampa. Senza niente di rimasto, niente di tutto questo.

   Uso:  node tests/preside-cavi.js
   Richiede Playwright. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 420, height: 860 } });
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const problems = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  const url = 'file://' + path.join(__dirname, '..', 'prototipi', 'spettacolo-preside.html');
  // prova una partita con questi cavi rimasti e guarda cosa succede a metà discorso
  const run = async left => {
    await p.goto(url);
    for (const k of left) await p.click(`#posa-pick button[data-p="${k}"]`);
    await p.click('#start');
    return p.evaluate(async () => {
      const T = window.__tramp, S = T.state();
      const out = { cause: S.faultCause, faultText: (S.events.find(e => e.id === 'cavo') || {}).text || null };
      // a metà discorso, microfono aperto e in zona, niente guasti in corso
      S.events = [];   // niente imprevisti: resta solo l'effetto della posa
      // voce ferma nella zona verde (niente deriva, niente stanchezza) e frontali accesi
      S.t = 30; S.tripAt = 31; S.fad[S.micCh] = 0.62; S.mute[S.micCh] = false; S.dimmer = 1; S.pars = ['bianco', 'bianco', 'bianco', 'bianco'];
      S.fatigue = 0; S.drift = 0.96; S.driftTo = 1; S.voiceK = 1; S.fad[5] = 0;
      const g0 = S.grad;
      await new Promise(r => setTimeout(r, 2500));
      out.dGrad = S.grad - g0; out.tripped = S.tripped; out.notes = S.notes.join(' | ');
      return out;
    });
  };
  const none = await run([]);
  check(!/inciampa/.test(none.faultText || '') && !none.tripped && !/Ronzio|inciampato/.test(none.notes), 'senza cavi rimasti succede comunque qualcosa: ' + JSON.stringify(none));
  const pass = await run(['passaggio']);
  check(pass.cause === 'ing' && /inciampa/.test(pass.faultText || ''), 'cavo nel passaggio: il guasto non è l\'ingresso strappato: ' + JSON.stringify(pass));
  const hum = await run(['ronzio']);
  check(/Ronzio/.test(hum.notes) && hum.dGrad < none.dGrad, 'ronzio: il pubblico non se ne accorge: ' + JSON.stringify({ hum, none: none.dGrad }));
  const scena = await run(['scena']);
  check(scena.tripped && /inciampato/.test(scena.notes) && scena.dGrad < none.dGrad - 5, 'cavo in scena: il preside non inciampa: ' + JSON.stringify(scena));
  check(errs.length === 0, 'errori JS: ' + errs.join(' | '));
  await b.close();
  if (problems.length) { console.log('PROBLEMI:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('preside-cavi: tutto ok', JSON.stringify({ none: none.dGrad, hum: hum.dGrad, scena: scena.dGrad }));
})();
