import * as THREE from 'three';
import { birthdayContent, type Memory } from '../../data/birthdayContent';
import { seeded } from '../core/noise';
import { createButterflies } from '../env/butterflies';
import { plantGrove } from '../env/trees';
import { plantPatch } from '../env/vegetation';
import { CENTRES, poseFor, scatterInView } from '../layout';
import { FRAME_SIZE, PhotoFrame } from '../objects/photoFrame';
import type { WorldContext } from './context';

export interface MemoryGardenScene {
  group: THREE.Group;
  layout: () => void;
}

/** Scene 2: three framed photographs hanging in the air above a garden of flowers. */
export async function createMemoryGarden(
  context: WorldContext,
  onChoose: (memory: Memory, frame: PhotoFrame) => void,
): Promise<MemoryGardenScene> {
  const { engine, interaction, dot } = context;
  const centre = CENTRES.memories;
  const group = new THREE.Group();
  const frames = new THREE.Group();
  group.add(frames);
  engine.scene.add(group);

  plantPatch(engine, group, { centre, radius: 42, keepClear: 7, view: { halfWidth: 10, back: 3, front: 20 }, grass: 7600, lavender: 640, flowers: 520, seed: 202, eye: new THREE.Vector3(0, 0, 16) });
  plantGrove(engine, group, {
    seed: 11, centre,
    points: [
      [-49, -92], [-40, -98], [-27, -102], [-14, -100], [-3, -93], [-56, -80], [4, -82], [-52, -66], [2, -62], [-20, -109], [-36, -110],
    ],
  });
  createButterflies(engine, interaction, group, centre, 8, 5);

  const pieces = birthdayContent.memories.map((memory, index) => new PhotoFrame(engine, memory, index, dot));
  await Promise.all(pieces.map((piece) => piece.build()));
  pieces.forEach((piece, index) => {
    frames.add(piece.root, piece.post);
    const memory = birthdayContent.memories[index];
    interaction.add({
      id: `memory-${index + 1}`,
      page: 'memories',
      label: `View photo ${index + 1}`,
      hit: piece.hit,
      onHover: (hovered) => piece.setHover(hovered),
      onNear: (amount) => piece.setNear(amount),
      onActivate: () => onChoose(memory, piece),
    });
  });

  const layout = (): void => {
    const pose = poseFor('memories', engine.camera);
    const slots = scatterInView(pieces.length, engine.camera, pose, seeded(5), { top: 0.19, bottom: 0.15, rowDepth: 3 });
    pieces.forEach((piece, index) => {
      const slot = slots[index];
      piece.place(slot.position, (slot.size / FRAME_SIZE) * 0.84, pose.position);
    });
  };
  layout();
  engine.onResize(layout);
  return { group, layout };
}
