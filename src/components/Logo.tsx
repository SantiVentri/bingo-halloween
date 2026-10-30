import styles from "./Logo.module.css";

// "BINGO" chorreado con "HALLOWEEN": grande en el inicio, compacto en el tablero
export default function Logo({ compacto = false }: { compacto?: boolean }) {
    return (
        <div className={compacto ? `${styles.logo} ${styles.compacto}` : styles.logo} role="img" aria-label="Bingo de Halloween">
            <span className={styles.bingo}>BINGO</span>
            <span className={styles.halloween}>HALLOWEEN</span>
        </div>
    );
}
