import { Suspense } from "react";
import styles from "./page.module.css";
import Ingreso from "@/components/Ingreso";
import Logo from "@/components/Logo";
import Calabaza from "@/components/ilustraciones/Calabaza";
import Murcielago from "@/components/ilustraciones/Murcielago";

export default function Home() {
  return (
    <div className={styles.pantalla}>
      <div className={styles.portada}>
        <Calabaza className={styles.calabaza} />
        <Murcielago className={styles.murcielago} />
        <Logo />
      </div>
      <main className={styles.contenido}>
        {/* El jugador vive en localStorage: el ingreso se dibuja solo en el navegador */}
        <Suspense fallback={<p className={styles.cargando}>Cargando…</p>}>
          <Ingreso />
        </Suspense>
      </main>
    </div>
  );
}
