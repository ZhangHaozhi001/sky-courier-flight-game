// cockpit.js — the lit instrument panel and the HUD of Sky Courier.
// Gauges are drawn, not decorated: the artificial horizon rolls and pitches
// with the plane, the altimeter and airspeed needles sweep real scales,
// and the compass strip scrolls with the heading. The HUD keeps altitude,
// speed and heading where a pilot's eye expects them: top-left, always.

const FT = 3.28084;
const KT = 1.94384;

export const toFeet = (m) => m * FT;
export const toKnots = (ms) => ms * KT;
export const toHeadingDeg = (h) => ((h * 180) / Math.PI % 360 + 360) % 360;

function dialFace(ctx, cx, cy, r, label) {
  const grad = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
  grad.addColorStop(0, '#17384a');
  grad.addColorStop(1, '#08141d');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(130,220,255,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = '#05090d';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#9fd8ef';
  ctx.font = `600 ${Math.round(r * 0.2)}px ui-monospace, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + r * 0.62);
}

function needle(ctx, cx, cy, r, angleRad, colour = '#ffc61a') {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(angleRad) * r * 0.22, cy - Math.sin(angleRad) * r * 0.22);
  ctx.lineTo(cx + Math.cos(angleRad) * r * 0.82, cy + Math.sin(angleRad) * r * 0.82);
  ctx.stroke();
  ctx.fillStyle = '#dfe9ee';
  ctx.beginPath();
  ctx.arc(cx, cy, 3.4, 0, Math.PI * 2);
  ctx.fill();
}

// a value 0..1 mapped onto a 270-degree gauge sweep, 0 at lower-left
const sweep = (frac) => Math.PI * 0.75 + frac * Math.PI * 1.5;

function drawHorizon(ctx, plane, cx, cy, r) {
  dialFace(ctx, cx, cy, r, 'ATTITUDE');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll);
  const pitchPx = plane.pitch * r * 1.15;
  ctx.translate(0, pitchPx);
  ctx.fillStyle = '#3f7ec2';
  ctx.fillRect(-r, -r * 2, r * 2, r * 2);
  ctx.fillStyle = '#8a6a42';
  ctx.fillRect(-r, 0, r * 2, r * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 1.4;
  for (const deg of [-20, -10, 10, 20]) {
    const y = -deg * (Math.PI / 180) * r * 1.15;
    const wdt = deg % 20 === 0 ? r * 0.34 : r * 0.2;
    ctx.beginPath();
    ctx.moveTo(-wdt, y);
    ctx.lineTo(wdt, y);
    ctx.stroke();
  }
  ctx.restore();
  // the fixed aircraft symbol
  ctx.strokeStyle = '#ffc61a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.52, cy);
  ctx.lineTo(cx - r * 0.16, cy);
  ctx.lineTo(cx - r * 0.16, cy + 5);
  ctx.moveTo(cx + r * 0.52, cy);
  ctx.lineTo(cx + r * 0.16, cy);
  ctx.lineTo(cx + r * 0.16, cy + 5);
  ctx.stroke();
  ctx.fillStyle = '#ffc61a';
  ctx.beginPath();
  ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawAltimeter(ctx, plane, cx, cy, r) {
  dialFace(ctx, cx, cy, r, 'ALT · FT');
  const alt = Math.max(0, toFeet(plane.y));
  ctx.fillStyle = '#cfe9f5';
  ctx.font = `600 ${Math.round(r * 0.17)}px ui-monospace, Menlo, monospace`;
  ctx.textAlign = 'center';
  for (let v = 0; v <= 1600; v += 200) {
    const a = sweep(v / 1600);
    const x1 = cx + Math.cos(a) * r * 0.8;
    const y1 = cy + Math.sin(a) * r * 0.8;
    const x2 = cx + Math.cos(a) * r * 0.92;
    const y2 = cy + Math.sin(a) * r * 0.92;
    ctx.strokeStyle = '#cfe9f5';
    ctx.lineWidth = v % 400 === 0 ? 2.4 : 1.2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    if (v % 400 === 0) ctx.fillText(String(v / 100), cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6 + 4);
  }
  needle(ctx, cx, cy, r, sweep(Math.min(1, alt / 1600)));
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(r * 0.26)}px ui-monospace, Menlo, monospace`;
  ctx.fillText(String(Math.round(alt)), cx, cy - r * 0.34);
  const vs = Math.round((plane.vy || 0) * FT * 60);
  ctx.fillStyle = vs < -600 ? '#ff7a6b' : '#9fd8ef';
  ctx.font = `600 ${Math.round(r * 0.19)}px ui-monospace, Menlo, monospace`;
  ctx.fillText(`${vs > 0 ? '+' : ''}${vs} fpm`, cx, cy + r * 0.36);
}

function drawAirspeed(ctx, plane, cx, cy, r) {
  dialFace(ctx, cx, cy, r, 'SPEED · KT');
  const spd = toKnots(plane.speed);
  // coloured arcs: amber past 115 kt, red past 148 (the airframe's limit)
  for (const [from, to, colour] of [[115, 148, '#e8a33d'], [148, 170, '#e2483d']]) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.86, sweep(from / 170), sweep(to / 170));
    ctx.stroke();
  }
  ctx.fillStyle = '#cfe9f5';
  ctx.font = `600 ${Math.round(r * 0.17)}px ui-monospace, Menlo, monospace`;
  ctx.textAlign = 'center';
  for (let v = 0; v <= 160; v += 20) {
    const a = sweep(v / 170);
    ctx.strokeStyle = '#cfe9f5';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
    ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
    ctx.stroke();
    ctx.fillText(String(v), cx + Math.cos(a) * r * 0.58, cy + Math.sin(a) * r * 0.58 + 4);
  }
  needle(ctx, cx, cy, r, sweep(Math.min(1, spd / 170)));
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(r * 0.26)}px ui-monospace, Menlo, monospace`;
  ctx.fillText(String(Math.round(spd)), cx, cy - r * 0.34);
}

function drawCompass(ctx, plane, x, y, w) {
  const hdg = toHeadingDeg(plane.heading);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, 34);
  ctx.clip();
  ctx.fillStyle = '#0a1a24';
  ctx.fillRect(x, y, w, 34);
  ctx.strokeStyle = 'rgba(130,220,255,0.4)';
  ctx.strokeRect(x, y, w, 34);
  const pxPerDeg = w / 110;
  ctx.textAlign = 'center';
  const lo = Math.floor(hdg) - 60;
  const hi = Math.ceil(hdg) + 60;
  for (let deg = lo; deg <= hi; deg++) {
    if (deg % 5 !== 0) continue;
    const norm = ((deg % 360) + 360) % 360;
    const sx = x + w / 2 + (deg - hdg) * pxPerDeg;
    const tall = norm % 30 === 0;
    ctx.strokeStyle = '#cfe9f5';
    ctx.lineWidth = tall ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(sx, y + 34);
    ctx.lineTo(sx, y + 34 - (tall ? 12 : 7));
    ctx.stroke();
    if (tall) {
      const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
      ctx.fillStyle = names[norm] ? '#ffc61a' : '#cfe9f5';
      ctx.font = `700 ${names[norm] ? 15 : 11}px ui-monospace, Menlo, monospace`;
      ctx.fillText(names[norm] || String(norm / 10).padStart(2, '0'), sx, y + 16);
    }
  }
  ctx.restore();
  ctx.fillStyle = '#ffc61a';
  ctx.beginPath();
  ctx.moveTo(x + w / 2 - 6, y + 36);
  ctx.lineTo(x + w / 2 + 6, y + 36);
  ctx.lineTo(x + w / 2, y + 42);
  ctx.closePath();
  ctx.fill();
}

function drawBar(ctx, x, y, w, h, frac, colour, label, valueText) {
  ctx.fillStyle = '#9fd8ef';
  ctx.font = '600 11px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y - 5);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(valueText, x + w, y - 5);
  ctx.fillStyle = '#0a1a24';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colour;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * Math.min(1, frac)), h - 2);
  ctx.strokeStyle = 'rgba(130,220,255,0.4)';
  ctx.strokeRect(x, y, w, h);
}

export function drawPanel(ctx, plane, time) {
  // the panel itself
  ctx.fillStyle = '#101c26';
  ctx.fillRect(0, 646, 1280, 154);
  ctx.fillStyle = '#2e4a5e';
  ctx.fillRect(0, 646, 1280, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = 24; x < 1280; x += 90) {
    ctx.beginPath();
    ctx.arc(x, 656, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawHorizon(ctx, plane, 118, 726, 62);
  drawAltimeter(ctx, plane, 268, 726, 54);
  drawAirspeed(ctx, plane, 396, 726, 54);
  drawCompass(ctx, plane, 486, 668, 300);

  const fuelFrac = plane.fuel / 100;
  const fuelColour = plane.fuel < 20 ? (Math.sin(time * 7) > 0 ? '#e2483d' : '#8c2b23') : plane.fuel < 40 ? '#e8a33d' : '#57d977';
  drawBar(ctx, 486, 726, 300, 13, fuelFrac, fuelColour, 'FUEL', `${Math.round(plane.fuel)} / 100`);
  drawBar(ctx, 486, 768, 300, 13, plane.damage / 100, '#e2483d', 'HULL', plane.damage <= 0 ? 'SOUND' : `${Math.round(plane.damage)}%`);

  // throttle quadrant on the right
  ctx.fillStyle = '#9fd8ef';
  ctx.font = '600 11px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('THROTTLE', 1168, 668);
  ctx.fillStyle = '#0a1a24';
  ctx.fillRect(1152, 676, 32, 108);
  ctx.strokeStyle = 'rgba(130,220,255,0.4)';
  ctx.strokeRect(1152, 676, 32, 108);
  const th = plane.throttle;
  ctx.fillStyle = '#ffc61a';
  ctx.fillRect(1154, 676 + 106 * (1 - th), 28, Math.max(2, 106 * th - 2));
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 15px ui-monospace, Menlo, monospace';
  ctx.fillText(`${Math.round(th * 100)}%`, 1168, 800 - 4);

  // engine state lamp
  ctx.fillStyle = plane.engineOut ? '#e2483d' : '#57d977';
  ctx.beginPath();
  ctx.arc(1112, 690, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9fd8ef';
  ctx.font = '600 10px ui-monospace, Menlo, monospace';
  ctx.fillText('ENG', 1112, 708);
}

// ---- HUD ----------------------------------------------------------------------

function pill(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(6,16,24,${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

export function drawHud(ctx, R, state) {
  const { plane, mission, target, time } = state;
  const alt = Math.round(Math.max(0, toFeet(plane.y)));
  const spd = Math.round(toKnots(plane.speed));
  const hdg = String(Math.round(toHeadingDeg(plane.heading))).padStart(3, '0');

  // top-left primary readouts
  pill(ctx, 16, 14, 356, 58);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9fd8ef';
  ctx.font = '600 11px ui-monospace, Menlo, monospace';
  ctx.fillText('ALT FT', 30, 32);
  ctx.fillText('SPD KT', 142, 32);
  ctx.fillText('HDG', 254, 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 27px ui-monospace, Menlo, monospace';
  ctx.fillText(String(alt), 30, 62);
  ctx.fillText(String(spd), 142, 62);
  ctx.fillText(hdg + '°', 254, 62);

  // top-right sortie figures
  const score = mission.ringScore + mission.dropScore;
  const mm = String(Math.floor(plane.elapsed / 60)).padStart(2, '0');
  const ss = String(Math.floor(plane.elapsed % 60)).padStart(2, '0');
  pill(ctx, 986, 14, 278, 58);
  ctx.fillStyle = '#9fd8ef';
  ctx.font = '600 11px ui-monospace, Menlo, monospace';
  ctx.fillText('SCORE', 1000, 32);
  ctx.fillText('TIME', 1096, 32);
  ctx.fillText('RINGS', 1180, 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 22px ui-monospace, Menlo, monospace';
  ctx.fillText(String(score), 1000, 62);
  ctx.fillText(`${mm}:${ss}`, 1096, 62);
  ctx.fillText(`${mission.ringsPassed}/8`, 1180, 62);

  // objective, top-centre
  if (target) {
    const dist = Math.hypot(target.x - plane.x, target.z - plane.z);
    const distText = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;
    ctx.font = '600 15px system-ui, sans-serif';
    const wdt = ctx.measureText(target.label).width + 92;
    pill(ctx, 640 - wdt / 2, 14, wdt, 34, 0.62);
    ctx.fillStyle = '#ffc61a';
    ctx.textAlign = 'center';
    ctx.fillText(`◎ ${target.label} · ${distText}`, 640, 37);
    ctx.textAlign = 'left';
  }

  // target marker or edge arrow
  if (target && R) {
    const c = R.toCam(target.x, target.y, target.z);
    if (c.z > 1.4) {
      const s = R.project(c);
      if (s.x > 30 && s.x < 1250 && s.y > 90 && s.y < 620) {
        ctx.strokeStyle = '#ffc61a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - 13);
        ctx.lineTo(s.x + 9, s.y);
        ctx.lineTo(s.x, s.y + 13);
        ctx.lineTo(s.x - 9, s.y);
        ctx.closePath();
        ctx.stroke();
      } else {
        edgeArrow(ctx, c);
      }
    } else {
      edgeArrow(ctx, c);
    }
  }

  // mission banner
  if (mission.bannerT > 0 && mission.banner) {
    const alpha = Math.min(1, mission.bannerT);
    ctx.font = '600 17px system-ui, sans-serif';
    const wdt = ctx.measureText(mission.banner).width + 36;
    ctx.save();
    ctx.globalAlpha = alpha;
    pill(ctx, 640 - wdt / 2, 88, wdt, 36, 0.6);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(mission.banner, 640, 112);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  // warnings, centre screen
  ctx.textAlign = 'center';
  if (plane.stalling && Math.sin(time * 11) > -0.2) {
    ctx.fillStyle = '#ff5a4a';
    ctx.font = '800 34px system-ui, sans-serif';
    ctx.fillText('STALL', 640, 220);
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText('nose down, let her gather speed', 640, 246);
  }
  if (plane.engineOut) {
    ctx.fillStyle = '#ff5a4a';
    ctx.font = '800 26px system-ui, sans-serif';
    ctx.fillText('ENGINE OUT — GLIDE HER HOME', 640, 190);
  } else if (plane.fuel < 20 && plane.airborne) {
    ctx.fillStyle = '#e8a33d';
    ctx.font = '700 19px system-ui, sans-serif';
    ctx.fillText('LOW FUEL', 640, 190);
  }
  ctx.textAlign = 'left';

  // early-flight hint
  if (plane.elapsed < 13 && !plane.landed) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('W/S throttle · ↑ ↓ pitch · ← → bank · Space drop parcel · drag mouse to steer', 18, 630);
  }
}

function edgeArrow(ctx, camPoint) {
  let dx = camPoint.x;
  let dy = -camPoint.y;
  if (camPoint.z < 0) {
    dx = -dx;
    dy = -dy;
  }
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const cx = 640 + dx * 400;
  const cy = 330 + dy * 190;
  const ang = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffc61a';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
