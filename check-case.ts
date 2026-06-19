import { db } from './db/index'
import { cases } from './schema'
import { eq } from 'drizzle-orm'

async function main() {
  const c = await db.select().from(cases).where(eq(cases.id, '6a022723-629a-4e43-b1be-cd4dbec4eeab'))
  console.log(JSON.stringify(c, null, 2))
}

main().catch(console.error)
