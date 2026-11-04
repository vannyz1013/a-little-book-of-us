import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Engine } from '../core/engine';
import { noise2, seeded, smoothstep } from '../core/noise';
import { grainTexture, palette } from '../core/textures';
import { leafGeometry, shadowed } from './helpers';

interface TierSpec {
  radius: number;
  height: number;
  colour: string;
  sheen: string;
  drip: string;
}

/** Proportions follow a real tiered cake: each tier about 70% of the one below. */
const TIERS: TierSpec[] = [
  { radius: 1.72, height: 1.08, colour: '#BCD3EA', sheen: '#E6EFF7', drip: '#F5F3FB' },
  { radius: 1.24, height: 0.98, colour: '#CBC0EA', sheen: '#EDE8F8', drip: '#F7F7F3' },
  { radius: 0.82, height: 0.88, colour: '#C4DCCB', sheen: '#E8F3EC', drip: '#F5F3FB' },
];

export const CAKE_TOP = TIERS.reduce((sum, tier) => sum + tier.height, 0);

/** The sponge under its buttercream: a lathed drum with soft, rounded shoulders. */
function drum(radius: number, height: number): THREE.BufferGeometry {
  const round = 0.1;
  const points: THREE.Vector2[] = [new THREE.Vector2(0.001, 0)];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    points.push(new THREE.Vector2(radius - round + Math.sin(a) * round, round - Math.cos(a) * round));
  }
  for (let i = 1; i < 10; i++) points.push(new THREE.Vector2(radius, round + ((height - round * 2) * i) / 10));
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    points.push(new THREE.Vector2(radius - round + Math.cos(a) * round, height - round + Math.sin(a) * round));
  }
  points.push(new THREE.Vector2(0.001, height));
  const geometry = new THREE.LatheGeometry(points, 96);

  // The faint unevenness of cream smoothed by hand.
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const angle = Math.atan2(z, x);
    const push = 1 + (noise2(Math.cos(angle) * 2.2 + 7, y * 1.6 + Math.sin(angle) * 2.2) - 0.5) * 0.016;
    position.setXYZ(i, x * push, y, z * push);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Cream run down over the edge of a tier: one surface, with rounded uneven drips. */
function drips(radius: number, seed: number): THREE.BufferGeometry {
  const random = seeded(seed);
  const around = 200;
  const rows = 22;
  const lobes = Array.from({ length: 24 }, (_, i) => ({
    angle: (i / 24) * Math.PI * 2 + (random() - 0.5) * 0.2,
    width: 0.04 + random() * 0.05,
    length: random() < 0.28 ? 0.05 + random() * 0.08 : 0.15 + random() * 0.42,
  }));
  const depthAt = (angle: number): number => {
    let depth = 0.07;
    for (const lobe of lobes) {
      let delta = Math.abs(angle - lobe.angle);
      delta = Math.min(delta, Math.PI * 2 - delta);
      depth = Math.max(depth, 0.07 + lobe.length * Math.exp(-((delta / lobe.width) ** 4)));
    }
    return depth;
  };

  const positions: number[] = [];
  const indices: number[] = [];
  for (let a = 0; a <= around; a++) {
    const angle = (a / around) * Math.PI * 2;
    const depth = depthAt(angle);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      let rad: number;
      let y: number;
      if (t < 0.34) {
        // Pooled across the top of the tier.
        const k = t / 0.34;
        rad = radius * (0.62 + 0.38 * k);
        y = 0.022 * Math.sin(k * Math.PI * 0.5) + 0.012;
      } else if (t < 0.5) {
        // Round the shoulder.
        const k = ((t - 0.34) / 0.16) * (Math.PI / 2);
        rad = radius - 0.1 + Math.sin(k) * 0.125;
        y = 0.034 - 0.1 + Math.cos(k) * 0.1;
      } else {
        // Down the wall, with a bead of cream at the bottom of each run.
        const k = (t - 0.5) / 0.5;
        const swell = 0.025 + 0.03 * smoothstep(0.55, 0.9, k);
        const close = Math.sqrt(Math.max(1 - smoothstep(0.86, 1, k) ** 2, 0));
        rad = radius + swell * close;
        y = -0.066 - (depth + 0.03) * k;
      }
      positions.push(c * rad, y, s * rad);
    }
  }
  const stride = rows + 1;
  for (let a = 0; a < around; a++) {
    for (let r = 0; r < rows; r++) {
      const p = a * stride + r;
      indices.push(p, p + stride, p + 1, p + 1, p + stride, p + stride + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** One piped shell of buttercream, ridged as if from a star nozzle. */
function pipedShell(): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(1, 16, 10);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const angle = Math.atan2(z, y);
    const ridge = 1 + Math.cos(angle * 7) * 0.09;
    const taper = 1 - smoothstep(-0.2, 1, x) * 0.62;
    position.setXYZ(i, x * 1.5, y * ridge * taper, z * ridge * taper);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A five-petalled sugar flower, modelled as one piece. */
function sugarFlower(): THREE.BufferGeometry {
  const petals: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const petal = new THREE.SphereGeometry(1, 10, 7);
    petal.scale(0.62, 0.17, 0.46);
    const position = petal.getAttribute('position');
    for (let v = 0; v < position.count; v++) {
      const x = position.getX(v);
      position.setY(v, position.getY(v) + x * x * 0.42);
    }
    petal.translate(0.62, 0, 0);
    petal.rotateY((i / 5) * Math.PI * 2);
    petals.push(petal);
  }
  const merged = mergeGeometries(petals)!;
  petals.forEach((part) => part.dispose());
  merged.computeVertexNormals();
  return merged;
}

export class Cake {
  readonly root = new THREE.Group();
  /** Added to the materials as candlelight spreads over the cream. */
  private readonly creams: THREE.MeshStandardMaterial[] = [];
  private warmth = 0;

  constructor(private readonly engine: Engine) {
    this.build();
  }

  private cream(colour: string, sheen: string, bump: THREE.Texture): THREE.MeshStandardMaterial {
    const shared = { color: colour, roughness: 0.46, bumpMap: bump, bumpScale: 0.32 };
    const material = this.engine.tier.physicalMaterials
      ? new THREE.MeshPhysicalMaterial({ ...shared, sheen: 1, sheenColor: new THREE.Color(sheen), sheenRoughness: 0.55, clearcoat: 0.32, clearcoatRoughness: 0.42 })
      : new THREE.MeshStandardMaterial(shared);
    this.creams.push(material);
    return material;
  }

  private build(): void {
    const bump = grainTexture(256, 26, 7);
    bump.repeat.set(5, 3);
    const random = seeded(77);
    const pearl = this.engine.tier.physicalMaterials
      ? new THREE.MeshPhysicalMaterial({ color: '#F4F1FB', roughness: 0.22, metalness: 0.06, clearcoat: 1, clearcoatRoughness: 0.14, iridescence: 0.45, iridescenceIOR: 1.3, sheen: 0.5, sheenColor: new THREE.Color(palette.lavender) })
      : new THREE.MeshStandardMaterial({ color: '#F4F1FB', roughness: 0.25, metalness: 0.1 });
    // Pearls are tiny on screen; a light sphere is indistinguishable from a dense one.
    const pearlGeometry = new THREE.SphereGeometry(1, 9, 6);
    const shellGeometry = pipedShell();
    const shellMaterial = this.cream('#F7F5FB', '#FFFFFF', bump);

    let base = 0;
    TIERS.forEach((tier, index) => {
      const body = new THREE.Mesh(drum(tier.radius, tier.height), this.cream(tier.colour, tier.sheen, bump));
      body.position.y = base;
      this.root.add(body);

      const run = new THREE.Mesh(drips(tier.radius, 90 + index), this.cream(tier.drip, '#FFFFFF', bump));
      run.position.y = base + tier.height;
      this.root.add(run);

      // Piped border around the foot of the tier.
      const count = Math.round((Math.PI * 2 * tier.radius) / 0.19);
      const shells = new THREE.InstancedMesh(shellGeometry, shellMaterial, count);
      const pearls = new THREE.InstancedMesh(pearlGeometry, pearl, count);
      const matrix = new THREE.Matrix4();
      const rotation = new THREE.Quaternion();
      const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.12);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle + Math.PI / 2).multiply(pitch);
        matrix.compose(
          new THREE.Vector3(Math.cos(angle) * (tier.radius + 0.02), base + 0.06, Math.sin(angle) * (tier.radius + 0.02)),
          rotation,
          new THREE.Vector3(0.09, 0.09, 0.1),
        );
        shells.setMatrixAt(i, matrix);
        const offset = angle + Math.PI / count;
        const size = i % 2 ? 0.026 : 0.034;
        matrix.compose(
          new THREE.Vector3(Math.cos(offset) * (tier.radius + 0.022), base + tier.height * 0.5 - 0.03, Math.sin(offset) * (tier.radius + 0.022)),
          new THREE.Quaternion(),
          new THREE.Vector3(size, size, size),
        );
        // Swags of pearls, dipping between the drips.
        matrix.elements[13] -= Math.abs(Math.sin(offset * 8)) * 0.1 - 0.08;
        pearls.setMatrixAt(i, matrix);
      }
      pearls.userData.tiny = true;
      this.root.add(shells, pearls);
      base += tier.height;
    });

    this.cascade(random);
    shadowed(this.root);
    // Pearls and flower hearts are too small to throw a visible shadow; skip them in the shadow pass.
    this.root.traverse((child) => {
      if (child.userData.tiny) child.castShadow = false;
    });
  }

  /** Sugar flowers and leaves falling diagonally across the tiers, as a florist would set them. */
  private cascade(random: () => number): void {
    const flower = sugarFlower();
    const petal = new THREE.MeshPhysicalMaterial({ roughness: 0.5, sheen: 0.7, sheenColor: new THREE.Color('#FFFFFF') });
    const tints = ['#FBFAFD', '#CFC4EE', '#BDD5EC', '#FBFAFD', '#B7A9E4'].map((hex) => new THREE.Color(hex));
    const spots: { position: THREE.Vector3; normal: THREE.Vector3; size: number }[] = [];

    let base = 0;
    const heights = TIERS.map((tier) => {
      const value = base;
      base += tier.height;
      return value;
    });
    TIERS.forEach((tier, index) => {
      const steps = [7, 6, 5][index];
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const angle = (index === 1 ? 0.58 : index === 0 ? 1.15 : 0.1) + t * 0.95 + (random() - 0.5) * 0.14;
        const normal = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const y = heights[index] + tier.height * (0.2 + (1 - t) * 0.72);
        spots.push({
          position: normal.clone().multiplyScalar(tier.radius + 0.05).setY(y),
          normal,
          size: 0.12 + random() * 0.085,
        });
      }
    });
    // A small crown around the base of the candle.
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2;
      spots.push({
        position: new THREE.Vector3(Math.cos(angle) * 0.34, CAKE_TOP + 0.09, Math.sin(angle) * 0.34),
        normal: new THREE.Vector3(Math.cos(angle) * 0.35, 1, Math.sin(angle) * 0.35).normalize(),
        size: 0.1 + random() * 0.05,
      });
    }

    const mesh = new THREE.InstancedMesh(flower, petal, spots.length);
    const hearts = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), new THREE.MeshStandardMaterial({ color: '#F4EFD3', roughness: 0.5 }), spots.length);
    const leafShape = leafGeometry(1, 0.46);
    const leaves = new THREE.InstancedMesh(leafShape, new THREE.MeshStandardMaterial({ color: '#AFD0BC', roughness: 0.55, side: THREE.DoubleSide }), spots.length * 2);
    const matrix = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    const rotation = new THREE.Quaternion();
    const spin = new THREE.Quaternion();
    spots.forEach((spot, index) => {
      rotation.setFromUnitVectors(up, spot.normal);
      spin.setFromAxisAngle(up, random() * 6.28);
      matrix.compose(spot.position, rotation.clone().multiply(spin), new THREE.Vector3().setScalar(spot.size));
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, tints[index % tints.length]);
      matrix.compose(spot.position.clone().addScaledVector(spot.normal, spot.size * 0.15), rotation, new THREE.Vector3().setScalar(spot.size * 0.27));
      hearts.setMatrixAt(index, matrix);
      for (const side of [0, 1]) {
        const leafTurn = new THREE.Quaternion().setFromAxisAngle(spot.normal, random() * 6.28);
        const out = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), spot.normal);
        matrix.compose(spot.position, leafTurn.multiply(out), new THREE.Vector3().setScalar(spot.size * 2.2));
        leaves.setMatrixAt(index * 2 + side, matrix);
      }
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    hearts.userData.tiny = true;
    this.root.add(leaves, mesh, hearts);
  }

  /** Candlelight warms the cream a little, like light scattering through it. */
  warm(amount: number): void {
    const warmth = THREE.MathUtils.clamp(amount, 0, 1);
    // The cinematic calls this every frame, including the long stretch before
    // candlelight starts. Avoid rewriting unchanged material state in that time.
    if (Math.abs(warmth - this.warmth) < 0.001) return;
    this.warmth = warmth;
    for (const material of this.creams) {
      material.emissive.set('#F4C9A4');
      material.emissiveIntensity = warmth * 0.08;
    }
  }
}
