import * as THREE from 'three';
import type { PageId } from '../../router';
import type { Director } from './director';
import type { Engine } from './engine';

export interface Interactable {
  id: string;
  page: PageId;
  /** Spoken name, used for the keyboard and screen-reader button. */
  label: string;
  /** An invisible, generously sized hit shape, cheaper and easier to touch than the art. */
  hit: THREE.Object3D;
  enabled?: () => boolean;
  onHover?: (hovered: boolean) => void;
  /** How close a mouse pointer is, from 0 (far) to 1 (on it), for a soft glow. */
  onNear?: (amount: number) => void;
  onActivate: () => void;
}

/**
 * After a tap, the browser fires a synthetic click at the same spot. If the tap has just
 * opened a dialog, that click lands on the dialog's backdrop and closes it straight away,
 * so the one click that follows a tap is swallowed.
 */
function swallowGhostClick(): void {
  const swallow = (event: MouseEvent): void => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 450);
}

/** Turns pointer and touch input into hover and click on 3D objects. */
export class Interaction {
  readonly items: Interactable[] = [];
  /** A point in the world under the pointer, for particles and butterflies. */
  readonly pointerWorld = new THREE.Vector3();
  blocked = false;

  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private hovered: Interactable | null = null;
  private pressed: { x: number; y: number; item: Interactable | null } | null = null;
  private hasPointer = false;
  private touch = false;

  constructor(private readonly engine: Engine, private readonly director: Director, surface: HTMLElement) {
    surface.addEventListener('pointermove', (event) => this.move(event));
    surface.addEventListener('pointerdown', (event) => this.down(event));
    surface.addEventListener('pointerup', (event) => this.up(event));
    surface.addEventListener('pointerleave', () => this.clear());
    engine.add(() => this.track());
  }

  add(item: Interactable): void {
    item.hit.traverse((object) => {
      object.userData.interactable = item;
    });
    this.items.push(item);
  }

  private setNdc(event: PointerEvent): void {
    const bounds = this.engine.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    this.hasPointer = true;
  }

  private active(): Interactable[] {
    return this.items.filter((item) => item.page === this.director.current && (item.enabled?.() ?? true));
  }

  private pick(): Interactable | null {
    if (this.blocked || this.director.flying) return null;
    this.raycaster.setFromCamera(this.ndc, this.engine.camera);
    const hit = this.raycaster.intersectObjects(this.active().map((item) => item.hit), true)[0];
    return (hit?.object.userData.interactable as Interactable | undefined) ?? null;
  }

  private setHover(item: Interactable | null): void {
    if (item === this.hovered) return;
    this.hovered?.onHover?.(false);
    this.hovered = item;
    item?.onHover?.(true);
    this.engine.renderer.domElement.style.cursor = item ? 'pointer' : '';
    this.engine.invalidate();
  }

  private move(event: PointerEvent): void {
    this.touch = event.pointerType === 'touch';
    this.setNdc(event);
    this.director.setPointer(this.ndc.x, this.ndc.y);
    // A finger has no hover: touching simply selects.
    if (!this.touch) this.setHover(this.pick());
  }

  private down(event: PointerEvent): void {
    this.setNdc(event);
    this.pressed = { x: event.clientX, y: event.clientY, item: this.pick() };
  }

  private up(event: PointerEvent): void {
    const press = this.pressed;
    this.pressed = null;
    if (!press?.item) return;
    // A press that wandered off is a swipe, not a tap.
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 14) return;
    this.setNdc(event);
    if (this.pick() !== press.item) return;
    if (event.pointerType !== 'mouse') swallowGhostClick();
    press.item.onActivate();
  }

  private clear(): void {
    this.setHover(null);
    this.director.setPointer(0, 0);
  }

  /** True while a mouse pointer rests on something that can be chosen. */
  get hovering(): boolean {
    return this.hovered !== null;
  }

  /** Drop any highlight, for example when a panel opens over the world. */
  reset(): void {
    this.setHover(null);
  }

  private track(): void {
    if (!this.hasPointer) return;
    // Project the pointer to a plane at the focus of the current view.
    const camera = this.engine.camera;
    this.raycaster.setFromCamera(this.ndc, camera);
    const distance = camera.position.distanceTo(this.director.focus());
    this.pointerWorld.copy(this.raycaster.ray.origin).addScaledVector(this.raycaster.ray.direction, distance);
  }

  /** Screen position of an object, for the automated tests. */
  project(id: string): [number, number] | null {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) return null;
    const point = new THREE.Box3().setFromObject(item.hit).getCenter(new THREE.Vector3()).project(this.engine.camera);
    return [((point.x + 1) / 2) * this.engine.width, ((1 - point.y) / 2) * this.engine.height];
  }
}
