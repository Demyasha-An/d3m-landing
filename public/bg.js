import * as THREE from "three";

/*
 * Animated WebGL background for d3mvpn.
 * - A drifting "network" of particles connected by lines (VPN/mesh metaphor)
 * - A few floating wireframe cubes for depth
 * - Subtle parallax that follows the cursor
 * Respects prefers-reduced-motion by rendering a single static frame.
 */

/* Bail out early on browsers without WebGL — the CSS background remains. */
function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl") || c.getContext("experimental-webgl"))
    );
  } catch (e) {
    return false;
  }
}

if (hasWebGL()) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PRIMARY = new THREE.Color(0xc084fc);
  const PRIMARY_SOFT = new THREE.Color(0x9a6de0);

  // Scale the scene down on small / low-core devices to keep it smooth.
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const lowCore = (navigator.hardwareConcurrency || 8) <= 4;
  const light = isMobile || lowCore;

  const renderer = new THREE.WebGLRenderer({
    antialias: !light,
    alpha: true,
    powerPreference: "high-performance",
  });
  // Lower DPR cap on mobile: fewer pixels to shade = better battery/FPS.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, light ? 1.5 : 2));
  renderer.domElement.className = "bg-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 18);

  /* ── Particle network ─────────────────── */
  const COUNT = light ? 48 : 90;
  const SPREAD = 26;
  const LINK_DIST = 5.2;
  const LINK_DIST_SQ = LINK_DIST * LINK_DIST;

  const positions = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * SPREAD;
    positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD * 0.62;
    positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD * 0.5;
    velocities[i * 3] = (Math.random() - 0.5) * 0.006;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.006;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.006;
  }

  // Soft round sprite for the points.
  const sprite = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(220,190,255,0.85)");
    grad.addColorStop(1, "rgba(192,132,252,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    return tex;
  })();

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.55,
    map: sprite,
    color: PRIMARY,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  // Line segments between nearby particles (rebuilt each frame).
  const maxSegments = COUNT * COUNT;
  const linePositions = new Float32Array(maxSegments * 3);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage)
  );
  const lineMat = new THREE.LineBasicMaterial({
    color: PRIMARY_SOFT,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(lines);

  /* ── Floating wireframe cubes ─────────── */
  const cubes = [];
  const cubeDefs = [
    { x: -9, y: 4, z: -4, s: 2.4 },
    { x: 8, y: -3, z: -2, s: 3.4 },
    { x: 11, y: 5, z: -6, s: 1.6 },
    { x: -7, y: -5, z: -3, s: 2.0 },
    { x: 2, y: 6.5, z: -7, s: 1.3 },
  ];
  cubeDefs.forEach((d) => {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(d.s, d.s, d.s));
    const mat = new THREE.LineBasicMaterial({
      color: PRIMARY,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const cube = new THREE.LineSegments(edges, mat);
    cube.position.set(d.x, d.y, d.z);
    cube.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    cube.userData.rx = (Math.random() - 0.5) * 0.0016;
    cube.userData.ry = (Math.random() - 0.5) * 0.0016;
    scene.add(cube);
    cubes.push(cube);
  });

  /* ── Parallax ──────────────────────────── */
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  window.addEventListener(
    "pointermove",
    (e) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
    },
    { passive: true }
  );

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  let resizeTimer;
  window.addEventListener(
    "resize",
    () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    },
    { passive: true }
  );

  const half = SPREAD / 2;
  function updateParticles() {
    const p = pGeo.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      p[ix] += velocities[ix];
      p[ix + 1] += velocities[ix + 1];
      p[ix + 2] += velocities[ix + 2];
      // wrap softly within the box
      if (p[ix] > half || p[ix] < -half) velocities[ix] *= -1;
      if (p[ix + 1] > half * 0.62 || p[ix + 1] < -half * 0.62)
        velocities[ix + 1] *= -1;
      if (p[ix + 2] > half * 0.5 || p[ix + 2] < -half * 0.5)
        velocities[ix + 2] *= -1;
    }
    pGeo.attributes.position.needsUpdate = true;

    // build links
    let s = 0;
    for (let i = 0; i < COUNT; i++) {
      const ax = p[i * 3],
        ay = p[i * 3 + 1],
        az = p[i * 3 + 2];
      for (let j = i + 1; j < COUNT; j++) {
        const dx = ax - p[j * 3];
        const dy = ay - p[j * 3 + 1];
        const dz = az - p[j * 3 + 2];
        // Compare squared distance — avoids a Math.sqrt per pair each frame.
        if (dx * dx + dy * dy + dz * dz < LINK_DIST_SQ) {
          linePositions[s++] = ax;
          linePositions[s++] = ay;
          linePositions[s++] = az;
          linePositions[s++] = p[j * 3];
          linePositions[s++] = p[j * 3 + 1];
          linePositions[s++] = p[j * 3 + 2];
        }
      }
    }
    lineGeo.setDrawRange(0, s / 3);
    lineGeo.attributes.position.needsUpdate = true;
  }

  let running = true;
  let rafId = 0;

  function render() {
    updateParticles();

    cubes.forEach((cube) => {
      cube.rotation.x += cube.userData.rx;
      cube.rotation.y += cube.userData.ry;
    });

    // ease parallax
    current.x += (target.x - current.x) * 0.04;
    current.y += (target.y - current.y) * 0.04;
    camera.position.x = current.x * 2.2;
    camera.position.y = -current.y * 1.4;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    if (!reduce && running) rafId = requestAnimationFrame(render);
  }

  function start() {
    running = true;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(render);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  // Pause the loop while the tab is hidden — saves CPU and battery.
  document.addEventListener("visibilitychange", () => {
    if (reduce) return;
    if (document.hidden) stop();
    else start();
  });

  // Recover gracefully if the browser drops the WebGL context.
  renderer.domElement.addEventListener(
    "webglcontextlost",
    (e) => {
      e.preventDefault();
      stop();
    },
    false
  );
  renderer.domElement.addEventListener("webglcontextrestored", () => {
    if (!reduce) start();
  });

  if (reduce) {
    render();
  } else {
    start();
  }
}
