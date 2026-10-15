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
  /** Dev mode on or off: it makes the workshop (F2) available. */
  onDevMode(on: boolean): void;
  /** Everything bought and tuned all the way, to try things out; returns what it did. */
  onUnlockAll(): string;
}

/** Why something cannot be had yet: what the card says, and what it costs if it can be bought. */
interface Lock {
  text: string;
  price?: number;
}

const STAT_LABELS = { tempo: L('Tempo', 'Speed'), antritt: L('Antritt', 'Acceleration'), wendig: L('Wendigkeit', 'Agility'), standfest: L('Standfest', 'Stability') } as const;
const TUTORIAL_LOCK = L('🔒 Erst durchs Tutorial', '🔒 Finish the tutorial first');

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
  /** The vehicle picker: arrows either side of category and name, the categories, the rides in it. */
  private readonly pickerName = h('div', 'picked');
  private readonly rides = h('div', 'chips rides');
  private readonly modeList = h('div', 'modes');
  private readonly modeBlurb = h('p', 'mode-blurb');
  /** The current mode; tapped, it opens the list of modes in place of the tracks. */
  private readonly modeButton = h('button', 'mode-pick');
  private readonly trackHead = h('h2', 'track-head', L('Strecke', 'Track'));
  /** Whether the mode list is open (and the tracks are put away meanwhile). */
  private choosingMode = false;
  private readonly trackList = h('div', 'cards tracks');
  private readonly start = h('button', 'start', L('Los!', 'Go!'));
  private readonly ghost = h('input');
  private readonly dev = h('input');
  private readonly garage = h('button', 'garage-btn', '🔧 Garage');
  private readonly buyVehicle = h('button', 'unlock');
  private readonly buyTrack = h('button', 'unlock');
  /** Answer to the last save or settings action, shown in the header for a moment. */
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
    head.append(purse);

    // One ride at a time: arrows to step through them (beside the vehicle itself as well), the
    // categories to jump between, and the rides of the current one.
    const left = h('section', 'col');
    const prev = h('button', 'arrow', '‹'), next = h('button', 'arrow', '›');
    prev.title = next.title = L('Gefährt wechseln (A/D)', 'Change ride (A/D)');
    prev.addEventListener('click', () => this.stepVehicle(-1));
    next.addEventListener('click', () => this.stepVehicle(1));
    const picker = h('div', 'picker');
    picker.append(prev, this.pickerName, next);
    left.append(h('h2', '', L('Gefährt', 'Ride')), picker, this.rides, this.detail);
    const bigPrev = h('button', 'stage-arrow left', '‹'), bigNext = h('button', 'stage-arrow right', '›');
    bigPrev.title = bigNext.title = prev.title;
    bigPrev.addEventListener('click', () => this.stepVehicle(-1));
    bigNext.addEventListener('click', () => this.stepVehicle(1));
    this.garage.title = L('Gefährt in der Werkstatt ansehen und tunen (T)', 'Look at your ride in the workshop and tune it (T)');
    this.garage.addEventListener('click', () => this.openGarage());
    this.buyVehicle.addEventListener('click', () => this.unlockVehicle());
    this.buyTrack.addEventListener('click', () => this.unlockTrack());
    const right = h('section', 'col');
    this.modeButton.addEventListener('click', () => {
      this.choosingMode = true;
      this.render();
    });
    // the track header carries arrows to step through the tracks, for touch
    const up = h('button', 'step', '▲'), down = h('button', 'step', '▼');
    up.title = down.title = L('Strecke wechseln (W/S)', 'Change track (W/S)');
    up.addEventListener('click', () => this.pickTrack(this.stepIn(this.tracksOfMode(), this.track, -1)));
    down.addEventListener('click', () => this.pickTrack(this.stepIn(this.tracksOfMode(), this.track, 1)));
    this.trackHead.append(up, down);
    right.append(h('h2', '', L('Modus', 'Mode')), this.modeButton, this.modeList, this.modeBlurb, this.trackHead, this.trackList, this.buyTrack, this.start);
    const hint = h('p', 'keys');
    hint.innerHTML = L('<kbd>A</kbd><kbd>D</kbd> Gefährt · <kbd>T</kbd> Garage · <kbd>Q</kbd><kbd>E</kbd> Modus · <kbd>W</kbd><kbd>S</kbd> Strecke · <kbd>Enter</kbd> Los', '<kbd>A</kbd><kbd>D</kbd> ride · <kbd>T</kbd> garage · <kbd>Q</kbd><kbd>E</kbd> mode · <kbd>W</kbd><kbd>S</kbd> track · <kbd>Enter</kbd> go');
    right.append(hint);
    this.root.append(head, left, right, this.bar(), bigPrev, bigNext, h('p', 'version', `Version ${__VERSION__}`));

    this.start.addEventListener('click', () => this.go());
    window.addEventListener('keydown', (e) => {
      // (typing into a field is not steering the menu)
      if (this.root.hidden || e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return;
      const step = (list: readonly string[], cur: string, d: number) => list[(list.indexOf(cur) + d + list.length) % list.length];
      switch (e.code) {
        case 'KeyA': case 'ArrowLeft': this.stepVehicle(-1); break;
        case 'KeyD': case 'ArrowRight': this.stepVehicle(1); break;
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

  private stepIn(list: readonly string[], cur: string, d: number): string {
    return list[(list.indexOf(cur) + d + list.length) % list.length];
  }

  /**
   * Along the bottom: the settings behind a cog (folded away until wanted) and full screen.
   * The settings: save to a file, load from one, the language, the ghost, dev mode and unlocking everything.
   */
  private bar(): HTMLElement {
    const bar = h('div', 'menubar');
    const panel = h('div', 'settings');
    panel.hidden = true;
    const cog = h('button', 'tool', L('⚙ Einstellungen', '⚙ Settings'));
    cog.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      cog.classList.toggle('on', !panel.hidden);
    });
    const box = panel;
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
    // dev mode: the workshop (F2) to tune the handling live
    const dev = h('label', 'tool toggle');
    this.dev.type = 'checkbox';
    this.dev.addEventListener('change', () => {
      this.handlers.onDevMode(this.dev.checked);
      this.say(this.dev.checked ? L('Dev-Mode an: F2 öffnet die Werkstatt.', 'Dev mode on: F2 opens the workshop.') : L('Dev-Mode aus.', 'Dev mode off.'));
    });
    dev.append(this.dev, L(' 🛠 Dev-Mode', ' 🛠 Dev mode'));
    dev.title = L('Macht die Werkstatt (F2) verfügbar: Fahrverhalten live einstellen', 'Makes the workshop (F2) available: tune the handling live');
    const all = h('button', 'tool', L('🔓 Alles freischalten', '🔓 Unlock everything'));
    all.title = L('Alle Gefährte und Strecken, Boost-Batterie, volles Tuning', 'Every ride and track, the boost battery, full tuning');
    all.addEventListener('click', () => {
      this.say(this.handlers.onUnlockAll());
      this.render();
    });
    // whether the best lap drives along
    const shadow = h('label', 'tool toggle');
    this.ghost.type = 'checkbox';
    this.ghost.addEventListener('change', () => {
      this.progress.showGhost = this.ghost.checked;
      this.progress.save();
    });
    shadow.append(this.ghost, L(' Schatten der Bestzeit', ' Best-lap ghost'));
    shadow.title = L('Im Zeitrennen fährt die Bestzeit als Schatten mit (beim Fahren auch Taste G)', 'In the time trial your best lap drives along as a ghost (key G while driving)');
    // the other language, one tap away
    const other = h('button', 'tool', L('🌐 English', '🌐 Deutsch'));
    other.title = L('Switch to English', 'Auf Deutsch umstellen');
    other.addEventListener('click', () => switchLanguage(lang === 'de' ? 'en' : 'de'));
    box.append(save, load, file, other, shadow, dev, all);
    bar.append(panel, cog);
    // full screen, held sideways where the phone allows it
    if (document.fullscreenEnabled) {
      const full = h('button', 'tool', L('⛶ Vollbild', '⛶ Full screen'));
      full.title = L('Vollbild an oder aus', 'Full screen on or off');
      full.addEventListener('click', async () => {
        if (document.fullscreenElement) return void document.exitFullscreen();
        await document.documentElement.requestFullscreen().catch(() => {});
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {});
      });
      bar.append(full);
    }
    bar.append(this.note);
    return bar;
  }

  /** A short message in the header, e.g. what the last setting or the tutorial did. */
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
   * Tutorial is; after it, a track is bought with Schrauben unless it is free.
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

  /** The next or previous ride, through all categories in turn. */
  private stepVehicle(d: number): void {
    const i = VEHICLE_ORDER.indexOf(this.vehicle);
    this.pickVehicle(VEHICLE_ORDER[(i + d + VEHICLE_ORDER.length) % VEHICLE_ORDER.length]);
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

  /**
   * The mode's tracks, cheapest first: the free ones at the top, the dearest at the bottom.
   * Before the tutorial is done there is nothing else to pick: just the tutorial itself. Once
   * it is done the tutorial track is never listed again, anywhere: it was for learning to
   * drive, and that is done now.
   */
  private tracksOfMode(): string[] {
    if (!this.progress.tutorialDone) return [TRAINING];
    const price = (id: string) => TRACKS.find((t) => t.id === id)?.unlockPrice ?? 0;
    return [...this.mode.tracks].filter((id) => id !== TRAINING).sort((a, b) => price(a) - price(b));
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
    this.dev.checked = this.progress.workshop;
    const mode = this.mode;

    const v = VEHICLES[this.vehicle];
    const cat = CATEGORIES.find((c) => c.vehicles.includes(v.id))!;
    const lockV = this.vehicleLock(this.vehicle);
    this.pickerName.style.setProperty('--tint', `#${BRAND_COLORS[v.brand].toString(16).padStart(6, '0')}`);
    this.pickerName.replaceChildren(h('small', '', cat.title), h('strong', '', lockV ? `🔒 ${v.label}` : v.label));
    this.rides.replaceChildren(
      ...cat.vehicles.map((id) => {
        const lock = this.vehicleLock(id);
        const b = h('button', `chip${id === v.id ? ' on' : ''}${lock ? ' locked' : ''}`, lock ? `🔒 ${VEHICLES[id].label}` : VEHICLES[id].label);
        if (lock?.price !== undefined && this.progress.money >= lock.price) b.classList.add('can');
        b.addEventListener('click', () => this.pickVehicle(id));
        return b;
      }),
    );
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
    this.unlockButton(this.buyVehicle, v.label, lockV);
    this.garage.disabled = !!lockV;
    const actions = h('div', 'actions');
    actions.append(this.garage, this.buyVehicle);
    this.detail.replaceChildren(
      h('p', 'kind words', `${v.kind} · ${L('Fahrprofile', 'Driving profiles')}: ${v.profiles.map((p) => p.name).join(', ')}`),
      h('p', 'words', v.blurb),
      stats,
      actions,
      h('p', 'kind words', L(`Aktuell ${num(top)} km/h · Tuning-Stufe ${stageNo}: ${stage.name} · Fahrprofil: ${profile.name}`, `Now ${num(top)} km/h · tuning stage ${stageNo}: ${stage.name} · driving profile: ${profile.name}`)),
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
    // The chosen track scrolls into view inside its list. (Not scrollIntoView: on a phone, where
    // the whole menu scrolls, that pulled the page down to the tracks at every pick of a ride.)
    const on = this.trackList.querySelector<HTMLElement>('.on');
    if (on) {
      const list = this.trackList;
      const top = on.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (top + on.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + on.offsetHeight - list.clientHeight;
    }
  }

  /** The best a track has seen in a mode, for its card. */
  private record(mode: ModeId, track: string): string {
    const r = this.progress.records[`${mode}:${track}`];
    switch (mode) {
      case 'time': return `${L('Bestzeit', 'Best lap')} ${formatTime(this.progress.bestLaps[track] ?? null)}`;
      case 'race': return r ? L(`Bester Platz ${r}`, `Best place ${r}`) : L('Noch kein Rennen', 'No race yet');
      case 'freestyle': return r ? L(`Bestes Freestyle ${formatMoney(r)}`, `Best session ${formatMoney(r)}`) : L('Noch kein Freestyle', 'No session yet');
      case 'crash': return r ? L(`Teuerster Crash ${r} Punkte`, `Costliest crash ${r} points`) : L('Noch kein Crash', 'No crash yet');
      case 'open': return L('Kein Limit', 'No limit');
    }
  }
}

