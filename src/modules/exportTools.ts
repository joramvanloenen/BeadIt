import { jsPDF } from 'jspdf';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function svgToPngBlob(svg: string, width: number, height: number): Promise<Blob> {
  const encoded = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(encoded);

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to load SVG for export'));
    img.src = objectUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(objectUrl);
    throw new Error('Unable to create canvas context');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  URL.revokeObjectURL(objectUrl);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
  if (!blob) {
    throw new Error('Unable to export PNG');
  }
  return blob;
}

export async function exportSvgAsPng(svg: string, width: number, height: number, filename: string): Promise<void> {
  const blob = await svgToPngBlob(svg, width, height);
  downloadBlob(blob, filename);
}

export async function exportSvgAsPdf(
  svg: string,
  width: number,
  height: number,
  filename: string,
  textLines?: string[]
): Promise<void> {
  const pngBlob = await svgToPngBlob(svg, width, height);
  const pngDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read PNG data for PDF export'));
    reader.readAsDataURL(pngBlob);
  });

  const doc = new jsPDF({
    orientation: width > height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [width, height]
  });

  doc.addImage(pngDataUrl, 'PNG', 0, 0, width, height);

  if (textLines && textLines.length > 0) {
    const pageW = 595;
    const pageH = 842;
    doc.addPage([pageW, pageH], 'portrait');
    const marginX = 48;
    const lineHeight = 16;
    let y = 60;
    doc.setFont('helvetica', 'normal');
    for (const line of textLines) {
      if (line === '' ) {
        y += lineHeight * 0.5;
        continue;
      }
      if (line.startsWith('##')) {
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(line.slice(2).trim(), marginX, y);
        doc.setFont('helvetica', 'normal');
      } else {
        doc.setFontSize(10);
        const wrapped = doc.splitTextToSize(line, pageW - marginX * 2) as string[];
        for (const segment of wrapped) {
          if (y > pageH - 48) {
            doc.addPage([pageW, pageH], 'portrait');
            y = 60;
          }
          doc.text(segment, marginX, y);
          y += lineHeight;
        }
      }
      y += lineHeight * 0.15;
      if (y > pageH - 48) {
        doc.addPage([pageW, pageH], 'portrait');
        y = 60;
      }
    }
  }

  doc.save(filename);
}
