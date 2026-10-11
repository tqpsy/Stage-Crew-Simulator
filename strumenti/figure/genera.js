/* Genera gli atlanti delle figure dello scarico, già nella vista del gioco
   (dall'alto a 38°, mondo girato di 45°): 8 direzioni, fermo + 6 passi, per
   ogni posa delle braccia. Topsy viene dal suo modello 3D; Macio, Gerry e i
   bambini dalle miniature di manichini.js finché non hanno la loro figura.

   Uso:
     node strumenti/figure/genera.js --three three.min.js --topsy topsy3d.js --rig topsy-rig.js [solo...]
   Scrive img/personaggi/<chi>-atlante.webp (Macio anche -maschera.webp) e
   personaggi-atlante.js con le celle. Per il Topsy definitivo basta rifarlo
   col nuovo topsy3d.js: il gioco non cambia. Richiede Playwright. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs'), path = require('path');
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const ROOT = path.join(__dirname, '..', '..'), HERE = __dirname;
const only = process.argv.slice(2).filter((a, i, A) => !a.startsWith('--') && !(A[i - 1] || '').startsWith('--'));
const WHO = only.length ? only : ['topsy', 'macio', 'gerry', 'kid', 'kid2'];
(async () => {
  const files = { 'three.min.js': arg('three'), 'topsy3d.js': arg('topsy'), 'topsy-rig.js': arg('rig') };
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  for (const [n, f] of Object.entries(files)) await p.route('**/' + n, r => f ? r.fulfill({ path: f, contentType: 'application/javascript' }) : r.fulfill({ body: '', contentType: 'application/javascript' }));
  await p.goto('file://' + path.join(HERE, 'render.html'));
  const metaFile = path.join(ROOT, 'personaggi-atlante.js');
  let meta = { figs: {} };
  if (fs.existsSync(metaFile)) { const s = fs.readFileSync(metaFile, 'utf8'); meta = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)); }
  Object.assign(meta, await p.evaluate(() => window.ATLAS_INFO));
  for (const who of WHO) {
    const t0 = Date.now();
    const r = await p.evaluate(who => who === 'topsy' ? window.renderTopsy() : window.renderManichino(who), who);
    const save = (data, f) => fs.writeFileSync(path.join(ROOT, 'img/personaggi', f), Buffer.from(data.split(',')[1], 'base64'));
    save(r.data, who + '-atlante.webp');
    meta.figs[who] = { src: 'img/personaggi/' + who + '-atlante.webp', w: r.w, h: r.h, poses: r.poses };
    if (r.mask) { save(r.mask, who + '-maschera.webp'); meta.figs[who].mask = 'img/personaggi/' + who + '-maschera.webp'; }
    console.log(who, r.w + 'x' + r.h, ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  }
  fs.writeFileSync(metaFile, '/* generato da strumenti/figure/genera.js: le celle degli atlanti delle figure\n   (x, y, larghezza, altezza, piedi x, piedi y) per posa, direzione, fotogramma */\nwindow.FIG_ATLAS = ' + JSON.stringify(meta) + ';\n');
  await b.close();
})();
