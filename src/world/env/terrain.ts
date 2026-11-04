import * as THREE from 'three';
import type { Engine } from '../core/engine';
import { fbm, smoothstep } from '../core/noise';
import { grainTexture } from '../core/textures';
import { CENTRES } from '../layout';

const CLEARINGS = [
  { centre: CENTRES.home, radius: 16 },
  { centre: CENTRES.memories, radius: 21 },
  { centre: CENTRES.letter, radius: 19 },
];

/** Distance from the point to the winding path that joins the places. */
function pathDistance(x: number, z: number): number {
  const wander = Math.sin(z * 0.045) * 9 + Math.sin(z * 0.019 + 1) * 14;
  const along = z < -72 ? 0.62 : 0.4;
  return Math.abs(x + 14 * (-z / 72) * along - wander * 0.55);
}

/** Height of the land anywhere in the world. */
export function groundHeight(x: number, z: number): number {
  let height = (fbm(x * 0.024 + 3, z * 0.024 + 8, 4) - 0.5) * 11;
  height += (fbm(x * 0.09, z * 0.09, 3) - 0.5) * 1.1;

  // Distant hills rise at the sides, to close the view softly.
  const edge = Math.abs(x + 6) - 58;
  if (edge > 0) height += edge * edge * 0.0045 * (0.5 + fbm(z * 0.02, x * 0.02, 3));

  for (const { centre, radius } of CLEARINGS) {
    const distance = Math.hypot(x - centre.x, z - centre.z);
    height *= smoothstep(radius * 0.72, radius * 1.65, distance);
  }
  return height;
}

export function isOnPath(x: number, z: number): boolean {
  return pathDistance(x, z) < 2.4;
}

export function createTerrain(engine: Engine): THREE.Mesh {
  const width = 300;
  const depth = 420;
  const segments = engine.tier.terrainSegments;
  const geometry = new THREE.PlaneGeometry(width, depth, Math.round(segments * 0.72), segments);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(-6, 0, -105);

  const position = geometry.getAttribute('position');
  const colours = new Float32Array(position.count * 3);
  const mint = new THREE.Color('#B6D6BE');
  const deep = new THREE.Color('#9CC5B0');
  const lavender = new THREE.Color('#C7BCE6');
  const sand = new THREE.Color('#E9E6EC');
  const colour = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, groundHeight(x, z));

    colour.lerpColors(mint, deep, fbm(x * 0.05, z * 0.05, 3));
    colour.lerp(lavender, smoothstep(0.52, 0.68, fbm(x * 0.03 + 50, z * 0.03 + 20, 3)) * 0.75);
    colour.lerp(sand, 1 - smoothstep(1.2, 3, pathDistance(x, z)));
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.computeVertexNormals();

  const grain = grainTexture(256, 18, 3);
  grain.repeat.set(26, 36);
  const ground = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, roughnessMap: grain, bumpMap: grain, bumpScale: 0.7 }),
  );
  ground.receiveShadow = true;
  engine.scene.add(ground);
  return ground;
}
