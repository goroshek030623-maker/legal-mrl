import { Worker } from "bullmq";
import Redis from "ioredis";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
};

const redis = new Redis(redisConnection);

async function updateJob(jobId, update) {
  const key = `ocr:job:${jobId}`;
  const data = await redis.get(key);
  if (!data) return;
  const job = JSON.parse(data);
  const updated = { ...job, ...update };
  await redis.setex(key, 3600, JSON.stringify(updated));
}

async function processPDF(job) {
  const { jobId, filePath } = job.data;
  const workDir = `/tmp/ocr-work/${jobId}`;

  try {
    await updateJob(jobId, { status: "processing" });

    fs.mkdirSync(workDir, { recursive: true });

    // Convert PDF to images using pdftoppm
    const ppmPrefix = path.join(workDir, "page");
    try {
      execSync(`pdftoppm -png -r 300 "${filePath}" "${ppmPrefix}"`, {
        timeout: 60000,
        stdio: "pipe",
      });
    } catch (e) {
      // Fallback: try pdf2pic if pdftoppm not available
      console.log("pdftoppm failed, trying pdf2pic fallback...");
      const { fromPath } = await import("pdf2pic");
      const convert = fromPath(filePath, {
        density: 300,
        saveFilename: "page",
        savePath: workDir,
        format: "png",
        width: 2480,
        height: 3508,
      });
      await convert.bulk(-1);
    }

    // Find all generated PNG images
    const images = fs
      .readdirSync(workDir)
      .filter((f) => f.endsWith(".png"))
      .sort();

    if (images.length === 0) {
      throw new Error("No images generated from PDF");
    }

    // Run Tesseract OCR on each image
    const texts = [];
    for (const img of images) {
      const imgPath = path.join(workDir, img);
      const txtPath = path.join(workDir, `${path.parse(img).name}`);
      try {
        execSync(`tesseract "${imgPath}" "${txtPath}" -l rus+eng`, {
          timeout: 120000,
          stdio: "pipe",
        });
        const text = fs.readFileSync(`${txtPath}.txt`, "utf-8");
        texts.push(text);
      } catch (e) {
        console.error(`Tesseract failed for ${img}:`, e.message);
        texts.push(`[OCR_ERROR: ${img}]`);
      }
    }

    const fullText = texts.join("\n\n---PAGE_BREAK---\n\n");

    await updateJob(jobId, {
      status: "completed",
      result: fullText,
    });

    // Cleanup
    fs.rmSync(workDir, { recursive: true, force: true });
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return { success: true, pages: images.length };
  } catch (err) {
    console.error(`OCR Worker error for job ${jobId}:`, err);
    await updateJob(jobId, {
      status: "failed",
      error: err.message,
    });
    // Cleanup
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw err;
  }
}

const worker = new Worker("ocr-jobs", processPDF, {
  connection: redisConnection,
  concurrency: 2,
});

worker.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

console.log("OCR worker started, listening on queue: ocr-jobs");
