import { Sound } from './audio/Sound';
import { formatMoney } from './config/tuning';
import { VEHICLE_ORDER, VEHICLES } from './config/vehicles';
import { createDebugPanel } from './debug/panel';
import { Input } from './input/Input';
import { installTouchControls } from './input/touch';
import { View } from './render/View';
import { GameCore, type GameInput } from './sim/GameCore';
import { Progress } from './sim/Progress';
import { initPhysics, STEP } from './sim/Sim';
import { trackById } from './tracks';
import { formatTime, Hud } from './ui/Hud';
import { Menu } from './ui/Menu';

await initPhysics();

const progress = new Progress(window.localStorage);
const view = new View(document.getElementById('game') as HTMLCanvasElement);
let core!: GameCore;

/** Build the level; the old physics world is thrown away. */
function loadTrack(id: string): void {
  const track = trackById(id);
  core?.dispose();
  progress.track = track.id;
  progress.save();
  core = new GameCore(track, progress);
  view.setTrack(track);
  view.setVehicle(core.sim.vehicle.spec, progress.hasBoost);
}
loadTrack(progress.track);

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
    core.restart();
    setRacing(true);
    const v = core.sim.vehicle.spec;
    hud.toast(core.track.name, `${v.label} · ${core.sim.vehicle.profile.name}`, 2.5);
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
    view.clearMarks();
    menu.show();
  }
}
setRacing(false);

function handleEvents(): void {
  for (const e of core.events) {
    if (!racing) continue;
    switch (e.type) {
      case 'pickup':
        if (e.kind === 'crate') {
          sound.crate();
          hud.toast(`Kasten Bier! +${formatMoney(e.value)}`, '', 1.5);
        } else {
          sound.bottle();
        }
        break;
      case 'lap':
        sound.lap();
        hud.toast(e.best ? `Bestzeit! ${formatTime(e.time)}` : `Runde: ${formatTime(e.time)}`);
        break;
      case 'tuned':
        sound.tuned();
        hud.toast(`${e.stage.name}! Jetzt ${core.topSpeedKmh.toFixed(1).replace('.', ',')} km/h`, e.stage.blurb, 3.5);
        break;
      case 'land':
        view.bump(e.speed);
        sound.thud(e.speed);
        break;
      case 'boost':
        sound.zap();
        break;
      case 'boostBought':
        sound.tuned();
        hud.toast('LKW-Batterie auf dem Schoß!', 'Umschalt halten für den Boost. Lädt beim Bremsen schneller.', 4);
        break;
      case 'broke':
        sound.nope();
        hud.toast(`Es fehlen noch ${formatMoney(e.missing)} Pfand`, '', 1.5);
        break;
    }
  }
  core.events.length = 0;
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
  if (input.take('debug')) gui.show(gui._hidden);
  if (input.take('menu') && racing) setRacing(false);
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
  if (racing) hud.update(core);
  view.render(core, acc / STEP, dt, !racing);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
