import * as THREE from 'three';
import type { Director } from '../core/director';
import type { Engine } from '../core/engine';
import type { Interaction } from '../core/interaction';
import { clamp } from '../core/noise';
import { butterflyParts } from './butterflies';

/**
 * Small, quiet magic that follows a mouse: a few sparkles left along its path, an
 * occasional butterfly, a ring of sparkles on a click in open air, and a soft glow
 * on whatever can be chosen as the pointer draws near. The same sparkles also rise
 * from the opening book and around the lit cake.
 *
 * One pooled point cloud and two pooled butterflies, updated in the engine's own
 * loop: nothing is allocated while it runs. Cursor effects only exist for a real
 * mouse, and none of it runs for visitors who prefer reduced motion.
 */

const POOL = 64;
/** At most this many trail sparkles at once; the rest of the pool is kept for bursts. */
const TRAIL_LIMIT = 40;
/** Pointer travel, in CSS pixels, between two trail sparkles. */
const TRAIL_SPACING = 18;
/** How far in front of the camera the cursor's sparkles live. */
const CURSOR_DEPTH = 4.5;
/** Within this many pixels (on a 900 px tall screen) an object starts to glow. */
const NEAR_RADIUS = 230;

const PALETTE = ['#B9A8EE', '#A6C8EA', '#A8D8BC', '#C9BCEF', '#FFF4E2'].map((c) => new THREE.Color(c));

export interface Magic {
  /** Sparkles rising from a point in the world, as from the opening book. */
  burst(at: THREE.Vector3, count: number, spread: number): void;
  /** Sparkles drifting up around a column, released over a few seconds. */
  rise(around: THREE.Vector3, radius: number, height: number, count: number, seconds: number): void;
  stats(): { active: number; trail: number; butterflies: number; enabled: boolean; sample?: unknown };
}

export function createCursorMagic(engine: Engine, director: Director, interaction: Interaction): Magic {
  const off: Magic = { burst() {}, rise() {}, stats: () => ({ active: 0, trail: 0, butterflies: 0, enabled: false }) };
  if (engine.reducedMotion) return off;
  const fineMouse = window.matchMedia('(hover: hover) and (pointer: fine)');

  // ---- The particle pool ----
  const position = new Float32Array(POOL * 3);
  const colour = new Float32Array(POOL * 3);
  const size = new Float32Array(POOL);
  const alpha = new Float32Array(POOL);
  const shape = new Float32Array(POOL);
  const velocity = new Float32Array(POOL * 3);
  const age = new Float32Array(POOL);
  const life = new Float32Array(POOL).fill(0);
  const baseSize = new Float32Array(POOL);
  const fromTrail = new Uint8Array(POOL);
  let cursor = 0;
  let active = 0;
  let trail = 0;

  const geometry = new THREE.BufferGeometry();
  const attribute = (array: Float32Array, width: number) => new THREE.BufferAttribute(array, width).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attribute(position, 3));
  geometry.setAttribute('aColour', attribute(colour, 3));
  geometry.setAttribute('aSize', attribute(size, 1));
  geometry.setAttribute('aAlpha', attribute(alpha, 1));
  geometry.setAttribute('aShape', attribute(shape, 1));
  geometry.setDrawRange(0, POOL);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uScale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColour;
      attribute float aSize;
      attribute float aAlpha;
      attribute float aShape;
      uniform float uScale;
      varying vec3 vColour;
      varying float vAlpha;
      varying float vShape;
      void main() {
        vColour = aColour;
        vAlpha = aAlpha;
        vShape = aShape;
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aAlpha > 0.0 ? aSize * uScale / -view.z : 0.0;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColour;
      varying float vAlpha;
      varying float vShape;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r = length(p);
        // A soft dot with a bright core, or a slim four-pointed star.
        // (smoothstep is only defined with its edges in order, so falls are written as 1 - rise.)
        float core = 1.0 - smoothstep(0.0, 0.3, r);
        float glow = exp(-r * r * 6.0) * 0.7 + core * 0.8;
        float armX = (1.0 - smoothstep(0.0, 0.16, abs(p.x))) * (1.0 - smoothstep(0.0, 1.0, abs(p.y)));
        float armY = (1.0 - smoothstep(0.0, 0.16, abs(p.y))) * (1.0 - smoothstep(0.0, 1.0, abs(p.x)));
        float star = max(armX, armY);
        float a = mix(glow, max(star, glow * 0.6), vShape) * vAlpha;
        if (a < 0.01) discard;
        // A warm white heart inside a pastel halo: it reads against the pale sky.
        gl_FragColor = vec4(mix(vColour, vec3(1.0, 0.98, 0.94), (1.0 - smoothstep(0.0, 0.4, r)) * 0.85), a);
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 30;
  engine.scene.add(points);
  if (new URLSearchParams(location.search).has('qa')) (window as unknown as Record<string, unknown>).__sparkles = points;

  const spawn = (x: number, y: number, z: number, vx: number, vy: number, vz: number, seconds: number, px: number, isTrail: boolean): void => {
    // Reuse the next slot; if the trail is at its limit, wait for room instead.
    if (isTrail && trail >= TRAIL_LIMIT) return;
    const i = cursor;
    cursor = (cursor + 1) % POOL;
    if (life[i] > 0) {
      active--;
      if (fromTrail[i]) trail--;
    }
    position[i * 3] = x;
    position[i * 3 + 1] = y;
    position[i * 3 + 2] = z;
    velocity[i * 3] = vx;
    velocity[i * 3 + 1] = vy;
    velocity[i * 3 + 2] = vz;
    const tone = PALETTE[Math.random() < 0.14 ? 4 : Math.floor(Math.random() * 4)];
    colour[i * 3] = tone.r;
    colour[i * 3 + 1] = tone.g;
    colour[i * 3 + 2] = tone.b;
    shape[i] = Math.random() < 0.3 ? 1 : 0;
    baseSize[i] = px * (0.7 + Math.random() * 0.6) * (shape[i] ? 1.5 : 1);
    age[i] = 0;
    life[i] = seconds * (0.8 + Math.random() * 0.4);
    fromTrail[i] = isTrail ? 1 : 0;
    active++;
    if (isTrail) trail++;
  };

  // ---- Where the cursor is, in the world ----
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const at = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const toWorld = (clientX: number, clientY: number, depth: number): THREE.Vector3 => {
    const bounds = engine.renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(ndc, engine.camera);
    return at.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, depth);
  };
  const cameraAxes = (): void => {
    right.setFromMatrixColumn(engine.camera.matrixWorld, 0);
    up.setFromMatrixColumn(engine.camera.matrixWorld, 1);
  };

  // ---- Cursor butterflies ----
  const parts = butterflyParts();
  interface Flier { root: THREE.Group; left: THREE.Group; right: THREE.Group; age: number; life: number; start: THREE.Vector3; drift: THREE.Vector3; bend: THREE.Vector3; phase: number }
  const fliers: Flier[] = [0, 1].map((n) => {
    const wing = (side: 1 | -1) => {
      const hinge = new THREE.Group();
      const mesh = new THREE.Mesh(parts.geometries[n % parts.geometries.length], parts.material);
      mesh.scale.x = side;
      hinge.add(mesh);
      return hinge;
    };
    const left = wing(-1);
    const rightWing = wing(1);
    const body = new THREE.Mesh(parts.body, parts.bodyMaterial);
    body.rotation.x = Math.PI / 2;
    const root = new THREE.Group();
    root.add(left, rightWing, body);
    root.visible = false;
    engine.scene.add(root);
    return { root, left, right: rightWing, age: 0, life: 0, start: new THREE.Vector3(), drift: new THREE.Vector3(), bend: new THREE.Vector3(), phase: n * 3 };
  });
  let travel = 0;
  let lastButterfly = -10;
  const releaseButterfly = (from: THREE.Vector3, time: number): void => {
    const flier = fliers.find((f) => !f.root.visible);
    if (!flier) return;
    cameraAxes();
    const side = Math.random() < 0.5 ? -1 : 1;
    flier.start.copy(from);
    // Away from the pointer: up and to one side, curving as it goes.
    flier.drift.copy(right).multiplyScalar(side * (0.7 + Math.random() * 0.4)).addScaledVector(up, 0.85 + Math.random() * 0.3);
    flier.bend.copy(right).multiplyScalar(-side * 0.45);
    flier.age = 0;
    flier.life = 3.4;
    flier.phase = Math.random() * 10;
    flier.root.visible = true;
    lastButterfly = time;
  };

  // ---- Pointer input: a real mouse only ----
  /** The world's clock, as of the last frame. */
  let now = 0;
  let last: { x: number; y: number } | null = null;
  let mouse: { x: number; y: number } | null = null;
  let lastMove = -10;
  const surface = engine.renderer.domElement;
  const isMouse = (event: PointerEvent) => event.pointerType === 'mouse' && fineMouse.matches;
  const quiet = () => interaction.blocked || director.flying;

  surface.addEventListener('pointermove', (event) => {
    if (!isMouse(event)) {
      mouse = null;
      return;
    }
    mouse = { x: event.clientX, y: event.clientY };
    lastMove = now;
    if (quiet()) {
      last = null;
      return;
    }
    if (!last) {
      last = { ...mouse };
      return;
    }
    const distance = Math.hypot(mouse.x - last.x, mouse.y - last.y);
    if (distance < TRAIL_SPACING) return;
    travel += distance;
    // Sparkles along the path, not on every event: one per stretch of travel.
    const steps = Math.min(Math.floor(distance / TRAIL_SPACING), 2);
    for (let s = 1; s <= steps; s++) {
      const f = s / steps;
      const p = toWorld(last.x + (mouse.x - last.x) * f, last.y + (mouse.y - last.y) * f, CURSOR_DEPTH);
      cameraAxes();
      const wobble = 0.05;
      spawn(
        p.x + (Math.random() - 0.5) * 0.04, p.y + (Math.random() - 0.5) * 0.04, p.z,
        right.x * (Math.random() - 0.5) * wobble + up.x * 0.06, right.y * (Math.random() - 0.5) * wobble + 0.07, right.z * (Math.random() - 0.5) * wobble + up.z * 0.06,
        0.9, 92, true,
      );
    }
    last = { ...mouse };
    // Now and then, after a good deal of wandering, a butterfly lifts off.
    if (travel > 1400 && now - lastButterfly > 7 && Math.random() < 0.35) {
      travel = 0;
      releaseButterfly(toWorld(mouse.x, mouse.y, CURSOR_DEPTH + 0.6).clone(), now);
    }
  });
  surface.addEventListener('pointerleave', () => {
    mouse = null;
    last = null;
  });
  surface.addEventListener('pointerdown', (event) => {
    if (!isMouse(event) || event.button !== 0 || quiet() || interaction.hovering) return;
    // A click in open air: a small ring of sparkles that opens and fades.
    const centre = toWorld(event.clientX, event.clientY, CURSOR_DEPTH).clone();
    cameraAxes();
    const count = 10;
    for (let n = 0; n < count; n++) {
      const angle = (n / count) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 0.32 + Math.random() * 0.08;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      spawn(
        centre.x, centre.y, centre.z,
        (right.x * dx + up.x * dy) * speed, (right.y * dx + up.y * dy) * speed, (right.z * dx + up.z * dy) * speed,
        0.7, 84, false,
      );
    }
  });

  // ---- A soft glow on what can be chosen, as the pointer draws near ----
  const nearness = new Map<string, number>();
  const box = new THREE.Box3();
  const centre = new THREE.Vector3();
  const updateNear = (): void => {
    const width = engine.renderer.domElement.clientWidth;
    const height = engine.renderer.domElement.clientHeight;
    const reach = NEAR_RADIUS * (Math.min(width, height) / 900);
    for (const item of interaction.items) {
      if (!item.onNear) continue;
      let amount = 0;
      if (mouse && !quiet() && item.page === director.current && (item.enabled?.() ?? true)) {
        box.setFromObject(item.hit).getCenter(centre).project(engine.camera);
        const dx = ((centre.x + 1) / 2) * width - mouse.x;
        const dy = ((1 - centre.y) / 2) * height - mouse.y;
        amount = clamp(1 - Math.hypot(dx, dy) / reach);
        amount *= amount;
      }
      if ((nearness.get(item.id) ?? 0) !== amount) {
        nearness.set(item.id, amount);
        item.onNear(amount);
      }
    }
  };

  // ---- Scheduled rises, for the book and the candle ----
  const rises: { around: THREE.Vector3; radius: number; height: number; left: number; every: number; next: number }[] = [];

  engine.add((dt, time) => {
    now = time;
    if (dt === 0) return;
    updateNear();
    // Stop leaving sparkles once the mouse rests.
    if (now - lastMove > 0.12) last = mouse ? { ...mouse } : null;

    for (const r of rises) {
      r.next -= dt;
      while (r.left > 0 && r.next <= 0) {
        r.left--;
        r.next += r.every;
        const angle = Math.random() * Math.PI * 2;
        const distance = r.radius * (0.75 + Math.random() * 0.35);
        spawn(
          r.around.x + Math.cos(angle) * distance, r.around.y + Math.random() * r.height, r.around.z + Math.sin(angle) * distance,
          (Math.random() - 0.5) * 0.08, 0.32 + Math.random() * 0.2, (Math.random() - 0.5) * 0.08,
          2.4, 150, false,
        );
      }
    }
    for (let k = rises.length - 1; k >= 0; k--) if (rises[k].left <= 0) rises.splice(k, 1);

    if (active > 0) {
      for (let i = 0; i < POOL; i++) {
        if (life[i] <= 0) continue;
        age[i] += dt;
        const t = age[i] / life[i];
        if (t >= 1) {
          life[i] = 0;
          alpha[i] = 0;
          active--;
          if (fromTrail[i]) trail--;
          continue;
        }
        const drag = 1 - dt * 1.6;
        velocity[i * 3] *= drag;
        velocity[i * 3 + 1] = velocity[i * 3 + 1] * drag + dt * 0.02;
        velocity[i * 3 + 2] *= drag;
        position[i * 3] += velocity[i * 3] * dt;
        position[i * 3 + 1] += velocity[i * 3 + 1] * dt;
        position[i * 3 + 2] += velocity[i * 3 + 2] * dt;
        // Fade in quickly, then shrink and fade away; stars twinkle a little.
        const fade = Math.min(t * 8, 1) * (1 - t) * (1 - t);
        alpha[i] = fade * (shape[i] ? 0.75 + Math.sin(age[i] * 14 + i) * 0.25 : 0.8);
        size[i] = baseSize[i] * (1 - t * 0.55);
      }
      for (const name of ['position', 'aAlpha', 'aSize', 'aColour', 'aShape']) geometry.getAttribute(name).needsUpdate = true;
    }
    material.uniforms.uScale.value = engine.renderer.getPixelRatio();

    for (const f of fliers) {
      if (!f.root.visible) continue;
      f.age += dt;
      const t = f.age / f.life;
      if (t >= 1) {
        f.root.visible = false;
        continue;
      }
      const curve = Math.sin(t * Math.PI);
      f.root.position.copy(f.start).addScaledVector(f.drift, t * 2.2).addScaledVector(f.bend, curve);
      f.root.position.y += Math.sin(f.age * 3 + f.phase) * 0.04;
      f.root.lookAt(engine.camera.position);
      f.root.rotateX(-1.1);
      // Small, and smaller still as it flies off and fades into the garden.
      f.root.scale.setScalar(0.085 * Math.min(t * 6, 1) * (1 - t * t));
      const flap = Math.sin(f.age * 16 + f.phase) * 0.8 + 0.42;
      f.left.rotation.z = -flap;
      f.right.rotation.z = flap;
    }
  });

  return {
    burst(around, count, spread) {
      for (let n = 0; n < count; n++) {
        spawn(
          around.x + (Math.random() - 0.5) * spread, around.y + Math.random() * spread * 0.3, around.z + (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * 0.25, 0.35 + Math.random() * 0.35, (Math.random() - 0.5) * 0.25,
          1.8, 110, false,
        );
      }
    },
    rise(around, radius, height, count, seconds) {
      rises.push({ around: around.clone(), radius, height, left: count, every: seconds / count, next: 0 });
    },
    stats: () => {
      // For QA: where the first living sparkle is on screen, and how it is drawn.
      let sample = null;
      for (let i = 0; i < POOL && !sample; i++) {
        if (life[i] <= 0) continue;
        const p = new THREE.Vector3(position[i * 3], position[i * 3 + 1], position[i * 3 + 2]).project(engine.camera);
        const depth = new THREE.Vector3(position[i * 3], position[i * 3 + 1], position[i * 3 + 2]).applyMatrix4(engine.camera.matrixWorldInverse).z;
        sample = { x: Math.round(((p.x + 1) / 2) * engine.width), y: Math.round(((1 - p.y) / 2) * engine.height), alpha: +alpha[i].toFixed(2), px: +((size[i] * engine.renderer.getPixelRatio()) / -depth).toFixed(1), depth: +depth.toFixed(2) };
      }
      return { active, trail, butterflies: fliers.filter((f) => f.root.visible).length, enabled: true, sample };
    },
  };
}
