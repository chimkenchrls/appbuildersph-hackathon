import type { SQLiteDatabase } from 'expo-sqlite';
import type { ClientRequest, ScopeGuardAnalysis, Finding, Classification } from '@/types/domain';

interface AnalysisRow {
  id: string;
  request_id: string;
  agreement_id: string;
  classification: Classification;
  summary: string;
  findings_json: string;
  clarification_questions_json: string;
  created_at: string;
}

interface RequestRow {
  id: string;
  project_id: string;
  agreement_id: string;
  raw_text: string;
  created_at: string;
  status?: string | null;
  accepted_at?: string | null;
}

export class ScopeGuardRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async createRequest(req: ClientRequest): Promise<ClientRequest> {
    await this.db.runAsync(
      `INSERT INTO client_requests (id, project_id, agreement_id, raw_text, created_at, status, accepted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        req.id,
        req.projectId,
        req.agreementId,
        req.rawText.trim(),
        req.createdAt,
        req.status || 'stored',
        req.acceptedAt || null,
      ],
    );
    return req;
  }

  async getRequestById(id: string): Promise<ClientRequest | null> {
    const row = await this.db.getFirstAsync<RequestRow>(
      'SELECT id, project_id, agreement_id, raw_text, created_at, status, accepted_at FROM client_requests WHERE id = ?;',
      [id],
    );
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.project_id,
      agreementId: row.agreement_id,
      rawText: row.raw_text,
      createdAt: row.created_at,
      status: (row.status as any) || 'stored',
      acceptedAt: row.accepted_at || null,
    };
  }

  async listRequestsByProjectId(projectId: string): Promise<ClientRequest[]> {
    const rows = await this.db.getAllAsync<RequestRow>(
      'SELECT id, project_id, agreement_id, raw_text, created_at, status, accepted_at FROM client_requests WHERE project_id = ? ORDER BY created_at DESC;',
      [projectId],
    );
    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      agreementId: r.agreement_id,
      rawText: r.raw_text,
      createdAt: r.created_at,
      status: (r.status as any) || 'stored',
      acceptedAt: r.accepted_at || null,
    }));
  }

  async updateRequestStatus(
    id: string,
    status: 'stored' | 'analyzed' | 'accepted',
    acceptedAt?: string,
  ): Promise<void> {
    await this.db.runAsync(
      'UPDATE client_requests SET status = ?, accepted_at = ? WHERE id = ?;',
      [status, acceptedAt || null, id],
    );
  }

  async deleteRequest(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM client_requests WHERE id = ?;', [id]);
  }

  async createAnalysis(analysis: ScopeGuardAnalysis): Promise<ScopeGuardAnalysis> {
    await this.db.runAsync(
      `INSERT INTO scopeguard_analyses (
        id, request_id, agreement_id, classification,
        summary, findings_json, clarification_questions_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        analysis.id,
        analysis.requestId,
        analysis.agreementId,
        analysis.classification,
        analysis.summary,
        JSON.stringify(analysis.findings),
        JSON.stringify(analysis.clarificationQuestions),
        analysis.createdAt,
      ],
    );
    return analysis;
  }

  async getAnalysisById(id: string): Promise<ScopeGuardAnalysis | null> {
    const row = await this.db.getFirstAsync<AnalysisRow>(
      'SELECT * FROM scopeguard_analyses WHERE id = ?;',
      [id],
    );
    if (!row) return null;
    return this.mapAnalysis(row);
  }

  async getAnalysisByRequestId(requestId: string): Promise<ScopeGuardAnalysis | null> {
    const row = await this.db.getFirstAsync<AnalysisRow>(
      'SELECT * FROM scopeguard_analyses WHERE request_id = ?;',
      [requestId],
    );
    if (!row) return null;
    return this.mapAnalysis(row);
  }

  async listAnalysesByProjectId(projectId: string): Promise<ScopeGuardAnalysis[]> {
    const rows = await this.db.getAllAsync<AnalysisRow>(
      `SELECT a.* FROM scopeguard_analyses a
       JOIN client_requests r ON a.request_id = r.id
       WHERE r.project_id = ?
       ORDER BY a.created_at DESC;`,
      [projectId],
    );
    return rows.map(this.mapAnalysis);
  }

  private mapAnalysis(row: AnalysisRow): ScopeGuardAnalysis {
    const findings: Finding[] = JSON.parse(row.findings_json || '[]');
    const clarificationQuestions: string[] = JSON.parse(row.clarification_questions_json || '[]');

    return {
      id: row.id,
      requestId: row.request_id,
      agreementId: row.agreement_id,
      classification: row.classification,
      summary: row.summary,
      findings,
      clarificationQuestions,
      createdAt: row.created_at,
    };
  }
}
