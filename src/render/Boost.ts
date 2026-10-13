import { BoxGeometry, type Group, Mesh, MeshBasicMaterial, PointLight, Quaternion, Vector3 } from 'three';

const SEGMENTS = 16;
const PER_BOLT = 4;
const FORWARD = new Vector3(0, 0, 1);
const from = new Vector3();
const to = new Vector3();
const dir = new Vector3();
const q = new Quaternion();
const rnd = (spread: number) => (Math.random() - 0.5) * 2 * spread;

/**
 * Lightning around the battery while the capacitor discharges: a handful of jagged
 * bolts that are thrown anew many times a second, plus a cold flicker of light.
 */
export class Sparks {
  private readonly segs: Mesh[] = [];
  private readonly light = new PointLight(0x7fd4ff, 0, 5, 2);
  private timer = 0;

  /**
   * @param parent the sprung body of the vehicle, so the bolts ride along
   * @param battery where the battery sits, in `parent` space
   * @param terminals where the capacitor's legs end, or null if none is fitted
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
    this.light.position.copy(battery);
    parent.add(this.light);
  }

  /** @param level 0…1, how hard the boost is pushing */
  update(level: number, dt: number): void {
    if (level < 0.04) {
      if (this.light.intensity !== 0) {
        this.light.intensity = 0;
        for (const s of this.segs) s.visible = false;
      }
      return;
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.04;
    this.light.intensity = level * (4 + Math.random() * 10);

    const bolts = Math.min(SEGMENTS / PER_BOLT, 1 + Math.round(level * 3));
    let n = 0;
    for (let b = 0; b < SEGMENTS / PER_BOLT; b++) {
      const live = b < bolts;
      // The first bolt jumps across from the capacitor, the others crawl out of the battery.
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
