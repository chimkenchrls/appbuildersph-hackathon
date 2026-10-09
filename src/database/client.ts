import * as SQLite from 'expo-sqlite';

let databaseInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabaseAsync(): Promise<SQLite.SQLiteDatabase> {
  if (databaseInstance) {
    return databaseInstance;
  }

  const db = await SQLite.openDatabaseAsync('saklaw.db');
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  databaseInstance = db;
  return databaseInstance;
}

export async function closeDatabaseAsync(): Promise<void> {
  if (databaseInstance) {
    await databaseInstance.closeAsync();
    databaseInstance = null;
  }
}
