import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, PageBreak, Header, Footer, PageNumber } from "docx";

export interface DocumentData {
  title: string;
  content: string;
  documentType?: string;
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

// Справочник типов документов
const DOCUMENT_CATEGORIES: Record<string, string> = {
  claim: 'court',
  respond: 'court',
  objection: 'court',
  motion: 'court',
  contract: 'contract',
  settlement: 'contract',
  pretension: 'pretension',
  claim_pretension: 'pretension',
};

function getCategory(documentType: string): string {
  const key = (documentType || '').toLowerCase().trim();
  
  if (key.includes('иск') || key.includes('заявл') || key.includes('отзыв') || key.includes('возраж') || key.includes('ходатай')) {
    return 'court';
  }
  if (key.includes('договор') || key.includes('соглаш') || key.includes('акт')) {
    return 'contract';
  }
  if (key.includes('претенз')) {
    return 'pretension';
  }
  
  return DOCUMENT_CATEGORIES[key] || 'universal';
}

// Стандартные параметры оформления для судов РФ
const STANDARD_FONT = {
  font: "Times New Roman",
  size: 28, // 14pt
};

const STANDARD_SPACING = {
  line: 360, // 1.5 интервал
  after: 200,
};

const INDENT_FIRST_LINE = 709; // 1.25 см

function createParagraph(text: string, options: any = {}): Paragraph {
  return new Paragraph({
    spacing: { ...STANDARD_SPACING, ...(options.spacing || {}) },
    indent: options.noIndent ? {} : { firstLine: options.firstLine || INDENT_FIRST_LINE },
    alignment: options.alignment || AlignmentType.JUSTIFIED,
    children: [
      new TextRun({
        text,
        ...STANDARD_FONT,
        bold: options.bold || false,
      }),
    ],
  });
}

function createCenteredParagraph(text: string, options: any = {}): Paragraph {
  return new Paragraph({
    spacing: { ...STANDARD_SPACING, ...(options.spacing || {}) },
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text,
        ...STANDARD_FONT,
        bold: options.bold || false,
      }),
    ],
  });
}

function createRightParagraph(text: string, options: any = {}): Paragraph {
  return new Paragraph({
    spacing: { ...STANDARD_SPACING, ...(options.spacing || {}) },
    alignment: AlignmentType.RIGHT,
    children: [
      new TextRun({
        text,
        ...STANDARD_FONT,
        bold: options.bold || false,
      }),
    ],
  });
}

// Разбиваем контент на параграфы с учётом пустых строк
function parseContent(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

// ===== ШАБЛОН: СУДЕБНЫЙ ДОКУМЕНТ =====
function buildCourtDocument(data: DocumentData): Document {
  const { title, content, clientData } = data;
  const paragraphs = parseContent(content);
  
  const children: any[] = [];
  
  // Шапка документа (по центру или слева — зависит от типа)
  children.push(createCenteredParagraph(title, { bold: true, spacing: { after: 400 } }));
  
  // Данные истца (справа или слева — по стандарту)
  if (clientData.fio || clientData.company) {
    children.push(createParagraph(`От: ${clientData.fio || clientData.company || "[УТОЧНИТЬ]"}`, { noIndent: true }));
    if (clientData.address) {
      children.push(createParagraph(`Адрес: ${clientData.address}`, { noIndent: true }));
    }
    if (clientData.phone) {
      children.push(createParagraph(`Телефон: ${clientData.phone}`, { noIndent: true }));
    }
    if (clientData.email) {
      children.push(createParagraph(`Email: ${clientData.email}`, { noIndent: true }));
    }
    if (clientData.inn) {
      children.push(createParagraph(`ИНН: ${clientData.inn}`, { noIndent: true }));
    }
    children.push(new Paragraph({ spacing: { after: 200 } })); // пустая строка
  }
  
  // Основной текст
  paragraphs.forEach((p, index) => {
    // Заголовки секций (вводная, описательная, мотивировочная, резолютивная)
    const lowerP = p.toLowerCase();
    const isHeading = 
      lowerP.includes('вводная') || 
      lowerP.includes('описательная') || 
      lowerP.includes('мотивировочная') || 
      lowerP.includes('резолютивная') ||
      lowerP.includes('прошу') ||
      lowerP.includes('прошу суд') ||
      lowerP.includes('прошу признать') ||
      lowerP.includes('прошу взыскать') ||
      lowerP.includes('прошу обязать');
    
    if (isHeading || index === 0) {
      children.push(createParagraph(p, { noIndent: true, bold: isHeading }));
    } else {
      children.push(createParagraph(p));
    }
  });
  
  // Подпись
  children.push(new Paragraph({ spacing: { before: 600 } }));
  children.push(createRightParagraph(`Подпись: ________________ / ${clientData.fio || "[УТОЧНИТЬ]"}/`, { noIndent: true }));
  children.push(createRightParagraph(`Дата: «____» ____________ 20____ г.`, { noIndent: true }));
  
  return new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1134,     // 2 см
            right: 851,    // 1.5 см
            bottom: 1134,  // 2 см
            left: 1701,    // 3 см
          },
        },
      },
      children,
    }],
  });
}

// ===== ШАБЛОН: ДОГОВОР =====
function buildContractDocument(data: DocumentData): Document {
  const { title, content, clientData } = data;
  const paragraphs = parseContent(content);
  
  const children: any[] = [];
  
  // Заголовок по центру
  children.push(createCenteredParagraph(title, { bold: true, spacing: { after: 400 } }));
  
  // Реквизиты сторон
  if (clientData.fio || clientData.company) {
    children.push(createParagraph(`1. РЕКВИЗИТЫ СТОРОН`, { bold: true, noIndent: true, spacing: { after: 200 } }));
    children.push(createParagraph(`1.1. Исполнитель: ${clientData.fio || clientData.company || "[УТОЧНИТЬ]"}`, { noIndent: true }));
    if (clientData.inn) {
      children.push(createParagraph(`ИНН: ${clientData.inn}`, { noIndent: true }));
    }
    if (clientData.ogrn) {
      children.push(createParagraph(`ОГРН: ${clientData.ogrn}`, { noIndent: true }));
    }
    if (clientData.address) {
      children.push(createParagraph(`Адрес: ${clientData.address}`, { noIndent: true }));
    }
    children.push(new Paragraph({ spacing: { after: 200 } }));
  }
  
  // Основной текст
  paragraphs.forEach(p => {
    children.push(createParagraph(p));
  });
  
  // Подписи сторон
  children.push(new Paragraph({ spacing: { before: 600 } }));
  children.push(createParagraph("Подписи сторон:", { bold: true, noIndent: true }));
  children.push(new Paragraph({ spacing: { after: 200 } }));
  
  // Две колонки для подписей (упрощённо — друг под другом)
  children.push(createParagraph(`Исполнитель: ________________ / ${clientData.fio || clientData.company || "[УТОЧНИТЬ]"}/`, { noIndent: true }));
  children.push(createParagraph(`Дата: «____» ____________ 20____ г.`, { noIndent: true }));
  children.push(new Paragraph({ spacing: { after: 200 } }));
  children.push(createParagraph(`Заказчик: ________________ / _________________________/`, { noIndent: true }));
  children.push(createParagraph(`Дата: «____» ____________ 20____ г.`, { noIndent: true }));
  
  return new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1134,
            right: 851,
            bottom: 1134,
            left: 1701,
          },
        },
      },
      children,
    }],
  });
}

// ===== ШАБЛОН: ПРЕТЕНЗИЯ =====
function buildPretensionDocument(data: DocumentData): Document {
  const { title, content, clientData } = data;
  const paragraphs = parseContent(content);
  
  const children: any[] = [];
  
  // Заголовок
  children.push(createCenteredParagraph(title, { bold: true, spacing: { after: 400 } }));
  
  // Кому (адресат)
  children.push(createParagraph(`Кому: _________________________________`, { noIndent: true }));
  children.push(createParagraph(`Адрес: _______________________________`, { noIndent: true }));
  children.push(new Paragraph({ spacing: { after: 200 } }));
  
  // От кого
  if (clientData.fio || clientData.company) {
    children.push(createParagraph(`От: ${clientData.fio || clientData.company || "[УТОЧНИТЬ]"}`, { noIndent: true }));
    if (clientData.address) {
      children.push(createParagraph(`Адрес: ${clientData.address}`, { noIndent: true }));
    }
    if (clientData.phone) {
      children.push(createParagraph(`Телефон: ${clientData.phone}`, { noIndent: true }));
    }
    if (clientData.email) {
      children.push(createParagraph(`Email: ${clientData.email}`, { noIndent: true }));
    }
    children.push(new Paragraph({ spacing: { after: 200 } }));
  }
  
  // Основной текст
  paragraphs.forEach((p, index) => {
    const lowerP = p.toLowerCase();
    const isHeading = 
      lowerP.includes('требовани') || 
      lowerP.includes('основани') || 
      lowerP.includes('суть') ||
      lowerP.includes('просим');
    
    children.push(createParagraph(p, { bold: isHeading }));
  });
  
  // Подпись
  children.push(new Paragraph({ spacing: { before: 600 } }));
  children.push(createRightParagraph(`Подпись: ________________ / ${clientData.fio || "[УТОЧНИТЬ]"}/`, { noIndent: true }));
  children.push(createRightParagraph(`Дата: «____» ____________ 20____ г.`, { noIndent: true }));
  
  return new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1134,
            right: 851,
            bottom: 1134,
            left: 1701,
          },
        },
      },
      children,
    }],
  });
}

// ===== УНИВЕРСАЛЬНЫЙ ШАБЛОН =====
function buildUniversalDocument(data: DocumentData): Document {
  const { title, content, clientData } = data;
  const paragraphs = parseContent(content);
  
  const children: any[] = [];
  
  // Заголовок
  children.push(createCenteredParagraph(title, { bold: true, spacing: { after: 400 } }));
  
  // Реквизиты
  if (clientData.fio || clientData.company) {
    children.push(createParagraph(`От: ${clientData.fio || clientData.company || "________"}`, { noIndent: true }));
    if (clientData.address) {
      children.push(createParagraph(`Адрес: ${clientData.address}`, { noIndent: true }));
    }
    if (clientData.phone) {
      children.push(createParagraph(`Телефон: ${clientData.phone}`, { noIndent: true }));
    }
    if (clientData.email) {
      children.push(createParagraph(`Email: ${clientData.email}`, { noIndent: true }));
    }
    if (clientData.inn) {
      children.push(createParagraph(`ИНН: ${clientData.inn}`, { noIndent: true }));
    }
    children.push(new Paragraph({ spacing: { after: 200 } }));
  }
  
  // Основной текст
  paragraphs.forEach(p => {
    children.push(createParagraph(p));
  });
  
  // Подпись
  children.push(new Paragraph({ spacing: { before: 600 } }));
  children.push(createRightParagraph(`Подпись: ________________ / ${clientData.fio || "________"}/`, { noIndent: true }));
  children.push(createRightParagraph(`Дата: «____» ____________ 20____ г.`, { noIndent: true }));
  
  return new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1134,
            right: 851,
            bottom: 1134,
            left: 1701,
          },
        },
      },
      children,
    }],
  });
}

// ===== ОСНОВНАЯ ФУНКЦИЯ =====
export async function generateLegalDocument(data: DocumentData): Promise<Buffer> {
  const category = getCategory(data.documentType || '');
  
  let doc: Document;
  
  switch (category) {
    case 'court':
      doc = buildCourtDocument(data);
      break;
    case 'contract':
      doc = buildContractDocument(data);
      break;
    case 'pretension':
      doc = buildPretensionDocument(data);
      break;
    default:
      doc = buildUniversalDocument(data);
  }
  
  return await Packer.toBuffer(doc);
}

export default generateLegalDocument;
