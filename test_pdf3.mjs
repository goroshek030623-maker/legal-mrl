import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "fs";

const filePath = "/var/www/legal-mrl/uploads/ae57986d8bde67a4af5ffb06e751c88d";
console.log("Testing PDF:", filePath);

try {
  const dataBuffer = await fs.promises.readFile(filePath);
  console.log("File size:", dataBuffer.length);
  
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(dataBuffer) });
  const pdfDocument = await loadingTask.promise;
  console.log("PDF loaded, pages:", pdfDocument.numPages);
  
  let fullText = "";
  for (let i = 1; i <= pdfDocument.numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(" ");
    fullText += pageText + "\n";
  }
  console.log("Text extracted, length:", fullText.length);
  console.log("First 200 chars:", fullText.substring(0, 200));
} catch (e) {
  console.error("Error:", e.message);
  console.error("Stack:", e.stack);
}
