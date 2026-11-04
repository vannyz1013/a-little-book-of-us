export type Ease = (t: number) => number;

export const easeInOut: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOut: Ease = (t) => 1 - (1 - t) ** 3;
export const easeIn: Ease = (t) => t * t * t;
export const linear: Ease = (t) => t;
export const easeSoft: Ease = (t) => t * t * (3 - 2 * t);

interface Tween {
  elapsed: number;
  duration: number;
  delay: number;
  ease: Ease;
  update: (value: number) => void;
  done: () => void;
}

/** A tiny tween runner driven by the render loop. It replaces the need for GSAP. */
export class Tweens {
  private active = new Set<Tween>();
  /** With reduced motion every tween finishes on the next frame. */
  instant = false;

  get running(): boolean {
    return this.active.size > 0;
  }

  to(duration: number, update: (value: number) => void, ease: Ease = easeInOut, delay = 0): Promise<void> {
    return new Promise((resolve) => {
      this.active.add({
        elapsed: 0,
        duration: this.instant ? 0 : duration,
        delay: this.instant ? 0 : delay,
        ease,
        update,
        done: resolve,
      });
    });
  }

  wait(duration: number): Promise<void> {
    return this.to(duration, () => {}, linear);
  }

  update(dt: number): void {
    for (const tween of this.active) {
      tween.elapsed += dt;
      const time = tween.elapsed - tween.delay;
      if (time < 0) continue;
      const progress = tween.duration <= 0 ? 1 : Math.min(time / tween.duration, 1);
      tween.update(tween.ease(progress));
      if (progress >= 1) {
        this.active.delete(tween);
        tween.done();
      }
    }
  }
}
