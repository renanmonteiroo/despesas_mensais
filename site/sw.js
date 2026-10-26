/* =========================================================
   FinControl · Service Worker (PWA) — v1.1
   ---------------------------------------------------------
   • App shell (HTML/CSS/JS/ícones) em cache → abre offline
   • Taxas do BCB: rede com fallback de cache
   • Firebase (Auth/Firestore): SEM cache (sempre rede)
   Para publicar alterações: versione a constante V abaixo.
   ========================================================= */
var V = "fincontrol-v3";

var PRECACHE = [
  "./",
  "index.html",
  "css/styles.css",
  "js/config.js",
  "js/store.js",
  "js/charts.js",
  "js/exemplo.js",
  "js/app.js",
  "assets/favicon.svg",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon-maskable-512.png",
  "manifest.webmanifest"
];

/* hosts que nunca podem ter cache (tempo real / sessão) */
function ehTempoReal(url) {
  return /firestore\.googleapis\.com|identitytoolkit|securetoken|firebaseinstallations|firebaseio\.com/.test(url.host);
}

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(V).then(function (c) {
      // cache: "no-cache" força revalidação — evita congelar uma versão velha
      // que o CDN ainda estivesse servindo durante a propagação de um deploy.
      return Promise.all(PRECACHE.map(function (u) {
        return fetch(new Request(u, { cache: "no-cache", credentials: "same-origin" }))
          .then(function (r) {
            if (!r.ok) throw new Error("precache falhou: " + u + " (" + r.status + ")");
            return c.put(u, r);
          });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (chaves) {
      return Promise.all(chaves.map(function (k) { return k === V ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (ehTempoReal(url)) return; // Auth/Firestore: sempre rede

  // 1) API do Banco Central: rede primeiro, cache do dia como reserva
  if (url.hostname === "api.bcb.gov.br") {
    e.respondWith(
      fetch(req).then(function (resp) {
        if (resp && resp.ok) {
          var copia = resp.clone();
          caches.open(V).then(function (c) { c.put(req, copia); });
        }
        return resp;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || Response.error(); });
      })
    );
    return;
  }

  // 2) Navegação do app (SPA): rede primeiro, shell offline como reserva
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (resp) {
        var copia = resp.clone();
        caches.open(V).then(function (c) { c.put("index.html", copia); });
        return resp;
      }).catch(function () {
        return caches.match("index.html").then(function (hit) { return hit || caches.match("./"); });
      })
    );
    return;
  }

  // 3) Estáticos e CDNs (SDK do Firebase, Chart.js, fontes): cache primeiro
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (resp) {
        if (resp && resp.ok && (resp.type === "basic" || resp.type === "cors")) {
          var copia = resp.clone();
          caches.open(V).then(function (c) { c.put(req, copia); });
        }
        return resp;
      });
    })
  );
});
