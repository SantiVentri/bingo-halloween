# Bingo de Halloween · Cambios respecto del documento del proyecto

Este documento complementa a `Bingo_Halloween_Documento_del_Proyecto.pdf`: resume lo que cambió durante el desarrollo y el estado final de cada requerimiento.

## 1. Cambios principales

### Revisión del grupo en lugar del informe PDF
El informe PDF (RF-18, RF-19, RF-20 y T-01) se reemplazó por una **revisión grupal**:

- Al cerrar el tablero, la app sube a UploadThing una **entrega**: un JSON con el nombre del jugador y sus 9 fotos elegidas. Si el jugador reabre el tablero, la entrega se retira.
- En `/revision`, abierta con el link, se ven las entregas de todos. El grupo se junta y, desde **un solo dispositivo**, marca cada foto como **Vale** o **No vale**. Los votos se guardan en ese dispositivo.
- **Gana quien tenga más fotos válidas.** Si hay empate, gana quien **subió su última foto antes**, según la hora del servidor de UploadThing (no la del celular, que se puede cambiar).
- El resultado se puede copiar como texto para mandarlo al grupo.

Motivo: un informe no evita que alguien suba fotos que no corresponden. La validación real la hace el grupo mirando las fotos.

### Borrar fotos: toque largo y confirmación
- **RF-14:** para borrar la última foto de una celda se la mantiene apretada; aparece una alerta con la miniatura y se confirma. La foto se borra primero de UploadThing y después del celular.
- **RF-29 (Deshacer):** reemplazado por la alerta de confirmación.
- **RF-27 (galería a pantalla completa):** no hay galería por celda. El carrusel con zoom se usa al elegir las fotos finales.
- **RF-25 (ver fotos de todos):** fuera del juego por decisión del grupo; las fotos de los demás se ven recién en la revisión.

### Funciones agregadas (no estaban en el documento)
- **Cambiar una categoría por otra al azar:** hasta 2 veces por jugador, también sobre la misma celda, sin deshacer. Si la celda tiene fotos, se borran. El sorteo usa el UUID y el número de cambio como semilla, así que no se puede volver a tirar. Los cambios entran en el respaldo.
- **Borrar todo el tablero:** borra todas las fotos (del celular y de la nube) y la elección; las categorías y los cambios se mantienen.
- **Cerrar y reabrir el tablero:** al confirmar la elección, el tablero se cierra (no se puede subir ni borrar) y se entrega; se puede reabrir con confirmación.

### Interfaz
- Rediseño completo: paleta del póster en variables CSS, tipografías Luckiest Guy (títulos) y Nunito (texto), botones y diálogos únicos e íconos SVG.
- Tablero con barra superior (nombre, progreso, menú) y barra inferior con un solo estado a la vez. Las acciones secundarias (respaldo, cambiar categoría, borrar todo, revisión) están en un menú.
- Avisos flotantes que se apilan abajo, en lugar de mensajes sobre el póster.

## 2. Estado de los requerimientos

| ID | Estado |
|---|---|
| RF-01 a RF-13 | Hechos |
| RF-14 | Hecho (toque largo + confirmación) |
| RF-15, RF-16, RF-17 | Hechos (paso a paso y resumen) |
| RF-18, RF-19, RF-20 | Reemplazados por la revisión del grupo |
| RF-21, RF-22 | Hechos (respaldo y restauración, incluye cambios de categoría) |
| RF-23 | No hecho (opcional; se descartó) |
| RF-24 | Hecho |
| RF-25 | Fuera por decisión del grupo |
| RF-26 | Hecho (gana quien tiene más fotos válidas) |
| RF-27 | Hecho dentro de la elección de fotos (carrusel con zoom) |
| RF-28 | Hecho (barra de progreso X/9) |
| RF-29 | Reemplazado por la alerta de confirmación |
| NF-01 a NF-13 | Hechos |
| NF-14 | Hecho (service worker: la app abre sin conexión; subir y entregar necesitan internet) |
| T-01 | Reemplazado (no hay PDF) |
| T-02, T-03 | Hechos |

## 3. Decisiones pendientes del documento (sección 12)

| Decisión | Resolución |
|---|---|
| Lista final de categorías | 21 categorías; cada tablero toma 9 al azar según el UUID |
| Bloquear el tablero al finalizar | Sí, con opción de reabrir |
| Fecha y hora de cierre | Sin corte programado: se acuerda de palabra |
| ¿El PDF se sube o se descarga? | No hay PDF: lo reemplaza la revisión |

## 4. Stack (diferencias)

- **Sin `@react-pdf/renderer`.**
- **`lucide-react`** para los íconos.
- **Service worker propio** (`public/sw.js`) en lugar de Serwist o next-pwa.
- **Rutas propias:** `DELETE /api/fotos` (borrar fotos de UploadThing) y `/api/entregas` (subir, retirar y listar entregas). Son rutas y no Server Actions porque las Server Actions se rechazan detrás de un proxy como los dev tunnels.
- El estado que vive en localStorage (elección, cambios, votos) se lee con `useSyncExternalStore`: Next 16 deja las páginas visitadas ocultas con su estado (`<Activity>`) y sin esto mostraban datos viejos.

## 5. Limitaciones conocidas

- **La elección no viaja en el respaldo:** si alguien cambia de celular después de entregar, tiene que volver a elegir (la entrega en la revisión no se pierde).
- **Las entregas nuevas pueden tardar unos minutos** en aparecer en la revisión (demora del listado de UploadThing).
- **Los votos viven en un solo dispositivo.**
- **Seguridad mínima (NF-08):** quien conozca el código de otro jugador podría retirar o reemplazar su entrega.
- **Sin conexión** se puede abrir la app, ver el tablero y sacar fotos; subir, entregar y la revisión necesitan internet.

## 6. Pendiente

- Probar en iPhone y Android reales con la URL de Vercel.
- Después del fin de semana (NF-09): guardar el resultado, bajar las fotos que se quieran conservar y borrarlas de UploadThing.

## 7. Migración a Supabase (después de la v1.0.0)

La v1.0.0 funcionaba sin base de datos (NF-07): el tablero vivía en el celular y las fotos y entregas en UploadThing. Se pasó a **Supabase** para que todo quede registrado en la base:

- **Identidad sin login:** cada navegador entra con un usuario anónimo de Supabase. El código de recuperación vincula otro navegador al mismo jugador; los dos siguen funcionando.
- **Base de datos:** jugadores, códigos, celulares vinculados, fotos, cambios de categoría, elecciones y votos, con reglas de seguridad (RLS) en la base.
- **Fotos en Storage** (bucket público, rutas imposibles de adivinar); la hora de subida la pone el servidor.
- **Revisión en vivo:** una decisión por foto, guardada en la base y compartida entre todos los dispositivos con Realtime. Reemplaza a las entregas en JSON y a los votos en un solo dispositivo.
- **Cambio de categoría** sorteado en el servidor (`/api/cambios`).
- **Se eliminó** el respaldo de texto (alcanza con el código) y UploadThing.
- Se mantiene la cola de fotos sin subir en IndexedDB y el modo sin conexión.

Con esto dejan de aplicar NF-07 (sin base de datos) y las limitaciones de la sección 5 sobre la demora de las entregas, los votos en un solo dispositivo y la elección que no viajaba en el respaldo.

## 8. Imagen del tablero para redes

Función agregada: con el tablero entregado, cada jugador puede generar una imagen con sus 9 fotos elegidas para compartirla en redes.

- **Formatos:** publicación (1080×1080) e historia (1080×1920), en JPEG.
- **Contenido:** logo, nombre del jugador, categoría de cada celda y sello ENCONTRADO.
- **Se genera en el celular** con un canvas (`lib/imagenTablero.ts`), sin dependencias nuevas ni datos nuevos en la base.
- **Compartir y descargar:** usa la hoja nativa del celular si el navegador lo permite; si no, queda Descargar.
- **Nuevo paso al entregar:** después de confirmar ya no se va directo a `/revision`: aparece una pantalla de festejo con Compartir e Ir a la revisión.
- **También desde el tablero entregado:** en el menú, con la opción Compartir mi tablero.
- **No depende de la revisión:** la imagen muestra siempre las fotos elegidas, aunque el grupo marque alguna como No vale.
- Si las fotos no están en ese celular, hace falta conexión. Si alguna no se puede cargar, no se genera una imagen incompleta: se muestra un error con Reintentar.

## 9. Grupos de amigos y votación por mayoría

La revisión era una sola para todos y tenía una decisión compartida por foto (el último voto pisaba al anterior). Ahora se juega en grupos:

- **Grupos:** al entrar, antes del nombre, cada jugador se suma a un grupo con su código de 6 caracteres (o el link `/?grupo=CÓDIGO`) o crea uno nuevo. Cada jugador está en un solo grupo, para siempre; el código de recuperación lo devuelve a su grupo.
- **Privacidad:** las reglas de la base solo dejan ver los tableros, fotos, elecciones y conteos del propio grupo. El bucket de fotos pasó a ser privado: las fotos se ven con URLs firmadas, que solo se generan para el dueño y su grupo.
- **Un voto por jugador:** votan los jugadores que entregaron, en las fotos de los demás entregados (nunca las propias). Los votos son anónimos: cada uno ve los suyos y del grupo se ven solo los conteos. Una foto vale si más de la mitad de sus votantes dice que vale; el empate no vale. Al reabrir un tablero se borran los votos que hizo ese jugador.
- **Cierre de entregas:** el creador del grupo las cierra desde el menú (*Mi grupo*), con al menos 2 tableros entregados. Después nadie se suma, entrega ni reabre.
- **Pantalla del ganador** (`/resultado`): con las entregas cerradas y todos los votos, se abre sola en todos los celulares. Muestra el podio, el tablero del ganador con las fotos válidas marcadas y las posiciones. El desempate sigue siendo la hora de la última foto.
- **Base nueva:** la migración `20261101120000_grupos.sql` borra los jugadores existentes. El script `supabase/rollback/20261101120000_grupos_down.sql` deja el esquema como antes.

Deja de aplicar la limitación de que cualquiera con el link podía votar en la revisión.

## 10. Ingreso con Google y "Mis grupos"

El usuario anónimo por navegador y el código de recuperación se reemplazan por una **cuenta de Google**, que es la misma en todos los grupos y celulares:

- **Ingreso:** el inicio tiene un solo botón, *Entrar con Google* (Supabase Auth, OAuth con PKCE). La vuelta de Google pasa por `/auth/callback`. El link de invitación `/?grupo=CÓDIGO` se conserva durante el ingreso.
- **Un jugador por cuenta y grupo:** el modelo no cambia. Un jugador es la participación de la cuenta en un grupo, con su propio nombre (se sugiere el último que usó o el de Google) y su propio tablero. Volver a entrar a un grupo donde ya se juega abre el mismo tablero, aunque el grupo haya cerrado las entregas.
- **Mis grupos:** el inicio lista los grupos de la cuenta. *Salir del grupo* vuelve a esa lista sin borrar nada. *Cerrar sesión* sale de la cuenta en ese celular y borra la copia local de las fotos que ya están en la nube; las fotos sin subir se conservan.
- **Transición desde los usuarios anónimos:** un navegador con un tablero anónimo vincula Google a ese mismo usuario (`linkIdentity`), así que conserva el tablero y las fotos. Si esa cuenta de Google ya estaba en uso, un traspaso con token le pasa los jugadores del usuario anónimo. Los códigos de recuperación que se hayan guardado siguen sirviendo desde el inicio para pasar ese tablero a la cuenta.
- **Base:** la migración `20261102120000_cuentas_google.sql` no borra datos. Las RPC solo aceptan cuentas, no usuarios anónimos. Para volver atrás está `supabase/rollback/20261102120000_cuentas_google_down.sql`.
