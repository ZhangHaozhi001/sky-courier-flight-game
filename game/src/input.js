// input.js — keyboard and mouse for Sky Courier.
//   ↑ / ↓ or the stick: pitch        ← / → : bank and turn
//   W / S: throttle up / down        Space: drop the parcel
//   Enter: start / confirm           R: fly again      P: pause      M: mute
// Holding the mouse button down turns the pointer into a stick: drag to steer.

const HELD = new Set();
const PRESSED = new Set(); // keys that went down since the last frame

const KEYMAP = {
  ArrowUp: 'pitchUp',
  ArrowDown: 'pitchDown',
  ArrowLeft: 'rollLeft',
  ArrowRight: 'rollRight',
  KeyW: 'throttleUp',
  KeyS: 'throttleDown',
  KeyA: 'rollLeft',
  KeyD: 'rollRight',
  Space: 'drop',
  Enter: 'confirm',
  KeyR: 'restart',
  KeyP: 'pause',
  KeyM: 'mute',
};

export function createInput(canvas) {
  const mouse = { down: false, dx: 0, dy: 0 };

  const onKey = (down) => (e) => {
    const name = KEYMAP[e.code];
    if (!name) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (down) {
      if (!HELD.has(name)) PRESSED.add(name);
      HELD.add(name);
    } else {
      HELD.delete(name);
    }
  };
  window.addEventListener('keydown', onKey(true));
  window.addEventListener('keyup', onKey(false));

  canvas.addEventListener('pointerdown', (e) => {
    mouse.down = true;
    mouse.dx = 0;
    mouse.dy = 0;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!mouse.down) return;
    const r = canvas.getBoundingClientRect();
    mouse.dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    mouse.dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
  });
  const release = () => {
    mouse.down = false;
    mouse.dx = 0;
    mouse.dy = 0;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  return {
    // the state the flight model reads every frame
    read() {
      const state = {
        pitchUp: HELD.has('pitchUp'),
        pitchDown: HELD.has('pitchDown'),
        rollLeft: HELD.has('rollLeft'),
        rollRight: HELD.has('rollRight'),
        throttleUp: HELD.has('throttleUp'),
        throttleDown: HELD.has('throttleDown'),
      };
      if (mouse.down) {
        if (mouse.dx < -0.12) state.rollLeft = true;
        if (mouse.dx > 0.12) state.rollRight = true;
        if (mouse.dy < -0.12) state.pitchUp = true;
        if (mouse.dy > 0.12) state.pitchDown = true;
      }
      return state;
    },
    // one-shot actions, consumed by the caller
    pressed(name) {
      if (PRESSED.has(name)) {
        PRESSED.delete(name);
        return true;
      }
      return false;
    },
  };
}
