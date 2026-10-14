import type { TrackDef } from '../sim/Track';
import { site } from './site';

// Rough layout only: a lap round an older works, several halls grown together at an angle.
// The footprint was read off an aerial picture.
const SITE = site({
  outline: [
    [75, 345], [215, 105], [245, 95], [340, 115], [385, 60], [625, 225],
    [580, 295], [685, 385], [625, 475], [525, 410], [410, 565], [255, 470],
  ],
  picture: [743, 624],
  scale: 0.25,
  margin: 9,
  roadWidth: 7,
  wallColor: 0xc9c5ba,
  roofColor: 0x4a4d52,
  height: 6,
});

export const WESERTOR: TrackDef = {
  id: 'wesertor',
  name: 'Altwerk Wesertor',
  blurb: `Einmal ums alte Werk: ${Math.round(SITE.length / 10) * 10} m um verwinkelte Hallen. Rohbau.`,
  unlockPrice: 150,
  lapPay: 40,
  spawn: SITE.spawn,
  statics: SITE.statics,
  props: [],
  gates: SITE.gates,
  pickups: [],
  decor: SITE.decor,
  line: SITE.line,
};
