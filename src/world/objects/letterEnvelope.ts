import * as THREE from 'three';
import { birthdayContent } from '../../data/birthdayContent';
import type { Engine } from '../core/engine';
import { easeInOut, easeOut } from '../core/tween';
import { colourTexture, drawWrapped, makeCanvas, palette } from '../core/textures';
import { hitBox, shadowed, slab } from './helpers';

const WIDTH = 2.9;
const HEIGHT = 1.95;

/** The letter is one sheet folded in half: each half is the size of the old card. */
const SHEET_WIDTH = WIDTH - 0.3;
const HALF = HEIGHT - 0.2;
/** How far the folded letter slides up out of the pocket, and how far once unfolded. */
const RISE_FOLDED = 1.2;
const RISE_OPEN = 1.32;
/** The unfolded top half leans back a touch, like paper that has been folded once. */
const OPEN_LEAN = -0.08;

const paper = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.82, side: THREE.DoubleSide });

function triangle(a: [number, number], b: [number, number], c: [number, number], depth: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(...a);
  shape.lineTo(...b);
  shape.lineTo(...c);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.004, bevelSegments: 1 });
}

/** The recipient's name, handwritten in soft ink. */
function address(engine: Engine): THREE.Texture {
  const [canvas, context] = makeCanvas(768, 176);
  context.clearRect(0, 0, 768, 176);
  context.textAlign = 'center';
  context.fillStyle = 'rgba(85, 86, 107, 0.86)';
  drawWrapped(context, `For ${birthdayContent.recipientName}`, 384, 14, 700, 150, (size) => `500 ${size}px Caveat, cursive`, 120);
  return colourTexture(engine, canvas);
}

/** A tiny pressed sprig: a curved stem, a few mint leaves and a lavender bud. */
function sprig(context: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.lineCap = 'round';
  context.strokeStyle = '#9DBFAA';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-70, 26);
  context.quadraticCurveTo(0, -6, 74, 14);
  context.stroke();
  const leaves: [number, number, number][] = [[-46, 12, -0.9], [-22, 2, 0.7], [4, -2, -0.6], [30, 2, 0.8], [52, 8, -0.5]];
  context.fillStyle = '#B9D6C4';
  for (const [lx, ly, angle] of leaves) {
    context.save();
    context.translate(lx, ly);
    context.rotate(angle);
    context.beginPath();
    context.ellipse(0, -13, 6.5, 15, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.fillStyle = palette.lavender;
  const buds: [number, number, number][] = [[80, 12, 7.5], [88, 2, 6], [92, 14, 5.5]];
  for (const [bx, by, r] of buds) {
    context.beginPath();
    context.arc(bx, by, r, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

/**
 * Plain letter paper: warm white, a faint lavender border and one small sprig
 * near the top. The words live only in the full letter, never on the paper that
 * shows in the envelope. The sheet is cut into its top and bottom halves so the
 * fold falls between them.
 */
function letterFaces(engine: Engine): { top: THREE.Texture; bottom: THREE.Texture; textEnd: number } {
  const width = 1024;
  const half = Math.round((width * HALF) / SHEET_WIDTH);
  const [sheet, context] = makeCanvas(width, half * 2);
  context.fillStyle = '#FBF8F2';
  context.fillRect(0, 0, width, half * 2);

  context.strokeStyle = 'rgba(200, 188, 232, 0.6)';
  context.lineWidth = 4;
  context.strokeRect(40, 40, width - 80, half * 2 - 80);

  sprig(context, width / 2, 210, 1.3);

  const top = makeCanvas(width, half);
  top[1].drawImage(sheet, 0, 0, width, half, 0, 0, width, half);
  const bottom = makeCanvas(width, half);
  bottom[1].drawImage(sheet, 0, half, width, half, 0, 0, width, half);
  // The part of the paper that small screens keep clear of their controls, as a
  // fraction of the sheet from its top. It is where the old preview lines ended,
  // so the framing on phones stays exactly as it was.
  return { top: colourTexture(engine, top[0]), bottom: colourTexture(engine, bottom[0]), textEnd: 0.82 };
}

/** One half of the sheet: printed on the front, plain paper behind. */
function sheetHalf(face: THREE.Texture, back: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(SHEET_WIDTH, HALF);
  const front = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: face, roughness: 0.85 }));
  const rear = new THREE.Mesh(geometry, back);
  rear.rotation.y = Math.PI;
  rear.position.z = -0.003;
  group.add(front, rear);
  return group;
}

/**
 * The birthday envelope: a flap on a hinge, a pocket, and a folded letter that
 * really slides out. Once read, the letter stays out and unfolded on the stand.
 */
export class LetterEnvelope {
  readonly root = new THREE.Group();
  readonly hit = hitBox(WIDTH + 0.5, HEIGHT + 0.6, 0.9);
  private readonly body = new THREE.Group();
  private readonly flap = new THREE.Group();
  /** The letter: its bottom half, and the top half on the fold line. */
  private readonly letter = new THREE.Group();
  private readonly fold = new THREE.Group();
  private appear = 0;
  private hover = 0;
  private hoverTarget = 0;
  private near = 0;
  private nearTarget = 0;
  /** 0 in its place, 1 tucked away (shrunk out of sight) while the surprise has the stage. */
  private aside = 0;
  private asideTarget = 0;
  private readonly home = new THREE.Vector3();
  opened = false;
  unfolded = false;
  /**
   * Once unfolded, in the envelope's own units: the top edge of the paper, the
   * bottom of the last line of writing, half the envelope's width, and a line just
   * below the point of the pocket. Used to keep the preview readable.
   */
  readonly preview: { top: number; textBottom: number; halfWidth: number; mouth: number };

  constructor(private readonly engine: Engine) {
    const halfW = WIDTH / 2;
    const halfH = HEIGHT / 2;

    const back = new THREE.Mesh(slab(WIDTH, HEIGHT, 0.03, 0.03), paper('#DAD3EF'));
    back.position.z = -0.05;
    this.body.add(back);

    // The letter waits inside, folded in half with its top half tucked behind.
    const faces = letterFaces(engine);
    const sheetTop = RISE_OPEN + HALF / 2 + HALF;
    this.preview = { top: sheetTop, textBottom: sheetTop - faces.textEnd * HALF * 2, halfWidth: WIDTH / 2, mouth: -0.15 };
    const plain = new THREE.MeshStandardMaterial({ color: '#F6F5F1', roughness: 0.85 });
    const lower = sheetHalf(faces.bottom, plain);
    const upper = sheetHalf(faces.top, plain);
    upper.position.y = HALF / 2;
    this.fold.add(upper);
    this.fold.position.set(0, HALF / 2, -0.006);
    this.fold.rotation.x = Math.PI;
    this.letter.add(lower, this.fold);
    this.letter.position.z = -0.008;
    this.body.add(this.letter);

    // The pocket is folded from three real panels.
    const side = paper('#EFEBF8');
    const left = new THREE.Mesh(triangle([-halfW, -halfH], [-halfW, halfH], [0.03, -0.04], 0.01), side);
    const right = new THREE.Mesh(triangle([halfW, -halfH], [-0.03, -0.04], [halfW, halfH], 0.01), side);
    const bottom = new THREE.Mesh(triangle([-halfW, -halfH], [0, 0.05], [halfW, -halfH], 0.012), paper('#F4F1FA'));
    left.position.z = right.position.z = 0.006;
    bottom.position.z = 0.018;
    this.body.add(left, right, bottom);

    // Written on the bottom panel of the pocket, clear of every seam: at this
    // height the panel is about 1.9 wide, and the name takes 1.3 of it.
    const name = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.3),
      new THREE.MeshBasicMaterial({ map: address(engine), transparent: true, depthWrite: false, toneMapped: false }),
    );
    name.position.set(0, -0.64, 0.036);
    this.body.add(name);

    // The flap hangs from the top edge on a hinge.
    this.flap.position.set(0, halfH, 0.03);
    const flapFold = new THREE.Mesh(triangle([-halfW, 0], [0, -1.16], [halfW, 0], 0.01), paper('#E4DDF3'));
    this.flap.add(flapFold);
    // A powder-blue lining inside the flap, seen once the envelope is open.
    const lining = new THREE.Shape();
    lining.moveTo(-halfW + 0.14, -0.03);
    lining.lineTo(0, -1.0);
    lining.lineTo(halfW - 0.14, -0.03);
    lining.closePath();
    const liner = new THREE.Mesh(
      new THREE.ShapeGeometry(lining),
      new THREE.MeshStandardMaterial({ color: '#DCE8F4', roughness: 0.85, side: THREE.DoubleSide }),
    );
    liner.position.z = -0.003;
    this.flap.add(liner);
    // A floral wax seal: a soft disc pressed with five petals and a pearl heart.
    const wax = new THREE.MeshStandardMaterial({ color: '#A998DC', roughness: 0.34 });
    const petalWax = new THREE.MeshStandardMaterial({ color: '#BBAEE6', roughness: 0.38 });
    const seal = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.045, 28), wax);
    disc.rotation.x = Math.PI / 2;
    seal.add(disc);
    const petalGeometry = new THREE.SphereGeometry(0.06, 12, 8);
    for (let n = 0; n < 5; n++) {
      const angle = (n / 5) * Math.PI * 2 + Math.PI / 2;
      const petal = new THREE.Mesh(petalGeometry, petalWax);
      petal.scale.set(0.85, 1.25, 0.32);
      petal.position.set(Math.cos(angle) * 0.075, Math.sin(angle) * 0.075, 0.03);
      petal.rotation.z = angle - Math.PI / 2;
      seal.add(petal);
    }
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 10), new THREE.MeshStandardMaterial({ color: '#F7F3EC', roughness: 0.25 }));
    pearl.position.z = 0.045;
    seal.add(pearl);
    seal.position.set(0, -1.1, 0.04);
    this.flap.add(seal);

    // A small pressed sprig above the seal, on the flap.
    const [sprigCanvas, sprigContext] = makeCanvas(320, 128);
    sprig(sprigContext, 160, 70, 1.25);
    const sprigMark = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.25),
      new THREE.MeshStandardMaterial({ map: colourTexture(engine, sprigCanvas), transparent: true, depthWrite: false, roughness: 0.8 }),
    );
    sprigMark.position.set(0, -0.78, 0.021);
    this.flap.add(sprigMark);
    this.body.add(this.flap);

    this.root.add(this.body, this.hit);
    shadowed(this.body);
    name.castShadow = false;
    sprigMark.castShadow = false;
    this.root.visible = false;
    engine.add((dt, time) => this.update(dt, time));
  }

  place(position: THREE.Vector3, scale: number, lookAt: THREE.Vector3): void {
    this.home.copy(position);
    this.root.position.copy(position);
    this.root.scale.setScalar(scale);
    this.root.lookAt(lookAt);
  }

  /** Moves to a new resting place smoothly, instead of jumping there. */
  async glide(position: THREE.Vector3, scale: number, lookAt: THREE.Vector3, seconds = 1.2): Promise<void> {
    const fromPosition = this.home.clone();
    const fromScale = this.root.scale.x;
    const fromQuaternion = this.root.quaternion.clone();
    this.place(position, scale, lookAt);
    const toQuaternion = this.root.quaternion.clone();
    await this.engine.tweens.to(this.engine.reducedMotion ? 0.01 : seconds, (t) => {
      this.home.lerpVectors(fromPosition, position, t);
      this.root.position.copy(this.home);
      this.root.scale.setScalar(fromScale + (scale - fromScale) * t);
      this.root.quaternion.slerpQuaternions(fromQuaternion, toQuaternion, t);
    }, easeInOut);
  }

  /** Where it rests, without the drift and hover added each frame. */
  restingSpot(): THREE.Vector3 {
    return this.home.clone();
  }

  setNear(amount: number): void {
    this.nearTarget = amount;
  }

  setHover(hovered: boolean): void {
    this.hoverTarget = hovered ? 1 : 0;
  }

  /** It drifts down into view once the candle is lit. */
  async reveal(): Promise<void> {
    this.root.visible = true;
    await this.engine.tweens.to(1.6, (t) => {
      this.appear = t;
    }, easeOut);
  }

  /** The flap lifts and the folded letter slides up out of the pocket. */
  async open(): Promise<void> {
    if (this.opened) return;
    this.opened = true;
    await this.engine.tweens.to(0.85, (t) => {
      this.flap.rotation.x = Math.PI * 0.96 * t;
      // Past halfway, the flap passes behind the letter.
      this.flap.position.z = t > 0.5 ? -0.03 : 0.03;
    }, easeInOut);
    await this.engine.tweens.to(0.95, (t) => {
      this.letter.position.y = t * RISE_FOLDED;
    }, easeInOut);
  }

  /** The top half opens on its fold, so the first lines can be read on the stand. */
  async unfold(): Promise<void> {
    if (this.unfolded) return;
    this.unfolded = true;
    // The open letter stands taller than the envelope; so must the area that can be tapped.
    const top = RISE_OPEN + HALF * 1.5;
    this.hit.scale.y = (top + HEIGHT / 2 + 0.3) / (HEIGHT + 0.6);
    this.hit.position.y = (top - HEIGHT / 2) / 2;
    const seconds = this.engine.reducedMotion ? 0.01 : 1.2;
    await this.engine.tweens.to(seconds, (t) => {
      this.letter.position.y = RISE_FOLDED + (RISE_OPEN - RISE_FOLDED) * t;
      this.fold.rotation.x = Math.PI + (OPEN_LEAN - Math.PI) * t;
      // While it swings over, the top half moves clear of the bottom half.
      this.fold.position.z = -0.006 + Math.sin(Math.PI * t) * 0.12;
    }, easeInOut);
    this.fold.position.z = 0.004;
  }

  isVisible(): boolean {
    return this.root.visible;
  }

  /**
   * Tucks the envelope out of the camera's way, or brings it back. Used on tall screens,
   * where it stands in front of the cake, while the surprise plays.
   */
  setAside(aside: boolean): void {
    this.asideTarget = aside ? 1 : 0;
    if (this.engine.reducedMotion) this.aside = this.asideTarget;
    this.engine.invalidate();
  }

  private update(dt: number, time: number): void {
    if (!this.root.visible) return;
    if (this.aside !== this.asideTarget) {
      const step = Math.min(Math.max(dt, 1 / 60) / 0.45, 1);
      this.aside = this.asideTarget > this.aside ? Math.min(this.aside + step, 1) : Math.max(this.aside - step, 0);
    }
    const tucked = Math.max(1 - this.aside * this.aside * (3 - 2 * this.aside), 0.001);
    if (this.body.scale.x !== tucked) this.body.scale.setScalar(tucked);
    this.body.visible = this.aside < 1;
    this.hover += (this.hoverTarget - this.hover) * (1 - Math.exp(-dt * 7));
    this.near += (this.nearTarget - this.near) * (1 - Math.exp(-dt * 5));
    // It drifts down and comes to rest on its stand; only a gentle sway remains.
    this.root.position.y = this.home.y + (1 - this.appear) * 2.4 + this.hover * 0.1;
    this.body.position.z = Math.max(this.hover * 0.22, this.near * 0.06);
    // An open letter is read, so it sways less.
    const sway = this.unfolded ? 0.4 : 1;
    this.body.rotation.y = Math.sin(time * 0.45) * 0.05 * sway;
    this.body.rotation.z = Math.sin(time * 0.6) * 0.012 * sway;
  }
}
