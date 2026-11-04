import * as THREE from 'three';
import { memoryImage } from '../../components/MemoryCard';
import type { Memory } from '../../data/birthdayContent';
import type { Engine } from '../core/engine';
import { seeded } from '../core/noise';
import { groundHeight } from '../env/terrain';
import { colourTexture, makeCanvas } from '../core/textures';
import { halo, hitBox, leafGeometry, roundedRect, shadowed, slab } from './helpers';

const OUTER = 2.5;
const OPENING = 1.92;
const DEPTH = 0.2;
export const FRAME_SIZE = OUTER + 0.2;

const FINISHES = [
  { frame: '#C8BCE8', mat: '#F2EEFA' },
  { frame: '#B9D1E8', mat: '#EEF4FA' },
  { frame: '#BFD8C5', mat: '#EEF6F0' },
];

function loadPicture(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

/** The whole photograph at its own proportions: never cropped, so no face is cut off. */
async function picture(engine: Engine, memory: Memory): Promise<{ texture: THREE.Texture; aspect: number }> {
  const size = engine.tier.name === 'high' ? 1024 : 768;
  const image = await loadPicture(memoryImage(memory).src);
  const aspect = image.naturalWidth / image.naturalHeight;
  const width = aspect >= 1 ? size : Math.round(size * aspect);
  const height = aspect >= 1 ? Math.round(size / aspect) : size;
  const [canvas, context] = makeCanvas(width, height);
  context.drawImage(image, 0, 0, width, height);
  return { texture: colourTexture(engine, canvas), aspect };
}

/** A real frame: moulded profile, recessed mat, photograph and backing. */
export class PhotoFrame {
  readonly root = new THREE.Group();
  readonly hit = hitBox(OUTER + 0.2, OUTER + 0.2, 0.8);
  private readonly body = new THREE.Group();
  private readonly glow: THREE.Sprite;
  private readonly finish: THREE.MeshStandardMaterial;
  private hover = 0;
  private hoverTarget = 0;
  private near = 0;
  private nearTarget = 0;
  private readonly phase: number;
  private readonly home = new THREE.Vector3();
  private lean = 0;
  scale = 1;
  /** A slim painted post from the lawn, standing in the world rather than in the frame. */
  readonly post: THREE.Group;

  constructor(private readonly engine: Engine, private readonly memory: Memory, private readonly index: number, dot: THREE.Texture) {
    const tone = FINISHES[index % FINISHES.length];
    this.phase = index * 1.7;
    this.finish = new THREE.MeshStandardMaterial({ color: tone.frame, roughness: 0.42, metalness: 0.02, emissive: tone.frame, emissiveIntensity: 0 });

    const shape = roundedRect(OUTER, OUTER, 0.14);
    const hole = new THREE.Path();
    const half = (OPENING + 0.1) / 2;
    hole.moveTo(-half, -half);
    hole.lineTo(-half, half);
    hole.lineTo(half, half);
    hole.lineTo(half, -half);
    hole.lineTo(-half, -half);
    shape.holes.push(hole);
    const moulding = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: DEPTH - 0.1, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 4, curveSegments: 8 }),
      this.finish,
    );
    moulding.position.z = -DEPTH / 2 + 0.05;
    this.body.add(moulding);

    const backing = new THREE.Mesh(slab(OUTER - 0.1, OUTER - 0.1, 0.05, 0.1), new THREE.MeshStandardMaterial({ color: '#E8E4F2', roughness: 0.8 }));
    backing.position.z = -DEPTH / 2 + 0.02;
    this.body.add(backing);

    const mat = new THREE.Mesh(new THREE.PlaneGeometry(OPENING + 0.12, OPENING + 0.12), new THREE.MeshStandardMaterial({ color: tone.mat, roughness: 0.9 }));
    mat.position.z = -DEPTH / 2 + 0.052;
    this.body.add(mat);

    this.glow = halo(dot, tone.frame, 6);
    this.glow.position.z = -0.7;
    this.body.add(this.glow);
    this.body.add(this.sprig());

    this.root.add(this.body, this.hit);
    shadowed(this.body);
    this.post = this.makePost(tone.frame);
    this.glow.castShadow = false;
    engine.add((dt, time) => this.update(dt, time));
  }

  private makePost(colour: string): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.5 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 1, 12), material);
    pole.position.y = 0.5;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.09, 18), material);
    group.add(pole, foot);
    group.userData.pole = pole;
    return shadowed(group);
  }

  /** A little bough tucked behind one corner, so each frame feels placed by hand. */
  private sprig(): THREE.Group {
    const random = seeded(this.index + 40);
    const sprig = new THREE.Group();
    const geometry = leafGeometry(0.4, 0.17);
    const material = new THREE.MeshStandardMaterial({ color: '#A9CDBB', roughness: 0.7, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(geometry, material);
      leaf.position.set(i * 0.1, i * -0.03, 0.02 + random() * 0.03);
      leaf.rotation.z = -0.9 + (i % 2 ? 1.5 : 0) + (random() - 0.5) * 0.4;
      sprig.add(leaf);
    }
    const corner = this.index % 2 ? 1 : -1;
    sprig.position.set((corner * OUTER) / 2 - (corner > 0 ? 0.55 : -0.0), OUTER / 2 + 0.03, DEPTH / 2);
    return sprig;
  }

  async build(): Promise<void> {
    const { texture, aspect } = await picture(this.engine, this.memory);
    // Fit the whole photograph inside the square opening; the mat shows around it.
    const fit = OPENING * 0.94;
    const width = aspect >= 1 ? fit : fit * aspect;
    const height = aspect >= 1 ? fit / aspect : fit;
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55 }));
    photo.position.z = -DEPTH / 2 + 0.06;
    photo.receiveShadow = true;
    this.body.add(photo);
  }

  place(position: THREE.Vector3, scale: number, lookAt: THREE.Vector3): void {
    this.home.copy(position);
    this.scale = scale;
    this.root.position.copy(position);
    this.root.scale.setScalar(scale);
    this.root.lookAt(lookAt);
    this.lean = (this.index % 2 ? 1 : -1) * 0.035;
    // The post stands just behind the frame and meets its back.
    const back = new THREE.Vector3(position.x - lookAt.x, 0, position.z - lookAt.z).normalize().multiplyScalar((DEPTH / 2 + 0.1) * scale);
    const x = position.x + back.x;
    const z = position.z + back.z;
    const ground = groundHeight(x, z);
    const height = Math.max(position.y - (OUTER / 2 - 0.2) * scale - ground, 0.01);
    this.post.position.set(x, ground, z);
    this.post.scale.setScalar(scale * 1.2);
    (this.post.userData.pole as THREE.Mesh).scale.y = height / (scale * 1.2);
    (this.post.userData.pole as THREE.Mesh).position.y = height / (scale * 1.2) / 2;
  }

  setNear(amount: number): void {
    this.nearTarget = amount;
  }

  setHover(hovered: boolean): void {
    this.hoverTarget = hovered ? 1 : 0;
  }

  /** Where the camera stands to look straight at this frame. */
  standpoint(distance: number): THREE.Vector3 {
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.root.quaternion);
    return this.home.clone().addScaledVector(forward, distance * this.scale);
  }

  centre(): THREE.Vector3 {
    return this.home.clone();
  }

  private update(dt: number, time: number): void {
    if (!this.root.parent?.parent?.visible) return;
    this.hover += (this.hoverTarget - this.hover) * (1 - Math.exp(-dt * 7));
    this.body.position.y = Math.sin(time * 0.7 + this.phase) * 0.05;
    this.body.position.z = this.hover * 0.55;
    this.body.rotation.y = Math.sin(time * 0.4 + this.phase) * 0.028 + this.hover * 0.1;
    this.body.rotation.x = -this.hover * 0.045;
    this.body.rotation.z = this.lean * (1 - this.hover);
    this.near += (this.nearTarget - this.near) * (1 - Math.exp(-dt * 5));
    this.finish.emissiveIntensity = Math.max(this.hover * 0.24, this.near * 0.08);
    (this.glow.material as THREE.SpriteMaterial).opacity = Math.max(this.hover * 0.34, this.near * 0.12);
  }
}
