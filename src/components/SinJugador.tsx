import Link from "next/link";
import styles from "./SinJugador.module.css";

// Se muestra en vez de redirigir cuando todavía no hay jugador en este dispositivo
export default function SinJugador() {
    return (
        <div className={styles.sinJugador}>
            <p>Primero tenés que entrar con tu nombre.</p>
            <Link href="/" className={styles.boton}>Ir al inicio</Link>
        </div>
    );
}
