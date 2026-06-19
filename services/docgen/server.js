#!/usr/bin/env node
import express from 'express';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import libre from 'libreoffice-convert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3005;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/var/www/legal-mrl/generated-docs';
const TEMPLATES_DIR = process.env.TEMPLATES_DIR || '/var/www/legal-mrl/templates';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const docQueue = new Queue('docgen-jobs', { connection });

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'legal-mrl-docgen', time: new Date().toISOString() });
});

app.post('/generate', async (req, res) => {
  try {
    const { documentType, content, clientData } = req.body;
    if (!documentType) return res.status(400).json({ error: 'documentType required' });
    if (!content) return res.status(400).json({ error: 'content required' });

    const jobId = uuidv4();
    const job = await docQueue.add('generate-doc', {
      jobId,
      documentType,
      content,
      clientData: clientData || {},
      templatePath: path.join(TEMPLATES_DIR, `${documentType}.docx`),
      outputDir: OUTPUT_DIR,
    }, { jobId });

    res.json({ jobId, status: 'queued', queueJobId: job.id });
  } catch (err) {
    console.error('POST /generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/job/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await docQueue.getJob(jobId);
    if (!job) return res.json({ jobId, status: 'not_found' });

    const state = await job.getState();
    const progress = await job.progress || 0;
    let result = null;
    if (job.returnvalue) result = job.returnvalue;
    if (job.failedReason) return res.json({ jobId, status: 'failed', error: job.failedReason });

    res.json({ jobId, status: state, progress, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/job/:jobId/download', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await docQueue.getJob(jobId);
    if (!job || !job.returnvalue) return res.status(404).json({ error: 'Not ready or not found' });

    const filePath = job.returnvalue.filePath;
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });

    const ext = path.extname(filePath);
    const filename = `${jobId}${ext}`;
    res.download(filePath, filename);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/convert', async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath || !fs.existsSync(filePath)) return res.status(400).json({ error: 'filePath required or missing' });

    const outputPdf = path.join(OUTPUT_DIR, `${path.basename(filePath, '.docx')}.pdf`);
    const docxBuf = fs.readFileSync(filePath);

    libre.convert(docxBuf, 'pdf', undefined, (err, pdfBuf) => {
      if (err) return res.status(500).json({ error: err.message });
      fs.writeFileSync(outputPdf, pdfBuf);
      res.json({ success: true, pdfPath: outputPdf });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`DocGen service listening on port ${PORT}`);
});
