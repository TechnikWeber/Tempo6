import { BoxGeometry, type Group, Mesh, MeshBasicMaterial, type Object3D, Quaternion, Vector3 } from 'three';

const SEGMENTS = 16;
const PER_BOLT = 4;
const FORWARD = new Vector3(0, 0, 1);
const from = new Vector3();
const to = new Vector3();
const dir = new Vector3();
const q = new Quaternion();
const rnd = (spread: number) => (Math.random() - 0.5) * 2 * spread;

/**
 * Lightning around the battery while the battery pack discharges: a handful of jagged
 * bolts that are thrown anew many times a second. All unlit
 * meshes: a real light here would make every material in the scene more expensive.
 */
export class Sparks {
  private readonly segs: Mesh[] = [];
  private on = false;
  private timer = 0;

  /**
   * @param parent the sprung body of the vehicle, so the bolts ride along
   * @param battery where the battery sits, in `parent` space
   * @param terminals where the battery pack's legs end, or null if none is fitted
   */
  constructor(parent: Group, private readonly battery: Vector3, private readonly terminals: Vector3 | null) {
    const geo = new BoxGeometry(1, 1, 1);
    const mat = new MeshBasicMaterial({ color: 0xcfefff, toneMapped: false });
    for (let i = 0; i < SEGMENTS; i++) {
      const m = new Mesh(geo, mat);
      m.visible = false;
      parent.add(m);
      this.segs.push(m);
    }
  }

  /** @param level 0…1, how hard the boost is pushing */
  update(level: number, dt: number): void {
    if (level < 0.04) {
      if (this.on) {
        this.on = false;
        for (const s of this.segs) s.visible = false;
      }
      return;
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.04;
    this.on = true;

    const bolts = Math.min(SEGMENTS / PER_BOLT, 1 + Math.round(level * 3));
    let n = 0;
    for (let b = 0; b < SEGMENTS / PER_BOLT; b++) {
      const live = b < bolts;
      // The first bolt jumps across from the battery pack, the others crawl out of the battery.
      const jump = b === 0 && this.terminals;
      if (jump) {
        from.copy(this.terminals!);
      } else {
        dir.set(rnd(1), rnd(0.5) + 0.15, rnd(1)).normalize();
        from.copy(this.battery).addScaledVector(dir, 0.1);
      }
      for (let k = 0; k < PER_BOLT; k++) {
        const seg = this.segs[n++];
        seg.visible = live;
        if (!live) continue;
        if (jump) {
          // Head for the battery, with a kink in every piece.
          to.copy(this.battery).sub(from).multiplyScalar(1 / (PER_BOLT - k));
          to.add(from);
          if (k < PER_BOLT - 1) to.x += rnd(0.07), to.y += rnd(0.07), to.z += rnd(0.07);
        } else {
          to.copy(from).addScaledVector(dir, 0.07 + Math.random() * 0.07);
          to.x += rnd(0.06), to.y += rnd(0.06), to.z += rnd(0.06);
        }
        const len = from.distanceTo(to);
        const thick = 0.008 + Math.random() * 0.012 * level;
        seg.position.copy(from).add(to).multiplyScalar(0.5);
        seg.quaternion.copy(q.setFromUnitVectors(FORWARD, dir.copy(to).sub(from).normalize()));
        seg.scale.set(thick, thick, Math.max(len, 0.01));
        from.copy(to);
        if (!jump) dir.set(dir.x + rnd(0.6), dir.y + rnd(0.6), dir.z + rnd(0.6)).normalize();
      }
    }
  }
}

const LINES = 44;

/**
 * Speed streaks while boosting: thin bright bars that rush past the camera, around the
 * edge of the view. They hang on the camera, so there is nothing to lay out or mask.
 */
export class SpeedLines {
  private readonly lines: Mesh[] = [];
  private readonly mat = new MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0, depthWrite: false, depthTest: false });

  constructor(camera: Object3D) {
    const geo = new BoxGeometry(1, 1, 1);
    for (let i = 0; i < LINES; i++) {
      const m = new Mesh(geo, this.mat);
      m.visible = false;
      m.frustumCulled = false;
      m.renderOrder = 10;
      this.place(m, -Math.random() * 26);
      camera.add(m);
      this.lines.push(m);
    }
  }

  private place(m: Mesh, z: number): void {
    const a = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.random() * 2.6;
    // wider than high, like the screen
    m.position.set(Math.cos(a) * r * 1.5, Math.sin(a) * r, z);
    const t = 0.008 + Math.random() * 0.014;
    m.scale.set(t, t, 1.5 + Math.random() * 3.5);
  }

  /** @param level 0…1 @param speed m/s */
  update(level: number, speed: number, dt: number): void {
    const show = level > 0.03;
    if (!show && this.mat.opacity === 0) return;
    this.mat.opacity = show ? level * 0.55 : 0;
    const rush = (25 + speed * 2.5) * dt;
    for (const m of this.lines) {
      m.visible = show;
      if (!show) continue;
      m.position.z += rush;
      if (m.position.z > 1) this.place(m, -26);
    }
  }
}
