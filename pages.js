/* Zentic Motion — shared behaviour for the dedicated portfolio pages (/web/, /motion/).
   Same motion language as the homepage (menu, reveal, cursor, film player),
   without the homepage-only intro, hero and contact logic. */
(() => {
  "use strict";

  var config = window.ZENTIC || null;

  function $(selector, scope) { return (scope || document).querySelector(selector); }
  function $$(selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); }

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var smallScreen = window.matchMedia("(max-width: 760px)");
  var finePointer = window.matchMedia("(pointer: fine) and (hover: hover)");
  var body = document.body;
  var header = $(".site-header");
  var main = $("main");
  var menu = $("#mobile-menu");
  var menuToggle = $(".menu-toggle");
  var dialog = $("#film-dialog");
  var previousFocus = null;
  var lastScroll = 0;

  /* ---------- Mobile menu ---------- */
  function syncScrollLock() {
    body.classList.toggle("locked", (menu && !menu.hidden) || Boolean(dialog && dialog.open));
  }
  function setMenu(open, restoreFocus) {
    if (!menu || !menuToggle) return;
    if (restoreFocus === undefined) restoreFocus = true;
    menu.hidden = !open;
    menuToggle.setAttribute("aria-expanded", String(open));
    $(".menu-word", menuToggle).textContent = open ? "Close" : "Menu";
    if (header) header.classList.toggle("menu-open", open);
    if (main) main.inert = open;
    syncScrollLock();
    if (open) { var first = $("a", menu); if (first) first.focus(); }
    else if (restoreFocus) menuToggle.focus();
  }
  if (menuToggle) menuToggle.addEventListener("click", function () { setMenu(menu.hidden); });
  $$("a", menu || document.createElement("div")).forEach(function (link) {
    link.addEventListener("click", function () { setMenu(false, false); });
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      if (menu && !menu.hidden) setMenu(false);
      else if (dialog && dialog.open) dialog.close();
    }
    if (!menu || menu.hidden || event.key !== "Tab") return;
    var focusables = [menuToggle].concat($$("a", menu));
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  smallScreen.addEventListener("change", function () {
    if (!smallScreen.matches && menu && !menu.hidden) setMenu(false, false);
  });

  /* ---------- Header on scroll ---------- */
  window.addEventListener("scroll", function () {
    var current = window.scrollY;
    if (header) {
      header.classList.toggle("scrolled", current > 28);
      header.classList.toggle("header-hidden", current > lastScroll && current > 260 && !(dialog && dialog.open) && (!menu || menu.hidden));
    }
    lastScroll = Math.max(0, current);
  }, { passive: true });

  /* ---------- Reveal on scroll ----------
     NOTE: archive grids are rendered just below, BEFORE the observer is
     created, so dynamically-added cards are observed too. */
  /* (observer setup moved below the grid rendering) */

  /* ---------- Custom cursor + magnetic (fine pointers only) ---------- */
  if (finePointer.matches && !reducedMotion.matches) {
    body.classList.add("has-cursor");
    var cursor = $(".cursor");
    var x = window.innerWidth / 2, y = window.innerHeight / 2, tx = x, ty = y;
    var renderCursor = function () {
      x += (tx - x) * 0.18; y += (ty - y) * 0.18;
      cursor.style.left = x + "px"; cursor.style.top = y + "px";
      requestAnimationFrame(renderCursor);
    };
    window.addEventListener("mousemove", function (event) { tx = event.clientX; ty = event.clientY; }, { passive: true });
    $$(".cursor-view, .cursor-open").forEach(function (item) {
      item.addEventListener("mouseenter", function () {
        $("span", cursor).textContent = item.classList.contains("cursor-open") ? "OPEN" : "VIEW";
        cursor.classList.add("visible");
      });
      item.addEventListener("mouseleave", function () { cursor.classList.remove("visible"); });
    });
    $$(".magnetic").forEach(function (item) {
      item.addEventListener("mousemove", function (event) {
        var box = item.getBoundingClientRect();
        var dx = (event.clientX - box.left - box.width / 2) * 0.12;
        var dy = (event.clientY - box.top - box.height / 2) * 0.18;
        item.style.transform = "translate(" + dx + "px," + dy + "px)";
      });
      item.addEventListener("mouseleave", function () { item.style.transform = ""; });
    });
    renderCursor();
  }

  var yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ============================================================
     ARCHIVE DATA — ADD NEW PROJECTS HERE
     Web: append an object to WEB_ARCHIVE (same fields as the homepage
     HOMEPAGE SELECTIONS block). Use { placeholder: true } for a
     clearly-marked future slot, or just omit it.
     Motion: add the project to content.js "projects", then append
     { key, n, thumb, alt } to MOTION_ARCHIVE below.
     ============================================================ */
  var WEB_ARCHIVE = [
    { n: "01", title: "Luméa Beauty", category: "WEB DESIGN / DEVELOPMENT", year: "2026",
      thumb: "/assets/lumea-site.webp", alt: "Luméa Beauty interactive lipstick storefront homepage",
      href: "https://lumea-beauty-portfolio.vercel.app/", aria: "Open the live Luméa Beauty website",
      description: "Interactive lipstick storefront concept for a beauty brand." },
    { n: "02", title: "BMW M4 Competition", category: "WEB DESIGN / DEVELOPMENT", year: "2026",
      thumb: "/assets/web-bmw-m4.webp", alt: "BMW M4 Competition concept website homepage",
      href: "https://bmw-m4-concept.vercel.app/", aria: "Open the BMW M4 Competition concept website",
      description: "Editorial concept site for the BMW M4 Competition coupé." },
    { n: "03", title: "Captured by Andrew", category: "WEB DESIGN / DEVELOPMENT", year: "2026",
      thumb: "/assets/web-andrew.webp", alt: "Captured by Andrew automotive photographer portfolio homepage",
      href: "https://andrew-auto-portfolio.vercel.app/", aria: "Open the Captured by Andrew portfolio website",
      description: "Portfolio and photo store for an automotive photographer." },
    { n: "04", title: "Constance N.", category: "WEB DESIGN / DEVELOPMENT", year: "2026",
      thumb: "/assets/web-constance.webp", alt: "Constance N. wedding photographer portfolio homepage",
      href: "https://constance-preview.vercel.app/", aria: "Open the Constance N. portfolio preview website",
      description: "Portfolio concept for a wedding photographer." }
  ];

  var MOTION_ARCHIVE = [
    { key: "showreel", n: "01", thumb: "/assets/showreel.webp", alt: "Zentic Motion showreel 2026 artwork" },
    { key: "macbook", n: "02", thumb: "/assets/macbook.webp", alt: "MacBook Pro product animation frame" },
    { key: "airpods", n: "03", thumb: "/assets/airpods.webp", alt: "AirPods Pro in a 3D product scene" },
    { key: "typography", n: "04", thumb: "/assets/typography.webp", alt: "Kinetic typography animation frame" },
    { key: "watch", n: "05", thumb: "/assets/watch.webp", alt: "Galaxy Watch advertisement concept frame" },
    { key: "brand", n: "06", thumb: "/assets/brand.webp", alt: "Cinematic brand motion film frame" }
  ];

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  function num(n) { return '<span class="sel-num" aria-hidden="true">' + n + "</span>"; }
  function meta(p) { return '<p class="sel-meta"><span>' + esc(p.category) + "</span><span>" + esc(p.year) + "</span></p>"; }
  function desc(p) { return p.description ? '<p class="sel-desc">' + esc(p.description) + "</p>" : ""; }

  function webCard(p, i) {
    var d = (i * 0.07).toFixed(2) + "s";
    if (p.placeholder) {
      return '<article class="sel-card sel-empty js-reveal" style="--d:' + d + '" role="listitem" aria-label="Open project slot ' + p.n + '">' +
        '<div class="sel-media sel-media-empty">' + num(p.n) + '<span class="sel-plus" aria-hidden="true">+</span></div>' +
        '<div class="sel-info"><h3>Open slot</h3><p class="sel-meta"><span>FUTURE PROJECT</span><span>&mdash;</span></p></div></article>';
    }
    return '<article class="sel-card js-reveal" style="--d:' + d + '" role="listitem">' +
      '<a class="sel-media cursor-open" href="' + esc(p.href) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(p.aria) + '">' +
      '<img src="' + esc(p.thumb) + '" alt="' + esc(p.alt) + '" width="1200" height="600" loading="lazy" decoding="async" />' +
      num(p.n) + '<span class="sel-view" aria-hidden="true">VIEW <i>↗</i></span></a>' +
      '<div class="sel-info archive-info"><div class="archive-titles"><h3>' + esc(p.title) + "</h3>" + desc(p) + "</div>" + meta(p) + "</div></article>";
  }

  function motionCard(p, i) {
    var d = (i * 0.07).toFixed(2) + "s";
    var project = config && config.projects ? config.projects[p.key] : null;
    if (!project) return "";
    return '<article class="sel-card js-reveal" style="--d:' + d + '" role="listitem">' +
      '<a class="sel-media sel-media-video media-link cursor-view" href="#" data-project="' + esc(p.key) + '" aria-label="Watch ' + esc(project.title) + '">' +
      '<img src="' + esc(p.thumb) + '" alt="' + esc(p.alt) + '" width="1600" height="900" loading="lazy" decoding="async" />' +
      num(p.n) + '<span class="sel-play" aria-hidden="true">▶</span></a>' +
      '<div class="sel-info archive-info"><div class="archive-titles"><h3>' + esc(project.title) + "</h3>" + desc(project) + "</div>" +
      '<p class="sel-meta"><span>' + esc(project.category.toUpperCase()) + "</span><span>2026</span></p></div></article>";
  }

  var webGrid = $("#archive-web");
  if (webGrid) webGrid.innerHTML = WEB_ARCHIVE.map(webCard).join("");
  var motionGrid = $("#archive-motion");
  if (motionGrid) motionGrid.innerHTML = MOTION_ARCHIVE.map(motionCard).join("");

  /* ---------- Reveal on scroll (after grids are rendered) ---------- */
  var revealElements = $$(".js-reveal");
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    revealElements.forEach(function (el) { el.classList.add("in-view"); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -4%" });
    revealElements.forEach(function (el) { revealObserver.observe(el); });
  }
  reducedMotion.addEventListener("change", function () {
    if (reducedMotion.matches) revealElements.forEach(function (el) { el.classList.add("in-view"); });
  });

  /* ---------- Film player (motion archive) ---------- */
  function openProject(key, trigger) {
    var project = config && config.projects ? config.projects[key] : null;
    if (!project || !dialog || typeof dialog.showModal !== "function") return false;
    previousFocus = trigger;
    $("#film-title").textContent = project.title;
    $("#film-category").textContent = project.category;
    $("#film-description").textContent = project.description;
    $("#film-tools").textContent = project.tools;
    var source = project.original || ("https://player.cloudinary.com/embed/?cloud_name=dtmah5v1c&public_id=" + encodeURIComponent(project.publicId));
    $("#film-source").href = source;
    var area = $("#player-area");
    area.replaceChildren();
    if (project.type === "iframe") {
      var frame = document.createElement("iframe");
      frame.title = project.title;
      frame.src = project.src;
      frame.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
      frame.allowFullscreen = true;
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      area.append(frame);
    } else {
      var video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.poster = String(project.poster || "").replace(/^\.\//, "/");
      video.src = "https://res.cloudinary.com/dtmah5v1c/video/upload/q_auto,vc_h264/" + encodeURIComponent(project.publicId) + ".mp4";
      video.addEventListener("error", function () {
        $(".player-help").textContent = "The film could not load here. Use Open original to watch it.";
      }, { once: true });
      area.append(video);
      video.play().catch(function () {});
    }
    $(".player-help").textContent = "If playback doesn’t start, open the original.";
    dialog.showModal();
    syncScrollLock();
    var closeBtn = $(".dialog-close");
    if (closeBtn) closeBtn.focus();
    return true;
  }

  $$("[data-project]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (openProject(link.dataset.project, link)) event.preventDefault();
    });
  });

  var dialogClose = $(".dialog-close");
  if (dialogClose && dialog) dialogClose.addEventListener("click", function () { dialog.close(); });
  if (dialog) {
    dialog.addEventListener("click", function (event) {
      if (event.target !== dialog) return;
      var box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    dialog.addEventListener("close", function () {
      $$("video", dialog).forEach(function (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      });
      $("#player-area").replaceChildren();
      syncScrollLock();
      if (previousFocus && previousFocus.focus) previousFocus.focus({ preventScroll: true });
    });
  }
})();
