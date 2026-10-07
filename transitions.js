/* Zentic Motion — internal page transitions.
   A subtle veil covers quick cross-page navigation (Home <-> /web/ <-> /motion/).
   The full Z/M startup intro stays exclusive to the initial homepage load. */
(() => {
  "use strict";

  var veil = document.querySelector(".page-veil");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Entrance: subpages start veiled (CSS) and fade in. The homepage keeps its
     own loader intro, so no entrance veil runs there. */
  if (veil && document.body.classList.contains("subpage")) {
    if (reduced) {
      veil.style.display = "none";
    } else {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { veil.classList.add("is-out"); });
      });
    }
  }

  function isSameDocument(url) {
    return url.pathname === location.pathname && url.search === location.search;
  }

  document.addEventListener("click", function (event) {
    var a = event.target.closest ? event.target.closest("a[href]") : null;
    if (!a || event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (a.target === "_blank" || a.hasAttribute("data-project")) return;

    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || href.indexOf("mailto:") === 0 || href.indexOf("tel:") === 0) return;

    var url;
    try { url = new URL(href, location.href); }
    catch (e) { return; }
    if (url.origin !== location.origin) return;
    if (isSameDocument(url)) return; /* fragment scroll on the same page */

    event.preventDefault();
    var go = function () { location.href = url.href; };
    if (reduced || !veil) { go(); return; }
    veil.classList.remove("is-out");
    veil.classList.add("is-in");
    window.setTimeout(go, 420);
  });
})();
