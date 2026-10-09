import { AgreementSchema, stored, storedJson } from '@/safety/persistedSchemas';
import { ServiceError } from '@/services/errors';
import { transaction } from '@/database/transaction';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Agreement, Requirement, TaxTreatment } from '@/types/domain';

interface AgreementRow {
  id: string;
  project_id: string;
  version_number: number;
  title: string;
  budget_amount: number | null;
  budget_currency: string;
  budget_notes: string | null;
  duration_days: number | null;
  deadline: string | null;
  timeline_notes: string | null;
  revision_terms: string | null;
  exclusions_json: string;
  missing_info_json: string;
  tax_treatment?: string | null;
  confirmed_at: string;
  sealed: number;
  client_approved_at?: string | null;
  client_signatory_name?: string | null;
  client_signature_data?: string | null;
}

interface RequirementRow {
  id: string;
  agreement_id: string;
  title: string;
  description: string;
  category: 'deliverable' | 'term' | 'exclusion';
}

export class AgreementRepository {
  constructor(private readonly db: SQLiteDatabase, private readonly inTransaction = false) {}

  async createInitial(agreement: Agreement): Promise<Agreement> {
    if (!this.inTransaction) return transaction(this.db, tx => new AgreementRepository(tx, true).createInitial(agreement));
    if (agreement.versionNumber !== 1 || await this.getLatestByProjectId(agreement.projectId)) throw new ServiceError('save_failed');
    return this.create(agreement);
  }

  async create(agreement: Agreement): Promise<Agreement> {
    agreement = AgreementSchema.parse(agreement);
    if (!this.inTransaction) return transaction(this.db, tx => new AgreementRepository(tx, true).create(agreement));
    await this.db.runAsync(
      `INSERT INTO agreements (
        id, project_id, version_number, title,
        budget_amount, budget_currency, budget_notes,
        duration_days, deadline, timeline_notes,
        revision_terms, exclusions_json, missing_info_json,
        tax_treatment, confirmed_at, client_approved_at,
        client_signatory_name, client_signature_data, sealed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);`,
      [
        agreement.id,
        agreement.projectId,
        agreement.versionNumber,
        agreement.title,
        agreement.budgetAmount,
        agreement.budgetCurrency,
        agreement.budgetNotes,
        agreement.durationDays,
        agreement.deadline,
        agreement.timelineNotes,
        agreement.revisionTerms,
        JSON.stringify(agreement.exclusions),
        JSON.stringify(agreement.missingInformation),
        agreement.taxTreatment || 'net_of_withholding',
        agreement.confirmedAt,
        agreement.clientApprovedAt || null,
        agreement.clientSignatoryName || null,
        agreement.clientSignatureData || null,
      ],
    );

    for (const req of agreement.requirements) {
      await this.db.runAsync(
        `INSERT INTO requirements (id, agreement_id, title, description, category)
         VALUES (?, ?, ?, ?, ?);`,
        [req.id, agreement.id, req.title, req.description, req.category],
      );
    }
    await this.db.runAsync('UPDATE agreements SET sealed = 1 WHERE id = ?;', [agreement.id]);

    return agreement;
  }

  async getById(id: string): Promise<Agreement | null> {
    const row = await this.db.getFirstAsync<AgreementRow>(
      'SELECT * FROM agreements WHERE id = ?;',
      [id],
    );
    if (!row) return null;
    return this.mapAgreement(row);
  }

  async getLatestByProjectId(projectId: string): Promise<Agreement | null> {
    const row = await this.db.getFirstAsync<AgreementRow>(
      'SELECT * FROM agreements WHERE project_id = ? ORDER BY version_number DESC LIMIT 1;',
      [projectId],
    );
    if (!row) return null;
    return this.mapAgreement(row);
  }

  async getByVersion(projectId: string, versionNumber: number): Promise<Agreement | null> {
    const row = await this.db.getFirstAsync<AgreementRow>(
      'SELECT * FROM agreements WHERE project_id = ? AND version_number = ?;',
      [projectId, versionNumber],
    );
    if (!row) return null;
    return this.mapAgreement(row);
  }

  async listByProjectId(projectId: string): Promise<Agreement[]> {
    const rows = await this.db.getAllAsync<AgreementRow>(
      'SELECT * FROM agreements WHERE project_id = ? ORDER BY version_number DESC;',
      [projectId],
    );

    const agreements: Agreement[] = [];
    for (const row of rows) {
      const agmt = await this.mapAgreement(row);
      agreements.push(agmt);
    }
    return agreements;
  }

  private async mapAgreement(row: AgreementRow): Promise<Agreement> {
    if (row.sealed !== 1) throw new ServiceError('data_integrity');
    const reqRows = await this.db.getAllAsync<RequirementRow>(
      'SELECT id, title, description, category FROM requirements WHERE agreement_id = ? ORDER BY id ASC;',
      [row.id],
    );

    const requirements: Requirement[] = reqRows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
    }));

    return stored(AgreementSchema, {
      id: row.id,
      projectId: row.project_id,
      versionNumber: row.version_number,
      title: row.title,
      requirements,
      budgetAmount: row.budget_amount,
      budgetCurrency: row.budget_currency,
      budgetNotes: row.budget_notes,
      durationDays: row.duration_days,
      deadline: row.deadline,
      timelineNotes: row.timeline_notes,
      revisionTerms: row.revision_terms,
      exclusions: storedJson(row.exclusions_json),
      missingInformation: storedJson(row.missing_info_json),
      taxTreatment: (row.tax_treatment as TaxTreatment) || 'net_of_withholding',
      confirmedAt: row.confirmed_at,
      clientApprovedAt: row.client_approved_at || null,
      clientSignatoryName: row.client_signatory_name || null,
      clientSignatureData: row.client_signature_data || null,
    });
  }

  /** Client approval is recorded on a confirmed agreement; its terms stay immutable. */
  async recordClientApproval(
    agreementId: string,
    signatoryName: string,
    signatureData?: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      `UPDATE agreements
       SET client_approved_at = ?, client_signatory_name = ?, client_signature_data = ?
       WHERE id = ?;`,
      [now, signatoryName, signatureData || null, agreementId],
    );
  }
}
