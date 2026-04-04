/**
 * Watermark utilities for exports (print, Excel, CSV).
 * Uses the TODAY logo as a background watermark.
 */

const LOGO_URL = "/logo.png";

/** Returns CSS + HTML for a watermark background in print pages */
export function getPrintWatermarkStyles(): string {
  return `
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      opacity: 0.06;
      pointer-events: none;
      z-index: -1;
    }
    .watermark img {
      width: 600px;
      height: auto;
    }
    @media print {
      .watermark {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        opacity: 0.06;
        z-index: -1;
      }
      .watermark img {
        width: 600px;
        height: auto;
      }
    }
  `;
}

/** Returns the watermark HTML element string */
export function getPrintWatermarkHtml(): string {
  return `<div class="watermark"><img src="${LOGO_URL}" alt="" /></div>`;
}

/**
 * Opens a print window with watermark background.
 * @param title Document title
 * @param subtitle Optional subtitle line (e.g. author + date)
 * @param tableHtml The HTML table content
 */
export function printWithWatermark(title: string, subtitle: string, tableHtml: string): void {
  const pw = window.open("", "_blank");
  if (!pw) return;
  pw.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      @page { size: landscape; margin: 1cm; }
      body { margin: 20px; position: relative; }
      ${getPrintWatermarkStyles()}
    </style></head><body>
    ${getPrintWatermarkHtml()}
    ${subtitle ? `<p style="font-family:Arial,sans-serif;font-size:11px;color:#666;margin-bottom:16px;">${subtitle}</p>` : ""}
    ${tableHtml}
  </body></html>`);
  pw.document.close();
  pw.print();
}

/**
 * Loads the logo as a base64 data URI (for Excel embedding).
 * Returns a promise that resolves to the base64 string.
 */
export async function getLogoBase64(): Promise<string> {
  try {
    const res = await fetch(LOGO_URL);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

/**
 * Adds a watermark sheet to an XLSX workbook.
 * Inserts a "TODAY" branding sheet at the end with centered text.
 */
export function addExcelWatermarkSheet(XLSX: any, wb: any): void {
  const wsData = [
    [""],
    [""],
    [""],
    [""],
    ["", "", "", "TODAY Education"],
    ["", "", "", "Учебный центр TODAY"],
    ["", "", "", `Экспортировано: ${new Date().toLocaleDateString("ru-RU")} ${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`],
    [""],
    ["", "", "", "Данный документ создан в системе TODAY CRM"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws, "TODAY");
}
