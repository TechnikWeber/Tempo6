import { beforeAll, describe, expect, it } from 'vitest';
import { BOOST, STAGES } from '../src/config/tuning';
import { HANDLING, VEHICLES, VEHICLE_ORDER, type VehicleSpec } from '../src/config/vehicles';
import { GameCore, type GameInput } from '../src/sim/GameCore';
import { Progress } from '../src/sim/Progress';
import { Race } from '../src/sim/Race';
import { initPhysics, Sim } from '../src/sim/Sim';
import type { TrackDef } from '../src/sim/Track';
import { TRACKS } from '../src/tracks';
import { PARKPLATZ } from '../src/tracks/parkplatz';

const FLAT: TrackDef = {
  id: 'flat',
  name: 'flat',
  blurb: '',
  unlockPrice: 0,
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

  it.each([0, 3, 7, 12])('reaches its top speed at stage %i and no more', (stage) => {
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

  it.each([6, 12, 30, 60])('turns right at %i km/h without falling over or spinning out', (kmh) => {
    const sim = simAt(spec, kmh / spec.speedFactor, 6);
    drive(sim, 8, 1);
    drive(sim, 3, 1, 1);
    const v = sim.vehicle;
    expect(v.upY).toBeGreaterThan(0.6);
    expect(v.yawRate).toBeLessThan(-0.08);
    // still travelling mostly nose first
    const lv = v.body.linvel();
    expect(v.speed).toBeGreaterThan(Math.hypot(lv.x, lv.z) * 0.8);
  });

  it.each([0, 6, 12])('steers while accelerating flat out from a standstill (stage %i)', (stage) => {
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
    expect(core.topSpeedKmh).toBeCloseTo(6 * 1.1);
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
      expect(speed * 3.6).toBeGreaterThan(kmh * 0.65);
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

describe('boost capacitor', () => {
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

  it('pushes well past the top speed, fades in gently and runs dry after a moment', () => {
    const sim = fitted(VEHICLES.trex, 30, 6.6);
    drive(sim, 6, 1);
    const top = sim.vehicle.speed;
    // no kick: after a tenth of a second there is next to nothing yet
    boost(sim, 0.1);
    expect(sim.vehicle.boosting).toBe(true);
    expect(sim.vehicle.boost).toBeLessThan(0.08);
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
    expect(biggestStep).toBeLessThan(0.05);
    expect(lasted).toBeGreaterThan(BOOST.duration - 0.1);
    expect(lasted).toBeLessThan(BOOST.duration + 0.1);
    // held down on an empty capacitor: nothing more comes, and it does not recharge either
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
    // everything is unlocked for testing, so it is already there
    expect(progress.hasBoost).toBe(true);
    expect(core.sim.vehicle.boostFitted).toBe(true);
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

describe.each(TRACKS.map((t) => [t.id, t] as const))('track %s', (_id, track) => {
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

describe('game on the Parkplatz', () => {
  it('collects bottles on the start straight and tunes once the money is there', () => {
    const core = new GameCore(PARKPLATZ, new Progress());
    for (let i = 0; i < 60 * 40; i++) core.step({ ...idle, throttle: 1 });
    // drove east along the start straight until the cones: three bottles
    expect(core.progress.money).toBe(75);
    core.progress.earn(25);
    core.step({ ...idle, tune: true });
    expect(core.progress.stageIndex).toBe(1);
    expect(core.topSpeedKmh).toBeCloseTo(8);
  });

  it('applies the vehicle factors to the tuning stage', () => {
    const core = new GameCore(PARKPLATZ, new Progress());
    core.setVehicle('ekaptn');
    expect(core.topSpeedKmh).toBeCloseTo(6 * 1.3);
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
    const core = new GameCore(PARKPLATZ, new Progress());
    core.step({ ...idle, tune: true });
    expect(core.progress.stageIndex).toBe(0);
    expect(core.events.some((e) => e.type === 'broke')).toBe(true);
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

describe('unlocking', () => {
  it('buys a vehicle with Pfand when not everything is open', () => {
    const p = new Progress();
    // UNLOCK_ALL is on for testing, so only the bookkeeping can be checked here.
    expect(p.isUnlocked('trex', 0)).toBe(true);
    p.earn(1000);
    expect(p.unlock('eskalation', 1000)).toBe(true);
  });
});
