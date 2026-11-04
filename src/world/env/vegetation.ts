import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Engine } from '../core/engine';
import { lerp, seeded } from '../core/noise';
import { groundHeight, isOnPath } from './terrain';

/** Shared clock for plants swaying in the breeze. */
const wind = { value: 0 };

function swayingMaterial(strength: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide, envMapIntensity: 0.5 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = `uniform float uWind;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 root = instanceMatrix[3].xyz;
      #else
        vec3 root = vec3(0.0);
      #endif
      float gust = sin(uWind * 1.3 + root.x * 0.5 + root.z * 0.4) * 0.6 + sin(uWind * 2.4 + root.z * 0.9) * 0.3;
      float bend = position.y * position.y;
      transformed.x += gust * ${strength.toFixed(3)} * bend;
      transformed.z += gust * ${(strength * 0.6).toFixed(3)} * bend;`,
    );
  };
  return material;
}

function paint(geometry: THREE.BufferGeometry, low: THREE.Color, high: THREE.Color, top: number): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  const colours = new Float32Array(position.count * 3);
  const colour = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    colour.lerpColors(low, high, Math.min(position.getY(i) / top, 1));
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geometry;
}

/** One curved, tapering blade. */
function blade(height: number, width: number, lean: number, turn: number, rows = 3): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const half = (width / 2) * (1 - t * t);
    const y = height * t;
    const out = lean * t * t;
    positions.push(-half, y, out, half, y, out);
    if (row < rows) {
      const a = row * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.rotateY(turn);
  geometry.computeVertexNormals();
  return geometry;
}

/** A tuft of blades. The far version has fewer, simpler blades: at that distance they read the same. */
function grassTuft(far = false): THREE.BufferGeometry {
  const random = seeded(4);
  const count = far ? 5 : 8;
  const blades = Array.from({ length: count }, (_, i) =>
    blade(0.42 + random() * 0.42, far ? 0.07 : 0.055, 0.2 + random() * 0.22, (i / count) * Math.PI * 2 + random(), far ? 2 : 3),
  );
  const merged = mergeGeometries(blades)!;
  blades.forEach((part) => part.dispose());
  return paint(merged, new THREE.Color('#9CC7B1'), new THREE.Color('#D5EADC'), 0.8);
}

/** A sprig of lavender: slim stems, each ending in a stack of little buds. */
function lavenderSprig(far = false): THREE.BufferGeometry {
  const random = seeded(8);
  const parts: THREE.BufferGeometry[] = [];
  for (let stem = 0; stem < (far ? 3 : 4); stem++) {
    const height = 0.72 + random() * 0.36;
    const lean = (random() - 0.5) * 0.5;
    const turn = random() * 6.28;
    const body = new THREE.CylinderGeometry(0.007, 0.011, height, far ? 3 : 4, 1, true);
    body.translate(0, height / 2, 0);
    body.rotateZ(lean * 0.3);
    body.rotateY(turn);
    parts.push(paint(body, new THREE.Color('#9CC7B1'), new THREE.Color('#B5D4C2'), 1.1).toNonIndexed());

    const profile: THREE.Vector2[] = [];
    const rows = far ? 3 : 6;
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      const radius = (0.04 + Math.sin(i * 2.6) * 0.01) * Math.sin(Math.PI * Math.min(t * 0.9 + 0.1, 1)) ** 0.55;
      profile.push(new THREE.Vector2(Math.max(radius, 0.002), t * 0.3));
    }
    const buds = new THREE.LatheGeometry(profile, far ? 3 : 5);
    buds.translate(0, height, 0);
    buds.rotateZ(lean * 0.3);
    buds.rotateY(turn);
    parts.push(paint(buds, new THREE.Color('#D2C8EE'), new THREE.Color('#B3A5E2'), height + 0.34).toNonIndexed());
  }
  for (const part of parts) part.deleteAttribute('uv');
  return mergeGeometries(parts)!;
}

/** A small open flower on a stem. Instance colour tints the petals. */
function wildflower(far = false): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const height = 0.56;
  const stem = new THREE.CylinderGeometry(0.007, 0.012, height, 4, 1, true);
  stem.translate(0, height / 2, 0);
  parts.push(paint(stem.toNonIndexed(), new THREE.Color('#A9CDBB'), new THREE.Color('#B5D4C2'), 1));

  const petals = far ? 5 : 6;
  for (let i = 0; i < petals; i++) {
    const petal = far ? new THREE.PlaneGeometry(0.11, 0.16, 1, 2) : new THREE.PlaneGeometry(0.1, 0.16, 2, 3);
    const position = petal.getAttribute('position');
    for (let v = 0; v < position.count; v++) {
      const y = position.getY(v) + 0.08;
      const taper = Math.sin(((y / 0.16) * 0.84 + 0.16) * Math.PI);
      position.setX(v, position.getX(v) * taper);
      position.setZ(v, y * y * 2.4);
      position.setY(v, y);
    }
    petal.computeVertexNormals();
    petal.rotateX(-Math.PI / 2 + 0.25);
    petal.rotateY((i / petals) * Math.PI * 2);
    petal.translate(0, height, 0);
    parts.push(paint(petal.toNonIndexed(), new THREE.Color('#ffffff'), new THREE.Color('#ffffff'), 1));
  }
  const heart = far ? new THREE.OctahedronGeometry(0.032, 0) : new THREE.IcosahedronGeometry(0.032, 0);
  heart.translate(0, height + 0.018, 0);
  parts.push(paint(heart, new THREE.Color('#F2EBC8'), new THREE.Color('#F2EBC8'), 1));

  for (const part of parts) part.deleteAttribute('uv');
  return mergeGeometries(parts)!;
}

export interface PatchOptions {
  centre: THREE.Vector3;
  radius: number;
  /** Plants are kept out of this radius, so the middle of the view stays clear. */
  keepClear: number;
  /** A rectangle kept free, so no plant ever stands between camera and subject. */
  view?: { halfWidth: number; back: number; front: number };
  grass: number;
  lavender: number;
  flowers: number;
  seed: number;
  /** Where the camera rests, relative to the centre. Plants near it get full detail. */
  eye?: THREE.Vector3;
}

/** Plants closer than this to the resting camera use the detailed shapes. */
const NEAR = 15;
/** Beyond this distance plants are thinned out. */
const THIN = 30;

const FLOWER_TINTS = ['#C8BCE8', '#B9D1E8', '#FFFFFF', '#AFC6EA', '#D9CFF0', '#FFFFFF'].map((hex) => new THREE.Color(hex));

/** Fill a part of the land with plants, as instanced meshes owned by its scene. */
export function plantPatch(engine: Engine, parent: THREE.Object3D, options: PatchOptions): void {
  const random = seeded(options.seed);
  const density = engine.tier.density;
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  // The camera always rests in front of the centre, looking in. Plants well behind it are never seen.
  const eye = options.centre.clone().add(options.eye ?? new THREE.Vector3(0, 0, 13));
  const behind = eye.z - options.centre.z + 5;

  const place = (detailed: THREE.BufferGeometry, simple: THREE.BufferGeometry, material: THREE.Material, wanted: number, tint: boolean, size: [number, number], cluster: boolean) => {
    const count = Math.max(Math.round(wanted * density), 1);
    const near = new THREE.InstancedMesh(detailed, material, count);
    const far = new THREE.InstancedMesh(simple, material, count);
    const counts = [0, 0];
    let target = count;
    let guard = 0;
    while (counts[0] + counts[1] < target && guard++ < count * 8) {
      const angle = random() * Math.PI * 2;
      const distance = lerp(options.keepClear, options.radius, Math.sqrt(random()));
      let x = options.centre.x + Math.cos(angle) * distance;
      let z = options.centre.z + Math.sin(angle) * distance * 0.8;
      if (cluster) {
        x = Math.round(x / 3.2) * 3.2 + (random() - 0.5) * 2;
        z = Math.round(z / 3.2) * 3.2 + (random() - 0.5) * 2;
      }
      if (isOnPath(x, z) || Math.hypot(x - options.centre.x, z - options.centre.z) < options.keepClear) continue;
      if (z - options.centre.z > behind) continue;
      const view = options.view;
      if (view) {
        const dz = z - options.centre.z;
        if (Math.abs(x - options.centre.x) < view.halfWidth && dz > -view.back && dz < view.front) continue;
      }
      // Far away, fewer but slightly larger plants give the same carpet for less work.
      const away = Math.hypot(x - eye.x, z - eye.z);
      if (away > THIN && random() < 0.4) {
        target--;
        continue;
      }
      const s = lerp(size[0], size[1], random()) * (away > THIN ? 1.15 : 1);
      position.set(x, groundHeight(x, z) - 0.03, z);
      rotation.setFromAxisAngle(up, random() * Math.PI * 2);
      scale.setScalar(s);
      const which = away < NEAR ? 0 : 1;
      const mesh = which ? far : near;
      mesh.setMatrixAt(counts[which], matrix.compose(position, rotation, scale));
      if (tint) mesh.setColorAt(counts[which], FLOWER_TINTS[Math.floor(random() * FLOWER_TINTS.length)]);
      counts[which]++;
    }
    [near, far].forEach((mesh, which) => {
      mesh.count = counts[which];
      if (!mesh.count) return mesh.dispose();
      if (tint && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false;
      mesh.receiveShadow = engine.tier.shadows > 0;
      parent.add(mesh);
    });
  };

  place(shared.grass(), shared.farGrass(), shared.grassMaterial(), options.grass, false, [0.8, 1.5], false);
  place(shared.lavender(), shared.farLavender(), shared.lavenderMaterial(), options.lavender, false, [1.2, 1.9], true);
  place(shared.flower(), shared.farFlower(), shared.flowerMaterial(), options.flowers, true, [1.1, 1.9], false);
}

/** Each plant shape is built once and reused by every patch. */
const shared = (() => {
  const once = <T,>(make: () => T) => {
    let value: T | undefined;
    return () => (value ??= make());
  };
  return {
    grass: once(() => grassTuft()),
    lavender: once(() => lavenderSprig()),
    flower: once(() => wildflower()),
    farGrass: once(() => grassTuft(true)),
    farLavender: once(() => lavenderSprig(true)),
    farFlower: once(() => wildflower(true)),
    grassMaterial: once(() => swayingMaterial(0.1)),
    lavenderMaterial: once(() => swayingMaterial(0.07)),
    flowerMaterial: once(() => swayingMaterial(0.11)),
  };
})();

export function startWind(engine: Engine): void {
  engine.add((_, time) => {
    wind.value = time;
  });
}
