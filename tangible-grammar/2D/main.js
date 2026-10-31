'use strict';

/* ════════════════════════════════════════════════════════════════
   Stage — shared animation infrastructure
   Every gesture is drawn on a 240×140 SVG stage at a single scale
   (puck r = 3 cm → R = 18u, h = 1 cm → T = 6u) and animated with the
   Web Animations API on one shared loop, so all items read alike.
   ════════════════════════════════════════════════════════════════ */

const NS = 'http://www.w3.org/2000/svg';
const W = 240, H = 140, R = 18, T = 6, G = 112, CX = 120, CY = 70;
const DUR = 3200;
const HEX = [[0, 0], [36, 0], [-36, 0], [18, 31], [-18, 31], [18, -31], [-18, -31]];

const lin = t => t;
const eio = t => (t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const rng = (seed = 1) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rad = a => (a * Math.PI) / 180;

const mk = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.append(n);
  return n;
};

/* Same transform structure on every frame so all keyframes interpolate. */
const tf = ({ x, y, r, sx, sy, px, py }) =>
  `translate(${x + px}px, ${y + py}px) rotate(${r}deg) translate(${-px}px, ${-py}px) scale(${sx}, ${sy})`;

/* Shorthand frames → WAAPI keyframes. Unspecified values carry forward.
   o: offset · x y: position · r: rotation · s|sx|sy: scale · px py: pivot · op: opacity · e: easing */
const keyframes = frames => {
  let st = { x: 0, y: 0, r: 0, sx: 1, sy: 1, px: 0, py: 0, op: 1 };
  const kf = frames.map(({ o, e = 'ease-in-out', s, ...f }) => {
    if (s != null) f.sx = f.sy = s;
    st = { ...st, ...f };
    return { offset: Math.min(o, 1), easing: e, opacity: st.op, transform: tf(st) };
  });
  if (kf[0].offset > 0) kf.unshift({ ...kf[0], offset: 0 });
  if (kf.at(-1).offset < 1) kf.push({ ...kf.at(-1), offset: 1 });
  return kf;
};

class Stage {
  anims = [];

  constructor(svg, key, out = '') {
    const [view, build, { dur = DUR, poster = .5 } = {}] = ANIM[key];
    Object.assign(this, { svg, dur, poster });
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.replaceChildren();
    if (view === 'side') this.line(8, G, W - 8, G, 'gr');
    this.text(6, 12, view.toUpperCase());
    if (out) this.text(W - 6, H - 6, out, 'out');
    build(this);
    this.pause();
  }

  resume() { this.anims.forEach(a => a.play()); }
  pause() { this.anims.forEach(a => { a.pause(); a.currentTime = this.poster * this.dur; }); }
  destroy() { this.anims.forEach(a => a.cancel()); this.svg.replaceChildren(); }

  /* ── primitives ── */
  el(tag, attrs, at = this.svg) { return mk(tag, attrs, at); }
  text(x, y, t, cls = '') { const n = this.el('text', { x, y, class: cls }); n.textContent = t; return n; }
  line(x1, y1, x2, y2, cls = 'gd', at) { return this.el('line', { x1, y1, x2, y2, class: cls }, at); }
  path(d, cls = 'gd', at) { return this.el('path', { d, class: cls }, at); }
  dot(cx, cy, r, cls = 'gd', at) { return this.el('circle', { cx, cy, r, class: cls }, at); }
  token(x, y) { return this.el('rect', { x: x - 2.5, y: y - 2.5, width: 5, height: 5, class: 'sys' }); }
  at(node, x, y) { node.setAttribute('transform', `translate(${x} ${y})`); return node; }

  /* ── pucks, drawn around their own origin ── */
  body(shape, attrs, { b, tick } = {}) {
    const g = this.el('g', b ? { class: 'b' } : {});
    this.el(shape, { ...attrs, class: 'pk' }, g);
    if (tick) this.line(0, 0, 0, 4 - R, 'tk', g);
    return g;
  }
  puck(o) { return this.body('circle', { r: R }, o); }                                   // top: flat
  blade(o) { return this.body('rect', { x: -R, y: -T / 2, width: 2 * R, height: T }, o); } // top: on rim
  slab(o) { return this.body('rect', { x: -R, y: -T, width: 2 * R, height: T }, o); }      // side: flat, origin bottom-centre
  edge(o) { return this.body('rect', { x: -T / 2, y: -2 * R, width: T, height: 2 * R }, o); } // side: on rim
  disc(o) { return this.body('circle', { r: R }, { tick: true, ...o }); }                // side: rolling face-on

  /* ── gesture marks ── */
  finger(at = this.svg, x = 0, y = 0) { return this.dot(x, y, 3.5, 'f', at); }
  palm(r = 24) { return this.dot(0, 0, r, 'palm'); }
  hand(k) { return this.path(`M0 -44Q${18 * k} 0 0 44`, 'hand'); }

  /* ── timing ── */
  #run(node, kf) {
    const a = node.animate(kf, { duration: this.dur, iterations: Infinity, fill: 'both' });
    this.anims.push(a);
    return node;
  }
  play(node, frames) { return this.#run(node, keyframes(frames)); }
  opac(node, pts) {
    pts = pts.map(([o, v]) => [Math.min(o, 1), v]);
    if (pts[0][0] > 0) pts.unshift([0, pts[0][1]]);
    if (pts.at(-1)[0] < 1) pts.push([1, pts.at(-1)[1]]);
    return this.#run(node, pts.map(([offset, opacity]) => ({ offset, opacity })));
  }
  flash(node, at, len = .15) { return this.opac(node, [[at, 0], [at + .001, 1], [at + len, 0]]); }
  show(node, at, end = .92) { return this.opac(node, [[at, 0], [at + .03, 1], [end, 1], [end + .06, 0]]); }
  trail(d, o0, o1, e = 'linear') {
    const p = this.el('path', { d, class: 'tr' }), L = p.getTotalLength();
    p.style.strokeDasharray = `${L}px`;
    return this.#run(p, [[0, 1, 1], [o0, 1, 1, e], [o1, 0, 1], [.92, 0, 1], [.98, 0, 0], [1, 0, 0]]
      .map(([offset, k, opacity, easing = 'linear']) => ({ offset, strokeDashoffset: `${k * L}px`, opacity, easing })));
  }
  ring(x, y, at, r = 4, k = 3) {
    return this.play(this.dot(0, 0, r, 'fx'), [{ o: 0, x, y, op: 0 }, { o: at, op: 0 }, { o: at + .001, op: 1, e: 'ease-out' }, { o: at + .18, s: k, op: 0 }]);
  }
  impact(x, y, at) {
    const a = x - R - 3, b = x + R + 3;
    return this.flash(this.path(`M${a} ${y - 1}l-6 -4M${a} ${y - 6}l-5 -1M${b} ${y - 1}l6 -4M${b} ${y - 6}l5 -1`, 'fx'), at, .18);
  }

  /* ── motion generators → frame lists ── */
  along(d, o0, o1, { from = 0, to = 1, n = 40, ez = lin } = {}) {
    const p = this.path(d, 'gd'), L = p.getTotalLength();
    const fr = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n, { x, y } = p.getPointAtLength(L * (from + (to - from) * ez(t)));
      return { o: o0 + (o1 - o0) * t, x, y, e: 'linear' };
    });
    p.remove();
    return fr;
  }
  arc(cx, cy, r, a0, a1, o0, o1, { n = 36, spin = 0, ez = lin } = {}) {
    return Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n, a = a0 + (a1 - a0) * ez(t);
      return { o: o0 + (o1 - o0) * t, x: cx + r * Math.cos(rad(a)), y: cy + r * Math.sin(rad(a)), r: spin * (a - a0), e: 'linear' };
    });
  }
}

/* vertical level gauge shared by lift / lower */
const level = (s, fr) => {
  s.line(18, G, 18, G - 92);
  for (let i = 0; i <= 4; i++) s.line(14, G - i * 22, 22, G - i * 22, 'scl');
  s.play(s.token(0, 0), fr.map(({ sx, sy, ...f }) => ({ ...f, x: 18 })));
};

/* ════════════════════════════════════════════════════════════════
   Gesture animations   key → [view, build(stage), {dur, poster}]
   ════════════════════════════════════════════════════════════════ */

const ANIM = {
  /* ── I · execution & lifecycle ── */
  stream: ['top', s => {
    s.path('M40 70H200');
    s.trail('M40 70H200', .08, .85);
    for (let x = 50; x <= 190; x += 20) s.show(s.token(x, 98), .08 + ((x - 40) / 160) * .77);
    const p = s.puck(); s.finger(p);
    s.play(p, [{ o: 0, x: 40, y: 70, op: 0 }, { o: .08, op: 1, e: 'linear' }, { o: .85, x: 200 }, { o: .92 }, { o: 1, op: 0 }]);
  }],

  halt: ['top', s => {
    s.trail('M30 70H130', .05, .35);
    [40, 60, 80, 100, 120].forEach(x => s.show(s.token(x, 98), .05 + ((x - 30) / 100) * .3));
    const p = s.puck();
    s.play(p, [{ o: 0, x: 30, y: 70, op: 0 }, { o: .05, op: 1, e: 'linear' }, { o: .35, x: 130 }, { o: .9 }, { o: 1, op: 0 }]);
    s.play(s.palm(), [{ o: 0, x: 130, y: 70, s: 1.8, op: 0 }, { o: .28, e: 'ease-in' }, { o: .35, s: 1, op: 1 }, { o: .9 }, { o: 1, op: 0 }]);
    s.ring(130, 70, .35, R + 6, 1.6);
  }, { poster: .6 }],

  launch: ['top', s => {
    const zone = 'M192 40h40v60h-40z';
    s.path(zone);
    s.flash(s.path(zone, 'sysl'), .7, .25);
    const p = s.puck(), f = s.finger(), fly = 'cubic-bezier(.1,.9,.2,1)';
    s.play(p, [{ o: 0, x: 60, y: 70, op: 0 }, { o: .1, op: 1, e: 'ease-out' }, { o: .3, x: 44 }, { o: .36, e: fly }, { o: .7, x: 212 }, { o: .9 }, { o: 1, op: 0 }]);
    s.play(f, [{ o: 0, x: 60 - R - 4, y: 70, op: 0 }, { o: .1, op: 1, e: 'ease-out' }, { o: .3, x: 44 - R - 4 }, { o: .36, e: 'ease-out' }, { o: .46, x: 70, op: 0 }]);
  }, { poster: .4 }],

  commit: ['side', s => {
    const p = s.slab(); s.finger(p, 0, -T - 4);
    s.play(p, [{ o: 0, x: 120, y: G, op: 0 }, { o: .1, op: 1, e: 'ease-out' }, { o: .35, y: G - 30, e: 'cubic-bezier(.7,0,1,.5)' }, { o: .42, y: G }, { o: .9 }, { o: 1, op: 0 }]);
    s.impact(120, G, .42);
    s.show(s.token(120, G + 12), .43);
  }, { poster: .3 }],

  retry: ['side', s => {
    const p = s.slab(), f = s.finger();
    s.play(p, [{ o: 0, x: 120, y: G, op: 0 }, { o: .08, op: 1 }, { o: .3, e: 'ease-out' }, { o: .4, y: G - 22, e: 'ease-in' }, { o: .5, y: G, e: 'ease-out' }, { o: .55, y: G - 5, e: 'ease-in' }, { o: .6, y: G }, { o: .9 }, { o: 1, op: 0 }]);
    s.play(f, [{ o: 0, x: 120, y: G - 36, op: 0 }, { o: .12, op: 1, e: 'ease-in' }, { o: .3, y: G - T - 3.5, e: 'ease-out' }, { o: .4, y: G - 46, op: 0 }]);
  }, { poster: .4 }],

  pause: ['side', s => {
    const sh = s.el('ellipse', { rx: R, ry: 2, class: 'shd' });
    const p = s.slab(); s.finger(p, -R - 4, -T / 2); s.finger(p, R + 4, -T / 2);
    s.play(p, [{ o: 0, x: 120, y: G, op: 0 }, { o: .1, op: 1 }, { o: .2, e: 'ease-out' }, { o: .42, y: G - 36 }, { o: .57, y: G - 40 }, { o: .72, y: G - 36 }, { o: .87, y: G - 40 }, { o: 1, op: 0 }]);
    s.play(sh, [{ o: 0, x: 120, y: G, op: 0 }, { o: .1, op: 1 }, { o: .2, e: 'ease-out' }, { o: .42, sx: .55 }, { o: .87 }, { o: 1, op: 0 }]);
  }],

  resume: ['side', s => {
    const sh = s.el('ellipse', { rx: R, ry: 2, class: 'shd' });
    const p = s.slab(); s.finger(p, 0, -T - 4);
    const fr = [{ o: 0, x: 70, y: G - 38, op: 0 }, { o: .1, op: 1 }, { o: .18 }, { o: .42, y: G }, { o: .48, e: 'linear' }, { o: .88, x: 190 }, { o: .92 }, { o: 1, op: 0 }];
    s.play(p, fr);
    s.play(sh, fr.map(f => ({ ...f, y: G, ...(f.o === 0 && { sx: .55 }), ...(f.o === .42 && { sx: 1 }) })));
    s.flash(s.line(70 - R, G, 70 + R, G, 'fx'), .42, .2);
    for (let x = 88; x <= 184; x += 16) s.show(s.token(x, G + 14), .48 + ((x - 70) / 120) * .4);
  }, { poster: .3 }],

  backtrack: ['top', s => {
    const d = 'M30 100L80 45L140 85L205 40';
    s.path(d);
    [[30, 100], [80, 45], [140, 85], [205, 40]].forEach(([x, y]) => s.dot(x, y, 2, 'gdot'));
    s.trail('M205 40L140 85L80 45', .5, .85);
    const p = s.puck(); s.finger(p);
    s.play(p, [{ o: 0, x: 30, y: 100, op: 0 }, { o: .05, op: 1 }, ...s.along(d, .05, .4), { o: .5 }, ...s.along(d, .5, .85, { from: 1, to: .33 }), { o: .92 }, { o: 1, op: 0 }]);
  }, { poster: .7 }],

  nudge: ['top', s => {
    s.dot(120, 70, R);
    const p = s.puck(), f = s.finger();
    s.play(p, [{ o: 0, x: 120, y: 70, op: 0 }, { o: .1, op: 1 }, { o: .4, e: 'ease-out' }, { o: .5, x: 128 }, { o: .9 }, { o: 1, op: 0 }]);
    s.play(f, [{ o: 0, x: 70, y: 70, op: 0 }, { o: .15, op: 1, e: 'ease-in' }, { o: .4, x: 120 - R - 4, e: 'ease-out' }, { o: .5, x: 128 - R - 4 }, { o: .55, e: 'ease-in' }, { o: .7, x: 80, op: 0 }]);
  }, { poster: .48 }],

  drift: ['top', s => {
    const p = s.puck(), f = s.finger();
    s.play(p, [{ o: 0, x: 40, y: 70, op: 0 }, { o: .08, op: 1 }, { o: .12, e: 'cubic-bezier(.15,.75,.3,1)' }, { o: .85, x: 195 }, { o: .92 }, { o: 1, op: 0 }]);
    s.play(f, [{ o: 0, x: 40 - R - 4, y: 70, op: 0 }, { o: .08, op: 1 }, { o: .12, e: 'ease-out' }, { o: .2, x: 70 - R - 4, op: 0 }]);
    for (let i = 0; i < 8; i++) {
      const u = (i + .5) / 8, t = s.token(40 + 155 * (1 - (1 - u) ** 3), 98);
      t.setAttribute('fill-opacity', 1 - i / 9);
      s.show(t, .12 + u * .73);
    }
  }, { poster: .7 }],

  /* ── II · parameters & steering ── */
  adjust: ['top', s => {
    for (let a = -135; a <= 135; a += 27) s.line(120 + 27 * Math.sin(rad(a)), 70 - 27 * Math.cos(rad(a)), 120 + 31 * Math.sin(rad(a)), 70 - 31 * Math.cos(rad(a)), 'scl');
    const bar = s.el('rect', { width: 120, height: 3, class: 'sys' });
    const p = s.puck({ tick: true }); s.finger(p, -R - 4, 0); s.finger(p, R + 4, 0);
    s.play(p, [{ o: 0, x: 120, y: 70, r: -100 }, { o: .1 }, { o: .45, r: 80 }, { o: .6 }, { o: .95, r: -100 }]);
    s.play(bar, [{ o: 0, x: 60, y: 118, sx: .15, sy: 1 }, { o: .1 }, { o: .45, sx: .9 }, { o: .6 }, { o: .95, sx: .15 }]);
  }, { poster: .3 }],

  compress: ['side', s => {
    const p = s.slab(), hand = s.el('g');
    s.el('rect', { x: -R - 4, y: -4, width: 2 * R + 8, height: 4, class: 'act' }, hand);
    s.path('M-8 -18v9m-3 -3l3 3l3 -3M8 -18v9m-3 -3l3 3l3 -3', 'fx', hand);
    s.play(p, [{ o: 0, x: 120, y: G }, { o: .2 }, { o: .55, sx: 1.08, sy: .45 }, { o: .75 }, { o: .95, sx: 1, sy: 1 }]);
    s.play(hand, [{ o: 0, x: 120, y: G - T - 1, op: 0 }, { o: .12, op: 1 }, { o: .2 }, { o: .55, y: G - T * .45 - 1 }, { o: .75 }, { o: .85, y: G - T - 10, op: 0 }]);
  }, { poster: .6 }],

  abstract: ['side', s => {
    for (let x = 60; x <= 180; x += 12) s.opac(s.dot(x, G + 6, 1.2, 'gdot'), [[.15, 1], [.6, 0], [.95, 0], [1, 1]]);
    const fr = [{ o: 0, x: 120, y: G, op: 0 }, { o: .1, op: 1 }, { o: .15 }, { o: .75, y: G - 84 }, { o: .88 }, { o: 1, op: 0 }];
    level(s, fr);
    const p = s.slab(); s.finger(p, -R - 4, -T / 2); s.finger(p, R + 4, -T / 2);
    s.play(p, fr);
  }, { poster: .7 }],

  specialize: ['side', s => {
    s.path(`M146 ${G + 5}l8 8m0 -8l-8 8`, 'scl');
    const fr = [{ o: 0, x: 80, y: G - 84, op: 0 }, { o: .1, op: 1 }, { o: .15 }, { o: .5, x: 150, y: G }, { o: .56, sy: .8 }, { o: .64, sy: 1 }, { o: .9 }, { o: 1, op: 0 }];
    level(s, fr);
    const p = s.slab(); s.finger(p, 0, -T - 4);
    s.play(p, fr);
    s.impact(150, G, .5);
  }, { poster: .35 }],

  steer: ['top', s => {
    const d = 'M25 105C90 105 125 100 150 75S190 32 220 30';
    s.path('M25 105H225');
    s.trail(d, .08, .85);
    const p = s.puck(); s.finger(p);
    s.play(p, [{ o: 0, x: 25, y: 105, op: 0 }, { o: .08, op: 1 }, ...s.along(d, .08, .85), { o: .92 }, { o: 1, op: 0 }]);
  }, { poster: .6 }],

  search: ['top', s => {
    const d = 'M30 30H210A20 20 0 0 1 210 70H30A20 20 0 0 0 30 110H210';
    s.trail(d, .05, .9);
    const p = s.puck(); s.dot(0, 0, R + 9, 'gd', p); s.finger(p);
    s.play(p, [{ o: 0, x: 30, y: 30, op: 0 }, { o: .05, op: 1 }, ...s.along(d, .05, .9), { o: .95, op: 0 }]);
  }, { dur: 4400, poster: .45 }],

  trace: ['top', s => {
    const d = 'M30 100L60 40L90 100L120 40L150 100L180 40L210 100';
    s.path(d, 'trk');
    s.trail(d, .05, .9);
    const p = s.puck(); s.finger(p);
    s.play(p, [{ o: 0, x: 30, y: 100, op: 0 }, { o: .05, op: 1 }, ...s.along(d, .05, .9, { n: 72 }), { o: .95, op: 0 }]);
  }, { dur: 4800, poster: .6 }],

  iterate: ['top', s => {
    s.dot(120, 70, 38, 'orb'); s.dot(120, 70, 2, 'gdot');
    s.flash(s.token(120, 70 - 38 - R - 6), 0, .2);
    const p = s.puck({ tick: true }); s.finger(p);
    s.play(p, s.arc(120, 70, 38, -90, 270, 0, 1, { spin: 2 }));
  }, { dur: 4000 }],

  'fine-tune': ['top', s => {
    const p = s.puck();
    s.play(p, [{ o: 0, x: 120, y: 70 }, { o: .25, s: .95 }, { o: .5, s: 1 }, { o: .75, s: .95 }, { o: 1, s: 1 }]);
    [-90, 30, 150].forEach(a => {
      const cx = 8 * Math.cos(rad(a)), cy = 8 * Math.sin(rad(a));
      s.dot(cx, cy, 4, 'orb', p);
      s.play(s.finger(p), s.arc(cx, cy, 4, a, a + 720, 0, 1));
    });
  }],

  /* ── III · epistemic state & logic ── */
  invert: ['top', s => {
    const p = s.puck(), back = s.dot(0, 0, R, 'bk', p);
    s.finger(p, 0, -R - 4); s.finger(p, 0, R + 4);
    s.play(p, [{ o: 0, x: 120, y: 70 }, { o: .15, e: 'ease-in' }, { o: .3, sx: 0, sy: 1.12, e: 'ease-out' }, { o: .45, sx: -1, sy: 1 }, { o: .6, e: 'ease-in' }, { o: .75, sx: 0, sy: 1.12, e: 'ease-out' }, { o: .9, sx: 1, sy: 1 }]);
    s.opac(back, [[.3, 0], [.301, 1], [.75, 1], [.751, 0]]);
  }],

  speculate: ['side', s => {
    s.el('rect', { x: 120 - R, y: G - T, width: 2 * R, height: T, class: 'gd' });
    const p = s.slab(); s.finger(p, R + 4, -T / 2);
    s.play(p, [{ o: 0, x: 120, y: G, px: -R, op: 0 }, { o: .08, op: 1 }, { o: .15, e: 'ease-out' }, { o: .4, r: -32 }, { o: .52, r: -29 }, { o: .64, r: -33 }, { o: .76, r: -30 }, { o: .84, e: 'ease-in' }, { o: .92, r: 0 }, { o: 1, op: 0 }]);
  }],

  debate: ['side', s => {
    const a = s.text(70, G - 50, 'A', 'mid'), b = s.text(170, G - 50, 'B', 'mid');
    s.opac(a, [[0, .2], [.125, 1], [.25, .2], [.5, .2], [.625, 1], [.75, .2]]);
    s.opac(b, [[0, .2], [.25, .2], [.375, 1], [.5, .2], [.75, .2], [.875, 1], [1, .2]]);
    const p = s.edge(); s.finger(p, 0, -2 * R - 4);
    s.play(p, [{ o: 0, x: 120, y: G }, { o: .125, r: -22 }, { o: .375, r: 22 }, { o: .625, r: -22 }, { o: .875, r: 22 }, { o: 1, r: 0 }]);
  }, { poster: .125 }],

  decide: ['side', s => {
    const p = s.edge(), f = s.finger(p, 0, -2 * R - 4);
    s.play(p, [{ o: 0, x: 120, y: G, op: 0 }, { o: .06, op: 1 }, { o: .14, r: -10 }, { o: .24, r: 9 }, { o: .33, r: -6 }, { o: .4, r: 0 }, { o: .401, px: T / 2 }, { o: .44, e: 'cubic-bezier(.5,0,1,.6)' }, { o: .58, r: 90 }, { o: .62, r: 86 }, { o: .66, r: 90 }, { o: .9 }, { o: 1, op: 0 }]);
    s.opac(f, [[.3, 0], [.34, 1], [.46, 1], [.5, 0]]);
    s.impact(141, G, .58);
    s.show(s.token(141, G + 12), .6);
  }, { poster: .75 }],

  'explore-path': ['side', s => {
    s.dot(200, G - R, R);
    const fr = [{ o: 0, x: 35, y: G - R, op: 0 }, { o: .08, op: 1 }, { o: .1 }, { o: .78, x: 200, r: 525 }, { o: .9 }, { o: 1, op: 0 }];
    s.play(s.disc(), fr);
    s.play(s.finger(), fr.map(({ r, ...f }) => ({ ...f, y: G - 2 * R - 4 })));
  }],

  perturb: ['top', s => {
    s.dot(120, 70, R);
    const p = s.puck(); s.finger(p, -R - 4, 0); s.finger(p, R + 4, 0);
    const rnd = rng(7), fr = [{ o: 0, x: 120, y: 70 }, { o: .15 }];
    for (let o = .18; o < .85; o += .03) fr.push({ o, x: 120 + (rnd() * 2 - 1) * 7, y: 70 + (rnd() * 2 - 1) * 4, e: 'linear' });
    fr.push({ o: .88, x: 120, y: 70 });
    s.play(p, fr);
  }],

  bypass: ['top', s => {
    s.path('M120 6V60M120 80V134', 'wall');
    const p = s.blade(); s.path('M-24 -2h-12M-26 2h-16', 'fx', p); s.finger(p);
    s.play(p, [{ o: 0, x: 20, y: 70, op: 0 }, { o: .1, op: 1, e: 'cubic-bezier(.5,0,.3,1)' }, { o: .6, x: 210 }, { o: .8 }, { o: .9, op: 0 }]);
  }, { poster: .35 }],

  /* ── IV · dyadic conditioning ── */
  align: ['top', s => {
    const a = s.puck(), b = s.puck({ b: 1 }); s.finger(a); s.finger(b);
    s.play(a, [{ o: 0, x: 40, y: 70, op: 0 }, { o: .08, op: 1, e: 'ease-out' }, { o: .45, x: 120 - R }, { o: .9 }, { o: 1, op: 0 }]);
    s.play(b, [{ o: 0, x: 200, y: 70, op: 0 }, { o: .08, op: 1, e: 'ease-out' }, { o: .45, x: 120 + R }, { o: .9 }, { o: 1, op: 0 }]);
    s.ring(120, 70, .45);
    s.show(s.dot(120, 70, 3, 'sys'), .47);
  }, { poster: .6 }],

  condition: ['top', s => {
    for (let x = 116; x <= 180; x += 16) s.show(s.token(x, 98), .32 + ((x - 102) / 84) * .53);
    const a = s.puck(), b = s.puck({ b: 1 }); s.finger(a);
    s.play(a, [{ o: 0, x: 30, y: 70, op: 0 }, { o: .08, op: 1, e: 'ease-in' }, { o: .3, x: 66 }, { o: .32 }, { o: .85, x: 150 }, { o: .92 }, { o: 1, op: 0 }]);
    s.play(b, [{ o: 0, x: 102, y: 70, op: 0 }, { o: .08, op: 1 }, { o: .32 }, { o: .85, x: 186 }, { o: .92 }, { o: 1, op: 0 }]);
    s.ring(84, 70, .3);
  }, { poster: .6 }],

  layer: ['side', s => {
    s.at(s.slab(), 110, G);
    const b = s.slab({ b: 1 }); s.finger(b, -R - 4, -T / 2); s.finger(b, R + 4, -T / 2);
    const d = `M190 ${G}C190 50 110 50 110 ${G - T}`;
    s.play(b, [{ o: 0, x: 190, y: G, op: 0 }, { o: .08, op: 1 }, { o: .12 }, ...s.along(d, .12, .55, { ez: eio }), { o: .9 }, { o: 1, op: 0 }]);
    s.impact(110, G - T, .55);
  }, { poster: .7 }],

  'fine-tune-pair': ['top', s => {
    const a = s.puck({ tick: true }), b = s.puck({ b: 1, tick: true }); s.finger(a); s.finger(b);
    const osc = (x, k) => [0, .25, .5, .75, 1].map((o, i) => ({ o, x, y: 70 + k * [0, -9, 0, 9, 0][i], r: k * [0, -35, 0, 35, 0][i] }));
    s.play(a, osc(102, 1)); s.play(b, osc(138, -1));
    s.opac(s.path('M120 58l-4 4l8 4l-8 4l8 4l-4 4', 'fx'), Array.from({ length: 21 }, (_, i) => [i / 20, i % 2 ? 1 : .15]));
  }, { poster: .3 }],

  'cross-attend': ['top', s => {
    const cap = s.el('rect', { x: -2 * R - 5, y: -R - 5, width: 4 * R + 10, height: 2 * R + 10, rx: R + 5, class: 'sysl' });
    const a = s.puck(), b = s.puck({ b: 1 }); s.finger(a); s.finger(b);
    const m = (x0, x1, x2) => [{ o: 0, x: x0, y: 70, op: 0 }, { o: .06, op: 1, e: 'ease-in' }, { o: .32, x: x1 }, { o: .42 }, { o: .85, x: x2 }, { o: .92 }, { o: 1, op: 0 }];
    s.play(a, m(25, 82, 122)); s.play(b, m(215, 118, 158));
    s.play(cap, [{ o: 0, x: 100, y: 70, op: 0 }, { o: .32 }, { o: .36, op: 1 }, { o: .42 }, { o: .85, x: 140 }, { o: .92 }, { o: 1, op: 0 }]);
    s.ring(100, 70, .32, 5, 4);
  }, { poster: .6 }],

  constrain: ['top', s => {
    const m = s.el('rect', { x: -5, y: -5, width: 10, height: 10, class: 'sys' });
    const rnd = rng(3), fr = [];
    for (let o = 0; o <= .5; o += .025) fr.push({ o, x: 120 + (rnd() * 2 - 1) * 26 * (1 - o / .5), y: 70 + (rnd() * 2 - 1) * 16 * (1 - o / .5), e: 'linear' });
    s.play(m, [...fr, { o: .52, x: 120, y: 70 }]);
    const a = s.puck(), b = s.puck({ b: 1 }); s.finger(a, -R - 4, 0); s.finger(b, R + 4, 0);
    s.play(a, [{ o: 0, x: 30, y: 70, op: 0 }, { o: .06, op: 1 }, { o: .1 }, { o: .5, x: 120 - R - 6 }, { o: .9 }, { o: 1, op: 0 }]);
    s.play(b, [{ o: 0, x: 210, y: 70, op: 0 }, { o: .06, op: 1 }, { o: .1 }, { o: .5, x: 120 + R + 6 }, { o: .9 }, { o: 1, op: 0 }]);
  }, { poster: .3 }],

  contrast: ['top', s => {
    s.path('M120 70L55 36M120 70L185 104');
    s.show(s.path('M71 44L169 96', 'sysl d'), .66);
    const a = s.puck(), b = s.puck({ b: 1 }); s.finger(a); s.finger(b);
    s.play(a, [{ o: 0, x: 102, y: 70, op: 0 }, { o: .1, op: 1 }, { o: .25 }, { o: .65, x: 55, y: 36 }, { o: .9 }, { o: 1, op: 0 }]);
    s.play(b, [{ o: 0, x: 138, y: 70, op: 0 }, { o: .1, op: 1 }, { o: .25 }, { o: .65, x: 185, y: 104 }, { o: .9 }, { o: 1, op: 0 }]);
  }, { poster: .75 }],

  delegate: ['top', s => {
    const [ax, ay] = [96, 84];
    s.dot(ax, ay, 2 * R, 'orb');
    const a = s.at(s.puck(), ax, ay); s.finger(a);
    const b = s.puck({ b: 1 }), fb = s.finger(b);
    const lx = ax + 36 * Math.cos(rad(-30)), ly = ay + 36 * Math.sin(rad(-30));
    s.play(b, [{ o: 0, x: ax - 36, y: ay, op: 0 }, { o: .08, op: 1 }, ...s.arc(ax, ay, 2 * R, 180, 330, .12, .5, { ez: eio }), { o: .54, e: 'cubic-bezier(.1,.8,.2,1)' }, { o: .72, x: lx + 74, y: ly - 43 }, { o: .9 }, { o: 1, op: 0 }]);
    s.opac(fb, [[.5, 1], [.54, 0], [.98, 0], [1, 1]]);
    s.ring((ax + lx) / 2, (ay + ly) / 2, .54);
  }, { poster: .35 }],

  conflict: ['top', s => {
    const a = s.puck(), b = s.puck({ b: 1 });
    const hit = 'cubic-bezier(.1,.7,.3,1)';
    [[a, 20, 102, 50, 116], [b, 220, 138, 190, 24]].forEach(([p, x0, x1, x2, y2]) => {
      s.opac(s.finger(p), [[0, 1], [.33, 1], [.36, 0], [.98, 0], [1, 1]]);
      s.play(p, [{ o: 0, x: x0, y: 70, op: 0 }, { o: .06, op: 1, e: 'ease-in' }, { o: .35, x: x1, e: hit }, { o: .65, x: x2, y: y2 }, { o: .85 }, { o: 1, op: 0 }]);
    });
    s.flash(s.path('M120 56v-8M120 84v8M110 62l-6 -5M130 62l6 -5M110 78l-6 5M130 78l6 5', 'fx'), .35, .2);
  }, { poster: .36 }],

  /* ── V · memory, RAG & ensembles ── */
  ingest: ['top', s => {
    const SC = [[-95, -45], [90, -40], [-70, 42], [100, 45], [-20, -50], [25, 52], [-100, 5]];
    const ez = 'cubic-bezier(.4,0,.2,1)';
    s.show(s.dot(120, 70, 62, 'sysl d'), .58);
    HEX.forEach(([hx, hy], i) => s.trail(`M${120 + SC[i][0]} ${70 + SC[i][1]}L${120 + hx} ${70 + hy}`, .12, .55, ez));
    HEX.forEach(([hx, hy], i) => s.play(s.puck(), [{ o: 0, x: 120 + SC[i][0], y: 70 + SC[i][1], op: 0 }, { o: .08, op: 1 }, { o: .12, e: ez }, { o: .55, x: 120 + hx, y: 70 + hy }, { o: .9 }, { o: 1, op: 0 }]));
    [-1, 1].forEach(k => s.play(s.hand(k), [{ o: 0, x: 120 + k * 112, y: 70, op: 0 }, { o: .08, op: 1 }, { o: .12, e: ez }, { o: .55, x: 120 + k * 68 }, { o: .65, op: 0 }]));
  }, { poster: .7 }],

  format: ['top', s => {
    const COL = [-57, -19, 19, 57];
    const GR = COL.flatMap(x => [[x, -20], [x, 20]]);
    const LO = [[-80, -30], [-60, 25], [-30, -45], [-5, 10], [30, -38], [50, 35], [85, -25], [95, 30]];
    s.show(s.path('M43 50H197M43 90H197' + COL.map(x => `M${120 + x} 26V114`).join(''), 'sysl d'), .6);
    GR.forEach(([gx, gy], i) => {
      const [lx, ly] = LO[i];
      s.trail(`M${120 + lx} ${70 + ly}L${120 + gx} ${70 + gy}`, .12, .55, 'ease-in-out');
      s.play(s.puck(), [{ o: 0, x: 120 + lx, y: 70 + ly, op: 0 }, { o: .08, op: 1 }, { o: .12 }, { o: .55, x: 120 + gx, y: 70 + gy }, { o: .9 }, { o: 1, op: 0 }]);
    });
  }, { poster: .7 }],

  diversify: ['top', s => {
    const ez = 'cubic-bezier(.3,0,.2,1)';
    s.play(s.palm(30), [{ o: 0, x: 120, y: 70, op: 0 }, { o: .06, op: 1 }, { o: .2, e: ez }, { o: .6, s: 2.4, op: 0 }]);
    HEX.forEach(([hx, hy]) => {
      const fx = 120 + hx * 2.1, fy = 70 + hy * 1.6;
      if (hx || hy) s.trail(`M${120 + hx} ${70 + hy}L${fx} ${fy}`, .2, .6, ez);
      s.play(s.puck(), [{ o: 0, x: 120 + hx, y: 70 + hy, op: 0 }, { o: .08, op: 1 }, { o: .2, e: ez }, { o: .6, x: fx, y: fy }, { o: .9 }, { o: 1, op: 0 }]);
    });
  }, { poster: .7 }],

  flush: ['top', s => {
    s.dot(120, 70, 62);
    s.play(s.palm(26), [{ o: 0, x: 120, y: 70, s: 2, op: 0 }, { o: .18, e: 'ease-in' }, { o: .26, s: 1, op: 1 }, { o: .34, op: 0 }]);
    s.ring(120, 70, .26, 10, 6);
    HEX.forEach(([hx, hy], i) => {
      const [dx, dy] = i ? [hx, hy] : [10, 30];
      s.play(s.puck(), [{ o: 0, x: 120 + hx, y: 70 + hy }, { o: .27, e: 'cubic-bezier(.1,.8,.3,1)' }, { o: .55, x: 120 + dx * 5, y: 70 + dy * 5, op: 0 }, { o: .56, x: 120 + hx, y: 70 + hy }, { o: .8 }, { o: .95, op: 1 }]);
    });
  }, { poster: .2 }],

  cull: ['top', s => {
    HEX.forEach(([hx, hy], i) => i !== 1 && s.at(s.puck(), 120 + hx, 70 + hy));
    s.show(s.dot(156, 70, R, 'sysl d'), .4, .74);
    const t = s.puck();
    [-1, 1].forEach(k => s.opac(s.finger(t, 0, k * (R + 4)), [[.1, 0], [.16, 1]]));
    s.play(t, [{ o: 0, x: 156, y: 70 }, { o: .3, e: 'cubic-bezier(.5,0,.2,1)' }, { o: .55, x: 228, op: 0 }, { o: .56, x: 156 }, { o: .8 }, { o: .95, op: 1 }]);
  }, { poster: .4 }],

  shuffle: ['top', s => {
    [48, 120, 192].forEach((cx, i) => {
      s.dot(cx, 70, 22, 'orb');
      [0, 180].forEach(off => s.play(s.puck({ b: off > 0 }), s.arc(cx, 70, 22, i * 120 - 90 + off, i * 120 + 270 + off, 0, 1)));
    });
  }, { dur: 4800, poster: .1 }],

  chain: ['top', s => {
    const xs = [48, 84, 120, 156, 192];
    xs.forEach((x, i) => {
      const t = .22 + i * .07;
      s.show(s.token(x, 40), t + .02);
      s.ring(x - R, 70, t, 3, 2.5);
      s.play(s.puck(), i < 4 ? [{ o: 0, x, y: 70 }]
        : [{ o: 0, x, y: 70 }, { o: t, e: 'cubic-bezier(.1,.8,.3,1)' }, { o: t + .25, x: 222, op: 0 }, { o: t + .26, x }, { o: .85 }, { o: .97, op: 1 }]);
    });
    s.play(s.finger(), [{ o: 0, x: 4, y: 70, op: 0 }, { o: .1, op: 1, e: 'ease-in' }, { o: .22, x: 48 - R - 4 }, { o: .3, x: 20, op: 0 }]);
  }, { dur: 3600, poster: .6 }],

  collaborate: ['top', s => {
    const d = 'M66 78Q120 50 174 66';
    s.play(s.palm(62), [{ o: 0, x: 66, y: 78, op: 0 }, { o: .1, op: 1 }, ...s.along(d, .1, .8, { ez: eio }), { o: .9, op: 0 }]);
    HEX.forEach(([hx, hy]) => {
      const lag = ((36 - hx) / 72) * .06;
      const fr = s.along(d, .1 + lag, .8 + lag, { ez: eio }).map(f => ({ ...f, x: f.x + hx, y: f.y + hy }));
      s.play(s.puck(), [{ o: 0, x: 66 + hx, y: 78 + hy, op: 0 }, { o: .1, op: 1 }, ...fr, { o: .95, op: 0 }]);
    });
  }, { poster: .45 }],

  saturate: ['top', s => {
    s.path('M8 15H95L150 55H232M8 125H95L150 85H232', 'wall');
    const J = [[140, 70], [109, 49], [109, 91], [78, 70], [72, 34], [72, 106], [42, 70]];
    const rnd = rng(5), jam = 'cubic-bezier(.5,0,1,1)';
    J.forEach(([x, y]) => {
      const fr = [{ o: 0, x: x - 70, y: y + (rnd() * 2 - 1) * 6, op: 0 }, { o: .1, op: 1, e: jam }, { o: .5, x, y }];
      for (let o = .53; o < .85; o += .04) fr.push({ o, x: x + (rnd() - .5) * 2.5, e: 'linear' });
      s.play(s.puck(), [...fr, { o: .87, x }, { o: .92 }, { o: 1, op: 0 }]);
    });
    const push = [.55, .6, .65, .7, .75, .8].map((o, i) => ({ o, x: i % 2 ? 28 : 32 }));
    s.play(s.hand(-1), [{ o: 0, x: -30, y: 70, op: 0 }, { o: .1, op: 1, e: jam }, { o: .5, x: 28 }, ...push, { o: .85, x: 28 }, { o: .92 }, { o: 1, op: 0 }]);
    [[150, 55], [150, 85]].forEach(([x, y]) => s.opac(s.dot(x, y, 3, 'sys'), [[.5, 0], [.52, 1], [.6, .3], [.64, 1], [.72, .3], [.76, 1], [.84, .3], [.88, 1], [.92, 0]]));
  }, { poster: .7 }],

  crash: ['side', s => {
    const F = [[120, 0, 0], [126, 1, 6], [84, 0, 0], [158, 0, 0], [100, 1, -12], [194, 0, 0], [48, 0, 0], [140, 1, 9], [176, 1, -6]];
    F.forEach(([fx, top, fr], i) => {
      const y0 = G - i * T, lean = 120 - i * 1.5, fy = G - top * T;
      const spin = fx === 120 ? 0 : Math.sign(fx - 120) * (30 + i * 5);
      s.play(s.slab({ b: i % 2 }), [
        { o: 0, x: 120, y: y0, py: -T / 2, op: 0 }, { o: .08, op: 1 }, { o: .18 },
        { o: .3, x: lean, r: -i * .6, e: 'ease-in' },
        { o: .42, x: (lean + fx) / 2, y: y0 + (fy - y0) * .35, r: spin, e: 'ease-in' },
        { o: .55 + i * .005, x: fx, y: fy, r: fr, e: 'ease-out' }, { o: .9 }, { o: 1, op: 0 },
      ]);
    });
    s.play(s.finger(), [{ o: 0, x: 200, y: G - 4 * T, op: 0 }, { o: .1, op: 1, e: 'ease-in' }, { o: .2, x: 120 + R + 4 }, { o: .28, x: 200, op: 0 }]);
    s.impact(120, G, .56);
  }, { dur: 3600, poster: .75 }],
};

/* ════════════════════════════════════════════════════════════════
   Dictionary data  (source: 04-dictionary.md)
   ════════════════════════════════════════════════════════════════ */

const CATS = [
  { id: 'I', short: 'Execution', name: 'Execution & Lifecycle', met: 'EXECUTION IS PHYSICAL LOCOMOTION', schema: 'SOURCE-PATH-GOAL', n: '1 puck' },
  { id: 'II', short: 'Parameters', name: 'Parameters & Steering', met: 'PARAMETERS ARE PHYSICAL DIMENSIONS AND FORCES', schema: 'FORCE · SCALE', n: '1 puck' },
  { id: 'III', short: 'Epistemic', name: 'Epistemic State & Logic', met: 'CERTAINTY IS EQUILIBRIUM; DUALITY IS FACE ORIENTATION', schema: 'BALANCE · AXIS', n: '1 puck' },
  { id: 'IV', short: 'Dyadic', name: 'Dyadic Conditioning', met: 'RELATIONAL LOGIC IS MULTI-BODY MECHANICS', schema: 'LINK · FORCE', n: '2 pucks' },
  { id: 'V', short: 'Ensemble', name: 'Memory, RAG & Ensembles', met: 'DATA IS GRANULAR MATTER IN A CONTAINER', schema: 'CONTAINER · MASS', n: 'N pucks' },
];

const ENTRIES = [
  /* I */
  { cat: 'I', terms: 'stream autoregress generate emit proceed', g: 'glide slide', out: 'emit ▪▪▪',
    syn: 'Fingertips rest lightly on the top face; the puck is translated smoothly and continuously across the plane along a forward vector — `glide` / `slide`.',
    sem: 'Initiates and sustains continuous token generation or forward-pass execution, yielding output tokens in real time at a rate proportional to the physical motion.',
    met: 'PROGRESS IS FORWARD MOTION ALONG A PATH',
    ground: 'Pushing an object across a low-friction surface: as long as the hand guides it forward, the stream of language flows forward.',
    voice: ['Keep going.', 'Elaborate on this.'] },
  { cat: 'I', terms: 'halt stop cancel interrupt kill block', g: 'clamp halt trap', out: '■ halted',
    syn: 'While the puck is moving (or generating), the palm slaps or presses firmly down onto it, instantly zeroing its velocity against the table — `clamp` / `halt` / `trap`.',
    sem: 'Immediately terminates an ongoing token stream, aborts a running tool execution, or blocks an agentic action mid-flight.',
    met: 'STOPPING A PROCESS IS ARRESTING PHYSICAL MOTION',
    ground: 'The muscular force needed to pin a moving object against a substrate: physical immobilization maps to computational termination.',
    voice: ['Stop.', 'Kill that process.'] },
  { cat: 'I', terms: 'launch deploy dispatch send publish ship', g: 'chuck launch flick', out: '→ dispatched',
    syn: 'Grip the puck and impart a sharp forward impulse, releasing it into free ballistic sliding toward a designated target zone — `chuck` / `launch` / `flick`.',
    sem: 'Packages a finalized prompt, agent task, or model checkpoint and dispatches it asynchronously to an external environment, API endpoint, or production server.',
    met: 'TRANSMITTING DATA IS PROJECTING AN OBJECT THROUGH SPACE',
    ground: 'Throwing or sliding an object toward a recipient: once released from the hand, the task runs autonomously under its own momentum.',
    voice: ['Send it.', 'Deploy to production.'] },
  { cat: 'I', terms: 'commit assert persist ground save finalize lock', g: 'slam smack press', out: '✓ committed',
    syn: 'Raise the puck slightly, then bring it decisively straight down onto the surface with a solid thud — `slam` / `smack` / firm `press`.',
    sem: 'Saves volatile context state to persistent storage, locks layer weights against further updates, or asserts a statement as verified ground truth.',
    met: 'PERMANENCE AND CERTAINTY ARE DOWNWARD FORCE INTO SOLID GROUND',
    ground: 'Stamping a seal, driving a stake into the earth, setting down a heavy stone: high downward force equates to immutability.',
    voice: ['Lock this in.', 'Commit state.'] },
  { cat: 'I', terms: 'retry regenerate re-sample reboot re-run', g: 'pop hop', out: '↻ resample',
    syn: 'A quick fingertip strike on the top makes the puck briefly leap or shudder vertically before settling back in place — `pop` / `hop`.',
    sem: 'Discards the immediate completion and triggers a fresh stochastic sampling pass with the same prompt context.',
    met: 'RENEWAL IS A VERTICAL JOLT',
    ground: 'Tapping a device to reset its internal state, or tossing a coin or die up slightly to get a fresh outcome.',
    voice: ['Try again.', 'Give me another take.'] },
  { cat: 'I', terms: 'pause suspend defer wait pend buffer', g: 'lift hover', out: '‖ suspended',
    syn: 'Grasp the puck by its 1 cm rim (`pinch`), `lift` it and `hover` — holding it suspended a few centimeters above the table.',
    sem: 'Temporarily suspends an inference stream or agentic workflow while keeping the KV-cache and execution state alive in memory.',
    met: 'SUSPENSION OF ACTIVITY IS LEVITATION OFF THE GROUND',
    ground: 'Lifting a needle off a record, or picking up a game piece mid-move: off the surface, the object is detached from the active timeline of the plane.',
    voice: ['Hold on.', 'Pause right there.'] },
  { cat: 'I', terms: 'resume continue unpause wake reinstate', g: 'lower land', out: '▶ resumed',
    syn: 'From hover, `lower` and `land` the puck, returning its flat base to contact with the workspace — motion picks up where it stopped.',
    sem: 'Restores a paused inference stream or re-engages a suspended agent exactly where it left off.',
    met: 'ENGAGEMENT IS SURFACE CONTACT',
    ground: 'Placing a wheel back onto the road so traction and forward progress can resume.',
    voice: ['Resume.', 'Carry on.'] },
  { cat: 'I', terms: 'backtrack undo revert roll-back downgrade', g: 'pull drag', out: '↶ −2 steps',
    syn: 'Keep frictional contact with the puck and `pull` / `drag` it backward along the exact trajectory it previously traveled.',
    sem: 'Steps backward through the chain-of-thought tree, reverts the conversation to an earlier checkpoint, or undoes the last agentic action.',
    met: 'EXECUTION HISTORY IS A PATH; REVERTING IS MOVING BACKWARD',
    ground: 'Retracing one’s footsteps to return to a prior state.',
    voice: ['Back up two steps.', 'Revert to before that.'] },
  { cat: 'I', terms: 'nudge hint prime cull tweak', g: 'nudge tap', out: '+δ steer',
    syn: 'With the side of a finger, `nudge` or `tap` the rim, displacing the puck by a few millimeters.',
    sem: 'Applies a subtle steering-vector intervention or minor prompt modification without disrupting the overall generation trajectory.',
    met: 'SUBTLE CAUSAL INFLUENCE IS A LIGHT LATERAL FORCE',
    ground: 'Gently bumping an object to adjust its position without overturning it.',
    voice: ['Make it slightly more formal.', 'Hint at the conclusion.'] },
  { cat: 'I', terms: 'drift decay degrade expire time-out', g: 'drift', out: '↘ decay',
    syn: 'Give the puck a gentle push and let it `drift`, sliding under decaying momentum until friction brings it to rest.',
    sem: 'Lets a learning rate, attention weight, or context relevance decay gradually until execution naturally halts.',
    met: 'DIMINISHING INTENSITY IS FRICTIONAL DECELERATION',
    ground: 'Watching an object coast to a stop as its kinetic energy dissipates.',
    voice: ['Let this topic fade out.'] },

  /* II */
  { cat: 'II', terms: 'adjust tune calibrate modulate top-p top-k scale', g: 'dial rotate', out: 'temperature',
    syn: 'Grasp the 6 cm circumference with thumb and fingers (`pinch`) and `dial` / `rotate` the puck incrementally around its central axis, like a precision knob.',
    sem: 'Continuously modifies a scalar hyperparameter — sampling temperature, top-p threshold, learning rate, or verbosity.',
    met: 'QUANTITY AND INTENSITY ARE ANGULAR DISPLACEMENT',
    ground: 'Turning valves, faucets, and volume dials to regulate flow and intensity.',
    voice: ['Turn up the creativity.', 'Dial the temperature down to 0.2.'] },
  { cat: 'II', terms: 'compress quantize distill minify compact summarize shrink', g: 'compress press', out: 'fp16 → int4',
    syn: 'Palm flat on the top face; a sustained `compress` / `press` squeezes downward along the 1 cm thickness axis into the table.',
    sem: 'Reduces weight precision (FP16 → INT4), distills a large model into a smaller footprint, or condenses a passage into a tight summary.',
    met: 'INFORMATION DENSITY IS PHYSICAL COMPRESSION',
    ground: 'Compacting loose material into a smaller, denser volume with downward muscular force.',
    voice: ['Summarize this into one sentence.', 'Quantize to 4-bit.'] },
  { cat: 'II', terms: 'abstract generalize hoist upcast escalate elevate', g: 'lift', out: 'level ↑',
    syn: 'Pinch the rim and make a steady vertical `lift`, raising the puck higher along the normal axis above the table plane.',
    sem: 'Moves reasoning from implementation detail to high-level architecture, or escalates a query to a more capable model.',
    met: 'ABSTRACTION IS VERTICAL ELEVATION (BIRD’S-EYE VIEW)',
    ground: 'Climbing to higher ground, where fine detail disappears and broad structure becomes visible.',
    voice: ['Give me the 30,000-foot view.', 'Abstract this class.'] },
  { cat: 'II', terms: 'specialize ground down-project narrow drill-down constrain', g: 'lower press', out: 'level ↓',
    syn: 'From an elevated position, `lower` steadily and finish with a firm downward `press` onto one specific spot.',
    sem: 'Focuses the model from general theory down into concrete code, domain terminology, or low-level hardware detail.',
    met: 'SPECIFICITY AND REALITY ARE DOWN ON THE GROUND',
    ground: 'Descending from the air to touch the concrete earth — “getting down to brass tacks”.',
    voice: ['Get specific.', 'Write the exact C++ implementation.'] },
  { cat: 'II', terms: 'steer guide orient redirect re-route control', g: 'steer sweep', out: '↪ redirect',
    syn: 'While sliding the puck forward, continuously `steer` / `sweep` — curving its heading smoothly left or right.',
    sem: 'Applies activation steering or system-prompt adjustments mid-generation to bend the output toward a desired topic or tone.',
    met: 'GOAL-DIRECTED REASONING IS VEHICULAR NAVIGATION',
    ground: 'Steering a vehicle along a curved path toward a new destination.',
    voice: ['Steer the conversation toward security implications.'] },
  { cat: 'II', terms: 'search browse explore scan navigate survey', g: 'pan sweep', out: 'scan latent',
    syn: 'Hand on the puck, `pan` / `sweep` it laterally in wide arcs across the workspace field.',
    sem: 'Explores the latent embedding space, scans a repository for patterns, or browses external sources broadly before focusing.',
    met: 'SEARCHING INFORMATION IS SCANNING A LANDSCAPE',
    ground: 'Sweeping a flashlight or magnifying glass across a broad surface to locate an item.',
    voice: ['Search the codebase for authentication handlers.', 'Explore related concepts.'] },
  { cat: 'II', terms: 'trace follow audit profile walk step', g: 'trace drag', out: 'step 1…n',
    syn: 'A slow, deliberate `trace`: guide the puck with high friction (`drag`) along a specific, precise contour.',
    sem: 'Forces the model or debugger to follow a predefined schema, execution graph, or step-by-step rubric without deviating.',
    met: 'COMPLIANCE WITH RULES IS FOLLOWING A NARROW TRACK',
    ground: 'Tracing a stencil or walking a tightrope, where deviation from the line is forbidden.',
    voice: ['Step through this line by line.', 'Follow the schema strictly.'] },
  { cat: 'II', terms: 'iterate loop cycle rehearse self-refine spin', g: 'spin twirl orbit', out: '↻ loop',
    syn: 'Flick the rim to make the puck `spin` / `twirl` in place, or move it in a continuous circular `orbit` around a point.',
    sem: 'Runs a recursive self-improvement loop, an iterative optimization pass, or a background polling daemon.',
    met: 'RECURSION AND ITERATION ARE CIRCULAR MOTION',
    ground: 'Wheels, gears, and orbits returning to their starting phase while doing work.',
    voice: ['Keep refining this until the tests pass.', 'Run in a loop.'] },
  { cat: 'II', terms: 'fine-tune adapt train fit massage sculpt', g: 'knead', out: 'Δ weights',
    syn: 'Fingers across the top face apply a continuous `knead` — rolling, distributed downward pressure in small rhythmic circles.',
    sem: 'Updates model weights or adapts prompt representations gradually using local domain data.',
    met: 'MODEL TRAINING IS MOLDING PLASTIC MATTER',
    ground: 'Kneading dough or working clay: sustained, distributed pressure reshapes a material’s internal structure.',
    voice: ['Adapt this to my writing style.', 'Fine-tune on these examples.'] },

  /* III */
  { cat: 'III', terms: 'invert negate reverse toggle contrarian switch', g: 'flip invert', out: '¬ negated',
    syn: 'Grasp the puck and make a crisp `flip`, turning it 180° over onto its opposite flat face.',
    sem: 'Reverses the logical polarity of a prompt, switches to a devil’s-advocate persona, or toggles between two modes (plan ↔ act, encode ↔ decode).',
    met: 'LOGICAL OPPOSITION IS TOPOLOGICAL INVERSION (THE OTHER SIDE OF THE COIN)',
    ground: 'A flat cylinder has two mutually exclusive resting faces — heads vs. tails, up vs. down.',
    voice: ['Argue the exact opposite.', 'Switch to execution mode.'] },
  { cat: 'III', terms: 'speculate hypothesize wonder hedge assume', g: 'tip lean tilt', out: '? hypothesis',
    syn: 'Tip the puck off its flat base (`tip`) into a sustained `lean` / `tilt`, holding it at an inclined pitch on its circular edge.',
    sem: 'Puts the model into a tentative, hypothetical mode where premises are explored without committing them to factual memory.',
    met: 'EPISTEMIC TENTATIVENESS IS INCLINATION OFF-BALANCE',
    ground: 'The posture of uncertainty — “leaning toward an idea” without both feet planted flat.',
    voice: ['Suppose for a moment that…', 'Hypothetically speaking.'] },
  { cat: 'III', terms: 'debate weigh trade-off wrestle oscillate compare', g: 'rock nutate wobble', out: 'A ⇄ B',
    syn: 'With the puck up on its rim, `rock` / `wobble` it rhythmically back and forth between opposite edges.',
    sem: 'Weighs two competing hypotheses, evaluates pros and cons, or oscillates between two interpretations before deciding.',
    met: 'DELIBERATION IS OSCILLATING BALANCE (SCALES OF JUSTICE)',
    ground: 'A balance scale tipping back and forth as weights are compared on either side.',
    voice: ['Weigh the trade-offs between SQL and NoSQL here.'] },
  { cat: 'III', terms: 'decide resolve adjudicate conclude collapse converge', g: 'topple settle', out: '→ resolved',
    syn: 'From a rocking or rim-balanced state, push the puck past its tipping threshold (`topple`) and let it `settle` flat onto a stable base.',
    sem: 'Collapses a superposition of candidate completions, or resolves a multi-path debate into one definitive answer.',
    met: 'DECISION IS GRAVITATIONAL RELAXATION TO STABLE EQUILIBRIUM',
    ground: 'A spinning or balanced coin finally falling flat: potential energy converts into a fixed, settled state.',
    voice: ['Make a final call.', 'Collapse to the best answer.'] },
  { cat: 'III', terms: 'explore-path rollout lookahead test-drive simulate', g: 'roll wheel', out: 'rollout ⋯',
    syn: 'Stand the puck on its 1 cm rim and `roll` / `wheel` it forward along the table like a wheel.',
    sem: 'Executes a speculative decoding rollout or MCTS trajectory — moving forward fast while staying uncommitted and reversible.',
    met: 'SPECULATIVE TRAJECTORY IS ROLLING ON A NARROW EDGE',
    ground: 'On its rim the puck has low rolling friction (fast lookahead) but zero lateral stability — uncommitted, easily toppled.',
    voice: ['Roll out this scenario and see where it leads.'] },
  { cat: 'III', terms: 'perturb fuzz randomize jitter mutate shake', g: 'shimmy', out: '± noise',
    syn: 'Lightly grasp the puck and `shimmy` it in quick, short lateral shifts across the surface.',
    sem: 'Injects Gaussian noise into latent embeddings, fuzzes a function with randomized inputs, or rephrases a prompt to test robustness.',
    met: 'STOCHASTIC NOISE IS HIGH-FREQUENCY VIBRATION',
    ground: 'Shaking a structure to test its joints, or agitating a container to randomize its contents.',
    voice: ['Fuzz this endpoint.', 'Add some variation.'] },
  { cat: 'III', terms: 'bypass evade short-circuit skate skip side-channel', g: 'skate', out: '⤳ skip',
    syn: 'Tilt the puck onto its sharp rim and `skate` it swiftly across the surface on the thin edge instead of the flat base.',
    sem: 'Skips expensive intermediate verification, bypasses boilerplate, or takes a heuristic shortcut.',
    met: 'CIRCUMVENTING FRICTION IS SKATING ON A THIN EDGE',
    ground: 'Ice skating or hydroplaning: minimal contact area slips past normal resistance.',
    voice: ['Skip the boilerplate.', 'Fast-track this.'] },

  /* IV */
  { cat: 'IV', terms: 'align bind connect link associate correlate pair', g: 'align nestle click', out: 'bind A·B',
    syn: 'Slide two pucks together until their curved rims make gentle tangential contact (`align` / `nestle`), optionally with a soft `click`.',
    sem: 'Binds a variable to a value, links an agent to a tool API, or aligns an output distribution with a reference rubric.',
    met: 'LOGICAL ASSOCIATION IS PHYSICAL CONTACT AND COUPLING',
    ground: 'Plugging connectors together: once in contact, forces and signals pass between them.',
    voice: ['Bind this database to the agent.', 'Connect these two concepts.'] },
  { cat: 'IV', terms: 'condition prepend prefix pipe cascade forward inject', g: 'escort trundle kick shunt', out: 'A → B',
    syn: 'Place puck A behind puck B and `escort` / `trundle` — pushing A so its rim drives B forward. For a discrete trigger, `kick` / `shunt` A into a resting B.',
    sem: 'Uses A (system prompt, few-shot set, upstream output) to condition, drive, or pipe into B (the active generator).',
    met: 'CAUSATION AND PIPELINING ARE MOMENTUM TRANSFER',
    ground: 'Billiard collisions and locomotives: the upstream body imparts motion and direction to the downstream one.',
    voice: ['Pipe this output into the parser.', 'Condition the model on this persona.'] },
  { cat: 'IV', terms: 'layer inherit extend subclass graft wrap overlay', g: 'stack balance-on', out: 'B ⊳ A',
    syn: 'Lift puck B and `stack` / `balance-on` it, flat and centered, directly atop puck A.',
    sem: 'Applies a LoRA adapter atop a frozen base model, derives a subclass from a base class, or overlays a steering vector on a generation.',
    met: 'HIERARCHY AND INHERITANCE ARE VERTICAL STACKING',
    ground: 'Building from the foundation upward: the lower puck is the base, the upper one modifies the interface.',
    voice: ['Load the coding LoRA on top of the base model.', 'Extend this base class.'] },
  { cat: 'IV', terms: 'fine-tune-pair co-train distill-pair reconcile negotiate', g: 'grind rub shear', out: 'A ≈ B',
    syn: 'Holding two pucks in contact (rim-to-rim or face-to-face), `grind` / `rub` / `shear` their interfaces against each other with palpable friction.',
    sem: 'Trains a student against a teacher, reconciles two conflicting sources, or makes two agents negotiate a shared representation.',
    met: 'MUTUAL ADAPTATION IS INTERFACIAL FRICTION',
    ground: 'Grinding two stones or gears together until their surfaces conform to one another.',
    voice: ['Reconcile the differences between these two drafts.', 'Distill teacher into student.'] },
  { cat: 'IV', terms: 'cross-attend fuse merge join integrate concatenate blend', g: 'scoot-together smack-together flank', out: 'A ⊕ B',
    syn: 'Bring two pucks together with both hands (`scoot-together` / `smack-together`), clapping them into contact, then move them as one coupled unit (`flank`).',
    sem: 'Computes cross-attention between two modalities or sequences, merges two checkpoints (SLERP / TIES), or performs a database join.',
    met: 'SYNTHESIS IS UNIFICATION OF SEPARATE BODIES',
    ground: 'Pressing two pieces of material together so they move and function as one composite body.',
    voice: ['Merge these two branches.', 'Cross-attend the image and the text.'] },
  { cat: 'IV', terms: 'constrain bound clamp delimit guardrail infill sandwich', g: 'bracket sandwich', out: '[ bounded ]',
    syn: 'Use two pucks on either side of a target space to `bracket` / `sandwich`, squeezing inward from both sides to constrain lateral motion.',
    sem: 'Enforces upper and lower bounds on an output, wraps an untrusted prompt in a guardrail, or infills between a prefix and a suffix.',
    met: 'LOGICAL CONSTRAINT IS BILATERAL CONTAINMENT',
    ground: 'Bookends or a vise keeping an object inside prescribed boundaries.',
    voice: ['Infill the code between these two functions.', 'Clamp the output within these safety bounds.'] },
  { cat: 'IV', terms: 'contrast diff compare disentangle separate fork branch', g: 'split separate fan', out: 'diff A B',
    syn: 'Starting with two pucks touching, `split` / `separate` / `fan` them apart along divergent paths.',
    sem: 'Computes a diff between two files, contrasts two completions side by side, splits train/test, or forks a conversation into two tracks.',
    met: 'DIFFERENTIATION AND BRANCHING ARE SPATIAL SEPARATION',
    ground: 'Pulling apart a joined object to inspect the gap, or a path splitting into two trails.',
    voice: ['Show me the diff between these two versions.', 'Fork the reasoning here.'] },
  { cat: 'IV', terms: 'delegate hand-off offload pass proxy escalate-to', g: 'pivot-around pinch-launch tiddlywink', out: 'A ⇢ B',
    syn: 'Hold puck A still and `pivot-around` it with puck B, then launch B outward off A’s rim (`pinch-launch` / `tiddlywink`).',
    sem: 'Transfers execution responsibility from an orchestrator agent (A) to a specialized sub-agent or worker (B).',
    met: 'DELEGATION IS LEVERAGED PROJECTION FROM A FULCRUM',
    ground: 'Using one stable body as a lever or anchor to launch another into action.',
    voice: ['Hand this off to the SQL specialist agent.'] },
  { cat: 'IV', terms: 'conflict attack challenge interrogate red-team collide', g: 'collide clack ricochet', out: 'A × B',
    syn: 'Drive two pucks into a sharp edge-to-edge impact (`collide` / `clack`), so one or both deflect off their headings (`ricochet`).',
    sem: 'Pits a red-team agent against a target model, or tests two contradictory assertions against each other to expose flaws.',
    met: 'CONTRADICTION AND ADVERSARIAL TESTING ARE HIGH-ENERGY COLLISIONS',
    ground: 'Crashing two bodies together to see which holds its course and which deflects or breaks.',
    voice: ['Red-team this prompt.', 'Test where these two requirements conflict.'] },

  /* V */
  { cat: 'V', terms: 'ingest collect gather batch consolidate pool group', g: 'corral pack', out: 'context +7',
    syn: 'With cupped palms and forearms, `corral` and `pack`: sweep dispersed pucks inward into a tight hexagonal cluster.',
    sem: 'Gathers dispersed documents into a RAG context window, batches inference requests for the GPU, or clusters similar embeddings.',
    met: 'CONTEXT AGGREGATION IS HERDING MATTER INTO A CONTAINER',
    ground: 'Scooping loose grain or pebbles into a bounded pile so they can be handled as one unit.',
    voice: ['Pull all these documents into the context window.', 'Batch these tasks together.'] },
  { cat: 'V', terms: 'format structure normalize standardize table index order', g: 'align-grid', out: '{ json }',
    syn: 'Manipulate a loose cluster into an `align-grid`: orthogonal rows and columns with uniform spacing.',
    sem: 'Converts unstructured text into a rigid JSON schema or Markdown table, normalizes records, or builds a structured vector index.',
    met: 'LOGICAL STRUCTURE IS GEOMETRIC GRID ALIGNMENT',
    ground: 'Arranging objects into neat rows and columns to impose order over chaos.',
    voice: ['Format this output as a JSON array.', 'Organize these into a table.'] },
  { cat: 'V', terms: 'diversify brainstorm expand fan-out broadcast distribute', g: 'expand fan-out spread', out: 'n × ideas',
    syn: 'Fingers atop a compact cluster, `expand` / `fan-out` / `spread` — pushing pucks radially outward to increase their spacing uniformly.',
    sem: 'Generates diverse candidates (high temperature, diversity penalty), distributes work across a cluster, or broadcasts to many agents.',
    met: 'CONCEPTUAL DIVERSITY IS SPATIAL DISPERSION',
    ground: 'Spreading a deck of cards or broadcasting seed so each occupies its own territory.',
    voice: ['Give me ten wildly different angles on this.', 'Distribute across worker nodes.'] },
  { cat: 'V', terms: 'flush purge wipe clear reset erase unlearn clean', g: 'break scatter dispersion-ring', out: '∅ cleared',
    syn: 'Strike a packed cluster sharply (`break` / `scatter` / `dispersion-ring`) or sweep an arm across, dispersing every puck out of the central workspace.',
    sem: 'Clears the KV-cache, wipes history to start a fresh session, or purges poisoned or obsolete chunks from memory.',
    met: 'CLEARING MEMORY IS EXPULSION FROM THE CONTAINER',
    ground: 'Wiping a tabletop clean with one sweep: an empty workspace equates to an empty memory buffer.',
    voice: ['Clear the context.', 'Wipe memory and start fresh.'] },
  { cat: 'V', terms: 'cull evict prune redact exclude drop omit filter', g: 'pinch-eject rake', out: '−1 chunk',
    syn: 'Inside a packed cluster, pinch one target puck and `pinch-eject` it — or `rake` it out with a finger — leaving the rest intact.',
    sem: 'Evicts a low-value chunk from RAG context, prunes a dead weight or branch, or redacts a sensitive entity before training.',
    met: 'SELECTIVE FILTERING IS EXTRACTION OF AN IMPURITY',
    ground: 'Picking a stone out of lentils, or weeding a garden.',
    voice: ['Drop this source from the context.', 'Redact this user’s data.'] },
  { cat: 'V', terms: 'shuffle randomize-batch permute interleave mix blend', g: 'churn shuffle mill', out: 'permute',
    syn: 'Both hands on a group, `churn` / `shuffle` / `mill` — stirring the bulk by circular shear and interleaving two sub-groups.',
    sem: 'Shuffles training epochs to break sequential correlation, interleaves multimodal tokens, or mixes domain datasets.',
    met: 'RANDOMIZATION IS FLUID MIXING AND STIRRING',
    ground: 'Shuffling dominoes or mahjong tiles, or stirring a bowl until the initial order is gone.',
    voice: ['Shuffle the training examples.', 'Mix these two datasets evenly.'] },
  { cat: 'V', terms: 'chain pipeline sequence orchestrate cascade entail', g: 'channel cradle-kick domino', out: 'step 1 → n',
    syn: 'Line pucks up in a row (`channel`) and trigger a `cradle-kick` — an impulse transferred through the line — or stand them on their rims and `domino`.',
    sem: 'Links prompt steps or agents into a sequential dependency chain where completing step i triggers step i+1.',
    met: 'SEQUENTIAL CAUSALITY IS A MECHANICAL CHAIN REACTION',
    ground: 'A row of dominoes falling, or Newton’s cradle passing energy from end to end.',
    voice: ['Run this pipeline end-to-end.', 'Chain these prompts together.'] },
  { cat: 'V', terms: 'collaborate swarm ensemble vote poll self-consistency', g: 'swarm flow', out: 'vote(n)',
    syn: 'Hands lightly over 5–10 pucks, `swarm` / `flow` the whole collective across the workspace as one cohesive, deformable granular liquid.',
    sem: 'Deploys a multi-agent swarm toward a shared objective with emergent cohesion, or runs majority voting across an ensemble.',
    met: 'COLLECTIVE INTELLIGENCE IS COHESIVE FLOCKING MOTION',
    ground: 'Flocks, herds, and droplets moving along a shared trajectory while keeping local interactions.',
    voice: ['Have the agent swarm tackle this repo.', 'Run an ensemble vote.'] },
  { cat: 'V', terms: 'saturate exhaust overflow overload deadlock jam starve', g: 'channel jam jam-lock', out: 'overflow!',
    syn: 'Push many pucks into a narrowing bottleneck (`channel`) until they `jam` / `jam-lock` — seizing at every contact so motion halts despite applied force.',
    sem: 'Hits the context-window token limit, exhausts GPU memory, or reaches a resource deadlock where no further progress is possible.',
    met: 'BOTTLENECKS AND OVERFLOW ARE GRANULAR JAMMING',
    ground: 'Traffic jams, or grain clogging a funnel: too many items through finite capacity and flow seizes.',
    voice: ['Show me where the bottleneck is.', 'Cap the context window here.'] },
  { cat: 'V', terms: 'crash fail wreck break corrupt hallucinate diverge', g: 'collapse bridge-snap shatter unravel', out: '✗ failure',
    syn: 'A tall column of pucks undergoes a sudden `collapse`, a force-arch a `bridge-snap`, or an ordered formation a violent `shatter` / `unravel`.',
    sem: 'Represents catastrophic forgetting, a structural failure in a reasoning proof, a broken build, or context collapse.',
    met: 'SYSTEM FAILURE IS STRUCTURAL DISINTEGRATION',
    ground: 'Towers falling and brittle structures shattering past their load limit — “the system crashed”, “the logic fell apart”.',
    voice: ['Chaos-test this architecture.', 'Tear down the stack.'] },
];

const PHRASES = [
  { name: 'RAG synthesis', steps: [['corral', 'ingest'], ['pinch-eject', 'cull'], ['pack', 'ingest'], ['compress', 'compress'], ['launch', 'launch']],
    act: 'Sweep 8 document pucks together, pluck out the irrelevant one, tighten the remaining 7, press down — “Summarize these into an executive brief” — and flick the lead puck toward the screen.' },
  { name: 'Speculative debugging', steps: [['stack', 'layer'], ['roll', 'explore-path'], ['rock', 'debate'], ['topple', 'decide'], ['slam', 'commit']],
    act: 'Stack a Test puck on a Code puck, roll the pair forward on its rim to simulate execution, rock it at an edge case, let it fall flat onto the passing state, and press down to commit the fix.' },
  { name: 'Adversarial red-team', steps: [['split', 'contrast'], ['flip', 'invert'], ['collide', 'conflict'], ['grind', 'fine-tune-pair'], ['settle-down', 'decide']],
    act: 'Split two agent pucks apart, flip B to invert it into an attacker persona, strike B against A to probe for vulnerabilities, grind their rims to harden the defense, and drop both flat to save the weights.' },
];

ENTRIES.forEach((e, i) => {
  e.n = i + 1;
  e.terms = e.terms.split(' ');
  e.g = e.g.split(' ');
  e.key = e.terms[0];
  e.search = [...e.terms, ...e.g, e.sem, e.syn, e.met, e.ground, ...e.voice].join(' ').toLowerCase();
});
const BY = Object.fromEntries(ENTRIES.map(e => [e.key, e]));

/* ════════════════════════════════════════════════════════════════
   UI
   ════════════════════════════════════════════════════════════════ */

const $ = (sel, root = document) => root.querySelector(sel);
const pad = n => String(n).padStart(2, '0');
const mark = t => t.replace(/`([^`]+)`/g, '<b class="g">$1</b>');

const cardHTML = e => `
  <a class="card" href="#${e.key}" data-item data-cat="${e.cat}" data-key="${e.key}">
    <svg class="stage" data-anim="${e.key}" aria-hidden="true"></svg>
    <div class="body">
      <p class="meta"><span>${pad(e.n)}</span><span class="g">${e.g.join(' · ')}</span></p>
      <h3>${e.key}</h3>
      <p class="mute">${e.terms.slice(1).join(' · ')}</p>
      <p class="met">${e.met}</p>
    </div>
  </a>`;

const sectionHead = (id, name, met, tail) =>
  `<h2><span>${id}. ${name}</span><small class="met">${met}</small><small class="mute">${tail}</small></h2>`;

$('#dict').innerHTML = CATS.map(c => `
  <section data-cat="${c.id}">
    ${sectionHead(c.id, c.name, c.met, `${c.schema} · ${c.n}`)}
    <div class="grid">${ENTRIES.filter(e => e.cat === c.id).map(cardHTML).join('')}</div>
  </section>`).join('') + `
  <section data-cat="P">
    ${sectionHead('VI', 'Phrases', 'ATOMIC VERBS COMPOSE INTO TANGIBLE SENTENCES', 'multi-step')}
    ${PHRASES.map(p => `
      <div class="phrase" data-item data-cat="P">
        <h3>${p.name}</h3>
        <ol>${p.steps.map(([g, k]) => `<li><a class="card" href="#${k}"><svg class="stage" data-anim="${k}" aria-hidden="true"></svg><span class="g">${g}</span></a></li>`).join('')}</ol>
        <p class="mute">${p.act}</p>
      </div>`).join('')}
  </section>`;

/* ── playback: only visible stages run ── */
let motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const live = new Set();
const sync = svg => (motion && live.has(svg) ? svg.stage.resume() : svg.stage.pause());
const io = new IntersectionObserver(es => es.forEach(({ target, isIntersecting }) => {
  live[isIntersecting ? 'add' : 'delete'](target);
  sync(target);
}), { rootMargin: '80px' });

document.querySelectorAll('svg[data-anim]').forEach(svg => {
  svg.stage = new Stage(svg, svg.dataset.anim, BY[svg.dataset.anim].out);
  io.observe(svg);
  const card = svg.closest('.card');
  card.addEventListener('pointerenter', () => svg.stage.resume());
  card.addEventListener('pointerleave', () => sync(svg));
});

/* ── entry dialog (hash-routed: #stream, #halt …) ── */
const dlg = $('#entry');
let dStage = null;

const openEntry = e => {
  const c = CATS.find(c => c.id === e.cat);
  const prev = ENTRIES.at(e.n - 2), next = ENTRIES[e.n % ENTRIES.length];
  Object.assign(dlg.dataset, { prev: prev.key, next: next.key });
  dlg.innerHTML = `
    <svg class="stage" aria-hidden="true"></svg>
    <div class="body">
      <p class="meta"><span>${pad(e.n)} · ${c.id}. ${c.name}</span><span>${c.schema} · ${c.n}</span></p>
      <h2>${e.key} <small class="mute">${e.terms.slice(1).join(' · ')}</small></h2>
      <dl>
        <dt>gesture</dt><dd class="g">${e.g.join(' · ')}</dd>
        <dt>syntax</dt><dd>${mark(e.syn)}</dd>
        <dt>semantics</dt><dd>${e.sem}</dd>
        <dt>metaphor</dt><dd><b class="met">${e.met}</b><br>${e.ground}</dd>
        <dt>voice</dt><dd class="mute">${e.voice.map(v => `“${v}”`).join('  ')}</dd>
      </dl>
      <nav>
        <a href="#${prev.key}">← ${prev.key}</a>
        <form method="dialog"><button>close</button></form>
        <a href="#${next.key}">${next.key} →</a>
      </nav>
    </div>`;
  if (!dlg.open) dlg.showModal();
  dStage?.destroy();
  const svg = $('svg', dlg);
  dStage = new Stage(svg, e.key, e.out);
  if (motion) dStage.resume();
  svg.addEventListener('pointerenter', () => dStage.resume());
  svg.addEventListener('pointerleave', () => motion || dStage.pause());
};

dlg.addEventListener('close', () => {
  dStage?.destroy();
  dStage = null;
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
});
dlg.addEventListener('click', ev => ev.target === dlg && dlg.close());
dlg.addEventListener('keydown', ev => {
  const k = { ArrowLeft: dlg.dataset.prev, ArrowRight: dlg.dataset.next }[ev.key];
  if (k) location.hash = k;
});

const route = () => {
  const e = BY[decodeURIComponent(location.hash.slice(1))];
  if (e) openEntry(e);
  else if (dlg.open) dlg.close();
};
addEventListener('hashchange', route);
route();

/* ── search & filter ── */
const q = $('#q'), filters = $('#filters'), count = $('#count');
const sections = [...document.querySelectorAll('#dict > section')];
const items = [...document.querySelectorAll('[data-item]')].map(el => ({
  el, cat: el.dataset.cat, text: (BY[el.dataset.key]?.search ?? el.textContent).toLowerCase(),
}));
let cat = 'all';

const filter = () => {
  const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let n = 0;
  for (const it of items) {
    const on = (cat === 'all' || it.cat === cat) && words.every(w => it.text.includes(w));
    it.el.hidden = !on;
    if (on && it.cat !== 'P') n++;
  }
  sections.forEach(s => (s.hidden = !s.querySelector('[data-item]:not([hidden])')));
  $('#empty').hidden = sections.some(s => !s.hidden);
  count.value = `${n} / ${ENTRIES.length}`;
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
q.addEventListener('input', filter);
addEventListener('keydown', ev => {
  if (ev.key === '/' && document.activeElement !== q && !dlg.open) { ev.preventDefault(); q.focus(); }
});
filter();

/* ── motion toggle ── */
const mBtn = $('#motion');
const setMotion = on => {
  motion = on;
  mBtn.setAttribute('aria-pressed', on);
  live.forEach(sync);
  if (dStage) on ? dStage.resume() : dStage.pause();
};
mBtn.addEventListener('click', () => setMotion(!motion));
setMotion(motion);
