import * as THREE from 'three';
import type { Engine } from '../core/engine';
import type { Interaction } from '../core/interaction';
import { seeded } from '../core/noise';
import { softDot } from '../core/textures';

const BOX = 26;

/**
 * Drifting pollen. Its positions wrap around the camera in the shader, so a few
 * hundred points fill the whole world and cost no JavaScript per frame.
 */
export function createParticles(engine: Engine, interaction: Interaction): { warmth: { value: number } } {
  const count = Math.round(320 * Math.max(engine.tier.density, 0.4));
  const random = seeded(12);
  const seeds = new Float32Array(count * 4);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = random() * BOX;
    positions[i * 3 + 1] = random() * BOX;
    positions[i * 3 + 2] = random() * BOX;
    seeds[i * 4] = random();
    seeds[i * 4 + 1] = random();
    seeds[i * 4 + 2] = random();
    seeds[i * 4 + 3] = random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));

  const warmth = { value: 0 };
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uMap: { value: softDot(engine) },
      uTime: { value: 0 },
      uCamera: { value: new THREE.Vector3() },
      uPointer: { value: new THREE.Vector3(9999, 0, 0) },
      uPixel: { value: 1 },
      uWarmth: warmth,
    },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime, uPixel, uWarmth;
      uniform vec3 uCamera, uPointer;
      varying float vAlpha;
      varying float vSeed;
      void main() {
        vec3 drift = vec3(sin(uTime * 0.13 + aSeed.x * 6.3) * 2.0, uTime * (0.05 + aSeed.y * 0.09), cos(uTime * 0.11 + aSeed.z * 6.3) * 2.0);
        vec3 p = mod(position + drift - uCamera + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)} + uCamera;
        // Pollen is nudged aside by the pointer, as if by a breath of air.
        vec3 away = p - uPointer;
        float reach = length(away);
        p += normalize(away + 0.001) * smoothstep(3.0, 0.0, reach) * 1.2;
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        float depth = -view.z;
        // Fades at the box walls, so nothing pops in or out of existence.
        vec3 edge = abs(p - uCamera) / ${(BOX / 2).toFixed(1)};
        vAlpha = (1.0 - smoothstep(0.7, 1.0, max(edge.x, max(edge.y, edge.z)))) * smoothstep(0.6, 2.5, depth);
        vAlpha *= 0.42 + 0.3 * sin(uTime * (0.5 + aSeed.w) + aSeed.x * 6.3) + uWarmth * 0.18;
        vSeed = aSeed.w;
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp((12.0 + aSeed.w * 16.0) * uPixel / depth, 1.5, 22.0 * uPixel);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uWarmth;
      varying float vAlpha;
      varying float vSeed;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
        vec3 cool = mix(vec3(1.0, 1.0, 1.0), vec3(0.90, 0.87, 1.0), vSeed);
        vec3 warm = vec3(1.0, 0.91, 0.76);
        gl_FragColor = vec4(mix(cool, warm, uWarmth), a);
      }`,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  engine.scene.add(points);
  const pointer = new THREE.Vector3(9999, 0, 0);

  engine.add((_, time) => {
    material.uniforms.uTime.value = time;
    material.uniforms.uCamera.value.copy(engine.camera.position);
    material.uniforms.uPixel.value = engine.renderer.getPixelRatio();
    pointer.lerp(interaction.pointerWorld, 0.09);
    material.uniforms.uPointer.value.copy(pointer);
  });
  return { warmth };
}
