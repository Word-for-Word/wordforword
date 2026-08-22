// Word for Word — skeleton interactivity

// This file is shared verbatim across every page, including generated
// article pages one folder deep (articles/<slug>.html — see
// templates/_header.html and scripts/build_articles.py). Every page now
// links assets via a root-absolute "/assets/..." path (see this repo's
// clean-URL restructuring), so a hardcoded "/assets/images/..." path
// resolves the same regardless of which folder depth the current page
// lives at — no per-page prefix needed here anymore.

// How far the hero has to scroll out of view (as a fraction of its own
// height) before it's treated as "left" for scroll-linked reset purposes.
// Shared between initIntroReveal() (seeding the hero asterisk's initial
// visibility on the intro/scroll handoff) and initHeroEyebrowExit() (the
// ongoing scroll-linked reset) — both need to agree on the same
// definition of "visible," or the seeded value on handoff could
// contradict what the ongoing check computes moments later.
const HERO_EXIT_THRESHOLD = 0.6;

// Only ever true when index.html's own inline <head> script (right after
// __pageLoadStart) found the one-shot sessionStorage flag set — meaning
// this navigation came from clicking the "Overview" nav link (see
// initNavPageFlash() below), not a fresh reload or the logo
// (initLogoSecretEntry() below). That script already added
// html.skip-intro-splash synchronously, hiding the elaborate splash
// before first paint (see style.css) — this constant just lets
// initIntroReveal() know to also shift the HERO's own entrance, instead
// of it still waiting out the (now invisible) splash's multi-second
// head start.
const SKIP_INTRO_SPLASH = document.documentElement.classList.contains("skip-intro-splash");
// True whenever there's no long elaborate splash for this page's own
// hero content to wait out — either it's not the homepage at all (only
// index.html ever has a real .intro-splash element) or it IS the
// homepage but skipping the splash (arrived via the Overview nav link).
// Both cases used to fall through to the FULL splash-length delay math
// below, leaving an abnormally long dead pause on a page whose hero
// otherwise has nothing multi-second to wait for — the quick page-flash
// (or nothing at all, on a secondary page's own fresh load) finishes in
// a fraction of that time.
const HAS_ELABORATE_SPLASH = !!document.querySelector(".intro-splash");
// Subtracted from every --intro-delay AND the final anchor timeout in
// initIntroReveal(), on top of the normal elapsed-time correction.
// Chosen so the EARLIEST --intro-delay in index.html (3220ms, the
// title's first word) lands a bit BEFORE the .page-flash screen (see
// style.css) finishes its own ~1.8s fade/hold/slide-away, not well
// after it — that element is fully hidden under the flash's own opaque
// cover the whole time regardless (see .page-flash's own comment: it
// never lets the real page show through, even mid-fade), so starting
// its .intro-reveal--slide-slow transition a little early just means
// MORE of it is still visibly left to play once the flash actually
// clears, instead of it only starting its motion after the flash is
// already gone.
//
// Was 2400 briefly, tuned against .intro-reveal--slide-slow's OLD 1.6s
// duration — when that duration got cut to 0.8s (its own permanent
// speed now, see that rule's own comment), 2400 started landing pieces
// so early that several finished their ENTIRE transition
// before the flash even cleared (confirmed live via getAnimations():
// the earliest piece's endTime was 1620ms, 180ms before the flash's own
// ~1800ms clear point) — reading as "no delay/animation at all," the
// opposite of this offset's whole purpose. 1800 re-anchors the earliest
// piece to start right around the flash's own clear point instead of
// well before it, so there's always a real, visible chunk of the
// (shorter) transition left to play once revealed — this number depends
// on --slide-slow's CURRENT duration and needs re-tuning again if that
// duration changes.
//
// Was 1300 before that (landing ~120ms after the flash cleared, back
// when --slide-slow was still 1.6s) — per explicit follow-up feedback
// that the whole sequence read as too slow to fully reveal, especially
// the LAST-arriving pieces (the eyebrows/asterisk): bumping this shifts
// the entire staggered choreography earlier as one block (preserving
// its existing relative timing exactly), so every piece lands closer to
// the flash's own clear point without changing how spaced-out they are
// from each other. The header's own entrance is separately driven by
// the html.show-page-flash CSS animation instead (fixed to start right
// at that same ~1.8s mark), so this offset's own effect on the header
// specifically is moot; only title/eyebrows/asterisk still depend on
// it. Applies equally to any OTHER page with its own hero content (see
// HAS_ELABORATE_SPLASH above) — same reasoning, no elaborate splash
// there either.
const SKIP_INTRO_SPLASH_OFFSET_MS = !HAS_ELABORATE_SPLASH || SKIP_INTRO_SPLASH ? 1800 : 0;

// Always land at the top on a refresh/reload — without this, the browser's
// own scroll-restoration silently re-applies whatever scroll position was
// last recorded for this page before any of our JS (Lenis, reveal
// observers) gets a chance to run, which reads as "refreshing dropped me
// back in the middle of the page" instead of a clean reload. Setting this
// BEFORE DOMContentLoaded is what actually pre-empts the browser's own
// restore.
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

document.addEventListener("DOMContentLoaded", () => {
  window.scrollTo(0, 0);
  initPageFlashReady();
  initNavHighlight();
  initLuxuryScroll();
  initHeroAsteriskPosition();
  initAboutHeroTitlePosition();
  // Gated on whenIntroAssetsReady() — see that function's own comment.
  // Previously this whole block ran unconditionally on DOMContentLoaded,
  // which fires once parsing is done regardless of whether the splash's
  // own images have actually finished downloading — on a slow/cold
  // connection (reported live on the freshly-deployed site) that read as
  // a screen cutting in with its own asterisk/caption still missing,
  // popping in moments later mid-sequence. Until this resolves, the user
  // sees nothing but the intro splash's own plain cream background (see
  // .intro-splash in style.css: opacity:0 is the default for every
  // numbered asterisk/caption, only flipped by initSplashScreens() below)
  // — html.intro-scroll-locked (set synchronously before first paint, see
  // index.html's own inline <head> script) keeps the real page from being
  // scrolled into view underneath regardless of how long this wait takes.
  // A no-op (resolves immediately) on every page other than a fresh
  // homepage load, so this doesn't change timing anywhere else.
  whenIntroAssetsReady().then(() => {
    // initSplashScreens() now runs FIRST (was after initIntroReveal()) so
    // splashFinalLandedDelayMs is already set by the time initIntroReveal()
    // reads it — see that variable's own comment for why, and
    // initIntroReveal()'s own comment on the "floor" that reads it for the
    // actual bug this reorder fixes. It still also runs before
    // initIntroSplashHold(), for the original reason: that function reads
    // splashFinalLandedDelayMs too, instead of independently guessing when
    // the "00" screen lands.
    initSplashScreens();
    initIntroReveal();
    initIntroSplashHold();
    initIntroScrollLock();
    // Reads the header's own --intro-delay, which initIntroReveal() just
    // set above (elapsed-time-corrected) — moved here (out of the
    // unconditional block below) specifically to preserve that same-task
    // ordering now that initIntroReveal() itself runs behind this promise
    // instead of unconditionally at DOMContentLoaded.
    initHeaderReady();
  });
  // Everything below is deferred one frame past the block above, per a
  // reported live symptom on a slow machine: the homepage's intro splash
  // showed its final "00" screen's text missing, then abruptly appearing
  // late. All ~19 init calls used to run synchronously in this one
  // DOMContentLoaded handler — a single long task blocking the main
  // thread for however long that whole block takes to execute. On a
  // fast machine that's imperceptible; on a slow one, if DOMContentLoaded
  // itself happens to fire close to the splash's own final cut-in time
  // (not unlikely — MIN_VISUAL_MS/the splash sequence both sit around
  // 2-2.5s, a plausible real DOMContentLoaded time on a slow load too),
  // this block's own execution can itself be the long task that delays
  // the browser from ever painting that final frame on schedule, then
  // "catches up" all at once once the block finishes — exactly the
  // "missing, then abruptly appears" symptom, self-inflicted by this
  // handler's own synchronous weight rather than anything external.
  // None of the functions below touch the splash/hero entrance sequence
  // itself (they're scroll-reveal setup, decorative marquee/cursor bits,
  // the section-4 carousel, nav dropdown, etc.) — nothing a user could
  // even reach yet, since html.intro-scroll-locked blocks scrolling and
  // the splash visually covers the whole page for several seconds
  // regardless. Deferring them by one frame costs nothing perceptible
  // and gives the browser a chance to paint in between. initRevealOnScroll()
  // reads --intro-delay too (on pages with no elaborate splash), but stays
  // correct here regardless of the above: whenIntroAssetsReady() resolves
  // as an immediate microtask on those pages, so initIntroReveal() has
  // already set it by the time THIS callback's own rAF fires.
  requestAnimationFrame(() => {
    // Must run before initRevealOnScroll() — that function's own
    // staggeredTargets query for .quote-block__mask needs these tiles to
    // already exist in the DOM.
    initQuoteBlockTiles();
    initRevealOnScroll();
    initSection4CarouselGate();
    initMosaicReveal();
    initQuoteBlockReveal();
    initSplitCtaReveal();
    initBeyondPageTextReveal();
    // initBeyondPageMagneticImages(); // temporarily disabled per explicit request
    initHeroEyebrowExit();
    initMarqueeAsterisks();
    initMarqueeCentering();
    initCustomCursor();
    initRoleTapReveal();
    initFeaturedCarousel();
    initCarouselReveal();
    initLogoSecretEntry();
    initNavPageFlash();
    initPublicationsDropdown();
    initEditionLightbox();
  });
});

// Manages .nav__dropdown-is-open on .site-header via real JS state (a
// grace-period timer), rather than a live CSS :has(...:hover) condition
// — see .nav__dropdown-hover-zone's own CSS comment for exactly why a
// pure-CSS condition doesn't work here: the hover zone needs its own
// pointer-events to already be "auto" the instant the cursor leaves the
// trigger heading toward it, but a :has(trigger:hover) condition (which
// pointer-events would have to be keyed off) reverts to false in that
// SAME instant, since it's recomputed live on every mousemove — verified
// via Playwright (instrumenting pointer-events and :hover directly frame
// by frame) that this produces a real window where NEITHER element can
// be hovered, reported as the dropdown "jittering" as it starts to open.
// mouseenter on the trigger sets the class (and, in the same synchronous
// step, the zone's pointer-events) BEFORE the cursor ever needs to reach
// the zone; a real elapsed-time grace period (not a same-tick CSS
// recomputation) is what decides when it later reverts, so a fast-
// moving cursor crossing between the two never finds a moment where
// neither is hoverable.
// body.header-ready gates the Publications dropdown's own height
// transition (see that class in style.css) — separate from
// body.intro-finished above on purpose: that class's timing is tuned to
// protect the EYEBROW lines' scroll-exit handoff, which has nothing to
// do with the header, and reusing it here left a real gap where the
// header had visibly finished dropping in but the dropdown's own
// transition hadn't been enabled yet — hovering "Publications" in that
// window (a completely plausible thing for a fresh arrival to do)
// opened the dropdown with an instant height snap instead of animating.
// Driven off the header's own actual transitionend/animationend instead
// of a hardcoded delay, so it's automatically correct whether the
// header just sits there (no entrance at all — the common case for
// every non-homepage page on a fresh load), transitions in via
// .intro-reveal--drop (homepage, fresh load), or animates in via the
// html.show-page-flash-scoped animation (arrival via nav click) — and
// stays correct if any of those timings change later without needing a
// matching number here. The setTimeout fallback exists for
// prefers-reduced-motion (that media query sets `transition: none` on
// .intro-reveal--drop, so transitionend would otherwise never fire) and
// as a general safety net against any other case where neither event
// fires.

// Compensates for a gap between when html.show-page-flash gets set
// (synchronously, at the very top of <body>, before either external
// stylesheet — Google Fonts, this page's own css/style.css — has
// necessarily finished loading) and when the browser can actually FIRST
// PAINT that state. Google Fonts' stylesheet is render-blocking but
// loads independently of this page's own css/style.css, which is what
// actually defines every .page-flash keyframe below — once THAT
// stylesheet parses, the animations tied to html.show-page-flash are
// considered "applied" and start ticking immediately, even while the
// browser is still holding the actual paint back waiting on the (often
// slower, external) Google Fonts request. Reported live: navigating
// between pages, the flash's own short pop-in (a 360ms bounce) and even
// the header's drop-in had already finished ticking through that
// invisible gap by the time anything was actually visible. Gating every
// one of THOSE animations behind a 2nd class (page-flash-ready), added
// only after a real paint has happened (double rAF — same idiom
// initSplitCtaReveal() elsewhere in this file uses for the same reason),
// re-anchors their start to a point the user can actually see, however
// long that earlier, invisible gap turned out to be. html.show-page-
// flash ALONE still covers the real page instantly (see .page-flash's
// own opacity/visibility in the CSS, deliberately NOT gated on this) —
// only the animated portions wait.
function initPageFlashReady() {
  if (!document.documentElement.classList.contains("show-page-flash")) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.add("page-flash-ready");
    });
  });
}

function initHeaderReady() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  let settled = false;
  const markReady = () => {
    if (settled) return;
    settled = true;
    document.body.classList.add("header-ready");
    header.removeEventListener("transitionend", onDone);
    header.removeEventListener("animationend", onDone);
  };
  const onDone = (e) => {
    if (e.target === header) markReady();
  };

  const hasIntroReveal = header.classList.contains("intro-reveal--drop");
  const hasPageFlash = document.documentElement.classList.contains("show-page-flash");
  if (!hasIntroReveal && !hasPageFlash) {
    markReady();
    return;
  }
  header.addEventListener("transitionend", onDone);
  header.addEventListener("animationend", onDone);

  // Must never fire before the entrance it's covering for can actually
  // finish — a fixed 3000ms guess used to fire well before the homepage's
  // own .intro-reveal--drop transition (gated on --intro-delay, up to
  // ~4870ms) even STARTS. Since body.header-ready's own .site-header rule
  // declares its own `transition` shorthand (for `height`) at HIGHER
  // specificity than .intro-reveal--drop's, adding it early doesn't just
  // race harmlessly — it silently REPLACES the opacity/transform
  // transition outright (shorthand properties replace, not merge; see
  // that rule's own comment), snapping the header to fully visible with
  // no animation ever having played. Reading the header's own (already
  // elapsed-time-corrected, see initIntroReveal()) --intro-delay here
  // instead means this stays correct if that delay ever changes, rather
  // than needing a second hardcoded number kept in sync with it by hand.
  const introDelay = hasIntroReveal ? parseFloat(header.style.getPropertyValue("--intro-delay")) || 0 : 0;
  const pageFlashEnd = hasPageFlash ? 2250 : 0; // 1.8s delay + 0.45s duration, see page-flash-header-drop
  const SAFETY_BUFFER_MS = 500;
  setTimeout(markReady, Math.max(introDelay + 450, pageFlashEnd) + SAFETY_BUFFER_MS);
}

// Lets a finished edition's publication-card (see the data-pdf attribute
// added to Volume 1's <article> in index.html/publications/index.html —
// deliberately NOT added to Volume 2/3's cards, which have no finished
// PDF to show yet) open as a click-through page-by-page viewer instead of
// sitting there doing nothing. The whole lightbox is built here rather
// than hand-written in every page's own HTML (same "generated, not
// duplicated" reasoning as the featured-carousel's indicators above) —
// one <article data-pdf="..."> is all a page needs to add to opt in.
//
// Rendering uses pdf.js (Mozilla's PDF renderer), loaded from a CDN only
// on first click rather than unconditionally at page load — this site
// already ships several multi-MB illustration images, and pdf.js itself
// plus a real edition PDF would add real weight to every single page
// load for a feature most visitors never open. Deferring the fetch to
// the actual click means that cost is only ever paid by someone who
// wants it.
function initEditionLightbox() {
  const cards = document.querySelectorAll("[data-pdf]");
  if (!cards.length) return;

  const PDFJS_VERSION = "3.11.174";
  const PDFJS_SCRIPT_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
  const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
  // Renders at 3x the page's native size so the canvas stays crisp on
  // retina displays even though CSS (.edition-lightbox__canvas) then
  // scales it back down to fit the viewport — was 2x, bumped to give
  // setZoomed()'s own full-screen-fill zoom (see its comment) enough
  // real pixels to upscale into without visibly blurring.
  const RENDER_SCALE = 3;

  let overlay = null;
  let canvasEl, pageWrapEl, titleEl, pageCountEl, prevBtn, nextBtn, closeBtn, fullscreenBtn;
  let pdfjsLoadPromise = null;
  let currentDoc = null;
  let currentDocUrl = null;
  let currentPage = 1;
  let renderToken = 0; // guards against a slow previous render landing after a newer one started
  let currentRenderTask = null; // pdf.js refuses a 2nd concurrent render() on the same canvas
  let lastFocusedEl = null;
  let isZoomed = false;
  let dragState = null; // {startX, startY, startScrollLeft, startScrollTop, moved} while a pointer is down
  let idleTimer = null;

  // 2.5s: long enough that turning a page or nudging the mouse toward a
  // button doesn't read as a flicker, short enough that it still
  // actually fades once someone's just sitting there reading.
  const FULLSCREEN_IDLE_MS = 2500;

  // Guarded on is-fullscreen — the UI never auto-hides in the normal
  // windowed view (only fullscreen's own "read the page, not the
  // chrome" framing calls for that), so this is a no-op there rather
  // than silently arming a timer that'd fade controls someone didn't
  // ask to have hidden.
  function armIdleTimer() {
    if (overlay) overlay.classList.remove("is-idle");
    clearTimeout(idleTimer);
    if (!overlay || !overlay.classList.contains("is-fullscreen")) return;
    idleTimer = setTimeout(() => overlay.classList.add("is-idle"), FULLSCREEN_IDLE_MS);
  }
  function clearIdleTimer() {
    clearTimeout(idleTimer);
    if (overlay) overlay.classList.remove("is-idle");
  }

  // Lower bound: guarantees a real zoom even in the unusual case neither
  // fill ratio below clears 1 (e.g. an oddly tiny page on a small
  // viewport). Upper bound: stays under RENDER_SCALE's 3x headroom over
  // the small, windowed (pre-zoom) fitted size — going all the way to 3x
  // would use up that ENTIRE margin, leaving nothing to spare before real
  // upscaling-past-rendered-pixels blur sets in.
  const MIN_ZOOM_SCALE = 1.7;
  const MAX_ZOOM_SCALE = 2.6;

  // The canvas's own fitted (unzoomed) size, measured once right before
  // setZoomed(true) applies a scale — kept around (rather than a plain
  // local variable) so applyZoomScale() below can reuse it without
  // re-measuring. Cleared back to null once fully zoomed back out, so
  // the NEXT zoom-in re-measures fresh rather than reusing a stale rect
  // from before a page turn, a window resize, or a fullscreen toggle
  // changed what "fitted size" even means.
  let zoomBaseRect = null;

  // Explicit px width/height (derived from zoomBaseRect), not a CSS
  // transform: a transform leaves the element's layout box (and so
  // .edition-lightbox__page-wrap's own scrollable overflow) at its
  // pre-transform size in some browsers, which would make the zoomed-in
  // page bigger to look at but impossible to pan around via scroll.
  // Setting real width/height instead grows the actual layout box, which
  // is what .edition-lightbox__page-wrap.is-zoomed's own overflow:auto
  // (see style.css) needs to have anything to scroll.
  function applyZoomScale(scale) {
    const clamped = Math.min(MAX_ZOOM_SCALE, Math.max(1, scale));
    const zoomed = clamped > 1;
    isZoomed = zoomed;
    pageWrapEl.classList.toggle("is-zoomed", zoomed);
    overlay.classList.toggle("is-zoomed", zoomed);
    canvasEl.style.cursor = zoomed ? "grab" : "zoom-in";
    if (zoomed) {
      canvasEl.style.width = `${zoomBaseRect.width * clamped}px`;
      canvasEl.style.height = `${zoomBaseRect.height * clamped}px`;
    } else {
      canvasEl.style.width = "";
      canvasEl.style.height = "";
      pageWrapEl.scrollTop = 0;
      pageWrapEl.scrollLeft = 0;
      zoomBaseRect = null;
    }
  }

  // The click-to-zoom toggle: jumps straight to a scale that FILLS the
  // screen (like object-fit: cover — the LARGER of the two fill ratios
  // below, so neither axis comes up short), not just the small windowed
  // fit enlarged by a flat multiplier — a flat multiplier off a page
  // that was already letterboxed down to fit 82vw/74vh could still land
  // smaller than the full viewport in both axes, defeating "fills the
  // whole screen" per explicit request. Trackpad pinch/ctrl-scroll is
  // deliberately NOT handled here (or anywhere else in this viewer) —
  // an earlier pass DID intercept it to scale the canvas directly, which
  // was reverted per explicit follow-up: that blocked the browser's own
  // native page-zoom, which is what was actually wanted ("the default
  // laptop behavior of freely zooming into a page"), not a custom
  // canvas-relative one. Leaving wheel/gesture events alone here is what
  // lets that native zoom reach the browser unobstructed.
  function setZoomed(zoomed) {
    if (zoomed === isZoomed) return;
    if (zoomed) {
      // Measured BEFORE any class toggling below, deliberately — the
      // .is-zoomed rules that follow strip the canvas's max-width/
      // max-height (see style.css), so measuring after would read its
      // native raster size (RENDER_SCALE=3x the page's real size) instead
      // of the small fitted display size this scale is actually meant to
      // multiply, landing on a wildly oversized canvas (confirmed live:
      // several thousand px, most of it scrolled off past the top-left
      // with no visible way back — this was the actual cause of "only
      // zooms into the top-left corner").
      zoomBaseRect = canvasEl.getBoundingClientRect();
      const fillScale = Math.max(window.innerWidth / zoomBaseRect.width, window.innerHeight / zoomBaseRect.height);
      applyZoomScale(Math.min(MAX_ZOOM_SCALE, Math.max(MIN_ZOOM_SCALE, fillScale)));
    } else {
      applyZoomScale(1);
    }
  }

  // Click-to-toggle and drag-to-pan share the same pointer gesture — this
  // is what actually distinguishes them: a genuine drag moves the pointer
  // more than DRAG_CLICK_THRESHOLD_PX before release, a plain click
  // doesn't. Using pointer events (not mouse+touch separately) covers
  // mouse, touch, and pen through one code path; touch-action:none on
  // the zoomed canvas (see style.css) stops the browser's own native
  // touch-scroll from also grabbing the same gesture, which would
  // otherwise fight this JS-driven scroll for control mid-drag.
  const DRAG_CLICK_THRESHOLD_PX = 6;

  function onCanvasPointerDown(e) {
    if (!isZoomed) return;
    dragState = {
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: pageWrapEl.scrollLeft,
      startScrollTop: pageWrapEl.scrollTop,
      moved: false,
    };
    // Wrapped: real browsers can occasionally reject this (pointer
    // already gone by the time it's called — e.g. a fast synthetic
    // pointercancel, some Safari versions historically), and an
    // uncaught NotFoundError here would abort this handler before
    // dragState is ever read, breaking the click-vs-drag distinction
    // for that whole gesture. Losing capture just means a drag that
    // exits the canvas mid-gesture might stop tracking a bit early —
    // harmless compared to that.
    try {
      canvasEl.setPointerCapture(e.pointerId);
    } catch {}
  }
  function onCanvasPointerMove(e) {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (!dragState.moved && Math.hypot(dx, dy) > DRAG_CLICK_THRESHOLD_PX) {
      dragState.moved = true;
      canvasEl.style.cursor = "grabbing";
    }
    if (dragState.moved) {
      pageWrapEl.scrollLeft = dragState.startScrollLeft - dx;
      pageWrapEl.scrollTop = dragState.startScrollTop - dy;
    }
  }
  function onCanvasPointerUp(e) {
    // No dragState at all (not zoomed, see onCanvasPointerDown's own
    // guard) means every pointerdown->pointerup on the canvas is a plain
    // click — always toggle zoom (on) in that case.
    const wasDrag = dragState ? dragState.moved : false;
    if (dragState) {
      try {
        canvasEl.releasePointerCapture(e.pointerId);
      } catch {}
      canvasEl.style.cursor = "grab";
      dragState = null;
    }
    if (!wasDrag) setZoomed(!isZoomed);
  }
  // A cancelled gesture (e.g. the OS interrupting a drag mid-swipe with
  // its own system gesture) never fires pointerup — without this,
  // dragState would just stay set, silently panning on the NEXT
  // unrelated pointermove that happens to fire before another real
  // pointerdown. No zoom toggle here: a cancel isn't a completed click.
  function onCanvasPointerCancel() {
    dragState = null;
    if (isZoomed) canvasEl.style.cursor = "grab";
  }

  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfjsLoadPromise) return pdfjsLoadPromise;
    pdfjsLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PDFJS_SCRIPT_URL;
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error("pdf.js failed to load"));
      document.head.appendChild(script);
    });
    return pdfjsLoadPromise;
  }

  function buildOverlay() {
    const el = document.createElement("div");
    el.className = "edition-lightbox";
    // Prev/next/close reuse the site's real .diamond-cta markup shape
    // (rotated-square diamond + .diamond-cta--tight sizing) — pure
    // stroke at rest, filling brown (--color-dark) on hover. (An earlier
    // pass tried a fancier "cream fill with the icon cut out as a hole
    // revealing the blurred backdrop" effect via an SVG mask — reverted
    // per explicit follow-up, it didn't read well live; this simpler
    // brown fill was the fallback offered at the time.)
    // Close/prev/next are direct children of the overlay itself
    // (siblings of .edition-lightbox__frame, not inside it) since
    // they're pinned to the actual SCREEN edges, not to the frame's own
    // (narrower) content column — see their own CSS.
    el.innerHTML = `
      <div class="edition-lightbox__backdrop"></div>
      <button type="button" class="edition-lightbox__fullscreen diamond-cta diamond-cta--tight" aria-label="Enter fullscreen">
        <span class="edition-lightbox__fullscreen-icon edition-lightbox__fullscreen-icon--enter" aria-hidden="true"></span>
        <span class="edition-lightbox__fullscreen-icon edition-lightbox__fullscreen-icon--exit" aria-hidden="true"></span>
      </button>
      <button type="button" class="edition-lightbox__close diamond-cta diamond-cta--tight" aria-label="Close">
        <span class="edition-lightbox__close-glyph"></span>
      </button>
      <button type="button" class="edition-lightbox__nav edition-lightbox__nav--prev diamond-cta diamond-cta--tight" aria-label="Previous page" disabled>
        <span class="arrow-glyph">
          <div class="edition-lightbox__nav-arrow" aria-hidden="true"></div>
        </span>
      </button>
      <button type="button" class="edition-lightbox__nav edition-lightbox__nav--next diamond-cta diamond-cta--tight" aria-label="Next page" disabled>
        <span class="arrow-glyph">
          <div class="edition-lightbox__nav-arrow" aria-hidden="true"></div>
        </span>
      </button>
      <div class="edition-lightbox__frame" role="dialog" aria-modal="true" aria-label="Edition viewer">
        <p class="edition-lightbox__title"></p>
        <div class="edition-lightbox__page-wrap">
          <div class="edition-lightbox__skeleton" aria-hidden="true"></div>
          <canvas class="edition-lightbox__canvas"></canvas>
        </div>
        <p class="edition-lightbox__page-count"></p>
      </div>
    `;
    document.body.appendChild(el);

    canvasEl = el.querySelector(".edition-lightbox__canvas");
    pageWrapEl = el.querySelector(".edition-lightbox__page-wrap");
    titleEl = el.querySelector(".edition-lightbox__title");
    pageCountEl = el.querySelector(".edition-lightbox__page-count");
    prevBtn = el.querySelector(".edition-lightbox__nav--prev");
    nextBtn = el.querySelector(".edition-lightbox__nav--next");
    closeBtn = el.querySelector(".edition-lightbox__close");
    fullscreenBtn = el.querySelector(".edition-lightbox__fullscreen");

    el.querySelector(".edition-lightbox__backdrop").addEventListener("click", closeLightbox);
    closeBtn.addEventListener("click", closeLightbox);
    prevBtn.addEventListener("click", () => goToPage(currentPage - 1));
    nextBtn.addEventListener("click", () => goToPage(currentPage + 1));
    canvasEl.style.cursor = "zoom-in";
    canvasEl.addEventListener("pointerdown", onCanvasPointerDown);
    canvasEl.addEventListener("pointermove", onCanvasPointerMove);
    canvasEl.addEventListener("pointerup", onCanvasPointerUp);
    canvasEl.addEventListener("pointercancel", onCanvasPointerCancel);
    fullscreenBtn.addEventListener("click", () => {
      // Toggling is deliberately just a request out to the browser, not
      // a class flip here — is-fullscreen only ever actually gets set
      // from the fullscreenchange listener below, which is the ONE
      // source of truth for whether we're really in fullscreen (it also
      // fires for exits this button had nothing to do with — Escape,
      // the browser's own fullscreen-exit chrome — so a class toggled
      // straight from this click would drift out of sync with reality
      // the first time someone left fullscreen any other way).
      if (document.fullscreenElement) document.exitFullscreen();
      else el.requestFullscreen().catch(() => {});
    });
    document.addEventListener("fullscreenchange", () => {
      const active = document.fullscreenElement === el;
      el.classList.toggle("is-fullscreen", active);
      fullscreenBtn.setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen");
      // Fullscreen mode fits each WHOLE page to the screen (contain —
      // see .edition-lightbox.is-fullscreen .edition-lightbox__canvas in
      // style.css); the click-to-zoom feature deliberately overflows
      // instead (cover, for inspecting fine detail — see setZoomed()'s
      // own comment). Leaving a stale zoom active across THIS switch
      // would size the canvas off whichever base it was measured against
      // before the switch, mismatched against the new one.
      setZoomed(false);
      if (active) armIdleTimer();
      else clearIdleTimer();
    });
    // Auto-hide the UI/title (fullscreen only — see armIdleTimer()'s own
    // guard) after a stretch with no cursor activity, per explicit
    // request: a page filling the whole screen reads more like actually
    // looking at the page, not a viewer chrome, once the controls aren't
    // permanently sitting on top of it. pointerdown (not just
    // pointermove) also counts as activity — a click-to-zoom or a
    // prev/next tap without any preceding hover (a touch, or a mouse
    // that was already sitting still directly over a button) should
    // reset the timer too, not just wait for movement that never comes.
    el.addEventListener("pointermove", armIdleTimer);
    el.addEventListener("pointerdown", armIdleTimer);

    document.addEventListener("keydown", (e) => {
      if (!el.classList.contains("is-open")) return;
      if (e.key === "Escape") {
        // The browser's own fullscreen handling already exits fullscreen
        // on Escape by itself (fires the fullscreenchange listener
        // above) — closing the WHOLE lightbox on the same keystroke,
        // on top of that, would skip a step every fullscreen video
        // player's own convention trains people to expect: Escape backs
        // out one layer at a time, not both at once.
        if (document.fullscreenElement) return;
        closeLightbox();
      } else if (e.key === "ArrowLeft") goToPage(currentPage - 1);
      else if (e.key === "ArrowRight") goToPage(currentPage + 1);
    });

    return el;
  }

  // The page COUNT only ever needs the document's total page count (known
  // the instant getDocument() resolves, before any page is actually
  // rendered/rasterized) — updating it here, synchronously with
  // navigation, is what lets every page turn after the first feel instant
  // instead of showing a "Loading…" flash while pdf.js rasterizes pixels
  // it hasn't even started drawing yet.
  function updatePageUi(pageNum, totalPages) {
    pageCountEl.textContent = `${pageNum} / ${totalPages}`;
    prevBtn.disabled = pageNum <= 1;
    nextBtn.disabled = pageNum >= totalPages;
  }

  function renderPage(pageNum) {
    const doc = currentDoc;
    const token = ++renderToken;
    // Cancelling (rather than just ignoring) the still-running previous
    // render is what actually frees the canvas for THIS render to use —
    // the token check below only guards against a stale render's result
    // landing late, it doesn't stop pdf.js from still being mid-draw.
    if (currentRenderTask) {
      currentRenderTask.cancel();
      currentRenderTask = null;
    }
    doc.getPage(pageNum).then((page) => {
      if (token !== renderToken) return; // a newer page/doc was requested meanwhile
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      canvasEl.width = viewport.width;
      canvasEl.height = viewport.height;
      const ctx = canvasEl.getContext("2d");
      const task = page.render({ canvasContext: ctx, viewport });
      currentRenderTask = task;
      task.promise.then(
        () => {
          if (token !== renderToken) return;
          currentRenderTask = null;
          // Only actually matters the first time (crossfades the shimmer
          // skeleton out) — a no-op re-add on every later page turn.
          pageWrapEl.classList.add("is-ready");
        },
        () => {
          // Rejects when cancel() above interrupts it — expected, not an
          // error, whichever render actually wins updates the canvas
          // instead.
          if (token !== renderToken) return;
          currentRenderTask = null;
        }
      );
    });
  }

  function goToPage(pageNum) {
    if (!currentDoc) return;
    const clamped = Math.min(Math.max(pageNum, 1), currentDoc.numPages);
    if (clamped === currentPage) return;
    // Reset before, not after, navigating — a stale zoomed-in px size
    // measured off the OLD page would otherwise briefly stretch/misfit
    // the new page's own canvas until the next render() replaces it.
    setZoomed(false);
    currentPage = clamped;
    updatePageUi(clamped, currentDoc.numPages);
    renderPage(clamped);
  }

  function openLightbox(card) {
    const url = card.dataset.pdf;
    if (!overlay) overlay = buildOverlay();

    lastFocusedEl = document.activeElement;
    document.body.classList.add("edition-lightbox-open");
    titleEl.textContent = card.dataset.pdfTitle || "";
    setZoomed(false);
    // Same double-rAF idiom initPageFlashReady()/initSplitCtaReveal() use
    // elsewhere in this file for the identical problem: a style change
    // right after inserting a new element can get coalesced with that
    // insertion into one style pass, with no committed "before" state to
    // transition from, so the fade/scale/blur entrance silently never
    // plays — just jumps straight to the open state. A single forced
    // reflow (offsetHeight) was tried first here and still wasn't enough
    // (confirmed live: still snapping straight to fully-open with no
    // visible fade). One rAF fires before the browser has necessarily
    // PAINTED the frame it's scheduled against; only the 2nd rAF is
    // guaranteed to run after that real paint has landed, so THIS is the
    // first point it's actually safe to start the transition from.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add("is-open");
        closeBtn.focus();
      });
    });

    if (currentDocUrl === url && currentDoc) {
      currentPage = 1;
      updatePageUi(1, currentDoc.numPages);
      renderPage(1);
      return;
    }

    // A different (or first-ever) edition: the shimmer skeleton is what
    // covers this wait, not page-count text — reset it so a PREVIOUSLY
    // opened edition's finished canvas doesn't flash in for a split
    // second before this one's own first page is ready.
    pageWrapEl.classList.remove("is-ready");
    pageCountEl.textContent = "";
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    loadPdfJs()
      .then((pdfjsLib) => pdfjsLib.getDocument(url).promise)
      .then((doc) => {
        currentDoc = doc;
        currentDocUrl = url;
        currentPage = 1;
        updatePageUi(1, doc.numPages);
        renderPage(1);
      })
      .catch(() => {
        pageCountEl.textContent = "Couldn't load this edition — try again shortly.";
      });
  }

  function closeLightbox() {
    if (!overlay) return;
    // Otherwise closing the lightbox from INSIDE fullscreen would leave
    // the browser sitting in fullscreen with nothing of ours left in it
    // — the fullscreenchange listener's own el.classList.toggle("is-
    // fullscreen", ...) still runs once this resolves, so is-fullscreen
    // doesn't need clearing here too.
    if (document.fullscreenElement === overlay) document.exitFullscreen();
    overlay.classList.remove("is-open");
    document.body.classList.remove("edition-lightbox-open");
    setZoomed(false);
    if (lastFocusedEl) lastFocusedEl.focus();
  }

  cards.forEach((card) => {
    card.addEventListener("click", () => openLightbox(card));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openLightbox(card);
      }
    });
  });
}

function initPublicationsDropdown() {
  // TEMPORARY: disabled entirely — the dropdown panel itself is already
  // display:none (see templates/_header.html and the 3 hand-authored
  // pages' own nav markup, same TEMPORARY comment there), but hovering
  // still added .nav__dropdown-is-open below, which expands the header
  // to make room for a panel that's no longer actually showing anything.
  // Remove this early return once the dropdown itself comes back.
  return;
  const trigger = document.querySelector(".nav__item--publications");
  const header = document.querySelector(".site-header");
  const hoverZone = document.querySelector(".nav__dropdown-hover-zone");
  if (!trigger || !header || !hoverZone) return;

  // Landing on a page via ANY nav-link click (not just "Publications"
  // itself — e.g. "Overview") leaves the cursor resting wherever that
  // link was, and some browsers then fire a mouseenter on whatever ends
  // up under it as soon as layout settles, even with the mouse never
  // actually moving, reading as the dropdown snapping open uninvited.
  // Real hover intent requires the cursor to have actually traveled some
  // minimum distance since load first; a cursor that's merely resting
  // (however long) never satisfies this, no matter what synthetic events
  // fire. Once real movement happens at all, this stays satisfied for
  // the rest of the page's life — normal hovering afterward is
  // unaffected.
  const MOVE_THRESHOLD_PX = 8;
  // A real mouse/trackpad reports several slightly-different coalesced
  // positions in the first moments after ANY page settles — confirmed
  // as a real source of false positives here, not just a theoretical
  // one: a physically stationary mouse can still clear MOVE_THRESHOLD_PX
  // from pure hardware/OS jitter alone within that window, satisfying
  // this guard before the user has genuinely started moving toward
  // anything. Ignoring movement reported before this grace period closes
  // means the origin point (and everything measured against it) only
  // ever gets seeded from movement that's had a real chance to be
  // intentional.
  const IGNORE_MOVEMENT_BEFORE_MS = 200;
  const trackingStartedAt = performance.now() + IGNORE_MOVEMENT_BEFORE_MS;
  let hasMovedEnough = false;
  let originPoint = null;
  const trackMovement = (e) => {
    if (performance.now() < trackingStartedAt) return;
    if (!originPoint) {
      originPoint = { x: e.clientX, y: e.clientY };
      return;
    }
    if (Math.hypot(e.clientX - originPoint.x, e.clientY - originPoint.y) >= MOVE_THRESHOLD_PX) {
      hasMovedEnough = true;
      document.removeEventListener("mousemove", trackMovement);
    }
  };
  document.addEventListener("mousemove", trackMovement);

  // Matches the CSS close-curve's own no-longer-needed 160ms debounce
  // (removed from CSS — this timer replaces it, see that rule's comment).
  const CLOSE_GRACE_MS = 160;
  let closeTimer = null;

  const open = () => {
    if (!hasMovedEnough) return;
    // The header's own entrance (fade+drop on the homepage, or the
    // page-flash-driven drop on every other page — see initHeaderReady())
    // physically moves the trigger's own on-screen position while it
    // plays. Arriving via a nav-link click leaves the cursor resting
    // exactly where THAT link ends up, so if it happens to be near
    // "Publications" once the header settles, the trigger effectively
    // slides in UNDER a stationary cursor — several browsers fire a
    // genuine mouseenter for that, with a real (if tiny/incidental)
    // mousemove alongside it, which the movement guard above alone
    // can't tell apart from actual intent. Blocking opens until
    // body.header-ready is set (real completion, not a guess) removes
    // the root cause directly: there's no more moving trigger for a
    // resting cursor to end up under by the time this can ever fire.
    if (!document.body.classList.contains("header-ready")) return;
    clearTimeout(closeTimer);
    header.classList.add("nav__dropdown-is-open");
  };
  const scheduleClose = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      header.classList.remove("nav__dropdown-is-open");
    }, CLOSE_GRACE_MS);
  };

  // .nav__dropdown itself (the real, clickable links) doesn't need its
  // own listeners — it's a DOM descendant of `trigger`, and
  // mouseenter/mouseleave (unlike mouseover/mouseout) only fire when the
  // cursor truly enters/exits an element INCLUDING all its descendants,
  // so moving into the dropdown's own links never fires trigger's
  // mouseleave in the first place.
  for (const el of [trigger, hoverZone]) {
    el.addEventListener("mouseenter", open);
    el.addEventListener("mouseleave", scheduleClose);
  }
}

// Unadvertised entry point to the Decap CMS admin panel for club members —
// triple-clicking the nav logo opens it in a new tab, instead of the
// logo's own single-click "go home" behavior. Every click is intercepted
// (not just the 3rd) rather than relying on the native click event's own
// `detail` count: letting the 1st click's default <a href> navigation
// fire immediately would leave the current page before a 2nd/3rd click
// could ever be counted, especially on any page other than the homepage
// itself. Reimplementing "go home" ourselves after a short window with
// fewer than 3 clicks keeps ordinary single/double clicks behaving
// exactly as before.
function initLogoSecretEntry() {
  const logo = document.querySelector(".nav__logo");
  if (!logo) return;

  const homeHref = logo.getAttribute("href");
  const CLICK_WINDOW_MS = 500;
  let clickCount = 0;
  let resetTimer = null;

  logo.addEventListener("click", (e) => {
    e.preventDefault();
    clickCount++;
    clearTimeout(resetTimer);

    if (clickCount >= 3) {
      clickCount = 0;
      window.open("/admin/", "_blank");
      return;
    }

    resetTimer = setTimeout(() => {
      clickCount = 0;
      window.location.href = homeHref;
    }, CLICK_WINDOW_MS);
  });
}

// The 4 top-level nav links (Overview/Publications/About Us/Get
// Involved — the DIRECT <a> children of .nav__links > li, which
// excludes the Publications dropdown's own nested sub-links) each get
// their own quick .page-flash (see style.css) on arrival, themed to
// match the site's intro-splash screens 01-04 in that same order. The
// Publications dropdown's own 4 category links (Interviews/Essays/
// Narratives/Outreach — everything except "Volumes", which leads back
// to index.html, Overview's own page) share screen 02 with the
// Publications link itself, since they're all pages living under that
// same nav item — see templates/category.html's own inline script,
// which shows screen 02 with a caption matching whichever category you
// actually land on. Since every navigation here is a real full page
// load (no client-side routing), the only way to signal "which flash to
// show" across that reload is a one-shot sessionStorage flag, read and
// immediately cleared by the DESTINATION page's own inline script
// (right after __pageLoadStart on index.html; right at the top of
// <body> on every other page) — see those scripts + the
// html.show-page-flash rules in style.css for the other half of this.
// Overview (01) additionally still skips the elaborate homepage-only
// intro splash entirely (see html.skip-intro-splash in style.css)
// rather than playing both.
const NAV_PAGE_FLASH_SCREENS = ["01", "02", "03", "04"];
function initNavPageFlash() {
  const topLevelLinks = document.querySelectorAll(".nav__links > li > a");
  topLevelLinks.forEach((link, i) => {
    const screen = NAV_PAGE_FLASH_SCREENS[i];
    if (!screen) return;
    link.addEventListener("click", () => {
      sessionStorage.setItem("wfw-page-flash", screen);
    });
  });

  // :not(:first-child) skips "Volumes" (see comment above).
  const categoryLinks = document.querySelectorAll(".nav__dropdown a:not(:first-child)");
  categoryLinks.forEach((link) => {
    link.addEventListener("click", () => {
      sessionStorage.setItem("wfw-page-flash", "02");
    });
  });

  // Same flag, for same-site links OUTSIDE the nav entirely — CTA buttons
  // like section 1's "Learn more" (-> about.html) or the publications
  // "View more"/"Read our latest issue!" tiles. Without this, clicking
  // one of those arrives at its destination with no page-flash at all
  // (the nav is the only thing that ever set the flag), which reads as
  // that page's own splash being skipped. `.closest(".nav")` excludes the
  // header links above so this doesn't just redundantly re-set the same
  // flag a second time for them. index.html is deliberately left out of
  // this map — Overview's own flash (see NAV_PAGE_FLASH_SCREENS[0] above)
  // is paired with skip-intro-splash and stays scoped to the ONE
  // top-level "Overview" nav link, per explicit request (see
  // html.skip-intro-splash's own comment).
  // Clean directory-style paths (matching every real href on the site —
  // see index.html's own nav/CTA links) — this map originally used
  // "publications.html"-style keys, which no href on the site actually
  // has, so the lookup below never matched anything and every one of
  // these CTA links (section 1's "Learn more", the publications "View
  // more"/"Read our latest issue!" tiles, the featured carousel's
  // "Volume #" link) silently skipped the destination page's flash
  // entirely. Reported live via "View more" specifically, but the stale
  // keys meant this was broken for all of them, not just that one link.
  const PAGE_FLASH_SCREEN_BY_HREF = {
    "/publications/": "02",
    "/interviews/": "02",
    "/essays/": "02",
    "/narratives/": "02",
    "/outreach/": "02",
    "/about/": "03",
    "/get-involved/": "04",
  };
  document.querySelectorAll("a[href]").forEach((link) => {
    if (link.closest(".nav")) return;
    const screen = PAGE_FLASH_SCREEN_BY_HREF[link.getAttribute("href")];
    if (!screen) return;
    link.addEventListener("click", () => {
      sessionStorage.setItem("wfw-page-flash", screen);
    });
  });
}

// vertical-align: middle centers an inline-block box against the
// font's X-HEIGHT (baseline + half the lowercase-letter height) — not
// its cap-height. The marquee text is all-caps, so a viewer reads
// "centered" as "centered against the capital letters," and x-height
// sits measurably below cap-height for any font. That gap is exactly
// why a vertical-align:middle asterisk reads as "too low" no matter how
// well-centered the glyph itself is within its own box — the box's
// POSITION on the line was the wrong thing. Fixed by abandoning
// vertical-align's keyword-based guess entirely: measure the track's
// actual rendered cap-height via canvas (real ink metrics, not an
// assumed ratio), then shift the glyph by exactly the difference
// between where vertical-align: baseline naturally puts its center
// (boxHeight/2 above the baseline) and where the capital letters' own
// visual center actually sits (capHeight/2 above the baseline).
function alignAsteriskToCapHeight(span, boxHeight, track) {
  document.fonts.ready.then(() => {
    const ctx = document.createElement("canvas").getContext("2d");
    const trackStyle = getComputedStyle(track);
    ctx.font = trackStyle.font || `${trackStyle.fontSize} ${trackStyle.fontFamily}`;
    const capHeight = ctx.measureText("H").actualBoundingBoxAscent;
    const shift = boxHeight / 2 - capHeight / 2;
    span.style.transform = `translateY(${shift}px)`;
  });
}

// Replaces the plain "*" characters in each marquee strip with the
// brown asterisk artwork (assets/images/Brown asterisk.png) instead of
// a bare text glyph or an SVG-built one — a plain raster image sidesteps
// font-metric/line-height quirks (baseline, x-height, glyph ink
// centering) entirely, leaving only the one real remaining problem
// (the box's vertical POSITION within the line), handled by
// alignAsteriskToCapHeight above. Splitting on the literal "*" preserves
// the surrounding &nbsp; spacing already baked into the HTML (it
// survives as plain U+00A0 characters in the split text nodes).
//
// Operates on each track's own child TEXT NODES only (not
// track.textContent as a whole) — every track now has real element
// children (.marquee-banner__word--* spans, one per face; see index.html)
// sitting between the "*" separators, and collapsing to textContent would
// flatten them to plain text, destroying their font overrides.
const MARQUEE_ASTERISK_SIZE = 14; // MUST match .marquee-asterisk img's height in style.css
function initMarqueeAsterisks() {
  const tracks = document.querySelectorAll(".marquee-banner__track");
  for (const track of tracks) {
    // Snapshot first — inserting/removing nodes while iterating the live
    // childNodes list would skip or repeat entries.
    for (const node of Array.from(track.childNodes)) {
      if (node.nodeType !== Node.TEXT_NODE || !node.data.includes("*")) continue;
      const parts = node.data.split("*");
      for (let i = 0; i < parts.length; i++) {
        track.insertBefore(document.createTextNode(parts[i]), node);
        if (i < parts.length - 1) {
          const span = document.createElement("span");
          span.className = "marquee-asterisk";
          const img = document.createElement("img");
          img.src = "/assets/images/Brown asterisk.png";
          img.alt = "";
          span.appendChild(img);
          track.insertBefore(span, node);
          alignAsteriskToCapHeight(span, MARQUEE_ASTERISK_SIZE, track);
        }
      }
      track.removeChild(node);
    }
  }
}

// text-align:center does NOT symmetric-center an overflowing
// .marquee-banner__track the way it might look like it should — that
// only holds for a line that FITS inside its container. Once the line
// is wider than the container (true of every marquee strip site-wide:
// white-space:nowrap + far more repeated words than fit any real
// viewport, by design), confirmed empirically (a standalone test case,
// same CSS) that it instead renders flush against the box's own left
// edge with the entire overflow spilling out to the right, not split
// evenly across both sides. Corrected the same way positionHeroAsterisk
// handles its own metric mismatch: measure each track's real rendered
// position, then nudge with a corrective transform, rather than trust a
// CSS assumption that doesn't hold here.
//
// Targets the MIDDLE Newsreader occurrence by index, not "whichever is
// nearest the viewport's center" (an earlier version) — proximity-based
// picking could land on an occurrence near either end of the repeating
// sequence depending on viewport width, leaving too few full cycles
// buffering ONE side and exposing the sequence's hard start/end as a
// visible gap (confirmed empirically at several widths). The middle
// occurrence always has the same number of full cycles on both sides
// regardless of viewport width, and centers just as exactly — every
// occurrence within one track is the identical word, so which specific
// one lands at dead-center is invisible to the eye.
function centerMarqueeTrack(track) {
  // Reset before measuring — otherwise a stale correction from a
  // previous run (e.g. before a resize) would be baked into this run's
  // own measurement, compounding instead of replacing it.
  track.style.transform = "none";
  const capsSpans = track.querySelectorAll(".marquee-banner__word--caps");
  if (!capsSpans.length) return;
  const target = capsSpans[Math.floor(capsSpans.length / 2)];
  const rect = target.getBoundingClientRect();
  const center = (rect.left + rect.right) / 2;
  const delta = window.innerWidth / 2 - center;
  track.style.transform = `translateX(${delta}px)`;
}

function centerMarqueeTracks() {
  for (const track of document.querySelectorAll(".marquee-banner__track")) {
    // .marquee-banner--scrolling tracks (currently just #get-involved's
    // test variant) drive their own position via a continuous CSS
    // animation (see that class in style.css) — this function's
    // corrective translateX is for the static illusion's fixed centering
    // and would fight (and get immediately overwritten by) that
    // animation, so skip it entirely here.
    if (track.closest(".marquee-banner--scrolling")) continue;
    centerMarqueeTrack(track);
  }
}

// Shared felt speed for every .marquee-banner--scrolling instance, in
// px/s — a single number here (rather than a fixed animation-duration in
// CSS) is what makes #get-involved and #publications move at the exact
// same visual pace despite having different (and differently long)
// content: each instance's own duration below is derived from ITS OWN
// track's real measured width divided by this constant, so a longer
// track takes proportionally longer per loop instead of covering the
// same distance in the same time and LOOKING faster.
// 20 (was effectively ~90 before this constant existed) — per explicit
// follow-up feedback that even the first slowdown was still too fast.
const MARQUEE_SCROLL_SPEED_PX_PER_S = 20;
function setMarqueeScrollMetrics() {
  const scrolls = document.querySelectorAll(".marquee-banner--scrolling .marquee-banner__scroll");
  for (const scroll of scrolls) {
    const track = scroll.querySelector(".marquee-banner__track");
    if (!track) continue;
    // This track's own real rendered width, NOT "50% of the container" —
    // see the CSS comment on .marquee-banner--scrolling .marquee-banner__scroll
    // for why the distinction matters (a reported visible reset at the
    // loop boundary, from sub-pixel drift between the two).
    const width = track.getBoundingClientRect().width;
    if (!width) continue;
    scroll.style.setProperty("--marquee-track-width", `${width}px`);
    scroll.style.animationDuration = `${width / MARQUEE_SCROLL_SPEED_PX_PER_S}s`;
  }
}

// Same measured-width-driven duration technique as setMarqueeScrollMetrics()
// above (see its own comment for why a JS-measured width beats a bare
// -50%/fixed duration), kept as a separate function/selector rather than
// widening that one's query to .partners__scroll — .partners now shares
// .marquee-banner--scrolling's own scroll-triggered REVEAL (the one-time
// fade-in), but its continuous-scroll elements are still their own
// .partners__scroll/.partners__track (not .marquee-banner__scroll/
// .marquee-banner__track), which setMarqueeScrollMetrics()'s query never
// matches — logo images need real vertical centering (a flex row), not
// the text marquees' inline/baseline layout, so they were never merged.
function setPartnersMarqueeMetrics() {
  const scroll = document.querySelector(".partners__scroll");
  if (!scroll) return;
  const track = scroll.querySelector(".partners__track");
  if (!track) return;
  const width = track.getBoundingClientRect().width;
  if (!width) return;
  scroll.style.setProperty("--marquee-track-width", `${width}px`);
  scroll.style.animationDuration = `${width / MARQUEE_SCROLL_SPEED_PX_PER_S}s`;
}

function initMarqueeCentering() {
  centerMarqueeTracks();
  setMarqueeScrollMetrics();
  setPartnersMarqueeMetrics();
  // Re-measure once the real webfonts (Newsreader/Instrument/Kapakana) are
  // actually in — same fallback-vs-real-font reflow reasoning as
  // positionHeroAsterisk. The logos themselves also affect
  // .partners__track's width once loaded (images have no intrinsic size
  // until decoded), so that gets its own settle-then-remeasure below too.
  document.fonts.ready.then(() => {
    centerMarqueeTracks();
    setMarqueeScrollMetrics();
  });
  const partnersTrack = document.querySelector(".partners__track");
  if (partnersTrack) {
    Promise.all(Array.from(partnersTrack.querySelectorAll("img"), whenImageSettled)).then(
      setPartnersMarqueeMetrics
    );
  }
  window.addEventListener("resize", () => {
    centerMarqueeTracks();
    setMarqueeScrollMetrics();
    setPartnersMarqueeMetrics();
  });
}

// Plays the one-time load-in sequence (title -> eyebrows -> nav), driven
// entirely by --intro-delay set per element in the HTML. Double rAF
// ensures the initial opacity:0 state is painted first, so this actually
// transitions instead of jumping straight to visible.
//
// Every --intro-delay is corrected here for time already spent waiting
// on external resources (Google Fonts, the Lenis CDN script — see the
// bare <script> at the very top of <head>) before this function even
// got to run: this function itself only runs on DOMContentLoaded, which
// doesn't fire until every blocking script — including that 3rd-party
// one — has finished loading. On a warm/cached load that's near-
// instant, so it's invisible; on a cold first load (no cached DNS/TLS
// to those hosts yet) it can take real time, and without this
// correction that entire delay gets ADDED on top of each element's
// already-intended --intro-delay, even though the splash's own
// CSS-only timeline (driven by animation-delay, not JS/DOMContentLoaded)
// finishes on schedule regardless — the hero title would then visibly
// lag the now-long-gone splash. Subtracting the elapsed time keeps every
// element anchored to real wall-clock time since navigation start
// instead of "whenever DOMContentLoaded happened to fire."
//
// (A first-paint-anchored version of this correction was tried instead
// of DOMContentLoaded, reasoning that DOMContentLoaded overcounts the
// script-fetch time paint never waited on — but that's backwards: the
// countdown this sets up can only ever start counting once THIS
// FUNCTION runs, which is itself gated by DOMContentLoaded regardless
// of what value gets written to --intro-delay. Anchoring the
// subtraction to paint time instead left the full original delay in
// place on top of a still-late DOMContentLoaded, measurably reproducing
// the ORIGINAL too-late bug on the same slow-Lenis test this comment
// block's fix was verified against — reverted back to DOMContentLoaded
// for that reason.)
//
// Also marks <body> once the whole sequence is genuinely done — see
// .hero__eyebrow-line's CSS: its scroll-linked exit state is scoped to
// body.intro-finished specifically so a fast scroll early on can't
// collide with the eyebrow lines' own intro entrance (both are "not
// .is-visible yet", but need different resting transforms — sliding up
// FROM below to arrive, vs. sliding further up to exit). CRITICAL: this
// timeout must fire AFTER the LATEST --intro-delay + its own
// transition-duration anywhere on the page finishes — currently the
// eyebrow lines themselves (4870ms delay + 1.6s slide-slow = 6470ms,
// +180ms buffer = 6650ms). Firing this too early cuts that transition
// off mid-flight (changing transition-delay while a transition is still
// running effectively breaks it), which looked like "the eyebrows don't
// move at all" when this was hardcoded to 5000ms. Update this number if
// those delays change again — it gets the same elapsed-time correction
// as everything else above, so 6650 is correct for BOTH the full and
// skip paths (the skip path's own SKIP_INTRO_SPLASH_OFFSET_MS is already
// baked into `elapsed`, shifting this anchor's effective real-world
// firing time by that same amount, same as every other delay here).
//
// The Publications dropdown's own height transition used to ALSO gate
// on body.intro-finished (see initHeaderReady() below for why that
// moved to its own, separate body.header-ready class instead) — this
// timeout firing late relative to the header actually finishing its
// entrance is exactly what caused that bug; don't reuse
// body.intro-finished for anything header-entrance-related again.
function initIntroReveal() {
  const introEls = document.querySelectorAll(".intro-reveal");
  if (!introEls.length) {
    // Secondary pages (articles, publications listing, etc.) have no
    // homepage intro sequence to choreograph against — nothing to wait
    // for, so body.intro-finished should be set immediately rather than
    // left unset forever. Plenty of sitewide CSS (e.g. the Publications
    // dropdown's own height transition) is gated on this class.
    document.body.classList.add("intro-finished");
    return;
  }

  // The hero title's squash-and-stretch entrance (.hero__wordmark-word/
  // --for-wrap, see style.css) targets the OUTER wrapper, not the inner
  // .hero__title-exit span/img that actually carries --intro-delay — a
  // CSS custom property set on a child isn't visible to a rule
  // targeting its ancestor, so the wrapper needs its OWN copy of that
  // same value. That copy used to be a second, hand-written
  // --intro-delay in the HTML, kept in sync with the inner one by hand;
  // now it's copied here at runtime instead (see the loop further down,
  // after introEls has already been corrected below) — one less place
  // to remember to update if these delays ever change again.
  //
  // The hero asterisk is timed the same way: instead of its own
  // independent, hand-recomputed --intro-delay (previously "word 2's
  // delay + ~930ms," manually redone by hand every time word 2's own
  // delay changed — reported live as exactly the fragile, easy-to-forget
  // upkeep this generated), its delay is now DERIVED directly from word
  // 2's own corrected delay further down, so retiming word 2 alone is
  // enough to keep the asterisk correctly synced to it.
  const timedEls = introEls;

  // + SKIP_INTRO_SPLASH_OFFSET_MS: 0 normally (no-op); when the splash
  // itself was skipped, this folds the "start earlier" shift into the
  // SAME subtraction already used for real elapsed-load-time correction
  // below (and into the final anchor timeout further down, which reuses
  // this same `elapsed`), rather than needing a second code path.
  const elapsed = Date.now() - (window.__pageLoadStart || Date.now()) + SKIP_INTRO_SPLASH_OFFSET_MS;
  // Floor for the correction below — reported live on a slow/cold load
  // (a hard reload hitting Google Fonts/the Lenis CDN fresh): once
  // `elapsed` alone exceeds an element's own --intro-delay, the plain
  // Math.max(0, ...) below clamps it to 0, so that element starts
  // fading in THE INSTANT is-visible is added, finishing a mere
  // ~0.8-1.6s later — while the splash's OWN hold (initIntroSplashHold(),
  // which starts at this same moment) can't possibly finish faster than
  // splashFinalLandedDelayMs (set by initSplashScreens(), run immediately
  // before this so the value is ready here), itself bounded BELOW by a
  // hard constant regardless of how large elapsed gets — see that
  // function's own SPLASH_SCREEN_MIN_HOLD_MS floor: 4 screen transitions
  // at a guaranteed minimum 400ms real gap each can never finish faster
  // than 1600ms, no matter how long asset loading took. --intro-delay
  // above has no equivalent lower bound (clamps all the way to 0), which
  // is the actual asymmetry: flooring it at splashFinalLandedDelayMs
  // closes that gap using the EXACT same number the splash itself is
  // bound by, rather than a separately-guessed constant that can drift
  // out of sync with it.
  //
  // A prior version floored this at splashFinalLandedDelayMs alone (matching
  // the splash's own screen-cascade floor, reasoning that landing on "00" is
  // the splash's "earliest possible clear time"). It isn't: initIntroSplashHold()
  // still holds "00" up for SPLASH_SCREEN_FINAL_HOLD_MS after it lands, and
  // THEN the splash needs its own INTRO_SPLASH_SLIDE_MS to physically slide
  // away — landing on "00" is only the start of that. Missing those two
  // terms meant the hero's floored delay could undercount the splash's real
  // remaining screen time by ~1.7s, letting the hero's fade+slide finish
  // (invisibly) before the splash actually cleared — confirmed live across
  // a range of elapsed values via getBoundingClientRect() on .intro-splash
  // itself. (A separate earlier attempt added only +SPLASH_SCREEN_MIN_HOLD_MS
  // here and made things worse — that's a DIFFERENT, smaller constant, 400ms
  // short of what's actually needed; the fix is these two terms specifically,
  // not any fixed buffer.)
  const splashReadyFloorMs = splashFinalLandedDelayMs + SPLASH_SCREEN_FINAL_HOLD_MS + INTRO_SPLASH_SLIDE_MS;
  // Was Math.max(0, original - elapsed, splashReadyFloorMs) applied to EACH
  // element independently — reported live as the hero title's pieces
  // sometimes all fading in together with no stagger, on the "Overview"
  // nav-link arrival specifically. Root cause: on that path, elapsed
  // already has SKIP_INTRO_SPLASH_OFFSET_MS (1800) folded in, and
  // splashReadyFloorMs lands at that same ~1800 by construction — so
  // word1's corrected delay (3620 - elapsed) crosses below the floor the
  // moment real load time exceeds roughly 0ms, which is nearly always.
  // Once word1 AND word2/the image ALSO cross below that SAME shared
  // floor (any real load time past ~150-500ms, well within normal
  // variance), Math.max clamped every one of them to the identical
  // 1800ms value independently — collapsing their whole relative stagger
  // (only 130-480ms apart to begin with) onto one instant. Subtracting
  // `elapsed` alone never causes this: every element shifts by the same
  // amount, so gaps between them are preserved. Only the independent
  // per-element floor clamp destroys those gaps. Fix: find how far
  // (if at all) the EARLIEST element's corrected delay sits below the
  // floor, then shift the WHOLE group later by that same single amount —
  // preserves every relative gap exactly, still guarantees nothing starts
  // before splashReadyFloorMs, and is a no-op (identical to the old
  // behavior) whenever nothing would have been floored anyway.
  const correctedDelays = [...timedEls].map(
    (el) => (parseFloat(el.style.getPropertyValue("--intro-delay")) || 0) - elapsed
  );
  const groupShiftMs = Math.max(0, splashReadyFloorMs - Math.min(...correctedDelays));
  timedEls.forEach((el, i) => {
    el.style.setProperty("--intro-delay", `${Math.max(0, correctedDelays[i] + groupShiftMs)}ms`);
  });

  // Squash-stretch wrappers copy their now-corrected delay straight from
  // their own inner .hero__title-exit child — see this function's own
  // earlier comment for why the wrapper needs a copy of this value at
  // all, and why it's derived here rather than hand-duplicated in HTML.
  const squashStretchWraps = document.querySelectorAll(".hero__wordmark-word, .hero__wordmark-for-wrap");
  for (const wrap of squashStretchWraps) {
    const inner = wrap.querySelector(".hero__title-exit");
    if (inner) wrap.style.setProperty("--intro-delay", inner.style.getPropertyValue("--intro-delay"));
  }

  // The asterisk pops in once word 2 has visibly settled: word 2's own
  // (already corrected, just-copied-onto-its-wrapper) delay, plus the
  // shared reveal transition's own duration, plus a small buffer so it
  // pops in just after word 2 finishes settling rather than the instant
  // it does. 800 matches .intro-reveal--slide-slow's own transition
  // duration — update both together if that duration ever changes.
  const HERO_TITLE_TRANSITION_MS = 800;
  const HERO_ASTERISK_SETTLE_BUFFER_MS = 130;
  const asteriskWrap = document.querySelector(".hero__wordmark-asterisk-wrap");
  const word2Wrap = document.querySelector(".hero__wordmark-word--2");
  if (asteriskWrap && word2Wrap) {
    const word2Delay = parseFloat(word2Wrap.style.getPropertyValue("--intro-delay")) || 0;
    asteriskWrap.style.setProperty(
      "--intro-delay",
      `${word2Delay + HERO_TITLE_TRANSITION_MS + HERO_ASTERISK_SETTLE_BUFFER_MS}ms`
    );
    // .is-timed is what actually lets .hero__wordmark-asterisk-wrap's
    // entrance animation apply (see that rule's own comment in
    // style.css) — added here, in the same synchronous block that just
    // set the real --intro-delay above, so the animation can never start
    // (using a stale HTML-authored delay) before this correction lands.
    asteriskWrap.classList.add("is-timed");
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (const el of introEls) el.classList.add("is-visible");
    });
  });

  setTimeout(() => {
    // Compute the hero asterisk's correct visibility BEFORE touching any
    // classes, and pass it along on the event instead of letting the
    // listener re-derive it. getBoundingClientRect() forces a
    // synchronous reflow — calling it AFTER body.intro-finished is added
    // but BEFORE the asterisk's own is-visible is toggled would let the
    // browser "see" and record a genuine (if momentary) in-between state
    // — finished, but not yet visible — as the CSS transition's actual
    // starting point. That's exactly what caused the hero asterisk to
    // visibly snap invisible and re-fade-in right as the intro finished,
    // even though the end state never numerically changed: reading
    // layout here, before either class changes, and letting the
    // listener apply the already-known answer with no layout reads of
    // its own, means there's no reflow wedged between the two class
    // mutations for the browser to treat as a real transition.
    const hero = document.querySelector(".hero");
    let asteriskVisible = true;
    if (hero) {
      const rect = hero.getBoundingClientRect();
      asteriskVisible = Math.max(0, -rect.top) / rect.height < HERO_EXIT_THRESHOLD;
    }
    document.body.classList.add("intro-finished");
    // initHeroEyebrowExit() listens for this to do its FIRST sync of the
    // hero asterisk specifically — see that function for why.
    document.dispatchEvent(new CustomEvent("introfinished", { detail: { asteriskVisible } }));
  }, Math.max(0, 6650 - elapsed, splashReadyFloorMs + 1600 + 180));
  // ^ Same slow-load floor as the --intro-delay correction above, and for
  // the same reason: 6650 (= the eyebrow lines' own 4870ms delay + their
  // 1.6s slide-slow duration + a 180ms buffer) assumes elapsed is small
  // enough that nothing above got floored. On a slow load where it
  // clamped every element's delay to splashReadyFloorMs instead, the
  // LATEST-finishing element also lands at that same floor, not 4870ms —
  // so this timeout needs the matching floor (splashReadyFloorMs + the
  // eyebrows' own 1.6s duration + the same 180ms buffer) or it fires
  // (and hands off to the scroll-linked system, which uses much shorter
  // delays — see initHeroEyebrowExit()) before the reveal it's supposed
  // to wait out has actually finished.
}

// Resolves once a real <img> has either loaded or failed — .complete is
// already true for images the browser finished (or never started, e.g.
// no src) BEFORE this runs, so those resolve instantly; anything still
// in flight is awaited via its own load/error event. Failure resolves
// (doesn't reject) deliberately: a single missing/broken asset should
// never be able to hold the splash hostage forever — see
// initIntroSplashHold()'s own hard timeout for the matching reasoning.
function whenImageSettled(img) {
  if (img.complete) return Promise.resolve();
  return new Promise((resolve) => {
    img.addEventListener("load", resolve, { once: true });
    img.addEventListener("error", resolve, { once: true });
  });
}

// Assets the intro splash's OWN JS-driven sequence needs before it's safe
// to start — the webfont the captions render in, plus all 5 numbered
// asterisks (1/2/3/4/final). 2/3/4 are CSS mask-image sources rather than
// <img> tags (see index.html's own prefetch script for why), so there's
// nothing in the DOM to pass to whenImageSettled() directly — a fresh
// Image() per URL is used to probe them instead; if the prefetch already
// populated the browser's cache for that URL, this resolves practically
// immediately. Same "resolve, never reject" shape as whenImageSettled,
// plus a hard timeout on the whole group — one slow/broken asset must
// never hold the ENTIRE intro (splash AND hero, both gated on this same
// promise in the DOMContentLoaded handler below) hostage forever. A no-op
// (resolves immediately) on any page other than a fresh homepage load —
// SKIP_INTRO_SPLASH means the splash is already force-hidden, and
// !HAS_ELABORATE_SPLASH means there's no splash here to begin with.
const INTRO_ASSETS_READY_TIMEOUT_MS = 8000;
function whenIntroAssetsReady() {
  if (SKIP_INTRO_SPLASH || !HAS_ELABORATE_SPLASH) return Promise.resolve();
  const asteriskUrls = [1, 2, 3, 4].map((n) => `/assets/images/Asterisk ${n}.png`);
  asteriskUrls.push("/assets/images/Asterisk - Default, Cream.png");
  const imagesReady = asteriskUrls.map((src) => whenImageSettled(Object.assign(new Image(), { src })));
  return Promise.race([
    Promise.all([document.fonts ? document.fonts.ready : Promise.resolve(), ...imagesReady]),
    new Promise((resolve) => setTimeout(resolve, INTRO_ASSETS_READY_TIMEOUT_MS)),
  ]);
}

// Transition moments for screens 01/02/03/04/final — moment[i] is BOTH
// "screen i cuts in" AND "screen i-1 hides" (a deliberate no-gap flash-
// straight-into-each-other look, per earlier explicit request — there
// is no separate "hide time," each screen's hide IS the next one's cut).
const SPLASH_SCREEN_CUT_DELAYS_MS = [0, 720, 1140, 1560, 1980];
// Floor on real time between two consecutive screen swaps — see the
// comment inside initSplashScreens() below for why this exists. 400 (was
// 220) — screen 01 now plays its own 120ms-delay + 240ms bounce-in (see
// .intro-splash__asterisk--1.is-cut in style.css), and this floor is
// what guarantees screen 01 stays on-screen long enough for that full
// 360ms sequence to actually finish even in the worst-case (every moment
// clamped) slow-load scenario — 220ms would have let screen 2 cut in
// mid-bounce.
const SPLASH_SCREEN_MIN_HOLD_MS = 400;
// How long the FINAL "00" screen specifically must stay up once it lands
// before initIntroSplashHold() is allowed to consider the splash ready to
// slide away — separate from SPLASH_SCREEN_MIN_HOLD_MS above, which only
// guarantees a real gap BETWEEN screens 01-04, not any dwell time on 00
// itself once it's the one showing. Without this, a slow-enough load lets
// initIntroSplashHold()'s own MIN_VISUAL_MS-elapsed correction clamp to
// (or below) splashFinalLandedDelayMs, so "ready to slide" can fire in the
// same instant "00" lands — reported live as "skips past 00 way too
// quickly." 700ms — longer than the 400ms inter-screen floor since this
// is the one screen a viewer is actually meant to read/register, not just
// glimpse in passing like 01-04.
const SPLASH_SCREEN_FINAL_HOLD_MS = 700;
// Matches .intro-splash.is-ready-to-slide's own `intro-splash-slide 1s`
// duration in style.css — how long the splash itself takes to physically
// slide off-screen once initIntroSplashHold() decides it's ready. Read by
// initIntroReveal()'s own splashReadyFloorMs below: splashFinalLandedDelayMs
// alone only covers "00 has landed," not the FINAL_HOLD dwell on top of it
// or this slide-away afterward — omitting this (an earlier version of that
// floor did) let the hero's floored --intro-delay under-count how long the
// splash is ACTUALLY still covering the screen, so on a moderately slow
// load (elapsed ~1.2s+, not just the extreme all-clamped case) the hero's
// entire fade+slide could finish while still hidden behind the still-up
// splash — confirmed live via getBoundingClientRect() on .intro-splash
// itself: the hero read opacity:1 before the splash had physically left
// the viewport, so it just "popped in already done" the instant the splash
// cleared, no visible motion. Update this if that CSS duration ever
// changes.
const INTRO_SPLASH_SLIDE_MS = 1000;
// Set by initSplashScreens() to the ACTUAL real delay (ms from
// DOMContentLoaded) at which the final/00 screen lands, once computed
// below. initIntroSplashHold() reads this — instead of independently
// re-deriving its own guess at when the splash sequence finishes — so
// the two can never disagree about when it's safe to start sliding the
// splash away. Requires initSplashScreens() to run BEFORE
// initIntroSplashHold() (see the DOMContentLoaded handler's call
// order).
let splashFinalLandedDelayMs = 0;

// Drives ALL 5 intro-splash screens (1/2/3/4/final) through ONE unified
// mechanism — a plain .is-cut opacity toggle, scheduled via setTimeout,
// instead of each screen running its own independent animation-delay/
// steps(1) CSS animation against the shared document timeline.
//
// That per-screen CSS approach held up fine for the general "slow
// connection" case (see the git history for the throttled-network
// investigation that originally shaped this system), but NOT under
// sustained CPU throttling: confirmed live (6x CPU throttle via CDP)
// that document.timeline.currentTime can already report "we're well
// past everything" while the renderer itself hasn't yet caught up
// repainting an EARLIER screen's own CSS animation to match — i.e. two
// independent screens, each independently animating against the same
// document timeline, CAN visibly disagree about where "now" is when the
// browser is struggling to keep up. That showed up exactly as reported:
// the final screen's text rendering on top of screen 4, overlapping.
//
// Reading document.timeline.currentTime ONCE here and scheduling every
// TRANSITION off that same snapshot removes the possibility entirely —
// there is only one JS-owned notion of "now" for the whole sequence.
// Scheduled per TRANSITION MOMENT, not per screen's cut/hide separately:
// an earlier version scheduled each screen's cut and each screen's hide
// as their OWN independent setTimeout calls — even when both happened
// to share the identical computed delay (screen N's hide === screen
// N+1's cut, by design), those are still two separate timer tasks, and
// nothing guarantees a browser can't process a paint between two
// "simultaneously due" timers, especially under load. Reported live as
// a brief blank flash right before screen 00. Grouping "hide the
// previous screen" and "cut the next one" into ONE callback per moment
// closes that gap the same way pairing asterisk+caption in one screen's
// own callback already did — there's no point inside one synchronous
// callback for the browser to paint a frame in the middle of it.
//
// Every moment also carries a MINIMUM real hold (SPLASH_SCREEN_MIN_HOLD_MS)
// on top of its elapsed-corrected ideal delay: on a very slow/cold load
// (this script not even starting until well after navigation — e.g. a
// dev server that had to cold-compile on the first hit of the day),
// `elapsed` can already exceed every momentMs above, which used to
// clamp EVERY Math.max(0, momentMs - elapsed) to 0 — all 5 screens
// toggling within one synchronous burst of back-to-back zero-delay
// timers, with no paint happening in between. The browser then only
// ever actually renders whichever screen was toggled LAST ("00"/final)
// — screens 01-04 get their classes added and removed again before a
// frame ever shows them. Reported live as "a split-second glimpse of
// 00, none of the preceding splashes visible." Per explicit follow-up
// feedback, the splash must always visibly start on 01 no matter what —
// higher priority than keeping the sequence's total length constant, so
// each step is now scheduled at least SPLASH_SCREEN_MIN_HOLD_MS after
// the previous one ACTUALLY fired (not just after its own ideal
// moment), guaranteeing a real paintable gap between every swap even in
// the all-clamped-to-0 case. On a normal-speed load this is a no-op —
// the natural 420ms gaps between real momentMs values already exceed
// this floor, so Math.max just keeps the original ideal delay.
//
// Trade-off, deliberately accepted: screen 1 no longer appears before
// DOMContentLoaded (it used to, as pure CSS, independent of JS) — on a
// connection so slow that DOMContentLoaded itself is delayed, the cream
// background now just shows a bit longer first. Chosen over the
// alternative (visibly overlapping/gapping screens under load) per
// explicit feedback that the latter is the higher-priority failure mode.
function initSplashScreens() {
  // Same guard as initIntroSplashHold() — the whole splash is already
  // force-hidden via the html.skip-intro-splash CSS rule, so there's
  // nothing for this to usefully schedule.
  if (SKIP_INTRO_SPLASH) return;
  const splash = document.querySelector(".intro-splash");
  const screens = [1, 2, 3, 4, "final"].map((n) => ({
    asterisk: document.querySelector(`.intro-splash__asterisk--${n}`),
    caption: document.querySelector(`.intro-splash__caption--${n}`),
  }));
  if (!splash || !screens.every((s) => s.asterisk && s.caption)) return;

  const lastMomentIndex = SPLASH_SCREEN_CUT_DELAYS_MS.length - 1;
  const elapsed = (document.timeline.currentTime || 0) + SKIP_INTRO_SPLASH_OFFSET_MS;
  let scheduledDelay = 0;
  for (const [i, momentMs] of SPLASH_SCREEN_CUT_DELAYS_MS.entries()) {
    const prev = screens[i - 1];
    const next = screens[i];
    const idealDelay = Math.max(0, momentMs - elapsed);
    // Never schedule sooner than SPLASH_SCREEN_MIN_HOLD_MS after the
    // PREVIOUS moment's own scheduled (not ideal) delay — guarantees a
    // real gap even when every idealDelay above has collapsed to 0.
    scheduledDelay = i === 0 ? idealDelay : Math.max(idealDelay, scheduledDelay + SPLASH_SCREEN_MIN_HOLD_MS);
    if (i === lastMomentIndex) splashFinalLandedDelayMs = scheduledDelay;
    setTimeout(
      () => {
        if (prev) {
          prev.asterisk.classList.remove("is-cut");
          prev.caption.classList.remove("is-cut");
        }
        next.asterisk.classList.add("is-cut");
        next.caption.classList.add("is-cut");
        // The cream->red background crossfade happens at this SAME
        // moment (landing on the final/00 screen) — see the CSS
        // comment on .intro-splash for why this is a plain inline style
        // set here, in the same callback, rather than a second
        // independently-timed CSS animation.
        if (i === lastMomentIndex) splash.style.backgroundColor = "var(--color-red)";
      },
      scheduledDelay
    );
  }
}

// Keeps the intro splash lingering on its final "00" logo screen until
// the page is ACTUALLY ready, instead of sliding away on a fixed
// 2480ms timer regardless — that fixed timer is what let a slow
// connection show the splash (and the hero's own CSS-driven asterisk)
// finish right on schedule while the JS-driven main content
// (initIntroReveal()'s title/eyebrows/nav, gated on DOMContentLoaded)
// was still stuck invisible behind it, so the splash cleared onto a
// still-blank page. Waits for the LATER of two things:
//   1. The original minimum visual time (2480ms, elapsed-corrected the
//      same way every other intro timing on this page is) — so on a
//      normal connection this behaves EXACTLY as before, no added
//      delay. On a slow load where initSplashScreens() had to fire its
//      whole sequence in a rapid burst, this naturally clamps to 0 extra
//      wait — nothing left to protect once every screen's own state is
//      already settled.
//   2. Real readiness: fonts AND every <img> the hero itself reveals
//      (wordmark "for", hero asterisk, nav logo) finished loading —
//      avoids revealing the title in a fallback font/missing image and
//      then visibly popping in the instant the splash clears (exactly
//      the "skips a step" symptom on a slow connection: fonts.ready can
//      resolve fine while these plain <img> loads are still pending,
//      since they're a completely separate load path). Capped at a
//      hard 8s timeout so a genuinely broken/never-loading resource
//      can't hold the splash forever.
// DOMContentLoaded itself isn't part of the readiness race here: this
// function only runs from inside that event's own handler, so by
// construction it's already true by the time this code executes.
function initIntroSplashHold() {
  const splash = document.querySelector(".intro-splash");
  // Already force-hidden by the html.skip-intro-splash CSS rule (see
  // style.css) — no point racing fonts/timers to reveal a splash that's
  // permanently opacity:0 either way.
  if (!splash || SKIP_INTRO_SPLASH) return;

  const MIN_VISUAL_MS = 2480; // matches the slide-away delay this replaces
  const READY_TIMEOUT_MS = 8000;

  // document.timeline.currentTime, NOT Date.now() - window.__pageLoadStart
  // — see initSplashScreens()'s own comment for the full story: a
  // Date.now()-based proxy can drift from the real document timeline
  // under exactly the conditions (something delaying THIS SCRIPT's own
  // execution specifically) this elapsed-time correction exists for.
  const elapsed = document.timeline.currentTime || 0;
  // Math.max against splashFinalLandedDelayMs (set by initSplashScreens(),
  // which runs before this — see the DOMContentLoaded handler's call
  // order): on a slow/cold load where the screen-cut sequence needed its
  // own SPLASH_SCREEN_MIN_HOLD_MS floor to guarantee 01-04 are each
  // actually visible (see that function's comment), the "00" screen can
  // land LATER than this MIN_VISUAL_MS constant assumes. Without this,
  // the splash could start sliding away before "00" has even cut in —
  // sliding away mid-sequence, on top of whichever screen happened to be
  // showing.
  //
  // splashFinalLandedDelayMs alone only guarantees "00" has LANDED by
  // the time this resolves — not that it's been VISIBLE for any real
  // stretch afterward. On a slow enough load, MIN_VISUAL_MS - elapsed
  // clamps to 0 (or below splashFinalLandedDelayMs) at the exact same
  // time "00" lands, so minVisualTime and the screen-cut can resolve in
  // the same instant: "00" never actually gets looked at before
  // is-ready-to-slide fires (readiness is frequently already true by
  // this point too, having had the whole rest of the sequence to
  // settle) — reported live as "skips past 00 way too quickly," still
  // reproducing even after flooring initIntroReveal()'s own delays
  // against splashFinalLandedDelayMs (a related but DIFFERENT bug — that
  // one was about the HERO finishing before the splash could clear, not
  // about "00" itself getting a real dwell). SPLASH_SCREEN_FINAL_HOLD_MS
  // adds that missing floor: "00" must stay up at least this long after
  // landing, regardless of how clamped everything upstream got.
  const minVisualTime = new Promise((resolve) => {
    setTimeout(
      resolve,
      Math.max(0, MIN_VISUAL_MS - elapsed, splashFinalLandedDelayMs + SPLASH_SCREEN_FINAL_HOLD_MS)
    );
  });
  const heroImages = document.querySelectorAll(".hero img, .nav__logo img");
  const readiness = Promise.race([
    Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      ...Array.from(heroImages).map(whenImageSettled),
    ]),
    new Promise((resolve) => setTimeout(resolve, READY_TIMEOUT_MS)),
  ]);

  Promise.all([minVisualTime, readiness]).then(() => {
    splash.classList.add("is-ready-to-slide");
  });
}

// Removes html.intro-scroll-locked (see style.css) once the splash has
// ACTUALLY finished sliding away — not a fixed guess at a duration, so
// this stays correct even if any of the intro's own timings change
// later. The grey layer (.intro-splash-layer--grey) is the last of the
// 3 stacked full-screen layers to clear (see the HTML/CSS comments
// above the splash for the brown/grey "rapidfire cascade" order), so
// its own slide finishing is the exact moment the real page is fully
// uncovered and safe to scroll again. No-op if the splash was skipped
// entirely (see SKIP_INTRO_SPLASH above) — nothing was ever locked to
// unlock, since the html.intro-scroll-locked class is only added in the
// first place when NOT skipping (see index.html's own inline <head>
// script).
function initIntroScrollLock() {
  if (SKIP_INTRO_SPLASH) return;
  const greyLayer = document.querySelector(".intro-splash-layer--grey");
  if (!greyLayer) return;
  greyLayer.addEventListener(
    "animationend",
    () => {
      document.documentElement.classList.remove("intro-scroll-locked");
    },
    { once: true }
  );
}

// Pins the hero asterisk to the actual top-right corner of the "d" in
// the second "Word" (measured via .hero__wordmark-d-anchor, a plain
// marker span around just that letter), instead of the CSS fallback
// (top: 50%; right: -13%, a %-of-.hero__wordmark-wrap position). That
// CSS-only position can't track the glyph reliably: .hero__wordmark-wrap's
// width and the word's own font-size are two INDEPENDENT clamp()s with
// different viewport breakpoints (1000/1727px vs 700/1293px), so they're
// only proportional to each other in the narrow band where both happen
// to be unclamped at once — outside it, one is pinned while the other
// keeps scaling, and the asterisk drifts off the "d" by tens of px.
// Measuring the real glyph sidesteps that mismatch entirely.
// Vertical translate component of an element's OWN current transform —
// read-only, no mutation. Used to recover the PERMANENT design nudges
// (see positionHeroAsterisk) without ever touching a live element's
// class/transition state.
function getTranslateY(el) {
  const t = getComputedStyle(el).transform;
  if (!t || t === "none") return 0;
  return new DOMMatrix(t).m42;
}

// Walks the offsetParent chain from `el` up to (not including) `ancestor`,
// summing offsetTop/offsetLeft — el's LAYOUT position relative to
// ancestor, with every `transform` anywhere in between completely
// ignored (offsetTop/Left are pre-transform layout values; transform is
// purely a paint-time effect and never factors into them, including an
// element's OWN transform).
function offsetRelativeTo(el, ancestor) {
  let top = 0;
  let left = 0;
  for (let node = el; node && node !== ancestor; node = node.offsetParent) {
    top += node.offsetTop;
    left += node.offsetLeft;
  }
  return { top, left };
}

function positionHeroAsterisk() {
  const wrap = document.querySelector(".hero__wordmark-wrap");
  const anchor = document.querySelector(".hero__wordmark-d-anchor");
  const asteriskWrap = document.querySelector(".hero__wordmark-asterisk-wrap");
  if (!wrap || !anchor || !asteriskWrap) return;

  // offsetTop/Left (not getBoundingClientRect) for the anchor: the "d"'s
  // own ancestor (.hero__title-exit) carries a scroll-linked
  // translateY(-100px) exit transform, live only while scrolled away —
  // getBoundingClientRect bakes that in if measured at the wrong moment
  // (confirmed live: a 100px vertical error that then just sits there,
  // since nothing re-measures on scroll alone). An earlier attempt fixed
  // this by temporarily forcing that ancestor into its resting state
  // (toggling classes + transition:none) before reading — but that
  // MUTATES the live element, and doing so while its own class-triggered
  // reveal transition hadn't started yet (still inside its
  // transition-delay countdown) or was mid-flight forced it to snap
  // instantly to its target instead of resuming — confirmed live: it
  // permanently broke the word's intended 3700ms-delayed slide-in
  // entrance, since the interrupted transition has nothing left to
  // finish once restored. offsetTop/Left is read-only and sidesteps
  // the whole problem: it ignores every transform up the chain
  // (including that exit one) with zero risk of touching anything live.
  //
  // Ignoring ALL transforms also drops the PERMANENT design nudges
  // sitting in the same ancestor chain (.hero__wordmark-placeholder's
  // translateY(-10px), .hero__wordmark-word--2's translateY(-3px) —
  // both always-on, no class toggle involved, so reading them via
  // getComputedStyle is safe: a plain read, no mutation, can't interfere
  // with anything's timeline). Added back explicitly below. Neither of
  // these transforms is horizontal, so LEFT was never affected by any
  // of this — anchor.offsetWidth/offsetLeft is used as-is.
  const anchorOffset = offsetRelativeTo(anchor, wrap);
  const placeholder = document.querySelector(".hero__wordmark-placeholder");
  const word2 = document.querySelector(".hero__wordmark-word--2");
  const permanentNudgeY =
    (placeholder ? getTranslateY(placeholder) : 0) + (word2 ? getTranslateY(word2) : 0);
  const anchorTop = anchorOffset.top + permanentNudgeY;
  const anchorRight = anchorOffset.left + anchor.offsetWidth;

  // asteriskWrap's own size still needs offsetWidth/Height, not
  // getBoundingClientRect — its `transform` briefly holds a scale/rotate
  // mid-flight during its pop-in and its scroll-triggered respin (see
  // .is-respinning below), and a rotated getBoundingClientRect returns
  // the enlarged axis-aligned box of that rotation, not its plain size.
  const asteriskWidth = asteriskWrap.offsetWidth;
  const asteriskHeight = asteriskWrap.offsetHeight;

  // Centers the asterisk box ON the "d"'s top-right corner point (not
  // flush against it) — reads as the asterisk straddling the corner,
  // matching how it originally sat when the two clamp()s above happened
  // to briefly agree. Right-nudge bumped repeatedly per explicit
  // follow-up feedback: +2 -> +4 -> +5 -> +6. Down-nudge bumped
  // repeatedly per explicit follow-up feedback: +5 -> +20 -> +35 -> +34
  // (1px up).
  //
  // The reusable --compact hero (see its own comment in style.css —
  // publications.html today, about.html/get-involved.html potentially
  // later) carries an extra modifier class for a small nudge (right +
  // down) on top of the shared positioning above — kept as an addition
  // here rather than a fork of this whole function, since everything
  // else about the positioning (anchor glyph, wrap, offsets) is meant to
  // work exactly like the homepage's.
  const isCompact = asteriskWrap.classList.contains("hero__wordmark-asterisk-wrap--compact");
  const extraRight = isCompact ? 4 : 0;
  const extraUp = isCompact ? -6 : 0;
  asteriskWrap.style.top = `${anchorTop - asteriskHeight / 2 + 34 - extraUp}px`;
  asteriskWrap.style.left = `${anchorRight - asteriskWidth / 2 + 6 + extraRight}px`;
  asteriskWrap.style.right = "auto";
}

function initHeroAsteriskPosition() {
  const wrap = document.querySelector(".hero__wordmark-wrap");
  const anchor = document.querySelector(".hero__wordmark-d-anchor");
  positionHeroAsterisk();
  // Re-measure once the real web font is actually in — same fallback-vs-
  // real-font reflow reasoning as initNavHighlight()'s placeIndicator.
  document.fonts.ready.then(positionHeroAsterisk);
  // Both a ResizeObserver AND the window "resize" event — deliberately
  // redundant (positionHeroAsterisk is cheap and idempotent, so firing
  // twice for the same change is harmless). Neither alone covers every
  // case: ResizeObserver reacts to the OBSERVED element's own box
  // changing size, which is smoother than "resize" during a continuous
  // drag (that event is coarsely throttled by the browser) — but
  // .hero__wordmark-wrap's width (clamp(220px, 22vw, 380px)) sits
  // clamped flat at its 220px minimum for any viewport under 1000px,
  // so ResizeObserver watching just the wrap never fires again anywhere
  // in that whole range even though the word's font-size
  // (clamp(104px, 14.85vw, 192px), a DIFFERENT breakpoint, 700px) is
  // still actively changing size in part of it — confirmed live: a
  // single 900px->700px resize left the asterisk stuck at its stale
  // 900px position, since the wrap's own box genuinely never resized.
  // Observing the anchor covers that (its box does change with
  // font-size), and "resize" covers it unconditionally regardless of
  // which element's box happens to change.
  if (window.ResizeObserver && wrap) {
    const ro = new ResizeObserver(positionHeroAsterisk);
    ro.observe(wrap);
    if (anchor) ro.observe(anchor);
  }
  window.addEventListener("resize", positionHeroAsterisk);
}

// Centers about.html's own text+image hero title group (see .hero__
// wordmark-wrap--about's own long comment in style.css) within the hero
// section. Same root problem as positionHeroAsterisk() above — two
// independent clamp()s (the word's font-size, the wrap's width) only
// stay proportional to each other in a narrow viewport band — so a
// static px correction only stays correct in whatever band it was tuned
// against; a real live measurement is required everywhere else. No-op
// on every other page (none of them carry .hero__wordmark-wrap--about).
//
// Targets the EYEBROWS' own vertical center, not .hero's raw geometric
// center — confirmed live these are NOT the same point: .hero--compact
// reserves padding-top for the fixed nav (calc(var(--nav-height) + 40px))
// before align-content:center centers the grid row in what's left, so
// the row (wrap + eyebrows) actually sits BELOW .hero's own midpoint,
// not on it. An earlier version of this function targeted .hero's own
// center directly and landed the title 55px above where the eyebrows
// (and every other compact hero's title) actually sit — matched hero's
// abstract center, but read as visibly uncentered next to its own
// eyebrows. The eyebrows carry no transform of their own, so they're a
// clean, always-correct stand-in for "where this grid row really is."
//
// text/img's own positions are measured via offsetTop (like
// positionHeroAsterisk() above), NOT getBoundingClientRect() — text's
// inner .hero__title-exit span and img itself both carry the page-load
// reveal's OWN transient slide-in transform (--intro-delay-gated,
// translateY(140px) -> none). getBoundingClientRect() would capture
// WHATEVER that transform happens to be at the exact moment this runs;
// called early (this function's own first call fires well before
// --intro-delay elapses, same reasoning as positionHeroAsterisk()'s own
// early call) that's the PRE-reveal position, not the resting one —
// reported live as exactly that: the title landing correctly centered,
// then visibly teleporting once a LATER call (fonts.ready/
// introfinished, after the reveal has actually finished) recomputed the
// real position. offsetTop is pre-transform layout — immune to that
// transient slide either way — with each element's own PERMANENT design
// nudge (word--2's -3px, the for-wrap's own -48%) added back via
// getTranslateY(), safe to read even mid squash-stretch entrance
// animation since that only ever animates scale, never touches the
// translate component held in --squash-base (see that keyframe's own
// comment). Net effect: correct on every single call, regardless of
// timing, instead of only once the reveal has settled. */
function positionAboutHeroTitle() {
  const wrap = document.querySelector(".hero__wordmark-wrap--about");
  if (!wrap) return;
  const hero = wrap.closest(".hero");
  const eyebrows = hero ? hero.querySelectorAll(".hero__eyebrow") : null;
  const text = wrap.querySelector(".hero__wordmark-word--2");
  const forWrap = wrap.querySelector(".hero__wordmark-for-wrap");
  const img = wrap.querySelector(".hero__wordmark-for");
  if (!hero || !eyebrows || !eyebrows.length || !text || !forWrap || !img) return;

  // Clear any previous correction before measuring — otherwise a second
  // call (resize, fonts.ready) would measure an already-corrected
  // position and compound the offset instead of recomputing it fresh.
  wrap.style.transform = "none";
  const wrapRect = wrap.getBoundingClientRect(); // wrap itself carries no transient transform
  const textTop = offsetRelativeTo(text, wrap).top + getTranslateY(text);
  const textBottom = textTop + text.offsetHeight;
  const imgTop = offsetRelativeTo(img, wrap).top + getTranslateY(forWrap);
  const imgBottom = imgTop + img.offsetHeight;
  const combinedTop = wrapRect.top + Math.min(textTop, imgTop);
  const combinedBottom = wrapRect.top + Math.max(textBottom, imgBottom);
  const combinedCenter = (combinedTop + combinedBottom) / 2;

  const eyebrowCenters = Array.from(eyebrows, (el) => {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2;
  });
  const targetCenter = eyebrowCenters.reduce((a, b) => a + b, 0) / eyebrowCenters.length;
  wrap.style.transform = `translateY(${targetCenter - combinedCenter}px)`;
}

// Called very early (see initHeroAsteriskPosition()'s own call site) —
// deliberately BEFORE text/img's own --intro-delay (~3220-3420ms) has
// elapsed, while both are still sitting at their plain declared (not
// yet animating) transforms, so this first read can safely use
// getBoundingClientRect() directly with no risk of measuring a
// transient mid-transition value. fonts.ready normally resolves well
// before that delay too. The "introfinished" listener is a final
// safety-net re-measure for the rare case fonts.ready itself was slow
// enough to land inside the reveal's own animating window — by the time
// introfinished fires (~6.65s), every reveal transition/animation on
// the page has already finished and is holding its resting state, so
// this last correction is always measuring something stable.
//
// Deferred one animation frame past the event itself — NOT called
// directly as the listener. initHeroEyebrowExit() has its OWN
// "introfinished" listener (registered later, since it's set up behind
// whenIntroAssetsReady() while this one runs unconditionally near the
// top of DOMContentLoaded) that's what actually adds .is-visible to the
// hero asterisk; DOM listeners for the same event fire in registration
// order, so this one would otherwise run FIRST, forcing a reflow (via
// getBoundingClientRect() inside positionAboutHeroTitle()) at the exact
// moment body.intro-finished is set but the asterisk's own is-visible
// isn't yet — the browser then commits that transitional
// "not-visible-yet" state (body.intro-finished
// .hero__wordmark-asterisk-wrap:not(.is-visible), an instant opacity:0/
// translateY(-100px) blip) as a REAL painted frame, instead of it being
// invisibly batched away with the very next mutation like it would be
// otherwise. Reported live as the asterisk visibly vanishing for over a
// second right as the intro sequence finished, then fading back in —
// the exact reflow-hazard class of bug .hero__wordmark-asterisk-wrap's
// own "introfinished" handling was already written carefully to avoid,
// reintroduced here by this listener's own forced reflow racing ahead
// of it. Deferring past a rAF lets every same-tick "introfinished"
// listener (including that one) finish its own class mutations first,
// so this reads the fully-settled result instead of a half-applied one.
function initAboutHeroTitlePosition() {
  const wrap = document.querySelector(".hero__wordmark-wrap--about");
  if (!wrap) return;
  positionAboutHeroTitle();
  document.fonts.ready.then(positionAboutHeroTitle);
  document.addEventListener(
    "introfinished",
    () => requestAnimationFrame(positionAboutHeroTitle),
    { once: true }
  );
  window.addEventListener("resize", positionAboutHeroTitle);
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(positionAboutHeroTitle);
    ro.observe(wrap);
  }
}

// Highlights the nav link for the page currently loaded (each link is a
// real separate page, not a same-page section) with a static underline
// under that link only.
function initNavHighlight() {
  const topLevelLinks = Array.from(document.querySelectorAll(".nav__links > li > a"));
  const dropdownLinks = Array.from(document.querySelectorAll(".nav__dropdown a"));
  const indicator = document.querySelector(".nav__indicator");
  if (!topLevelLinks.length || !indicator) return;

  // Every real page here lives at a directory URL (e.g. "/about/",
  // "/interviews/") backed by that folder's own index.html — matching
  // the nav's own literal href values — except article pages, which are
  // genuine standalone files (articles/<slug>.html). Stripping a
  // trailing "index.html" (and re-adding the trailing slash) makes
  // "/about/" and "/about/index.html" both resolve to the same
  // currentPath as the nav's "/about/" href.
  // This used to compare against location.pathname.split("/").pop(),
  // which is "" for every directory URL (nothing follows the trailing
  // slash) and fell back to the literal string "index.html" — a value
  // that never matches any real href below, so the indicator always
  // fell through to topLevelLinks[0] (Overview) no matter which page
  // was actually loaded.
  let currentPath = location.pathname;
  if (currentPath.endsWith("/index.html")) currentPath = currentPath.slice(0, -"index.html".length);
  else if (currentPath !== "/" && !currentPath.endsWith("/") && !/\.[a-zA-Z0-9]+$/.test(currentPath)) currentPath += "/";

  // Article pages, publications/ itself, and every category page under
  // the dropdown (interviews/, essays/, ...) all count as
  // "Publications*" for the TOP-LEVEL indicator — the dropdown's own
  // matching sub-link (if any) gets its own SEPARATE underline below,
  // in ADDITION to this one, not instead of it (see that block's own
  // comment for why "Volumes" never qualifies here).
  const isArticlePage = location.pathname.includes("/articles/");
  const isPublicationsFamily =
    isArticlePage || currentPath === "/publications/" || dropdownLinks.some((link) => link.getAttribute("href") === currentPath);
  const activeTopLink =
    (isPublicationsFamily && topLevelLinks.find((link) => link.getAttribute("href") === "/publications/")) ||
    topLevelLinks.find((link) => link.getAttribute("href") === currentPath) ||
    topLevelLinks[0];
  activeTopLink.classList.add("is-active");

  // The dropdown's own sub-link matching the CURRENT page (e.g.
  // "Interviews" while on /interviews/) gets its own underline too —
  // see .nav__dropdown a.is-active in style.css. "Volumes" never matches
  // since its own href is an in-page anchor on the homepage
  // ("/#publications"), not a distinct currentPath of its own.
  const activeDropdownLink = dropdownLinks.find((link) => link.getAttribute("href") === currentPath);
  if (activeDropdownLink) activeDropdownLink.classList.add("is-active");

  // getBoundingClientRect() (viewport-relative, then subtracted against
  // the indicator's own container) rather than offsetLeft/offsetWidth —
  // offsetLeft is relative to the nearest POSITIONED ancestor, which
  // silently changes per-link: .nav__item--publications has its own
  // position:relative (needed as .nav__dropdown's containing block, see
  // that HTML comment), making IT the offsetParent for "Publications*"
  // specifically, while every other link's offsetParent stays whatever
  // it was before — so offsetLeft measured 0 (relative to that link's
  // own now-positioned <li>) instead of its true position in the bar,
  // placing the indicator at the wrong spot only when Publications was
  // the active link. getBoundingClientRect() is immune to this: it's
  // real rendered geometry, independent of the offsetParent chain.
  const placeIndicator = () => {
    const containerRect = indicator.parentElement.getBoundingClientRect();
    const linkRect = activeTopLink.getBoundingClientRect();
    // Excludes the trailing .nav__link-asterisk (only "Publications*"
    // has one) from the indicator's own width — per explicit request,
    // the underline should never extend under the asterisk itself.
    const asterisk = activeTopLink.querySelector(".nav__link-asterisk");
    const width = asterisk ? asterisk.getBoundingClientRect().left - linkRect.left : linkRect.width;
    indicator.style.left = `${linkRect.left - containerRect.left}px`;
    indicator.style.width = `${width}px`;
  };

  placeIndicator();
  // Re-measure once the real web font (Newsreader, a local file, not
  // preloaded) is actually in — if it's still showing its fallback at
  // the point this function first runs, the link measures at the
  // FALLBACK font's width, and the indicator gets sized/positioned to
  // match that. Once Newsreader swaps in moments later, the link reflows
  // to its real (usually narrower) width, but nothing re-measures the
  // indicator, leaving it visibly off — intermittently, since whether
  // the swap has already happened by the time this runs depends on
  // font-cache state, same root cause as the earlier cold-load timing
  // bug elsewhere in this file.
  document.fonts.ready.then(placeIndicator);
  window.addEventListener("resize", placeIndicator);
}

// Replaces native scroll with Lenis smoothing — a light per-frame lerp
// that takes the edge off native scroll without the floaty, animate-to-
// target feel that duration/easing-based smoothing gives on continuous
// wheel input. Falls back to native scroll silently if the CDN script
// didn't load.
// Lenis loads with the `async` attribute (see index.html) specifically
// so a slow/blocked request to its CDN can't delay DOMContentLoaded (and
// therefore the whole intro reveal) the way a plain blocking <script>
// would — but that means it can genuinely still be in flight by the
// time this runs. The inline `onload` on that <script> tag dispatches
// "lenisready" once it actually arrives; retry once instead of just
// giving up on smooth-scroll for the rest of the session.
function initLuxuryScroll() {
  if (typeof Lenis === "undefined") {
    window.addEventListener("lenisready", initLuxuryScroll, { once: true });
    return;
  }

  const lenis = new Lenis({
    lerp: 0.18, // higher = snappier/closer to native, lower = smoother/heavier
    smoothWheel: true,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  const anchorLinks = document.querySelectorAll('a[href^="#"]');
  for (const link of anchorLinks) {
    link.addEventListener("click", (e) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: 1, easing: (t) => 1 - (1 - t) ** 3 });
    });
  }
}

// Fades each square / card / block / image-mask into place as it enters
// the viewport (pure opacity, no motion), with a pronounced stagger —
// each subsequent sibling waits noticeably longer, for a slow, dramatic,
// floaty cascade rather than a quick uniform fade-in.
//
// Observation is deferred until the user's first scroll: the intro
// sequence should own the initial load, so main content must never
// fade in just because it happened to already be in the viewport on
// page load — only once the user actually scrolls.
//
// Resets (never "done for good"): scrolling a tile far enough away —
// above OR below the viewport, regardless of whether it's already
// been seen — resets it, so scrolling back re-triggers the fade-in.
//
// Computed directly from getBoundingClientRect() on scroll (rAF-
// throttled) rather than IntersectionObserver — an earlier
// IntersectionObserver-based version occasionally left a tile that
// was clearly on-screen without "is-visible", which direct
// computation avoids entirely by re-deriving the correct state every
// frame instead of relying on the browser's own (batched, not
// necessarily per-frame) intersection notifications. Also makes the
// reset buffer easy to reason about in plain pixels: a tile only
// resets once it's a full viewport-height past whichever edge it
// exited — comfortably lenient, not "reset the instant it's offscreen."
// TEMPORARY per explicit request: scrolling far enough away from an
// already-revealed tile/mask/card and back should NOT re-trigger its
// fade-in — once revealed, stays revealed. Flip back to `true` to
// restore the original re-trigger-on-re-entry behavior. Scoped to just
// this one flag (not a removed farAway branch) so reverting is a
// one-line change. Does NOT touch the hero's own scroll exit/re-entry
// (initHeroEyebrowExit() below) — that's a separate system entirely and
// was never part of this one, which is exactly why the hero keeps
// re-triggering while everything else now doesn't.
const REVEAL_RETRIGGER_ENABLED = false;

// Splits the "Slogan" banner (assets/images/Slogan.jpg, 3600x1837) into
// an evenly-sized tile grid at runtime, generating the mask <div>s
// initRevealOnScroll() below stagger-reveals — same "mask panels fade
// out to unveil the photo underneath" trick as .image-mosaic__mask (see
// that section's own CSS comment), per explicit request that this image
// assemble in tile-by-tile on scroll instead of fading in as one flat
// rectangle. Generated here rather than hand-written in HTML because
// .quote-block is reused verbatim across 6 separate pages (index/about/
// get-involved/templates/{publications,article,category}.html) — one
// shared tile count instead of near-identical divs duplicated 6 times,
// which could quietly drift out of sync across pages if ever changed by
// hand in only some of them.
//
// 4 columns x 2 rows (was 6x3 — per explicit follow-up feedback that 18
// tiles read as too small/fussy; 8 bigger tiles reads more like a
// deliberate mosaic): Slogan.jpg's own aspect ratio (3600/1837 ~= 1.96)
// is closest to a whole-number grid at 4:2 (=2.0, ~2% off — invisible in
// practice) without visibly distorting into non-square tiles — the exact
// same column:row = width:height convention .featured-carousel's own
// 4x2 grid already uses for its own 4:2(=2.0)-ratio container.
const QUOTE_BLOCK_TILE_COLS = 4;
const QUOTE_BLOCK_TILE_ROWS = 2;
// Builds one COLS x ROWS grid layer (either the reveal masks or the
// hover-glow tiles — same dimensions, different child class) and appends
// it to `image`. Shared so the two grids can never drift out of sync
// with each other or with QUOTE_BLOCK_TILE_COLS/ROWS.
function buildQuoteBlockTileGrid(image, wrapperClass, tileClass) {
  const wrapper = document.createElement("div");
  wrapper.className = wrapperClass;
  wrapper.style.gridTemplateColumns = `repeat(${QUOTE_BLOCK_TILE_COLS}, 1fr)`;
  wrapper.style.gridTemplateRows = `repeat(${QUOTE_BLOCK_TILE_ROWS}, 1fr)`;
  for (let i = 0; i < QUOTE_BLOCK_TILE_COLS * QUOTE_BLOCK_TILE_ROWS; i++) {
    const tile = document.createElement("div");
    tile.className = tileClass;
    tile.setAttribute("aria-hidden", "true");
    wrapper.appendChild(tile);
  }
  image.appendChild(wrapper);
}
function initQuoteBlockTiles() {
  const images = document.querySelectorAll(".quote-block__image");
  for (const image of images) {
    // Idempotent — harmless if this ever runs twice for the same image.
    if (image.querySelector(".quote-block__masks")) continue;
    buildQuoteBlockTileGrid(image, "quote-block__masks", "quote-block__mask");
    // Per-cell hover glow (per explicit request, once the photo was
    // split into tiles) — same .image-mosaic__hover-tile pattern, a
    // separate grid layer above the masks rather than a hover rule ON
    // the masks themselves, since a mask's opacity is already spoken
    // for by the scroll-reveal (fades to 0 permanently once revealed —
    // see .quote-block__mask.is-visible) and can't also carry a hover
    // background without the two fighting over the same property.
    buildQuoteBlockTileGrid(image, "quote-block__hover-tiles", "quote-block__hover-tile");
  }
}

function initRevealOnScroll() {
  // .split-cta__illustration-tile (not .split-cta itself — see the CSS
  // comment above this same selector list) is what gives section 3's
  // illustration box its tile-by-tile cascade: 4 tiles sharing one
  // parent, same stagger math as any other square-grid.
  const staggeredTargets = document.querySelectorAll(
    ".square, .split-cta__illustration-tile, .image-mosaic__mask, .featured-carousel__mask, .quote-block__mask, .publication-card, .marquee-banner--scrolling, .beyond-page__img, .slogan-preview .split-cta__text-line, .team-bio, #about-intro .square--cream .split-cta__text-line"
  );
  // .partners used to be tracked separately here (a single-unit reveal
  // that must never get a --reveal-delay) — now that it shares
  // .marquee-banner--scrolling's own reveal with #get-involved/
  // #publications (per explicit request), it's picked up by the query
  // above like any other instance of that class; no separate tracking
  // needed.
  // .featured-carousel__mask is EXCLUDED from checkAll()'s own viewport
  // check below (though it stays in staggeredTargets so the stagger loop
  // right below still gives it a normal --reveal-delay among its own 8
  // siblings) — see initSection4CarouselGate() further down, which is
  // what actually adds is-visible to these now. Section 4's carousel
  // sits directly beneath that section's own square-grid with no gap, so
  // on most viewport heights BOTH are "in view" per this function's own
  // generous 10%-90% window at the same scroll position — confirmed
  // live: the carousel's tiles (0-600ms stagger among themselves) could
  // start fading in while the GRID's own later tiles (also 0-600ms, but
  // a SEPARATE, unrelated stagger) were still mid-cascade, reading as
  // "the carousel appeared before the row above it finished" even though
  // it's visually below. Gating the carousel on the grid's own LAST tile
  // actually finishing (a real transitionend chain, not two independent
  // viewport checks racing) is what the DOM order visually implies should
  // happen regardless of how fast/slow the user scrolls past both.
  const viewportTargets = Array.from(staggeredTargets).filter(
    (el) => !el.classList.contains("featured-carousel__mask")
  );
  const targets = viewportTargets;
  if (!targets.length) return;

  // Stagger is normalized to a shared TOTAL cascade span per group
  // (600ms end-to-end, divided across that group's own sibling count)
  // rather than a flat per-item ms — a flat value doesn't generalize:
  // section 1's squares span 4 GRID ROWS, so most of their "tile by
  // tile" cascade already comes from tiles at different rows entering
  // the viewport at genuinely different scroll moments, seconds apart;
  // the footer (3 cells) is a single ROW, so all siblings enter the
  // viewport in the exact same instant — the artificial per-item delay
  // is the ONLY thing that can stagger them at all. A flat 40-100ms/step
  // gave section 1's 10+ siblings a full second of spread while giving
  // a 3-item row almost none — reported as the footer "acting like one
  // long rectangle" instead of tiles. Normalizing to a fixed total span
  // means every group gets a comparably obvious cascade regardless of
  // how many siblings it has.
  const CASCADE_SPAN_MS = 600;
  for (const el of staggeredTargets) {
    const siblings = Array.from(el.parentElement.children);
    const index = siblings.indexOf(el);
    const step = siblings.length > 1 ? CASCADE_SPAN_MS / (siblings.length - 1) : 0;
    el.style.setProperty("--reveal-delay", `${Math.round(index * step)}ms`);
  }

  // Override: .site-footer__center sits in the footer's DOM order
  // alongside the 4 real squares (checker, dark, dark, checker), so the
  // generic per-parent stagger above treats it as just one more sibling
  // in that same 0..600ms spread. Start it at the SAME delay as the 3rd
  // square (index 2) — the content should already be under way by the
  // time that square begins, not wait for the whole sequence to finish.
  const footerCenter = document.querySelector(".site-footer__center");
  if (footerCenter) {
    const footerSquares = document.querySelectorAll(".site-footer .square:not(.site-footer__center)");
    const thirdSquare = footerSquares[2];
    const thirdSquareDelay = thirdSquare ? parseFloat(thirdSquare.style.getPropertyValue("--reveal-delay")) || 0 : 0;
    footerCenter.style.setProperty("--reveal-delay", `${thirdSquareDelay}ms`);
  }

  // Override: .marquee-banner--scrolling (the sponsor/partner marquee on
  // every page, plus #get-involved/#publications on index.html) is
  // always a single, standalone full-width section — not one of several
  // visually-simultaneous siblings the generic per-parent stagger above
  // is meant for. That loop still indexes it by its position among
  // <main>'s own top-level section children (an accident of how many
  // sections happen to precede it, unrelated to any real stagger group).
  // On about.html this handed .partners a 600ms delay (3rd of <main>'s
  // 3 children) — long enough that the footer's OWN tiles just below it
  // (mostly <525ms, entering the viewport at nearly the same scroll
  // position) finished fading in before the marquee's delay had even
  // elapsed, reading as "the footer animates in before the sponsor
  // marquee" despite the marquee sitting earlier in the DOM. Forcing 0ms
  // removes that accidental lag; the marquee still fades in as its own
  // flat unit (see the CSS comment above .marquee-banner--scrolling), it
  // just does so the instant ITS OWN rect crosses the reveal threshold
  // instead of waiting on an unrelated number.
  for (const marquee of document.querySelectorAll(".marquee-banner--scrolling")) {
    marquee.style.setProperty("--reveal-delay", "0ms");
  }

  // Section 3's illustration tiles are 2 rows (row 1: the full-height
  // pair, DOM index 0-1; row 2: the half-height pair below, index 2-3 —
  // see the HTML comment above .split-cta__illustration-tiles), not 4
  // independently-staggered siblings — the generic per-parent loop above
  // still gives them 0/200/400/600ms (indexed by DOM order among all 4),
  // which reads as an ODD, uneven stagger once both rows reveal at the
  // same triggered moment (see the piggyback below): row 1's own two
  // tiles arrive 200ms apart from EACH OTHER, then row 2's own two tiles
  // ALSO arrive 200ms apart from each other, rather than each row
  // reading as one clean beat. Override: both tiles in a row share ONE
  // delay — row 1 together, row 2 together 300ms later.
  const splitCtaTiles = document.querySelectorAll(".split-cta__illustration-tile");
  if (splitCtaTiles.length === 4) {
    splitCtaTiles[0].style.setProperty("--reveal-delay", "0ms");
    splitCtaTiles[1].style.setProperty("--reveal-delay", "0ms");
    splitCtaTiles[2].style.setProperty("--reveal-delay", "300ms");
    splitCtaTiles[3].style.setProperty("--reveal-delay", "300ms");
  }

  // About page "Beyond the Page" photo stack — same override pattern as
  // splitCtaTiles above (explicit values beat the generic per-parent
  // index math), needed here because that generic math also counts the
  // beige circle as a sibling and would space these two photos out more
  // than wanted. A short, explicit gap instead, per explicit request
  // that img--2 should follow img--1 "sooner." opacity/translate/rotate
  // all share this SAME --reveal-delay (see the CSS) — per a later
  // explicit request that rotate not wait for translate to finish first,
  // there's no separate flat delay for rotate anymore, so this 120ms gap
  // now staggers the rotate too, not just the slide/fade.
  //
  // BEYOND_PAGE_ENTRANCE_DELAY_MS (base offset added to both, defined
  // near initBeyondPageTextReveal() below) is separate from the 120ms
  // stagger between the two — checkAll() above still flips is-visible
  // on these at the SAME early scroll position as every other tracked
  // element (that threshold is shared sitewide, not worth forking just
  // for this section); this offset instead delays when the CSS
  // transition actually STARTS reacting to that class, per explicit
  // request that the motion itself started before the section was
  // scrolled far enough into view to actually watch it happen.
  const beyondPageImg1 = document.querySelector(".beyond-page__img--1");
  const beyondPageImg2 = document.querySelector(".beyond-page__img--2");
  if (beyondPageImg1 && beyondPageImg2) {
    beyondPageImg1.style.setProperty("--reveal-delay", `${BEYOND_PAGE_ENTRANCE_DELAY_MS}ms`);
    beyondPageImg2.style.setProperty("--reveal-delay", `${BEYOND_PAGE_ENTRANCE_DELAY_MS + 120}ms`);
  }

  // Per explicit request, row 2 should just naturally follow row 1 once
  // triggered, not need its OWN extra scroll to bring its (physically
  // lower, so later-entering-the-viewport) rect into view — checkAll()
  // below has row 2 piggyback on row 1's own scroll state instead of
  // checking its own rect. The --reveal-delay override above is what
  // actually spaces the two rows apart visually once they share the
  // same is-visible moment.
  const splitCtaRow1 = splitCtaTiles[0];
  const splitCtaRow2 = new Set([splitCtaTiles[2], splitCtaTiles[3]].filter(Boolean));

  let ticking = false;
  const checkAll = () => {
    const vh = window.innerHeight;
    const splitCtaRow1Rect = splitCtaRow1 ? splitCtaRow1.getBoundingClientRect() : null;
    for (const el of targets) {
      const rect = splitCtaRow1Rect && splitCtaRow2.has(el) ? splitCtaRow1Rect : el.getBoundingClientRect();
      // Was `rect.top < vh * 0.9 && rect.bottom > vh * 0.1` — the lower
      // bound excluded anything that had ALREADY scrolled fully past the
      // top of the viewport, not just anything not yet reached. checkAll()
      // only runs on real "scroll" events (not a continuous per-frame
      // loop), so a single fast scroll (a trackpad flick, Lenis's own
      // inertia, a scrollbar-track jump, etc.) can carry an element clean
      // through this "currently entering" window between two sampled
      // positions — it never gets marked, and since
      // REVEAL_RETRIGGER_ENABLED is false there's nothing to retry it
      // later. Confirmed live: a fast scroll into section 4 left the
      // square-grid's first row (already scrolled past, rect.bottom well
      // above 0) stuck at opacity:0 forever — which permanently broke
      // initSection4CarouselGate() below, since that gate waits on EVERY
      // grid tile's own transitionend before ever revealing the carousel,
      // and a tile that never became is-visible never fires one. Dropping
      // the lower bound means "has scrolled at least this far" is enough,
      // in either direction — an element already passed gets marked
      // visible the next time checkAll() runs (even from that same fast
      // scroll's own trailing "scroll" event), instead of staying invisible
      // until the user happens to scroll back up over it again.
      const inView = rect.top < vh * 0.9;
      const farAway = rect.bottom < -vh * 1.5 || rect.top > vh * 2.5;
      // Guarded with contains() now — calling classList.add()/remove()
      // for a token that's already (not) present still fires a genuine
      // MutationObserver "attributes" mutation, even though the
      // resulting class string is unchanged (a real, surprising browser
      // behavior, not a spec violation on our part). This ran
      // UNCONDITIONALLY on every scroll frame for every tracked target,
      // so anything watching one of these elements' class via
      // MutationObserver (see initSplitCtaReveal()) was getting fired
      // dozens of times per second for the ENTIRE duration of active
      // scrolling, not once when visibility genuinely changed —
      // confirmed via direct instrumentation: a single continuous
      // scroll produced ~80 redundant callbacks in 1.4s, each one
      // cancelling and rescheduling initSplitCtaReveal()'s pending
      // reveal, so it could only ever fire once scrolling had been
      // fully still for a longer stretch than its own delay — read as
      // "waits for the whole section to finish, then a big pause."
      if (inView) {
        if (!el.classList.contains("is-visible")) el.classList.add("is-visible");
      } else if (farAway && REVEAL_RETRIGGER_ENABLED) {
        if (el.classList.contains("is-visible")) el.classList.remove("is-visible");
      }
    }
    ticking = false;
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(checkAll);
  };
  // The "wait for the user's first scroll" deferral above this function
  // exists so the homepage's own elaborate intro sequence isn't
  // competing with square-grid content fading in simultaneously just
  // because it happened to already be in the viewport — but that
  // reasoning is specific to pages that HAVE such an intro (only
  // index.html ever does). On any other page (publications.html,
  // about.html, get-involved.html, category/article pages), there's no
  // load-owning sequence to protect, so content already in view on
  // arrival (e.g. publications.html's Volumes cards, now visible without
  // scrolling since the hero got shorter) should just reveal immediately
  // instead of sitting there inert until the user scrolls at all.
  if (HAS_ELABORATE_SPLASH) {
    window.addEventListener(
      "scroll",
      () => {
        checkAll();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll, { passive: true });
      },
      { once: true, passive: true }
    );
  } else {
    // Still shouldn't beat THIS page's own hero to the punch, if it has
    // one (publications.html/about.html/get-involved.html all do) —
    // reading the (already-corrected — initIntroReveal() runs before
    // this, in the same DOMContentLoaded handler) --intro-delay values
    // directly means this stays in sync automatically if that timing
    // ever changes again, rather than needing a second hardcoded number
    // kept in step with it by hand. 0 (checkAll() runs immediately) on
    // any page with no .intro-reveal elements at all (category/article
    // pages) — nothing there to wait for either.
    const introEls = document.querySelectorAll(".intro-reveal");
    let maxHeroDelay = 0;
    for (const el of introEls) {
      const delay = parseFloat(el.style.getPropertyValue("--intro-delay")) || 0;
      if (delay > maxHeroDelay) maxHeroDelay = delay;
    }
    const HERO_REVEAL_DURATION_MS = 800; // matches .intro-reveal--slide-slow's own duration
    setTimeout(checkAll, introEls.length ? maxHeroDelay + HERO_REVEAL_DURATION_MS : 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  }
}

// The hero eyebrow lines, the "Word for Word" title pieces, AND the hero
// asterisk all key off the SAME shared trigger — the HERO SECTION's own
// bounding rect, 5% of its height scrolled out of view — rather than each
// element's individual position, so everything crosses the threshold at
// exactly the same scroll amount and exits/returns as one unit. What
// makes the eyebrow lines specifically read as "line by line" instead of
// one paragraph-block moving at once is purely CSS: the 2nd line in each
// eyebrow block carries a small extra transition-delay (see the
// nth-child rule under body.intro-finished .hero__eyebrow-line in the
// CSS), so line 1 is visibly already moving before line 2 starts — the
// title/asterisk have no such stagger (see .hero__title-exit and
// .hero__wordmark-asterisk-wrap in the CSS). Scrolling back up past that
// same 5% point brings everything back, same stagger in reverse. See
// body.intro-finished .hero__eyebrow-line / .hero__title-exit /
// .hero__wordmark-asterisk-wrap in the CSS for why this only takes
// effect once the page-load intro has genuinely finished.
//
// The eyebrow lines and title pieces are toggled EAGERLY (check() runs
// immediately, not deferred to the user's first scroll like
// initRevealOnScroll()'s targets) — safe for them because their entrance
// is a CSS *transition* (opacity/transform + transition-delay), which
// respects its own delay regardless of when "is-visible" gets toggled.
//
// The hero asterisk is toggled SEPARATELY, and ONLY once
// body.intro-finished is actually set — not before. Its entrance is a
// CSS *animation* (hero-asterisk-intro), and animations only take effect
// once their own delay elapses; before that, the element's appearance
// falls back to plain (non-animation) rules. Toggling "is-visible" on it
// early would make the page's generic, unscoped ".is-visible { opacity:
// 1 }" rule win that fallback (equal specificity, later in the
// cascade) — showing the asterisk fully in-place from frame one instead
// of hidden and waiting to pop in, which is exactly the "starts out
// already in place instead of sliding up and fading in" regression an
// earlier, eager-for-everything version of this function caused. Not
// toggling it AT ALL, on the other hand, reproduces the ORIGINAL bug
// ("asterisk disappears after it spins in") — body.intro-finished
// .hero__wordmark-asterisk-wrap:not(.is-visible) would match an element
// that had simply never been checked.
//
// The FIRST asterisk sync doesn't call check() itself — it applies the
// visibility value initIntroReveal() already computed and passed on the
// "introfinished" event's detail, rather than re-deriving it here via
// another getBoundingClientRect() call. Doing that read here (after
// body.intro-finished is already set) would reintroduce a forced-
// reflow hazard: the browser would "see" and record a genuine —
// finished, but not-yet-visible — in-between state as the transition's
// real starting point, which is exactly what caused the asterisk to
// visibly snap invisible and re-fade-in right at the intro/scroll-exit
// handoff even though the end state never numerically changed.
function initHeroEyebrowExit() {
  const hero = document.querySelector(".hero");
  const alwaysEls = document.querySelectorAll(".hero__eyebrow-line, .hero__title-exit");
  const asterisk = document.querySelector(".hero__wordmark-asterisk-wrap");
  if (!hero || (!alwaysEls.length && !asterisk)) return;

  // Gates the respin-on-reset flourish below, not just the resting
  // opacity/transform: prefers-reduced-motion already forces
  // .hero__wordmark-asterisk-wrap's animation to none in CSS (see
  // style.css), but .is-respinning's selector is MORE specific than
  // that override (3 classes vs. 1), so it would still win and
  // re-enable the spin if left to CSS alone. Simplest fix is to never
  // add the class in the first place, same as every other
  // motion-gated feature on this page.
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let ticking = false;
  // Was asterisk-only; now also gates alwaysEls (eyebrow-line/title-exit)
  // below — see that guard's own comment for why. Renamed to make clear
  // it's a whole-system handoff flag, not an asterisk-specific one.
  let scrollLinkedReady = false;
  // Tracks the asterisk's PREVIOUS visibility so the respin below only
  // fires on an actual hidden->visible transition (scrolling back up
  // into the hero after having scrolled away) — not on every scroll
  // tick while it's already sitting visible. Seeded properly once
  // scrollLinkedReady flips true (see the "introfinished" listener
  // below), not here — before that point the asterisk isn't being
  // toggled at all yet, so there's no real "previous" state to track.
  let asteriskWasVisible = false;

  // Tracks whether the hero was ever scrolled out of view BEFORE the
  // intro sequence's own ~6.65s timeline finishes — a real scenario,
  // not just a dev-testing one: plenty of people scroll well before a
  // page-load animation is done. Without this, a user who scrolls down
  // and back up to the hero DURING that window sees the asterisk just
  // silently sitting there fully visible once intro-finished fires —
  // the "introfinished" handler below deliberately SNAPS straight to
  // the computed visibility with no transition/respin at all (see its
  // own comment: reading layout mid-flight there caused a worse bug,
  // a visible invisible-then-refade flash). That shortcut is correct
  // for the common case (never left the hero at all), but wrong for
  // "scrolled away and came back before intro finished" — which is
  // exactly a hidden->visible transition and deserves the same
  // reveal+respin every OTHER re-entry gets. This flag is what lets the
  // handler tell those two cases apart.
  let scrolledAwayBeforeReady = false;
  const preReadyScrollCheck = () => {
    if (scrollLinkedReady) {
      window.removeEventListener("scroll", preReadyScrollCheck);
      return;
    }
    const rect = hero.getBoundingClientRect();
    if (Math.max(0, -rect.top) / rect.height >= HERO_EXIT_THRESHOLD) scrolledAwayBeforeReady = true;
  };
  const check = () => {
    const rect = hero.getBoundingClientRect();
    const outFraction = Math.max(0, -rect.top) / rect.height;
    const visible = outFraction < HERO_EXIT_THRESHOLD;
    // Gated on scrollLinkedReady for the same reason the asterisk already
    // was: body.intro-finished is what scopes the CSS that makes exit
    // always instant (transition-duration:0s — see style.css), so a fast
    // scroll down-then-up BEFORE intro-finished has no such protection —
    // is-visible gets removed then re-added within the SAME real 0.8s
    // transition window, with no paint in between to commit the
    // "removed" state. The browser then has nothing to transition FROM,
    // so it doesn't restart the animation at all: the element just
    // freezes at whatever opacity/transform it happened to be mid-flight
    // through the ORIGINAL page-load reveal. Reported live: the very
    // FIRST scroll-down-then-up (which, on a fresh reload, reliably
    // lands inside this pre-intro-finished window) silently slides but
    // never fades; every later cycle — always well after intro-finished
    // — works fine. Leaving alwaysEls untouched until scrollLinkedReady
    // mirrors what the asterisk already does correctly: the page-load
    // reveal (driven purely by each element's own --intro-delay) plays
    // out undisturbed, and the scroll-linked system only starts touching
    // these classes once the CSS protection for it actually exists.
    if (scrollLinkedReady) {
      for (const el of alwaysEls) el.classList.toggle("is-visible", visible);
    }
    if (asterisk && scrollLinkedReady) {
      asterisk.classList.toggle("is-visible", visible);
      if (visible && !asteriskWasVisible && !reduceMotion) {
        asterisk.classList.remove("is-respinning");
        void asterisk.offsetWidth;
        asterisk.classList.add("is-respinning");
      } else if (!visible) {
        // .is-respinning's own rule (body.intro-finished
        // .hero__wordmark-asterisk-wrap.is-respinning) is equal-but-later
        // specificity than the :not(.is-visible) hide rule below it in
        // style.css, so leaving it on through a hidden phase makes it WIN
        // the cascade — its animation's forwards-filled opacity:1 then
        // permanently overrides the hide rule's opacity:0. Confirmed
        // live: after the very first respin ever plays, scrolling away
        // again left the asterisk stuck fully visible, forever, since
        // nothing ever removed this class on exit. It's a one-shot
        // flourish anyway — nothing needs it to survive past this point.
        asterisk.classList.remove("is-respinning");
      }
      asteriskWasVisible = visible;
    }
    ticking = false;
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(check);
  };

  check();
  window.addEventListener("scroll", preReadyScrollCheck, { passive: true });
  document.addEventListener(
    "introfinished",
    (e) => {
      const visible = e.detail.asteriskVisible;
      // Seed alwaysEls to the ACTUAL current visibility the instant the
      // system comes online — same precomputed value (read before any
      // class changes, back in initIntroReveal()) the asterisk already
      // relies on, for the same reflow-hazard reason: computing it fresh
      // here, after intro-finished but before this toggle, would let the
      // browser commit a real in-between state as a transition's start
      // point. Unlike the asterisk, alwaysEls needs no respin-style
      // flourish — a plain toggle is enough, it's a transition, not an
      // animation that can go stale.
      for (const el of alwaysEls) el.classList.toggle("is-visible", visible);
      scrollLinkedReady = true;
      if (asterisk) {
        if (scrolledAwayBeforeReady && visible && !reduceMotion) {
          // Genuinely a hidden->visible transition (scrolled away and
          // back before intro finished) — give it the same reveal+respin
          // treatment as every other re-entry, instead of silently
          // snapping straight to visible.
          asterisk.classList.remove("is-respinning");
          asterisk.classList.add("is-visible");
          void asterisk.offsetWidth;
          asterisk.classList.add("is-respinning");
        } else {
          asterisk.classList.toggle("is-visible", visible);
        }
      }
      asteriskWasVisible = visible;
    },
    { once: true }
  );
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
}

// Gates section 4's carousel masks on that SAME section's own square-
// grid tiles genuinely finishing first — see the comment on
// viewportTargets inside initRevealOnScroll() for why this exists (the
// carousel sits directly below the grid with no gap, so both can be
// "in view" per that function's own check at the same scroll position,
// letting the carousel's independent stagger start before the grid's
// own later tiles had finished theirs).
//
// Deterministic (MutationObserver), NOT transitionend — an earlier
// version counted each tile's own "transitionend" and waited for all 8.
// Reported live as "carousel doesn't appear" on a slow machine: under
// real main-thread congestion, a style change and its own computed-
// style read can land in the same recalc with no paint in between, so
// the opacity transition never actually STARTS — and a transition that
// never starts never fires transitionend. REVEAL_RETRIGGER_ENABLED is
// false, so nothing ever retries that tile, and this gate's doneCount
// could get stuck below gridTiles.length forever, permanently hiding
// the carousel. MutationObserver instead watches the class attribute
// directly — that mutation is real and synchronous the instant
// checkAll() calls classList.add("is-visible"), regardless of whether a
// transition/paint ever follows it.
//
// checkAll() (in initRevealOnScroll()) adds is-visible to every
// qualifying tile in ONE synchronous pass per scroll event — once the
// user has scrolled far enough for the whole grid to be "in view" at
// once, all 8 tiles get is-visible in that same instant, regardless of
// each one's own --reveal-delay. is-visible landing on a tile does NOT
// mean it has started fading in yet — that's gated by transition-delay:
// var(--reveal-delay), which can be up to 600ms later. A PREVIOUS
// version of this gate waited for is-visible alone (no further buffer)
// and revealed the carousel the instant all 8 tiles had it — which, per
// the above, can be near-instantly, well before row 2's tiles (the
// larger --reveal-delay values) have even started fading in. Reported
// live as "carousel appears too early — even before the second row of
// its own section."
//
// A version before THAT waited for is-visible PLUS the slowest tile's
// own --reveal-delay PLUS its full 700ms transition duration — reported
// live as the opposite, "abnormally late."
//
// This gate's actual job is narrower than either of those: only stop
// the carousel's own fade from STARTING before the grid's slowest tile
// has ALSO started (so it never visibly precedes any grid tile), without
// also waiting for that tile's fade to fully finish first. Waiting for
// is-visible PLUS the slowest —reveal-delay (not also its 700ms
// transition) is exactly that — the carousel starts fading in at the
// same moment the grid's last tile does, reading as one continuous
// cascade instead of arriving early or arriving after a pause.
function initSection4CarouselGate() {
  const gridTiles = document.querySelectorAll(".square-grid--flush-bottom .square");
  const carouselMasks = document.querySelectorAll(".featured-carousel__mask");
  if (!gridTiles.length || !carouselMasks.length) return;

  const pending = new Set(gridTiles);
  let maxDelay = 0;

  for (const tile of gridTiles) {
    const mo = new MutationObserver(() => {
      if (!tile.classList.contains("is-visible")) return;
      mo.disconnect();
      pending.delete(tile);
      maxDelay = Math.max(maxDelay, parseFloat(tile.style.getPropertyValue("--reveal-delay")) || 0);
      if (pending.size > 0) return;
      setTimeout(() => {
        for (const mask of carouselMasks) mask.classList.add("is-visible");
      }, maxDelay);
    });
    mo.observe(tile, { attributes: true, attributeFilter: ["class"] });
  }
}

// Reveals `targets` in sync with `tile` itself starting to fade in —
// per explicit request that overlay content (captions, scrims) should
// feel like part of its tile's own reveal, not a separate step arriving
// after the tile (or a whole group of tiles) finishes. Deliberately NOT
// "transitionstart", despite that reading as the obvious event to use:
// initSplitCtaReveal() already hit this exact wall (see its own comment)
// — transitionstart/transitionrun has a long history of unreliable
// support (Safari in particular), so an earlier version of THIS reveal
// system very likely never fired its intended early trigger at all.
// Same fix here: read the tile's own --reveal-delay (set deterministically
// by initRevealOnScroll()'s stagger math) the moment checkAll() adds
// is-visible to it, then schedule `targets` on that exact same delay —
// deterministic on every browser, no event-support gamble.
function revealWithTile(tile, targets) {
  if (!tile || !targets.length) return;
  const mo = new MutationObserver(() => {
    if (!tile.classList.contains("is-visible")) return;
    mo.disconnect();
    const delay = parseFloat(tile.style.getPropertyValue("--reveal-delay")) || 0;
    setTimeout(() => {
      // Double rAF (same idiom as initIntroReveal()/initSplitCtaReveal(),
      // same reason) — guarantees targets' opacity:0 starting state has
      // genuinely painted at least once before flipping to is-visible, so
      // a 0ms (or coalesced-into-the-same-frame) delay can't skip the
      // transition outright.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          for (const el of targets) el.classList.add("is-visible");
        });
      });
    }, delay);
  });
  mo.observe(tile, { attributes: true, attributeFilter: ["class"] });
}

// Masks are a 2-col x 3-row grid in DOM/source order, so index 4/5 are
// the bottom row — the exact 2 tiles the scrim and both captions (all
// bottom-anchored, see their own CSS) visually sit over. Pairing each
// piece of overlay content with that specific tile (rather than the
// mosaic's own "all 6 masks, then scrim, then captions" chain this
// replaced) is what makes the shadow/caption feel like it arrives WITH
// its tile instead of as an afterthought once the whole grid is done.
function initMosaicReveal() {
  const mosaics = document.querySelectorAll(".image-mosaic");
  if (!mosaics.length) return;

  for (const mosaic of mosaics) {
    const masks = mosaic.querySelectorAll(".image-mosaic__mask");
    const scrim = mosaic.querySelector(".image-mosaic__scrim");
    const captionLeft = mosaic.querySelector(".image-mosaic__caption--left");
    const captionRight = mosaic.querySelector(".image-mosaic__caption--right");
    if (masks.length < 6 || !scrim) continue;

    const [bottomLeft, bottomRight] = [masks[4], masks[5]];
    revealWithTile(bottomLeft, [scrim, captionLeft].filter(Boolean));
    revealWithTile(bottomRight, [captionRight].filter(Boolean));
  }
}

// Chains .quote-block__overlay's own reveal off the LAST tile (bottom-
// right — the one whose cascade delay/viewport entry finishes last) —
// same revealWithTile() helper initMosaicReveal() above uses, so the
// text card only starts fading in once the photo has genuinely finished
// assembling, not a fixed guessed delay layered on top of a whole-image
// fade (that's no longer a thing here — see the CSS comment on
// .quote-block). No-op on the 5 pages that reuse .quote-block without
// an overlay (about/get-involved/publications/article/category) — the
// querySelector for it just returns null there.
function initQuoteBlockReveal() {
  const blocks = document.querySelectorAll(".quote-block");
  for (const block of blocks) {
    const masks = block.querySelectorAll(".quote-block__mask");
    const overlay = block.querySelector(".quote-block__overlay");
    if (!masks.length || !overlay) continue;
    revealWithTile(masks[masks.length - 1], [overlay]);
  }
}

// Similar chain to initMosaicReveal() (masks finish -> scrim ->
// captions), applied to section 3, but the first handoff fires EARLY
// rather than waiting for the whole group to finish: the artwork starts
// sliding up + fading in the moment the 3rd tile BEGINS its own fade
// (not once all 4 tiles are done) — "transitionstart" is what catches
// that moment, since it only fires once the tile's own --reveal-delay
// has elapsed and its opacity transition actually starts running, vs.
// "transitionend" which would wait for it to finish. Once the artwork's
// OWN transition finishes, that triggers the 4 text lines to cascade in
// — this second handoff still waits for a finish, not a start, since
// there's nothing after it in the chain to get a head start on. Only the
// tiles are scroll-tracked (see initRevealOnScroll()'s targets); the
// artwork and text lines exist purely to be chained to.
// Deterministic timing, NOT transition events: an earlier version
// triggered the illustration off the trigger tile's own "transitionstart"
// and the text lines off the illustration's "transitionend." That read
// as "everything comes in too late" in practice — transitionstart in
// particular has spotty real-world support (long history of Safari only
// reliably firing transitionend, not transitionrun/transitionstart), so
// the illustration was very likely never getting its intended early
// trigger at all and was instead always falling through to a 1.5s-late
// safety-net timer, with text lagging even further behind that as a
// result. Reading the tile's own --reveal-delay (set deterministically
// by initRevealOnScroll()'s stagger math) and scheduling off plain
// setTimeout instead removes the dependency on any transition event
// firing at all — the illustration now starts EXACTLY when tile 3's own
// fade begins, and the text lines EXACTLY 450ms later (matching
// .split-cta__illustration's own opacity/transform transition duration),
// on every browser, every time.
const SPLIT_CTA_ILLUSTRATION_TRANSITION_MS = 450;
// Big asterisk pops in first, small one chases it — same succession the
// user asked for, using the hero wordmark's own pop-in keyframes
// (hero-asterisk-intro) rather than a new animation.
const SPLIT_CTA_ASTERISK_STAGGER_MS = 180;
function initSplitCtaReveal() {
  const section = document.querySelector(".split-cta");
  if (!section) return;

  const tiles = section.querySelectorAll(".split-cta__illustration-tile");
  const illustration = section.querySelector(".split-cta__illustration");
  const textLines = section.querySelectorAll(".split-cta__text-line");
  const asteriskLarge = section.querySelector(".split-cta__illustration-asterisk-wrap--large");
  const asteriskSmall = section.querySelector(".split-cta__illustration-asterisk-wrap--small");
  if (!tiles.length || !illustration) return;

  const revealIllustration = () => illustration.classList.add("is-visible");
  const revealTextLines = () => {
    for (const line of textLines) line.classList.add("is-visible");
  };
  let asteriskTimer = null;
  const revealAsterisks = () => {
    if (asteriskLarge) asteriskLarge.classList.add("is-visible");
    asteriskTimer = setTimeout(() => {
      if (asteriskSmall) asteriskSmall.classList.add("is-visible");
    }, SPLIT_CTA_ASTERISK_STAGGER_MS);
  };
  const hideAll = () => {
    illustration.classList.remove("is-visible");
    for (const line of textLines) line.classList.remove("is-visible");
    if (asteriskLarge) asteriskLarge.classList.remove("is-visible");
    if (asteriskSmall) asteriskSmall.classList.remove("is-visible");
  };

  // Settled back on tile 3 (index 2) after trying tiles 1/2 — with a
  // real, gradual scroll (not an instant jump), the 4 tiles don't
  // actually reveal in one synced batch the way a synthetic test
  // suggested; each crosses its own reveal threshold at a different
  // moment as the page scrolls. Explicitly wanted: the illustration
  // should start at the same moment tile 3 itself starts (not once the
  // whole grid has already finished), with the text lines still coming
  // last in the chain.
  const triggerTile = tiles[2] || tiles[tiles.length - 1];
  let showTimer = null;
  let textTimer = null;

  // Kept bidirectional (not a one-shot MutationObserver that disconnects
  // after its first fire, as an earlier version did) — the tile itself
  // is scroll-reset by initRevealOnScroll() like every other tile
  // (scrolling far enough away removes its own is-visible so scrolling
  // back re-triggers it), but this function used to only ever listen
  // for the FIRST time that happened, so the illustration/text stayed
  // visible forever afterward regardless of scroll position. Now this
  // mirrors the tile's own state every time it changes, either
  // direction, matching how every other reveal on this page resets.
  // Tracks the last state this function actually acted on — defense in
  // depth alongside the checkAll() fix (see initRevealOnScroll()): even
  // with that fix, this guards against ever re-scheduling/re-hiding for
  // a mutation that didn't represent a genuine visibility change, rather
  // than trusting every MutationObserver callback to mean exactly that.
  let lastKnownVisible = null;
  const sync = () => {
    const nowVisible = triggerTile.classList.contains("is-visible");
    if (nowVisible === lastKnownVisible) return;
    lastKnownVisible = nowVisible;

    clearTimeout(showTimer);
    clearTimeout(textTimer);
    clearTimeout(asteriskTimer);
    if (nowVisible) {
      const delay = parseFloat(triggerTile.style.getPropertyValue("--reveal-delay")) || 0;
      showTimer = setTimeout(() => {
        // Double rAF (same idiom initIntroReveal() already uses, same
        // reason) guarantees the illustration's initial opacity:0 state
        // has genuinely been painted at least once before flipping to
        // is-visible. Needed now specifically because trigger delay can
        // be 0 (see triggerTile above) — a setTimeout(fn, 0) alone isn't
        // guaranteed to land after a real paint, so the browser can
        // coalesce "set opacity:0" and "set opacity:1" into the same
        // frame and skip the transition outright, popping straight to
        // the end state with no visible animation at all.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            revealIllustration();
            revealAsterisks();
            textTimer = setTimeout(revealTextLines, SPLIT_CTA_ILLUSTRATION_TRANSITION_MS);
          });
        });
      }, delay);
    } else {
      hideAll();
    }
  };

  sync();
  const observer = new MutationObserver(sync);
  observer.observe(triggerTile, { attributes: true, attributeFilter: ["class"] });
}

// About page "Beyond the Page" — same reveal-CHAIN idea as
// initSplitCtaReveal() above (text fades/slides in once the section's
// own illustration is already underway, not immediately on page load),
// but that function early-returns for this page (its own `if (!tiles.
// length || !illustration) return;` — there's no .split-cta__
// illustration-tile/.split-cta__illustration here, this section's
// "illustration" is the 2-photo stack instead). Mirrors that function's
// own bidirectional-MutationObserver-on-a-trigger-element pattern,
// watching .beyond-page__img--1 (the earlier of the 2 photos to settle)
// instead of a tile.
// Base offset added to .beyond-page__img--1/--2's own --reveal-delay (see
// initRevealOnScroll() above) — checkAll() flips is-visible on them at the
// SAME early scroll-position threshold as every other tracked element on
// the site, which per explicit request fired before the section was
// scrolled far enough into view to actually watch the entrance play out.
// This doesn't change WHEN is-visible gets added, only how long the CSS
// transition waits afterward before reacting to it. BEYOND_PAGE_TEXT_
// DELAY_MS below is kept in step with this by hand (= this + 600) — see
// its own comment.
const BEYOND_PAGE_ENTRANCE_DELAY_MS = 400;
const BEYOND_PAGE_TEXT_DELAY_MS = BEYOND_PAGE_ENTRANCE_DELAY_MS + 600; // matches .beyond-page__img's own opacity transition duration, shifted by the same entrance delay
function initBeyondPageTextReveal() {
  const textLines = document.querySelectorAll(".split-cta--beyond-page .split-cta__text-line");
  const asteriskWrap = document.querySelector(".beyond-page__asterisk-wrap");
  const triggerImg = document.querySelector(".beyond-page__img--1");
  if (!textLines.length || !triggerImg) return;

  const revealTextLines = () => {
    for (const line of textLines) line.classList.add("is-visible");
  };
  const hideTextLines = () => {
    for (const line of textLines) line.classList.remove("is-visible");
  };
  // Pops in at the SAME moment the photos' own entrance transition
  // actually starts (BEYOND_PAGE_ENTRANCE_DELAY_MS, not the earlier raw
  // trigger) — mirrors index.html's own revealAsterisks() firing
  // alongside revealIllustration() rather than with the (later) text.
  const revealAsterisk = () => {
    if (asteriskWrap) asteriskWrap.classList.add("is-visible");
  };
  const hideAsterisk = () => {
    if (asteriskWrap) asteriskWrap.classList.remove("is-visible");
  };

  let showTimer = null;
  let asteriskTimer = null;
  let lastKnownVisible = null;
  const sync = () => {
    const nowVisible = triggerImg.classList.contains("is-visible");
    if (nowVisible === lastKnownVisible) return;
    lastKnownVisible = nowVisible;

    clearTimeout(showTimer);
    clearTimeout(asteriskTimer);
    if (nowVisible) {
      asteriskTimer = setTimeout(revealAsterisk, BEYOND_PAGE_ENTRANCE_DELAY_MS);
      showTimer = setTimeout(revealTextLines, BEYOND_PAGE_TEXT_DELAY_MS);
    } else {
      hideTextLines();
      hideAsterisk();
    }
  };

  sync();
  const observer = new MutationObserver(sync);
  observer.observe(triggerImg, { attributes: true, attributeFilter: ["class"] });
}

// About page "Beyond the Page" outreach photos — a subtle magnetic-
// REPULSION effect per explicit request: approaching/hovering a photo
// nudges it slightly AWAY from the cursor (opposite of the usual
// "magnetic" attraction pattern). Driven by a continuous per-frame lerp
// toward a target offset — same technique initCustomCursor() below uses
// for its own floaty drag (curX/curY easing toward mouseX/mouseY every
// frame) — rather than setting the target directly and letting a CSS
// `transition` retarget on every raw mousemove event; the latter is what
// made an earlier version of this feel jerky (each new mousemove cuts
// off the previous transition mid-flight and restarts easing from
// wherever it happened to be). A low LERP factor is what gives it a
// floaty, lagging quality instead of tracking the cursor immediately.
// Applied via the plain `transform` property (translate(px,px)),
// deliberately NOT the standalone `translate`/`rotate` properties these
// same elements already use for their scroll-entrance slide/tilt (see
// .beyond-page__img's own CSS comment) — individual transform
// properties compose with `transform` automatically (CSS Transforms
// Level 2), so this coexists without either system needing to know
// about the other.
const BEYOND_PAGE_MAGNETIC_RADIUS = 320; // px from a photo's center before it reacts at all — expanded per explicit request
const BEYOND_PAGE_MAGNETIC_MAX_OFFSET = 30; // px — expanded per explicit request, but still deliberately capped, not a real relocation
const BEYOND_PAGE_MAGNETIC_LERP = 0.06; // low = floaty/lagging; see this function's own comment
function initBeyondPageMagneticImages() {
  const images = document.querySelectorAll(".beyond-page__img");
  if (!images.length) return;

  const state = Array.from(images, () => ({ curX: 0, curY: 0 }));
  let mouseX = null;
  let mouseY = null;

  document.addEventListener(
    "mousemove",
    (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    },
    { passive: true }
  );

  function raf() {
    images.forEach((img, i) => {
      const s = state[i];
      let targetX = 0;
      let targetY = 0;
      if (mouseX !== null) {
        const rect = img.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = cx - mouseX;
        const dy = cy - mouseY;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < BEYOND_PAGE_MAGNETIC_RADIUS) {
          const strength = 1 - dist / BEYOND_PAGE_MAGNETIC_RADIUS;
          targetX = (dx / dist) * strength * BEYOND_PAGE_MAGNETIC_MAX_OFFSET;
          targetY = (dy / dist) * strength * BEYOND_PAGE_MAGNETIC_MAX_OFFSET;
        }
      }
      s.curX += (targetX - s.curX) * BEYOND_PAGE_MAGNETIC_LERP;
      s.curY += (targetY - s.curY) * BEYOND_PAGE_MAGNETIC_LERP;
      img.style.transform = `translate(${s.curX.toFixed(2)}px, ${s.curY.toFixed(2)}px)`;
    });
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}

// Custom cursor decoration: a small Instrument Serif asterisk that
// trails the REAL cursor (which stays visible — this doesn't replace
// it) with a floaty, lagging "drag", attached near the tail end of the
// pointer rather than sitting on top of the tip. Split into a wrap
// (real cursor position, via a lerp'd translate set directly in the
// rAF loop below) + inner glyph (the continuous hero-asterisk-spin
// animation) for the same reason the hero asterisk and square-corner
// asterisks are split the same way: a CSS `animation` that touches
// `transform` fully REPLACES an element's own transform rather than
// composing with it, so putting the position translate and the spin on
// the SAME element would fight each other. Skipped entirely under
// prefers-reduced-motion (this is a constantly-spinning, constantly-
// moving decoration attached to the user's own pointer — exactly the
// kind of motion that setting is meant to suppress) and on touch/coarse
// pointers (no real mouse to trail).
function initCustomCursor() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const wrap = document.createElement("div");
  wrap.className = "custom-cursor-wrap";
  wrap.setAttribute("aria-hidden", "true");
  // Reuses the hero's own asterisk artwork (a plain PNG, rotated via
  // the same hero-asterisk-spin animation the hero itself uses) rather
  // than building a glyph from an SVG <text> element. Contrast against
  // whatever background it's over comes from mix-blend-mode (see CSS),
  // not a JS-driven src swap between 2 fixed color variants — the swap
  // approach needed elementFromPoint + a background-color allowlist on
  // every mousemove, and the transition between the 2 fixed colors was
  // an abrupt, discrete jump rather than a true per-pixel contrast fix.
  const glyph = document.createElement("img");
  glyph.src = "/assets/images/Asterisk - Default.png";
  glyph.alt = "";
  glyph.className = "custom-cursor-asterisk";
  wrap.appendChild(glyph);
  document.body.appendChild(wrap);

  // Offset toward the tail end of a standard pointer (which points up-
  // left, tip at the exact mouse position) — down-right of the cursor,
  // just barely overlapping it rather than sitting right underneath.
  // The translate(-50%,-50%) below makes (curX+OFFSET_X, curY+OFFSET_Y)
  // the WRAP'S OWN CENTER, not its top-left corner — without that, this
  // offset would need to separately account for half the glyph's own
  // size just to keep the visible asterisk positioned consistently, and
  // silently drift further away every time the glyph's size changes.
  const OFFSET_X = 20;
  const OFFSET_Y = 24;
  // Lower = more lag/"drag" before catching up to the real cursor.
  // Was bumped to 0.4 earlier to fight a perceived "orbiting" during
  // circular mouse motion — that turned out to be a red herring (the
  // user confirmed live it wasn't actually visible), and the real bug
  // was the glyph.src reassignment thrashing every mousemove event
  // elsewhere in this function (now fixed), which was starving this
  // rAF loop of frames and made the lag look like it had disappeared
  // entirely. Reverted to the original, intentionally floaty value.
  const LERP = 0.14;

  // Real, actually-clickable elements only — not decorative hover targets
  // like .diamond-cta or .square, which already use cursor: default.
  function isClickablePoint(x, y) {
    const node = document.elementFromPoint(x, y);
    return !!node?.closest("a[href], button");
  }

  const HOVER_SCALE = 1.5;
  const SCALE_LERP = 0.25;

  // Spin speed reacts to how fast the REAL mouse is moving (not the
  // lagged follower position — that would add a second delay on top of
  // this one and feel sluggish to react). BASE_DEG_PER_SEC matches the
  // old fixed "8s per rotation" CSS animation this replaces. A fast flick
  // adds up to MAX_BOOST_DEG_PER_SEC on top of that, smoothed by
  // SPIN_LERP so it eases in on a flick and back out again once the
  // mouse slows — the same lerp-toward-a-target pattern already used for
  // position and hover-scale above, just applied to angular speed.
  const BASE_DEG_PER_SEC = 45;
  const SPEED_TO_BOOST = 0.15; // extra deg/sec of spin per px/sec of mouse speed
  const MAX_BOOST_DEG_PER_SEC = 650;
  const SPIN_LERP = 0.35;
  // At 18px, while ALSO chasing a fast-moving cursor, a pure rotation-
  // speed difference isn't perceivable on its own (confirmed: isolated
  // and enlarged, 45deg/sec vs 650deg/sec is obviously different; on
  // the real small, moving glyph it wasn't). Pairing the spin-up with a
  // size pulse — reusing angularSpeed, already smoothed by SPIN_LERP
  // above, as the single source of truth for "how sped up right now" —
  // makes the reaction to speed unmistakable at actual cursor size.
  const SPEED_SCALE_BOOST = 0.6; // extra scale at max angular boost

  // Click burst: adds straight into the SAME per-frame angular-speed
  // system as the mouse-flick boost above, instead of a separately
  // `animation`-driven layer with its own fixed duration — that older
  // approach (a CSS keyframe on a separate wrapper div) had a hard stop
  // the instant the animation ended, which read as an abrupt cut rather
  // than settling into the constant spin. clickBoost instead lerps
  // toward 0 every frame, same as everything else here, so it has no
  // "end" to be abrupt about — it just asymptotically fades into
  // whatever angularSpeed already is.
  const CLICK_BOOST_DEG_PER_SEC = 3600; // instantaneous spike per click
  const CLICK_BOOST_LERP = 0.08; // lower = longer tail before it's imperceptible

  let mouseX = -100;
  let mouseY = -100;
  let curX = -100;
  let curY = -100;
  let started = false;
  let targetScale = 1;
  let curScale = 1;
  let prevMouseX = mouseX;
  let prevMouseY = mouseY;
  let angularSpeed = BASE_DEG_PER_SEC;
  let clickBoost = 0;
  let rotationDeg = 0;
  let lastFrameTime = null;

  window.addEventListener(
    "mousemove",
    (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!started) {
        curX = mouseX;
        curY = mouseY;
        started = true;
      }
      targetScale = isClickablePoint(e.clientX, e.clientY) ? HOVER_SCALE : 1;
    },
    { passive: true }
  );

  // Additive (not reset) — a rapid double-click stacks a second spike on
  // top of whatever's left of the first instead of restarting it, so
  // repeat clicks feel like they're compounding rather than each one
  // clipping the last.
  window.addEventListener(
    "click",
    () => {
      clickBoost += CLICK_BOOST_DEG_PER_SEC;
    },
    { passive: true }
  );

  function raf(time) {
    if (lastFrameTime === null) lastFrameTime = time;
    const dt = (time - lastFrameTime) / 1000;
    lastFrameTime = time;

    const mouseSpeed = dt > 0 ? Math.hypot(mouseX - prevMouseX, mouseY - prevMouseY) / dt : 0;
    prevMouseX = mouseX;
    prevMouseY = mouseY;
    const targetAngularSpeed = BASE_DEG_PER_SEC + Math.min(mouseSpeed * SPEED_TO_BOOST, MAX_BOOST_DEG_PER_SEC);
    angularSpeed += (targetAngularSpeed - angularSpeed) * SPIN_LERP;
    clickBoost += (0 - clickBoost) * CLICK_BOOST_LERP;
    rotationDeg = (rotationDeg + (angularSpeed + clickBoost) * dt) % 360;
    const speedScale = 1 + ((angularSpeed - BASE_DEG_PER_SEC) / MAX_BOOST_DEG_PER_SEC) * SPEED_SCALE_BOOST;
    glyph.style.transform = `rotate(${rotationDeg}deg) scale(${speedScale})`;

    curX += (mouseX - curX) * LERP;
    curY += (mouseY - curY) * LERP;
    curScale += (targetScale - curScale) * SCALE_LERP;
    wrap.style.transform = `translate(${curX + OFFSET_X}px, ${curY + OFFSET_Y}px) translate(-50%, -50%) scale(${curScale})`;
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}

// Roles grid (Interviewer/Columnist/Editor/Designer) reveals its
// description on :hover in CSS — no help at all on a device with no
// real hover. Gated to hover-incapable devices only (same feature
// query initCustomCursor() uses, just negated): on a real mouse, hover
// already does this, and layering a click toggle on top there too
// would let a tap-then-move-away leave a tile stuck open. Listens on
// the whole tile, not just .square__role-tap-btn (that's purely a
// visual "tap me" affordance, styled in style.css) — a bigger touch
// target than a 32px diamond, and any tap inside the tile (including
// the button itself) bubbles up to this one listener.
function initRoleTapReveal() {
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const tiles = document.querySelectorAll(".square--role-reveal");
  for (const tile of tiles) {
    tile.addEventListener("click", () => {
      tile.classList.toggle("is-tapped");
    });
  }
}

// Builds a plain, always-fully-visible stand-in for a slide, for the
// loop-continuity clones below — NOT a blind cloneNode(true). The real
// .featured-carousel__slide--first carries one-time reveal machinery (8
// mask tiles, mosaic-reveal classes on its scrim) that only ever gets
// wired up ONCE, on the ORIGINAL element, by initCarouselReveal(); a
// naive clone of it would carry the SAME masks/mosaic-reveal classes
// but with nothing driving them, so it'd sit permanently in whatever
// pre-reveal (masked-over, invisible scrim) state it happened to be
// cloned in — exactly wrong for something that needs to always look
// identical to the finished slide. Every OTHER real slide already has
// no reveal machinery at all (see the HTML comment above the carousel),
// so this just mirrors that same plain shape regardless of which slide
// it's standing in for. No title/edition/number here — those live on
// the one shared caption outside the track now (see initFeaturedCarousel()),
// carried forward via the source slide's own data-title/data-edition/
// data-number attributes instead of a cloned element.
function buildCarouselLoopClone(sourceSlide) {
  const clone = document.createElement("div");
  clone.className = "featured-carousel__slide";
  clone.setAttribute("aria-hidden", "true");
  clone.dataset.title = sourceSlide.dataset.title ?? "";
  clone.dataset.edition = sourceSlide.dataset.edition ?? "";
  clone.dataset.number = sourceSlide.dataset.number ?? "";
  clone.dataset.articleUrl = sourceSlide.dataset.articleUrl ?? "#";

  const photo = sourceSlide.querySelector(".featured-carousel__photo");
  const placeholder = sourceSlide.querySelector(".featured-carousel__photo-placeholder");
  if (photo) {
    const img = document.createElement("img");
    img.className = "featured-carousel__photo";
    img.src = photo.src;
    img.alt = "";
    clone.appendChild(img);
  } else if (placeholder) {
    const div = document.createElement("div");
    div.className = "featured-carousel__photo-placeholder";
    div.setAttribute("aria-hidden", "true");
    clone.appendChild(div);
  }

  const scrim = document.createElement("div");
  scrim.className = "featured-carousel__scrim";
  scrim.setAttribute("aria-hidden", "true");
  clone.appendChild(scrim);

  const hoverTiles = document.createElement("div");
  hoverTiles.className = "featured-carousel__hover-tiles";
  for (let i = 0; i < 8; i++) {
    const tile = document.createElement("div");
    tile.className = "featured-carousel__hover-tile";
    tile.setAttribute("aria-hidden", "true");
    hoverTiles.appendChild(tile);
  }
  clone.appendChild(hoverTiles);

  return clone;
}

// Section 4's carousel: prev/next move .featured-carousel__track by one
// slide-width via transform. A truly infinite loop, not just wrapping
// the index — clicking "next" on the last real slide used to jump
// straight back to translateX(0), a visible reverse slide all the way
// across the track. Instead, a clone of the first slide is appended
// after the last (and a clone of the last is prepended before the
// first), so continuing past either end slides CONTINUOUSLY into that
// clone — visually identical to the real slide it's a copy of — and
// only once that motion finishes does it snap (transition:none, no
// visible jump) back to the real slide sitting in the same spot,
// closing the loop invisibly.
function initFeaturedCarousel() {
  const track = document.querySelector(".featured-carousel__track");
  const prevBtn = document.querySelector(".featured-carousel__nav--prev");
  const nextBtn = document.querySelector(".featured-carousel__nav--next");
  if (!track || !prevBtn || !nextBtn) return;

  const carousel = document.querySelector(".featured-carousel");
  const captionTitle = document.querySelector(".featured-carousel__title");
  const captionEdition = document.querySelector(".featured-carousel__edition");
  const captionNumber = document.querySelector(".featured-carousel__number");

  const realSlides = Array.from(track.children);
  const realCount = realSlides.length;
  if (realCount < 2) return;

  track.appendChild(buildCarouselLoopClone(realSlides[0]));
  track.insertBefore(buildCarouselLoopClone(realSlides[realCount - 1]), track.firstChild);

  // CSS's own width:400%/flex:0 0 25% are sized for exactly 4 real
  // slides (a sane fallback if this script ever failed to run) — now
  // that there are 2 more (the clones), both need to match the ACTUAL
  // total instead.
  const totalSlides = realCount + 2;
  track.style.width = `${totalSlides * 100}%`;
  for (const slide of track.children) {
    slide.style.flex = `0 0 ${100 / totalSlides}%`;
  }

  // Index 1 (not 0) — the prepended clone occupies slot 0, so the real
  // first slide starts at slot 1.
  let index = 1;

  const render = (animate) => {
    track.style.transition = animate ? "" : "none";
    track.style.transform = `translateX(-${index * (100 / totalSlides)}%)`;
    if (!animate) {
      // Forces the browser to actually apply transition:none before the
      // NEXT render() call re-enables it — otherwise the snap itself
      // could get caught by the real transition and animate visibly,
      // exactly the reverse-slide this exists to avoid.
      track.getBoundingClientRect();
    }
  };
  render(false);

  // The shared caption (see the HTML comment above the carousel)
  // crossfades its own text to match whichever slide is now active —
  // completely decoupled from the track's transform transition, so it
  // fades in place instead of physically sliding past with the image.
  // 500ms, not some shorter value, to actually MATCH the real opacity
  // transition duration these elements get from .mosaic-reveal--slide in
  // style.css (they carry that class too, for the one-time scroll
  // reveal) — swapping text any earlier than the fade-out's own real
  // duration means it happens mid-fade, at partial opacity, which reads
  // as a jarring flash-swap rather than a clean crossfade.
  const CAPTION_FADE_MS = 500;
  const applyCaption = (slide) => {
    if (captionTitle) {
      captionTitle.textContent = slide.dataset.title ?? "";
      // Edition's own href (-> publications.html) is static and set once
      // in the HTML — only the title's target changes per-slide.
      captionTitle.href = slide.dataset.articleUrl || "#";
    }
    if (captionEdition) captionEdition.textContent = slide.dataset.edition ?? "";
    if (captionNumber) captionNumber.textContent = slide.dataset.number ?? "";
  };
  applyCaption(track.children[index]);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const crossfadeCaptionTo = (slide) => {
    if (!carousel || reduceMotion) {
      applyCaption(slide);
      return;
    }
    carousel.classList.add("is-caption-fading");
    window.setTimeout(() => {
      applyCaption(slide);
      carousel.classList.remove("is-caption-fading");
    }, CAPTION_FADE_MS);
  };

  // Clicking faster than the track's own 0.6s transform transition used
  // to let `index` overshoot its valid 0..totalSlides-1 range: retargeting
  // an in-flight CSS transition to a new value never fires transitionend
  // for the interrupted one, so the wraparound-snap logic below could go
  // multiple clicks without ever running. Once `index` overshot,
  // track.children[index] was undefined, which crashed crossfadeCaptionTo
  // mid-fade and left the caption permanently stuck at opacity:0 (see the
  // is-caption-fading rule) — the "goes blank" bug. Ignoring nav clicks
  // until the current transition actually settles keeps `index` always
  // valid, which fixes the caption bug at its root instead of just
  // guarding around a bad index.
  let isAnimating = false;

  // Bottom-center diamond indicators (see .featured-carousel__indicator
  // in style.css) — one per REAL slide, never per clone, built here
  // instead of hand-written in the HTML so the count can't drift out of
  // sync with the actual slide total. Clicking one jumps straight to
  // that slide: indicator i corresponds to track.children[i + 1], since
  // slot 0 is the prepended clone (see the `index` comment above).
  const indicatorsContainer = document.querySelector(".featured-carousel__indicators");
  const indicatorButtons = indicatorsContainer
    ? realSlides.map((_, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "featured-carousel__indicator";
        btn.setAttribute("role", "tab");
        btn.setAttribute("aria-label", `Go to slide ${i + 1}`);
        btn.addEventListener("click", () => goToSlide(i));
        indicatorsContainer.appendChild(btn);
        return btn;
      })
    : [];
  // `index` ranges over the clone-padded track (0..totalSlides-1); this
  // maps it back to which REAL slide (0-based) is actually showing,
  // wrapping the same way the transitionend snap below does — so the
  // active dot stays correct even mid-wraparound, when `index` is
  // briefly sitting in a clone slot (0 or totalSlides-1).
  const updateIndicators = () => {
    if (!indicatorButtons.length) return;
    const activeRealIndex = ((index - 1) % realCount + realCount) % realCount;
    indicatorButtons.forEach((btn, i) => {
      const isActive = i === activeRealIndex;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  };
  updateIndicators();

  const goToSlide = (i) => {
    const targetIndex = i + 1;
    if (isAnimating || targetIndex === index) return;
    isAnimating = true;
    index = targetIndex;
    render(true);
    crossfadeCaptionTo(track.children[index]);
    updateIndicators();
  };

  track.addEventListener("transitionend", (e) => {
    if (e.propertyName !== "transform") return;
    if (index === totalSlides - 1) {
      index = 1;
      render(false);
    } else if (index === 0) {
      index = realCount;
      render(false);
    }
    isAnimating = false;
  });

  prevBtn.addEventListener("click", () => {
    if (isAnimating) return;
    isAnimating = true;
    index -= 1;
    render(true);
    crossfadeCaptionTo(track.children[index]);
    updateIndicators();
  });
  nextBtn.addEventListener("click", () => {
    if (isAnimating) return;
    isAnimating = true;
    index += 1;
    render(true);
    crossfadeCaptionTo(track.children[index]);
    updateIndicators();
  });
}

// Same "overlay content arrives with its own tile" fix as
// initMosaicReveal() above (see revealWithTile()'s own comment for the
// full reasoning), applied to section 4's carousel. Masks are a 4-col x
// 2-row grid in DOM/source order, so index 0 is the top-left tile —
// directly under .featured-carousel__title/--edition (both top-left-
// anchored, see their own CSS) — and index 7 is the bottom-right tile,
// under .featured-carousel__number (bottom-right-anchored). The scrim
// darkens top-down (see its own CSS gradient), matching the top row, so
// it reveals alongside that same top-left tile. Nav buttons aren't tied
// to any tile position (persistent controls, not photo-relative) — kept
// grouped with title/edition since that's the trigger they always
// shared. Only wired up for .featured-carousel__slide--first: the other
// 3 slides have no masks/scrim to pair with (see the HTML comment above
// the carousel) since they're never scrolled into view, only clicked into.
function initCarouselReveal() {
  const slide = document.querySelector(".featured-carousel__slide--first");
  if (!slide) return;

  const masks = slide.querySelectorAll(".featured-carousel__mask");
  const scrim = slide.querySelector(".featured-carousel__scrim");
  // Title/edition/number now live outside any slide (see the HTML
  // comment above the carousel) — queried at the document level, not
  // scoped to `slide`, since they're no longer its descendants.
  const title = document.querySelector(".featured-carousel__title");
  const edition = document.querySelector(".featured-carousel__edition");
  const number = document.querySelector(".featured-carousel__number");
  const navButtons = document.querySelectorAll(".featured-carousel__nav");
  // Also a persistent, photo-position-agnostic control — same reasoning
  // as navButtons above, so it's grouped with them rather than either
  // tile.
  const indicators = document.querySelector(".featured-carousel__indicators");
  if (masks.length < 8 || !scrim) return;

  revealWithTile(masks[0], [scrim, title, edition, ...navButtons, indicators].filter(Boolean));
  revealWithTile(masks[7], [number].filter(Boolean));
}
