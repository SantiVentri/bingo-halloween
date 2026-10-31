import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

// Las fotos se suben directo del navegador a UploadThing; esta ruta solo firma la subida (T-02, NF-06)
export const routerSubidas = {
    // Una imagen por pedido, hasta 8 MB (NF-03)
    foto: f(
        { image: { maxFileSize: "8MB", maxFileCount: 1 } },
        // La subida se da por buena sin esperar el callback del servidor
        { awaitServerData: false },
    ).onUploadComplete(() => { }),
} satisfies FileRouter;

export type RouterSubidas = typeof routerSubidas;
