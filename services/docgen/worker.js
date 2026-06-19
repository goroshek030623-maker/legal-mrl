#!/usr/bin/env node
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const TEMPLATES_DIR = process.env.TEMPLATES_DIR || '/var/www/legal-mrl/templates';
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/var/www/legal-mrl/generated-docs';

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function ensureTemplate(documentType) {
  const templatePath = path.join(TEMPLATES_DIR, `${documentType}.docx`);
  if (fs.existsSync(templatePath)) return templatePath;

  const defaultTemplate = path.join(TEMPLATES_DIR, 'default.docx');
  if (fs.existsSync(defaultTemplate)) return defaultTemplate;

  return null;
}

function createBasicDocx(title) {
  const zip = new PizZip();
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${title}</w:t></w:r></w:p>
    <w:p><w:r><w:t>{content}</w:t></w:r></w:p>
  </w:body>
</w:document>`;
  zip.file('word/document.xml', xml);
  return zip;
}

const worker = new Worker('docgen-jobs', async (job) => {
  const { jobId, documentType, content, clientData, templatePath: tp } = job.data;
  await job.updateProgress(10);

  let templatePath = tp || await ensureTemplate(documentType);
  let zip;

  if (templatePath && fs.existsSync(templatePath)) {
    const templateBuf = fs.readFileSync(templatePath);
    zip = new PizZip(templateBuf);
  } else {
    zip = createBasicDocx(documentType || 'Документ');
  }
  await job.updateProgress(30);

  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  const data = {
    content: content || '',
    ...clientData,
    date: new Date().toLocaleDateString('ru-RU'),
  };
  await job.updateProgress(50);

  doc.render(data);
  await job.updateProgress(70);

  const outputPath = path.join(OUTPUT_DIR, `${jobId}.docx`);
  const buf = doc.getZip().generate({ type: 'nodebuffer' });
  fs.writeFileSync(outputPath, buf);
  await job.updateProgress(100);

  return { filePath: outputPath, jobId, documentType, url: `/job/${jobId}/download` };
}, { connection, concurrency: 2 });

worker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed: ${result.filePath}`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

console.log('DocGen worker started');
