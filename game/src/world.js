// world.js — builds the valley of Sky Courier from a seed: patchwork fields,
// a river, one road with a bridge, the home runway, a village, pine woods,
// the ring course and the supply pad. Everything is plain data; render.js
// draws it and aircraft.js collides with the trees and houses it lists.

import { COLOURS, DROP, RINGS, RUNWAY, WORLD } from './config.js';
import { makeRng } from './random.js';

// The river wanders down the middle of the valley, west of the village.
export function riverX(z) {
  return 170 * Math.sin(z * 0.0011) + 55 * Math.sin(z * 0.0037 + 1.7) - 120;
}

const RIVER_HALF = 46;
const ROAD_Z = 240;
const ROAD_HALF = 9;

// The ring course: a slalom up the valley and back, low over the fields,
// across the river, past the village and home again. Heights are the ring
// centres; each ring faces the pilot flying the course in order.
const COURSE = [
  { x: -320, y: 95, z: 560 },
  { x: -170, y: 120, z: 40 },
  { x: 40, y: 140, z: -430 },
  { x: 330, y: 115, z: -880 },
  { x: 660, y: 150, z: -1200 },
  { x: 430, y: 105, z: -1640 },
  { x: -40, y: 135, z: -1900 },
  { x: -330, y: 95, z: -1440 },
];

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const half = WORLD.size / 2;

  // --- fields: a patchwork of square plots in valley greens and golds ----
  const fields = [];
  const tile = 300;
  for (let gx = -half; gx < half; gx += tile) {
    for (let gz = -half; gz < half; gz += tile) {
      const roll = rng.next();
      fields.push({
        x0: gx,
        z0: gz,
        x1: gx + tile,
        z1: gz + tile,
        color: roll < 0.12 ? COLOURS.fieldDark : COLOURS.fields[rng.int(0, COLOURS.fields.length - 1)],
        crop: rng.chance(0.4), // some fields carry crop rows
      });
    }
  }

  // --- river segments, sampled along its curve ---------------------------
  const river = [];
  for (let z = -half; z < half; z += 100) {
    river.push({ z0: z, z1: z + 100, x0: riverX(z), x1: riverX(z + 100), half: RIVER_HALF });
  }

  // --- trees: pine woods, kept clear of the strip, river, road and pad ---
  const trees = [];
  let guard = 0;
  while (trees.length < 640 && guard++ < 6000) {
    const x = rng.range(-half + 60, half - 60);
    const z = rng.range(-half + 60, half - 60);
    if (Math.abs(x - RUNWAY.x) < 78 && z > RUNWAY.zFar - 90 && z < RUNWAY.zNear + 130) continue;
    if (Math.abs(x - riverX(z)) < RIVER_HALF + 34) continue;
    if (Math.abs(z - ROAD_Z) < 30) continue;
    if (Math.hypot(x - DROP.x, z - DROP.z) < 90) continue;
    if (Math.hypot(x - 620, z + 60) < 150 && rng.chance(0.7)) continue; // village clearing
    trees.push({ x, z, h: rng.range(13, 25), r: rng.range(4.5, 7.5), dark: rng.chance(0.4) });
  }

  // --- houses: the village east of the river, farms elsewhere ------------
  const houses = [];
  const addHouse = (x, z) => {
    houses.push({
      x,
      z,
      w: rng.range(14, 22),
      d: rng.range(12, 18),
      h: rng.range(6, 9.5),
      rot: rng.range(0, Math.PI),
      wall: COLOURS.houseWall,
      roof: COLOURS.houseRoof,
    });
  };
  for (let i = 0; i < 15; i++) addHouse(620 + rng.range(-120, 120), -60 + rng.range(-110, 110));
  addHouse(RUNWAY.x + 90, RUNWAY.zNear - 40); // the hangar by the strip
  addHouse(RUNWAY.x - 110, RUNWAY.zNear + 30); // the courier office
  for (let i = 0; i < 9; i++) {
    const x = rng.range(-half + 200, half - 200);
    const z = rng.range(-half + 200, half - 200);
    if (Math.abs(x - riverX(z)) < 120) continue;
    addHouse(x, z);
  }

  // --- mountains ringing the valley ---------------------------------------
  const mountains = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rng.range(-0.08, 0.08);
    mountains.push({
      x: Math.cos(a) * rng.range(2950, 3550),
      z: Math.sin(a) * rng.range(2950, 3550),
      h: rng.range(280, 560),
      r: rng.range(420, 760),
    });
  }

  // --- clouds --------------------------------------------------------------
  const clouds = [];
  for (let i = 0; i < 42; i++) {
    clouds.push({
      x: rng.range(-half, half),
      z: rng.range(-half, half),
      y: rng.range(250, 390),
      r: rng.range(45, 110),
    });
  }

  // --- the ring course, each ring facing the line of flight ----------------
  const rings = COURSE.slice(0, RINGS.count).map((p, i) => {
    const prev = COURSE[Math.max(0, i - 1)];
    const next = COURSE[Math.min(COURSE.length - 1, i + 1)];
    let nx = next.x - prev.x;
    let nz = next.z - prev.z;
    const len = Math.hypot(nx, nz) || 1;
    nx /= len;
    nz /= len;
    // two in-plane axes for drawing the circle
    const ux = -nz;
    const uz = nx;
    return { ...p, nx, nz, ux, uz, index: i, passed: false, missed: false };
  });

  return {
    fields,
    river,
    road: { z: ROAD_Z, half: ROAD_HALF },
    trees,
    houses,
    mountains,
    clouds,
    rings,
    pad: { x: DROP.x, z: DROP.z, r: DROP.padRadius },
    windsock: { x: RUNWAY.x + 40, z: RUNWAY.zNear - 90 },
  };
}

// Is a point inside the river's water? Used for splash-downs.
export function inRiver(x, z) {
  return Math.abs(x - riverX(z)) < RIVER_HALF - 4;
}

// The tallest obstacle at a point, for collision: trees and house roofs.
export function obstacleHeightAt(world, x, z) {
  let top = 0;
  for (const t of world.trees) {
    if (Math.abs(t.x - x) < t.r && Math.abs(t.z - z) < t.r) top = Math.max(top, t.h);
  }
  for (const h of world.houses) {
    if (Math.abs(h.x - x) < h.w / 2 + 2 && Math.abs(h.z - z) < h.d / 2 + 2) top = Math.max(top, h.h + 3);
  }
  return top;
}
