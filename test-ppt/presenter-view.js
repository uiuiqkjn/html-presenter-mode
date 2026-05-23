/**
 * Presenter View — universal speaker console for HTML slide decks.
 * Zero dependencies. Vanilla JS. Works with any HTML presentation framework.
 *
 * Usage:
 *   <script src="presenter-view.js"></script>
 *   <script>PresenterView.init({ slideSelector: '.slide' });</script>
 *
 * Press P to start. Press P again or close the popup to stop.
 *
 * Communication: window.postMessage between main page and popup.
 * Works across file:// and about:blank origins (unlike BroadcastChannel).
 *
 * License: MIT
 */
(function () {
  'use strict';

  // ── Configuration ──────────────────────────────────────────────────────

  var DEFAULT_CONFIG = {
    slideSelector: '.slide',
    notesAttribute: 'data-notes',
    notesSelector: '.speaker-notes',
    startKey: 'p',
    aspectRatio: 16 / 9,
    messageNamespace: '__pv_',
    popupPollMs: 800,
    // If true, dispatch arrow keys for navigation (works with most decks).
    // If false, show/hide slides via style.display.
    dispatchNavKeys: true,
    // Optional: custom navigation callback. Receives (index, direction).
    // direction is 1 for forward, -1 for backward.
    onNavigate: null,
  };

  // ── State ──────────────────────────────────────────────────────────────

  var config = {};
  var slides = [];
  var currentIndex = 0;
  var popup = null;
  var timerStart = null;
  var timerInterval = null;
  var popupPollInterval = null;
  var mainResizeTimer = null;
  var sessionId = '';
  var initialized = false;
  var active = false;

  // ── Shortcuts ──────────────────────────────────────────────────────────

  function $$sel(sel, ctx) {
    return [].slice.call((ctx || document).querySelectorAll(sel));
  }

  // ── Slide helpers ──────────────────────────────────────────────────────

  function getNotes(index) {
    var slide = slides[index];
    if (!slide) return '';
    var attr = slide.getAttribute(config.notesAttribute);
    if (attr !== null && attr !== undefined) return attr;
    var el = slide.querySelector(config.notesSelector);
    if (el) return el.textContent || el.innerText || '';
    return '';
  }

  function getSlideHTML(index) {
    var slide = slides[index];
    if (!slide) return '';
    var clone = slide.cloneNode(true);
    var noteEls = clone.querySelectorAll(config.notesSelector);
    for (var i = 0; i < noteEls.length; i++) {
      noteEls[i].parentNode.removeChild(noteEls[i]);
    }
    if (clone.hasAttribute(config.notesAttribute)) {
      clone.removeAttribute(config.notesAttribute);
    }
    // Let the slide render at its natural viewport-based size.
    // vw/vh units only work correctly when the element is at actual viewport scale.
    // The popup will scale this down with CSS transform after rendering.
    clone.style.display = '';
    clone.style.visibility = 'visible';
    clone.style.position = 'relative';
    clone.style.transform = 'none';
    clone.style.flex = '0 0 auto';
    clone.style.overflow = 'hidden';
    clone.removeAttribute('hidden');
    return clone.outerHTML;
  }

  function getSlideText(index) {
    var slide = slides[index];
    if (!slide) return '';
    var clone = slide.cloneNode(true);
    var noteEls = clone.querySelectorAll(config.notesSelector);
    for (var i = 0; i < noteEls.length; i++) {
      noteEls[i].parentNode.removeChild(noteEls[i]);
    }
    return (clone.textContent || clone.innerText || '').trim();
  }

  // ── Style collection ───────────────────────────────────────────────────

  function collectStyles() {
    var parts = [];
    var styles = document.querySelectorAll('style');
    for (var i = 0; i < styles.length; i++) {
      parts.push(styles[i].outerHTML);
    }
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var j = 0; j < links.length; j++) {
      parts.push(links[j].outerHTML);
    }
    return parts.join('\n');
  }

  function getPreviewViewport() {
    var w = Math.round(window.innerWidth || document.documentElement.clientWidth || 1280);
    var h = Math.round(window.innerHeight || document.documentElement.clientHeight || 720);
    if (w <= 0) w = 1280;
    if (h <= 0) h = Math.round(w / (config.aspectRatio || (16 / 9)));
    return {
      width: w,
      height: h,
      aspectRatio: w / h,
    };
  }

  function getPreviewContext() {
    return {
      htmlClass: document.documentElement.className || '',
      htmlStyle: document.documentElement.getAttribute('style') || '',
      bodyClass: document.body ? (document.body.className || '') : '',
      bodyStyle: document.body ? (document.body.getAttribute('style') || '') : '',
    };
  }

  // ── Screen detection ───────────────────────────────────────────────────

  function detectDualScreen() {
    if (window.screen && window.screen.isExtended !== undefined) {
      return window.screen.isExtended;
    }
    if (
      window.screen &&
      window.screen.width > window.innerWidth * 1.5 &&
      window.screen.width > 1920
    ) {
      return true;
    }
    return false;
  }

  // ── Communication (postMessage) ────────────────────────────────────────

  function sendToPopup(msg) {
    if (!popup || popup.closed) return;
    msg._ns = sessionId;
    try {
      popup.postMessage(msg, '*');
    } catch (e) {}
  }

  // Listen for messages from the popup (and any other postMessage sources)
  function handleWindowMessage(e) {
    var msg = e.data;
    if (!msg || msg._ns !== sessionId) return; // filter by namespace

    switch (msg.type) {
      case 'popup-ready':
        // Popup is loaded — send initial sync
        sendToPopup({
          type: 'sync',
          index: currentIndex,
          timerStart: timerStart,
          viewport: getPreviewViewport(),
          context: getPreviewContext(),
        });
        break;

      case 'navigate':
        navigateTo(msg.index, msg.direction);
        break;

      case 'close':
        stop();
        break;

      case 'fullscreen-request':
        toggleAudienceFullscreen();
        break;

      case 'blackout':
        toggleBlackout();
        break;

      default:
        break;
    }
  }

  // ── Popup HTML construction ────────────────────────────────────────────

  function buildPopupCSS() {
    // Using concatenation to avoid minification issues
    return [
      '*{margin:0;padding:0;box-sizing:border-box}',
      ':root{--pv-bg:#000;--pv-surface:#0a0a0a;--pv-accent:#ff6b6b;--pv-text:#e8e8ed;--pv-text-dim:#7a7a8a;--pv-border:#1c1c1c;--pv-radius:6px}',
      'html,body{width:100%;height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;background:var(--pv-bg);color:var(--pv-text);-webkit-font-smoothing:antialiased}',
      '#pv-app{display:flex;flex-direction:column;height:100%;user-select:none}',
      '#pv-header{display:flex;align-items:center;justify-content:space-between;padding:10px 24px;background:var(--pv-surface);border-bottom:1px solid var(--pv-border);flex-shrink:0;min-height:52px}',
      '#pv-timer{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--pv-accent);letter-spacing:1px}',
      '#pv-counter{font-size:13px;color:var(--pv-text-dim);font-weight:500}',
      '#pv-ctrl-btns{display:flex;gap:8px;align-items:center}',
      '#pv-ctrl-btns button{padding:6px 14px;border:1px solid var(--pv-border);border-radius:var(--pv-radius);cursor:pointer;font-size:12px;font-weight:600;transition:all .15s}',
      '#pv-fullscreen{background:transparent;color:var(--pv-text-dim)}',
      '#pv-fullscreen:hover{background:var(--pv-border);color:var(--pv-text)}',
      '#pv-stop{background:var(--pv-accent);color:#fff;border-color:var(--pv-accent)!important}',
      '#pv-stop:hover{opacity:.85}',
      '#pv-main{display:flex;flex:1;overflow:hidden;min-height:0}',
      '#pv-current{flex:1;display:flex;align-items:center;justify-content:center;padding:6px;overflow:hidden;background:#000}',
      '.pv-frame-stage{position:relative;overflow:hidden;flex:none;background:#000}',
      '.pv-frame-stage iframe{position:absolute;top:0;left:0;border:none;display:block;background:#000;transform-origin:top left}',
      '#pv-sidebar{width:300px;display:flex;flex-direction:column;flex-shrink:0;border-left:1px solid var(--pv-border);overflow-y:auto;overflow-x:hidden;position:relative;background:#050505}',
      '#pv-next-preview{padding:10px 14px;border-bottom:1px solid var(--pv-border);background:#050505}',
      '.pv-section-label{font-size:10px;text-transform:uppercase;color:var(--pv-text-dim);margin-bottom:8px;letter-spacing:1px;font-weight:600}',
      '#pv-next-stage{margin:0 auto}',
      '#pv-notes{flex:1;padding:12px 14px;min-height:100px;display:flex;flex-direction:column;background:#050505}',
      '#pv-notes-content{font-size:16px;line-height:1.7;color:#fff;white-space:pre-wrap;word-break:break-word;overflow-y:auto;flex:1;cursor:text;border-radius:6px;padding:12px;margin:0;background:#0a0a0a;border:1px solid #1c1c1c}',
      '#pv-notes-content:empty::before{content:"Click to add notes…";color:var(--pv-text-dim);font-style:italic}',
      '#pv-notes-content:focus{outline:none;background:#111;border-color:#333}',
      '#pv-footer{display:flex;align-items:center;padding:10px 20px;background:var(--pv-surface);border-top:1px solid var(--pv-border);flex-shrink:0;gap:16px;min-height:52px}',
      '#pv-footer button{padding:8px 22px;background:var(--pv-surface);color:var(--pv-text);border:1px solid var(--pv-border);border-radius:var(--pv-radius);cursor:pointer;font-size:13px;font-weight:600;transition:all .15s;white-space:nowrap}',
      '#pv-footer button:hover{background:var(--pv-border)}',
      '#pv-prev:disabled,#pv-next:disabled{opacity:.3;cursor:default}',
      '#pv-thumbnails{flex:1;display:flex;gap:4px;overflow-x:auto;overflow-y:hidden;padding:2px 0;align-items:center}',
      '#pv-thumbnails::-webkit-scrollbar{height:3px}',
      '#pv-thumbnails::-webkit-scrollbar-thumb{background:var(--pv-border);border-radius:2px}',
      '.pv-thumb{min-width:52px;height:30px;flex-shrink:0;background:#111;border:2px solid transparent;cursor:pointer;border-radius:3px;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center;transition:all .15s}',
      '.pv-thumb.active{border-color:var(--pv-accent);background:#1a1a1a}',
      '.pv-thumb.active .pv-thumb-num{color:var(--pv-accent)}',
      '.pv-thumb:hover:not(.active){border-color:#444}',
      '.pv-thumb-num{font-size:11px;color:rgba(255,255,255,.35);font-weight:600;font-family:system-ui,sans-serif}',
      '#pv-resizer{position:absolute;top:0;left:-3px;width:6px;height:100%;cursor:col-resize;z-index:10}',
      '#pv-resizer:hover{background:var(--pv-accent);opacity:.5}',
      '#pv-hint{position:fixed;bottom:10px;left:50%;transform:translateX(-50%);font-size:10px;color:var(--pv-text-dim);opacity:.6;pointer-events:none;z-index:100}',
    ].join('');
  }

  function buildPopupBody(slidesCount) {
    return [
      '<div id="pv-app">',
      '<header id="pv-header">',
      '<span id="pv-timer">00:00</span>',
      '<span id="pv-counter">Slide 1 / ' + slidesCount + '</span>',
      '<div id="pv-ctrl-btns">',
      '<button id="pv-fullscreen" title="Toggle fullscreen">&#x26F6; Audience</button>',
      '<button id="pv-stop">Stop</button>',
      '</div>',
      '</header>',
      '<main id="pv-main">',
      '<div id="pv-current">',
      '<div id="pv-current-stage" class="pv-frame-stage">',
      '<iframe id="pv-c-frame"></iframe>',
      '</div>',
      '</div>',
      '<aside id="pv-sidebar">',
      '<div id="pv-resizer"></div>',
      '<div id="pv-next-preview">',
      '<div class="pv-section-label">Next slide</div>',
      '<div id="pv-next-stage" class="pv-frame-stage">',
      '<iframe id="pv-n-frame"></iframe>',
      '</div>',
      '</div>',
      '<div id="pv-notes">',
      '<div class="pv-section-label">Speaker notes</div>',
      '<div id="pv-notes-content"></div>',
      '</div>',
      '</aside>',
      '</main>',
      '<footer id="pv-footer">',
      '<button id="pv-prev" title="Previous (Left Arrow)">&#x25C0; Prev</button>',
      '<div id="pv-thumbnails"></div>',
      '<button id="pv-next" title="Next (Right Arrow)">Next &#x25B6;</button>',
      '</footer>',
      '<div id="pv-hint">&#x2190; &#x2192; navigate &middot; Esc stop &middot; B blackout</div>',
      '</div>',
    ].join('');
  }

  function buildPopupScript(slidesData, previewViewport, previewContext) {
    var slidesJSON = JSON.stringify(slidesData);
    var previewJSON = JSON.stringify(previewViewport);
    var contextJSON = JSON.stringify(previewContext);
    var sessionJSON = JSON.stringify(sessionId);
    var curIdx = currentIndex;
    var tStart = timerStart || Date.now();

    // This script runs INSIDE the popup. It uses window.opener.postMessage
    // to communicate back to the main page.
    return [
      '(function(){',
      'var SLIDES = ' + slidesJSON + ';',
      'var NS = ' + sessionJSON + ';',
      'var CURRENT = ' + curIdx + ';',
      'var TIMER_START = ' + tStart + ';',
      'var PREVIEW = ' + previewJSON + ';',
      'var CONTEXT = ' + contextJSON + ';',
      'var NOTES_EDITS = {};', // per-slide edited notes (session only)

      // ── Send message to opener ──
      'function send(msg) {',
      '  msg._ns = NS;',
      '  try { window.opener.postMessage(msg, "*"); } catch(e) {}',
      '}',

      // ── Navigate (tells main window to change slides) ──
      'function navigateTo(idx, dir) {',
      '  if (idx < 0 || idx >= SLIDES.length) return;',
      '  CURRENT = idx;',
      '  send({ type: "navigate", index: idx, direction: dir || 0 });',
      '  updateDisplay();',
      '}',

      // ── Update all UI ──
      'function updateDisplay() {',
      '  var idx = CURRENT;',
      '  if (idx === undefined) idx = 0;',
      '  var cFrame = document.getElementById("pv-c-frame");',
      '  var nFrame = document.getElementById("pv-n-frame");',
      '  var notesEl = document.getElementById("pv-notes-content");',
      '  var counterEl = document.getElementById("pv-counter");',
      '  var prevBtn = document.getElementById("pv-prev");',
      '  var nextBtn = document.getElementById("pv-next");',
      '  var thumbs = document.querySelectorAll(".pv-thumb");',
      '',
      '  // ── Helpers ──',
      '  function getStyles() {',
      '    var p = [];',
      '    var ss = document.querySelectorAll("style");',
      '    for (var si = 0; si < ss.length; si++) p.push(ss[si].outerHTML);',
      '    var ls = document.querySelectorAll("link[rel=\\"stylesheet\\"]");',
      '    for (var li = 0; li < ls.length; li++) p.push(ls[li].outerHTML);',
      '    return p.join("");',
      '  }',
      '  function escAttr(v) {',
      '    return String(v || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");',
      '  }',
      '  function getAllSrcdoc() {',
      '    if (window.__pv_srcdoc) return window.__pv_srcdoc;',
      '    var h = "";',
      '    for (var i = 0; i < SLIDES.length; i++) {',
      '      h += "<div id=\\"pv-s-" + i + "\\" style=\\"display:none;width:100%;height:100%\\">" + SLIDES[i].html + "</div>";',
      '    }',
      '    h += "<div id=\\"pv-s--1\\" style=\\"display:none;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;font-size:14px;color:#555;background:#000\\">\\u2014 End \\u2014</div>";',
      '    var htmlAttrs = (CONTEXT && CONTEXT.htmlClass) ? " class=\\"" + escAttr(CONTEXT.htmlClass) + "\\"" : "";',
      '    var bodyAttrs = " data-presenter-view-preview=\\"\\"";',
      '    if (CONTEXT && CONTEXT.bodyClass) bodyAttrs += " class=\\"" + escAttr(CONTEXT.bodyClass) + "\\"";',
      '    if (CONTEXT && CONTEXT.bodyStyle) bodyAttrs += " style=\\"" + escAttr(CONTEXT.bodyStyle) + "\\"";',
      '    window.__pv_srcdoc = "<!DOCTYPE html><html" + htmlAttrs + "><head><meta charset=\\"UTF-8\\"><meta name=\\"viewport\\" content=\\"width=device-width,initial-scale=1\\">" +',
      '      getStyles() + "<style>html,body{margin:0;padding:0;overflow:hidden;width:100%;height:100%}body[data-presenter-view-preview] [data-anim]{opacity:1!important;transform:none!important;visibility:visible!important}</style>" +',
      '      "</head><body" + bodyAttrs + ">" + h +',
      '      "<script>window._setContext=function(ctx){ctx=ctx||{};document.documentElement.className=ctx.htmlClass||String();document.body.className=ctx.bodyClass||String();if(ctx.htmlStyle!==undefined)document.documentElement.setAttribute(\\"style\\",ctx.htmlStyle||String());if(ctx.bodyStyle!==undefined)document.body.setAttribute(\\"style\\",ctx.bodyStyle||String())};window._show=function(n){for(var i=0,ss=document.querySelectorAll(\\"[id^=pv-s-]\\");i<ss.length;i++)ss[i].style.display=\\"none\\";var t=document.getElementById(\\"pv-s-\\"+n);if(t)t.style.display=\\"\\"};<\\/script>" +',
      '      "</body></html>";',
      '    return window.__pv_srcdoc;',
      '  }',
      '  function setFrame(frame, slideIdx, availW, availH) {',
      '    if (availW <= 0) availW = 400; if (availH <= 0) availH = 250;',
      '    var sourceW = Math.max(1, Math.round((PREVIEW && PREVIEW.width) || 1280));',
      '    var sourceH = Math.max(1, Math.round((PREVIEW && PREVIEW.height) || (sourceW / ((PREVIEW && PREVIEW.aspectRatio) || (16 / 9)))));',
      '    var scale = Math.min(availW / sourceW, availH / sourceH);',
      '    if (!isFinite(scale) || scale <= 0) scale = 1;',
      '    var displayW = Math.max(1, Math.round(sourceW * scale));',
      '    var displayH = Math.max(1, Math.round(sourceH * scale));',
      '    var stage = frame.parentElement;',
      '    if (stage) {',
      '      stage.style.width = displayW + "px";',
      '      stage.style.height = displayH + "px";',
      '    }',
      '    // Render with the audience viewport, then scale the whole iframe down.',
      '    // This preserves 100vw/100vh layouts and prevents right-edge clipping.',
      '    frame.setAttribute("width", sourceW);',
      '    frame.setAttribute("height", sourceH);',
      '    frame.style.width = sourceW + "px";',
      '    frame.style.height = sourceH + "px";',
      '    frame.style.transform = "scale(" + scale + ")";',
      '    var targetIdx = (slideIdx >= 0 && slideIdx < SLIDES.length) ? slideIdx : -1;',
      '    if (!frame.__pv_init) {',
      '      frame.__pv_init = true;',
      '      frame.__pv_pending = targetIdx;',
      '      frame.srcdoc = getAllSrcdoc();',
      '      frame.onload = function() {',
      '        frame.__pv_ready = true;',
      '        try { if (frame.contentWindow._setContext) frame.contentWindow._setContext(CONTEXT); frame.contentWindow._show(frame.__pv_pending); } catch(e) {}',
      '      };',
      '    } else if (frame.__pv_ready) {',
      '      try { if (frame.contentWindow._setContext) frame.contentWindow._setContext(CONTEXT); frame.contentWindow._show(targetIdx); } catch(e) { frame.srcdoc = getAllSrcdoc(); }',
      '    } else {',
      '      frame.__pv_pending = targetIdx;',
      '    }',
      '  }',
      '',
      '  // ── Current slide preview ──',
      '  var pEl = document.getElementById("pv-current");',
      '  var maxW = (pEl.clientWidth - 12) * 0.90;',
      '  var maxH = (pEl.clientHeight - 12) * 0.90;',
      '  setFrame(cFrame, idx, maxW, maxH);',
      '',
      '  // ── Next slide preview ──',
      '  var nBox = document.getElementById("pv-next-preview");',
      '  var nAvailW = nBox.clientWidth - 28;',
      '  if (nAvailW <= 0) nAvailW = 260;',
      '  var nAspect = (PREVIEW && PREVIEW.aspectRatio) || ((PREVIEW && PREVIEW.width) / (PREVIEW && PREVIEW.height)) || (16 / 9);',
      '  var nAvailH = nAvailW / nAspect;',
      '  setFrame(nFrame, idx + 1, nAvailW, nAvailH);',
      '',
      '  // ── Speaker notes ──',
      '  if (notesEl.isContentEditable) {',
      '    NOTES_EDITS[CURRENT] = notesEl.textContent;',
      '  }',
      '  notesEl.contentEditable = "false";',
      '  var edited = NOTES_EDITS[idx];',
      '  var original = (SLIDES[idx] && SLIDES[idx].notes) || "";',
      '  notesEl.textContent = edited !== undefined ? edited : original;',
      '',
      '  // ── Counter ──',
      '  counterEl.textContent = "Slide " + (idx + 1) + " / " + SLIDES.length;',
      '',
      '  // ── Buttons ──',
      '  prevBtn.disabled = idx <= 0;',
      '  nextBtn.disabled = idx >= SLIDES.length - 1;',
      '',
      '  // ── Thumbnails ──',
      '  for (var i = 0; i < thumbs.length; i++) {',
      '    thumbs[i].classList.toggle("active", i === idx);',
      '  }',
      '}',

      // ── Build thumbnails ──
      '(function() {',
      '  var tc = document.getElementById("pv-thumbnails");',
      '  for (var i = 0; i < SLIDES.length; i++) {',
      '    (function(idx) {',
      '      var t = document.createElement("div");',
      '      t.className = "pv-thumb";',
      '      t.innerHTML = "<span class=\\"pv-thumb-num\\">" + (idx + 1) + "</span>";',
      '      t.addEventListener("click", function() {',
      '        var dir = idx > CURRENT ? 1 : (idx < CURRENT ? -1 : 0);',
      '        navigateTo(idx, dir);',
      '      });',
      '      tc.appendChild(t);',
      '    })(i);',
      '  }',
      '})();',

      // ── Button handlers ──
      'document.getElementById("pv-prev").addEventListener("click", function() {',
      '  if (CURRENT > 0) navigateTo(CURRENT - 1, -1);',
      '});',
      'document.getElementById("pv-next").addEventListener("click", function() {',
      '  if (CURRENT < SLIDES.length - 1) navigateTo(CURRENT + 1, 1);',
      '});',
      'document.getElementById("pv-stop").addEventListener("click", function() {',
      '  send({ type: "close" });',
      '  window.close();',
      '});',
      'document.getElementById("pv-fullscreen").addEventListener("click", function() {',
      '  send({ type: "fullscreen-request" });',
      '});',

      '// ── Editable notes: click to edit, blur/Enter to save ──',
      '(function() {',
      '  var notesEl = document.getElementById("pv-notes-content");',
      '  notesEl.addEventListener("click", function() {',
      '    if (!notesEl.isContentEditable) {',
      '      notesEl.contentEditable = "true";',
      '      notesEl.focus();',
      '    }',
      '  });',
      '  notesEl.addEventListener("blur", function() {',
      '    NOTES_EDITS[CURRENT] = notesEl.textContent;',
      '    notesEl.contentEditable = "false";',
      '  });',
      '  notesEl.addEventListener("keydown", function(e) {',
      '    if (e.key === "Enter" && !e.shiftKey) {',
      '      e.preventDefault();',
      '      NOTES_EDITS[CURRENT] = notesEl.textContent;',
      '      notesEl.contentEditable = "false";',
      '      notesEl.blur();',
      '    }',
      '  });',
      '})();',

      // ── Sidebar resizer ──
      '(function() {',
      '  var resizer = document.getElementById("pv-resizer");',
      '  var sidebar = document.getElementById("pv-sidebar");',
      '  var startX, startW;',
      '  resizer.addEventListener("mousedown", function(e) {',
      '    startX = e.clientX;',
      '    startW = sidebar.offsetWidth;',
      '    document.body.style.cursor = "col-resize";',
      '    document.body.style.userSelect = "none";',
      '    function onMove(ev) {',
      '      var w = Math.max(260, Math.min(500, startW + (startX - ev.clientX)));',
      '      sidebar.style.width = w + "px";',
      '    }',
      '    function onUp() {',
      '      document.removeEventListener("mousemove", onMove);',
      '      document.removeEventListener("mouseup", onUp);',
      '      document.body.style.cursor = "";',
      '      document.body.style.userSelect = "";',
      '      updateDisplay();',
      '    }',
      '    document.addEventListener("mousemove", onMove);',
      '    document.addEventListener("mouseup", onUp);',
      '    e.preventDefault();',
      '  });',
      '})();',

      // ── Keyboard ──
      'document.addEventListener("keydown", function(e) {',
      '  if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {',
      '    e.preventDefault();',
      '    if (CURRENT < SLIDES.length - 1) navigateTo(CURRENT + 1, 1);',
      '  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {',
      '    e.preventDefault();',
      '    if (CURRENT > 0) navigateTo(CURRENT - 1, -1);',
      '  } else if (e.key === "Escape") {',
      '    send({ type: "close" });',
      '    window.close();',
      '  } else if (e.key === "b" || e.key === "B") {',
      '    send({ type: "blackout" });',
      '  }',
      '});',

      // ── Timer ──
      'setInterval(function() {',
      '  var elapsed = Math.floor((Date.now() - TIMER_START) / 1000);',
      '  var m = Math.floor(elapsed / 60).toString().padStart(2, "0");',
      '  var s = (elapsed % 60).toString().padStart(2, "0");',
      '  var timerEl = document.getElementById("pv-timer");',
      '  if (timerEl) timerEl.textContent = m + ":" + s;',
      '}, 1000);',

      // ── Listen for messages from opener (main page) ──
      'window.addEventListener("message", function(e) {',
      '  var msg = e.data;',
      '  if (!msg || msg._ns !== NS) return;',
      '  if (msg.type === "sync" || msg.type === "init") {',
      '    if (msg.index !== undefined) CURRENT = msg.index;',
      '    if (msg.timerStart) TIMER_START = msg.timerStart;',
      '    if (msg.viewport) PREVIEW = msg.viewport;',
      '    if (msg.context) CONTEXT = msg.context;',
      '    updateDisplay();',
      '  } else if (msg.type === "close") {',
      '    window.close();',
      '  }',
      '});',

      // ── Initial render (double rAF ensures layout is complete) ──
      'requestAnimationFrame(function() {',
      '  requestAnimationFrame(function() {',
      '    updateDisplay();',
      '    send({ type: "popup-ready" });',
      '  });',
      '});',

      // ── Recalculate on resize ──
      'var _rt;',
      'window.addEventListener("resize", function() {',
      '  clearTimeout(_rt);',
      '  _rt = setTimeout(updateDisplay, 200);',
      '});',

      // ── Clean up on close ──
      'window.addEventListener("beforeunload", function() {',
      '  send({ type: "close" });',
      '});',
      '})();',
    ].join('\n');
  }

  function openPopup(styles, slidesData, previewViewport, previewContext) {
    var pw = Math.min(1400, screen.availWidth * 0.92);
    var ph = Math.min(900, screen.availHeight * 0.85);
    var pl = Math.max(0, (screen.availWidth - pw) / 2);
    var pt = Math.max(0, (screen.availHeight - ph) / 2);

    var win = window.open(
      'about:blank',
      'presenter-view',
      'width=' + Math.round(pw) +
        ',height=' + Math.round(ph) +
        ',left=' + Math.round(pl) +
        ',top=' + Math.round(pt) +
        ',menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no'
    );

    if (!win) {
      alert('Popup blocked. Please allow popups for this site to use Presenter View.');
      return null;
    }

    var doc = win.document;

    doc.open();
    doc.write(
      '<!DOCTYPE html>\n' +
      '<html>\n' +
      '<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
      '<title>Presenter View</title>\n' +
      '<style>\n' + buildPopupCSS() + '\n</style>\n' +
      // Inject main page styles so slide previews render correctly
      styles + '\n' +
      '</head>\n' +
      '<body>\n' +
      buildPopupBody(slidesData.length) + '\n' +
      '<script>\n' +
      buildPopupScript(slidesData, previewViewport, previewContext) + '\n' +
      '</' + 'script>\n' +
      '</body>\n' +
      '</html>'
    );
    doc.close();

    return win;
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  function navigateTo(index, direction) {
    if (index < 0 || index >= slides.length) return;

    var dir = direction || (index > currentIndex ? 1 : -1);
    var steps = Math.abs(index - currentIndex);
    currentIndex = index;

    // Strategy 1: custom callback
    if (config.onNavigate) {
      config.onNavigate(index, dir);
    }
    // Strategy 2: dispatch keyboard events (works with most HTML decks)
    else if (config.dispatchNavKeys) {
      var key = dir > 0 ? 'ArrowRight' : 'ArrowLeft';
      var keyCode = dir > 0 ? 39 : 37;
      // Dispatch one event per step for multi-slide jumps
      for (var s = 0; s < steps; s++) {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: key,
          code: key,
          keyCode: keyCode,
          which: keyCode,
          bubbles: true,
          cancelable: true,
        }));
      }
    }
    // Strategy 3: show/hide slides directly
    else {
      for (var i = 0; i < slides.length; i++) {
        slides[i].style.display = i === index ? '' : 'none';
      }
    }

    // Sync popup state
    sendToPopup({
      type: 'sync',
      index: currentIndex,
      timerStart: timerStart,
      viewport: getPreviewViewport(),
      context: getPreviewContext(),
    });
  }

  function handleMainResize() {
    if (!active) return;
    if (mainResizeTimer) clearTimeout(mainResizeTimer);
    mainResizeTimer = setTimeout(function () {
      mainResizeTimer = null;
      sendToPopup({
        type: 'sync',
        index: currentIndex,
        timerStart: timerStart,
        viewport: getPreviewViewport(),
        context: getPreviewContext(),
      });
    }, 120);
  }

  function next() {
    navigateTo(currentIndex + 1, 1);
  }

  function prev() {
    navigateTo(currentIndex - 1, -1);
  }

  function goTo(index) {
    var dir = index > currentIndex ? 1 : (index < currentIndex ? -1 : 0);
    navigateTo(index, dir);
  }

  // ── Timer ──────────────────────────────────────────────────────────────

  function startTimer() {
    stopTimer();
    timerStart = Date.now();
    timerInterval = setInterval(function () {
      if (!popup || popup.closed) {
        stop();
        return;
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    timerStart = null;
  }

  // ── Blackout ───────────────────────────────────────────────────────────

  function toggleBlackout() {
    var overlay = document.getElementById('__pv_blackout');
    if (overlay) {
      overlay.parentNode.removeChild(overlay);
    } else {
      overlay = document.createElement('div');
      overlay.id = '__pv_blackout';
      overlay.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:99999;cursor:none;';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', function () {
        overlay.parentNode.removeChild(overlay);
      });
    }
  }

  // ── Fullscreen ─────────────────────────────────────────────────────────

  function toggleAudienceFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(function () {});
    } else {
      document.documentElement.requestFullscreen().catch(function () {});
    }
  }

  // ── Keyboard (main window) ─────────────────────────────────────────────

  function handleMainKeydown(e) {
    if (
      e.key.toLowerCase() === config.startKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      var activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      if (active) {
        stop();
      } else {
        start();
      }
      return;
    }
  }

  // ── Popup liveness polling ─────────────────────────────────────────────

  function startPopupPoll() {
    stopPopupPoll();
    popupPollInterval = setInterval(function () {
      if (!popup || popup.closed) {
        stop();
      }
    }, config.popupPollMs);
  }

  function stopPopupPoll() {
    if (popupPollInterval) {
      clearInterval(popupPollInterval);
      popupPollInterval = null;
    }
  }

  // ── Detect current slide from deck position ────────────────────────────

  function detectCurrentSlide() {
    // For decks that use transform-based navigation,
    // check which slide is most visible in the viewport
    var bestIdx = 0;
    var bestOverlap = 0;
    var vw = window.innerWidth;

    for (var i = 0; i < slides.length; i++) {
      var rect = slides[i].getBoundingClientRect();
      // How much of this slide is in the viewport?
      var overlap = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0));
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  // ── Public API ─────────────────────────────────────────────────────────

  function start() {
    if (!initialized) {
      console.warn('[PresenterView] Call PresenterView.init() first.');
      return;
    }

    if (active) {
      if (popup && !popup.closed) {
        popup.focus();
      }
      return;
    }

    if (!slides.length) {
      console.warn('[PresenterView] No slides found.');
      return;
    }

    sessionId = config.messageNamespace + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    // Detect current slide
    currentIndex = detectCurrentSlide();

    // Collect styles from main document
    var styles = collectStyles();

    // Build slide data
    var slidesData = [];
    for (var i = 0; i < slides.length; i++) {
      slidesData.push({
        html: getSlideHTML(i),
        notes: getNotes(i),
        text: getSlideText(i).substring(0, 80),
      });
    }

    // Open popup
    popup = openPopup(styles, slidesData, getPreviewViewport(), getPreviewContext());
    if (!popup) return;

    // Listen for messages from popup
    window.addEventListener('message', handleWindowMessage);
    window.addEventListener('resize', handleMainResize);
    document.addEventListener('fullscreenchange', handleMainResize);

    // Start timer
    startTimer();

    // Poll popup liveness
    startPopupPoll();

    // Try dual-screen fullscreen
    var dual = detectDualScreen();
    if (dual === true) {
      setTimeout(function () {
        document.documentElement.requestFullscreen().catch(function () {});
      }, 800);
    }

    active = true;
    document.body.setAttribute('data-presenter-view-active', '');
  }

  function stop() {
    stopTimer();
    stopPopupPoll();

    // Notify popup
    sendToPopup({ type: 'close' });

    // Remove message listener
    window.removeEventListener('message', handleWindowMessage);
    window.removeEventListener('resize', handleMainResize);
    document.removeEventListener('fullscreenchange', handleMainResize);
    if (mainResizeTimer) {
      clearTimeout(mainResizeTimer);
      mainResizeTimer = null;
    }

    if (popup && !popup.closed) {
      popup.close();
    }
    popup = null;

    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(function () {});
    }

    // Remove blackout
    var overlay = document.getElementById('__pv_blackout');
    if (overlay) {
      overlay.parentNode.removeChild(overlay);
    }

    // Restore all slides (in case we used display:none)
    for (var i = 0; i < slides.length; i++) {
      slides[i].style.display = '';
    }

    active = false;
    sessionId = '';
    document.body.removeAttribute('data-presenter-view-active');
  }

  function init(opts) {
    if (initialized) return;

    config = {};
    var keys = Object.keys(DEFAULT_CONFIG);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      config[k] = (opts && opts[k] !== undefined) ? opts[k] : DEFAULT_CONFIG[k];
    }

    slides = $$sel(config.slideSelector);

    if (!slides.length) {
      console.warn(
        '[PresenterView] No slides found matching "' +
        config.slideSelector + '".'
      );
    }

    document.addEventListener('keydown', handleMainKeydown);
    initialized = true;
  }

  // ── Exports ────────────────────────────────────────────────────────────

  window.PresenterView = {
    init: init,
    start: start,
    stop: stop,
    next: next,
    prev: prev,
    goTo: goTo,
    navigateTo: navigateTo,
    get currentIndex() {
      return currentIndex;
    },
    get slideCount() {
      return slides.length;
    },
    get isActive() {
      return active;
    },
  };
})();
