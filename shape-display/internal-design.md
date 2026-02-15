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

| Field   | Description                                                                 |
| ------- | --------------------------------------------------------------------------- |
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

1. **Time advance** — `globalTime += dt`. The underlying clock never resets.
2. **Program-relative time** — The pattern receives `t = globalTime - programStartTime`, so `t` starts from 0 on each re-run. This ensures animation signals (`tween`, etc.) and sequences replay from the start.
3. **Pattern evaluation** — For each pin `(x, z)`, call `activePattern(x, z, t, GRID)` to get a height in `[0, 1]`.
4. **3D update** — Set pin positions and update the instanced mesh and edge shader texture.
5. **Audio update** — Compute movement intensity (sum of height deltas) and drive the synthesizer voices proportionally.

### Audio-Visual Sync

Audio is driven from the **same frame loop** as the visual update. Movement intensity is computed as the average absolute height change between the current and previous frames. This value controls:

- Oscillator gain (volume ramps with motion)
- Oscillator frequency (pitch rises with intensity)
- Filter cutoff (brighter timbre with more motion)

Because both audio parameters and pin positions are computed from `activePattern` in the same `requestAnimationFrame` callback, they are always in sync.

## User Scope Injection

The user code runs inside `new Function(...)` with injected parameter names:

```
wave, ripple, checker, gridlines, pyramid, flat, noise, map, seq, sleep,
blend, add, mul, inv, ease,
tween, osc, saw, pulse,
grid,
sin, cos, abs, sqrt, floor, PI,
clamp, lerp, smoothstep
```

All factory functions create `Pattern` instances. Math utilities (`sin`, `cos`, etc.) are standard `Math.*` functions. The `map()` callback captures these through closure, so `sin(x)` works inside `map((x) => sin(x))`.

## Animation Signals

Animation signals are plain functions `(x, z, t, n) => number` that can be used anywhere a static value is accepted. Because `_resolveArg()` already normalises functions, signals compose naturally with transforms:

```js
wave(1, 1).rotate(tween(0, PI, 5)); // animate rotation over 5 s
checker(4).blend(pyramid(), osc(0.3)); // oscillating blend
```

| Signal                        | Signature                                    | Description   |
| ----------------------------- | -------------------------------------------- | ------------- |
| `tween(from, to, dur, ease?)` | Ramp from → to over dur seconds, clamp at to | One-shot ramp |
| `osc(freq, lo?, hi?)`         | Sine oscillation between lo and hi           | Continuous    |
| `saw(freq, lo?, hi?)`         | Sawtooth ramp between lo and hi              | Continuous    |
| `pulse(freq, duty?)`          | Square wave (0 or 1)                         | Continuous    |

Signals depend on `t`, which is **program-relative time** (see below), so `tween` starts from 0 on each re-run.

## Sleep & Non-Looping Sequences

`sleep(duration)` creates a special `Pattern` of type `"sleep"`. It is meaningful only inside `seq()`:

- **`sleep(t)`** — holds the previous pattern for `t` seconds (the pattern keeps animating, just no transition to the next one)
- **`sleep(Infinity)`** — halts the sequence permanently (no looping)

### Seq Compilation (Timeline Model)

The `seq` compiler builds a flat list of **timeline segments**:

| Segment type      | Key          | Description                           |
| ----------------- | ------------ | ------------------------------------- |
| `"p"` (pattern)   | `fn`         | Show a pattern for `dur` seconds      |
| `"x"` (crossfade) | `from`, `to` | Smoothstep crossfade over 0.8 s       |
| `"h"` (hold)      | `fn`         | Hold a pattern for `sleep(t)` seconds |

If the sequence contains `sleep(Infinity)`, `totalDur` is set to `Infinity` and the sequence does **not loop**. Otherwise `totalDur` is finite and time wraps via modulo for looping. A crossfade back to the first pattern is appended automatically when looping.

## Program-Relative Time

When the user runs the code (Ctrl+Enter), `programStartTime` is captured from `globalTime`. The render loop passes `globalTime - programStartTime` to the pattern, so `t` always starts from 0 on each re-run. This ensures:

- `tween()` animations play from the beginning
- `seq()` sequences restart from the first pattern
- `sleep(Infinity)` holds indefinitely until the user re-evaluates

## Dynamic Grid Size

`grid(n)` (injected as `_setGrid`) allows the user to set the pin grid resolution from 2 to 64 (default 32). It works via a **deferred rebuild** pattern:

1. During script execution, `grid(n)` stores the requested size in `_pendingGridSize`.
2. After the script finishes, `runProgram()` checks `_pendingGridSize` and calls `rebuildGrid(n)` if changed.
3. `rebuildGrid(n)` tears down the old instanced mesh, edge geometry, shell, and data arrays, then creates new ones sized to `n × n`.

The old pattern factory `grid(spacing)` was renamed to `gridlines(spacing)` to free the `grid` name for the size API.

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
