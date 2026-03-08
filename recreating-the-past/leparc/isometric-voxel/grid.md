# Isometric Pyramid – External Edges Only

## Problem Analysis

Currently every cube draws its own edges, creating internal grid lines across flat surfaces that should appear as one continuous plane. We need to draw **only** the edges where two surfaces meet at an angle (silhouette/crease edges).

## Solution: Separate Fill Pass from Edge Pass

### Phase 1: Fill all faces (no stroke)

Draw every visible face as a solid white polygon with **no edges** using painter's algorithm. This creates clean, merged surfaces.

### Phase 2: Compute and draw only external edges

An edge is **external** if and only if the two faces sharing it are on **different planes** (different face normals). Concretely:

- An edge shared by two **top** faces → internal (coplanar) → skip
- An edge shared by a **top** face and a **right** face → external → draw
- An edge on the boundary of the shape (only one face) → external → draw

### Edge Detection via Occupancy Grid

Build a 3D boolean grid of which cells contain cubes. For each cube, check each of the 3 visible face's 4 edges. For each edge, determine what other face (if any) shares it. If the neighbor face is coplanar → skip. Otherwise → draw.

#### Neighbor logic for each edge of each face:

For a **Top face** (z+ face) of cube at (x,y,z), the 4 edges connect to:

- North edge → top face of (x, y-1, z) — coplanar, skip if neighbor exists
- South edge → top face of (x, y+1, z) — coplanar, skip if neighbor exists
- East edge → top face of (x+1, y, z) — coplanar, skip if neighbor exists
- West edge → top face of (x-1, y, z) — coplanar, skip if neighbor exists
- But also: south edge is shared with left face of (x, y+1, z) if that exists — that's a different normal → but the coplanar neighbor takes priority visually

**Simpler robust approach:** Collect all edges from all drawn faces into a map keyed by the edge's two projected endpoints (sorted). Each entry stores the set of face normals. After collection, draw only edges where the face-normal set has **more than one unique normal**, or exactly **one face** (boundary).

Actually even simpler: key edges by their **3D coordinates** (pair of 3D points), and track which face-type (top/left/right) contributed each edge. Draw only if the edge has faces of different types, or only one face.
