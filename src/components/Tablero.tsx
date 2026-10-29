import styles from "./Tablero.module.css";

export default function Tablero() {
    return (
        <div className={styles.tablero}>
            <div className={styles.celda}></div>
            <div className={styles.celda}></div>
            <div className={styles.celda}></div>
            <div className={styles.celda}></div>
            <div className={styles.celda}></div>
            <div className={styles.celda}></div>
            <div className={styles.celda}></div>
            <div className={styles.celda}></div>
            <div className={styles.celda}></div>
        </div>
    );
}