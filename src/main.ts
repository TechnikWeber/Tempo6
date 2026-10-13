import { Sound } from './audio/Sound';
import { formatMoney } from './config/tuning';
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
  view.setVehicle(core.sim.vehicle.spec);
}
loadTrack(progress.track);

const input = new Input();
const sound = new Sound();
input.onFirstGesture = () => sound.unlock();
installTouchControls(input);
const hud = new Hud(() => input.trigger('tune'));
const gui = createDebugPanel(() => core);
gui.hide();
const hudRoot = document.getElementById('hud')!;
const touchRoot = document.getElementById('touch')!;

let racing = false;
const menu = new Menu(progress, {
  onVehicle(id) {
    core.setVehicle(id);
    view.setVehicle(core.sim.vehicle.spec);
  },
  onTrack: loadTrack,
  onStart() {
    sound.unlock();
    core.restart();
    setRacing(true);
    const v = core.sim.vehicle.spec;
    hud.toast(core.track.name, `${v.maker} ${v.label}`, 2.5);
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
  }
  while (acc >= STEP) {
    core.step(cmd);
    acc -= STEP;
    // One-shot actions must only fire on the first step of a frame.
    cmd.upright = cmd.respawn = cmd.tune = false;
  }

  handleEvents();
  const v = core.sim.vehicle;
  sound.setMotor(racing ? v.speed : 0, racing && v.wheelsOnGround > 0 ? Math.abs(cmd.throttle) : 0);
  if (racing) hud.update(core);
  view.render(core, acc / STEP, dt, !racing);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
