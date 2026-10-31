'use client'

import type { ReactNode } from "react";
import { ChevronRight, Dices, DoorOpen, LogOut, Share2, Trash2, UserPlus, Users } from "lucide-react";
import styles from "./MenuTablero.module.css";
import Dialogo from "@/components/ui/Dialogo";

type MenuTableroProps = {
    abierto: boolean;
    onCerrar: () => void;
    cerrado: boolean;
    hayFotos: boolean;
    cambiosRestantes: number;
    codigoGrupo: string;
    // Tablero entregado y con las fotos elegidas ya cargadas
    puedeCompartir: boolean;
    onCompartir: () => void;
    onGrupo: () => void;
    onCambiar: () => void;
    onBorrarTodo: () => void;
    onRevision: () => void;
    onSalirDelGrupo: () => void;
    onCerrarSesion: () => void;
};

type OpcionProps = {
    icono: ReactNode;
    titulo: string;
    detalle: string;
    peligro?: boolean;
    deshabilitada?: boolean;
    onElegir: () => void;
};

function Opcion({ icono, titulo, detalle, peligro, deshabilitada, onElegir }: OpcionProps) {
    return (
        <li>
            <button
                type="button"
                className={peligro ? `${styles.opcion} ${styles.peligro}` : styles.opcion}
                disabled={deshabilitada}
                onClick={onElegir}
            >
                <span className={styles.icono} aria-hidden="true">{icono}</span>
                <span className={styles.textos}>
                    <span className={styles.titulo}>{titulo}</span>
                    <span className={styles.detalle}>{detalle}</span>
                </span>
                <ChevronRight className={styles.flecha} aria-hidden="true" />
            </button>
        </li>
    );
}

// Acciones secundarias del tablero, en una hoja que sube desde abajo.
// Cada opción cierra el menú y abre lo suyo
export default function MenuTablero({
    abierto,
    onCerrar,
    cerrado,
    hayFotos,
    cambiosRestantes,
    codigoGrupo,
    puedeCompartir,
    onCompartir,
    onGrupo,
    onCambiar,
    onBorrarTodo,
    onRevision,
    onSalirDelGrupo,
    onCerrarSesion,
}: MenuTableroProps) {
    function elegir(accion: () => void) {
        onCerrar();
        accion();
    }

    return (
        <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Opciones" variante="hoja">
            <ul className={styles.opciones}>
                <Opcion
                    icono={<Share2 />}
                    titulo="Compartir mi tablero"
                    detalle={puedeCompartir
                        ? "Una imagen con tus fotos para tus redes"
                        : cerrado ? "Esperando que carguen tus fotos" : "Disponible al entregar tu tablero"}
                    deshabilitada={!puedeCompartir}
                    onElegir={() => elegir(onCompartir)}
                />
                <Opcion
                    icono={<UserPlus />}
                    titulo="Mi grupo"
                    detalle={`Código ${codigoGrupo} · invitar y ver quién entregó`}
                    onElegir={() => elegir(onGrupo)}
                />
                <Opcion
                    icono={<Users />}
                    titulo="Revisión del grupo"
                    detalle="Ver las entregas de tu grupo y votar las fotos"
                    onElegir={() => elegir(onRevision)}
                />
                <Opcion
                    icono={<Dices />}
                    titulo="Cambiar una categoría"
                    detalle={cerrado
                        ? "No disponible con el tablero cerrado"
                        : cambiosRestantes === 0
                            ? "Ya usaste los 2 cambios"
                            : `Por otra al azar · ${cambiosRestantes === 1 ? "te queda 1" : `te quedan ${cambiosRestantes}`}`}
                    deshabilitada={cerrado || cambiosRestantes === 0}
                    onElegir={() => elegir(onCambiar)}
                />
                <Opcion
                    icono={<Trash2 />}
                    titulo="Borrar todo el tablero"
                    detalle={cerrado
                        ? "No disponible con el tablero cerrado"
                        : hayFotos ? "Borra todas tus fotos; las categorías quedan" : "Todavía no hay fotos"}
                    peligro
                    deshabilitada={cerrado || !hayFotos}
                    onElegir={() => elegir(onBorrarTodo)}
                />
                <Opcion
                    icono={<DoorOpen />}
                    titulo="Salir del grupo"
                    detalle="Volver a Mis grupos; tu tablero queda guardado"
                    onElegir={() => elegir(onSalirDelGrupo)}
                />
                <Opcion
                    icono={<LogOut />}
                    titulo="Cerrar sesión"
                    detalle="Salir de tu cuenta de Google en este celular"
                    peligro
                    onElegir={() => elegir(onCerrarSesion)}
                />
            </ul>
        </Dialogo>
    );
}
