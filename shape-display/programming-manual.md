# Shape Display Programming Manual

## Overview

The Shape Display is a programmable 30×30 grid of motorized pins. Each pin's height is controlled in real-time by a pattern function you write in JavaScript. The system provides a functional, composable API inspired by Tidal Cycles and P5.js — patterns are functions that can be combined, transformed, and sequenced.

**Core concept:** Everything is a *pattern* — a function of the form:

```js
(x, z, t, n) => h
```

| Parameter | Range | Description |
|-----------|-------|-------------|
| `x` | 0–1 | Horizontal position (left to right) |
| `z` | 0–1 | Depth position (front to back) |
| `t` | 0–∞ | Time in seconds (continuous) |
| `n` | 30 | Grid resolution |
| **return** `h` | 0–1 | Pin height (0 = flush, 1 = fully extended) |

Your program must **return** a pattern function. Press **Ctrl+Enter** to run.

---

## Getting Started

The simplest program — a static flat surface:

```js
return s.flat(0.5)
```

A custom pattern using `s.map`:

```js
return s.map((x, z, t) =>
  Math.sin(x * 10 + t) * 0.5 + 0.5
)
```

A sequence of built-in patterns:

```js
return s.seq(2,
  s.wave(1, 1),
  s.ripple(0.5, 0.5, 3),
  s.pyramid()
)
```

---

## Primitives

### `s.flat(height)`

All pins at a constant height.

```js
s.flat(0)     // all pins flush
s.flat(1)     // all pins fully extended
s.flat(0.5)   // halfway
```

### `s.wave(freqX, freqZ)`

Sinusoidal wave along X and Z axes. Frequencies control how many wave periods fit across the grid.

```js
s.wave(1, 1)   // one period in each axis
s.wave(3, 0)   // three vertical stripes, flat along Z
s.wave(0, 2)   // two horizontal stripes, flat along X
```

### `s.ripple(cx, cz, freq)`

Concentric circular ripple centered at `(cx, cz)`.

```js
s.ripple(0.5, 0.5, 3)   // centered, 3 rings
s.ripple(0, 0, 5)        // corner origin, tighter rings
```

### `s.checker(size)`

Checkerboard pattern. `size` controls the number of divisions.

```js
s.checker(2)    // large squares
s.checker(6)    // small squares
```

### `s.grid(spacing)`

Raised grid lines. `spacing` is in pin units.

```js
s.grid(5)    // lines every 5 pins
s.grid(10)   // lines every 10 pins
```

### `s.pyramid()`

A centered pyramid shape, tallest at center.

```js
s.pyramid()
```

### `s.noise(scale)`

Perlin noise field. `scale` controls spatial frequency. Slowly drifts over time.

```js
s.noise(3)    // broad, smooth terrain
s.noise(10)   // fine, detailed texture
```

### `s.map(fn)`

Define a fully custom pattern. This is the most powerful primitive.

```js
// diagonal gradient
s.map((x, z) => (x + z) / 2)

// animated diagonal wave
s.map((x, z, t) =>
  s.sin((x + z) * 6 + t * 2) * 0.5 + 0.5
)

// distance from center
s.map((x, z) => {
  const d = s.sqrt((x - 0.5) ** 2 + (z - 0.5) ** 2)
  return 1 - d * 2
})

// use grid index for pixel-level control
s.map((x, z, t, n) => {
  const ix = Math.round(x * (n - 1))
  const iz = Math.round(z * (n - 1))
  return (ix + iz) % 3 === 0 ? 1 : 0
})
```

---

## Combinators

Combinators take one or more patterns and produce a new pattern.

### `s.blend(a, b, mix)`

Crossfade between two patterns. `mix` can be a number (0–1) or a pattern function for spatially varying blends.

```js
// static 50/50 blend
s.blend(s.wave(1, 1), s.pyramid(), 0.5)

// animated blend using time
s.blend(
  s.checker(4),
  s.ripple(0.5, 0.5, 3),
  s.map((x, z, t) => s.sin(t) * 0.5 + 0.5)
)

// spatial blend: wave on left, pyramid on right
s.blend(s.wave(2, 2), s.pyramid(), s.map((x) => x))
```

### `s.add(a, b)`

Add two patterns together (clamped to 0–1).

```js
s.add(s.wave(1, 0), s.wave(0, 1))
```

### `s.mul(a, b)`

Multiply two patterns (useful for masking).

```js
// ripple masked by a circular falloff
s.mul(
  s.ripple(0.5, 0.5, 5),
  s.map((x, z) => 1 - s.sqrt((x-0.5)**2 + (z-0.5)**2) * 2)
)
```

### `s.inv(pattern)`

Invert a pattern: `1 - h`.

```js
s.inv(s.pyramid())   // bowl shape
```

### `s.ease(pattern)`

Apply smoothstep easing to output values. Softens hard edges.

```js
s.ease(s.checker(4))   // rounded checkerboard
```

---

## Sequencing

### `s.seq(duration, ...patterns)`

Cycle through patterns with smooth transitions. Each pattern holds for `duration` seconds, then crossfades to the next over 0.8 seconds.

```js
s.seq(2,
  s.flat(0),
  s.pyramid(),
  s.wave(2, 2),
  s.ripple(0.5, 0.5, 4),
  s.checker(5)
)
```

The sequence loops indefinitely. Transition easing is automatic.

---

## Spatial Transforms

### `s.rotate(pattern, angle)`

Rotate a pattern around the grid center. `angle` is in radians, or a pattern function for animated rotation.

```js
// static 45° rotation
s.rotate(s.wave(2, 0), Math.PI / 4)

// continuously spinning
s.rotate(s.checker(4), s.map((x, z, t) => t * 0.5))
```

### `s.scale(pattern, sx, sz?)`

Scale a pattern from center. Values > 1 zoom in, < 1 zoom out. If `sz` is omitted, uniform scaling is used.

```js
s.scale(s.checker(4), 2)       // zoomed in 2×
s.scale(s.wave(1, 1), 0.5, 2)  // squished
```

### `s.offset(pattern, ox, oz)`

Translate a pattern. Offsets can be numbers or pattern functions for animation.

```js
// static shift
s.offset(s.ripple(0.5, 0.5, 3), 0.2, 0.1)

// scrolling wave
s.offset(s.wave(2, 0), s.map((x, z, t) => t * 0.1), 0)
```

---

## Time Transforms

### `s.slow(pattern, factor)`

Slow down a pattern's time evolution.

```js
s.slow(s.noise(5), 3)   // 3× slower
```

### `s.fast(pattern, factor)`

Speed up a pattern's time evolution.

```js
s.fast(s.noise(5), 2)   // 2× faster
```

---

## Math Utilities

These are available on the `s` object for use inside `s.map` and other functions.

| Function | Description |
|----------|-------------|
| `s.sin(x)` | Sine |
| `s.cos(x)` | Cosine |
| `s.abs(x)` | Absolute value |
| `s.sqrt(x)` | Square root |
| `s.floor(x)` | Floor |
| `s.PI` | π |
| `s.clamp(v)` | Clamp to 0–1 |
| `s.lerp(a, b, t)` | Linear interpolation |
| `s.smoothstep(t)` | Smooth hermite interpolation (0–1 → 0–1) |

---

## Recipes

**Breathing pulse:**

```js
return s.map((x, z, t) => s.sin(t * 2) * 0.4 + 0.5)
```

**Rotating ripple:**

```js
return s.rotate(
  s.ripple(0.5, 0.5, 4),
  s.map((x, z, t) => t * 0.3)
)
```

**Terrain with moving spotlight:**

```js
return s.mul(
  s.noise(6),
  s.map((x, z, t) => {
    const cx = s.sin(t * 0.5) * 0.3 + 0.5
    const cz = s.cos(t * 0.7) * 0.3 + 0.5
    const d = s.sqrt((x - cx) ** 2 + (z - cz) ** 2)
    return s.clamp(1 - d * 3)
  })
)
```

**Sequenced show with variety:**

```js
return s.seq(2,
  s.wave(1, 1),
  s.ease(s.checker(6)),
  s.rotate(s.wave(3, 0), s.map((x,z,t) => t)),
  s.blend(s.noise(4), s.pyramid(), 0.5),
  s.mul(s.ripple(0.5, 0.5, 5), s.inv(s.pyramid())),
  s.flat(0.02)
)
```

**Conway-style cellular (using grid snapping):**

```js
return s.map((x, z, t, n) => {
  const ix = Math.round(x * (n - 1))
  const iz = Math.round(z * (n - 1))
  const phase = s.floor(t / 0.5)
  const v = s.sin(ix * 0.7 + phase) * s.cos(iz * 0.9 + phase * 1.3)
  return v > 0 ? 0.95 : 0.05
})
```