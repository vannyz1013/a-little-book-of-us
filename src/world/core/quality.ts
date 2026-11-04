export type TierName = 'high' | 'medium' | 'low';

export interface Tier {
  name: TierName;
  pixelRatio: number;
  /** Shadow map size; 0 turns real-time shadows off. */
  shadows: number;
  /** Scales every plant, particle and butterfly count. */
  density: number;
  skyClouds: boolean;
  physicalMaterials: boolean;
  terrainSegments: number;
}

const TIERS: Record<TierName, Tier> = {
  high: { name: 'high', pixelRatio: 2, shadows: 2048, density: 1, skyClouds: true, physicalMaterials: true, terrainSegments: 150 },
  medium: { name: 'medium', pixelRatio: 1.5, shadows: 1024, density: 0.55, skyClouds: true, physicalMaterials: true, terrainSegments: 110 },
  low: { name: 'low', pixelRatio: 1, shadows: 0, density: 0.25, skyClouds: false, physicalMaterials: false, terrainSegments: 70 },
};

export function rendererName(gl: WebGL2RenderingContext): string {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
}

export function detectTier(gl: WebGL2RenderingContext): Tier {
  const forced = new URLSearchParams(location.search).get('tier') as TierName | null;
  if (forced && forced in TIERS) return { ...TIERS[forced] };

  const renderer = rendererName(gl).toLowerCase();
  if (/swiftshader|llvmpipe|software|microsoft basic/.test(renderer)) return { ...TIERS.low };

  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 4;
  const phone = window.matchMedia('(pointer: coarse)').matches;
  if (memory <= 3 || cores <= 3) return { ...TIERS.low };
  if (phone) return { ...TIERS.medium, density: 0.36, shadows: 1024 };
  if (memory <= 4 || cores <= 4 || /intel|mali-[gt]\d{1,2}\b|adreno \(tm\) [1-5]/.test(renderer)) {
    return { ...TIERS.medium };
  }
  return { ...TIERS.high };
}

/**
 * Watches real frame times and steps quality down if a device struggles. It never
 * steps back up: a resolution that keeps changing is worse than a slightly softer one.
 */
export class FrameGovernor {
  private frames = 0;
  private total = 0;
  private settle = 40;
  steps = 0;
  average = 0;

  constructor(private readonly onStepDown: (step: number) => boolean) {}

  sample(dt: number): void {
    if (this.settle > 0) {
      this.settle--;
      return;
    }
    this.frames++;
    this.total += dt;
    if (this.frames < 45) return;
    this.average = this.total / this.frames;
    this.frames = 0;
    this.total = 0;
    if (this.average > 1 / 28 && this.onStepDown(this.steps)) {
      this.steps++;
      this.settle = 30;
    }
  }
}
