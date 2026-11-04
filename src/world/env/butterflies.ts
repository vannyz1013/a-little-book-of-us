import * as THREE from 'three';
import type { Engine } from '../core/engine';
import type { Interaction } from '../core/interaction';
import { seeded } from '../core/noise';

interface Butterfly {
  root: THREE.Group;
  left: THREE.Group;
  right: THREE.Group;
  home: THREE.Vector3;
  phase: number;
  speed: number;
  reach: number;
}

/** A real two-lobed wing, hinged on the body, shaded from a pale root to a soft tip. */
function wingGeometry(low: string, high: string): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.04);
  shape.bezierCurveTo(0.2, 0.32, 0.62, 0.5, 0.82, 0.32);
  shape.bezierCurveTo(0.9, 0.16, 0.66, -0.02, 0.5, -0.04);
  shape.bezierCurveTo(0.6, -0.2, 0.54, -0.46, 0.3, -0.5);
  shape.bezierCurveTo(0.14, -0.46, 0.05, -0.2, 0, -0.06);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 10);
  const position = geometry.getAttribute('position');
  const colours = new Float32Array(position.count * 3);
  const a = new THREE.Color(low);
  const b = new THREE.Color(high);
  const colour = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    colour.lerpColors(a, b, Math.min(Math.hypot(position.getX(i), position.getY(i)) / 0.85, 1));
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** The wing, body and material set every butterfly in the world shares. */
export const butterflyParts = (() => {
  let parts: { geometries: THREE.BufferGeometry[]; material: THREE.Material; body: THREE.BufferGeometry; bodyMaterial: THREE.Material } | undefined;
  return () =>
    (parts ??= {
      geometries: [wingGeometry('#F2EEFB', '#B7A9E4'), wingGeometry('#EEF5FB', '#A6C4E6'), wingGeometry('#FFFFFF', '#CFC6EE')],
      material: new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.12 }),
      body: new THREE.CapsuleGeometry(0.03, 0.34, 3, 8),
      bodyMaterial: new THREE.MeshStandardMaterial({ color: '#7E7F96', roughness: 0.7 }),
    });
})();

export interface Swarm {
  excited: { value: number };
}

export function createButterflies(
  engine: Engine,
  interaction: Interaction,
  parent: THREE.Object3D,
  centre: THREE.Vector3,
  wanted: number,
  seed: number,
): Swarm {
  const random = seeded(seed);
  const parts = butterflyParts();
  const count = Math.max(Math.round(wanted * Math.max(engine.tier.density, 0.5)), 3);
  const flock: Butterfly[] = [];

  for (let i = 0; i < count; i++) {
    const geometry = parts.geometries[i % parts.geometries.length];
    const makeWing = (side: 1 | -1) => {
      const hinge = new THREE.Group();
      const wing = new THREE.Mesh(geometry, parts.material);
      wing.scale.x = side;
      hinge.add(wing);
      return hinge;
    };
    const left = makeWing(-1);
    const right = makeWing(1);
    const root = new THREE.Group();
    const body = new THREE.Mesh(parts.body, parts.bodyMaterial);
    body.rotation.x = Math.PI / 2;
    root.add(left, right, body);
    root.scale.setScalar(0.34 + random() * 0.16);
    const angle = random() * Math.PI * 2;
    const home = centre.clone().add(new THREE.Vector3(Math.cos(angle) * (3.5 + random() * 8), 1.4 + random() * 3.6, Math.sin(angle) * (2 + random() * 6) + 3));
    root.position.copy(home);
    parent.add(root);
    flock.push({ root, left, right, home, phase: random() * 40, speed: 0.3 + random() * 0.3, reach: 1.2 + random() * 1.8 });
  }

  const excited = { value: 0 };
  const next = new THREE.Vector3();
  const heading = new THREE.Vector3();
  const offset = new THREE.Vector3();
  parent.getWorldPosition(offset);

  engine.add((dt, time) => {
    if (!parent.visible || dt === 0) return;
    for (const b of flock) {
      const t = time * b.speed + b.phase;
      next.set(
        b.home.x + Math.sin(t) * b.reach + Math.sin(t * 2.3) * 0.5,
        b.home.y + Math.sin(t * 1.7) * 0.7 + excited.value * 0.9,
        b.home.z + Math.cos(t * 0.8) * b.reach,
      );
      // They shy away from the pointer, softly.
      heading.copy(next).add(offset).sub(interaction.pointerWorld);
      const distance = heading.length();
      if (distance < 3.2) next.addScaledVector(heading.normalize(), (3.2 - distance) * 0.7);

      heading.copy(next).sub(b.root.position);
      b.root.position.lerp(next, 1 - Math.exp(-dt * 2.6));
      b.root.rotation.y = Math.atan2(heading.x, heading.z) + Math.PI;
      b.root.rotation.x = 0.4;

      const flap = Math.sin(time * (10 + excited.value * 5) + b.phase) * 0.8 + 0.42;
      b.left.rotation.z = -flap;
      b.right.rotation.z = flap;
    }
  });
  return { excited };
}
