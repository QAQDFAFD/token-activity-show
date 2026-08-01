import Database from 'better-sqlite3'
import { migrateDatabase } from './migrations'

export function openDatabase(path: string): Database.Database {
  const database = new Database(path)

  try {
    database.pragma('journal_mode = WAL')
    database.pragma('foreign_keys = ON')
    database.pragma('busy_timeout = 5000')
    migrateDatabase(database)
    return database
  } catch (error) {
    database.close()
    throw error
  }
}
