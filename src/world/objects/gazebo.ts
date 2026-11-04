import * as THREE from 'three';
import { shadowed } from './helpers';

const COLUMNS = 8;
const RADIUS = 7.4;

const stone = (color: string, roughness = 0.5) => new THREE.MeshStandardMaterial({ color, roughness });

/** A pale garden pavilion around the cake, hung with tiny lights that wake with the candle. */
export class Gazebo {
  readonly root = new THREE.Group();
  /** Height of the plinth top, where the cake stand sits. */
  readonly tableTop = 1.34;
  private readonly bulbs: THREE.InstancedMesh;
  private readonly bulbMaterial: THREE.MeshStandardMaterial;

  constructor() {
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.6, 0.34, 56), stone('#ECEAF2', 0.62));
    floor.position.y = 0.05;
    const step = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.3, 0.14, 56), stone('#F4F3F6', 0.48));
    step.position.y = 0.28;
    const inlay = new THREE.Mesh(new THREE.RingGeometry(3.1, 3.22, 64), new THREE.MeshStandardMaterial({ color: '#C8BCE8', roughness: 0.4 }));
    inlay.rotation.x = -Math.PI / 2;
    inlay.position.y = 0.352;
    this.root.add(floor, step, inlay);

    // A turned marble plinth, its mouldings made with a lathe.
    const profile = [
      [0.001, 0], [1.2, 0], [1.2, 0.09], [1.05, 0.13], [0.98, 0.2], [0.72, 0.28], [0.62, 0.4], [0.58, 0.75],
      [0.62, 0.92], [0.74, 0.98], [0.98, 1.02], [1.08, 1.06], [1.08, 1.0 + 0.1], [0.001, 1.1],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const plinth = new THREE.Mesh(new THREE.LatheGeometry(profile, 56), stone('#F2F0F5', 0.34));
    plinth.position.y = 0.25;
    this.root.add(plinth);

    // Slim columns and a ring beam stand behind the cake and never block it.
    const column = this.columnGeometry();
    const material = stone('#F3F2F6', 0.46);
    const top = new THREE.Vector3();
    for (let i = 0; i < COLUMNS; i++) {
      const angle = (i / COLUMNS) * Math.PI * 2 + Math.PI / COLUMNS;
      if (Math.sin(angle) > 0.5) continue; // Leave the front open toward the viewer.
      const mesh = new THREE.Mesh(column, material);
      mesh.position.set(Math.cos(angle) * RADIUS, 0.3, Math.sin(angle) * RADIUS);
      this.root.add(mesh);
    }
    const beam = new THREE.Mesh(new THREE.TorusGeometry(RADIUS, 0.11, 10, 72, Math.PI * 1.5), material);
    beam.rotation.x = Math.PI / 2;
    beam.rotation.z = Math.PI * 0.75;
    beam.position.y = 8;
    this.root.add(beam);
    top.set(0, 9, 0);

    // Fine ribs rising to a small crown, like a garden birdcage.
    for (let i = 0; i < COLUMNS; i++) {
      const angle = (i / COLUMNS) * Math.PI * 2 + Math.PI / COLUMNS;
      if (Math.sin(angle) > 0.5) continue;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(Math.cos(angle) * RADIUS, 8, Math.sin(angle) * RADIUS),
        new THREE.Vector3(Math.cos(angle) * RADIUS * 0.82, 10.2, Math.sin(angle) * RADIUS * 0.82),
        new THREE.Vector3(0, 11.2, 0),
      );
      this.root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.045, 6), material));
    }
    shadowed(this.root);
    floor.castShadow = step.castShadow = false;

    // Strings of lights hang in swags from one column top to the next, along the beam, on a fine wire.
    const strands: THREE.Vector3[] = [];
    const per = 12;
    const standing = Array.from({ length: COLUMNS }, (_, i) => (i / COLUMNS) * Math.PI * 2 + Math.PI / COLUMNS).filter((angle) => Math.sin(angle) <= 0.5);
    const wire = new THREE.MeshStandardMaterial({ color: '#C9C4D6', roughness: 0.5 });
    for (let s = 0; s < standing.length; s++) {
      const a = standing[s];
      const b = standing[(s + 1) % standing.length];
      // Only neighbouring columns: the open front has no columns to hang from.
      let span = b - a;
      if (span <= 0) span += Math.PI * 2;
      if (span > Math.PI / 2) continue;
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= per; i++) {
        const t = i / per;
        const angle = a + span * t;
        const sag = Math.sin(t * Math.PI);
        const radius = RADIUS - 0.14 - sag * 0.35;
        const point = new THREE.Vector3(Math.cos(angle) * radius, 7.9 - sag * 0.75, Math.sin(angle) * radius);
        points.push(point);
        if (i > 0 && i < per) strands.push(point.clone().setY(point.y - 0.06));
      }
      this.root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.012, 4), wire));
    }
    this.bulbMaterial = new THREE.MeshStandardMaterial({ color: '#F4F1FA', emissive: '#FFD9A8', emissiveIntensity: 0, roughness: 0.3 });
    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.052, 7, 5), this.bulbMaterial, strands.length);
    const matrix = new THREE.Matrix4();
    strands.forEach((point, index) => this.bulbs.setMatrixAt(index, matrix.setPosition(point)));
    this.root.add(this.bulbs);
  }

  private columnGeometry(): THREE.BufferGeometry {
    const height = 7.72;
    const profile = [
      [0.001, 0], [0.34, 0], [0.34, 0.1], [0.27, 0.16], [0.2, 0.24], [0.15, height * 0.55], [0.14, height - 0.34],
      [0.19, height - 0.24], [0.28, height - 0.1], [0.3, height], [0.001, height],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(profile, 18);
  }

  lightUp(amount: number): void {
    this.bulbMaterial.emissiveIntensity = amount * 2.4;
  }
}
