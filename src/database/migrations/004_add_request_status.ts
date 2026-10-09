import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 4;

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE client_requests ADD COLUMN status TEXT DEFAULT 'stored';
    ALTER TABLE client_requests ADD COLUMN accepted_at TEXT;
    ALTER TABLE agreements ADD COLUMN client_approved_at TEXT;
    ALTER TABLE agreements ADD COLUMN client_signatory_name TEXT;
    ALTER TABLE agreements ADD COLUMN client_signature_data TEXT;
  `);
}
