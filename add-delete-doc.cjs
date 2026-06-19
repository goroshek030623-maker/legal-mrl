// Добавляем endpoint DELETE /api/documents/:id
const fs = require('fs');
const path = require('path');

const serverPath = '/var/www/legal-mrl/api/server.ts';
let content = fs.readFileSync(serverPath, 'utf8');

const newEndpoint = `
// Удаление документа из дела
app.delete('/api/documents/:id', authMiddleware, async (req, res) => {
  try {
    const docId = req.params.id
    
    // Находим документ
    const doc = await db.select().from(documents).where(eq(documents.id, docId))
    if (!doc.length) {
      return res.status(404).json({ error: 'Document not found' })
    }
    
    // Проверяем права — получаем дело и проверяем userId
    const caseData = await db.select().from(cases).where(eq(cases.id, doc[0].caseId))
    if (!caseData.length) {
      return res.status(404).json({ error: 'Case not found' })
    }
    
    if (!req.isAdmin && caseData[0].userId && caseData[0].userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    
    // Удаляем файл с диска
    if (doc[0].path && fs.existsSync(doc[0].path)) {
      fs.unlinkSync(doc[0].path)
    }
    
    // Удаляем из БД
    await db.delete(documents).where(eq(documents.id, docId))
    
    res.json({ success: true })
  } catch (err) {
    console.error('[DELETE DOC] Error:', err)
    res.status(500).json({ error: 'Failed to delete document' })
  }
})

`;

// Находим место после endpoint загрузки документов и вставляем перед следующим endpoint
const insertMarker = `// Генерация документа через AI`;

if (!content.includes("app.delete('/api/documents/:id'")) {
  // Вставляем перед генерацией документа
  content = content.replace(insertMarker, newEndpoint + insertMarker);
  fs.writeFileSync(serverPath, content);
  console.log('✅ Endpoint DELETE /api/documents/:id добавлен');
} else {
  console.log('ℹ️ Endpoint уже существует');
}
