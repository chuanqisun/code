# Shape Display — Internal Design

This document describes the architecture of the Shape Display pattern language and scheduler for maintainers.

## High-Level Architecture

The system follows a **pattern-creation / scheduling** separation inspired by [Strudel](https://strudel.cc/). The user writes code that declaratively constructs patterns; a separate render loop continuously evaluates the active pattern to drive the 3D pin grid and audio.

```
User Code  →  Pattern AST  →  compile()  →  (x,z,t,n)=>h  →  Scheduler (render loop)
                                                                  ├─ 3D pins
                                                                  └─ Audio
```

1. **Pattern creation** — The user script builds a tree of `Pattern` objects via factory functions and chained method calls.
2. **Compilation** — `Pattern._compile()` walks the AST and produces a single `(x, z, t, n) => h` function.
3. **Scheduling** — The `requestAnimationFrame` loop maintains its own clock (`globalTime`) and queries the compiled function every frame.

## Pattern Class

### AST Representation

Each `Pattern` stores two fields:

| Field | Description |
|-------|-------------|
| `_type` | A string tag identifying the node kind (e.g. `"wave"`, `"rotate"`, `"seq"`) |
| `_args` | A plain object holding the node's parameters and child `Pattern` references |

For example, `noise(2).slow(3).rotate(0.5)` produces:

```
Pattern("rotate", {
  source: Pattern("slow", {
    source: Pattern("noise", { scale: 2 }),
    factor: 3
  }),
  angle: 0.5
})
```

### Chaining

Every method on `Pattern` (`rotate`, `slow`, `blend`, etc.) creates a **new** `Pattern` node whose `_args.source` (or `_args.a`) references `this`. This builds the AST without mutating any existing node.

### Auto-Registration (No `return`)

The user script does not need to `return` a value. Instead, `Pattern` uses a **root registry**:

- The constructor adds every new `Pattern` to `Pattern._registry`.
- It also removes from the registry any `Pattern` instances referenced in `_args` (consumed patterns).
- After the user script finishes executing, only **root** patterns — those not consumed by any other pattern — remain in the registry.
- The scheduler takes the last root pattern and compiles it.

This means intermediate patterns created during chaining (e.g. the `noise(2)` node in `noise(2).slow(3)`) are automatically deregistered because `slow` consumes them. Only the final, outermost pattern survives as a root.

**Multiple roots:** If the user creates several unconnected patterns, each becomes a root. The system uses the last one. This is a deliberate simplification.

### Compilation

`_compileNode(pattern)` is a recursive switch over `_type`. Each case:

1. Compiles any child `Pattern` references in `_args` (recursive).
2. Returns a closure `(x, z, t, n) => h` that captures the compiled children.

Arguments that could be either a `Pattern`, a raw function, or a number are resolved by `_resolveArg()`, which normalizes them into `(x, z, t, n) => value` functions.

Compilation happens **once** when the user triggers a run (Ctrl+Enter). The compiled function is stored as `activePattern` and evaluated 30×30 = 900 times per frame.

## Scheduler (Render Loop)

The render loop runs via `requestAnimationFrame` and performs:

1. **Time advance** — `globalTime += dt`. This clock **never resets**, even when the user changes the pattern. This is the key mechanism that prevents visual/audio jumps on code change. Inspired by [Strudel's scheduling](https://loophole-letters.vercel.app/web-audio-scheduling): "when the pattern is changed from outside, the next scheduling callback will work with the new pattern, keeping its clock running."
2. **Pattern evaluation** — For each pin `(x, z)`, call `activePattern(x, z, globalTime, GRID)` to get a height in `[0, 1]`.
3. **3D update** — Set pin positions and update the instanced mesh and edge shader texture.
4. **Audio update** — Compute movement intensity (sum of height deltas) and drive the synthesizer voices proportionally. This keeps audio tightly coupled to the visual motion.

### Audio-Visual Sync

Audio is driven from the **same frame loop** as the visual update. Movement intensity is computed as the average absolute height change between the current and previous frames. This value controls:

- Oscillator gain (volume ramps with motion)
- Oscillator frequency (pitch rises with intensity)
- Filter cutoff (brighter timbre with more motion)

Because both audio parameters and pin positions are computed from `activePattern` in the same `requestAnimationFrame` callback, they are always in sync.

## User Scope Injection

The user code runs inside `new Function(...)` with injected parameter names:

```
wave, ripple, checker, grid, pyramid, flat, noise, map, seq,
blend, add, mul, inv, ease,
sin, cos, abs, sqrt, floor, PI,
clamp, lerp, smoothstep
```

All factory functions create `Pattern` instances. Math utilities (`sin`, `cos`, etc.) are standard `Math.*` functions. The `map()` callback captures these through closure, so `sin(x)` works inside `map((x) => sin(x))`.

## Adding a New Pattern Type

To add a new pattern type (e.g. `diamond`):

1. **Factory function** — Add `function _diamond(...) { return new Pattern("diamond", { ... }); }` and include it in `_scopeNames`/`_scopeValues`.
2. **Compile case** — Add a `case "diamond":` in `_compileNode` that returns `(x, z, t, n) => h`.
3. **Docs** — Update the API reference panel in HTML, `programming-manual.md`, and this document.

To add a new transform (e.g. `mirror`):

1. **Method** — Add `mirror(...) { return new Pattern("mirror", { source: this, ... }); }` to the `Pattern` class.
2. **Compile case** — Add the corresponding case in `_compileNode`.
3. **Docs** — Update all documentation.

## URL Sharing

The editor contents are compressed with the Compression Streams API (`deflate`) and stored as a base64url fragment in the URL hash. This allows sharing patterns via links without any server.
