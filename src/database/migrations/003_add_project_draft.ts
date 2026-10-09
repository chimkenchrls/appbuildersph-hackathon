import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 3;

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE projects ADD COLUMN draft_scope_json TEXT;
  `);
}
