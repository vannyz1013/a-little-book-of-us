import * as THREE from 'three';
import { asset } from '../../dom';
import { fbm, seeded } from './noise';
import type { Engine } from './engine';

export const palette = {
  lavender: '#C8BCE8',
  powder: '#B9D1E8',
  mint: '#BFD8C5',
  cloud: '#F7F7F3',
  slate: '#55566B',
  paleLavender: '#E9E3F5',
  paleBlue: '#E6EFF7',
};

const loader = new THREE.ImageLoader();

export const loadImage = (path: string): Promise<HTMLImageElement> => loader.loadAsync(asset(path));

export function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d')!];
}

export function colourTexture(engine: Engine, source: HTMLCanvasElement | HTMLImageElement): THREE.Texture {
  const texture = new THREE.Texture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(engine.tier.name === 'low' ? 2 : 6, engine.renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
}

/** Wrap text to a width, and shrink it until it fits a box. */
export function drawWrapped(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  font: (size: number) => string,
  startSize: number,
): void {
  let size = startSize;
  let lines: string[] = [];
  while (size > 10) {
    context.font = font(size);
    lines = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (context.measureText(test).width > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    if (lines.length * size * 1.24 <= height) break;
    size -= 2;
  }
  const lineHeight = size * 1.24;
  const top = y + (height - lines.length * lineHeight) / 2 + lineHeight * 0.78;
  lines.forEach((line, index) => context.fillText(line, x, top + index * lineHeight));
}

/** A soft round dot, used for glows and pollen. */
export function softDot(engine: Engine, inner = '#ffffff'): THREE.Texture {
  const [canvas, context] = makeCanvas(128, 128);
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.3, `${inner}AA`);
  gradient.addColorStop(1, `${inner}00`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return colourTexture(engine, canvas);
}

/** Tiling greyscale grain, used to break up smooth surfaces. */
export function grainTexture(size = 256, scale = 16, seed = 1): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const random = seeded(seed);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Sampling around a circle in each axis makes the noise tile.
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const value = fbm(Math.cos(u) * scale + Math.sin(v) * scale * 0.7 + 40, Math.sin(u) * scale + Math.cos(v) * scale * 0.7 + 40, 4);
      const shade = Math.floor((value * 0.8 + random() * 0.2) * 255);
      const index = (y * size + x) * 4;
      data[index] = data[index + 1] = data[index + 2] = shade;
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Fine parallel lines, for the block of pages along the edge of the book. */
export function pageEdgeTexture(engine: Engine, vertical: boolean): THREE.Texture {
  const [canvas, context] = makeCanvas(vertical ? 256 : 16, vertical ? 16 : 256);
  context.fillStyle = '#F4F1EA';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const random = seeded(9);
  for (let i = 0; i < 256; i += 3) {
    context.fillStyle = `rgba(150,140,170,${0.1 + random() * 0.24})`;
    if (vertical) context.fillRect(i, 0, 1, 16);
    else context.fillRect(0, i, 16, 1);
  }
  return colourTexture(engine, canvas);
}
