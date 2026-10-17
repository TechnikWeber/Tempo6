import { L, num } from '../i18n';
import { BOOST, formatMoney, stageSpeedKmh, STAGES } from '../config/tuning';
import type { PadPress } from '../input/pads';
import type { GameCore } from '../sim/GameCore';
import { PadFocus } from './PadFocus';
import { fillPadHints, keyName } from './prompts';

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
  /** The controller's highlight: one thing at a time, ok takes it. */
  private readonly focus = new PadFocus(() => this.root);

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
    this.focus.clear();
    this.render();
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** A press on the controller: the d-pad goes through what can be had, ok takes it, back leaves. */
  pad(p: PadPress): void {
    if (p === 'back' || p === 'north') this.handlers.back();
    else this.focus.handle(p);
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
      if (e.type === 'broke') this.said = L(`Es fehlen noch ${formatMoney(e.missing)}.`, `${formatMoney(e.missing)} short.`);
      if (e.type === 'untrained') this.said = L('Erst einmal durchs Tutorial, dann geht die Drossel raus.', 'Get through the tutorial first, then the limiter comes out.');
      if (e.type === 'boostBought') this.said = L(`Autobatterie auf dem Schoß! ${keyName('boost')} halten für den Boost. Lädt beim Fahren nach, beim Bremsen schneller.`, `Car battery on the lap! Hold ${keyName('boost')} to boost. It charges as you drive, faster when braking.`);
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
    const max = progress.maxStageIndex;

    const ladder = h('ol', 'ladder');
    STAGES.forEach((s, i) => {
      const row = h('li', i === now ? 'now' : i <= max ? 'done' : i === max + 1 ? 'next' : 'later');
      row.append(h('b', '', `${i}`), h('span', 'name', s.name), h('span', 'kmh', `${stageSpeedKmh(s, factor).toFixed(0)} km/h`));
      if (i === now) row.append(h('span', 'price', L('eingebaut', 'fitted')));
      else if (i <= max) row.append(h('span', 'price', '✓'));
      else if (i === 1 && !progress.trained()) row.append(h('span', 'price', 'Tutorial'));
      else row.append(h('span', 'price', formatMoney(s.price)));
      // any stage already owned can be switched back to (or up to again) without paying twice
      if (i <= max && i !== now) {
        row.title = L('Zurück auf diese Stufe wechseln, ohne nochmal zu kaufen', 'Switch back to this stage, without buying it again');
        row.style.cursor = 'pointer';
        row.dataset.pad = `stage-${i}`;
        row.addEventListener('click', () => {
          core.setStage(i);
          this.render();
        });
      }
      ladder.append(row);
    });

    const next = progress.nextStage;
    const buy = h('button', 'buy');
    buy.dataset.pad = 'buy';
    if (!next) {
      buy.textContent = L('Ausgetunt. Mehr geht nicht. Noch nicht.', 'Fully tuned. That is all there is. For now.');
      buy.disabled = true;
    } else if (!progress.trained()) {
      buy.textContent = L('Erst durchs Tutorial', 'Finish the tutorial first');
      buy.disabled = true;
    } else {
      buy.textContent = L(`${next.name} einbauen · ${formatMoney(next.price)}`, `Fit ${next.name} · ${formatMoney(next.price)}`);
      buy.disabled = progress.money < next.price;
    }
    buy.addEventListener('click', () => this.tune());

    // owned already: a plain on/off switch, nothing more to pay; not yet owned: buy it
    const boost = h('button', 'buy boost');
    boost.dataset.pad = 'boost';
    if (progress.boostOwned) {
      boost.textContent = progress.hasBoost
        ? L('⚡ Boost-Batterie an (abklemmen)', '⚡ Boost battery on (unfit it)')
        : L('⚡ Boost-Batterie aus (wieder anklemmen)', '⚡ Boost battery off (fit it again)');
      boost.classList.toggle('on', progress.hasBoost);
      boost.addEventListener('click', () => {
        if (progress.hasBoost) core.dropBoost();
        else core.buyBoost();
        this.render();
      });
    } else {
      boost.textContent = `⚡ ${L('Boost-Batterie', 'Boost battery')} · ${formatMoney(BOOST.price)}`;
      boost.disabled = progress.money < BOOST.price;
      boost.addEventListener('click', () => this.buyBoost());
    }

    const profiles = h('div', 'profiles');
    v.spec.profiles.forEach((p, i) => {
      const b = h('button', `profile${i === core.profileIndex ? ' on' : ''}`);
      b.dataset.pad = `profile-${i}`;
      b.append(h('strong', '', p.name), h('span', '', p.blurb));
      b.addEventListener('click', () => {
        core.setProfile(i);
        this.render();
      });
      profiles.append(b);
    });

    const back = h('button', 'back', L('← Zurück', '← Back'));
    back.dataset.pad = 'back';
    back.addEventListener('click', () => this.handlers.back());
    const padHint = h('p', 'pad-only pad-hint');
    padHint.dataset.padHint = 'garage';

    const panel = h('div', 'panel');
    panel.append(
      h('h2', '', `Garage · ${v.spec.label}`),
      h('p', 'money', `🔩 ${formatMoney(progress.money)} · ${L('jetzt', 'now')} ${num(core.topSpeedKmh)} km/h`),
      ladder,
      buy,
      boost,
      h('h3', '', L('Fahrprofil', 'Driving profile')),
      profiles,
      h('p', 'said', this.said),
      back,
      padHint,
    );
    this.root.replaceChildren(panel);
    fillPadHints(this.root);
    // (back on what it was on, or on buying the next stage the first time round)
    this.focus.sync('buy');
  }
}
