import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 3;

/** Add guards without rewriting, rounding, or deleting existing records. */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE agreements ADD COLUMN sealed INTEGER NOT NULL DEFAULT 1 CHECK (sealed IN (0, 1));
    CREATE TRIGGER agreements_no_update BEFORE UPDATE ON agreements WHEN OLD.sealed = 1
      BEGIN SELECT RAISE(ABORT, 'Confirmed agreements are immutable'); END;
    CREATE TRIGGER agreements_no_delete BEFORE DELETE ON agreements
      BEGIN SELECT RAISE(ABORT, 'Confirmed agreements are immutable'); END;
    CREATE TRIGGER requirements_no_insert BEFORE INSERT ON requirements
      WHEN NOT EXISTS (SELECT 1 FROM agreements WHERE id = NEW.agreement_id AND sealed = 0)
      BEGIN SELECT RAISE(ABORT, 'Confirmed requirements are immutable'); END;
    CREATE TRIGGER requirements_no_update BEFORE UPDATE ON requirements
      BEGIN SELECT RAISE(ABORT, 'Confirmed requirements are immutable'); END;
    CREATE TRIGGER requirements_no_delete BEFORE DELETE ON requirements
      BEGIN SELECT RAISE(ABORT, 'Confirmed requirements are immutable'); END;
    CREATE TRIGGER request_link_insert BEFORE INSERT ON client_requests
      WHEN NOT EXISTS (SELECT 1 FROM agreements WHERE id = NEW.agreement_id AND project_id = NEW.project_id AND sealed = 1)
      BEGIN SELECT RAISE(ABORT, 'Request agreement/project mismatch'); END;
    CREATE TRIGGER requests_no_update BEFORE UPDATE ON client_requests
      BEGIN SELECT RAISE(ABORT, 'Saved requests are immutable'); END;
    CREATE TRIGGER requests_no_delete BEFORE DELETE ON client_requests
      BEGIN SELECT RAISE(ABORT, 'Saved requests are immutable'); END;
    CREATE TRIGGER analysis_link_insert BEFORE INSERT ON scopeguard_analyses
      WHEN NOT EXISTS (SELECT 1 FROM client_requests WHERE id = NEW.request_id AND agreement_id = NEW.agreement_id)
      BEGIN SELECT RAISE(ABORT, 'Analysis request/agreement mismatch'); END;
    CREATE TRIGGER analyses_no_update BEFORE UPDATE ON scopeguard_analyses
      BEGIN SELECT RAISE(ABORT, 'Saved analyses are immutable'); END;
    CREATE TRIGGER analyses_no_delete BEFORE DELETE ON scopeguard_analyses
      BEGIN SELECT RAISE(ABORT, 'Saved analyses are immutable'); END;
  `);
  for (const operation of ['INSERT', 'UPDATE']) {
    await db.execAsync(`
      CREATE TRIGGER proposal_link_${operation.toLowerCase()} BEFORE ${operation} ON change_proposals
        WHEN NOT EXISTS (SELECT 1 FROM scopeguard_analyses a JOIN client_requests r ON r.id = a.request_id
          WHERE a.id = NEW.analysis_id AND r.project_id = NEW.project_id AND r.agreement_id = a.agreement_id)
        BEGIN SELECT RAISE(ABORT, 'Proposal analysis/project mismatch'); END;
      CREATE TRIGGER proposal_days_${operation.toLowerCase()} BEFORE ${operation} ON change_proposals
        WHEN NEW.freelancer_days_estimate IS NOT NULL AND
          (typeof(NEW.freelancer_days_estimate) <> 'integer' OR NEW.freelancer_days_estimate < 0 OR NEW.freelancer_days_estimate > 1000000000000)
        BEGIN SELECT RAISE(ABORT, 'Working days must be a nonnegative integer'); END;
    `);
  }
}
