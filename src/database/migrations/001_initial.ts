import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 1;

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL CHECK (length(trim(title)) > 0),
      client_name TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agreements (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
      version_number INTEGER NOT NULL CHECK (version_number >= 1),
      title TEXT NOT NULL,
      budget_amount REAL,
      budget_currency TEXT NOT NULL DEFAULT 'PHP',
      budget_notes TEXT,
      duration_days INTEGER,
      deadline TEXT,
      timeline_notes TEXT,
      revision_terms TEXT,
      exclusions_json TEXT NOT NULL DEFAULT '[]',
      missing_info_json TEXT NOT NULL DEFAULT '[]',
      confirmed_at TEXT NOT NULL,
      UNIQUE (project_id, version_number)
    );

    CREATE TABLE IF NOT EXISTS requirements (
      id TEXT NOT NULL,
      agreement_id TEXT NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('deliverable', 'term', 'exclusion')),
      PRIMARY KEY (agreement_id, id)
    );

    CREATE TABLE IF NOT EXISTS client_requests (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
      agreement_id TEXT NOT NULL REFERENCES agreements(id) ON DELETE RESTRICT,
      raw_text TEXT NOT NULL CHECK (length(trim(raw_text)) > 0),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scopeguard_analyses (
      id TEXT PRIMARY KEY NOT NULL,
      request_id TEXT NOT NULL UNIQUE REFERENCES client_requests(id) ON DELETE CASCADE,
      agreement_id TEXT NOT NULL REFERENCES agreements(id) ON DELETE RESTRICT,
      classification TEXT NOT NULL CHECK (
        classification IN ('included', 'potential_additional', 'needs_clarification')
      ),
      summary TEXT NOT NULL,
      findings_json TEXT NOT NULL,
      clarification_questions_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS change_proposals (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
      analysis_id TEXT NOT NULL REFERENCES scopeguard_analyses(id) ON DELETE RESTRICT,
      selected_items_json TEXT NOT NULL,
      freelancer_fee_estimate REAL,
      freelancer_days_estimate INTEGER,
      currency TEXT NOT NULL DEFAULT 'PHP',
      draft_message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'copied', 'sent')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_agreements_project ON agreements(project_id);
    CREATE INDEX IF NOT EXISTS idx_requirements_agreement ON requirements(agreement_id);
    CREATE INDEX IF NOT EXISTS idx_client_requests_project ON client_requests(project_id);
    CREATE INDEX IF NOT EXISTS idx_scopeguard_agreement ON scopeguard_analyses(agreement_id);
    CREATE INDEX IF NOT EXISTS idx_change_proposals_project ON change_proposals(project_id);
  `);
}
