// ─── pool.js ─── Ecosystem management ──────────────────────────
// Controls bot population via spawn/retire dynamics.
// Decoupled from Bot class — receives callbacks for spawning and querying.

// ─── Local helpers ──────────────────────────────────────────────
function rand(min, max) {
  return min + Math.random() * (max - min);
}
function chance(p) {
  return Math.random() < p;
}
function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Bot lifecycle constants ────────────────────────────────────
export const MAX_BOTS = 50;
export const INITIAL_BOTS = 4;
export const BOT_LIFETIME_MIN = 14000;
export const BOT_LIFETIME_MAX = 100000;
export const BOT_RETIRE_CHECK_CHANCE = 0.15;

// ─── Ecology loop constants ────────────────────────────────────
export const ECO_TICK_MIN = 200;
export const ECO_TICK_MAX = 800;
export const ECO_SPAWN_BASE = 0.6;
export const ECO_SPAWN_LOW_BOOST = 0.18;
export const ECO_SPAWN_BURST_CHANCE = 0.06;
export const ECO_SPAWN_BURST_BOOST = 0.35;
export const ECO_RETIRE_BASE = 0.04;
export const ECO_RETIRE_HIGH_BOOST = 0.08;
export const ECO_RETIRE_BURST_CHANCE = 0.04;
export const ECO_RETIRE_BURST_BOOST = 0.18;
export const ECO_MASS_SPAWN_CHANCE = 0.03;
export const ECO_MASS_SPAWN_MIN = 1;
export const ECO_MASS_SPAWN_MAX = 4;
export const ECO_MASS_SPAWN_DELAY_MIN = 60;
export const ECO_MASS_SPAWN_DELAY_MAX = 200;

// ─── Ecology loop ───────────────────────────────────────────────
// Callbacks:
//   activeBotCount() → number of non-retiring bots
//   spawnBot()       → create and start a new bot
//   getActiveBots()  → array of non-retiring bot objects (must have .retiring)
export async function ecologyLoop({ activeBotCount, spawnBot, getActiveBots }) {
  while (true) {
    // spawn
    const count = activeBotCount();
    if (count < MAX_BOTS) {
      let p = ECO_SPAWN_BASE;
      if (count <= 2) p += ECO_SPAWN_LOW_BOOST;
      if (chance(ECO_SPAWN_BURST_CHANCE)) p += ECO_SPAWN_BURST_BOOST;
      if (Math.random() < p) spawnBot();
    }

    // retire
    const pool = getActiveBots();
    if (pool.length > 1) {
      let p = ECO_RETIRE_BASE;
      if (pool.length >= 7) p += ECO_RETIRE_HIGH_BOOST;
      if (chance(ECO_RETIRE_BURST_CHANCE)) p += ECO_RETIRE_BURST_BOOST;
      if (Math.random() < p) choice(pool).retiring = true;
    }

    // occasional burst
    if (chance(ECO_MASS_SPAWN_CHANCE) && activeBotCount() < 8) {
      const n = Math.floor(rand(ECO_MASS_SPAWN_MIN, ECO_MASS_SPAWN_MAX + 1));
      for (let i = 0; i < n; i++) {
        if (activeBotCount() < MAX_BOTS) {
          spawnBot();
          await sleep(rand(ECO_MASS_SPAWN_DELAY_MIN, ECO_MASS_SPAWN_DELAY_MAX));
        }
      }
    }

    await sleep(rand(ECO_TICK_MIN, ECO_TICK_MAX));
  }
}
