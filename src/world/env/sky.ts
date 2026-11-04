import * as THREE from 'three';
import type { Engine } from '../core/engine';
import type { Atmosphere } from './lighting';

/** A gradient dome with slow painted clouds, drawn behind everything. */
export function createSky(engine: Engine, atmosphere: Atmosphere): void {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    defines: engine.tier.skyClouds ? { CLOUDS: 1 } : {},
    uniforms: {
      uZenith: { value: atmosphere.zenith },
      uHorizon: { value: atmosphere.horizon },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = clip.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform float uTime;
      varying vec3 vDirection;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.1 + 3.7; a *= 0.5; }
        return v;
      }
      void main() {
        vec3 d = normalize(vDirection);
        float h = clamp(d.y * 1.5 + 0.08, 0.0, 1.0);
        vec3 colour = mix(uHorizon, uZenith, pow(h, 0.72));
        #ifdef CLOUDS
          vec2 p = d.xz / (abs(d.y) + 0.22) * 1.1 + vec2(uTime * 0.006, 0.0);
          float c = smoothstep(0.47, 0.74, fbm(p));
          colour = mix(colour, vec3(0.985, 0.98, 0.99), c * 0.75 * smoothstep(0.0, 0.2, d.y));
        #endif
        gl_FragColor = vec4(colour, 1.0);
      }`,
  });

  const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 20), material);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  engine.scene.add(dome);
  engine.add((_, time) => {
    material.uniforms.uTime.value = time;
    dome.position.copy(engine.camera.position);
  });
}
