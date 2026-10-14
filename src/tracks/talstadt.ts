import type { TrackDef } from '../sim/Track';
import { site } from './site';

// Rough layout only: a lap round a large works building with a saw-tooth north side and an
// office wing on the west corner. The footprint was read off an aerial picture.
const SITE = site({
  outline: [
    [105, 300], [290, 115], [345, 150], [400, 95], [455, 120], [500, 125], [625, 240],
    [545, 345], [500, 335], [445, 445], [360, 395], [275, 470], [190, 495], [55, 365],
  ],
  picture: [670, 595],
  scale: 0.25,
  margin: 9,
  roadWidth: 7,
  wallColor: 0xb9bcc2,
  roofColor: 0x5a6068,
  height: 7,
});

export const TALSTADT: TrackDef = {
  id: 'talstadt',
  name: 'Werk Talstadt',
  blurb: `Einmal ums Werk: ${Math.round(SITE.length / 10) * 10} m um die große Halle. Rohbau.`,
  unlockPrice: 100,
  lapPay: 35,
  spawn: SITE.spawn,
  statics: SITE.statics,
  props: [],
  gates: SITE.gates,
  pickups: [],
  decor: SITE.decor,
  line: SITE.line,
};
