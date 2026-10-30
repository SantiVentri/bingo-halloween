import { Suspense } from "react";
import styles from "./page.module.css";
import Ingreso from "@/components/Ingreso";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        {/* El jugador vive en localStorage: el ingreso se dibuja solo en el navegador */}
        <Suspense fallback={<p className={styles.cargando}>Cargando…</p>}>
          <Ingreso />
        </Suspense>
      </main>
    </div>
  );
}
