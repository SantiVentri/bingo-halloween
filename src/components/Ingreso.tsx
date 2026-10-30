'use client'

import { use, useState, type FormEvent } from "react";
import { browser } from "react-dom";
import { ArrowLeft, KeyRound, TriangleAlert } from "lucide-react";
import styles from "./Ingreso.module.css";
import Boton from "@/components/ui/Boton";
import Campo from "@/components/ui/Campo";
import CodigoRecuperacion from "@/components/CodigoRecuperacion";
import {
    LARGO_MAXIMO_NOMBRE,
    crearJugador,
    esCodigoValido,
    obtenerJugador,
    recuperarJugador,
    type Jugador,
} from "@/lib/jugador";
import { CELDAS_TABLERO } from "@/lib/tablero";

// seguir: ya hay jugador en este dispositivo · nuevo: primer ingreso
// recuperar: "Ya tengo código" · codigo: recién creado, se muestra el código una vez
type Paso = "seguir" | "nuevo" | "recuperar" | "codigo";

// Ingreso sin login (RF-01, RF-24) y recuperación del tablero con el código (RF-03)
export default function Ingreso() {
    use(browser("El jugador se guarda en localStorage"));

    const [jugador, setJugador] = useState<Jugador | null>(obtenerJugador);
    const [paso, setPaso] = useState<Paso>(jugador ? "seguir" : "nuevo");
    // El código se muestra una sola vez, al crear el jugador
    const [codigo, setCodigo] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    function cambiarPaso(siguiente: Paso) {
        setError("");
        setPaso(siguiente);
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
            const creado = await crearJugador(nombre);
            setJugador(creado.jugador);
            setCodigo(creado.codigo);
            cambiarPaso("codigo");
        } catch {
            setError("No se pudo entrar. Revisá la conexión y probá de nuevo.");
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

    if (paso === "seguir" && jugador) {
        return (
            <div key="seguir" className={styles.ingreso}>
                <div className={styles.encabezado}>
                    <h1 className={styles.titulo}>¡Hola de nuevo, {jugador.nombre}!</h1>
                    <p className={styles.bajada}>Tu tablero te está esperando.</p>
                </div>
                <Boton href="/tablero" anchoCompleto>Ir a mi tablero</Boton>
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
                    <p className={styles.bajada}>
                        Este es tu código de recuperación. Guardalo (por ejemplo, mandátelo por WhatsApp):
                        si cambiás de celular o se borran los datos, es la única forma de recuperar tu tablero.
                    </p>
                </div>
                <CodigoRecuperacion codigo={codigo} />
                <Boton href="/tablero" anchoCompleto>Ya lo guardé, ir al tablero</Boton>
            </div>
        );
    }

    if (paso === "recuperar") {
        return (
            <form key="recuperar" className={styles.ingreso} onSubmit={recuperar} noValidate>
                <div className={styles.encabezado}>
                    <h1 className={styles.titulo}>Recuperar mi tablero</h1>
                    <p className={styles.bajada}>Pegá el código que guardaste: se recuperan tu tablero y tus fotos.</p>
                </div>
                {jugador && (
                    <p className={styles.advertencia}>
                        <TriangleAlert aria-hidden="true" />
                        <span>
                            Este celular deja de mostrar el tablero de {jugador.nombre}.
                            Si lo vas a necesitar, guardá su código antes (está en el menú, en Respaldo).
                        </span>
                    </p>
                )}
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
                    onClick={() => cambiarPaso(jugador ? "seguir" : "nuevo")}
                >
                    Volver
                </Boton>
            </form>
        );
    }

    return (
        // Cada formulario lleva su key: si no, React reutiliza el botón "Ya tengo código"
        // como el submit del formulario siguiente en medio del clic y lo envía vacío
        <form key="nuevo" className={styles.ingreso} onSubmit={ingresar} noValidate>
            <div className={styles.encabezado}>
                <h1 className={styles.titulo}>Encontrá a los {CELDAS_TABLERO} disfrazados</h1>
                <p className={styles.bajada}>Poné tu nombre y te toca un tablero con {CELDAS_TABLERO} disfraces para fotografiar.</p>
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
            <div className={styles.separador}><span>¿Ya jugaste en otro celular?</span></div>
            <Boton variante="secundario" anchoCompleto onClick={() => cambiarPaso("recuperar")}>
                Ya tengo código
            </Boton>
        </form>
    );
}
