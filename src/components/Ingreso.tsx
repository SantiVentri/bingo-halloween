'use client'

import { use, useState, type FormEvent } from "react";
import { browser } from "react-dom";
import { ArrowLeft, KeyRound, TriangleAlert } from "lucide-react";
import styles from "./Ingreso.module.css";
import Boton from "@/components/ui/Boton";
import CodigoRecuperacion from "@/components/CodigoRecuperacion";
import {
    LARGO_MAXIMO_NOMBRE,
    crearJugador,
    esCodigoValido,
    obtenerJugador,
    type Jugador,
} from "@/lib/jugador";
import { importarFotos } from "@/lib/fotos";
import { guardarCambios } from "@/lib/cambios";
import { fotosDelRespaldo, leerRespaldo } from "@/lib/respaldo";

// seguir: ya hay jugador en este dispositivo · nuevo: primer ingreso
// recuperar: "Ya tengo código" · codigo: recién creado, se muestra el código una vez
type Paso = "seguir" | "nuevo" | "recuperar" | "codigo";

// Ingreso sin login (RF-01, RF-24) y recuperación del tablero con el código (RF-03) o el respaldo (RF-22)
export default function Ingreso() {
    use(browser("El jugador se guarda en localStorage"));

    const [jugador, setJugador] = useState<Jugador | null>(obtenerJugador);
    const [paso, setPaso] = useState<Paso>(jugador ? "seguir" : "nuevo");
    const [error, setError] = useState("");

    function cambiarPaso(siguiente: Paso) {
        setError("");
        setPaso(siguiente);
    }

    function ingresar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        const datos = new FormData(evento.currentTarget);
        const nombre = String(datos.get("nombre") ?? "").trim();
        if (!nombre) {
            setError("Escribí tu nombre para entrar.");
            return;
        }
        setJugador(crearJugador(nombre));
        cambiarPaso("codigo");
    }

    async function recuperar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        const datos = new FormData(evento.currentTarget);
        const texto = String(datos.get("codigo") ?? "");
        const respaldo = leerRespaldo(texto);
        const codigo = respaldo?.uuid ?? texto;
        const nombre = String(datos.get("nombre") ?? "").trim() || respaldo?.nombre || "";
        if (!esCodigoValido(codigo)) {
            setError("Ese código no es válido. Revisá que esté completo, con los guiones.");
            return;
        }
        if (!nombre) {
            setError("Escribí tu nombre para entrar.");
            return;
        }
        if (respaldo) {
            try {
                await importarFotos(respaldo.uuid, fotosDelRespaldo(respaldo));
                // Sin cambios en el respaldo se conservan los que ya hubiera en este dispositivo
                if (respaldo.cambios.length > 0) guardarCambios(respaldo.uuid, respaldo.cambios);
            } catch {
                setError("No se pudieron guardar las fotos del respaldo en este dispositivo.");
                return;
            }
        }
        setJugador(crearJugador(nombre, codigo));
        cambiarPaso("seguir");
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
                <CodigoRecuperacion codigo={jugador.uuid} />
                <Boton href="/tablero" anchoCompleto>Ya lo guardé, ir al tablero</Boton>
            </div>
        );
    }

    if (paso === "recuperar") {
        return (
            <form key="recuperar" className={styles.ingreso} onSubmit={recuperar} noValidate>
                <div className={styles.encabezado}>
                    <h1 className={styles.titulo}>Recuperar mi tablero</h1>
                    <p className={styles.bajada}>Pegá tu código o el respaldo completo que copiaste en el otro celular.</p>
                </div>
                {jugador && (
                    <p className={styles.advertencia}>
                        <TriangleAlert aria-hidden="true" />
                        <span>
                            Esto reemplaza el tablero de {jugador.nombre} en este celular.
                            Guardá su código antes si lo vas a necesitar.
                        </span>
                    </p>
                )}
                <label className={styles.campo}>
                    <span className={styles.etiqueta}>Código o respaldo</span>
                    <textarea
                        name="codigo"
                        className={`${styles.input} ${styles.areaCodigo}`}
                        rows={3}
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />
                    <span className={styles.ayuda}>Con el respaldo completo también se recuperan tus fotos.</span>
                </label>
                <label className={styles.campo}>
                    <span className={styles.etiqueta}>Tu nombre</span>
                    <input
                        name="nombre"
                        className={styles.input}
                        maxLength={LARGO_MAXIMO_NOMBRE}
                        autoComplete="given-name"
                        defaultValue={jugador?.nombre}
                    />
                    {!jugador && <span className={styles.ayuda}>Si pegaste el respaldo, podés dejarlo vacío.</span>}
                </label>
                {error && <p className={styles.error} role="alert">{error}</p>}
                <Boton type="submit" anchoCompleto>Recuperar tablero</Boton>
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
                <h1 className={styles.titulo}>Encontrá a los 9 disfrazados</h1>
                <p className={styles.bajada}>Poné tu nombre y te toca un tablero con 9 disfraces para fotografiar.</p>
            </div>
            <label className={styles.campo}>
                <span className={styles.etiqueta}>¿Cómo te llamás?</span>
                <input
                    name="nombre"
                    className={styles.input}
                    maxLength={LARGO_MAXIMO_NOMBRE}
                    autoComplete="given-name"
                    placeholder="Tu nombre"
                />
            </label>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <Boton type="submit" anchoCompleto>Empezar</Boton>
            <div className={styles.separador}><span>¿Ya jugaste en otro celular?</span></div>
            <Boton variante="secundario" anchoCompleto onClick={() => cambiarPaso("recuperar")}>
                Ya tengo código
            </Boton>
        </form>
    );
}
