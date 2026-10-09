import type { SQLiteDatabase } from 'expo-sqlite';
import { ServiceError } from '@/services/errors';

const queues = new WeakMap<SQLiteDatabase, Promise<unknown>>();

/** Serialize operations and bind every query to Expo's isolated transaction handle. */
export function transaction<T>(db: SQLiteDatabase, action: (tx: SQLiteDatabase) => Promise<T>): Promise<T> {
  const run = (queues.get(db) ?? Promise.resolve()).then(async () => {
    let result!: T;
    await db.withExclusiveTransactionAsync(async tx => {
      result = await action(tx);
      // Expo opens a separate connection for exclusive transactions. foreign_keys is
      // connection-local and cannot be enabled after BEGIN; verify all references before commit.
      if ((await tx.getAllAsync('PRAGMA foreign_key_check;')).length) throw new ServiceError('data_integrity');
    });
    return result;
  });
  queues.set(db, run.catch(() => undefined));
  return run;
}
