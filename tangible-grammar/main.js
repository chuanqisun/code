'use strict';

/* ════════════════════════════════════════════════════════════════
   Stage — shared three.js infrastructure.
   anims.js describes each gesture with the small vocabulary below;
   every card renders through one WebGL canvas (scissored per card),
   the detail dialog has its own renderer you can drag to orbit.
   ════════════════════════════════════════════════════════════════ */

const THREE_URL = 'https://esm.sh/three@0.187.0';

import_three().catch(err => {
  document.querySelector('#dict').innerHTML = `<p class="mute">Could not load three.js from esm.sh (${err.message}).</p>`;
});

async function import_three() {
  const THREE = await import(THREE_URL);
  const H = 1;
  const COL = { act: 0xf4a261, env: 0x6fd3c2, mute: 0x666666, fg: 0xffffff };
  const EASE = {
    lin: u => u,
    io: u => (u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2),
    in: u => u ** 3,
    out: u => 1 - (1 - u) ** 3,
  };
  const CAM = { r: 37, el: Math.atan2(18, 26), target: new THREE.Vector3(0, .5, -2.5) };

  const basic = (c, op = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: op >= 1 });
  const lambert = c => new THREE.MeshLambertMaterial({ color: c, transparent: true });
  const lines = (c, op = 1, dash = false) => dash
    ? new THREE.LineDashedMaterial({ color: c, transparent: true, opacity: op, dashSize: .5, gapSize: .5, depthWrite: false })
    : new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false });
  const lerp = (a, b, u) => a + (b - a) * u;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  class Stage {
    tracks = [];
    pucks = [];
    fx = [];

    constructor(key) {
      const [build, { dur = 3.6, poster = .6 } = {}] = ANIM[key];
      Object.assign(this, { dur, poster });
      this.scene = new THREE.Scene();
      this.root = new THREE.Group();
      this.scene.add(new THREE.AmbientLight(0xffffff, 1.1), new THREE.DirectionalLight(0xffffff, 2.2).translateX(6).translateY(14).translateZ(10), this.root);
      this.cam = new THREE.PerspectiveCamera(32, 12 / 7, .1, 200);
      const grid = new THREE.GridHelper(44, 22, 0x262626, 0x151515);
      grid.material.transparent = true;
      this.root.add(grid);
      build(this);
      this.root.children.forEach(n => {
        n.userData.op ??= 1;
        n.traverse(o => o.material && [].concat(o.material).forEach(m => this.fx.push({ m, base: m.opacity, n })));
      });
      this.view();
    }

    /* camera: az / el offsets in radians (dialog drag, card sway) */
    view(az = 0, el = 0) {
      const e = CAM.el + el;
      this.cam.position.set(CAM.r * Math.cos(e) * Math.sin(az), CAM.r * Math.sin(e), CAM.target.z + CAM.r * Math.cos(e) * Math.cos(az));
      this.cam.lookAt(CAM.target);
    }

    update(t) {
      this.tracks.forEach(f => f(t));
      for (const p of this.pucks) {
        const { shadow } = p.userData, flat = Math.abs(p.rotation.x % Math.PI) < .4 && Math.abs(p.rotation.z % Math.PI) < .4;
        shadow.position.set(p.position.x, .02, p.position.z);
        shadow.userData.op = flat ? p.userData.op / (1 + Math.max(0, p.position.y - .5) * .4) : 0;
      }
      const fade = clamp(Math.min(t, 1 - t) / .05);
      for (const { m, base, n } of this.fx) m.opacity = base * n.userData.op * fade;
      for (const n of this.root.children) n.visible = n.userData.op * fade > .003;   // fully faded nodes must not write depth
    }

    dispose() {
      this.scene.traverse(o => { o.geometry?.dispose(); [].concat(o.material ?? []).forEach(m => m.dispose()); });
    }

    /* ── scene vocabulary ── */
    add(node, at = this.root) { at.add(node); return node; }
    at(node, x, y, z) { node.position.set(x, y, z); return node; }

    puck({ b = false, tick = true } = {}) {
      const geo = new THREE.CylinderGeometry(3, 3, H, 48);
      const [top, side, bottom, edge] = b ? [0x4b5058, 0x30343a, 0xd0d4d9, 0xd0d4d9] : [0xf1f1f1, 0x9a9a9a, 0x2a2a2a, 0xffffff];
      const g = new THREE.Group();
      g.add(
        new THREE.Mesh(geo, [lambert(side), lambert(top), lambert(bottom)]),
        new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), lines(edge)),
      );
      if (tick) g.add(new THREE.Mesh(new THREE.BoxGeometry(.3, .04, 2.2), basic(b ? 0xffffff : 0x000000)).translateY(H / 2 + .02).translateZ(-1.5));
      g.position.y = .5;
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(3, 40).rotateX(-Math.PI / 2), basic(0xffffff, .1));
      g.userData.shadow = this.add(shadow);
      this.pucks.push(g);
      return this.add(g);
    }

    ghost(x, y, z, { r = [0, 0, 0], dash = false } = {}) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(3, 3, H, 40), 20), lines(COL.mute, 1, dash));
      e.computeLineDistances();
      e.rotation.set(...r.map(d => d * Math.PI / 180));
      return this.at(this.add(e), x, y, z);
    }

    finger(parent, x, y, z) {
      return this.at(this.add(new THREE.Mesh(new THREE.SphereGeometry(.45, 16, 12), basic(COL.act)), parent ?? this.root), x, y, z);
    }
    hand(x = 0, y = .5, z = 0) { return this.finger(null, x, y, z); }
    top(p) { return this.finger(p, 0, H / 2 + .5, 0); }
    pinch(p) { this.finger(p, -3.45, 0, 0); this.finger(p, 3.45, 0, 0); }

    palm(r, op = .3) {
      const g = new THREE.Group(), geo = new THREE.CylinderGeometry(r, r, .3, 40);
      g.add(new THREE.Mesh(geo, basic(COL.act, op)), new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), lines(COL.act)));
      return this.add(g);
    }

    token(x, z, { y = .5, size = .9, op = 1, c = 'env' } = {}) {
      return this.at(this.add(new THREE.Mesh(new THREE.BoxGeometry(size, size, size), basic(COL[c], op))), x, y, z);
    }

    bar(x, z, len) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(len, .5, .5), basic(COL.env)).translateX(len / 2));
      return this.at(this.add(g), x, .3, z);
    }

    loop(pts, { c = 'mute', y = .05, dash = false, at = this.root, op = 1 } = {}) {
      const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(x, 0, z))), lines(COL[c], op, dash));
      l.computeLineDistances();
      l.position.y = y;
      return this.add(l, at);
    }
    circle(x, z, r, o = {}) {
      const l = this.loop(Array.from({ length: 64 }, (_, i) => [r * Math.cos(i / 64 * 2 * Math.PI), r * Math.sin(i / 64 * 2 * Math.PI)]), o);
      l.position.x = x; l.position.z = z;
      return l;
    }
    zone(x, z, w, d, o = {}) {
      const l = this.loop([[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]], o);
      l.position.x = x; l.position.z = z;
      return l;
    }
    line(pts, { c = 'mute', y = .05, dash = false } = {}) {
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(x, y, z))), lines(COL[c], 1, dash));
      l.computeLineDistances();
      return this.add(l);
    }
    vline(x, z, h) {
      const v = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h, 0)];
      for (let y = 0; y <= h; y += 2.5) v.push(new THREE.Vector3(-.4, y, 0), new THREE.Vector3(.4, y, 0));
      const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(v), lines(COL.mute));
      return this.at(this.add(l), x, 0, z);
    }
    wall(pts, h = 2.5) {
      const pos = [];
      for (let i = 1; i < pts.length; i++) {
        const [a, b] = [pts[i - 1], pts[i]];
        pos.push(a[0], 0, a[1], b[0], 0, b[1], b[0], h, b[1], a[0], 0, a[1], b[0], h, b[1], a[0], h, a[1]);
      }
      const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const m = new THREE.Mesh(geo, basic(0xffffff, .1)); m.material.side = THREE.DoubleSide;
      const top = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(x, h, z))), lines(0xffffff));
      const base = this.line(pts, { c: 'fg', y: .02 });
      return this.add(new THREE.Group().add(m, top)) && base;
    }

    /* ── timing ──────────────────────────────────────────────── */
    anim(node, frames) {
      const keys = new Set(frames.flatMap(f => Object.keys(f)));
      const norm = v => (typeof v === 'number' ? [v, v, v] : v);
      let st = { p: node.position.toArray(), r: [0, 0, 0], s: [1, 1, 1], op: 1 };
      const F = frames.map(({ o, e = 'io', ...f }) => {
        if (f.s != null) f.s = norm(f.s);
        st = { ...st, ...f };
        return { o: Math.min(o, 1), e: EASE[e], ...st };
      });
      if (F[0].o > 0) F.unshift({ ...F[0], o: 0 });
      if (F.at(-1).o < 1) F.push({ ...F.at(-1), o: 1 });
      const mix = (a, b, u) => a.map((v, i) => lerp(v, b[i], u));
      this.tracks.push(t => {
        let i = F.length - 1;
        while (i > 0 && F[i].o > t) i--;
        const a = F[i], b = F[i + 1];
        const u = b ? b.e((t - a.o) / (b.o - a.o)) : 0, at = k => (b ? mix(a[k], b[k], u) : a[k]);
        if (keys.has('p')) node.position.set(...at('p'));
        if (keys.has('r')) node.rotation.set(...at('r').map(d => d * Math.PI / 180));
        if (keys.has('s')) node.scale.set(...at('s'));
        if (keys.has('op')) node.userData.op = b ? lerp(a.op, b.op, u) : a.op;
      });
      return node;
    }
    vis(node, pts) { return this.anim(node, pts.map(([o, op]) => ({ o, op, e: 'lin' }))); }
    flash(node, at, len = .15) { return this.vis(node, [[0, 0], [at, 0], [at + .001, 1], [at + len, 0]]); }
    show(node, at, end = .93) { return this.vis(node, [[0, 0], [at, 0], [at + .02, 1], [end, 1], [end + .04, 0]]); }

    /* tokens appearing one after another: the environment's response */
    emit(pts, o0, o1, { decay = false } = {}) {
      pts.forEach(([x, z], i) => this.show(this.token(x, z, { size: decay ? .9 - .6 * i / (pts.length - 1) : .9 }), o0 + (o1 - o0) * i / (pts.length - 1)));
    }

    /* drawn progressively from o0 to o1 */
    trail(pts, o0, o1, { y = .06 } = {}) {
      const geo = new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(x, y, z)));
      const l = this.add(new THREE.Line(geo, lines(COL.act)));
      this.tracks.push(t => geo.setDrawRange(0, Math.ceil(clamp((t - o0) / (o1 - o0)) * pts.length)));
      return l;
    }

    ring(x, z, at, { r = 3.5, k = 2.5, c = 'act' } = {}) {
      const l = this.circle(0, 0, r, { c });
      return this.anim(l, [q(0, x, .05, z, { s: 1, op: 0 }), { o: at }, { o: at + .001, op: 1, e: 'out' }, { o: at + .2, s: k, op: 0, e: 'out' }]);
    }

    /* line between two moving nodes */
    link(a, b, o0, o1) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const l = this.add(new THREE.Line(geo, lines(COL.env)));
      l.userData.op = 0;
      this.tracks.push(t => {
        const pos = geo.attributes.position;
        pos.setXYZ(0, a.position.x, .6, a.position.z);
        pos.setXYZ(1, b.position.x, .6, b.position.z);
        pos.needsUpdate = true;
        l.userData.op = t >= o0 && t <= o1 ? 1 : 0;
      });
      return l;
    }
  }

  /* ════════════════════════════════════════════════════════════════
     UI
     ════════════════════════════════════════════════════════════════ */

  const $ = (sel, root = document) => root.querySelector(sel);
  const pad = n => String(n).padStart(2, '0');
  const sentence = t => t.toLowerCase().replace(/[a-z]/, c => c.toUpperCase());
  const mark = t => t.replace(/`([^`]+)`/g, '<b class="act">$1</b>');

  CATS.forEach(c => (c.met = sentence(c.met)));
  ENTRIES.forEach(e => { e.met = sentence(e.met); e.search += ' ' + e.met.toLowerCase(); });

  const cardHTML = e => `
    <a class="card" href="#${e.key}" data-item data-cat="${e.cat}" data-key="${e.key}">
      <div class="stage" data-key="${e.key}"><span class="out env">${e.out}</span></div>
      <div class="body">
        <h3>${e.key} <small class="mute">${pad(e.n)}</small></h3>
        <p class="act">${e.g.join(' · ')}</p>
        <p class="mute">${e.terms.slice(1).join(' · ')}</p>
        <p>${e.met}</p>
      </div>
    </a>`;

  $('#dict').innerHTML = CATS.map(c => `
    <section data-cat="${c.id}">
      <h2>${c.id}. ${c.name} <small class="mute">${c.met} · ${c.n}</small></h2>
      <div class="grid">${ENTRIES.filter(e => e.cat === c.id).map(cardHTML).join('')}</div>
    </section>`).join('') + `
    <section data-cat="P">
      <h2>Phrases <small class="mute">verbs compose into sequences</small></h2>
      ${PHRASES.map(p => `
        <div class="phrase" data-item data-cat="P" data-text="${p.name} ${p.steps.map(s => s.join(' ')).join(' ')}">
          <h3>${p.name}</h3>
          <ol>${p.steps.map(([g, k]) => `<li><a class="card" href="#${k}"><div class="stage" data-key="${k}"></div><span class="act">${g}</span></a></li>`).join('')}</ol>
        </div>`).join('')}
    </section>`;

  /* ── cards: one canvas, one scissored viewport per card ── */
  let motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dirty = true;
  const canvas = $('#gl');
  const gl = new THREE.WebGLRenderer({ canvas, antialias: true });
  gl.setPixelRatio(Math.min(devicePixelRatio, 2));
  gl.setClearColor(0x000000, 1);
  const fit = () => { gl.setSize(innerWidth, innerHeight, false); dirty = true; };
  fit();
  addEventListener('resize', fit);
  addEventListener('scroll', () => (dirty = true), { passive: true });

  const views = [...document.querySelectorAll('.card .stage')].map(el => ({ el, stage: new Stage(el.dataset.key) }));
  const dlg = $('#entry');
  let dlgView = null;

  const tick = now => {
    requestAnimationFrame(tick);
    if (dlgView) return dlgView.frame(now);
    if (!motion && !dirty) return;
    dirty = false;
    gl.setScissorTest(false);
    gl.clear();
    gl.setScissorTest(true);
    for (const { el, stage } of views) {
      const r = el.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
      const y = innerHeight - r.bottom;
      gl.setViewport(r.left, y, r.width, r.height);
      gl.setScissor(r.left, y, r.width, r.height);
      stage.update(motion ? (now / 1000 / stage.dur) % 1 : stage.poster);
      stage.view(Math.sin(now / 4200) * .14 * motion);
      gl.render(stage.scene, stage.cam);
    }
  };
  requestAnimationFrame(tick);

  /* ── detail dialog: own renderer, drag to orbit ── */
  let dlgGL = null;
  const openEntry = e => {
    const c = CATS.find(c => c.id === e.cat);
    const prev = ENTRIES.at(e.n - 2), next = ENTRIES[e.n % ENTRIES.length];
    Object.assign(dlg.dataset, { prev: prev.key, next: next.key });
    dlg.innerHTML = `
      <div class="stage"><span class="out env">${e.out}</span></div>
      <div class="body">
        <h2>${e.key} <small class="mute">${e.terms.slice(1).join(' · ')}</small></h2>
        <dl>
          <dt>Gesture</dt><dd class="act">${e.g.join(' · ')}</dd>
          <dt>Syntax</dt><dd>${mark(e.syn)}</dd>
          <dt>Semantics</dt><dd>${e.sem}</dd>
          <dt>Metaphor</dt><dd>${e.met}<br><span class="mute">${e.ground}</span></dd>
          <dt>Voice</dt><dd class="mute">${e.voice.map(v => `“${v}”`).join(' ')}</dd>
          <dt>Category</dt><dd class="mute">${c.id}. ${c.name} · ${c.schema.toLowerCase()} · ${c.n}</dd>
        </dl>
        <nav><a href="#${prev.key}">← ${prev.key}</a><form method="dialog"><button>Close</button></form><a href="#${next.key}">${next.key} →</a></nav>
      </div>`;
    if (!dlg.open) dlg.showModal();
    dlgView?.stage.dispose();

    dlgGL ??= new THREE.WebGLRenderer({ antialias: true });
    dlgGL.setPixelRatio(Math.min(devicePixelRatio, 2));
    const host = $('.stage', dlg);
    host.prepend(dlgGL.domElement);
    dlgGL.setSize(host.clientWidth, host.clientHeight);

    const stage = new Stage(e.key), drag = { az: 0, el: 0 };
    let t0 = performance.now();
    dlgGL.domElement.onpointermove = ev => {
      if (!ev.buttons) return;
      drag.az -= ev.movementX * .008;
      drag.el = clamp(drag.el + ev.movementY * .006, -.5, .6);
      if (!motion) dlgView.frame(performance.now());
    };
    dlgView = {
      stage,
      frame(now) {
        stage.update(motion ? ((now - t0) / 1000 / stage.dur) % 1 : stage.poster);
        stage.view(drag.az + Math.sin(now / 4200) * .1 * motion, drag.el);
        dlgGL.render(stage.scene, stage.cam);
      },
    };
    dlgView.frame(performance.now());
  };

  dlg.addEventListener('close', () => {
    dlgView?.stage.dispose();
    dlgView = null;
    dirty = true;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  });
  dlg.addEventListener('click', ev => ev.target === dlg && dlg.close());
  dlg.addEventListener('keydown', ev => {
    const k = { ArrowLeft: dlg.dataset.prev, ArrowRight: dlg.dataset.next }[ev.key];
    if (k) location.hash = k;
  });
  new ResizeObserver(() => dlgView && dlgGL.setSize($('.stage', dlg).clientWidth, $('.stage', dlg).clientHeight)).observe(dlg);

  const route = () => {
    const e = BY[decodeURIComponent(location.hash.slice(1))];
    if (e) openEntry(e);
    else if (dlg.open) dlg.close();
  };
  addEventListener('hashchange', route);
  route();

  /* ── search & filter ── */
  const search = $('#q'), filters = $('#filters'), count = $('#count');
  const sections = [...document.querySelectorAll('#dict > section')];
  const items = [...document.querySelectorAll('[data-item]')].map(el => ({
    el, cat: el.dataset.cat, text: (BY[el.dataset.key]?.search ?? el.dataset.text).toLowerCase(),
  }));
  let cat = 'all';

  const filter = () => {
    const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let n = 0;
    for (const it of items) {
      const on = (cat === 'all' || it.cat === cat) && words.every(w => it.text.includes(w));
      it.el.hidden = !on;
      if (on && it.cat !== 'P') n++;
    }
    sections.forEach(s => (s.hidden = !s.querySelector('[data-item]:not([hidden])')));
    $('#empty').hidden = sections.some(s => !s.hidden);
    count.value = `${n} / ${ENTRIES.length}`;
    dirty = true;
  };

  filters.innerHTML = [['all', 'All'], ...CATS.map(c => [c.id, `${c.id} ${c.short}`]), ['P', 'Phrases']]
    .map(([id, label]) => `<button data-f="${id}" aria-pressed="${id === 'all'}">${label}</button>`).join('');
  filters.addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    cat = b.dataset.f;
    filters.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    filter();
  });
  search.addEventListener('input', filter);
  addEventListener('keydown', ev => {
    if (ev.key === '/' && document.activeElement !== search && !dlg.open) { ev.preventDefault(); search.focus(); }
  });
  filter();

  const mBtn = $('#motion');
  const setMotion = on => { motion = on; dirty = true; mBtn.setAttribute('aria-pressed', on); };
  mBtn.addEventListener('click', () => setMotion(!motion));
  setMotion(motion);
}
