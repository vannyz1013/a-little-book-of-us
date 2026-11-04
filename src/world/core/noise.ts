/** Small deterministic random and value noise, so the world is the same every visit. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (x: number, y: number): number => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const smooth = (t: number): number => t * t * (3 - 2 * t);

export function noise2(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export function fbm(x: number, y: number, octaves = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise2(x, y) * amplitude;
    total += amplitude;
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 9.2;
    amplitude *= 0.5;
  }
  return value / total;
}

export const clamp = (v: number, low = 0, high = 1): number => Math.min(high, Math.max(low, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number): number => smooth(clamp((v - a) / (b - a)));
