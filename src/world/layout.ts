import * as THREE from 'three';
import type { PageId } from '../router';

/** The three places, laid out along one winding journey. */
export const CENTRES: Record<PageId, THREE.Vector3> = {
  home: new THREE.Vector3(0, 0, 0),
  memories: new THREE.Vector3(-28, 0, -72),
  letter: new THREE.Vector3(30, 0, -204),
};

export const ORDER: PageId[] = ['home', 'memories', 'letter'];

/**
 * Once the letter stands open in front of the cake on a tall screen, the camera
 * rises a little and looks further down, so the cake sits higher in the frame
 * and the nearer letter stands clear below it.
 */
export interface LetterFit {
  /** Camera height and look-at height, relative to the scene centre, and distance scale. */
  eye: number;
  target: number;
  zoom: number;
}

export const sceneState: { letterOpen: boolean; fit: LetterFit | null } = { letterOpen: false, fit: null };
const TALL_OPEN = { eye: 1.5, target: -2.05 };
/** Short phones have less room under the birthday message, so the view tilts less. */
const SHORT_OPEN = { eye: 1.0, target: -1.35 };
export const isShortScreen = (): boolean => window.innerHeight < 720;

/**
 * Narrow portrait screens (phones held upright). Here the friends stand a little further
 * apart, either side of the envelope and the open letter, instead of behind them.
 */
export const isPortraitPhone = (aspect: number): boolean => aspect < 0.78;

/** Phones held sideways: wide, and too short for the usual stacked interface (matches the CSS rule). */
export const isShortLandscape = (aspect: number, height: number): boolean => aspect > 1.15 && height <= 500;

/** How far either friend stands from the middle of the birthday garden. */
export const gardenSpread = (aspect: number): number => (isPortraitPhone(aspect) ? 1.5 : 1.0);

/**
 * Where the gift rests in the birthday garden (local to the scene). On portrait phones it
 * waits on the floor behind and to the left of the cake, clear of the two friends standing
 * at the front; elsewhere it keeps its place at the front left.
 */
export function giftSpot(aspect: number, target = new THREE.Vector3()): THREE.Vector3 {
  if (isPortraitPhone(aspect)) return target.set(-2.6, 0.37, -1.3);
  return target.set(aspect > 1.15 ? -3.65 : -1.9, 0.37, 2.85);
}

export interface Pose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

/** Distance at which a box of this size fits the view, whatever the screen shape. */
export function fitDistance(camera: THREE.PerspectiveCamera, width: number, height: number): number {
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return Math.max(height / (2 * tan), width / (2 * tan * camera.aspect));
}

/** Where the camera rests at each place. Portrait screens stand further back. */
export function poseFor(id: PageId, camera: THREE.PerspectiveCamera): Pose {
  const centre = CENTRES[id];
  switch (id) {
    case 'home': {
      const distance = fitDistance(camera, 4.6, 6.2);
      return {
        position: centre.clone().add(new THREE.Vector3(0, 3.6, distance)),
        target: centre.clone().add(new THREE.Vector3(0, 3.35, 0)),
      };
    }
    case 'memories': {
      const distance = 16;
      return {
        position: centre.clone().add(new THREE.Vector3(0, 5.2, distance)),
        target: centre.clone().add(new THREE.Vector3(0, 5.5, 0)),
      };
    }
    case 'letter': {
      // Wide screens leave room beside the cake; tall ones above it, for the message.
      const wide = camera.aspect > 1.15;
      const distance = wide ? fitDistance(camera, 13, 9.8) : fitDistance(camera, 6.7, 11.5);
      const open = !wide && sceneState.letterOpen;
      const shortRest = !wide && !open && isShortScreen();
      // Screens too short for the usual open framing get one fitted to their controls.
      const fit = open ? sceneState.fit : null;
      if (fit) {
        return {
          position: centre.clone().add(new THREE.Vector3(0, fit.eye, distance * fit.zoom)),
          target: centre.clone().add(new THREE.Vector3(0, fit.target, 0)),
        };
      }
      const tilt = !open ? { eye: 0, target: shortRest ? -1.4 : 0 } : isShortScreen() ? SHORT_OPEN : TALL_OPEN;
      return {
        position: centre.clone().add(new THREE.Vector3(0, (wide ? 4.5 : 5) + tilt.eye, distance)),
        target: centre.clone().add(new THREE.Vector3(0, (wide ? 3.5 : 4.6) + tilt.target, 0)),
      };
    }
  }
}

export interface Slot {
  position: THREE.Vector3;
  /** Largest uniform scale for an object of unit size in this slot. */
  size: number;
}

export interface ScatterOptions {
  /** Fractions of the screen reserved at the top and bottom for the interface. */
  top: number;
  bottom: number;
  /** How far apart the rows stand, front to back, in world units. */
  rowDepth: number;
}

/**
 * Spreads objects across the visible area, so every object is on screen and
 * tappable at any aspect ratio. Rows stand one behind another in real depth,
 * and are enlarged to compensate, so the arrangement keeps its place on screen.
 */
export function scatterInView(
  count: number,
  camera: THREE.PerspectiveCamera,
  pose: Pose,
  seed: () => number,
  options: ScatterOptions,
): Slot[] {
  const { top, bottom, rowDepth } = options;
  const distance = pose.position.distanceTo(pose.target);
  const viewHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const viewWidth = viewHeight * camera.aspect;
  const usableHeight = viewHeight * (1 - top - bottom);
  const usableWidth = viewWidth * 0.92;

  // Pick the grid whose cells are nearest to the shape of a note or frame,
  // preferring rows that are evenly filled.
  let rows = 1;
  let best = Infinity;
  for (let r = 1; r <= count; r++) {
    const columns = Math.ceil(count / r);
    const ratio = usableWidth / columns / (usableHeight / r);
    const uneven = (columns * r - count) / count;
    const score = Math.abs(Math.log(ratio / 1.15)) + uneven * 0.8;
    if (score < best) {
      best = score;
      rows = r;
    }
  }
  const base = Math.floor(count / rows);
  const extra = count % rows;
  const widest = base + (extra ? 1 : 0);
  const cellWidth = usableWidth / widest;
  const cellHeight = usableHeight / rows;
  const size = Math.min(cellWidth, cellHeight);

  const forward = pose.target.clone().sub(pose.position).normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward);
  const middle = (bottom - top) * viewHeight * 0.5;

  const slots: Slot[] = [];
  for (let row = 0; row < rows; row++) {
    const inRow = base + (row < extra ? 1 : 0);
    const depth = (rows - 1 - row * 2) * 0.5 * rowDepth + rowDepth * ((rows - 1) * 0.5);
    for (let column = 0; column < inRow; column++) {
      const across = inRow > 1 ? (column - (inRow - 1) / 2) / ((inRow - 1) / 2) : 0;
      // Each object sits at its own depth: the rows curve around the viewer.
      const own = depth + across * across * size * 0.5 + (seed() - 0.5) * size * 0.5;
      const zoom = (distance + own) / distance;
      const x = (column - (inRow - 1) / 2) * cellWidth + (seed() - 0.5) * cellWidth * 0.1;
      const y = ((rows - 1) / 2 - row) * cellHeight + middle + (seed() - 0.5) * cellHeight * 0.1;
      slots.push({
        position: pose.position
          .clone()
          .addScaledVector(forward, distance + own)
          .addScaledVector(right, x * zoom)
          .addScaledVector(up, y * zoom),
        size: size * zoom,
      });
    }
  }
  return slots;
}
