'use client'

import { use, useEffect, useState, type FormEvent } from "react";
import { browser } from "react-dom";
import { ArrowLeft, ChevronRight, LogIn, TriangleAlert, UserPlus, Users } from "lucide-react";
import styles from "./Ingreso.module.css";
import Boton from "@/components/ui/Boton";
import Campo from "@/components/ui/Campo";
import InvitarGrupo from "@/components/InvitarGrupo";
import {
    ErrorDeGrupo,
    LARGO_CODIGO_GRUPO,
    LARGO_MAXIMO_NOMBRE,
    buscarGrupo,
    crearJugador,
    elegirJugador,
    esCodigoGrupoValido,
    esCodigoValido,
    misGrupos,
    nombreDelJugadorAnonimo,
    normalizarCodigoGrupo,
    recuperarJugador,
    type Jugador,
    type Participacion,
} from "@/lib/jugador";
import { cerrarSesion, entrarConGoogle, leerSesion, type Sesion } from "@/lib/cuenta";
import { CELDAS_TABLERO } from "@/lib/tablero";

// cargando: leyendo la sesión y los grupos · login: entrar con Google
// grupos: inicio con sesión, "Mis grupos" · unirme: código de un grupo
// nombre: se pide al final, con el grupo ya elegido (uno por grupo)
// invitar: recién creado el grupo · recuperar: código de la versión anónima
type Paso = "cargando" | "login" | "grupos" | "unirme" | "nombre" | "invitar" | "recuperar";

// El link de invitación trae el código del grupo: /?grupo=K7QX2M
function codigoDelLink(): string | null {
    const codigo = new URLSearchParams(window.location.search).get("grupo");
    return codigo && esCodigoGrupoValido(codigo) ? normalizarCodigoGrupo(codigo) : null;
}

function mensajeDeGrupo(error: ErrorDeGrupo): string {
    return error.motivo === "inexistente"
        ? "No existe un grupo con ese código. Revisalo y probá de nuevo."
        : "Ese grupo ya cerró las entregas: no se puede sumar gente nueva.";
}

function estadoDe(participacion: Participacion): string {
    if (participacion.cerrado) return "Entregas cerradas";
    if (participacion.entregado) return "Tablero entregado";
    return "Jugando";
}

// Navegación completa: el tablero arranca de cero con el jugador elegido (con
// router.push, una página guardada oculta seguiría mostrando al anterior)
function irAlTablero(jugador: Jugador) {
    elegirJugador(jugador);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- hay que descartar el estado de las páginas
    window.location.assign("/tablero");
}

// Ingreso con Google (RF-01, RF-24): la cuenta es la misma en todos los grupos.
// Se elige un grupo de la lista o se suma a uno con su código (o crea uno) y
// después se pone el nombre para ese grupo
export default function Ingreso() {
    use(browser("La sesión y el jugador viven en el navegador"));

    const [codigoInvitacion] = useState(codigoDelLink);
    const [jugadorAnonimo] = useState(nombreDelJugadorAnonimo);
    const [paso, setPaso] = useState<Paso>("cargando");
    const [sesion, setSesion] = useState<Sesion | null>(null);
    const [grupos, setGrupos] = useState<Participacion[]>([]);
    // Grupo al que se suma; null: crea uno nuevo
    const [codigoGrupo, setCodigoGrupo] = useState<string | null>(null);
    // El grupo recién creado, para invitar
    const [creado, setCreado] = useState<Jugador | null>(null);
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    function cambiarPaso(siguiente: Paso) {
        setError("");
        setPaso(siguiente);
    }

    // Busca el grupo del código: si ya juega en él entra directo; si no, pide el nombre
    async function irAlGrupo(codigo: string): Promise<void> {
        const { codigo: normalizado, miJugador } = await buscarGrupo(codigo);
        if (miJugador) {
            irAlTablero(miJugador);
            return;
        }
        setCodigoGrupo(normalizado);
        cambiarPaso("nombre");
    }

    useEffect(() => {
        let vigente = true;
        (async () => {
            const leida = await leerSesion();
            if (!vigente) return;
            setSesion(leida);
            if (leida.tipo !== "cuenta") {
                setPaso("login");
                return;
            }
            setGrupos(await misGrupos());
            if (!vigente) return;
            if (!codigoInvitacion) {
                setPaso("grupos");
                return;
            }
            try {
                await irAlGrupo(codigoInvitacion);
            } catch (causa) {
                if (!vigente) return;
                setPaso("unirme");
                setError(causa instanceof ErrorDeGrupo
                    ? mensajeDeGrupo(causa)
                    : "No se pudo buscar el grupo. Revisá la conexión y probá de nuevo.");
            }
        })().catch(() => {
            if (!vigente) return;
            setPaso("grupos");
            setError("No se pudieron cargar tus grupos. Revisá la conexión y recargá la página.");
        });
        return () => {
            vigente = false;
        };
        // Solo al montar: irAlGrupo cambia en cada render
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codigoInvitacion]);

    async function entrar() {
        setEnviando(true);
        setError("");
        try {
            // Al volver de Google sigue con la invitación, si había
            await entrarConGoogle(codigoInvitacion ? `/?grupo=${codigoInvitacion}` : "/");
        } catch {
            setError("No se pudo abrir el ingreso con Google. Revisá la conexión y probá de nuevo.");
            setEnviando(false);
        }
    }

    async function salir() {
        setEnviando(true);
        try {
            await cerrarSesion();
        } finally {
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- hay que descartar el estado del inicio
            window.location.assign("/");
        }
    }

    function crearGrupo() {
        setCodigoGrupo(null);
        cambiarPaso("nombre");
    }

    async function unirme(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        const datos = new FormData(evento.currentTarget);
        const texto = String(datos.get("grupo") ?? "");
        if (!esCodigoGrupoValido(texto)) {
            setError(`El código del grupo tiene ${LARGO_CODIGO_GRUPO} letras y números.`);
            return;
        }
        setEnviando(true);
        try {
            await irAlGrupo(texto);
        } catch (causa) {
            setError(causa instanceof ErrorDeGrupo
                ? mensajeDeGrupo(causa)
                : "No se pudo buscar el grupo. Revisá la conexión y probá de nuevo.");
        } finally {
            setEnviando(false);
        }
    }

    async function ingresar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        const datos = new FormData(evento.currentTarget);
        const nombre = String(datos.get("nombre") ?? "").trim();
        if (!nombre) {
            setError("Escribí tu nombre para entrar.");
            return;
        }
        setEnviando(true);
        try {
            const jugador = await crearJugador(nombre, codigoGrupo);
            if (jugador.grupo.esCreador && !codigoGrupo) {
                setCreado(jugador);
                cambiarPaso("invitar");
            } else {
                irAlTablero(jugador);
            }
        } catch (causa) {
            setError(causa instanceof ErrorDeGrupo
                ? mensajeDeGrupo(causa)
                : "No se pudo entrar. Revisá la conexión y probá de nuevo.");
        } finally {
            setEnviando(false);
        }
    }

    async function recuperar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        const datos = new FormData(evento.currentTarget);
        const texto = String(datos.get("codigo") ?? "");
        if (!esCodigoValido(texto)) {
            setError("Ese código no es válido. Revisá que esté completo, con los guiones.");
            return;
        }
        setEnviando(true);
        try {
            const recuperado = await recuperarJugador(texto);
            if (!recuperado) {
                setError("No encontramos un tablero con ese código.");
                return;
            }
            irAlTablero(recuperado);
        } catch {
            setError("No se pudo recuperar. Revisá la conexión y probá de nuevo.");
        } finally {
            setEnviando(false);
        }
    }

    if (paso === "cargando") {
        return <p className={styles.cargando}>Cargando…</p>;
    }

    if (paso === "login") {
        return (
            <div key="login" className={styles.ingreso}>
                <div className={styles.encabezado}>
                    <h1 className={styles.titulo}>Encontrá a los {CELDAS_TABLERO} disfrazados</h1>
                    <p className={styles.bajada}>
                        {codigoInvitacion
                            ? <>Te invitaron al grupo <span className={styles.codigoGrupo}>{codigoInvitacion}</span>. Entrá con tu cuenta de Google para sumarte.</>
                            : "Se juega en grupo. Entrá con tu cuenta de Google: con la misma cuenta seguís tus tableros en cualquier celular."}
                    </p>
                </div>
                {sesion?.tipo === "anonima" && jugadorAnonimo && (
                    <p className={styles.advertencia}>
                        <TriangleAlert aria-hidden="true" />
                        <span>
                            Ahora se entra con Google. El tablero de {jugadorAnonimo} pasa a tu cuenta, con todas sus fotos.
                        </span>
                    </p>
                )}
                {error && <p className={styles.error} role="alert">{error}</p>}
                <Boton anchoCompleto icono={<LogIn />} onClick={entrar} disabled={enviando}>
                    {enviando ? "Abriendo Google…" : "Entrar con Google"}
                </Boton>
            </div>
        );
    }

    if (paso === "invitar" && creado) {
        return (
            <div key="invitar" className={styles.ingreso}>
                <div className={styles.encabezado}>
                    <span className={styles.iconoTitulo} aria-hidden="true"><UserPlus /></span>
                    <h1 className={styles.titulo}>¡Listo, {creado.nombre}!</h1>
                </div>
                <section className={styles.seccion}>
                    <h2 className={styles.subtitulo}>Invitá a tu grupo</h2>
                    <p className={styles.bajada}>
                        Pasales este código o el link a tus amigos: solo los de tu grupo ven y votan tus fotos.
                        Cuando entreguen todos, cerrás las entregas desde el menú del tablero.
                    </p>
                    <InvitarGrupo codigo={creado.grupo.codigo} />
                </section>
                <Boton anchoCompleto onClick={() => irAlTablero(creado)}>Ir al tablero</Boton>
            </div>
        );
    }

    if (paso === "recuperar") {
        return (
            <form key="recuperar" className={styles.ingreso} onSubmit={recuperar} noValidate>
                <div className={styles.encabezado}>
                    <h1 className={styles.titulo}>Recuperar un tablero</h1>
                    <p className={styles.bajada}>
                        Si guardaste un código de recuperación de antes, pegalo: ese tablero pasa a tu cuenta.
                    </p>
                </div>
                <Campo
                    etiqueta="Código de recuperación"
                    name="codigo"
                    mono
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
                {error && <p className={styles.error} role="alert">{error}</p>}
                <Boton type="submit" anchoCompleto disabled={enviando}>
                    {enviando ? "Recuperando…" : "Recuperar tablero"}
                </Boton>
                <Boton variante="fantasma" anchoCompleto icono={<ArrowLeft />} onClick={() => cambiarPaso("grupos")}>
                    Volver
                </Boton>
            </form>
        );
    }

    if (paso === "unirme") {
        return (
            // Cada formulario lleva su key: si no, React reutiliza un botón del paso
            // anterior como el submit de este en medio del clic y lo envía vacío
            <form key="unirme" className={styles.ingreso} onSubmit={unirme} noValidate>
                <div className={styles.encabezado}>
                    <span className={styles.iconoTitulo} aria-hidden="true"><Users /></span>
                    <h1 className={styles.titulo}>Sumate a un grupo</h1>
                    <p className={styles.bajada}>Escribí el código que te pasó quien creó el grupo.</p>
                </div>
                <Campo
                    etiqueta="Código del grupo"
                    name="grupo"
                    mono
                    defaultValue={codigoInvitacion ?? ""}
                    maxLength={LARGO_CODIGO_GRUPO + 4}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="K7QX2M"
                />
                {error && <p className={styles.error} role="alert">{error}</p>}
                <Boton type="submit" anchoCompleto disabled={enviando}>
                    {enviando ? "Buscando…" : "Seguir"}
                </Boton>
                <Boton variante="fantasma" anchoCompleto icono={<ArrowLeft />} onClick={() => cambiarPaso("grupos")}>
                    Volver
                </Boton>
            </form>
        );
    }

    if (paso === "nombre") {
        // Cada grupo tiene su nombre: se sugiere el último que usó o el de Google
        const sugerido = grupos[0]?.jugador.nombre ?? (sesion?.tipo === "cuenta" ? sesion.nombre : null) ?? "";
        return (
            <form key="nombre" className={styles.ingreso} onSubmit={ingresar} noValidate>
                <div className={styles.encabezado}>
                    <h1 className={styles.titulo}>
                        {codigoGrupo ? <>Te sumás al grupo <span className={styles.codigoGrupo}>{codigoGrupo}</span></> : "Creá tu grupo"}
                    </h1>
                    <p className={styles.bajada}>
                        Poné tu nombre para este grupo y te toca un tablero con {CELDAS_TABLERO} disfraces para fotografiar.
                        {codigoGrupo ? "" : " Después vas a poder invitar a tus amigos con el código del grupo."}
                    </p>
                </div>
                <Campo
                    etiqueta="¿Cómo te llamás?"
                    name="nombre"
                    defaultValue={sugerido}
                    maxLength={LARGO_MAXIMO_NOMBRE}
                    autoComplete="given-name"
                    placeholder="Tu nombre"
                />
                {error && <p className={styles.error} role="alert">{error}</p>}
                <Boton type="submit" anchoCompleto disabled={enviando}>{enviando ? "Entrando…" : "Empezar"}</Boton>
                <Boton
                    variante="fantasma"
                    anchoCompleto
                    icono={<ArrowLeft />}
                    onClick={() => cambiarPaso(codigoGrupo ? "unirme" : "grupos")}
                >
                    Volver
                </Boton>
            </form>
        );
    }

    return (
        <div key="grupos" className={styles.ingreso}>
            <div className={styles.encabezado}>
                <h1 className={styles.titulo}>
                    {grupos.length > 0 ? "Mis grupos" : `Encontrá a los ${CELDAS_TABLERO} disfrazados`}
                </h1>
                <p className={styles.bajada}>
                    {grupos.length > 0
                        ? "Tocá un grupo para seguir con tu tablero, o sumate a otro."
                        : "Se juega en grupo: sumate al de tus amigos con su código o creá uno nuevo y pasales el tuyo."}
                </p>
            </div>
            {error && <p className={styles.error} role="alert">{error}</p>}
            {grupos.length > 0 && (
                <ul className={styles.grupos}>
                    {grupos.map((participacion) => (
                        <li key={participacion.jugador.id}>
                            <button
                                type="button"
                                className={styles.grupo}
                                onClick={() => irAlTablero(participacion.jugador)}
                            >
                                <span className={styles.grupoTextos}>
                                    <span className={styles.codigoGrupo}>{participacion.jugador.grupo.codigo}</span>
                                    <span className={styles.grupoDetalle}>
                                        Como {participacion.jugador.nombre} · {estadoDe(participacion)}
                                        {participacion.jugador.grupo.esCreador ? " · Lo creaste vos" : ""}
                                    </span>
                                </span>
                                <ChevronRight className={styles.flecha} aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <Boton anchoCompleto onClick={() => cambiarPaso("unirme")}>Tengo el código de un grupo</Boton>
            <Boton variante="secundario" anchoCompleto onClick={crearGrupo}>Crear un grupo</Boton>
            <Boton variante="fantasma" anchoCompleto onClick={() => cambiarPaso("recuperar")}>
                Tengo un código de recuperación
            </Boton>
            {sesion?.tipo === "cuenta" && (
                <div className={styles.cuenta}>
                    <span>Entraste como {sesion.email ?? sesion.nombre ?? "tu cuenta de Google"}</span>
                    <button type="button" className={styles.enlace} onClick={salir} disabled={enviando}>
                        Cerrar sesión
                    </button>
                </div>
            )}
        </div>
    );
}
