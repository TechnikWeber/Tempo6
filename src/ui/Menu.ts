import { formatMoney } from '../config/tuning';
import { VEHICLE_ORDER, VEHICLES, type VehicleId } from '../config/vehicles';
import type { Progress } from '../sim/Progress';
import { TRACKS } from '../tracks';
import { formatTime } from './Hud';

interface MenuHandlers {
  /** Highlighted vehicle changed (it is unlocked). */
  onVehicle(id: VehicleId): void;
  /** Highlighted track changed (it is unlocked). */
  onTrack(id: string): void;
  onStart(): void;
}

const STAT_LABELS = { tempo: 'Tempo', antritt: 'Antritt', wendig: 'Wendigkeit', standfest: 'Standfest' } as const;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** Start screen: pick a vehicle and a level, unlock them with Pfand, go. */
export class Menu {
  private readonly root = document.getElementById('menu')!;
  private readonly money = h('b');
  private readonly detail = h('div', 'detail');
  private readonly vehicleList = h('div', 'cards');
  private readonly trackList = h('div', 'cards tracks');
  private readonly start = h('button', 'start');
  /** What the cursor is on; may be locked, unlike the progress selection. */
  private vehicle: VehicleId;
  private track: string;

  constructor(private readonly progress: Progress, private readonly handlers: MenuHandlers) {
    this.vehicle = progress.vehicle;
    this.track = progress.track || TRACKS[0].id;

    const head = h('header');
    head.append(h('h1', '', 'Tempo6'), h('p', 'tagline', 'Sammle Pfand. Tune dein Gefährt. Werde zu schnell.'));
    const purse = h('p', 'purse', 'Pfand ');
    purse.append(this.money);
    head.append(purse);

    const left = h('section', 'col');
    left.append(h('h2', '', 'Gefährt'), this.vehicleList, this.detail);
    const right = h('section', 'col');
    right.append(h('h2', '', 'Strecke'), this.trackList, this.start);
    const hint = h('p', 'keys');
    hint.innerHTML = '<kbd>A</kbd><kbd>D</kbd> Gefährt · <kbd>W</kbd><kbd>S</kbd> Strecke · <kbd>Enter</kbd> Los';
    right.append(hint);
    this.root.append(head, left, right);

    this.start.addEventListener('click', () => this.go());
    window.addEventListener('keydown', (e) => {
      if (this.root.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
      const step = (list: readonly string[], cur: string, d: number) => list[(list.indexOf(cur) + d + list.length) % list.length];
      const tracks = TRACKS.map((t) => t.id);
      switch (e.code) {
        case 'KeyA': case 'ArrowLeft': this.pickVehicle(step(VEHICLE_ORDER, this.vehicle, -1) as VehicleId); break;
        case 'KeyD': case 'ArrowRight': this.pickVehicle(step(VEHICLE_ORDER, this.vehicle, 1) as VehicleId); break;
        case 'KeyW': case 'ArrowUp': this.pickTrack(step(tracks, this.track, -1)); break;
        case 'KeyS': case 'ArrowDown': this.pickTrack(step(tracks, this.track, 1)); break;
        case 'Enter': case 'Space': this.go(); break;
        default: return;
      }
      e.preventDefault();
      // Keep the driving controls from seeing the key that started the race.
      e.stopImmediatePropagation();
    }, true);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(): void {
    this.root.hidden = false;
    this.vehicle = this.progress.vehicle;
    this.render();
  }

  hide(): void {
    this.root.hidden = true;
  }

  private vehicleOpen(id: VehicleId): boolean {
    return this.progress.isUnlocked(id, VEHICLES[id].unlockPrice);
  }

  private trackOpen(id: string): boolean {
    return this.progress.isUnlocked(id, TRACKS.find((t) => t.id === id)!.unlockPrice);
  }

  private pickVehicle(id: VehicleId): void {
    this.vehicle = id;
    if (this.vehicleOpen(id)) this.handlers.onVehicle(id);
    this.render();
  }

  private pickTrack(id: string): void {
    this.track = id;
    if (this.trackOpen(id)) this.handlers.onTrack(id);
    this.render();
  }

  /** Start, or buy whatever is still locked in the current selection. */
  private go(): void {
    const v = VEHICLES[this.vehicle];
    const t = TRACKS.find((x) => x.id === this.track)!;
    if (!this.vehicleOpen(v.id)) {
      if (this.progress.unlock(v.id, v.unlockPrice)) this.pickVehicle(v.id);
      else this.nope();
      return;
    }
    if (!this.trackOpen(t.id)) {
      if (this.progress.unlock(t.id, t.unlockPrice)) this.pickTrack(t.id);
      else this.nope();
      return;
    }
    this.handlers.onStart();
  }

  private nope(): void {
    this.start.classList.remove('nope');
    void this.start.offsetWidth;
    this.start.classList.add('nope');
  }

  private render(): void {
    this.money.textContent = formatMoney(this.progress.money);

    this.vehicleList.replaceChildren(
      ...VEHICLE_ORDER.map((id) => {
        const v = VEHICLES[id];
        const open = this.vehicleOpen(id);
        const b = h('button', `card${id === this.vehicle ? ' on' : ''}${open ? '' : ' locked'}`);
        b.style.setProperty('--tint', `#${v.colors.accent.toString(16).padStart(6, '0')}`);
        b.append(h('small', '', v.maker), h('strong', '', v.label));
        if (!open) b.append(h('em', '', `🔒 ${formatMoney(v.unlockPrice)}`));
        b.addEventListener('click', () => this.pickVehicle(id));
        return b;
      }),
    );

    const v = VEHICLES[this.vehicle];
    const stats = h('dl');
    for (const key of Object.keys(STAT_LABELS) as (keyof typeof STAT_LABELS)[]) {
      const bar = h('dd');
      for (let i = 1; i <= 5; i++) bar.append(h('i', i <= v.stats[key] ? 'on' : ''));
      stats.append(h('dt', '', STAT_LABELS[key]), bar);
    }
    const top = this.progress.stage.topSpeedKmh * v.speedFactor;
    this.detail.replaceChildren(
      h('h3', '', `${v.maker} ${v.label}`),
      h('p', 'kind', v.kind),
      h('p', '', v.blurb),
      stats,
      h('p', 'kind', `Aktuell ${top.toFixed(1).replace('.', ',')} km/h · Tuning-Stufe ${this.progress.stageIndex}: ${this.progress.stage.name}`),
    );

    this.trackList.replaceChildren(
      ...TRACKS.map((t) => {
        const open = this.trackOpen(t.id);
        const b = h('button', `card${t.id === this.track ? ' on' : ''}${open ? '' : ' locked'}`);
        b.append(h('strong', '', t.name), h('span', '', t.blurb));
        const best = this.progress.bestLaps[t.id];
        b.append(h('em', '', open ? `Bestzeit ${formatTime(best ?? null)}` : `🔒 ${formatMoney(t.unlockPrice)}`));
        b.addEventListener('click', () => this.pickTrack(t.id));
        return b;
      }),
    );

    const lockedV = !this.vehicleOpen(this.vehicle);
    const lockedT = !this.trackOpen(this.track);
    const t = TRACKS.find((x) => x.id === this.track)!;
    this.start.textContent = lockedV
      ? `${v.label} freischalten (${formatMoney(v.unlockPrice)})`
      : lockedT
        ? `${t.name} freischalten (${formatMoney(t.unlockPrice)})`
        : 'Los!';
    this.start.classList.toggle('buy', lockedV || lockedT);
  }
}
