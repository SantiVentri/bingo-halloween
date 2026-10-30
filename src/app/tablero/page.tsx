import { Suspense } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import TableroDelJugador from "@/components/TableroDelJugador";

export default function TableroPage() {
    return (
        <div className={styles.page}>
            <main className={styles.poster}>
                <Image src="/Bingo Halloween.jpg" alt="Halloween Bingo"
                    width={1414}
                    height={2000}
                    sizes="(max-width: 600px) 100vw, 600px"
                    preload
                    className={styles.imagen}
                />
                {/* El jugador vive en localStorage: esta parte se dibuja solo en el navegador */}
                <Suspense>
                    <TableroDelJugador />
                </Suspense>
            </main>
        </div>
    )
}
