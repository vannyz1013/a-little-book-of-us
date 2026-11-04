import * as THREE from 'three';
import type { Engine } from '../core/engine';
import { easeOut } from '../core/tween';
import { softDot } from '../core/textures';
import { halo, shadowed } from './helpers';

const HEIGHT = 0.72;

/** A slim, twisted candle with a true flame, and the only warm light in the world. */
export class Candle {
  readonly root = new THREE.Group();
  readonly light = new THREE.PointLight('#FFC08A', 0, 15, 1.7);
  readonly hit: THREE.Mesh;
  lit = false;
  private readonly flame: THREE.Mesh;
  private readonly flameMaterial: THREE.ShaderMaterial;
  private readonly glow: THREE.Sprite;
  private readonly wide: THREE.Sprite;
  private readonly hint: THREE.Sprite;
  private power = 0;

  constructor(private readonly engine: Engine) {
    const geometry = new THREE.CylinderGeometry(0.085, 0.095, HEIGHT, 20, 36);
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      const angle = Math.atan2(z, x);
      const twist = 1 + Math.cos(angle * 3 + y * 14) * 0.2;
      position.setXYZ(i, x * twist, y, z * twist);
    }
    geometry.computeVertexNormals();
    geometry.translate(0, HEIGHT / 2, 0);
    const wax = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#D9D1F1', roughness: 0.34 }));
    this.root.add(wax);

    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.1, 5), new THREE.MeshStandardMaterial({ color: '#4A4A5A', roughness: 0.9 }));
    wick.position.y = HEIGHT + 0.05;
    this.root.add(wick);
    shadowed(this.root);

    // A teardrop flame, shaded from a white heart to an amber edge.
    const profile: THREE.Vector2[] = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      profile.push(new THREE.Vector2(Math.max(Math.sin(Math.PI * t ** 0.62) ** 1.15 * (1 - t * 0.42) * 0.105, 0.0005), t * 0.46));
    }
    this.flameMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uPower: { value: 0 } },
      vertexShader: /* glsl */ `
        varying float vHeight;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vHeight = position.y / 0.46;
          vNormal = normalize(normalMatrix * normal);
          vec4 view = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(-view.xyz);
          gl_Position = projectionMatrix * view;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uPower;
        varying float vHeight;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float facing = pow(max(dot(normalize(vNormal), normalize(vView)), 0.0), 1.4);
          vec3 edge = mix(vec3(1.0, 0.5, 0.18), vec3(1.0, 0.72, 0.35), vHeight);
          vec3 heart = vec3(1.0, 0.96, 0.84);
          vec3 colour = mix(edge, heart, facing * (1.0 - vHeight * 0.55));
          // The blue foot of a real candle flame.
          colour = mix(vec3(0.42, 0.5, 0.95), colour, smoothstep(0.02, 0.2, vHeight));
          gl_FragColor = vec4(colour, uPower * (0.25 + facing * 0.8));
        }`,
    });
    const flameGeometry = new THREE.LatheGeometry(profile, 16);
    this.flame = new THREE.Mesh(flameGeometry, this.flameMaterial);
    this.flame.position.y = HEIGHT + 0.07;
    this.flame.visible = false;
    this.root.add(this.flame);

    const dot = softDot(engine);
    this.glow = halo(dot, '#FFD29A', 1.1);
    this.glow.position.y = HEIGHT + 0.26;
    this.wide = halo(dot, '#FFC59A', 5.4);
    this.wide.position.y = HEIGHT + 0.2;
    this.hint = halo(dot, '#FFF7E2', 0.7);
    this.hint.position.y = HEIGHT + 0.12;
    this.root.add(this.glow, this.wide, this.hint);

    this.light.position.set(0, HEIGHT + 0.42, 0.25);
    this.root.add(this.light);

    // Bigger than the candle, so it is an easy target for a finger.
    this.hit = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.9, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = HEIGHT * 0.65;
    this.root.add(this.hit);

    engine.add((_, time) => this.update(time));
  }

  async ignite(onWarmth: (amount: number) => void): Promise<void> {
    if (this.lit) return;
    this.lit = true;
    this.flame.visible = true;
    this.hint.visible = false;
    await this.engine.tweens.to(3.2, (t) => {
      this.power = t;
      onWarmth(t);
    }, easeOut);
  }

  /** Restore the lit state instantly. */
  private update(time: number): void {
    if (!this.root.parent?.parent?.visible) return;
    if (!this.lit) {
      (this.hint.material as THREE.SpriteMaterial).opacity = 0.34 + Math.sin(time * 1.9) * 0.2;
      return;
    }
    const breath = Math.sin(time * 8.3) * 0.05 + Math.sin(time * 13.7) * 0.035 + Math.sin(time * 3.1) * 0.05;
    const appear = Math.min(this.power * 3, 1);
    this.flame.scale.set(appear * (1 - breath * 0.5), appear * (1 + breath), appear * (1 - breath * 0.5));
    this.flame.rotation.z = Math.sin(time * 5.1) * 0.035;
    this.flameMaterial.uniforms.uPower.value = appear;
    this.light.intensity = this.power * (9 + breath * 6);
    (this.glow.material as THREE.SpriteMaterial).opacity = appear * (0.4 + breath);
    (this.wide.material as THREE.SpriteMaterial).opacity = this.power * (0.055 + breath * 0.04);
  }
}
