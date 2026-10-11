/* Le figure dello scarico che non hanno ancora la loro action figure (Macio,
   Gerry, i bambini), costruite come miniature: volumi semplici, plastica
   opaca, snodi visibili. Stessa luce, stessa telecamera e stesso passo del
   Topsy 3D, così stanno nello stesso mondo. Solo per lo strumento che genera
   gli atlanti: nel gioco arrivano già disegnate (img/personaggi/*.webp).
   Unità: centimetri, Y in alto, la figura guarda verso +Z. */
(function (global) {
  'use strict';
  function build (THREE, who) {
    const S = SPEC[who];
    const mats = {};
    // la trama della stoffa, come sulla figura di Topsy: maglia fine e qualche piega
    const knit = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), im = g.createImageData(64, 64);
      let x = 7; const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 64 * 64; i++) { const v = 205 + rnd() * 50 - ((i >> 6) % 2) * 16 - ((i & 63) % 3 === 0 ? 10 : 0); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
      g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
    })();
    const M = (k, color, o) => mats[k] || (mats[k] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.62, metalness: 0 }, o || {})));
    const cloth = (k, color, o) => M(k, color, Object.assign({ map: knit, roughness: 0.85 }, o || {}));
    const mesh = (g, m, parent, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); if (sx) o.scale.set(sx, sy, sz); o.userData.mat = m.userData.key; parent.add(o); return o; };
    const sph = (r, d) => new THREE.SphereGeometry(r, d || 20, Math.round((d || 20) * 0.75));
    // un pezzo di braccio o gamba: dal giunto in giù, raggi in alto e in basso
    const limb = (parent, len, r1, r2, m, x, y, z) => {
      const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p);
      mesh(new THREE.CylinderGeometry(r1, r2, len, 18, 1), m, p, 0, -len / 2, 0);
      mesh(sph(r1), m, p, 0, 0, 0);
      const end = new THREE.Group(); end.position.set(0, -len, 0); p.add(end);
      mesh(sph(r2 * 0.98), m, end, 0, 0, 0);
      return { p, end };
    };
    const tagM = (m, key) => { m.userData.key = key; return m; };
    const skin = tagM(M('skin', S.skin, { roughness: 0.5 }), 'skin');
    const tee = tagM(cloth('tee', S.tee), 'tee'), pants = tagM(cloth('pants', S.pants), 'pants');
    const shoe = tagM(M('shoe', S.shoe, { roughness: 0.45 }), 'shoe'), dark = tagM(M('dark', S.hairC || '#221c18', { roughness: 0.85 }), 'dark');
    const H = S.h, leg = H * (S.legK || 0.47), thigh = leg * 0.5, shin = leg * 0.43, torso = H * (S.torsoK || 0.285), hipW = S.hipW || H * 0.115, shW = S.shW || H * 0.235;
    const root = new THREE.Group(), hips = new THREE.Group(); hips.position.y = leg; root.add(hips);
    // bacino e gambe
    mesh(sph(1, 20), pants, hips, 0, 1, 0, hipW * 0.62, H * 0.06, hipW * 0.42);
    const legs = [-1, 1].map(s => {
      const t = limb(hips, thigh, H * 0.058 * (S.armK || 1), H * 0.045 * (S.armK || 1), pants, s * hipW * 0.34, 0, 0);
      const k = limb(t.end, shin, H * 0.043 * (S.armK || 1), H * 0.035 * (S.armK || 1), pants, 0, 0, 0);
      const f = new THREE.Group(); k.end.add(f);
      mesh(sph(1, 16), shoe, f, 0, -leg * 0.05, H * 0.032, H * 0.036, H * 0.027, H * 0.075);
      if (S.socks) mesh(new THREE.CylinderGeometry(H * 0.026, H * 0.027, H * 0.035, 14), tagM(M('sock', S.socks), 'sock'), k.end, 0, H * 0.01, 0);
      return { t: t.p, k: k.p, f };
    });
    // busto: un tornio con la pancia, schiacciato davanti-dietro
    const spine = new THREE.Group(); hips.add(spine);
    const prof = [], b = S.belly || 0;
    [[0, 0.5], [0.15, 0.52 + b * 0.25], [0.38, 0.55 + b * 0.55], [0.6, 0.6 + b * 0.25], [0.82, 0.68], [0.94, 0.62], [1.0, 0.25]].forEach(([y, r]) => prof.push(new THREE.Vector2(r * shW * 0.5, y * torso)));
    const tor = mesh(new THREE.LatheGeometry(prof, 28), tee, spine, 0, 0, 0); tor.scale.set(1, 1, 0.62 + b * 0.25);
    mesh(new THREE.CylinderGeometry(shW * 0.26, shW * 0.26, H * 0.014, 24), tagM(M('belt', S.belt || '#141416', { roughness: 0.4 }), 'belt'), spine, 0, H * 0.012, 0).scale.set(1, 1, 0.66 + b * 0.25);
    if (S.coat) {   // il camice del bidello fino a metà coscia
      const cg = new THREE.CylinderGeometry(shW * 0.29, shW * 0.33, H * 0.17, 24, 1, true);
      mesh(cg, tee, hips, 0, -H * 0.06, 0).scale.set(1, 1, 0.72);
    }
    if (S.logo) mesh(new THREE.CircleGeometry(H * 0.016, 20), tagM(M('logo', S.logo, { roughness: 0.5 }), 'logo'), spine, -shW * 0.15, torso * 0.72, shW * 0.5 * 0.67 * (0.62 + b * 0.25) + 0.4);
    // il logo del service grande sulla schiena: Macio si riconosce anche di spalle
    if (S.logo) { const lg = mesh(new THREE.CircleGeometry(H * 0.05, 28), tagM(M('logo', S.logo, { roughness: 0.5 }), 'logo'), spine, 0, torso * 0.62, -(shW * 0.5 * 0.62 * (0.62 + b * 0.25) + 0.4)); lg.rotation.y = Math.PI; }
    // collo e testa
    const neck = new THREE.Group(); neck.position.y = torso * 0.98; spine.add(neck);
    mesh(new THREE.CylinderGeometry(H * 0.034, H * 0.038, H * 0.07, 16), skin, neck, 0, H * 0.03, 0);
    mesh(new THREE.TorusGeometry(H * 0.04, H * 0.008, 8, 24), tee, neck, 0, 0, 0).rotation.x = Math.PI / 2;
    const head = new THREE.Group(); head.position.y = H * 0.06; neck.add(head);
    const R = H * 0.07 * (S.headK || 1);
    mesh(sph(R, 28), tagM(M('head', S.skin, { roughness: S.bald ? 0.32 : 0.5 }), 'skin'), head, 0, R * 0.95, 0, S.skullW || 0.92, 1.08, 1);
    mesh(sph(R * 0.72, 20), skin, head, 0, R * (S.chin2 ? 0.38 : 0.5), R * 0.18, S.jawW || 1.05, S.chin2 ? 0.9 : 0.75, 1);   // mascella e mento
    if (S.chin2) mesh(sph(R * 0.55, 18), skin, head, 0, R * 0.02, R * 0.16, 1.35, 0.65, 1);   // il doppio mento
    mesh(sph(R * 0.25), skin, head, -R * 0.93, R * 0.85, -R * 0.05, 0.45, 1, 0.8); mesh(sph(R * 0.25), skin, head, R * 0.93, R * 0.85, -R * 0.05, 0.45, 1, 0.8);
    const face = new THREE.Group(); face.position.set(0, R * 0.95, 0); head.add(face);
    S.face(THREE, face, R, { M, mesh, sph, skin, dark, tagM });
    // braccia: manica, braccio, avambraccio, mano
    const arms = [-1, 1].map(s => {
      const u = limb(spine, H * 0.15, H * 0.036 * (S.armK || 1), H * 0.03 * (S.armK || 1), skin, s * shW * 0.45, torso * 0.83, 0);
      mesh(new THREE.CylinderGeometry(H * 0.045 * (S.armK || 1), H * 0.042 * (S.armK || 1), H * 0.07, 16), tee, u.p, 0, -H * 0.028, 0);
      mesh(sph(H * 0.04 * (S.armK || 1)), tee, u.p, 0, 0, 0);
      const f = limb(u.end, H * 0.135, H * 0.03 * (S.armK || 1), H * 0.024 * (S.armK || 1), skin, 0, 0, 0);
      mesh(sph(H * 0.036), S.glove ? tagM(M('glove', S.glove), 'glove') : skin, f.end, 0, -H * 0.02, 0, 0.8, 1.15, 0.62);
      u.p.rotation.z = s * 0.06;
      return { u: u.p, f: f.p };
    });
    // la posa: fase del passo p (radianti), ampiezza a (0 fermo), braccia
    function pose (p, a, armsK) {
      const A = 0.42 * a;
      legs.forEach((L, i) => { const q = p + i * Math.PI; L.t.rotation.x = -A * Math.sin(q); L.k.rotation.x = a * (0.15 + 0.75 * Math.max(0, Math.cos(q - 0.5)) ** 2); L.f.rotation.x = -L.t.rotation.x * 0.3 - L.k.rotation.x * 0.6; });
      hips.position.y = leg - a * 1.6 * Math.abs(Math.cos(p));
      hips.rotation.y = 0.08 * a * Math.sin(p); spine.rotation.y = -0.14 * a * Math.sin(p);
      arms.forEach((R2, i) => {
        const q = p + i * Math.PI, s = i ? 1 : -1;
        if (armsK === 'porta') { R2.u.rotation.set(-0.32, 0, s * 0.22); R2.f.rotation.set(-1.25, 0, -s * 0.3); }
        else if (armsK === 'avanti') { R2.u.rotation.set(-0.62, 0, s * 0.1); R2.f.rotation.set(-0.28, 0, 0); }
        else { R2.u.rotation.set(0.38 * a * Math.sin(q), 0, s * 0.07); R2.f.rotation.set(-0.18 - 0.25 * a * Math.max(0, -Math.sin(q)), 0, 0); }
      });
      spine.rotation.x = armsK === 'porta' ? -0.05 : 0.02 * a;
      root.updateMatrixWorld(true);
    }
    pose(0, 0, 'giu');
    return { root, pose, mats };
  }
  // i lineamenti, sulla faccia (centro della testa, raggio R)
  const eyes = (THREE, f, R, K, white) => {
    [-1, 1].forEach(s => {
      if (white) K.mesh(K.sph(R * 0.13), K.tagM(K.M('eyeW', '#f2ede4', { roughness: 0.3 }), 'eyeW'), f, s * R * 0.33, R * 0.08, R * 0.86, 1, 0.75, 0.5);
      K.mesh(K.sph(R * 0.075), K.tagM(K.M('eyeP', '#2a1e16', { roughness: 0.2 }), 'eyeP'), f, s * R * 0.33, R * 0.08, R * 0.93);
    });
  };
  const brows = (THREE, f, R, K, c, th, tilt) => [-1, 1].forEach(s => { const m = K.mesh(new THREE.BoxGeometry(R * 0.42, R * th, R * 0.14), K.tagM(K.M('brow' + c, c, { roughness: 0.9 }), 'dark'), f, s * R * 0.34, R * 0.3, R * 0.9); m.rotation.z = -s * tilt; m.rotation.y = s * 0.25; });
  const nose = (THREE, f, R, K, k) => K.mesh(K.sph(R * 0.17 * k), K.skin, f, 0, -R * 0.12, R * 0.98, 0.85, 1.05, 0.9);
  const SPEC = {
    // Macio: pelato lucido, baffoni scuri a spazzola, pancia, maglia del service
    macio: { h: 168, skin: '#d9a07c', tee: '#cfcfcf', pants: '#2b2d33', shoe: '#1b1c20', belt: '#15161a', belly: 0.7, headK: 1.24, bald: true, skullW: 1.0, jawW: 1.2, chin2: true, logo: '#f2a541', shW: 49, hipW: 25, legK: 0.44, torsoK: 0.31, armK: 1.15,
      face (THREE, f, R, K) {
        eyes(THREE, f, R, K, true); brows(THREE, f, R, K, '#2a2420', 0.22, 0.22); nose(THREE, f, R, K, 1.45);
        const mo = K.tagM(K.M('baffi', '#2a2420', { roughness: 0.95 }), 'dark');
        for (let i = -7; i <= 7; i++) {   // baffoni: una spazzola larga e folta che scende ai lati
          const t = i / 7, x = t * R * 0.8, y = -R * 0.27 - Math.abs(t) ** 1.4 * R * 0.4, z = R * (1.0 - Math.abs(t) ** 2 * 0.32);
          K.mesh(K.sph(R * (0.26 - Math.abs(t) * 0.08)), mo, f, x, y, z, 1.2, 0.9, 0.8);
        }
      } },
    // Gerry: bidello, camice blu, capelli grigi ai lati, sorriso largo
    gerry: { h: 176, skin: '#e8a883', tee: '#2f5d8a', pants: '#3b3f47', shoe: '#2a2420', belt: '#23476b', belly: 0.3, coat: true, hairC: '#8a837c', shW: 42, hipW: 21,
      face (THREE, f, R, K) {
        eyes(THREE, f, R, K, true); brows(THREE, f, R, K, '#6f6862', 0.12, -0.12); nose(THREE, f, R, K, 1.3);
        const g = K.tagM(K.M('grigi', '#8a837c', { roughness: 0.95 }), 'dark');
        const ring = new THREE.TorusGeometry(R * 0.95, R * 0.22, 10, 24, Math.PI * 1.25);
        const h = K.mesh(ring, g, f, 0, R * 0.05, -R * 0.08); h.rotation.set(Math.PI / 2, 0, -Math.PI * 0.125 - Math.PI / 2); h.scale.set(1, 1.05, 0.9);
        const mouth = K.mesh(new THREE.TorusGeometry(R * 0.26, R * 0.05, 8, 16, Math.PI), K.tagM(K.M('bocca', '#5e2220'), 'eyeP'), f, 0, -R * 0.36, R * 0.9);
        mouth.rotation.z = Math.PI;
      } },
    kid: { h: 125, skin: '#e2b08c', tee: '#ff7a59', pants: '#2f4f86', shoe: '#f4f1ea', headK: 1.35, hairC: '#5a3a22', shW: 30, hipW: 16,
      face (THREE, f, R, K) { eyes(THREE, f, R, K, true); nose(THREE, f, R, K, 0.8); hair(THREE, f, R, K, '#5a3a22'); } },
    kid2: { h: 120, skin: '#c9946e', tee: '#7ad3ff', pants: '#3a3d46', shoe: '#e05a4a', headK: 1.35, hairC: '#20170f', shW: 29, hipW: 15,
      face (THREE, f, R, K) { eyes(THREE, f, R, K, true); nose(THREE, f, R, K, 0.8); hair(THREE, f, R, K, '#20170f'); } }
  };
  function hair (THREE, f, R, K, c) {
    const m = K.tagM(K.M('hair' + c, c, { roughness: 0.9 }), 'dark');
    const cap = K.mesh(new THREE.SphereGeometry(R * 1.04, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), m, f, 0, R * 0.02, -R * 0.04, 0.95, 1.1, 1.04);
    cap.rotation.x = -0.35;
  }
  global.MANICHINI = { build, SPEC };
})(typeof window !== 'undefined' ? window : globalThis);
