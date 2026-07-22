import { headerCompletoBase64 } from '@/lib/header-base64';
import jsPDF from 'jspdf';

/**
 * Dibuja el encabezado combinando la imagen base y texto vectorial (Altura: 25mm).
 */
export const drawPdfHeader = (doc: jsPDF) => {
  const pageWidth = doc.internal.pageSize.width;

  // --- 1. Definimos las nuevas dimensiones ---
  const headerY = 0;
  const headerWidth = pageWidth;
  const headerHeight = 31; // Altura aumentada un 25% para que el logo sea circular

  // --- 2. Añadimos el fondo usando tu variable original ---
  doc.addImage(headerCompletoBase64, 'PNG', 0, headerY, headerWidth, headerHeight);

};

export const drawPdfFooter = (doc: jsPDF, pageNumber: number, totalPages: number, individualId?: string | null) => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const verdeCorporativo = [22, 90, 48];

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - 15, pageHeight - 10, { align: 'right' });

  if (individualId) {
    doc.setFontSize(6);
    doc.setTextColor(150);
    doc.text(`Ref. Int: ${individualId}`, 15, pageHeight - 10);
  }

  doc.setFillColor(verdeCorporativo[0], verdeCorporativo[1], verdeCorporativo[2]);
  doc.rect(0, pageHeight - 5, pageWidth, 5, 'F');
};
