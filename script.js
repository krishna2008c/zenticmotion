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
  let menuCloseTimer = 0;
  let lastScroll = 0;

  heroCover?.addEventListener("error", () => {
    heroCover.src = "./assets/showreel.webp";
  }, { once: true });
  // the remote thumbnail can fail before this deferred script attaches the listener above
  if (heroCover?.complete && !heroCover.naturalWidth) heroCover.src = "./assets/showreel.webp";

  /* ---------- Opening sequence ----------
     CSS drives the mark's entrance from first paint. Here we only decide WHEN the blue layer
     leaves: after a minimum hold, and once fonts and the hero image are ready (capped, so a slow
     network can never trap the visitor). Runs once per page load. */
  function runIntro() {
    const loader = $(".loader");
    const themeMeta = $('meta[name="theme-color"]');
    const setTheme = (color) => themeMeta?.setAttribute("content", color);
    if (!loader) {
      body.classList.remove("loading", "intro-reveal");
      setTheme("#0b0b0b");
      return;
    }

    const reduced = reducedMotion.matches;
    const MIN_HOLD = reduced ? 900 : 1700;  // ms the finished mark has to be on screen from its start
    const MAX_WAIT = 3400;                  // hard cap on waiting for assets
    const EXIT_MS = reduced ? 520 : 1120;   // keep in sync with --exit in the CSS
    const TAIL_MS = reduced ? 0 : 2400;     // long enough for the slowest homepage entrance to finish

    // the mark's CSS animation starts at first paint, before this script runs: account for that
    const probe = $(".zm-sl", loader)?.getAnimations?.()[0];
    const elapsed = Math.min(Number(probe?.currentTime) || 0, MIN_HOLD);

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    // hero image: wait for whichever source ends up loading (the page swaps to a local copy if the remote one fails)
    const heroReady = !heroCover ? Promise.resolve() : new Promise((resolve) => {
      const ready = () => (heroCover.decode ? heroCover.decode().catch(() => {}) : Promise.resolve()).then(resolve);
      if (heroCover.complete) ready();   // already loaded, or already failed: nothing left to wait for
      else heroCover.addEventListener("load", ready, { once: true });
    });

    // the layer is a pure overlay: don't let touch scrolling move the page underneath it
    loader.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });

    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      loader.remove();
      body.classList.remove("loading");
      setTheme("#0b0b0b");
      // the homepage entrance may still be settling; drop its class once it is done
      setTimeout(() => body.classList.remove("intro-reveal"), Math.max(0, TAIL_MS - EXIT_MS));
    }

    function exit() {
      body.classList.add("intro-reveal");
      loader.classList.add("is-exit");
      if (!reduced) setTimeout(() => setTheme("#0b0b0b"), EXIT_MS * 0.5);
      loader.addEventListener("transitionend", (event) => { if (event.target === loader) finish(); });
      setTimeout(finish, EXIT_MS + 250);
    }

    Promise.race([
      Promise.all([sleep(MIN_HOLD - elapsed), fontsReady, heroReady]),
      sleep(MAX_WAIT - elapsed),
    ]).then(exit, exit);
  }
  runIntro();

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
    clearTimeout(menuCloseTimer);
    if (open) {
      menu.hidden = false;
      /* let the browser paint the unhidden menu, then trigger the transition */
      if (reducedMotion.matches) menu.classList.add("open");
      else requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add("open")));
    } else {
      menu.classList.remove("open");
      /* keep it in the DOM until the exit transition finishes */
      if (reducedMotion.matches) menu.hidden = true;
      else menuCloseTimer = setTimeout(() => { if (!menu.classList.contains("open")) menu.hidden = true; }, 650);
    }
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
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!contactForm.reportValidity()) return;
    const data = new FormData(contactForm);
    const payload = {
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      service: String(data.get("service") || "").trim(),
      message: String(data.get("message") || "").trim(),
      company: String(data.get("company") || "").trim(), // honeypot
    };
    const sendBtn = contactForm.querySelector(".send-button");
    const sendLabel = sendBtn.querySelector("span");
    const originalLabel = sendLabel.textContent;
    sendBtn.disabled = true;
    sendLabel.textContent = "SENDING…";
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error(out.error || "Send failed.");
      contactForm.reset();
      toast("Brief sent — I'll reply within 48 hours.");
    } catch (err) {
      // Fallback: open the visitor's email app with the prefilled brief.
      const service = payload.service || "Zentic Motion project";
      const subject = `Project enquiry — ${service}`;
      const brief = `Hi Krishna,\n\n${payload.message}\n\nProject type: ${service}\nName: ${payload.name}\nEmail: ${payload.email}`;
      $("#draft-text").value = `To: ${config.email}\nSubject: ${subject}\n\n${brief}`;
      $("#draft-fallback").hidden = false;
      toast("Couldn't send directly — your email app is opening instead.");
      location.href = `mailto:${config.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(brief)}`;
    } finally {
      sendBtn.disabled = false;
      sendLabel.textContent = originalLabel;
    }
  });
  // Custom service dropdown — full styling control, same form API (#service).
  (() => {
    const root = $("#service-select");
    if (!root) return;
    const button = root.querySelector(".cs-button");
    const valueEl = root.querySelector(".cs-value");
    const list = root.querySelector(".cs-list");
    const input = $("#service");
    const options = [...root.querySelectorAll('[role="option"]')];
    let hi = -1;

    const setService = (val) => {
      input.value = val || "";
      const match = options.find((o) => o.dataset.value === val);
      options.forEach((o) => o.setAttribute("aria-selected", String(o === match)));
      valueEl.textContent = match ? match.textContent.trim() : "Select a service";
      valueEl.classList.toggle("placeholder", !match);
      hi = match ? options.indexOf(match) : -1;
    };
    const isOpen = () => !list.hidden;
    const open = () => {
      list.hidden = false;
      root.classList.add("open");
      button.setAttribute("aria-expanded", "true");
    };
    const close = () => {
      list.hidden = true;
      root.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
      options.forEach((o) => o.classList.remove("hi"));
    };

    button.addEventListener("click", () => (isOpen() ? close() : open()));
    options.forEach((opt, i) => {
      opt.addEventListener("click", () => {
        setService(opt.dataset.value);
        close();
        button.focus();
      });
      opt.addEventListener("mousemove", () => {
        options.forEach((o) => o.classList.remove("hi"));
        opt.classList.add("hi");
        hi = i;
      });
    });
    button.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!isOpen()) open();
        hi = e.key === "ArrowDown"
          ? Math.min(hi + 1, options.length - 1)
          : Math.max(hi - 1, 0);
        options.forEach((o, idx) => o.classList.toggle("hi", idx === hi));
        options[hi].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && isOpen() && hi >= 0) {
        e.preventDefault();
        setService(options[hi].dataset.value);
        close();
      } else if (e.key === "Escape") {
        close();
      }
    });
    document.addEventListener("click", (e) => {
      if (!root.contains(e.target)) close();
    });
    // Service rows on the page prefill the dropdown.
    $$("[data-service]").forEach((link) =>
      link.addEventListener("click", () => setService(link.dataset.service))
    );
  })();

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
