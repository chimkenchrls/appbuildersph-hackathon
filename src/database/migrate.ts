import type { SQLiteDatabase } from 'expo-sqlite';
import { transaction } from './transaction';
import { migrations } from './migrations';

export async function migrateAsync(db: SQLiteDatabase): Promise<void> {
  await transaction(db, async tx => {
    await tx.execAsync(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
    const appliedRows = await tx.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version ASC;',
    );
    const appliedVersions = new Set(appliedRows.map(row => row.version));
    for (const migration of migrations) {
      if (!appliedVersions.has(migration.version)) {
        await migration.up(tx);
        await tx.runAsync('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);',
          [migration.version, new Date().toISOString()]);
      }
    }
  });
}
