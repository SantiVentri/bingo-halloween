import { Ghost } from "lucide-react";
import PantallaMensaje from "@/components/ui/PantallaMensaje";
import Boton from "@/components/ui/Boton";

// Se muestra en vez de redirigir cuando todavía no hay jugador en este dispositivo
export default function SinJugador() {
    return (
        <PantallaMensaje
            icono={<Ghost />}
            titulo="Todavía no entraste"
            texto="Primero poné tu nombre para recibir tu tablero."
            accion={<Boton href="/">Ir al inicio</Boton>}
        />
    );
}
