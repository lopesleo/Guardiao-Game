// Helpers numéricos sem dependência de Phaser.

export const distSq = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};

export const dist = (ax, ay, bx, by) => Math.sqrt(distSq(ax, ay, bx, by));

export const angle = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

export const lerp = (a, b, t) => a + (b - a) * t;

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const randRange = (min, max) => min + Math.random() * (max - min);

export const randInt = (min, max) => Math.floor(randRange(min, max + 1));

export const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export const shuffle = arr => {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const formatTime = ms => {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};
