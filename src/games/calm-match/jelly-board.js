import * as THREE from 'three/webgpu';
import { makeGelEnvironment, makeTrayGel, makeAirMaterial } from './gel-material.js';
import { makeJellyShape } from './jelly-shape.js';

const PALETTE = ['#f17fa9', '#75d7be', '#b098e6', '#edc469'];
const position = i => new THREE.Vector3(i % 5 - 2, 2.5 - Math.floor(i / 5), 0);
const ease = t => t * t * (3 - 2 * t);
export const POP_MS = 640;
export const FALL_MS = 800;

/** One GPU scene for the whole tray; the DOM remains the accessible input layer. */
export async function createJellyBoard(host, initialBoard) {
  const canvas = document.createElement('canvas');
  canvas.className = 'jelly-board-canvas';
  canvas.hidden = true;
  canvas.setAttribute('aria-hidden', 'true');
  host.before(canvas);
  const renderer = new THREE.WebGPURenderer({ canvas, alpha: true, antialias: true });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2.5, 2.5, 3, -3, .1, 30);
  camera.position.z = 10;
  renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NoToneMapping;
  let environment, observer, disposed = false;
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const geo = g => { geometries.add(g); return g; };
  const mat = m => { materials.add(m); return m; };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function dispose() {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    observer?.disconnect();
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    textures.forEach(t => t.dispose());
    environment?.dispose(); renderer.dispose(); canvas.remove();
    host.classList.remove('has-jelly-renderer');
  }
  try {
    await renderer.init();
    environment = makeGelEnvironment(renderer);
    scene.environment = environment.texture;
    scene.environmentIntensity = .9;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe6e1e5, 1.1));
    const light = new THREE.DirectionalLight(0xffffff, 1.8);
    light.position.set(-4, 6, 6); scene.add(light);
    const fill = new THREE.DirectionalLight(0xf8faff, .8);
    fill.position.set(4, 3, 1); scene.add(fill);
    const floor = new THREE.Mesh(geo(new THREE.PlaneGeometry(5, 6)), mat(new THREE.MeshBasicMaterial({ color: '#f5f5f3' })));
    floor.position.z = -.46; scene.add(floor);
    const bodyGeometry = geo(makeJellyShape());
    const surfaces = PALETTE.map(c => makeTrayGel(c, environment.texture, true));
    const gel = surfaces.map(s => mat(s.gel));
    const rearMaterials = surfaces.map(s => mat(s.rear));
    // Keep facial ink out of the opaque texture sampled by gel transmission.
    // Opacity stays one; only the render queue changes. Depth testing still
    // lets a foreground jelly occlude another jelly's face during gathering.
    const ink = mat(new THREE.MeshStandardMaterial({ color: '#33242b', roughness: .18, transparent: true, opacity: 1, depthWrite: false }));
    const eyeGeo = geo(new THREE.SphereGeometry(.04, 12, 8));
    const bubbleGeo = geo(new THREE.SphereGeometry(1, 10, 8));
    const bubbleMat = mat(makeAirMaterial());
    const air = new THREE.InstancedMesh(bubbleGeo, bubbleMat, initialBoard.length * 5);
    air.frustumCulled = false; air.renderOrder = 1; scene.add(air);
    const airTransform = new THREE.Object3D();
    const airMatrix = new THREE.Matrix4();
    const mouthPoints = Array.from({ length: 13 }, (_, i) => new THREE.Vector3((i / 12 - .5) * .085, -.082 - Math.sin(i / 12 * Math.PI) * .022, .277));
    const mouthGeo = geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mouthPoints), 12, .009, 5, false));
    const shadowPixels = new Uint8Array(32 * 32 * 4);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const radius = ((x - 15.5) / 15.5) ** 2 + ((y - 15.5) / 15.5) ** 2;
      shadowPixels[(y * 32 + x) * 4 + 3] = Math.round(Math.max(0, Math.exp(-radius * 5) - .007) * 90);
    }
    const shadowTexture = new THREE.DataTexture(shadowPixels, 32, 32);
    shadowTexture.needsUpdate = true; textures.add(shadowTexture);
    const shadowMat = mat(new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
    const shadowGeo = geo(new THREE.PlaneGeometry(.95, .78));
    const tiles = initialBoard.map((c, i) => {
      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      shadow.position.copy(position(i)); shadow.position.y -= .09; shadow.position.z = -.43; scene.add(shadow);
      const group = new THREE.Group(); group.matrixAutoUpdate = false; scene.add(group);
      const body = new THREE.Mesh(bodyGeometry, gel[c]); group.add(body);
      const rear = new THREE.Mesh(bodyGeometry, rearMaterials[c]); rear.renderOrder = -1; group.add(rear);
      for (const x of [-.115, .115]) { const eye = new THREE.Mesh(eyeGeo, ink); eye.position.set(x, -.025, .265); eye.renderOrder = 10; group.add(eye); }
      const mouth = new THREE.Mesh(mouthGeo, ink);
      mouth.renderOrder = 10;
      group.add(mouth);
      const airPockets = [];
      for (let j = 0; j < 5; j++) {
        // Stay well inside the silhouette; front/back offsets add depth without
        // putting air pockets into the transmission buffer (which magnifies them).
        const x = Math.sin(i * 2 + j * 5) * .22;
        const y = -.19 + j * .09;
        const phase = i * .73 + j * 2.4;
        airPockets.push({ x, y, z: .06 + j % 3 * .045, phase, size: .019 + j * .005 });
      }
      return { group, body, rear, airPockets, home: position(i), pos: position(i), glow: 0, stretch: 0, stretchV: 0, angle: 0, drop: 0, vy: 0, squash: 0, squashV: 0, color: c };
    });
    const waist = Array.from({ length: 13 }, (_, i) => new THREE.Vector2(.065 + .13 * Math.pow(Math.abs(i / 6 - 1), 1.7), i / 12 - .5));
    const linkGeo = geo(new THREE.LatheGeometry(waist, 12));
    const links = Array.from({ length: 29 }, () => { const m = new THREE.Mesh(linkGeo, gel[0]); m.visible = false; scene.add(m); return m; });
    const particles = new THREE.InstancedMesh(bubbleGeo, bubbleMat, 64);
    particles.count = 0; particles.frustumCulled = false; scene.add(particles);
    const particleData = [];
    const dummy = new THREE.Object3D();
    const axisY = new THREE.Vector3(0, 1, 0), delta = new THREE.Vector3(), center = new THREE.Vector3();
    const rotation = new THREE.Matrix4(), scale = new THREE.Vector3(), quat = new THREE.Quaternion();
    const zAxis = new THREE.Vector3(0, 0, 1);
    let selection = [], finger = null, popping = null, burstAt = -1, last = performance.now();
    let boardColors = [...initialBoard];
    function burst(now) {
      canvas.dataset.phase = 'bubbles';
      burstAt = now; particleData.length = 0;
      const count = Math.min(64, popping.indices.length * 7);
      for (let i = 0; i < count; i++) {
        const angle = i * 2.39996;
        particleData.push({ x: center.x, y: center.y, vx: Math.cos(angle) * (1 + Math.random() * 2), vy: Math.sin(angle) * (1 + Math.random() * 2), size: .035 + Math.random() * .055 });
      }
      particles.count = count;
    }
    function update(now) {
      if (disposed) return;
      const dt = Math.min((now - last) / 1000, .033); last = now;
      if (document.hidden) return;
      const popT = popping ? Math.min(1, (now - popping.start) / 430) : 0;
      const tier = selection.length >= 7 ? 2 : selection.length >= 5 ? 1 : 0;
      const breath = reduced.matches ? .5 : .5 + .5 * Math.sin(now * .0032);
      if (popping && popT >= 1 && burstAt < popping.start && !reduced.matches) burst(now);
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i], selected = selection.indexOf(i), inPop = popping?.indices.includes(i);
        const light = selected >= 0 ? .55 + tier * .16 + (tier ? breath * .18 : 0) + (inPop ? popT * .12 : 0) : 0;
        t.glow += (light - t.glow) * (1 - Math.exp(-16 * dt));
        t.body.userData.gelGlow = t.glow;
        t.pos.copy(t.home);
        let target = 0;
        if (selected >= 0 && !popping) {
          const next = selected === selection.length - 1 ? finger : tiles[selection[selected + 1]].home;
          if (next) {
            delta.copy(next).sub(t.home);
            const length = delta.length();
            t.angle = Math.atan2(delta.y, delta.x);
            target = Math.min(.36, length * .26);
            t.pos.addScaledVector(delta, Math.min(.13, .15 / (length || 1)));
          }
        }
        t.stretchV += ((target - t.stretch) * 180 - t.stretchV * 15) * dt;
        t.stretch += t.stretchV * dt;
        if (t.drop > 0 || t.vy > 0) {
          t.vy -= 24 * dt; t.drop += t.vy * dt;
          if (t.drop <= 0) {
            t.drop = 0;
            const impact = Math.min(7, Math.abs(t.vy) * .65);
            t.squashV -= impact;
            for (const n of [i - 1, i + 1]) {
              if (tiles[n] && Math.floor(n / 5) === Math.floor(i / 5)) tiles[n].squashV -= impact * .09;
            }
            t.vy = Math.abs(t.vy) > 1 ? -t.vy * .19 : 0;
          }
        }
        t.squashV += (-t.squash * 220 - t.squashV * 12) * dt;
        t.squash = THREE.MathUtils.clamp(t.squash + t.squashV * dt, -.32, .28);
        t.pos.y += t.drop;
        const charge = selection.length >= 7 ? .045 : selection.length >= 5 ? .025 : 0;
        let size = selected >= 0 && !reduced.matches ? 1 + charge * (.5 + breath) : 1;
        if (inPop && !reduced.matches) {
          t.pos.lerp(center, ease(popT) * .96);
          size = popT < .75 ? 1 + Math.sin(popT * Math.PI) * .15 : Math.max(.02, (1 - popT) * 4);
        }
        t.group.visible = !(inPop && popT >= 1);
        const stretch = reduced.matches ? 0 : t.stretch;
        const squash = reduced.matches ? 0 : t.squash;
        quat.setFromAxisAngle(zAxis, t.angle);
        scale.set(Math.exp(stretch) * size, Math.exp(-stretch / 2) * size, Math.exp(-stretch / 2) * size);
        t.group.matrix.compose(t.pos, quat, scale);
        rotation.makeRotationZ(-t.angle); t.group.matrix.multiply(rotation);
        rotation.makeScale(Math.exp(-squash / 2), Math.exp(squash), 1); t.group.matrix.multiply(rotation);
        const time = reduced.matches ? 0 : now * .0004;
        t.airPockets.forEach((pocket, j) => {
          airTransform.position.set(pocket.x + (reduced.matches ? 0 : Math.sin(time + pocket.phase) * .009), pocket.y + (reduced.matches ? 0 : Math.sin(time * .7 + pocket.phase) * .016), pocket.z);
          airTransform.scale.setScalar(t.group.visible ? pocket.size : 0);
          airTransform.updateMatrix(); airMatrix.multiplyMatrices(t.group.matrix, airTransform.matrix);
          air.setMatrixAt(i * 5 + j, airMatrix);
        });
      }
      air.instanceMatrix.needsUpdate = true;
      links.forEach((link, n) => {
        link.visible = n < selection.length - 1 && !(popping && popT >= 1);
        if (!link.visible) return;
        const a = tiles[selection[n]], b = tiles[selection[n + 1]];
        delta.copy(b.pos).sub(a.pos);
        link.position.copy(a.pos).addScaledVector(delta, .5); link.position.z = -.035;
        const length = delta.length();
        link.quaternion.setFromUnitVectors(axisY, length > .00001 ? delta.multiplyScalar(1 / length) : axisY);
        const thickness = selection.length >= 7 ? 1.25 : selection.length >= 5 ? 1.12 : 1;
        link.scale.set(thickness, Math.max(.01, length), thickness);
        link.material = gel[a.color];
        link.userData.gelGlow = .75 + tier * .16 + breath * .12;
      });
      if (particles.count) {
        const age = (now - burstAt) / 1000;
        particleData.forEach((b, i) => {
          dummy.position.set(b.x + b.vx * age, b.y + b.vy * age + .8 * age * age, .4);
          dummy.scale.setScalar(Math.max(0, 1 - age / .85) * b.size);
          dummy.updateMatrix(); particles.setMatrixAt(i, dummy.matrix);
        });
        particles.instanceMatrix.needsUpdate = true;
        if (age > .85) particles.count = 0;
      }
      renderer.render(scene, camera);
    }
    const resize = () => { const r = host.getBoundingClientRect(); if (r.width && r.height) renderer.setSize(r.width, r.height, false); };
    observer = new ResizeObserver(resize); observer.observe(host); resize();
    // Compile every palette and the normally hidden effects before revealing
    // the tray; a monochrome saved board must not defer this to its first clear.
    tiles.forEach((tile, i) => { tile.body.material = gel[i % 4]; tile.rear.material = rearMaterials[i % 4]; tile.group.matrix.makeTranslation(tile.home.x, tile.home.y, 0); });
    links.forEach((link, i) => { link.visible = true; link.material = gel[i % 4]; });
    particles.count = 64;
    await renderer.compileAsync(scene, camera);
    renderer.render(scene, camera);
    tiles.forEach(tile => { tile.body.material = gel[tile.color]; tile.rear.material = rearMaterials[tile.color]; });
    links.forEach(link => { link.visible = false; });
    particles.count = 0;
    update(performance.now());
    renderer.setAnimationLoop(update);
    return {
      show() { canvas.hidden = false; host.classList.add('has-jelly-renderer'); },
      select(indices, client) {
        if (popping) return;
        selection = [...indices];
        if (client) { const r = host.getBoundingClientRect(); finger = new THREE.Vector3((client.x - r.left) / r.width * 5 - 2.5, 3 - (client.y - r.top) / r.height * 6, 0); }
        else finger = null;
      },
      pop(indices) {
        canvas.dataset.phase = 'gather';
        selection = [...indices]; center.set(0, 0, 0);
        indices.forEach(i => center.add(tiles[i].pos)); center.divideScalar(indices.length);
        popping = { indices: [...indices], start: performance.now() };
      },
      sync(colors, falls = []) {
        canvas.dataset.phase = falls.length ? 'fall' : 'idle';
        boardColors = [...colors]; popping = null; selection = []; finger = null;
        tiles.forEach((t, i) => { t.color = boardColors[i]; t.glow = 0; t.body.userData.gelGlow = 0; t.body.material = gel[t.color]; t.rear.material = rearMaterials[t.color]; t.drop = reduced.matches ? 0 : falls[i] || 0; t.vy = 0; t.group.visible = true; });
      },
      dispose,
    };
  } catch (error) { dispose(); throw error; }
}
