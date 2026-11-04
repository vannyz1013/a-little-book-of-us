import * as THREE from 'three';
import { CAKE_TOP, type Cake } from '../objects/cake';
import { Character } from '../objects/character';
import { GiftBox } from '../objects/giftBox';
import { Candle } from '../objects/candle';
import type { Director } from '../core/director';
import type { Engine } from '../core/engine';
import type { BirthdayCinematicUI, SurpriseMode } from '../ui/birthdayCinematic';

interface SurpriseOptions {
  engine: Engine;
  director: Director;
  scene: THREE.Group;
  centre: THREE.Vector3;
  gift: GiftBox;
  munYi: Character;
  ziNor: Character;
  cake: Cake;
  cakeStand: THREE.Group;
  candle: Candle;
  surpriseUI: BirthdayCinematicUI;
}

interface CameraShot {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

const smooth = (t: number): number => {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
const mix = (a: number, b: number, t: number): number => THREE.MathUtils.lerp(a, b, smooth(t));
const angleMix = (a: number, b: number, t: number): number => {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * THREE.MathUtils.clamp(t, 0, 1);
};

interface CharacterSnapshot {
  position: THREE.Vector3;
  yaw: number;
  pose: Character['pose'];
}

const snapshotCharacter = (character: Character): CharacterSnapshot => ({
  position: character.root.position.clone(),
  yaw: character.root.rotation.y,
  pose: { ...character.pose },
});

/** One persistent, timeline-driven 3D sequence. Replays reset this state instead of creating another loop. */
export class BirthdaySurprise {
  readonly characters = new THREE.Group();
  private readonly carrier = new THREE.Group();
  private readonly cakeStand = this.makeSmallStand();
  private readonly travelCake: THREE.Group;
  private readonly flames: THREE.Mesh[] = [];
  private readonly flameMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly cakeLight = new THREE.PointLight('#FFC995', 0, 5.5, 1.8);
  private readonly sparkles: THREE.Mesh[] = [];
  private mode: SurpriseMode = 'hidden';
  private restoring = false;
  private elapsed = 0;
  private lastClock = performance.now();
  private messageMask = 0;
  private readonly startCamera = new THREE.Vector3();
  private readonly startTarget = new THREE.Vector3();
  private readonly cameraDirection = new THREE.Vector3();
  private readonly currentCamera = new THREE.Vector3();
  private readonly currentTarget = new THREE.Vector3();
  private readonly nextCamera = new THREE.Vector3();
  private readonly nextTarget = new THREE.Vector3();
  private readonly cameraShots: Record<'entrance' | 'twoShot' | 'wish' | 'final', CameraShot> = {
    entrance: { position: new THREE.Vector3(), target: new THREE.Vector3() },
    twoShot: { position: new THREE.Vector3(), target: new THREE.Vector3() },
    wish: { position: new THREE.Vector3(), target: new THREE.Vector3() },
    final: { position: new THREE.Vector3(), target: new THREE.Vector3() },
  };
  private cameraShotAspect = -1;
  private readonly transferWorld = new THREE.Vector3();
  private readonly transferStart = new THREE.Vector3();
  private readonly transferLocal = new THREE.Vector3();
  private readonly goalWorld = new THREE.Vector3();
  private transferActive = false;
  private gardenSpread = 2.45;
  private gardenZ = 2.35;
  private runStart: { munYi: CharacterSnapshot; ziNor: CharacterSnapshot } | null = null;
  private restoreStart: { munYi: CharacterSnapshot; ziNor: CharacterSnapshot } | null = null;
  private restoreTarget: { munYi: CharacterSnapshot; ziNor: CharacterSnapshot } | null = null;
  private gardenTarget: { munYi: CharacterSnapshot; ziNor: CharacterSnapshot } | null = null;
  private restoreElapsed = 0;
  private restoreDuration = 0;
  private readonly idleMunYiPhase = 0.7;
  private readonly idleZiNorPhase = 2.65;
  private flameBase: number;
  private readonly onState: (mode: SurpriseMode, mask: number) => void;

  constructor(private readonly options: SurpriseOptions) {
    const { scene, engine, munYi, ziNor, gift, cake, surpriseUI } = options;
    this.onState = (mode, mask) => surpriseUI.set(mode, mask);

    // The travel cake is a clone of the existing model, sharing its geometry and materials.
    this.travelCake = cake.root.clone(true);
    this.travelCake.scale.setScalar(0.235);
    this.travelCake.position.y = 0.05;
    const trayMaterial = new THREE.MeshPhysicalMaterial({ color: '#F7F3EC', roughness: 0.28, metalness: 0.08, clearcoat: 0.7 });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: '#D4B778', roughness: 0.28, metalness: 0.64 });
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.6, 0.065, 48), trayMaterial);
    tray.position.y = 0.015;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.012, 6, 48), trimMaterial);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.045;
    this.carrier.add(tray, rim, this.travelCake);

    const candleRoot = new THREE.Group();
    this.flameBase = 0.05 + CAKE_TOP * 0.235;
    const waxMaterial = new THREE.MeshPhysicalMaterial({ color: '#E5D9F0', roughness: 0.35, clearcoat: 0.2 });
    const flameColours = ['#FFD9AA', '#FFF0C7', '#F6D5FB', '#FFF0C7', '#FFD9AA'];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + Math.PI / 10;
      const x = Math.cos(angle) * 0.1;
      const z = Math.sin(angle) * 0.1;
      const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.023, 0.16, 10), waxMaterial);
      wax.position.set(x, this.flameBase + 0.08, z);
      candleRoot.add(wax);
      const flameMaterial = new THREE.MeshStandardMaterial({ color: flameColours[i], emissive: '#FF9F4C', emissiveIntensity: 0.05, roughness: 0.3, transparent: true, opacity: 0.8 });
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), flameMaterial);
      flame.scale.set(0.72, 1.55, 0.72);
      flame.position.set(x, this.flameBase + 0.19, z);
      flame.visible = false;
      this.flames.push(flame);
      this.flameMaterials.push(flameMaterial);
      candleRoot.add(flame);
    }
    this.carrier.add(candleRoot, this.cakeLight);
    this.cakeLight.position.set(0, this.flameBase + 0.27, 0);
    // A small uniform increase makes the pair read clearly behind the smaller cake.
    munYi.root.scale.multiplyScalar(1.06);
    ziNor.root.scale.multiplyScalar(1.06);
    this.characters.add(munYi.root, ziNor.root);
    scene.add(this.characters, this.cakeStand);
    this.characters.visible = true;
    this.cakeStand.visible = false;
    this.cakeStand.add(this.carrier);
    this.carrier.visible = false;

    this.createSparkles();
    scene.add(this.sparkleGroup);
    this.sparkleGroup.visible = false;
    this.cakeStand.position.set(0, 0.35, 2.62);
    gift.root.visible = true;
    surpriseUI.set('hidden', 0);

    this.placeGardenCharacters();
    engine.onResize(() => {
      if (this.mode === 'hidden' && !this.restoring) this.placeGardenCharacters();
    });

    engine.add((dt, time) => this.update(dt, time));
  }

  /** Keep the same two character roots beside the cake in the resting garden. */
  private placeGardenCharacters(): void {
    const { engine, munYi, ziNor } = this.options;
    const portrait = engine.aspect < 0.78;
    this.gardenSpread = portrait ? 0.78 : 1.0;
    this.gardenZ = 3.5;

    munYi.root.position.set(-this.gardenSpread, 0.35, this.gardenZ);
    ziNor.root.position.set(this.gardenSpread, 0.35, this.gardenZ);
    munYi.root.rotation.set(0, 0.2, 0);
    ziNor.root.rotation.set(0, -0.2, 0);
    this.setGardenPose(munYi, 0.1, 0.18, 0.05);
    this.setGardenPose(ziNor, -0.1, -0.18, 0.04);
    munYi.setWalking(false);
    ziNor.setWalking(false);
    this.characters.visible = true;
    this.gardenTarget = { munYi: snapshotCharacter(munYi), ziNor: snapshotCharacter(ziNor) };
  }

  private setGardenPose(character: Character, headTurn: number, gazeX: number, expression: number): void {
    const pose = character.pose;
    pose.leftLift = pose.rightLift = 0;
    pose.leftForward = pose.rightForward = 0;
    pose.headTurn = headTurn;
    pose.headTilt = -0.01;
    pose.gazeX = gazeX;
    pose.gazeY = -0.025;
    pose.expression = expression;
    pose.carrying = 0;
  }

  /** Keep the garden pose alive with slow, staggered glances between friend and cake. */
  private updateGardenAttention(dt: number, time: number): void {
    const respond = 1 - Math.exp(-Math.max(dt, 0) * 1.8);
    const glance = (phase: number, direction: number, character: Character): void => {
      const wave = 0.5 + 0.5 * Math.sin(time * 0.24 + phase);
      const cakeLook = smooth((wave - 0.72) / 0.24);
      const pose = character.pose;
      pose.headTurn = THREE.MathUtils.damp(pose.headTurn, direction * (0.1 + cakeLook * 0.035), dt, 1.35);
      pose.gazeX = THREE.MathUtils.damp(pose.gazeX, direction * (0.18 + cakeLook * 0.035), dt, 1.8);
      pose.gazeY = THREE.MathUtils.damp(pose.gazeY, -0.025 - cakeLook * 0.075, dt, 1.8);
      pose.headTilt = THREE.MathUtils.lerp(pose.headTilt, Math.sin(time * 0.17 + phase) * 0.012, respond);
    };
    glance(this.idleMunYiPhase, 1, this.options.munYi);
    glance(this.idleZiNorPhase, -1, this.options.ziNor);
  }

  private restoreCharacter(character: Character, start: CharacterSnapshot, target: CharacterSnapshot, amount: number): void {
    character.root.position.lerpVectors(start.position, target.position, amount);
    character.root.rotation.set(0, angleMix(start.yaw, target.yaw, amount), 0);
    const from = start.pose;
    const to = target.pose;
    const pose = character.pose;
    pose.leftLift = THREE.MathUtils.lerp(from.leftLift, to.leftLift, amount);
    pose.rightLift = THREE.MathUtils.lerp(from.rightLift, to.rightLift, amount);
    pose.leftForward = THREE.MathUtils.lerp(from.leftForward, to.leftForward, amount);
    pose.rightForward = THREE.MathUtils.lerp(from.rightForward, to.rightForward, amount);
    pose.headTurn = THREE.MathUtils.lerp(from.headTurn, to.headTurn, amount);
    pose.headTilt = THREE.MathUtils.lerp(from.headTilt, to.headTilt, amount);
    pose.gazeX = THREE.MathUtils.lerp(from.gazeX, to.gazeX, amount);
    pose.gazeY = THREE.MathUtils.lerp(from.gazeY, to.gazeY, amount);
    pose.expression = THREE.MathUtils.lerp(from.expression, to.expression, amount);
    pose.carrying = THREE.MathUtils.lerp(from.carrying, to.carrying, amount);
  }

  private readonly sparkleGroup = new THREE.Group();

  private makeSmallStand(): THREE.Group {
    const profile = [[0.001, 0], [0.38, 0], [0.4, 0.06], [0.26, 0.12], [0.15, 0.25], [0.13, 0.78], [0.2, 0.85], [0.56, 0.94], [0.58, 1.0], [0.001, 1.03]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const pedestal = new THREE.Mesh(
      new THREE.LatheGeometry(profile, 32),
      new THREE.MeshPhysicalMaterial({ color: '#EEE8F5', roughness: 0.34, metalness: 0.03, clearcoat: 0.45 }),
    );
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.018, 6, 40), new THREE.MeshStandardMaterial({ color: '#D4B778', metalness: 0.58, roughness: 0.3 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.99;
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: '#D8CCEA', roughness: 0.45 });
    const wheels = new THREE.Group();
    for (const x of [-0.3, 0.3]) {
      for (const z of [-0.3, 0.3]) {
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 6, 16), wheelMaterial);
        wheel.rotation.y = Math.PI / 2;
        wheel.position.set(x, 0.035, z);
        wheels.add(wheel);
      }
    }
    const stand = new THREE.Group();
    stand.add(pedestal, ring, wheels);
    stand.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = mesh.receiveShadow = true;
    });
    return stand;
  }

  private createSparkles(): void {
    const colours = ['#FFF1D5', '#E6D7FB', '#CDE0F3'];
    for (let i = 0; i < 10; i++) {
      const material = new THREE.MeshBasicMaterial({ color: colours[i % colours.length], transparent: true, opacity: 0.5, toneMapped: false });
      const sparkle = new THREE.Mesh(new THREE.OctahedronGeometry(0.025 + (i % 3) * 0.008, 0), material);
      sparkle.userData.phase = (i / 10) * Math.PI * 2;
      sparkle.userData.height = 1.05 + (i % 4) * 0.14;
      this.sparkles.push(sparkle);
      this.sparkleGroup.add(sparkle);
    }
  }

  get state(): SurpriseMode {
    return this.mode;
  }

  get canBegin(): boolean {
    return this.mode === 'hidden' && !this.restoring;
  }

  begin(): void {
    if (this.mode === 'playing' || this.restoring) return;
    const { engine, director, gift, munYi, ziNor, cake, candle } = this.options;
    if (this.mode === 'hidden') this.placeGardenCharacters();
    this.runStart = { munYi: snapshotCharacter(munYi), ziNor: snapshotCharacter(ziNor) };
    this.elapsed = 0;
    this.lastClock = performance.now();
    this.messageMask = 0;
    this.transferActive = false;
    this.resetCarrier();
    gift.setOpen(0);
    gift.setHover(false);
    gift.root.visible = true;
    this.characters.visible = true;
    this.options.cakeStand.visible = false;
    cake.root.visible = false;
    candle.root.visible = false;
    cake.warm(0);
    this.cakeStand.visible = false;
    this.sparkleGroup.visible = true;
    this.cakeLight.intensity = 0;
    this.sparkles.forEach((sparkle) => {
      sparkle.visible = false;
      (sparkle.material as THREE.MeshBasicMaterial).opacity = 0;
    });
    this.carrier.visible = true;
    this.carrier.position.set(0, 0.5, 0.33);
    ziNor.setWalking(false);
    munYi.setWalking(false);
    this.flames.forEach((flame) => (flame.visible = false));
    this.options.gift.root.visible = true;
    this.options.gift.root.position.set(engine.aspect > 1.15 ? -3.65 : -1.9, 0.37, 2.85);

    engine.camera.getWorldDirection(this.cameraDirection);
    this.startCamera.copy(engine.camera.position);
    this.startTarget.copy(engine.camera.position).addScaledVector(this.cameraDirection, 12);
    director.setCinematicShot(this.startCamera, this.startTarget);
    this.mode = 'playing';
    this.onState('playing', 0);
    this.refreshCameraShots();
    if (engine.reducedMotion) {
      this.elapsed = 31;
      this.applyFinalPose(31);
      this.finish();
      const final = this.cameraShots.final;
      director.setCinematicShot(final.position, final.target);
    }
    engine.invalidate();
  }

  skip(): void {
    if (this.mode !== 'playing') return;
    this.elapsed = 31;
    this.applyFinalPose(31);
    this.finish();
    this.refreshCameraShots();
    const final = this.cameraShots.final;
    this.options.director.setCinematicShot(final.position, final.target);
    this.options.engine.invalidate();
  }

  replay(): void {
    if (this.mode !== 'playing') this.begin();
  }

  backToCake(seconds = 1.1): void {
    if (this.mode === 'hidden') return;
    const { director, engine, gift, cake, candle } = this.options;
    const start = { munYi: snapshotCharacter(this.options.munYi), ziNor: snapshotCharacter(this.options.ziNor) };
    this.placeGardenCharacters();
    this.restoreTarget = this.gardenTarget;
    this.restoreStart = start;
    this.restoreCharacter(this.options.munYi, start.munYi, this.restoreTarget!.munYi, 0);
    this.restoreCharacter(this.options.ziNor, start.ziNor, this.restoreTarget!.ziNor, 0);
    this.restoreElapsed = 0;
    this.restoreDuration = engine.reducedMotion ? 0 : Math.max(0, seconds);
    if (this.restoreDuration > 0) {
      this.options.munYi.setWalking(start.munYi.position.distanceTo(this.restoreTarget!.munYi.position) > 0.04, 2.7);
      this.options.ziNor.setWalking(start.ziNor.position.distanceTo(this.restoreTarget!.ziNor.position) > 0.04, 2.7);
    }
    this.mode = 'hidden';
    this.elapsed = 0;
    this.characters.visible = true;
    this.cakeStand.visible = false;
    this.sparkleGroup.visible = false;
    gift.root.visible = true;
    gift.setOpen(0);
    gift.setHover(false);
    this.options.cakeStand.visible = true;
    cake.root.visible = true;
    candle.root.visible = true;
    cake.warm(candle.lit ? 1 : 0);
    this.restoring = this.restoreDuration > 0;
    this.resetCarrier();
    this.onState('hidden', 0);
    if (this.restoreDuration <= 0) {
      this.placeGardenCharacters();
      director.releaseShot();
      this.restoring = false;
      this.restoreStart = null;
      this.restoreTarget = null;
      this.onState('hidden', 0);
    } else {
      void director.backOut(this.restoreDuration).then(() => {
        if (this.restoring) this.placeGardenCharacters();
        this.restoring = false;
        this.restoreStart = null;
        this.restoreTarget = null;
        // The gift's accessible button was omitted while restoring; republish
        // the hidden scene actions once the gift can be activated again.
        this.onState('hidden', 0);
        engine.invalidate();
      });
    }
    engine.invalidate();
  }

  private resetCarrier(): void {
    const { scene, ziNor } = this.options;
    if (this.carrier.parent !== ziNor.root) {
      this.carrier.parent?.remove(this.carrier);
      ziNor.root.add(this.carrier);
    }
    this.carrier.position.set(0, 0.5, 0.33);
    this.carrier.rotation.set(0, 0, 0);
    this.carrier.scale.setScalar(1);
    this.cakeStand.visible = false;
    this.carrier.visible = this.mode !== 'hidden';
    scene.updateMatrixWorld(true);
  }

  private placeFinalCake(): void {
    const { scene, ziNor } = this.options;
    this.carrier.updateMatrixWorld(true);
    this.goalWorld.set(0, 1.42, 2.62).add(this.options.centre);
    ziNor.root.remove(this.carrier);
    scene.add(this.carrier);
    this.carrier.position.copy(scene.worldToLocal(this.goalWorld));
    this.carrier.rotation.set(0, 0, 0);
    this.carrier.scale.setScalar(1);
    this.carrier.visible = true;
    this.cakeStand.visible = true;
  }

  private finish(): void {
    this.mode = 'finished';
    this.options.ziNor.setWalking(false);
    this.options.cake.warm(1);
    this.options.cakeStand.visible = false;
    this.placeFinalCake();
    this.flames.forEach((flame) => (flame.visible = true));
    this.options.gift.root.visible = false;
    this.options.gift.setOpen(1);
    this.messageMask = 0b111;
    this.onState('finished', this.messageMask);
    this.options.engine.invalidate();
  }

  private update(dt: number, time: number): void {
    const { engine, director, gift, munYi, ziNor, cake } = this.options;
    const now = performance.now();
    // Keep the story timeline close to wall time on slow software renderers.
    // The engine still caps dt for procedural motion; only the keyframed
    // cinematic clock catches up when a rendered frame takes longer.
    const timelineDelta = Math.min(Math.max((now - this.lastClock) / 1000, 0), 1.5);
    this.lastClock = now;
    if (this.mode === 'hidden') {
      gift.update(time, gift.root.visible);
      if (this.restoring && this.restoreStart && this.restoreTarget) {
        this.restoreElapsed += dt;
        const progress = smooth(this.restoreElapsed / this.restoreDuration);
        this.restoreCharacter(munYi, this.restoreStart.munYi, this.restoreTarget.munYi, progress);
        this.restoreCharacter(ziNor, this.restoreStart.ziNor, this.restoreTarget.ziNor, progress);
        if (this.restoreElapsed >= this.restoreDuration) {
          this.placeGardenCharacters();
          this.restoring = false;
          this.restoreStart = null;
          this.restoreTarget = null;
        }
      }
      if (director.current === 'letter') {
        if (!this.restoring) this.updateGardenAttention(dt, time);
        munYi.update(dt, time);
        ziNor.update(dt, time);
      }
      return;
    }

    if (this.mode === 'playing') {
      this.elapsed += timelineDelta;
      if (this.elapsed >= 31) {
        this.elapsed = 31;
        this.applyFinalPose(this.elapsed);
        this.finish();
      }
    }

    const t = this.mode === 'playing' ? this.elapsed : 31;
    if (this.mode === 'playing') this.applyFinalPose(t);
    gift.update(time, t < 2.35);
    munYi.update(dt, time);
    ziNor.update(dt, time, this.mode === 'playing' ? timelineDelta : dt);

    // Wish moment: warm candle glow and a few slowly rising sparkles.
    const warmth = smooth((t - 16.2) / 2.2);
    cake.warm(warmth);
    this.cakeLight.intensity = warmth * (0.75 + Math.sin(time * 7.4) * 0.12);
    for (let index = 0; index < this.flames.length; index++) {
      const flame = this.flames[index];
      flame.visible = t >= 16.2;
      const flicker = 0.92 + Math.sin(time * (7.2 + index * 0.23) + index) * 0.08;
      flame.scale.y = 1.55 * flicker;
      flame.rotation.z = Math.sin(time * 3.1 + index) * 0.08;
      this.flameMaterials[index].emissiveIntensity = warmth * 1.2;
    }
    for (let index = 0; index < this.sparkles.length; index++) {
      const sparkle = this.sparkles[index];
      const phase = sparkle.userData.phase as number;
      const height = sparkle.userData.height as number;
      const lift = ((time * 0.14 + phase / (Math.PI * 2)) % 1) * 0.48;
      sparkle.position.set(Math.cos(phase + time * 0.12) * 1.15, height + lift, 2.28 + Math.sin(phase + time * 0.12) * 0.55);
      (sparkle.material as THREE.MeshBasicMaterial).opacity = warmth * (0.24 + (Math.sin(time * 2.2 + phase) + 1) * 0.18);
      sparkle.visible = warmth > 0.02;
    }

    if (this.mode === 'playing') {
      const mask = t >= 27.1 ? 0b111 : t >= 24.7 ? 0b011 : t >= 22.5 ? 0b001 : 0;
      if (mask !== this.messageMask) {
        this.messageMask = mask;
        this.onState('playing', mask);
      }
      this.updateCamera(t, director);
    }
    if (engine.reducedMotion && this.mode === 'playing') engine.invalidate();
  }

  private applyFinalPose(time: number): void {
    const { munYi, ziNor, gift } = this.options;
    const start = this.runStart;
    if (!start) return;
    const setup = smooth(time / 2.2);
    const walk = smooth((time - 2.5) / 6.5);
    const spread = this.options.engine.aspect < 0.78 ? 1.05 : 1.35;
    const carryX = 0.45;
    const presentationX = 0.38;
    let ziX = mix(start.ziNor.position.x, this.gardenSpread, setup);
    if (time >= 2.5) ziX = mix(this.gardenSpread, carryX, walk);
    if (time >= 11.4 && time < 12.4) ziX = mix(carryX, presentationX, (time - 11.4) / 1);
    else if (time >= 12.4 && time < 14.3) ziX = presentationX;
    else if (time >= 14.3) ziX = mix(presentationX, spread, (time - 14.3) / 1.65);
    const munX = mix(start.munYi.position.x, -spread, setup);
    const ziZ = mix(start.ziNor.position.z, 2.3, setup);
    const munZ = mix(start.munYi.position.z, 2.3, setup);
    ziNor.root.position.set(ziX, start.ziNor.position.y, ziZ);
    munYi.root.position.set(munX, start.munYi.position.y, munZ);

    const surprise = smooth((time - 8.7) / 1.6);
    const present = smooth((time - 9.8) / 1.6);
    const wish = smooth((time - 15) / 1.5);
    const headAttention = smooth((time - 2.45) / 4.8);
    const bodyAttention = smooth((time - 4.7) / 4.2);
    const approachWalk = smooth((time - 2.25) / 0.45) * (1 - smooth((time - 8.25) / 1.0));
    const presentationStep = time >= 11.4 && time < 12.45;
    const munSettling = time < 2.25 && Math.hypot(start.munYi.position.x + spread, start.munYi.position.z - 2.3) > 0.04;
    const ziSettling = time < 2.25 && Math.hypot(start.ziNor.position.x - this.gardenSpread, start.ziNor.position.z - 2.3) > 0.04;
    munYi.setWalking(munSettling, 2.7);
    ziNor.setWalking(ziSettling || approachWalk > 0.015 || presentationStep, presentationStep ? 3.2 : 5.4);
    const carrying = 1 - smooth((time - 13.9) / 0.55);
    ziNor.pose.carrying = THREE.MathUtils.lerp(start.ziNor.pose.carrying, carrying, setup);

    // Recalculate both friends' headings from their moving positions each frame.
    // Mun Yi turns her head first, then her body follows; both targets move with
    // Zi Nor and shift to the cake for the wish.
    const munFriendYaw = Math.atan2(ziNor.root.position.x - munYi.root.position.x, ziNor.root.position.z - munYi.root.position.z);
    const ziFriendYaw = Math.atan2(munYi.root.position.x - ziNor.root.position.x, munYi.root.position.z - ziNor.root.position.z);
    const munCakeYaw = Math.atan2(-munYi.root.position.x, 2.62 - munYi.root.position.z);
    const ziCakeYaw = Math.atan2(-ziNor.root.position.x, 2.62 - ziNor.root.position.z);
    const munLookYaw = mix(munFriendYaw, munCakeYaw, wish);
    const ziLookYaw = mix(ziFriendYaw, ziCakeYaw, wish);
    const munTravelYaw = angleMix(start.munYi.yaw, 0, setup);
    const ziTravelYaw = angleMix(start.ziNor.yaw, -Math.PI / 2, setup);
    munYi.root.rotation.y = angleMix(munTravelYaw, munLookYaw * 0.45, bodyAttention);
    ziNor.root.rotation.y = angleMix(ziTravelYaw, ziLookYaw * 0.45, smooth((time - 8.4) / 1.2));
    const munHeadStart = start.munYi.yaw + start.munYi.pose.headTurn;
    const ziHeadStart = start.ziNor.yaw + start.ziNor.pose.headTurn;
    const munHeadTarget = angleMix(munHeadStart, munLookYaw, headAttention);
    const ziHeadTarget = angleMix(ziHeadStart, ziLookYaw, headAttention);
    munYi.pose.headTurn = THREE.MathUtils.clamp(munHeadTarget - munYi.root.rotation.y, -0.56, 0.56);
    ziNor.pose.headTurn = THREE.MathUtils.clamp(ziHeadTarget - ziNor.root.rotation.y, -0.56, 0.56);
    munYi.pose.headTilt = THREE.MathUtils.lerp(start.munYi.pose.headTilt, -0.035 * surprise + wish * 0.035, setup);
    munYi.pose.expression = THREE.MathUtils.lerp(start.munYi.pose.expression, 0.48 * surprise + 0.12 * present * (1 - wish), setup);
    ziNor.pose.expression = THREE.MathUtils.lerp(start.ziNor.pose.expression, 0.16 * headAttention + 0.12 * present, setup);
    munYi.pose.gazeX = THREE.MathUtils.lerp(start.munYi.pose.gazeX, THREE.MathUtils.clamp((munLookYaw - munYi.root.rotation.y - munYi.pose.headTurn) * 2, -1, 1), headAttention);
    ziNor.pose.gazeX = THREE.MathUtils.lerp(start.ziNor.pose.gazeX, THREE.MathUtils.clamp((ziLookYaw - ziNor.root.rotation.y - ziNor.pose.headTurn) * 2, -1, 1), headAttention);
    munYi.pose.gazeY = THREE.MathUtils.lerp(start.munYi.pose.gazeY, 0.04 * surprise - 0.55 * wish, headAttention);
    ziNor.pose.gazeY = THREE.MathUtils.lerp(start.ziNor.pose.gazeY, -0.42 * wish, headAttention);
    munYi.pose.leftLift = THREE.MathUtils.lerp(start.munYi.pose.leftLift, 0.38 * present * (1 - wish) - 0.52 * wish, setup);
    munYi.pose.rightLift = THREE.MathUtils.lerp(start.munYi.pose.rightLift, 0.3 * present * (1 - wish) - 0.52 * wish, setup);
    munYi.pose.leftForward = THREE.MathUtils.lerp(start.munYi.pose.leftForward, 0.5 * wish, setup);
    munYi.pose.rightForward = THREE.MathUtils.lerp(start.munYi.pose.rightForward, 0.5 * wish, setup);

    ziNor.pose.leftForward = THREE.MathUtils.lerp(start.ziNor.pose.leftForward, mix(0.7, 0.98, present) * (1 - wish * 0.25), setup);
    ziNor.pose.rightForward = THREE.MathUtils.lerp(start.ziNor.pose.rightForward, mix(0.7, 0.98, present) * (1 - wish * 0.25), setup);
    ziNor.pose.leftLift = THREE.MathUtils.lerp(start.ziNor.pose.leftLift, mix(0.08, 0.19, present), setup);
    ziNor.pose.rightLift = THREE.MathUtils.lerp(start.ziNor.pose.rightLift, mix(0.08, 0.19, present), setup);
    if (time < 12.4) this.carrier.position.set(0, 0.5 + present * 0.13, 0.33 + present * 0.13);

    if (time < 2.35) {
      gift.setOpen(smooth(time / 1.45));
      gift.root.visible = true;
    } else {
      gift.root.visible = false;
    }

    if (time < 14.3) {
      this.carrier.visible = true;
      if (time >= 12.4) {
        const progress = smooth((time - 12.4) / 1.9);
        this.options.ziNor.root.updateMatrixWorld(true);
        this.carrier.updateMatrixWorld(true);
        if (!this.transferActive) {
          this.transferStart.copy(this.carrier.getWorldPosition(this.transferLocal));
          this.transferActive = true;
        }
        this.goalWorld.set(0, 1.42, 2.62).add(this.options.centre);
        this.transferWorld.lerpVectors(this.transferStart, this.goalWorld, progress);
        this.options.ziNor.root.updateMatrixWorld(true);
        this.transferLocal.copy(this.transferWorld);
        this.options.ziNor.root.worldToLocal(this.transferLocal);
        this.carrier.position.copy(this.transferLocal);
      }
    } else if (this.carrier.parent === this.options.ziNor.root) {
      this.placeFinalCake();
    }

    const standProgress = smooth((time - 12.2) / 2.1);
    this.cakeStand.position.set(-0.3 * (1 - standProgress), 0.35, 2.62);
    this.cakeStand.visible = time >= 12.2;
    if (time >= 14.3) {
      this.options.ziNor.pose.leftForward = this.options.ziNor.pose.rightForward = 0.28 * (1 - wish * 0.35);
      this.options.ziNor.pose.leftLift = this.options.ziNor.pose.rightLift = 0.02;
    }
  }

  private refreshCameraShots(): void {
    const { engine } = this.options;
    if (Math.abs(engine.aspect - this.cameraShotAspect) < 0.0001) return;
    this.cameraShotAspect = engine.aspect;
    this.setShot(this.cameraShots.entrance, 7.1, 5.3, 1.9, 0.85, 0.1);
    this.setShot(this.cameraShots.twoShot, 6.0, 4.65, 0.78, 1.75, 0.35);
    this.setShot(this.cameraShots.wish, 5.0, 3.95, 0.4, 1.75, 0.35);
    this.setShot(this.cameraShots.final, engine.aspect < 0.78 ? 4.5 : 6.2, 4.8, 0.75);
  }

  private setShot(shot: CameraShot, width: number, height: number, extraDistance: number, cameraX = 0.15, targetX = 0): void {
    const distance = Math.max(
      height / (2 * Math.tan(THREE.MathUtils.degToRad(this.options.engine.camera.fov / 2))),
      width / (2 * Math.tan(THREE.MathUtils.degToRad(this.options.engine.camera.fov / 2)) * this.options.engine.aspect),
    ) + extraDistance;
    shot.target.set(targetX, 1.68, 2.08).add(this.options.centre);
    shot.position.set(cameraX, 3.65, 2.08 + distance).add(this.options.centre);
  }

  private updateCamera(time: number, director: Director): void {
    this.refreshCameraShots();
    const { entrance, twoShot, wish, final } = this.cameraShots;
    this.currentCamera.copy(this.startCamera);
    this.currentTarget.copy(this.startTarget);

    if (time < 1.8) {
      this.nextCamera.copy(entrance.position);
      this.nextTarget.copy(entrance.target);
      this.currentCamera.lerp(this.nextCamera, smooth(time / 1.8));
      this.currentTarget.lerp(this.nextTarget, smooth(time / 1.8));
    } else if (time < 8.8) {
      const push = 0.22 * smooth((time - 5.8) / 3);
      this.currentCamera.copy(entrance.position).lerp(twoShot.position, push);
      this.currentTarget.copy(entrance.target);
    } else if (time < 11.0) {
      const push = 0.22 + 0.78 * smooth((time - 8.8) / 2.2);
      this.currentCamera.copy(entrance.position).lerp(twoShot.position, push);
      this.currentTarget.copy(entrance.target).lerp(twoShot.target, smooth((time - 8.8) / 2.2));
    } else if (time < 17.3) {
      this.currentCamera.copy(twoShot.position);
      this.currentTarget.copy(twoShot.target);
    } else if (time < 19.5) {
      this.currentCamera.copy(twoShot.position).lerp(wish.position, smooth((time - 17.3) / 2.2));
      this.currentTarget.copy(twoShot.target).lerp(wish.target, smooth((time - 17.3) / 2.2));
    } else if (time < 21.6) {
      this.currentCamera.copy(wish.position).lerp(final.position, smooth((time - 19.5) / 2.1));
      this.currentTarget.copy(wish.target).lerp(final.target, smooth((time - 19.5) / 2.1));
    } else {
      this.currentCamera.copy(final.position);
      this.currentTarget.copy(final.target);
    }
    director.setCinematicShot(this.currentCamera, this.currentTarget);
  }
}
