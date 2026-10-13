**English** · [Deutsch](README.de.md)

# Tempo6

A browser racing game with power wheelchairs and mobility scooters. You start at the legal 6 km/h, collect deposit bottles on a supermarket car park, and spend the money on increasingly questionable tuning until 75 km/h.

Status: first playable prototype (one test track, two vehicles, tuning ladder).

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
| Buy next tuning stage | T | X |
| Back on the wheels | R | Y |
| Back to the start | Backspace | Back |
| Wheelchair / scooter | 1 / 2 | |
| Sound on/off | M | |
| Workshop (live handling tuning, cheats) | F2 | |

Touch devices get on-screen controls.

## Architecture

- `src/sim/`: physics and game rules ([Rapier](https://rapier.rs) raycast vehicle, fixed 60 Hz step). No rendering or DOM, so it runs headless in the tests.
- `src/render/`: [three.js](https://threejs.org) scene; all models are built from primitives in code.
- `src/input/`: keyboard, gamepad and touch merged into one driving intent.
- `src/config/`: tuning stages, vehicle specs and handling parameters.
- `src/tracks/`: tracks as plain data, used by both physics and rendering.
