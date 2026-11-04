import * as THREE from 'three';
import type { Engine } from '../core/engine';
import { easeInOut, easeSoft } from '../core/tween';
import { colourTexture, drawWrapped, loadImage, makeCanvas, pageEdgeTexture, palette, softDot } from '../core/textures';
import { halo, hitBox, shadowed, slab } from './helpers';

const WIDTH = 2.7;
const HEIGHT = 3.55;
const THICKNESS = 0.62;
const BOARD = 0.075;
const LEAVES = 5;

const TAGLINE = 'A little collection of moments and memories, made just for you.';

/** The painted wreath from the 2D book, with the title lettered inside its oval. */
async function coverArt(engine: Engine): Promise<THREE.Texture> {
  const art = await loadImage('images/cover/book-cover.webp');
  const [canvas, context] = makeCanvas(1024, 1347);
  context.drawImage(art, 0, 0, 1024, 1347);
  context.textAlign = 'center';
  context.fillStyle = palette.slate;
  // Both lines share one size, small enough that the longer stays inside the wreath.
  const title = ['A Little', 'Book for You'];
  const font = (size: number) => `600 ${size}px "Cormorant Garamond", Georgia, serif`;
  context.font = font(124);
  const widest = Math.max(...title.map((line) => context.measureText(line).width));
  const size = Math.min(124, Math.floor((124 * 540) / widest));
  context.font = font(size);
  context.fillText(title[0], 512, 728 - size * 1.03);
  context.fillText(title[1], 512, 728);
  context.fillStyle = '#686A80';
  drawWrapped(context, TAGLINE, 512, 776, 430, 170, (size) => `italic 500 ${size}px "Cormorant Garamond", Georgia, serif`, 46);
  return colourTexture(engine, canvas);
}

async function endpaper(engine: Engine): Promise<THREE.Texture> {
  const [canvas, context] = makeCanvas(512, 674);
  context.fillStyle = palette.paleLavender;
  context.fillRect(0, 0, 512, 674);
  context.strokeStyle = palette.lavender;
  context.lineWidth = 3;
  context.strokeRect(34, 34, 444, 606);
  return colourTexture(engine, canvas);
}

async function firstPage(engine: Engine): Promise<THREE.Texture> {
  const sprig = await loadImage('images/cover/book-page.webp');
  const [canvas, context] = makeCanvas(512, 674);
  context.fillStyle = '#FBFAF6';
  context.fillRect(0, 0, 512, 674);
  context.drawImage(sprig, 170, 300, 330, 330);
  return colourTexture(engine, canvas);
}

export class StoryBook {
  readonly root = new THREE.Group();
  readonly hit = hitBox(WIDTH + 0.7, HEIGHT + 0.7, THICKNESS + 1);
  private readonly tilt = new THREE.Group();
  private readonly hinge = new THREE.Group();
  private readonly leaves: { pivot: THREE.Group; mesh: THREE.Mesh; base: Float32Array; bend: number }[] = [];
  private readonly glow: THREE.Sprite;
  private readonly page: THREE.Sprite;
  private readonly board: THREE.MeshStandardMaterial;
  private hover = 0;
  private hoverTarget = 0;
  private near = 0;
  private nearTarget = 0;
  /** A brief lift and lean, as a hand takes hold of the cover. */
  private stir = 0;
  private openness = 0;
  private readonly home: THREE.Vector3;

  constructor(private readonly engine: Engine, position: THREE.Vector3) {
    this.home = position.clone();
    this.root.position.copy(position);
    this.root.add(this.tilt, this.hit);
    this.board = new THREE.MeshStandardMaterial({ color: '#BDB0E3', roughness: 0.62 });
    const dot = softDot(engine);
    this.glow = halo(dot, palette.lavender, 7.5);
    this.glow.position.z = -1.2;
    this.tilt.add(this.glow);
    this.page = halo(dot, '#FFFDF6', 5);
    this.page.position.set(WIDTH * 0.25, 0, 0.7);
    this.tilt.add(this.page);
    engine.add((dt, time) => this.update(dt, time));
  }

  async build(): Promise<void> {
    const [cover, liner, opening] = await Promise.all([coverArt(this.engine), endpaper(this.engine), firstPage(this.engine)]);
    const engine = this.engine;
    const hingeX = -WIDTH / 2;
    const halfDepth = THICKNESS / 2;

    // Back board.
    const backBoard = new THREE.Mesh(slab(WIDTH, HEIGHT, BOARD, 0.09), this.board);
    backBoard.position.z = -halfDepth;
    this.tilt.add(backBoard);

    // The block of pages, with a gently hollowed fore-edge, as a sewn book has.
    const blockWidth = WIDTH - 0.13;
    const blockHeight = HEIGHT - 0.14;
    const blockDepth = THICKNESS - BOARD * 1.4;
    const block = new THREE.BoxGeometry(blockWidth, blockHeight, blockDepth, 1, 1, 12);
    const vertices = block.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) {
      if (vertices.getX(i) > 0) {
        const z = vertices.getZ(i) / (blockDepth / 2);
        vertices.setX(i, vertices.getX(i) - 0.045 * (1 - z * z));
      }
    }
    block.computeVertexNormals();
    const fore = new THREE.MeshStandardMaterial({ map: pageEdgeTexture(engine, true), roughness: 0.9 });
    const ends = new THREE.MeshStandardMaterial({ map: pageEdgeTexture(engine, false), roughness: 0.9 });
    const paper = new THREE.MeshStandardMaterial({ map: opening, roughness: 0.92 });
    const blockMesh = new THREE.Mesh(block, [fore, fore, ends, ends, paper, paper]);
    blockMesh.position.x = 0.03;
    this.tilt.add(blockMesh);

    // The rounded spine that joins the boards.
    const spineShape = new THREE.CylinderGeometry(halfDepth + BOARD * 0.55, halfDepth + BOARD * 0.55, HEIGHT, 24, 1, true, Math.PI, Math.PI);
    spineShape.scale(0.34, 1, 1);
    const spineMaterial = new THREE.MeshStandardMaterial({ color: '#B4A6DE', roughness: 0.58, side: THREE.DoubleSide });
    const spine = new THREE.Mesh(spineShape, spineMaterial);
    spine.position.x = hingeX + 0.01;
    this.tilt.add(spine);

    // A ribbon bookmark, slipped out of the foot of the book.
    const ribbonPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hingeX + 1.05, -HEIGHT / 2 + 0.1, 0.1),
      new THREE.Vector3(hingeX + 1.08, -HEIGHT / 2 - 0.16, 0.13),
      new THREE.Vector3(hingeX + 1.02, -HEIGHT / 2 - 0.36, 0.08),
      new THREE.Vector3(hingeX + 1.11, -HEIGHT / 2 - 0.58, 0.14),
    ]);
    const ribbon = new THREE.Mesh(
      new THREE.TubeGeometry(ribbonPath, 14, 0.032, 5, false),
      new THREE.MeshStandardMaterial({ color: palette.powder, roughness: 0.42 }),
    );
    ribbon.scale.z = 0.3;
    this.tilt.add(ribbon);

    // Pages that turn when the book is opened.
    const leafWidth = blockWidth - 0.06;
    for (let i = 0; i < LEAVES; i++) {
      const geometry = new THREE.PlaneGeometry(leafWidth, blockHeight - 0.02, 10, 1);
      geometry.translate(leafWidth / 2, 0, 0);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#FBFAF6', roughness: 0.9, side: THREE.DoubleSide }));
      const pivot = new THREE.Group();
      pivot.position.set(hingeX + 0.08, 0, halfDepth - BOARD * 0.7 + 0.005 + i * 0.003);
      pivot.add(mesh);
      pivot.visible = false;
      this.tilt.add(pivot);
      this.leaves.push({ pivot, mesh, base: Float32Array.from(geometry.getAttribute('position').array), bend: 0.3 + i * 0.05 });
    }

    // The front board swings on a hinge at the spine.
    this.hinge.position.set(hingeX, 0, halfDepth);
    const front = new THREE.Mesh(slab(WIDTH, HEIGHT, BOARD, 0.09), [
      new THREE.MeshStandardMaterial({ map: cover, roughness: 0.58 }),
      this.board,
    ]);
    front.position.x = WIDTH / 2;
    this.hinge.add(front);
    const inside = new THREE.Mesh(
      new THREE.PlaneGeometry(WIDTH - 0.1, HEIGHT - 0.1),
      new THREE.MeshStandardMaterial({ map: liner, roughness: 0.85 }),
    );
    inside.rotation.y = Math.PI;
    inside.position.set(WIDTH / 2, 0, -BOARD / 2 - 0.002);
    this.hinge.add(inside);
    this.tilt.add(this.hinge);

    shadowed(this.tilt);
    this.glow.castShadow = this.page.castShadow = false;
  }

  setHover(hovered: boolean): void {
    this.hoverTarget = hovered ? 1 : 0;
  }

  private setLeaf(index: number, progress: number): void {
    const leaf = this.leaves[index];
    leaf.pivot.visible = progress > 0 && progress < 1;
    leaf.pivot.rotation.y = -Math.PI * 0.985 * progress;
    const position = leaf.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const lift = Math.sin(Math.PI * progress) * leaf.bend;
    for (let i = 0; i < position.count; i++) {
      const x = leaf.base[i * 3];
      const wave = Math.sin((x / (WIDTH - 0.2)) * Math.PI);
      position.setZ(i, wave * lift);
    }
    position.needsUpdate = true;
    leaf.mesh.geometry.computeVertexNormals();
  }

  private pose(open: number): void {
    this.openness = open;
    this.hinge.rotation.y = -Math.PI * 0.97 * Math.min(open * 1.35, 1);
    this.tilt.position.x = (WIDTH / 2) * open;
    this.leaves.forEach((_, index) => {
      const start = 0.26 + index * 0.1;
      this.setLeaf(index, Math.min(Math.max((open - start) / 0.34, 0), 1));
    });
  }

  setNear(amount: number): void {
    this.nearTarget = amount;
  }

  async open(): Promise<void> {
    await this.engine.tweens.to(0.32, (t) => {
      this.stir = Math.sin(Math.PI * t);
    }, easeInOut);
    this.stir = 0;
    await this.engine.tweens.to(1.9, (t) => this.pose(t), easeInOut);
  }

  async pageGlow(seconds: number): Promise<void> {
    await this.engine.tweens.to(seconds, (t) => {
      (this.page.material as THREE.SpriteMaterial).opacity = t * 0.95;
    }, easeSoft);
  }

  /** Where the camera goes to enter the book. */
  pageCentre(target: THREE.Vector3): THREE.Vector3 {
    return this.tilt.localToWorld(target.set(WIDTH * 0.04, 0, 0.3));
  }

  close(): void {
    this.pose(0);
    (this.page.material as THREE.SpriteMaterial).opacity = 0;
  }

  private update(dt: number, time: number): void {
    if (!this.root.parent?.visible) return;
    this.hover += (this.hoverTarget - this.hover) * (1 - Math.exp(-dt * 7));
    this.near += (this.nearTarget - this.near) * (1 - Math.exp(-dt * 5));
    const calm = 1 - this.openness;
    this.root.position.y = this.home.y + Math.sin(time * 0.8) * 0.09 * calm + this.hover * 0.1 + this.stir * 0.12;
    this.tilt.rotation.y = (Math.sin(time * 0.42) * 0.09 - 0.14) * calm + this.hover * 0.1 * calm;
    this.tilt.rotation.x = (Math.sin(time * 0.57) * 0.025 - 0.05) * calm - this.stir * 0.06;
    this.tilt.rotation.z = Math.sin(time * 0.33) * 0.016 * calm;
    (this.glow.material as THREE.SpriteMaterial).opacity = Math.max(this.hover * 0.26, this.near * 0.1);
    this.board.emissive.set('#C8BCE8');
    this.board.emissiveIntensity = Math.max(this.hover * 0.14, this.near * 0.05);
  }
}
