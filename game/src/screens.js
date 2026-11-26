// screens.js — the two framed screens of Sky Courier: the title card the
// sortie starts from, and the debrief panel it ends on (a scored breakdown
// for a landing, the plain facts for a crash).

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(7,15,22,0.82)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,220,255,0.5)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

export function drawTitle(ctx, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, 800);
  grad.addColorStop(0, 'rgba(5,12,20,0.55)');
  grad.addColorStop(0.55, 'rgba(5,12,20,0.25)');
  grad.addColorStop(1, 'rgba(5,12,20,0.6)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 800);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffc61a';
  ctx.font = '800 76px system-ui, sans-serif';
  ctx.fillText('SKY COURIER', 640, 148);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 25px system-ui, sans-serif';
  ctx.fillText('—  V A L L E Y   R U N  —', 640, 190);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(230,242,250,0.92)';
  ctx.fillText('The valley\'s mail flies at dawn, and today it flies with you.', 640, 226);
  ctx.fillText('Thread the rings, drop the parcel on the village pad, and bring her home in one piece.', 640, 250);

  // the three errands, as cards
  const cards = [
    ['1 · THREAD THE RINGS', 'Eight gold-and-blue hoops up the valley.\nDead centre pays 300, an edge pays 120.'],
    ['2 · DROP THE PARCEL', 'The red pad east of the river.\nSpace lets go — gravity does the rest.'],
    ['3 · LAND HER HOME', 'Back on the strip, gently, under 46 m/s.\nFuel left and time under par pay a bonus.'],
  ];
  cards.forEach(([title, body], i) => {
    const x = 92 + i * 376;
    panel(ctx, x, 292, 344, 118);
    ctx.fillStyle = '#ffc61a';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText(title, x + 172, 326);
    ctx.fillStyle = 'rgba(230,242,250,0.92)';
    ctx.font = '14px system-ui, sans-serif';
    body.split('\n').forEach((line, j) => ctx.fillText(line, x + 172, 356 + j * 20));
  });

  panel(ctx, 292, 442, 696, 108);
  ctx.fillStyle = '#9fd8ef';
  ctx.font = '700 14px ui-monospace, Menlo, monospace';
  ctx.fillText('W / S — THROTTLE        ↑ / ↓ — PITCH        ← / → — BANK & TURN', 640, 476);
  ctx.fillText('SPACE — DROP PARCEL     DRAG MOUSE — STICK     P — PAUSE     M — SOUND', 640, 502);
  ctx.fillStyle = 'rgba(230,242,250,0.85)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Watch the fuel gauge: the engine drinks at full throttle, and gliding home is slower than it looks.', 640, 530);

  if (Math.sin(time * 2.6) > -0.35) {
    ctx.fillStyle = '#ffc61a';
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.fillText('CLICK OR PRESS ENTER TO FLY', 640, 606);
  }
  ctx.textAlign = 'left';
}

function scoreRow(ctx, x, y, label, value) {
  ctx.fillStyle = 'rgba(230,242,250,0.92)';
  ctx.font = '16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 17px ui-monospace, Menlo, monospace';
  ctx.fillText(value, x + 470, y);
  ctx.textAlign = 'left';
}

export function drawEnd(ctx, plane, mission) {
  const grad = ctx.createLinearGradient(0, 0, 0, 800);
  grad.addColorStop(0, 'rgba(5,12,20,0.45)');
  grad.addColorStop(1, 'rgba(5,12,20,0.62)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 800);

  panel(ctx, 330, 108, 620, 470);
  ctx.textAlign = 'center';
  if (plane.landed) {
    ctx.fillStyle = '#57d977';
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.fillText('SORTIE COMPLETE', 640, 168);
    ctx.fillStyle = 'rgba(230,242,250,0.9)';
    ctx.font = '15px system-ui, sans-serif';
    const q = plane.touchdown.quality;
    ctx.fillText(
      q === 'smooth' ? 'A landing the strip keeper applauds.' : q === 'fast' ? 'Down safely — but she rolled out long and hot.' : 'Down in one piece. The mechanic will have words.',
      640,
      198,
    );
    let y = 248;
    scoreRow(ctx, 405, y, `Rings threaded — ${mission.ringsPassed} of 8`, `+${mission.ringScore}`);
    y += 36;
    scoreRow(ctx, 405, y, mission.dropDistance === null ? 'Parcel — never dropped' : `Parcel — ${Math.round(mission.dropDistance)} m from the pad`, `+${mission.dropScore}`);
    y += 36;
    scoreRow(ctx, 405, y, `Landing — ${q}`, `+${mission.landingScore || 0}`);
    y += 36;
    scoreRow(ctx, 405, y, `Fuel in the tank — ${Math.round(plane.fuel)} left`, `+${mission.fuelBonus || 0}`);
    y += 36;
    scoreRow(ctx, 405, y, 'Time under par', `+${mission.timeBonus || 0}`);
    y += 52;
    ctx.strokeStyle = 'rgba(140,220,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(405, y - 30);
    ctx.lineTo(875, y - 30);
    ctx.stroke();
    scoreRow(ctx, 405, y, 'TOTAL', String(mission.totalScore));
    // the grade stamp, parked in the panel's top-right corner, clear of the rows
    ctx.save();
    ctx.translate(838, 192);
    ctx.rotate(-0.16);
    ctx.strokeStyle = '#ffc61a';
    ctx.lineWidth = 3;
    ctx.strokeRect(-26, -26, 52, 52);
    ctx.fillStyle = '#ffc61a';
    ctx.font = '800 36px system-ui, sans-serif';
    ctx.fillText(mission.grade, 0, 12);
    ctx.restore();
  } else {
    ctx.fillStyle = '#ff5a4a';
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.fillText('SORTIE OVER', 640, 168);
    ctx.fillStyle = 'rgba(230,242,250,0.94)';
    ctx.font = '16px system-ui, sans-serif';
    const words = plane.crashCause.split(' ');
    let line = '';
    let ly = 208;
    for (const w of words) {
      if ((line + ' ' + w).length > 52) {
        ctx.fillText(line, 640, ly);
        ly += 24;
        line = w;
      } else line = line ? line + ' ' + w : w;
    }
    if (line) ctx.fillText(line, 640, ly);
    let y = ly + 56;
    scoreRow(ctx, 405, y, `Rings threaded — ${mission.ringsPassed} of 8`, `+${mission.ringScore}`);
    y += 36;
    scoreRow(ctx, 405, y, mission.dropDistance === null ? 'Parcel — never reached the village' : `Parcel — ${Math.round(mission.dropDistance)} m from the pad`, `+${mission.dropScore}`);
    y += 52;
    ctx.strokeStyle = 'rgba(140,220,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(405, y - 30);
    ctx.lineTo(875, y - 30);
    ctx.stroke();
    scoreRow(ctx, 405, y, 'SCORE BEFORE THE END', String(mission.ringScore + mission.dropScore));
  }
  ctx.fillStyle = '#ffc61a';
  ctx.font = '800 20px system-ui, sans-serif';
  ctx.fillText('PRESS R TO FLY AGAIN', 640, 548);
  ctx.textAlign = 'left';
}
