const staticFikrininYeri = "fikrinin-yeri-site-v1";

const assets = [
  "http://localhost/corder/login",
  "http://localhost/corder/receipt",
  "http://localhost/corder/table-operations",
  "http://localhost/corder/tables",
  "http://localhost/corder/terminal-cart",
  "http://localhost/corder/terminal-menu",
  "http://localhost/corder/terminal-users",
  "http://localhost/corder/public/js/libs/RequestHandler.js",
  "http://localhost/corder/public/js/modules/Cart.js",
  "http://localhost/corder/public/js/modules/FileManager.js",
  "http://localhost/corder/public/js/modules/Formatter.js",
  "http://localhost/corder/public/js/modules/LoginOperations.js",
  "http://localhost/corder/public/js/modules/TableManagement.js",
  "http://localhost/corder/public/js/modules/UserManagement.js",
  "http://localhost/corder/public/js/pages/terminal/Login.js",
  "http://localhost/corder/public/js/pages/terminal/Receipt.js",
  "http://localhost/corder/public/js/pages/terminal/TableOperations.js",
  "http://localhost/corder/public/js/pages/terminal/Tables.js",
  "http://localhost/corder/public/js/pages/terminal/TerminalCart.js",
  "http://localhost/corder/public/js/pages/terminal/TerminalMenu.js",
  "http://localhost/corder/public/js/pages/terminal/TerminalUsers.js",
  "http://localhost/corder/public/js/TerminalMain.js",
];

self.addEventListener("install", (installEvent) => {
  installEvent.waitUntil(
    caches.open(staticFikrininYeri).then((cache) => {
      return cache.addAll(assets);
    })
  );
});

self.addEventListener("fetch", (fetchEvent) => {
  fetchEvent.respondWith(
    caches.match(fetchEvent.request).then((cachedResponse) => {
      return cachedResponse || fetch(fetchEvent.request);
    })
  );
});
