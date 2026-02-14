# Shape Display Programming Manual

## Overview

The Shape Display is a programmable 30×30 grid of motorized pins. Each pin's height is controlled in real-time by a **Pattern** you write in JavaScript. The system provides a chainable, composable API inspired by Tidal Cycles / Strudel — patterns are objects that can be combined, transformed, and sequenced using method chaining.

**Core concept:** Everything is a *Pattern* — an object that maps coordinates and time to a height value:

```js
(x, z, t, n) => h
```

| Parameter | Range | Description |
|-----------|-------|-------------|
| `x` | 0–1 | Horizontal position (left to right) |
| `z` | 0–1 | Depth position (front to back) |
| `t` | 0–∞ | Time in seconds (continuous) |
| `n` | 30 | Grid resolution |
| **output** `h` | 0–1 | Pin height (0 = flush, 1 = fully extended) |

Your script is **declarative**: you build patterns and call `display(pattern)` to declare which one the scheduler should show. The scheduler runs independently and always samples the latest declared pattern. Press **Ctrl/Cmd + Enter** to run.

---

## Getting Started

The simplest program — a static flat surface:

```js
display(flat(0.5))
```

A custom pattern using `pat`:

```js
display(pat((x, z, t) =>
  sin(x * 10 + t) * 0.5 + 0.5
))
```

A sequence of built-in patterns:

```js
display(seq(2,
  wave(1, 1),
  ripple(0.5, 0.5, 3),
  pyramid()
))
```

Chaining transforms:

```js
display(wave(2, 0).slow(2).rotate(PI / 4).ease())
```

---

## Declaring Patterns

### `display(pattern)`

Declare which pattern the scheduler should show on the display. This is the entry point — your script builds a pattern and passes it to `display()`.

```js
display(wave(1, 1))

// with transforms
display(wave(2, 0).slow(2).rotate(PI / 4))

// with variables
const bg = noise(5)
const fg = ripple(0.5, 0.5, 3)
display(fg.mul(bg))
```

If `display()` is called multiple times, the last call wins.

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

### `pat(fn)`

Define a fully custom pattern from a function `(x, z, t, n) → h`.

```js
// diagonal gradient
pat((x, z) => (x + z) / 2)

// animated diagonal wave
pat((x, z, t) =>
  sin((x + z) * 6 + t * 2) * 0.5 + 0.5
)

// distance from center
pat((x, z) => {
  const d = sqrt((x - 0.5) ** 2 + (z - 0.5) ** 2)
  return 1 - d * 2
})

// use grid index for pixel-level control
pat((x, z, t, n) => {
  const ix = Math.round(x * (n - 1))
  const iz = Math.round(z * (n - 1))
  return (ix + iz) % 3 === 0 ? 1 : 0
})
```

---

## Combinators

Combinators take one or more patterns and produce a new pattern. They are available both as **chaining methods** and as **top-level functions**.

### `.blend(other, mix)` / `blend(a, b, mix)`

Crossfade between two patterns. `mix` can be a number (0–1) or a Pattern for spatially varying blends.

```js
// chaining: blend pyramid into wave
wave(1, 1).blend(pyramid(), 0.5)

// top-level
blend(checker(4), ripple(0.5, 0.5, 3), 0.5)

// animated blend using a pattern as mix
wave(1, 1).blend(
  checker(4),
  pat((x, z, t) => sin(t) * 0.5 + 0.5)
)

// spatial blend: wave on left, pyramid on right
wave(2, 2).blend(pyramid(), pat((x) => x))
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
  pat((x, z) => 1 - sqrt((x-0.5)**2 + (z-0.5)**2) * 2)
)
```

### `.inv()` / `inv(pattern)`

Invert a pattern: `1 - h`.

```js
pyramid().inv()   // bowl shape
```

### `.ease()`

Apply smoothstep easing to output values. Softens hard edges.

```js
checker(4).ease()   // rounded checkerboard
```

---

## Sequencing

### `seq(duration, ...patterns)`

Cycle through patterns with smooth crossfade transitions. Each pattern holds for `duration` seconds, then crossfades to the next over 0.8 seconds.

```js
display(seq(2,
  flat(0),
  pyramid(),
  wave(2, 2),
  ripple(0.5, 0.5, 4),
  checker(5)
))
```

The sequence loops indefinitely. Transition easing is automatic.

---

## Spatial Transforms

All spatial transforms are **chaining methods** that return a new Pattern.

### `.rotate(angle)`

Rotate a pattern around the grid center. `angle` is in radians, or a Pattern for animated rotation.

```js
// static 45° rotation
wave(2, 0).rotate(PI / 4)

// continuously spinning
checker(4).rotate(pat((x, z, t) => t * 0.5))
```

### `.scale(sx, sz?)`

Scale a pattern from center. Values > 1 zoom in, < 1 zoom out. If `sz` is omitted, uniform scaling is used.

```js
checker(4).scale(2)       // zoomed in 2×
wave(1, 1).scale(0.5, 2)  // squished
```

### `.offset(ox, oz)`

Translate a pattern. Offsets can be numbers or Patterns for animation.

```js
// static shift
ripple(0.5, 0.5, 3).offset(0.2, 0.1)

// scrolling wave
wave(2, 0).offset(pat((x, z, t) => t * 0.1), 0)
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

These are available as top-level names for use inside `pat()` and other functions.

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

## Live Coding

Your script is **declarative** — it builds patterns and calls `display()` to register them with the scheduler. The internal clock **never resets** — when you re-run your code, the new pattern picks up at the current time, creating seamless transitions.

This is inspired by Strudel/Tidal Cycles' approach of decoupling pattern creation from scheduling:

1. **You write code** → declares patterns via `display()` (no `return` needed)
2. **The scheduler runs independently** → queries the active Pattern every frame at the current time
3. **When you re-run** → the new Pattern replaces the old one, but the clock continues

This means you can edit sequences, change transforms, or swap patterns without any jarring jumps.

Press **Ctrl/Cmd + Enter** to run the code.

---

## Recipes

**Breathing pulse:**

```js
display(pat((x, z, t) => sin(t * 2) * 0.4 + 0.5))
```

**Rotating ripple:**

```js
display(ripple(0.5, 0.5, 4).rotate(
  pat((x, z, t) => t * 0.3)
))
```

**Terrain with moving spotlight:**

```js
display(noise(6).mul(
  pat((x, z, t) => {
    const cx = sin(t * 0.5) * 0.3 + 0.5
    const cz = cos(t * 0.7) * 0.3 + 0.5
    const d = sqrt((x - cx) ** 2 + (z - cz) ** 2)
    return clamp(1 - d * 3)
  })
))
```

**Sequenced show with variety:**

```js
display(seq(2,
  wave(1, 1),
  checker(6).ease(),
  wave(3, 0).rotate(pat((x,z,t) => t)),
  noise(4).blend(pyramid(), 0.5),
  ripple(0.5, 0.5, 5).mul(pyramid().inv()),
  flat(0.02)
))
```

**Conway-style cellular (using grid snapping):**

```js
display(pat((x, z, t, n) => {
  const ix = Math.round(x * (n - 1))
  const iz = Math.round(z * (n - 1))
  const phase = floor(t / 0.5)
  const v = sin(ix * 0.7 + phase) * cos(iz * 0.9 + phase * 1.3)
  return v > 0 ? 0.95 : 0.05
}))
```
