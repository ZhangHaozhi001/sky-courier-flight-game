// render.js — draws Sky Courier on a 2D canvas with a hand-rolled 3D
// projection: chase camera, painter's-order polygons clipped at the near
// plane, a vector-drawn aircraft, and a lit cockpit panel. No images,
// no fonts, nothing fetched: every pixel is drawn from the world data.

import { CAMERA, COLOURS, RINGS, RUNWAY } from './config.js';
import { forwardVector } from './aircraft.js';
import { riverX } from './world.js';

export const VIEW_W = 1280;
export const VIEW_H = 800;

const NEAR = 1.4;

export function createRenderer(canvas) {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext('2d');
  const cam = { x: 0, y: 30, z: 1700, init: false };
  let basis = null; // {fx,fy,fz, rx,ry,rz, ux,uy,uz, cx,cy,cz, f}

  // ---- camera --------------------------------------------------------------
  function updateCamera(plane, dt, snap = false) {
    const fwd = forwardVector(plane.heading);
    const idealX = plane.x - fwd.x * CAMERA.backDistance;
    const idealZ = plane.z - fwd.z * CAMERA.backDistance;
    const idealY = Math.max(2.2, plane.y + CAMERA.upDistance);
    if (!cam.init || snap) {
      cam.x = idealX;
      cam.y = idealY;
      cam.z = idealZ;
      cam.init = true;
    } else {
      const k = 1 - Math.exp(-CAMERA.smoothing * dt);
      cam.x += (idealX - cam.x) * k;
      cam.y += (idealY - cam.y) * k;
      cam.z += (idealZ - cam.z) * k;
    }
    // look ahead of the nose, a touch above the plane
    const lookX = plane.x + fwd.x * CAMERA.lookAhead;
    const lookZ = plane.z + fwd.z * CAMERA.lookAhead;
    const lookY = plane.y + 2.2 + Math.sin(plane.pitch) * 18;
    let fx = lookX - cam.x;
    let fy = lookY - cam.y;
    let fz = lookZ - cam.z;
    const fl = Math.hypot(fx, fy, fz) || 1;
    fx /= fl;
    fy /= fl;
    fz /= fl;
    // right = forward x world-up, normalised; up completes the frame
    let rx = -fz;
    let rz = fx;
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl;
    rz /= rl;
    // up = right x forward, with right = (rx, 0, rz)
    const upx = 0 * fz - rz * fy;
    const upy = rz * fx - rx * fz;
    const upz = rx * fy - 0 * fx;
    basis = {
      fx, fy, fz,
      rx, ry: 0, rz,
      ux: upx, uy: upy, uz: upz,
      cx: cam.x, cy: cam.y, cz: cam.z,
      f: VIEW_H / 2 / Math.tan((CAMERA.fovDeg * Math.PI) / 360),
    };
    return basis;
  }

  // world point -> camera space {x right, y up, z forward}
  function toCam(x, y, z) {
    const dx = x - basis.cx;
    const dy = y - basis.cy;
    const dz = z - basis.cz;
    return {
      x: dx * basis.rx + dy * basis.ry + dz * basis.rz,
      y: dx * basis.ux + dy * basis.uy + dz * basis.uz,
      z: dx * basis.fx + dy * basis.fy + dz * basis.fz,
    };
  }

  function project(c) {
    return { x: VIEW_W / 2 + (c.x * basis.f) / c.z, y: VIEW_H / 2 - (c.y * basis.f) / c.z, z: c.z };
  }

  // clip a camera-space polygon against the near plane, then draw it
  function drawPoly(points, fill, stroke = null, width = 1) {
    const clipped = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (a.z >= NEAR) clipped.push(a);
      if ((a.z >= NEAR) !== (b.z >= NEAR)) {
        const t = (NEAR - a.z) / (b.z - a.z);
        clipped.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR });
      }
    }
    if (clipped.length < 3) return;
    ctx.beginPath();
    clipped.forEach((c, i) => {
      const s = project(c);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  const quad = (corners, fill, stroke, width) => drawPoly(corners.map(([x, y, z]) => toCam(x, y, z)), fill, stroke, width);
  const dist2 = (x, z) => (x - cam.x) * (x - cam.x) + (z - cam.z) * (z - cam.z);

  // ---- sky, sun, mountains, clouds ------------------------------------------
  function drawSky(plane) {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, COLOURS.skyTop);
    grad.addColorStop(0.45, COLOURS.skyMid);
    grad.addColorStop(0.72, COLOURS.skyLow);
    grad.addColorStop(1, COLOURS.skyLow);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // the sun: a fixed direction, high in the south-east
    const sunDir = { x: 0.45, y: 0.62, z: 0.64 };
    const sc = {
      x: sunDir.x * basis.rx + sunDir.z * basis.rz,
      y: sunDir.x * basis.ux + sunDir.y * basis.uy + sunDir.z * basis.uz,
      z: sunDir.x * basis.fx + sunDir.y * basis.fy + sunDir.z * basis.fz,
    };
    if (sc.z > 0.05) {
      const sx = VIEW_W / 2 + (sc.x * basis.f) / sc.z;
      const sy = VIEW_H / 2 - (sc.y * basis.f) / sc.z;
      const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 130);
      glow.addColorStop(0, 'rgba(255,243,196,0.95)');
      glow.addColorStop(0.25, 'rgba(255,243,196,0.45)');
      glow.addColorStop(1, 'rgba(255,243,196,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sx - 140, sy - 140, 280, 280);
      ctx.fillStyle = COLOURS.sun;
      ctx.beginPath();
      ctx.arc(sx, sy, 17, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMountains(world) {
    const peaks = [...world.mountains].sort((a, b) => dist2(b.x, b.z) - dist2(a.x, a.z));
    for (const m of peaks) {
      const base = toCam(m.x, 0, m.z);
      if (base.z < NEAR) continue;
      // billboard the base corners on the camera's right vector, so a peak
      // reads as a peak from every heading and never as an edge-on spike
      const rx = basis.rx;
      const rz = basis.rz;
      const L = [m.x - rx * m.r, -10, m.z - rz * m.r];
      const Rr = [m.x + rx * m.r, -10, m.z + rz * m.r];
      const apex = [m.x, m.h, m.z];
      drawPoly([toCam(...L), toCam(...Rr), toCam(...apex)], COLOURS.mountainFar);
      // a darker shade face on one flank
      const mid = [m.x + rx * m.r * 0.06, -10, m.z + rz * m.r * 0.06];
      drawPoly([toCam(...mid), toCam(...Rr), toCam(...apex)], COLOURS.mountain);
      // snow cap
      const capY = m.h * 0.78;
      const capL = [m.x - rx * m.r * 0.2, capY, m.z - rz * m.r * 0.2];
      const capR = [m.x + rx * m.r * 0.2, capY, m.z + rz * m.r * 0.2];
      drawPoly([toCam(...capL), toCam(...capR), toCam(...apex)], 'rgba(245,249,252,0.9)');
    }
  }

  function drawClouds(world, time) {
    const sorted = [...world.clouds].sort((a, b) => dist2(b.x, b.z) - dist2(a.x, a.z));
    for (const c of sorted) {
      const drift = Math.sin(time * 0.01 + c.x) * 6;
      const centre = toCam(c.x + drift, c.y, c.z);
      if (centre.z < NEAR || centre.z > 3200) continue;
      const s = project(centre);
      const r = (c.r * basis.f) / centre.z;
      if (r < 3) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (const [ox, oy, orr] of [[0, 0, 1], [-0.7, 0.12, 0.66], [0.7, 0.1, 0.7], [0.1, -0.22, 0.6]]) {
        ctx.beginPath();
        ctx.ellipse(s.x + ox * r, s.y + oy * r * 0.5, r * orr, r * orr * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ---- terrain ----------------------------------------------------------------
  function drawFields(world) {
    const visible = world.fields
      .map((f) => ({ f, d: dist2((f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2) }))
      .filter(({ d }) => d < 2900 * 2900)
      .sort((a, b) => b.d - a.d);
    for (const { f } of visible) {
      quad(
        [
          [f.x0, 0, f.z0],
          [f.x1, 0, f.z0],
          [f.x1, 0, f.z1],
          [f.x0, 0, f.z1],
        ],
        f.color,
      );
      if (f.crop) {
        // crop rows: three darker lines across the plot
        ctx.save();
        ctx.globalAlpha = 0.16;
        for (const t of [0.3, 0.55, 0.8]) {
          const z = f.z0 + (f.z1 - f.z0) * t;
          quad(
            [
              [f.x0 + 6, 0.1, z - 3],
              [f.x1 - 6, 0.1, z - 3],
              [f.x1 - 6, 0.1, z + 3],
              [f.x0 + 6, 0.1, z + 3],
            ],
            '#3d6125',
          );
        }
        ctx.restore();
      }
    }
  }

  function drawRiverAndRoad(world) {
    for (const seg of world.river) {
      quad(
        [
          [seg.x0 - seg.half - 9, 0.05, seg.z0],
          [seg.x0 + seg.half + 9, 0.05, seg.z0],
          [seg.x1 + seg.half + 9, 0.05, seg.z1],
          [seg.x1 - seg.half - 9, 0.05, seg.z1],
        ],
        COLOURS.riverBank,
      );
      quad(
        [
          [seg.x0 - seg.half, 0.12, seg.z0],
          [seg.x0 + seg.half, 0.12, seg.z0],
          [seg.x1 + seg.half, 0.12, seg.z1],
          [seg.x1 - seg.half, 0.12, seg.z1],
        ],
        COLOURS.river,
      );
    }
    const half = world.road.half;
    const roadZ = world.road.z;
    quad(
      [
        [-2100, 0.15, roadZ - half],
        [2100, 0.15, roadZ - half],
        [2100, 0.15, roadZ + half],
        [-2100, 0.15, roadZ + half],
      ],
      COLOURS.road,
    );
    // the bridge where the road crosses the river
    const bx = riverX(roadZ);
    quad(
      [
        [bx - 70, 0.5, roadZ - half - 2],
        [bx + 70, 0.5, roadZ - half - 2],
        [bx + 70, 0.5, roadZ + half + 2],
        [bx - 70, 0.5, roadZ + half + 2],
      ],
      '#7a7264',
    );
  }

  function drawRunway() {
    const w = RUNWAY.width / 2;
    quad(
      [
        [RUNWAY.x - w, 0.18, RUNWAY.zFar],
        [RUNWAY.x + w, 0.18, RUNWAY.zFar],
        [RUNWAY.x + w, 0.18, RUNWAY.zNear],
        [RUNWAY.x - w, 0.18, RUNWAY.zNear],
      ],
      COLOURS.runway,
    );
    // centreline dashes
    for (let z = RUNWAY.zFar + 30; z < RUNWAY.zNear - 20; z += 55) {
      quad(
        [
          [RUNWAY.x - 1.4, 0.26, z],
          [RUNWAY.x + 1.4, 0.26, z],
          [RUNWAY.x + 1.4, 0.26, z + 26],
          [RUNWAY.x - 1.4, 0.26, z + 26],
        ],
        COLOURS.runwayEdge,
      );
    }
    // threshold bars at both ends
    for (const zEnd of [RUNWAY.zFar + 8, RUNWAY.zNear - 8]) {
      quad(
        [
          [RUNWAY.x - w + 4, 0.26, zEnd - 3],
          [RUNWAY.x + w - 4, 0.26, zEnd - 3],
          [RUNWAY.x + w - 4, 0.26, zEnd + 3],
          [RUNWAY.x - w + 4, 0.26, zEnd + 3],
        ],
        COLOURS.runwayEdge,
      );
    }
  }

  function drawPad(world) {
    const { x, z, r } = world.pad;
    const disc = [];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      disc.push([x + Math.cos(a) * r, 0.22, z + Math.sin(a) * r]);
    }
    drawPoly(disc.map((p) => toCam(p[0], p[1], p[2])), COLOURS.pad);
    const inner = [];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      inner.push([x + Math.cos(a) * r * 0.55, 0.3, z + Math.sin(a) * r * 0.55]);
    }
    drawPoly(inner.map((p) => toCam(p[0], p[1], p[2])), COLOURS.padRing);
    const core = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      core.push([x + Math.cos(a) * r * 0.3, 0.36, z + Math.sin(a) * r * 0.3]);
    }
    drawPoly(core.map((p) => toCam(p[0], p[1], p[2])), COLOURS.pad);
  }

  // ---- trees and houses ---------------------------------------------------------
  function drawTree(t) {
    const base = toCam(t.x, 0, t.z);
    if (base.z < NEAR || base.z > 2400) return;
    const top = project(toCam(t.x, t.h, t.z));
    const b = project(base);
    const wdt = (t.r * basis.f) / base.z;
    ctx.strokeStyle = COLOURS.trunk;
    ctx.lineWidth = Math.max(1, wdt * 0.12);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x, b.y - (b.y - top.y) * 0.3);
    ctx.stroke();
    ctx.fillStyle = t.dark ? COLOURS.treeDark : COLOURS.tree;
    for (const [cy, cw] of [[0.45, 1], [0.68, 0.72], [0.9, 0.44]]) {
      const yBase = b.y - (b.y - top.y) * (cy - 0.22);
      const yTop = b.y - (b.y - top.y) * (cy + 0.24);
      const half = (wdt * cw) / 2;
      ctx.beginPath();
      ctx.moveTo(b.x - half, yBase);
      ctx.lineTo(b.x + half, yBase);
      ctx.lineTo(b.x, yTop);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawHouse(h) {
    const c = toCam(h.x, 0, h.z);
    if (c.z < NEAR || c.z > 2400) return;
    const cs = Math.cos(h.rot);
    const sn = Math.sin(h.rot);
    const corner = (lx, lz, y) => [h.x + lx * cs - lz * sn, y, h.z + lx * sn + lz * cs];
    const hw = h.w / 2;
    const hd = h.d / 2;
    const gable = h.h + 3.2;
    // two walls and the roof, enough to read as a house from the air
    drawPoly([corner(-hw, -hd, 0), corner(hw, -hd, 0), corner(hw, -hd, h.h), corner(-hw, -hd, h.h)].map((p) => toCam(...p)), h.wall);
    drawPoly([corner(hw, -hd, 0), corner(hw, hd, 0), corner(hw, hd, h.h), corner(hw, -hd, h.h)].map((p) => toCam(...p)), '#ddd0b8');
    drawPoly(
      [corner(-hw - 1, -hd, h.h), corner(hw + 1, -hd, h.h), corner(0, -hd * 0.2, gable)].map((p) => toCam(...p)),
      h.roof,
    );
    drawPoly(
      [corner(-hw - 1, hd, h.h), corner(hw + 1, hd, h.h), corner(0, hd * 0.2, gable)].map((p) => toCam(...p)),
      h.roof,
    );
  }

  function drawRings(world, mission, time) {
    for (const ring of world.rings) {
      const isNext = mission && mission.phase === 'rings' && mission.ringIndex === ring.index;
      const colour = ring.passed ? COLOURS.ringDone : isNext ? COLOURS.ringNext : COLOURS.ringOpen;
      const pts = [];
      const SEG = 26;
      for (let i = 0; i <= SEG; i++) {
        const a = (i / SEG) * Math.PI * 2;
        const px = ring.x + Math.cos(a) * RINGS.radius * ring.ux;
        const py = ring.y + Math.sin(a) * RINGS.radius;
        const pz = ring.z + Math.cos(a) * RINGS.radius * ring.uz;
        pts.push(toCam(px, py, pz));
      }
      ctx.globalAlpha = ring.passed ? 0.45 : 0.95;
      for (let i = 0; i < SEG; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        if (a.z < NEAR || b.z < NEAR) continue;
        const sa = project(a);
        const sb = project(b);
        const wdt = Math.max(2.2, Math.min(10, 1500 / a.z)) * (isNext ? 1 + 0.16 * Math.sin(time * 5) : 1);
        // a dark halo first, so the hoop reads against bright sky and cloud
        ctx.strokeStyle = 'rgba(12,24,36,0.4)';
        ctx.lineWidth = wdt + 2.6;
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.stroke();
        ctx.strokeStyle = colour;
        ctx.lineWidth = wdt;
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  return {
    ctx,
    cam,
    updateCamera,
    toCam,
    project,
    drawPoly,
    quad,
    drawSky,
    drawMountains,
    drawClouds,
    drawFields,
    drawRiverAndRoad,
    drawRunway,
    drawPad,
    drawTree,
    drawHouse,
    drawRings,
    get basis() {
      return basis;
    },
  };
}
