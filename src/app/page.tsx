import { Suspense } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import Ingreso from "@/components/Ingreso";

export default function Home() {
  return (
    <div className={styles.pantalla}>
      {/* La parte de arriba del póster: título, calabaza y fantasma */}
      <div className={styles.portada}>
        <Image
          src="/Bingo Halloween.jpg"
          alt="Halloween Bingo"
          width={1414}
          height={2000}
          sizes="(max-width: 520px) 100vw, 520px"
          preload
          className={styles.imagen}
        />
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
