import * as THREE from 'three';

/** A small storybook gift that serves as the accessible entry point to the surprise. */
export class GiftBox {
  readonly root = new THREE.Group();
  readonly hit = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.3, 1.45), new THREE.MeshBasicMaterial({ visible: false }));
  private readonly lid = new THREE.Group();
  private readonly sparkles: THREE.Mesh[] = [];
  private readonly home = new THREE.Vector3(-3.65, 0.37, 2.85);
  private hover = 0;
  private opened = 0;

  constructor() {
    const lavender = new THREE.MeshPhysicalMaterial({ color: '#BCA8DF', roughness: 0.42, clearcoat: 0.28, clearcoatRoughness: 0.36 });
    const powder = new THREE.MeshPhysicalMaterial({ color: '#BFD8F0', roughness: 0.4, clearcoat: 0.3 });
    const gold = new THREE.MeshStandardMaterial({ color: '#D6B778', metalness: 0.62, roughness: 0.31 });
    const ivory = new THREE.MeshStandardMaterial({ color: '#FFF9F1', roughness: 0.6 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.7, 1.08), lavender);
    base.position.y = 0.35;
    base.castShadow = base.receiveShadow = true;
    this.root.add(base);

    const frontRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.72, 1.1), powder);
    frontRibbon.position.y = 0.35;
    const sideRibbon = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.72, 0.17), powder);
    sideRibbon.position.y = 0.35;
    this.root.add(frontRibbon, sideRibbon);

    // A fine warm-gold edge separates the lid from the wrapped box.
    const lidBand = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.045, 1.15), gold);
    lidBand.position.y = 0.72;
    this.root.add(lidBand);
    this.lid.position.y = 0.74;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 1.2), lavender);
    top.position.y = 0.1;
    top.castShadow = top.receiveShadow = true;
    this.lid.add(top);
    const topRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.205, 1.21), powder);
    topRibbon.position.y = 0.1;
    const crossRibbon = new THREE.Mesh(new THREE.BoxGeometry(1.21, 0.205, 0.18), powder);
    crossRibbon.position.y = 0.1;
    this.lid.add(topRibbon, crossRibbon);
    this.root.add(this.lid);

    // Soft sculpted ribbon loops instead of a flat bow silhouette.
    for (const side of [-1, 1]) {
      const points = Array.from({ length: 17 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return new THREE.Vector3(side * 0.18 + Math.cos(a) * 0.2, 0.25 + Math.sin(a) * 0.115, Math.sin(a) * 0.045);
      });
      const loop = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'centripetal'), 32, 0.026, 7, false), powder);
      this.lid.add(loop);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 10), gold);
    knot.position.set(0, 0.25, 0.015);
    knot.scale.set(1, 0.72, 0.62);
    this.lid.add(knot);

    // The front label is a real texture on the 3D box, not overlay text.
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 768;
    labelCanvas.height = 190;
    const context = labelCanvas.getContext('2d');
    if (context) {
      context.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
      context.fillStyle = '#59416F';
      context.font = 'italic 500 76px "Cormorant Garamond"';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.shadowColor = 'rgba(74, 48, 104, .18)';
      context.shadowBlur = 8;
      context.fillText('A Little Surprise...', labelCanvas.width / 2, labelCanvas.height / 2 + 1);
    }
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    labelTexture.colorSpace = THREE.SRGBColorSpace;
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.3, 0.018), ivory);
    plaque.position.set(0, 0.35, 0.553);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.22), new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true, toneMapped: false }));
    label.position.set(0, 0.35, 0.565);
    this.root.add(plaque, label);

    // A restrained botanical motif echoes the character embroidery.
    const stem = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.39, 0.13, 0.56), new THREE.Vector3(0.32, 0.22, 0.565), new THREE.Vector3(0.28, 0.31, 0.565)]), 10, 0.006, 4, false),
      gold,
    );
    this.root.add(stem);
    for (const [x, y, r] of [[0.32, 0.2, -0.5], [0.29, 0.28, 0.55], [-0.4, 0.16, 0.45]] as const) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: '#C6D8C4', roughness: 0.56 }));
      leaf.position.set(x, y, 0.566);
      leaf.scale.set(0.07, 0.027, 0.009);
      leaf.rotation.z = r;
      this.root.add(leaf);
    }

    const glimmerMaterial = new THREE.MeshBasicMaterial({ color: '#FFF3D4', transparent: true, opacity: 0.65, toneMapped: false });
    for (let i = 0; i < 7; i++) {
      const sparkle = new THREE.Mesh(new THREE.OctahedronGeometry(0.025 + (i % 3) * 0.006, 0), glimmerMaterial);
      sparkle.userData.phase = (i / 7) * Math.PI * 2;
      sparkle.userData.radius = 0.66 + (i % 2) * 0.18;
      this.sparkles.push(sparkle);
      this.root.add(sparkle);
    }

    this.hit.position.y = 0.72;
    this.root.add(this.hit);
    this.root.position.copy(this.home);
    this.root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh && mesh !== this.hit) mesh.castShadow = mesh.receiveShadow = true;
    });
  }

  setHover(value: boolean): void {
    this.hover = value ? 1 : 0;
  }

  setOpen(value: number): void {
    this.opened = THREE.MathUtils.clamp(value, 0, 1);
  }

  update(time: number, active = true): void {
    if (!active) return;
    this.root.position.y = this.home.y + Math.sin(time * 1.35) * 0.035;
    const scale = 1 + this.hover * 0.025 + Math.sin(time * 1.35) * 0.008;
    this.root.scale.setScalar(scale);
    this.lid.rotation.x = this.opened * 0.72;
    this.lid.position.y = 0.74 + this.opened * 0.12;
    this.sparkles.forEach((sparkle) => {
      const phase = sparkle.userData.phase as number;
      const radius = sparkle.userData.radius as number;
      sparkle.position.set(Math.cos(phase + time * 0.24) * radius, 0.76 + Math.sin(time * 1.1 + phase) * 0.12, Math.sin(phase + time * 0.24) * radius);
      const pulse = 0.55 + Math.sin(time * 2 + phase) * 0.35;
      (sparkle.material as THREE.MeshBasicMaterial).opacity = pulse;
      sparkle.visible = this.opened < 0.82;
    });
  }
}
