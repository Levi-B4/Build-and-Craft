// Highland cow model built from simple boxes. Geometry and materials are shared across all cows.
import * as THREE from 'three';

let shared = null;

function getShared() {
  if (shared) return shared;
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const mat = (color) => new THREE.MeshLambertMaterial({ color });
  shared = {
    geo: {
      body: box(0.9, 0.8, 1.4),
      shag: box(0.98, 0.18, 1.3),
      leg: box(0.22, 0.6, 0.22),
      head: box(0.6, 0.55, 0.5),
      fringe: box(0.68, 0.28, 0.14),
      muzzle: box(0.42, 0.26, 0.14),
      hornBase: box(0.42, 0.1, 0.1),
      hornTip: box(0.1, 0.26, 0.1),
      tail: box(0.1, 0.5, 0.1),
      tuft: box(0.16, 0.18, 0.16),
    },
    mat: {
      coat: mat(0xb5602b),
      dark: mat(0x8a4520),
      horn: mat(0xeadfc4),
      muzzle: mat(0x3b2a22),
      hoof: mat(0x5a3a22),
    },
  };
  return shared;
}

/**
 * Build a cow mesh group. Local +z is the cow's front; origin is between the hooves.
 * @returns {{group: THREE.Group, legs: THREE.Object3D[], head: THREE.Object3D}}
 */
export function createCowModel() {
  const { geo, mat } = getShared();
  const group = new THREE.Group();
  const add = (parent, g, m, x, y, z) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  add(group, geo.body, mat.coat, 0, 0.95, 0);
  add(group, geo.shag, mat.dark, 0, 0.56, 0);

  const legs = [];
  for (const [x, z] of [[-0.28, 0.48], [0.28, 0.48], [-0.28, -0.48], [0.28, -0.48]]) {
    const pivot = new THREE.Object3D();
    pivot.position.set(x, 0.62, z);
    add(pivot, geo.leg, mat.dark, 0, -0.31, 0);
    group.add(pivot);
    legs.push(pivot);
  }

  const head = new THREE.Object3D();
  head.position.set(0, 1.12, 0.82);
  group.add(head);
  add(head, geo.head, mat.coat, 0, 0, 0.12);
  add(head, geo.fringe, mat.dark, 0, 0.12, 0.4);
  add(head, geo.muzzle, mat.muzzle, 0, -0.14, 0.41);
  for (const s of [-1, 1]) {
    add(head, geo.hornBase, mat.horn, s * 0.45, 0.2, 0.08);
    add(head, geo.hornTip, mat.horn, s * 0.63, 0.33, 0.08);
  }

  add(group, geo.tail, mat.dark, 0, 0.95, -0.74);
  add(group, geo.tuft, mat.dark, 0, 0.66, -0.76);

  return { group, legs, head };
}

/** Half extents of the cow's (yaw-independent) collision box. */
export const COW_HALF_WIDTH = 0.7;
export const COW_HEIGHT = 1.5;
