import { L } from '../i18n';
import type { Control, Family } from '../input/pads';

// The screen names the buttons of whatever was used last: the keyboard, or the controller with
// what is printed on it. Hints for the controller sit in elements marked data-pad-hint and are
// filled in here, since what they say depends on the make.

/** What is printed on each control, by make. */
const LABELS: Record<Family, Record<Control, string>> = {
  nintendo: {
    south: 'B', east: 'A', west: 'Y', north: 'X', l1: 'L', r1: 'R', l2: 'ZL', r2: 'ZR',
    select: '−', start: '+', home: '⌂', l3: 'L3', r3: 'R3', up: '▲', down: '▼', left: '◀', right: '▶',
  },
  xbox: {
    south: 'A', east: 'B', west: 'X', north: 'Y', l1: 'LB', r1: 'RB', l2: 'LT', r2: 'RT',
    select: '⧉', start: '☰', home: 'Ⓧ', l3: 'LS', r3: 'RS', up: '▲', down: '▼', left: '◀', right: '▶',
  },
  playstation: {
    south: '✕', east: '○', west: '□', north: '△', l1: 'L1', r1: 'R1', l2: 'L2', r2: 'R2',
    select: 'Share', start: 'Options', home: 'PS', l3: 'L3', r3: 'R3', up: '▲', down: '▼', left: '◀', right: '▶',
  },
};

let family: Family = 'nintendo';

/** One control as a key cap, the way the pad in use has it. */
export function glyph(c: Control): string {
  return `<kbd class="pad ${family} ${c}">${LABELS[family][c]}</kbd>`;
}

/** The button that says yes in menus and the one that goes back: A and B wherever they sit. */
function ok(): Control {
  return family === 'nintendo' ? 'east' : 'south';
}
function back(): Control {
  return family === 'nintendo' ? 'south' : 'east';
}

function hint(name: string): string {
  const g = glyph;
  switch (name) {
    case 'drive':
      return L(
        `${g('r2')} Gas · ${g('l2')} Bremse/rückwärts · Stick oder ${g('left')}${g('right')} lenken · ${g('south')} Handbremse · ${g('east')} ${g('r1')} Boost · ${g('north')} aufrichten · ${g('select')} Level neu · ${g('start')} Menü`,
        `${g('r2')} throttle · ${g('l2')} brake/reverse · stick or ${g('left')}${g('right')} steer · ${g('south')} handbrake · ${g('east')} ${g('r1')} boost · ${g('north')} get up · ${g('select')} restart · ${g('start')} menu`,
      );
    case 'flipped':
      return L(`${g('north')} zum Aufrichten`, `${g('north')} to get back up`);
    case 'wrecked':
      return L(`${g('select')} Level neu`, `${g('select')} restart`);
    case 'boost':
      return g('east');
    case 'menu':
      return L(
        `${g('left')}${g('right')} Gefährt · ${g('l1')}${g('r1')} Modus · ${g('up')}${g('down')} Strecke · ${g(ok())} Los · ${g('north')} Garage · ${g('west')} freischalten · ${g('select')} Einstellungen`,
        `${g('left')}${g('right')} ride · ${g('l1')}${g('r1')} mode · ${g('up')}${g('down')} track · ${g(ok())} go · ${g('north')} garage · ${g('west')} unlock · ${g('select')} settings`,
      );
    case 'settings':
      return L(`${g('up')}${g('down')}${g('left')}${g('right')} wählen · ${g(ok())} drücken · ${g(back())} zu`, `${g('up')}${g('down')}${g('left')}${g('right')} pick · ${g(ok())} press · ${g(back())} close`);
    case 'garage':
      return L(`${g('up')}${g('down')} wählen · ${g(ok())} nehmen · ${g(back())} zurück`, `${g('up')}${g('down')} pick · ${g(ok())} take · ${g(back())} back`);
    default:
      return '';
  }
}

/** Fill in the controller hints under `root`, e.g. after the garage has drawn itself anew. */
export function fillPadHints(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-pad-hint]').forEach((e) => (e.innerHTML = hint(e.dataset.padHint ?? '')));
}

/** Name the controller's buttons from now on (or the keyboard's again), in this make's labels. */
export function showPad(on: boolean, make: Family): void {
  document.body.classList.toggle('pad', on);
  if (make === family && document.body.dataset.padHints) return;
  family = make;
  document.body.dataset.padHints = make;
  fillPadHints();
}

/** A key named in running text, e.g. a toast: the keyboard's or the controller's. */
export function keyName(action: 'boost' | 'respawn'): string {
  if (!document.body.classList.contains('pad')) return action === 'boost' ? L('Umschalt', 'Shift') : L('Rücktaste', 'Backspace');
  return LABELS[family][action === 'boost' ? 'east' : 'select'];
}
