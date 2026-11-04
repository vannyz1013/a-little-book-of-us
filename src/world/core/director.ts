import * as THREE from 'three';
import type { PageId } from '../../router';
import { CENTRES, poseFor, type Pose } from '../layout';
import { clamp, lerp } from './noise';
import type { Engine } from './engine';
import { easeInOut, easeOut } from './tween';

/**
 * Flies the one camera along one spline that threads the three places, so that
 * moving between sections is a real journey and never a page swap.
 */
export class Director {
  private readonly spine: THREE.CatmullRomCurve3;
  private readonly stops: Record<PageId, number>;
  private readonly pointer = new THREE.Vector2();
  private readonly sway = new THREE.Vector2();
  private readonly position = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly scratch = new THREE.Vector3();
  private readonly shot = { position: new THREE.Vector3(), target: new THREE.Vector3(), weight: 0 };
  private flightId = 0;

  current: PageId = 'home';
  flying = false;
  /** 0 at Home to 1 at the Birthday: everything atmospheric keys off this. */
  progress = 0;

  constructor(private readonly engine: Engine) {
    const centre = (id: PageId) => CENTRES[id];
    const points = [
      centre('home').clone().add(new THREE.Vector3(0, 3.6, 12)),
      new THREE.Vector3(-3, 5, -18),
      new THREE.Vector3(-16, 5.5, -42),
      centre('memories').clone().add(new THREE.Vector3(0, 5.2, 16)),
      // From the memory garden the path rises over the grove and comes down to the pavilion.
      new THREE.Vector3(-34, 9, -92),
      new THREE.Vector3(-20, 17, -122),
      new THREE.Vector3(6, 18, -154),
      new THREE.Vector3(30, 16, -176),
      centre('letter').clone().add(new THREE.Vector3(0, 4.3, 14)),
    ];
    this.spine = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const last = points.length - 1;
    this.stops = { home: 0, memories: 3 / last, letter: 1 };

    engine.onResize(() => {
      if (!this.flying) this.settle();
    });
    engine.add((dt) => this.update(dt));
    this.settle();
  }

  /** Where along the journey (0 to 1) each place sits. */
  stopOf(id: PageId): number {
    return this.stops[id];
  }

  private pose(id: PageId): Pose {
    return poseFor(id, this.engine.camera);
  }

  /** The point the camera is looking at. */
  focus(): THREE.Vector3 {
    return this.target;
  }

  setPointer(x: number, y: number): void {
    this.pointer.set(x, y);
    this.engine.invalidate();
  }

  private settle(): void {
    const pose = this.pose(this.current);
    this.position.copy(pose.position);
    this.target.copy(pose.target);
    this.progress = this.stops[this.current] ?? 0;
    this.engine.invalidate();
  }

  /** Resolves once the camera is no longer flying. */
  async arrived(): Promise<void> {
    while (this.flying) await this.engine.tweens.wait(0.1);
  }

  /** Glide to the current place's resting pose, after that pose has changed. */
  async reframe(seconds = 1.4): Promise<void> {
    if (this.flying) return;
    const from: Pose = { position: this.position.clone(), target: this.target.clone() };
    const to = this.pose(this.current);
    const flight = ++this.flightId;
    await this.engine.tweens.to(this.engine.reducedMotion ? 0.01 : seconds, (t) => {
      if (flight !== this.flightId) return;
      this.position.lerpVectors(from.position, to.position, t);
      this.target.lerpVectors(from.target, to.target, t);
    }, easeInOut);
  }

  /** Jump straight to a place, as on a first visit to a direct link. */
  jump(id: PageId): void {
    this.current = id;
    this.settle();
  }

  private place(from: Pose, to: Pose, start: number, end: number, t: number): void {
    const u = lerp(start, end, t);
    this.progress = u;
    this.spine.getPoint(clamp(u), this.scratch);

    // Blend from each resting pose onto the spine and back off it again.
    const blend = Math.sin(Math.PI * clamp(t));
    this.position.lerpVectors(from.position, to.position, t);
    this.position.lerp(this.scratch, Math.min(blend * 1.4, 1));

    // Look along the journey in the middle, and at the destination at the end.
    this.spine.getPoint(clamp(u + Math.sign(end - start) * 0.05), this.look);
    this.target.lerpVectors(from.target, to.target, t);
    this.target.lerp(this.look, Math.min(blend * 1.2, 0.85));
  }

  async flyTo(id: PageId, seconds?: number): Promise<void> {
    const flight = ++this.flightId;
    const from: Pose = { position: this.position.clone(), target: this.target.clone() };
    const start = this.progress;
    const end = this.stops[id];
    const to = this.pose(id);
    this.current = id;
    this.flying = true;
    this.releaseShot();
    const duration = seconds ?? 2.6 + Math.abs(end - start) * 3.4;
    await this.engine.tweens.to(duration, (t) => {
      if (flight === this.flightId) this.place(from, to, start, end, t);
    }, easeInOut);
    if (flight === this.flightId) {
      this.flying = false;
      this.settle();
    }
  }

  /** Lean the camera in toward something, for example a chosen frame. */
  async closeUp(position: THREE.Vector3, target: THREE.Vector3, seconds = 1.1): Promise<void> {
    this.shot.position.copy(position);
    this.shot.target.copy(target);
    const start = this.shot.weight;
    await this.engine.tweens.to(seconds, (t) => {
      this.shot.weight = lerp(start, 1, t);
    }, easeInOut);
  }

  async backOut(seconds = 1): Promise<void> {
    const start = this.shot.weight;
    await this.engine.tweens.to(seconds, (t) => {
      this.shot.weight = lerp(start, 0, t);
    }, easeInOut);
  }

  /** Hold a real-time cinematic camera shot while its owner eases the camera each frame. */
  setCinematicShot(position: THREE.Vector3, target: THREE.Vector3): void {
    this.shot.position.copy(position);
    this.shot.target.copy(target);
    this.shot.weight = 1;
    this.engine.invalidate();
  }

  releaseShot(): void {
    this.shot.weight = 0;
  }

  /** Leave the book by travelling part of the way along the path while unseen. */
  startFrom(u: number, id: PageId): void {
    this.progress = u;
    this.spine.getPoint(u, this.position);
    this.spine.getPoint(u + 0.04, this.target);
    this.current = id;
    this.releaseShot();
  }

  private update(dt: number): void {
    const camera = this.engine.camera;
    if (!this.engine.reducedMotion) {
      const ease = 1 - Math.exp(-dt * 3.2);
      this.sway.x += (this.pointer.x - this.sway.x) * ease;
      this.sway.y += (this.pointer.y - this.sway.y) * ease;
    }
    camera.position.copy(this.position);
    this.look.copy(this.target);
    if (this.shot.weight > 0) {
      const weight = easeOut(this.shot.weight);
      camera.position.lerp(this.shot.position, weight);
      this.look.lerp(this.shot.target, weight);
    }
    // A gentle parallax: the camera drifts and keeps looking at the same point.
    const calm = this.flying ? 0.35 : 1 - this.shot.weight;
    camera.position.x += this.sway.x * 0.55 * calm;
    camera.position.y += this.sway.y * 0.32 * calm;
    camera.lookAt(this.look);
  }
}
