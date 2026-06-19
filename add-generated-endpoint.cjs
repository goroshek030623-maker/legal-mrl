// Скрипт для добавления endpoint /api/generated/:id
// Запускать: node add-generated-endpoint.js

const fs = require('fs');
const path = require('path');

const serverPath = '/var/www/legal-mrl/api/server.ts';
let content = fs.readFileSync(serverPath, 'utf8');

// Найдем место после endpoint save-generated-doc и добавим новый endpoint
const insertMarker = `// Serve static files from production dist`;

const newEndpoint = `
// Скачивание сгенерированного документа как .docx
app.get('/api/generated/:id', authMiddleware, async (req, res) => {
  try {
    const caseId = req.params.id
    
    const caseData = await db.select().from(cases).where(eq(cases.id, caseId))
    if (!caseData.length) {
      return res.status(404).json({ error: 'Case not found' })
    }
    
    const c = caseData[0]
    
    if (!c.generatedDocument) {
      return res.status(404).json({ error: 'Document not generated yet' })
    }
    
    // Проверяем права доступа
    if (!req.isAdmin && c.userId && c.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    
    const docx = require('docx')
    const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } = docx
    
    // Разбиваем текст на параграфы
    const paragraphs = c.generatedDocument.split('\\n').map(line => {
      const trimmed = line.trim()
      if (!trimmed) {
        return new Paragraph({ spacing: { after: 200 } })
      }
      
      // Заголовки
      if (trimmed.startsWith('# ')) {
        return new Paragraph({
          text: trimmed.substring(2),
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200, before: 200 }
        })
      }
      if (trimmed.startsWith('## ')) {
        return new Paragraph({
          text: trimmed.substring(3),
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 150, before: 150 }
        })
      }
      if (trimmed.startsWith('### ')) {
        return new Paragraph({
          text: trimmed.substring(4),
          heading: HeadingLevel.HEADING_3,
          spacing: { after: 100, before: 100 }
        })
      }
      
      return new Paragraph({
        children: [
          new TextRun({
            text: trimmed,
            font: 'Times New Roman',
            size: 28, // 14pt
          })
        ],
        spacing: {
          after: 200,
          line: 360, // 1.5 интервал
        },
        alignment: AlignmentType.JUSTIFIED,
      })
    })
    
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1134, // 2cm
              right: 850, // 1.5cm
              bottom: 1134,
              left: 1701, // 3cm для левого поля (для подшивки)
            }
          }
        },
        children: paragraphs
      }]
    })
    
    const buffer = await Packer.toBuffer(doc)
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', \`attachment; filename=\${encodeURIComponent(c.title || 'Документ')}.docx\`)
    res.send(buffer)
    
  } catch (err) {
    console.error('[DOWNLOAD] Error:', err)
    res.status(500).json({ error: 'Failed to generate document' })
  }
})

`;

if (!content.includes("app.get('/api/generated/:id'")) {
  content = content.replace(insertMarker, newEndpoint + insertMarker);
  fs.writeFileSync(serverPath, content);
  console.log('✅ Endpoint /api/generated/:id добавлен');
} else {
  console.log('ℹ️ Endpoint уже существует');
}
