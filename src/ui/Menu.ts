import { L, lang, num, switchLanguage } from '../i18n';
import { MODES, modeById, type ModeId } from '../config/modes';
import { formatMoney, stageSpeedKmh, STAGES } from '../config/tuning';
import { BRAND_COLORS, CATEGORIES, VEHICLE_ORDER, VEHICLES, type VehicleId } from '../config/vehicles';
import type { Progress } from '../sim/Progress';
import { trackOpen, TRACKS, TRAINING } from '../tracks';
import { formatTime } from './Hud';

interface MenuHandlers {
  /** Highlighted vehicle changed; it is shown even while it is still locked. */
  onVehicle(id: VehicleId): void;
  /** Highlighted track changed; it is shown even while it is still locked. */
  onTrack(id: string): void;
  onStart(): void;
  /** Into the tuning garage with the highlighted vehicle (it is unlocked). */
  onGarage(): void;
  /** The whole save as a file to download. */
  onExport(): void;
  /** A save file picked to load; resolves to a message if it was no good. */
  onImport(text: string): Promise<string | null>;
  /** A cheat code typed in; returns what it did, or null if it is not one. */
  onCheat(code: string): string | null;
}

/** Why something cannot be had yet: what the card says, and what it costs if it can be bought. */
interface Lock {
  text: string;
  price?: number;
}

/** Smallest scale of the vehicle list that is still readable and tappable. */
const MIN_ZOOM = 0.7;
const STAT_LABELS = { tempo: L('Tempo', 'Speed'), antritt: L('Antritt', 'Acceleration'), wendig: L('Wendigkeit', 'Agility'), standfest: L('Standfest', 'Stability') } as const;
const TUTORIAL_LOCK = L('🔒 Erst durch den Reha-Parcours', '🔒 Finish the Rehab Course first');

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/**
 * Start screen: pick a vehicle, a mode and a track, unlock them with Schrauben, go. Whatever
 * is highlighted is shown behind the menu, bought or not; only "Los!" needs both to be had.
 */
export class Menu {
  private readonly root = document.getElementById('menu')!;
  private readonly money = h('b');
  private readonly detail = h('div', 'detail');
  private readonly vehicleList = h('div', 'garage');
  /** Zoomed wrapper inside the list, so the whole garage fits without scrolling. */
  private readonly vehicleCards = h('div');
  private readonly modeList = h('div', 'modes');
  private readonly modeBlurb = h('p', 'mode-blurb');
  /** The current mode; tapped, it opens the list of modes in place of the tracks. */
  private readonly modeButton = h('button', 'mode-pick');
  private readonly trackHead = h('h2', '', L('Strecke', 'Track'));
  /** Whether the mode list is open (and the tracks are put away meanwhile). */
  private choosingMode = false;
  private readonly trackList = h('div', 'cards tracks');
  private readonly start = h('button', 'start', L('Los!', 'Go!'));
  private readonly ghost = h('input');
  private readonly garage = h('button', 'garage-btn', '🔧 Garage');
  private readonly buyVehicle = h('button', 'unlock');
  private readonly buyTrack = h('button', 'unlock');
  /** Answer to the last save or cheat action, shown in the header for a moment. */
  private readonly note = h('span', 'note');
  private noteTimer = 0;
  /** What the cursor is on; may be locked. */
  private vehicle: VehicleId;
  private track: string;

  constructor(private readonly progress: Progress, private readonly handlers: MenuHandlers) {
    this.vehicle = progress.vehicle;
    this.track = progress.track || TRACKS[0].id;

    const head = h('header');
    head.append(h('h1', '', 'Tempo6'), h('p', 'tagline', L('Verdien dir Schrauben. Tune dein Gefährt. Werde zu schnell.', 'Earn screws. Tune your ride. Get too fast.')));
    const purse = h('p', 'purse', '🔩 ');
    purse.append(this.money);
    // whether the best lap drives along
    const shadow = h('label', 'who');
    this.ghost.type = 'checkbox';
    this.ghost.addEventListener('change', () => {
      progress.showGhost = this.ghost.checked;
      progress.save();
    });
    shadow.append(this.ghost, L(' Schatten', ' Ghost'));
    shadow.title = L('Die Bestzeit fährt als Schatten mit (Taste G)', 'Your best lap drives along as a ghost (key G)');
    head.append(shadow, this.tools(), purse);

    const left = h('section', 'col');
    this.vehicleList.append(this.vehicleCards);
    left.append(this.vehicleList);
    this.garage.title = L('Gefährt in der Werkstatt ansehen und tunen (T)', 'Look at your ride in the workshop and tune it (T)');
    this.garage.addEventListener('click', () => this.openGarage());
    this.buyVehicle.addEventListener('click', () => this.unlockVehicle());
    this.buyTrack.addEventListener('click', () => this.unlockTrack());
    const right = h('section', 'col');
    this.modeButton.addEventListener('click', () => {
      this.choosingMode = true;
      this.render();
    });
    right.append(h('h2', '', L('Modus', 'Mode')), this.modeButton, this.modeList, this.modeBlurb, this.trackHead, this.trackList, this.buyTrack, this.start);
    const hint = h('p', 'keys');
    hint.innerHTML = L('<kbd>A</kbd><kbd>D</kbd> Gefährt · <kbd>T</kbd> Garage · <kbd>Q</kbd><kbd>E</kbd> Modus · <kbd>W</kbd><kbd>S</kbd> Strecke · <kbd>Enter</kbd> Los', '<kbd>A</kbd><kbd>D</kbd> ride · <kbd>T</kbd> garage · <kbd>Q</kbd><kbd>E</kbd> mode · <kbd>W</kbd><kbd>S</kbd> track · <kbd>Enter</kbd> go');
    right.append(hint);
    this.root.append(head, left, this.detail, right);

    this.start.addEventListener('click', () => this.go());
    new ResizeObserver(() => this.fit()).observe(this.root);
    window.addEventListener('keydown', (e) => {
      // (typing a cheat code is not steering the menu)
      if (this.root.hidden || e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return;
      const step = (list: readonly string[], cur: string, d: number) => list[(list.indexOf(cur) + d + list.length) % list.length];
      switch (e.code) {
        case 'KeyA': case 'ArrowLeft': this.pickVehicle(step(VEHICLE_ORDER, this.vehicle, -1) as VehicleId); break;
        case 'KeyD': case 'ArrowRight': this.pickVehicle(step(VEHICLE_ORDER, this.vehicle, 1) as VehicleId); break;
        case 'KeyW': case 'ArrowUp': this.pickTrack(step(this.tracksOfMode(), this.track, -1)); break;
        case 'KeyS': case 'ArrowDown': this.pickTrack(step(this.tracksOfMode(), this.track, 1)); break;
        case 'KeyQ': this.pickMode(step(MODES.map((m) => m.id), this.mode.id, -1) as ModeId); break;
        case 'KeyE': this.pickMode(step(MODES.map((m) => m.id), this.mode.id, 1) as ModeId); break;
        case 'Enter': case 'Space': this.go(); break;
        case 'KeyT': this.openGarage(); break;
        default: return;
      }
      e.preventDefault();
      // Keep the driving controls from seeing the key that started the race.
      e.stopImmediatePropagation();
    }, true);
  }

  /** Save to a file, load from one, and the box for cheat codes. */
  private tools(): HTMLElement {
    const box = h('div', 'tools');
    const save = h('button', 'tool', L('💾 Speichern', '💾 Save'));
    save.title = L('Spielstand als Datei herunterladen. Bleibt, auch wenn der Browser seine Daten löscht.', 'Download your progress as a file. It stays even if the browser clears its data.');
    save.addEventListener('click', () => this.handlers.onExport());
    const file = h('input');
    file.type = 'file';
    file.accept = '.json,application/json';
    file.hidden = true;
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      file.value = '';
      if (f) this.say((await this.handlers.onImport(await f.text())) ?? '');
    });
    const load = h('button', 'tool', L('📂 Laden', '📂 Load'));
    load.title = L('Einen gespeicherten Spielstand laden', 'Load a saved game');
    load.addEventListener('click', () => file.click());
    const cheat = h('form', 'cheat');
    const code = h('input');
    code.placeholder = L('Cheatcode', 'Cheat code');
    code.size = 9;
    code.autocomplete = 'off';
    const ok = h('button', 'tool', '🎮');
    ok.title = L('Cheatcode eingeben', 'Enter a cheat code');
    cheat.append(code, ok);
    cheat.addEventListener('submit', (e) => {
      e.preventDefault();
      const said = this.handlers.onCheat(code.value);
      code.value = '';
      code.blur();
      this.say(said ?? L('Nichts passiert.', 'Nothing happens.'));
      this.render();
    });
    box.append(save, load, file, cheat);
    // full screen, held sideways where the phone allows it
    if (document.fullscreenEnabled) {
      const full = h('button', 'tool', L('⛶ Vollbild', '⛶ Full screen'));
      full.title = L('Vollbild an oder aus', 'Full screen on or off');
      full.addEventListener('click', async () => {
        if (document.fullscreenElement) return void document.exitFullscreen();
        await document.documentElement.requestFullscreen().catch(() => {});
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {});
      });
      box.append(full);
    }
    // the other language, one tap away
    const other = h('button', 'tool', L('🌐 English', '🌐 Deutsch'));
    other.title = L('Switch to English', 'Auf Deutsch umstellen');
    other.addEventListener('click', () => switchLanguage(lang === 'de' ? 'en' : 'de'));
    box.append(other, this.note);
    return box;
  }

  /** A short message in the header, e.g. what the last cheat or the tutorial did. */
  say(text: string, seconds = 4): void {
    this.note.textContent = text;
    clearTimeout(this.noteTimer);
    this.noteTimer = window.setTimeout(() => (this.note.textContent = ''), seconds * 1000);
  }

  /** The mode in play: before the tutorial is done that is always the time trial. */
  private get mode() {
    return modeById(this.progress.tutorialDone ? this.progress.mode : 'time');
  }

  private openGarage(): void {
    if (this.vehicleOpen(this.vehicle)) this.handlers.onGarage();
    else this.nope(this.garage);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(): void {
    this.root.hidden = false;
    this.vehicle = this.progress.vehicle;
    this.track = this.progress.track || TRACKS[0].id;
    this.render();
  }

  hide(): void {
    this.root.hidden = true;
  }

  private vehicleOpen(id: VehicleId): boolean {
    return this.progress.isUnlocked(id, VEHICLES[id].unlockPrice);
  }

  private modeLock(id: ModeId): Lock | null {
    return id === 'time' || this.progress.tutorialDone ? null : { text: TUTORIAL_LOCK };
  }

  /**
   * What keeps a track shut, or null if it is open. Until the tutorial is over only the
   * Reha-Parcours is; after it, a track is bought with Schrauben unless it is free.
   */
  private trackLock(id: string): Lock | null {
    if (trackOpen(this.progress, id)) return null;
    if (!this.progress.tutorialDone) return { text: TUTORIAL_LOCK };
    return this.priced(TRACKS.find((t) => t.id === id)!.unlockPrice);
  }

  private vehicleLock(id: VehicleId): Lock | null {
    return this.vehicleOpen(id) ? null : this.priced(VEHICLES[id].unlockPrice);
  }

  private priced(price: number): Lock {
    return { text: `🔒 ${formatMoney(price)}`, price };
  }

  /** The same look for anything locked: greyed out, a padlock, and the price if it has one. */
  private lockCard(b: HTMLElement, lock: Lock | null): void {
    if (!lock) return;
    b.classList.add('locked');
    // enough Schrauben to buy it right now
    if (lock.price !== undefined && this.progress.money >= lock.price) b.classList.add('can');
    b.append(h('em', 'lock', lock.text));
  }

  private pickVehicle(id: VehicleId): void {
    this.vehicle = id;
    this.handlers.onVehicle(id);
    // a vehicle that still has its throttle in goes through training first
    if (!this.progress.trained(id) && this.vehicleOpen(id) && this.track !== TRAINING) this.pickTrack(TRAINING);
    this.render();
  }

  private pickMode(id: ModeId): void {
    if (this.modeLock(id)) return this.nope(this.choosingMode ? this.modeList : this.start);
    this.progress.mode = id;
    this.progress.save();
    // chosen: the list goes, the tracks come back
    this.choosingMode = false;
    // the track goes along if the mode has it, else the mode's first
    const tracks = this.tracksOfMode();
    this.pickTrack(tracks.includes(this.track) ? this.track : tracks[0]);
  }

  /** The mode's tracks, cheapest first: the free ones at the top, the dearest at the bottom. */
  private tracksOfMode(): string[] {
    const price = (id: string) => TRACKS.find((t) => t.id === id)?.unlockPrice ?? 0;
    return [...this.mode.tracks].sort((a, b) => price(a) - price(b));
  }

  private pickTrack(id: string): void {
    this.track = id;
    this.handlers.onTrack(id);
    this.render();
  }

  private unlockVehicle(): void {
    const v = VEHICLES[this.vehicle];
    if (this.progress.unlock(v.id, v.unlockPrice)) this.pickVehicle(v.id);
    else this.nope(this.buyVehicle);
  }

  private unlockTrack(): void {
    const lock = this.trackLock(this.track);
    if (lock?.price !== undefined && this.progress.unlock(this.track, lock.price)) this.pickTrack(this.track);
    else this.nope(this.buyTrack);
  }

  /** Only with a vehicle and a track that are both had. */
  private get ready(): boolean {
    return this.vehicleOpen(this.vehicle) && !this.trackLock(this.track) && !this.modeLock(this.mode.id);
  }

  private go(): void {
    if (this.ready) this.handlers.onStart();
    else this.nope(this.start);
  }

  private nope(button: HTMLElement): void {
    button.classList.remove('nope');
    void button.offsetWidth;
    button.classList.add('nope');
  }

  /** Shrink the vehicle list until it fits its column; below MIN_ZOOM it scrolls instead. */
  private fit(): void {
    const s = this.vehicleCards.style;
    s.zoom = '1';
    const natural = this.vehicleCards.offsetHeight;
    const room = this.vehicleList.clientHeight;
    if (natural > room && room > 0) s.zoom = String(Math.max(MIN_ZOOM, (room - 1) / natural));
    this.vehicleList.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  }

  /** The button that buys a locked thing, or nothing if there is nothing to buy. */
  private unlockButton(b: HTMLButtonElement, name: string, lock: Lock | null): void {
    b.hidden = lock?.price === undefined;
    if (lock?.price === undefined) return;
    b.textContent = L(`🔓 ${name} freischalten · ${formatMoney(lock.price)}`, `🔓 Unlock ${name} · ${formatMoney(lock.price)}`);
    b.classList.toggle('can', this.progress.money >= lock.price);
  }

  private render(): void {
    this.money.textContent = formatMoney(this.progress.money);
    this.ghost.checked = this.progress.showGhost;
    const mode = this.mode;

    this.vehicleCards.replaceChildren(
      ...CATEGORIES.flatMap((cat) => {
        const cards = h('div', 'cards');
        for (const id of cat.vehicles) {
          const v = VEHICLES[id];
          const b = h('button', `card${id === this.vehicle ? ' on' : ''}`);
          b.style.setProperty('--tint', `#${BRAND_COLORS[v.brand].toString(16).padStart(6, '0')}`);
          b.append(h('strong', '', v.label));
          this.lockCard(b, this.vehicleLock(id));
          b.addEventListener('click', () => this.pickVehicle(id));
          cards.append(b);
        }
        return [h('h2', '', cat.title), cards];
      }),
    );
    const v = VEHICLES[this.vehicle];
    const stats = h('dl');
    for (const key of Object.keys(STAT_LABELS) as (keyof typeof STAT_LABELS)[]) {
      const bar = h('dd');
      for (let i = 1; i <= 5; i++) bar.append(h('i', i <= v.stats[key] ? 'on' : ''));
      stats.append(h('dt', '', STAT_LABELS[key]), bar);
    }
    const profile = v.profiles[this.progress.profiles[v.id] ?? 0] ?? v.profiles[0];
    const stageNo = this.progress.stageOf(v.id);
    const stage = STAGES[stageNo];
    const top = stageSpeedKmh(stage, v.speedFactor * profile.speed);
    const lockV = this.vehicleLock(this.vehicle);
    this.unlockButton(this.buyVehicle, v.label, lockV);
    this.garage.disabled = !!lockV;
    const actions = h('div', 'actions');
    actions.append(this.garage, this.buyVehicle);
    this.detail.replaceChildren(
      h('h3', '', v.label),
      h('p', 'kind', `${v.kind} · ${L('Fahrprofile', 'Driving profiles')}: ${v.profiles.map((p) => p.name).join(', ')}`),
      h('p', '', v.blurb),
      stats,
      actions,
      h('p', 'kind', L(`Aktuell ${num(top)} km/h · Tuning-Stufe ${stageNo}: ${stage.name} · Fahrprofil: ${profile.name}`, `Now ${num(top)} km/h · tuning stage ${stageNo}: ${stage.name} · driving profile: ${profile.name}`)),
    );

    const modeButtons = (list: typeof MODES) => list.map((m) => {
        const lock = this.modeLock(m.id);
        const b = h('button', `mode${m.id === mode.id ? ' on' : ''}`);
        b.append(h('strong', '', lock ? `🔒 ${m.name}` : m.name), h('span', '', m.blurb));
        if (lock) {
          b.classList.add('locked');
          b.title = lock.text;
        }
        b.addEventListener('click', () => this.pickMode(m.id));
        return b;
      });
    // (what is still being tried out sits apart, under its own label)
    const trial = h('div', 'trial');
    trial.append(h('small', '', L('Experimentell', 'Experimental')), ...modeButtons(MODES.filter((m) => m.experimental)));
    const back = h('button', 'mode-back', L('← Zurück', '← Back'));
    back.addEventListener('click', () => {
      this.choosingMode = false;
      this.render();
    });
    this.modeList.replaceChildren(...modeButtons(MODES.filter((m) => !m.experimental)), trial, back);
    this.modeButton.replaceChildren(h('strong', '', mode.name), h('span', '', L('Modus wechseln ▾', 'Change mode ▾')));
    this.modeBlurb.textContent = mode.blurb;
    // never both lists at once: either the modes, or the tracks with everything that goes with them
    const choosing = this.choosingMode;
    this.modeList.hidden = !choosing;
    this.modeButton.hidden = choosing;
    for (const e of [this.modeBlurb, this.trackHead, this.trackList, this.start]) e.hidden = choosing;

    this.trackList.replaceChildren(
      ...this.tracksOfMode().map((id) => {
        const t = TRACKS.find((x) => x.id === id)!;
        const lock = this.trackLock(t.id);
        const b = h('button', `card${t.id === this.track ? ' on' : ''}`);
        b.append(h('strong', '', t.name), h('span', '', t.blurb));
        if (!lock) b.append(h('em', '', this.record(mode.id, t.id)));
        this.lockCard(b, lock);
        // the chosen track shows who is fastest on it
        if (t.id === this.track && !lock && mode.id === 'time') {
          const board = h('ol', 'board');
          for (const e of (this.progress.boards[t.id] ?? []).slice(0, 3)) {
            board.append(h('li', '', `${formatTime(e.time)} · ${L('Du', 'You')} · ${VEHICLES[e.vehicle].label} · ${L('Stufe', 'stage')} ${e.stage}`));
          }
          if (board.children.length) b.append(board);
        }
        b.addEventListener('click', () => this.pickTrack(t.id));
        return b;
      }),
    );
    const t = TRACKS.find((x) => x.id === this.track);
    this.unlockButton(this.buyTrack, t?.name ?? '', this.trackLock(this.track));
    if (this.choosingMode) this.buyTrack.hidden = true;
    this.start.disabled = !this.ready;
    this.fit();
    // (the chosen track scrolls into view, as the chosen vehicle does)
    this.trackList.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  }

  /** The best a track has seen in a mode, for its card. */
  private record(mode: ModeId, track: string): string {
    const r = this.progress.records[`${mode}:${track}`];
    switch (mode) {
      case 'time': return `${L('Bestzeit', 'Best lap')} ${formatTime(this.progress.bestLaps[track] ?? null)}`;
      case 'race': return r ? L(`Bester Platz ${r}`, `Best place ${r}`) : L('Noch kein Rennen', 'No race yet');
      case 'freestyle': return r ? L(`Beste Kette ${formatMoney(r)}`, `Best chain ${formatMoney(r)}`) : L('Noch keine Kette', 'No chain yet');
      case 'crash': return r ? L(`Teuerster Crash ${r} Punkte`, `Costliest crash ${r} points`) : L('Noch kein Crash', 'No crash yet');
    }
  }
}
