import styles from "./CodigoRecuperacion.module.css";
import BotonCopiar from "@/components/BotonCopiar";

type CodigoRecuperacionProps = {
    codigo: string;
};

// Muestra el código con el aviso para guardarlo (RF-03)
export default function CodigoRecuperacion({ codigo }: CodigoRecuperacionProps) {
    return (
        <div className={styles.codigoRecuperacion}>
            <p className={styles.aviso}>
                Guardá este código (por ejemplo, mandátelo por WhatsApp). Si borrás
                los datos del navegador o cambiás de celular, es la única forma de
                recuperar tu tablero.
            </p>
            <code className={styles.codigo}>{codigo}</code>
            <BotonCopiar texto={codigo} etiqueta="Copiar código" />
        </div>
    );
}
