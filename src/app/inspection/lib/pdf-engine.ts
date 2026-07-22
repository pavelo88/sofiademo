import { normalizeReportForPdf, renderImageGallery } from '@/lib/pdf-utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { drawPdfFooter, drawPdfHeader } from './pdf-helpers';

export const generatePDF = async (dataRaw: any, tecnico: string, reportID: string) => {
  const data = await normalizeReportForPdf(dataRaw);
  const doc = new jsPDF();
  drawPdfHeader(doc); // Llama a la cabecera corregida arriba

  const finalID = reportID || 'BORRADOR';
  const marginX = 15;
  let currentY = 40;

  // Colores consistentes
  const brandGreen = [16, 185, 129];
  const deepGray = [30, 41, 59];

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(deepGray[0], deepGray[1], deepGray[2]);
  doc.text(`HOJA DE TRABAJO: ${finalID}`, marginX, currentY);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  currentY += 8;
  doc.text(`Cliente: ${data.clienteNombre || data.cliente || 'No asignado'}`, marginX, currentY);
  doc.text(`Fecha: ${data.fecha || new Date().toLocaleDateString()}`, 150, currentY);

  const p = data.parametrosTecnicos || {};

  (doc as any).autoTable({
    startY: currentY + 10,
    margin: { left: marginX },
    head: [['PARÁMETRO INSPECTOR', 'VALOR MEDIDO']],
    body: [
      ['Presión de Aceite', (p.presionAceite || '-') + ' Bar'],
      ['Temperatura', (p.temperatura || '-') + ' ºC'],
      ['Tensión de Baterías', (p.tensionBaterias || '-') + ' Vdc'],
      ['Horas de Operación', (p.horas || '0') + ' H'],
    ],
    theme: 'grid',
    headStyles: { fillColor: brandGreen, textColor: [255, 255, 255] }, // Cabecera Verde
    styles: { fontSize: 8 }
  });

  const lastY = (doc as any).lastAutoTable.finalY;

  (doc as any).autoTable({
    startY: lastY + 10,
    margin: { left: marginX },
    head: [['PRUEBA ELÉCTRICA CON CARGA', 'VALOR']],
    body: [
      ['Tensión RS / ST / RT', `${data.potenciaConCarga?.tensionRS || '-'}V`],
      ['Potencia Activa', (data.potenciaConCarga?.potenciaKW || '-') + ' kW'],
    ],
    theme: 'striped',
    headStyles: { fillColor: deepGray, textColor: [255, 255, 255] }, // Cabecera Gris
    styles: { fontSize: 8 }
  });

  // --- REGISTRO FOTOGRÁFICO ---
  if (data.imageUrls && data.imageUrls.length > 0) {
    renderImageGallery(doc, data.imageUrls);
  }

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPdfFooter(doc, i, totalPages);
  }

  return doc;
};