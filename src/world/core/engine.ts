import * as THREE from 'three';
import { FrameGovernor, detectTier, type Tier } from './quality';
import { Tweens } from './tween';

export type Updater = (dt: number, time: number) => void;

/** Owns the renderer and the one render loop. Everything else subscribes to it. */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 520);
  readonly tweens = new Tweens();
  readonly tier: Tier;
  readonly reducedMotion: boolean;
  width = 1;
  height = 1;

  private updaters = new Set<Updater>();
  private resizers = new Set<() => void>();
  private lastFrame = 0;
  private time = 0;
  private dirty = true;
  private frameRequest = 0;
  private running = false;
  private governor: FrameGovernor;
  /** While a reading panel covers the world there is no need for full frame rate. */
  dimmed = false;
  private skip = false;
  drawCalls = 0;
  triangles = 0;

  constructor(host: HTMLElement) {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.tweens.instant = this.reducedMotion;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
    this.tier = detectTier(this.renderer.getContext() as WebGL2RenderingContext);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = this.tier.shadows > 0;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = 'world-canvas';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.append(this.renderer.domElement);

    this.governor = new FrameGovernor((step) => this.stepDown(step));

    new ResizeObserver(() => this.resize(host)).observe(host);
    this.resize(host);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop();
      else this.start();
    });
  }

  get aspect(): number {
    return this.width / this.height;
  }

  private stepDown(step: number): boolean {
    if (step === 0 || step === 1) {
      this.tier.pixelRatio = Math.max(this.tier.pixelRatio * 0.78, 0.75);
      this.applySize();
      return true;
    }
    if (step === 2 && this.renderer.shadowMap.enabled) {
      // Keep the last shadow map instead of re-rendering it every frame.
      this.renderer.shadowMap.autoUpdate = false;
      return true;
    }
    return false;
  }

  private applySize(): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.tier.pixelRatio));
    this.renderer.setSize(this.width, this.height, false);
  }

  private resize(host: HTMLElement): void {
    this.width = Math.max(host.clientWidth, 1);
    this.height = Math.max(host.clientHeight, 1);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.applySize();
    this.resizers.forEach((listener) => listener());
    this.invalidate();
  }

  onResize(listener: () => void): void {
    this.resizers.add(listener);
  }

  add(updater: Updater): void {
    this.updaters.add(updater);
  }

  invalidate(): void {
    this.dirty = true;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    this.frameRequest = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameRequest);
  }

  private tick = (): void => {
    if (!this.running) return;
    this.frameRequest = requestAnimationFrame(this.tick);

    // Halve the frame rate behind reading panels, to save battery while reading.
    if (this.dimmed && !this.tweens.running) {
      this.skip = !this.skip;
      if (this.skip) return;
    }

    const now = performance.now();
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;
    const animating = this.tweens.running;

    // With reduced motion nothing moves on its own, so only draw when something changed.
    if (this.reducedMotion && !this.dirty && !animating) return;

    this.tweens.update(dt);
    if (!this.reducedMotion) this.time += dt;
    this.updaters.forEach((update) => update(this.reducedMotion ? 0 : dt, this.time));
    this.renderer.render(this.scene, this.camera);
    this.dirty = false;
    this.drawCalls = this.renderer.info.render.calls;
    this.triangles = this.renderer.info.render.triangles;
    if (!this.dimmed && !this.reducedMotion) this.governor.sample(dt);
  };

  averageFrame(): number {
    return this.governor.average;
  }

  qualitySteps(): number {
    return this.governor.steps;
  }

  /** Release GPU memory, used if the world has to give way to the flat book. */
  dispose(): void {
    this.stop();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) value.dispose();
        }
        material.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
