// aircraftview.js — draws the courier plane itself: a vector 3D model
// (fuselage, wing, tail, glasshouse, spinning prop) built from the plane's
// own heading, pitch and roll, plus its ground shadow and the falling parcel.

const LIVERY = {
  body: '#f0e6cf',
  bodyShade: '#d9c9a3',
  stripe: '#c8402a',
  wing: '#e7dcc0',
  wingShade: '#cdbd93',
  glass: '#1d3038',
  tyre: '#22262a',
};

// The plane's axes in the world: forward, right and up, rolled as one frame.
export function planeFrame(plane) {
  const h = plane.heading;
  const p = plane.pitch;
  const f = {
    x: Math.sin(h) * Math.cos(p),
    y: Math.sin(p),
    z: -Math.cos(h) * Math.cos(p),
  };
  const r0 = { x: Math.cos(h), y: 0, z: Math.sin(h) };
  const u0 = {
    x: r0.y * f.z - r0.z * f.y,
    y: r0.z * f.x - r0.x * f.z,
    z: r0.x * f.y - r0.y * f.x,
  };
  const cr = Math.cos(plane.roll);
  const sr = Math.sin(plane.roll);
  const r = { x: r0.x * cr + u0.x * sr, y: r0.y * cr + u0.y * sr, z: r0.z * cr + u0.z * sr };
  const u = { x: u0.x * cr - r0.x * sr, y: u0.y * cr - r0.y * sr, z: u0.z * cr - r0.z * sr };
  return { f, r, u };
}

// local point (x right, y up, z aft) -> world point on the aircraft
function onPlane(plane, frame, lx, ly, lz) {
  return [
    plane.x + frame.r.x * lx + frame.u.x * ly - frame.f.x * lz,
    plane.y + frame.r.y * lx + frame.u.y * ly - frame.f.y * lz,
    plane.z + frame.r.z * lx + frame.u.z * ly - frame.f.z * lz,
  ];
}

export function drawShadow(R, plane) {
  if (plane.y <= 0.4) return;
  const c = R.toCam(plane.x, 0.25, plane.z);
  if (c.z < 1.4) return;
  const s = R.project(c);
  const rx = Math.max(4, (150 * R.basis.f) / c.z / Math.max(6, plane.y * 0.55));
  const alpha = Math.max(0.05, 0.34 - plane.y * 0.0016);
  R.ctx.save();
  R.ctx.fillStyle = `rgba(20,30,16,${alpha})`;
  R.ctx.beginPath();
  R.ctx.ellipse(s.x, s.y, rx, rx * 0.3, 0, 0, Math.PI * 2);
  R.ctx.fill();
  R.ctx.restore();
}

export function drawAircraft(R, plane, time) {
  const frame = planeFrame(plane);
  const P = (lx, ly, lz) => R.toCam(...onPlane(plane, frame, lx, ly, lz));
  const faces = [];
  const face = (pts, fill) => {
    const cam = pts.map((p) => P(...p));
    const depth = cam.reduce((s, c) => s + c.z, 0) / cam.length;
    faces.push({ cam, fill, depth });
  };

  // wing and tailplane first (they sit behind the fuselage faces)
  face([[-4.9, 0.28, 0.5], [-0.5, 0.08, 0.85], [0.5, 0.08, 0.85], [4.9, 0.28, 0.5]], LIVERY.wing);
  face([[-4.9, 0.28, 0.5], [-0.5, 0.08, -0.55], [0.5, 0.08, -0.55], [4.9, 0.28, 0.5]], LIVERY.wingShade);
  face([[-1.85, 0.42, 3.35], [1.85, 0.42, 3.35], [0.4, 0.4, 2.95], [-0.4, 0.4, 2.95]], LIVERY.wing);
  // fuselage: top, two sides, belly
  face([[0, 0.62, -1.6], [0, 0.5, 2.4], [0, 0.35, 3.45], [0, 0.12, -3.55]], LIVERY.body);
  face([[-0.64, 0.1, -3.2], [-0.66, 0.35, 0.6], [-0.38, 0.35, 3.3], [0, 0.12, -3.55]], LIVERY.bodyShade);
  face([[0.64, 0.1, -3.2], [0, 0.12, -3.55], [0.38, 0.35, 3.3], [0.66, 0.35, 0.6]], LIVERY.body);
  face([[0, -0.5, -1.4], [0, -0.3, 2.6], [0, 0.35, 3.45], [0, 0.12, -3.55]], LIVERY.bodyShade);
  // the courier stripe down both cheeks
  face([[-0.65, -0.05, -2.6], [-0.67, 0.12, 0.4], [-0.4, 0.14, 3.1], [-0.26, -0.02, -2.9]], LIVERY.stripe);
  face([[0.65, -0.05, -2.6], [0.26, -0.02, -2.9], [0.4, 0.14, 3.1], [0.67, 0.12, 0.4]], LIVERY.stripe);
  // fin and rudder
  face([[0, 0.4, 2.85], [0, 1.65, 3.3], [0, 0.42, 3.45]], LIVERY.stripe);
  // glasshouse
  face([[-0.4, 0.62, -1.35], [0.4, 0.62, -1.35], [0.36, 0.88, -0.25], [-0.36, 0.88, -0.25]], LIVERY.glass);
  face([[-0.36, 0.88, -0.25], [0.36, 0.88, -0.25], [0.3, 0.6, 0.55], [-0.3, 0.6, 0.55]], LIVERY.glass);

  // the propeller disc joins the sorted faces, so the fuselage correctly
  // hides it from behind instead of it floating over the tail
  const disc = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    disc.push([Math.cos(a) * 1.05, 0.12 + Math.sin(a) * 1.05, -3.62]);
  }
  face(disc, 'rgba(28,28,32,0.16)');

  faces.sort((a, b) => b.depth - a.depth);
  for (const f of faces) R.drawPoly(f.cam, f.fill);

  // wheels: two dark discs low on the fuselage while the gear is down (always)
  for (const side of [-0.85, 0.85]) {
    const c = P(side, -0.92, -0.2);
    if (c.z < 1.4) continue;
    const s = R.project(c);
    const r = Math.max(1.6, (0.34 * R.basis.f) / c.z);
    R.ctx.fillStyle = LIVERY.tyre;
    R.ctx.beginPath();
    R.ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    R.ctx.fill();
  }

  // two blade strokes at the nose, spinning with the revs; only drawn when
  // the nose is at least partly toward the camera, never over the tail
  const nose = P(0, 0.12, -3.62);
  const noseDir = R.toCam(...onPlane(plane, frame, 0, 0.12, -6));
  if (nose.z > 1.4 && noseDir.z < nose.z) {
    const s = R.project(nose);
    const r = Math.max(2, (1.05 * R.basis.f) / nose.z);
    const spin = time * (6 + plane.throttle * 46) + plane.elapsed * 3;
    R.ctx.save();
    R.ctx.strokeStyle = 'rgba(24,24,28,0.7)';
    R.ctx.lineWidth = Math.max(1.4, r * 0.1);
    R.ctx.beginPath();
    R.ctx.moveTo(s.x - Math.cos(spin) * r, s.y - Math.sin(spin) * r * 0.94);
    R.ctx.lineTo(s.x + Math.cos(spin) * r, s.y + Math.sin(spin) * r * 0.94);
    R.ctx.stroke();
    R.ctx.restore();
  }
}

export function drawParcel(R, parcel) {
  if (!parcel) return;
  const c = R.toCam(parcel.x, parcel.y, parcel.z);
  if (c.z < 1.4) return;
  const s = R.project(c);
  const size = Math.max(2.5, (1.5 * R.basis.f) / c.z);
  const ctx = R.ctx;
  // a little parachute canopy over a brown crate
  ctx.fillStyle = '#e8e3d5';
  ctx.beginPath();
  ctx.arc(s.x, s.y - size * 1.5, size * 0.95, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,50,40,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(s.x - size * 0.9, s.y - size * 1.5);
  ctx.lineTo(s.x, s.y);
  ctx.moveTo(s.x + size * 0.9, s.y - size * 1.5);
  ctx.lineTo(s.x, s.y);
  ctx.stroke();
  ctx.fillStyle = '#8a6844';
  ctx.fillRect(s.x - size / 2, s.y - size / 2, size, size);
  ctx.strokeStyle = '#5d452a';
  ctx.strokeRect(s.x - size / 2, s.y - size / 2, size, size);
}
