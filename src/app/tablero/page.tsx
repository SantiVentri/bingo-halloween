import { Suspense } from "react";
import styles from "./page.module.css";
import MarcoTablero from "@/components/MarcoTablero";
import TableroDelJugador from "@/components/TableroDelJugador";

export default function TableroPage() {
    return (
        <div className={styles.pantalla}>
            {/* El jugador vive en localStorage: el tablero se dibuja solo en el navegador.
                Mientras tanto se ve el póster en el mismo lugar, sin saltos */}
            <Suspense fallback={<MarcoTablero />}>
                <TableroDelJugador />
            </Suspense>
        </div>
    )
}
