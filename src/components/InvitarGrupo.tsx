'use client'

import { Share2 } from "lucide-react";
import styles from "./InvitarGrupo.module.css";
import Boton from "@/components/ui/Boton";
import BotonCopiar from "@/components/BotonCopiar";
import { linkDeInvitacion } from "@/lib/jugador";

type InvitarGrupoProps = {
    codigo: string;
};

// Código del grupo con el link de invitación: se comparte con el menú del celular
// o, si no hay, se copia
export default function InvitarGrupo({ codigo }: InvitarGrupoProps) {
    const link = linkDeInvitacion(codigo);
    const puedeCompartir = typeof navigator.share === "function";

    async function compartir() {
        try {
            await navigator.share({
                title: "Bingo de Halloween",
                text: `¡Sumate a mi grupo del Bingo de Halloween! Código: ${codigo}`,
                url: link,
            });
        } catch {
            // Se cerró el menú de compartir sin elegir nada
        }
    }

    return (
        <div className={styles.invitar}>
            {/* user-select: all para copiarlo de un toque si el portapapeles no anda */}
            <code className={styles.codigo} aria-label={`Código del grupo: ${codigo.split("").join(" ")}`}>{codigo}</code>
            {puedeCompartir && (
                <Boton anchoCompleto icono={<Share2 />} onClick={compartir}>Invitar amigos</Boton>
            )}
            <BotonCopiar texto={link} etiqueta="Copiar link de invitación" />
        </div>
    );
}
