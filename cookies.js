/*
 * Gestor de consentimiento de cookies — Rietmann Ibérica
 *
 * Uso en cada página (antes de </body>):
 *   <link rel="stylesheet" href="cookies.css">
 *   <script src="cookies.js" defer></script>
 *
 * Cualquier elemento con el atributo data-cookie-settings abre el panel de configuración.
 *
 * Para que un servicio externo solo se cargue con consentimiento:
 *   - Scripts:  <script type="text/plain" data-cookie-category="analytics" data-src="https://..."></script>
 *               (o con el código dentro del script en lugar de data-src)
 *   - Iframes (Google Maps, YouTube…):
 *               <iframe data-cookie-category="marketing" data-src="https://..." ...></iframe>
 * Categorías disponibles: "analytics" y "marketing".
 * Si se añade un servicio, hay que incluir sus cookies en la tabla de politica-cookies.html.
 */
(function () {
  "use strict";

  var COOKIE_NAME = "rietmann_consent";
  var DURATION_DAYS = 395; // 13 meses
  var POLICY_URL = "politica-cookies.html";

  function readConsent() {
    var m = document.cookie.match(new RegExp("(?:^|; )" + COOKIE_NAME + "=([^;]*)"));
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { return null; }
  }

  function writeConsent(c) {
    var data = { analytics: !!c.analytics, marketing: !!c.marketing, fecha: new Date().toISOString() };
    var d = new Date();
    d.setTime(d.getTime() + DURATION_DAYS * 864e5);
    document.cookie = COOKIE_NAME + "=" + encodeURIComponent(JSON.stringify(data)) +
      "; expires=" + d.toUTCString() + "; path=/; SameSite=Lax" +
      (location.protocol === "https:" ? "; Secure" : "");
    return data;
  }

  // Borra cookies de analítica conocidas cuando se retira el consentimiento
  function clearAnalyticsCookies() {
    var host = location.hostname.replace(/^www\./, "");
    document.cookie.split("; ").forEach(function (c) {
      var name = c.split("=")[0];
      if (/^(_ga|_gid|_gat|_pk_)/.test(name)) {
        [location.hostname, "." + host, ""].forEach(function (dom) {
          document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + (dom ? "; domain=" + dom : "");
        });
      }
    });
  }

  function activate(consent) {
    document.querySelectorAll('script[type="text/plain"][data-cookie-category]').forEach(function (s) {
      if (!consent[s.getAttribute("data-cookie-category")] || s.getAttribute("data-activated")) return;
      var n = document.createElement("script");
      Array.prototype.forEach.call(s.attributes, function (a) {
        if (["type", "data-cookie-category", "data-src", "data-activated"].indexOf(a.name) === -1) n.setAttribute(a.name, a.value);
      });
      if (s.getAttribute("data-src")) n.src = s.getAttribute("data-src"); else n.text = s.text;
      s.setAttribute("data-activated", "1");
      s.parentNode.insertBefore(n, s.nextSibling);
    });

    document.querySelectorAll("iframe[data-cookie-category][data-src]").forEach(function (f) {
      var ok = consent && consent[f.getAttribute("data-cookie-category")];
      var ph = f.previousElementSibling;
      var hasPh = ph && ph.classList.contains("rc-placeholder");
      if (ok) {
        if (!f.src) f.src = f.getAttribute("data-src");
        f.style.display = "";
        if (hasPh) ph.remove();
      } else if (!hasPh) {
        f.style.display = "none";
        var p = document.createElement("div");
        p.className = "rc-placeholder";
        p.innerHTML = 'Este contenido usa cookies de terceros. <button type="button" class="btn-link" data-cookie-settings>&nbsp;Configurar cookies</button>';
        f.parentNode.insertBefore(p, f);
      }
    });
  }

  var bannerEl = null, overlayEl = null, lastFocus = null;

  function save(c) {
    var previous = readConsent();
    var data = writeConsent(c);
    closeAll();
    // Si se retira un consentimiento ya dado, se limpian cookies y se recarga para descargar los servicios
    if (previous && ((previous.analytics && !data.analytics) || (previous.marketing && !data.marketing))) {
      clearAnalyticsCookies();
      location.reload();
      return;
    }
    activate(data);
  }

  function closeAll() {
    if (bannerEl) { bannerEl.remove(); bannerEl = null; }
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    document.removeEventListener("keydown", onKey);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function showBanner() {
    if (bannerEl) return;
    bannerEl = document.createElement("div");
    bannerEl.className = "rc-banner";
    bannerEl.setAttribute("role", "region");
    bannerEl.setAttribute("aria-label", "Aviso de cookies");
    bannerEl.innerHTML =
      "<h2>Utilizamos cookies</h2>" +
      "<p>Usamos cookies técnicas necesarias para el funcionamiento de la web y, solo si nos das tu consentimiento, " +
      "cookies de análisis y de terceros. Puedes aceptarlas, rechazarlas o configurarlas. " +
      'Más información en nuestra <a href="' + POLICY_URL + '">Política de Cookies</a>.</p>' +
      '<div class="rc-actions">' +
      '<button type="button" class="rc-btn" data-rc="reject">Rechazar</button>' +
      '<button type="button" class="rc-btn" data-rc="config">Configurar</button>' +
      '<button type="button" class="rc-btn" data-rc="accept">Aceptar todas</button>' +
      "</div>";
    bannerEl.addEventListener("click", function (e) {
      var a = e.target.getAttribute("data-rc");
      if (a === "reject") save({ analytics: false, marketing: false });
      if (a === "accept") save({ analytics: true, marketing: true });
      if (a === "config") openPanel();
    });
    document.body.appendChild(bannerEl);
  }

  function category(id, title, text, checked) {
    return '<div class="rc-cat"><div class="rc-cat-head"><strong id="rc-l-' + id + '">' + title + "</strong>" +
      '<label class="rc-switch"><input type="checkbox" id="rc-' + id + '" aria-labelledby="rc-l-' + id + '"' +
      (checked ? " checked" : "") + '><span class="rc-slider"></span></label></div><p>' + text + "</p></div>";
  }

  function onKey(e) { if (e.key === "Escape" && overlayEl && readConsent()) closeAll(); }

  function openPanel() {
    lastFocus = document.activeElement;
    if (bannerEl) { bannerEl.remove(); bannerEl = null; }
    if (overlayEl) return;
    var c = readConsent() || { analytics: false, marketing: false };
    overlayEl = document.createElement("div");
    overlayEl.className = "rc-overlay";
    overlayEl.innerHTML =
      '<div class="rc-modal" role="dialog" aria-modal="true" aria-labelledby="rc-title">' +
      '<h2 id="rc-title">Configuración de cookies</h2>' +
      "<p>Elige qué cookies aceptas. Puedes cambiar tu elección en cualquier momento desde el enlace " +
      "«Configurar cookies» del pie de página.</p>" +
      '<div class="rc-cat"><div class="rc-cat-head"><strong>Técnicas</strong><span class="rc-always">Siempre activas</span></div>' +
      "<p>Necesarias para que la web funcione y para recordar tu elección sobre las cookies. No requieren consentimiento.</p></div>" +
      category("analytics", "Analíticas", "Nos permiten medir de forma estadística las visitas y el uso de la web para mejorarla.", c.analytics) +
      category("marketing", "Marketing y terceros", "Las instalan servicios externos integrados en la web (mapas, vídeos, redes sociales) y pueden usarse para mostrar publicidad personalizada.", c.marketing) +
      '<div class="rc-actions">' +
      '<button type="button" class="rc-btn" data-rc="reject">Rechazar todas</button>' +
      '<button type="button" class="rc-btn" data-rc="save">Guardar selección</button>' +
      '<button type="button" class="rc-btn" data-rc="accept">Aceptar todas</button>' +
      "</div></div>";
    overlayEl.addEventListener("click", function (e) {
      var a = e.target.getAttribute("data-rc");
      if (a === "reject") save({ analytics: false, marketing: false });
      if (a === "accept") save({ analytics: true, marketing: true });
      if (a === "save") save({
        analytics: overlayEl.querySelector("#rc-analytics").checked,
        marketing: overlayEl.querySelector("#rc-marketing").checked
      });
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlayEl);
    overlayEl.querySelector("button").focus();
  }

  window.RietmannCookies = { open: openPanel, consent: readConsent };

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-cookie-settings]") : null;
    if (t) { e.preventDefault(); openPanel(); }
  });

  function init() {
    var c = readConsent();
    activate(c || { analytics: false, marketing: false });
    if (!c) showBanner();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
