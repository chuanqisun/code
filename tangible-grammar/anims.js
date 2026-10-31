'use strict';

/* ════════════════════════════════════════════════════════════════
   Gesture animations — pure scene descriptions, no three.js here.
   World: table is the XZ plane, Y up, units are cm.
   Puck: r = 3, h = 1, resting centre y = .5.
   Colours: act = human gesture, env = environment (senses the pucks),
            mute = guides, white/grey = puck A / puck B.
   Frame format: { o: 0..1, p: [x,y,z], r: [deg x,y,z], s, op, e: 'io'|'in'|'out'|'lin' }
   ════════════════════════════════════════════════════════════════ */

const R = 3, Y = .5;
const HEX = [[0, 0], [6.2, 0], [-6.2, 0], [3.1, 5.4], [-3.1, 5.4], [3.1, -5.4], [-3.1, -5.4]];

const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const rng = (seed = 1) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const q = (o, x, y, z, f = {}) => ({ o, p: [x, y, z], ...f });   // free 3D frame
const g = (o, x, z = 0, f = {}) => q(o, x, Y, z, f);              // frame on the table
const row = (n, x0, x1, z) => Array.from({ length: n }, (_, i) => [x0 + (x1 - x0) * i / (n - 1), z]);

/* rotate about a ground pivot in the XY plane (lean / rock / topple) */
const tip = (px, ox, oy, d, base = 0) => {
  const c = Math.cos(rad(d)), s = Math.sin(rad(d));
  return { p: [px + ox * c - oy * s, oy * c + ox * s, 0], r: [0, 0, base + d] };
};

/* polyline parametrised by arc length */
const route = pts => {
  const cum = [0];
  pts.forEach((p, i) => i && cum.push(cum[i - 1] + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])));
  const L = cum.at(-1);
  const at = u => {
    const d = u * L;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), [x0, z0] = pts[i - 1], [x1, z1] = pts[i];
    return { x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, dx: x1 - x0, dz: z1 - z0 };
  };
  const sub = (u0, u1, n = 40) => Array.from({ length: n + 1 }, (_, k) => { const { x, z } = at(u0 + (u1 - u0) * k / n); return [x, z]; });
  return { pts, at, sub, u: i => cum[i] / L };
};

const follow = (path, o0, o1, { from = 0, to = 1, n = 48, ez = u => u, head = false } = {}) =>
  Array.from({ length: n + 1 }, (_, k) => {
    const u = k / n, { x, z, dx, dz } = path.at(from + (to - from) * ez(u));
    const f = g(o0 + (o1 - o0) * u, x, z, { e: 'lin' });
    if (head) f.r = [0, deg(Math.atan2(-dx, -dz)), 0];
    return f;
  });

const spline = (pts, n = 14) => {
  const P = [pts[0], ...pts, pts.at(-1)], out = [];
  for (let i = 1; i < P.length - 2; i++)
    for (let k = 0; k < n; k++) {
      const t = k / n, [a, b, c, d] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
      out.push([0, 1].map(j => .5 * (2 * b[j] + (c[j] - a[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t * t + (3 * b[j] - a[j] - 3 * c[j] + d[j]) * t ** 3)));
    }
  return [...out, pts.at(-1)];
};

/* points on a circle / ellipse; spin rotates the body about Y */
const arcf = (cx, cz, a0, a1, o0, o1, { rx = 5, rz = rx, n = 40, y = Y, spin = 0, ez = u => u } = {}) =>
  Array.from({ length: n + 1 }, (_, k) => {
    const u = k / n, a = a0 + (a1 - a0) * ez(u);
    return q(o0 + (o1 - o0) * u, cx + rx * Math.cos(rad(a)), y, cz + rz * Math.sin(rad(a)), { r: [0, spin * (a - a0), 0], e: 'lin' });
  });

const shake = (o0, o1, x, z, ax, az, seed, { decay = false, step = .025 } = {}) => {
  const rnd = rng(seed), out = [];
  for (let o = o0; o <= o1; o += step) {
    const k = decay ? 1 - (o - o0) / (o1 - o0) : 1;
    out.push(g(o, x + (rnd() * 2 - 1) * ax * k, z + (rnd() * 2 - 1) * az * k, { e: 'lin' }));
  }
  return out;
};

const hexPucks = (s, k = [1, 1]) => HEX.map(([x, z]) => { const p = s.puck(); s.at(p, x * k[0], Y, z * k[1]); return p; });

const ANIM = {
  /* ── I · execution & lifecycle ───────────────────────── */
  stream: [s => {
    const p = s.puck(); s.top(p);
    s.anim(p, [g(0, -9), g(.08, -9), g(.85, 9)]);
    s.trail([[-9, 0], [9, 0]], .08, .85);
    s.emit(row(8, -6, 9, 6.5), .12, .85);
  }],

  halt: [s => {
    const p = s.puck(), h = s.palm(4);
    s.anim(p, [g(0, -10), g(.05, -10), g(.35, 3, 0, { e: 'out' })]);
    s.anim(h, [q(0, 3, 6, 0, { op: 0 }), { o: .28 }, { o: .31, op: 1 }, q(.36, 3, 1.3, 0, { e: 'in' }), { o: .9 }]);
    s.trail([[-10, 0], [3, 0]], .05, .35);
    s.emit(row(5, -8, 3, 6.5), .05, .35);
    s.ring(3, 0, .36, { r: 3.6, k: 1.8 });
    s.show(s.circle(3, 0, 4.4, { c: 'env' }), .38);
  }, { poster: .7 }],

  launch: [s => {
    const p = s.puck(), f = s.hand();
    s.zone(10, 0, 7, 8, { c: 'mute', dash: 1 });
    s.flash(s.zone(10, 0, 7, 8, { c: 'env' }), .72, .25);
    s.anim(p, [g(0, -8), g(.1, -8), g(.3, -11), g(.36, -11), g(.72, 10, 0, { e: 'out' })]);
    s.anim(f, [q(0, -8, 1.4, 0, { op: 0 }), { o: .1 }, { o: .12, op: 1 }, q(.3, -11, 1.4, 0), q(.37, -6, 1.4, 0, { e: 'out' }), { o: .41, op: 0 }]);
    s.trail([[-11, 0], [10, 0]], .36, .72);
  }, { poster: .5 }],

  commit: [s => {
    const p = s.puck(); s.top(p);
    s.anim(p, [q(0, 0, 6, 0), q(.1, 0, 6, 0), g(.38, 0, 0, { e: 'in' })]);
    s.ring(0, 0, .38, { r: 3.4, k: 2.2 });
    s.show(s.circle(0, 0, 4, { c: 'env' }), .4);
    s.show(s.token(0, 7), .42);
  }, { poster: .8 }],

  retry: [s => {
    const p = s.puck(); s.top(p);
    s.anim(p, [g(0, 0), { o: .3 }, q(.4, 0, 4, 0, { e: 'out' }), g(.5, 0, 0, { e: 'in' }), q(.56, 0, 2, 0, { e: 'out' }), g(.62, 0, 0, { e: 'in' })]);
    s.vis(s.token(-1.5, 7), [[0, 1], [.3, 1], [.33, 0]]);
    s.show(s.token(1.5, 7), .62);
  }, { poster: .4 }],

  pause: [s => {
    const p = s.puck(); s.pinch(p);
    s.anim(p, [g(0, 0), { o: .15 }, q(.4, 0, 6, 0), q(.55, 0, 6.6, 0), q(.7, 0, 6, 0), q(.85, 0, 6.6, 0)]);
    row(4, -4.5, 4.5, 7).forEach(([x, z]) => s.token(x, z));
  }, { poster: .7 }],

  resume: [s => {
    const p = s.puck(); s.top(p);
    s.anim(p, [q(0, -6, 6, 0), { o: .1 }, g(.4, -6, 0, { e: 'in' }), { o: .46 }, g(.85, 8)]);
    s.emit(row(6, -2, 9, 6.5), .5, .85);
  }, { poster: .8 }],

  backtrack: [s => {
    const path = route([[-10, 5], [-4, -4], [3, 3], [10, -4]]);
    s.line(path.pts, { c: 'mute', dash: 1 });
    path.pts.forEach(([x, z]) => s.token(x, z, { size: .5, c: 'mute' }));
    const p = s.puck(); s.top(p);
    s.anim(p, [...follow(path, .05, .4), g(.5, 10, -4), ...follow(path, .5, .85, { from: 1, to: path.u(1) })]);
    s.trail(path.sub(1, path.u(1)), .5, .85);
  }, { poster: .7 }],

  nudge: [s => {
    const p = s.puck(), f = s.hand();
    s.anim(p, [g(0, 0), { o: .4 }, g(.5, 1.2, 0, { e: 'out' })]);
    s.anim(f, [q(0, -9, Y, 0, { op: 0 }), { o: .1 }, { o: .14, op: 1 }, q(.4, -3.5, Y, 0, { e: 'out' }), q(.5, -2.3, Y, 0), q(.7, -9, Y, 0), { o: .75, op: 0 }]);
    s.show(s.circle(0, 0, 3.3, { c: 'env', dash: 1 }), .45);
  }, { poster: .6 }],

  drift: [s => {
    const p = s.puck(), f = s.hand();
    s.anim(p, [g(0, -9), { o: .12 }, g(.88, 8, 0, { e: 'out' })]);
    s.anim(f, [q(0, -12.4, Y, 0, { op: 0 }), { o: .08 }, { o: .1, op: 1 }, q(.16, -9.4, Y, 0, { e: 'out' }), { o: .2, op: 0 }]);
    s.emit(row(8, -7, 8, 6.5), .14, .86, { decay: true });
  }, { poster: .8 }],

  /* ── II · parameters & steering ──────────────────────── */
  adjust: [s => {
    const p = s.puck(); s.pinch(p);
    s.anim(p, [{ o: 0, r: [0, -100, 0] }, { o: .1 }, { o: .45, r: [0, 80, 0] }, { o: .6 }, { o: .95, r: [0, -100, 0] }]);
    const b = s.bar(-6, 7.5, 12);
    s.anim(b, [{ o: 0, s: [.15, 1, 1] }, { o: .1 }, { o: .45, s: [.9, 1, 1] }, { o: .6 }, { o: .95, s: [.15, 1, 1] }]);
  }, { poster: .45 }],

  compress: [s => {
    const p = s.puck(), h = s.palm(3.6, .5), t = s.token(0, 7);
    s.anim(p, [g(0, 0, 0, { s: 1 }), { o: .2 }, q(.55, 0, .225, 0, { s: [1, .45, 1] }), { o: .75 }, g(.95, 0, 0, { s: 1 })]);
    s.anim(h, [q(0, 0, 6, 0, { op: 0 }), { o: .1, op: 1 }, q(.2, 0, 1.15, 0), q(.55, 0, .6, 0), { o: .75 }, q(.88, 0, 6, 0, { op: 0 })]);
    s.anim(t, [{ o: 0, s: 1.3 }, { o: .2 }, { o: .55, s: .5 }, { o: .75 }, { o: .95, s: 1.3 }]);
  }, { poster: .65 }],

  abstract: [s => {
    const p = s.puck(); s.pinch(p);
    s.circle(0, 0, R, { c: 'mute', dash: 1 });
    s.anim(p, [g(0, 0), { o: .15 }, q(.75, 0, 9, 0), { o: .9 }]);
    s.vline(-11, 0, 10);
    s.anim(s.token(-11, 0), [q(0, -11, Y, 0), { o: .15 }, q(.75, -11, 9, 0), { o: .9 }]);
  }, { poster: .8 }],

  specialize: [s => {
    const p = s.puck(); s.top(p);
    s.circle(6, 0, R + .4, { c: 'mute', dash: 1 });
    s.anim(p, [q(0, -4, 9, 0), { o: .15 }, g(.5, 6, 0, { e: 'in' })]);
    s.vline(-11, 0, 10);
    s.anim(s.token(-11, 0), [q(0, -11, 9, 0), { o: .15 }, q(.5, -11, Y, 0, { e: 'in' })]);
    s.ring(6, 0, .5, { r: 3.4, k: 2 });
  }, { poster: .8 }],

  steer: [s => {
    const path = route(spline([[-10, 5], [-3, 5], [3, 2], [8, -3], [10, -7]]));
    s.line([[-10, 5], [10, 5]], { c: 'mute', dash: 1 });
    const p = s.puck(); s.top(p);
    s.anim(p, [{ o: 0, r: [0, 0, 0] }, ...follow(path, .08, .85, { head: true, n: 60 })]);
    s.trail(path.sub(0, 1, 60), .08, .85);
  }, { poster: .7 }],

  search: [s => {
    const path = route([[-10, -6], [10, -6], [10, 0], [-10, 0], [-10, 6], [10, 6]]);
    const p = s.puck(); s.top(p);
    s.circle(0, 0, 5.2, { c: 'mute', dash: 1, y: -.45, at: p });
    s.anim(p, follow(path, .05, .9, { n: 90 }));
    s.trail(path.sub(0, 1, 90), .05, .9);
    [[-3, -3, .13], [4, 3, .43], [-6, 3, .55]].forEach(([x, z, o]) => s.show(s.token(x, z, { size: 1.2 }), o));
  }, { dur: 5, poster: .6 }],

  trace: [s => {
    const path = route([[-10, 5], [-6, -5], [-2, 5], [2, -5], [6, 5], [10, -5]]);
    s.line(path.pts, { c: 'mute' });
    const p = s.puck(); s.top(p);
    s.anim(p, follow(path, .05, .9, { n: 100 }));
    s.trail(path.sub(0, 1, 100), .05, .9);
    path.pts.forEach(([x, z], i) => s.show(s.token(x, z * 1.55, { size: .8 }), .05 + .85 * path.u(i)));
  }, { dur: 5, poster: .6 }],

  iterate: [s => {
    const p = s.puck(); s.top(p);
    s.circle(0, 0, 5, { c: 'act', dash: 1 });
    s.anim(p, arcf(0, 0, -90, 270, 0, 1, { rx: 5, spin: 2 }));
    s.anim(s.token(0, 0), Array.from({ length: 9 }, (_, i) => ({ o: i / 8, s: i % 2 ? 1.8 : 1, e: 'lin' })));
  }, { dur: 4 }],

  'fine-tune': [s => {
    const p = s.puck();
    s.anim(p, [{ o: 0, s: 1 }, { o: .25, s: [1, .8, 1] }, { o: .5, s: 1 }, { o: .75, s: [1, .8, 1] }, { o: 1, s: 1 }]);
    [-90, 30, 150].forEach(a => s.anim(s.hand(), arcf(0, 0, a, a + 720, 0, 1, { rx: 1.4, y: 1.5 })));
    s.anim(s.token(0, 7), [{ o: 0, s: [1.5, .7, 1] }, { o: .25, s: [.7, 1.5, 1] }, { o: .5, s: [1.5, .7, 1] }, { o: .75, s: [.7, 1.5, 1] }, { o: 1, s: [1.5, .7, 1] }]);
  }],

  /* ── III · epistemic state & logic ───────────────────── */
  invert: [s => {
    const p = s.puck(); s.pinch(p);
    s.anim(p, [g(0, 0, 0, { r: [0, 0, 0] }), { o: .15 }, q(.32, 0, 4.5, 0, { r: [90, 0, 0] }), g(.5, 0, 0, { r: [180, 0, 0] }), { o: .62 }, q(.78, 0, 4.5, 0, { r: [270, 0, 0] }), g(.92, 0, 0, { r: [360, 0, 0] })]);
  }],

  speculate: [s => {
    const p = s.puck(); s.top(p);
    s.ghost(0, Y, 0, { dash: 1 });
    const L = d => ({ ...tip(3, -3, Y, d), e: 'io' });
    s.anim(p, [{ o: 0, ...tip(3, -3, Y, 0) }, { o: .15 }, { o: .35, ...L(-30) }, { o: .47, ...L(-27) }, { o: .59, ...L(-31) }, { o: .71, ...L(-28) }, { o: .88, ...L(0) }]);
    s.token(0, 7, { op: .35 });
  }],

  debate: [s => {
    const p = s.puck();
    const T = d => tip(0, 0, 3, d, 90);
    s.anim(p, [{ o: 0, ...T(0) }, { o: .125, ...T(18) }, { o: .375, ...T(-18) }, { o: .625, ...T(18) }, { o: .875, ...T(-18) }, { o: 1, ...T(0) }]);
    const [a, b] = [s.token(-8, 0), s.token(8, 0)];
    s.anim(a, [{ o: 0, s: .6 }, { o: .125, s: 1.7 }, { o: .25, s: .6 }, { o: .5, s: .6 }, { o: .625, s: 1.7 }, { o: .75, s: .6 }]);
    s.anim(b, [{ o: 0, s: .6 }, { o: .25, s: .6 }, { o: .375, s: 1.7 }, { o: .5, s: .6 }, { o: .75, s: .6 }, { o: .875, s: 1.7 }, { o: 1, s: .6 }]);
  }, { poster: .125 }],

  decide: [s => {
    const p = s.puck();
    const T = (d, e) => ({ ...tip(.5, -.5, 3, d, 90), e });
    s.anim(p, [{ o: 0, ...T(0) }, { o: .12, ...T(-8) }, { o: .22, ...T(6) }, { o: .31, ...T(-5) }, { o: .4, ...T(0) }, { o: .62, ...T(-90, 'in') }]);
    s.ring(3.5, 0, .62, { r: 3.4, k: 2 });
    s.show(s.token(3.5, 7), .64);
  }, { poster: .8 }],

  'explore-path': [s => {
    const p = s.puck(); s.top(p);
    s.ghost(8, 3, 0, { r: [90, 0, 0] });
    s.line([[-9, 0], [8, 0]], { c: 'mute', dash: 1 });
    s.anim(p, [q(0, -9, 3, 0, { r: [90, 0, 0] }), { o: .1 }, q(.8, 8, 3, 0, { r: [90, -(17 / 3) * 180 / Math.PI, 0] })]);
  }],

  perturb: [s => {
    const p = s.puck(); s.pinch(p);
    s.circle(0, 0, R + .2, { c: 'mute', dash: 1 });
    s.anim(p, [g(0, 0), { o: .12 }, ...shake(.14, .86, 0, 0, 1.3, .8, 7), g(.9, 0, 0)]);
    s.anim(s.token(0, 7), [g(0, 0, 7), { o: .12 }, ...shake(.14, .86, 0, 7, .9, .6, 11), g(.9, 0, 7)]);
  }, { poster: .5 }],

  bypass: [s => {
    s.wall([[0, -9], [0, -.9]], 4);
    s.wall([[0, .9], [0, 9]], 4);
    const p = s.puck({ tick: false });
    s.anim(p, [q(0, -11, 3, 0, { r: [90, 0, 0] }), { o: .1 }, q(.7, 11, 3, 0, { e: 'in' })]);
    s.trail([[-11, 0], [11, 0]], .1, .7, { y: 3 });
  }, { poster: .5 }],

  /* ── IV · two pucks ──────────────────────────────────── */
  align: [s => {
    const a = s.puck(), b = s.puck({ b: 1 }); s.top(a); s.top(b);
    s.anim(a, [g(0, -14), { o: .08 }, g(.42, -3, 0, { e: 'out' })]);
    s.anim(b, [g(0, 14), { o: .08 }, g(.42, 3, 0, { e: 'out' })]);
    s.ring(0, 0, .43, { r: 1.5, k: 3, c: 'env' });
    s.link(a, b, .45, 1);
    s.show(s.token(0, 0, { size: .7 }), .45);
  }, { poster: .7 }],

  condition: [s => {
    const a = s.puck(), b = s.puck({ b: 1 }); s.top(a);
    s.anim(a, [g(0, -15), { o: .08 }, g(.3, -6, 0, { e: 'in' }), g(.85, 3, 0, { e: 'out' })]);
    s.anim(b, [g(0, 0), { o: .3 }, g(.85, 9, 0, { e: 'out' })]);
    s.ring(-3, 0, .3, { r: 1.5, k: 3, c: 'env' });
    s.emit(row(5, 4, 12, 6.5), .4, .85);
  }, { poster: .8 }],

  layer: [s => {
    const a = s.puck(), b = s.puck({ b: 1 }); s.pinch(b);
    s.anim(b, [g(0, 10), { o: .1 }, q(.28, 10, 5.5, 0), q(.56, 0, 5.5, 0), q(.66, 0, 1.5, 0, { e: 'in' })]);
    s.ring(0, 0, .66, { r: 3.4, k: 1.6, c: 'env' });
    s.show(s.circle(0, 0, 4, { c: 'env' }), .7);
  }, { poster: .85 }],

  'fine-tune-pair': [s => {
    const a = s.puck({ tick: true }), b = s.puck({ b: 1 });
    const osc = k => [0, .12, .25, .37, .5, .62, .75, .87, 1].map((o, i) => {
      const v = [0, -1, 0, 1, 0, -1, 0, 1, 0][i];
      return g(o, k * 3.05, k * v * .9, { r: [0, -k * v * 35, 0] });
    });
    s.anim(a, osc(-1)); s.anim(b, osc(1));
    s.link(a, b, 0, 1);
    s.anim(s.token(0, 0, { size: .6 }), [0, .125, .25, .375, .5, .625, .75, .875, 1].map((o, i) => ({ o, s: i % 2 ? 1.8 : .8, e: 'lin' })));
  }, { poster: .3 }],

  'cross-attend': [s => {
    const a = s.puck(), b = s.puck({ b: 1 });
    s.anim(a, [g(0, -15), { o: .08 }, g(.35, -3.05, 0, { e: 'out' }), { o: .45 }, g(.85, 3)]);
    s.anim(b, [g(0, 15), { o: .08 }, g(.35, 3.05, 0, { e: 'out' }), { o: .45 }, g(.85, 9)]);
    const cap = [];
    for (let k = 0; k <= 16; k++) cap.push([3.05 + 3.4 * Math.sin(rad(180 * k / 16)), 3.4 * Math.cos(rad(180 * k / 16))]);
    for (let k = 0; k <= 16; k++) cap.push([-3.05 - 3.4 * Math.sin(rad(180 * k / 16)), -3.4 * Math.cos(rad(180 * k / 16))]);
    const c = s.loop(cap, { c: 'env' });
    s.anim(c, [q(0, 0, .05, 0, { op: 0 }), { o: .35 }, { o: .38, op: 1 }, { o: .45 }, q(.85, 6, .05, 0)]);
    s.ring(0, 0, .36, { r: 2, k: 3, c: 'env' });
  }, { poster: .7 }],

  constrain: [s => {
    const a = s.puck(), b = s.puck({ b: 1 });
    s.finger(a, -3.4, 0, 0); s.finger(b, 3.4, 0, 0);
    s.anim(a, [g(0, -15), { o: .08 }, g(.5, -5, 0, { e: 'out' })]);
    s.anim(b, [g(0, 15), { o: .08 }, g(.5, 5, 0, { e: 'out' })]);
    s.anim(s.token(0, 0, { size: 1.6 }), [q(0, 0, .8, 0), ...shake(.04, .5, 0, 0, 3.2, 1.8, 3, { decay: true }).map(f => ({ ...f, p: [f.p[0], .8, f.p[2]] })), q(.52, 0, .8, 0)]);
  }, { poster: .7 }],

  contrast: [s => {
    const a = s.puck(), b = s.puck({ b: 1 }); s.top(a); s.top(b);
    s.anim(a, [g(0, -3.05), { o: .22 }, g(.65, -8.5, -5)]);
    s.anim(b, [g(0, 3.05), { o: .22 }, g(.65, 8.5, 5)]);
    s.link(a, b, .35, 1);
  }, { poster: .8 }],

  delegate: [s => {
    const A = [-3, 2], b = s.puck({ b: 1 }), a = s.puck(); s.top(a);
    s.at(a, A[0], Y, A[1]);
    s.circle(A[0], A[1], 6.2, { c: 'mute', dash: 1 });
    const end = [A[0] + 6.2 * Math.cos(rad(330)), A[1] + 6.2 * Math.sin(rad(330))];
    s.anim(b, [...arcf(A[0], A[1], 180, 330, .12, .5, { rx: 6.2, ez: u => u * u * (3 - 2 * u) }), g(.54, end[0], end[1]), g(.74, end[0] + 8 * .866, end[1] - 8 * .5, { e: 'out' })]);
    s.ring(end[0], end[1], .54, { r: 3.4, k: 2 });
    const zx = end[0] + 8 * .866, zz = end[1] - 4;
    s.zone(zx, zz, 6, 6, { c: 'mute', dash: 1 });
    s.flash(s.zone(zx, zz, 6, 6, { c: 'env' }), .74, .25);
  }, { poster: .4 }],

  conflict: [s => {
    const a = s.puck(), b = s.puck({ b: 1 });
    s.anim(a, [g(0, -15), { o: .06 }, g(.35, -3.05, 0, { e: 'in' }), g(.65, -9, -7, { e: 'out', r: [0, 160, 0] })]);
    s.anim(b, [g(0, 15), { o: .06 }, g(.35, 3.05, 0, { e: 'in' }), g(.65, 9, 7, { e: 'out', r: [0, -160, 0] })]);
    s.ring(0, 0, .35, { r: 1.5, k: 4, c: 'env' });
    s.ring(0, 0, .37, { r: 1.2, k: 3 });
  }, { poster: .4 }],

  /* ── V · many pucks ──────────────────────────────────── */
  ingest: [s => {
    const SC = [[-14, -6], [13, -5], [-12, 6], [14, 5], [-5, -8], [6, 7], [-15, 0]];
    HEX.forEach(([hx, hz], i) => {
      const p = s.puck({ tick: false });
      s.anim(p, [g(0, SC[i][0], SC[i][1]), { o: .12 }, g(.55, hx, hz, { e: 'io' })]);
      s.trail([SC[i], [hx, hz]], .12, .55);
    });
    s.show(s.circle(0, 0, 10.6, { c: 'env' }), .58);
  }, { poster: .8 }],

  format: [s => {
    const LO = [[-11, -5], [-8, 5], [-3, -7], [-1, 4], [4, -6], [6, 6], [11, -4], [12, 4]];
    const grid = [[-9.6, -3.3], [-9.6, 3.3], [-3.2, -3.3], [-3.2, 3.3], [3.2, -3.3], [3.2, 3.3], [9.6, -3.3], [9.6, 3.3]];
    grid.forEach(([gx, gz], i) => {
      const p = s.puck({ tick: false });
      s.anim(p, [g(0, LO[i][0], LO[i][1]), { o: .12 }, g(.55, gx, gz)]);
      s.trail([LO[i], [gx, gz]], .12, .55);
    });
    [-6.4, 0, 6.4].forEach(x => s.show(s.line([[x, -7], [x, 7]], { c: 'env' }), .6));
    s.show(s.line([[-13, 0], [13, 0]], { c: 'env' }), .6);
  }, { poster: .8 }],

  diversify: [s => {
    const h = s.palm(3.4, .35);
    s.anim(h, [q(0, 0, 1.3, 0, { op: 0 }), { o: .06, op: 1 }, { o: .2, s: 1 }, { o: .6, s: 2.8, op: 0 }]);
    HEX.forEach(([hx, hz]) => {
      const p = s.puck({ tick: false }), [fx, fz] = [hx * 1.45, hz * 1.05];
      s.anim(p, [g(0, hx, hz), { o: .2 }, g(.6, fx, fz, { e: 'out' })]);
      if (hx || hz) s.trail([[hx, hz], [fx, fz]], .2, .6);
      s.show(s.token(fx, fz, { y: 2.2, size: .8 }), .64);
    });
  }, { poster: .8 }],

  flush: [s => {
    const h = s.palm(3.8, .45);
    s.anim(h, [q(0, 0, 6, 0, { op: 0 }), { o: .18 }, { o: .2, op: 1 }, q(.27, 0, 1.3, 0, { e: 'in' }), { o: .34, op: 0 }]);
    s.vis(s.circle(0, 0, 10.6, { c: 'env' }), [[0, 1], [.27, 1], [.42, 0], [.78, 0], [.92, 1]]);
    s.ring(0, 0, .28, { r: 2, k: 7 });
    HEX.forEach(([hx, hz], i) => {
      const p = s.puck({ tick: false }), [dx, dz] = i ? [hx, hz] : [3, 6], k = 16 / Math.hypot(dx, dz);
      s.anim(p, [g(0, hx, hz, { op: 1 }), { o: .27 }, q(.4, dx * k * .5, 3, dz * k * .5, { e: 'out' }), q(.58, dx * k, Y, dz * k, { e: 'in', op: 0 }), g(.6, hx, hz, { op: 0 }), { o: .75 }, { o: .9, op: 1 }]);
    });
  }, { poster: .2 }],

  cull: [s => {
    HEX.forEach(([hx, hz], i) => {
      const p = s.puck({ tick: false });
      if (i !== 1) return s.at(p, hx, Y, hz);
      s.pinch(p);
      s.anim(p, [g(0, hx, hz, { op: 1 }), { o: .28 }, q(.34, hx + 1, 2, hz, { e: 'out' }), q(.5, 18, Y, hz, { e: 'in', op: 0 }), g(.62, hx, hz, { op: 0 }), { o: .72 }, { o: .9, op: 1 }]);
    });
    s.show(s.circle(6.2, 0, 3.9, { c: 'env' }), .08, .3);
  }, { poster: .4 }],

  shuffle: [s => {
    const rx = 10, rz = 6;
    for (let i = 0; i < 4; i++) {
      const p = s.puck({ b: i % 2, tick: true });
      s.anim(p, arcf(0, 0, i * 90, i * 90 + 360, 0, 1, { rx, rz, spin: 1.5 }));
    }
    const c = s.puck(); s.anim(c, [g(0, 0, 0, { r: [0, 0, 0] }), { o: 1, r: [0, -720, 0] }]);
    s.line(arcf(0, 0, 0, 360, 0, 1, { rx, rz, n: 64 }).map(f => [f.p[0], f.p[2]]), { c: 'act', dash: 1 });
  }, { dur: 5, poster: .1 }],

  chain: [s => {
    const xs = [-6.1, 0, 6.1], st = s.puck(), last = s.puck({ b: 1 });
    s.anim(st, [g(0, -19), { o: .08 }, g(.26, -12.2, 0, { e: 'in' })]);
    xs.forEach((x, i) => {
      const t = .26 + i * .08, p = i < 2 ? s.puck() : last, tk = s.token(x, 0, { y: 4.5 });
      s.anim(tk, [{ o: 0, s: .6 }, { o: t - .01 }, { o: t + .05, s: 1.8 }, { o: t + .15, s: .6 }]);
      s.ring(x - R, 0, t, { r: 1.4, k: 3 });
      if (i < 2) s.anim(p, [g(0, x), { o: t - .01 }, g(t + .03, x + .5), g(t + .08, x)]);
      else s.anim(p, [g(0, x), { o: t }, g(t + .3, 20, 0, { e: 'out' })]);
    });
    s.anim(s.token(-12.2, 0, { y: 4.5 }), [{ o: 0, s: .6 }, { o: .22 }, { o: .27, s: 1.8 }, { o: .37, s: .6 }]);
  }, { dur: 3.8, poster: .5 }],

  collaborate: [s => {
    const path = route(spline([[-4, 2], [0, -1.5], [4, 2]]));
    const ring = s.circle(0, 0, 10.8, { c: 'env', dash: 1 });
    const cen = [];
    for (let k = 0; k <= 40; k++) { const u = k / 40, { x, z } = path.at(u); cen.push([.1 + .75 * u, x, z, 12 * Math.sin(rad(360 * u))]); }
    s.anim(ring, [q(0, path.at(0).x, .05, path.at(0).z, { op: 0 }), { o: .08 }, { o: .1, op: 1 }, ...cen.map(([o, x, z]) => q(o, x, .05, z, { e: 'lin' })), { o: .92, op: 0 }]);
    HEX.forEach(([hx, hz]) => {
      const p = s.puck({ tick: true });
      s.anim(p, [g(0, cen[0][1] + hx, cen[0][2] + hz), { o: .1 }, ...cen.map(([o, x, z, a]) => {
        const c = Math.cos(rad(a)), sn = Math.sin(rad(a));
        return g(o, x + hx * c - hz * sn, z + hx * sn + hz * c, { r: [0, -a, 0], e: 'lin' });
      })]);
    });
  }, { poster: .5 }],

  saturate: [s => {
    s.wall([[-14, 11], [2, 3.6], [14, 3.6]], 2);
    s.wall([[-14, -11], [2, -3.6], [14, -3.6]], 2);
    const J = [[1, 0], [-4, 3.4], [-4, -3.4], [-9, 0], [-10, 6], [-10, -6]], rnd = rng(5);
    J.forEach(([x, z]) => {
      const p = s.puck({ tick: false }), fr = [g(0, x - 12, z * .6), { o: .08 }, g(.5, x, z, { e: 'in' })];
      for (let o = .53; o < .88; o += .04) fr.push(g(o, x + (rnd() - .5) * .5, z + (rnd() - .5) * .5, { e: 'lin' }));
      s.anim(p, fr);
      s.trail([[x - 12, z * .6], [x, z]], .08, .5);
    });
    s.anim(s.token(6, 0, { size: 1.4 }), [{ o: 0, op: 0 }, { o: .5 }, ...[.53, .58, .63, .68, .73, .78, .83, .88].map((o, i) => ({ o, op: i % 2 ? .25 : 1, e: 'lin' }))]);
  }, { poster: .8 }],

  crash: [s => {
    const N = 8, rnd = rng(9);
    for (let i = 0; i < N; i++) {
      const p = s.puck({ b: i % 2 }), y0 = Y + i;
      const fx = (i % 4 - 1.5) * 7 + (rnd() - .5) * 1.4, fz = (i < 4 ? -1 : 1) * 4.4 + (rnd() - .5) * 1.4, spin = (rnd() - .5) * 200;
      s.anim(p, [q(0, 0, y0, 0), { o: .22 }, q(.34, i * .22, y0, 0, { r: [0, 0, -i * 1.1] }), q(.46 + i * .004, (i * .22 + fx) / 2, y0 * .35, fz / 2, { r: [0, spin / 2, -25 + rnd() * 50], e: 'in' }), g(.62, fx, fz, { r: [0, spin, 0], e: 'out' })]);
    }
    s.anim(s.token(0, 0, { size: 1.2 }), [q(0, 0, N + .9, 0), { o: .22 }, q(.34, 1.8, N + .6, 0), q(.5, 3, 4, 0, { e: 'in' }), q(.58, 0, .6, 0, { e: 'out' })]);
    s.anim(s.hand(), [q(0, 9, 3, 0, { op: 0 }), { o: .14 }, { o: .18, op: 1 }, q(.3, 3.6, 3, 0, { e: 'in' }), q(.36, 9, 3, 0, { op: 0 })]);
    s.ring(0, 0, .5, { r: 3.5, k: 3 });
  }, { dur: 4, poster: .8 }],
};
