import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

async function testPdf() {
  const testPdfPath = process.argv[2] || '/tmp/test.pdf';
  if (!fs.existsSync(testPdfPath)) {
    console.log('PDF not found:', testPdfPath);
    return;
  }
  
  try {
    const dataBuffer = fs.readFileSync(testPdfPath);
    const pdfDocument = await pdfjsLib.getDocument({ 
      data: new Uint8Array(dataBuffer),
      useSystemFonts: true
    }).promise;
    
    console.log('Pages:', pdfDocument.numPages);
    let fullText = '';
    
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const items = textContent.items.map((item) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5]
      })).sort((a, b) => {
        if (Math.abs(b.y - a.y) > 3) return b.y - a.y;
        return a.x - b.x;
      });
      
      let pageText = '';
      let lastY = null;
      for (const item of items) {
        if (lastY !== null && Math.abs(lastY - item.y) > 3) {
          pageText += '\n';
        } else if (lastY !== null) {
          pageText += ' ';
        }
        pageText += item.str;
        lastY = item.y;
      }
      fullText += pageText + '\n\n';
    }
    
    console.log('Extracted text length:', fullText.length);
    console.log('First 200 chars:', fullText.substring(0, 200));
  } catch (e) {
    console.error('PDF ERROR:', e.message);
    console.error(e.stack);
  }
}

testPdf();
