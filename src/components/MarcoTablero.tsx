import type { CSSProperties, ReactNode } from "react";
import styles from "./MarcoTablero.module.css";
import Logo from "@/components/Logo";
import MarcoGrilla from "@/components/MarcoGrilla";

type MarcoTableroProps = {
    barra?: ReactNode;
    pie?: ReactNode;
    // De 0 a 1: cuánto se ilumina el fondo a medida que se completa el tablero
    luz?: number;
    // Lo que va adentro del marco de la grilla
    children?: ReactNode;
};

// Logo y barra arriba, grilla en el medio y barra abajo. Las barras tienen alto fijo
// para que la grilla no cambie de tamaño al cargar ni al cambiar el estado
export default function MarcoTablero({ barra, pie, luz = 0, children }: MarcoTableroProps) {
    return (
        <>
            <div className={styles.luz} style={{ "--luz": luz } as CSSProperties} aria-hidden="true" />
            <header className={styles.cabecera}>
                <div className={styles.logo}><Logo compacto /></div>
                <div className={styles.barra}>{barra}</div>
            </header>
            <main className={styles.principal}>
                <MarcoGrilla>{children}</MarcoGrilla>
            </main>
            <footer className={styles.pie}>{pie}</footer>
        </>
    );
}
