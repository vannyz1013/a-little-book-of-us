import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Engine } from '../core/engine';
import { fbm, seeded } from '../core/noise';
import { groundHeight } from './terrain';

/** A crown of many soft clusters, smoothly shaded, with dappled colour. */
function canopy(colourLow: THREE.Color, colourHigh: THREE.Color, seed: number, detail: number): THREE.BufferGeometry {
  const random = seeded(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 26; i++) {
    const radius = 0.36 + random() * 0.46;
    const sphere = new THREE.IcosahedronGeometry(radius, detail);
    sphere.deleteAttribute('uv');
    sphere.deleteAttribute('normal');
    const welded = mergeVertices(sphere, 1e-4);
    const angle = random() * Math.PI * 2;
    const spread = Math.sqrt(random()) * 2.5;
    const dome = Math.sqrt(Math.max(1 - (spread / 2.8) ** 2, 0));
    const offset = new THREE.Vector3(Math.cos(angle) * spread, (random() * 1.5 - 0.3) * dome, Math.sin(angle) * spread);
    const position = welded.getAttribute('position');
    const normals = new Float32Array(position.count * 3);
    const own = new THREE.Vector3();
    const whole = new THREE.Vector3();
    for (let v = 0; v < position.count; v++) {
      const x = position.getX(v);
      const y = position.getY(v);
      const z = position.getZ(v);
      // Gentle, low-frequency lumps: strong high-frequency noise is what made the crowns look faceted.
      const push = 1 + (fbm(x * 2.6 + i * 7, z * 2.6 + y * 2.6, 3) - 0.5) * 0.36;
      const px = x * push + offset.x;
      const py = y * push * 0.86 + offset.y;
      const pz = z * push + offset.z;
      position.setXYZ(v, px, py, pz);
      // Foliage shading: blend each cluster's own roundness with the roundness of the whole
      // crown, so the canopy reads as one soft mass instead of a pile of separate balls.
      own.set(x, y, z).normalize();
      whole.set(px, (py - 0.35) * 1.2, pz).normalize();
      own.multiplyScalar(0.45).addScaledVector(whole, 0.55).normalize();
      normals[v * 3] = own.x;
      normals[v * 3 + 1] = own.y;
      normals[v * 3 + 2] = own.z;
    }
    welded.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    parts.push(welded);
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((part) => part.dispose());
  const position = merged.getAttribute('position');
  const colours = new Float32Array(position.count * 3);
  const colour = new THREE.Color();
  for (let v = 0; v < position.count; v++) {
    const dapple = (fbm(position.getX(v) * 1.7, position.getZ(v) * 1.7 + position.getY(v), 3) - 0.5) * 0.7;
    colour.lerpColors(colourLow, colourHigh, THREE.MathUtils.clamp(THREE.MathUtils.smoothstep(position.getY(v), -1.4, 1.8) + dapple, 0, 1));
    colours[v * 3] = colour.r;
    colours[v * 3 + 1] = colour.g;
    colours[v * 3 + 2] = colour.b;
  }
  merged.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return merged;
}

function trunk(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.2, 0),
    new THREE.Vector3(0.18, 1.6, 0.05),
    new THREE.Vector3(-0.12, 3.2, -0.1),
    new THREE.Vector3(0.1, 4.7, 0),
  ]);
  const tube = new THREE.TubeGeometry(curve, 10, 0.15, 6, false);
  const position = tube.getAttribute('position');
  for (let v = 0; v < position.count; v++) {
    // Narrow the trunk toward the crown.
    const y = position.getY(v);
    const factor = 1.25 - y * 0.13;
    const point = curve.getPoint(Math.min(Math.max((y + 0.2) / 4.9, 0), 1));
    position.setX(v, point.x + (position.getX(v) - point.x) * factor);
    position.setZ(v, point.z + (position.getZ(v) - point.z) * factor);
  }
  tube.computeVertexNormals();
  return tube;
}

export interface Grove {
  points: [number, number][];
  seed: number;
  /** The middle of the scene. Only trees near it fall inside the sun's shadow box. */
  centre: THREE.Vector3;
}

/** Beyond this distance from the scene centre a tree's shadow would land outside the shadow map. */
const SHADOW_REACH = 24;

/** The three crowns are built once per detail level and shared by every grove. */
const crownCache = new Map<number, THREE.BufferGeometry[]>();
function crownsFor(detail: number): THREE.BufferGeometry[] {
  let crowns = crownCache.get(detail);
  if (!crowns) {
    crowns = [
      canopy(new THREE.Color('#B9B0E2'), new THREE.Color('#E6E0F6'), 21, detail),
      canopy(new THREE.Color('#ACC7E3'), new THREE.Color('#E2EDF7'), 22, detail),
      canopy(new THREE.Color('#A9CFBB'), new THREE.Color('#DCEEE3'), 23, detail),
    ];
    crownCache.set(detail, crowns);
  }
  return crowns;
}

/** A few blossoming trees, instanced so a whole grove costs a handful of draw calls. */
export function plantGrove(engine: Engine, parent: THREE.Object3D, grove: Grove): void {
  const random = seeded(grove.seed);
  const detail = engine.tier.name === 'low' ? 1 : 2;
  const crowns = crownsFor(detail);
  const leaves = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const bark = new THREE.MeshStandardMaterial({ color: '#8F8EA6', roughness: 0.92 });
  const stems = new THREE.InstancedMesh(trunk(), bark, grove.points.length);
  stems.castShadow = engine.tier.shadows > 0;
  stems.frustumCulled = false;

  // Buckets by crown shape, then by whether the tree is close enough to cast a shadow.
  const buckets: THREE.Matrix4[][][] = [[[], []], [[], []], [[], []]];
  const matrix = new THREE.Matrix4();
  grove.points.forEach(([x, z], index) => {
    const y = groundHeight(x, z);
    const scale = 0.85 + random() * 0.7;
    const turn = random() * Math.PI * 2;
    matrix.compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn),
      new THREE.Vector3(scale, scale, scale),
    );
    stems.setMatrixAt(index, matrix);
    const crown = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y + 5.6 * scale, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn),
      new THREE.Vector3(scale * 1.25, scale * 1.15, scale * 1.25),
    );
    const casts = Math.hypot(x - grove.centre.x, z - grove.centre.z) < SHADOW_REACH ? 0 : 1;
    buckets[Math.floor(random() * 3)][casts].push(crown);
  });
  parent.add(stems);

  buckets.forEach((pair, i) =>
    pair.forEach((bucket, far) => {
      if (!bucket.length) return;
      const mesh = new THREE.InstancedMesh(crowns[i], leaves, bucket.length);
      bucket.forEach((crown, index) => mesh.setMatrixAt(index, crown));
      mesh.castShadow = engine.tier.shadows > 0 && !far;
      mesh.frustumCulled = false;
      parent.add(mesh);
    }),
  );
}
