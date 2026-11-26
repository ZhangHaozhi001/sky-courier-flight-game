// missions.js — one sortie of Sky Courier, in three errands:
//   1. Thread the eight valley rings, in order, as neatly as you can.
//   2. Drop the mail parcel onto the village supply pad.
//   3. Come home and put her back on the strip in one piece.
// Each errand scores on its own; fuel left and time under par pay a bonus,
// so the throttle is a decision, not a detail.

import { DROP, RINGS, RUNWAY, SCORING } from './config.js';

export function createMission(world) {
  return {
    phase: 'rings', // rings -> drop -> land -> done
    ringIndex: 0,
    ringsPassed: 0,
    ringScore: 0,
    ringNotes: [],
    parcel: null, // { x, y, z, vx, vy, vz } while it falls
    parcelDropped: false,
    dropScore: 0,
    dropDistance: null,
    finished: false,
    totalScore: 0,
    grade: '',
    banner: 'Thread the rings: follow the gold hoop, eight in all.',
    bannerT: 6,
    prevPos: null,
  };
}

// The point the HUD arrow and the objective line should point at right now.
export function currentTarget(m, plane) {
  if (m.phase === 'rings') {
    const r = m.world ? m.world.rings[m.ringIndex] : null;
    return r ? { x: r.x, y: r.y, z: r.z, label: `Ring ${m.ringIndex + 1} of ${RINGS.count}` } : null;
  }
  if (m.phase === 'drop') return { x: DROP.x, y: 60, z: DROP.z, label: 'The supply pad — Space drops the parcel' };
  if (m.phase === 'land') return { x: RUNWAY.x, y: 0, z: (RUNWAY.zNear + RUNWAY.zFar) / 2, label: 'Home strip — land gently, under 46 m/s' };
  return null;
}

export function dropParcel(m, plane, events) {
  if (m.parcelDropped || !plane.airborne || plane.crashed) return;
  m.parcelDropped = true;
  const fx = Math.sin(plane.heading) * Math.cos(plane.pitch) * plane.speed;
  const fz = -Math.cos(plane.heading) * Math.cos(plane.pitch) * plane.speed;
  m.parcel = {
    x: plane.x,
    y: plane.y - 2,
    z: plane.z,
    vx: fx,
    vy: Math.sin(plane.pitch) * plane.speed - 1,
    vz: fz,
  };
  events.push('parcel-away');
}

export function updateMission(m, world, plane, dt, events) {
  m.world = world;
  if (m.bannerT > 0) m.bannerT -= dt;
  const prev = m.prevPos;
  m.prevPos = { x: plane.x, y: plane.y, z: plane.z };
  if (!plane.airborne && !plane.landed) return;
  if (plane.crashed || m.finished) return;

  // --- errand 1: the rings --------------------------------------------------
  if (m.phase === 'rings' && prev) {
    const ring = world.rings[m.ringIndex];
    if (ring) {
      const sidePrev = (prev.x - ring.x) * ring.nx + (prev.z - ring.z) * ring.nz;
      const sideNow = (plane.x - ring.x) * ring.nx + (plane.z - ring.z) * ring.nz;
      if (sidePrev !== 0 && Math.sign(sidePrev) !== Math.sign(sideNow)) {
        // crossed the ring's plane this step: how close to the middle?
        const du = (plane.x - ring.x) * ring.ux + (plane.z - ring.z) * ring.uz;
        const dy = plane.y - ring.y;
        const radial = Math.hypot(du, dy);
        if (radial <= RINGS.radius) {
          const centred = 1 - radial / RINGS.radius;
          const gained = Math.round(RINGS.scoreEdge + (RINGS.scoreCentre - RINGS.scoreEdge) * centred);
          ring.passed = true;
          m.ringsPassed++;
          m.ringScore += gained;
          m.ringNotes.push(centred > 0.66 ? 'dead centre' : centred > 0.33 ? 'clean' : 'clipped the edge');
          events.push('ring');
          setBanner(m, centred > 0.66 ? `Ring ${m.ringIndex + 1}: dead centre! +${gained}` : `Ring ${m.ringIndex + 1} threaded. +${gained}`);
        } else {
          ring.missed = true;
          events.push('ring-miss');
          setBanner(m, `Ring ${m.ringIndex + 1} slipped past you. The course moves on.`);
        }
        m.ringIndex++;
        if (m.ringIndex >= world.rings.length) {
          m.phase = 'drop';
          setBanner(m, 'Course flown. Now the parcel: the red pad east of the river, Space to drop.');
        }
      }
    }
  }

  // if the parcel went early (during the rings), the drop errand is already
  // done by the time the course is: move straight on to the landing
  if (m.phase === 'drop' && m.parcelDropped && !m.parcel) m.phase = 'land';

  // --- errand 2: the falling parcel -------------------------------------------
  if (m.parcel) {
    const p = m.parcel;
    p.vy -= 22 * dt; // parcels fall faster than planes should
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    if (p.y <= 0) {
      p.y = 0;
      const dist = Math.hypot(p.x - DROP.x, p.z - DROP.z);
      m.dropDistance = dist;
      if (dist <= DROP.padRadius) m.dropScore = DROP.scorePerfect;
      else if (dist <= 60) m.dropScore = DROP.scoreNear;
      else if (dist <= 120) m.dropScore = DROP.scoreFar;
      else m.dropScore = 0;
      events.push(m.dropScore > 0 ? 'parcel-good' : 'parcel-bad');
      setBanner(
        m,
        m.dropScore === DROP.scorePerfect
          ? `Bullseye on the pad, ${Math.round(dist)} m out. The village cheers.`
          : m.dropScore > 0
            ? `Parcel down ${Math.round(dist)} m from the pad. Close enough to fetch.`
            : `Parcel lost in the fields, ${Math.round(dist)} m off. It will be a long walk.`,
      );
      m.parcel = null;
      if (m.phase === 'drop') {
        m.phase = 'land';
      } else if (m.phase === 'rings') {
        // dropped early: allowed, but the rings still wait
        setBanner(m, 'Parcel away early — bold. The rings still wait.');
      }
    }
  }

  // --- errand 3: the landing ------------------------------------------------------
  if (plane.landed && !m.finished) {
    m.finished = true;
    const t = plane.touchdown;
    const landingScore = t.quality === 'smooth' ? SCORING.landingGood : t.quality === 'fast' ? 250 : SCORING.landingFirm;
    const fuelBonus = Math.round(plane.fuel * SCORING.fuelBonusPerUnit);
    const timeBonus = Math.max(0, Math.round((SCORING.parSeconds - plane.elapsed) * SCORING.timeBonusPerSecond));
    m.landingScore = landingScore;
    m.fuelBonus = fuelBonus;
    m.timeBonus = timeBonus;
    m.totalScore = m.ringScore + m.dropScore + landingScore + fuelBonus + timeBonus;
    m.grade = m.totalScore >= 2400 ? 'S' : m.totalScore >= 1950 ? 'A' : m.totalScore >= 1450 ? 'B' : m.totalScore >= 900 ? 'C' : 'D';
    events.push('sortie-complete');
  }
}

function setBanner(m, text) {
  m.banner = text;
  m.bannerT = 5;
}
