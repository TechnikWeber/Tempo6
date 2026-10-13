import { beforeAll, describe, expect, it } from 'vitest';
import { STAGES } from '../src/config/tuning';
import { HANDLING, SCOOTER, WHEELCHAIR, type VehicleSpec } from '../src/config/vehicles';
import { GameCore, type GameInput } from '../src/sim/GameCore';
import { Progress } from '../src/sim/Progress';
import { Race } from '../src/sim/Race';
import { initPhysics, Sim } from '../src/sim/Sim';
import type { TrackDef } from '../src/sim/Track';
import { PARKPLATZ } from '../src/tracks/parkplatz';

const FLAT: TrackDef = {
  name: 'flat',
  spawn: { pos: [0, 0.5, 0], yaw: 0 },
  statics: [{ pos: [0, -0.5, 0], half: [500, 0.5, 500], color: 0 }],
  props: [],
  gates: [],
  pickups: [],
  decor: [],
};

const idle: GameInput = { throttle: 0, steer: 0, handbrake: false, upright: false, respawn: false, tune: false, selectVehicle: null };

function drive(sim: Sim, seconds: number, throttle: number, steer = 0, handbrake = false) {
  for (let i = 0; i < seconds * 60; i++) sim.step({ throttle, steer, handbrake });
}

beforeAll(async () => {
  await initPhysics();
});

describe.each<[string, VehicleSpec]>([
  ['wheelchair', WHEELCHAIR],
  ['scooter', SCOOTER],
])('%s', (_name, spec) => {
  it('settles on its wheels', () => {
    const sim = new Sim(FLAT, spec);
    drive(sim, 2, 0);
    expect(sim.vehicle.wheelsOnGround).toBe(4);
    expect(sim.vehicle.upY).toBeGreaterThan(0.99);
    expect(Math.abs(sim.vehicle.speed)).toBeLessThan(0.02);
  });

  it.each([0, 3, 7, 11, 12])('reaches the top speed of stage %i and no more', (stage) => {
    const sim = new Sim(FLAT, spec);
    const s = STAGES[stage];
    sim.vehicle.setMotor(s.topSpeedKmh / 3.6, s.accel);
    drive(sim, 10, 1);
    const kmh = sim.vehicle.speed * 3.6;
    expect(kmh).toBeGreaterThan(s.topSpeedKmh * 0.95);
    expect(kmh).toBeLessThan(s.topSpeedKmh * 1.02);
    expect(Math.abs(sim.vehicle.body.translation().x)).toBeLessThan(0.5);
  });

  it('brakes by itself when the stick is released', () => {
    const sim = new Sim(FLAT, spec);
    sim.vehicle.setMotor(40 / 3.6, 5.5);
    drive(sim, 6, 1);
    drive(sim, 4, 0);
    expect(Math.abs(sim.vehicle.speed)).toBeLessThan(0.1);
  });

  it('brakes hard when pulling back, clearly harder than just letting go', () => {
    const stopFrom40 = (throttle: number) => {
      const sim = new Sim(FLAT, spec);
      sim.vehicle.setMotor(40 / 3.6, 5.5);
      drive(sim, 6, 1);
      const z0 = sim.vehicle.body.translation().z;
      let steps = 0;
      while (sim.vehicle.speed > 0.3 && steps++ < 600) sim.step({ throttle, steer: 0, handbrake: false });
      expect(sim.vehicle.upY).toBeGreaterThan(0.9);
      return sim.vehicle.body.translation().z - z0;
    };
    const coasting = stopFrom40(0);
    const braking = stopFrom40(-1);
    expect(braking).toBeLessThan(8.5);
    expect(braking).toBeLessThan(coasting * 0.65);
  });

  it('reverses', () => {
    const sim = new Sim(FLAT, spec);
    drive(sim, 3, -1);
    expect(sim.vehicle.speed).toBeLessThan(-0.6);
  });

  it.each([6, 12, 30, 60])('turns right at %i km/h without flipping or spinning out', (kmh) => {
    const sim = new Sim(FLAT, spec);
    sim.vehicle.setMotor(kmh / 3.6, 6);
    drive(sim, 6, 1);
    drive(sim, 3, 1, 1);
    const v = sim.vehicle;
    expect(v.upY).toBeGreaterThan(0.6);
    expect(v.yawRate).toBeLessThan(-0.1);
    // still travelling mostly nose first
    const lv = v.body.linvel();
    expect(v.speed).toBeGreaterThan(Math.hypot(lv.x, lv.z) * 0.8);
  });
});

describe.each<[string, VehicleSpec]>([
  ['wheelchair', WHEELCHAIR],
  ['scooter', SCOOTER],
])('%s cornering', (_name, spec) => {
  it.each([0, 6, 12])('steers while accelerating flat out from a standstill (stage %i)', (stage) => {
    const sim = new Sim(FLAT, spec);
    const s = STAGES[stage];
    sim.vehicle.setMotor(s.topSpeedKmh / 3.6, s.accel);
    drive(sim, 1, 0);
    drive(sim, 0.8, 1, -1);
    expect(sim.vehicle.yawRate).toBeGreaterThan(0.4);
    expect(sim.vehicle.upY).toBeGreaterThan(0.8);
  });

  it('rides on two wheels at full lock and speed, but stays up', () => {
    const sim = new Sim(FLAT, spec);
    sim.vehicle.setMotor(30 / 3.6, 5);
    drive(sim, 5, 1);
    let maxRoll = 0;
    let minWheels = 4;
    for (let i = 0; i < 60 * 6; i++) {
      sim.step({ throttle: 1, steer: 1, handbrake: false });
      maxRoll = Math.max(maxRoll, Math.abs(sim.vehicle.roll));
      minWheels = Math.min(minWheels, sim.vehicle.wheelsOnGround);
    }
    expect(maxRoll).toBeGreaterThan(0.12);
    expect(minWheels).toBeLessThanOrEqual(2);
    expect(sim.vehicle.upY).toBeGreaterThan(0.6);
    expect(sim.vehicle.yawRate).toBeLessThan(-0.2);
  });

  it('falls over without the tip assist', () => {
    const sim = new Sim(FLAT, spec);
    const saved = HANDLING.tipAssist;
    HANDLING.tipAssist = 0;
    try {
      sim.vehicle.setMotor(40 / 3.6, 5.5);
      drive(sim, 5, 1);
      let minUp = 1;
      for (let i = 0; i < 60 * 4; i++) {
        sim.step({ throttle: 1, steer: 1, handbrake: false });
        minUp = Math.min(minUp, sim.vehicle.upY);
      }
      expect(minUp).toBeLessThan(0.3);
    } finally {
      HANDLING.tipAssist = saved;
    }
  });

  it('stays on four wheels at gentle steering', () => {
    const sim = new Sim(FLAT, spec);
    sim.vehicle.setMotor(30 / 3.6, 5);
    drive(sim, 5, 1);
    drive(sim, 4, 1, 0.5);
    expect(Math.abs(sim.vehicle.roll)).toBeLessThan(0.2);
    expect(sim.vehicle.wheelsOnGround).toBeGreaterThanOrEqual(3);
  });
});

describe('wheelchair', () => {
  it('turns on the spot', () => {
    const sim = new Sim(FLAT, WHEELCHAIR);
    drive(sim, 1, 0);
    drive(sim, 2, 0, 1);
    expect(sim.vehicle.yawRate).toBeLessThan(-1.5);
    const p = sim.vehicle.body.translation();
    expect(Math.hypot(p.x, p.z)).toBeLessThan(1);
  });
});

describe('race', () => {
  it('counts a lap only after all gates in order', () => {
    const race = new Race(PARKPLATZ.gates);
    const at = (i: number) => race.update(PARKPLATZ.gates[i].x, PARKPLATZ.gates[i].z, 1);
    expect(at(0)).toBe('start');
    expect(at(2)).toBe(null);
    expect(at(0)).toBe(null);
    expect(at(1)).toBe(null);
    expect(at(2)).toBe(null);
    expect(at(3)).toBe(null);
    expect(at(0)).toBe('lap');
    expect(race.laps).toBe(1);
    expect(race.best).toBeGreaterThan(0);
  });
});

describe('game on the Parkplatz', () => {
  it('collects bottles on the start straight and tunes once the money is there', () => {
    const core = new GameCore(PARKPLATZ, new Progress());
    for (let i = 0; i < 60 * 40; i++) core.step({ ...idle, throttle: 1 });
    // drove east along the start straight until the cones: three bottles
    expect(core.progress.money).toBe(75);
    expect(core.race.running).toBe(true);
    core.progress.earn(25);
    core.step({ ...idle, tune: true });
    expect(core.progress.stageIndex).toBe(1);
    expect(core.sim.vehicle.topSpeed).toBeCloseTo(8 / 3.6);
  });

  it('restarts the level: vehicle, props and pickups back, money kept', () => {
    const core = new GameCore(PARKPLATZ, new Progress());
    const cone = core.sim.props[0];
    cone.tracked.body.setTranslation({ x: 5, y: 3, z: 5 }, true);
    for (let i = 0; i < 60 * 12; i++) core.step({ ...idle, throttle: 1 });
    const money = core.progress.money;
    expect(money).toBeGreaterThan(0);
    core.step({ ...idle, respawn: true });
    const p = core.sim.vehicle.body.translation();
    expect(Math.hypot(p.x - PARKPLATZ.spawn.pos[0], p.z - PARKPLATZ.spawn.pos[2])).toBeLessThan(0.2);
    const c = cone.tracked.body.translation();
    expect(Math.hypot(c.x - cone.def.pos[0], c.z - cone.def.pos[2])).toBeLessThan(0.2);
    expect(core.pickupTimers.every((t) => t === 0)).toBe(true);
    expect(core.race.running).toBe(false);
    expect(core.progress.money).toBe(money);
  });

  it('cannot tune without money', () => {
    const core = new GameCore(PARKPLATZ, new Progress());
    core.step({ ...idle, tune: true });
    expect(core.progress.stageIndex).toBe(0);
    expect(core.events.some((e) => e.type === 'broke')).toBe(true);
  });

  it('gets up the kicker ramp even in factory condition', () => {
    const core = new GameCore(PARKPLATZ, new Progress());
    core.sim.vehicle.place(6, 0.5, 8.6, -Math.PI / 2);
    let maxY = 0;
    for (let i = 0; i < 60 * 8; i++) {
      core.step({ ...idle, throttle: 1 });
      maxY = Math.max(maxY, core.sim.vehicle.body.translation().y);
    }
    expect(maxY).toBeGreaterThan(0.7);
    expect(core.sim.vehicle.body.translation().x).toBeLessThan(-2);
  });

  it('flies off the big ramp at 60 km/h and can be put back on its wheels', () => {
    const core = new GameCore(PARKPLATZ, new Progress());
    core.sim.vehicle.setMotor(60 / 3.6, 7);
    core.sim.vehicle.place(40, 0.5, -40, 0);
    let maxY = 0;
    for (let i = 0; i < 60 * 7; i++) {
      core.step({ ...idle, throttle: 1 });
      maxY = Math.max(maxY, core.sim.vehicle.body.translation().y);
    }
    expect(maxY).toBeGreaterThan(3);
    core.step({ ...idle, upright: true });
    for (let i = 0; i < 120; i++) core.step(idle);
    expect(core.sim.vehicle.upY).toBeGreaterThan(0.95);
  });
});
