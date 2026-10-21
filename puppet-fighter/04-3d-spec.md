# Technical Specification: 3D Hand-Tracked Marionette Simulator

## 1. Overview & Design Philosophy

A real-time, browser-based 3D marionette simulator controlled by a single hand hovering parallel to the desk over an upward-facing webcam.

To make the puppet feel authentic, responsive, and easy to control without complex Inverse Kinematics (IK) or pre-baked animations, the system uses a **Decoupled "Palm-Crutch" Architecture**:

- **The Palm** acts as the rigid marionette crossbar, bearing the puppet's core weight (Head/Torso) and controlling global position, jumping, and turning.
- **Four Fingers** act as independent string levers that pull the arms and knees via pure ragdoll physics and one-way distance constraints (`RopeJoint`).

---

## 2. Tech Stack & Dependencies

- **Build Tool:** Vite (Vanilla TypeScript or React)
- **Computer Vision:** `@mediapipe/tasks-vision` (`HandLandmarker`)
- **Signal Smoothing:** `1eurofilter` (Eliminates webcam micro-jitter with zero high-speed latency)
- **3D Rendering:** `three` (Three.js)
- **3D Physics Engine:** `@dimforge/rapier3d-compat` (WebAssembly physics engine with native `RopeJoint` and ragdoll joint support)
- **Real-Time Tuning UI:** `lil-gui`

```bash
npm install three @types/three @dimforge/rapier3d-compat @mediapipe/tasks-vision 1eurofilter lil-gui
```

---

## 3. Hardware & Camera Setup

- **Camera Placement:** Placed flat on the desk pointing **bottom-up** (or angled sharply upward) toward the ceiling.
- **Hand Posture:** The user holds their dominant hand flat (palm facing down, parallel to the floor) roughly 15–40 cm above the lens.
- **Benefit:** Zero finger occlusion. All 21 MediaPipe hand landmarks remain continuously visible to the sensor.

---

## 4. Control Mapping (The 5-String Rig)

To prevent "tendon sympathy" (where curling a finger accidentally dips the puppet's head), the puppet's core weight is decoupled from the fingers:

| String #          | Puppet Attachment    | Hand Landmark Source                                              | Primary Action                                                              |
| :---------------- | :------------------- | :---------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| **1 (Core)**      | **Top of Head**      | **Palm Center** (Avg of Wrist `0`, Index MCP `5`, Pinky MCP `17`) | Carries weight, walks across stage, jumps, controls facing direction (yaw). |
| **2 (Left Arm)**  | **Left Wrist/Hand**  | **Thumb Tip** (`4`)                                               | Sweeps outward, waves, claps.                                               |
| **3 (Left Leg)**  | **Left Knee**        | **Index Tip** (`8`)                                               | Lifts left leg to step/walk.                                                |
| **4 (Right Leg)** | **Right Knee**       | **Middle Tip** (`12`)                                             | Lifts right leg to step/walk.                                               |
| **5 (Right Arm)** | **Right Wrist/Hand** | **Pinky Tip** (`20`) _(or Ring `16`)_                             | Lifts right arm, balances spatial mapping.                                  |

---

## 5. Coordinate Transformation & Smoothing Pipeline

MediaPipe outputs two sets of landmarks: `landmarks` (normalized 2D screen space `[0.0 - 1.0]`) and `worldLandmarks` (metric 3D space in meters, centered at the hand's geometric center). **We combine both for maximum stability.**

### Step 1: Signal Smoothing (`1eurofilter`)

Instantiate 15 `OneEuroFilter` instances (X, Y, Z for each of the 5 control points) plus 1 filter for Palm Yaw rotation.

- **Default Filter Config:** `freq = 30`, `mincutoff = 1.0`, `beta = 0.05`, `dcutoff = 1.0`.

### Step 2: Computing the Core Anchor (`P_palm`) in 3D Game Space

1. **Horizontal Stage Position (`X`, `Z`):**
   Use normalized 2D screen coordinates of the Palm Center:
   - `Game_X = (0.5 - Palm.x) * STAGE_WIDTH` _(Mirrored so moving right moves puppet right)_
   - `Game_Z = (Palm.y - 0.5) * STAGE_DEPTH`
2. **Vertical Height / Jumping (`Y`):**
   MediaPipe's raw `Z` depth is noisy. Instead, calculate the **2D Apparent Hand Scale** (Euclidean distance between Wrist `0` and Middle MCP `9` in normalized screen coordinates):
   - `handScale = hypot(L[0].x - L[9].x, L[0].y - L[9].y)`
   - When the hand moves **up** (away from the desk camera), `handScale` decreases.
   - Map `handScale` inversely to `Game_Y`:
     `Game_Y = clamp( remap(handScale, [MIN_SCALE, MAX_SCALE], [MAX_HEIGHT, MIN_HEIGHT]) )`
3. **Facing Direction (`Yaw`):**
   Calculate the 2D angle of the hand in the camera plane:
   - `Palm_Yaw = atan2(L[9].x - L[0].x, L[9].y - L[0].y)`

### Step 3: Computing the 4 Finger Anchors (`P_thumb`, `P_index`, `P_middle`, `P_pinky`)

Use `worldLandmarks` (`WL`) to get the exact local 3D offset of each fingertip relative to the palm, scaled to the puppet's proportions, and add it to `P_palm`:

- `Finger_Game_Pos = P_palm + (WL[Tip] - WL[Palm_Center]) * PUPPET_SCALE`
- _Note on Finger Pull Amplification:_ Multiply the vertical Y-offset `(WL[Tip].y - WL[MCP].y)` by a `PULL_MULTIPLIER` (e.g., `2.5x`) so a comfortable 3 cm finger twitch translates to a dramatic 7.5 cm leg lift in-game.

---

## 6. Physics Architecture (Rapier3D)

### A. The Stage

- Static `RigidBody` floor at `Y = 0` with a high-friction collider (`friction = 1.2`) so the puppet's feet grip the ground when stepping forward.

### B. The 5 Kinematic Hand Anchors

- Create 5 `RigidBodyDesc.kinematicPositionBased()` bodies in Rapier (no colliders needed).
- Every frame, update their positions using `setNextKinematicTranslation()` with the smoothed 3D coordinates from Section 5.

### C. The Puppet Ragdoll (10 Dynamic RigidBodies)

Construct the puppet using simple capsule/box colliders connected by Rapier joints:

| Body Part          | Shape / Size (m)             | Mass  | Damping (Lin / Ang) | Connected To | Joint Type                  |
| :----------------- | :--------------------------- | :---- | :------------------ | :----------- | :-------------------------- |
| **Head**           | Sphere (`r: 0.15`)           | `0.5` | `0.5 / 2.0`         | Torso        | `SphericalJoint` (Neck)     |
| **Torso**          | Capsule (`h: 0.5, r: 0.15`)  | `2.0` | `0.5 / 5.0`         | —            | _(Core Body)_               |
| **Upper Arm (x2)** | Capsule (`h: 0.25, r: 0.05`) | `0.3` | `0.5 / 1.0`         | Torso        | `SphericalJoint` (Shoulder) |
| **Lower Arm (x2)** | Capsule (`h: 0.25, r: 0.04`) | `0.2` | `0.5 / 1.0`         | Upper Arm    | `RevoluteJoint` (Elbow)     |
| **Upper Leg (x2)** | Capsule (`h: 0.3, r: 0.06`)  | `0.6` | `0.5 / 1.0`         | Torso        | `SphericalJoint` (Hip)      |
| **Lower Leg (x2)** | Capsule (`h: 0.3, r: 0.05`)  | `0.8` | `0.5 / 1.0`         | Upper Leg    | `RevoluteJoint` (Knee)      |

- **Crucial Physics Tweak (Heavy Feet):** Give `Lower Leg` a slightly higher mass (`0.8`) than `Upper Leg` (`0.6`). This acts like lead weights in real marionette boots, pulling the legs straight down and ensuring crisp pendulum walking.
- **Torso Yaw Alignment:** Every physics step, gently slerp the Torso's Y-rotation toward `Palm_Yaw` (using angular velocity or a motor) so the puppet doesn't spin uncontrollably on a single head string.

### D. The 5 Strings (`RopeJoint`)

Do not simulate colliding rope segments. Connect each Kinematic Hand Anchor to its target Puppet RigidBody using `RAPIER.JointData.rope(maxLength, localAnchorA, localAnchorB)`:

1. **Core String:** `PalmAnchor` $\rightarrow$ `Head` (Top center, `len: 1.5m`)
2. **Left Arm String:** `ThumbAnchor` $\rightarrow$ `Left Lower Arm` (Wrist, `len: 1.8m`)
3. **Left Leg String:** `IndexAnchor` $\rightarrow$ `Left Upper Leg` (Knee tip, `len: 2.0m`)
4. **Right Leg String:** `MiddleAnchor` $\rightarrow$ `Right Upper Leg` (Knee tip, `len: 2.0m`)
5. **Right Arm String:** `PinkyAnchor` $\rightarrow$ `Right Lower Arm` (Wrist, `len: 1.8m`)

_How `RopeJoint` handles mechanics automatically:_

- When distance $< \text{maxLength}$, tension is `0` (string is slack; limbs drop with gravity; feet rest flat on the floor).
- When distance $\ge \text{maxLength}$, the joint pulls taut immediately, lifting the knee, arm, or jumping the entire body off the floor.

---

## 7. Visual Rendering (Three.js)

1. **Scene & Lighting:**
   - A wooden stage floor with a warm spotlight casting shadows (`castShadow = true` on all puppet meshes) so the player can clearly judge how high the puppet's feet are off the ground.
2. **Puppet Meshes:**
   - Map Three.js wooden-textured `Mesh` objects (Capsules/Spheres) directly to the `translation()` and `rotation()` of the 10 Rapier RigidBodies each frame.
3. **String Rendering:**
   - Create 5 `THREE.Line` objects (2 vertices each).
   - Every frame, update Vertex 0 to the Kinematic Hand Anchor position and Vertex 1 to the world position of the Puppet's attachment point.
   - _Visual Polish:_ If the distance between Vertex 0 and Vertex 1 is less than `maxLength` (slack), change the line opacity from `1.0` to `0.3` to visually indicate slack tension.
4. **Control Plane HUD:**
   - Render 5 small glowing spheres at the top of the stage representing the 5 Kinematic Hand Anchors so the user has immediate visual feedback of where their palm and fingertips are in 3D space.

---

## 8. Implementation Skeleton (`main.ts` Loop)

```typescript
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { OneEuroFilter } from "1eurofilter";

// 1. Initialize Rapier, Three.js, and MediaPipe HandLandmarker (IMAGE or VIDEO mode)
await RAPIER.init();
const world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });

// 2. Main Game Loop
function animate(timestamp: number) {
  requestAnimationFrame(animate);

  // A. Detect Hand from Bottom-Up Webcam
  const results = handLandmarker.detectForVideo(videoElement, timestamp);

  if (results.landmarks.length > 0) {
    const L = results.landmarks[0]; // 2D Normalized
    const WL = results.worldLandmarks[0]; // 3D Metric Local

    // B. Calculate & Smooth Palm Center + Height (from Apparent Hand Size)
    const rawScale = Math.hypot(L[0].x - L[9].x, L[0].y - L[9].y);
    const palmPos = computeSmoothedPalm(L, rawScale, timestamp);
    palmKinematicBody.setNextKinematicTranslation(palmPos);

    // C. Calculate & Smooth 4 Fingertip Anchors
    const fingerIndices = [4, 8, 12, 20]; // Thumb, Index, Middle, Pinky
    fingerIndices.forEach((idx, i) => {
      const fingerPos = computeSmoothedFinger(palmPos, WL[idx], WL[9], i, timestamp);
      fingerKinematicBodies[i].setNextKinematicTranslation(fingerPos);
    });

    // D. Stabilize Torso Yaw to match Hand Rotation
    const targetYaw = filterYaw.filter(Math.atan2(L[9].x - L[0].x, L[9].y - L[0].y), timestamp);
    applyTorsoYawTorque(puppetTorsoBody, targetYaw);
  }

  // E. Step Physics & Sync Three.js Meshes + String Lines
  world.step();
  syncPhysicsToThreeJS();
  renderer.render(scene, camera);
}
```

---

## 9. Tuning Parameters (`lil-gui` Checklist)

Expose these 6 sliders in `lil-gui` during testing to dial in the physical feel:

1. `gravityY`: Default `-9.81` (Increase to `-15.0` if the puppet feels too "floaty" or underwater).
2. `fingerPullMultiplier`: Default `2.5` (Adjusts how high knees lift per cm of finger movement).
3. `handHeightSensitivity`: Calibrates the min/max hand size for jumping vs. standing on the floor.
4. `footMass`: Default `0.8` (Higher keeps legs grounded; lower makes kicking easier).
5. `floorFriction`: Default `1.2` (Crucial for translating alternating knee lifts into forward walking).
6. `filterBeta`: Default `0.05` (Higher = less lag on fast movements; lower = smoother when still).
