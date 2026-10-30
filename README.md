# 🎃 Bingo de Halloween

> Encontrá a los 9 disfrazados… si te animás.

App web para jugar al bingo de disfraces desde el celular en una fiesta de Halloween. Cada jugador recibe un tablero de 3×3 con categorías de disfraces, saca una foto de alguien disfrazado en cada celda y, al final, el grupo revisa las fotos de todos y decide quién ganó.

**App:** [bingo-halloween.vercel.app](https://bingo-halloween.vercel.app) · **Versión:** 1.0.0

Pensada para un grupo cerrado de amigos y para usarse durante el fin de semana de Halloween: no tiene login ni base de datos.

---

## Cómo se juega

1. **Entrar con el nombre.** No hay cuenta ni contraseña: el celular recibe un código de recuperación que conviene guardar (por ejemplo, mandándoselo por WhatsApp).
2. **Completar el tablero.** Cada jugador tiene 9 categorías al azar (siempre las mismas para su código). Tocar una celda abre la cámara o la galería; se pueden sacar varias fotos por celda.
3. **Finalizar.** Con las 9 celdas completas aparece **¡Bingo! Finalizar**: se elige la mejor foto de cada celda y se entrega el tablero.
4. **Revisión del grupo.** Se juntan y, desde un solo dispositivo, abren `/revision`: marcan cada foto como **Vale** o **No vale**.
5. **Ganador.** Gana quien tenga **más fotos válidas**. Si hay empate, gana quien **subió su última foto antes** (según la hora del servidor, no la del celular).

## Funciones

- **Tablero determinístico:** 9 de 21 categorías, elegidas y ordenadas con el código del jugador como semilla.
- **Fotos sin perder nada:** se comprimen en el celular (1600 px, JPEG), se ven al instante y se guardan en el dispositivo hasta que terminan de subir. Si falla la subida, quedan pendientes y se reintentan solas al volver la conexión.
- **Borrar:** mantener apretada una celda borra su última foto, con confirmación. También se puede borrar todo el tablero (las categorías se mantienen).
- **Cambiar una categoría por otra al azar:** hasta 2 veces, sin deshacer.
- **Respaldo:** un texto con el código, las fotos y los cambios para recuperar todo en otro celular.
- **Cerrar y reabrir:** al entregar, el tablero se bloquea; se puede reabrir si alguien se equivocó.
- **Sin conexión:** la app abre y muestra el tablero y las fotos guardadas sin internet (subir, entregar y revisar sí lo necesitan).

## Stack

| Área | Tecnología |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Cache Components) + React 19 + TypeScript |
| Estilos | CSS Modules y variables CSS con la paleta del póster |
| Tipografías | Luckiest Guy (títulos) y Nunito (texto), con `next/font` |
| Íconos | [lucide-react](https://lucide.dev) |
| Archivos | [UploadThing](https://uploadthing.com): fotos subidas directo desde el navegador y entregas en JSON |
| Datos locales | `localStorage` (jugador, elección, cambios, votos) e IndexedDB (fotos) |
| Sin conexión | Service worker propio (`public/sw.js`) |
| Deploy | [Vercel](https://vercel.com), desde la rama `main` |

## Correrlo localmente

Requisitos: Node.js 20 o superior y una app de UploadThing.

```bash
npm install
```

Crear un archivo `.env.local` con el token de UploadThing (se saca del panel de UploadThing, en *API Keys*):

```bash
UPLOADTHING_TOKEN=...
```

Después:

```bash
npm run dev      # desarrollo en http://localhost:3000
npm run build    # build de producción
npm start        # sirve el build
npm run lint     # ESLint
```

> El service worker solo se registra en producción (`npm run build && npm start` o en Vercel). En desarrollo, el indicador de Next tapa el botón de menú arriba a la derecha; en producción no aparece.

## Estructura

```
src/
├── app/
│   ├── page.tsx              # Inicio: nombre, código y recuperación
│   ├── tablero/              # El tablero del jugador
│   ├── finalizar/            # Elección de la foto final de cada celda
│   ├── revision/             # Revisión del grupo y ganador
│   └── api/
│       ├── uploadthing/      # Firma las subidas de fotos (UploadThing)
│       ├── fotos/            # DELETE: borra fotos de UploadThing
│       └── entregas/         # POST/DELETE/GET: entregas para la revisión
├── components/               # Pantallas y componentes (ui/ tiene los componentes base)
├── hooks/                    # useFotos (fotos y subidas) y useAlmacen (localStorage)
└── lib/                      # Lógica: tablero, jugador, fotos, respaldo, entregas, votos
public/
├── Bingo Halloween.jpg       # El póster del tablero
└── sw.js                     # Service worker (sin conexión)
docs/
├── Bingo_Halloween_Documento_del_Proyecto.pdf
└── Cambios_respecto_del_documento.md
```

## Dónde vive cada dato

No hay base de datos: el estado vive en el celular de cada jugador y en UploadThing.

| Dato | Dónde |
|---|---|
| Jugador (código y nombre) | `localStorage` · `bingo-halloween:jugador` |
| Fotos (blob, estado, URL, horas) | IndexedDB · base `bingo-halloween`, almacén `fotos` |
| Elección de fotos finales | `localStorage` · `bingo-halloween:eleccion:<código>` |
| Cambios de categoría | `localStorage` · `bingo-halloween:cambios:<código>` |
| Votos de la revisión | `localStorage` del dispositivo que revisa · `bingo-halloween:votos` |
| Fotos subidas | UploadThing · `<código>__<categoría>__<id>.jpg` |
| Entregas | UploadThing · `entrega__<código>.json` |

## Limitaciones conocidas

- La elección de fotos no viaja en el respaldo: si alguien cambia de celular después de entregar, tiene que volver a elegir (la entrega no se pierde).
- Las entregas nuevas pueden tardar unos minutos en aparecer en la revisión (demora del listado de UploadThing).
- Los votos viven en un solo dispositivo.
- Seguridad mínima, a propósito: está pensado para un grupo cerrado de amigos.

## Documentación

- [Documento del proyecto](docs/Bingo_Halloween_Documento_del_Proyecto.pdf): descripción, alcance, requerimientos, fases y stack.
- [Cambios respecto del documento](docs/Cambios_respecto_del_documento.md): qué cambió durante el desarrollo y el estado final de cada requerimiento.

## Autores

Santino Ventrice y Joaquín Urruty · 2026
