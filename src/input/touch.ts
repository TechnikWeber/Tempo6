import type { Input } from './Input';

/** On-screen controls for phones: a steering strip on the left, pedals on the right. */
export function installTouchControls(input: Input): void {
  if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) return;
  const root = document.getElementById('touch')!;
  root.hidden = false;

  const strip = document.getElementById('touch-steer')!;
  const knob = strip.firstElementChild as HTMLElement;
  const steer = (e: PointerEvent) => {
    const r = strip.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    input.touch.steer = x;
    knob.style.transform = `translateX(${x * (r.width / 2 - 30)}px)`;
  };
  const release = () => {
    input.touch.steer = 0;
    knob.style.transform = '';
  };
  strip.addEventListener('pointerdown', (e) => {
    strip.setPointerCapture(e.pointerId);
    steer(e);
  });
  strip.addEventListener('pointermove', (e) => {
    if (strip.hasPointerCapture(e.pointerId)) steer(e);
  });
  strip.addEventListener('pointerup', release);
  strip.addEventListener('pointercancel', release);

  const hold = (id: string, on: () => void, off: () => void) => {
    const el = document.getElementById(id)!;
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      on();
    });
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
  };
  hold('touch-gas', () => (input.touch.throttle = 1), () => (input.touch.throttle = 0));
  hold('touch-back', () => (input.touch.throttle = -1), () => (input.touch.throttle = 0));
  hold('touch-brake', () => (input.touch.handbrake = true), () => (input.touch.handbrake = false));
  hold('touch-boost', () => (input.touch.boost = true), () => (input.touch.boost = false));
  document.getElementById('touch-up')!.addEventListener('click', () => input.trigger('upright'));
  document.getElementById('touch-reset')!.addEventListener('click', () => input.trigger('respawn'));
  document.getElementById('touch-menu')!.addEventListener('click', () => input.trigger('menu'));
  // the notices on the screen are buttons too
  document.getElementById('flipped')!.addEventListener('click', () => input.trigger('upright'));
  document.getElementById('wrecked')!.addEventListener('click', () => input.trigger('respawn'));
  document.body.classList.add('touch');
  // (no long-press menus or text picking on the controls)
  root.addEventListener('contextmenu', (e) => e.preventDefault());
}
