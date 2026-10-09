import * as SQLite from 'expo-sqlite';

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabaseAsync(): Promise<SQLite.SQLiteDatabase> {
  if (!opening) opening = open().catch(error => { opening = null; throw error; });
  return opening;
}

async function open() {
  const db = await SQLite.openDatabaseAsync('saklaw.db');
  try {
    await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    return db;
  } catch (error) {
    await db.closeAsync();
    throw error;
  }
}

export async function closeDatabaseAsync(): Promise<void> {
  if (opening) {
    const db = await opening;
    await db.closeAsync();
    opening = null;
  }
}
