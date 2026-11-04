import * as THREE from 'three';
import { createButterflies, type Swarm } from '../env/butterflies';
import { plantGrove } from '../env/trees';
import { plantPatch } from '../env/vegetation';
import { CENTRES, fitDistance, isShortScreen, poseFor, sceneState, type LetterFit } from '../layout';
import type { LetterBounds } from '../ui/hud';
import type { BirthdayCinematicUI } from '../ui/birthdayCinematic';
import { Cake, CAKE_TOP } from '../objects/cake';
import { Candle } from '../objects/candle';
import { Character } from '../objects/character';
import { GiftBox } from '../objects/giftBox';
import { Gazebo } from '../objects/gazebo';
import { contactShadow, shadowed } from '../objects/helpers';
import { LetterEnvelope } from '../objects/letterEnvelope';
import type { WorldContext } from './context';
import { BirthdaySurprise } from './birthdaySurprise';

/** Height of the envelope pedestal above the pavilion floor. */
const PEDESTAL_TOP = 2.2;
/** The cake reads clearly behind the friends when the full display is scaled together. */
const CAKE_DISPLAY_SCALE = 0.84;
/** Tall screens: where the opened envelope stands, in front of the cake. */
const OPEN_SCALE = 0.55;
const OPEN_Z = 5.9;

/** A turned marble pedestal with a shallow ledge, matching the cake plinth. */
function displayPedestal(): THREE.Group {
  const marble = new THREE.MeshStandardMaterial({ color: '#F2F0F5', roughness: 0.36 });
  const h = PEDESTAL_TOP;
  const profile = [
    [0.001, 0], [0.46, 0], [0.46, 0.08], [0.36, 0.14], [0.26, 0.24], [0.2, 0.4], [0.17, h * 0.5], [0.18, h - 0.36],
    [0.24, h - 0.24], [0.34, h - 0.14], [0.36, h - 0.06], [0.001, h - 0.06],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const column = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), marble);
  // A low rim at the back of the top slab keeps the envelope from tipping.
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.62), marble);
  slab.position.y = h - 0.02;
  const lip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.05), marble);
  lip.position.set(0, h + 0.08, -0.26);
  const group = new THREE.Group();
  group.add(column, slab, lip);
  return shadowed(group);
}

export interface BirthdayScene {
  group: THREE.Group;
  cake: Cake;
  candle: Candle;
  envelope: LetterEnvelope;
  gazebo: Gazebo;
  swarm: Swarm;
  cakeCentre: THREE.Vector3;
  gift: GiftBox;
  surprise: BirthdaySurprise;
  layout: (smooth?: boolean) => void;
  onScreen: () => { letterTop: number; letterTextBottom: number; cakeFront: number; candleTop: number };
}

/** A porcelain footed stand, the sort of piece a good baker keeps for one occasion. */
function cakeStand(): THREE.Group {
  const profile = [
    [0.001, 0], [0.72, 0], [0.74, 0.03], [0.62, 0.07], [0.3, 0.13], [0.16, 0.22], [0.13, 0.34], [0.17, 0.46],
    [0.42, 0.53], [2.02, 0.56], [2.06, 0.6], [2.02, 0.64], [0.001, 0.62],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const stand = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 72),
    new THREE.MeshPhysicalMaterial({ color: '#F7F6FA', roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
  );
  return shadowed(new THREE.Group().add(stand));
}

/** Scene 4: the highlight of the journey, at dusk under a pavilion of tiny lights. */
export function createBirthdayGarden(
  context: WorldContext,
  onCandle: () => void,
  onEnvelope: () => void,
  letterBounds: () => LetterBounds | null,
  surpriseUI: BirthdayCinematicUI,
): BirthdayScene {
  const { engine, interaction, dot, director } = context;
  const centre = CENTRES.letter;
  const group = new THREE.Group();
  group.position.copy(centre);
  const backdrop = new THREE.Group();
  engine.scene.add(group, backdrop);

  plantPatch(engine, backdrop, { centre, radius: 44, keepClear: 11, view: { halfWidth: 10, back: 0, front: 26 }, grass: 6400, lavender: 800, flowers: 380, seed: 303 });
  plantGrove(engine, backdrop, {
    seed: 17, centre,
    points: [
      [8, -222], [16, -228], [26, -232], [38, -230], [49, -224], [57, -212], [3, -210], [59, -198], [-1, -196], [20, -240], [44, -240],
    ],
  });
  // The whole scene toggles together, including the planting behind the pavilion.
  group.add(backdrop);
  backdrop.position.copy(centre).negate();

  const gazebo = new Gazebo();
  group.add(gazebo.root);

  const stand = cakeStand();
  stand.position.y = gazebo.tableTop;
  stand.scale.setScalar(CAKE_DISPLAY_SCALE);
  group.add(stand);

  const cake = new Cake(engine);
  cake.root.scale.setScalar(CAKE_DISPLAY_SCALE);
  cake.root.position.y = gazebo.tableTop + 0.64 * CAKE_DISPLAY_SCALE;
  group.add(cake.root);

  const candle = new Candle(engine);
  candle.root.scale.setScalar(CAKE_DISPLAY_SCALE);
  candle.root.position.y = cake.root.position.y + CAKE_TOP * CAKE_DISPLAY_SCALE + 0.03;
  group.add(candle.root);

  const gift = new GiftBox();
  group.add(gift.root);

  const pool = contactShadow(dot, 7, 7, 0.26);
  pool.position.y = 0.36;
  group.add(pool);

  const envelope = new LetterEnvelope(engine);
  group.add(envelope.root);

  // On wide screens the envelope stands beside the cake, on a slim marble pedestal of its own.
  const pedestal = displayPedestal();
  pedestal.position.set(4.7, 0.35, 1.2);
  group.add(pedestal);

  const swarm = createButterflies(engine, interaction, group, new THREE.Vector3(0, 1.4, 0), 7, 13);

  const munYi = new Character('munYi');
  const ziNor = new Character('ziNor');
  const surprise = new BirthdaySurprise({
    engine,
    director,
    scene: group,
    centre,
    gift,
    munYi,
    ziNor,
    cake,
    cakeStand: stand,
    candle,
    surpriseUI,
  });

  const cakeCentre = new THREE.Vector3(0, cake.root.position.y + (CAKE_TOP * CAKE_DISPLAY_SCALE) / 2, 0).add(centre);

  // ---- Fitting the open letter on tall screens ----
  // Every check is made on screen, in CSS pixels, so it holds for any phone and
  // for the browser's own bars and safe areas.
  const probe = new THREE.PerspectiveCamera();
  const holder = new THREE.Object3D();
  const point = new THREE.Vector3();
  const MARGIN = 8;
  const candleTop = new THREE.Vector3(0, candle.root.position.y + 1.05 * CAKE_DISPLAY_SCALE, 0).add(centre);
  // The front of the bottom tier is nearest the camera, so it is the edge the letter must stay below.
  const cakeFront = new THREE.Vector3(0, cake.root.position.y, 1.72 * CAKE_DISPLAY_SCALE).add(centre);

  const screenY = (world: THREE.Vector3): number => {
    point.copy(world).project(probe);
    return ((1 - point.y) / 2) * engine.renderer.domElement.clientHeight;
  };
  const aim = (position: THREE.Vector3, target: THREE.Vector3): void => {
    probe.copy(engine.camera);
    probe.position.copy(position);
    probe.lookAt(target);
    probe.updateMatrixWorld();
  };
  /** Screen heights of the paper's top edge and of the last line of writing. */
  const letterOnScreen = (spot: THREE.Vector3, scale: number, eye: THREE.Vector3): { top: number; textBottom: number; mouth: number } => {
    holder.position.copy(spot);
    holder.scale.setScalar(scale);
    holder.lookAt(eye);
    holder.updateMatrixWorld();
    const at = (y: number) => screenY(holder.localToWorld(new THREE.Vector3(0, y, 0)).add(centre));
    return { top: at(envelope.preview.top), textBottom: at(envelope.preview.textBottom), mouth: at(envelope.preview.mouth) };
  };

  interface Placement {
    spot: THREE.Vector3;
    scale: number;
    fit: LetterFit | null;
  }

  /** The open letter's place on a tall screen: the usual one if it fits, or a fitted framing. */
  const tallOpenPlacement = (): Placement => {
    const scale = isShortScreen() ? OPEN_SCALE * 0.9 : OPEN_SCALE;
    const floor = 0.35 + scale * 0.99;
    const usual: Placement = { spot: new THREE.Vector3(0, floor, OPEN_Z), scale, fit: null };
    const bounds = letterBounds();
    // Not measurable while another scene is showing: keep the last fitted framing.
    if (!bounds) return { ...usual, spot: envelope.restingSpot(), fit: sceneState.fit };

    const width = engine.renderer.domElement.clientWidth;
    /** Lowest stand height at which the writing clears the controls, or null if none does. */
    const standHeight = (eye: THREE.Vector3, scale: number, floor: number, z: number): number | null => {
      const limit = bounds.bottom - MARGIN;
      const textBottom = (y: number) => letterOnScreen(new THREE.Vector3(0, y, z), scale, eye).textBottom;
      if (textBottom(floor) <= limit) return floor;
      let low = floor;
      let high = floor + 3;
      if (textBottom(high) > limit) return null;
      for (let step = 0; step < 14; step++) {
        const middle = (low + high) / 2;
        if (textBottom(middle) <= limit) high = middle;
        else low = middle;
      }
      return high;
    };
    /** The stand height and the letter's height on screen, if this framing works. */
    const check = (position: THREE.Vector3, target: THREE.Vector3, scale: number, z: number, strict: boolean): { y: number; size: number } | null => {
      aim(position, target);
      if (screenY(candleTop) < bounds.top + MARGIN) return null;
      const eye = position.clone().sub(centre);
      const floor = 0.35 + scale * 0.99;
      const y = standHeight(eye, scale, floor, z);
      if (y === null) return null;
      const spot = new THREE.Vector3(0, y, z);
      const letter = letterOnScreen(spot, scale, eye);
      if (letter.top < screenY(cakeFront)) return null;
      // Where there is room, the open mouth of the envelope stays in sight too,
      // so the letter is seen to come out of it.
      if (strict && letterOnScreen(spot, scale, eye).mouth > bounds.bottom - MARGIN) return null;
      // The whole envelope must stay inside the screen's width.
      point.set(envelope.preview.halfWidth, 0, 0);
      holder.localToWorld(point).add(centre).project(probe);
      if (((point.x + 1) / 2) * width > width - MARGIN) return null;
      return { y, size: letter.textBottom - letter.top };
    };

    sceneState.fit = null;
    const plain = poseFor('letter', engine.camera);
    if (check(plain.position, plain.target, scale, OPEN_Z, true)?.y === floor) return usual;

    // Stand back a little and look lower until the candle, the cake, the letter and
    // the controls each have their own space, choosing the framing that shows the
    // letter largest. The cake may shrink to two thirds of its size at most. The
    // envelope may rise off the floor; its foot is then hidden behind the controls.
    const distance = fitDistance(engine.camera, 6.7, 11.5);
    const search = (strict: boolean): (Placement & { size: number }) | null => {
      let best: (Placement & { size: number }) | null = null;
      for (let zoom = 1; zoom <= 1.5; zoom += 0.04) {
        for (const size of [1, 0.9, 0.8]) {
          for (const z of [OPEN_Z, OPEN_Z + 1.2, OPEN_Z + 2.4]) {
            for (let drop = 0; drop <= 3.5; drop += 0.1) {
              const fit = { eye: 5 + drop * 0.7, target: 4.6 - drop, zoom };
              const position = new THREE.Vector3(0, fit.eye, distance * zoom).add(centre);
              const target = new THREE.Vector3(0, fit.target, 0).add(centre);
              const result = check(position, target, scale * size, z, strict);
              if (result && (!best || result.size > best.size)) {
                best = { spot: new THREE.Vector3(0, result.y, z), scale: scale * size, fit, size: result.size };
              }
            }
          }
        }
      }
      return best;
    };
    const best = search(true) ?? search(false);
    if (best) return best;
    console.warn('The open letter could not be fitted on this screen.');
    return usual;
  };

  const layout = (smooth = false): void => {
    // Keep the tappable surprise inside the narrower portrait composition.
    gift.root.position.x = engine.aspect > 1.15 ? -3.65 : -1.9;
    gift.root.position.z = 2.85;
    if (engine.aspect <= 1.15 && sceneState.letterOpen) {
      const before = JSON.stringify(sceneState.fit);
      const placement = tallOpenPlacement();
      sceneState.fit = placement.fit;
      const local = poseFor('letter', engine.camera).position.clone().sub(centre);
      if (smooth) void envelope.glide(placement.spot, placement.scale, local);
      else envelope.place(placement.spot, placement.scale, local);
      pedestal.visible = false;
      // A new framing on a resize is taken at once; the smooth case glides with the camera.
      if (!smooth && JSON.stringify(sceneState.fit) !== before && director.current === 'letter' && !director.flying) {
        director.jump('letter');
      }
      return;
    }
    const pose = poseFor('letter', engine.camera);
    // Beside the cake on wide screens, in front of it on tall ones.
    const local = pose.position.clone().sub(centre);
    const wide = engine.aspect > 1.15;
    if (wide) envelope.place(new THREE.Vector3(4.7, PEDESTAL_TOP + 0.35 + 0.82 * 0.99, 1.2), 0.82, local);
    else envelope.place(new THREE.Vector3(0, 1.05, 3.6), 0.72, local);
    pedestal.visible = wide;
    pedestal.rotation.y = Math.atan2(local.x - 4.7, local.z - 1.2);
  };
  layout();
  engine.onResize(layout);

  interaction.add({
    id: 'candle',
    page: 'letter',
    label: 'Light the candle',
    hit: candle.hit,
    enabled: () => !candle.lit,
    onActivate: onCandle,
  });
  interaction.add({
    id: 'birthday-gift',
    page: 'letter',
    label: 'A Little Surprise...',
    hit: gift.hit,
    enabled: () => surprise.canBegin && gift.root.visible,
    onHover: (hovered) => gift.setHover(hovered),
    onActivate: () => surprise.begin(),
  });
  interaction.add({
    id: 'envelope',
    page: 'letter',
    label: 'Open your letter',
    hit: envelope.hit,
    enabled: () => envelope.isVisible(),
    onHover: (hovered) => envelope.setHover(hovered),
    onNear: (amount) => envelope.setNear(amount),
    onActivate: onEnvelope,
  });

  /** For QA: where the open letter, the cake and the candle are on screen right now. */
  const onScreen = () => {
    probe.copy(engine.camera);
    probe.updateMatrixWorld();
    const y = (local: number) => screenY(envelope.root.localToWorld(new THREE.Vector3(0, local, 0)));
    return {
      letterTop: y(envelope.preview.top),
      letterTextBottom: y(envelope.preview.textBottom),
      cakeFront: screenY(cakeFront),
      candleTop: screenY(candleTop),
    };
  };

  return { group, cake, candle, envelope, gazebo, swarm, cakeCentre, gift, surprise, layout, onScreen };
}
