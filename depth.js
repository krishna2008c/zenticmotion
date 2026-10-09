/* Zentic Motion — "The Grid Gains Depth" scroll transition.
   A lightweight, dependency-free canvas moment between Selected Motion and
   About: the site's own 2D hairline grid extrudes into an abstract
   architectural corridor of portal frames as you scroll, then resolves back
   to flat 2D before About takes over.

   Everything is a pure function of scroll progress, so scrolling upward
   reproduces the animation perfectly in reverse. No Three.js, no assets. */
(() => {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var zone = document.getElementById("depth-zone");
  var canvas = document.getElementById("depth-canvas");
  if (!zone || !canvas) return;

  var smallScreen = window.matchMedia("(max-width: 760px)");
  var ctx = canvas.getContext("2d");

  var W = 0, H = 0, F = 1;      // viewport px, focal length px
  var fw = 1, fh = 0.75;        // frame half-size, world units
  var N = 8, S = 2.2;           // frame count, spacing (world units)
  var CAM_START = 2.1;          // camera z at progress 0 (frame 0 fills viewport)
  var CAM_END = -13.6;          // camera z at progress 1
  var NEAR = 0.6;               // near cull distance
  var lastP = -1;
  var inView = false;

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function sstep(a, b, x) {
    var t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function setup() {
    var vw = canvas.clientWidth || window.innerWidth;
    var vh = canvas.clientHeight || window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = vw; H = vh;
    canvas.width = Math.max(1, Math.round(vw * dpr));
    canvas.height = Math.max(1, Math.round(vh * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    F = H * 1.4; /* restrained FOV (~37deg): spatial, never tunnel-like */
    if (smallScreen.matches) { N = 5; S = 2.4; }
    else { N = 8; S = 2.2; }
    fh = 0.75;
    fw = fh * (W / H);
    CAM_END = -(N * S) + 4;
    lastP = -1;
  }

  /* Pinhole projection. Camera looks down -z. Returns null past the near plane. */
  function project(x, y, z, camZ, camX) {
    var dz = z - camZ;
    if (dz > -NEAR) return null;
    var s = F / (-dz);
    return { x: W / 2 + (x - camX) * s, y: H / 2 + y * s, dz: dz };
  }
  function nearFade(dz) { return sstep(NEAR, 3, -dz); }
  function farFade(dz) { return 1 - 0.85 * sstep(14, 30, -dz); }

  function seg(p1, p2, alpha) {
    if (!p1 || !p2 || alpha <= 0.004) return;
    ctx.strokeStyle = "rgba(244,243,236," + alpha.toFixed(3) + ")";
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  /* The site's flat 2D grid, drawn through the same projection as the corridor
     (virtual camera slightly further back, so it reads as a clear inset grid),
     so the lines are literally the same lines that gain depth. */
  function drawFlat(alpha) {
    var cz = CAM_START + 0.9, cx = 0;
    var corners = [
      project(-fw, -fh, 0, cz, cx), project(fw, -fh, 0, cz, cx),
      project(fw, fh, 0, cz, cx), project(-fw, fh, 0, cz, cx)
    ];
    for (var i = 0; i < 4; i++) seg(corners[i], corners[(i + 1) % 4], alpha);
    /* centre vertical + horizontals: the selected-grid rhythm */
    seg(project(0, -fh, 0, cz, cx), project(0, fh, 0, cz, cx), alpha);
    [-fh, 0, fh].forEach(function (y) {
      seg(project(-fw, y, 0, cz, cx), project(fw, y, 0, cz, cx), alpha);
    });
  }

  function frameCorners(i, camZ, camX) {
    var z = -i * S;
    return [
      project(-fw, -fh, z, camZ, camX), project(fw, -fh, z, camZ, camX),
      project(fw, fh, z, camZ, camX), project(-fw, fh, z, camZ, camX)
    ];
  }

  function drawCorridor(p) {
    var camZ = lerp(CAM_START, CAM_END, p);
    var camX = 0.05 * Math.sin(p * Math.PI); /* whisper of lateral drift */
    var env = sstep(0.05, 0.20, p) * (1 - sstep(0.80, 0.95, p));
    if (env <= 0.004) return;

    var i, k;
    /* longitudinal rails: the flat lines extending into perspective */
    var railBase = 0.16 * env;
    for (i = 0; i < N - 1; i++) {
      var c0 = frameCorners(i, camZ, camX);
      var c1 = frameCorners(i + 1, camZ, camX);
      for (k = 0; k < 4; k++) {
        if (!c0[k] || !c1[k]) continue;
        var a = railBase * (nearFade(c0[k].dz) + nearFade(c1[k].dz)) / 2 * (farFade(c0[k].dz) + farFade(c1[k].dz)) / 2;
        seg(c0[k], c1[k], a);
      }
    }
    /* portal frames */
    for (i = 0; i < N; i++) {
      var c = frameCorners(i, camZ, camX);
      var z = -i * S, dz = z - camZ;
      var a = 0.2 * env * nearFade(dz) * farFade(dz);
      if (a <= 0.004) continue;
      for (k = 0; k < 4; k++) seg(c[k], c[(k + 1) % 4], a);
    }
    /* diagonal bracing: an almost-subconscious structural Z, then M */
    var bEnv = sstep(0.40, 0.52, p) * (1 - sstep(0.60, 0.74, p));
    if (bEnv > 0.004) {
      var b1 = Math.floor(N / 2), b2 = b1 + 1;
      var f1 = frameCorners(b1, camZ, camX);
      var zb = -b1 * S, zbDz = zb - camZ;
      var za = 0.12 * env * bEnv * nearFade(zbDz) * farFade(zbDz);
      seg(f1[1], f1[3], za); /* top-right -> bottom-left: a structural "Z" */
      var f2 = frameCorners(b2, camZ, camX);
      var mb = -b2 * S, mbDz = mb - camZ;
      var ma = 0.12 * env * bEnv * nearFade(mbDz) * farFade(mbDz);
      var dip = project(0, -fh + 0.7 * fh, mb, camZ, camX);
      seg(f2[0], dip, ma); /* valley in the top half: a whispered "M" */
      seg(dip, f2[1], ma);
    }
  }

  function draw(p) {
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1;
    var flatEnv = (1 - sstep(0.08, 0.22, p)) + sstep(0.80, 0.94, p);
    var fa = 0.2 * Math.min(1, flatEnv);
    if (fa > 0.003) drawFlat(fa);
    drawCorridor(p);
  }

  function progress() {
    var r = zone.getBoundingClientRect();
    var total = zone.offsetHeight - window.innerHeight;
    if (total <= 0) return 0;
    return clamp01(-r.top / total);
  }

  function loop() {
    requestAnimationFrame(loop);
    if (!inView || document.hidden) return;
    var p = progress();
    if (Math.abs(p - lastP) < 0.0005) return;
    lastP = p;
    draw(p);
  }

  /* faint echo lines continuing behind the top of About (never over text) */
  var echo = document.getElementById("depth-echo");
  function drawEcho() {
    if (!echo) return;
    var w = echo.clientWidth, h = echo.clientHeight;
    if (!w || !h) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    echo.width = Math.round(w * dpr);
    echo.height = Math.round(h * dpr);
    var c = echo.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.lineWidth = 1;
    var xs = [w * 0.06, w / 2, w * 0.94];
    var steps = 14;
    for (var s = 0; s < xs.length; s++) {
      for (var i = 0; i < steps; i++) {
        var y0 = (h * i) / steps, y1 = (h * (i + 1)) / steps;
        var a = 0.07 * (1 - i / steps); /* fades out well above the copy */
        c.strokeStyle = "rgba(244,243,236," + a.toFixed(3) + ")";
        c.beginPath(); c.moveTo(xs[s], y0); c.lineTo(xs[s], y1 + 1); c.stroke();
      }
    }
  }

  var resizeT = 0;
  function onResize() {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { setup(); drawEcho(); draw(clamp01(lastP < 0 ? 0 : lastP)); }, 150);
  }

  setup();
  drawEcho();
  draw(0);
  new IntersectionObserver(function (entries) { inView = entries[0].isIntersecting; }, { rootMargin: "120px" }).observe(zone);
  window.addEventListener("resize", onResize);
  smallScreen.addEventListener("change", onResize);
  loop();
})();
