**English** · [Deutsch](README.de.md)

# Tempo6

A browser racing game with power wheelchairs and mobility scooters. You start at the legal 6 km/h, collect deposit bottles on a supermarket car park, and spend the money on increasingly questionable tuning until 75 km/h.

Status: playable prototype with a start screen, two tracks, seven vehicles and a tuning ladder.

## Vehicles

All makers and models are made up; they are loosely inspired by real product categories.

| Model | Type | Character |
| --- | --- | --- |
| Rasicare T-Rex Mitteldreher | Power chair, mid-wheel drive | Six wheels, turns on the spot |
| Rasicare Avanti RX | Power chair, rear-wheel drive | Fast, prefers wide arcs |
| Rasicare Orkan 4 | Heavy power chair, rear-wheel drive | Slow to get going, very stable |
| Halber e-skalation | Manual chair with hub motors | Light, twitchy, thrust in push strokes |
| Halber schubs one | Manual chair with a pusher wheel | Steered and braked by hand |
| Halber e-käpt'n | Manual chair with a front tractor unit | Three wheels, fastest, tips easily |
| Rentnerblitz Komet 4 | Mobility scooter | Steers like a car |

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
