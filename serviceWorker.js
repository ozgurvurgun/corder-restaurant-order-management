const staticFikrininYeri = "fikrinin-yeri-site-v1";
const assets = [
  "https://site.com/login",
  "https://site.com/receipt",
  "https://site.com/table-operations",
  "https://site.com/tables",
  "https://site.com/terminal-cart",
  "https://site.com/terminal-menu",
  "https://site.com/terminal-users",
  "https://site.com/public/js/libs/RequestHandler.js",
  "https://site.com/public/js/modules/Cart.js",
  "https://site.com/public/js/modules/FileManager.js",
  "https://site.com/public/js/modules/Formatter.js",
  "https://site.com/public/js/modules/LoginOperations.js",
  "https://site.com/public/js/modules/TableManagement.js",
  "https://site.com/public/js/modules/UserManagement.js",
  "https://site.com/public/js/pages/terminal/Login.js",
  "https://site.com/public/js/pages/terminal/Receipt.js",
  "https://site.com/public/js/pages/terminal/TableOperations.js",
  "https://site.com/public/js/pages/terminal/Tables.js",
  "https://site.com/public/js/pages/terminal/TerminalCart.js",
  "https://site.com/public/js/pages/terminal/TerminalMenu.js",
  "https://site.com/public/js/pages/terminal/TerminalUsers.js",
  "https://site.com/public/js/TerminalMain.js",
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
