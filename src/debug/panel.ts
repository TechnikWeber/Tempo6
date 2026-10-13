import GUI from 'lil-gui';
import { BOOST, STAGES } from '../config/tuning';
import { HANDLING, HANDLING_DEFAULTS } from '../config/vehicles';
import type { GameCore } from '../sim/GameCore';

/** The "Werkstatt": live tuning of the handling and cheats for testing. Toggle with F2. */
export function createDebugPanel(game: () => GameCore, onProfile: () => void = () => {}): GUI {
  const gui = new GUI({ title: 'Werkstatt (F2)' });
  const progress = game().progress;
  const state = { stufe: progress.stageIndex };

  const stufe = gui
    .add(state, 'stufe', 0, STAGES.length - 1, 1)
    .name('Tuning-Stufe')
    .onChange((v: number) => {
      progress.stageIndex = v;
      progress.save();
      game().applyStage();
    });
  gui.add({ f: () => progress.earn(1000) }, 'f').name('+10 € Pfand');
  gui
    .add({ f: () => { progress.wipe(); game().applyStage(); } }, 'f')
    .name('Spielstand löschen');

  gui.add({ f: () => game().restart() }, 'f').name('Level neu starten (⌫)');

  // One button per candidate driving profile of the current vehicle; the list is
  // rebuilt whenever the vehicle changes.
  let profiles = gui.addFolder('Fahrprofil');
  let shownFor = '';
  const showProfiles = () => {
    const core = game();
    const spec = core.sim.vehicle.spec;
    shownFor = `${spec.id}:${core.profileIndex}`;
    profiles.destroy();
    profiles = gui.addFolder(`Fahrprofil: ${spec.label}`);
    spec.profiles.forEach((p, i) => {
      const pick = () => {
        game().setProfile(i);
        onProfile();
        showProfiles();
      };
      const c = profiles.add({ pick }, 'pick').name(`${i === core.profileIndex ? '● ' : '○ '}${i + 1} · ${p.name}`);
      c.domElement.title = p.blurb;
    });
  };
  showProfiles();

  const h = gui.addFolder('Fahrverhalten');
  h.add({ f: () => { Object.assign(HANDLING, HANDLING_DEFAULTS); h.controllersRecursive().forEach((c) => c.updateDisplay()); } }, 'f')
    .name('Einstellungen zurücksetzen');
  h.add(HANDLING, 'grip', 0.5, 4, 0.05).name('Reifengrip');
  h.add(HANDLING, 'lateralAccel', 2, 16, 0.5).name('Lenk-Schärfe (m/s²)');
  h.add(HANDLING, 'cornerYaw', 0, 2.5, 0.05).name('Drehrate bei Tempo (rad/s)');
  h.add(HANDLING, 'cornerMax', 12, 45, 1).name('…höchstens (m/s²)');
  h.add(HANDLING, 'cornerSlow', 0, 0.7, 0.05).name('Kurve kostet Tempo (Anteil)');
  h.add(HANDLING, 'cornerDrag', 0, 12, 0.5).name('Kurven-Bremswirkung (m/s²)');
  h.add(HANDLING, 'gripAtSpeed', 0, 0.15, 0.005).name('Grip-Zuwachs je m/s');
  h.add(HANDLING, 'gripUse', 0.5, 1.3, 0.05).name('Grip-Ausnutzung (>1 rutscht)');
  h.add(HANDLING, 'steerAssist', 0, 1, 0.05).name('Lenkhilfe (Rollstuhl)');
  h.add(HANDLING, 'handAssist', 0, 1, 0.05).name('Lenkhilfe (Greifreifen)');
  h.add(HANDLING, 'spinGuard', 0, 80, 5).name('Dreher-Bremse (Lenker)');
  h.add(HANDLING, 'driftAngle', 0, 0.5, 0.02).name('Driftwinkel (rad)');
  h.add(HANDLING, 'airControl', 0, 2, 0.1).name('Flug-Stabilisierung');
  h.add(HANDLING, 'tipHeight', 0, 0.8, 0.02).name('Kippneigung');
  h.add(HANDLING, 'tipAssist', 0, 1, 0.05).name('Kipp-Assistent');
  h.add(HANDLING, 'tipAngle', 0.2, 1, 0.05).name('Assistent: Winkel');
  h.add(HANDLING, 'tipFree', 0, 0.3, 0.01).name('Assistent: freie Neigung');
  h.add(HANDLING, 'tipInherent', 0, 0.6, 0.05).name('Kipp-Ausgleich bei Tempo');
  h.add(HANDLING, 'righting', 0, 0.3, 0.01).name('Aufricht-Moment');
  h.add(HANDLING, 'rollDamping', 0, 200, 5).name('Wank-Dämpfung');
  h.add(HANDLING, 'motorGain', 1, 15, 0.5).name('Motor-Biss');
  h.add(HANDLING, 'yawGain', 2, 40, 1).name('Dreh-Biss (Rollstuhl)');
  h.add(HANDLING, 'fwdStability', 0, 1.2, 0.05).name('Frontantrieb: Heck-Ruhe');
  h.add(HANDLING, 'brakeDecel', 1, 12, 0.5).name('Magnetbremse (m/s²)');
  h.add(HANDLING, 'footBrake', 2, 30, 0.5).name('Bremse mit S (m/s²)');
  h.add(HANDLING, 'handbrakeSlide', 0, 1, 0.05).name('Handbremse: Heckgrip');
  h.add(HANDLING, 'suspensionCompression', 0.5, 10, 0.1).name('Dämpfung ein');
  h.add(HANDLING, 'suspensionRelaxation', 0.5, 10, 0.1).name('Dämpfung aus');
  h.add(HANDLING, 'bodySway', 0, 3, 0.1).name('Aufbau-Wanken (Optik)');

  const BOOST_DEFAULTS = { ...BOOST };
  const b = gui.addFolder('Boost');
  b.add({ f: () => { Object.assign(BOOST, BOOST_DEFAULTS); b.controllersRecursive().forEach((c) => c.updateDisplay()); } }, 'f')
    .name('Einstellungen zurücksetzen');
  b.add(BOOST, 'duration', 0.5, 8, 0.1).name('Dauer (s)');
  b.add(BOOST, 'recharge', 1, 30, 0.5).name('Nachladen (s)');
  b.add(BOOST, 'recuperation', 1, 6, 0.1).name('…beim Bremsen schneller (×)');
  b.add(BOOST, 'minCharge', 0, 1, 0.05).name('Mindestladung zum Zünden');
  b.add(BOOST, 'speed', 0, 1, 0.05).name('Mehr Tempo (Anteil)');
  b.add(BOOST, 'extraSpeed', 0, 5, 0.1).name('…plus fest (m/s)');
  b.add(BOOST, 'accel', 0, 2, 0.05).name('Mehr Antritt (Anteil)');
  b.add(BOOST, 'rampUp', 0.05, 2, 0.05).name('Einblenden (s)');
  b.add(BOOST, 'rampDown', 0.05, 3, 0.05).name('Ausblenden (s)');
  b.close();

  // Keep the slider in step when the stage changes through normal play.
  setInterval(() => {
    const core = game();
    if (shownFor !== `${core.sim.vehicle.spec.id}:${core.profileIndex}`) showProfiles();
    if (state.stufe !== progress.stageIndex) {
      state.stufe = progress.stageIndex;
      stufe.updateDisplay();
    }
  }, 500);

  gui.close();
  return gui;
}
