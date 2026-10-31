// Service worker para abrir la app sin conexión (NF-14).
// El tablero y las fotos ya viven en el celular (localStorage e IndexedDB):
// alcanza con guardar las páginas y los archivos de la app.
// Subir fotos, entregar y la revisión siguen necesitando internet.
const CACHE = "bingo-v3";
const PAGINAS = ["/", "/tablero", "/finalizar", "/revision", "/resultado"];

// Archivos de la app que aparecen en el HTML: código, estilos y fuentes
function archivosDelHtml(html) {
  const encontrados = html.match(/\/_next\/(?:static\/[^"'\s)]+|image\?[^"'\s)]+)/g) ?? [];
  return [...new Set(encontrados.map((ruta) => ruta.replaceAll("&amp;", "&")))];
}

// Al instalar se guardan las 5 páginas y sus archivos, así abre sin conexión
// aunque nunca se haya entrado a esa página. Si algo falla, se sigue igual
self.addEventListener("install", (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PAGINAS.map(async (pagina) => {
      try {
        const respuesta = await fetch(pagina, { cache: "no-store" });
        if (!respuesta.ok) return;
        await cache.put(pagina, respuesta.clone());
        const archivos = archivosDelHtml(await respuesta.text());
        await Promise.all(archivos.map((archivo) => cache.add(archivo).catch(() => { })));
      } catch {
        // Sin conexión al instalar: se guardarán al usarse
      }
    }));
    await self.skipWaiting();
  })());
});

// Borra los caches de versiones anteriores
self.addEventListener("activate", (evento) => {
  evento.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter((nombre) => nombre !== CACHE).map((nombre) => caches.delete(nombre)));
    await self.clients.claim();
  })());
});

// Página: primero la red (siempre la última versión); sin conexión, la guardada
async function pagina(pedido) {
  const cache = await caches.open(CACHE);
  const clave = new URL(pedido.url).pathname;
  try {
    const respuesta = await fetch(pedido);
    if (respuesta.ok) cache.put(clave, respuesta.clone());
    return respuesta;
  } catch {
    return (await cache.match(clave)) ?? (await cache.match("/")) ?? Response.error();
  }
}

// Archivo de la app con hash en el nombre (no cambia nunca): primero el guardado
async function archivo(pedido) {
  const cache = await caches.open(CACHE);
  const guardado = await cache.match(pedido);
  if (guardado) return guardado;
  const respuesta = await fetch(pedido);
  if (respuesta.ok) cache.put(pedido, respuesta.clone());
  return respuesta;
}

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  const url = new URL(pedido.url);
  // Solo lecturas de este sitio. Quedan afuera la API, las subidas, las fotos de
  // Supabase y los pedidos internos de navegación de Next (RSC): si fallan sin
  // conexión, Next navega de forma normal y se sirve la página guardada
  if (pedido.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || pedido.headers.has("RSC") || url.searchParams.has("_rsc")) return;

  if (pedido.mode === "navigate") {
    evento.respondWith(pagina(pedido));
  } else if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/_next/image")
    || url.pathname === "/icon.png" || url.pathname === "/apple-icon.png") {
    evento.respondWith(archivo(pedido));
  }
});
