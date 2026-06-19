import { Worker } from 'bullmq';
import Redis from 'ioredis';
import OpenAI from 'openai';
import fs from 'fs';

// Загружаем API ключ из .env основного проекта
const envPath = '/var/www/legal-mrl/.env';
let apiKey = '';
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf-8');
  const match = env.match(/MOONSHOT_API_KEY=(.+)/);
  if (match) apiKey = match[1].trim();
}
if (!apiKey) {
  console.error('❌ MOONSHOT_API_KEY not found in .env');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey,
  baseURL: 'https://api.moonshot.ai/v1',
});

const redis = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: null });

async function updateStatus(jobId, status, extra = {}) {
  const current = await redis.get(`job:${jobId}:status`);
  const parsed = current ? JSON.parse(current) : {};
  const updated = { ...parsed, status, ...extra, updatedAt: new Date().toISOString() };
  await redis.setex(`job:${jobId}:status`, 3600, JSON.stringify(updated));
}

async function saveResult(jobId, result) {
  await redis.setex(`job:${jobId}:result`, 3600, JSON.stringify(result));
}

// Анализ дела
async function handleAnalyze(job) {
  const { jobId, caseId, title, description, documentsText } = job.data;
  await updateStatus(jobId, 'processing', { step: 'calling_api' });

  const prompt = `Ты — юридический аналитик. Сегодня 18 июня 2026 года. Проанализируй дело и дай краткий вывод.

Название дела: ${title}
Описание: ${description}

Документы дела:
${documentsText?.substring(0, 15000) || 'Нет документов'}

Дай анализ в формате:
1. Суть спора
2. Позиция истца
3. Позиция ответчика
4. Рекомендуемая стратегия
5. Шансы на успех (в процентах)`;

  const completion = await openai.chat.completions.create({
    model: 'kimi-k2.5',
    messages: [
      { role: 'system', content: 'Ты — опытный юрист. Отвечай кратко и по делу.' },
      { role: 'user', content: prompt }
    ],
    temperature: 1,
    max_tokens: 1000,
  });

  const result = completion.choices[0]?.message?.content || 'Ошибка генерации';
  await saveResult(jobId, { content: result, caseId, type: 'analyze' });
  await updateStatus(jobId, 'completed', { completedAt: new Date().toISOString() });
  return result;
}

// Генерация документа
async function handleGenerate(job) {
  const { jobId, documentType, clientData, position, caseTitle, caseDescription, caseAnalysis, documentsText } = job.data;
  await updateStatus(jobId, 'processing', { step: 'generating_document' });

  const prompt = `Ты — ведущий юрист с 20-летним стажем. Сегодня 18 июня 2026 года. Составь юридический документ: ${documentType}.

КОНТЕКСТ ДЕЛА:
Название: ${caseTitle || 'Не указано'}
Описание: ${caseDescription || 'Не указано'}
Сторона клиента: ${position === 'plaintiff' ? 'истец' : position === 'defendant' ? 'ответчик' : 'не указана'}

Первичный анализ дела (обязательно используй при составлении):
${caseAnalysis?.substring(0, 4000) || 'Нет анализа'}

Контекст из документов:
${documentsText?.substring(0, 15000) || 'Нет документов'}

Данные клиента:
${JSON.stringify(clientData, null, 2)}

---

ПРАВИЛА СОСТАВЛЕНИЯ:

ШАГ 1. Определи категорию документа:
- СУДЕБНЫЕ: исковое заявление, отзыв, возражение, заявление, ходатайство — шапка с наименованием суда, данные сторон, цена иска, структура: вводная → описательная → мотивировочная → резолютивная
- ДОГОВОРНЫЕ: договор, дополнительное соглашение, соглашение о расторжении, акт — реквизиты сторон (полное наименование/ФИО, ИНН, ОГРН, адрес), преамбула со ссылкой на основной договор, последовательно пронумерованные пункты изменений
- ПРЕТЕНЗИЯ (досудебная): реквизиты адресата, суть претензии, требования, срок ответа, ссылки на закон
- ИНОЕ: определи самую подходящую структуру

ШАГ 2. Обязательно:
- Ссылки на актуальное законодательство РФ (2026 год): конкретные статьи ГК РФ, ГПК РФ, КАС РФ, ТК РФ, НК РФ и др.
- Только предоставленные данные. НЕ выдумывай ФИО, адреса, даты, суммы, реквизиты, ИНН, ОГРН, номера договоров. Если данных нет — укажи [УТОЧНИТЬ]
- Текст ЧИСТЫЙ — без markdown: НЕ используй звёздочки, решётки, бэктики, подчёркивания, зачёркивания
- НЕ используй списки с маркерами — пиши связным текстом
- Без воды и общих фраз — только по делу
- Максимум 35000 знаков

ФОРМАТ ОТВЕТА (строго):
TITLE: [Точное название документа]
BODY:
[Полный текст с правильной шапкой и структурой для данного типа документа]`;

  const completion = await openai.chat.completions.create({
    model: 'kimi-k2.5',
    messages: [
      { role: 'system', content: 'Ты — юрист с 20-летним стажем. Пишешь официальные юридические документы по стандартам судебного документооборота РФ. Текст должен быть ЧИСТЫМ — без markdown-разметки (*, **, #, ` и т.д.). Используй ТОЛЬКО предоставленные данные. Если данных недостаточно — укажи [УТОЧНИТЬ].' },
      { role: 'user', content: prompt }
    ],
    temperature: 1,
    max_tokens: 8000,
  });

  const result = completion.choices[0]?.message?.content || 'Ошибка генерации';
  await saveResult(jobId, { content: result, documentType, position, type: 'generate' });
  await updateStatus(jobId, 'completed', { completedAt: new Date().toISOString() });
  return result;
}

const worker = new Worker('ai-jobs', async (job) => {
  console.log(`📥 Processing job ${job.id} | type: ${job.name}`);
  try {
    if (job.name === 'analyze') {
      return await handleAnalyze(job);
    } else if (job.name === 'generate') {
      return await handleGenerate(job);
    } else {
      throw new Error(`Unknown job type: ${job.name}`);
    }
  } catch (err) {
    console.error(`❌ Job ${job.id} failed:`, err.message);
    await updateStatus(job.data.jobId, 'failed', { error: err.message });
    throw err;
  }
}, {
  connection: redis,
  concurrency: 2,
});

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

console.log('🤖 AI Worker started | Listening queue: ai-jobs');
