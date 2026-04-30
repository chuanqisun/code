# 1. What is a flow field?

A flow field is a function that tells you the local direction at every point `(x, y)`.

In the code, that is:

```js
function fieldAngle(x, y) {
  const s = 0.0022;
  return 2.4 * (0.9 * Math.sin(x * s) + 0.7 * Math.cos(y * s * 1.31) + 0.6 * Math.sin((x + y) * s * 0.7) + 0.5 * Math.cos((x - y) * s * 0.9));
}
```

This returns an **angle** in radians.

So for any point `(x, y)`, you can compute a direction vector:

```js
dx = Math.cos(angle);
dy = Math.sin(angle);
```

That means:

- `fieldAngle(x, y)` defines the orientation of the line at that location
- nearby points have similar angles
- this creates smooth curving motion

You can think of the canvas as having a tiny arrow drawn everywhere, and each arrow tells a line which way to continue.

---

# 2. Why not just draw random curves?

If you randomly start many lines and let them grow, they will:

- overlap
- bunch together
- leave large gaps
- look messy rather than evenly distributed

The image you showed has a more **uniform density**.  
To achieve that, we must control spacing.

That is what the occupancy grid is for.

---

# 3. Main idea of the algorithm

The algorithm works like this:

1. Pick a random seed point.
2. If that seed is not too close to existing lines, start a new streamline there.
3. Grow the line forward along the flow field.
4. Grow the line backward along the flow field.
5. Stop growth if:
   - the line leaves the canvas
   - it comes too close to an existing line
6. Store all accepted points into a spatial data structure.
7. Repeat with many random seed attempts.

So each new line is only added if there is still space for it.

This is why the final image looks “packed.”

---

# 4. The important parameters

```js
const SPACING = 10;
const STEP = 2.0;
const MAX_STEPS = 500;
const SEED_TRIES = 30000;
const MIN_LENGTH = 20;
const LINE_WIDTH = 2.0;
```

## `SPACING`

Desired distance between neighboring lines.

- bigger spacing → fewer lines, more open space
- smaller spacing → denser field

This is the most important parameter for the packing effect.

---

## `STEP`

How far we move each time while tracing a streamline.

- smaller step → smoother curve, more points
- larger step → rougher curve, faster generation

Usually this should be significantly smaller than `SPACING`.

Why?  
Because if spacing is 10 and your step is also 10, the line may “jump” through forbidden regions without noticing.

---

## `MAX_STEPS`

Maximum number of tracing steps in one direction.

Prevents infinite or very long lines.

---

## `SEED_TRIES`

How many random candidate seeds we attempt.

Most tries will fail later in the process because the canvas becomes crowded.

---

## `MIN_LENGTH`

Discard tiny streamlines.

Without this, you get lots of very short fragments in leftover gaps.

---

# 5. Why use a grid?

Checking distance against **every point of every line** would be slow.

If there are thousands of points, and each new point checks all previous points, performance becomes bad.

So we use a **spatial grid**.

```js
const cellSize = SPACING / Math.sqrt(2);
const gridW = Math.ceil(canvas.width / cellSize);
const gridH = Math.ceil(canvas.height / cellSize);
const grid = Array.from({ length: gridW * gridH }, () => []);
```

This divides the canvas into small square cells.

Each cell stores the accepted line points that fall inside it.

So instead of checking all points globally, we only check points in nearby cells.

That makes proximity tests much faster.

---

# 6. Why choose `cellSize = SPACING / sqrt(2)`?

This is a geometric trick.

We want a grid small enough that if two points are closer than `SPACING`, they must lie in either:

- the same cell, or
- one of the neighboring cells

A square cell of side `SPACING / sqrt(2)` has diagonal length:

```js
diag = cellSize * sqrt(2) = SPACING
```

So no cell is “wider” than the minimum distance threshold.

That means checking the 3×3 block of neighboring cells around a point is enough.

This is what makes the neighbor search local and safe.

---

# 7. Grid indexing

```js
function gridIndex(cx, cy) {
  return cy * gridW + cx;
}
```

This converts a 2D cell coordinate `(cx, cy)` into a 1D array index.

Because `grid` is stored as a flat array.

---

# 8. Bounds checking

```js
function inBounds(x, y) {
  return x >= 0 && x < canvas.width && y >= 0 && y < canvas.height;
}
```

A streamline stops if it exits the canvas.

---

# 9. Adding accepted points to the grid

```js
function addPointToGrid(x, y) {
  const cx = Math.floor(x / cellSize);
  const cy = Math.floor(y / cellSize);
  if (cx < 0 || cy < 0 || cx >= gridW || cy >= gridH) return;
  grid[gridIndex(cx, cy)].push({ x, y });
}
```

Once a line is accepted, all its points are inserted into the grid.

This means future lines will avoid them.

Important: points are only added **after** the line is accepted, not while testing it.

So failed candidate lines do not contaminate the occupancy structure.

---

# 10. Distance testing: `isFarEnough`

```js
function isFarEnough(x, y, minDist = SPACING) {
  const cx = Math.floor(x / cellSize);
  const cy = Math.floor(y / cellSize);
  const r2 = minDist * minDist;

  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const nx = cx + ox;
      const ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
      const cell = grid[gridIndex(nx, ny)];
      for (let i = 0; i < cell.length; i++) {
        const p = cell[i];
        const dx = p.x - x;
        const dy = p.y - y;
        if (dx * dx + dy * dy < r2) return false;
      }
    }
  }
  return true;
}
```

This function asks:

> “Is this point at least `minDist` away from all previously accepted line points?”

It does this by:

1. finding which grid cell `(x, y)` belongs to
2. checking that cell and its 8 neighbors
3. computing squared Euclidean distance to points in those cells
4. rejecting if any are too close

### Why squared distance?

Instead of:

```js
Math.sqrt(dx * dx + dy * dy) < minDist;
```

it uses:

```js
dx * dx + dy * dy < minDist * minDist;
```

This avoids `sqrt`, which is faster.

---

# 11. Tracing a streamline

The streamline follows the field step by step.

```js
function trace(x0, y0, dir) {
  const pts = [];
  let x = x0,
    y = y0;

  for (let i = 0; i < MAX_STEPS; i++) {
    const a = fieldAngle(x, y) + (dir < 0 ? Math.PI : 0);
    const nx = x + Math.cos(a) * STEP;
    const ny = y + Math.sin(a) * STEP;

    if (!inBounds(nx, ny)) break;

    if (i > 2 && !isFarEnough(nx, ny, SPACING * 0.9)) break;

    pts.push({ x: nx, y: ny });
    x = nx;
    y = ny;
  }
  return pts;
}
```

---

## What `dir` means

- `dir = +1` → trace forward
- `dir = -1` → trace backward

To go backward, the angle is flipped by `π` radians:

```js
a = fieldAngle(x, y) + Math.PI;
```

Since adding π reverses a direction vector.

So from one seed point, we grow the line in both directions.

This gives a complete streamline passing through the seed.

---

## Step-by-step integration

At each iteration:

1. read field angle at current point
2. convert angle into movement vector
3. move by `STEP`
4. test if the new point is valid
5. if valid, append it
6. continue from the new point

This is a simple numerical integration scheme, basically **Euler integration**.

---

# 12. Why stop if too close to an existing line?

This is the core spacing rule.

```js
if (i > 2 && !isFarEnough(nx, ny, SPACING * 0.9)) break;
```

The line stops growing when it would enter another line’s territory.

That ensures lines “pack” beside each other instead of crossing or clustering.

---

## Why `i > 2`?

The first few steps are exempt.

Why?

Because the streamline begins at the seed point, and near the seed the geometry can be delicate.  
If we enforced spacing immediately, tiny numerical issues might kill the line too early.

So we allow the first few steps to establish the line.

---

## Why `SPACING * 0.9` instead of exactly `SPACING`?

This is a tolerance trick.

Using slightly less than the target spacing:

- prevents overly aggressive stopping
- makes filling more robust
- allows lines to get close without leaving too many gaps

Exact geometric constraints often produce more visible holes.

---

# 13. Building one complete streamline

```js
function makeStreamline(x, y) {
  if (!isFarEnough(x, y, SPACING)) return null;

  const back = trace(x, y, -1).reverse();
  const fwd = trace(x, y, +1);
  const pts = [...back, { x, y }, ...fwd];

  if (pts.length < MIN_LENGTH) return null;

  for (const p of pts) addPointToGrid(p.x, p.y);
  return pts;
}
```

This function attempts to create one full line.

### Step 1: check the seed

If the seed is too close to existing lines, abandon it immediately.

---

### Step 2: trace backward and forward

We generate:

- one half-line going backward
- one half-line going forward

Backward points are reversed so the final point order is continuous.

Without `reverse()`, the points would go outward from the seed in the wrong order.

---

### Step 3: include the seed point

The full line becomes:

```js
[backward... , seed, forward...]
```

---

### Step 4: reject short lines

If the line is too short, it is probably just a fragment squeezed into a tiny gap.

Rejecting those helps keep the result visually cleaner.

---

### Step 5: commit it

Only now do we add its points to the occupancy grid.

That means:

- accepted lines influence future lines
- rejected candidate lines do not

This separation is very important.

---

# 14. Drawing the streamline

```js
function drawLine(pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.stroke();
}
```

This simply connects the traced points into one polyline.

The visual smoothness depends on:

- smoothness of `fieldAngle`
- small enough `STEP`

---

# 15. The outer generation loop

```js
for (let i = 0; i < SEED_TRIES; i++) {
  const x = Math.random() * canvas.width;
  const y = Math.random() * canvas.height;
  const line = makeStreamline(x, y);
  if (line) drawLine(line);
}
```

This is a “dart throwing” approach:

- throw random seeds at the canvas
- keep only seeds that fit
- each accepted line occupies space
- over time, open space becomes rarer
- eventually almost all new random seeds fail

That naturally fills the canvas with approximately evenly spaced streamlines.

---

# 16. Why does this look evenly distributed?

Because each accepted line creates an exclusion zone around itself.

New lines can only appear in remaining empty corridors.

So the process is self-balancing:

- sparse regions are more likely to accept new seeds
- crowded regions reject them

This is similar in spirit to **Poisson disk sampling**, except here we are placing **curves**, not isolated points.

---

# 17. Important limitation: point-to-point spacing is an approximation

The current code stores **sampled points** from accepted lines, not true line segments.

So spacing is enforced approximately.

That means:

- if `STEP` is small, the approximation is good
- if `STEP` is too large, lines may slip closer than intended between sample points

For many artworks, point sampling is sufficient.

A more precise version would test distance to actual line segments, which is more expensive.

---

# 18. Why this works visually even though it is approximate

Because:

- lines are sampled frequently
- the spacing threshold is fairly large compared to the step
- the eye reads the overall density, not exact geometry

So this lightweight approximation gives a good visual result at a much lower cost.

---

# 19. What determines the final style?

Several things:

## A. the flow field function

This controls:

- curvature
- direction changes
- whether motion is smooth or chaotic

A slowly varying field gives long elegant arcs.  
A noisy field gives turbulence.

---

## B. spacing

Controls stripe density.

---

## C. line width

If line width is close to spacing, the result becomes almost solid bands.  
If much thinner, it looks airy.

---

## D. minimum length

Higher `MIN_LENGTH` removes tiny clutter.

---

## E. seed strategy

Random seeds produce organic coverage.  
A grid-based or adaptive seed strategy would produce different structure.
