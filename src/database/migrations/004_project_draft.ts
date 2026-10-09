import type { SQLiteDatabase } from 'expo-sqlite';
import * as integrityGuards from './003_integrity_guards';

export const version = 4;

// Both branches shipped a different migration 3. Converge without changing records.
export async function up(db: SQLiteDatabase): Promise<void> {
  const projects = await db.getAllAsync<{ name: string }>('PRAGMA table_info(projects);');
  if (!projects.some(column => column.name === 'draft_scope_json')) {
    await db.execAsync('ALTER TABLE projects ADD COLUMN draft_scope_json TEXT;');
  }
  const agreements = await db.getAllAsync<{ name: string }>('PRAGMA table_info(agreements);');
  if (!agreements.some(column => column.name === 'sealed')) await integrityGuards.up(db);
}
