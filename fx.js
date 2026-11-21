/* Sfondo animato a canvas: scariche di energia lungo tracce tecnologiche.
   Disegna solo le scariche attive (poche per volta), a ~30 fps, in pausa se la scheda è nascosta. */
(function () {
  "use strict";
  var host = document.querySelector(".bg-fx");
  if (!host) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { host.style.display = "none"; return; }
  var cBase = document.getElementById("fxBase"), cLive = document.getElementById("fxLive");
  if (!cBase || !cLive || !cBase.getContext) return;
  var xb = cBase.getContext("2d"), xl = cLive.getContext("2d");
  var VW = 1600, VH = 900;

  /* ---- generatore pseudo-casuale (stesso risultato a ogni caricamento) ---- */
  var seed = 23;
  function R() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function ri(a, b) { return Math.floor(a + R() * (b - a + 1)); }
  function sgn() { return R() < 0.5 ? -1 : 1; }

  function traceH() {
    var y = ri(40, 860), x = -30, p = [[x, y]];
    while (x < VW + 30) {
      x += ri(110, 330); p.push([x, y]);
      if (R() < 0.85) { var d = ri(40, 130) * sgn(); if (y + d < 30 || y + d > 870) d = -d; x += Math.abs(d); y += d; p.push([x, y]); }
    }
    return p;
  }
  function traceV() {
    var x = ri(60, 1540), y = -30, p = [[x, y]];
    while (y < VH + 30) {
      y += ri(90, 250); p.push([x, y]);
      if (R() < 0.85) { var d = ri(40, 120) * sgn(); if (x + d < 30 || x + d > VW - 30) d = -d; y += Math.abs(d); x += d; p.push([x, y]); }
    }
    return p;
  }

  var traces = [], i, j;
  var raw = [];
  for (i = 0; i < 22; i++) raw.push(traceH());
  for (i = 0; i < 10; i++) raw.push(traceV());
  for (i = raw.length - 1; i > 0; i--) { j = Math.floor(R() * (i + 1)); var tmp = raw[i]; raw[i] = raw[j]; raw[j] = tmp; }
  var CYCLES = [23, 24, 25, 26, 27, 28];
  raw.forEach(function (p, idx) {
    if (R() < 0.45) p = p.slice().reverse();
    var cum = [0], tot = 0;
    for (var k = 1; k < p.length; k++) { tot += Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]); cum.push(tot); }
    traces.push({ pts: p, cf: cum.map(function (v) { return v / tot; }), d: CYCLES[Math.floor(R() * CYCLES.length)], ph: R(), c: idx % 4 });
  });

  /* ---- palette per tema ---- */
  var PAL = {
    dark:  { core: ["#ffffff", "#ffffff", "#ffd9b8", "#ffffff"], glow: ["#7fd0ff", "#00a3ff", "#ff6b00", "#7fd0ff"], base: "#8fcfff", baseA: 0.03, a: { halo: 0.09, tail: 0.24, glow: 0.5, core: 0.95 } },
    light: { core: ["#0a3a8a", "#0a3a8a", "#a63a00", "#0a3a8a"], glow: ["#0a84e0", "#0077cc", "#ff6b00", "#0a84e0"], base: "#0a3a8a", baseA: 0.05, a: { halo: 0.09, tail: 0.3, glow: 0.55, core: 0.9 } }
  };
  var pal = PAL.dark;
  function readTheme() { pal = document.documentElement.getAttribute("data-theme") === "light" ? PAL.light : PAL.dark; }

  /* ---- dimensioni (ricostruite solo se cambia davvero la larghezza o l'altezza cambia molto) ---- */
  var cw = 0, ch = 0, k = 1, ox = 0, oy = 0, lastW = 0, lastH = 0, nTr = 32;
  function size(force) {
    var w = window.innerWidth, h = window.innerHeight;
    if (!force && w === lastW && Math.abs(h - lastH) < 150) return;
    lastW = w; lastH = h;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    cw = Math.round(w * dpr); ch = Math.round(h * dpr);
    cBase.width = cLive.width = cw; cBase.height = cLive.height = ch;
    k = Math.max(cw / VW, ch / VH); ox = (cw - VW * k) / 2; oy = (ch - VH * k) / 2;
    nTr = w <= 700 ? 16 : 32;
    drawBase(); drewLast = false; drawLive(performance.now());
  }

  function drawBase() {
    xb.clearRect(0, 0, cw, ch);
    xb.lineCap = "round"; xb.lineJoin = "round";
    xb.strokeStyle = pal.base; xb.globalAlpha = pal.baseA; xb.lineWidth = Math.max(1, k);
    for (var t = 0; t < nTr; t++) {
      var p = traces[t].pts; xb.beginPath();
      for (var q = 0; q < p.length; q++) { var X = ox + p[q][0] * k, Y = oy + p[q][1] * k; if (q) xb.lineTo(X, Y); else xb.moveTo(X, Y); }
      xb.stroke();
    }
    xb.globalAlpha = 1;
  }

  /* ---- profilo di una scarica: due passaggi (forte, poi più debole), poi lunga pausa ---- */
  function lerp(frames, f) {
    for (var q = 0; q < frames.length - 1; q++) {
      var a = frames[q], b = frames[q + 1];
      if (f >= a[0] && f <= b[0]) return a[1] + (b[1] - a[1]) * ((f - a[0]) / (b[0] - a[0]));
    }
    return 0;
  }
  var KA = [[0, 0], [0.005, 0.8], [0.03, 0.35], [0.045, 0.8], [0.06, 0.7], [0.066, 0]];
  var KB = [[0.10, 0], [0.104, 0.5], [0.13, 0.2], [0.16, 0.45], [0.166, 0]];
  function activity(f) {
    if (f < 0.066) return { op: lerp(KA, f), p: Math.min(f / 0.06, 1) };
    if (f >= 0.10 && f < 0.166) return { op: lerp(KB, f), p: Math.min((f - 0.10) / 0.06, 1) };
    return null;
  }

  function strokeRange(tr, a, b) {
    if (a < 0) a = 0; if (b > 1) b = 1; if (b <= a) return;
    var pts = tr.pts, cf = tr.cf, started = false;
    xl.beginPath();
    for (var q = 0; q < pts.length - 1; q++) {
      var s0 = cf[q], s1 = cf[q + 1];
      if (s1 < a) continue; if (s0 > b) break;
      var t0 = Math.max(a, s0), t1 = Math.min(b, s1), span = s1 - s0;
      var u0 = (t0 - s0) / span, u1 = (t1 - s0) / span;
      var x0 = pts[q][0] + (pts[q + 1][0] - pts[q][0]) * u0, y0 = pts[q][1] + (pts[q + 1][1] - pts[q][1]) * u0;
      var x1 = pts[q][0] + (pts[q + 1][0] - pts[q][0]) * u1, y1 = pts[q][1] + (pts[q + 1][1] - pts[q][1]) * u1;
      if (!started) { xl.moveTo(ox + x0 * k, oy + y0 * k); started = true; }
      xl.lineTo(ox + x1 * k, oy + y1 * k);
    }
    if (started) xl.stroke();
  }

  /* strati della cometa: alone morbido, coda che sfuma, bagliore della testa, nucleo */
  var LAYERS = [
    { n: "halo", L: 0.28, w: 16, col: "glow", steps: [0.35, 0.7, 1] },
    { n: "tail", L: 0.20, w: 4.5, col: "glow", steps: [0.25, 0.5, 0.75, 1] },
    { n: "glow", L: 0.05, w: 10, col: "glow", steps: [1] },
    { n: "core", L: 0.06, w: 1.8, col: "core", steps: [1] }
  ];
  var drewLast = false;
  function drawLive(now) {
    var tsec = now / 1000, active = [], t;
    for (t = 0; t < nTr; t++) {
      var tr = traces[t], f = ((tsec / tr.d) + tr.ph) % 1, ac = activity(f);
      if (ac && ac.op > 0.01) active.push([tr, ac]);
    }
    if (!active.length) { if (drewLast) { xl.clearRect(0, 0, cw, ch); drewLast = false; } return; }
    xl.clearRect(0, 0, cw, ch);
    xl.lineCap = "round"; xl.lineJoin = "round";
    for (var li = 0; li < LAYERS.length; li++) {
      var ly = LAYERS[li];
      xl.lineWidth = ly.w * k;
      for (var a = 0; a < active.length; a++) {
        var tr2 = active[a][0], ac2 = active[a][1], head = ac2.p * 1.28;
        xl.strokeStyle = pal[ly.col][tr2.c];
        var n = ly.steps.length;
        for (var s = 0; s < n; s++) {
          xl.globalAlpha = ac2.op * pal.a[ly.n] * ly.steps[s];
          strokeRange(tr2, head - ly.L + (ly.L / n) * s, head - ly.L + (ly.L / n) * (s + 1));
        }
      }
    }
    xl.globalAlpha = 1; drewLast = true;
  }

  /* ---- ciclo di animazione (~30 fps, in pausa se la scheda è nascosta) ---- */
  var raf = 0, last = 0;
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (ts - last < 32) return;
    last = ts; drawLive(ts);
  }
  function start() { if (!raf) raf = requestAnimationFrame(frame); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });

  var rs = 0;
  window.addEventListener("resize", function () { if (rs) return; rs = requestAnimationFrame(function () { rs = 0; size(false); }); });
  window.addEventListener("themechange", function () { readTheme(); drawBase(); drewLast = false; drawLive(performance.now()); });

  readTheme(); size(true); start();
})();
