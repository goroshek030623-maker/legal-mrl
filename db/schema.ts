import { mysqlTable, varchar, text, timestamp, json, int } from 'drizzle-orm/mysql-core'

export const cases = mysqlTable('cases', {
  id: varchar('id', { length: 36 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  caseType: varchar('case_type', { length: 20 }).default('legal'),
  serviceType: varchar('service_type', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  analysis: text('analysis'),
  recommendedActions: text('recommended_actions'),
  generatedDocument: text('generated_document', { mode: 'long' }),
  userId: varchar('user_id', { length: 36 }),
  clientData: json('client_data')
})

export const documents = mysqlTable('documents', {
  id: varchar('id', { length: 36 }).primaryKey(),
  caseId: varchar('case_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  size: int('size').notNull(),
  path: varchar('path', { length: 500 }).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  minioPath: varchar("minio_path", { length: 500 }),
  extractedText: text("extracted_text"),
  summary: text("summary")
})

export const payments = mysqlTable('payments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  paymentId: varchar('payment_id', { length: 255 }).notNull(),
  caseId: varchar('case_id', { length: 36 }),
  documentId: varchar('document_id', { length: 36 }),
  amount: int('amount').notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }),
  paymentData: json('payment_data'),
  createdAt: timestamp('created_at').defaultNow().notNull()
})

export const visits = mysqlTable('visits', {
  id: varchar('id', { length: 36 }).primaryKey(),
  ip: varchar('ip', { length: 45 }),
  userAgent: text('user_agent'),
  path: varchar('path', { length: 255 }).notNull(),
  referrer: varchar('referrer', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull()
})

export const adminStats = mysqlTable('admin_stats', {
  id: varchar('id', { length: 36 }).primaryKey(),
  totalVisits: int('total_visits').default(0),
  uniqueVisitors: int('unique_visitors').default(0),
  totalPayments: int('total_payments').default(0),
  totalRevenue: int('total_revenue').default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

export const users = mysqlTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }),
  isAdmin: int('is_admin').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull()
})

export const aiLogs = mysqlTable("ai_logs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  caseId: varchar("case_id", { length: 36 }),
  requestType: varchar("request_type", { length: 50 }).notNull(),
  model: varchar("model", { length: 50 }),
  prompt: text("prompt"),
  response: text("response", { mode: "long" }),
  tokensUsed: int("tokens_used"),
  durationMs: int("duration_ms"),
  success: int("success").notNull().default(1),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

