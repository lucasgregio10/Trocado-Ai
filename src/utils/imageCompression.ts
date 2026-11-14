const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;
const MAX_DIMENSION_PX = 1280;
const TARGET_MAX_BYTES = 600 * 1024; // 600 KB

export interface CompressedReceiptResult {
  blob: Blob;
  dataUrl: string;
  sizeBytes: number;
}

function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase();
  return (
    type === 'image/heic' ||
    type === 'image/heif' ||
    /\.(heic|heif)$/i.test(file.name)
  );
}

function validateImageFile(file: File): void {
  const mime = file.type.toLowerCase();
  const hasAllowedMime = mime ? ALLOWED_MIME_TYPES.has(mime) : false;
  const hasAllowedExt = ALLOWED_EXTENSIONS.test(file.name);

  if (!hasAllowedMime && !hasAllowedExt) {
    throw new Error(
      'Formato não suportado. Envie uma foto JPEG, PNG, WEBP ou HEIC.'
    );
  }
}

async function decodeImageSource(file: File): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fallback to HTMLImageElement below
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('decode_failed'));
      element.src = objectUrl;
    });
    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch {
    URL.revokeObjectURL(objectUrl);
    if (isHeicFile(file)) {
      throw new Error(
        'Este navegador não conseguiu converter a imagem HEIC. Tire outra foto ou converta para JPEG/PNG.'
      );
    }
    throw new Error('Não foi possível abrir a imagem selecionada. Tente outro arquivo.');
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Falha ao comprimir a imagem.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Não foi possível converter a imagem.'));
      }
    };
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem comprimida.'));
    reader.readAsDataURL(blob);
  });
}

export async function compressReceiptImage(file: File): Promise<CompressedReceiptResult> {
  validateImageFile(file);

  const source = await decodeImageSource(file);
  try {
    const maxSide = Math.max(source.width, source.height);
    const baseScale = maxSide > MAX_DIMENSION_PX ? MAX_DIMENSION_PX / maxSide : 1;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas indisponível neste navegador.');
    }

    const attempts: Array<{ scaleFactor: number; quality: number }> = [
      { scaleFactor: 1, quality: 0.8 },
      { scaleFactor: 1, quality: 0.68 },
      { scaleFactor: 0.8, quality: 0.6 },
      { scaleFactor: 0.65, quality: 0.55 },
    ];

    let finalBlob: Blob | null = null;

    for (const attempt of attempts) {
      const targetWidth = Math.max(1, Math.round(source.width * baseScale * attempt.scaleFactor));
      const targetHeight = Math.max(1, Math.round(source.height * baseScale * attempt.scaleFactor));
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      source.draw(ctx, targetWidth, targetHeight);

      const blob = await canvasToBlob(canvas, attempt.quality);
      finalBlob = blob;
      if (blob.size <= TARGET_MAX_BYTES) {
        break;
      }
    }

    if (!finalBlob) {
      throw new Error('Não foi possível comprimir a imagem.');
    }

    const dataUrl = await blobToDataUrl(finalBlob);

    return {
      blob: finalBlob,
      dataUrl,
      sizeBytes: finalBlob.size,
    };
  } finally {
    source.cleanup();
  }
}
