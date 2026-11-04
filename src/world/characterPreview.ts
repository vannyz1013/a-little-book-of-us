import * as THREE from 'three';
import { Engine } from './core/engine';
import { Character } from './objects/character';

type View = 'full' | 'side' | 'left-side' | 'back' | 'mun-hair' | 'zi-hair' | 'mun-face' | 'zi-face' | 'mun-earrings' | 'zi-earrings' | 'mun-necklace' | 'zi-necklace' | 'mun-bracelet' | 'zi-bracelet';

const VIEWS: { id: View; label: string }[] = [
  { id: 'full', label: 'Full body · front' },
  { id: 'left-side', label: 'Left side' },
  { id: 'side', label: 'Right side' },
  { id: 'back', label: 'Back' },
  { id: 'mun-hair', label: 'Mun Yi · hair' },
  { id: 'zi-hair', label: 'Zi Nor · hair' },
  { id: 'mun-face', label: 'Mun Yi · face' },
  { id: 'zi-face', label: 'Zi Nor · face' },
  { id: 'mun-earrings', label: 'Mun Yi · earrings' },
  { id: 'zi-earrings', label: 'Zi Nor · earrings' },
  { id: 'mun-necklace', label: 'Mun Yi · necklace' },
  { id: 'zi-necklace', label: 'Zi Nor · necklace' },
  { id: 'mun-bracelet', label: 'Mun Yi · bracelet' },
  { id: 'zi-bracelet', label: 'Zi Nor · bracelet' },
];

/** A quiet, actual-WebGL stage for reviewing the two characters before they join the world. */
export async function startCharacterPreview(root: HTMLElement): Promise<void> {
  root.replaceChildren();
  root.classList.add('character-review');

  const stage = document.createElement('div');
  stage.className = 'world-stage character-review__stage';
  root.append(stage);
  const engine = new Engine(stage);
  const { scene, camera } = engine;
  scene.background = new THREE.Color('#ECE5F5');
  scene.fog = new THREE.Fog('#ECE5F5', 18, 34);

  const hemi = new THREE.HemisphereLight('#F8F5FF', '#D8D3DF', 2.05);
  const sun = new THREE.DirectionalLight('#FFF4E8', 2.5);
  sun.position.set(-3, 6, 5);
  sun.castShadow = engine.tier.shadows > 0;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -4;
  sun.shadow.camera.right = sun.shadow.camera.top = 4;
  sun.shadow.bias = -0.0004;
  const fill = new THREE.DirectionalLight('#DCEBFF', 0.75);
  fill.position.set(4, 3, 2);
  // A soft rear rim makes the newly shaped hair volumes readable during
  // side/back review without changing the front-facing key light.
  const rearFill = new THREE.DirectionalLight('#DCE4FF', 1.1);
  rearFill.position.set(-1.5, 3.5, -4);
  scene.add(hemi, sun, fill, rearFill);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(7, 56), new THREE.MeshStandardMaterial({ color: '#E1E8E1', roughness: 0.94 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const munYi = new Character('munYi');
  const ziNor = new Character('ziNor');
  munYi.root.position.set(-0.72, 0, 0);
  munYi.root.rotation.y = 0.08;
  ziNor.root.position.set(0.72, 0, 0);
  ziNor.root.rotation.y = -0.08;
  scene.add(munYi.root, ziNor.root);
  engine.add((dt, time) => {
    munYi.update(dt, time);
    ziNor.update(dt, time);
  });

  const header = document.createElement('header');
  header.className = 'character-review__header';
  const title = document.createElement('h1');
  title.textContent = 'Mun Yi & Zi Nor';
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Three.js character preview';
  header.append(title, subtitle);

  const toolbar = document.createElement('nav');
  toolbar.className = 'character-review__views';
  toolbar.setAttribute('aria-label', 'Character preview views');
  const label = document.createElement('p');
  label.className = 'character-review__view-label';
  label.setAttribute('aria-live', 'polite');
  const mobileSelect = document.createElement('select');
  mobileSelect.className = 'character-review__select';
  mobileSelect.setAttribute('aria-label', 'Character preview view');
  for (const option of VIEWS) {
    const item = document.createElement('option');
    item.value = option.id;
    item.textContent = option.label;
    mobileSelect.append(item);
  }
  const buttons = new Map<View, HTMLButtonElement>();
  const requestedView = new URLSearchParams(location.search).get('view') as View | null;
  let view: View = VIEWS.some((option) => option.id === requestedView) ? requestedView! : 'full';

  const frame = (): void => {
    const portrait = engine.aspect < 1;
    // Front and back use a horizontal pair. The side camera looks along world X,
    // so separate the silhouettes along Z instead of stacking them in depth.
    const sideView = view === 'side' || view === 'left-side';
    const hairView = view === 'mun-hair' || view === 'zi-hair';
    munYi.root.visible = view !== 'zi-hair';
    ziNor.root.visible = view !== 'mun-hair';
    if (hairView) {
      munYi.root.position.set(0, 0, 0);
      ziNor.root.position.set(0, 0, 0);
      munYi.root.rotation.y = ziNor.root.rotation.y = 0;
    } else if (sideView) {
      const gap = portrait ? 0.7 : 1.12;
      munYi.root.position.set(0, 0, gap);
      ziNor.root.position.set(0, 0, -gap);
      munYi.root.rotation.y = ziNor.root.rotation.y = 0;
    } else {
      const gap = view === 'back' ? (portrait ? 0.72 : 0.84) : (portrait ? 0.62 : 0.72);
      munYi.root.position.set(-gap, 0, 0);
      ziNor.root.position.set(gap, 0, 0);
      munYi.root.rotation.y = view === 'back' ? 0 : 0.08;
      ziNor.root.rotation.y = view === 'back' ? 0 : -0.08;
    }
    const mun = munYi.root.position;
    const zi = ziNor.root.position;
    const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    switch (view) {
      case 'side':
      case 'left-side':
        {
          const pairWidth = portrait ? 2.9 : 3.55;
          const horizontalFit = pairWidth / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * engine.aspect);
          const distance = Math.max(portrait ? 8.8 : 4.8, horizontalFit * 1.08);
          camera.position.copy(at(view === 'left-side' ? -distance : distance, 1.42, 0));
          camera.lookAt(at(0, 1.14, 0));
        }
        break;
      case 'back':
        {
          const pairWidth = portrait ? 3.0 : 3.25;
          const horizontalFit = pairWidth / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * engine.aspect);
          camera.position.set(0, 1.34, -Math.max(4.8, horizontalFit * 1.1));
          camera.lookAt(at(0, 1.12, 0));
        }
        break;
      case 'mun-hair':
      case 'zi-hair': {
        const character = view === 'mun-hair' ? munYi : ziNor;
        const longHairCloseup = view === 'mun-hair';
        camera.position.copy(character.root.position).add(at(0, longHairCloseup ? 1.9 : 1.85, longHairCloseup ? -3.55 : -3));
        camera.lookAt(character.root.position.clone().add(at(0, longHairCloseup ? 1.72 : 1.5, 0)));
        break;
      }
      case 'mun-face':
        camera.position.copy(mun).add(at(-0.02, 1.78, 1.95));
        camera.lookAt(mun.clone().add(at(0, 1.77, 0)));
        break;
      case 'zi-face':
        camera.position.copy(zi).add(at(0.02, 1.78, 1.95));
        camera.lookAt(zi.clone().add(at(0, 1.77, 0)));
        break;
      case 'mun-earrings':
      case 'zi-earrings': {
        const character = view === 'mun-earrings' ? munYi : ziNor;
        const x = view === 'mun-earrings' ? -1 : 1;
        camera.position.copy(character.root.position).add(at(x * 0.48, 1.56, 1.18));
        camera.lookAt(character.root.position.clone().add(at(x * 0.34, 1.55, 0.12)));
        break;
      }
      case 'mun-necklace':
      case 'zi-necklace': {
        const character = view === 'mun-necklace' ? munYi : ziNor;
        camera.position.copy(character.root.position).add(at(0.1, 1.24, 1.68));
        camera.lookAt(character.root.position.clone().add(at(0, 1.24, 0.09)));
        break;
      }
      case 'mun-bracelet':
      case 'zi-bracelet': {
        const character = view === 'mun-bracelet' ? munYi : ziNor;
        character.root.updateMatrixWorld(true);
        const wrist = character.handRight.getWorldPosition(new THREE.Vector3());
        camera.position.copy(wrist).add(at(0.42, 0.24, 0.86));
        camera.lookAt(wrist.clone().add(at(0, 0, 0.02)));
        break;
      }
      default:
        {
          const pairWidth = portrait ? 2.58 : 2.9;
          const horizontalFit = pairWidth / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * engine.aspect);
          const distance = Math.max(4.45, horizontalFit * 1.1);
          camera.position.set(0, 1.35, distance);
          camera.lookAt(0, 1.16, 0);
        }
        break;
    }
    camera.updateProjectionMatrix();
  };

  const setView = (next: View): void => {
    view = next;
    const current = VIEWS.find((option) => option.id === view)!;
    label.textContent = current.label;
    mobileSelect.value = view;
    for (const [id, button] of buttons) button.setAttribute('aria-pressed', String(id === view));
    frame();
    engine.invalidate();
  };

  for (const option of VIEWS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = option.label;
    button.setAttribute('aria-pressed', String(option.id === view));
    button.addEventListener('click', () => setView(option.id));
    buttons.set(option.id, button);
    toolbar.append(button);
  }
  mobileSelect.addEventListener('change', () => setView(mobileSelect.value as View));
  toolbar.append(mobileSelect);
  const footer = document.createElement('footer');
  footer.className = 'character-review__footer';
  footer.append(label);
  root.append(header, toolbar, footer);

  setView(view);
  engine.onResize(frame);
  const raycaster = new THREE.Raycaster();
  engine.renderer.domElement.addEventListener('pointerdown', (event) => {
    const bounds = engine.renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1), camera);
    const hit = raycaster.intersectObjects([munYi.root, ziNor.root], true)[0];
    if (!hit) return;
    let object: THREE.Object3D | null = hit.object;
    while (object && object !== munYi.root && object !== ziNor.root) object = object.parent;
    (object === munYi.root ? munYi : ziNor).wave();
  });

  (window as unknown as Record<string, unknown>).__preview = {
    ready: true,
    wave: (who: 'munYi' | 'ziNor') => (who === 'munYi' ? munYi : ziNor).wave(),
    setView,
    view: () => view,
    stats: () => {
      let geometry = 0;
      for (const who of [munYi, ziNor]) {
        who.root.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (mesh.geometry) geometry += (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.getAttribute('position').count) / 3;
        });
      }
      return { view, calls: engine.drawCalls, renderedTriangles: engine.triangles, characterTriangles: Math.round(geometry) };
    },
    geometryReport: () => [munYi, ziNor].map((who) => {
      const invalid: { surface: string; type: string; vertices: number; invalidVertices: number }[] = [];
      who.root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh || !mesh.geometry) return;
        const position = mesh.geometry.getAttribute('position');
        let invalidVertices = 0;
        for (let i = 0; i < position.count; i++) {
          if (!Number.isFinite(position.getX(i)) || !Number.isFinite(position.getY(i)) || !Number.isFinite(position.getZ(i))) invalidVertices++;
        }
        if (invalidVertices) invalid.push({ surface: mesh.name || 'unnamed', type: mesh.geometry.type, vertices: position.count, invalidVertices });
      });
      return { character: who.name, invalid };
    }),
  };
  await engine.renderer.compileAsync(scene, camera);
  engine.start();
}
