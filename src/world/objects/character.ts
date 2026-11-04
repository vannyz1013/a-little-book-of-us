import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The two friends, as storybook figures built from code.
 *
 * Faces and hair follow the memory photographs and approved storybook direction:
 * gently stylized four-head proportions, clean skin, and layered pastel clothes
 * with lace and embroidery. Each figure is made of a few
 * rigid pieces (skirt, torso, head, eyes and arms); every piece is merged into
 * one mesh per surface, coloured per vertex. Built once per design and shared.
 */

export type CharacterName = 'munYi' | 'ziNor';

type Surface = 'cloth' | 'skin' | 'gloss' | 'metal' | 'hair' | 'jewel';
type Colour = string | ((x: number, y: number, z: number) => string);

interface Design {
  skin: string;
  hair: string;
  /** Overall size; Zi Nor is a touch taller. */
  scale: number;
  /** Face width and how much the chin narrows (Mun Yi's face is a little more oval). */
  faceWidth: number;
  chinTaper: number;
  hair_style: 'bob' | 'long';
  glasses: 'roundedRectangle' | 'hexagon';
  glassesColour: string;
  smileWidth: number;
  outfit: 'princess' | 'friend';
  beautyMark?: boolean;
}

const DESIGNS: Record<CharacterName, Design> = {
  // Long centre-parted hair and the fine gold hexagonal glasses in her photos.
  munYi: {
    skin: '#F7E0CF',
    hair: '#251E23',
    scale: 1,
    faceWidth: 1.0,
    chinTaper: 0.12,
    hair_style: 'long',
    glasses: 'hexagon',
    glassesColour: '#C8A96D',
    smileWidth: 0.09,
    outfit: 'princess',
  },
  // The softly rounded jaw-length bob and wider rose-gold glasses from her photos.
  ziNor: {
    skin: '#F6DECC',
    hair: '#251E23',
    scale: 1.03,
    faceWidth: 1.06,
    chinTaper: 0.06,
    hair_style: 'bob',
    glasses: 'roundedRectangle',
    glassesColour: '#C49B82',
    smileWidth: 0.095,
    outfit: 'friend',
    beautyMark: true,
  },
};

const PALETTE = {
  lavender: '#C9BCEB',
  deepLavender: '#AE9EDD',
  powder: '#B7D1EF',
  deepPowder: '#8FAED4',
  ivory: '#F7F1E6',
  lace: '#FFFAF2',
  sage: '#B3CDB6',
  deepSage: '#97B79F',
  leaf: '#A7C8B0',
  blush: '#EFBFB3',
  lip: '#B96F7B',
  champagne: '#D6B778',
  pearl: '#FFF8EA',
  silver: '#E8EDF4',
  crystal: '#C7B3F0',
  blueCrystal: '#AFCFF2',
  eye: '#3A2A30',
  white: '#FFFFFF',
};

// ---------------------------------------------------------------------------
// Pieces: parts are baked into their piece's space with a colour per vertex.

class Piece {
  readonly parts = new Map<Surface, THREE.BufferGeometry[]>();

  add(geometry: THREE.BufferGeometry, colour: Colour, surface: Surface = 'cloth', matrix?: THREE.Matrix4): void {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    // Colour is decided in the part's own space, before it is placed.
    const position = g.getAttribute('position');
    const count = position.count;
    const colours = new Float32Array(count * 3);
    const fixed = typeof colour === 'string' ? new THREE.Color(colour) : null;
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      if (fixed) c.copy(fixed);
      else c.set((colour as Exclude<Colour, string>)(position.getX(i), position.getY(i), position.getZ(i)));
      colours[i * 3] = c.r;
      colours[i * 3 + 1] = c.g;
      colours[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    if (matrix) g.applyMatrix4(matrix);
    g.clearGroups();
    const list = this.parts.get(surface) ?? [];
    list.push(g);
    this.parts.set(surface, list);
  }

  merged(): Map<Surface, THREE.BufferGeometry> {
    const out = new Map<Surface, THREE.BufferGeometry>();
    for (const [surface, list] of this.parts) {
      const g = mergeGeometries(list, false)!;
      g.computeBoundingSphere();
      out.set(surface, g);
      list.forEach((part) => part.dispose());
    }
    return out;
  }
}

const place = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const ellipsoid = (rx: number, ry: number, rz: number, w = 20, h = 14) => new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz);
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// ---- Fabric ----

interface Tier {
  /** Radius and height pairs, from the waist down. */
  profile: [number, number][];
  folds: number;
  depth: number;
  /** Pointed "handkerchief" hem: how many points, and how deep. */
  points?: number;
  pointDepth?: number;
  colour: string;
  /** How far up from the hem the lace band reaches. */
  lace: number;
  /** Scallop frequency and thread tone distinguish the separate hems. */
  scallops?: number;
  laceColor?: string;
}

/** The folds and hem points of a tier at an angle and a depth into it (t = 0 at the waist, 1 at the hem). */
function tierShape(tier: Tier, angle: number, t: number): { scale: number; drop: number } {
  // A few broad, low-amplitude folds read as cloth; many sharp radial waves read
  // as a striped cone. Keep the waist smooth and let the folds grow toward hem.
  // Let the crease drift as the cloth falls; fixed phase produced perfectly
  // vertical grooves that looked like a fluted cone.
  // LatheGeometry stores ring heights as float32, so its top ring can be a few
  // ulps above the profile top. Clamp before the fractional power to avoid NaNs.
  const progress = THREE.MathUtils.clamp(t, 0, 1);
  const phase = progress * 1.65 + Math.sin(angle * 2.1) * 0.11;
  const fold = Math.sin(angle * tier.folds + phase) * tier.depth * Math.pow(progress, 1.45)
    + Math.sin(angle * tier.folds * 1.72 - phase * 1.4) * tier.depth * 0.28 * progress;
  const rearWeight = smoothstep(0.35, -0.12, Math.cos(angle));
  const rearFold = Math.sin(angle * tier.folds * 0.76 + phase * 1.8 + Math.sin(angle * 2.3 + phase) * 0.22)
    * tier.depth * 0.34 * rearWeight * Math.pow(progress, 1.25);
  const rearDrape = Math.sin(angle * 2.15 + phase * 1.25 + Math.sin(angle * 1.4) * 0.32)
    * tier.depth * 0.12 * rearWeight * Math.pow(progress, 1.6);
  const point = tier.points ? Math.pow(Math.abs(Math.cos((angle * tier.points) / 2)), 3) * (tier.pointDepth ?? 0) : 0;
  return { scale: 1 + fold + rearFold + rearDrape, drop: point * Math.pow(progress, 6) };
}

function profileAt(profile: [number, number][], y: number): number {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1];
    const [r1, y1] = profile[i];
    if (y <= y0 && y >= y1) {
      const t = (y0 - y) / (y0 - y1 || 1);
      const rPrev = profile[Math.max(i - 2, 0)][0];
      const rNext = profile[Math.min(i + 1, profile.length - 1)][0];
      const t2 = t * t;
      const t3 = t2 * t;
      // Catmull-Rom across each interval smooths the silhouette while retaining
      // the hand-shaped waist, hip and hem landmarks.
      return 0.5 * ((2 * r0) + (-rPrev + r1) * t + (2 * rPrev - 5 * r0 + 4 * r1 - rNext) * t2 + (-rPrev + 3 * r0 - 3 * r1 + rNext) * t3);
    }
  }
  return profile[profile.length - 1][0];
}

function tierColour(tier: Tier, x: number, y: number, z: number): string {
  const top = tier.profile[0][1];
  const bottom = tier.profile[tier.profile.length - 1][1];
  const t = Math.min(Math.max((top - y) / (top - bottom || 1), 0), 1);
  const angle = Math.atan2(x, z);
  const fold = Math.sin(angle * tier.folds + t * 1.65) * 0.5 + 0.5;
  const softLight = 0.93 + 0.045 * fold + 0.02 * (0.5 + 0.5 * Math.cos(angle * 2.2 - t * 2.3));
  return `#${new THREE.Color(tier.colour).multiplyScalar(softLight).getHexString()}`;
}

/** Raised, softly folded fabric panels over a continuous skirt lining. */
function addDrapePanels(piece: Piece, tier: Tier): void {
  const count = Math.max(6, tier.folds);
  const across = 10;
  const down = 32;
  const span = (Math.PI * 2) / count;
  const top = tier.profile[0][1];
  const bottom = tier.profile[tier.profile.length - 1][1];
  for (let panel = 0; panel < count; panel++) {
    const center = (panel / count) * Math.PI * 2;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let row = 0; row <= down; row++) {
      const t = row / down;
      const yBase = top + (bottom - top) * t;
      for (let col = 0; col <= across; col++) {
        const u = col / across;
        const q = u * 2 - 1;
        const angle = center + q * span * 0.5;
        const shape = tierShape(tier, angle, t);
        const ridge = Math.pow(Math.max(Math.cos(q * Math.PI * 0.5), 0), 3) * tier.depth * 0.72 * Math.sin(t * Math.PI * 0.78);
        const softFold = Math.sin(t * Math.PI * 1.5 + panel * 0.7 + q * 1.2) * tier.depth * 0.16 * t;
        const radius = profileAt(tier.profile, yBase) * shape.scale + 0.007 + ridge + softFold;
        const hemDrape = 0.012 * (1 - q * q) * Math.pow(t, 5) * Math.sin(panel * 1.4 + 0.6);
        positions.push(Math.sin(angle) * radius, yBase - shape.drop - hemDrape, Math.cos(angle) * radius);
        uvs.push(u, t);
      }
    }
    for (let row = 0; row < down; row++) {
      for (let col = 0; col < across; col++) {
        const a = row * (across + 1) + col;
        const b = a + across + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const panelGeometry = new THREE.BufferGeometry();
    panelGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    panelGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    panelGeometry.setIndex(indices);
    panelGeometry.computeVertexNormals();
    piece.add(panelGeometry, (x, y, z) => tierColour(tier, x, y, z));
  }
}

/** A skirt layer with a shaped lining, draped outer panels, lace and a fine rolled hem. */
function addTier(piece: Piece, tier: Tier, segments = 80): void {
  const top = tier.profile[0][1];
  const bottom = tier.profile[tier.profile.length - 1][1];
  // Dense, smoothly interpolated cross-sections keep the A-line profile from
  // reading as stacked straight cones.
  const rings: THREE.Vector2[] = [];
  const verticalSegments = 36;
  for (let i = 0; i <= verticalSegments; i++) {
    const y = top + (bottom - top) * (i / verticalSegments);
    rings.push(new THREE.Vector2(Math.max(0.01, profileAt(tier.profile, y)), y));
  }
  const g = new THREE.LatheGeometry(rings, segments);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const t = THREE.MathUtils.clamp((top - y) / (top - bottom || 1), 0, 1);
    const shape = tierShape(tier, Math.atan2(x, z), t);
    p.setXYZ(i, x * shape.scale, y - shape.drop, z * shape.scale);
  }
  g.computeVertexNormals();
  piece.add(g, (x, y, z) => tierColour(tier, x, y, z));
  addDrapePanels(piece, tier);

  // A band of lace laid along the hem, following its points, with a scalloped edge.
  const around = segments * 2;
  const rows = 4;
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let k = 0; k <= around; k++) {
    const angle = (k / around) * Math.PI * 2;
    const hem = bottom;
    for (let r = 0; r <= rows; r++) {
      const f = r / rows;
      // The bottom row dips into little scallops.
      const scallop = r === 0 ? (0.5 - 0.5 * Math.cos(angle * (tier.scallops ?? tier.folds * 3))) * 0.01 : 0;
      const y = hem + tier.lace * f - scallop;
      const point = onTier(tier, angle, Math.min(y, top - 0.01), 0.02 + 0.002 * (1 - f));
      positions.push(point.x, point.y, point.z);
      uvs.push(k / around, f);
    }
  }
  const indices: number[] = [];
  for (let k = 0; k < around; k++) {
    for (let r = 0; r < rows; r++) {
      const a = k * (rows + 1) + r;
      const b = (k + 1) * (rows + 1) + r;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const band = new THREE.BufferGeometry();
  band.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  band.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  band.setIndex(indices);
  band.computeVertexNormals();
  const laceColor = tier.laceColor ?? PALETTE.lace;
  piece.add(band, laceColor);

  // A fine thread line defines the top of the lace insert without adding a
  // heavy cord around the entire skirt.
  const thread: THREE.Vector3[] = [];
  for (let k = 0; k < segments; k++) {
    const angle = (k / segments) * Math.PI * 2;
    thread.push(onTier(tier, angle, bottom + tier.lace * 0.76, 0.023));
  }
  piece.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(thread, true), segments * 2, 0.0018, 4, true), laceColor);

  // A rolled hem gives the cloth an edge with thickness.
  const edge: THREE.Vector3[] = [];
  for (let k = 0; k < segments; k++) {
    const angle = (k / segments) * Math.PI * 2;
    const shape = tierShape(tier, angle, 1);
    const r = tier.profile[tier.profile.length - 1][0] * shape.scale + 0.004;
    const scallop = (0.5 - 0.5 * Math.cos(angle * (tier.scallops ?? tier.folds * 3))) * 0.01;
    edge.push(new THREE.Vector3(Math.sin(angle) * (r + 0.008), bottom - shape.drop - scallop, Math.cos(angle) * (r + 0.008)));
  }
  piece.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, true), segments * 2, 0.005, 6, true), PALETTE.lace);
}

/** A point on a tier's surface, a little proud of it. */
function onTier(tier: Tier, angle: number, y: number, lift = 0.008, draped = false): THREE.Vector3 {
  const top = tier.profile[0][1];
  const bottom = tier.profile[tier.profile.length - 1][1];
  const t = (top - y) / (top - bottom);
  const shape = tierShape(tier, angle, t);
  let r = profileAt(tier.profile, y) * shape.scale;
  if (draped) {
    const count = Math.max(6, tier.folds);
    const span = (Math.PI * 2) / count;
    const normalized = (angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const panel = Math.floor(normalized / span);
    const q = ((normalized - panel * span) / span) * 2 - 1;
    const ridge = Math.pow(Math.max(Math.cos(q * Math.PI * 0.5), 0), 3) * tier.depth * 0.72 * Math.sin(t * Math.PI * 0.78);
    const softFold = Math.sin(t * Math.PI * 1.5 + panel * 0.7 + q * 1.2) * tier.depth * 0.16 * t;
    r += 0.007 + ridge + softFold;
  }
  r += lift;
  return new THREE.Vector3(Math.sin(angle) * r, y - shape.drop, Math.cos(angle) * r);
}

/** A five-petalled flower, flat, facing +z. */
function flower(radius: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    const r = radius * (0.5 + 0.5 * Math.abs(Math.cos(a * 2.5)));
    const x = Math.sin(a) * r;
    const y = Math.cos(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return new THREE.ShapeGeometry(shape, 1);
}

/** A softly tapered almond silhouette for the eye white. */
function almondEye(width: number, height: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.5, 0);
  shape.bezierCurveTo(-width * 0.24, height * 0.58, width * 0.24, height * 0.58, width * 0.5, 0);
  shape.bezierCurveTo(width * 0.24, -height * 0.43, -width * 0.24, -height * 0.43, -width * 0.5, 0);
  shape.closePath();
  return new THREE.ShapeGeometry(shape, 20);
}

const leaf = (length: number) => ellipsoid(length * 0.32, length * 0.5, 0.002, 10, 6);

/** A band of embroidery around a tier: little flowers with leaves. */
function embroider(piece: Piece, tier: Tier, y: number, count: number, colours: string[], size = 0.028): void {
  const bloom = flower(size);
  const heart = flower(size * 0.35);
  const sprig = leaf(size * 1.4);
  for (let n = 0; n < count; n++) {
    const angle = (n / count) * Math.PI * 2 + 0.13;
    const wave = Math.sin(n * 1.7) * 0.02;
    const at = onTier(tier, angle, y + wave, 0.006, true);
    piece.add(bloom, colours[n % colours.length], 'cloth', place(at.x, at.y, at.z, 0, angle, n * 0.6));
    const inner = onTier(tier, angle, y + wave, 0.011, true);
    piece.add(heart, '#F3E2A9', 'cloth', place(inner.x, inner.y, inner.z, 0, angle, 0));
    for (const side of [-1, 1]) {
      const l = onTier(tier, angle + side * 0.075, y + wave - 0.012, 0.006, true);
      piece.add(sprig, PALETTE.leaf, 'cloth', place(l.x, l.y, l.z, 0, angle, side * 1.1));
    }
  }
}

/** A tube whose radius narrows from start to end, optionally flattened front to back. */
function taperedTube(points: THREE.Vector3[], from: number, to: number, flat = 1, segments = 24): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const radial = 10;
  const g = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const p = g.getAttribute('position');
  const centre = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, centre);
    const r = from + (to - from) * t;
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      p.setXYZ(k, centre.x + (p.getX(k) - centre.x) * r, centre.y + (p.getY(k) - centre.y) * r, centre.z + (p.getZ(k) - centre.z) * r * flat);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** A gently domed, tapering hair lock rather than a round tube or flat decal. */
function hairRibbon(
  points: THREE.Vector3[],
  width: number,
  depth: number,
  back = false,
  rows = 36,
  across = 10,
  terminalWidth = 0.1,
  wrapRadius = 0,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const center = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const side = new THREE.Vector3(1, 0, 0).projectOnPlane(tangent).normalize();
    if (side.lengthSq() < 0.001) side.set(0, 0, 1).projectOnPlane(tangent).normalize();
    const normal = tangent.clone().cross(side).normalize().multiplyScalar(back ? -1 : 1);
    const taper = Math.pow(Math.sin(Math.PI * t), 0.36);
    const tip = terminalWidth + (1 - terminalWidth) * taper;
    for (let col = 0; col <= across; col++) {
      const q = (col / across) * 2 - 1;
      const dome = Math.sqrt(Math.max(1 - q * q, 0));
      const acrossShape = Math.pow(dome, 0.72);
      const lateral = q * width * tip;
      // Let wide rear sections wrap around the skull/curtain instead of cutting
      // across it like raised cords. The tiny radial lift keeps their edges on
      // the hair surface as it curves away from the centre line.
      const wrap = wrapRadius > 0
        ? wrapRadius - Math.sqrt(Math.max(wrapRadius * wrapRadius - lateral * lateral, 0))
        : 0;
      const p = center.clone()
        .addScaledVector(side, lateral)
        .addScaledVector(normal, wrap + depth * acrossShape * tip);
      positions.push(p.x, p.y, p.z);
      uvs.push(col / across, t);
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < across; col++) {
      const a = row * (across + 1) + col;
      const b = a + across + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A soft rear curtain of hair that falls from the crown to Mun Yi's waist. */
function longHairCurtain(): THREE.BufferGeometry {
  const across = 36;
  const down = 46;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= down; row++) {
    const t = row / down;
    for (let col = 0; col <= across; col++) {
      const u = (col / across) * 2 - 1;
      const radius = longCurtainRadius(t, u);
      const hemWave = longCurtainHem(u) * smoothstep(0.78, 1, t);
      const y = HEAD_R * (0.35 - 2.55 * t) + hemWave;
      const edge = 0.95 + 0.05 * Math.cos(u * Math.PI * 0.5);
      const x = u * radius * edge + Math.sin(t * 2.6 + u * 3.4) * 0.012 * t;
      const z = -Math.sqrt(Math.max(radius * radius - x * x, 0.001)) - 0.003;
      positions.push(x, y, z);
      uvs.push(col / across, t);
    }
  }
  for (let row = 0; row < down; row++) {
    for (let col = 0; col < across; col++) {
      const a = row * (across + 1) + col;
      const b = a + across + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A ribbon bow: two soft loops, a knot, and two tails of a given length. */
function bow(piece: Piece, colour: string, at: THREE.Vector3, size: number, tails: number, facing = 0): void {
  const rotate = (v: THREE.Vector3) => v.applyAxisAngle(new THREE.Vector3(0, 1, 0), facing).add(at);
  for (const side of [-1, 1]) {
    const p = rotate(new THREE.Vector3(side * size * 1.05, size * 0.15, 0));
    piece.add(new THREE.TorusGeometry(size, size * 0.42, 10, 20), colour, 'cloth', place(p.x, p.y, p.z, 0, facing, side * 0.35, 1, 0.72, 0.38));
  }
  const knot = rotate(new THREE.Vector3(0, 0, size * 0.1));
  piece.add(ellipsoid(size * 0.45, size * 0.42, size * 0.3), colour, 'cloth', place(knot.x, knot.y, knot.z));
  if (tails > 0) {
    for (const side of [-1, 1]) {
      const a = rotate(new THREE.Vector3(side * size * 0.25, -size * 0.2, 0));
      const b = rotate(new THREE.Vector3(side * size * 0.6, -tails * 0.5, size * 0.1));
      const c = rotate(new THREE.Vector3(side * size * 0.75, -tails, size * 0.05));
      piece.add(taperedTube([a, b, c], size * 0.42, size * 0.3, 0.22, 12), colour);
    }
  }
}

/** A thin flat frame with a hole: the front of a pair of glasses. */
function frameShape(kind: Design['glasses'], w: number, h: number, thickness: number): THREE.ExtrudeGeometry {
  const outline = (scale: number) => {
    const s = new THREE.Path();
    const ww = (w / 2) * scale;
    const hh = (h / 2) * scale;
    if (kind === 'hexagon') {
      const pts: [number, number][] = [[-ww, hh * 0.3], [-ww * 0.6, hh], [ww * 0.6, hh], [ww, hh * 0.3], [ww * 0.78, -hh], [-ww * 0.78, -hh]];
      pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
      s.closePath();
    } else {
      const r = Math.min(ww, hh) * 0.38;
      s.moveTo(-ww + r, -hh);
      s.lineTo(ww - r, -hh);
      s.quadraticCurveTo(ww, -hh, ww, -hh + r);
      s.lineTo(ww, hh - r);
      s.quadraticCurveTo(ww, hh, ww - r, hh);
      s.lineTo(-ww + r, hh);
      s.quadraticCurveTo(-ww, hh, -ww, hh - r);
      s.lineTo(-ww, -hh + r);
      s.quadraticCurveTo(-ww, -hh, -ww + r, -hh);
    }
    return s;
  };
  const shape = new THREE.Shape(outline(1).getPoints(10));
  shape.holes.push(new THREE.Path(outline(1 - thickness / Math.min(w, h)).getPoints(10).reverse()));
  return new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false, curveSegments: 10 });
}

/** A softly faceted drop crystal, with its narrow point at the bottom. */
function teardrop(radius: number, height: number): THREE.BufferGeometry {
  const profile = [
    [0.001, -height * 0.5], [radius * 0.34, -height * 0.38], [radius * 0.72, -height * 0.18],
    [radius, 0], [radius * 0.87, height * 0.2], [radius * 0.56, height * 0.39], [radius * 0.2, height * 0.48], [0.001, height * 0.5],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geometry = new THREE.LatheGeometry(profile, 12);
  geometry.computeVertexNormals();
  return geometry;
}

/** One wing of a delicate butterfly, extruded just enough to catch the light. */
function butterflyWing(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.02, 0.22, 0.3, 0.35, 0.42, 0.23);
  shape.bezierCurveTo(0.51, 0.13, 0.29, 0.04, 0.12, -0.02);
  shape.bezierCurveTo(0.32, -0.08, 0.34, -0.27, 0.2, -0.3);
  shape.bezierCurveTo(0.08, -0.31, 0.02, -0.15, 0, 0);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.003, bevelSegments: 1, curveSegments: 8 });
}

/** A small wire necklace follows the collar instead of sitting like a flat decal. */
function chain(points: THREE.Vector3[], radius = 0.0045, segments = 36): THREE.BufferGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true, 'centripetal'), segments, radius, 5, true);
}

function tiaraArc(): THREE.BufferGeometry {
  const points = [
    new THREE.Vector3(-0.24, 0.12, 0.415), new THREE.Vector3(-0.18, 0.22, 0.39),
    new THREE.Vector3(-0.1, 0.292, 0.375), new THREE.Vector3(0, 0.33, 0.36),
    new THREE.Vector3(0.1, 0.292, 0.375), new THREE.Vector3(0.18, 0.22, 0.39), new THREE.Vector3(0.24, 0.12, 0.415),
  ];
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.008, 5, false);
}

// ---------------------------------------------------------------------------
// The figure. About 2.35 tall, feet at the origin, facing +z.

const HEAD_R = 0.42;
const WAIST = 1.02;
const SHOULDER_Y = 1.35;
const NECK_TOP = 1.47;
/** The head's centre, above the neck pivot. */
const HEAD_C = HEAD_R * 0.93;

interface Built {
  body: Map<Surface, THREE.BufferGeometry>;
  legLeft: Map<Surface, THREE.BufferGeometry>;
  legRight: Map<Surface, THREE.BufferGeometry>;
  torso: Map<Surface, THREE.BufferGeometry>;
  head: Map<Surface, THREE.BufferGeometry>;
  eye: Map<Surface, THREE.BufferGeometry>;
  mouth: Map<Surface, THREE.BufferGeometry>;
  arm: Map<Surface, THREE.BufferGeometry>;
  mouthAt: THREE.Vector3;
  mouthTilt: number;
  eyeX: number;
  eyeY: number;
  eyeZ: number;
}

/**
 * The hair as one sculpted shell around the head: a lathe profile from the crown
 * down, a soft parting, and the face showing through an opening shaped like a
 * hairline that falls away from the parting. Relative to the head's centre.
 */
function hairOutline(style: Design['hair_style']): [number, number][] {
  // Radii and heights are relative to the skull radius. The long style uses a
  // separate sculpted rear curtain, so this shell only forms the scalp and nape.
  return style === 'bob'
    ? [[0.001, 1.09], [0.35, 1.05], [0.62, 0.95], [0.85, 0.77], [1.02, 0.5], [1.11, 0.16], [1.14, -0.18], [1.12, -0.42], [1.07, -0.58], [0.99, -0.7], [0.88, -0.79]]
    : [[0.001, 1.08], [0.35, 1.04], [0.62, 0.93], [0.85, 0.74], [1.0, 0.5], [1.07, 0.2], [1.09, -0.2], [1.11, -0.48], [1.08, -0.63], [0.99, -0.68]];
}

function hairRadius(style: Design['hair_style'], height: number): number {
  return profileAt(hairOutline(style), height);
}

/** A softly raised nape and slightly longer side curve, blended only into the back of the bob. */
function bobNapeShift(x: number, y: number, z: number, radius: number): number {
  const rear = smoothstep(radius * 0.12, -radius * 0.12, z);
  const lower = smoothstep(-radius * 0.28, -radius * 0.68, y);
  const angle = Math.atan2(x, -z);
  const nape = Math.exp(-((angle / 0.5) ** 2));
  const jawSide = Math.exp(-(((Math.abs(angle) - 0.86) / 0.36) ** 2));
  return rear * lower * radius * (0.12 * nape - 0.045 * jawSide);
}

/** Broad, gently curved clumps are sculpted into the bob's rear shell. */
function bobSectionShift(x: number, y: number, z: number, radius: number): number {
  const rear = smoothstep(-radius * 0.02, -radius * 0.26, z);
  const crownToNape = smoothstep(radius * 0.88, -radius * 0.72, y);
  const angle = Math.atan2(x, -z);
  const phase = angle * 2.35 + y / radius * 0.72 + Math.sin(y / radius * 1.45 + angle * 0.3) * 0.22
    + Math.sin(angle * 3.9 + y / radius * 1.1) * 0.08;
  const amplitude = 0.035 + 0.075 * smoothstep(radius * 0.2, -radius * 0.48, y);
  return radius * amplitude * Math.cos(phase) * rear * crownToNape;
}

function longCurtainRadius(t: number, across: number): number {
  const flow = 0.62 * Math.sin(across * Math.PI * 1.7 + t * 1.15 + Math.sin(t * 1.8 + across) * 0.28)
    + 0.25 * Math.sin(across * Math.PI * 3.65 - t * 1.35 + 0.5)
    + 0.13 * Math.sin(across * Math.PI * 5.7 + t * 1.7 - 0.35);
  const rearVolume = 0.06 * smoothstep(0, 0.04, t);
  return HEAD_R * (1.015 + rearVolume + 0.035 * Math.sin(Math.PI * t) + 0.17 * flow * Math.sin(Math.PI * t));
}

function longCurtainHem(across: number): number {
  return HEAD_R * (0.034 * Math.sin(across * Math.PI * 2.4 + 0.35)
    + 0.013 * Math.sin(across * Math.PI * 4.8 - 0.22));
}

function hairShell(d: Design): THREE.BufferGeometry {
  const R = HEAD_R;
  const fw = d.faceWidth;
  const outline = hairOutline(d.hair_style);
  const smooth = new THREE.SplineCurve(outline.map(([r, y]) => new THREE.Vector2(r * R, y * R))).getPoints(d.hair_style === 'bob' ? 56 : 90);
  const g = new THREE.LatheGeometry(smooth, 128);
  const p = g.getAttribute('position');
  // The hairline falls away from the parting, framing the face.
  const hairline = (x: number) => R * 0.5 - (x * x) / R * 1.15;
  const keep: boolean[] = [];
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * fw;
    let y = p.getY(i);
    let z = p.getZ(i);
    // The opening for the face: only at the front, only as wide as the face, below the hairline.
    const inside = smoothstep(-0.015, 0.04, hairline(x) - y) * smoothstep(R * 0.2, R * 0.55, z) * (1 - smoothstep(R * 0.78, R * 0.95, Math.abs(x)));
    const underLongCurtain = d.hair_style === 'long' && Math.abs(x) < R * 0.82 && z < -R * 0.55 && y < R * 0.23;
    if (y > -R * 0.92) {
      // Within the head, the shell dives deep inside the skull, so its edge meets the skin cleanly.
      const pull = 1 - inside * (0.45 + 0.35 * smoothstep(-R * 0.25, -R * 0.7, y));
      x *= pull;
      y *= 1 - inside * 0.1;
      z *= pull;
      keep.push(!underLongCurtain);
    } else {
      // Below the chin, the front simply opens: long hair falls behind the shoulders.
      keep.push(inside < 0.5 && !underLongCurtain);
    }
    // A soft parting along the crown.
    if (z > 0 && y > R * 0.3) {
      const groove = Math.exp(-((x / 0.019) ** 2)) * 0.014 * smoothstep(R * 0.3, R * 0.6, y);
      const len = Math.hypot(x, y, z);
      const k = (len - groove) / len;
      x *= k;
      y *= k;
      z *= k;
    }
    if (d.hair_style === 'bob' && z < 0) {
      // Taper the underside toward the nape instead of carrying the bob's
      // maximum radius straight down into a flat helmet edge.
      const rear = smoothstep(R * 0.08, -R * 0.18, z);
      const lower = smoothstep(-R * 0.18, -R * 0.7, y);
      const tuck = R * 0.11 * rear * lower;
      const radial = Math.hypot(x, z) || 1;
      x -= (x / radial) * tuck;
      z -= (z / radial) * tuck;
      // Broad flow in the rear shell gives the bob a softly layered shape. It
      // fades completely before the hairline, preserving the approved front.
      const lift = bobSectionShift(x, y, z, R);
      const shapedRadius = Math.hypot(x, z) || 1;
      x += (x / shapedRadius) * lift;
      z += (z / shapedRadius) * lift;
      if (y < -R * 0.28) y += bobNapeShift(x, y, z, R);
    }
    p.setXYZ(i, x, y, z);
  }
  // Drop the triangles that fall in the opening below the chin.
  const index = g.getIndex()!;
  const kept: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const ia = index.getX(i);
    const ib = index.getX(i + 1);
    const ic = index.getX(i + 2);
    if (keep[ia] && keep[ib] && keep[ic]) kept.push(ia, ib, ic);
  }
  g.setIndex(kept);
  g.computeVertexNormals();
  return g;
}

function buildFigure(d: Design): Built {
  const body = new Piece();
  const legLeft = new Piece();
  const legRight = new Piece();
  const torso = new Piece();
  const head = new Piece();
  const eye = new Piece();
  const mouth = new Piece();
  const arm = new Piece();
  let mouthAt = new THREE.Vector3();
  let mouthTilt = 0;
  const R = HEAD_R;
  const fw = d.faceWidth;

  // ---- Dress layers and articulated legs ----
  if (d.outfit === 'princess') {
    // The ivory petticoat is the continuous base. Two shorter overskirts sit
    // just proud of it and end at different heights; they no longer intersect
    // as three complete cones, which caused the old white tears and z-fighting.
    const ruffle: Tier = { profile: [[0.15, WAIST], [0.21, 0.9], [0.37, 0.66], [0.59, 0.3], [0.68, 0.045]], folds: 8, depth: 0.026, colour: PALETTE.ivory, lace: 0.039, scallops: 28, laceColor: '#FFF9EF' };
    const middle: Tier = { profile: [[0.19, 1.005], [0.255, 0.9], [0.43, 0.66], [0.6, 0.42], [0.69, 0.26]], folds: 7, depth: 0.018, points: 8, pointDepth: 0.008, colour: PALETTE.powder, lace: 0.032, scallops: 24, laceColor: '#FFF9F3' };
    const over: Tier = { profile: [[0.27, 0.92], [0.38, 0.78], [0.51, 0.59], [0.6, 0.49], [0.66, 0.435]], folds: 6, depth: 0.016, points: 6, pointDepth: 0.014, colour: PALETTE.lavender, lace: 0.027, scallops: 20, laceColor: '#FBF5F5' };
    for (const tier of [ruffle, middle, over]) addTier(body, tier);
    embroider(body, over, 0.54, 8, [PALETTE.lace, '#F2D1DA'], 0.018);
    embroider(body, middle, 0.34, 12, [PALETTE.lace, '#F2D1DA', PALETTE.deepLavender], 0.016);
    embroider(body, ruffle, 0.17, 16, [PALETTE.deepLavender, PALETTE.powder], 0.014);
    for (const piece of [legLeft, legRight]) {
      const stocking = new THREE.LatheGeometry([[0.001, -0.47], [0.039, -0.45], [0.045, -0.27], [0.048, -0.08], [0.001, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 18);
      piece.add(stocking, '#FFF7EF', 'skin');
      piece.add(ellipsoid(0.056, 0.038, 0.087), PALETTE.deepLavender, 'gloss', place(0, -0.46, 0.035));
      piece.add(new THREE.TorusGeometry(0.044, 0.006, 6, 18, Math.PI), PALETTE.champagne, 'metal', place(0, -0.43, 0.03, 0, Math.PI / 2, 0));
    }
  } else {
    const petticoat: Tier = { profile: [[0.14, WAIST - 0.02], [0.2, 0.88], [0.31, 0.64], [0.42, 0.42], [0.45, 0.32]], folds: 7, depth: 0.01, colour: PALETTE.ivory, lace: 0.032, scallops: 26, laceColor: '#FFF9F1' };
    const skirt: Tier = { profile: [[0.18, WAIST - 0.01], [0.27, 0.88], [0.405, 0.64], [0.52, 0.46], [0.56, 0.405]], folds: 6, depth: 0.022, points: 6, pointDepth: 0.008, colour: PALETTE.powder, lace: 0.029, scallops: 22, laceColor: '#F7F4EE' };
    addTier(body, petticoat);
    addTier(body, skirt);
    embroider(body, skirt, 0.58, 12, [PALETTE.lace, PALETTE.silver, '#D7C9F0'], 0.017);
    for (const piece of [legLeft, legRight]) {
      const leg = new THREE.LatheGeometry([[0.001, -0.49], [0.04, -0.46], [0.046, -0.28], [0.05, -0.09], [0.001, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 18);
      piece.add(leg, '#FFF7EF', 'skin');
      piece.add(ellipsoid(0.056, 0.04, 0.088), PALETTE.deepPowder, 'gloss', place(0, -0.46, 0.035));
      piece.add(new THREE.TorusGeometry(0.044, 0.006, 6, 18, Math.PI), PALETTE.silver, 'metal', place(0, -0.43, 0.03, 0, Math.PI / 2, 0));
    }
  }

  // ---- Torso (pivot at the waist) ----
  const bodice = d.outfit === 'princess' ? PALETTE.lavender : PALETTE.powder;
  const torsoProfile: [number, number][] = d.outfit === 'princess'
    ? [[0.145, -0.02], [0.16, 0.08], [0.185, 0.2], [0.178, 0.29], [0.145, 0.355], [0.075, 0.405], [0.05, 0.425]]
    : [[0.145, -0.02], [0.16, 0.08], [0.185, 0.2], [0.19, 0.29], [0.16, 0.36], [0.08, 0.405], [0.05, 0.425]];
  torso.add(
    new THREE.LatheGeometry(torsoProfile.map(([r, y]) => new THREE.Vector2(r, y)), 40).scale(1, 1, 0.8),
    (_x, y, z) => (y > 0.34 && z > 0 ? (d.outfit === 'princess' ? PALETTE.lace : '#E9F1F8') : bodice),
  );
  torso.add(
    new THREE.LatheGeometry([[0.001, 0.36], [0.05, 0.37], [0.056, 0.395], [0.058, 0.44], [0.054, 0.48], [0.058, 0.51], [0.065, 0.52], [0.001, 0.525]].map(([r, y]) => new THREE.Vector2(r, y)), 32),
    d.skin,
    'skin',
  );
  if (d.outfit === 'princess') {
    // Fine corset piping gives the fitted bodice shape without hard panel edges.
    const frontZ = (x: number, y: number) => 0.14 - Math.abs(x) * 0.23 + Math.max(y - 0.2, 0) * 0.04;
    for (const side of [-1, 1]) {
      const seam = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.072, 0.37, frontZ(0.072, 0.37)),
        new THREE.Vector3(side * 0.065, 0.27, frontZ(0.065, 0.27)),
        new THREE.Vector3(side * 0.055, 0.13, frontZ(0.055, 0.13)),
        new THREE.Vector3(side * 0.06, 0.02, frontZ(0.06, 0.02)),
      ]);
      torso.add(new THREE.TubeGeometry(seam, 18, 0.003, 5, false), '#E5D8F5', 'cloth');
    }
    const neckline = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.13, 0.35, 0.12), new THREE.Vector3(-0.08, 0.31, 0.145),
      new THREE.Vector3(0, 0.3, 0.157), new THREE.Vector3(0.08, 0.31, 0.145), new THREE.Vector3(0.13, 0.35, 0.12),
    ]);
    torso.add(new THREE.TubeGeometry(neckline, 28, 0.007, 6, false), PALETTE.lace, 'cloth');
    // A restrained blue waist detail and a short bow belong only to the princess.
    torso.add(new THREE.TorusGeometry(0.151, 0.012, 8, 40), PALETTE.powder, 'cloth', place(0, 0.0, 0, Math.PI / 2, 0, 0, 1, 1, 0.8));
    bow(torso, PALETTE.powder, new THREE.Vector3(0.045, 0.005, 0.145), 0.038, 0.2, 0.2);
    torso.add(flower(0.018), PALETTE.lace, 'cloth', place(0.045, 0.007, 0.167, 0, 0.2, 0));
    // Fine floral stitching and pearl buttons across the bodice.
    for (const [x, y, s] of [[0, 0.22, 0.016], [-0.075, 0.19, 0.011], [0.075, 0.19, 0.011], [0, 0.12, 0.01]] as const) {
      torso.add(flower(s), '#F7E9F4', 'cloth', place(x, y, frontZ(x, y) + 0.008, 0, x * 2, 0));
    }
    for (const y of [0.13, 0.19, 0.25]) torso.add(new THREE.SphereGeometry(0.008, 8, 6), PALETTE.pearl, 'jewel', place(0, y, frontZ(0, y) + 0.01));
  } else {
    // A soft draped neckline and silver-white botanical stitching, with no waist bow.
    const neckline = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.13, 0.36, 0.105), new THREE.Vector3(-0.075, 0.32, 0.14),
      new THREE.Vector3(0, 0.31, 0.15), new THREE.Vector3(0.075, 0.32, 0.14), new THREE.Vector3(0.13, 0.36, 0.105),
    ]);
    torso.add(new THREE.TubeGeometry(neckline, 26, 0.006, 5, false), '#F8F6F3', 'cloth');
    for (const side of [-1, 1]) {
      const stem = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.08, 0.08, 0.128), new THREE.Vector3(side * 0.11, 0.18, 0.127),
        new THREE.Vector3(side * 0.085, 0.27, 0.126), new THREE.Vector3(side * 0.06, 0.34, 0.118),
      ]);
      torso.add(new THREE.TubeGeometry(stem, 18, 0.0025, 4, false), '#F4F1F1', 'cloth');
      for (const [x, y, sideLeaf] of [[0.1, 0.15, -1], [0.105, 0.23, 1], [0.06, 0.3, -1]] as const) {
        torso.add(leaf(0.035), '#EEF0F5', 'cloth', place(side * x, y, 0.13, 0, side * -0.25, sideLeaf * 0.85, 0.65, 0.55, 0.8));
      }
      const petal = flower(0.012);
      torso.add(petal, '#F7F3FB', 'cloth', place(side * 0.08, 0.36, 0.12, 0, side * 0.25, 0));
    }
    for (const y of [0.12, 0.2, 0.28]) torso.add(new THREE.SphereGeometry(0.0065, 8, 6), PALETTE.silver, 'jewel', place(0, y, 0.145));
    // Zi Nor has a softly tailored powder-blue cap sleeve. This follows each
    // articulated arm and avoids the transparent floating cape sheet.
  }

  // Each necklace follows the neckline and keeps its own distinct pendant silhouette.
  torso.add(
    chain([
      new THREE.Vector3(-0.145, 0.405, 0.035), new THREE.Vector3(-0.12, 0.34, 0.09),
      new THREE.Vector3(-0.065, 0.29, 0.14), new THREE.Vector3(0, 0.275, 0.155),
      new THREE.Vector3(0.065, 0.29, 0.14), new THREE.Vector3(0.12, 0.34, 0.09), new THREE.Vector3(0.145, 0.405, 0.035),
      new THREE.Vector3(0, 0.44, -0.115),
    ]),
    d.outfit === 'princess' ? PALETTE.champagne : PALETTE.silver,
    'metal',
  );
  if (d.outfit === 'princess') {
    torso.add(new THREE.TorusGeometry(0.012, 0.0035, 6, 16), PALETTE.champagne, 'metal', place(0, 0.27, 0.16, Math.PI / 2));
    torso.add(teardrop(0.03, 0.07), PALETTE.crystal, 'jewel', place(0, 0.212, 0.168));
    torso.add(new THREE.SphereGeometry(0.008, 8, 6), PALETTE.pearl, 'jewel', place(-0.074, 0.294, 0.14));
    torso.add(new THREE.SphereGeometry(0.008, 8, 6), PALETTE.pearl, 'jewel', place(0.074, 0.294, 0.14));
  } else {
    const pendant = new THREE.DodecahedronGeometry(0.031, 0);
    torso.add(pendant, PALETTE.blueCrystal, 'jewel', place(0, 0.225, 0.16, 0, 0, 0, 0.76, 1.18, 0.62));
    const wing = butterflyWing();
    for (const side of [-1, 1]) {
      torso.add(wing, PALETTE.silver, 'metal', place(side * 0.024, 0.258, 0.169, 0, 0, 0, 0.085, 0.085, 0.42));
    }
  }

  // ---- Arms (pivot at the shoulder, hanging down) ----
  const sleeve = d.outfit === 'princess' ? PALETTE.ivory : '#D3E3F5';
  const puff = d.outfit === 'princess'
    ? new THREE.LatheGeometry([[0.001, 0.07], [0.06, 0.06], [0.092, 0.0], [0.085, -0.06], [0.06, -0.09], [0.001, -0.095]].map(([r, y]) => new THREE.Vector2(r, y)), 28)
    : new THREE.LatheGeometry([[0.001, 0.075], [0.052, 0.067], [0.073, 0.035], [0.081, -0.005], [0.075, -0.045], [0.061, -0.09], [0.052, -0.105], [0.001, -0.105]].map(([r, y]) => new THREE.Vector2(r, y)), 32);
  if (d.outfit === 'princess') {
    // Gathered: soft pleats around the puff.
    const p = puff.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const k = 1 + Math.sin(Math.atan2(p.getX(i), p.getZ(i)) * 10) * 0.05;
      p.setXYZ(i, p.getX(i) * k, p.getY(i), p.getZ(i) * k);
    }
    puff.computeVertexNormals();
  } else {
    const p = puff.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const angle = Math.atan2(p.getX(i), p.getZ(i));
      const y = p.getY(i);
      const pleat = 1 + Math.sin(angle * 6 + y * 4) * 0.018 * smoothstep(-0.105, 0.02, y);
      p.setXYZ(i, p.getX(i) * pleat, y, p.getZ(i) * pleat);
    }
    puff.computeVertexNormals();
  }
  arm.add(puff, sleeve);
  arm.add(new THREE.TorusGeometry(0.058, 0.008, 8, 28), d.outfit === 'princess' ? PALETTE.lace : '#F6F7FB', 'cloth', place(0, -0.085, 0, Math.PI / 2));
  if (d.outfit === 'princess') bow(arm, PALETTE.deepLavender, new THREE.Vector3(0, -0.02, 0.085), 0.024, 0);
  else arm.add(new THREE.TorusGeometry(0.049, 0.004, 6, 24), '#F6F7FB', 'cloth', place(0, -0.084, 0, Math.PI / 2));
  arm.add(new THREE.LatheGeometry([[0.001, -0.05], [0.042, -0.07], [0.042, -0.2], [0.038, -0.3], [0.001, -0.32]].map(([r, y]) => new THREE.Vector2(r, y)), 16), d.skin, 'skin');
  arm.add(ellipsoid(0.045, 0.054, 0.036), d.skin, 'skin', place(0, -0.335, 0.004));
  // The two bracelets use different silhouettes and stay attached to the moving wrists.
  arm.add(new THREE.TorusGeometry(0.041, 0.0045, 6, 28), d.outfit === 'princess' ? PALETTE.champagne : PALETTE.silver, 'metal', place(0, -0.27, 0.012, Math.PI / 2));
  if (d.outfit === 'princess') {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const at = new THREE.Vector3(Math.cos(a) * 0.041, -0.27, Math.sin(a) * 0.041 + 0.012);
      arm.add(new THREE.SphereGeometry(i % 2 ? 0.006 : 0.008, 8, 6), i % 2 ? PALETTE.pearl : PALETTE.crystal, 'jewel', place(at.x, at.y, at.z));
    }
    arm.add(flower(0.014), PALETTE.lavender, 'jewel', place(0, -0.27, 0.051));
    arm.add(new THREE.SphereGeometry(0.006, 8, 6), PALETTE.pearl, 'jewel', place(0, -0.27, 0.056));
  } else {
    const wing = butterflyWing();
    for (const side of [-1, 1]) {
      arm.add(wing, PALETTE.champagne, 'metal', place(side * 0.02, -0.27, 0.05, 0, 0, 0, 0.105, 0.105, 0.5));
      arm.add(wing, PALETTE.blueCrystal, 'jewel', place(side * 0.02, -0.27, 0.055, 0, 0, 0, 0.085, 0.085, 0.5));
    }
    arm.add(ellipsoid(0.006, 0.022, 0.006), PALETTE.silver, 'metal', place(0, -0.27, 0.056));
  }

  // ---- Head (pivot at the top of the neck; the face's centre is HEAD_C above) ----
  const cy = HEAD_C;
  const skull = new THREE.SphereGeometry(R, 88, 64);
  {
    const p = skull.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const below = Math.max(-y / R, 0);
      const taper = 1 - d.chinTaper * below * below;
      const x = p.getX(i) * fw * taper;
      const shapedY = y * (y < 0 ? 0.97 : 1);
      let z = p.getZ(i) * 0.94 * (1 - d.chinTaper * 0.3 * below);
      const frontWeight = smoothstep(R * 0.06, R * 0.58, z);
      const bridge = Math.exp(-((x / (R * 0.09)) ** 2) - (((shapedY + R * 0.02) / (R * 0.34)) ** 2)) * R * 0.042;
      const tip = Math.exp(-((x / (R * 0.085)) ** 2) - (((shapedY + R * 0.19) / (R * 0.11)) ** 2)) * R * 0.075;
    const cheek = Math.exp(-(((Math.abs(x) - R * 0.48) / (R * 0.22)) ** 2) - (((shapedY + R * 0.2) / (R * 0.25)) ** 2)) * R * 0.035;
      z += frontWeight * (bridge + tip + cheek);
      p.setXYZ(i, x, shapedY, z);
    }
    skull.computeVertexNormals();
  }
  head.add(skull, d.skin, 'skin', place(0, cy, 0));
  const faceRelief = (x: number, dy: number) => {
    const frontWeight = smoothstep(R * 0.06, R * 0.58, R * 0.94 * Math.sqrt(Math.max(1 - (x / (R * fw)) ** 2 - (dy / R) ** 2, 0.02)));
    const bridge = Math.exp(-((x / (R * 0.09)) ** 2) - (((dy + R * 0.02) / (R * 0.34)) ** 2)) * R * 0.042;
    const tip = Math.exp(-((x / (R * 0.085)) ** 2) - (((dy + R * 0.19) / (R * 0.11)) ** 2)) * R * 0.075;
    const cheek = Math.exp(-(((Math.abs(x) - R * 0.48) / (R * 0.22)) ** 2) - (((dy + R * 0.2) / (R * 0.25)) ** 2)) * R * 0.035;
    return frontWeight * (bridge + tip + cheek);
  };
  const front = (x: number, dy: number) => R * 0.94 * Math.sqrt(Math.max(1 - (x / (R * fw)) ** 2 - (dy / R) ** 2, 0.02)) + faceRelief(x, dy);
  const onFace = (x: number, dy: number, lift: number) => new THREE.Vector3(x, cy + dy, front(x, dy) + lift);
  const faceTurn = (x: number, dy: number) => [-Math.asin(dy / R) * 0.9, Math.asin(x / (R * fw)) * 0.9] as const;

  // The bridge and tip are sculpted into the high-resolution face surface; no
  // separate nose sphere breaks the profile.
  for (const side of [-1, 1]) {
    const x = side * 0.48 * R * fw;
    const b = onFace(x, -0.24 * R, -0.006);
    const [rx, ry] = faceTurn(x, -0.24 * R);
    head.add(ellipsoid(0.047, 0.026, 0.007), PALETTE.blush, 'skin', place(b.x, b.y, b.z, rx, ry, 0));
  }
  if (d.beautyMark) {
    const mark = onFace(0, 0.18 * R, 0.006);
    head.add(new THREE.CircleGeometry(0.006, 16), '#76544D', 'gloss', place(mark.x, mark.y, mark.z));
  }
  {
    const w = d.smileWidth;
    const smile = new THREE.Shape();
    smile.moveTo(-w / 2, 0);
    smile.quadraticCurveTo(0, -0.01, w / 2, 0);
    smile.quadraticCurveTo(w * 0.24, -0.022, 0, -0.024);
    smile.quadraticCurveTo(-w * 0.24, -0.022, -w / 2, 0);
    const dy = -0.35 * R;
    const at = onFace(0, dy, 0.002);
    const [rx] = faceTurn(0, dy);
    mouthAt = at;
    mouthTilt = rx;
    mouth.add(new THREE.ShapeGeometry(smile, 20), PALETTE.lip, 'gloss');
  }
  // Soft, thin brows with a gentle arch.
  for (const side of [-1, 1]) {
    const x = side * 0.34 * R * fw;
    const dy = 0.21 * R;
    const brow = new THREE.CatmullRomCurve3([
      onFace(x - side * 0.05, dy - 0.032, 0.006),
      onFace(x - side * 0.018, dy - 0.018, 0.009),
      onFace(x + side * 0.015, dy - 0.016, 0.009),
      onFace(x + side * 0.05, dy - 0.035, 0.005),
    ]);
    head.add(new THREE.TubeGeometry(brow, 16, 0.0045, 5, false), '#493A3C', 'hair');
  }

  // Eyes sit a little below the middle of the face; eyelashes at the outer corners.
  const eyeX = 0.34 * R * fw;
  const eyeDy = -0.05 * R;
  const eyeAt = onFace(eyeX, eyeDy, 0.006);
  for (const side of [-1, 1]) {
    const x = side * eyeX;
    const l = onFace(x + side * 0.03, eyeDy + 0.04, 0.002);
    const [rx, ry] = faceTurn(x, eyeDy);
    head.add(new THREE.CapsuleGeometry(0.0045, 0.022, 2, 5), PALETTE.eye, 'gloss', place(l.x, l.y, l.z, rx, ry, side * -0.9));
  }

  // Glasses: front frames, a fine bridge, and arms back into the hair.
  const lensW = d.glasses === 'hexagon' ? 0.17 : 0.19;
  const lensH = d.glasses === 'hexagon' ? 0.135 : 0.128;
  const frame = frameShape(d.glasses, lensW, lensH, 0.0038);
  // Frames should follow the face closely. The previous 4.5 cm offset made
  // them visibly hover in front of the eyes.
  const glassZ = eyeAt.z + 0.004;
  for (const side of [-1, 1]) {
    head.add(frame, d.glassesColour, 'metal', place(side * eyeX, cy + eyeDy, glassZ, 0, side * 0.14, 0));
    head.add(new THREE.CylinderGeometry(0.0026, 0.0026, R * 1.05, 6), d.glassesColour, 'metal', place(side * (eyeX + lensW / 2 + 0.004), cy + eyeDy + 0.025, glassZ - R * 0.43, Math.PI / 2, 0, 0));
  }
  head.add(new THREE.CylinderGeometry(0.0024, 0.0024, eyeX * 2 - lensW + 0.016, 6), d.glassesColour, 'metal', place(0, cy + eyeDy + 0.025, glassZ + 0.004, 0, 0, Math.PI / 2));

  // ---- Hair ----
  const shine = (x: number, y: number, z: number) => {
    const crown = Math.exp(-(((y - R * 0.72) / (R * 0.19)) ** 2));
    const sweep = 0.5 + 0.5 * Math.cos(x * 4.2 + y * 2.3);
    if (z > 0 && crown * sweep > 0.5) return '#514149';
    if (z > 0 && crown * sweep > 0.22) return '#382C33';
    const rear = smoothstep(-R * 0.02, -R * 0.2, z);
    if (rear < 0.001) return d.hair;
    const flow = 0.5 + 0.5 * Math.cos(x / R * 5.1 + y / R * 2.1 + Math.sin(x / R * 2.8 + y / R) * 0.35);
    const tone = new THREE.Color(d.hair).lerp(new THREE.Color('#57444C'), rear * (0.08 + flow * 0.17));
    return `#${tone.getHexString()}`;
  };
  const frontHairPoint = (side: -1 | 1, across: number, height: number): THREE.Vector3 => {
    const x = side * across * R * fw;
    const radius = R * hairRadius(d.hair_style, height) * 1.012;
    const z = Math.sqrt(Math.max(radius * radius - (x / fw) ** 2, 0.001)) + 0.006;
    return new THREE.Vector3(x, height * R, z);
  };
  head.add(hairShell(d), shine, 'hair', place(0, cy, 0));
  if (d.hair_style === 'long') {
    head.add(longHairCurtain(), (x, y) => {
      const flow = 0.5 + 0.5 * Math.cos(x / R * 3.3 + y / R * 0.85 + Math.sin(x / R * 1.5 + y / R * 1.25) * 0.28);
      const base = new THREE.Color(d.hair).lerp(new THREE.Color('#59464E'), 0.11 + flow * 0.17);
      return `#${base.getHexString()}`;
    }, 'hair', place(0, cy, 0));
  }

  // Centre-parted side sections sweep from the crown around the temples. Mun
  // Yi's locks continue to her waist; Zi Nor's narrow sections curl under her jaw.
  for (const side of [-1, 1] as const) {
    const heights = d.hair_style === 'long'
      ? [0.91, 0.68, 0.43, 0.13, -0.34, -0.95, -1.75, -2.42]
      : [0.91, 0.68, 0.43, 0.12, -0.17, -0.48, -0.58];
    const across = d.hair_style === 'long'
      ? [0.08, 0.23, 0.48, 0.79, 0.97, 1.02, 0.98, 0.88]
      : [0.08, 0.23, 0.48, 0.79, 0.98, 0.96, 0.82];
    const lock = heights.map((height, i) => frontHairPoint(side, across[i], height));
    head.add(hairRibbon(lock, d.hair_style === 'long' ? 0.052 : 0.044, 0.013, false, 42, 12), d.hair, 'hair', place(0, cy, 0));
    const underLock = lock.slice(2).map((point, i) => point.clone().add(new THREE.Vector3(side * 0.045, -i * 0.001, -0.018)));
    head.add(hairRibbon(underLock, 0.024, 0.008, false, 30, 8), '#33282E', 'hair', place(0, cy, 0));
  }

  if (d.hair_style === 'long') {
    // A small, readable tiara sits on the front contour of the part rather than
    // inside the crown shell.
    head.add(tiaraArc(), PALETTE.champagne, 'metal', place(0, cy, 0));
    head.add(teardrop(0.034, 0.082), PALETTE.crystal, 'jewel', place(0, cy + 0.365, 0.385));
    head.add(new THREE.OctahedronGeometry(0.023, 0), PALETTE.crystal, 'jewel', place(-0.112, cy + 0.275, 0.39));
    head.add(new THREE.OctahedronGeometry(0.023, 0), PALETTE.crystal, 'jewel', place(0.112, cy + 0.275, 0.39));
  } else {
    // One small lavender flower tucks into the left side of her bob.
    const flowerAt = new THREE.Vector3(0.275, cy + 0.33, 0.24);
    const petal = flower(0.046);
    head.add(petal, '#C7B1ED', 'jewel', place(flowerAt.x, flowerAt.y, flowerAt.z, 0, 0, 0, 1, 0.82, 1));
    head.add(new THREE.SphereGeometry(0.009, 10, 8), PALETTE.champagne, 'metal', place(flowerAt.x, flowerAt.y, flowerAt.z + 0.006));
  }

  // Their earrings are deliberately different in shape and follow the head pivot.
  if (d.outfit === 'princess') {
    for (const side of [-1, 1]) {
      const x = side * 0.42;
      head.add(new THREE.SphereGeometry(0.009, 10, 8), PALETTE.champagne, 'metal', place(x, cy - 0.105, 0.245));
      head.add(new THREE.TorusGeometry(0.012, 0.0032, 6, 14), PALETTE.champagne, 'metal', place(x, cy - 0.13, 0.25, Math.PI / 2));
      head.add(teardrop(0.029, 0.07), PALETTE.crystal, 'jewel', place(x, cy - 0.185, 0.255));
      head.add(new THREE.SphereGeometry(0.014, 10, 8), PALETTE.pearl, 'jewel', place(x, cy - 0.23, 0.256));
    }
  } else {
    const wing = butterflyWing();
    for (const side of [-1, 1]) {
      const x = side * 0.365;
      for (const wingSide of [-1, 1]) {
        head.add(wing, PALETTE.champagne, 'metal', place(x + wingSide * 0.018, cy - 0.13, 0.28, 0, 0, 0, wingSide * 0.1, 0.1, 0.45));
        head.add(wing, PALETTE.blueCrystal, 'jewel', place(x + wingSide * 0.018, cy - 0.13, 0.286, 0, 0, 0, wingSide * 0.082, 0.082, 0.5));
      }
      head.add(new THREE.SphereGeometry(0.006, 8, 6), PALETTE.silver, 'metal', place(x, cy - 0.13, 0.291));
    }
  }

  // ---- Eyes (separate, so they can blink) ----
  eye.add(almondEye(0.086, 0.055), '#FFF9F3', 'gloss');
  eye.add(new THREE.CircleGeometry(0.024, 28), '#805B58', 'gloss', place(0.004, -0.001, 0.004));
  eye.add(new THREE.CircleGeometry(0.014, 24), '#302329', 'gloss', place(0.004, -0.001, 0.008));
  eye.add(new THREE.CircleGeometry(0.0055, 16), PALETTE.white, 'gloss', place(0.013, 0.012, 0.011));
  eye.add(new THREE.CircleGeometry(0.003, 12), PALETTE.white, 'gloss', place(-0.006, -0.012, 0.011));

  return {
    body: body.merged(),
    legLeft: legLeft.merged(),
    legRight: legRight.merged(),
    torso: torso.merged(),
    head: head.merged(),
    eye: eye.merged(),
    mouth: mouth.merged(),
    arm: arm.merged(),
    mouthAt,
    mouthTilt,
    eyeX,
    eyeY: cy + eyeDy,
    eyeZ: eyeAt.z,
  };
}

// ---------------------------------------------------------------------------

let materials: Record<Surface, THREE.Material> | null = null;
const shared = () =>
  (materials ??= {
    cloth: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.76, sheen: 0.75, sheenRoughness: 0.55, sheenColor: new THREE.Color('#fffaf5'), side: THREE.DoubleSide }),
    skin: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.86, sheen: 0.1, sheenRoughness: 0.82, clearcoat: 0.01 }),
    hair: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.56, clearcoat: 0.08, clearcoatRoughness: 0.52, side: THREE.DoubleSide }),
    gloss: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, clearcoat: 0.28, clearcoatRoughness: 0.2 }),
    metal: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.26, metalness: 0.72, clearcoat: 0.36, clearcoatRoughness: 0.25 }),
    jewel: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.19, metalness: 0.1, clearcoat: 0.75, clearcoatRoughness: 0.16, iridescence: 0.28, iridescenceIOR: 1.25 }),
  });

const built = new Map<CharacterName, Built>();

function meshes(parts: Map<Surface, THREE.BufferGeometry>): THREE.Group {
  const group = new THREE.Group();
  for (const [surface, geometry] of parts) {
    const mesh = new THREE.Mesh(geometry, shared()[surface]);
    mesh.name = surface;
    mesh.castShadow = surface !== 'metal';
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

/** One figure in the world: articulated arms and legs, face pivots, and a light gait. */
export class Character {
  readonly root = new THREE.Group();
  readonly skirt = new THREE.Group();
  readonly torso = new THREE.Group();
  readonly head = new THREE.Group();
  readonly armLeft = new THREE.Group();
  readonly armRight = new THREE.Group();
  readonly legLeft = new THREE.Group();
  readonly legRight = new THREE.Group();
  readonly handLeft = new THREE.Object3D();
  readonly handRight = new THREE.Object3D();
  private readonly eyes: THREE.Group[] = [];
  private readonly eyeHome: THREE.Vector3[] = [];
  private readonly mouth = new THREE.Group();
  private readonly phase = Math.random() * 10;
  private blinkIn = 2 + Math.random() * 3;
  private blink = 0;
  private waveT = -1;
  private gait = 0;
  private gaitTarget = 0;
  private walkPhase = Math.random() * Math.PI * 2;
  private strideRate = 6.2;
  /** Extra poses a scene can set (for example, holding something). */
  readonly pose = { leftLift: 0, rightLift: 0, leftForward: 0, rightForward: 0, headTurn: 0, headTilt: 0, gazeX: 0, gazeY: 0, expression: 0, carrying: 0 };

  constructor(readonly name: CharacterName) {
    const design = DESIGNS[name];
    let b = built.get(name);
    if (!b) {
      b = buildFigure(design);
      built.set(name, b);
    }
    this.skirt.add(meshes(b.body));
    this.root.add(this.skirt);
    this.legLeft.position.set(-0.085, 0.49, 0);
    this.legLeft.add(meshes(b.legLeft));
    this.legRight.position.set(0.085, 0.49, 0);
    this.legRight.add(meshes(b.legRight));
    this.root.add(this.legLeft, this.legRight);
    this.torso.position.y = WAIST;
    this.torso.add(meshes(b.torso));
    this.root.add(this.torso);

    this.head.position.y = NECK_TOP - WAIST;
    this.head.add(meshes(b.head));
    this.mouth.add(meshes(b.mouth));
    this.mouth.position.copy(b.mouthAt);
    this.mouth.rotation.x = b.mouthTilt;
    this.head.add(this.mouth);
    for (const side of [-1, 1]) {
      const eye = meshes(b.eye);
      eye.position.set(side * b.eyeX, b.eyeY, b.eyeZ);
      eye.rotation.y = side * 0.32;
      this.eyes.push(eye);
      this.eyeHome.push(eye.position.clone());
      this.head.add(eye);
    }
    this.torso.add(this.head);
    // Keep the faces expressive while giving both figures a taller, less chibi silhouette.
    this.head.scale.setScalar(0.7);

    for (const [arm, hand, side] of [[this.armLeft, this.handLeft, -1], [this.armRight, this.handRight, 1]] as const) {
      arm.position.set(side * 0.185, SHOULDER_Y - WAIST, 0);
      arm.add(meshes(b.arm));
      hand.position.set(0, -0.37, 0.048);
      hand.name = side < 0 ? 'left-hand-anchor' : 'right-hand-anchor';
      arm.add(hand);
      this.torso.add(arm);
    }
    this.root.scale.setScalar(design.scale);
  }

  /** A small hello: one hand rises and waves, then rests again. */
  wave(): void {
    if (this.waveT < 0) this.waveT = 0;
  }

  get waving(): boolean {
    return this.waveT >= 0;
  }

  /** Blend a measured stride in and out; the scene owns the character's path. */
  setWalking(walking: boolean, strideRate = 6.2): void {
    this.gaitTarget = walking ? 1 : 0;
    this.strideRate = strideRate;
  }

  update(dt: number, time: number, gaitDelta = dt): void {
    const t = time + this.phase;
    this.gait += (this.gaitTarget - this.gait) * (1 - Math.exp(-5 * Math.max(gaitDelta, 0)));
    if (gaitDelta > 0 && this.gait > 0.001) this.walkPhase += gaitDelta * this.strideRate;
    // Breathing settles into a soft counter-sway while walking.
    const step = Math.sin(this.walkPhase);
    const bob = Math.sin(this.walkPhase * 2) * 0.018 * this.gait;
    this.torso.position.y = WAIST + bob;
    this.torso.scale.set(1, 1 + Math.sin(t * 1.7) * 0.006 + Math.abs(Math.sin(this.walkPhase * 2)) * 0.003 * this.gait, 1);
    this.torso.rotation.z = Math.sin(t * 0.45) * 0.01 + step * 0.018 * this.gait;
    this.skirt.rotation.x = Math.sin(t * 1.15) * 0.006 + Math.cos(this.walkPhase) * 0.022 * this.gait;
    this.skirt.rotation.z = Math.sin(t * 0.65) * 0.006 + Math.sin(this.walkPhase * 0.5) * 0.012 * this.gait;
    this.head.rotation.y = Math.sin(t * 0.37) * 0.07 + this.pose.headTurn;
    this.head.rotation.x = Math.sin(t * 0.53) * 0.018 + this.pose.headTilt - bob * 0.4;
    this.head.rotation.z = Math.sin(t * 0.29) * 0.02 - step * 0.012 * this.gait;
    this.mouth.scale.set(1 + this.pose.expression * 0.07, 1 + this.pose.expression * 0.2, 1);

    // Blinking, every few seconds.
    if (dt > 0) this.blinkIn -= dt;
    if (dt > 0 && this.blinkIn <= 0) {
      this.blink += dt / 0.16;
      if (this.blink >= 1) {
        this.blink = 0;
        this.blinkIn = 2.4 + Math.random() * 3.2;
      }
    }
    const lid = this.blink > 0 ? 1 - Math.sin(this.blink * Math.PI) * 0.9 : 1;
    for (let i = 0; i < this.eyes.length; i++) {
      const eye = this.eyes[i];
      eye.position.set(this.eyeHome[i].x + this.pose.gazeX * 0.012, this.eyeHome[i].y + this.pose.gazeY * 0.01, this.eyeHome[i].z);
      eye.rotation.y = (i === 0 ? -0.32 : 0.32) + this.pose.gazeX * 0.12;
      eye.scale.set(1, lid * (1 + this.pose.expression * 0.08), 1);
    }

    // Arms rest softly beside the skirt, with the smallest movement.
    const rest = 0.2 + Math.sin(t * 0.8) * 0.015;
    const armSwing = 1 - THREE.MathUtils.clamp(this.pose.carrying, 0, 1) * 0.9;
    const swing = step * 0.27 * this.gait * armSwing;
    this.armLeft.rotation.set(-0.05 - this.pose.leftForward - swing, 0, -(rest + this.pose.leftLift) + swing * 0.12);
    this.armRight.rotation.set(-0.05 - this.pose.rightForward + swing, 0, rest + this.pose.rightLift + swing * 0.12);
    this.legLeft.rotation.x = Math.sin(this.walkPhase + Math.PI) * 0.34 * this.gait;
    this.legRight.rotation.x = step * 0.34 * this.gait;
    this.legLeft.rotation.z = Math.sin(this.walkPhase * 0.5 + 1) * 0.025 * this.gait;
    this.legRight.rotation.z = Math.sin(this.walkPhase * 0.5) * 0.025 * this.gait;

    if (this.waveT >= 0) {
      this.waveT += dt;
      const total = 2.2;
      const k = this.waveT / total;
      if (k >= 1) this.waveT = -1;
      else {
        const lift = Math.sin(Math.min(k * 3, 1) * Math.PI * 0.5) * (k > 0.8 ? (1 - k) / 0.2 : 1);
        this.armRight.rotation.z = rest + lift * 2.45 + Math.sin(this.waveT * 13) * 0.2 * lift;
        this.armRight.rotation.x = -lift * 0.25;
        this.head.rotation.z += lift * 0.06;
      }
    }
  }
}
