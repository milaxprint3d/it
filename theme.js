/* Modalità scura / chiara: scelta salvata solo sul dispositivo (localStorage, chiave "theme") */
(function () {
  var root = document.documentElement;
  function saved() {
    try { var t = localStorage.getItem("theme"); return (t === "light" || t === "dark") ? t : null; }
    catch (e) { return null; }
  }
  function apply(t) {
    root.setAttribute("data-theme", t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", t === "light" ? "#f3f7ff" : "#070b16");
    var b = document.getElementById("themeToggle");
    if (b) {
      var light = t === "light";
      var label = light ? "Passa alla modalità scura" : "Passa alla modalità chiara";
      b.setAttribute("aria-pressed", String(light));
      b.setAttribute("aria-label", label);
      b.title = label;
    }
    try { window.dispatchEvent(new Event("themechange")); } catch (e) {}
  }
  apply(saved() || "dark");
  document.addEventListener("DOMContentLoaded", function () {
    apply(root.getAttribute("data-theme") || "dark");
    var b = document.getElementById("themeToggle");
    if (b) b.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      apply(next);
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  });
})();
