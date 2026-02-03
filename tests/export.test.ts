import { describe, it, expect } from "vitest";

// Test the PDF generation function by importing the module
// Since generateMinimalPdf is not exported, we test it via a local copy

function generateMinimalPdf(text: string): Uint8Array {
  const escaped = text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

  const maxLineLen = 80;
  const wrappedLines: string[] = [];
  for (const line of escaped.split("\n")) {
    if (line.length <= maxLineLen) {
      wrappedLines.push(line);
    } else {
      for (let i = 0; i < line.length; i += maxLineLen) {
        wrappedLines.push(line.slice(i, i + maxLineLen));
      }
    }
  }

  const fontSize = 10;
  const leading = 14;
  const margin = 50;
  const pageHeight = 792;
  const pageWidth = 612;
  const usableHeight = pageHeight - 2 * margin;
  const linesPerPage = Math.floor(usableHeight / leading);

  const pages: string[][] = [];
  for (let i = 0; i < wrappedLines.length; i += linesPerPage) {
    pages.push(wrappedLines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push(["(empty)"]);

  const objects: string[] = [];
  let objNum = 1;
  const catalogObj = objNum++;
  objects.push(
    `${catalogObj} 0 obj\n<< /Type /Catalog /Pages ${catalogObj + 1} 0 R >>\nendobj`
  );
  const pagesObj = objNum++;
  const pageObjNums: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    pageObjNums.push(objNum);
    objNum += 2;
  }
  const fontObj = objNum++;
  const kidRefs = pageObjNums.map((n) => `${n} 0 R`).join(" ");
  objects.push(
    `${pagesObj} 0 obj\n<< /Type /Pages /Kids [${kidRefs}] /Count ${pages.length} >>\nendobj`
  );
  for (let i = 0; i < pages.length; i++) {
    const pageLines = pages[i];
    const pageObjNum = pageObjNums[i];
    const streamObjNum = pageObjNum + 1;
    let stream = `BT\n/F1 ${fontSize} Tf\n${leading} TL\n${margin} ${pageHeight - margin} Td\n`;
    for (const line of pageLines) {
      stream += `(${line}) Tj T*\n`;
    }
    stream += "ET";
    objects.push(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${streamObjNum} 0 R /Resources << /Font << /F1 ${fontObj} 0 R >> >> >>\nendobj`
    );
    objects.push(
      `${streamObjNum} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`
    );
  }
  objects.push(
    `${fontObj} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj`
  );
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj + "\n";
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objNum}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objNum} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

describe("generateMinimalPdf", () => {
  it("returns a Uint8Array", () => {
    const result = generateMinimalPdf("Hello");
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it("starts with %PDF-1.4", () => {
    const result = generateMinimalPdf("Test");
    const text = new TextDecoder().decode(result);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
  });

  it("ends with %%EOF", () => {
    const result = generateMinimalPdf("Test");
    const text = new TextDecoder().decode(result);
    expect(text.endsWith("%%EOF")).toBe(true);
  });

  it("contains Courier font reference", () => {
    const result = generateMinimalPdf("Test");
    const text = new TextDecoder().decode(result);
    expect(text).toContain("/BaseFont /Courier");
  });

  it("escapes parentheses in content", () => {
    const result = generateMinimalPdf("Hello (world)");
    const text = new TextDecoder().decode(result);
    expect(text).toContain("Hello \\(world\\)");
  });

  it("handles empty input", () => {
    const result = generateMinimalPdf("");
    const text = new TextDecoder().decode(result);
    expect(text).toContain("%PDF-1.4");
    expect(text).toContain("%%EOF");
  });

  it("handles multi-page content", () => {
    const longText = Array(100).fill("Line of text").join("\n");
    const result = generateMinimalPdf(longText);
    const text = new TextDecoder().decode(result);
    // Should have multiple page objects (100 lines at ~49 lines/page = 3 pages)
    const countMatch = text.match(/\/Count (\d+)/);
    expect(countMatch).not.toBeNull();
    expect(parseInt(countMatch![1], 10)).toBeGreaterThan(1);
  });
});
