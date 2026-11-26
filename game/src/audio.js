// audio.js — every sound in Sky Courier is synthesised with WebAudio:
// no audio files, nothing to load. The engine is two detuned oscillators
// and filtered noise whose pitch follows the throttle; the rest are small
// one-shot voices for rings, the parcel, warnings and the ends of a sortie.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    engineOsc2.start();

    // wind: looped noise through a bandpass, loudness follows airspeed
    const noiseLen = ctx.sampleRate * 1.5;
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 640;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    noise.start();
    return true;
  }

  function tone(freq, dur, type = 'sine', vol = 0.16, when = 0, slideTo = null) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function thump(vol = 0.5, freq = 90) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(32, t0 + 0.28);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.35);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
      return muted;
    },
    isMuted: () => muted,
    // called every frame with the plane's state
    update(plane) {
      if (!ctx || muted) return;
      const rpm = 55 + plane.throttle * 95 + plane.speed * 0.35;
      engineOsc.frequency.value = rpm;
      engineOsc2.frequency.value = rpm * 1.5 + 3;
      const running = plane.crashed || plane.landed ? 0 : 0.028 + plane.throttle * 0.075;
      engineGain.gain.setTargetAtTime(running, ctx.currentTime, 0.09);
      windGain.gain.setTargetAtTime(Math.min(0.16, plane.speed * 0.0022), ctx.currentTime, 0.15);
    },
    stopEngine() {
      if (!ctx) return;
      if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      if (windGain) windGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    },
    ring() {
      tone(880, 0.14, 'sine', 0.18);
      tone(1318, 0.22, 'sine', 0.16, 0.07);
    },
    ringMiss() {
      tone(220, 0.18, 'triangle', 0.1, 0, 160);
    },
    drop() {
      tone(340, 0.1, 'square', 0.08, 0, 190);
    },
    parcelDown(good) {
      if (good) {
        tone(660, 0.12, 'sine', 0.16);
        tone(990, 0.2, 'sine', 0.14, 0.09);
      } else {
        thump(0.3, 120);
      }
    },
    stallWarning() {
      tone(1175, 0.09, 'square', 0.06);
    },
    takeoff() {
      tone(523, 0.12, 'triangle', 0.12);
      tone(784, 0.18, 'triangle', 0.12, 0.1);
    },
    touchdown(good) {
      thump(good ? 0.25 : 0.45, good ? 110 : 80);
      if (good) tone(784, 0.25, 'sine', 0.12, 0.05);
    },
    crash() {
      thump(0.7, 70);
      tone(140, 0.5, 'sawtooth', 0.2, 0, 40);
    },
    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.14, i * 0.11));
    },
  };
}
