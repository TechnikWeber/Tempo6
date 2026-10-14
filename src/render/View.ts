import { L } from '../i18n';
import {
  AmbientLight, BoxGeometry, BufferGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, DirectionalLight,
  Float32BufferAttribute, Fog, Group,
  HemisphereLight, IcosahedronGeometry, Mesh, MeshStandardMaterial, type Object3D, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry,
  Quaternion, RingGeometry, Scene, Shape, ShapeGeometry, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { HANDLING, VEHICLES, type VehicleSpec } from '../config/vehicles';
import { GHOST_RATE, type GhostLap } from '../sim/Progress';
import type { GameCore } from '../sim/GameCore';
import { drumSlats } from '../sim/Movers';
import { SPINNER_HALF } from '../sim/Sim';
import { heightAt, type DecorDef, type TrackDef } from '../sim/Track';
import type { Tracked } from '../sim/Tracked';
import { box, buildPickup, buildProp, buildTraffic, buildVehicle, cyl, mat, type VehicleRig } from './models';
import { Sparks, SpeedLines } from './Boost';
import { SkidMarks } from './Skid';
import { Wreckage } from './Wreckage';

const SKY = 0x9fd3f0;
/** What the shadow of the best lap is made of. */
const GHOST = new MeshStandardMaterial({ color: 0xdfe9f5, transparent: true, opacity: 0.18, depthWrite: false, roughness: 1 });
const SHADOW_HALF = 22;
const SHADOW_MAP = 2048;
// The sun's direction and the two axes of its shadow map.
const SUN = new Vector3(18, 34, -12);
const SUN_DIR = SUN.clone().normalize();
const SUN_RIGHT = new Vector3(0, 1, 0).cross(SUN_DIR).normalize();
const SUN_UP = SUN_DIR.clone().cross(SUN_RIGHT);
const snapped = new Vector3();
const qa = new Quaternion();
const qb = new Quaternion();
const va = new Vector3();
const vb = new Vector3();

/** Blend a body between its last two physics states. */
function place(obj: Object3D, t: Tracked, alpha: number): void {
  va.fromArray(t.prev, 0);
  vb.fromArray(t.cur, 0);
  obj.position.lerpVectors(va, vb, alpha);
  qa.fromArray(t.prev, 3);
  qb.fromArray(t.cur, 3);
  obj.quaternion.slerpQuaternions(qa, qb, alpha);
}

function textTexture(text: string, bg: string, fg: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = fg;
  g.font = '900 190px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2 + 10);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function checkerTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 160;
  const g = c.getContext('2d')!;
  for (let y = 0; y < 10; y++) for (let x = 0; x < 2; x++) {
    g.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4';
    g.fillRect(x * 16, y * 16, 16, 16);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** @param ground height of the ground at a point; decor stands on it */
function buildDecor(d: DecorDef, ground: (x: number, z: number) => number): Object3D {
  const g = new Group();
  g.position.set(...d.pos);
  // (bands follow the ground point by point instead, see below)
  if (d.type !== 'path') g.position.y += ground(d.pos[0], d.pos[2]);
  g.rotation.y = d.yaw ?? 0;
  const [hx, hy, hz] = d.half ?? [0.5, 0.5, 0.5];
  switch (d.type) {
    case 'box':
      box(g, hx * 2, hy * 2, hz * 2, d.color ?? 0xffffff);
      break;
    case 'tree': {
      const trunk = new Mesh(new CylinderGeometry(0.15, 0.2, 1.4, 6), mat(0x6b4a2b));
      trunk.position.y = 0.7;
      trunk.castShadow = true;
      g.add(trunk);
      for (let i = 0; i < 2; i++) {
        const top = new Mesh(new ConeGeometry(1.3 - i * 0.4, 1.8, 7), mat(0x2f7d3a));
        top.position.y = 2 + i * 1.1;
        top.castShadow = true;
        g.add(top);
      }
      break;
    }
    case 'lamp':
      box(g, 0.12, 5, 0.12, 0x555a60, 0, 2.5, 0);
      box(g, 1.2, 0.1, 0.12, 0x555a60, 0.5, 5, 0);
      box(g, 0.5, 0.1, 0.25, 0xfff3b0, 1, 4.92, 0);
      break;
    case 'finish': {
      const m = new Mesh(new PlaneGeometry(hx * 2, hz * 2), new MeshStandardMaterial({ map: checkerTexture(), roughness: 1 }));
      m.rotation.x = -Math.PI / 2;
      m.receiveShadow = true;
      g.add(m);
      break;
    }
    case 'board': {
      const edge = mat(0x2a2c30);
      const face = new MeshStandardMaterial({ map: textTexture(d.text ?? '', '#f4f4f4', '#1d1d1f'), roughness: 0.9 });
      g.add(new Mesh(new BoxGeometry(hx * 2, hy * 2, hz * 2), [edge, edge, edge, edge, face, face]));
      // posts, thinner than the board so their faces never lie in the board's own
      for (const s of [1, -1]) box(g, 0.1, d.pos[1], hz * 1.4, 0x2a2c30, s * hx * 0.8, -d.pos[1] / 2, 0);
      break;
    }
    case 'label': {
      const m = new Mesh(new PlaneGeometry(hz * 2, hx * 2), new MeshStandardMaterial({ map: textTexture(d.text ?? '', '#3f4248', '#f4f4f4'), roughness: 1 }));
      m.rotation.x = -Math.PI / 2;
      m.receiveShadow = true;
      g.add(m);
      break;
    }
    case 'path': {
      // one band lying on the ground: a few vertices across at every point
      const pts = d.points ?? [];
      const n = pts.length;
      const across = hx > 1 ? 5 : 2;
      const vertices: number[] = [];
      const index: number[] = [];
      pts.forEach(([x, z], i) => {
        const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const nx = ((b[1] - a[1]) / len) * hx, nz = (-(b[0] - a[0]) / len) * hx;
        for (let k = 0; k < across; k++) {
          const f = 1 - (2 * k) / (across - 1);
          vertices.push(x + nx * f, ground(x + nx * f, z + nz * f), z + nz * f);
        }
        const j = ((i + 1) % n) * across;
        for (let k = 0; k < across - 1; k++) index.push(i * across + k, i * across + k + 1, j + k, i * across + k + 1, j + k + 1, j + k);
      });
      const geo = new BufferGeometry();
      geo.setAttribute('position', new Float32BufferAttribute(vertices, 3));
      geo.setIndex(index);
      geo.computeVertexNormals();
      const m = new Mesh(geo, mat(d.color ?? 0xffffff));
      m.receiveShadow = true;
      g.add(m);
      break;
    }
    case 'clock': {
      // a white face on a dark rim, twelve marks, and hands the view keeps at the real time
      const r = hx;
      const face = cyl(g, r, 0.06, 0xf4f4f4, 0, 0, 0.03, 32);
      face.rotation.x = Math.PI / 2;
      const rim = cyl(g, r + 0.08, 0.05, 0x2a2c30, 0, 0, 0.025, 32);
      rim.rotation.x = Math.PI / 2;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        box(g, k % 3 ? 0.04 : 0.07, r * 0.14, 0.02, 0x2a2c30, Math.sin(a) * r * 0.82, Math.cos(a) * r * 0.82, 0.07).rotation.z = -a;
      }
      for (const [name, len, w] of [['hour', 0.5, 0.09], ['minute', 0.78, 0.06], ['second', 0.85, 0.02]] as const) {
        const hand = new Group();
        hand.name = name;
        box(hand, w, r * len, 0.02, name === 'second' ? 0xd23b3b : 0x1d1d1f, 0, (r * len) / 2 - r * 0.08, 0).castShadow = false;
        hand.position.z = name === 'hour' ? 0.09 : name === 'minute' ? 0.11 : 0.13;
        g.add(hand);
      }
      g.userData.clock = true;
      break;
    }
    case 'oval': {
      // a flat oval, a white rim and the colour inside, facing out along +Z
      for (const [grow, c, z] of [[0.12, 0xf4f4f4, 0.02], [0, d.color ?? 0x1565c0, 0.05]] as const) {
        const m = cyl(g, 1, 0.04, c, 0, 0, z, 40);
        m.rotation.x = Math.PI / 2;
        m.scale.set(hx + grow, 1, hy + grow);
      }
      break;
    }
    case 'balloon': {
      // envelope, a band round it, ropes and a basket; the view lets it bob and turn
      const env = new Mesh(new IcosahedronGeometry(4, 1), mat(d.color ?? 0xd23b3b));
      env.scale.set(1, 1.2, 1);
      env.position.y = 7;
      env.castShadow = true;
      g.add(env);
      const band = cyl(g, 4.08, 0.7, 0xf2c230, 0, 7, 0, 20);
      band.castShadow = false;
      for (const s of [-1, 1]) for (const t of [-1, 1]) box(g, 0.04, 2.6, 0.04, 0x5a4636, s * 0.6, 1.9, t * 0.6);
      box(g, 1.3, 0.9, 1.3, 0x8a5a32, 0, 0.45, 0);
      g.userData.balloon = true;
      break;
    }
    case 'smoke': {
      // puffs that the view lets rise, swell and fade, over and over
      for (let i = 0; i < 7; i++) {
        const puff = new Mesh(new IcosahedronGeometry(0.35, 0), new MeshStandardMaterial({ color: 0x8f9295, transparent: true, opacity: 0.6, roughness: 1, depthWrite: false }));
        puff.userData.phase = i / 7;
        g.add(puff);
      }
      g.userData.smoke = true;
      break;
    }
    case 'slab': {
      const m = new Mesh(new ShapeGeometry(new Shape((d.points ?? []).map(([x, z]) => new Vector2(x, -z)))), mat(d.color ?? 0xffffff));
      m.rotation.x = -Math.PI / 2;
      m.receiveShadow = true;
      g.add(m);
      break;
    }
    case 'ring': {
      const m = new Mesh(new RingGeometry(hx - hz, hx + hz, 96), mat(d.color ?? 0xffffff));
      m.rotation.x = -Math.PI / 2;
      m.receiveShadow = true;
      g.add(m);
      break;
    }
    case 'sign': {
      const wall = mat(d.color ?? 0xdddddd);
      const face = new MeshStandardMaterial({ map: textTexture(d.text ?? '', '#c22a2a', '#fff6d6'), roughness: 0.9 });
      const band = new Mesh(new BoxGeometry(hx * 1.2, hy * 0.5, 0.3), [wall, wall, wall, wall, wall, face]);
      band.position.set(0, hy * 0.45, -hz - 0.15);
      g.add(band);
      box(g, hx * 2, hy * 2, hz * 2, d.color ?? 0xdddddd);
      box(g, hx * 0.5, hy * 0.9, 0.2, 0x4a6a80, 0, -hy * 0.55, -hz - 0.05); // entrance glass
      break;
    }
  }
  return g;
}

/** Everything three.js: scene, camera, lights and the meshes that mirror the sim. */
export class View {
  readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(60, 1, 0.1, 600);
  private readonly sun = new DirectionalLight(0xfff1d6, 2.6);
  private propMeshes: Object3D[] = [];
  private pickupMeshes: Object3D[] = [];
  private trafficMeshes: Object3D[] = [];
  private spinnerMeshes: Object3D[] = [];
  private moverMeshes: Object3D[] = [];
  /** The ground all round; up in the sky there is none. */
  private lawn: Mesh | null = null;
  /** Exhaust puffs to animate. */
  private smokes: Object3D[] = [];
  /** Wall clocks telling the real time, and balloons bobbing in the air. */
  private clocks: Object3D[] = [];
  private balloons: Object3D[] = [];
  /** Clouds drifting across the sky, round every track. */
  private readonly clouds: Group[] = [];
  /** The opponents of the race on show, and which game they belong to. */
  private rivals: { core: GameCore | null; rigs: Object3D[] } = { core: null, rigs: [] };
  private level: Group | null = null;
  private track: TrackDef | null = null;
  private model: VehicleRig | null = null;
  private readonly skids: SkidMarks;
  /** Visual body sway on the springs: angle and angular velocity for roll and pitch. */
  private sway = { roll: 0, rollV: 0, pitch: 0, pitchV: 0, lastSpeed: 0, accel: 0 };
  private spinExtra: number[] = [];
  /** Tail-out angle of the model and how fast it is swinging. */
  private drift = 0;
  private driftV = 0;
  private sparks: Sparks | null = null;
  private readonly speedLines: SpeedLines;
  private fitted = false;
  private wreckage: Wreckage | null = null;
  /** The best lap driving along: a see-through copy of the vehicle it was set with. */
  private ghost: { lap: GhostLap; root: Group } | null = null;
  /** Damage the model on screen shows; when the vehicle has less, it has been repaired. */
  private shownDamage = 0;
  /** Camera shake that dies away, e.g. after a landing. */
  private shake = 0;
  /** Body bouncing on the springs after a landing: offset and speed. */
  private heave = { y: 0, v: 0 };
  private restY = 0;
  private camYaw = 0;
  private camReady = false;
  private lean = 0;
  private time = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.scene.background = new Color(SKY);
    this.scene.fog = new Fog(SKY, 80, 320);
    this.scene.add(new HemisphereLight(0xcfe8ff, 0x5a5f55, 1.1), new AmbientLight(0xffffff, 0.25));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -SHADOW_HALF;
    sc.right = sc.top = SHADOW_HALF;
    sc.near = 1;
    sc.far = 120;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    const lawn = new Mesh(new PlaneGeometry(900, 900), mat(0x6fa35a));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = -0.05;
    this.scene.add(lawn);
    this.lawn = lawn;
    this.makeClouds();

    this.skids = new SkidMarks(this.scene);
    this.scene.add(this.camera);
    this.speedLines = new SpeedLines(this.camera);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Wipe tyre marks, e.g. when the level restarts. */
  clearMarks(): void {
    this.skids.clear();
  }

  /** Swap the level geometry. */
  /**
   * Swap the level geometry.
   * @param gates mark the checkpoints (in the modes that time laps)
   */
  setTrack(track: TrackDef, gates = false): void {
    if (this.level) {
      this.scene.remove(this.level);
      this.level.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose();
      });
    }
    if (this.ghost) this.scene.remove(this.ghost.root);
    this.ghost = null;
    const level = new Group();
    this.level = level;
    this.track = track;
    this.propMeshes = [];
    this.pickupMeshes = [];
    for (const b of track.statics) {
      const m = box(level, b.half[0] * 2, b.half[1] * 2, b.half[2] * 2, b.color, ...b.pos);
      if (b.quat) m.quaternion.fromArray(b.quat);
    }
    const ground = (x: number, z: number) => heightAt(track.terrain, x, z);
    if (track.terrain) {
      const t = track.terrain;
      const geo = new PlaneGeometry(t.half[0] * 2, t.half[1] * 2, t.cols, t.rows);
      geo.rotateX(-Math.PI / 2);
      // (the plane's rows run from -Z to +Z after the turn, like the grid)
      const y = geo.attributes.position;
      for (let i = 0; i < y.count; i++) y.setY(i, ground(y.getX(i), y.getZ(i)));
      geo.computeVertexNormals();
      const m = new Mesh(geo, mat(t.color));
      m.receiveShadow = true;
      level.add(m);
    }
    this.smokes = [];
    this.clocks = [];
    this.balloons = [];
    for (const d of track.decor) {
      const m = buildDecor(d, ground);
      if (m.userData.smoke) this.smokes.push(m);
      if (m.userData.clock) this.clocks.push(m);
      if (m.userData.balloon) this.balloons.push(m);
      level.add(m);
    }
    for (const p of track.props) {
      const m = buildProp(p.type);
      this.propMeshes.push(m);
      level.add(m);
    }
    for (const p of track.pickups) {
      const m = buildPickup(p.type);
      m.position.set(...p.pos);
      this.pickupMeshes.push(m);
      level.add(m);
    }
    this.trafficMeshes = (track.traffic ?? []).map((t) => {
      const m = buildTraffic(t);
      level.add(m);
      return m;
    });
    this.spinnerMeshes = (track.spinners ?? []).map((s) => {
      const g = new Group();
      const disc = new Mesh(new CylinderGeometry(s.radius, s.radius, SPINNER_HALF * 2, 32), mat(s.color));
      disc.receiveShadow = true;
      g.add(disc);
      // spokes, so one can see it turn
      for (let k = 0; k < 4; k++) {
        const spoke = box(g, s.radius * 2 - 0.4, 0.01, 0.35, 0xf2c230, 0, SPINNER_HALF + 0.005, 0);
        spoke.rotation.y = (k * Math.PI) / 4;
        spoke.castShadow = false;
      }
      level.add(g);
      return g;
    });
    this.moverMeshes = (track.movers ?? []).map((d) => {
      const g = new Group();
      if (d.type === 'propeller') {
        // blades round the hub, as the physics has them, and a striped tip on each
        const n = d.blades ?? 2;
        for (let k = 0; k < n; k++) {
          const a = (2 * Math.PI * k) / n;
          const arm = new Group();
          arm.rotation.z = a;
          box(arm, d.half[0] * 2, d.half[1] * 2, d.half[2] * 2, d.color, 0, -d.half[1], 0);
          box(arm, d.half[0] * 2 + 0.02, 0.3, d.half[2] * 2 + 0.02, 0xf2f2f2, 0, -d.half[1] * 2 + 0.2, 0);
          g.add(arm);
        }
        // (the hub sticks out a little either side of the blades)
        box(g, 0.4, 0.4, d.half[2] * 2 + 0.3, 0x3a3c40, 0, 0, 0);
        level.add(g);
        return g;
      }
      if (d.type === 'drum') {
        // striped slats as the physics has them, every other one a hair shorter so their ends
        // never share a face, and a ring round either end
        const r = d.radius ?? 3, t = d.half[1], len = d.half[2];
        drumSlats(r, t, d.blades ?? 32).forEach(([a, x, y, half], k) => {
          const slat = box(g, half * 2, t * 2, (len - (k % 2) * 0.01) * 2, k % 2 ? 0xf2f2f2 : d.color, x, y, 0);
          slat.rotation.z = a;
          const ring = r + 2 * t + 0.12;
          for (const s of [-1, 1]) {
            const hoop = box(g, ((half * ring) / r) * 2, 0.28, 0.3, 0x3a3c40, Math.sin(a) * ring, -Math.cos(a) * ring, s * (len - 0.2));
            hoop.rotation.z = a;
            hoop.castShadow = false;
          }
        });
        level.add(g);
        return g;
      }
      // (the body sits at the middle of the top surface)
      box(g, d.half[0] * 2, d.half[1] * 2, d.half[2] * 2, d.color, 0, -d.half[1], 0).receiveShadow = true;
      // yellow edges, so one can see where the plank ends
      for (const s of [1, -1]) box(g, 0.08, 0.012, d.half[2] * 2, 0xf2c230, s * (d.half[0] - 0.06), 0.006, 0).castShadow = false;
      level.add(g);
      return g;
    });
    if (gates) this.markGates(level, track, ground);
    if (this.lawn) this.lawn.visible = !track.sky;
    this.scene.add(level);
    this.skids.clear();
    this.camReady = false;
  }

  /**
   * The checkpoints made visible: a striped post either side of the way and the number painted
   * on the road between them. The finish has its own line; on a course it gets posts too.
   */
  private markGates(level: Group, track: TrackDef, ground: (x: number, z: number) => number): void {
    const n = track.gates.length;
    track.gates.forEach((g, i) => {
      if (g.x > 400) return; // (a gate parked out of reach: nothing timed there)
      const last = track.course && i === n - 1;
      if (i === 0 && !track.course) return;
      // the way through: along the line where there is one, else along the gate's short side
      let yaw = g.hx < g.hz ? Math.PI / 2 : 0;
      if (track.line) {
        let best = 0, bd = Infinity;
        track.line.forEach(([x, z], k) => {
          const d = (x - g.x) ** 2 + (z - g.z) ** 2;
          if (d < bd) [best, bd] = [k, d];
        });
        const a = track.line[best], b = track.line[(best + 1) % track.line.length];
        yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      }
      const half = track.roadHalf ? track.roadHalf + 0.5 : Math.max(g.hx, g.hz) - 0.3;
      const lx = Math.cos(yaw), lz = -Math.sin(yaw);
      for (const s of [-1, 1]) {
        const x = g.x + lx * half * s, z = g.z + lz * half * s, y = ground(x, z);
        for (let k = 0; k < 4; k++) box(level, 0.14, 0.4, 0.14, k % 2 ? 0x1d1d1f : 0xf2c230, x, y + 0.2 + k * 0.4, z).castShadow = false;
        box(level, 0.02, 0.35, 0.5, i === 0 || last ? 0xd23b3b : 0x2f6db5, x, y + 1.45, z + 0.27).rotation.y = yaw;
      }
      const label: DecorDef = { type: 'label', pos: [g.x, 0.11, g.z], half: [1.0, 0, Math.min(2.4, half - 0.8)], yaw: yaw + Math.PI, text: i === 0 ? 'START' : last ? L('ZIEL', 'FINISH') : `CP ${i}` };
      level.add(buildDecor(label, ground));
    });
  }

  /** Clouds drift, clocks tell the time, balloons bob. */
  private animateSky(dt: number): void {
    for (const c of this.clouds) {
      c.position.x += (c.userData.speed as number) * dt;
      if (c.position.x > 420) c.position.x -= 840;
    }
    const now = new Date();
    const sec = now.getSeconds() + now.getMilliseconds() / 1000;
    const min = now.getMinutes() + sec / 60;
    const hour = (now.getHours() % 12) + min / 60;
    for (const c of this.clocks) {
      // (clockwise seen from the front: the face looks along +Z)
      c.getObjectByName('hour')!.rotation.z = -(hour / 12) * Math.PI * 2;
      c.getObjectByName('minute')!.rotation.z = -(min / 60) * Math.PI * 2;
      c.getObjectByName('second')!.rotation.z = -(Math.floor(sec) / 60) * Math.PI * 2;
    }
    this.balloons.forEach((b, i) => {
      b.position.y = (b.userData.y0 ??= b.position.y) + Math.sin(this.time * 0.4 + i * 2) * 1.5;
      b.rotation.y += dt * 0.05;
    });
  }

  /** A few dozen clouds of white blocks, high up, drifting slowly the same way. */
  private makeClouds(): void {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const white = new MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: 0.92 });
    for (let k = 0; k < 34; k++) {
      const c = new Group();
      const n = 3 + Math.floor(rnd() * 4);
      for (let i = 0; i < n; i++) {
        const m = new Mesh(new BoxGeometry(8 + rnd() * 12, 3 + rnd() * 4, 6 + rnd() * 8), white);
        m.position.set((i - n / 2) * 7 + rnd() * 4, rnd() * 3, rnd() * 6 - 3);
        c.add(m);
      }
      // (some low enough to drift under the sky path)
      c.position.set(rnd() * 840 - 420, k % 4 === 0 ? 30 + rnd() * 15 : 75 + rnd() * 40, rnd() * 700 - 350);
      c.userData.speed = 1 + rnd() * 1.5;
      this.clouds.push(c);
      this.scene.add(c);
    }
  }

  /** The others in a race: built once per game, then moved along with their bodies. */
  private placeRivals(core: GameCore, alpha: number): void {
    if (this.rivals.core !== core) {
      for (const r of this.rivals.rigs) this.scene.remove(r);
      this.rivals = { core, rigs: core.rivals.map((r) => buildVehicle(r.vehicle.spec, r.vehicle.boostFitted).root) };
      for (const r of this.rivals.rigs) this.scene.add(r);
    }
    core.rivals.forEach((r, i) => place(this.rivals.rigs[i], r.vehicle.tracked, alpha));
  }

  private resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Show the recorded best lap at the point the lap in progress has reached, if that is wanted. */
  private placeGhost(core: GameCore, showroom: boolean): void {
    const lap = core.ghost;
    if (this.ghost && this.ghost.lap !== lap) {
      this.scene.remove(this.ghost.root);
      this.ghost = null;
    }
    if (lap && !this.ghost) {
      const root = buildVehicle(VEHICLES[lap.vehicle]).root;
      root.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        o.material = GHOST;
        o.castShadow = o.receiveShadow = false;
      });
      this.scene.add(root);
      this.ghost = { lap, root };
    }
    if (!this.ghost) return;
    const s = this.ghost.lap.samples;
    const at = core.race.lapTime * GHOST_RATE;
    const i = Math.floor(at), count = s.length / 7;
    this.ghost.root.visible = !showroom && core.progress.showGhost && core.race.running && i + 1 < count;
    if (!this.ghost.root.visible) return;
    const a = i * 7, b = a + 7, f = at - i;
    this.ghost.root.position.set(s[a] + (s[b] - s[a]) * f, s[a + 1] + (s[b + 1] - s[a + 1]) * f, s[a + 2] + (s[b + 2] - s[a + 2]) * f);
    qa.set(s[a + 3], s[a + 4], s[a + 5], s[a + 6]);
    qb.set(s[b + 3], s[b + 4], s[b + 5], s[b + 6]);
    this.ghost.root.quaternion.slerpQuaternions(qa, qb, f);
  }

  /** @param boost show the boost battery on it */
  setVehicle(spec: VehicleSpec, boost: boolean): void {
    if (this.model) this.scene.remove(this.model.root);
    this.wreckage?.dispose();
    this.model = buildVehicle(spec, boost);
    this.wreckage = new Wreckage(this.scene, this.model, (x, z) => heightAt(this.track?.terrain, x, z));
    this.shownDamage = 0;
    this.fitted = boost;
    this.sparks = new Sparks(this.model.body, this.model.battery, this.model.terminals);
    this.drift = this.driftV = 0;
    this.scene.add(this.model.root);
    this.restY = this.model.body.position.y;
    this.heave = { y: 0, v: 0 };
    this.sway = { roll: 0, rollV: 0, pitch: 0, pitchV: 0, lastSpeed: 0, accel: 0 };
    this.camReady = false;
  }

  /**
   * @param alpha position between the last two physics steps, 0…1
   * @param showroom circle the camera around the parked vehicle (start screen)
   */
  render(core: GameCore, alpha: number, dt: number, showroom = false): void {
    const v = core.sim.vehicle;
    // The battery pack shows up on the vehicle the moment it is bought.
    // …and a repaired one is a new one.
    if (this.model && (v.boostFitted !== this.fitted || v.damage < this.shownDamage)) this.setVehicle(v.spec, v.boostFitted);
    this.shownDamage = v.damage;
    const model = this.model;
    const track = this.track;
    if (!model || !track) return;
    this.time += dt;

    place(model.root, v.tracked, alpha);
    this.wreckage?.update(v, dt);
    // A write-off has no wheels left to stand on: what remains sits on the ground.
    if (this.wreckage) model.root.position.y -= this.wreckage.sunk * v.spec.clearance;
    // Drift look: under cornering load the model swings its tail out, so from behind
    // you get to see a bit of its flank. The physics keeps going where it was going.
    // It swings out on a soft spring, so it wags back once when the corner is over.
    const load = Math.max(-1, Math.min(1, v.latAccel / 9)) * Math.min(1, Math.abs(v.speed) / 4);
    const driftTo = load * HANDLING.driftAngle * (v.wheelsOnGround > 0 ? 1 : 0.3);
    const dh = Math.min(dt, 0.05);
    this.driftV += ((driftTo - this.drift) * 60 - this.driftV * 7.5) * dh;
    this.drift += this.driftV * dh;
    model.root.rotateY(this.drift);
    this.sparks?.update(showroom ? 0 : v.boost, dt);
    this.speedLines.update(showroom ? 0 : v.boost, Math.abs(v.speed), dt);
    v.spec.wheels.forEach((w, i) => {
      const m = model.wheels[i];
      if (this.wreckage?.loose(i)) return;
      m.pivot.position.y = w.y - v.wheelSuspension(i);
      m.pivot.rotation.y = v.wheelYaw[i];
      // Spinning up: the wheel turns faster than the ground goes by.
      if (w.drive) this.spinExtra[i] = (this.spinExtra[i] ?? 0) + v.burnout * dt * 45;
      m.spin.rotation.x = v.wheelSpin(i) + (this.spinExtra[i] ?? 0);
    });
    this.swayBody(model, v.latAccel, v.speed, v.wheelsOnGround > 0, dt);
    // Landing: the body slams down on the springs and bounces back.
    const hh = Math.min(dt, 0.05);
    this.heave.v += (-this.heave.y * 140 - this.heave.v * 9) * hh;
    this.heave.y = Math.max(-0.12, this.heave.y + this.heave.v * hh);
    model.body.position.y = this.restY + this.heave.y;
    this.skids.update(v, dt);
    // The driver leans out of the corner, a lot.
    const target = Math.max(-0.45, Math.min(0.45, v.latAccel * 0.05));
    this.lean += (target - this.lean) * Math.min(1, dt * 6);
    model.driver.rotation.z = this.lean;
    // Pushing the rims: both arms swing with the stroke.
    for (const arm of model.arms) arm.rotation.x = -0.15 + Math.sin(v.pushPhase) * 0.45;

    this.placeGhost(core, showroom);
    core.sim.props.forEach((p, i) => place(this.propMeshes[i], p.tracked, alpha));
    core.sim.traffic.cars.forEach((c, i) => place(this.trafficMeshes[i], c.tracked, alpha));
    core.sim.spinners.forEach((s, i) => place(this.spinnerMeshes[i], s, alpha));
    core.sim.movers.forEach((m, i) => place(this.moverMeshes[i], m.tracked, alpha));
    this.placeRivals(core, alpha);
    this.animateSky(dt);
    for (const s of this.smokes) {
      s.children.forEach((puff, i) => {
        const f = (this.time * 0.45 + (puff.userData.phase as number)) % 1;
        puff.position.set(Math.sin(i * 2.1 + this.time) * 0.15 + f * 0.6, f * 3.2, Math.cos(i * 1.7) * 0.12);
        puff.scale.setScalar(0.4 + f * 2.2);
        ((puff as Mesh).material as MeshStandardMaterial).opacity = 0.55 * (1 - f);
      });
    }
    this.pickupMeshes.forEach((m, i) => {
      m.visible = !showroom && core.paying && !core.halted && core.pickupTimers[i] === 0;
      m.rotation.y = this.time * 2 + i;
      m.position.y = track.pickups[i].pos[1] + Math.sin(this.time * 3 + i) * 0.08;
    });

    if (showroom) this.showroomCamera(model.root.position, v.yaw);
    else this.updateCamera(model.root.position, v.yaw, v, dt);
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * The body rocks on its springs like a soft old sofa: it leans out of corners,
   * squats under power and dives on the brakes, and it overshoots a little.
   */
  private swayBody(model: VehicleRig, lateral: number, speed: number, grounded: boolean, dt: number): void {
    const s = this.sway;
    if (dt > 0) {
      s.accel += ((speed - s.lastSpeed) / Math.max(dt, 1 / 120) - s.accel) * Math.min(1, dt * 8);
      s.lastSpeed = speed;
    }
    const k = HANDLING.bodySway;
    const rollTo = grounded ? Math.max(-0.22, Math.min(0.22, lateral * 0.022 * k)) : 0;
    const pitchTo = grounded ? Math.max(-0.14, Math.min(0.14, -s.accel * 0.014 * k)) : 0;
    // Under-damped spring: 1 Hz, so it visibly settles.
    const w = 6.5, zeta = 0.38;
    const h = Math.min(dt, 0.05);
    s.rollV += ((rollTo - s.roll) * w * w - 2 * zeta * w * s.rollV) * h;
    s.roll += s.rollV * h;
    s.pitchV += ((pitchTo - s.pitch) * w * w - 2 * zeta * w * s.pitchV) * h;
    s.pitch += s.pitchV * h;
    model.body.rotation.z = s.roll;
    model.body.rotation.x = s.pitch;
  }

  private showroomCamera(pos: Vector3, yaw: number): void {
    // Slow orbit, starting from the front three-quarter view.
    const a = yaw + 0.7 + this.time * 0.35;
    this.camera.position.set(pos.x + Math.sin(a) * 3.4, pos.y + 1.1, pos.z + Math.cos(a) * 3.4);
    this.camera.lookAt(pos.x, pos.y + 0.25, pos.z);
    if (this.camera.fov !== 42) {
      this.camera.fov = 42;
      this.camera.updateProjectionMatrix();
    }
    this.aimSun(pos);
    this.camReady = false;
  }

  /**
   * The shadow map follows the vehicle, but only in whole texels. Moving it smoothly makes
   * every shadow edge crawl, which shows as flicker on the driver's back and cap.
   */
  private aimSun(pos: Vector3): void {
    const texel = (SHADOW_HALF * 2) / SHADOW_MAP;
    const r = Math.round(pos.dot(SUN_RIGHT) / texel) * texel;
    const u = Math.round(pos.dot(SUN_UP) / texel) * texel;
    snapped.copy(SUN_DIR).multiplyScalar(pos.dot(SUN_DIR)).addScaledVector(SUN_RIGHT, r).addScaledVector(SUN_UP, u);
    this.sun.target.position.copy(snapped);
    this.sun.position.copy(snapped).add(SUN);
  }

  /** A landing with this sink rate (m/s): shake the camera and slam the body down. */
  bump(sinkRate: number): void {
    const hit = Math.min(1, sinkRate / 9);
    this.shake = Math.max(this.shake, hit);
    this.heave.v -= 0.6 + hit * 1.6;
  }

  private updateCamera(pos: Vector3, heading: number, v: GameCore['sim']['vehicle'], dt: number): void {
    const speed = Math.abs(v.speed);
    // Follow where it is going rather than where it points: in a drift the vehicle
    // then shows its flank.
    const yaw = heading - v.slip * Math.min(1, speed / 4);
    if (!this.camReady) {
      this.camYaw = yaw;
      this.camReady = true;
    }
    // Swing behind the vehicle along the shorter way round.
    let diff = yaw - this.camYaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.camYaw += diff * (1 - Math.exp(-dt * 3.5));

    // Under boost the camera falls back a little, as if left behind.
    const dist = 3.0 + Math.min(speed, 22) * 0.06 + v.boost * 0.3;
    const height = 1.7 + Math.min(speed, 22) * 0.02;
    const sx = Math.sin(this.camYaw), cz = Math.cos(this.camYaw);
    // A little life: a bob that grows with speed, a jolt after landings.
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const grounded = v.wheelsOnGround > 0 ? 1 : 0.3;
    const bob = Math.sin(this.time * (7 + speed * 0.5)) * Math.min(0.018, speed * 0.0016) * grounded;
    const jx = Math.sin(this.time * 61) * (this.shake * 0.07 + v.boost * 0.012);
    const jy = Math.sin(this.time * 47) * (this.shake * 0.12 + v.boost * 0.016);
    this.camera.position.set(pos.x - sx * dist + cz * jx, Math.max(0.5, pos.y + height + bob + jy), pos.z - cz * dist - sx * jx);
    this.camera.lookAt(pos.x + sx * 1.5, pos.y + 0.55, pos.z + cz * 1.5);
    // Bank into the corner a touch.
    this.camera.rotateZ(Math.max(-0.06, Math.min(0.06, v.latAccel * 0.004)));
    // Wider lens at speed: 60 km/h in a wheelchair should look terrifying.
    const fov = 58 + Math.min(16, speed * 0.8) + v.boost * 6;
    if (Math.abs(fov - this.camera.fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    this.aimSun(pos);
  }
}
