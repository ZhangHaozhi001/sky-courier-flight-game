// aircraft.js — the flight model for the courier plane: an honest arcade
// model. Throttle makes speed, speed makes lift, banks make turns, and
// running out of either speed or fuel makes decisions for you. It reports
// what happened each step as events so missions.js and audio.js can react.

import { PLANE, RUNWAY, WORLD } from './config.js';
import { inRiver, obstacleHeightAt } from './world.js';

export function createPlane() {
  return {
    x: RUNWAY.x,
    y: 0,
    z: PLANE.startZ,
    heading: PLANE.startHeading,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: PLANE.fuelCapacity,
    damage: 0,
    airborne: false,
    landed: false,
    crashed: false,
    crashCause: '',
    touchdown: null, // { quality: 'smooth' | 'firm' | 'hard', sink, speed }
    stalling: false,
    engineOut: false,
    elapsed: 0,
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Heading 0 is north (-z); the nose's horizontal direction:
export function forwardVector(heading) {
  return { x: Math.sin(heading), z: -Math.cos(heading) };
}

export function stepPlane(p, input, world, dt) {
  const events = [];
  if (p.crashed || p.landed) return events;
  p.elapsed += dt;

  // --- throttle and engine -------------------------------------------------
  if (input.throttleUp) p.throttle = clamp(p.throttle + PLANE.throttleRate * dt, 0, 1);
  if (input.throttleDown) p.throttle = clamp(p.throttle - PLANE.throttleRate * dt, 0, 1);
  if (p.fuel <= 0) {
    if (!p.engineOut) events.push('engine-out');
    p.engineOut = true;
    p.throttle = 0;
  } else {
    p.fuel = Math.max(0, p.fuel - (0.08 + p.throttle * PLANE.fuelBurn) * dt);
  }

  // --- speed ----------------------------------------------------------------
  const drag = PLANE.dragBase + PLANE.dragQuad * p.speed * p.speed;
  let accel = p.throttle * PLANE.engineAccel - drag;
  if (!p.airborne) accel -= 0.9; // rolling resistance on the grass strip
  if (p.airborne) accel -= Math.sin(p.pitch) * 6.5; // climbing costs speed
  p.speed = clamp(p.speed + accel * dt, 0, PLANE.maxSpeed);

  // --- attitude --------------------------------------------------------------
  const pitchTarget = (input.pitchUp ? PLANE.maxPitch : 0) + (input.pitchDown ? -PLANE.maxPitch * 0.8 : 0);
  const rollTarget = (input.rollRight ? PLANE.maxRoll : 0) + (input.rollLeft ? -PLANE.maxRoll : 0);
  const attitudeRate = p.airborne ? 1 : p.speed / PLANE.takeOffSpeed;
  p.pitch += clamp(pitchTarget - p.pitch, -1, 1) * PLANE.pitchRate * attitudeRate * dt * 1.6;
  // roll authority scales the same way: on the ground the wings barely bite,
  // so the plane cannot lean over while it is still taxiing
  p.roll += clamp(rollTarget - p.roll, -1, 1) * PLANE.rollRate * attitudeRate * dt * 1.5;

  // --- stall: too slow and the nose falls out of the sky ----------------------
  const wasStalling = p.stalling;
  p.stalling = p.airborne && p.speed < PLANE.stallSpeed;
  if (p.stalling && !wasStalling) events.push('stall-start');
  if (!p.stalling && wasStalling) events.push('stall-end');
  if (p.stalling) p.pitch = Math.max(p.pitch - 0.85 * dt, -0.5);

  // --- heading follows the bank ------------------------------------------------
  if (p.airborne) {
    const bite = Math.min(1, p.speed / 18) * (18 / Math.max(p.speed, 18));
    p.heading += Math.sin(p.roll) * PLANE.turnFactor * bite * dt;
  } else if (p.speed > 4) {
    // taxi steering: gentle, from the same keys
    p.heading += (input.rollRight ? 1 : 0) * 0.35 * dt + (input.rollLeft ? -1 : 0) * 0.35 * dt;
  }
  // keep the heading wrapped so long sorties never grow the float
  if (p.heading > Math.PI) p.heading -= Math.PI * 2;
  else if (p.heading < -Math.PI) p.heading += Math.PI * 2;

  // --- motion --------------------------------------------------------------------
  const fwd = forwardVector(p.heading);
  const horizontal = Math.cos(p.pitch) * p.speed;
  let vy = 0;
  if (p.airborne) {
    vy = Math.sin(p.pitch) * p.speed;
    if (p.speed < PLANE.stallSpeed * 1.2) vy -= (PLANE.stallSpeed * 1.2 - p.speed) * 0.5;
    vy -= PLANE.gravitySink * 0.22 * (1 - Math.cos(p.roll)); // a steep bank spills lift
    if (p.y > WORLD.ceiling) vy = Math.min(vy, 0);
  }
  p.x += fwd.x * horizontal * dt;
  p.z += fwd.z * horizontal * dt;
  if (p.airborne) p.y += vy * dt;
  p.vy = vy;

  // keep the valley: turn the world edge into a gentle headwind wall
  const lim = WORLD.size / 2 - 30;
  p.x = clamp(p.x, -lim, lim);
  p.z = clamp(p.z, -lim, lim);

  // --- taking off ------------------------------------------------------------------
  if (!p.airborne && p.speed >= PLANE.takeOffSpeed && p.pitch > 0.1) {
    p.airborne = true;
    p.y = 0.5;
    events.push('takeoff');
  }

  // --- the ground, for better or worse ----------------------------------------------
  if (p.airborne) {
    const obstacle = obstacleHeightAt(world, p.x, p.z);
    const floor = Math.max(0, obstacle);
    if (p.y <= floor) {
      if (inRiver(p.x, p.z) && obstacle === 0) {
        return crash(p, events, 'You put her down in the river. The mail is wet, the plane is wetter.');
      }
      if (obstacle > 0) {
        return crash(p, events, obstacle > 12 ? 'You clipped the pines. Timber is not a landing surface.' : 'You found a rooftop the hard way.');
      }
      const onStrip =
        Math.abs(p.x - RUNWAY.x) <= RUNWAY.width / 2 + 8 && p.z > RUNWAY.zFar - 30 && p.z < RUNWAY.zNear + 30;
      const sink = -vy;
      if (onStrip && sink <= PLANE.hardTouchdownSink && p.speed <= PLANE.safeTouchdownSpeed + 14 && Math.abs(p.roll) < 0.4) {
        p.y = 0;
        p.airborne = false;
        p.landed = true;
        const quality = sink <= PLANE.safeTouchdownSink && p.speed <= PLANE.safeTouchdownSpeed ? 'smooth' : sink <= PLANE.safeTouchdownSink ? 'fast' : 'firm';
        if (quality === 'firm') p.damage = Math.max(p.damage, 45); // the gear took a beating
        if (quality === 'fast') p.damage = Math.max(p.damage, 20); // rolled out long and hot
        p.touchdown = { quality, sink, speed: p.speed };
        events.push('touchdown');
      } else if (onStrip) {
        return crash(p, events, 'You arrived at the runway faster than it could receive you.');
      } else {
        return crash(p, events, sink > 8 ? 'You flew into the ground at speed. The valley keeps the wreck.' : 'You set down in a field and the furrows took the gear off.');
      }
    }
  }
  return events;
}

function crash(p, events, cause) {
  p.crashed = true;
  p.crashCause = cause;
  p.damage = 100;
  p.y = Math.max(0, p.y);
  events.push('crash');
  return events;
}
