import GUI from 'lil-gui';
import { STAGES } from '../config/tuning';
import { HANDLING } from '../config/vehicles';
import type { GameCore } from '../sim/GameCore';

/** The "Werkstatt": live tuning of the handling and cheats for testing. Toggle with F2. */
export function createDebugPanel(core: GameCore): GUI {
  const gui = new GUI({ title: 'Werkstatt (F2)' });
  const state = { stufe: core.progress.stageIndex };

  const stufe = gui
    .add(state, 'stufe', 0, STAGES.length - 1, 1)
    .name('Tuning-Stufe')
    .onChange((v: number) => {
      core.progress.stageIndex = v;
      core.progress.save();
      core.applyStage();
    });
  gui.add({ f: () => core.progress.earn(1000) }, 'f').name('+10 € Pfand');
  gui
    .add({ f: () => { core.progress.wipe(); core.applyStage(); } }, 'f')
    .name('Spielstand löschen');

  const h = gui.addFolder('Fahrverhalten');
  h.add(HANDLING, 'grip', 0.5, 4, 0.05).name('Reifengrip');
  h.add(HANDLING, 'lateralAccel', 2, 14, 0.5).name('Kurven-g (m/s²)');
  h.add(HANDLING, 'motorGain', 1, 15, 0.5).name('Motor-Biss');
  h.add(HANDLING, 'yawGain', 2, 40, 1).name('Dreh-Biss (Rollstuhl)');
  h.add(HANDLING, 'brakeDecel', 1, 12, 0.5).name('Magnetbremse (m/s²)');
  h.add(HANDLING, 'handbrakeSlide', 0, 1, 0.05).name('Handbremse: Heckgrip');
  h.add(HANDLING, 'suspensionCompression', 0.5, 10, 0.1).name('Dämpfung ein');
  h.add(HANDLING, 'suspensionRelaxation', 0.5, 10, 0.1).name('Dämpfung aus');

  // Keep the slider in step when the stage changes through normal play.
  setInterval(() => {
    if (state.stufe !== core.progress.stageIndex) {
      state.stufe = core.progress.stageIndex;
      stufe.updateDisplay();
    }
  }, 500);

  gui.close();
  return gui;
}
