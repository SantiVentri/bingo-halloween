import { Suspense } from "react";
import type { Metadata } from "next";
import styles from "./page.module.css";
import RevisionGrupo from "@/components/RevisionGrupo";

export const metadata: Metadata = {
    title: "Revisión · Bingo de Halloween",
};

export default function RevisionPage() {
    return (
        <div className={styles.page}>
            <main className={styles.main}>
                {/* Los votos viven en el localStorage de este dispositivo: se dibuja solo en el navegador */}
                <Suspense fallback={<p className={styles.cargando}>Cargando…</p>}>
                    <RevisionGrupo />
                </Suspense>
            </main>
        </div>
    )
}
