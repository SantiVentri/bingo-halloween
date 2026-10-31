# 🎃 Bingo de Halloween

> Encontrá a los 9 disfrazados… si te animás.

App web para jugar al bingo de disfraces desde el celular en una fiesta de Halloween. Cada jugador se suma a un grupo de amigos, recibe un tablero de 3×3 con categorías de disfraces y saca una foto de alguien disfrazado en cada celda. Al final, el grupo vota las fotos de todos y sale el ganador.

**App:** [bingo-halloween.vercel.app](https://bingo-halloween.vercel.app) · **Versión:** 2.0.0

Pensada para grupos de amigos y para usarse durante el fin de semana de Halloween: se entra con el código del grupo y el nombre, sin email ni contraseña. Cada grupo solo ve y vota sus propias fotos.

---

## Cómo se juega

1. **Sumarse a un grupo o crearlo.** Uno crea el grupo y les pasa a los demás el código de 6 caracteres (por ejemplo `K7QX2M`) o el link de invitación (`/?grupo=K7QX2M`). Cada jugador está en un solo grupo, para siempre.
2. **Entrar con el nombre.** No hay cuenta ni contraseña: el celular recibe un código de recuperación que conviene guardar (por ejemplo, mandándoselo por WhatsApp). Con ese código se sigue el mismo tablero, en el mismo grupo, desde otro celular.
3. **Completar el tablero.** Cada jugador tiene 9 categorías al azar (siempre las mismas para su código). Tocar una celda abre la cámara o la galería; se pueden sacar varias fotos por celda.
4. **Finalizar.** Con las 9 celdas completas aparece **¡Bingo! Finalizar**: se elige la mejor foto de cada celda y se entrega el tablero. Después se puede compartir una imagen del tablero en redes.
5. **Votar.** En `/revision`, cada jugador que entregó vota **Vale** o **No vale** en cada foto de los demás (las propias no se votan). Los votos son anónimos: se ven los conteos en vivo, no quién votó. Una foto **vale si más de la mitad** de sus votantes dice que vale; el empate no vale.
6. **Cerrar las entregas.** Cuando entregaron todos, el creador del grupo cierra las entregas desde el menú (*Mi grupo*). Desde ahí nadie más se suma, entrega ni reabre; quienes no entregaron quedan afuera.
7. **Ganador.** Con las entregas cerradas y todos los votos, se abre sola la pantalla `/resultado` en todos los celulares. Gana quien tenga **más fotos válidas**. Si hay empate, gana quien **subió su última foto antes** (según la hora del servidor, no la del celular).

## Funciones

- **Tablero determinístico:** 9 de 21 categorías, elegidas y ordenadas con el código del jugador como semilla.
- **Fotos sin perder nada:** se comprimen en el celular (1600 px, JPEG), se ven al instante y se guardan en el dispositivo hasta que terminan de subir. Si falla la subida, quedan pendientes y se reintentan solas al volver la conexión.
- **Borrar:** mantener apretada una celda borra su última foto, con confirmación. También se puede borrar todo el tablero (las categorías se mantienen).
- **Cambiar una categoría por otra al azar:** hasta 2 veces, sin deshacer. El sorteo lo hace el servidor.
- **Varios celulares:** con el código, el mismo tablero se usa desde otro celular (los dos siguen funcionando y se sincronizan en vivo).
- **Grupos privados:** las reglas de la base solo dejan ver los tableros, fotos y conteos del propio grupo. Las fotos están en un bucket privado y se ven con URLs firmadas.
- **Cerrar y reabrir:** al entregar, el tablero se bloquea; se puede reabrir si alguien se equivocó (se borran los votos que hizo) mientras el grupo no haya cerrado las entregas.
- **Imagen para redes:** con el tablero entregado se genera en el celular una imagen con las 9 fotos elegidas, en formato publicación (1:1) o historia (9:16), para compartirla o descargarla. Muestra siempre las fotos elegidas, sin importar lo que se vote en la revisión.
- **Sin conexión:** la app abre y muestra el tablero y las fotos guardadas sin internet (subir, entregar y revisar sí lo necesitan; la imagen para redes también, si las fotos no están en ese celular).

## Stack

| Área | Tecnología |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Cache Components) + React 19 + TypeScript |
| Estilos | CSS Modules y variables CSS en `globals.css` |
| Tipografías | Rubik Wet Paint (logo), Anton (títulos y botones) y Nunito Sans (texto), con `next/font` |
| Íconos | [lucide-react](https://lucide.dev) e ilustraciones SVG propias en `components/ilustraciones` |
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

1. En Supabase, aplicar en orden las migraciones de `supabase/migrations/`: `20261030120000_inicial.sql`, `20261031120000_no_votar_propias.sql` y `20261101120000_grupos.sql` (SQL Editor, o `npx supabase db push` con el proyecto vinculado). Crean las tablas, las reglas, las funciones, el bucket `fotos` y Realtime.
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

### Pasar una base existente a grupos

La migración `20261101120000_grupos.sql` **borra todos los jugadores** (con sus fotos, votos y elecciones) y vuelve privado el bucket.

1. Hacer un backup: `npx supabase db dump --data-only -f backup_pre_grupos.sql` (o desde *Database → Backups*).
2. Vaciar el bucket `fotos` desde *Storage* (Supabase no deja borrar los archivos por SQL).
3. Aplicar la migración.

Para volver atrás está `supabase/rollback/20261101120000_grupos_down.sql`: deja el esquema exactamente como antes de los grupos (también borra los jugadores; los datos viejos se recuperan restaurando el backup). Se corre a mano, desde el SQL Editor o con `psql`, y después hay que volver a desplegar la versión anterior de la app.

## Estructura

```
src/
├── app/
│   ├── page.tsx              # Inicio: grupo (unirse o crear), nombre y recuperación
│   ├── tablero/              # El tablero del jugador
│   ├── finalizar/            # Elección de la foto final de cada celda
│   ├── revision/             # Revisión y votación del grupo
│   ├── resultado/            # Pantalla del ganador
│   └── api/
│       └── cambios/          # POST: cambio de categoría (sorteo en el servidor)
├── components/               # Pantallas y componentes (ui/ tiene los componentes base)
├── hooks/                    # useFotos (fotos y subidas), useTableroRemoto y useRevision (estado en la base)
└── lib/                      # Lógica: tablero, jugador, grupo, fotos, revisión y clientes de Supabase
public/
└── sw.js                     # Service worker (sin conexión)
supabase/
├── migrations/               # Esquema de la base, reglas y funciones
└── rollback/                 # Scripts para deshacer migraciones (se corren a mano)
docs/
├── Bingo_Halloween_Documento_del_Proyecto.pdf
└── Cambios_respecto_del_documento.md
```

## Dónde vive cada dato

| Dato | Dónde |
|---|---|
| Grupo (código, creador, cierre de entregas) | Tabla `grupos` |
| Jugador (id, nombre y grupo) | Tabla `jugadores`; en el navegador queda el jugador activo con su grupo (`localStorage` · `bingo-halloween:jugador`) |
| Código de recuperación | Tabla `codigos` (solo lo lee el propio jugador) |
| Celulares de cada jugador | Tabla `jugador_dispositivos` (usuarios anónimos de Supabase) |
| Fotos | Storage, bucket privado `fotos` (`<jugador>/<foto>.jpg`) y tabla `fotos` (con la hora de subida del servidor) |
| Fotos sin subir | IndexedDB del celular · base `bingo-halloween`, almacén `fotos` |
| Cambios de categoría | Tabla `cambios` (máximo 2) |
| Foto elegida por celda | Tabla `elecciones`; entregado = `jugadores.entregado_en` |
| Votos de la revisión | Tabla `votos` (uno por jugador y foto; cada uno ve solo los suyos) y tabla `conteos` (totales anónimos por foto, los mantiene un trigger) |

## Limitaciones conocidas

- Si un navegador pierde su sesión (por ejemplo, se borran los datos del sitio), hay que volver a entrar con el código.
- Sin conexión se puede abrir la app, ver el tablero y sacar fotos; subir, cambiar categoría, entregar y la revisión necesitan internet.
- Quien tenga el código o el link de un grupo puede sumarse hasta que se cierren las entregas.
- Un voto se puede cambiar después de que sale el resultado; la pantalla del ganador se actualiza en vivo.

## Documentación

- [Documento del proyecto](docs/Bingo_Halloween_Documento_del_Proyecto.pdf): descripción, alcance, requerimientos, fases y stack.
- [Cambios respecto del documento](docs/Cambios_respecto_del_documento.md): qué cambió durante el desarrollo y el estado final de cada requerimiento.

## Autores

Santino Ventrice y Joaquín Urruty · 2026
