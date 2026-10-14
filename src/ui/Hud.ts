import { L, num } from '../i18n';
import { RACE } from '../config/modes';
import { BOOST, formatMoney } from '../config/tuning';
import type { GameCore } from '../sim/GameCore';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function formatTime(s: number | null): string {
  if (s === null) return '–';
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, '0')}`;
}

/** DOM overlay. Only touches an element when its text actually changes. */
export class Hud {
  private readonly cache = new Map<HTMLElement, string>();
  private readonly speed = el('speed');
  private readonly speedBar = el('speed-bar');
  private readonly top = el('top');
  private readonly vehicle = el('vehicle');
  private readonly bannerEl = el('banner');
  private bannerTimer = 0;
  private readonly lapLabel = el('lap-label');
  private readonly lapSub = el('lap-sub');
  private readonly lapTime = el('lap-time');
  private readonly lapBest = el('lap-best');
  private readonly money = el('money');
  private readonly toastEl = el('toast');
  private readonly flipped = el('flipped');
  private readonly wrecked = el('wrecked');
  private readonly damageRow = el('damage-row');
  private readonly damageBar = el('damage-bar');
  private readonly damageText = el('damage-text');
  private readonly boostRow = el('boost-row');
  private readonly boostBar = el('boost-bar');
  private toastTimer = 0;
  private readonly pending = el('pending');
  private readonly stuntEl = el('stunt');
  private stuntTimer = 0;
  private readonly lightsEl = el('lights');
  private lightsTimer = 0;

  private set(e: HTMLElement, text: string): void {
    if (this.cache.get(e) === text) return;
    this.cache.set(e, text);
    e.textContent = text;
  }

  /** Big and in the middle of the screen, for the end of something. */
  banner(title: string, sub = '', seconds = 3): void {
    const b = document.createElement('b');
    b.textContent = title;
    this.bannerEl.replaceChildren(b);
    if (sub) {
      const s = document.createElement('small');
      s.textContent = sub;
      this.bannerEl.append(s);
    }
    this.bannerEl.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.bannerEl.classList.remove('show'), seconds * 1000);
  }

  hideBanner(): void {
    clearTimeout(this.bannerTimer);
    this.bannerEl.classList.remove('show');
  }

  toast(title: string, sub = '', seconds = 2.5): void {
    this.toastEl.replaceChildren(title);
    if (sub) {
      const s = document.createElement('small');
      s.textContent = sub;
      this.toastEl.append(s);
    }
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), seconds * 1000);
  }

  /** The start lights: `n` seconds to go, 0 = green. */
  lights(n: number): void {
    clearTimeout(this.lightsTimer);
    this.lightsEl.hidden = false;
    this.lightsEl.classList.toggle('go', n === 0);
    [...this.lightsEl.children].forEach((lamp, i) => lamp.classList.toggle('on', n > 0 && i <= 3 - n));
    if (n === 0) this.lightsTimer = window.setTimeout(() => (this.lightsEl.hidden = true), 900);
  }

  /** Put the lights away, e.g. when leaving for the menu mid-countdown. */
  lightsOff(): void {
    clearTimeout(this.lightsTimer);
    this.lightsEl.hidden = true;
  }

  /** A short line for a stunt just done; it does not get in the way like a toast. */
  stunt(text: string): void {
    this.stuntEl.textContent = text;
    this.stuntEl.classList.add('show');
    clearTimeout(this.stuntTimer);
    this.stuntTimer = window.setTimeout(() => this.stuntEl.classList.remove('show'), 1400);
  }

  /** The panel top left says what the mode is about: lap times, the place, the run, the score. */
  private lapPanel(core: GameCore): void {
    const { race, progress, track } = core;
    const record = progress.records[`${core.mode}:${track.id}`];
    switch (core.mode) {
      case 'time':
        this.set(this.lapLabel, L('Runde', 'Lap'));
        this.set(this.lapTime, race.running ? formatTime(race.lapTime) : '–');
        this.set(this.lapSub, L('Bestzeit', 'Best'));
        this.set(this.lapBest, formatTime(race.best));
        break;
      case 'race':
        this.set(this.lapLabel, L('Platz', 'Place'));
        this.set(this.lapTime, `${core.place} / ${core.rivals.length + 1}`);
        this.set(this.lapSub, core.finished ? L('Im Ziel', 'Finished') : `${L('Runde', 'Lap')} ${Math.min(RACE.laps, race.laps + 1)} / ${RACE.laps}`);
        this.set(this.lapBest, race.running && !core.finished ? formatTime(race.lapTime) : '');
        break;
      case 'freestyle':
        // the time left up top; the run in progress and the session so far below
        this.set(this.lapLabel, L('Noch', 'Left'));
        this.set(this.lapTime, formatTime(core.timeLeft).replace(/\.\d+$/, ''));
        this.set(this.lapSub, core.stunts.chain ? `${L('Kette', 'Chain')} +${Math.round(core.stunts.pending)} ×${num(core.stunts.multiplier)} ·` : `${L('Bisher', 'So far')}`);
        this.set(this.lapBest, core.stunts.chain ? `${core.sessionTotal}` : `${core.sessionTotal}${record ? ` / ${record}` : ''}`);
        break;
      case 'crash':
        this.set(this.lapLabel, 'Crash');
        this.set(this.lapTime, core.crash.started ? `${core.crash.score} ${L('Punkte', 'points')}` : L('Gas!', 'Floor it!'));
        this.set(this.lapSub, L('Rekord', 'Record'));
        this.set(this.lapBest, record ? `${record}` : '–');
        break;
    }
  }

  update(core: GameCore): void {
    const { progress, sim } = core;
    // what the lap has earned so far and is not safe yet
    const open = Math.round(core.stunts.pending);
    // (freestyle shows its run in the big panel, the crashtest has no tricks)
    this.pending.hidden = (open === 0 && core.stunts.chain === 0) || core.mode === 'freestyle' || core.mode === 'crash';
    this.set(this.pending, `+${open} ${L('offen', 'pending')}${core.stunts.multiplier > 1 ? ` · ×${num(core.stunts.multiplier)}` : ''}`);
    const kmh = Math.abs(sim.vehicle.speed) * 3.6;
    this.set(this.speed, num(kmh));
    this.speedBar.style.width = `${Math.min(100, (kmh / core.topSpeedKmh) * 100).toFixed(0)}%`;
    const top = core.topSpeedKmh;
    this.set(this.top, num(top, top % 1 ? 1 : 0));
    this.set(this.vehicle, sim.vehicle.spec.label);
    this.lapPanel(core);
    this.set(this.money, formatMoney(progress.money));
    const v = sim.vehicle;
    this.wrecked.hidden = !v.wrecked;
    this.flipped.hidden = v.wrecked || core.flippedFor < 1;
    // how much of the vehicle is left
    this.damageRow.hidden = v.damage === 0;
    if (v.damage > 0) {
      this.damageBar.style.width = `${((1 - v.damage) * 100).toFixed(0)}%`;
      this.set(this.damageText, v.wrecked ? L('Schrott', 'Scrap') : `${Math.round(v.damage * 100)} % ${L('Schaden', 'damage')}`);
      this.damageRow.classList.toggle('low', v.impaired > 0);
    }
    this.boostRow.hidden = !v.boostFitted;
    if (v.boostFitted) {
      this.boostBar.style.width = `${(v.boostCharge * 100).toFixed(0)}%`;
      this.boostRow.classList.toggle('on', v.boosting);
      this.boostRow.classList.toggle('low', !v.boosting && v.boostCharge < BOOST.minCharge);
    }
  }
}
