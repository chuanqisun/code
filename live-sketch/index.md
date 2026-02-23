# System Design: AI-First Live-Coding Graphics Engine

## 1. Abstract
This document outlines the architecture for a novel live-coding graphics engine designed for visual artists and programmers. The system bridges the gap between strict, deterministic programming and fuzzy, generative AI. By utilizing a continuous-execution environment, a compositional scene graph, and a tagged-template AI bridge, users can "sculpt" visual scenes in real-time—using standard JavaScript for structural scaffolding and natural language for complex math, behaviors, and aesthetics.

---

## 2. Core Principles

### 2.1. Continuous Execution & State Preservation
The world never stops, and time never resets. When a user modifies their code in the REPL, the system does not restart the simulation. Instead, it performs a "hot-swap" of logic and properties. Because behaviors are compiled as differential functions of time (`dt`), changing a behavior (e.g., from "slide right" to "slide left") results in a smooth, continuous change in momentum rather than a jarring teleportation back to an origin point.

### 2.2. Compositional and Hierarchical Hybrid
The engine utilizes a hybrid of an Entity-Component-System (ECS) and a 3D-style Scene Graph. Entities are pure data containers. Relationships are strictly hierarchical (e.g., a dot mounted to a circle). When a parent moves or rotates, the child inherits the transformation matrix automatically, allowing for complex, nested orbital mechanics without complex user-facing math.

### 2.3. Flexible Levels of AI Delegation
The API is "AI-First" but "JS-Native." The user has absolute control over *how much* they delegate to the LLM. The `ai` tag can be used at arbitrary levels of the API:
*   **Macro-level (Fuzzy Objects):** Generating entire property sets (`.set(ai`a glowing sun`)`).
*   **Micro-level (Fuzzy Values):** Generating specific primitive values (`.set({ color: ai`neon pink` })`).
*   **Behavioral-level (Fuzzy Logic):** Generating continuous update functions (`.run(ai`orbit the center`)`).

---

## 3. The Coding Experience (API Design)

The user interacts with the engine via a JavaScript REPL. The API is idempotent and chainable. The `ai` tagged template literal acts as the bridge to the LLM compiler.

### 3.1. The Minimum Demo
Here is how a user builds a complex, continuous scene step-by-step without ever stopping the renderer:

```javascript
// Step 1: "I want a circle"
circle('main')
  .set({ radius: 50, color: 'white' });

// Step 2: "Put a dot on the circle and spin it"
circle('main')
  .set({ radius: 50, color: 'white' })
  .run( ai`spin clockwise steadily` );

dot('tracer')
  .set({ radius: 5, color: 'red' })
  .mount('main') // Hierarchical composition
  .run( ai`sit exactly on the right edge of the parent` );

// Step 3: "The dot leaves a trace and the circle slides"
circle('main')
  .run( ai`spin clockwise and slide to the right continuously` ); // Hot-swapped!

dot('tracer')
  .mount('main')
  .run( ai`sit exactly on the right edge` )
  .trace(); // Built-in engine feature
```

### 3.2. Mixing Strict JS with Fuzzy AI
Because the syntax is valid JavaScript, users can leverage standard programming constructs (loops, math, variables) alongside AI delegation.

```javascript
// Strict JS loop + Fuzzy AI properties and behaviors
for (let i = 0; i < 5; i++) {
    dot(`planet_${i}`)
        .set({ 
            radius: 10 + (i * 5),           // Strict JS math
            color: ai`a random gas giant`,  // Fuzzy AI value
            y: 0
        })
        .mount('sun')                       // Strict hierarchy
        .run( ai`orbit at speed ${5 - i}` );// Fuzzy AI behavior with JS interpolation
}
```

---

## 4. Technical Implementation

To achieve this experience, the system is divided into four main subsystems: The REPL Reconciler, The AI Compiler Pipeline, The Scene Graph, and The Render Loop.

### 4.1. The Idempotent API & Reconciliation (State Management)
To allow users to re-evaluate their code without duplicating objects, the engine uses a React-like reconciliation pattern.

1.  **Tracking:** Every time the REPL evaluates the code, a `touchedIds` Set is cleared.
2.  **Idempotency:** When `circle('id')` is called, the engine checks if `'id'` exists. If yes, it returns the existing entity. If no, it creates it. It then adds `'id'` to `touchedIds`.
3.  **Garbage Collection:** After the code finishes executing, the engine deletes any entity whose ID is *not* in `touchedIds` (meaning the user deleted it from their code).

```javascript
class Engine {
    constructor() {
        this.entities = new Map();
        this.touchedIds = new Set();
    }

    evaluate(userCode) {
        this.touchedIds.clear();
        try {
            eval(userCode); // Executes user's REPL code
        } catch (e) {
            console.error("Syntax Error. Preserving previous state.");
            return;
        }
        // Garbage collect removed entities
        for (let id of this.entities.keys()) {
            if (!this.touchedIds.has(id)) this.entities.delete(id);
        }
    }
}
```

### 4.2. The AI Compiler Pipeline
The `ai` tag does not block the main thread. It returns an **Intent Object**. The API methods (`set`, `run`) detect this object and trigger asynchronous LLM compilation.

**1. The Tag Definition:**
```javascript
window.ai = function(strings, ...values) {
    const prompt = strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '');
    return { __isAiIntent: true, prompt };
};
```

**2. Context-Aware Resolution:**
When an Intent Object is passed to the API, the engine wraps it in a strict System Prompt based on the context, fetches the result, caches it, and hot-swaps it into the live entity.

```javascript
async function resolveAiBehavior(prompt, entity) {
    const cacheKey = `behavior:${prompt}`;
    if (aiCache.has(cacheKey)) {
        entity.behavior = aiCache.get(cacheKey); // Instant load
        return;
    }

    // The System Prompt forces deterministic, differential JS output
    const systemPrompt = `
        You are a compiler. Output ONLY a javascript function: (state, time, dt) => {...}. 
        Update the state based on this intent: "${prompt}". 
        Use 'dt' for continuous movement. Do not use absolute time unless requested.
    `;
    
    const jsCode = await fetchLLM(systemPrompt);
    const compiledFn = eval(jsCode);
    
    aiCache.set(cacheKey, compiledFn);
    entity.behavior = compiledFn; // Hot-swaps into the running loop
}
```

### 4.3. The Scene Graph & Data Structures
Entities hold local transforms (relative to their parent) and world transforms (absolute canvas coordinates). 

```javascript
class Entity {
    constructor(id, type) {
        this.id = id;
        this.type = type;
        this.parent = null;
        
        this.props = { radius: 10, color: 'white' };
        this.local = { x: 0, y: 0, rotation: 0, scale: 1 };
        this.world = { x: 0, y: 0, rotation: 0, scale: 1 };
        
        this.behavior = null; // The compiled AI function
        this.trail = null;
    }
}
```

### 4.4. The Continuous Render Loop
The engine runs a strict 60fps `requestAnimationFrame` loop. It executes in three phases: Logic, Matrix Math, and Rendering.

```javascript
function tick(currentTime) {
    const dt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // Phase 1: Execute Behaviors (Live Logic)
    for (let entity of engine.entities.values()) {
        if (entity.behavior) {
            try {
                // The AI-generated function mutates entity.local
                entity.behavior(entity.local, currentTime, dt);
            } catch (e) {
                console.error(`Behavior error on ${entity.id}`);
                entity.behavior = null; // Disable broken behavior, keep world running
            }
        }
    }

    // Phase 2: Calculate Scene Graph (World Transforms)
    for (let entity of engine.entities.values()) {
        if (entity.parent) {
            let parent = engine.entities.get(entity.parent);
            entity.world = applyTransformMatrix(parent.world, entity.local);
        } else {
            entity.world = { ...entity.local };
        }
        
        // Update trails based on absolute world position
        if (entity.trail) updateTrail(entity); 
    }

    // Phase 3: Render
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let entity of engine.entities.values()) {
        drawEntity(ctx, entity);
    }

    requestAnimationFrame(tick);
}
```

---

## 5. Summary
This architecture provides a robust, crash-resistant environment for live visual coding. By separating the **declarative structure** (handled by standard JavaScript and the Reconciler) from the **mathematical behavior** (handled by the LLM and injected into the continuous loop), the system achieves the holy grail of creative coding: the precision of a programmer combined with the expressive speed of natural language.