/* ============================================================
   ZENTIC MOTION — Scroll-driven 3D background tube
   ------------------------------------------------------------
   A single continuous metallic tube rendered on a fixed WebGL
   canvas BEHIND the homepage content. It lives only inside the
   existing black region: #web (Selected Web Work) -> #work
   (Selected Motion) -> #about (toolkit) and fades out before
   #services (the next white section).

   - Idle motion: gentle sway + breathing tube-light glow.
   - Scroll motion: camera pans down the vertical tube; fully
     reversible, no scroll hijacking.
   - Layering: canvas is fixed, z-index 0, pointer-events none.
     Content sections sit above it (see styles.css).
   - Respects prefers-reduced-motion (single static frame).
   ============================================================ */
import * as THREE from "three";

(() => {
  "use strict";

  // ---- Feature gates -------------------------------------------------
  const canvasHost = document.body;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const smallScreen = window.matchMedia("(max-width: 760px)");
  if (!canvasHost || !window.WebGLRenderingContext) return;

  const regionStart = document.getElementById("web");      // Selected Web Work
  const regionEnd = document.getElementById("services");   // next white section
  if (!regionStart || !regionEnd) return;

  // ---- Canvas ---------------------------------------------------------
  const canvas = document.createElement("canvas");
  canvas.id = "tube-canvas";
  canvas.setAttribute("aria-hidden", "true");
  canvasHost.appendChild(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,          // page black (#0b0b0b) shows through — no mismatched patches
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch (e) {
    canvas.remove();
    return;
  }
  const PR_CAP = smallScreen.matches ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PR_CAP));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    220
  );

  // ---- Soft studio environment (procedural, no external HDR) -----------
  // Gives the dark metal believable soft reflections.
  function makeStudioEnv() {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = "#050505";
    g.fillRect(0, 0, 128, 64);
    // soft white softbox band near the top
    const band = g.createLinearGradient(0, 4, 0, 30);
    band.addColorStop(0, "rgba(255,255,255,0.95)");
    band.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = band;
    g.fillRect(10, 4, 108, 26);
    // faint cool floor bounce
    const floor = g.createLinearGradient(0, 44, 0, 64);
    floor.addColorStop(0, "rgba(150,170,200,0)");
    floor.addColorStop(1, "rgba(150,170,200,0.28)");
    g.fillStyle = floor;
    g.fillRect(0, 44, 128, 20);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
    pmrem.dispose();
    return env;
  }
  scene.environment = makeStudioEnv();

  // ---- Lights: soft white key, dim fill, cool rim (no RGB neon) --------
  scene.add(new THREE.HemisphereLight(0xffffff, 0x0b0b0b, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(4, 6, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfd8e6, 0.85);
  rim.position.set(-6, -1.5, -5);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.22));

  // ---- The tube: one continuous vertical wavy line, top → bottom --------
  // The camera faces it straight-on, so it reads as flowing 2D lines with
  // a 3D rounded finish — never coming toward the viewer.
  const TUBE_H = 52;
  const ctrl = [];
  const CTRL_N = 10;
  // Mobile tuning: on narrow portrait screens the same world-size tube
  // fills half the viewport and washes out the text — so mobile gets a
  // slimmer tube, tighter glow, gentler wave and a pulled-back camera.
  const IS_MOBILE = smallScreen.matches;
  const RADIUS = IS_MOBILE ? 0.26 : 0.45;
  const HALO1_X = IS_MOBILE ? 1.8 : 2.4;
  const HALO2_X = IS_MOBILE ? 3.2 : 4.8;
  const CAM_Z = IS_MOBILE ? 23 : 18;
  const EMISSIVE_BASE = IS_MOBILE ? 1.0 : 1.5;
  const EMISSIVE_PULSE = IS_MOBILE ? 0.18 : 0.3;
  const HALO1_OP = IS_MOBILE ? 0.06 : 0.1;
  const HALO2_OP = IS_MOBILE ? 0.028 : 0.045;
  const WAVE_X = IS_MOBILE ? 1.4 : 2.6;
  const WAVE_X2 = IS_MOBILE ? 0.5 : 0.8;
  for (let i = 0; i <= CTRL_N; i++) {
    const t = i / CTRL_N; // 0 = top, 1 = bottom
    const y = 14 - t * TUBE_H; // +14 → -38
    ctrl.push(
      new THREE.Vector3(
        WAVE_X * Math.sin(y * 0.28) + WAVE_X2 * Math.sin(y * 0.11 + 1.0),
        y,
        1.2 * Math.sin(y * 0.18 + 0.5) // subtle depth variation
      )
    );
  }
  const curve = new THREE.CatmullRomCurve3(ctrl, false, "centripetal");
  const TUBULAR = IS_MOBILE ? 150 : 240;
  const RADIAL = IS_MOBILE ? 20 : 30;
  const tubeGeo = new THREE.TubeGeometry(curve, TUBULAR, RADIUS, RADIAL, false);
  // Soft glow halos: larger additive tubes around the core (fake bloom —
  // no postprocessing pass needed). These make it read as a tube light.
  const haloGeo1 = new THREE.TubeGeometry(curve, TUBULAR, RADIUS * HALO1_X, RADIAL, false);
  const haloGeo2 = new THREE.TubeGeometry(curve, TUBULAR, RADIUS * HALO2_X, RADIAL, false);

  const tubeUniforms = { uTime: { value: 0 } };
  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff, // tube-light glow
    emissiveIntensity: EMISSIVE_BASE,
    roughness: 0.35,
    metalness: 0.05,
    envMapIntensity: 0.5,
    transparent: true, // for the end-of-region fade
    opacity: 0,
  });
  // Subtle organic breathing, computed on the GPU — no per-frame rebuilds.
  tubeMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = tubeUniforms.uTime;
    shader.vertexShader =
      "uniform float uTime;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         float breathe = sin(uTime * 0.85 + position.y * 1.6 + position.z * 0.22) * 0.028;
         transformed += normalize(normal) * breathe;`
      );
  };
  const swayGroup = new THREE.Group();
  const tube = new THREE.Mesh(tubeGeo, tubeMat);
  swayGroup.add(tube);
  const haloMat1 = new THREE.MeshBasicMaterial({
    color: 0xe8eeff, transparent: true, opacity: HALO1_OP,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const haloMat2 = new THREE.MeshBasicMaterial({
    color: 0xd8e2ff, transparent: true, opacity: HALO2_OP,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const halo1 = new THREE.Mesh(haloGeo1, haloMat1);
  const halo2 = new THREE.Mesh(haloGeo2, haloMat2);
  swayGroup.add(halo1);
  swayGroup.add(halo2);
  scene.add(swayGroup);

  // ---- Scroll mapping ---------------------------------------------------
  // p = 0 at the top of #web, p = 1 at the top of #services (white).
  let topEdge = 0;
  let regionLen = 1;
  function measureRegion() {
    topEdge = regionStart.getBoundingClientRect().top + window.scrollY;
    const endTop = regionEnd.getBoundingClientRect().top + window.scrollY;
    regionLen = Math.max(1, endTop - topEdge);
  }
  measureRegion();
  // Re-measure after late layout shifts (images, webfonts, hero video) so the
  // fade windows stay glued to the real #web / #services positions.
  window.addEventListener("load", measureRegion);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(measureRegion).catch(() => {});
  }

  const smoothstep = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  function scrollProgress() {
    const vc = window.scrollY + window.innerHeight * 0.5;
    return Math.min(1, Math.max(0, (vc - topEdge) / regionLen));
  }
  function regionVisible() {
    const y = window.scrollY;
    const vh = window.innerHeight;
    return topEdge < y + vh + 80 && topEdge + regionLen > y - 80;
  }

  const _cam = new THREE.Vector3();
  const _look = new THREE.Vector3();

  // ---- Mouse parallax: the tube drifts subtly toward the cursor ---------
  // Desktop only, and never under prefers-reduced-motion. Lerped so the
  // motion stays buttery; layered on top of scroll + idle, replacing none.
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const allowParallax = !smallScreen.matches && !reduceMotion.matches
    && window.matchMedia("(pointer: fine)").matches;
  if (allowParallax) {
    window.addEventListener("pointermove", (e) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;  // -1 … 1
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  function renderFrame(time) {
    const p = scrollProgress();

    // Camera faces the tube straight-on and pans down as you scroll —
    // the tube flows top → bottom through the frame. Pure function of p,
    // so scrolling back reverses it exactly. Mouse parallax drifts the
    // view a touch toward the cursor (desktop only).
    const camY = 2 - p * 20;
    if (allowParallax) {
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
    }
    const px = allowParallax ? mouse.x * 1.4 : 0;
    const py = allowParallax ? mouse.y * -0.9 : 0;
    camera.position.set(px, camY + py, CAM_Z);
    camera.lookAt(px * 0.5, camY - 2.5 + py * 0.5, 0);

    // Idle: gentle sway + breathing glow (tube-light shimmer).
    const tSec = time * 0.001;
    swayGroup.position.x = Math.sin(time * 0.0004) * 0.5;
    swayGroup.rotation.z = Math.sin(time * 0.00022) * 0.022;
    tubeMat.emissiveIntensity = EMISSIVE_BASE + Math.sin(tSec * 1.2) * EMISSIVE_PULSE;
    haloMat1.opacity = HALO1_OP * 0.9 + Math.sin(tSec * 1.2) * HALO1_OP * 0.2;
    key.position.x = 4 + Math.sin(time * 0.0004) * 1.4;
    key.position.y = 6 + Math.cos(time * 0.0003) * 0.9;
    tubeUniforms.uTime.value = tSec;

    // Fade in right as the region enters (visible on Selected Web Work),
    // fade out before the white #services section arrives.
    const fade = smoothstep(0, 0.08, p) * (1 - smoothstep(0.82, 0.95, p));
    tubeMat.opacity = fade;
    haloMat1.opacity *= fade;
    haloMat2.opacity = HALO2_OP * fade;

    renderer.render(scene, camera);
  }

  // ---- Main loop: renders only while the region is on screen ------------
  let rafId = 0;
  let lastP = -1;
  function loop(time) {
    rafId = requestAnimationFrame(loop);
    if (document.hidden || !regionVisible()) {
      if (canvas.style.visibility !== "hidden") canvas.style.visibility = "hidden";
      return;
    }
    if (canvas.style.visibility !== "visible") canvas.style.visibility = "visible";
    const p = scrollProgress();
    // With idle motion always on, keep rendering; skip only if fully faded.
    if (tubeMat.opacity <= 0.001 && Math.abs(p - lastP) < 0.0005) return;
    lastP = p;
    renderFrame(time || 0);
  }

  function onResize() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PR_CAP));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    measureRegion();
    if (reduceMotion.matches) renderFrame(0);
  }
  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("orientationchange", onResize, { passive: true });

  function dispose() {
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    tubeGeo.dispose();
    haloGeo1.dispose();
    haloGeo2.dispose();
    tubeMat.dispose();
    haloMat1.dispose();
    haloMat2.dispose();
    renderer.dispose();
    canvas.remove();
  }
  window.addEventListener("pagehide", dispose);

  reduceMotion.addEventListener?.("change", () => {
    if (reduceMotion.matches) {
      cancelAnimationFrame(rafId);
      renderFrame(0); // one static frame, no loop
      canvas.style.visibility = regionVisible() ? "visible" : "hidden";
    } else {
      lastP = -1;
      rafId = requestAnimationFrame(loop);
    }
  });

  // ---- Go ---------------------------------------------------------------
  if (reduceMotion.matches) {
    // Static presentation: one still frame per scroll position, no loop.
    const renderStill = () => {
      renderFrame(0);
      canvas.style.visibility = regionVisible() ? "visible" : "hidden";
    };
    renderStill();
    let scrollQueued = false;
    window.addEventListener("scroll", () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => { scrollQueued = false; renderStill(); });
    }, { passive: true });
  } else {
    rafId = requestAnimationFrame(loop);
  }
})();
