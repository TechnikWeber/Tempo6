import type { PadPress } from '../input/pads';

/** What can be pressed: buttons, the toggles and sliders, and whatever else carries a data-pad name. */
const PRESSABLE = 'button, label.toggle, [data-pad]';

function pressable(e: HTMLElement): boolean {
  return e.dataset.pad !== 'off' && !(e as HTMLButtonElement).disabled && e.getClientRects().length > 0;
}

/** Its data-pad name, or what it says: the same thing again after the panel is drawn anew. */
function nameOf(e: HTMLElement): string {
  return e.dataset.pad || e.textContent || '';
}

/**
 * A highlight the d-pad moves over a panel's buttons, for screens a controller cannot do with
 * one press per job (the garage, the settings); ok presses what is highlighted. The panels draw
 * themselves anew after every change, so the highlight finds its way back by name.
 */
export class PadFocus {
  private el: HTMLElement | null = null;
  private name = '';

  constructor(private readonly root: () => HTMLElement) {}

  private items(): HTMLElement[] {
    return [...this.root().querySelectorAll<HTMLElement>(PRESSABLE)].filter(pressable);
  }

  /**
   * Put the highlight back after a redraw: on the same thing if it is still there, else on the
   * one named `prefer`, else on the first.
   */
  sync(prefer = ''): void {
    const items = this.items();
    let el = this.el && this.el.isConnected && items.includes(this.el) ? this.el : null;
    el ??= items.find((e) => nameOf(e) === this.name) ?? items.find((e) => nameOf(e) === prefer) ?? items[0] ?? null;
    this.set(el);
  }

  private set(el: HTMLElement | null): void {
    for (const e of this.root().querySelectorAll('.pad-focus')) if (e !== el) e.classList.remove('pad-focus');
    this.el = el;
    if (!el) return;
    this.name = nameOf(el);
    el.classList.add('pad-focus');
    // (only for the controller: the mouse scrolls where it likes)
    if (document.body.classList.contains('pad')) el.scrollIntoView({ block: 'nearest' });
  }

  /** Off the panel, e.g. when it closes. */
  clear(): void {
    this.el?.classList.remove('pad-focus');
    this.el = null;
    this.name = '';
  }

  /** A press for the panel: a step to the nearest thing that way, or a push on what is highlighted. Returns whether it took it. */
  handle(p: PadPress): boolean {
    if (p === 'ok') {
      this.sync();
      this.el?.click();
      return true;
    }
    if (p !== 'up' && p !== 'down' && p !== 'left' && p !== 'right') return false;
    this.sync();
    if (!this.el) return true;
    // (on a slider, left and right move the slider instead of the highlight)
    const range = this.el.querySelector<HTMLInputElement>('input[type=range]');
    if (range && (p === 'left' || p === 'right')) {
      if (p === 'left') range.stepDown();
      else range.stepUp();
      range.dispatchEvent(new Event('input', { bubbles: true }));
      range.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    const from = this.el.getBoundingClientRect();
    const fx = from.left + from.width / 2, fy = from.top + from.height / 2;
    const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[p];
    let best: HTMLElement | null = null;
    let score = Infinity;
    for (const e of this.items()) {
      if (e === this.el) continue;
      const r = e.getBoundingClientRect();
      const ox = r.left + r.width / 2 - fx, oy = r.top + r.height / 2 - fy;
      // how far that way, and how far off to the side (which counts double)
      const along = ox * dx + oy * dy;
      const aside = Math.abs(ox * dy) + Math.abs(oy * dx);
      if (along <= 1) continue;
      const s = along + aside * 2;
      if (s < score) {
        score = s;
        best = e;
      }
    }
    if (best) this.set(best);
    return true;
  }
}
