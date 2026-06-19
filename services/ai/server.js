import express from 'express';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json({ limit: '50mb' }));

const redis = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: null });
const aiQueue = new Queue('ai-jobs', { connection: redis });

const PORT = process.env.PORT || 3004;

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'legal-mrl-ai', timestamp: new Date().toISOString() });
});

// POST /analyze — поставить задачу анализа в очередь
app.post('/analyze', async (req, res) => {
  try {
    const { caseId, title, description, documentsText } = req.body;
    if (!caseId) return res.status(400).json({ error: 'caseId is required' });

    const jobId = uuidv4();
    await redis.setex(`job:${jobId}:status`, 3600, JSON.stringify({ status: 'pending', type: 'analyze', createdAt: new Date().toISOString() }));

    await aiQueue.add('analyze', {
      jobId,
      caseId,
      title: title || '',
      description: description || '',
      documentsText: documentsText || ''
    }, { jobId });

    res.json({ jobId, status: 'pending', type: 'analyze' });
  } catch (err) {
    console.error('Analyze error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /generate — поставить задачу генерации в очередь
app.post('/generate', async (req, res) => {
  try {
    const { documentType, clientData, position } = req.body;
    if (!documentType) return res.status(400).json({ error: 'documentType is required' });

    const jobId = uuidv4();
    await redis.setex(`job:${jobId}:status`, 3600, JSON.stringify({ status: 'pending', type: 'generate', createdAt: new Date().toISOString() }));

    await aiQueue.add('generate', {
      jobId,
      documentType,
      clientData: clientData || {},
      position: position || 'plaintiff'
    }, { jobId });

    res.json({ jobId, status: 'pending', type: 'generate' });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /job/:jobId/status
app.get('/job/:jobId/status', async (req, res) => {
  try {
    const data = await redis.get(`job:${req.params.jobId}:status`);
    if (!data) return res.status(404).json({ error: 'Job not found' });
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /job/:jobId/result
app.get('/job/:jobId/result', async (req, res) => {
  try {
    const data = await redis.get(`job:${req.params.jobId}:result`);
    if (!data) return res.status(404).json({ error: 'Result not ready or job not found' });
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 AI Service listening on port ${PORT}`);
});
