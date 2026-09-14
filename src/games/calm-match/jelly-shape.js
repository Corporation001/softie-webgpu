import * as THREE from 'three/webgpu';

export function makeJellyShape(widthSegments = 32, heightSegments = 24) {
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const sy = p.getY(i), theta = Math.acos(THREE.MathUtils.clamp(sy, -1, 1));
    const radial = Math.sin(theta);
    const radius = Math.pow(radial, .82) * (1 - .07 * sy);
    const s = radial > .00001 ? radius / radial : 0;
    const y = .035 + 2.36 * Math.pow((sy + 1) / 2, 1.28) + .42 * Math.exp(-theta * theta / .055);
    p.setXYZ(i, p.getX(i) * .405 * s, (y - 1.25) * .29, p.getZ(i) * .27 * s);
  }
  geometry.computeVertexNormals();
  return geometry;
}
