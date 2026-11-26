// shots.js — deterministic scenes for the entry's screenshots.
// The game reads ?shot=<name>&seed=<n> and freezes in a composed moment of
// real play: takeoff, the hero ring run, the parcel drop, the debrief.
// Nothing here draws anything the game itself would not draw; it only
// places the plane, the parcel and the score where a good sortie puts them.

import { RUNWAY } from './config.js';

export function setupShot(name, world, plane, mission) {
  switch (name) {
    case 'start':
      return 'title';

    case 'takeoff': {
      Object.assign(plane, {
        x: RUNWAY.x, y: 2.5, z: 1130, heading: 0, pitch: 0.16, roll: 0.02,
        speed: 30, throttle: 0.92, fuel: 97, airborne: true, elapsed: 6,
      });
      mission.banner = 'Wheels up. The valley opens ahead — chase the gold ring.';
      mission.bannerT = 99;
      return 'flying';
    }

    case 'hero': {
      Object.assign(plane, {
        x: 8, y: 130, z: -170, heading: 0.12, pitch: 0.02, roll: 0.3,
        speed: 41, throttle: 0.72, fuel: 74, airborne: true, elapsed: 78,
      });
      world.rings[0].passed = true;
      world.rings[1].passed = true;
      mission.ringIndex = 2;
      mission.ringsPassed = 2;
      mission.ringScore = 512;
      mission.banner = 'Ring 3 ahead — dead centre pays best.';
      mission.bannerT = 99;
      return 'flying';
    }

    case 'drop': {
      Object.assign(plane, {
        x: 420, y: 168, z: -235, heading: 0.96, pitch: -0.04, roll: 0.12,
        speed: 44, throttle: 0.5, fuel: 41, airborne: true, elapsed: 154,
      });
      for (const r of world.rings) r.passed = true;
      mission.phase = 'drop';
      mission.ringIndex = world.rings.length;
      mission.ringsPassed = 8;
      mission.ringScore = 1715;
      mission.parcelDropped = true;
      mission.parcel = { x: 598, y: 64, z: -352, vx: 20, vy: -18, vz: -8 };
      mission.banner = 'Parcel away — falling for the pad.';
      mission.bannerT = 99;
      return 'flying';
    }

    case 'end': {
      Object.assign(plane, {
        x: RUNWAY.x, y: 0, z: 905, heading: 0, pitch: 0, roll: 0,
        speed: 0, throttle: 0, fuel: 22, landed: true, elapsed: 236,
        touchdown: { quality: 'smooth', sink: 1.8, speed: 38 },
      });
      for (let i = 0; i < world.rings.length; i++) {
        if (i === 5) world.rings[i].missed = true;
        else world.rings[i].passed = true;
      }
      Object.assign(mission, {
        phase: 'done',
        finished: true,
        bannerT: 0,
        ringsPassed: 7,
        ringScore: 1610,
        dropScore: 500,
        dropDistance: 9,
        landingScore: 400,
        fuelBonus: 132,
        timeBonus: 84,
        totalScore: 2726,
        grade: 'S',
      });
      return 'ended';
    }

    default:
      return null;
  }
}
