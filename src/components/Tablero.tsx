import styles from "./Tablero.module.css";
import { generarTablero } from "@/lib/tablero";

type TableroProps = {
    uuid: string;
};

export default function Tablero({ uuid }: TableroProps) {
    const categorias = generarTablero(uuid);

    return (
        <ul className={styles.tablero} aria-label="Tablero de bingo">
            {categorias.map((categoria) => (
                <li key={categoria} className={styles.celda}>
                    <span className={styles.categoria}>{categoria}</span>
                </li>
            ))}
        </ul>
    );
}
