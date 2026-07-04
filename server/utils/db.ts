import { drizzle } from 'drizzle-orm/postgres-js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'
import { useDbPool } from '../plugins/db'

let db: PostgresJsDatabase<typeof schema> | undefined

export function useDb() {
  if (!db) {
    db = drizzle(useDbPool(), { schema })
  }
  return db
}

export { schema }
