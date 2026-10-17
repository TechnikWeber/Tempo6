import { L, num, ordinal, translatePage } from './i18n';
import { Sound } from './audio/Sound';
import { modeById } from './config/modes';
import { formatMoney, STAGES } from './config/tuning';
import { VEHICLE_ORDER, VEHICLES } from './config/vehicles';
import { createDebugPanel } from './debug/panel';
import { Input } from './input/Input';
import { PROFILES, profileById } from './input/pads';
import { installTouchControls } from './input/touch';
import { View } from './render/View';
import { GameCore, type GameInput } from './sim/GameCore';
import { Progress } from './sim/Progress';
import { initPhysics, STEP } from './sim/Sim';
import { DEFAULT_TRACK, trackById, trackOpen, TRACKS, TRAINING } from './tracks';
import { GARAGE } from './tracks/garage';
import type { TrackDef } from './sim/Track';
import { Garage } from './ui/Garage';
import { formatTime, Hud } from './ui/Hud';
import { Menu } from './ui/Menu';
import { keyName, showPad } from './ui/prompts';

translatePage();
await initPhysics();

// ?demo: a show round with everything open that keeps nothing (screenshots, trying things
// out on someone else's phone). The real save is not touched.
const DEMO = new URLSearchParams(location.search).has('demo');
const progress = new Progress(DEMO ? memoryStore() : window.localStorage);
if (DEMO) {
  progress.money = 999;
  progress.unlockEverything([...VEHICLE_ORDER, ...TRACKS.map((t) => t.id)]);
  for (const id of VEHICLE_ORDER) progress.stages[id] = progress.maxStages[id] = 5;
}

function memoryStore() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}
const view = new View(document.getElementById('game') as HTMLCanvasElement);
let core!: GameCore;

/** Build the level; the old physics world is thrown away. */
function loadTrack(id: string): void {
  const track = trackById(id);
  progress.track = track.id;
  progress.save();
  build(track);
}

/** Put up a scene, the garage too, without making it the track to come back to. */
function build(track: TrackDef): void {
  core?.dispose();
  // (the tutorial is a time trial; the garage is nothing in particular)
  const mode = progress.tutorialDone && track !== GARAGE && modeById(progress.mode).tracks.includes(track.id) ? progress.mode : 'time';
  core = new GameCore(track, progress, mode);
  view.setTrack(track, core.laps);
  view.setVehicle(core.sim.vehicle.spec, progress.hasBoost);
}
// Before the tutorial there is only the tutorial; and a track that was only looked at in the
// menu, never bought, is not where the game starts either. Once the tutorial is done it is
// gone for good, so a stale save pointing at it lands on the car park instead.
loadTrack(trackOpen(progress, progress.track) ? progress.track : progress.tutorialDone ? DEFAULT_TRACK : TRAINING);

const input = new Input();
const sound = new Sound();
input.onGesture = () => sound.unlock();
installTouchControls(input);
// (tuning is done in the garage only, so the HUD has no shop)
const hud = new Hud();
const gui = createDebugPanel(() => core, () => {
  const p = core.sim.vehicle.profile;
  hud.toast(`${L('Fahrprofil', 'Driving profile')}: ${p.name}`, p.blurb, 2.5);
  reportProfiles();
}, () => view.setVehicle(core.sim.vehicle.spec, progress.hasBoost));
gui.hide();
const hudRoot = document.getElementById('hud')!;
const touchRoot = document.getElementById('touch')!;

/**
 * While developing, the chosen profile per vehicle is written to profile-choices.json
 * in the project folder, so the keepers can be read off there later.
 */
function reportProfiles(): void {
  if (!import.meta.env.DEV) return;
  const picks: Record<string, { index: number; name: string }> = {};
  for (const id of VEHICLE_ORDER) {
    const list = VEHICLES[id].profiles;
    const index = Math.min(progress.profiles[id] ?? 0, list.length - 1);
    picks[id] = { index, name: list[index].name };
  }
  void fetch('/__profiles', { method: 'POST', body: JSON.stringify(picks, null, 2) }).catch(() => {});
}
reportProfiles();

let racing = false;
const menu = new Menu(progress, {
  onVehicle(id) {
    core.setVehicle(id);
    view.setVehicle(core.sim.vehicle.spec, progress.hasBoost);
    // a fresh time of day for the preview each time the ride changes, same as picking a track
    view.randomizeTimeOfDay();
  },
  onTrack: loadTrack,
  onStart() {
    sound.unlock();
    core.restart(true);
    setRacing(true);
    const v = core.sim.vehicle.spec;
    hud.toast(core.track.name, `${v.label} · ${core.sim.vehicle.profile.name}`, 2.5);
  },
  onGarage() {
    sound.unlock();
    menu.hide();
    build(GARAGE);
    garage.show();
  },
  onExport() {
    const url = URL.createObjectURL(new Blob([progress.exportSave(TRACKS.map((t) => t.id))], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `tempo6-spielstand-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  async onImport(text) {
    if (!Progress.importSave(window.localStorage, text)) return L('Das ist kein Tempo6-Spielstand.', 'That is not a Tempo6 save.');
    // (simplest way to have everything read the loaded save afresh)
    location.reload();
    return null;
  },
  onDevMode(on) {
    progress.workshop = on;
    progress.save();
    if (!on) gui.hide();
  },
  onUnlockAll() {
    // (tutorial over, every vehicle and track bought, the boost fitted and switched on, everything tuned all the way)
    progress.unlockEverything([...VEHICLE_ORDER, ...TRACKS.map((t) => t.id)]);
    for (const id of VEHICLE_ORDER) {
      progress.stages[id] = STAGES.length - 1;
      progress.maxStages[id] = STAGES.length - 1;
    }
    progress.boostActive = true;
    progress.save();
    core.applyStage();
    return L('Alles freigeschaltet und voll getunt.', 'Everything unlocked and fully tuned.');
  },
  onWipe() {
    progress.wipe();
    // (same as loading a save: everything reads the fresh one from the start)
    location.reload();
  },
  padProfile() {
    if (input.padChoice) return `🎮 Controller: ${profileById(input.padChoice).name}`;
    return `🎮 Controller: ${L('automatisch', 'automatic')}${input.padName ? ` (${input.padProfile.name})` : ''}`;
  },
  onPadProfile() {
    // automatic, then each profile in turn, then automatic again
    const ids = [null, ...PROFILES.map((p) => p.id)];
    input.choosePad(ids[(ids.indexOf(input.padChoice) + 1) % ids.length]);
  },
});

const garage = new Garage({
  core: () => core,
  back() {
    garage.hide();
    loadTrack(progress.track);
    menu.show();
  },
});

// The buttons on the screen are named after whatever was used last, the keyboard or the
// controller (with what is printed on that one).
showPad(input.usingPad, input.padProfile.family);
input.onDevice = () => {
  showPad(input.usingPad, input.padProfile.family);
  menu.refreshPad();
};
input.onPad = (name, profile) => {
  // (a controller does not count as a gesture for the audio, so it may still be waiting for one)
  const sub = `${L('Tasten', 'Buttons')}: ${profile.name}${sound.waiting ? L(' · Für Ton einmal klicken', ' · Click once for sound') : ''}`;
  if (racing) hud.toast(`🎮 ${name}`, sub, 3);
  else menu.say(`🎮 ${name} · ${sub}`, 6);
  menu.refreshPad();
};

function setRacing(on: boolean): void {
  racing = on;
  document.body.classList.toggle('racing', on);
  hudRoot.hidden = !on;
  touchRoot.classList.toggle('off', !on);
  if (on) {
    menu.hide();
  } else {
    core.restart();
    hud.lightsOff();
    hud.hideBanner();
    view.clearMarks();
    menu.show();
  }
}
setRacing(false);

/** Lap message waiting for its payout line, and the place the lap took on the board. */
let lastLap = '';
let ranked = 0;
/**
 * Back to the menu a moment after the run is over (the tutorial done, a race finished),
 * with a line for the menu to show.
 */
let leave: { at: number; note: string } | null = null;
function leaveSoon(seconds: number, note: string): void {
  leave = { at: performance.now() + seconds * 1000, note };
}
function handleEvents(): void {
  for (const e of core.events) {
    if (!racing) continue;
    switch (e.type) {
      case 'pickup':
        if (e.kind === 'toolbox') {
          sound.crate();
          hud.toast(`${L('Werkzeugkiste!', 'Toolbox!')} +${formatMoney(e.value)}`, '', 1.5);
        } else {
          sound.bottle();
        }
        break;
      case 'lap':
        sound.lap();
        lastLap = e.best ? `${L('Bestzeit!', 'Best lap!')} ${formatTime(e.time)}` : `${L('Runde', 'Lap')}: ${formatTime(e.time)}`;
        break;
      case 'tuned':
        sound.tuned();
        hud.toast(`${e.stage.name}! ${L('Jetzt', 'Now')} ${num(core.topSpeedKmh)} km/h`, e.stage.blurb, 3.5);
        break;
      case 'land':
        view.bump(e.speed);
        sound.thud(e.speed);
        input.rumble(0.2 + e.speed * 0.08, 120);
        break;
      case 'honk':
        sound.honk();
        break;
      case 'stunt': {
        const names = { drift: 'Drift', twoWheels: L('Zweirad', 'Two wheels'), wheelie: 'Wheelie', air: L('Flug', 'Air'), looping: L('Looping!', 'Loop!'), nearMiss: L('Knapp vorbei', 'Near miss') };
        hud.stunt(`${names[e.kind]} +${Math.max(1, Math.round(e.points))}${e.multiplier > 1 ? ` (×${num(e.multiplier)})` : ''}`);
        break;
      }
      case 'payout': {
        const parts = [e.lap && `${L('Runde', 'lap')} ${e.lap}`, e.best && `${L('Bestzeit', 'best')} ${e.best}`, e.clean && `${L('unfallfrei', 'clean')} ${e.clean}`, e.stunts && `${L('Stunts', 'stunts')} ${e.stunts}`].filter(Boolean);
        sound.crate();
        // (the lap time comes with it, or the two toasts would cover each other)
        if (ranked) parts.unshift(L(`Platz ${ranked} der Bestenliste`, `${ordinal(ranked)} on the leaderboard`));
        hud.toast(lastLap ? `${lastLap} · +${formatMoney(e.total)}` : `+${formatMoney(e.total)}`, parts.join(' · '), 3.5);
        lastLap = '';
        ranked = 0;
        break;
      }
      case 'count':
        hud.lights(e.n);
        sound.count(e.n === 0);
        break;
      case 'ranked':
        ranked = e.place;
        break;
      case 'crash':
        view.bump(e.impact * 0.6);
        sound.thud(e.impact * 0.6);
        input.rumble(0.3 + e.impact * 0.08, 200);
        break;
      case 'wreck':
        sound.nope();
        hud.toast(L('Totalschaden!', 'Written off!'), L(`Was nicht im Ziel war, ist weg. ${keyName('respawn')}: Level neu starten.`, `Whatever was not over the line is gone. ${keyName('respawn')}: restart.`), 4);
        break;
      case 'boost':
        sound.zap();
        break;
      case 'boostBought':
        sound.tuned();
        hud.toast(L('Autobatterie auf dem Schoß!', 'Car battery on the lap!'), L(`${keyName('boost')} halten für den Boost. Lädt beim Bremsen schneller.`, `Hold ${keyName('boost')} to boost. Charges faster when braking.`), 4);
        break;
      case 'raceOver': {
        sound.lap();
        if (e.place === 1) sound.cheer();
        const medal = ['🥇', '🥈', '🥉'][e.place - 1] ?? '🏁';
        hud.banner(L(`${medal} Platz ${e.place} von ${e.of}`, `${medal} ${ordinal(e.place)} of ${e.of}`), e.pay ? `${L('Preisgeld', 'Prize')} +${formatMoney(e.pay)}` : L('Kein Preisgeld. Nächstes Mal.', 'No prize. Next time.'), 5);
        leaveSoon(5, L(`Rennen auf ${core.track.name}: Platz ${e.place} von ${e.of}`, `Race at ${core.track.name}: ${ordinal(e.place)} of ${e.of}`) + (e.pay ? `, +${formatMoney(e.pay)}.` : '.'));
        break;
      }
      case 'chain':
        sound.crate();
        hud.toast(`${L('Kette', 'Chain')}: +${formatMoney(e.total)}`, '', 2);
        break;
      case 'freestyleOver':
        sound.lap();
        if (e.record) sound.cheer();
        hud.banner(L('Zeit um!', 'Time’s up!'), `${L('Insgesamt', 'In total')} +${formatMoney(e.total)}${e.record ? L(' · Rekord!', ' · Record!') : ''}`, 5);
        leaveSoon(5, L(`Freestyle auf ${core.track.name}: +${formatMoney(e.total)}`, `Freestyle at ${core.track.name}: +${formatMoney(e.total)}`) + (e.record ? L(', Rekord!', ', a record!') : '.'));
        break;
      case 'chainLost':
        sound.nope();
        hud.toast(L('Kette gerissen!', 'Chain broken!'), L(`${formatMoney(e.lost)} futsch.`, `${formatMoney(e.lost)} gone.`), 2);
        break;
      case 'crashScore':
        if (e.propeller) {
          hud.banner(L('Weggefetzt!', 'Swatted!'), `${L('Propeller-Treffer', 'Propeller hit')}: +${e.points}`, 2);
          sound.thud(9);
        }
        hud.stunt(`+${e.points}`);
        break;
      case 'crashOver':
        sound.crate();
        if (e.record) sound.cheer();
        hud.toast(`${e.score} ${L('Punkte', 'points')}${e.record ? L(' · Rekord!', ' · Record!') : ''}`, `+${formatMoney(e.pay)} · ${keyName('respawn')}: ${L('nochmal', 'again')}`, 6);
        break;
      case 'missed':
        sound.nope();
        hud.toast(L('Checkpoint verpasst!', 'Checkpoint missed!'), L('Die Runde zählt nicht. Alle CP-Schilder der Reihe nach durchfahren.', 'The lap does not count. Drive through every CP marker in order.'), 3);
        break;
      case 'skipped': {
        sound.nope();
        const cp = e.gate === 0 ? L('das Ziel', 'the finish') : `CP ${e.gate}`;
        hud.toast(L(`${cp} ausgelassen!`, `${cp} left out!`), L(`Zurück und durch ${cp}, sonst zählt die Runde nicht.`, `Go back through ${cp}, or the lap will not count.`), 3.5);
        break;
      }
      case 'fell':
        sound.nope();
        hud.toast(L('Runtergefallen!', 'Fell off!'), L('Zurück zum Start, die Uhr läuft weiter.', 'Back to the start, the clock keeps running.'), 2.5);
        break;
      case 'untrained':
        sound.nope();
        hud.toast(L('Erst einmal durchs Tutorial', 'Get through the tutorial first'), L('Dann ist die Drossel raus.', 'Then the limiter comes out.'), 2);
        break;
      case 'graduated':
        sound.tuned();
        sound.cheer();
        hud.banner(L('Tutorial abgeschlossen!', 'Tutorial done!'), L(`${e.stage.name}: jedes Gefährt fährt jetzt ${e.stage.topSpeedKmh} km/h.`, `${e.stage.name}: every ride now does ${e.stage.topSpeedKmh} km/h.`), 3);
        leaveSoon(3, L('Ausbildung bestanden! Alle Modi und der Parkplatz sind offen, jedes Gefährt hat die Drossel raus.', 'Training passed! All modes and the car park are open, and every ride has its limiter out.'));
        break;
      case 'broke':
        sound.nope();
        hud.toast(L(`Es fehlen noch ${formatMoney(e.missing)}`, `${formatMoney(e.missing)} short`), '', 1.5);
        break;
    }
  }
  if (lastLap) {
    // a lap that paid nothing still gets its time shown
    hud.toast(lastLap);
    lastLap = '';
  }
  core.events.length = 0;
  if (leave && performance.now() > leave.at) {
    const { note } = leave;
    leave = null;
    if (racing) {
      setRacing(false);
      menu.say(note, 8);
    }
  }
}

/** Whether the train was near at the last look, so it sounds its horn once as it comes. */
let trainNear = false;
/** The sounds of what goes on around the vehicle: a train going by, a propeller turning. */
function listen(at: { x: number; z: number }): void {
  let train = Infinity;
  for (const c of core.sim.traffic.cars) {
    if (c.def.type !== 'train') continue;
    const p = c.tracked.body.translation();
    train = Math.min(train, Math.hypot(p.x - at.x, p.z - at.z));
  }
  sound.setTrain(racing ? Math.max(0, 1 - train / 160) : 0);
  const near = train < 110;
  if (racing && near && !trainNear) sound.trainHorn();
  trainNear = near;
  let whoosh = 0;
  for (const m of core.sim.movers) {
    // (the big wheel at the fair turns too, but quietly)
    if (m.def.type !== 'propeller' || (m.def.spin ?? 0) < 1) continue;
    const d = Math.hypot(m.def.pos[0] - at.x, m.def.pos[2] - at.z);
    // one swell per blade going past the bottom
    const beat = Math.abs(Math.sin((m.angle * (m.def.blades ?? 2)) / 2)) ** 6;
    whoosh = Math.max(whoosh, Math.max(0, 1 - d / 45) * (0.25 + 0.75 * beat));
  }
  sound.setWhoosh(racing ? whoosh : 0);
}

const IDLE: GameInput = { throttle: 0, steer: 0, handbrake: false, upright: false, respawn: false, tune: false };
let last = performance.now();
let acc = 0;

function frame(now: number): void {
  // Clamp long pauses (tab in background) so the sim does not try to catch up.
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;

  let cmd = input.poll(dt);
  // The controller's presses go to whatever is up: in the race the few that are not driving,
  // else the garage or the start screen.
  for (const p of input.padPresses.splice(0)) {
    if (racing) {
      if (p === 'start') input.trigger('menu');
      else if (p === 'select') input.trigger('respawn');
      else if (p === 'north') input.trigger('upright');
    } else if (garage.visible) {
      garage.pad(p);
    } else if (menu.visible) {
      menu.pad(p);
    }
  }
  if (input.take('mute')) sound.toggleMute();
  // (the ghost key only counts while driving; in the menu the switch is in the settings)
  if (input.take('ghost') && racing) {
    progress.showGhost = !progress.showGhost;
    progress.save();
    if (racing) hud.toast(progress.showGhost ? L('Schatten an', 'Ghost on') : L('Schatten aus', 'Ghost off'), L('Die Bestzeit fährt mit.', 'Your best lap drives along.'), 1.5);
  }
  // (the workshop only opens in dev mode, switched on in the settings)
  if (input.take('debug') && progress.workshop) gui.show(gui._hidden);
  if (input.take('menu') && racing) {
    leave = null;
    setRacing(false);
  }
  // On the start screen the vehicle just stands there and gets looked at.
  if (!racing) cmd = { ...IDLE };

  if (acc < STEP) {
    // No physics step this frame (fast displays): keep one-shot actions for the next one.
    if (cmd.upright) input.trigger('upright');
    if (cmd.respawn) input.trigger('respawn');
    if (cmd.tune) input.trigger('tune');
    if (cmd.buyBoost) input.trigger('buyBoost');
  }
  while (acc >= STEP) {
    core.step(cmd);
    acc -= STEP;
    // One-shot actions must only fire on the first step of a frame.
    cmd.upright = cmd.respawn = cmd.tune = cmd.buyBoost = false;
  }

  handleEvents();
  const v = core.sim.vehicle;
  sound.setMotor(racing ? v.speed : 0, racing && v.wheelsOnGround > 0 ? Math.abs(cmd.throttle) : 0);
  sound.setSqueal(racing ? Math.max(...v.skid) : 0);
  sound.setBoost(racing ? v.boost : 0);
  // the tune belongs to the start screen (and the garage behind it), not to the driving
  sound.setMusic(!racing && progress.music);
  listen(v.body.translation());
  if (racing) hud.update(core);
  view.render(core, acc / STEP, dt, !racing, !menu.showingVehicleAlone);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// In the show round, a handle for setting up pictures from the browser's console.
if (DEMO) {
  Object.assign(window, {
    tempo6: {
      core: () => core,
      /** Put the vehicle somewhere, facing somewhere; the camera catches up behind it. */
      place: (x: number, z: number, yaw: number, y = 0.7) => core.sim.vehicle.place(x, y, z, yaw),
      track: (id: string) => {
        loadTrack(id);
        core.restart(true);
      },
    },
  });
}
