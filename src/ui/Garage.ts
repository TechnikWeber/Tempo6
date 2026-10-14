import { BOOST, formatMoney, stageSpeedKmh, STAGES } from '../config/tuning';
import type { GameCore } from '../sim/GameCore';

interface GarageHandlers {
  /** The game in the garage, with the vehicle standing in it. */
  core(): GameCore;
  back(): void;
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** The tuning garage: the vehicle on its bay, the whole ladder beside it, buy the next step. */
export class Garage {
  private readonly root = document.getElementById('garage')!;
  /** What the last purchase did. */
  private said = '';

  constructor(private readonly handlers: GarageHandlers) {
    window.addEventListener('keydown', (e) => {
      if (this.root.hidden) return;
      if (e.code === 'Escape' || e.code === 'Backspace') this.handlers.back();
      else if (e.code === 'KeyT' || e.code === 'Enter') this.tune();
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(): void {
    this.said = '';
    this.root.hidden = false;
    this.render();
  }

  hide(): void {
    this.root.hidden = true;
  }

  private tune(): void {
    const core = this.handlers.core();
    core.tune();
    this.report(core);
  }

  private buyBoost(): void {
    const core = this.handlers.core();
    core.buyBoost();
    this.report(core);
  }

  /** Turn what the purchase brought about into a line for the panel. */
  private report(core: GameCore): void {
    for (const e of core.events) {
      if (e.type === 'tuned') this.said = `${e.stage.name}! ${e.stage.blurb}`;
      if (e.type === 'broke') this.said = `Es fehlen noch ${formatMoney(e.missing)}.`;
      if (e.type === 'untrained') this.said = 'Erst einmal durch den Reha-Parcours, dann geht die Drossel raus.';
      if (e.type === 'boostBought') this.said = 'Autobatterie auf dem Schoß! Umschalt halten für den Boost.';
    }
    core.events.length = 0;
    this.render();
  }

  render(): void {
    const core = this.handlers.core();
    const { progress } = core;
    const v = core.sim.vehicle;
    const factor = v.spec.speedFactor * v.profile.speed;
    const now = progress.stageIndex;

    const ladder = h('ol', 'ladder');
    STAGES.forEach((s, i) => {
      const row = h('li', i < now ? 'done' : i === now ? 'now' : i === now + 1 ? 'next' : 'later');
      row.append(h('b', '', `${i}`), h('span', 'name', s.name), h('span', 'kmh', `${stageSpeedKmh(s, factor).toFixed(0)} km/h`));
      if (i <= now) row.append(h('span', 'price', i === now ? 'eingebaut' : '✓'));
      else if (i === 1 && !progress.trained()) row.append(h('span', 'price', 'Reha-Parcours'));
      else row.append(h('span', 'price', formatMoney(s.price)));
      ladder.append(row);
    });

    const next = progress.nextStage;
    const buy = h('button', 'buy');
    if (!next) {
      buy.textContent = 'Ausgetunt. Mehr geht nicht. Noch nicht.';
      buy.disabled = true;
    } else if (!progress.trained()) {
      buy.textContent = 'Erst durch den Reha-Parcours';
      buy.disabled = true;
    } else {
      buy.textContent = `${next.name} einbauen · ${formatMoney(next.price)}`;
      buy.disabled = progress.money < next.price;
    }
    buy.addEventListener('click', () => this.tune());

    const boost = h('button', 'buy boost');
    if (progress.hasBoost) {
      boost.textContent = '⚡ Boost-Batterie eingebaut';
      boost.disabled = true;
    } else {
      boost.textContent = `⚡ Boost-Batterie · ${formatMoney(BOOST.price)}`;
      boost.disabled = progress.money < BOOST.price;
    }
    boost.addEventListener('click', () => this.buyBoost());

    const profiles = h('div', 'profiles');
    v.spec.profiles.forEach((p, i) => {
      const b = h('button', `profile${i === core.profileIndex ? ' on' : ''}`);
      b.append(h('strong', '', p.name), h('span', '', p.blurb));
      b.addEventListener('click', () => {
        core.setProfile(i);
        this.render();
      });
      profiles.append(b);
    });

    const back = h('button', 'back', '← Zurück');
    back.addEventListener('click', () => this.handlers.back());

    const panel = h('div', 'panel');
    panel.append(
      h('h2', '', `Garage · ${v.spec.label}`),
      h('p', 'money', `🔩 ${formatMoney(progress.money)} · jetzt ${core.topSpeedKmh.toFixed(1).replace('.', ',')} km/h`),
      ladder,
      buy,
      boost,
      h('h3', '', 'Fahrprofil'),
      profiles,
      h('p', 'said', this.said),
      back,
    );
    this.root.replaceChildren(panel);
  }
}
