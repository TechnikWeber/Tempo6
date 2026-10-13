**English** · [Deutsch](README.de.md)

# Tempo6

A browser racing game with power wheelchairs and mobility scooters. You start at the legal 6 km/h, collect deposit bottles on a supermarket car park, and spend the money on increasingly questionable tuning until 75 km/h.

Status: playable prototype with a start screen, two tracks, three more roughed in, a curve test ground, thirteen vehicles and a tuning ladder.

## Vehicles

All model names are made up; the vehicles are loosely inspired by real product categories. There are no maker names, only a colour badge.

Every vehicle has three candidate driving profiles to try out in the workshop (F2). While the dev server runs, the chosen ones are written to `profile-choices.json`.

| Model | Category | Character |
| --- | --- | --- |
| T-Rex | Power wheelchairs | Mid-wheel drive, six wheels, turns on the spot |
| Avanti RX | Power wheelchairs | Rear-wheel drive, fast, prefers wide arcs |
| Avanti FX | Power wheelchairs | Front-wheel drive, pulls round corners, tail-happy |
| Orkan 4 | Power wheelchairs | Heavy rear-wheel drive, very stable |
| Arrivo Karton | One-piece folder | Light folding power chair, nimble |
| e-skalation | Push assist | Hub motors, thrust in push strokes |
| e-nix | Push assist | Hub motors with a joystick, optional attendant control |
| Arschtritt 3000 | Push assist | Pusher wheel at the back, steered and braked by hand |
| e-käpt'n | Tractor unit | Front-mounted drive, three wheels, fastest |
| Piepmatz | Mobility scooters | Tiny, agile, tippy |
| Stubentiger | Mobility scooters | Compact |
| Sternschnuppe 4 | Mobility scooters | The classic with a basket |
| Großer Wagen | Mobility scooters | Long, heavy, fast, huge turning circle |

Vehicles and tracks are unlocked with deposit money; `UNLOCK_ALL` in `src/config/vehicles.ts` opens everything for testing.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # headless physics and game logic tests
npm run build    # static build in dist/
```

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Drive / steer | WASD or arrow keys | Triggers / left stick |
| Handbrake | Space | A |
| Boost (car battery on the lap) | Shift or B | B / RB |
| Buy next tuning stage | T | X |
| Back on the wheels | R | Y |
| Restart the level | Backspace | Back |
| Back to the start screen | Esc | Start |
| Sound on/off | M | |
| Workshop (live handling tuning, cheats) | F2 | |

Touch devices get on-screen controls.

## Architecture

- `src/sim/`: physics and game rules ([Rapier](https://rapier.rs) raycast vehicle, fixed 60 Hz step). No rendering or DOM, so it runs headless in the tests.
- `src/render/`: [three.js](https://threejs.org) scene; all models are built from primitives in code.
- `src/input/`: keyboard, gamepad and touch merged into one driving intent.
- `src/config/`: tuning stages, vehicle specs and handling parameters.
- `src/tracks/`: tracks as plain data, used by both physics and rendering.
