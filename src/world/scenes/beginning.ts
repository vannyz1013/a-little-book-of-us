import * as THREE from 'three';
import { createButterflies } from '../env/butterflies';
import { groundHeight } from '../env/terrain';
import { plantGrove } from '../env/trees';
import { plantPatch } from '../env/vegetation';
import { CENTRES } from '../layout';
import { contactShadow } from '../objects/helpers';
import { StoryBook } from '../objects/book';
import type { WorldContext } from './context';

export interface BeginningScene {
  group: THREE.Group;
  book: StoryBook;
}

/** Scene 1: the floating storybook, waiting in a quiet garden. */
export async function createBeginning(context: WorldContext, onOpen: () => void): Promise<BeginningScene> {
  const { engine, interaction, dot } = context;
  const centre = CENTRES.home;
  const group = new THREE.Group();
  engine.scene.add(group);

  plantPatch(engine, group, { centre, radius: 44, keepClear: 5, view: { halfWidth: 4.5, back: 2, front: 22 }, grass: 7600, lavender: 560, flowers: 560, seed: 101 });
  plantGrove(engine, group, {
    seed: 7, centre,
    points: [
      [-19, -14], [-26, -7], [-32, -22], [17, -15], [25, -8], [33, -24], [-9, -30], [10, -33], [-42, -6], [44, -10], [-22, -36], [26, -40],
    ],
  });

  const book = new StoryBook(engine, centre.clone().add(new THREE.Vector3(0, 3.4, 0)));
  await book.build();
  group.add(book.root);

  const shadow = contactShadow(dot, 7, 4.4, 0.3);
  shadow.position.set(centre.x, groundHeight(centre.x, centre.z) + 0.04, centre.z);
  group.add(shadow);

  createButterflies(engine, interaction, group, centre, 12, 3);

  interaction.add({
    id: 'book',
    page: 'home',
    label: 'Open the book',
    hit: book.hit,
    onHover: (hovered) => book.setHover(hovered),
    onNear: (amount) => book.setNear(amount),
    onActivate: onOpen,
  });
  return { group, book };
}
