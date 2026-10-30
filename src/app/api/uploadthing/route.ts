import { createRouteHandler } from "uploadthing/next";
import { routerSubidas } from "./core";

// Usa UPLOADTHING_TOKEN de las variables de entorno
export const { GET, POST } = createRouteHandler({ router: routerSubidas });
