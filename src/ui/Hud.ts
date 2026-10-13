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
  private readonly lapTime = el('lap-time');
  private readonly lapBest = el('lap-best');
  private readonly money = el('money');
  private readonly stageNo = el('stage-no');
  private readonly stage = el('stage');
  private readonly tune = el<HTMLButtonElement>('tune');
  private readonly toastEl = el('toast');
  private readonly flipped = el('flipped');
  private readonly wrecked = el('wrecked');
  private readonly damageRow = el('damage-row');
  private readonly damageBar = el('damage-bar');
  private readonly damageText = el('damage-text');
  private readonly boostRow = el('boost-row');
  private readonly boostBar = el('boost-bar');
  private readonly buyBoost = el<HTMLButtonElement>('buy-boost');
  private toastTimer = 0;
  private readonly pending = el('pending');
  private readonly stuntEl = el('stunt');
  private stuntTimer = 0;

  constructor(onTune: () => void, onBuyBoost: () => void) {
    this.tune.addEventListener('click', () => {
      onTune();
      this.tune.blur();
    });
    this.buyBoost.addEventListener('click', () => {
      onBuyBoost();
      this.buyBoost.blur();
    });
  }

  private set(e: HTMLElement, text: string): void {
    if (this.cache.get(e) === text) return;
    this.cache.set(e, text);
    e.textContent = text;
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

  /** A short line for a stunt just done; it does not get in the way like a toast. */
  stunt(text: string): void {
    this.stuntEl.textContent = text;
    this.stuntEl.classList.add('show');
    clearTimeout(this.stuntTimer);
    this.stuntTimer = window.setTimeout(() => this.stuntEl.classList.remove('show'), 1400);
  }

  update(core: GameCore): void {
    const { progress, race, sim } = core;
    // what the lap has earned so far and is not safe yet
    const open = Math.round(core.stunts.pending);
    this.pending.hidden = open === 0 && core.stunts.chain === 0;
    this.set(this.pending, `+${open} offen${core.stunts.multiplier > 1 ? ` · ×${core.stunts.multiplier.toFixed(1).replace('.', ',')}` : ''}`);
    const kmh = Math.abs(sim.vehicle.speed) * 3.6;
    const stage = progress.stage;
    this.set(this.speed, kmh.toFixed(1).replace('.', ','));
    this.speedBar.style.width = `${Math.min(100, (kmh / core.topSpeedKmh) * 100).toFixed(0)}%`;
    const top = core.topSpeedKmh;
    this.set(this.top, top.toFixed(top % 1 ? 1 : 0).replace('.', ','));
    this.set(this.vehicle, sim.vehicle.spec.label);
    this.set(this.lapTime, race.running ? formatTime(race.lapTime) : '–');
    this.set(this.lapBest, formatTime(race.best));
    this.set(this.money, formatMoney(progress.money));
    this.set(this.stageNo, String(progress.stageIndex));
    this.set(this.stage, stage.name);

    const next = progress.nextStage;
    if (!next) {
      this.set(this.tune, 'Ausgetunt. Mehr geht nicht. Noch nicht.');
      this.tune.disabled = true;
    } else {
      const missing = next.price - progress.money;
      this.set(
        this.tune,
        missing <= 0
          ? `[T] ${next.name} → ${next.topSpeedKmh} km/h (${formatMoney(next.price)})`
          : `${next.name} → ${next.topSpeedKmh} km/h · noch ${formatMoney(missing)}`,
      );
      this.tune.disabled = false;
    }
    this.tune.classList.toggle('ready', progress.canTune);
    const v = sim.vehicle;
    this.wrecked.hidden = !v.wrecked;
    this.flipped.hidden = v.wrecked || core.flippedFor < 1;
    // how much of the vehicle is left
    this.damageRow.hidden = v.damage === 0;
    if (v.damage > 0) {
      this.damageBar.style.width = `${((1 - v.damage) * 100).toFixed(0)}%`;
      this.set(this.damageText, v.wrecked ? 'Schrott' : `${Math.round(v.damage * 100)} % Schaden`);
      this.damageRow.classList.toggle('low', v.impaired > 0);
    }
    this.boostRow.hidden = !v.boostFitted;
    if (v.boostFitted) {
      this.boostBar.style.width = `${(v.boostCharge * 100).toFixed(0)}%`;
      this.boostRow.classList.toggle('on', v.boosting);
      this.boostRow.classList.toggle('low', !v.boosting && v.boostCharge < BOOST.minCharge);
    }
    this.buyBoost.hidden = v.boostFitted;
    if (!v.boostFitted) {
      const missing = BOOST.price - progress.money;
      this.set(this.buyBoost, missing <= 0 ? `[K] Autobatterie: Boost! (${formatMoney(BOOST.price)})` : `Autobatterie (Boost) · noch ${formatMoney(missing)}`);
      this.buyBoost.classList.toggle('ready', missing <= 0);
    }
  }
}
