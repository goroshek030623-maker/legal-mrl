import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, PageBreak } from "docx";
import { writeFileSync } from "fs";

export interface DocumentData {
  title: string;
  content: string;
  clientData: {
    fio?: string;
    company?: string;
    inn?: string;
    ogrn?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
}

export async function generateLegalDocument(data: DocumentData): Promise<Buffer> {
  const { title, content, clientData } = data;
  
  // Разбиваем контент на параграфы
  const paragraphs = content.split("\n\n").filter(p => p.trim());
  
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1134, // 2 см
            right: 851, // 1.5 см
            bottom: 1134, // 2 см
            left: 1701, // 3 см
          }
        }
      },
      children: [
        // Заголовок документа
        new Paragraph({
          text: title,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400, line: 360 },
          children: [
            new TextRun({
              text: title,
              bold: true,
              size: 28, // 14pt
              font: "Times New Roman",
            })
          ]
        }),
        
        // Реквизиты сторон
        new Paragraph({
          spacing: { after: 200, line: 360 },
          children: [
            new TextRun({
              text: `От: ${clientData.fio || "________"}`,
              size: 28,
              font: "Times New Roman",
            })
          ]
        }),
        
        new Paragraph({
          spacing: { after: 200, line: 360 },
          children: [
            new TextRun({
              text: `Адрес: ${clientData.address || "________"}`,
              size: 28,
              font: "Times New Roman",
            })
          ]
        }),
        
        new Paragraph({
          spacing: { after: 400, line: 360 },
          children: [
            new TextRun({
              text: `Телефон: ${clientData.phone || "________"}`,
              size: 28,
              font: "Times New Roman",
            })
          ]
        }),
        
        // Основной текст
        ...paragraphs.map(p => 
          new Paragraph({
            spacing: { after: 200, line: 360 },
            indent: { firstLine: 709 }, // 1.25 см
            children: [
              new TextRun({
                text: p.trim(),
                size: 28,
                font: "Times New Roman",
              })
            ]
          })
        ),
        
        // Подпись
        new Paragraph({
          spacing: { before: 600, line: 360 },
          children: [
            new TextRun({
              text: `\nПодпись: ________________ / ${clientData.fio || "________"}/`,
              size: 28,
              font: "Times New Roman",
            })
          ]
        }),
        
        new Paragraph({
          spacing: { line: 360 },
          children: [
            new TextRun({
              text: `Дата: ________________`,
              size: 28,
              font: "Times New Roman",
            })
          ]
        }),
      ]
    }]
  });
  
  return await Packer.toBuffer(doc);
}

export default generateLegalDocument;
