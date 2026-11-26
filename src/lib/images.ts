type Options = { maxSide: number; quality?: number; square?: boolean }

/**
 * Redimensiona y comprime una imagen a JPEG en el navegador (sin dependencias).
 * JPEG y no WebP: Safari no codifica WebP desde canvas.
 * `square` recorta al centro. Lanza si el navegador no sabe decodificar el archivo (p. ej. HEIC en Chrome).
 */
export async function resizeToJpeg(
  file: File,
  { maxSide, quality = 0.82, square = false }: Options,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const sw = square ? Math.min(bitmap.width, bitmap.height) : bitmap.width
    const sh = square ? sw : bitmap.height
    const sx = (bitmap.width - sw) / 2
    const sy = (bitmap.height - sh) / 2
    const scale = Math.min(1, maxSide / Math.max(sw, sh))
    const width = Math.round(sw * scale)
    const height = Math.round(sh * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas no disponible')
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height)

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo comprimir la imagen'))), 'image/jpeg', quality),
    )
    return { blob, width, height }
  } finally {
    bitmap.close()
  }
}
