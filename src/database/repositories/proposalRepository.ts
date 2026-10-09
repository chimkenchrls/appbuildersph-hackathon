import { wholeWorkingDays } from '@/safety/validation';
import { ServiceError } from '@/services/errors';
import { ProposalSchema, stored, storedJson } from '@/safety/persistedSchemas';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ChangeProposal, ProposalStatus } from '@/types/domain';

interface ProposalRow {
  id: string;
  project_id: string;
  analysis_id: string;
  selected_items_json: string;
  freelancer_fee_estimate: number | null;
  freelancer_days_estimate: number | null;
  currency: string;
  draft_message: string;
  status: ProposalStatus;
  created_at: string;
  updated_at: string;
}

export class ProposalRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async create(p: ChangeProposal): Promise<ChangeProposal> {
    p = ProposalSchema.parse(p);
    if (!wholeWorkingDays(p.freelancerDaysEstimate)) throw new ServiceError('invalid_input');
    await this.db.runAsync(
      `INSERT INTO change_proposals (
        id, project_id, analysis_id, selected_items_json,
        freelancer_fee_estimate, freelancer_days_estimate,
        currency, draft_message, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        p.id,
        p.projectId,
        p.analysisId,
        JSON.stringify(p.selectedItems),
        p.freelancerFeeEstimate,
        p.freelancerDaysEstimate,
        p.currency,
        p.draftMessage,
        p.status,
        p.createdAt,
        p.updatedAt,
      ],
    );
    return p;
  }

  async getById(id: string): Promise<ChangeProposal | null> {
    const row = await this.db.getFirstAsync<ProposalRow>(
      'SELECT * FROM change_proposals WHERE id = ?;',
      [id],
    );
    if (!row) return null;
    return this.mapProposal(row);
  }

  async listByProjectId(projectId: string): Promise<ChangeProposal[]> {
    const rows = await this.db.getAllAsync<ProposalRow>(
      'SELECT * FROM change_proposals WHERE project_id = ? ORDER BY updated_at DESC;',
      [projectId],
    );
    return rows.map(this.mapProposal);
  }

  async update(
    id: string,
    updates: {
      draftMessage?: string;
      status?: ProposalStatus;
      freelancerFeeEstimate?: number | null;
      freelancerDaysEstimate?: number | null;
      selectedItems?: string[];
    },
  ): Promise<ChangeProposal | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const draftMessage = updates.draftMessage !== undefined ? updates.draftMessage : existing.draftMessage;
    const status = updates.status !== undefined ? updates.status : existing.status;
    const fee = updates.freelancerFeeEstimate !== undefined ? updates.freelancerFeeEstimate : existing.freelancerFeeEstimate;
    const days = updates.freelancerDaysEstimate !== undefined ? updates.freelancerDaysEstimate : existing.freelancerDaysEstimate;
    if (!wholeWorkingDays(days)) throw new ServiceError('invalid_input');
    const selectedItems = updates.selectedItems !== undefined ? updates.selectedItems : existing.selectedItems;

    const next = ProposalSchema.parse({ ...existing, draftMessage, status, freelancerFeeEstimate: fee,
      freelancerDaysEstimate: days, selectedItems, updatedAt: now });
    await this.db.runAsync(
      `UPDATE change_proposals
       SET draft_message = ?, status = ?, freelancer_fee_estimate = ?, freelancer_days_estimate = ?,
           selected_items_json = ?, updated_at = ?
       WHERE id = ?;`,
      [draftMessage, status, fee, days, JSON.stringify(selectedItems), now, id],
    );

    return next;
  }

  private mapProposal(row: ProposalRow): ChangeProposal {
    return stored(ProposalSchema, {
      id: row.id,
      projectId: row.project_id,
      analysisId: row.analysis_id,
      selectedItems: storedJson(row.selected_items_json),
      freelancerFeeEstimate: row.freelancer_fee_estimate,
      freelancerDaysEstimate: row.freelancer_days_estimate,
      currency: row.currency,
      draftMessage: row.draft_message,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
