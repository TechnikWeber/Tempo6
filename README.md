**English** · [Deutsch](README.de.md)

# Tempo6

**▶ Play in your browser: [technikweber.github.io/Tempo6](https://technikweber.github.io/Tempo6/)** · on a computer or a phone held sideways, nothing to install, no sign-up.

A racing game with power wheelchairs and mobility scooters. Every vehicle starts at 12 km/h (on paper: the legal 6) in the Reha-Parcours, a training course with a seesaw, a rocking bridge and a balance beam. Get through once and the throttle comes off; then earn Schrauben (screws) with laps, races and stunts and spend them on increasingly questionable tuning until 75 km/h. The game is in English and switches to German with one button on the start screen.

<p align="center">
  <img src="docs/screenshots/01-startbildschirm.jpg" alt="Start screen with vehicles, modes and tracks" width="49%">
  <img src="docs/screenshots/03-rennen-startaufstellung.jpg" alt="Starting grid of a race on the DIY-store car park" width="49%">
  <img src="docs/screenshots/02-reha-parcours-wippe.jpg" alt="A wheelchair on the seesaw in the Reha-Parcours" width="49%">
  <img src="docs/screenshots/04-werk-vordach-haupteingang.jpg" alt="Under the canopy of the main entrance at the Talstadt works" width="49%">
  <img src="docs/screenshots/05-altwerk-zug.jpg" alt="A train passing the old works" width="49%">
  <img src="docs/screenshots/06-garage.jpg" alt="Tuning garage with the stage ladder and driving profiles" width="49%">
</p>

## What's in it

- **Modes:** time trial against the clock and your own ghost, a three-lap race against three others, freestyle for stunt chains, and an experimental crashtest.
- **Tracks:** Reha-Parcours, DIY-store car park, Talstadt works, the Sky Path, the old works at Porta West Africa, an old airfield, a playground of ramps, a stadium circuit, a long hill circuit and the crashtest ground.
- **Tuning:** eight stages up to 75 km/h, a boost battery, three driving profiles per vehicle, all in the garage too.
- **Save:** kept in the browser, and with "Speichern"/"Laden" as a file that survives clearing the browser's data; "Spielstand löschen" in the settings starts over.
- **Sound:** made in the browser, no audio files: the motors, the knocks, and an 8-bit tune on the start screen and in the garage (sliders in the settings for everything, 100 % to start with, for the sounds, 25 %, and for the music, 25 %, where 0 % turns it off; M mutes all sound).

## Vehicles

All model names are made up; the vehicles are loosely inspired by real product categories. There are no maker names, only a colour badge.

Every vehicle has three driving profiles to choose from in the garage. While the dev server runs, the chosen ones are written to `profile-choices.json`.

| Model | Category | Character |
| --- | --- | --- |
| TDFiX | Power wheelchairs | Mid-wheel drive, six wheels, turns on the spot |
| Avanti RX | Power wheelchairs | Rear-wheel drive, fast, prefers wide arcs |
| Avanti FX | Power wheelchairs | Front-wheel drive, pulls round corners, tail-happy |
| Strom4 | Power wheelchairs | Heavy rear-wheel drive, very stable |
| Arrivo Karton | One-piece folder | Light folding power chair, nimble |
| e-skalation | Power Addons | Hub motors, thrust in push strokes |
| e-six Seven | Power Addons | Hub motors with a joystick, optional attendant control |
| Arschtritt 3000 | Power Addons | Pusher wheel at the back, steered and braked by hand |
| Sprite | Power Addons | Power chair on a rigid frame, does not fold, calmer |
| e-kapitän | Tractor unit | Front-mounted drive, three wheels, fastest |
| Kohlibri | Mobility scooters | Tiny, agile, tippy |
| Lion | Mobility scooters | Compact |
| Covid Pro | Mobility scooters | The classic with a basket |
| Olivion | Mobility scooters | Long, heavy, fast, huge turning circle |
| Scandalmobile | Tuned stair climbers | Stair climber with a seat, rebuilt for racing: Grandpa sits up front, Grandma gets towed on roller skates |

Vehicles and tracks are unlocked with Schrauben. To try everything: add `?demo` to the address for a show round with everything open that saves nothing.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # headless physics and game logic tests
npm run build    # static build in dist/
```

Every push to `main` tests, builds and publishes the game with GitHub Pages (`.github/workflows/pages.yml`). Saves live in the browser, under technikweber.github.io.

## Controls

| Action | Keyboard | Controller: Switch layout (8BitDo) | Xbox | PlayStation |
| --- | --- | --- | --- | --- |
| Drive / steer | WASD or arrow keys | ZR / ZL, left stick or d-pad | RT / LT, left stick or d-pad | R2 / L2, left stick or d-pad |
| In the air: turn and shift / tip the nose, stretch the jump | Steer / throttle and brake | left stick / ZR, ZL | left stick / RT, LT | left stick / R2, L2 |
| Handbrake | Space | B | A | ✕ |
| Boost (car battery on the lap) | Shift or B | A or R | B or RB | ○ or R1 |
| Back on the wheels | R | X | Y | △ |
| Restart the level | Backspace | − | View | Share |
| Back to the start screen | Esc | + | Menu | Options |
| Sound on/off | M | | | |
| Garage (on the start screen) | T | X | Y | △ |
| Workshop (live handling tuning; with dev mode on in the settings) | F2 | | | |

On the start screen a controller does what the keys do: left and right pick the ride, up and down the track, the shoulder buttons the mode, A (Xbox A, ✕) goes, Y (Xbox X, □) unlocks what is highlighted and − (View, Share) opens the settings. In the garage and the settings the d-pad moves a highlight, A presses it and B goes back. The screen names the buttons of whatever was used last, the keys or the controller's own labels. The game tells controllers apart by their make: an 8BitDo in its own mode is the default and anything unknown is taken for one, Switch Pro, Xbox and PlayStation controllers get their own names; "🎮 Controller" in the settings picks by hand if it guesses wrong. Browsers only let the sound start after a click or a key, not a controller button, so click into the game once for sound.

On a phone held sideways: steering strip bottom left with "aufrichten" (upright) and "neu" (restart) above it, throttle (big), reverse, handbrake and boost bottom right, menu top left. "Vollbild" on the start screen goes full screen.

## Architecture

- `src/sim/`: physics and game rules ([Rapier](https://rapier.rs) raycast vehicle, fixed 60 Hz step). No rendering or DOM, so it runs headless in the tests.
- `src/render/`: [three.js](https://threejs.org) scene; all models are built from primitives in code.
- `src/input/`: keyboard, controller and touch merged into one driving intent; `pads.ts` holds the controller profiles.
- `src/config/`: tuning stages, vehicle specs and handling parameters.
- `src/tracks/`: tracks as plain data, used by both physics and rendering.
