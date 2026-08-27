/**
 * Trell Tracking SDK — drop-in script for auto-tracking pageviews, forms, and CTA clicks.
 *
 * Usage:
 *   <script src="https://trepi.relake.co/sdk/trell.js"
 *     data-pk="pk_..."
 *     data-auto-track="true"
 *     defer></script>
 */
(function () {
  "use strict";

  // ── Config ──────────────────────────────────────────────────
  var scriptEl = document.currentScript || (function () {
    var s = document.getElementsByTagName("script");
    return s[s.length - 1];
  })();

  var PK = scriptEl.getAttribute("data-pk") || "";
  var AUTO_TRACK = (scriptEl.getAttribute("data-auto-track") || "true") === "true";

  // Infer API base from the script src: https://host/sdk/trell.js → https://host
  var scriptSrc = scriptEl.src || "";
  var API_BASE = (scriptEl.getAttribute("data-api-url") || "").trim();
  if (!API_BASE) {
    try { API_BASE = new URL(scriptSrc).origin; } catch (_) { API_BASE = ""; }
  }

  if (!PK || !API_BASE) return;

  var INGEST_URL = API_BASE + "/v1/ingest";

  // ── Helpers ─────────────────────────────────────────────────
  var V = 1;
  var SESSION_TTL_MS = 30 * 60 * 1000; // 30 min
  var LS = tryLS();

  function tryLS() {
    try { return window.localStorage; } catch (_) { return null; }
  }

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // Derive a stable, deterministic form id from the form's DOM structure so the
  // same form always maps to the same id (even without name/id/data attributes).
  function hashCode(str) {
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & 0x7fffffff;
    }
    return hash.toString(36);
  }

  function stableFormId(formEl) {
    // Prefer explicit identifiers — these are the most reliable.
    var explicit = formEl.getAttribute("data-trell-form-id") || formEl.id;
    if (explicit) return explicit;
    // Otherwise build a fingerprint from the form's signature attrs + field names.
    var sig = formEl.getAttribute("action") || formEl.getAttribute("name") || "";
    Array.prototype.forEach.call(formEl.querySelectorAll("input, textarea, select"), function (f) {
      sig += "|" + (f.getAttribute("name") || f.getAttribute("id") || f.type);
    });
    if (!sig) sig = formEl.outerHTML.slice(0, 200);
    return "form-" + hashCode(sig);
  }

  function getVisitorId() {
    var key = "_trell_vid";
    var id = LS && LS.getItem(key);
    if (!id) { id = uuid(); if (LS) LS.setItem(key, id); }
    return id;
  }

  function getSessionId() {
    var key = "_trell_sid";
    var tsKey = "_trell_sid_ts";
    var now = Date.now();
    var id = LS && LS.getItem(key);
    var ts = LS && LS.getItem(tsKey);
    if (!id || !ts || (now - Number(ts)) > SESSION_TTL_MS) {
      id = uuid();
      if (LS) { LS.setItem(key, id); LS.setItem(tsKey, String(now)); }
    } else {
      if (LS) LS.setItem(tsKey, String(now));
    }
    return id;
  }

  // ── Device Detection ────────────────────────────────────────
  function detectDevice() {
    var ua = navigator.userAgent || "";
    var vw = window.innerWidth || document.documentElement.clientWidth || 1024;
    var vh = window.innerHeight || document.documentElement.clientHeight || 768;
    var type = vw <= 768 ? "mobile" : vw <= 1024 ? "tablet" : "desktop";

    var os = null;
    if (/Windows/i.test(ua)) os = "Windows";
    else if (/Mac OS X/i.test(ua)) os = "macOS";
    else if (/Linux/i.test(ua)) os = "Linux";
    else if (/Android/i.test(ua)) os = "Android";
    else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";

    var browser = null;
    if (/Edg\//i.test(ua)) browser = "Edge";
    else if (/Chrome/i.test(ua) && !/OPR/i.test(ua)) browser = "Chrome";
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
    else if (/Firefox/i.test(ua)) browser = "Firefox";
    else if (/OPR|Opera/i.test(ua)) browser = "Opera";

    return { type: type, os: os, browser: browser, viewport: [vw, vh] };
  }

  // ── UTM Extraction ──────────────────────────────────────────
  function getUtm() {
    var p = new URLSearchParams(window.location.search);
    var src = p.get("utm_source");
    var med = p.get("utm_medium");
    var cam = p.get("utm_campaign");
    var term = p.get("utm_term");
    var cont = p.get("utm_content");
    if (!src && !med && !cam && !term && !cont) return null;
    return { source: src || null, medium: med || null, campaign: cam || null, term: term || null, content: cont || null };
  }

  // ── Build Event ─────────────────────────────────────────────
  function buildBase() {
    return {
      v: V,
      event_id: uuid(),
      project: PK,
      ts: Date.now(),
      session_id: getSessionId(),
      visitor_id: getVisitorId(),
      url: window.location.href,
      page: { path: window.location.pathname, title: document.title || "" },
      referrer: document.referrer || "",
      utm: getUtm(),
      device: detectDevice(),
      properties: {},
    };
  }

  function buildFormBase(formEl) {
    var b = buildBase();
    b.form = {
      id: stableFormId(formEl),
      name: formEl.getAttribute("data-trell-form-name") || formEl.getAttribute("name") || undefined,
    };
    return b;
  }

  // ── Send ────────────────────────────────────────────────────
  var queue = [];
  var sending = false;

  function send(ev) {
    queue.push(ev);
    flush();
  }

  function flush() {
    if (sending || queue.length === 0) return;
    sending = true;
    var batch = queue.splice(0, 200);
    var body = batch.length === 1 ? batch[0] : batch;

    var xhr = new XMLHttpRequest();
    xhr.open("POST", INGEST_URL, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Authorization", "Bearer " + PK);
    xhr.onreadystatechange = function () {
      sending = false;
      if (queue.length > 0) flush();
    };
    xhr.onerror = function () {
      sending = false;
      // Retry after 2s
      setTimeout(function () { queue.unshift.apply(queue, batch); flush(); }, 2000);
    };
    try { xhr.send(JSON.stringify(body)); } catch (_) { sending = false; }
  }

  // ── Event Name Mapping ──────────────────────────────────────
  function eventNameFor(el) {
    var t = el.tagName;
    if (t === "INPUT") {
      var type = (el.getAttribute("type") || "").toLowerCase();
      if (type === "submit") return "Submit";
      if (type === "button") return "Click";
    }
    if (t === "BUTTON") {
      var text = (el.textContent || "").trim().slice(0, 60);
      return text || "Button Click";
    }
    if (t === "A") {
      var href = el.getAttribute("href") || "";
      if (href.startsWith("#") || href.startsWith("javascript:")) return "Anchor Click";
      return "Link Click";
    }
    return el.textContent.trim().slice(0, 60) || "Click";
  }

  // ── Auto-Track: Pageviews ───────────────────────────────────
  var lastPagePath = window.location.pathname;

  function trackPageview() {
    if (!AUTO_TRACK) return;
    var ev = buildBase();
    ev.type = "pageview";
    send(ev);
  }

  // SPA: intercept pushState / replaceState
  if (history.pushState) {
    var origPush = history.pushState;
    history.pushState = function () {
      origPush.apply(this, arguments);
      onNav();
    };
  }
  if (history.replaceState) {
    var origReplace = history.replaceState;
    history.replaceState = function () {
      origReplace.apply(this, arguments);
      onNav();
    };
  }
  window.addEventListener("popstate", onNav);

  function onNav() {
    var newPath = window.location.pathname;
    if (newPath !== lastPagePath) {
      lastPagePath = newPath;
      trackPageview();
    }
  }

  // ── Auto-Track: Forms ───────────────────────────────────────
  var trackedForms = new WeakSet();
  var formStartTimes = new WeakMap();

  function observeForm(formEl) {
    if (trackedForms.has(formEl)) return;
    trackedForms.add(formEl);

    // form_view: when the form becomes visible
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var ev = buildFormBase(formEl);
            ev.type = "form_view";
            send(ev);
          }
        });
      }, { threshold: 0.1 }).observe(formEl);
    }

    // field focus → form_start
    var fields = formEl.querySelectorAll("input, textarea, select");
    Array.prototype.forEach.call(fields, function (field) {
      field.addEventListener("focus", function () {
        if (!formStartTimes.has(formEl)) {
          formStartTimes.set(formEl, Date.now());
          var ev = buildFormBase(formEl);
          ev.type = "form_start";
          send(ev);
        }
      });

      // field_interaction
      field.addEventListener("focus", function () {
        var ev = buildFormBase(formEl);
        ev.type = "field_interaction";
        ev.field = field.getAttribute("name") || field.getAttribute("id") || field.type || "field";
        ev.interaction = "focus";
        send(ev);
      });

      field.addEventListener("change", function () {
        var ev = buildFormBase(formEl);
        ev.type = "field_interaction";
        ev.field = field.getAttribute("name") || field.getAttribute("id") || field.type || "field";
        ev.interaction = "change";
        send(ev);
      });
    });

    // submit
    formEl.addEventListener("submit", function (e) {
      var ev = buildFormBase(formEl);
      ev.type = "form_submit";
      ev.valid = typeof formEl.checkValidity === "function" ? formEl.checkValidity() : true;
      // Capture all form field values
      var fieldData = {};
      var submitFields = formEl.querySelectorAll("input, textarea, select");
      Array.prototype.forEach.call(submitFields, function (f) {
        var name = f.getAttribute("name") || f.getAttribute("id") || f.type || "field";
        if (f.type === "password") {
          fieldData[name] = "***";
        } else if (f.type === "email") {
          fieldData[name] = f.value;
        } else if (f.tagName === "SELECT") {
          fieldData[name] = f.options[f.selectedIndex] ? f.options[f.selectedIndex].text : f.value;
        } else if (f.type === "checkbox" || f.type === "radio") {
          fieldData[name] = f.checked;
        } else {
          fieldData[name] = f.value;
        }
      });
      ev.properties = ev.properties || {};
      ev.properties.fields = fieldData;
      send(ev);
    });
  }

  // ── Auto-Track: CTA Clicks ──────────────────────────────────
  document.addEventListener("click", function (e) {
    if (!AUTO_TRACK) return;
    var el = e.target;

    // Walk up to find a clickable element
    var clickEl = el.closest("a, button, [data-trell-track]");
    if (!clickEl) return;

    // Skip if inside a form (handled by form logic)
    if (clickEl.closest("form")) return;

    var name = clickEl.getAttribute("data-trell-track") || eventNameFor(clickEl);
    var ev = buildBase();
    ev.type = "cta_click";
    ev.cta = name;
    ev.label = (clickEl.textContent || "").trim().slice(0, 100) || undefined;
    ev.href = clickEl.getAttribute("href") || undefined;
    send(ev);
  }, true);

  // ── Auto-Track: Scroll Depth ────────────────────────────────
  if (AUTO_TRACK) {
    var scrollMilestones = { 25: false, 50: false, 75: false, 100: false };
    var maxScrollDepth = 0;
    var scrollThrottle = null;

    function getScrollDepth() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (scrollHeight <= 0) return 0;
      return Math.min(Math.round((scrollTop / scrollHeight) * 100), 100);
    }

    function checkScrollDepth() {
      var depth = getScrollDepth();
      if (depth > maxScrollDepth) maxScrollDepth = depth;

      Object.keys(scrollMilestones).forEach(function (milestone) {
        var m = Number(milestone);
        if (!scrollMilestones[m] && depth >= m) {
          scrollMilestones[m] = true;
          var ev = buildBase();
          ev.type = "scroll_depth";
          ev.properties = { depth: m, maxDepth: 100 };
          send(ev);
        }
      });
    }

    window.addEventListener("scroll", function () {
      if (scrollThrottle) return;
      scrollThrottle = setTimeout(function () {
        scrollThrottle = null;
        checkScrollDepth();
      }, 200);
    }, { passive: true });
  }

  // ── Auto-Track: Time on Page ────────────────────────────────
  if (AUTO_TRACK) {
    var pageLoadTime = Date.now();

    function trackPageExit() {
      var durationMs = Date.now() - pageLoadTime;
      var ev = buildBase();
      ev.type = "page_exit";
      ev.properties = { durationMs: durationMs, maxScrollDepth: typeof maxScrollDepth !== "undefined" ? maxScrollDepth : 0 };
      try {
        var blob = new Blob([JSON.stringify(ev)], { type: "application/json" });
        navigator.sendBeacon(INGEST_URL, blob);
      } catch (_) { send(ev); }
    }

    window.addEventListener("beforeunload", trackPageExit);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") trackPageExit();
    });
  }

  // ── Auto-Track: Form Abandon (beforeunload) ─────────────────
  window.addEventListener("beforeunload", function () {
    var forms = document.querySelectorAll("form[data-trell-form-id], form[id]");
    Array.prototype.forEach.call(forms, function (formEl) {
      if (!formStartTimes.has(formEl)) return;
      // Check if any field was filled
      var fields = formEl.querySelectorAll("input, textarea, select");
      var hasData = Array.prototype.some.call(fields, function (f) { return f.value; });
      if (hasData) {
        var ev = buildFormBase(formEl);
        ev.type = "form_abandon";
        ev.durationMs = Date.now() - formStartTimes.get(formEl);
        // Use sendBeacon for reliability during page unload
        try {
          var blob = new Blob([JSON.stringify(ev)], { type: "application/json" });
          navigator.sendBeacon(INGEST_URL, blob);
        } catch (_) { send(ev); }
      }
    });
  });

  // ── Form Discovery ──────────────────────────────────────────
  function discoverForms() {
    var forms = document.querySelectorAll("form");
    Array.prototype.forEach.call(forms, observeForm);
  }

  // ── Public API ──────────────────────────────────────────────
  window.trell = {
    track: function (type, props) {
      var ev = buildBase();
      ev.type = type;
      if (props) {
        Object.keys(props).forEach(function (k) {
          if (k === "form") {
            ev.form = props[k];
          } else {
            ev.properties[k] = props[k];
          }
        });
      }
      send(ev);
    },
  };

  // ── Init ────────────────────────────────────────────────────
  trackPageview();
  if (AUTO_TRACK) {
    discoverForms();
    // Re-discover forms on DOM changes
    if ("MutationObserver" in window) {
      new MutationObserver(discoverForms).observe(document.documentElement, { childList: true, subtree: true });
    }
  }
})();
