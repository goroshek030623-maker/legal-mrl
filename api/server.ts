import dotenv from 'dotenv'
dotenv.config({ path: '/var/www/legal-mrl/.env' })

console.log('MOONSHOT_API_KEY exists:', !!process.env.MOONSHOT_API_KEY)
console.log('MOONSHOT_API_KEY length:', process.env.MOONSHOT_API_KEY?.length || 0)
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@sanity/client'
import fs from 'fs'
import { exec, execSync } from "child_process"
import { promisify } from 'util'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import generateLegalDocument from "./generate-docx"
import rateLimit from 'express-rate-limit'
const execAsync = promisify(exec)

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-production'

const app = express()

// ===== RATE LIMITERS (bot protection) =====
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
})

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests, please slow down' }
})

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads, please slow down' }
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please slow down' }
})


const upload = multer({ dest: '/var/www/legal-mrl/uploads/' })




// ===== HELPERS =====

function cleanMarkdown(text: string): string {
  if (!text) return text
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/зачёркивание(.+?)зачёркивание/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function extractPdfText(pdfPath: string, maxChars: number = 3000): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse')).default
    const dataBuffer = await fs.promises.readFile(pdfPath)
    const pdfData = await pdfParse(dataBuffer)
    console.log('PDF pdf-parse text length:', pdfData.text?.length || 0)
    if (pdfData.text && pdfData.text.trim().length > 20) {
      return smartTruncate(pdfData.text, maxChars)
    }
    console.log('PDF parse returned empty, trying pdftotext...')
  } catch (e: any) {
    console.log('PDF pdf-parse error:', e.message)
  }

  try {
    const { stdout } = await execAsync('pdftotext -layout "' + pdfPath + '" -')
    console.log('PDF pdftotext text length:', stdout?.length || 0)
    if (stdout && stdout.trim().length > 10) {
      return smartTruncate(stdout, maxChars)
    }
  } catch (e: any) {
    console.log('PDF pdftotext error:', e.message)
  }

  return '(PDF contains scanned images — text not extracted)'
}


// Extract text from DOCX (Word) files
async function extractDocxText(docxPath: string, maxChars: number = 3000): Promise<string> {
  try {
    // execSync imported above
    const xmlContent = execSync(`unzip -p "${docxPath}" word/document.xml 2>/dev/null || echo ''`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    if (!xmlContent) return '';
    let text = xmlContent
      .replace(/<w:p[^>]*>/g, '\n')
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
    return text.substring(0, maxChars);
  } catch (e: any) {
    console.log('[DOCX] Extract error:', e.message);
    return '';
  }
}

// ===== SMART TRUNCATE =====
function smartTruncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cutAt = text.lastIndexOf('.', maxLength);
  if (cutAt > maxLength * 0.8) return text.substring(0, cutAt + 1);
  return text.substring(0, maxLength);
}

// ===== DOCUMENT SUMMARIZATION =====
async function summarizeDocument(text: string): Promise<string | null> {
  if (!text || text.length < 100) return null;
  try {
    const completion = await openai.chat.completions.create({
      model: 'kimi-k2.5',
      messages: [
        { role: 'system', content: 'Ты юридический ассистент. Выдели ключевые факты из документа кратко и структурированно.' },
        { role: 'user', content: `Выдели из документа ключевые юридические факты в формате:
ТИП: [тип документа]
ДАТА: [даты]
СТОРОНЫ: [ФИО/названия организаций]
СУММА: [если есть]
СУТЬ: [3-4 предложения о чем документ]

Текст документа:
${smartTruncate(text, 8000)}` }
      ],
      max_tokens: 300,
      temperature: 1
    });
    return completion.choices[0].message.content || null;
  } catch (e: any) {
    console.log('[SUMMARIZE] Error:', e.message);
    return null;
  }
}

// ===== AI LOGGING =====

interface AILogData {
  caseId?: string
  requestType: string
  model?: string
  prompt?: string
  response?: string
  tokensUsed?: number
  durationMs?: number
  success?: boolean
  error?: string
}

async function logAI({ caseId, requestType, model, prompt, response, tokensUsed, durationMs, success = true, error }: AILogData) {
  try {
    await db.insert(aiLogs).values({
      id: require("uuid").v4(),
      caseId: caseId || null,
      requestType,
      model: model || null,
      prompt: prompt ? prompt.substring(0, 5000) : null,
      response: response ? response.substring(0, 10000) : null,
      tokensUsed: tokensUsed || null,
      durationMs: durationMs || null,
      success: success ? 1 : 0,
      error: error || null
    })
  } catch (e: any) {
    console.error("[logAI error]", e.message)
  }
}

// ===== END AI LOGGING =====

// ===== MICROSERVICE HELPERS =====

async function uploadToMinIO(filePath: string, fileName: string): Promise<string | null> {
  try {
    console.log('[MICROSERVICE] Uploading to MinIO:', fileName)
    const fileBuffer = await fs.promises.readFile(filePath)
    const nodeFetch = (await import("node-fetch")).default
    const FormData = (await import("form-data")).default
    const formData = new FormData()
    
    formData.append('file', blob, fileName)

    const res = await fetch('http://localhost:3003/upload', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    })
    if (!res.ok) throw new Error(`MinIO upload failed: ${res.status}`)
    const data = await res.json()
    console.log('[MICROSERVICE] MinIO upload success:', data.path)
    return data.path || data.minioPath || null
  } catch (e: any) {
    console.error('[MICROSERVICE] MinIO upload error:', e.message)
    return null
  }
}

async function callOCR(filePath: string): Promise<string | null> {
  try {
    console.log("[MICROSERVICE] Calling OCR service:", filePath)
    const fileBuffer = await fs.promises.readFile(filePath)
    const nodeFetch = (await import("node-fetch")).default
    const FormData = (await import("form-data")).default
    const formData = new FormData()
    
    formData.append("pdf", fileBuffer, filePath.split('/').pop() || 'document.pdf')

    const res = await nodeFetch("http://localhost:3003/ocr", {
      method: "POST",
      body: formData,
      headers: formData.getHeaders()
    })
    if (!res.ok) throw new Error(`OCR failed: ${res.status}`)
    const data = await res.json()
    const jobId = data.jobId
    if (!jobId) throw new Error("OCR did not return jobId")
    console.log("[MICROSERVICE] OCR job submitted:", jobId)

    // Poll for result
    let status = "pending"
    let result = null
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const statusRes = await fetch("http://localhost:3003/ocr/" + jobId + "/status")
      if (!statusRes.ok) continue
      const statusData = await statusRes.json()
      status = statusData.status
      console.log("[MICROSERVICE] OCR job status:", status)
      if (status === "completed") {
        const resultRes = await fetch("http://localhost:3003/ocr/" + jobId + "/result")
        if (resultRes.ok) {
          result = await resultRes.json()
          break
        }
      }
      if (status === "failed") {
        throw new Error("OCR job failed: " + (statusData.error || "unknown"))
      }
    }

    if (!result || !result.text) {
      console.log("[MICROSERVICE] OCR no text extracted")
      return null
    }
    console.log("[MICROSERVICE] OCR success, text length:", result.text.length)
    return result.text || null
  } catch (e: any) {
    console.error("[MICROSERVICE] OCR error:", e.message)
    return null
  }
}

async function callAIService(endpoint: string, payload: any): Promise<any | null> {
  try {
    console.log('[MICROSERVICE] Calling AI service:', endpoint, payload)
    const res = await fetch(`http://localhost:3004${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error(`AI service ${endpoint} failed: ${res.status}`)
    const data = await res.json()
    console.log('[MICROSERVICE] AI service queued:', data)

    // If async job returned, poll for result
    if (data && data.jobId && data.status === 'pending') {
      const jobId = data.jobId
      let attempts = 0
      const maxAttempts = 60 // 60 seconds max
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 1000))
        const statusRes = await fetch(`http://localhost:3004/job/${jobId}/status`)
        if (statusRes.ok) {
          const statusData = await statusRes.json()
          if (statusData.status === 'completed' || statusData.status === 'done') {
            const resultRes = await fetch(`http://localhost:3004/job/${jobId}/result`)
            if (resultRes.ok) {
              const resultData = await resultRes.json()
              console.log('[MICROSERVICE] AI job completed, result length:', resultData.content?.length || 0)
              return resultData
            }
            break
          } else if (statusData.status === 'failed' || statusData.status === 'error') {
            throw new Error(`AI job failed: ${statusData.error || 'unknown'}`)
          }
        }
        attempts++
        console.log('[MICROSERVICE] AI job polling...', attempts)
      }
      throw new Error('AI job timeout')
    }

    return data
  } catch (e: any) {
    console.error('[MICROSERVICE] AI service error:', e.message)
    return null
  }
}

async function callDocGen(content: string, clientData: any, documentType: string): Promise<{ url: string, path: string } | null> {
  try {
    console.log('[MICROSERVICE] Calling DocGen service:', documentType)
    const res = await fetch('http://localhost:3005/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, clientData, documentType })
    })
    if (!res.ok) throw new Error(`DocGen failed: ${res.status}`)
    const data = await res.json()
    console.log('[MICROSERVICE] DocGen success:', data.url || data.path)
    return data
  } catch (e: any) {
    console.error('[MICROSERVICE] DocGen error:', e.message)
    return null
  }
}

async function downloadFromMinIO(minioPath: string, localPath: string): Promise<boolean> {
  try {
    console.log('[MICROSERVICE] Downloading from MinIO:', minioPath)
    const res = await fetch(`http://localhost:3003/download?path=${encodeURIComponent(minioPath)}`)
    if (!res.ok) throw new Error(`MinIO download failed: ${res.status}`)
    const buffer = await res.arrayBuffer()
    await fs.promises.writeFile(localPath, Buffer.from(buffer))
    console.log('[MICROSERVICE] MinIO download success:', localPath)
    return true
  } catch (e: any) {
    console.error('[MICROSERVICE] MinIO download error:', e.message)
    return false
  }
}

// ===== END MICROSERVICE HELPERS =====

// ===== END HELPERS =====
app.use(cors())
app.use('/api/', generalLimiter)
app.use(express.json())

// Принудительно UTF-8 для multipart
app.use((req, res, next) => {
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    req.headers['content-type'] = req.headers['content-type'].replace(/charset=[^;]+/, 'charset=utf-8')
  }
  next()
})

app.use(generalLimiter)

// Подключение к БД (drizzle)
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { cases, documents, users, aiLogs, payments } from '../db/schema'
import { eq, desc, sql, isNull, isNotNull, and } from 'drizzle-orm'

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'legal_mrl',
  password: process.env.DB_PASSWORD || '@t+G7s8wWNzV',
  database: process.env.DB_NAME || 'legal_mrl',
  charset: 'utf8mb4'
})

const db = drizzle(pool)

// OpenAI
import OpenAI from 'openai'
const openai = new OpenAI({
  apiKey: process.env.MOONSHOT_API_KEY || 'your-key-here',
  baseURL: 'https://api.moonshot.ai/v1'
})

// Роуты API

// Создание дела
app.post('/api/cases', uploadLimiter, upload.array('files', 50), async (req, res) => {
  try {
    const { title, description } = req.body
    const caseId = uuidv4()
    
    await db.insert(cases).values({
      id: caseId,
      title,
      description: description || null,
      status: 'pending'
    })

    // Сохраняем файлы
    const files = req.files as Express.Multer.File[]
    if (files?.length) {
      for (const file of files) {
        const docId = uuidv4()
        // Fix encoding: multer may receive filename as latin1, convert to utf8
        const fixedName = Buffer.from(file.originalname, 'latin1').toString('utf8')
        await db.insert(documents).values({
          id: docId,
          caseId,
          name: fixedName,
          type: file.mimetype,
          size: file.size,
          path: file.path
        })
      }
    }

    res.json({ id: caseId, success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create case' })
  }
})

// Список дел
app.get('/api/cases', async (req, res) => {
  try {
    const allCases = await db.select().from(cases)
    
    // Добавляем количество документов
    const result = await Promise.all(
      allCases.map(async (c) => {
        const docs = await db.select().from(documents).where(eq(documents.caseId, c.id))
        return {
          ...c,
          documentCount: docs.length
        }
      })
    )
    
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch cases' })
  }
})

// Dashboard статистика
app.get('/api/dashboard', async (req, res) => {
  try {
    const totalCases = await db.select({ count: sql`count(*)` }).from(cases)
    const activeCases = await db.select({ count: sql`count(*)` }).from(cases).where(eq(cases.status, 'active'))
    const pendingCases = await db.select({ count: sql`count(*)` }).from(cases).where(eq(cases.status, 'pending'))
    const paidCases = await db.select({ count: sql`count(*)` }).from(cases).where(eq(cases.status, 'paid'))
    const totalDocuments = await db.select({ count: sql`count(*)` }).from(documents)
    const totalUsers = await db.select({ count: sql`count(*)` }).from(users)
    
    // Payment stats
    const totalPayments = await db.select({ count: sql`count(*)` }).from(payments)
    const paidPayments = await db.select({ amount: sql`COALESCE(SUM(amount), 0)` })
      .from(payments)
      .where(sql`status IN ('paid', 'completed', 'success')`)
    const pendingPayments = await db.select({ amount: sql`COALESCE(SUM(amount), 0)` })
      .from(payments)
      .where(sql`status NOT IN ('paid', 'completed', 'success')`)
    
    res.json({
      cases: {
        total: Number(totalCases[0]?.count || 0),
        active: Number(activeCases[0]?.count || 0),
        pending: Number(pendingCases[0]?.count || 0),
        paid: Number(paidCases[0]?.count || 0)
      },
      documents: {
        total: Number(totalDocuments[0]?.count || 0)
      },
      payments: {
        total: Number(totalPayments[0]?.count || 0),
        paidAmount: Number(paidPayments[0]?.amount || 0),
        pendingAmount: Number(pendingPayments[0]?.amount || 0),
        currency: '₽'
      },
      users: {
        total: Number(totalUsers[0]?.count || 0)
      }
    })
  } catch (err: any) {
    console.error('Dashboard error:', err)


// Admin Dashboard (extended data)
app.get('/api/admin/dashboard', async (req, res) => {
  try {
    // Verify admin
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    if (!decoded.isAdmin) return res.status(403).json({ error: 'Admin access required' })

    const totalCases = await db.select({ count: sql`count(*)` }).from(cases)
    const activeCases = await db.select({ count: sql`count(*)` }).from(cases).where(eq(cases.status, 'active'))
    const pendingCases = await db.select({ count: sql`count(*)` }).from(cases).where(eq(cases.status, 'pending'))
    const paidCases = await db.select({ count: sql`count(*)` }).from(cases).where(eq(cases.status, 'paid'))
    const totalDocuments = await db.select({ count: sql`count(*)` }).from(documents)
    const totalUsers = await db.select({ count: sql`count(*)` }).from(users)
    
    const totalPayments = await db.select({ count: sql`count(*)` }).from(payments)
    const paidPayments = await db.select({ amount: sql`COALESCE(SUM(amount), 0)` })
      .from(payments)
      .where(sql`status IN ('paid', 'completed', 'success')`)
    const pendingPayments = await db.select({ amount: sql`COALESCE(SUM(amount), 0)` })
      .from(payments)
      .where(sql`status NOT IN ('paid', 'completed', 'success')`)

    // Recent cases (last 10)
    const recentCases = await db.select({
      id: cases.id,
      title: cases.title,
      status: cases.status,
      createdAt: cases.createdAt
    }).from(cases).orderBy(desc(cases.createdAt)).limit(10)

    // Recent users (last 10)
    const recentUsers = await db.select({
      id: users.id,
      email: users.email,
      name: users.fullName,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt
    }).from(users).orderBy(desc(users.createdAt)).limit(10)

    // Recent payments (last 10)
    const recentPayments = await db.select({
      id: payments.id,
      amount: payments.amount,
      status: payments.status,
      caseId: payments.caseId,
      createdAt: payments.createdAt
    }).from(payments).orderBy(desc(payments.createdAt)).limit(10)

    // Recent documents (last 10)
    const recentDocs = await db.select({
      id: documents.id,
      name: documents.name,
      caseId: documents.caseId,
      uploadedAt: documents.uploadedAt
    }).from(documents).orderBy(desc(documents.uploadedAt)).limit(10)

    // Get case titles for payments and documents
    const allCaseIds = [...recentPayments.map(p => p.caseId), ...recentDocs.map(d => d.caseId)].filter(Boolean)
    const uniqueCaseIds = [...new Set(allCaseIds)]
    
    let caseMap = new Map()
    if (uniqueCaseIds.length > 0) {
      const caseData = await db.select({ id: cases.id, title: cases.title }).from(cases).where(sql`id IN (${uniqueCaseIds.map(() => '?').join(',')})`, uniqueCaseIds)
      caseMap = new Map(caseData.map(c => [c.id, c.title]))
    }

    // Get document counts for cases
    const caseIds = recentCases.map(c => c.id)
    let docCounts = new Map()
    if (caseIds.length > 0) {
      const docData = await db.select({ 
        caseId: documents.caseId, 
        count: sql`count(*)` 
      }).from(documents).where(sql`case_id IN (${caseIds.map(() => '?').join(',')})`, caseIds).groupBy(documents.caseId)
      docCounts = new Map(docData.map(d => [d.caseId, Number(d.count)]))
    }

    res.json({
      cases: {
        total: Number(totalCases[0]?.count || 0),
        active: Number(activeCases[0]?.count || 0),
        pending: Number(pendingCases[0]?.count || 0),
        paid: Number(paidCases[0]?.count || 0),
        recent: recentCases.map(c => ({
          ...c,
          clientName: c.title,
          documentCount: docCounts.get(c.id) || 0
        }))
      },
      documents: {
        total: Number(totalDocuments[0]?.count || 0),
        recent: recentDocs.map(d => ({
          id: d.id,
          title: d.name,
          caseTitle: caseMap.get(d.caseId) || '—',
          createdAt: d.uploadedAt,
          status: 'uploaded'
        }))
      },
      payments: {
        total: Number(totalPayments[0]?.count || 0),
        paidAmount: Number(paidPayments[0]?.amount || 0),
        pendingAmount: Number(pendingPayments[0]?.amount || 0),
        currency: '₽',
        recent: recentPayments.map(p => ({
          ...p,
          caseTitle: caseMap.get(p.caseId) || '—'
        }))
      },
      users: {
        total: Number(totalUsers[0]?.count || 0),
        recent: recentUsers.map(u => ({
          ...u,
          isAdmin: Boolean(u.isAdmin),
          caseCount: 0
        }))
      }
    })
  } catch (err: any) {
    console.error('Admin dashboard error:', err)
    res.status(500).json({ error: 'Failed to fetch admin dashboard', details: err.message })
  }
})

// Admin Dashboard (extended data)
app.get('/api/admin/dashboard', async (req, res) => {
  try {
    // Verify admin
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    if (!decoded.isAdmin) return res.status(403).json({ error: 'Admin access required' })

    const totalCases = await db.select({ count: sql`count(*)` }).from(cases)
    const activeCases = await db.select({ count: sql`count(*)` }).from(cases).where(eq(cases.status, 'active'))
    const pendingCases = await db.select({ count: sql`count(*)` }).from(cases).where(eq(cases.status, 'pending'))
    const paidCases = await db.select({ count: sql`count(*)` }).from(cases).where(eq(cases.status, 'paid'))
    const totalDocuments = await db.select({ count: sql`count(*)` }).from(documents)
    const totalUsers = await db.select({ count: sql`count(*)` }).from(users)
    
    const totalPayments = await db.select({ count: sql`count(*)` }).from(payments)
    const paidPayments = await db.select({ amount: sql`COALESCE(SUM(amount), 0)` })
      .from(payments)
      .where(sql`status IN ('paid', 'completed', 'success')`)
    const pendingPayments = await db.select({ amount: sql`COALESCE(SUM(amount), 0)` })
      .from(payments)
      .where(sql`status NOT IN ('paid', 'completed', 'success')`)

    // Recent cases (last 10)
    const recentCases = await db.select({
      id: cases.id,
      title: cases.title,
      status: cases.status,
      createdAt: cases.createdAt
    }).from(cases).orderBy(desc(cases.createdAt)).limit(10)

    // Recent users (last 10)
    const recentUsers = await db.select({
      id: users.id,
      email: users.email,
      name: users.fullName,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt
    }).from(users).orderBy(desc(users.createdAt)).limit(10)

    // Recent payments (last 10)
    const recentPayments = await db.select({
      id: payments.id,
      amount: payments.amount,
      status: payments.status,
      caseId: payments.caseId,
      createdAt: payments.createdAt
    }).from(payments).orderBy(desc(payments.createdAt)).limit(10)

    // Recent documents (last 10)
    const recentDocs = await db.select({
      id: documents.id,
      name: documents.name,
      caseId: documents.caseId,
      uploadedAt: documents.uploadedAt
    }).from(documents).orderBy(desc(documents.uploadedAt)).limit(10)

    // Get case titles for payments and documents
    const allCaseIds = [...recentPayments.map(p => p.caseId), ...recentDocs.map(d => d.caseId)].filter(Boolean)
    const uniqueCaseIds = [...new Set(allCaseIds)]
    
    let caseMap = new Map()
    if (uniqueCaseIds.length > 0) {
      const caseData = await db.select({ id: cases.id, title: cases.title }).from(cases).where(sql`id IN (${uniqueCaseIds.map(() => '?').join(',')})`, uniqueCaseIds)
      caseMap = new Map(caseData.map(c => [c.id, c.title]))
    }

    // Get document counts for cases
    const caseIds = recentCases.map(c => c.id)
    let docCounts = new Map()
    if (caseIds.length > 0) {
      const docData = await db.select({ 
        caseId: documents.caseId, 
        count: sql`count(*)` 
      }).from(documents).where(sql`case_id IN (${caseIds.map(() => '?').join(',')})`, caseIds).groupBy(documents.caseId)
      docCounts = new Map(docData.map(d => [d.caseId, Number(d.count)]))
    }

    res.json({
      cases: {
        total: Number(totalCases[0]?.count || 0),
        active: Number(activeCases[0]?.count || 0),
        pending: Number(pendingCases[0]?.count || 0),
        paid: Number(paidCases[0]?.count || 0),
        recent: recentCases.map(c => ({
          ...c,
          clientName: c.title,
          documentCount: docCounts.get(c.id) || 0
        }))
      },
      documents: {
        total: Number(totalDocuments[0]?.count || 0),
        recent: recentDocs.map(d => ({
          id: d.id,
          title: d.name,
          caseTitle: caseMap.get(d.caseId) || '—',
          createdAt: d.uploadedAt,
          status: 'uploaded'
        }))
      },
      payments: {
        total: Number(totalPayments[0]?.count || 0),
        paidAmount: Number(paidPayments[0]?.amount || 0),
        pendingAmount: Number(pendingPayments[0]?.amount || 0),
        currency: '₽',
        recent: recentPayments.map(p => ({
          ...p,
          caseTitle: caseMap.get(p.caseId) || '—'
        }))
      },
      users: {
        total: Number(totalUsers[0]?.count || 0),
        recent: recentUsers.map(u => ({
          ...u,
          isAdmin: Boolean(u.isAdmin),
          caseCount: 0
        }))
      }
    })
  } catch (err: any) {
    console.error('Admin dashboard error:', err)
    res.status(500).json({ error: 'Failed to fetch admin dashboard', details: err.message })
  }
})



// Получение дела
app.get('/api/cases/:id', async (req, res) => {
  try {
    const caseId = req.params.id
    const caseData = await db.select().from(cases).where(eq(cases.id, caseId))
    
    if (!caseData.length) {
      return res.status(404).json({ error: 'Case not found' })
    }
    
    const docs = await db.select().from(documents).where(eq(documents.caseId, caseId))
    
    res.json({
      ...caseData[0],
      documents: docs
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch case' })
  }
})

// Загрузка документов к делу — с микросервисами
app.post('/api/cases/:id/documents', uploadLimiter, upload.array('files', 50), async (req, res) => {
  try {
    const caseId = req.params.id
    const files = req.files as Express.Multer.File[]
    
    if (!files?.length) {
      return res.status(400).json({ error: 'No files' })
    }
    
    for (const file of files) {
      const docId = uuidv4()
      const fixedName = Buffer.from(file.originalname, 'latin1').toString('utf8')
      console.log('[DOCUMENTS] Processing upload:', fixedName)

      // 1. Upload to MinIO (microservice)
      let minioPath = null
      try {
        minioPath = await uploadToMinIO(file.path, fixedName)
      } catch (e: any) {
        console.log('[DOCUMENTS] MinIO upload failed, fallback to local:', e.message)
      }

      // 2. OCR (microservice) for PDFs
      let extractedText = null
      if (file.mimetype === 'application/pdf' || fixedName.endsWith('.pdf')) {
        try {
          extractedText = await callOCR(file.path)
          console.log('[DOCUMENTS] OCR extracted text length:', extractedText?.length || 0)
        } catch (e: any) {
          console.log('[DOCUMENTS] OCR failed, fallback to local extractPdfText:', e.message)
          try {
            extractedText = await extractPdfText(file.path, 3000)
          } catch (e2: any) {
            console.log('[DOCUMENTS] Local PDF extraction also failed:', e2.message)
          }
        }
      } else {
        try {
          extractedText = (await fs.promises.readFile(file.path, 'utf-8')).substring(0, 3000)
        } catch (e: any) {
          console.log('[DOCUMENTS] Text file read error:', e.message)
        }
      }
      
      // Generate summary if we have text
      let summary = null
      if (extractedText && extractedText.length > 100) {
        try {
          summary = await summarizeDocument(extractedText)
          console.log('[DOCUMENTS] Summary generated:', summary ? 'yes' : 'no', 'length:', summary?.length || 0)
        } catch (e: any) {
          console.log('[DOCUMENTS] Summary generation failed:', e.message)
        }
      }

      await db.insert(documents).values({
        id: docId,
        caseId,
        name: fixedName,
        type: file.mimetype,
        size: file.size,
        path: file.path,
        minioPath: minioPath || null,
        extractedText: extractedText || null,
        summary: summary || null
      })
      console.log('[DOCUMENTS] Saved document:', docId, 'minioPath:', minioPath ? 'yes' : 'no', 'extractedText:', extractedText ? 'yes' : 'no')
    }
    
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to upload' })
  }
})

// AI-анализ дела — с микросервисами
app.post('/api/cases/:id/analyze', aiLimiter, async (req, res) => {
  try {
    const caseId = req.params.id
    
    // Получаем данные дела
    const caseData = await db.select().from(cases).where(eq(cases.id, caseId))
    const docs = await db.select().from(documents).where(eq(documents.caseId, caseId))
    
    if (!caseData.length) {
      return res.status(404).json({ error: 'Case not found' })
    }
    
    const c = caseData[0]
    
    // Собираем текст из документов (используем extractedText из БД, fallback на локальные файлы)
    let documentsText = ''
    let docsProcessed = 0
    for (const doc of docs) {
      if (docsProcessed >= 10) break
      let text = ''
      
      // Сначала пробуем читать файл свежо (extractPdfText + OCR), только если не получилось - используем extractedText из БД
      if (false && doc.extractedText) {  // DISABLED: always read fresh to avoid stale OCR
        text = smartTruncate(doc.extractedText, 8000)
        console.log('[ANALYZE] Using extractedText from DB for:', doc.name, 'length:', text.length)
      } else if (doc.type === 'application/pdf' || doc.name.endsWith('.pdf')) {
        // Fallback: читаем локальный файл
        try {
          console.log('[ANALYZE] Fallback: reading local PDF:', doc.path)
          text = await extractPdfText(doc.path, 10000)
          if (text && text.length > 100) {
            await db.update(documents).set({ extractedText: text }).where(eq(documents.id, doc.id))
          }
          console.log("[ANALYZE] PDF text length:", text.length)
        } catch (e: any) {
          console.log('[ANALYZE] PDF read error:', e.message)
        }
        // u0415u0441u043bu0438 u0442u0435u043au0441u0442 u0441u043bu0438u0448u043au043eu043c u043au043eu0440u043eu0442u043au0438u0439 u2014 u0441u043au0430u043d, u043fu0440u043eu0431u0443u0435u043c OCR
        if (!text || text.length < 100) {
          console.log('[ANALYZE] PDF u043fu043eu0445u043eu0436 u043du0430 u0441u043au0430u043d, u043fu0440u043eu0431u0443u0435u043c OCR...')
          try {
            const ocrText = await callOCR(doc.path)
            if (ocrText && ocrText.length > 100) {
              text = ocrText
              await db.update(documents).set({ extractedText: ocrText }).where(eq(documents.id, doc.id))
              console.log('[ANALYZE] OCR u0443u0441u043fu0435u0445, u0442u0435u043au0441u0442:', ocrText.length)
            } else {
              console.log('[ANALYZE] OCR u043du0435 u0432u0435u0440u043du0443u043b u0442u0435u043au0441u0442')
            }
          } catch (e: any) {
            console.log('[ANALYZE] OCR u043eu0448u0438u0431u043au0430:', e.message)
          }
        }
        if (!text || text.length < 10) {
          text = '(u043du0435 u0443u0434u0430u043bu043eu0441u044c u043fu0440u043eu0447u0438u0442u0430u0442u044c PDF)'
        }
      } else if (doc.name.endsWith('.docx') || doc.name.endsWith('.doc')) {
        // DOCX fallback
        try {
          console.log('[ANALYZE] Fallback: reading local DOCX:', doc.path)
          text = await extractDocxText(doc.path, 3000)
        } catch (e: any) {
          console.log('[ANALYZE] DOCX read error:', e.message)
          text = '(не удалось прочитать DOCX)'
        }
      } else if (doc.type?.startsWith('image/') || doc.name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)) {
        // Image fallback — OCR
        try {
          console.log('[ANALYZE] Fallback: OCR for image:', doc.path)
          text = await callOCR(doc.path) || '(OCR не распознал текст)'
        } catch (e: any) {
          console.log('[ANALYZE] OCR error:', e.message)
          text = '(не удалось распознать изображение)'
        }
      }
      
      if (text || doc.summary) {
        const docType = doc.type || doc.name.split('.').pop() || 'unknown';
        const docFacts = text || doc.extractedText || doc.summary || '(не удалось прочитать)';
        documentsText += `\n=== ДОКУМЕНТ: ${doc.name} ===\nТИП: ${docType}\nКЛЮЧЕВЫЕ ФАКТЫ: ${docFacts}\n`;
        docsProcessed++
      }
    }
    
    console.log('[ANALYZE] Documents text length:', documentsText.length)
    console.log('[ANALYZE] Documents text preview:', documentsText.substring(0, 200))
    
    // Микросервис AI отключён — используем только прямой вызов OpenAI
    let analysis = ''
    let suggestedActions: string[] = []
    let usedMicroservice = false
    /*
    try {
      console.log('[ANALYZE] Calling AI microservice...')
      const aiResult = await callAIService('/analyze', {
        caseId,
        title: c.title,
        description: c.description,
        documentsText
      })
      
      if (aiResult && aiResult.analysis) {
        analysis = aiResult.analysis
        suggestedActions = aiResult.suggestedActions || []
        usedMicroservice = true
        console.log('[ANALYZE] AI microservice success, analysis length:', analysis.length)
      }
    } catch (e: any) {
      console.log('[ANALYZE] AI microservice failed, fallback to direct OpenAI:', e.message)
    }
    */
    
    // Fallback: прямой вызов OpenAI
    if (!usedMicroservice) {
      const prompt = `
Проанализируй юридическую ситуацию:

Название: ${c.title}
Описание: ${c.description || 'Не указано'}
Документов: ${docs.length}

${documentsText ? 'Содержание документов:' + documentsText : 'Документы приложены, но текст не извлечён.'}

Дай краткий анализ (3-5 пунктов), основываясь ТОЛЬКО на содержании документов:
1. Что нужно сделать в первую очередь (конкретные шаги)
2. Какие документы потребуются (чего не хватает в материалах)
3. Возможные риски (конкретные слабые места)
4. Рекомендации по стратегии (опираясь на факты из документов)

Если в документах есть конкретные суммы, даты, статьи закона, ФИО, адреса, реквизиты — укажи их ТОЧНО как в тексте. Если чего-то нет в тексте — напиши [НЕТ В ДОКУМЕНТЕ], НЕ выдумывай и НЕ додумывай.
Формат: кратко, по делу, без воды, БЕЗ markdown (без звездочек, без решеток, без списков с точками).

Также предложи 4-5 конкретных вариантов действий для клиента после анализа. Обязательно включи вариант "Закрыть дело и уйти" (если нет перспектив или клиент не хочет продолжать). Другие варианты могут быть: подготовить исковое заявление, написать претензию, запросить дополнительные документы, досудебное урегулирование.

ВАЖНО: Отвечай ТОЛЬКО в этом формате (без markdown, без звездочек, без решеток, без списков с точками):
ANALYSIS:
[текст анализа простым текстом]

ACTIONS:
1. [Название действия] - [Краткое описание]
2. [Название действия] - [Краткое описание]
3. [Название действия] - [Краткое описание]
4. [Название действия] - [Краткое описание]
...`

      const completion = await openai.chat.completions.create({
        model: 'kimi-k2.5',
        messages: [
          { role: 'system', content: 'Ты юридический консультант. Даёшь конкретные рекомендации.' },
          { role: 'user', content: prompt }
        ],
        temperature: 1,
        max_tokens: 16000
      })
      
      const generatedText = completion.choices[0].message.content || completion.choices[0].message.reasoning_content || ''
      console.log("[ANALYZE] AI finish_reason:", completion.choices[0].finish_reason)
      console.log("[ANALYZE] AI message object:", JSON.stringify(completion.choices[0].message, null, 2))
      console.log('[ANALYZE] AI generatedText length:', generatedText ? generatedText.length : 0)
      console.log('[ANALYZE] AI generatedText preview:', generatedText ? generatedText.substring(0, 200) : 'NULL')
      
      let rawAnalysis = cleanMarkdown(generatedText)
      let rawSuggestedActions: string[] = []
      
      const analysisMatch = generatedText.match(/(?:^|\n)\s*(?:•\s*)?ANALYSIS:\s*([\s\S]+?)(?=\n\s*(?:•\s*)?ACTIONS:|$)/i)
      const actionsMatch = generatedText.match(/(?:^|\n)\s*(?:•\s*)?ACTIONS:\s*([\s\S]+)/i)
      
      if (analysisMatch && actionsMatch) {
        rawAnalysis = analysisMatch[1].trim()
        const actionsText = actionsMatch[1].trim()
        rawSuggestedActions = actionsText.split('\n')
          .map(line => line.trim())
          .filter(line => line.match(/^\d+\./))
          .map(line => line.replace(/^\d+\.\s*/, ''))
      } else if (actionsMatch) {
        const actionsText = actionsMatch[1].trim()
        rawSuggestedActions = actionsText.split('\n')
          .map(line => line.trim())
          .filter(line => line.match(/^\d+\./))
          .map(line => line.replace(/^\d+\.\s*/, ''))
        rawAnalysis = generatedText.replace(/ACTIONS:\s*[\s\S]+/, '').trim()
      } else {
        rawAnalysis = generatedText.trim()
        rawSuggestedActions = [
          'Подготовить исковое заявление',
          'Написать претензию',
          'Собрать дополнительные документы',
          'Закрыть дело и уйти'
        ]
      }
      
      analysis = rawAnalysis
      suggestedActions = rawSuggestedActions
    }
    
    // Сохраняем анализ и действия
    await db.update(cases)
      .set({ 
        analysis,
        status: 'active'
      })
      .where(eq(cases.id, caseId))
    
    res.json({ analysis, suggestedActions, usedMicroservice })
  } catch (err: any) {
    console.error('Analyze error:', err)
    res.status(500).json({ error: 'Failed to analyze', details: err.message })
  }
})

// Скачивание документа — с микросервисами (MinIO fallback)
app.get('/api/documents/:id', async (req, res) => {
  try {
    const docId = req.params.id
    const docs = await db.select().from(documents).where(eq(documents.id, docId))
    
    if (!docs.length) {
      return res.status(404).json({ error: 'Document not found' })
    }
    
    const doc = docs[0]
    
    // Проверяем оплату (ОТКЛЮЧЕНО ДЛЯ ТЕСТИРОВАНИЯ)
    const TEST_MODE = false
    if (!TEST_MODE) {
      const paymentCheck = await db.select()
        .from(payments)
        .where(eq(payments.documentId, docId))
        .orderBy(payments.createdAt)
        .limit(1)
      
      const isPaid = paymentCheck.length > 0 && 
        (paymentCheck[0].status === "success" || paymentCheck[0].status === "completed" || paymentCheck[0].status === "paid")
      
      if (!isPaid) {
        return res.status(403).json({ 
          error: "Payment required", 
          message: "Документ доступен только после оплаты. Цена: 499 ₽",
          paymentRequired: true,
          amount: 499
        })
      }
    }
    
    // Если есть minioPath — пробуем скачать из MinIO
    if (doc.minioPath) {
      try {
        console.log('[DOWNLOAD] Trying MinIO for document:', docId)
        const tempPath = `/tmp/${docId}_${doc.name}`
        const success = await downloadFromMinIO(doc.minioPath, tempPath)
        if (success && fs.existsSync(tempPath)) {
          console.log('[DOWNLOAD] Serving from MinIO temp path:', tempPath)
          return res.download(tempPath, doc.name)
        }
      } catch (e: any) {
        console.log('[DOWNLOAD] MinIO download failed, fallback to local:', e.message)
      }
    }
    
    // Fallback: локальный файл (проверяем несколько возможных путей)
    const possiblePaths = [
      doc.path,
      '/var/www/legal-mrl/' + doc.path,
      '/var/www/legal-mrl/api/' + doc.path
    ].filter(p => p)
    
    let foundPath = null
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        foundPath = p
        console.log('[DOWNLOAD] Found file at:', p)
        break
      }
    }
    
    if (foundPath) {
      console.log('[DOWNLOAD] Serving from local path:', foundPath)
      return res.download(foundPath, doc.name)
    }
    
    console.log('[DOWNLOAD] File not found. Tried paths:', possiblePaths)
    res.status(404).json({ error: 'File not found neither in MinIO nor locally' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to download' })
  }
})

// Удаление документа
app.delete('/api/cases/:caseId/documents/:docId', async (req, res) => {
  try {
    const { caseId, docId } = req.params
    
    // Проверяем существование документа
    const docs = await db.select().from(documents).where(eq(documents.id, docId))
    if (!docs.length) {
      return res.status(404).json({ error: 'Document not found' })
    }
    
    const doc = docs[0]
    if (doc.caseId !== caseId) {
      return res.status(403).json({ error: 'Document does not belong to this case' })
    }
    
    // Удаляем файл с диска
    try {
      if (fs.existsSync(doc.path)) {
        fs.unlinkSync(doc.path)
      }
    } catch (e) {
      console.log('File delete error:', e)
    }
    
    // Удаляем из БД
    await db.delete(documents).where(eq(documents.id, docId))
    
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete document' })
  }
})

// Генерация юридического документа (иск, претензия и т.д.)
app.post('/api/cases/:id/generate', aiLimiter, async (req, res) => {
  try {
    const caseId = req.params.id
    const { documentType, clientData } = req.body
    
    // Получаем данные дела
    const caseData = await db.select().from(cases).where(eq(cases.id, caseId))
    if (!caseData.length) {
      return res.status(404).json({ error: 'Case not found' })
    }
    
    const c = caseData[0]
    const docs = await db.select().from(documents).where(eq(documents.caseId, caseId))
    
    // Читаем документы для контекста (используем extractedText, fallback на локальные файлы)
    let documentsText = ''
    let docsProcessed = 0
    for (const doc of docs) {
      if (docsProcessed >= 5) break
      let text = ''
      if (doc.summary) {
        text = doc.summary
      } else if (false && doc.extractedText) {  // DISABLED: always read fresh to avoid stale OCR
        text = smartTruncate(doc.extractedText, 2000)
      } else if (doc.type === 'application/pdf' || doc.name.endsWith('.pdf')) {
        try {
          text = await extractPdfText(doc.path, 2000)
        } catch (e: any) {
          console.log('PDF read error:', e.message)
        }
      }
      if (text) {
        documentsText += `\n--- ${doc.name} ---\n${text}\n`
        docsProcessed++
      }
    }
    
    const prompt = `ЗАДАЧА: Подготовь юридический документ типа "${documentType}"

ДЕЛО: ${c.title}
ОПИСАНИЕ: ${c.description || 'Не указано'}

ДАННЫЕ КЛИЕНТА:
${Object.entries(clientData).map(([k, v]) => `${k}: ${v}`).join('\n')}

${documentsText ? 'МАТЕРИАЛЫ ДЕЛА (из загруженных документов):\n' + documentsText : ''}

ТРЕБОВАНИЯ:
1. Используй ТОЛЬКО факты из материалов дела и данных клиента — не выдумывай
2. Официальный юридический стиль, ссылки на законы РФ
3. Включи все реквизиты, даты, суммы, ФИО из материалов
4. Документ должен быть готов к подаче в суд или отправке
5. Пиши ТОЛЬКО по делу — без воды, общих рассуждений и шаблонных фраз
6. Если для документа достаточно 3000-5000 знаков — пиши столько, НЕ растягивай до максимума
7. Максимальный объем — 35000 знаков

ФОРМАТ ОТВЕТА (обязательно):
TITLE: [Точное название документа]
BODY:
[Полный текст документа без сокращений]
`

    const completion = await openai.chat.completions.create({
      model: 'kimi-k2.5',
      messages: [
        { role: 'system', content: 'Ты юрист с 20-летним стажем. Составляешь юридические документы любого типа: судебные, договорные, претензии. Определяешь категорию документа самостоятельно и применяешь правильную структуру. ИСПОЛЬЗУЙ ТОЛЬКО предоставленные данные клиента. НЕ выдумывай имена, суммы, даты, адреса, реквизиты, номера договоров, паспортные данные. Если данных недостаточно — укажи [УТОЧНИТЬ]. Пиши ТОЛЬКО по делу, без воды и общих фраз. Текст должен быть ЧИСТЫМ — без markdown-разметки (*, **, #, ` и т.д.). Максимум 35000 знаков.' },
        { role: 'user', content: prompt }
      ],
      temperature: 1,
      max_tokens: 16000
    })
    
    const generatedText = completion.choices[0].message.content || completion.choices[0].message.reasoning_content || ''
    
    // Парсим заголовок и тело
    const titleMatch = generatedText.match(/TITLE:\s*(.+)/)
    const bodyMatch = generatedText.match(/BODY:\s*([\s\S]+)/)
    
    let title = titleMatch ? titleMatch[1].trim().substring(0, 500) : documentType
    let body = cleanMarkdown(bodyMatch ? bodyMatch[1].trim() : generatedText)
    
    // Если формат не соблюден — используем весь текст как body
    if (!bodyMatch && generatedText) {
      body = cleanMarkdown(generatedText)
    }
    
    // Сохраняем в БД как новый документ
    const generatedId = uuidv4()
    await db.insert(cases).values({
      id: generatedId,
      title: `${documentType} — ${c.title}`,
      description: body,
      status: 'generated',
      analysis: JSON.stringify({
        documentType,
        clientData,
        originalCaseId: caseId,
        title,
        preview: body.substring(0, 500) + '...',
        paid: false
      })
    })
    
    res.json({
      id: generatedId,
      title,
      preview: body.substring(0, 500) + '...',
      fullText: body,
      paid: false
    })
  } catch (err) {
    console.error('Generate error:', err)
    res.status(500).json({ error: 'Failed to generate document', details: err.message })
  }
})


// Генерация документа (новый эндпоинт для фронтенда) — с микросервисами
app.post('/api/cases/:id/generate-document', aiLimiter, async (req, res) => {
  try {
    const caseId = req.params.id
    const { documentType: dt, clientData, position } = req.body
    let documentType = dt || req.body.action || 'claim'
    if (documentType.length > 30) {
      const lower = documentType.toLowerCase()
      if (lower.includes('иск')) documentType = 'claim'
      else if (lower.includes('ответ')) documentType = 'respond'
      else if (lower.includes('возраж')) documentType = 'objection'
      else if (lower.includes('претенз')) documentType = 'claim'
      else if (lower.includes('договор')) documentType = 'contract'
      else if (lower.includes('соглаш')) documentType = 'settlement'
      else if (lower.includes('заявл')) documentType = 'claim'
      else if (lower.includes('ходатай')) documentType = 'motion'
      else documentType = 'claim'
    }
    const caseData = await db.select().from(cases).where(eq(cases.id, caseId))
    if (!caseData.length) {
      return res.status(404).json({ error: 'Case not found' })
    }

    const c = caseData[0]
    const docs = await db.select().from(documents).where(eq(documents.caseId, caseId))

    // Собираем текст из документов (используем extractedText, fallback на локальные файлы)
    let documentsText = ''
    let docsProcessed = 0
    for (const doc of docs) {
      if (docsProcessed >= 5) break
      let text = ''
      if (false && doc.extractedText) {  // DISABLED: always read fresh to avoid stale OCR
        text = smartTruncate(doc.extractedText, 2000)
        console.log('[GENERATE-DOC] Using extractedText from DB:', doc.name)
      } else if (doc.type === 'application/pdf' || doc.name.endsWith('.pdf')) {
        try {
          console.log('[GENERATE-DOC] Fallback: reading local PDF:', doc.name)
          text = await extractPdfText(doc.path, 2000)
        } catch (e: any) {
          console.log('PDF read error:', e.message)
        }
      }
      if (text) {
        documentsText += `\n--- ${doc.name} ---\n${text}\n`
        docsProcessed++
      }
    }

    let title = documentType
    let body = ''
    let usedMicroservice = false

    // 1. Пробуем микросервис AI
    try {
      console.log('[GENERATE-DOC] Calling AI microservice...')
      const aiResult = await callAIService('/generate', {
        documentType,
        clientData,
        position: position || 'plaintiff',
        caseTitle: c.title,
        caseDescription: c.description,
        caseAnalysis: c.analysis,
        documentsText
      })
      
      if (aiResult && aiResult.content) {
        console.log('[GENERATE-DOC] AI microservice success, content length:', aiResult.content.length)
        const generatedText = aiResult.content
        const titleMatch = generatedText.match(/TITLE:\s*(.+)/)
        const bodyMatch = generatedText.match(/BODY:\s*([\s\S]+)/)
        title = titleMatch ? titleMatch[1].trim() : documentType
        body = cleanMarkdown(bodyMatch ? bodyMatch[1].trim() : generatedText)
        usedMicroservice = true
      }
    } catch (e: any) {
      console.log('[GENERATE-DOC] AI microservice failed, fallback to direct OpenAI:', e.message)
    }

    // 2. Fallback: прямой вызов OpenAI
    if (!usedMicroservice) {
      const prompt = `
Подготовь юридический документ: ${documentType}

Дело: ${c.title}
Описание: ${c.description || 'Не указано'}
Сторона: ${position || 'plaintiff'}

Данные клиента:
${Object.entries(clientData || {}).map(([k, v]) => `${k}: ${v}`).join('\n')}

${c.analysis ? `Первичный анализ дела:
${(c.analysis || '').substring(0, 4000)}

` : ''}${documentsText ? 'Контекст из документов:' + documentsText : ''}

Сегодня 18 июня 2026 года. Составь юридический документ: ${documentType}

ПРАВИЛА СОСТАВЛЕНИЯ:

ШАГ 1. Определи категорию документа самостоятельно:
- СУДЕБНЫЕ (иск, отзыв, возражение, заявление, ходатайство) — шапка с наименованием суда, данные сторон, цена иска, структура: вводная → описательная → мотивировочная → резолютивная
- ДОГОВОРНЫЕ (договор, доп. соглашение, соглашение о расторжении, акт) — реквизиты сторон (ФИО/наименование, ИНН, ОГРН, адрес), преамбула со ссылкой на основной договор, пронумерованные пункты изменений
- ПРЕТЕНЗИЯ (досудебная) — реквизиты адресата, суть претензии, требования, срок ответа, ссылки на закон
- ИНОЕ — определи самую подходящую структуру

ШАГ 2. Обязательно:
- Ссылки на актуальное законодательство РФ (2026 год): конкретные статьи ГК РФ, ГПК РФ, КАС РФ, ТК РФ, НК РФ и др.
- Только предоставленные данные. НЕ выдумывай ФИО, адреса, даты, суммы, реквизиты, ИНН, ОГРН. Если данных нет — укажи [УТОЧНИТЬ]
- Текст ЧИСТЫЙ — без markdown: НЕ используй звёздочки, решётки, бэктики, подчёркивания, зачёркивания
- НЕ используй списки с маркерами — пиши связным текстом
- Без воды и общих фраз — только по делу
- Максимум 35000 знаков

Формат ответа:
TITLE: [Точное название документа]
BODY:
[Полный текст с правильной структурой]
`

      const completion = await openai.chat.completions.create({
        model: 'kimi-k2.5',
        messages: [
          { role: 'system', content: 'Ты юрист с 20-летним стажем. Составляешь юридические документы любого типа: судебные, договорные, претензии. Определяешь категорию документа самостоятельно и применяешь правильную структуру. ИСПОЛЬЗУЙ ТОЛЬКО предоставленные данные клиента. НЕ выдумывай имена, суммы, даты, адреса, реквизиты, номера договоров, паспортные данные. Если данных недостаточно — укажи [УТОЧНИТЬ]. Пиши ТОЛЬКО по делу, без воды и общих фраз. Текст должен быть ЧИСТЫМ — без markdown-разметки (*, **, #, ` и т.д.). Максимум 35000 знаков.' },
          { role: 'user', content: prompt }
        ],
        temperature: 1,
        max_tokens: 16000
      })

      const generatedText = completion.choices[0].message.content || completion.choices[0].message.reasoning_content || ''

      const titleMatch = generatedText.match(/TITLE:\s*(.+)/)
      const bodyMatch = generatedText.match(/BODY:\s*([\s\S]+)/)

      title = titleMatch ? titleMatch[1].trim() : documentType
      body = cleanMarkdown(bodyMatch ? bodyMatch[1].trim() : generatedText)
    }

    // 3. Пробуем DocGen микросервис для форматирования
    let docGenResult = null
    if (usedMicroservice) {
      try {
        console.log('[GENERATE-DOC] Calling DocGen microservice...')
        docGenResult = await callDocGen(body, clientData, documentType)
        console.log('[GENERATE-DOC] DocGen success:', docGenResult?.url || docGenResult?.path)
      } catch (e: any) {
        console.log('[GENERATE-DOC] DocGen failed:', e.message)
      }
    }

    const generatedId = uuidv4()
    await db.insert(cases).values({
      id: generatedId,
      title: `${documentType} — ${c.title}`,
      description: body,
      status: 'generated',
      analysis: JSON.stringify({
        documentType,
        clientData,
        originalCaseId: caseId,
        title,
        preview: body.substring(0, 500) + '...',
        paid: false,
        usedMicroservice,
        docGenUrl: docGenResult?.url || null
      })
    })

    // Update original case with generated document
    await db.update(cases).set({
      generatedDocument: body,
      status: 'active',
      updatedAt: new Date()
    }).where(eq(cases.id, caseId))

    res.json({
      id: generatedId,
      title,
      content: body,
      preview: body.substring(0, 500) + '...',
      paid: false,
      usedMicroservice,
      docGenUrl: docGenResult?.url || null
    })
  } catch (err: any) {
    console.error('Generate-document error:', err)
    res.status(500).json({ error: 'Failed to generate document', details: err.message })
  }
})

// Извлечение фактов из документа
app.post('/api/documents/:id/extract', async (req, res) => {
  try {
    const docId = req.params.id
    const docs = await db.select().from(documents).where(eq(documents.id, docId))

    if (!docs.length) {
      return res.status(404).json({ error: 'Document not found' })
    }

    const doc = docs[0]

    // Сначала пробуем читать файл свежо (extractPdfText + OCR), только если не получилось - используем extractedText из БД
    let documentText = doc.extractedText || ''
    if (!documentText) {
      if (!fs.existsSync(doc.path)) {
        return res.status(404).json({ error: 'File not found on disk' })
      }
      
      if (doc.type === 'application/pdf' || doc.name.endsWith('.pdf')) {
        try {
          documentText = await extractPdfText(doc.path, 8000)
          console.log('[EXTRACT] PDF text length:', documentText.length)
        } catch (e: any) {
          console.log('[EXTRACT] PDF read error:', e.message)
        }
        
        // Если текст слишком короткий — скан, пробуем OCR
        if (!documentText || documentText.length < 100) {
          console.log('[EXTRACT] PDF похож на скан, пробуем OCR...')
          try {
            const ocrText = await callOCR(doc.path)
            if (ocrText && ocrText.length > 100) {
              documentText = ocrText
              console.log('[EXTRACT] OCR успех, текст:', ocrText.length)
            } else {
              console.log('[EXTRACT] OCR не вернул текст')
            }
          } catch (e: any) {
            console.log('[EXTRACT] OCR ошибка:', e.message)
          }
        }
        
        if (!documentText || documentText.length < 10) {
          return res.status(422).json({ error: 'PDF содержит сканированные изображения — текст не извлечен. Загрузите PDF с текстовым слоем или используйте OCR.' })
        }
      } else {
        try {
          documentText = (await fs.promises.readFile(doc.path, 'utf-8')).substring(0, 8000)
        } catch (e: any) {
          console.log('Text read error:', e.message)
          return res.status(500).json({ error: 'Failed to read file', details: e.message })
        }
      }
    }

    const prompt = `
Проанализируй документ и извлеки ключевые юридические факты:

Название документа: ${doc.name}

Текст документа:
${documentText}

Извлеки следующие факты (если присутствуют):
1. Даты (когда произошло событие, сроки, дедлайны)
2. Суммы (денежные требования, штрафы, пени)
3. Стороны (ФИО, названия организаций, ИНН, адреса)
4. Предмет (о чем документ, что описывается)
5. Обязательства (кто что должен сделать)
6. Нарушения (если есть — что нарушено, ссылки на законы/статьи)
7. Доказательства (какие документы, факты подтверждают позицию)

Формат ответа:
FACTS:
- [категория]: [конкретный факт]
- [категория]: [конкретный факт]
...
`

    const completion = await openai.chat.completions.create({
      model: 'kimi-k2.5',
      messages: [
        { role: 'system', content: 'Ты юридический аналитик. Извлекаешь конкретные факты из документов. Отвечай кратко и по делу.' },
        { role: 'user', content: prompt }
      ],
      temperature: 1,
      max_tokens: 2000
    })

    const generatedText = completion.choices[0].message.content || completion.choices[0].message.reasoning_content || ''

    const factsMatch = generatedText.match(/FACTS:\s*([\s\S]+)/)
    const extractedFacts = factsMatch ? factsMatch[1].trim() : generatedText

    res.json({
      documentId: docId,
      documentName: doc.name,
      extractedFacts,
      textLength: documentText.length
    })
  } catch (err: any) {
    console.error('Extract error:', err)
    res.status(500).json({ error: 'Failed to extract facts', details: err.message })
  }
})
// Оплата дела (генерация документа)
app.post('/api/cases/:id/pay', async (req, res) => {
  try {
    const caseId = req.params.id
    const caseData = await db.select().from(cases).where(eq(cases.id, caseId))
    
    if (!caseData.length) {
      return res.status(404).json({ error: 'Case not found' })
    }
    
    const c = caseData[0]
    const { amount = 499, method = 'sbp' } = req.body
    
    const publicId = process.env.ITPAY_PUBLIC_ID
    const apiSecret = process.env.ITPAY_API_SECRET
    
    if (!publicId || !apiSecret) {
      return res.status(500).json({ error: 'ITPAY credentials not configured' })
    }
    
    const clientPaymentId = uuidv4()
    
    const payload = {
      amount: String(amount),
      client_payment_id: clientPaymentId,
      method: method,
      description: 'Оплата документа DokIQ',
      success_url: 'http://62.113.110.117:8081/payment/success',
      success_url_description: 'Вернуться на сайт',
      metadata: {
        source: 'legal_mrl',
        case_id: caseId
      }
    }
    
    const auth = Buffer.from(publicId + ':' + apiSecret).toString('base64')
    
    const itpayRes = await fetch('https://api.gw.itpay.ru/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    
    const itpayData = await itpayRes.json().catch(() => ({}))
    
    if (!itpayRes.ok) {
      console.error('ITPay error:', itpayRes.status, itpayData)
      return res.status(500).json({ 
        error: 'ITPay API error', 
        status: itpayRes.status, 
        details: itpayData 
      })
    }
    
    const paymentData = itpayData.data || itpayData
    
    await db.insert(payments).values({
      id: uuidv4(),
      paymentId: paymentData.id || 'unknown',
      caseId: caseId,
      amount: parseInt(amount),
      status: paymentData.status || 'pending',
      paymentMethod: method,
      paymentData: { ...paymentData, payload }
    })
    
    res.json({
      success: true,
      paymentId: paymentData.id,
      status: paymentData.status,
      amount: amount,
      paymentUrl: paymentData.payment_qr_urls || null,
      paymentQrImages: paymentData.payment_qr_images || null,
      method: paymentData.method,
      description: paymentData.description,
      created: paymentData.created
    })
  } catch (err) {
    console.error('Case payment error:', err)
    res.status(500).json({ error: 'Failed to create payment', details: (err as Error).message })
  }
})

// Проверка статуса оплаты
app.get('/api/payments/:id/status', async (req, res) => {
  try {
    const paymentId = req.params.id
    const paymentRecords = await db.select().from(payments).where(eq(payments.paymentId, paymentId))
    
    if (!paymentRecords.length) {
      return res.status(404).json({ error: 'Payment not found' })
    }
    
    const payment = paymentRecords[0]
    let currentStatus = payment.status
    
    // Если статус ещё не завершён — проверим у ITPAY
    if (currentStatus !== 'completed' && currentStatus !== 'paid' && currentStatus !== 'success') {
      try {
        const publicId = process.env.ITPAY_PUBLIC_ID
        const apiSecret = process.env.ITPAY_API_SECRET
        if (publicId && apiSecret) {
          const auth = Buffer.from(publicId + ':' + apiSecret).toString('base64')
          const itpayRes = await fetch('https://api.gw.itpay.ru/v1/payments/' + paymentId, {
            headers: {
              'Authorization': 'Basic ' + auth,
              'Accept': 'application/json'
            }
          })
          if (itpayRes.ok) {
            const itpayData = await itpayRes.json().catch(() => ({}))
            const freshData = itpayData.data || itpayData
            console.log('[PAYMENT STATUS] ITPay response:', JSON.stringify(freshData).substring(0, 200))
            if (freshData.status && freshData.status !== currentStatus) {
              console.log('[PAYMENT STATUS] Status changed from', currentStatus, 'to', freshData.status)
              currentStatus = freshData.status
              await db.update(payments)
                .set({ status: currentStatus, paymentData: { ...payment.paymentData, ...freshData } })
                .where(eq(payments.id, payment.id))
            }
          }
        }
      } catch (e) {
        console.log('ITPAY status check error:', e.message)
      }
    }
    
    const paidStatuses = ['completed', 'paid', 'success', 'succeeded', 'confirmed', 'done']
    const isPaid = paidStatuses.includes(currentStatus)
    
    res.json({
      paymentId: payment.paymentId,
      status: currentStatus,
      amount: payment.amount,
      paid: isPaid,
      createdAt: payment.createdAt
    })
  } catch (err) {
    console.error('Payment status error:', err)
    res.status(500).json({ error: 'Failed to check payment status', details: (err as Error).message })
  }
})

// Оплата документа
app.post('/api/documents/:id/pay', async (req, res) => {
  try {
    const docId = req.params.id
    const docs = await db.select().from(documents).where(eq(documents.id, docId))
    
    if (!docs.length) {
      return res.status(404).json({ error: 'Document not found' })
    }
    
    const doc = docs[0]
    const { amount = 499, method = 'sbp' } = req.body
    
    const publicId = process.env.ITPAY_PUBLIC_ID
    const apiSecret = process.env.ITPAY_API_SECRET
    
    if (!publicId || !apiSecret) {
      return res.status(500).json({ error: 'ITPAY credentials not configured' })
    }
    
    const clientPaymentId = uuidv4()
    
    const payload = {
      amount: String(amount),
      client_payment_id: clientPaymentId,
      method: method,
      description: 'Оплата документа DokIQ',
      success_url: 'http://62.113.110.117:8081/payment/success',
      success_url_description: 'Вернуться на сайт',
      metadata: {
        source: 'legal_mrl',
        document_id: docId,
        case_id: doc.caseId
      }
    }
    
    const auth = Buffer.from(publicId + ':' + apiSecret).toString('base64')
    
    const itpayRes = await fetch('https://api.gw.itpay.ru/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    
    const itpayData = await itpayRes.json().catch(() => ({}))
    
    if (!itpayRes.ok) {
      console.error('ITPay error:', itpayRes.status, itpayData)
      return res.status(500).json({ 
        error: 'ITPay API error', 
        status: itpayRes.status, 
        details: itpayData 
      })
    }
    
    const paymentData = itpayData.data || itpayData
    
    await db.insert(payments).values({
      id: uuidv4(),
      paymentId: paymentData.id || 'unknown',
      caseId: doc.caseId,
      documentId: docId,
      amount: parseInt(amount),
      status: paymentData.status || 'pending',
      paymentMethod: method,
      paymentData: { ...paymentData, payload }
    })
    
    res.json({
      success: true,
      paymentId: paymentData.id,
      status: paymentData.status,
      amount: amount,
      paymentUrl: paymentData.payment_qr_urls || null,
      paymentQrImages: paymentData.payment_qr_images || null,
      method: paymentData.method,
      description: paymentData.description,
      created: paymentData.created
    })
  } catch (err) {
    console.error('Document payment error:', err)
    res.status(500).json({ error: 'Failed to create payment', details: (err as Error).message })
  }
})

// Скачивание сгенерированного документа (после оплаты)
app.get('/api/generated/:id', async (req, res) => {
  try {
    const docId = req.params.id
    const docs = await db.select().from(cases).where(eq(cases.id, docId))
    
    if (!docs.length) {
      return res.status(404).json({ error: 'Document not found' })
    }
    
    const doc = docs[0]
    
    // Проверяем оплату через таблицу payments
    const paymentCheck = await db.select()
      .from(payments)
      .where(eq(payments.caseId, docId))
      .orderBy(payments.createdAt)
      .limit(1)
    
    const isPaid = paymentCheck.length > 0 && 
      (paymentCheck[0].status === "success" || paymentCheck[0].status === "completed" || paymentCheck[0].status === "paid")
    
    if (!isPaid) {
      return res.status(403).json({ 
        error: "Payment required",
        message: "Документ доступен только после оплаты. Цена: 499 ₽",
        paymentRequired: true,
        amount: 499,
        preview: doc.description?.substring(0, 500) + "...",
        status: "payment_required"
      })
    }
    
    const title = doc.title || 'Документ'
    const content = doc.description || ''
    
    // Генерируем настоящий .docx файл
    const docxBuffer = await generateLegalDocument({
      title,
      content,
      clientData: {
        fio: doc.title || '________',
      }
    })
    
    const filename = title.replace(/[^a-zA-Z0-9\u0400-\u04FF]/g, '_') + '.docx'
    const encodedFilename = encodeURIComponent(filename)
    
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.send(docxBuffer)
  } catch (err) {
    console.error('Download error:', err)
    res.status(500).json({ error: 'Failed to download' })
  }
})
// Auth middleware
function authMiddleware(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as any
    req.userId = decoded.userId
    req.userEmail = decoded.email
    req.isAdmin = decoded.isAdmin || false
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

// Регистрация
async function handleRegister(req: any, res: any) {
  try {
    const { email, password, fullName } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }
    
    const existing = await db.select().from(users).where(eq(users.email, email))
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' })
    }
    
    const userId = uuidv4()
    const passwordHash = bcrypt.hashSync(password, 10)
    
    await db.insert(users).values({
      id: userId,
      email,
      passwordHash,
      fullName: fullName || null,
      isAdmin: 0
    })
    
    const token = jwt.sign({ userId, email, isAdmin: false }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, userId, email, fullName, isAdmin: false })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ error: 'Registration failed' })
  }
}
app.post('/api/register', authLimiter, handleRegister)
app.post('/api/auth/register', authLimiter, handleRegister)

// Логин
async function handleLogin(req: any, res: any) {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }
    
    const userList = await db.select().from(users).where(eq(users.email, email))
    if (userList.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    
    const user = userList[0]
    const valid = bcrypt.compareSync(password, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    
    const token = jwt.sign({ userId: user.id, email: user.email, isAdmin: user.isAdmin === 1 }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, userId: user.id, email: user.email, fullName: user.fullName, isAdmin: user.isAdmin === 1 })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
}
app.post('/api/login', authLimiter, handleLogin)
app.post('/api/auth/login', authLimiter, handleLogin)

// Получение текущего пользователя
async function handleMe(req: any, res: any) {
  try {
    const userList = await db.select().from(users).where(eq(users.id, req.userId))
    if (userList.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }
    const user = userList[0]
    res.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isAdmin: user.isAdmin === 1
    })
  } catch (err) {
    console.error('Me error:', err)
    res.status(500).json({ error: 'Failed to get user' })
  }
}
app.get('/api/me', authMiddleware, handleMe)
app.get('/api/auth/me', authMiddleware, handleMe)


// AI Logs — admin endpoints
app.get("/api/admin/ai-logs", async (req, res) => {
  try {
    const { caseId, requestType, limit = "50" } = req.query as any
    let query = db.select().from(aiLogs).orderBy(desc(aiLogs.createdAt))
    if (caseId) {
      query = db.select().from(aiLogs).where(eq(aiLogs.caseId, caseId)).orderBy(desc(aiLogs.createdAt))
    }
    if (requestType) {
      query = db.select().from(aiLogs).where(eq(aiLogs.requestType, requestType)).orderBy(desc(aiLogs.createdAt))
    }
    const logs = await query.limit(parseInt(limit) || 50)
    res.json({ logs, count: logs.length })
  } catch (err: any) {
    console.error("AI logs error:", err)
    res.status(500).json({ error: "Failed to fetch AI logs", details: err.message })
  }
})

app.get("/api/admin/ai-logs/:caseId", async (req, res) => {
  try {
    const caseId = req.params.caseId
    const logs = await db.select().from(aiLogs).where(eq(aiLogs.caseId, caseId)).orderBy(desc(aiLogs.createdAt))
    res.json({ logs, count: logs.length })
  } catch (err: any) {
    console.error("AI logs by case error:", err)
    res.status(500).json({ error: "Failed to fetch AI logs", details: err.message })
  }
})

const PORT = process.env.PORT || 3002

// ===== ADMIN: BATCH SUMMARIZE =====
app.post('/api/admin/summarize-all', async (req, res) => {
  try {
    const docsToSummarize = await db.select()
      .from(documents)
      .where(and(
        isNull(documents.summary),
        isNotNull(documents.extractedText)
      ))
    
    console.log('[ADMIN] Found documents to summarize:', docsToSummarize.length)
    
    let processed = 0
    const maxBatch = 10
    
    for (let i = 0; i < Math.min(docsToSummarize.length, maxBatch); i++) {
      const doc = docsToSummarize[i]
      try {
        const summary = await summarizeDocument(doc.extractedText!)
        if (summary) {
          await db.update(documents)
            .set({ summary })
            .where(eq(documents.id, doc.id))
          processed++
          console.log('[ADMIN] Summarized:', doc.name, 'id:', doc.id)
        }
      } catch (e: any) {
        console.log('[ADMIN] Failed to summarize:', doc.name, e.message)
      }
      
      // Delay between calls
      if (i < Math.min(docsToSummarize.length, maxBatch) - 1) {
        await new Promise(r => setTimeout(r, 200))
      }
    }
    
    res.json({ 
      success: true, 
      processed, 
      remaining: Math.max(0, docsToSummarize.length - processed) 
    })
  } catch (err) {
    console.error('[ADMIN] Summarize-all error:', err)
    res.status(500).json({ error: 'Failed to summarize documents' })
  }
})

app.listen(PORT, () => {
  console.log(`DokIQ API running on port ${PORT}`)
})
