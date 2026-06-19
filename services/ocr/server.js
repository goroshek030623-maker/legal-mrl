import express from "express";
import multer from "multer";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.OCR_PORT || 3003;

const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
};

const redis = new Redis(redisConnection);
const ocrQueue = new Queue("ocr-jobs", { connection: redisConnection });

const upload = multer({ dest: "/tmp/ocr-uploads/" });

app.use(express.json());

// Ensure upload dir exists
if (!fs.existsSync("/tmp/ocr-uploads/")) {
  fs.mkdirSync("/tmp/ocr-uploads/", { recursive: true });
}

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Submit OCR job
app.post("/ocr", upload.single("pdf"), async (req, res) => {
  try {
    console.log("[OCR-SERVER] req.file:", req.file ? { path: req.file.path, originalname: req.file.originalname, size: req.file.size } : null);
    console.log("[OCR-SERVER] req.body:", req.body);
    console.log("[OCR-SERVER] req.headers:", req.headers);
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    const jobId = uuidv4();
    const filePath = req.file.path;
    const originalName = req.file.originalname;

    // Store initial job data in Redis
    await redis.setex(
      `ocr:job:${jobId}`,
      3600,
      JSON.stringify({
        id: jobId,
        status: "pending",
        filePath,
        originalName,
        result: null,
        error: null,
        createdAt: new Date().toISOString(),
      })
    );

    // Add to BullMQ queue
    await ocrQueue.add(
      "process-pdf",
      { jobId, filePath },
      { jobId }
    );

    res.json({ jobId, status: "pending" });
  } catch (err) {
    console.error("OCR submit error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get job status
app.get("/ocr/:jobId/status", async (req, res) => {
  try {
    const data = await redis.get(`ocr:job:${req.params.jobId}`);
    if (!data) {
      return res.status(404).json({ error: "Job not found" });
    }
    const job = JSON.parse(data);
    res.json({ jobId: job.id, status: job.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get job result
app.get("/ocr/:jobId/result", async (req, res) => {
  try {
    const data = await redis.get(`ocr:job:${req.params.jobId}`);
    if (!data) {
      return res.status(404).json({ error: "Job not found" });
    }
    const job = JSON.parse(data);
    if (job.status !== "completed") {
      return res.status(400).json({
        jobId: job.id,
        status: job.status,
        error: job.error,
      });
    }
    res.json({ jobId: job.id, status: job.status, text: job.result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`OCR service running on port ${PORT}`);
});
