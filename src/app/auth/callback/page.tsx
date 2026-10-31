import { Suspense } from "react";
import type { Metadata } from "next";
import styles from "../../page.module.css";
import CompletarIngreso from "@/components/CompletarIngreso";
import Logo from "@/components/Logo";

export const metadata: Metadata = {
    title: "Entrando · Bingo de Halloween",
};

// Vuelta de Google: el cliente de Supabase canjea el código por la sesión
export default function CallbackPage() {
    return (
        <div className={styles.pantalla}>
            <div className={styles.portada}>
                <Logo />
            </div>
            <main className={styles.contenido}>
                {/* La sesión vive en el navegador: se completa solo ahí */}
                <Suspense fallback={<p className={styles.cargando}>Entrando…</p>}>
                    <CompletarIngreso />
                </Suspense>
            </main>
        </div>
    );
}
