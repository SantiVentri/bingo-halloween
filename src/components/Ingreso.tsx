'use client'

import { use, useState, type FormEvent } from "react";
import { browser } from "react-dom";
import Link from "next/link";
import styles from "./Ingreso.module.css";
import CodigoRecuperacion from "@/components/CodigoRecuperacion";
import {
    LARGO_MAXIMO_NOMBRE,
    crearJugador,
    esCodigoValido,
    obtenerJugador,
    type Jugador,
} from "@/lib/jugador";

// seguir: ya hay jugador en este dispositivo · nuevo: primer ingreso
// recuperar: "Ya tengo código" · codigo: recién creado, se muestra el código una vez
type Paso = "seguir" | "nuevo" | "recuperar" | "codigo";

// Ingreso sin login (RF-01, RF-24) y recuperación del tablero (RF-03)
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

    function recuperar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        const datos = new FormData(evento.currentTarget);
        const codigo = String(datos.get("codigo") ?? "");
        const nombre = String(datos.get("nombre") ?? "").trim();
        if (!esCodigoValido(codigo)) {
            setError("Ese código no es válido. Revisá que esté completo, con los guiones.");
            return;
        }
        if (!nombre) {
            setError("Escribí tu nombre para entrar.");
            return;
        }
        setJugador(crearJugador(nombre, codigo));
        cambiarPaso("seguir");
    }

    if (paso === "seguir" && jugador) {
        return (
            <div className={styles.ingreso}>
                <h1 className={styles.titulo}>¡Hola de nuevo, {jugador.nombre}!</h1>
                <Link href="/tablero" className={styles.principal}>Ir a mi tablero</Link>
                <button type="button" className={styles.secundario} onClick={() => cambiarPaso("recuperar")}>
                    Usar otro código
                </button>
            </div>
        );
    }

    if (paso === "codigo" && jugador) {
        return (
            <div className={styles.ingreso}>
                <h1 className={styles.titulo}>¡Listo, {jugador.nombre}!</h1>
                <CodigoRecuperacion codigo={jugador.uuid} />
                <Link href="/tablero" className={styles.principal}>Ya lo guardé, ir al tablero</Link>
            </div>
        );
    }

    if (paso === "recuperar") {
        return (
            <form className={styles.ingreso} onSubmit={recuperar} noValidate>
                <h1 className={styles.titulo}>Recuperar mi tablero</h1>
                {jugador && (
                    <p className={styles.advertencia}>
                        Esto reemplaza el tablero de {jugador.nombre} en este dispositivo.
                        Guardá su código antes si lo vas a necesitar.
                    </p>
                )}
                <label className={styles.campo}>
                    Código de recuperación
                    <input
                        name="codigo"
                        className={styles.input}
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />
                </label>
                <label className={styles.campo}>
                    Tu nombre
                    <input
                        name="nombre"
                        className={styles.input}
                        maxLength={LARGO_MAXIMO_NOMBRE}
                        autoComplete="given-name"
                        defaultValue={jugador?.nombre}
                    />
                </label>
                {error && <p className={styles.error} role="alert">{error}</p>}
                <button type="submit" className={styles.principal}>Recuperar tablero</button>
                <button
                    type="button"
                    className={styles.secundario}
                    onClick={() => cambiarPaso(jugador ? "seguir" : "nuevo")}
                >
                    Volver
                </button>
            </form>
        );
    }

    return (
        <form className={styles.ingreso} onSubmit={ingresar} noValidate>
            <h1 className={styles.titulo}>Bingo de Halloween</h1>
            <label className={styles.campo}>
                ¿Cómo te llamás?
                <input
                    name="nombre"
                    className={styles.input}
                    maxLength={LARGO_MAXIMO_NOMBRE}
                    autoComplete="given-name"
                    autoFocus
                />
            </label>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" className={styles.principal}>Empezar</button>
            <button type="button" className={styles.secundario} onClick={() => cambiarPaso("recuperar")}>
                Ya tengo código
            </button>
        </form>
    );
}
