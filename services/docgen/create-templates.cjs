const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const fs = require('fs');
const path = require('path');

const templatesDir = '/var/www/legal-mrl/templates';
if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir, { recursive: true });

const templates = {
  'isk.docx': { title: 'ИСКОВОЕ ЗАЯВЛЕНИЕ', content: '{content}' },
  'pretensiya.docx': { title: 'ПРЕТЕНЗИЯ', content: '{content}' },
  'dogovor.docx': { title: 'ДОГОВОР', content: '{content}' },
  'spravka.docx': { title: 'СПРАВКА', content: '{content}' },
  'default.docx': { title: 'ДОКУМЕНТ', content: '{content}' },
};

for (const [filename, data] of Object.entries(templates)) {
  const zip = new PizZip();
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/><w:jc w:val="center"/></w:pPr>
      <w:r><w:t>${data.title}</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>${data.content}</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;
  
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  
  zip.file('[Content_Types].xml', ct);
  zip.file('_rels/.rels', rels);
  zip.file('word/document.xml', xml);
  
  const buf = zip.generate({ type: 'nodebuffer' });
  fs.writeFileSync(path.join(templatesDir, filename), buf);
  console.log('Created', filename);
}
