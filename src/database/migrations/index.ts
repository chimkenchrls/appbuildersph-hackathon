import type { SQLiteDatabase } from 'expo-sqlite';
import * as initialMigration from './001_initial';
import * as addTaxTreatmentMigration from './002_add_tax_treatment';

export interface Migration {
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
}

export const migrations: Migration[] = [
  initialMigration,
  addTaxTreatmentMigration,
];

