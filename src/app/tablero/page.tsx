import Image from "next/image";
import styles from "./page.module.css";
import Tablero from "@/components/Tablero";

export default function TableroPage() {
    return (
        <div className={styles.page}>
            <Image src="/Bingo Halloween.jpg" alt="Tablero"
                width={392}
                height={600}
                className={styles.imagen}
            />
            <main className={styles.main}>
                <Tablero />
            </main>
        </div>
    )
}