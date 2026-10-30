'use client'

import { useEffect } from "react";

// Registra el service worker que permite abrir la app sin conexión (NF-14).
// Solo en producción: en desarrollo guardaría versiones viejas del código
export default function RegistrarServiceWorker() {
    useEffect(() => {
        if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
        navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => { });
    }, []);

    return null;
}
