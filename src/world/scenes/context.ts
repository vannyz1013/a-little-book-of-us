import type * as THREE from 'three';
import type { Director } from '../core/director';
import type { Engine } from '../core/engine';
import type { Interaction } from '../core/interaction';

/** What every scene needs from the world around it. */
export interface WorldContext {
  engine: Engine;
  director: Director;
  interaction: Interaction;
  dot: THREE.Texture;
}
