export async function getCroppedImageBlob(
  imageSrc: string,
  cropPixels: { x: number; y: number; width: number; height: number },
  maxOutputSize = 1024
): Promise<Blob> {
  const image = await loadImage(imageSrc)
  // Don't upscale beyond the actual source crop — preserves sharpness.
  const outputSize = Math.min(maxOutputSize, Math.floor(Math.min(cropPixels.width, cropPixels.height)))
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    outputSize,
    outputSize
  )

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      0.95
    )
  })
}

// Types that browsers and next/image render reliably without re-encoding.
// GIF is here and also skipped unconditionally below — a canvas re-encode
// flattens it to a single frame.
const RENDER_SAFE = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
const DOWNSCALE_THRESHOLD = 2 * 1024 * 1024

/**
 * Whether an upload should be re-encoded client-side. Pure — no DOM — so the
 * decision is testable on its own.
 */
export function needsDownscale(type: string, size: number): boolean {
  // Re-encoding an animated GIF would drop every frame but the first.
  if (type === 'image/gif') return false
  // HEIC/HEIF and friends upload fine but render broken, so convert at any size.
  if (!RENDER_SAFE.includes(type)) return true
  return size > DOWNSCALE_THRESHOLD
}

/**
 * Aspect-preserving downscale to a JPEG blob. Never upscales.
 * Throws if the browser can't decode the file (e.g. HEIC outside Safari).
 */
export async function downscaleImageBlob(
  file: File,
  maxDimension = 2048,
  quality = 0.85
): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.naturalWidth * scale)
    canvas.height = Math.round(image.naturalHeight * scale)
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
        'image/jpeg',
        quality
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = src
  })
}
