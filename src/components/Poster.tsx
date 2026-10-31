import Image from "next/image";
import type { ReactNode } from "react";
import styles from "./Poster.module.css";

// El póster del bingo (JPG) ocupando todo el lugar disponible sin deformarse.
// Lo que va encima (grilla, botón de Finalizar) se ubica en % sobre la imagen
export default function Poster({ children }: { children?: ReactNode }) {
    return (
        <div className={styles.escenario}>
            <div className={styles.poster}>
                <Image
                    src="/Bingo Halloween.jpg"
                    alt="Halloween Bingo"
                    width={1414}
                    height={2000}
                    sizes="(max-width: 600px) 100vw, 600px"
                    preload
                    className={styles.imagen}
                />
                {children}
            </div>
        </div>
    );
}
