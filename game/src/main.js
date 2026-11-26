// main.js — Sky Courier: Valley Run. Wires the world, the plane, the
// mission and the sound together and runs the frame loop:
// title -> flying -> debrief, with pause and restart, plus the frozen
// ?shot= scenes the screenshots are taken from.

import { createRenderer } from './render.js';
import { drawAircraft, drawParcel, drawShadow } from './aircraftview.js';
import { drawHud, drawPanel } from './cockpit.js';
import { drawEnd, drawTitle } from './screens.js';
import { buildWorld } from './world.js';
import { createPlane, stepPlane } from './aircraft.js';
import { createMission, currentTarget, dropParcel, updateMission } from './missions.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { setupShot } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = Number.parseInt(params.get('seed') || '20261126', 10);
const shotName = params.get('shot');

const canvas = document.getElementById('game');
const R = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();

let world = buildWorld(seed);
let plane = createPlane();
let mission = createMission(world);
mission.world = world;
let state = 'title'; // title | flying | paused | ended
let endTimer = -1;
let lastStallBeep = 0;
let fanfarePlayed = false;

if (shotName) {
  const mode = setupShot(shotName, world, plane, mission);
  if (mode) state = mode;
}

function reset() {
  world = buildWorld(seed);
  plane = createPlane();
  mission = createMission(world);
  mission.world = world;
  endTimer = -1;
  fanfarePlayed = false;
  state = 'flying';
  audio.unlock();
}

function startFlying() {
  if (state === 'title') {
    state = 'flying';
    audio.unlock();
  }
}

canvas.addEventListener('pointerdown', () => {
  audio.unlock();
  if (state === 'title') startFlying();
});
window.addEventListener('keydown', () => audio.unlock(), { once: true });

function handleEvents(events) {
  for (const e of events) {
    if (e === 'takeoff') audio.takeoff();
    else if (e === 'ring') audio.ring();
    else if (e === 'ring-miss') audio.ringMiss();
    else if (e === 'parcel-away') audio.drop();
    else if (e === 'parcel-good') audio.parcelDown(true);
    else if (e === 'parcel-bad') audio.parcelDown(false);
    else if (e === 'touchdown') {
      audio.touchdown(plane.touchdown && plane.touchdown.quality === 'smooth');
      endTimer = 1.5;
    } else if (e === 'crash') {
      audio.crash();
      audio.stopEngine();
      endTimer = 1.3;
    }
  }
}

function step(dt) {
  const keys = input.read();
  const events = stepPlane(plane, keys, world, dt);
  if (input.pressed('drop')) {
    const dropEvents = [];
    dropParcel(mission, plane, dropEvents);
    events.push(...dropEvents);
  }
  updateMission(mission, world, plane, dt, events);
  handleEvents(events);
  audio.update(plane);
  if (plane.stalling && plane.elapsed - lastStallBeep > 0.45) {
    lastStallBeep = plane.elapsed;
    audio.stallWarning();
  }
  if (endTimer > 0) {
    endTimer -= dt;
    if (endTimer <= 0) {
      state = 'ended';
      if (plane.landed && !fanfarePlayed) {
        fanfarePlayed = true;
        audio.fanfare();
      }
    }
  }
}

function drawScene(time, dt, snapCamera) {
  // on the title card the camera sways gently over the parked plane
  let sway = 0;
  if (state === 'title') {
    sway = Math.sin(time * 0.4) * 0.45;
    plane.heading += sway;
  }
  R.updateCamera(plane, snapCamera ? 0 : dt, snapCamera);
  if (state === 'title') plane.heading -= sway;

  R.drawSky(plane);
  R.drawMountains(world);
  R.drawClouds(world, time);
  R.drawFields(world);
  R.drawRiverAndRoad(world);
  R.drawRunway();
  R.drawPad(world);

  const objects = [
    ...world.trees.map((t) => ({ kind: 'tree', x: t.x, z: t.z, item: t })),
    ...world.houses.map((h) => ({ kind: 'house', x: h.x, z: h.z, item: h })),
  ].sort((a, b) => {
    const da = (a.x - R.cam.x) ** 2 + (a.z - R.cam.z) ** 2;
    const db = (b.x - R.cam.x) ** 2 + (b.z - R.cam.z) ** 2;
    return db - da;
  });
  for (const o of objects) {
    if (o.kind === 'tree') R.drawTree(o.item);
    else R.drawHouse(o.item);
  }

  R.drawRings(world, mission, time);
  drawShadow(R, plane);
  drawParcel(R, mission.parcel);
  drawAircraft(R, plane, time);
  drawPanel(R.ctx, plane, time);

  if (state !== 'title') {
    drawHud(R.ctx, R, { plane, mission, target: currentTarget(mission, plane), time });
  }
  if (state === 'title') drawTitle(R.ctx, time);
  if (state === 'ended') drawEnd(R.ctx, plane, mission);
  if (state === 'paused') {
    R.ctx.fillStyle = 'rgba(7,15,22,0.5)';
    R.ctx.fillRect(0, 0, 1280, 800);
    R.ctx.fillStyle = '#ffffff';
    R.ctx.font = '800 44px system-ui, sans-serif';
    R.ctx.textAlign = 'center';
    R.ctx.fillText('PAUSED', 640, 400);
    R.ctx.font = '600 17px system-ui, sans-serif';
    R.ctx.fillText('P to resume', 640, 436);
    R.ctx.textAlign = 'left';
  }
}

let lastNow = performance.now();
let shotFrames = 0;

function frame(now) {
  const dt = Math.min(0.033, (now - lastNow) / 1000);
  lastNow = now;
  const time = now / 1000;

  if (shotName) {
    // frozen scene: no physics, a fixed clock, a snapped camera
    drawScene(2.35, 0, true);
    shotFrames++;
    if (shotFrames >= 3) window.__shotReady = true;
    requestAnimationFrame(frame);
    return;
  }

  if (input.pressed('confirm')) {
    if (state === 'title') startFlying();
    else if (state === 'ended') reset();
  }
  if (input.pressed('restart') && state !== 'title') reset();
  if (input.pressed('pause') && (state === 'flying' || state === 'paused')) {
    state = state === 'flying' ? 'paused' : 'flying';
  }
  if (input.pressed('mute')) audio.toggleMute();

  if (state === 'flying') step(dt);
  drawScene(time, dt, false);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
