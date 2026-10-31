import type { ReactNode } from "react";
import styles from "./MarcoTablero.module.css";
import Poster from "@/components/Poster";

type MarcoTableroProps = {
    barra?: ReactNode;
    pie?: ReactNode;
    // Lo que va encima del póster
    children?: ReactNode;
};

// Barra arriba, póster en el medio y barra abajo. Las barras tienen alto fijo
// para que el póster no cambie de tamaño al cargar ni al cambiar el estado
export default function MarcoTablero({ barra, pie, children }: MarcoTableroProps) {
    return (
        <>
            <header className={styles.barra}>{barra}</header>
            <main className={styles.principal}>
                <Poster>{children}</Poster>
            </main>
            <footer className={styles.pie}>{pie}</footer>
        </>
    );
}
