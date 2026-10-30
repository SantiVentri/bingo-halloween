import { Suspense } from "react";
import styles from "./page.module.css";
import EleccionFotos from "@/components/EleccionFotos";

export default function FinalizarPage() {
    return (
        <div className={styles.page}>
            <main className={styles.main}>
                {/* El jugador y las fotos viven en el navegador: se dibuja solo ahí */}
                <Suspense fallback={<p className={styles.cargando}>Cargando…</p>}>
                    <EleccionFotos />
                </Suspense>
            </main>
        </div>
    )
}
