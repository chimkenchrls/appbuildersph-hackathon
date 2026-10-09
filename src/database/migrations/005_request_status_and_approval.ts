import type { SQLiteDatabase } from 'expo-sqlite';
import * as integrityGuards from './003_integrity_guards';

export const version = 5;

async function columns(db: SQLiteDatabase, table: string): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
  return new Set(rows.map(row => row.name));
}

/**
 * Adds request status and client approval, and relaxes the integrity guards just enough for them.
 *
 * Still immutable: an agreement's terms, its requirements, a request's text and links, and saved
 * analyses. Now allowed: recording client approval on an agreement, changing a request's status,
 * and deleting records (a request, a whole project, or the demo data).
 *
 * Staging shipped these columns as its own migration 4, so every step checks what already exists.
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  const requests = await columns(db, 'client_requests');
  if (!requests.has('status')) await db.execAsync("ALTER TABLE client_requests ADD COLUMN status TEXT DEFAULT 'stored';");
  if (!requests.has('accepted_at')) await db.execAsync('ALTER TABLE client_requests ADD COLUMN accepted_at TEXT;');

  let agreements = await columns(db, 'agreements');
  for (const column of ['client_approved_at', 'client_signatory_name', 'client_signature_data']) {
    if (!agreements.has(column)) await db.execAsync(`ALTER TABLE agreements ADD COLUMN ${column} TEXT;`);
  }
  const projects = await columns(db, 'projects');
  if (!projects.has('draft_scope_json')) await db.execAsync('ALTER TABLE projects ADD COLUMN draft_scope_json TEXT;');
  agreements = await columns(db, 'agreements');
  if (!agreements.has('sealed')) await integrityGuards.up(db);

  await db.execAsync(`
    DROP TRIGGER IF EXISTS agreements_no_update;
    DROP TRIGGER IF EXISTS agreements_no_delete;
    DROP TRIGGER IF EXISTS requirements_no_delete;
    DROP TRIGGER IF EXISTS requests_no_update;
    DROP TRIGGER IF EXISTS requests_no_delete;
    DROP TRIGGER IF EXISTS analyses_no_delete;

    CREATE TRIGGER agreements_no_update BEFORE UPDATE ON agreements
      WHEN OLD.sealed = 1 AND (
        NEW.id IS NOT OLD.id OR NEW.project_id IS NOT OLD.project_id OR NEW.version_number IS NOT OLD.version_number
        OR NEW.title IS NOT OLD.title OR NEW.budget_amount IS NOT OLD.budget_amount
        OR NEW.budget_currency IS NOT OLD.budget_currency OR NEW.budget_notes IS NOT OLD.budget_notes
        OR NEW.duration_days IS NOT OLD.duration_days OR NEW.deadline IS NOT OLD.deadline
        OR NEW.timeline_notes IS NOT OLD.timeline_notes OR NEW.revision_terms IS NOT OLD.revision_terms
        OR NEW.exclusions_json IS NOT OLD.exclusions_json OR NEW.missing_info_json IS NOT OLD.missing_info_json
        OR NEW.tax_treatment IS NOT OLD.tax_treatment OR NEW.confirmed_at IS NOT OLD.confirmed_at
        OR NEW.sealed IS NOT OLD.sealed)
      BEGIN SELECT RAISE(ABORT, 'Confirmed agreements are immutable'); END;

    CREATE TRIGGER requests_no_update BEFORE UPDATE ON client_requests
      WHEN NEW.id IS NOT OLD.id OR NEW.project_id IS NOT OLD.project_id OR NEW.agreement_id IS NOT OLD.agreement_id
        OR NEW.raw_text IS NOT OLD.raw_text OR NEW.created_at IS NOT OLD.created_at
      BEGIN SELECT RAISE(ABORT, 'Saved requests are immutable'); END;
  `);
}
