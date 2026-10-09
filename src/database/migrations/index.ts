import type { SQLiteDatabase } from 'expo-sqlite';
import * as initialMigration from './001_initial';

export interface Migration {
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
}

export const migrations: Migration[] = [
  initialMigration,
];
