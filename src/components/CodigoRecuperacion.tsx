import styles from "./CodigoRecuperacion.module.css";
import BotonCopiar from "@/components/BotonCopiar";

type CodigoRecuperacionProps = {
    codigo: string;
};

// El código de recuperación con su botón para copiarlo (RF-03)
export default function CodigoRecuperacion({ codigo }: CodigoRecuperacionProps) {
    return (
        <div className={styles.codigoRecuperacion}>
            {/* user-select: all para copiarlo entero de un toque si el portapapeles no anda */}
            <code className={styles.codigo}>{codigo}</code>
            <BotonCopiar texto={codigo} etiqueta="Copiar código" />
        </div>
    );
}
