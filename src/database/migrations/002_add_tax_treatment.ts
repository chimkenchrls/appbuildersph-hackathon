import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 2;

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE agreements ADD COLUMN tax_treatment TEXT DEFAULT 'net_of_withholding';
  `);
}
