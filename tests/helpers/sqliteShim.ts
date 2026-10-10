import type { SQLiteDatabase } from 'expo-sqlite';

// Real migrations and repositories on Node's built-in SQLite, through a small stand-in for the
// expo-sqlite calls they use. Tests that need it should be skipped where Node has no SQLite.
type NodeSqlite = { DatabaseSync: new (path: string) => {
  close(): void;
  exec(sql: string): void;
  prepare(sql: string): {
    run(...p: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...p: unknown[]): unknown;
    all(...p: unknown[]): unknown[];
  };
} };

export const nodeSqlite: NodeSqlite | undefined = (() => {
  try {
    return (process as unknown as { getBuiltinModule?: (id: string) => NodeSqlite | undefined }).getBuiltinModule?.('node:sqlite');
  } catch {
    return undefined;
  }
})();

export function openDatabase(path = ':memory:', foreignKeys = true): SQLiteDatabase {
  const db = new nodeSqlite!.DatabaseSync(path);
  db.exec(foreignKeys ? 'PRAGMA foreign_keys = ON;' : 'PRAGMA foreign_keys = OFF;');
  const shim = {
    async closeAsync() { db.close(); },
    async execAsync(sql: string) { db.exec(sql); },
    async runAsync(sql: string, params: unknown[] = []) {
      const r = db.prepare(sql).run(...params);
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async getFirstAsync(sql: string, params: unknown[] = []) { return db.prepare(sql).get(...params) ?? null; },
    async getAllAsync(sql: string, params: unknown[] = []) { return db.prepare(sql).all(...params); },
    async withExclusiveTransactionAsync(task: (tx: SQLiteDatabase) => Promise<void>) {
      if (path === ':memory:') await shim.withTransactionAsync(() => task(shim as unknown as SQLiteDatabase));
      else {
        const tx = openDatabase(path, false);
        try { await tx.withTransactionAsync(() => task(tx)); } finally { await tx.closeAsync(); }
      }
    },
    async withTransactionAsync(task: () => Promise<void>) {
      db.exec('BEGIN');
      try { await task(); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
  return shim as unknown as SQLiteDatabase;
}
