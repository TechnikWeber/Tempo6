import { Sound } from './audio/Sound';
import { modeById } from './config/modes';
import { formatMoney } from './config/tuning';
import { VEHICLE_ORDER, VEHICLES } from './config/vehicles';
import { createDebugPanel } from './debug/panel';
import { Input } from './input/Input';
import { installTouchControls } from './input/touch';
import { View } from './render/View';
import { GameCore, type GameInput } from './sim/GameCore';
import { Progress } from './sim/Progress';
import { initPhysics, STEP } from './sim/Sim';
import { trackById, trackOpen, TRACKS, TRAINING } from './tracks';
import { GARAGE } from './tracks/garage';
import type { TrackDef } from './sim/Track';
import { Garage } from './ui/Garage';
import { formatTime, Hud } from './ui/Hud';
import { Menu } from './ui/Menu';

await initPhysics();

const progress = new Progress(window.localStorage);
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
  view.setTrack(track);
  view.setVehicle(core.sim.vehicle.spec, progress.hasBoost);
}
// Before the tutorial there is only the Reha-Parcours; and a track that was only looked at
// in the menu, never bought, is not where the game starts either.
loadTrack(trackOpen(progress, progress.track) ? progress.track : TRAINING);

const input = new Input();
const sound = new Sound();
input.onFirstGesture = () => sound.unlock();
installTouchControls(input);
const hud = new Hud(() => input.trigger('tune'), () => input.trigger('buyBoost'));
const gui = createDebugPanel(() => core, () => {
  const p = core.sim.vehicle.profile;
  hud.toast(`Fahrprofil: ${p.name}`, p.blurb, 2.5);
  reportProfiles();
});
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
    if (!Progress.importSave(window.localStorage, text)) return 'Das ist kein Tempo6-Spielstand.';
    // (simplest way to have everything read the loaded save afresh)
    location.reload();
    return null;
  },
  onCheat(code) {
    switch (code.trim().toLowerCase()) {
      case '1337':
        progress.workshop = true;
        progress.save();
        return 'Werkstatt freigeschaltet: F2 öffnet sie.';
      case 'money':
        progress.earn(1000);
        return '+1000 Schrauben!';
      default:
        return null;
    }
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
          hud.toast(`Werkzeugkiste! +${formatMoney(e.value)}`, '', 1.5);
        } else {
          sound.bottle();
        }
        break;
      case 'lap':
        sound.lap();
        lastLap = e.best ? `Bestzeit! ${formatTime(e.time)}` : `Runde: ${formatTime(e.time)}`;
        break;
      case 'tuned':
        sound.tuned();
        hud.toast(`${e.stage.name}! Jetzt ${core.topSpeedKmh.toFixed(1).replace('.', ',')} km/h`, e.stage.blurb, 3.5);
        break;
      case 'land':
        view.bump(e.speed);
        sound.thud(e.speed);
        break;
      case 'honk':
        sound.honk();
        break;
      case 'stunt': {
        const names = { drift: 'Drift', twoWheels: 'Zweirad', wheelie: 'Wheelie', air: 'Flug', looping: 'Looping!', nearMiss: 'Knapp vorbei' };
        hud.stunt(`${names[e.kind]} +${Math.max(1, Math.round(e.points))}${e.multiplier > 1 ? ` (×${e.multiplier.toFixed(1).replace('.', ',')})` : ''}`);
        break;
      }
      case 'payout': {
        const parts = [e.lap && `Runde ${e.lap}`, e.best && `Bestzeit ${e.best}`, e.clean && `unfallfrei ${e.clean}`, e.stunts && `Stunts ${e.stunts}`].filter(Boolean);
        sound.crate();
        // (the lap time comes with it, or the two toasts would cover each other)
        if (ranked) parts.unshift(`Platz ${ranked} der Bestenliste`);
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
        break;
      case 'wreck':
        sound.nope();
        hud.toast('Totalschaden!', 'Was nicht im Ziel war, ist weg. Rücktaste: Level neu starten.', 4);
        break;
      case 'boost':
        sound.zap();
        break;
      case 'boostBought':
        sound.tuned();
        hud.toast('Autobatterie auf dem Schoß!', 'Umschalt halten für den Boost. Lädt beim Bremsen schneller.', 4);
        break;
      case 'raceOver': {
        sound.lap();
        if (e.place === 1) sound.cheer();
        const medal = ['🥇', '🥈', '🥉'][e.place - 1] ?? '🏁';
        hud.banner(`${medal} Platz ${e.place} von ${e.of}`, e.pay ? `Preisgeld +${formatMoney(e.pay)}` : 'Kein Preisgeld. Nächstes Mal.', 5);
        leaveSoon(5, `Rennen auf ${core.track.name}: Platz ${e.place} von ${e.of}${e.pay ? `, +${formatMoney(e.pay)}` : ''}.`);
        break;
      }
      case 'chain':
        sound.crate();
        if (e.record) sound.cheer();
        hud.toast(`Kette: +${formatMoney(e.total)}`, e.record ? 'Neuer Rekord auf dieser Strecke!' : '', 2.5);
        break;
      case 'chainLost':
        sound.nope();
        hud.toast('Kette gerissen!', `${formatMoney(e.lost)} futsch.`, 2);
        break;
      case 'crashScore':
        if (e.propeller) {
          hud.banner('Weggefetzt!', `Propeller-Treffer: +${e.points}`, 2);
          sound.thud(9);
        }
        hud.stunt(`+${e.points}`);
        break;
      case 'crashOver':
        sound.crate();
        if (e.record) sound.cheer();
        hud.toast(`${e.score} Punkte${e.record ? ' · Rekord!' : ''}`, `+${formatMoney(e.pay)} · Rücktaste: nochmal`, 6);
        break;
      case 'untrained':
        sound.nope();
        hud.toast('Erst einmal durch den Parcours', 'Dann ist die Drossel raus.', 2);
        break;
      case 'graduated':
        sound.tuned();
        sound.cheer();
        hud.banner('Tutorial abgeschlossen!', `${e.stage.name}: jedes Gefährt fährt jetzt ${e.stage.topSpeedKmh} km/h.`, 3);
        leaveSoon(3, 'Ausbildung bestanden! Alle Modi und der Parkplatz sind offen, jedes Gefährt hat die Drossel raus.');
        break;
      case 'broke':
        sound.nope();
        hud.toast(`Es fehlen noch ${formatMoney(e.missing)}`, '', 1.5);
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
  if (input.take('mute')) sound.toggleMute();
  if (input.take('ghost')) {
    progress.showGhost = !progress.showGhost;
    progress.save();
    if (racing) hud.toast(progress.showGhost ? 'Schatten an' : 'Schatten aus', 'Die Bestzeit fährt mit.', 1.5);
  }
  // (the workshop only opens once its cheat code has been typed in)
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
  listen(v.body.translation());
  if (racing) hud.update(core);
  view.render(core, acc / STEP, dt, !racing);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
