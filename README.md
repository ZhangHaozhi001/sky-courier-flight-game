# sky-courier-flight-game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/ZhangHaozhi001/sky-courier-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/ZhangHaozhi001/sky-courier-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Sky Courier: Valley Run — a complete flight game in a single static page. Pilot a mail plane in chase view over a hand-built valley: thread eight scoring rings in order, drop the parcel onto the village supply pad, then bring her home to the grass strip — gently, and with fuel to spare. A working cockpit (artificial horizon, altimeter, airspeed, compass, fuel and hull) and a synthesized WebAudio soundscape are all drawn and computed in code; there are no image or audio assets and the game makes zero network requests.

## Run it

```sh
node main.ts
python3 -m http.server --directory game 8000
```

`node main.ts` builds the entry: it copies `game/` and `screenshots/` into the output directory (`$MAKEFUN_OUTPUT_DIR` or `/output`) and writes the dossier. To fly, serve `game/` with any static file server as shown and open http://localhost:8000 in a desktop browser.

## How to play

- **W / S** throttle, **↑ / ↓** pitch, **← / →** bank and turn — or hold the mouse button and drag to steer.
- **Space** drops the parcel. **P** pauses, **M** mutes, **R** flies again, **Enter** starts.
- Speed makes lift: too slow and she stalls, nose first. The engine drinks fuel in proportion to the throttle, so a firewalled sortie can end in a long glide home.
- Rings pay for accuracy (dead centre 300, an edge 120), the parcel pays for closeness to the pad (500 / 260 / 120), and a smooth landing under 46 m/s pays 400 — with bonuses for fuel left in the tank and time under the five-minute par.

## How it is built

Plain JavaScript modules under `game/src/`, one job each: `config.js` (every tunable number), `world.js` (the seeded valley: fields, river, road and bridge, pines, village, peaks, the ring course), `aircraft.js` (the flight model: throttle, lift, stall, fuel, touchdown quality), `missions.js` (the three errands and the scoring), `render.js` (a hand-rolled 3D projection and the valley), `aircraftview.js` (the vector aircraft), `cockpit.js` (the instrument panel and HUD), `screens.js` (title and debrief), `audio.js` (all-synthesized sound), `input.js` and `shots.js` (the deterministic scenes the screenshots were taken from, via `?shot=hero|takeoff|drop|end`).

---

<sub>Entered on [make.fun](https://make.fun/?ref=gyf4n4nd&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
