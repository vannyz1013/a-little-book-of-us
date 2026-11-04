import * as THREE from 'three';

export function roundedRect(width: number, height: number, radius: number): THREE.Shape {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

/** A solid rounded slab with softened edges, centred, with 0-1 UVs on its faces. */
export function slab(width: number, height: number, thickness: number, radius: number, shape?: THREE.Shape): THREE.ExtrudeGeometry {
  const bevel = Math.min(0.02, thickness * 0.3);
  const geometry = new THREE.ExtrudeGeometry(shape ?? roundedRect(width - bevel * 2, height - bevel * 2, radius), {
    depth: Math.max(thickness - bevel * 2, 0.001),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 8,
  });
  geometry.translate(0, 0, -(thickness - bevel * 2) / 2);
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, position.getX(i) / width + 0.5, position.getY(i) / height + 0.5);
  }
  return geometry;
}

export function hitBox(width: number, height: number, depth: number): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({ visible: false });
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
}

export function shadowed<T extends THREE.Object3D>(object: T, cast = true, receive = true): T {
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
  return object;
}

/** A soft halo sprite, for hover glow and warm light. */
export function halo(map: THREE.Texture, color: string, size: number): THREE.Sprite {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  sprite.scale.set(size, size, 1);
  return sprite;
}

/** A stretched dark spot on the ground, a cheap contact shadow that works on every tier. */
export function contactShadow(map: THREE.Texture, width: number, depth: number, opacity = 0.2): THREE.Mesh {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ map, color: '#55566B', transparent: true, opacity, depthWrite: false, toneMapped: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  return shadow;
}

/** A leafy sprig, as one geometry: used on frames and the cake. */
export function leafGeometry(length: number, width: number): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(width, length, 2, 5);
  geometry.translate(0, length / 2, 0);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const t = position.getY(i) / length;
    const taper = Math.sin(Math.min(t * 1.06 + 0.02, 1) * Math.PI) ** 0.8;
    const x = position.getX(i) * taper;
    position.setX(i, x);
    // Curved along the length and cupped along the middle.
    position.setZ(i, Math.sin(t * Math.PI) * length * 0.12 - Math.abs(x) * 0.5);
  }
  geometry.computeVertexNormals();
  return geometry;
}
