'use client'

import { useMemo, useSyncExternalStore } from "react";
import { leerAlmacen, suscribirAlmacen } from "@/lib/almacen";
import { claveEleccion, interpretarEleccion, type Eleccion } from "@/lib/eleccion";
import { claveCambios, interpretarCambios } from "@/lib/cambios";
import type { Cambio } from "@/lib/tablero";

// Lee una clave de localStorage y se actualiza cuando cambia, aunque la
// pantalla haya quedado oculta por Next al navegar
function useTextoGuardado(clave: string): string | null {
    return useSyncExternalStore(suscribirAlmacen, () => leerAlmacen(clave), () => null);
}

export function useEleccion(uuid: string): Eleccion {
    const texto = useTextoGuardado(claveEleccion(uuid));
    return useMemo(() => interpretarEleccion(texto), [texto]);
}

export function useCambios(uuid: string): Cambio[] {
    const texto = useTextoGuardado(claveCambios(uuid));
    return useMemo(() => interpretarCambios(texto), [texto]);
}
