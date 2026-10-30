import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Boton.module.css";

type Variante = "primario" | "secundario" | "fantasma" | "peligro";

type BotonProps = {
    variante?: Variante;
    tamano?: "m" | "s";
    anchoCompleto?: boolean;
    icono?: ReactNode;
    // Con href se dibuja como link de Next
    href?: string;
    children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

// Botón único de la app: reemplaza a los estilos sueltos de cada pantalla
export default function Boton({
    variante = "primario",
    tamano = "m",
    anchoCompleto = false,
    icono,
    href,
    children,
    className,
    type = "button",
    ...resto
}: BotonProps) {
    const clases = [
        styles.boton,
        styles[variante],
        tamano === "s" && styles.chico,
        anchoCompleto && styles.anchoCompleto,
        className,
    ].filter(Boolean).join(" ");

    const contenido = (
        <>
            {icono && <span className={styles.icono} aria-hidden="true">{icono}</span>}
            <span>{children}</span>
        </>
    );

    if (href) {
        return <Link href={href} className={clases}>{contenido}</Link>;
    }
    return <button type={type} className={clases} {...resto}>{contenido}</button>;
}
