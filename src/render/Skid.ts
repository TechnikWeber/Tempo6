import {
  BoxGeometry, BufferAttribute, BufferGeometry, DynamicDrawUsage, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  type Scene, Vector3,
} from 'three';
import type { Vehicle } from '../sim/Vehicle';

const SEGMENTS = 900;
const LIFETIME = 14;
const FADE = 5;
const PUFFS = 40;

const a = new Vector3();
const b = new Vector3();
const side = new Vector3();
const UP = new Vector3(0, 1, 0);

/**
 * Black tyre marks that fade away, plus puffs of tyre smoke. One ring buffer of quads:
 * the oldest mark is overwritten when it runs out.
 */
export class SkidMarks {
  private readonly pos = new Float32Array(SEGMENTS * 4 * 3);
  private readonly col = new Float32Array(SEGMENTS * 4 * 4);
  private readonly born = new Float32Array(SEGMENTS).fill(-1e9);
  private readonly strength = new Float32Array(SEGMENTS);
  private readonly geo = new BufferGeometry();
  private readonly mesh: Mesh;
  private next = 0;
  private time = 0;
  /** Last ground contact per wheel while it was skidding. */
  private last: (Vector3 | null)[] = [];

  private readonly puffs: { mesh: Mesh; mat: MeshStandardMaterial; age: number; life: number; vx: number; vz: number }[] = [];
  private nextPuff = 0;
  private puffTimer = 0;

  constructor(scene: Scene) {
    const index: number[] = [];
    for (let i = 0; i < SEGMENTS; i++) index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3);
    this.geo.setIndex(index);
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage));
    this.geo.setAttribute('color', new BufferAttribute(this.col, 4).setUsage(DynamicDrawUsage));
    const mat = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    this.mesh = new Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    const puffGeo = new BoxGeometry(1, 1, 1);
    for (let i = 0; i < PUFFS; i++) {
      const m = new MeshStandardMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0, depthWrite: false, flatShading: true });
      const mesh = new Mesh(puffGeo, m);
      mesh.visible = false;
      scene.add(mesh);
      this.puffs.push({ mesh, mat: m, age: 0, life: 1, vx: 0, vz: 0 });
    }
  }

  clear(): void {
    this.born.fill(-1e9);
    this.col.fill(0);
    this.geo.attributes.color.needsUpdate = true;
    this.last = [];
    for (const p of this.puffs) p.mesh.visible = false;
  }

  update(v: Vehicle, dt: number): void {
    this.time += dt;
    let smokeAt: Vector3 | null = null;
    let smoke = 0;

    v.spec.wheels.forEach((w, i) => {
      const s = v.skid[i];
      const c = s > 0.15 ? v.wheelContact(i) : null;
      if (!c) {
        this.last[i] = null;
        return;
      }
      b.set(c.x, c.y + 0.012, c.z);
      const prev = this.last[i];
      if (!prev) {
        this.last[i] = b.clone();
        return;
      }
      if (prev.distanceToSquared(b) < 0.0036) return;
      a.copy(prev);
      this.addSegment(a, b, w.radius >= 0.25 ? 0.02 : w.caster ? 0.022 : 0.045, s);
      prev.copy(b);
      if (s > smoke) {
        smoke = s;
        smokeAt = b.clone();
      }
    });

    // Fade: only the alpha of segments that are still alive needs touching.
    for (let i = 0; i < SEGMENTS; i++) {
      const age = this.time - this.born[i];
      if (age > LIFETIME + 0.5) continue;
      const alpha = Math.max(0, Math.min(1, (LIFETIME - age) / FADE)) * this.strength[i];
      for (let k = 0; k < 4; k++) this.col[(i * 4 + k) * 4 + 3] = alpha;
    }
    this.geo.attributes.color.needsUpdate = true;

    this.puffTimer -= dt;
    if (smokeAt && smoke > 0.5 && this.puffTimer <= 0) {
      this.puffTimer = 0.05;
      this.spawnPuff(smokeAt, smoke);
    }
    for (const p of this.puffs) {
      if (!p.mesh.visible) continue;
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        p.mesh.visible = false;
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.position.y += 0.7 * dt;
      p.mesh.scale.setScalar(0.12 + t * 0.45);
      p.mesh.rotation.y += dt * 2;
      p.mat.opacity = 0.38 * (1 - t);
    }
  }

  private addSegment(from: Vector3, to: Vector3, halfWidth: number, strength: number): void {
    const i = this.next;
    this.next = (this.next + 1) % SEGMENTS;
    side.subVectors(to, from).cross(UP).normalize().multiplyScalar(halfWidth);
    const p = this.pos;
    const o = i * 12;
    p[o] = from.x - side.x; p[o + 1] = from.y; p[o + 2] = from.z - side.z;
    p[o + 3] = from.x + side.x; p[o + 4] = from.y; p[o + 5] = from.z + side.z;
    p[o + 6] = to.x - side.x; p[o + 7] = to.y; p[o + 8] = to.z - side.z;
    p[o + 9] = to.x + side.x; p[o + 10] = to.y; p[o + 11] = to.z + side.z;
    this.geo.attributes.position.needsUpdate = true;
    for (let k = 0; k < 4; k++) {
      const c = (i * 4 + k) * 4;
      this.col[c] = this.col[c + 1] = this.col[c + 2] = 0.03;
    }
    this.born[i] = this.time;
    this.strength[i] = 0.5 + 0.45 * strength;
  }

  private spawnPuff(at: Vector3, strength: number): void {
    const p = this.puffs[this.nextPuff];
    this.nextPuff = (this.nextPuff + 1) % PUFFS;
    p.mesh.visible = true;
    p.mesh.position.set(at.x, at.y + 0.08, at.z);
    p.age = 0;
    p.life = 0.6 + 0.6 * strength;
    p.vx = (Math.random() - 0.5) * 0.8;
    p.vz = (Math.random() - 0.5) * 0.8;
    p.mat.opacity = 0.38;
  }
}
