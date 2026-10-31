'use client'

import { use, useState, type FormEvent } from "react";
import { browser } from "react-dom";
import { ArrowLeft, KeyRound, TriangleAlert, Users } from "lucide-react";
import styles from "./Ingreso.module.css";
import Boton from "@/components/ui/Boton";
import Campo from "@/components/ui/Campo";
import CodigoRecuperacion from "@/components/CodigoRecuperacion";
import InvitarGrupo from "@/components/InvitarGrupo";
import {
    ErrorDeGrupo,
    LARGO_CODIGO_GRUPO,
    LARGO_MAXIMO_NOMBRE,
    buscarGrupo,
    crearJugador,
    esCodigoGrupoValido,
    esCodigoValido,
    normalizarCodigoGrupo,
    obtenerJugador,
    recuperarJugador,
    type Jugador,
} from "@/lib/jugador";
import { CELDAS_TABLERO } from "@/lib/tablero";

// seguir: ya hay jugador en este dispositivo · inicio: primer ingreso, elegir grupo
// unirme: código de un grupo · nombre: se pide al final, con el grupo ya elegido
// codigo: recién creado, se muestran el código de recuperación (una vez) y el del grupo
// recuperar: "Ya tengo código"
type Paso = "seguir" | "inicio" | "unirme" | "nombre" | "codigo" | "recuperar";

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

// Ingreso sin login (RF-01, RF-24): primero el grupo (unirse con un código o crear
// uno) y después el nombre. Recuperación del tablero con el código (RF-03)
export default function Ingreso() {
    use(browser("El jugador se guarda en localStorage"));

    const [jugador, setJugador] = useState<Jugador | null>(obtenerJugador);
    const [codigoInvitacion] = useState(codigoDelLink);
    const [paso, setPaso] = useState<Paso>(jugador ? "seguir" : codigoInvitacion ? "unirme" : "inicio");
    // Grupo al que se suma; null: crea uno nuevo
    const [codigoGrupo, setCodigoGrupo] = useState<string | null>(null);
    // El código se muestra una sola vez, al crear el jugador
    const [codigo, setCodigo] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    function cambiarPaso(siguiente: Paso) {
        setError("");
        setPaso(siguiente);
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
            setCodigoGrupo(await buscarGrupo(texto));
            cambiarPaso("nombre");
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
            const creado = await crearJugador(nombre, codigoGrupo);
            setJugador(creado.jugador);
            setCodigo(creado.codigo);
            cambiarPaso("codigo");
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
            setJugador(recuperado);
            cambiarPaso("seguir");
        } catch {
            setError("No se pudo recuperar. Revisá la conexión y probá de nuevo.");
        } finally {
            setEnviando(false);
        }
    }

    // Aviso para los pasos que reemplazan al jugador de este celular
    const advertenciaOtroJugador = jugador && (
        <p className={styles.advertencia}>
            <TriangleAlert aria-hidden="true" />
            <span>
                Este celular deja de mostrar el tablero de {jugador.nombre}.
                Si lo vas a necesitar, guardá su código antes (está en el menú, en Código de recuperación).
            </span>
        </p>
    );

    if (paso === "seguir" && jugador) {
        // Llegó con el link de otro grupo: cada jugador juega en uno solo
        const otroGrupo = codigoInvitacion && codigoInvitacion !== jugador.grupo.codigo ? codigoInvitacion : null;
        return (
            <div key="seguir" className={styles.ingreso}>
                <div className={styles.encabezado}>
                    <h1 className={styles.titulo}>¡Hola de nuevo, {jugador.nombre}!</h1>
                    <p className={styles.bajada}>
                        Tu tablero te está esperando. Jugás en el grupo <span className={styles.codigoGrupo}>{jugador.grupo.codigo}</span>.
                    </p>
                </div>
                {otroGrupo && (
                    <p className={styles.advertencia}>
                        <TriangleAlert aria-hidden="true" />
                        <span>
                            Te invitaron al grupo <span className={styles.codigoGrupo}>{otroGrupo}</span>, pero ya estás
                            en otro. Cada jugador juega en un solo grupo: para sumarte tenés que empezar un tablero nuevo.
                        </span>
                    </p>
                )}
                <Boton href="/tablero" anchoCompleto>Ir a mi tablero</Boton>
                {otroGrupo && (
                    <Boton variante="secundario" anchoCompleto onClick={() => cambiarPaso("unirme")}>
                        Empezar de nuevo en {otroGrupo}
                    </Boton>
                )}
                <Boton variante="fantasma" anchoCompleto onClick={() => cambiarPaso("recuperar")}>
                    Usar otro código
                </Boton>
            </div>
        );
    }

    if (paso === "codigo" && jugador) {
        return (
            <div key="codigo" className={styles.ingreso}>
                <div className={styles.encabezado}>
                    <span className={styles.iconoTitulo} aria-hidden="true"><KeyRound /></span>
                    <h1 className={styles.titulo}>¡Listo, {jugador.nombre}!</h1>
                </div>
                {jugador.grupo.esCreador && (
                    <section className={styles.seccion}>
                        <h2 className={styles.subtitulo}>Invitá a tu grupo</h2>
                        <p className={styles.bajada}>
                            Pasales este código o el link a tus amigos: solo los de tu grupo ven y votan tus fotos.
                            Cuando entreguen todos, cerrás las entregas desde el menú del tablero.
                        </p>
                        <InvitarGrupo codigo={jugador.grupo.codigo} />
                    </section>
                )}
                <section className={styles.seccion}>
                    <h2 className={styles.subtitulo}>Tu código de recuperación</h2>
                    <p className={styles.bajada}>
                        Guardalo (por ejemplo, mandátelo por WhatsApp): si cambiás de celular o se borran los
                        datos, es la única forma de recuperar tu tablero.
                    </p>
                    <CodigoRecuperacion codigo={codigo} />
                </section>
                <Boton href="/tablero" anchoCompleto>Ya lo guardé, ir al tablero</Boton>
            </div>
        );
    }

    if (paso === "recuperar") {
        return (
            <form key="recuperar" className={styles.ingreso} onSubmit={recuperar} noValidate>
                <div className={styles.encabezado}>
                    <h1 className={styles.titulo}>Recuperar mi tablero</h1>
                    <p className={styles.bajada}>Pegá el código que guardaste: se recuperan tu tablero, tus fotos y tu grupo.</p>
                </div>
                {advertenciaOtroJugador}
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
                <Boton
                    variante="fantasma"
                    anchoCompleto
                    icono={<ArrowLeft />}
                    onClick={() => cambiarPaso(jugador ? "seguir" : "inicio")}
                >
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
                {advertenciaOtroJugador}
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
                <Boton
                    variante="fantasma"
                    anchoCompleto
                    icono={<ArrowLeft />}
                    onClick={() => cambiarPaso(jugador ? "seguir" : "inicio")}
                >
                    Volver
                </Boton>
            </form>
        );
    }

    if (paso === "nombre") {
        return (
            <form key="nombre" className={styles.ingreso} onSubmit={ingresar} noValidate>
                <div className={styles.encabezado}>
                    <h1 className={styles.titulo}>
                        {codigoGrupo ? <>Te sumás al grupo <span className={styles.codigoGrupo}>{codigoGrupo}</span></> : "Creá tu grupo"}
                    </h1>
                    <p className={styles.bajada}>
                        Poné tu nombre y te toca un tablero con {CELDAS_TABLERO} disfraces para fotografiar.
                        {codigoGrupo ? "" : " Después vas a poder invitar a tus amigos con el código del grupo."}
                    </p>
                </div>
                <Campo
                    etiqueta="¿Cómo te llamás?"
                    name="nombre"
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
                    onClick={() => cambiarPaso(codigoGrupo ? "unirme" : "inicio")}
                >
                    Volver
                </Boton>
            </form>
        );
    }

    return (
        <div key="inicio" className={styles.ingreso}>
            <div className={styles.encabezado}>
                <h1 className={styles.titulo}>Encontrá a los {CELDAS_TABLERO} disfrazados</h1>
                <p className={styles.bajada}>
                    Se juega en grupo: sumate al de tus amigos con su código o creá uno nuevo y pasales el tuyo.
                </p>
            </div>
            <Boton anchoCompleto onClick={() => cambiarPaso("unirme")}>Tengo el código de un grupo</Boton>
            <Boton variante="secundario" anchoCompleto onClick={crearGrupo}>Crear un grupo</Boton>
            <div className={styles.separador}><span>¿Ya jugaste en otro celular?</span></div>
            <Boton variante="fantasma" anchoCompleto onClick={() => cambiarPaso("recuperar")}>
                Ya tengo código de recuperación
            </Boton>
        </div>
    );
}
