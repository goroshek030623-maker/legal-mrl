import type { Config } from 'drizzle-kit'

export default {
  schema: './db/schema.ts',
  out: './db/migrations',
  driver: 'mysql2',
  dbCredentials: {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'legal_mrl'
  }
} satisfies Config
