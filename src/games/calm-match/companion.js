import * as THREE from 'three/webgpu';
import { makeJellyShape } from './jelly-shape.js';
import { makeGelEnvironment, makeTrayGel } from './gel-material.js';

// A small real 3D portrait: sculpted eyes/mouth move with the body, not SVG ink.
export async function createCompanion(host) {
  const canvas = document.createElement('canvas');
  canvas.className = 'companion-canvas'; canvas.hidden = true;
  canvas.setAttribute('aria-hidden', 'true'); host.append(canvas);
  const renderer = new THREE.WebGPURenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor('#f5f5f3', 0); renderer.toneMapping = THREE.NoToneMapping;
  const geometries = new Set(), materials = new Set();
  const geo = g => { geometries.add(g); return g; };
  const mat = m => { materials.add(m); return m; };
  let disposed = false, environment, resizeObserver, visibilityObserver;
  let visible = true, mood = 'calm', gazeX = 0, gazeY = 0, cheerAt = -10000, last = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function dispose() {
    if (disposed) return;
    disposed = true; renderer.setAnimationLoop(null);
    resizeObserver?.disconnect(); visibilityObserver?.disconnect();
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    environment?.dispose(); renderer.dispose(); canvas.remove(); host.classList.remove('has-3d-companion');
  }
  try {
    await renderer.init();
    const scene = new THREE.Scene();
    environment = makeGelEnvironment(renderer, 128); scene.environment = environment.texture;
    const camera = new THREE.OrthographicCamera(-.55, .55, .58, -.52, .1, 20); camera.position.z = 5;
    scene.add(new THREE.HemisphereLight('#fff9f2', '#d5c0cc', 1.8));
    const light = new THREE.DirectionalLight('#ffffff', 2.6); light.position.set(-3, 4, 5); scene.add(light);
    const group = new THREE.Group(); scene.add(group);
    const surface = makeTrayGel('#f17fa9', environment.texture);
    const geometry = geo(makeJellyShape(48, 32));
    const body = new THREE.Mesh(geometry, mat(surface.gel));
    const rear = new THREE.Mesh(geometry, mat(surface.rear)); rear.renderOrder = -1;
    group.add(body, rear);
    const ink = mat(new THREE.MeshPhysicalMaterial({ color: '#35232b', roughness: .19, clearcoat: 1, clearcoatRoughness: .1, transparent: true, depthWrite: false }));
    const blush = mat(new THREE.MeshStandardMaterial({ color: '#ef8caf', roughness: .6, transparent: true, opacity: .58, depthWrite: false }));
    const eyeGeo = geo(new THREE.SphereGeometry(1, 24, 16));
    const face = new THREE.Group(); group.add(face);
    const eyes = [];
    for (const x of [-.12, .12]) {
      const eye = new THREE.Mesh(eyeGeo, ink); eye.position.set(x, -.012, .257); eye.scale.set(.031, .041, .028); eye.renderOrder = 10; face.add(eye); eyes.push(eye);
      const cheek = new THREE.Mesh(eyeGeo, blush); cheek.position.set(x * 1.55, -.066, .226); cheek.scale.set(.043, .019, .008); cheek.renderOrder = 11; face.add(cheek);
    }
    const smilePoints = Array.from({ length: 21 }, (_, i) => new THREE.Vector3((i / 20 - .5) * .087, -.059 - Math.sin(i / 20 * Math.PI) * .024, .283));
    const smile = new THREE.Mesh(geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(smilePoints), 24, .009, 8, false)), ink);
    smile.renderOrder = 10; face.add(smile);
    const surprised = new THREE.Mesh(geo(new THREE.TorusGeometry(.019, .007, 8, 24)), ink);
    surprised.position.set(0, -.078, .282); surprised.scale.y = 1.2; surprised.renderOrder = 10; face.add(surprised);
    const eyeArcs = [];
    for (const x of [-.12, .12]) {
      const points = Array.from({ length: 13 }, (_, i) => new THREE.Vector3(x + (i / 12 - .5) * .062, -.02 + Math.sin(i / 12 * Math.PI) * .022, .283));
      const eye = new THREE.Mesh(geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, .009, 8, false)), ink);
      eye.renderOrder = 10; face.add(eye); eyeArcs.push(eye);
    }
    function update(now) {
      if (disposed || document.hidden || !visible || now - last < 32) return;
      last = now;
      const cheering = mood === 'happy';
      const blink = !reduced.matches && (now % 5100) > 4930;
      eyes.forEach(eye => { eye.visible = !cheering; eye.scale.y = blink ? .008 : .041; });
      eyeArcs.forEach(eye => eye.visible = cheering);
      smile.visible = mood !== 'excited'; surprised.visible = !smile.visible;
      const t = Math.max(0, (now - cheerAt) / 800);
      const hop = !reduced.matches && t < 1 ? Math.sin(t * Math.PI) * .08 : 0;
      const breath = reduced.matches ? 0 : Math.sin(now * .0018) * .014;
      group.position.y = hop;
      group.scale.set(1 + breath, 1 - breath, 1);
      group.rotation.y += ((reduced.matches ? 0 : gazeX * .07) - group.rotation.y) * .16;
      group.rotation.z += ((reduced.matches ? 0 : gazeX * -.018) - group.rotation.z) * .16;
      face.position.x += (gazeX * .006 - face.position.x) * .18;
      face.position.y += (gazeY * .005 - face.position.y) * .18;
      renderer.render(scene, camera);
    }
    const resize = () => { const r = host.getBoundingClientRect(); if (r.width && r.height) renderer.setSize(r.width, r.height, false); };
    resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); resize();
    visibilityObserver = new IntersectionObserver(([entry]) => visible = entry.isIntersecting); visibilityObserver.observe(host);
    // All facial variants compile up front, so a first smile never builds shaders.
    await renderer.compileAsync(scene, camera);
    update(performance.now()); canvas.hidden = false; host.classList.add('has-3d-companion');
    renderer.setAnimationLoop(update);
    return {
      react(nextMood, x, y) { if (nextMood === 'happy' && mood !== 'happy') cheerAt = performance.now(); mood = nextMood; gazeX = x; gazeY = y; },
      dispose,
    };
  } catch (error) { dispose(); throw error; }
}
