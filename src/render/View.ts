import {
  AmbientLight, BoxGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, DirectionalLight, Fog, Group,
  HemisphereLight, Mesh, MeshStandardMaterial, type Object3D, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry,
  Quaternion, Scene, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import type { VehicleSpec } from '../config/vehicles';
import type { GameCore } from '../sim/GameCore';
import type { DecorDef, TrackDef } from '../sim/Track';
import type { Tracked } from '../sim/Tracked';
import { box, buildPickup, buildProp, buildVehicle, mat, type VehicleModel } from './models';

const SKY = 0x9fd3f0;
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

function buildDecor(d: DecorDef): Object3D {
  const g = new Group();
  g.position.set(...d.pos);
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
  private level: Group | null = null;
  private track: TrackDef | null = null;
  private model: VehicleModel | null = null;
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
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -28;
    sc.right = sc.top = 28;
    sc.near = 1;
    sc.far = 120;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);

    const lawn = new Mesh(new PlaneGeometry(900, 900), mat(0x6fa35a));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = -0.05;
    this.scene.add(lawn);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Swap the level geometry. */
  setTrack(track: TrackDef): void {
    if (this.level) {
      this.scene.remove(this.level);
      this.level.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose();
      });
    }
    const level = new Group();
    this.level = level;
    this.track = track;
    this.propMeshes = [];
    this.pickupMeshes = [];
    for (const b of track.statics) {
      const m = box(level, b.half[0] * 2, b.half[1] * 2, b.half[2] * 2, b.color, ...b.pos);
      if (b.quat) m.quaternion.fromArray(b.quat);
    }
    for (const d of track.decor) level.add(buildDecor(d));
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
    this.scene.add(level);
    this.camReady = false;
  }

  private resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setVehicle(spec: VehicleSpec): void {
    if (this.model) this.scene.remove(this.model.root);
    this.model = buildVehicle(spec);
    this.scene.add(this.model.root);
    this.camReady = false;
  }

  /**
   * @param alpha position between the last two physics steps, 0…1
   * @param showroom circle the camera around the parked vehicle (start screen)
   */
  render(core: GameCore, alpha: number, dt: number, showroom = false): void {
    const model = this.model;
    const track = this.track;
    if (!model || !track) return;
    const v = core.sim.vehicle;
    this.time += dt;

    place(model.root, v.tracked, alpha);
    v.spec.wheels.forEach((w, i) => {
      const m = model.wheels[i];
      m.pivot.position.y = w.y - v.wheelSuspension(i);
      m.pivot.rotation.y = v.wheelYaw[i];
      m.spin.rotation.x = v.wheelSpin(i);
    });
    // The driver leans out of the corner, a lot.
    const target = Math.max(-0.45, Math.min(0.45, v.yawRate * v.speed * 0.05));
    this.lean += (target - this.lean) * Math.min(1, dt * 6);
    model.driver.rotation.z = this.lean;
    // Pushing the rims: both arms swing with the stroke.
    for (const arm of model.arms) arm.rotation.x = -0.15 + Math.sin(v.pushPhase) * 0.45;

    core.sim.props.forEach((p, i) => place(this.propMeshes[i], p.tracked, alpha));
    this.pickupMeshes.forEach((m, i) => {
      m.visible = !showroom && core.pickupTimers[i] === 0;
      m.rotation.y = this.time * 2 + i;
      m.position.y = track.pickups[i].pos[1] + Math.sin(this.time * 3 + i) * 0.08;
    });

    if (showroom) this.showroomCamera(model.root.position, v.yaw);
    else this.updateCamera(model.root.position, v.yaw, Math.abs(v.speed), dt);
    this.renderer.render(this.scene, this.camera);
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
    this.sun.position.set(pos.x + 18, pos.y + 34, pos.z - 12);
    this.sun.target.position.copy(pos);
    this.camReady = false;
  }

  private updateCamera(pos: Vector3, yaw: number, speed: number, dt: number): void {
    if (!this.camReady) {
      this.camYaw = yaw;
      this.camReady = true;
    }
    // Swing behind the vehicle along the shorter way round.
    let diff = yaw - this.camYaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.camYaw += diff * (1 - Math.exp(-dt * 3.5));

    const dist = 3.0 + speed * 0.14;
    const height = 1.7 + speed * 0.04;
    const sx = Math.sin(this.camYaw), cz = Math.cos(this.camYaw);
    this.camera.position.set(pos.x - sx * dist, Math.max(0.5, pos.y + height), pos.z - cz * dist);
    this.camera.lookAt(pos.x + sx * 1.5, pos.y + 0.55, pos.z + cz * 1.5);
    // Wider lens at speed: 60 km/h in a wheelchair should look terrifying.
    const fov = 58 + Math.min(34, speed * 2);
    if (Math.abs(fov - this.camera.fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    this.sun.position.set(pos.x + 18, pos.y + 34, pos.z - 12);
    this.sun.target.position.copy(pos);
  }
}
