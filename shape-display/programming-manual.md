# Shape Display Programming Manual

## Overview

The Shape Display is a programmable 30×30 grid of motorized pins. Each pin's height is controlled in real-time by a pattern you write in JavaScript. Patterns are created by calling factory functions and chaining transform methods — no `return` statement needed.

**Core concept:** Everything is a *Pattern*. A pattern describes a height field over space and time:

| Parameter | Range | Description |
|-----------|-------|-------------|
| `x` | 0–1 | Horizontal position (left to right) |
| `z` | 0–1 | Depth position (front to back) |
| `t` | 0–∞ | Time in seconds (continuous) |
| `n` | 30 | Grid resolution |
| **output** `h` | 0–1 | Pin height (0 = flush, 1 = fully extended) |

Write your pattern, then press **Ctrl+Enter** (Cmd+Enter on Mac) to run. The clock never resets — editing and re-running smoothly transitions to the new pattern.

---

## Getting Started

The simplest program — a static flat surface:

```js
flat(0.5)
```

A custom pattern using `map`:

```js
map((x, z, t) =>
  sin(x * 10 + t) * 0.5 + 0.5
)
```

A sequence of built-in patterns:

```js
seq(2,
  wave(1, 1),
  ripple(0.5, 0.5, 3),
  pyramid()
)
```

Chaining transforms on a pattern:

```js
noise(5).slow(2).rotate(PI / 4)
```

---

## Primitives

### `flat(height)`

All pins at a constant height.

```js
flat(0)     // all pins flush
flat(1)     // all pins fully extended
flat(0.5)   // halfway
```

### `wave(freqX, freqZ)`

Sinusoidal wave along X and Z axes. Frequencies control how many wave periods fit across the grid.

```js
wave(1, 1)   // one period in each axis
wave(3, 0)   // three vertical stripes, flat along Z
wave(0, 2)   // two horizontal stripes, flat along X
```

### `ripple(cx, cz, freq)`

Concentric circular ripple centered at `(cx, cz)`.

```js
ripple(0.5, 0.5, 3)   // centered, 3 rings
ripple(0, 0, 5)        // corner origin, tighter rings
```

### `checker(size)`

Checkerboard pattern. `size` controls the number of divisions.

```js
checker(2)    // large squares
checker(6)    // small squares
```

### `grid(spacing)`

Raised grid lines. `spacing` is in pin units.

```js
grid(5)    // lines every 5 pins
grid(10)   // lines every 10 pins
```

### `pyramid()`

A centered pyramid shape, tallest at center.

```js
pyramid()
```

### `noise(scale)`

Perlin noise field. `scale` controls spatial frequency. Slowly drifts over time.

```js
noise(3)    // broad, smooth terrain
noise(10)   // fine, detailed texture
```

### `map(fn)`

Define a fully custom pattern. The function receives `(x, z, t, n)` and returns a height. This is the most powerful primitive.

```js
// diagonal gradient
map((x, z) => (x + z) / 2)

// animated diagonal wave
map((x, z, t) =>
  sin((x + z) * 6 + t * 2) * 0.5 + 0.5
)

// distance from center
map((x, z) => {
  const d = sqrt((x - 0.5) ** 2 + (z - 0.5) ** 2)
  return 1 - d * 2
})

// use grid index for pixel-level control
map((x, z, t, n) => {
  const ix = Math.round(x * (n - 1))
  const iz = Math.round(z * (n - 1))
  return (ix + iz) % 3 === 0 ? 1 : 0
})
```

---

## Combinators

Combinators take one or more patterns and produce a new pattern. They are available as both chained methods and standalone functions.

### `.blend(other, mix)` / `blend(a, b, mix)`

Crossfade between two patterns. `mix` can be a number (0–1) or a pattern for spatially/temporally varying blends.

```js
// static 50/50 blend (method)
wave(1, 1).blend(pyramid(), 0.5)

// animated blend using time (standalone)
blend(
  checker(4),
  ripple(0.5, 0.5, 3),
  map((x, z, t) => sin(t) * 0.5 + 0.5)
)

// spatial blend: wave on left, pyramid on right
wave(2, 2).blend(pyramid(), map((x) => x))
```

### `.add(other)` / `add(a, b)`

Add two patterns together (clamped to 0–1).

```js
wave(1, 0).add(wave(0, 1))
```

### `.mul(other)` / `mul(a, b)`

Multiply two patterns (useful for masking).

```js
// ripple masked by a circular falloff
ripple(0.5, 0.5, 5).mul(
  map((x, z) => 1 - sqrt((x-0.5)**2 + (z-0.5)**2) * 2)
)
```

### `.inv()` / `inv(pattern)`

Invert a pattern: `1 - h`.

```js
pyramid().inv()   // bowl shape
```

### `.ease()` / `ease(pattern)`

Apply smoothstep easing to output values. Softens hard edges.

```js
checker(4).ease()   // rounded checkerboard
```

---

## Sequencing

### `seq(duration, ...patterns)`

Cycle through patterns with smooth transitions. Each pattern holds for `duration` seconds, then crossfades to the next over 0.8 seconds.

```js
seq(2,
  flat(0),
  pyramid(),
  wave(2, 2),
  ripple(0.5, 0.5, 4),
  checker(5)
)
```

The sequence loops indefinitely. Transition easing is automatic. You can chain transforms on a sequence:

```js
seq(1, wave(1, 0), wave(0, 1)).slow(2)
```

---

## Spatial Transforms

Transforms are chained as methods on any pattern.

### `.rotate(angle)`

Rotate a pattern around the grid center. `angle` is in radians, or a pattern for animated rotation.

```js
// static 45° rotation
wave(2, 0).rotate(PI / 4)

// continuously spinning
checker(4).rotate(map((x, z, t) => t * 0.5))
```

### `.scale(sx, sz?)`

Scale a pattern from center. Values > 1 zoom in, < 1 zoom out. If `sz` is omitted, uniform scaling is used.

```js
checker(4).scale(2)       // zoomed in 2×
wave(1, 1).scale(0.5, 2)  // squished
```

### `.offset(ox, oz)`

Translate a pattern. Offsets can be numbers or patterns for animation.

```js
// static shift
ripple(0.5, 0.5, 3).offset(0.2, 0.1)

// scrolling wave
wave(2, 0).offset(map((x, z, t) => t * 0.1), 0)
```

---

## Time Transforms

### `.slow(factor)`

Slow down a pattern's time evolution.

```js
noise(5).slow(3)   // 3× slower
```

### `.fast(factor)`

Speed up a pattern's time evolution.

```js
noise(5).fast(2)   // 2× faster
```

---

## Math Utilities

These are available directly in your code (no prefix needed).

| Function | Description |
|----------|-------------|
| `sin(x)` | Sine |
| `cos(x)` | Cosine |
| `abs(x)` | Absolute value |
| `sqrt(x)` | Square root |
| `floor(x)` | Floor |
| `PI` | π |
| `clamp(v)` | Clamp to 0–1 |
| `lerp(a, b, t)` | Linear interpolation |
| `smoothstep(t)` | Smooth hermite interpolation (0–1 → 0–1) |

---

## Recipes

**Breathing pulse:**

```js
map((x, z, t) => sin(t * 2) * 0.4 + 0.5)
```

**Rotating ripple:**

```js
ripple(0.5, 0.5, 4).rotate(
  map((x, z, t) => t * 0.3)
)
```

**Terrain with moving spotlight:**

```js
noise(6).mul(
  map((x, z, t) => {
    const cx = sin(t * 0.5) * 0.3 + 0.5
    const cz = cos(t * 0.7) * 0.3 + 0.5
    const d = sqrt((x - cx) ** 2 + (z - cz) ** 2)
    return clamp(1 - d * 3)
  })
)
```

**Sequenced show with variety:**

```js
seq(2,
  wave(1, 1),
  checker(6).ease(),
  wave(3, 0).rotate(map((x, z, t) => t)),
  noise(4).blend(pyramid(), 0.5),
  ripple(0.5, 0.5, 5).mul(pyramid().inv()),
  flat(0.02)
)
```

**Conway-style cellular (using grid snapping):**

```js
map((x, z, t, n) => {
  const ix = Math.round(x * (n - 1))
  const iz = Math.round(z * (n - 1))
  const phase = floor(t / 0.5)
  const v = sin(ix * 0.7 + phase) * cos(iz * 0.9 + phase * 1.3)
  return v > 0 ? 0.95 : 0.05
})
```