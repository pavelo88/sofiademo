export const getPdfFileName = (reportId?: string | null) => {
  const baseId = typeof reportId === 'string' && reportId.trim() ? reportId.trim() : 'BORRADOR';
  const safeId = baseId.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
  return `${safeId}.pdf`;
};

export type PdfImageFormat = 'PNG' | 'JPEG' | 'WEBP';

export const getInlineImageDataUrl = (imageValue: unknown): string | null => {
  if (typeof imageValue !== 'string') return null;
  const trimmed = imageValue.trim();
  if (!trimmed) return null;
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed) ? trimmed : null;
};

const getPdfImageFormat = (dataUrl: string): PdfImageFormat => {
  if (typeof dataUrl !== 'string') return 'PNG';
  const mimeMatch = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
  const mime = (mimeMatch?.[1] || '').toLowerCase();
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'JPEG';
  if (mime.includes('webp')) return 'WEBP';
  return 'PNG';
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(blob);
  });

export const resolveImageToDataUrl = async (imageValue: unknown, quality = 0.7): Promise<string | null> => {
  const inline = getInlineImageDataUrl(imageValue);
  if (inline) return inline;

  if (typeof imageValue !== 'string') {
    if (imageValue instanceof File || imageValue instanceof Blob) {
      // Si es un archivo local, lo pasamos por canvas para redimensionar/comprimir
      const dataUrl = await blobToDataUrl(imageValue);
      return compressImageDataUrl(dataUrl, quality);
    }
    return null;
  }
  const source = imageValue.trim();
  if (!/^https?:\/\//i.test(source)) return null;

  try {
    const response = await fetch(source, { mode: 'cors' });
    if (response.ok) {
      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      return compressImageDataUrl(dataUrl, quality);
    }
  } catch (error) {
    console.warn('No se pudo descargar la imagen remota, intentamos con canvas:', error);
  }

  // Intento vía Canvas para redimensionar/comprimir y evitar PDFs gigantes
  return compressImageDataUrl(source, quality, true);
};

/**
 * Auxiliar para comprimir imágenes y evitar que el PDF pese demasiado
 */
export const compressImageDataUrl = (source: string, quality = 0.7, isUrl = false): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    if (isUrl) img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        // Redimensionamos si es muy grande (max 1200px) para ahorrar espacio
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height / width) * maxDim;
            width = maxDim;
          } else {
            width = (width / height) * maxDim;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Usamos JPEG para fotos para reducir drásticamente el peso
          resolve(canvas.toDataURL("image/jpeg", quality));
          return;
        }
      } catch (e) {
        console.error("Error comprimiendo imagen:", e);
      }
      resolve(source); // Fallback al original si falla
    };
    img.onerror = () => {
      resolve(source); // Fallback al original si falla
    };
    img.src = source;
  });
};

type PdfReportLike = Record<string, any> & {
  inspectorSignatureUrl?: unknown;
  inspectorSignature?: unknown;
  clientSignatureUrl?: unknown;
  clientSignature?: unknown;
  imageUrls?: unknown[];
};

export const normalizeReportForPdf = async <T extends PdfReportLike>(report: T): Promise<T> => {
  const normalized = { ...report } as T;
  const inspectorSource = report.inspectorSignatureUrl || report.inspectorSignature || '';
  const clientSource = report.clientSignatureUrl || report.clientSignature || '';

  normalized.inspectorSignatureUrl = await resolveImageToDataUrl(inspectorSource);
  normalized.clientSignatureUrl = await resolveImageToDataUrl(clientSource);

  if (Array.isArray(report.imageUrls) && report.imageUrls.length > 0) {
    const resolved = await Promise.all(report.imageUrls.map((url: unknown) => resolveImageToDataUrl(url)));
    normalized.imageUrls = resolved.filter((item): item is string => !!item);
  }

  return normalized;
};

export const addImageSafely = (
  doc: { addImage: (imageData: string, format: PdfImageFormat, x: number, y: number, width: number, height: number) => void },
  imageValue: unknown,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  const imageDataUrl = getInlineImageDataUrl(imageValue);
  if (!imageDataUrl) return false;

  try {
    doc.addImage(imageDataUrl, getPdfImageFormat(imageDataUrl), x, y, width, height);
    return true;
  } catch (error) {
    console.warn('No se pudo insertar imagen en PDF:', error);
    return false;
  }
};

export const addPngImageSafely = (
  doc: { addImage: (imageData: string, format: PdfImageFormat, x: number, y: number, width: number, height: number) => void },
  imageValue: unknown,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  return addImageSafely(doc, imageValue, x, y, width, height);
};

/**
 * Renders a gallery of images at the end of the PDF.
 */
export const renderImageGallery = (doc: any, imageUrls: any[], title = 'REGISTRO FOTOGRÁFICO') => {
  if (!imageUrls || imageUrls.length === 0) return;

  const pageWidth = doc.internal.pageSize.width;
  const margin = 15;
  const imagesPerPage = 4;
  const imgWidth = (pageWidth - (margin * 3)) / 2;
  const imgHeight = 80; // Altura fija para mantener consistencia
  const darkColor = '#165a30';

  let currentY = 0;

  imageUrls.forEach((url, index) => {
    // Si es el inicio o toca nueva página
    if (index % imagesPerPage === 0) {
      doc.addPage();
      currentY = 40; // Espacio para el header

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(darkColor);
      doc.text(title, margin, currentY);
      currentY += 10;
    }

    // Si es el segundo de la página (index impar en el %2) pero el segundo en el eje Y
    // En realidad con 2 por página, si index es impar va a la derecha, si es par va a la izquierda.
    // Con imagesPerPage = 2, solo usamos una "fila" por página o queremos 4 por página?
    // Pongamos 4 por página (2 columnas x 2 filas) para aprovechar mejor el espacio.
    const imagesPerRow = 2;
    const rowsPerPage = 2;
    const totalPerPage = imagesPerRow * rowsPerPage;
    
    const pageIndex = index % totalPerPage;
    const row = Math.floor(pageIndex / imagesPerRow);
    const column = pageIndex % imagesPerRow;

    const posX = margin + (column * (imgWidth + margin));
    const posY = 50 + (row * (imgHeight + 15));

    const added = addImageSafely(doc, url, posX, posY, imgWidth, imgHeight);
    if (!added) {
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.rect(posX, posY, imgWidth, imgHeight);
      doc.text("Imagen no disponible", posX + (imgWidth / 4), posY + (imgHeight / 2));
    }
  });
};
