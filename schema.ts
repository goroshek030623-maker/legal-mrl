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
  userId: varchar('user_id', { length: 36 })
})

export const documents = mysqlTable('documents', {
  id: varchar('id', { length: 36 }).primaryKey(),
  caseId: varchar('case_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  size: int('size').notNull(),
  path: varchar('path', { length: 500 }).notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull()
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
