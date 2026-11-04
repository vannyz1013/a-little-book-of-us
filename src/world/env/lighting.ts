import * as THREE from 'three';
import type { Director } from '../core/director';
import type { Engine } from '../core/engine';
import { clamp, lerp } from '../core/noise';
import { CENTRES, ORDER } from '../layout';

interface Mood {
  zenith: string;
  horizon: string;
  fog: string;
  hemiSky: string;
  hemiGround: string;
  sun: string;
  sunStrength: number;
  fill: number;
}

/** The light of each place: an afternoon that slowly becomes a lavender dusk. */
const MOODS: Mood[] = [
  { zenith: '#A5C4E8', horizon: '#ECE6F7', fog: '#E3E2F4', hemiSky: '#EDF1FF', hemiGround: '#BFD8C5', sun: '#FFF3E4', sunStrength: 3.1, fill: 1.5 },
  { zenith: '#B3BCEB', horizon: '#EFE7F4', fog: '#E5E1F4', hemiSky: '#EFEEFF', hemiGround: '#C9DCCB', sun: '#FFEFE6', sunStrength: 3.0, fill: 1.3 },
  { zenith: '#9CA3DA', horizon: '#E6DCF0', fog: '#D9D3EC', hemiSky: '#D7D7F4', hemiGround: '#B4CABC', sun: '#F8E4E6', sunStrength: 1.55, fill: 1.2 },
];

const WARM = { fog: new THREE.Color('#E8CFD3'), hemi: new THREE.Color('#F3D9C4'), horizon: new THREE.Color('#F4E0D6') };

const SUN_DIRECTION = new THREE.Vector3(0.55, 1, 0.5).normalize();

export class Atmosphere {
  readonly sun = new THREE.DirectionalLight('#ffffff', 3);
  readonly hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1.4);
  /** 0 before the candle is lit, 1 once its warmth has filled the air. */
  warmth = 0;
  readonly zenith = new THREE.Color();
  readonly horizon = new THREE.Color();
  private readonly fog = new THREE.Fog('#ffffff', 26, 118);
  private readonly moods = MOODS.map((mood) => ({
    zenith: new THREE.Color(mood.zenith),
    horizon: new THREE.Color(mood.horizon),
    fog: new THREE.Color(mood.fog),
    hemiSky: new THREE.Color(mood.hemiSky),
    hemiGround: new THREE.Color(mood.hemiGround),
    sun: new THREE.Color(mood.sun),
    sunStrength: mood.sunStrength,
    fill: mood.fill,
  }));

  constructor(private readonly engine: Engine, private readonly director: Director) {
    const { scene, tier } = engine;
    scene.fog = this.fog;
    scene.add(this.hemi, this.sun, this.sun.target);

    if (tier.shadows > 0) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(tier.shadows, tier.shadows);
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.04;
      this.sun.shadow.radius = 7;
      this.sun.shadow.intensity = 0.5;
      const camera = this.sun.shadow.camera;
      camera.left = camera.bottom = -17;
      camera.right = camera.top = 17;
      camera.near = 2;
      camera.far = 90;
    }
    this.buildEnvironment();
    engine.add((_dt, time) => this.update(time));
  }

  /** A soft studio of sky colours, so polished materials have something to reflect. */
  private buildEnvironment(): void {
    const room = new THREE.Scene();
    const geometry = new THREE.SphereGeometry(10, 24, 16);
    const colours: number[] = [];
    const top = new THREE.Color('#DDE6FA');
    const bottom = new THREE.Color('#D6E6DA');
    const mid = new THREE.Color('#FFF8F4');
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i) / 10;
      const colour = y > 0 ? mid.clone().lerp(top, y) : mid.clone().lerp(bottom, -y);
      colours.push(colour.r, colour.g, colour.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    room.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const generator = new THREE.PMREMGenerator(this.engine.renderer);
    this.engine.scene.environment = generator.fromScene(room, 0.04).texture;
    this.engine.scene.environmentIntensity = 0.42;
    generator.dispose();
    geometry.dispose();
  }

  private update(time: number): void {
    const stops = ORDER.length - 1;
    const stations = ORDER.map((id) => this.director.stopOf(id));
    const u = this.director.progress;
    let index = 0;
    while (index < stops - 1 && u > stations[index + 1]) index++;
    const t = clamp((u - stations[index]) / (stations[index + 1] - stations[index]));
    const a = this.moods[index];
    const b = this.moods[index + 1];

    this.zenith.lerpColors(a.zenith, b.zenith, t);
    this.horizon.lerpColors(a.horizon, b.horizon, t).lerp(WARM.horizon, this.warmth * 0.4);
    this.fog.color.lerpColors(a.fog, b.fog, t).lerp(WARM.fog, this.warmth * 0.5);
    this.hemi.color.lerpColors(a.hemiSky, b.hemiSky, t).lerp(WARM.hemi, this.warmth * 0.45);
    this.hemi.groundColor.lerpColors(a.hemiGround, b.hemiGround, t);
    // The light breathes very slightly, as on a day with high, thin cloud.
    const breath = 1 + Math.sin(time * 0.23) * 0.025 + Math.sin(time * 0.071 + 1.3) * 0.015;
    this.hemi.intensity = (lerp(a.fill, b.fill, t) + this.warmth * 0.22) * breath;
    this.sun.color.lerpColors(a.sun, b.sun, t);
    this.sun.intensity = lerp(a.sunStrength, b.sunStrength, t);

    // The shadow area follows the place we are nearest to.
    const nearest = ORDER.reduce((best, id) => (Math.abs(this.director.stopOf(id) - u) < Math.abs(this.director.stopOf(best) - u) ? id : best));
    const focus = this.director.current ? CENTRES[this.director.flying ? nearest : this.director.current] : CENTRES.home;
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(SUN_DIRECTION, 44);
  }
}
