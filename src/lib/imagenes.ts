// Compresión en el navegador antes de subir (NF-02, NF-03)
const LADO_MAXIMO = 1600;
const CALIDAD_JPEG = 0.8;

export const TAMANO_MAXIMO = 8 * 1024 * 1024;

// Achica la foto a 1600 px de lado máximo en JPEG. Si el navegador no puede
// decodificarla (por ejemplo, un formato raro), devuelve la original
export async function comprimirImagen(archivo: File): Promise<Blob> {
  try {
    const imagen = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(imagen.width * escala);
    canvas.height = Math.round(imagen.height * escala);
    canvas.getContext("2d")?.drawImage(imagen, 0, 0, canvas.width, canvas.height);
    imagen.close();

    const comprimida = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", CALIDAD_JPEG),
    );
    if (comprimida) return comprimida;
  } catch {
    // Se sigue con la original
  }
  return archivo;
}
