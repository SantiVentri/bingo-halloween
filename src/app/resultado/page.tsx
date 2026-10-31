import { Suspense } from "react";
import type { Metadata } from "next";
import styles from "./page.module.css";
import Resultado from "@/components/Resultado";

export const metadata: Metadata = {
    title: "Resultado · Bingo de Halloween",
};

export default function ResultadoPage() {
    return (
        <div className={styles.page}>
            <main className={styles.main}>
                {/* La sesión de Supabase vive en el navegador: se dibuja solo ahí */}
                <Suspense fallback={<p className={styles.cargando}>Cargando…</p>}>
                    <Resultado />
                </Suspense>
            </main>
        </div>
    )
}
