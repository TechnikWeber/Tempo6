import { Sound } from './audio/Sound';
import { formatMoney } from './config/tuning';
import { VEHICLES } from './config/vehicles';
import { createDebugPanel } from './debug/panel';
import { Input } from './input/Input';
import { installTouchControls } from './input/touch';
import { View } from './render/View';
import { GameCore } from './sim/GameCore';
import { Progress } from './sim/Progress';
import { initPhysics, STEP } from './sim/Sim';
import { PARKPLATZ } from './tracks/parkplatz';
import { formatTime, Hud } from './ui/Hud';

await initPhysics();

const track = PARKPLATZ;
const core = new GameCore(track, new Progress(window.localStorage));
const view = new View(document.getElementById('game') as HTMLCanvasElement, track);
view.setVehicle(core.sim.vehicle.spec);

const input = new Input();
const sound = new Sound();
input.onFirstGesture = () => sound.unlock();
installTouchControls(input);
const hud = new Hud(() => input.trigger('tune'));
const gui = createDebugPanel(core);

hud.toast('Tempo6', 'Sammle Pfand. Tune dein Gefährt. Werde zu schnell.', 4);

function handleEvents(): void {
  for (const e of core.events) {
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
        hud.toast(`${e.stage.name}! Jetzt ${e.stage.topSpeedKmh} km/h`, e.stage.blurb, 3.5);
        break;
      case 'broke':
        sound.nope();
        hud.toast(`Es fehlen noch ${formatMoney(e.missing)} Pfand`, '', 1.5);
        break;
      case 'vehicle':
        view.setVehicle(VEHICLES[e.id]);
        hud.toast(VEHICLES[e.id].label, '', 1.5);
        break;
    }
  }
  core.events.length = 0;
}

let last = performance.now();
let acc = 0;

function frame(now: number): void {
  // Clamp long pauses (tab in background) so the sim does not try to catch up.
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;

  const cmd = input.poll(dt);
  if (input.take('mute')) sound.toggleMute();
  if (input.take('debug')) gui.show(gui._hidden);

  if (acc < STEP) {
    // No physics step this frame (fast displays): keep one-shot actions for the next one.
    if (cmd.upright) input.trigger('upright');
    if (cmd.respawn) input.trigger('respawn');
    if (cmd.tune) input.trigger('tune');
    if (cmd.selectVehicle) input.trigger(cmd.selectVehicle);
  }
  while (acc >= STEP) {
    core.step(cmd);
    acc -= STEP;
    // One-shot actions must only fire on the first step of a frame.
    cmd.upright = cmd.respawn = cmd.tune = false;
    cmd.selectVehicle = null;
  }

  handleEvents();
  const v = core.sim.vehicle;
  sound.setMotor(v.speed, v.wheelsOnGround > 0 ? Math.abs(cmd.throttle) : 0);
  hud.update(core);
  view.render(core, acc / STEP, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
