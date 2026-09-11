(() => {
  "use strict";

  const config = window.ZENTIC;
  if (!config) return;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const smallScreen = matchMedia("(max-width: 760px)");
  const finePointer = matchMedia("(pointer: fine) and (hover: hover)");
  const body = document.body;
  const header = $(".site-header");
  const main = $("main");
  const menu = $("#mobile-menu");
  const menuToggle = $(".menu-toggle");
  const dialog = $("#film-dialog");
  const preview = $(".hero-preview");
  const previewToggle = $(".preview-toggle");
  const heroCover = $(".hero-reel img");
  let previousFocus = null;
  let previewPaused = false;
  let previewHovered = false;
  let heroVisible = true;
  let toastTimer = 0;
  let lastScroll = 0;

  heroCover?.addEventListener("error", () => {
    heroCover.src = "./assets/showreel.webp";
  }, { once: true });

  function finishLoader() {
    const loader = $(".loader");
    if (!loader) return;
    $(".loader-track i").style.width = "100%";
    $(".loader-meta strong").textContent = "100";
    loader.classList.add("done");
    body.classList.remove("loading");
    setTimeout(() => loader.remove(), 500);
  }

  function runLoader() {
    if (reducedMotion.matches) {
      finishLoader();
      return;
    }
    const counter = $(".loader-meta strong");
    const line = $(".loader-track i");
    let value = 0;
    const tick = () => {
      const remaining = 100 - value;
      value += Math.max(1, Math.ceil(remaining * 0.42));
      value = Math.min(value, 100);
      counter.textContent = String(value).padStart(2, "0");
      line.style.width = `${value}%`;
      if (value < 100) setTimeout(tick, 16 + Math.random() * 12);
      else setTimeout(finishLoader, 40);
    };
    setTimeout(tick, 40);
  }
  runLoader();

  function toast(message) {
    const element = $(".toast");
    clearTimeout(toastTimer);
    element.textContent = message;
    element.classList.add("visible");
    toastTimer = setTimeout(() => element.classList.remove("visible"), 3200);
  }

  function syncScrollLock() {
    body.classList.toggle("locked", !menu.hidden || Boolean(dialog?.open));
  }

  function setMenu(open, restoreFocus = true) {
    menu.hidden = !open;
    menuToggle.setAttribute("aria-expanded", String(open));
    $(".menu-word", menuToggle).textContent = open ? "Close" : "Menu";
    header.classList.toggle("menu-open", open);
    main.inert = open;
    syncScrollLock();
    if (open) $("a", menu)?.focus();
    else if (restoreFocus) menuToggle.focus();
  }

  menuToggle?.addEventListener("click", () => setMenu(menu.hidden));
  $$("a", menu).forEach((link) => link.addEventListener("click", () => setMenu(false, false)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!menu.hidden) setMenu(false);
      else if (dialog?.open) dialog.close();
    }
    if (menu.hidden || event.key !== "Tab") return;
    const focusables = [menuToggle, ...$$("a", menu)];
    const first = focusables[0];
    const last = focusables.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  smallScreen.addEventListener("change", () => {
    if (!smallScreen.matches && !menu.hidden) setMenu(false, false);
    syncPreview();
  });

  function openProject(key, trigger) {
    const project = config.projects[key];
    if (!project || typeof dialog?.showModal !== "function") return false;
    previousFocus = trigger;
    $("#film-title").textContent = project.title;
    $("#film-category").textContent = project.category;
    $("#film-description").textContent = project.description;
    $("#film-tools").textContent = project.tools;
    const source = project.original || `https://player.cloudinary.com/embed/?cloud_name=dtmah5v1c&public_id=${encodeURIComponent(project.publicId)}`;
    $("#film-source").href = source;
    const area = $("#player-area");
    area.replaceChildren();

    if (project.type === "iframe") {
      const frame = document.createElement("iframe");
      frame.title = project.title;
      frame.src = project.src;
      frame.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
      frame.allowFullscreen = true;
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      area.append(frame);
    } else {
      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.poster = project.poster;
      video.src = `https://res.cloudinary.com/dtmah5v1c/video/upload/q_auto,vc_h264/${encodeURIComponent(project.publicId)}.mp4`;
      video.addEventListener("error", () => {
        $(".player-help").textContent = "The film could not load here. Use Open original to watch it.";
      }, { once: true });
      area.append(video);
      video.play().catch(() => {});
    }

    $(".player-help").textContent = "If playback doesn’t start, open the original.";
    dialog.showModal();
    preview?.pause();
    syncScrollLock();
    $(".dialog-close")?.focus();
    return true;
  }

  $$("[data-project]").forEach((link) => link.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (openProject(link.dataset.project, link)) event.preventDefault();
  }));

  $(".dialog-close")?.addEventListener("click", () => dialog.close());
  dialog?.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog?.addEventListener("close", () => {
    $$("video", dialog).forEach((video) => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    });
    $("#player-area").replaceChildren();
    syncScrollLock();
    previousFocus?.focus({ preventScroll: true });
    syncPreview();
  });

  const contactForm = $("#contact-form");
  contactForm.hidden = false;
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!contactForm.reportValidity()) return;
    const data = new FormData(contactForm);
    const service = String(data.get("service") || "Zentic Motion project");
    const subject = `Project enquiry — ${service}`;
    const brief = `Hi Krishna,\n\n${String(data.get("message")).trim()}\n\nProject type: ${service}\nName: ${String(data.get("name")).trim()}\nEmail: ${String(data.get("email")).trim()}`;
    $("#draft-text").value = `To: ${config.email}\nSubject: ${subject}\n\n${brief}`;
    $("#draft-fallback").hidden = false;
    location.href = `mailto:${config.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(brief)}`;
  });
  $$("[data-service]").forEach((link) => link.addEventListener("click", () => {
    $("#service").value = link.dataset.service;
  }));

  async function copyText(text, success, fallback) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      toast(success);
    } catch {
      fallback();
    }
  }
  const copyEmail = $(".copy-email");
  copyEmail.hidden = false;
  copyEmail.addEventListener("click", () => copyText(config.email, "Email copied.", () => {
    const range = document.createRange();
    range.selectNodeContents($(".email"));
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    toast("Email selected — use Copy on your device.");
  }));
  $("#copy-brief").addEventListener("click", () => copyText($("#draft-text").value, "Brief copied.", () => {
    $("#draft-text").focus();
    $("#draft-text").select();
    toast("Brief selected — use Copy on your device.");
  }));
  $("#year").textContent = String(new Date().getFullYear());

  const revealElements = $$(".js-reveal");
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("in-view"));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -4%" });
    revealElements.forEach((element) => revealObserver.observe(element));
  }

  function syncPreview() {
    if (!preview || !previewToggle) return;
    const allowed = !reducedMotion.matches && !smallScreen.matches && !navigator.connection?.saveData;
    const shouldPlay = allowed && previewHovered && heroVisible && !document.hidden && !dialog?.open && !previewPaused;
    if (!allowed) {
      preview.pause();
      preview.classList.remove("playing");
      previewToggle.hidden = true;
      return;
    }
    if (!preview.src) preview.src = config.preview;
    previewToggle.hidden = false;
    previewToggle.setAttribute("aria-pressed", String(previewPaused));
    previewToggle.textContent = previewPaused ? "Enable preview" : "Preview on hover";
    if (shouldPlay) preview.play().then(() => preview.classList.add("playing")).catch(() => { previewToggle.hidden = true; });
    else {
      preview.pause();
      preview.classList.remove("playing");
    }
  }
  const heroReel = $(".hero-reel");
  heroReel?.addEventListener("mouseenter", () => { previewHovered = true; syncPreview(); });
  heroReel?.addEventListener("mouseleave", () => { previewHovered = false; syncPreview(); });
  heroReel?.addEventListener("focus", () => { previewHovered = true; syncPreview(); });
  heroReel?.addEventListener("blur", () => { previewHovered = false; syncPreview(); });
  preview?.addEventListener("error", () => {
    previewToggle.hidden = true;
    preview.classList.remove("playing");
  });
  previewToggle?.addEventListener("click", () => {
    previewPaused = !previewPaused;
    syncPreview();
  });
  document.addEventListener("visibilitychange", syncPreview);
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) revealElements.forEach((element) => element.classList.add("in-view"));
    syncPreview();
  });
  if ("IntersectionObserver" in window && heroReel) {
    const reelObserver = new IntersectionObserver((entries) => {
      heroVisible = entries[0].isIntersecting;
      syncPreview();
    }, { threshold: 0.08 });
    reelObserver.observe(heroReel);
  } else syncPreview();

  window.addEventListener("scroll", () => {
    const current = scrollY;
    header.classList.toggle("scrolled", current > 28);
    header.classList.toggle("header-hidden", current > lastScroll && current > 260 && !dialog?.open && menu.hidden);
    lastScroll = Math.max(0, current);
    if (!reducedMotion.matches && current < innerHeight) {
      const progress = Math.min(1, current / innerHeight);
      $(".hero-copy").style.transform = `translateY(${progress * 48}px)`;
      $(".hero-reel-wrap").style.setProperty("--scroll-y", `${progress * -30}px`);
      $(".hero-frame-no strong").textContent = String(1 + Math.round(progress * 24)).padStart(3, "0");
    }
  }, { passive: true });

  if (finePointer.matches && !reducedMotion.matches) {
    body.classList.add("has-cursor");
    const cursor = $(".cursor");
    let x = innerWidth / 2;
    let y = innerHeight / 2;
    let targetX = x;
    let targetY = y;
    const renderCursor = () => {
      x += (targetX - x) * 0.18;
      y += (targetY - y) * 0.18;
      cursor.style.left = `${x}px`;
      cursor.style.top = `${y}px`;
      requestAnimationFrame(renderCursor);
    };
    addEventListener("mousemove", (event) => { targetX = event.clientX; targetY = event.clientY; }, { passive: true });
    $$(".cursor-view, .cursor-open").forEach((item) => {
      item.addEventListener("mouseenter", () => {
        $("span", cursor).textContent = item.classList.contains("cursor-open") ? "OPEN" : "VIEW";
        cursor.classList.add("visible");
      });
      item.addEventListener("mouseleave", () => cursor.classList.remove("visible"));
    });
    $$(".magnetic").forEach((item) => {
      item.addEventListener("mousemove", (event) => {
        const box = item.getBoundingClientRect();
        const dx = (event.clientX - box.left - box.width / 2) * 0.12;
        const dy = (event.clientY - box.top - box.height / 2) * 0.18;
        item.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      item.addEventListener("mouseleave", () => { item.style.transform = ""; });
    });
    const hero = $(".hero");
    const reelWrap = $(".hero-reel-wrap");
    hero?.addEventListener("mousemove", (event) => {
      const dx = (event.clientX / innerWidth - 0.5) * 12;
      const dy = (event.clientY / innerHeight - 0.5) * 10;
      reelWrap.style.transform = `translate(${dx}px, calc(${dy}px + var(--scroll-y, 0px))) rotate(2.1deg)`;
    });
    hero?.addEventListener("mouseleave", () => { reelWrap.style.transform = "translateY(var(--scroll-y, 0px)) rotate(2.1deg)"; });
    renderCursor();
  }
})();
