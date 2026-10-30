# 🎃 Bingo de Halloween

> Encontrá a los 9 disfrazados… si te animás.

App web para jugar al bingo de disfraces desde el celular en una fiesta de Halloween. Cada jugador recibe un tablero de 3×3 con categorías de disfraces, saca una foto de alguien disfrazado en cada celda y, al final, el grupo revisa las fotos de todos y decide quién ganó.

**App:** [bingo-halloween.vercel.app](https://bingo-halloween.vercel.app) · **Versión:** 1.0.0

Pensada para un grupo cerrado de amigos y para usarse durante el fin de semana de Halloween: se entra solo con el nombre, sin email ni contraseña.

---

## Cómo se juega

1. **Entrar con el nombre.** No hay cuenta ni contraseña: el celular recibe un código de recuperación que conviene guardar (por ejemplo, mandándoselo por WhatsApp). Con ese código se sigue el mismo tablero desde otro celular.
2. **Completar el tablero.** Cada jugador tiene 9 categorías al azar (siempre las mismas para su código). Tocar una celda abre la cámara o la galería; se pueden sacar varias fotos por celda.
3. **Finalizar.** Con las 9 celdas completas aparece **¡Bingo! Finalizar**: se elige la mejor foto de cada celda y se entrega el tablero.
4. **Revisión del grupo.** Se juntan y abren `/revision`: marcan cada foto como **Vale** o **No vale**. Los votos se ven en vivo en todos los celulares que tengan la revisión abierta.
5. **Ganador.** Gana quien tenga **más fotos válidas**. Si hay empate, gana quien **subió su última foto antes** (según la hora del servidor, no la del celular).

## Funciones

- **Tablero determinístico:** 9 de 21 categorías, elegidas y ordenadas con el código del jugador como semilla.
- **Fotos sin perder nada:** se comprimen en el celular (1600 px, JPEG), se ven al instante y se guardan en el dispositivo hasta que terminan de subir. Si falla la subida, quedan pendientes y se reintentan solas al volver la conexión.
- **Borrar:** mantener apretada una celda borra su última foto, con confirmación. También se puede borrar todo el tablero (las categorías se mantienen).
- **Cambiar una categoría por otra al azar:** hasta 2 veces, sin deshacer. El sorteo lo hace el servidor.
- **Varios celulares:** con el código, el mismo tablero se usa desde otro celular (los dos siguen funcionando y se sincronizan en vivo).
- **Cerrar y reabrir:** al entregar, el tablero se bloquea; se puede reabrir si alguien se equivocó.
- **Sin conexión:** la app abre y muestra el tablero y las fotos guardadas sin internet (subir, entregar y revisar sí lo necesitan).

## Stack

| Área | Tecnología |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Cache Components) + React 19 + TypeScript |
| Estilos | CSS Modules y variables CSS con la paleta del póster |
| Tipografías | Luckiest Guy (títulos) y Nunito (texto), con `next/font` |
| Íconos | [lucide-react](https://lucide.dev) |
| Base de datos | [Supabase](https://supabase.com): Postgres con reglas de seguridad (RLS), Realtime y Storage para las fotos |
| Identidad | Usuario anónimo de Supabase por navegador (sin email) + código de recuperación |
| Datos locales | IndexedDB: copia de las fotos y cola de las que todavía no subieron |
| Sin conexión | Service worker propio (`public/sw.js`) |
| Deploy | [Vercel](https://vercel.com), desde la rama `main` |

## Correrlo localmente

Requisitos: Node.js 20 o superior y un proyecto de Supabase.

```bash
npm install
```

1. En Supabase, aplicar la migración `supabase/migrations/20261030120000_inicial.sql` (SQL Editor, o `npx supabase db push` con el proyecto vinculado). Crea las tablas, las reglas, las funciones, el bucket `fotos` y Realtime.
2. Habilitar **Anonymous sign-ins** en *Authentication → Sign In / Providers*.
3. Crear `.env.local` (y cargar lo mismo en Vercel):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...   # solo servidor: la usa /api/cambios
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
│       └── cambios/          # POST: cambio de categoría (sorteo en el servidor)
├── components/               # Pantallas y componentes (ui/ tiene los componentes base)
├── hooks/                    # useFotos (fotos y subidas) y useTableroRemoto (estado en la base)
└── lib/                      # Lógica: tablero, jugador, fotos, revisión y clientes de Supabase
public/
├── Bingo Halloween.jpg       # El póster del tablero
└── sw.js                     # Service worker (sin conexión)
supabase/
└── migrations/               # Esquema de la base, reglas y funciones
docs/
├── Bingo_Halloween_Documento_del_Proyecto.pdf
└── Cambios_respecto_del_documento.md
```

## Dónde vive cada dato

| Dato | Dónde |
|---|---|
| Jugador (id y nombre) | Tabla `jugadores`; en el navegador queda el jugador activo (`localStorage` · `bingo-halloween:jugador`) |
| Código de recuperación | Tabla `codigos` (solo lo lee el propio jugador) |
| Celulares de cada jugador | Tabla `jugador_dispositivos` (usuarios anónimos de Supabase) |
| Fotos | Storage, bucket `fotos` (`<jugador>/<foto>.jpg`) y tabla `fotos` (con la hora de subida del servidor) |
| Fotos sin subir | IndexedDB del celular · base `bingo-halloween`, almacén `fotos` |
| Cambios de categoría | Tabla `cambios` (máximo 2) |
| Foto elegida por celda | Tabla `elecciones`; entregado = `jugadores.entregado_en` |
| Votos de la revisión | Tabla `votos` (una decisión por foto, con quién y cuándo) |

## Limitaciones conocidas

- Si un navegador pierde su sesión (por ejemplo, se borran los datos del sitio), hay que volver a entrar con el código.
- Sin conexión se puede abrir la app, ver el tablero y sacar fotos; subir, cambiar categoría, entregar y la revisión necesitan internet.
- Seguridad pensada para un grupo cerrado: cualquiera con el link puede jugar y votar en la revisión.

## Documentación

- [Documento del proyecto](docs/Bingo_Halloween_Documento_del_Proyecto.pdf): descripción, alcance, requerimientos, fases y stack.
- [Cambios respecto del documento](docs/Cambios_respecto_del_documento.md): qué cambió durante el desarrollo y el estado final de cada requerimiento.

## Autores

Santino Ventrice y Joaquín Urruty · 2026
