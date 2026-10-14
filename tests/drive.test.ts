import { beforeAll, describe, expect, it } from 'vitest';
import { BONUS, BOOST, DAMAGE, stageSpeedKmh, STAGES, STUNTS } from '../src/config/tuning';
import { CRASH, MODES, RACE } from '../src/config/modes';
import { HANDLING, VEHICLES, VEHICLE_ORDER, type VehicleSpec } from '../src/config/vehicles';
import { GameCore, type GameEvent, type GameInput } from '../src/sim/GameCore';
import { Progress } from '../src/sim/Progress';
import { Race } from '../src/sim/Race';
import { initPhysics, Sim } from '../src/sim/Sim';
import { Stunts } from '../src/sim/Stunts';
import { looping, ramp, type TrackDef } from '../src/sim/Track';
import { trackById, trackOpen, TRACKS, TRAINING } from '../src/tracks';
import { KURVEN } from '../src/tracks/kurven';
import { PARKPLATZ } from '../src/tracks/parkplatz';
import { REHA } from '../src/tracks/reha';
import { Autopilot } from './autopilot';

const FLAT: TrackDef = {
  id: 'flat',
  name: 'flat',
  blurb: '',
  unlockPrice: 0,
  lapPay: 0,
  spawn: { pos: [0, 0.7, 0], yaw: 0 },
  statics: [{ pos: [0, -0.5, 0], half: [500, 0.5, 500], color: 0 }],
  props: [],
  gates: [],
  pickups: [],
  decor: [],
};

const idle: GameInput = { throttle: 0, steer: 0, handbrake: false, upright: false, respawn: false, tune: false };
const ALL: [string, VehicleSpec][] = VEHICLE_ORDER.map((id) => [id, VEHICLES[id]]);

function drive(sim: Sim, seconds: number, throttle: number, steer = 0, handbrake = false) {
  for (let i = 0; i < seconds * 60; i++) sim.step({ throttle, steer, handbrake });
}

/** A sim with the motor set like the game does for a tuning stage's numbers. */
function simAt(spec: VehicleSpec, kmh: number, accel: number): Sim {
  const sim = new Sim(FLAT, spec);
  sim.vehicle.setMotor((kmh * spec.speedFactor) / 3.6, accel * spec.accelFactor);
  return sim;
}

beforeAll(async () => {
  await initPhysics();
});

describe.each(ALL)('%s', (_name, spec) => {
  it('has wheel loads adding up to the full weight', () => {
    expect(spec.wheels.reduce((s, w) => s + w.load, 0)).toBeCloseTo(1, 2);
  });

  it('settles level on all its wheels', () => {
    const sim = new Sim(FLAT, spec);
    drive(sim, 3, 0);
    expect(sim.vehicle.wheelsOnGround).toBe(spec.wheels.length);
    expect(sim.vehicle.upY).toBeGreaterThan(0.99);
    expect(Math.abs(sim.vehicle.speed)).toBeLessThan(0.02);
    // chassis rides at the designed height
    const y = sim.vehicle.body.translation().y;
    expect(y).toBeGreaterThan(spec.half[1] + spec.clearance - 0.05);
    expect(y).toBeLessThan(spec.half[1] + spec.clearance + 0.05);
  });

  it.each([0, 3, 5, STAGES.length - 1])('reaches its top speed at stage %i and no more', (stage) => {
    const s = STAGES[stage];
    const sim = simAt(spec, s.topSpeedKmh, s.accel);
    drive(sim, 20, 1);
    const top = s.topSpeedKmh * spec.speedFactor;
    const kmh = sim.vehicle.speed * 3.6;
    expect(kmh).toBeGreaterThan(top * 0.93);
    expect(kmh).toBeLessThan(top * 1.03);
    expect(Math.abs(sim.vehicle.body.translation().x)).toBeLessThan(6);
    expect(sim.vehicle.upY).toBeGreaterThan(0.8);
  });

  it('brakes by itself when the stick is released', () => {
    const sim = simAt(spec, 40, 5.5);
    drive(sim, 8, 1);
    drive(sim, 7, 0);
    expect(Math.abs(sim.vehicle.speed)).toBeLessThan(0.1);
  });

  it('brakes hard when pulling back, clearly harder than just letting go', () => {
    const stop = (throttle: number) => {
      const sim = simAt(spec, 40 / spec.speedFactor, 5.5);
      drive(sim, 8, 1);
      const z0 = sim.vehicle.body.translation().z;
      let steps = 0;
      while (sim.vehicle.speed > 0.3 && steps++ < 600) sim.step({ throttle, steer: 0, handbrake: false });
      expect(sim.vehicle.upY).toBeGreaterThan(0.85);
      return sim.vehicle.body.translation().z - z0;
    };
    const coasting = stop(0);
    const braking = stop(-1);
    expect(braking).toBeLessThan(16);
    expect(braking).toBeLessThan(coasting * 0.8);
  });

  it('reverses', () => {
    const sim = new Sim(FLAT, spec);
    drive(sim, 3, -1);
    expect(sim.vehicle.speed).toBeLessThan(-0.6);
  });

  it('stands for a moment after braking to a stop before it backs away', () => {
    const sim = simAt(spec, 40 / spec.speedFactor, 7);
    drive(sim, 8, 1);
    let steps = 0;
    while (sim.vehicle.speed > 0.3 && steps++ < 600) sim.step({ throttle: -1, steer: 0, handbrake: false });
    // the stick stays pulled back: nothing happens for a moment…
    let minUp = 1;
    for (let i = 0; i < 60 * HANDLING.reverseDelay; i++) {
      sim.step({ throttle: -1, steer: 0, handbrake: false });
      expect(sim.vehicle.speed).toBeGreaterThan(-0.3);
      minUp = Math.min(minUp, sim.vehicle.upY);
    }
    // …then it reverses after all
    drive(sim, 3, -1);
    expect(sim.vehicle.speed).toBeLessThan(-0.6);
    expect(minUp).toBeGreaterThan(0.9);
    expect(sim.vehicle.upY).toBeGreaterThan(0.95);
  });

  it.each([6, 12, 30, 60])('turns right at %i km/h without falling over or spinning out', (kmh) => {
    const sim = simAt(spec, kmh / spec.speedFactor, 6);
    drive(sim, 8, 1);
    drive(sim, 3, 1, 1);
    const v = sim.vehicle;
    expect(v.upY).toBeGreaterThan(0.6);
    expect(v.yawRate).toBeLessThan(-0.08);
    // still travelling mostly nose first (full lock costs forward speed even at walking
    // pace, while a front-driven chair's tail swings round as fast as ever)
    const lv = v.body.linvel();
    expect(v.speed).toBeGreaterThan(Math.hypot(lv.x, lv.z) * 0.75);
  });

  it.each([0, 4, STAGES.length - 1])('steers while accelerating flat out from a standstill (stage %i)', (stage) => {
    const s = STAGES[stage];
    const sim = simAt(spec, s.topSpeedKmh, s.accel);
    drive(sim, 1, 0);
    drive(sim, 1, 1, -1);
    expect(sim.vehicle.yawRate).toBeGreaterThan(0.25);
    expect(sim.vehicle.upY).toBeGreaterThan(0.8);
  });

  it('lifts wheels at full lock and speed, but stays up', () => {
    const sim = simAt(spec, 30 / spec.speedFactor, 5);
    drive(sim, 6, 1);
    let maxRoll = 0;
    let minWheels = spec.wheels.length;
    for (let i = 0; i < 60 * 6; i++) {
      sim.step({ throttle: 1, steer: 1, handbrake: false });
      maxRoll = Math.max(maxRoll, Math.abs(sim.vehicle.roll));
      minWheels = Math.min(minWheels, sim.vehicle.wheelsOnGround);
    }
    expect(sim.vehicle.upY).toBeGreaterThan(0.6);
    expect(sim.vehicle.yawRate).toBeLessThan(-0.15);
  });

  it('stays planted at gentle steering', () => {
    const sim = simAt(spec, 30 / spec.speedFactor, 5);
    drive(sim, 6, 1);
    drive(sim, 4, 1, 0.4);
    expect(Math.abs(sim.vehicle.roll)).toBeLessThan(0.25);
    expect(sim.vehicle.wheelsOnGround).toBeGreaterThanOrEqual(spec.wheels.length - 1);
  });

  it('gets up the kicker ramp even in factory condition', () => {
    const progress = new Progress();
    progress.vehicle = spec.id;
    const core = new GameCore(PARKPLATZ, progress);
    core.sim.vehicle.place(6, 0.7, 8.6, -Math.PI / 2);
    let maxY = 0;
    for (let i = 0; i < 60 * 9; i++) {
      core.step({ ...idle, throttle: 1 });
      maxY = Math.max(maxY, core.sim.vehicle.body.translation().y);
    }
    expect(maxY).toBeGreaterThan(spec.half[1] + spec.clearance + 0.3);
    expect(core.sim.vehicle.body.translation().x).toBeLessThan(-2);
    core.dispose();
  });
});

const VARIANTS = ALL.flatMap(([id, spec]) => spec.profiles.slice(1).map((p, i) => [`${id} / ${p.name}`, spec, i + 1] as const));

describe.each(VARIANTS)('profile %s', (_name, spec, index) => {
  const p = spec.profiles[index];
  const make = (kmh: number, accel: number) => {
    const sim = new Sim(FLAT, spec);
    sim.vehicle.profile = p;
    sim.vehicle.setMotor((kmh * spec.speedFactor * p.speed) / 3.6, accel * spec.accelFactor * p.accel);
    return sim;
  };

  it('reaches its top speed and stops again', () => {
    const sim = make(27, 4.6);
    drive(sim, 14, 1);
    const top = 27 * spec.speedFactor * p.speed;
    expect(sim.vehicle.speed * 3.6).toBeGreaterThan(top * 0.93);
    expect(sim.vehicle.speed * 3.6).toBeLessThan(top * 1.03);
    drive(sim, 10, 0);
    expect(Math.abs(sim.vehicle.speed)).toBeLessThan(0.15);
    expect(sim.vehicle.upY).toBeGreaterThan(0.9);
  });

  it('steers from a standstill and corners at 12 km/h without falling over', () => {
    const sim = make(12 / (spec.speedFactor * p.speed), 3.2);
    drive(sim, 1, 0);
    drive(sim, 1, 1, -1);
    expect(sim.vehicle.yawRate).toBeGreaterThan(0.3);
    drive(sim, 5, 1, 0);
    drive(sim, 4, 1, 1);
    expect(sim.vehicle.upY).toBeGreaterThan(0.6);
    expect(sim.vehicle.yawRate).toBeLessThan(-0.08);
  });

  it('holds full lock at 60 km/h and a boosted slalom without going over', () => {
    const sim = make(60 / (spec.speedFactor * p.speed), 9);
    sim.vehicle.boostFitted = true;
    drive(sim, 9, 1);
    let minUp = 1;
    for (let i = 0; i < 60 * 11; i++) {
      const weave = i >= 300;
      sim.step({ throttle: 1, steer: weave && Math.floor(i / 45) % 2 ? -1 : 1, handbrake: false, boost: weave });
      minUp = Math.min(minUp, sim.vehicle.upY);
    }
    expect(minUp).toBeGreaterThan(0.6);
    sim.world.free();
  });
});

describe('nimble profiles', () => {
  // More lean on top of sharper steering used to cancel out: on two wheels the tip assist
  // took the steering away again and the "nimble" one ran wider than the standard one.
  const NIMBLE = VARIANTS.filter(([, spec, index]) => spec.profiles[index].turn > 1);
  it.each(NIMBLE)('%s turns at least as quickly as the standard profile at any tuning stage', (_name, spec, index) => {
    const turnRate = (i: number, stage: number) => {
      const p = spec.profiles[i];
      const s = STAGES[stage];
      const sim = new Sim(FLAT, spec);
      sim.vehicle.profile = p;
      sim.vehicle.setMotor((s.topSpeedKmh * spec.speedFactor * p.speed) / 3.6, s.accel * spec.accelFactor * p.accel);
      drive(sim, 10, 1);
      drive(sim, 6, 1, 1);
      let rate = 0;
      for (let k = 0; k < 180; k++) {
        sim.step({ throttle: 1, steer: 1, handbrake: false });
        rate += Math.abs(sim.vehicle.yawRate) / 180;
      }
      expect(sim.vehicle.upY).toBeGreaterThan(0.7);
      sim.world.free();
      return rate;
    };
    // (stage 2 is about where the old mid stage was)
    for (const stage of [0, 2, STAGES.length - 1]) expect(turnRate(index, stage)).toBeGreaterThan(turnRate(0, stage) * 0.95);
  });
});

describe('profiles', () => {
  it('every vehicle offers at least three, with distinct names', () => {
    for (const [, spec] of ALL) {
      expect(spec.profiles.length).toBeGreaterThanOrEqual(3);
      expect(new Set(spec.profiles.map((x) => x.name)).size).toBe(spec.profiles.length);
    }
  });

  it('the game applies and remembers the chosen one', () => {
    const progress = new Progress();
    const core = new GameCore(PARKPLATZ, progress);
    core.setProfile(2);
    expect(core.sim.vehicle.profile.name).toBe('Sänfte');
    expect(core.topSpeedKmh).toBeCloseTo(STAGES[0].topSpeedKmh * 1.1);
    core.setVehicle('orkan');
    expect(core.profileIndex).toBe(0);
    core.setVehicle('trex');
    expect(core.sim.vehicle.profile.name).toBe('Sänfte');
    core.dispose();
  });
});

describe('mario kart manners', () => {
  // Full lock has to stay a corner at any speed, not open up into a motorway bend.
  it.each(ALL)('%s turns a tight circle at 30, 60 and 75 km/h without sliding or tipping over', (_id, spec) => {
    for (const [kmh, maxRadius] of [[30, 11], [60, 24], [75, 31]]) {
      const sim = simAt(spec, kmh / spec.speedFactor, 9);
      drive(sim, 9, 1);
      let slip = 0;
      let yaw = 0;
      let speed = 0;
      for (let i = 0; i < 60 * 5; i++) {
        sim.step({ throttle: 1, steer: 1, handbrake: false });
        if (i >= 120) {
          slip = Math.max(slip, Math.abs(sim.vehicle.slip));
          yaw += Math.abs(sim.vehicle.yawRate) / 180;
          speed += sim.vehicle.speed / 180;
        }
      }
      expect(sim.vehicle.upY).toBeGreaterThan(0.6);
      expect(speed * 3.6).toBeGreaterThan(kmh * 0.45);
      expect(speed / yaw).toBeLessThan(maxRadius);
      expect(slip).toBeLessThan(0.4);
      sim.world.free();
    }
  });

  it.each(ALL)('%s weaves left and right at 60 km/h and stays on its wheels', (_id, spec) => {
    const sim = simAt(spec, 60 / spec.speedFactor, 9);
    drive(sim, 9, 1);
    let minUp = 1;
    for (let i = 0; i < 60 * 8; i++) {
      sim.step({ throttle: 1, steer: Math.floor(i / 45) % 2 ? 1 : -1, handbrake: false });
      minUp = Math.min(minUp, sim.vehicle.upY);
    }
    expect(minUp).toBeGreaterThan(0.6);
    sim.world.free();
  });

  it.each(ALL)('%s lands the big jump on its wheels and drives on', (_id, spec) => {
    const progress = new Progress();
    progress.vehicle = spec.id;
    const core = new GameCore(PARKPLATZ, progress);
    core.sim.vehicle.setMotor(50 / 3.6, 6);
    core.sim.vehicle.place(40, 0.7, -40, 0);
    let maxY = 0;
    let landed = false;
    let after = 0;
    for (let i = 0; i < 60 * 9 && after < 50; i++) {
      // a clumsy take-off: steering while going up the ramp
      const z = core.sim.vehicle.body.translation().z;
      core.step({ ...idle, throttle: 1, steer: z > -8 && z < 2 ? 0.5 : 0 });
      maxY = Math.max(maxY, core.sim.vehicle.body.translation().y);
      landed ||= z > 3 && core.events.some((e) => e.type === 'land');
      core.events.length = 0;
      // judge it just under a second after touchdown
      if (landed) after++;
    }
    expect(maxY).toBeGreaterThan(1.5);
    expect(landed).toBe(true);
    expect(core.sim.vehicle.upY).toBeGreaterThan(0.9);
    expect(core.sim.vehicle.wheelsOnGround).toBeGreaterThanOrEqual(2);
    expect(Math.abs(core.sim.vehicle.speed)).toBeGreaterThan(3);
    core.dispose();
  });

  it.each(ALL)('%s slides along a wall instead of hooking on it', (_id, spec) => {
    const progress = new Progress();
    progress.vehicle = spec.id;
    const core = new GameCore(PARKPLATZ, progress);
    core.sim.vehicle.setMotor(30 / 3.6, 5);
    // towards the east wall of the lot at 30°
    core.sim.vehicle.place(50, 0.7, -30, 0.52);
    const z0 = -30;
    for (let i = 0; i < 60 * 10; i++) core.step({ ...idle, throttle: 1 });
    const p = core.sim.vehicle.body.translation();
    expect(core.sim.vehicle.upY).toBeGreaterThan(0.8);
    // it reached the wall (40 m away along its heading) and kept moving along it
    expect(p.x).toBeGreaterThan(55);
    expect(p.z - z0).toBeGreaterThan(45);
    core.dispose();
  });
});

describe('slowing down', () => {
  // Rear-driven chairs used to be flung forward by their own turning and sped up at full lock.
  it.each(ALL)('%s never gains speed at full lock, and loses some even at walking pace', (_id, spec) => {
    for (const stage of [0, 3]) {
      const s = STAGES[stage];
      const sim = simAt(spec, s.topSpeedKmh, s.accel);
      drive(sim, 8, 1);
      const before = Math.hypot(sim.vehicle.body.linvel().x, sim.vehicle.body.linvel().z);
      let fastest = 0;
      for (let i = 0; i < 60 * 4; i++) {
        sim.step({ throttle: 1, steer: 1, handbrake: false });
        fastest = Math.max(fastest, Math.hypot(sim.vehicle.body.linvel().x, sim.vehicle.body.linvel().z));
      }
      const after = Math.hypot(sim.vehicle.body.linvel().x, sim.vehicle.body.linvel().z);
      expect(fastest).toBeLessThan(before * 1.02);
      expect(after).toBeLessThan(before * 0.97);
      sim.world.free();
    }
  });

  it.each(ALL)('%s loses a good part of its speed at full lock and gets it back afterwards', (_id, spec) => {
    const sim = simAt(spec, 60 / spec.speedFactor, 9);
    drive(sim, 9, 1);
    const before = sim.vehicle.speed;
    drive(sim, 1, 1, 1);
    // a drag, not an emergency stop
    expect(sim.vehicle.speed).toBeLessThan(before * 0.92);
    expect(sim.vehicle.speed).toBeGreaterThan(before * 0.6);
    drive(sim, 2, 1, 1);
    expect(sim.vehicle.speed).toBeLessThan(before * 0.88);
    expect(sim.vehicle.speed).toBeGreaterThan(before * 0.5);
    drive(sim, 4, 1);
    expect(sim.vehicle.speed).toBeGreaterThan(before * 0.93);
    sim.world.free();
  });

  it.each(ALL)('%s coasts down just as gently with a strong motor as with a weak one', (_id, spec) => {
    const coast = (accel: number) => {
      const sim = simAt(spec, 40, accel);
      drive(sim, 10, 1);
      const z0 = sim.vehicle.body.translation().z;
      drive(sim, 6, 0);
      const d = sim.vehicle.body.translation().z - z0;
      sim.world.free();
      return d;
    };
    expect(coast(11)).toBeGreaterThan(coast(3) * 0.9);
  });

  // A driven front fork used to dig in when turned without throttle and stop it dead.
  const HANDLEBARS = ALL.filter(([, spec]) => spec.wheels.some((w) => w.steer))
    .flatMap(([id, spec]) => spec.profiles.map((p, i) => [`${id} / ${p.name}`, spec, i] as const));
  it.each(HANDLEBARS)('%s rolls round a bend when coasting instead of digging in', (_name, spec, index) => {
    const coast = (kmh: number, steer: number) => {
      const p = spec.profiles[index];
      const sim = simAt(spec, kmh * p.speed, 2.5 * p.accel);
      sim.vehicle.profile = p;
      drive(sim, 8, 1);
      let steps = 0;
      while (Math.abs(sim.vehicle.speed) > 0.15 && steps++ < 600) sim.step({ throttle: 0, steer, handbrake: false });
      sim.world.free();
      return steps / 60;
    };
    for (const kmh of [6, 12]) {
      const straight = coast(kmh, 0);
      const turning = coast(kmh, 1);
      expect(turning).toBeGreaterThan(straight * 0.9);
      // …but letting go still stops it
      expect(turning).toBeLessThan(straight * 2.5);
    }
  });

  it.each(ALL)('%s stops from 60 km/h within 19 m on the brake', (_id, spec) => {
    const sim = simAt(spec, 60 / spec.speedFactor, 9);
    drive(sim, 9, 1);
    const z0 = sim.vehicle.body.translation().z;
    let steps = 0;
    while (sim.vehicle.speed > 0.3 && steps++ < 600) sim.step({ throttle: -1, steer: 0, handbrake: false });
    expect(sim.vehicle.body.translation().z - z0).toBeLessThan(19);
    expect(sim.vehicle.upY).toBeGreaterThan(0.8);
    sim.world.free();
  });
});

describe('bump stops', () => {
  // Short chairs used to hang on the nose or the tail, with next to no brake or motor left.
  it.each(ALL)('%s pulls away, coasts down and brakes properly at the top tuning stage', (_id, spec) => {
    const s = STAGES[STAGES.length - 1];
    // (a fresh sim each time: the test floor is only so long)
    const run = (throttle: number) => {
      const sim = simAt(spec, s.topSpeedKmh, s.accel);
      let steps = 0;
      while (sim.vehicle.speed < sim.vehicle.topSpeed * 0.9 && steps++ < 60 * 20) sim.step({ throttle: 1, steer: 0, handbrake: false });
      drive(sim, 2, 1);
      const v = sim.vehicle.speed;
      const z0 = sim.vehicle.body.translation().z;
      let n = 0;
      while (sim.vehicle.speed > 0.3 && n++ < 60 * 30) sim.step({ throttle, steer: 0, handbrake: false });
      expect(sim.vehicle.upY).toBeGreaterThan(0.85);
      const decel = (v * v) / 2 / (sim.vehicle.body.translation().z - z0);
      sim.world.free();
      return { toSpeed: steps / 60, decel };
    };
    const coasting = run(0);
    expect(coasting.toSpeed).toBeLessThan(7);
    expect(coasting.decel).toBeGreaterThan(4);
    expect(run(-1).decel).toBeGreaterThan(8.5);
  });
});

describe('boost battery', () => {
  const fitted = (spec: VehicleSpec, kmh: number, accel: number) => {
    const sim = simAt(spec, kmh / spec.speedFactor, accel);
    sim.vehicle.boostFitted = true;
    return sim;
  };
  const boost = (sim: Sim, seconds: number, on = true, throttle = 1, steer = 0) => {
    for (let i = 0; i < seconds * 60; i++) sim.step({ throttle, steer, handbrake: false, boost: on });
  };

  it('does nothing unless one is fitted', () => {
    const sim = simAt(VEHICLES.trex, 30, 6.6);
    drive(sim, 6, 1);
    boost(sim, 2);
    expect(sim.vehicle.boost).toBe(0);
    expect(sim.vehicle.speed * 3.6).toBeLessThan(31);
  });

  it('pushes well past the top speed, fades in without a jolt and runs dry after a moment', () => {
    const sim = fitted(VEHICLES.trex, 30, 6.6);
    drive(sim, 6, 1);
    const top = sim.vehicle.speed;
    // a kick, but not a jolt: after a tenth of a second only a little of it is there
    boost(sim, 0.1);
    expect(sim.vehicle.boosting).toBe(true);
    expect(sim.vehicle.boost).toBeLessThan(0.2);
    let fastest = 0;
    let biggestStep = 0;
    let last = sim.vehicle.boost;
    let lasted = 0.1;
    for (let i = 0; i < 60 * 4; i++) {
      sim.step({ throttle: 1, steer: 0, handbrake: false, boost: true });
      fastest = Math.max(fastest, sim.vehicle.speed);
      biggestStep = Math.max(biggestStep, Math.abs(sim.vehicle.boost - last));
      last = sim.vehicle.boost;
      if (sim.vehicle.boosting) lasted += 1 / 60;
    }
    expect(fastest).toBeGreaterThan(top * 1.25);
    expect(fastest).toBeLessThan(top * (1 + BOOST.speed) + BOOST.extraSpeed + 0.5);
    expect(biggestStep).toBeLessThan(0.08);
    expect(lasted).toBeGreaterThan(BOOST.duration - 0.1);
    expect(lasted).toBeLessThan(BOOST.duration + 0.1);
    // held down on an empty battery: nothing more comes, and it does not recharge either
    expect(sim.vehicle.boostCharge).toBe(0);
    expect(sim.vehicle.boost).toBe(0);
    drive(sim, 3, 1);
    expect(sim.vehicle.speed).toBeLessThan(top * 1.03);
  });

  it('recharges while driving, faster while slowing down, and waits for some charge before firing again', () => {
    const sim = fitted(VEHICLES.trex, 40, 7.4);
    drive(sim, 6, 1);
    boost(sim, 3);
    expect(sim.vehicle.boostCharge).toBe(0);
    drive(sim, 1, 1);
    const cruising = sim.vehicle.boostCharge;
    expect(cruising).toBeCloseTo(1 / BOOST.recharge, 2);
    // not enough yet
    boost(sim, 0.2);
    expect(sim.vehicle.boosting).toBe(false);
    drive(sim, 1, 0);
    expect(sim.vehicle.boostCharge - cruising).toBeGreaterThan((1 / BOOST.recharge) * 2);
    drive(sim, BOOST.recharge, 1);
    expect(sim.vehicle.boostCharge).toBe(1);
    boost(sim, 0.5);
    expect(sim.vehicle.boosting).toBe(true);
  });

  it('gives a push from a standstill without touching the throttle, but not while braking', () => {
    const sim = fitted(VEHICLES.komet, 20, 5);
    drive(sim, 1, 0);
    boost(sim, 1.5, true, 0);
    expect(sim.vehicle.speed * 3.6).toBeGreaterThan(15);
    boost(sim, 0.5, true, -1);
    expect(sim.vehicle.boosting).toBe(false);
  });

  it.each(ALL)('%s takes a full boost at the top tuning stage, straight and in a corner', (_id, spec) => {
    const s = STAGES[STAGES.length - 1];
    for (const steer of [0, 1]) {
      const sim = fitted(spec, s.topSpeedKmh / spec.speedFactor, s.accel);
      // (the factor cancels: every vehicle gets its own real top speed)
      sim.vehicle.setMotor((s.topSpeedKmh * spec.speedFactor) / 3.6, s.accel * spec.accelFactor);
      drive(sim, 10, 1);
      const top = sim.vehicle.speed;
      let minUp = 1;
      let fastest = 0;
      for (let i = 0; i < 60 * 4; i++) {
        sim.step({ throttle: 1, steer, handbrake: false, boost: true });
        minUp = Math.min(minUp, sim.vehicle.upY);
        fastest = Math.max(fastest, sim.vehicle.speed);
      }
      expect(minUp).toBeGreaterThan(0.6);
      if (steer === 0) {
        expect(fastest).toBeGreaterThan(top * 1.15);
        expect(Math.abs(sim.vehicle.body.translation().x)).toBeLessThan(10);
      }
      sim.world.free();
    }
  });

  it('is fitted by the game once bought, and announces every discharge', () => {
    const progress = new Progress();
    const core = new GameCore(PARKPLATZ, progress);
    expect(core.sim.vehicle.boostFitted).toBe(false);
    progress.earn(BOOST.price);
    core.step({ ...idle, buyBoost: true });
    expect(core.events.some((e) => e.type === 'boostBought')).toBe(true);
    expect(progress.hasBoost).toBe(true);
    expect(core.sim.vehicle.boostFitted).toBe(true);
    core.events.length = 0;
    for (let i = 0; i < 30; i++) core.step({ ...idle, throttle: 1, boost: true });
    expect(core.events.filter((e) => e.type === 'boost').length).toBe(1);
    core.step({ ...idle, respawn: true });
    expect(core.sim.vehicle.boostCharge).toBe(1);
    expect(core.sim.vehicle.boost).toBe(0);
    core.dispose();
  });
});

describe('tyre marks', () => {
  it('reports a burnout only with a strong motor, and scrubbing under hard braking', () => {
    const weak = simAt(VEHICLES.trex, 6, 2.5);
    drive(weak, 1, 0);
    let max = 0;
    for (let i = 0; i < 60; i++) {
      weak.step({ throttle: 1, steer: 0, handbrake: false });
      max = Math.max(max, weak.vehicle.burnout);
    }
    expect(max).toBe(0);

    const strong = simAt(VEHICLES.trex, 60, 7);
    drive(strong, 1, 0);
    max = 0;
    for (let i = 0; i < 60; i++) {
      strong.step({ throttle: 1, steer: 0, handbrake: false });
      max = Math.max(max, strong.vehicle.burnout);
    }
    expect(max).toBeGreaterThan(0.8);
    drive(strong, 6, 1);
    expect(strong.vehicle.burnout).toBe(0);
    strong.step({ throttle: -1, steer: 0, handbrake: false });
    strong.step({ throttle: -1, steer: 0, handbrake: false });
    expect(Math.max(...strong.vehicle.skid)).toBeGreaterThan(0.7);
    expect(strong.vehicle.wheelContact(0)).not.toBeNull();
  });
});

describe('tip assist', () => {
  it.each(['trex', 'komet'] as const)('%s falls over without it', (id) => {
    const saved = { ...HANDLING };
    HANDLING.tipAssist = 0;
    // the tippy end of the workshop slider; the default leans far less
    HANDLING.tipHeight = 0.3;
    try {
      const sim = simAt(VEHICLES[id], 40, 5.5);
      drive(sim, 6, 1);
      let minUp = 1;
      for (let i = 0; i < 60 * 4; i++) {
        sim.step({ throttle: 1, steer: 1, handbrake: false });
        minUp = Math.min(minUp, sim.vehicle.upY);
      }
      expect(minUp).toBeLessThan(0.3);
    } finally {
      Object.assign(HANDLING, saved);
    }
  });
});

describe('differential drive', () => {
  it.each(['trex', 'avanti', 'avantifx', 'orkan', 'arrivo', 'eskalation', 'enix'] as const)('%s turns on the spot', (id) => {
    const sim = new Sim(FLAT, VEHICLES[id]);
    drive(sim, 1, 0);
    drive(sim, 2, 0, 1);
    expect(sim.vehicle.yawRate).toBeLessThan(-1.2);
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

// (the crashtest ground has no laps; its own test is with the modes)
describe.each(TRACKS.filter((t) => t.id !== 'crashtest').map((t) => [t.id, t] as const))('track %s', (_id, track) => {
  it('lets the starter roll off the grid and through the finish gate', () => {
    const core = new GameCore(track, new Progress());
    for (let i = 0; i < 60 * 3; i++) core.step(idle);
    expect(core.sim.vehicle.wheelsOnGround).toBe(6);
    for (let i = 0; i < 60 * 15; i++) core.step({ ...idle, throttle: 1 });
    expect(core.race.running).toBe(true);
    expect(core.sim.vehicle.upY).toBeGreaterThan(0.95);
    core.dispose();
  });
});

describe('crash damage', () => {
  const WALL = { pos: [0, 1, 0.3] as [number, number, number], half: [30, 1, 0.3] as [number, number, number], color: 0 };
  /** Straight into a wall at the given speed, from 80 m away. */
  const crash = (spec: VehicleSpec, kmh: number, seconds = 14) => {
    const sim = new Sim({ ...FLAT, spawn: { pos: [0, 0.7, -80], yaw: 0 }, statics: [...FLAT.statics, WALL] }, spec);
    sim.vehicle.setMotor(kmh / 3.6, 9);
    drive(sim, seconds, 1);
    return sim;
  };

  it.each(ALL)('%s shrugs off a nudge, is battered by a real knock and written off by a crash at 50 km/h', (_id, spec) => {
    const nudge = crash(spec, 8);
    expect(nudge.vehicle.damage).toBe(0);
    const knock = crash(spec, 30, 12);
    expect(knock.vehicle.damage).toBeGreaterThan(0.1);
    expect(knock.vehicle.damage).toBeLessThan(DAMAGE.effectsFrom);
    expect(knock.vehicle.wrecked).toBe(false);
    const wreck = crash(spec, 50, 8);
    expect(wreck.vehicle.wrecked).toBe(true);
    // a heap of parts goes nowhere, whatever the stick says
    drive(wreck, 3, -1);
    expect(Math.abs(wreck.vehicle.speed)).toBeLessThan(0.3);
    for (const s of [nudge, knock, wreck]) s.world.free();
  });

  it.each(ALL)('%s does not mind hard driving, props or a jump off a kicker', (_id, spec) => {
    const track: TrackDef = {
      ...FLAT,
      spawn: { pos: [0, 0.7, -80], yaw: 0 },
      statics: [...FLAT.statics, ramp([0, 0], 0, 6, 5, 0.16, 0)],
      props: [{ type: 'cone', pos: [0, 0.26, -40] }, { type: 'carton', pos: [0, 0.26, -20] }, { type: 'cart', pos: [1, 0.46, 40] }],
    };
    const sim = new Sim(track, spec);
    sim.vehicle.setMotor(60 / 3.6, 9);
    drive(sim, 9, 1);
    drive(sim, 2, -1);
    for (let i = 0; i < 60 * 6; i++) sim.step({ throttle: 1, steer: Math.floor(i / 45) % 2 ? 1 : -1, handbrake: false });
    expect(sim.vehicle.damage).toBe(0);
    sim.world.free();
  });

  it('only looks battered up to half, then pulls to the damaged side, loses speed and finally a wheel', () => {
    const run = (damage: number) => {
      const sim = simAt(VEHICLES.komet, 30, 6);
      sim.vehicle.damagedSide = 1;
      sim.vehicle.setDamage(damage);
      drive(sim, 8, 1);
      return sim;
    };
    const fine = run(0), battered = run(0.45), bent = run(0.7), limping = run(0.9);
    // up to half it drives like new
    expect(battered.vehicle.speed).toBeCloseTo(fine.vehicle.speed, 1);
    expect(Math.abs(battered.vehicle.body.translation().x)).toBeLessThan(0.5);
    // beyond that it is slower and wanders off to the left (+X when heading +Z)
    expect(bent.vehicle.speed).toBeLessThan(fine.vehicle.speed * 0.95);
    expect(bent.vehicle.body.translation().x).toBeGreaterThan(2);
    expect(bent.vehicle.lostWheel).toBe(-1);
    // and near the end a front wheel on that side is gone
    const lost = limping.vehicle.lostWheel;
    expect(lost).toBeGreaterThanOrEqual(0);
    expect(VEHICLES.komet.wheels[lost].x).toBeGreaterThan(0);
    expect(VEHICLES.komet.wheels[lost].drive).toBeFalsy();
    expect(limping.vehicle.upY).toBeGreaterThan(0.7);
    for (const s of [fine, battered, bent, limping]) s.world.free();
  });

  it('is repaired by restarting the level, but not by being put upright', () => {
    const core = new GameCore(PARKPLATZ, new Progress());
    core.sim.vehicle.setDamage(0.8);
    core.step({ ...idle, upright: true });
    expect(core.sim.vehicle.damage).toBe(0.8);
    expect(core.sim.vehicle.lostWheel).toBeGreaterThanOrEqual(0);
    core.step({ ...idle, respawn: true });
    expect(core.sim.vehicle.damage).toBe(0);
    expect(core.sim.vehicle.lostWheel).toBe(-1);
    core.dispose();
  });

  it('tells the game about a crash and about the write-off', () => {
    const core = new GameCore(PARKPLATZ, new Progress());
    core.sim.vehicle.setMotor(60 / 3.6, 9);
    // straight at the east wall of the lot
    core.sim.vehicle.place(40, 0.7, 30, Math.PI / 2);
    const seen = new Set<string>();
    for (let i = 0; i < 60 * 6; i++) {
      core.step({ ...idle, throttle: 1 });
      for (const e of core.events) seen.add(e.type);
      core.events.length = 0;
    }
    expect(seen.has('crash')).toBe(true);
    expect(seen.has('wreck')).toBe(true);
    core.dispose();
  });
});

describe('air control', () => {
  // off a ramp at 50 km/h, with the given stick while in the air
  const jump = (spec: VehicleSpec, throttle: number, steer: number) => {
    const track: TrackDef = { ...FLAT, spawn: { pos: [0, 0.7, -60], yaw: 0 }, statics: [...FLAT.statics, ramp([0, 0], 0, 10, 6, 0.3, 0)] };
    const sim = new Sim(track, spec);
    sim.vehicle.setMotor(50 / 3.6, 7);
    let air = 0;
    let turned = 0, across = 0, along = 0, nose = 0, samples = 0;
    for (let i = 0; i < 60 * 14; i++) {
      const v = sim.vehicle;
      const p = v.body.translation();
      const flying = v.wheelsOnGround === 0 && p.z > 5;
      if (!flying && air > 10) break;
      sim.step(flying ? { throttle, steer, handbrake: false } : { throttle: 1, steer: 0, handbrake: false });
      if (!flying) continue;
      air++;
      // (it took off heading +Z at x = 0)
      turned = v.yaw;
      across = v.body.translation().x;
      along = v.body.translation().z;
      // how far the nose points down, averaged over the flight: minus the height component of the forward axis
      const q = v.body.rotation();
      if (air > 20) nose += -2 * (q.y * q.z - q.w * q.x), samples++;
    }
    drive(sim, 1.5, 1);
    const end = { air: air / 60, turned, across, along, nose: nose / Math.max(1, samples), upY: sim.vehicle.upY };
    sim.world.free();
    return end;
  };

  it.each(ALL)('%s can be turned, shifted and tipped a little in the air, and still lands', (_id, spec) => {
    const hands = jump(spec, 0, 0);
    expect(Math.abs(hands.turned)).toBeLessThan(0.05);

    const right = jump(spec, 0, 1);
    // turns right (yaw goes negative) and drifts right (towards -X), but gently
    expect(right.turned).toBeLessThan(-0.4);
    expect(right.turned).toBeGreaterThan(-1.4);
    expect(right.across).toBeLessThan(hands.across - 0.6);
    expect(right.upY).toBeGreaterThan(0.9);

    const forward = jump(spec, 1, 0), back = jump(spec, -1, 0);
    // throttle stretches the jump and puts the nose down, pulling back does the opposite
    expect(forward.along).toBeGreaterThan(back.along + 0.5);
    expect(forward.nose).toBeGreaterThan(back.nose + 0.3);
    expect(forward.upY).toBeGreaterThan(0.9);
    expect(back.upY).toBeGreaterThan(0.9);
  });
});

describe('looping', () => {
  const run = (spec: VehicleSpec) => {
    const track: TrackDef = {
      ...FLAT,
      spawn: { pos: [-130, 0.7, 0], yaw: Math.PI / 2 },
      statics: [...FLAT.statics, ...looping([0, 0], 5, 4.7, 5, 0)],
    };
    const sim = new Sim(track, spec);
    sim.vehicle.setMotor(65 / 3.6, 9);
    let minUp = 1;
    for (let i = 0; i < 60 * 14; i++) {
      sim.step({ throttle: 1, steer: 0, handbrake: false });
      minUp = Math.min(minUp, sim.vehicle.upY);
    }
    const end = { minUp, upY: sim.vehicle.upY, x: sim.vehicle.body.translation().x };
    sim.world.free();
    return end;
  };

  // The wall-glancing logic used to take the road ahead for a wall and steer the chairs off it.
  it.each(ALL)('%s gets over the top at 65 km/h', (_id, spec) => {
    expect(run(spec).minUp).toBeLessThan(-0.8);
  });

  // The ones that steer by handlebar track straight enough to come out cleanly every time.
  it.each(ALL.filter(([, spec]) => spec.wheels.some((w) => w.steer)))('%s comes out the far side on its wheels', (_id, spec) => {
    const end = run(spec);
    expect(end.upY).toBeGreaterThan(0.9);
    expect(end.x).toBeGreaterThan(20);
  });
});

describe('turning disc', () => {
  const disc = (speed: number): TrackDef => ({
    ...FLAT,
    spawn: { pos: [4, 0.9, 0], yaw: 0 },
    spinners: [{ pos: [0, 0.1, 0], radius: 8, speed, color: 0 }],
  });
  // angle of the vehicle's position round the middle of the disc
  const bearing = (sim: Sim) => Math.atan2(sim.vehicle.body.translation().x, sim.vehicle.body.translation().z);

  it.each(ALL)('%s is carried round when it stands on one', (_id, spec) => {
    const sim = new Sim(disc(1), spec);
    drive(sim, 1, 0);
    const from = bearing(sim);
    const facing = sim.vehicle.yaw;
    drive(sim, 2, 0);
    const swept = Math.atan2(Math.sin(bearing(sim) - from), Math.cos(bearing(sim) - from));
    const turned = Math.atan2(Math.sin(sim.vehicle.yaw - facing), Math.cos(sim.vehicle.yaw - facing));
    // two seconds at 1 rad/s: most of two radians, both round the middle and round itself
    expect(swept).toBeGreaterThan(1.4);
    expect(turned).toBeGreaterThan(1.4);
    expect(sim.vehicle.upY).toBeGreaterThan(0.9);
    sim.world.free();
  });

  it('leaves a vehicle beside it alone', () => {
    const sim = new Sim({ ...disc(1), spawn: { pos: [12, 0.7, 0], yaw: 0 } }, VEHICLES.trex);
    drive(sim, 3, 0);
    expect(Math.abs(sim.vehicle.yaw)).toBeLessThan(0.02);
    expect(Math.abs(sim.vehicle.speed)).toBeLessThan(0.05);
    sim.world.free();
  });
});

describe('curve test ground', () => {
  it('lets a slow chair round all four corners of the circuit', () => {
    const progress = new Progress();
    const core = new GameCore(KURVEN, progress);
    core.sim.vehicle.setMotor(10 / 3.6, 3.3);
    const [south, east, north, west] = KURVEN.gates;
    // gate, then a point a little inside the corner that follows it
    const line: [number, number][] = [
      [south.x, south.z], [east.x - 4, south.z + 4],
      [east.x, east.z], [east.x - 2.5, north.z - 2.5],
      [north.x, north.z], [west.x + 1.5, north.z - 1.5],
      [west.x, west.z], [west.x + 1, south.z + 1],
    ];
    let next = 0;
    let minUp = 1;
    for (let i = 0; i < 60 * 150 && core.race.laps === 0; i++) {
      const v = core.sim.vehicle;
      const p = v.body.translation();
      const [tx, tz] = line[next];
      if (Math.hypot(tx - p.x, tz - p.z) < 3) next = (next + 1) % line.length;
      let off = Math.atan2(tx - p.x, tz - p.z) - v.yaw;
      off = Math.atan2(Math.sin(off), Math.cos(off));
      // (positive yaw is to the left, positive steer to the right)
      core.step({ ...idle, throttle: 1, steer: Math.max(-1, Math.min(1, -off * 2)) });
      minUp = Math.min(minUp, v.upY);
    }
    expect(core.race.laps).toBe(1);
    expect(minUp).toBeGreaterThan(0.9);
    // the finish line pays: the lap, a first best time, and nothing got scratched
    const paid = core.events.find((e) => e.type === 'payout');
    expect(paid).toMatchObject({ lap: KURVEN.lapPay, best: Math.round(KURVEN.lapPay * BONUS.best), clean: Math.round(KURVEN.lapPay * BONUS.clean) });
    expect(progress.money).toBe(paid && paid.type === 'payout' ? paid.total : -1);
    core.dispose();
  });
});

// (the Reha-Parcours and the car park are too tight for this; the Reha-Parcours has tests of its own)
describe.each(TRACKS.filter((t) => t.line && t.id !== TRAINING && t.id !== PARKPLATZ.id).map((t) => [t.id, t] as const))('road %s', (_id, track) => {
  it('can be lapped at 30 km/h by following its centre line', () => {
    const core = new GameCore(track, new Progress());
    core.sim.vehicle.setMotor(30 / 3.6, 5);
    const line = track.line!;
    // start with the point nearest to the grid, then always aim a few metres ahead
    const start = core.sim.vehicle.body.translation();
    let at = 0;
    line.forEach(([x, z], i) => {
      if (Math.hypot(x - start.x, z - start.z) < Math.hypot(line[at][0] - start.x, line[at][1] - start.z)) at = i;
    });
    let minUp = 1;
    let off = 0;
    for (let i = 0; i < 60 * 400 && core.race.laps === 0; i++) {
      const v = core.sim.vehicle;
      const p = v.body.translation();
      while (Math.hypot(line[at][0] - p.x, line[at][1] - p.z) < 5) at = (at + 1) % line.length;
      let turn = Math.atan2(line[at][0] - p.x, line[at][1] - p.z) - v.yaw;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      core.step({ ...idle, throttle: 1, steer: Math.max(-1, Math.min(1, -turn * 2)) });
      minUp = Math.min(minUp, v.upY);
      off = Math.max(off, Math.hypot(line[at][0] - p.x, line[at][1] - p.z));
    }
    expect(core.race.laps).toBe(1);
    expect(minUp).toBeGreaterThan(0.9);
    // never far from the line it was aiming at
    expect(off).toBeLessThan(9);
    core.dispose();
  });
});

describe('stunts', () => {
  /** Run a sim with a stunt counter alongside. */
  const watch = (sim: Sim, st: Stunts, seconds: number, input: { throttle: number; steer: number }) => {
    const kinds: string[] = [];
    for (let i = 0; i < seconds * 60; i++) {
      sim.step({ ...input, handbrake: false });
      for (const s of st.update(sim.vehicle, [], 1 / 60)) kinds.push(s.kind);
    }
    return kinds;
  };

  it('pays for a flight that ends on the wheels, and for a looping', () => {
    const st = new Stunts();
    const jump = new Sim({ ...FLAT, spawn: { pos: [0, 0.7, -60], yaw: 0 }, statics: [...FLAT.statics, ramp([0, 0], 0, 10, 6, 0.3, 0)] }, VEHICLES.komet);
    jump.vehicle.setMotor(50 / 3.6, 7);
    expect(watch(jump, st, 10, { throttle: 1, steer: 0 })).toContain('air');
    // a good second in the air
    expect(st.pending).toBeGreaterThan(STUNTS.air.perSecond * 0.8);
    jump.world.free();

    const loop = new Sim({ ...FLAT, spawn: { pos: [-130, 0.7, 0], yaw: Math.PI / 2 }, statics: [...FLAT.statics, ...looping([0, 0], 5, 4.7, 5, 0)] }, VEHICLES.komet);
    loop.vehicle.setMotor(65 / 3.6, 9);
    expect(watch(loop, new Stunts(), 12, { throttle: 1, steer: 0 })).toContain('looping');
    loop.world.free();
  });

  it('pays for a drift, and nothing for plain driving', () => {
    const drifter = simAt(VEHICLES.avanti, 40, 7);
    drifter.vehicle.profile = VEHICLES.avanti.profiles[2];
    drive(drifter, 6, 1);
    const st = new Stunts();
    // in and out of full lock, like a slalom
    const kinds: string[] = [];
    for (let i = 0; i < 60 * 8; i++) {
      drifter.step({ throttle: 1, steer: Math.floor(i / 60) % 2 ? 1 : -1, handbrake: false });
      for (const s of st.update(drifter.vehicle, [], 1 / 60)) kinds.push(s.kind);
    }
    expect(kinds).toContain('drift');
    drifter.world.free();

    const plain = simAt(VEHICLES.komet, 30, 6);
    const none = new Stunts();
    expect(watch(plain, none, 8, { throttle: 1, steer: 0 })).toEqual([]);
    expect(watch(plain, none, 3, { throttle: 1, steer: 0.3 })).toEqual([]);
    expect(none.pending).toBe(0);
    plain.world.free();
  });

  it('multiplies a run of stunts, until a knock or a pause ends it', () => {
    const st = new Stunts();
    const sim = simAt(VEHICLES.komet, 30, 6);
    drive(sim, 2, 1);
    // (stunts fed by hand: flights one after the other)
    const flight = () => {
      const v = sim.vehicle;
      const real = v.wheelsOnGround;
      v.wheelsOnGround = 0;
      for (let i = 0; i < 60; i++) st.update(v, [], 1 / 60);
      v.wheelsOnGround = real;
      return st.update(v, [], 1 / 60)[0];
    };
    expect(flight().multiplier).toBe(1);
    expect(flight().multiplier).toBe(1 + STUNTS.chainStep);
    expect(st.multiplier).toBe(1 + 2 * STUNTS.chainStep);
    st.crash();
    expect(st.multiplier).toBe(1);
    flight();
    for (let i = 0; i < 60 * (STUNTS.chainWindow + 0.5); i++) st.update(sim.vehicle, [], 1 / 60);
    expect(st.multiplier).toBe(1);
    // banking hands over what is there and starts from nothing
    const sum = st.bank();
    expect(sum).toBeGreaterThan(0);
    expect(st.pending).toBe(0);
    sim.world.free();
  });

  it('loses what was not banked when the vehicle is written off', () => {
    const core = new GameCore(PARKPLATZ, new Progress());
    core.stunts.pending = 40;
    core.sim.vehicle.setDamage(1);
    core.step(idle);
    expect(core.stunts.pending).toBe(0);
    expect(core.events.some((e) => e.type === 'wreck')).toBe(true);
    core.dispose();
  });
});

describe('start lights, leaderboard and ghost', () => {
  it('holds the vehicle for three lights and then lets it go', () => {
    const core = new GameCore(PARKPLATZ, new Progress());
    core.restart(true);
    const counts: number[] = [];
    for (let i = 0; i < 60 * 2.9; i++) {
      core.step({ ...idle, throttle: 1 });
      for (const e of core.events) if (e.type === 'count') counts.push(e.n);
      core.events.length = 0;
    }
    expect(counts).toEqual([3, 2, 1]);
    expect(Math.abs(core.sim.vehicle.speed)).toBeLessThan(0.05);
    for (let i = 0; i < 60 * 2; i++) {
      core.step({ ...idle, throttle: 1 });
      for (const e of core.events) if (e.type === 'count') counts.push(e.n);
      core.events.length = 0;
    }
    expect(counts).toEqual([3, 2, 1, 0]);
    expect(core.sim.vehicle.speed).toBeGreaterThan(1);
    // without lights (the menu, the workshop) a restart holds nothing
    core.restart();
    expect(core.countdown).toBe(0);
    core.dispose();
  });

  it('keeps the ten best laps of a track in order, and across sessions', () => {
    const saved = new Map<string, string>();
    const store = { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => void saved.set(k, v) };
    const p = new Progress(store);
    const lap = (time: number) => p.addTime('parkplatz', { time, name: p.name, vehicle: 'trex', stage: 2, date: 0 });
    expect(lap(50)).toBe(1);
    expect(lap(40)).toBe(1);
    expect(lap(45)).toBe(2);
    for (let i = 0; i < 12; i++) lap(60 + i);
    expect(lap(999)).toBe(0);
    expect(p.boards.parkplatz.length).toBe(10);
    const again = new Progress(store);
    expect(again.boards.parkplatz.map((e) => e.time).slice(0, 3)).toEqual([40, 45, 50]);
    expect(again.boards.parkplatz[0].name).toBe('Du');
  });

  it('records the best lap as a ghost and finds it again next time', () => {
    const saved = new Map<string, string>();
    const store = { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => void saved.set(k, v) };
    const progress = new Progress(store);
    const core = new GameCore(KURVEN, progress);
    expect(core.ghost).toBeNull();
    core.sim.vehicle.setMotor(12 / 3.6, 4);
    const line = KURVEN.line!;
    let at = 0;
    for (let i = 0; i < 60 * 200 && core.race.laps === 0; i++) {
      const v = core.sim.vehicle;
      const p = v.body.translation();
      while (Math.hypot(line[at][0] - p.x, line[at][1] - p.z) < 4) at = (at + 1) % line.length;
      let turn = Math.atan2(line[at][0] - p.x, line[at][1] - p.z) - v.yaw;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      core.step({ ...idle, throttle: 1, steer: Math.max(-1, Math.min(1, -turn * 2)) });
    }
    expect(core.race.laps).toBe(1);
    const ghost = core.ghost!;
    expect(ghost.vehicle).toBe('trex');
    expect(ghost.time).toBeCloseTo(core.race.best!, 5);
    // ten samples a second, seven numbers each, for the whole lap
    expect(ghost.samples.length % 7).toBe(0);
    expect(Math.abs(ghost.samples.length / 7 - ghost.time * 10)).toBeLessThan(3);
    // it starts at the finish line and is back near it at the end
    const [gate] = KURVEN.gates;
    expect(Math.hypot(ghost.samples[0] - gate.x, ghost.samples[2] - gate.z)).toBeLessThan(4);
    expect(progress.boards.kurven[0].time).toBeCloseTo(ghost.time, 5);
    expect(core.events.some((e) => e.type === 'ranked' && e.place === 1)).toBe(true);
    core.dispose();
    const next = new GameCore(KURVEN, new Progress(store));
    expect(next.ghost?.samples.length).toBe(ghost.samples.length);
    next.dispose();
  });
});

describe('game on the Parkplatz', () => {
  it('collects screws on the start straight and tunes once the money is there', () => {
    const progress = new Progress();
    progress.stageIndex = 1;
    const core = new GameCore(PARKPLATZ, progress);
    for (let i = 0; i < 60 * 20; i++) core.step({ ...idle, throttle: 1 });
    // drove east along the start straight until the cones: three screws
    expect(core.progress.money).toBe(3);
    core.progress.earn(STAGES[2].price - 3);
    core.step({ ...idle, tune: true });
    expect(core.progress.stageIndex).toBe(2);
    expect(core.topSpeedKmh).toBeCloseTo(STAGES[2].topSpeedKmh);
  });

  it('applies the vehicle factors to the tuning stage', () => {
    const core = new GameCore(PARKPLATZ, new Progress());
    core.setVehicle('ekaptn');
    expect(core.topSpeedKmh).toBeCloseTo(STAGES[0].topSpeedKmh * 1.3);
    expect(core.sim.vehicle.spec.id).toBe('ekaptn');
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
    const progress = new Progress();
    progress.stageIndex = 1;
    const core = new GameCore(PARKPLATZ, progress);
    core.step({ ...idle, tune: true });
    expect(core.progress.stageIndex).toBe(1);
    expect(core.events.some((e) => e.type === 'broke')).toBe(true);
  });

  it('cannot tune before the Reha-Parcours, money or not', () => {
    const core = new GameCore(PARKPLATZ, new Progress());
    core.progress.earn(1000);
    core.step({ ...idle, tune: true });
    expect(core.progress.stageIndex).toBe(0);
    expect(core.events.some((e) => e.type === 'untrained')).toBe(true);
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
    for (let i = 0; i < 300; i++) core.step(idle);
    expect(core.sim.vehicle.upY).toBeGreaterThan(0.95);
  });
});

describe('traffic', () => {
  const LOOP: TrackDef = {
    ...FLAT,
    spawn: { pos: [100, 0.7, 100], yaw: 0 },
    gates: [{ x: 500, z: 500, hx: 1, hz: 1 }],
    traffic: [{ type: 'car', color: 0, speed: 6, path: [[0, 0], [0, 40], [20, 40], [20, 0]] }],
  };

  it('drives round its loop at its own speed and comes back to the start', () => {
    const sim = new Sim(LOOP, VEHICLES.trex);
    const car = sim.traffic.cars[0];
    drive(sim, 5, 0);
    const p = car.tracked.body.translation();
    expect(p.z).toBeCloseTo(30, 0);
    expect(Math.abs(p.x)).toBeLessThan(0.1);
    // 120 m round: 20 s
    drive(sim, 15, 0);
    const q = car.tracked.body.translation();
    expect(Math.hypot(q.x, q.z)).toBeLessThan(1.5);
    expect(sim.vehicle.upY).toBeGreaterThan(0.99);
  });

  it('brakes and honks for a wheelchair in its way, then drives on', () => {
    const progress = new Progress();
    const core = new GameCore(LOOP, progress);
    core.sim.vehicle.place(0, 0.7, 20, Math.PI / 2);
    let honks = 0;
    for (let i = 0; i < 60 * 8; i++) {
      core.step(idle);
      honks += core.events.filter((e) => e.type === 'honk').length;
      core.events.length = 0;
    }
    const car = core.sim.traffic.cars[0];
    expect(honks).toBe(1);
    expect(car.speed).toBe(0);
    expect(car.tracked.body.translation().z).toBeLessThan(17.5);
    // nobody got run over
    const p = core.sim.vehicle.body.translation();
    expect(Math.hypot(p.x, p.z - 20)).toBeLessThan(0.3);
    core.sim.vehicle.place(100, 0.7, 100, 0);
    for (let i = 0; i < 60 * 4; i++) core.step(idle);
    expect(car.speed).toBeCloseTo(6);
    core.step({ ...idle, respawn: true });
    expect(car.tracked.body.translation().z).toBeLessThan(2);
    core.dispose();
  });

  it('shoves a wheelchair aside that comes in from the side', () => {
    const sim = new Sim(LOOP, VEHICLES.trex);
    // it turns up against the car's flank as that goes past: no braking for that
    drive(sim, 3, 0);
    sim.vehicle.place(1.0, 0.7, 18.5, 0);
    drive(sim, 4, 0);
    const p = sim.vehicle.body.translation();
    expect(Math.hypot(p.x - 1.0, p.z - 18.5)).toBeGreaterThan(0.2);
    expect(sim.traffic.cars[0].tracked.body.translation().z).toBeGreaterThan(35);
  });

  it.each(TRACKS.map((t) => [t.id, t] as const))('on %s keeps clear of everything fixed', (_id, track) => {
    const boxes = track.statics.filter((b) => b.pos[1] + b.half[1] > 0.05);
    for (const t of track.traffic ?? []) {
      t.path.forEach(([x, z], i) => {
        const [nx, nz] = t.path[(i + 1) % t.path.length];
        const steps = Math.ceil(Math.hypot(nx - x, nz - z));
        for (let k = 0; k <= steps; k++) {
          const px = x + ((nx - x) * k) / steps, pz = z + ((nz - z) * k) / steps;
          for (const b of boxes) {
            // distance to the box's footprint; 1.3 m is half a van and a bit
            const dx = Math.max(0, Math.abs(px - b.pos[0]) - b.half[0]), dz = Math.max(0, Math.abs(pz - b.pos[2]) - b.half[2]);
            expect(Math.hypot(dx, dz) > 1.3, `traffic at ${px},${pz} hits the box at ${b.pos}`).toBe(true);
          }
        }
      });
    }
  });
});

describe('unlocking', () => {
  it('buys a vehicle with Schrauben when not everything is open', () => {
    const p = new Progress();
    expect(p.isUnlocked('trex', 0)).toBe(true);
    expect(p.isUnlocked('eskalation', 100)).toBe(false);
    p.earn(99);
    expect(p.unlock('eskalation', 100)).toBe(false);
    p.earn(1);
    expect(p.unlock('eskalation', 100)).toBe(true);
    expect(p.money).toBe(0);
    expect(p.isUnlocked('eskalation', 100)).toBe(true);
  });
});

describe('Reha-Parcours', () => {
  const drive = (core: GameCore, ap: Autopilot, seconds: number, until?: () => boolean) => {
    for (let i = 0; i < 60 * seconds && !until?.(); i++) {
      core.step(ap.input(core));
      if (core.events.length > 200) core.events.length = 0;
    }
  };

  it.each(ALL)('%s gets through at stage 0, upright, and comes out with the throttle off', (id, spec) => {
    const progress = new Progress();
    progress.vehicle = spec.id;
    const core = new GameCore(REHA, progress);
    const ap = new Autopilot(REHA.line!);
    let minUp = 1, done = false, t = 0;
    for (; t < 60 * 180 && !done; t++) {
      core.step(ap.input(core));
      minUp = Math.min(minUp, core.sim.vehicle.upY);
      done = core.events.some((e) => e.type === 'graduated');
      core.events.length = 0;
    }
    expect(done).toBe(true);
    // never on its side, never wrecked
    expect(minUp).toBeGreaterThan(0.15);
    expect(core.sim.vehicle.damage).toBe(0);
    // a perfect line takes about half a minute; by hand it is more
    expect(t / 60).toBeGreaterThan(15);
    expect(t / 60).toBeLessThan(60);
    expect(progress.stageIndex).toBe(1);
    expect(progress.stages[id]).toBe(1);
    expect(core.topSpeedKmh).toBeCloseTo(stageSpeedKmh(STAGES[1], spec.speedFactor * core.sim.vehicle.profile.speed));
    // learning to drive pays nothing: no screws lying about, no lap money…
    expect(progress.money).toBe(0);
    // …and once through it stops and stays stopped until the menu, collecting nothing
    expect(core.halted).toBe(true);
    for (let i = 0; i < 60 * 3; i++) core.step(ap.input(core));
    expect(progress.money).toBe(0);
    expect(Math.abs(core.sim.vehicle.speed)).toBeLessThan(0.3);
    core.dispose();
  });

  it('puts the screws out from the second run on', () => {
    const progress = new Progress();
    progress.stageIndex = 1;
    const core = new GameCore(REHA, progress);
    const ap = new Autopilot(REHA.line!);
    drive(core, ap, 40);
    expect(progress.money).toBeGreaterThan(0);
    core.dispose();
  });

  it('starts every vehicle and profile at 6 km/h or more, and a stage never below what it says', () => {
    for (const [, spec] of ALL) {
      for (const p of spec.profiles) {
        for (const s of STAGES) {
          const kmh = stageSpeedKmh(s, spec.speedFactor * p.speed);
          expect(kmh).toBeGreaterThanOrEqual(s.topSpeedKmh);
          if (spec.speedFactor * p.speed > 1) expect(kmh).toBeGreaterThan(s.topSpeedKmh);
        }
      }
    }
  });

  it('tips the seesaw over under the vehicle and back again once it has left', () => {
    const core = new GameCore(REHA, new Progress());
    const saw = core.sim.movers[0];
    expect(saw.angle).toBeCloseTo(-saw.def.angle);
    const ap = new Autopilot(REHA.line!);
    // drive until the vehicle is off the far end, watching the plank go over under it
    let most = -1;
    drive(core, ap, 60, () => {
      most = Math.max(most, saw.angle);
      return core.sim.vehicle.body.translation().z > saw.def.pos[2] + saw.def.half[2] + 0.5 && core.sim.vehicle.body.translation().x > 10;
    });
    expect(most).toBeCloseTo(saw.def.angle);
    drive(core, ap, 6);
    expect(saw.angle).toBeCloseTo(-saw.def.angle);
    core.dispose();
  });

  it('keeps the rocking bridge rolling by itself', () => {
    const core = new GameCore(REHA, new Progress());
    const rocker = core.sim.movers.find((m) => m.def.type === 'rocker')!;
    let lo = 0, hi = 0;
    for (let i = 0; i < 60 * 4; i++) {
      core.step(idle);
      lo = Math.min(lo, rocker.angle);
      hi = Math.max(hi, rocker.angle);
      // the body follows what it is told
      const r = rocker.tracked.body.rotation();
      expect(Math.abs(2 * Math.atan2(r.z, r.w) - rocker.angle)).toBeLessThan(0.01);
    }
    expect(hi).toBeCloseTo(rocker.def.angle, 2);
    expect(lo).toBeCloseTo(-rocker.def.angle, 2);
    core.dispose();
  });

  it('keeps the tuning stage per vehicle, and an old save gives its stage to the vehicle it drove', () => {
    const data: Record<string, string> = {};
    const store = { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) };
    data['tempo6.save.v3'] = JSON.stringify({ money: 5, stageIndex: 2, vehicle: 'komet', unlocked: ['komet'] });
    const p = new Progress(store);
    expect(p.stageIndex).toBe(2);
    // (a vehicle past the Reha-Parcours means the tutorial is done, so every vehicle has stage 1)
    expect(p.tutorialDone).toBe(true);
    expect(p.trained('trex')).toBe(true);
    p.vehicle = 'trex';
    expect(p.stageIndex).toBe(1);
    p.save();
    const again = new Progress(store);
    expect(again.stages).toEqual({ komet: 2 });
    expect(again.stageOf('trex')).toBe(1);
  });

  it('exports the save with its shadows to a file and reads it back into an empty browser', () => {
    const mem = () => {
      const data = new Map<string, string>();
      return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    };
    const here = mem();
    const p = new Progress(here);
    p.earn(77);
    p.stageIndex = 2;
    p.tutorialDone = true;
    p.saveGhost('reha', { time: 31, vehicle: 'trex', samples: [1, 2, 3, 4, 5, 6, 7] });
    const file = p.exportSave(TRACKS.map((t) => t.id));
    const there = mem();
    expect(Progress.importSave(there, 'kein Spielstand')).toBe(false);
    expect(Progress.importSave(there, JSON.stringify({ game: 'anderes' }))).toBe(false);
    expect(Progress.importSave(there, file)).toBe(true);
    const back = new Progress(there);
    expect(back.money).toBe(77);
    expect(back.stageIndex).toBe(2);
    expect(back.tutorialDone).toBe(true);
    expect(back.loadGhost('reha')?.time).toBe(31);
  });

  it('ends the tutorial with the first vehicle through: all throttles off, modes and free tracks open', () => {
    const progress = new Progress();
    expect(trackOpen(progress, TRAINING)).toBe(true);
    expect(trackOpen(progress, PARKPLATZ.id)).toBe(false);
    progress.graduate();
    expect(progress.tutorialDone).toBe(true);
    for (const [id] of ALL) expect(progress.stageOf(id)).toBeGreaterThanOrEqual(1);
    expect(progress.stageOf('komet')).toBe(1);
    expect(trackOpen(progress, PARKPLATZ.id)).toBe(true);
    // free after the tutorial: the car park and the crashtest ground; the rest is bought
    expect(TRACKS.filter((t) => t.unlockPrice === 0).map((t) => t.id).sort()).toEqual(['crashtest', 'parkplatz', TRAINING].sort());
    expect(trackOpen(progress, 'stadion')).toBe(false);
  });
});

describe('modes', () => {
  const trained = (stage = 1) => {
    const p = new Progress();
    p.tutorialDone = true;
    p.stageIndex = stage;
    return p;
  };

  it('has every track of every mode, and each mode at least one that is free after the tutorial', () => {
    for (const m of MODES) {
      for (const id of m.tracks) expect(TRACKS.some((t) => t.id === id)).toBe(true);
      expect(m.tracks.some((id) => trackOpen(trained(), id))).toBe(true);
    }
    // the others need a line to follow
    for (const id of MODES.find((m) => m.id === 'race')!.tracks) expect(trackById(id).line).toBeTruthy();
  });

  it('races three others round the car park; they drive off and whoever is first over the line after three laps wins', () => {
    const core = new GameCore(PARKPLATZ, trained(4), 'race');
    expect(core.rivals.length).toBe(3);
    core.restart(true);
    const ap = new Autopilot(PARKPLATZ.line!, 2.5).from(PARKPLATZ.spawn.pos[0], PARKPLATZ.spawn.pos[2]);
    let over: GameEvent | undefined;
    for (let i = 0; i < 60 * 120 && !over; i++) {
      core.step(ap.input(core));
      over = core.events.find((e) => e.type === 'raceOver');
      core.events.length = 0;
    }
    expect(over).toMatchObject({ type: 'raceOver', of: 4 });
    expect(core.finished).toBeGreaterThanOrEqual(1);
    expect(core.progress.records['race:parkplatz']).toBe(core.finished);
    // the others got going too
    for (const r of core.rivals) expect(r.race.laps).toBeGreaterThanOrEqual(RACE.laps - 1);
    core.dispose();
  });

  it('draws the grid afresh for every start, so the player is not always in front', () => {
    const core = new GameCore(PARKPLATZ, trained(4), 'race');
    const rows = new Set<string>();
    for (let i = 0; i < 12; i++) {
      core.restart(true);
      const p = core.sim.vehicle.body.translation();
      rows.add(`${p.x.toFixed(1)},${p.z.toFixed(1)}`);
      // nobody shares a slot
      for (const r of core.rivals) expect(Math.hypot(r.grid.x - p.x, r.grid.z - p.z)).toBeGreaterThan(1);
    }
    expect(rows.size).toBeGreaterThan(1);
    // and the others are tuned to the player's stage, at 90 to 100 % of their vehicle there
    for (const [k, r] of core.rivals.entries()) {
      expect(r.vehicle.topSpeed * 3.6).toBeCloseTo(stageSpeedKmh(STAGES[4], r.vehicle.spec.speedFactor) * RACE.skill[k]);
    }
    core.dispose();
  });

  it('sends everyone into the crashtest flat out with the boost battery, whatever they have bought', () => {
    const core = new GameCore(trackById('crashtest'), trained(1), 'crash');
    expect(core.topSpeedKmh).toBeCloseTo(stageSpeedKmh(STAGES[STAGES.length - 1], 1));
    expect(core.sim.vehicle.boostFitted).toBe(true);
    // and the propeller over the table keeps turning
    const prop = core.sim.movers.find((m) => m.def.type === 'propeller')!;
    for (let i = 0; i < 60; i++) core.step(idle);
    expect(prop.angle).toBeCloseTo(prop.def.spin!, 1);
    core.dispose();
  });

  it('pays a freestyle run of stunts when it ends, and never times a lap', () => {
    // (about the speed the stunt tests jump at)
    const progress = trained();
    progress.vehicle = 'komet';
    progress.stageIndex = 6;
    const jump: TrackDef = { ...FLAT, gates: [{ x: 0, z: 0, hx: 3, hz: 1 }], spawn: { pos: [0, 0.7, -60], yaw: 0 }, statics: [...FLAT.statics, ramp([0, 0], 0, 10, 6, 0.3, 0)] };
    const core = new GameCore(jump, progress, 'freestyle');
    // over the ramp (and through what would be a finish gate), then let the run end
    for (let i = 0; i < 60 * 10; i++) core.step({ ...idle, throttle: 1 });
    for (let i = 0; i < 60 * 10; i++) core.step({ ...idle });
    expect(core.events.some((e) => e.type === 'lap' || e.type === 'lapStart')).toBe(false);
    expect(core.events.some((e) => e.type === 'stunt' && e.kind === 'air')).toBe(true);
    const chain = core.events.find((e) => e.type === 'chain');
    expect(chain).toMatchObject({ type: 'chain', record: true });
    expect(core.progress.money).toBeGreaterThan(0);
    core.dispose();
  });

  it('scores a crashtest from the first knock until it lies still, with nobody at the controls after it', () => {
    const core = new GameCore(trackById('crashtest'), trained(3), 'crash');
    let over: GameEvent | undefined;
    let stoppedSteering = true;
    for (let i = 0; i < 60 * 40 && !over; i++) {
      const before = core.crash.started;
      core.step({ ...idle, throttle: 1, steer: 1 });
      // once it has started, the steering no longer turns it on purpose
      if (before && Math.abs(core.sim.vehicle.speed) > 1 && core.sim.vehicle.boosting) stoppedSteering = false;
      over = core.events.find((e) => e.type === 'crashOver');
      core.events.length = 0;
    }
    expect(stoppedSteering).toBe(true);
    expect(over).toBeTruthy();
    if (over?.type !== 'crashOver') return;
    expect(over.score).toBeGreaterThan(50);
    expect(over.pay).toBe(Math.round(over.score / CRASH.perScrew));
    expect(core.progress.records['crash:crashtest']).toBe(over.score);
    // and Backspace sets up the next go
    core.step({ ...idle, respawn: true });
    expect(core.crash.started).toBe(false);
    expect(core.crash.score).toBe(0);
    core.dispose();
  });
});
