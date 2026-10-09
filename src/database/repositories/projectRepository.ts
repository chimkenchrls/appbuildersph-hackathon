import type { SQLiteDatabase } from 'expo-sqlite';
import type { Project } from '@/types/domain';

export class ProjectRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async create(data: {
    id: string;
    title: string;
    clientName?: string | null;
    description?: string | null;
    draftScopeJson?: string | null;
  }): Promise<Project> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO projects (id, title, client_name, description, draft_scope_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        data.id,
        data.title.trim(),
        data.clientName?.trim() ?? null,
        data.description?.trim() ?? null,
        data.draftScopeJson ?? null,
        now,
        now,
      ],
    );

    return {
      id: data.id,
      title: data.title.trim(),
      clientName: data.clientName?.trim() ?? null,
      description: data.description?.trim() ?? null,
      draftScopeJson: data.draftScopeJson ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async list(): Promise<Project[]> {
    const rows = await this.db.getAllAsync<{
      id: string;
      title: string;
      client_name: string | null;
      description: string | null;
      draft_scope_json: string | null;
      created_at: string;
      updated_at: string;
    }>('SELECT id, title, client_name, description, draft_scope_json, created_at, updated_at FROM projects ORDER BY updated_at DESC;');

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      clientName: r.client_name,
      description: r.description,
      draftScopeJson: r.draft_scope_json,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async getById(id: string): Promise<Project | null> {
    const row = await this.db.getFirstAsync<{
      id: string;
      title: string;
      client_name: string | null;
      description: string | null;
      draft_scope_json: string | null;
      created_at: string;
      updated_at: string;
    }>('SELECT id, title, client_name, description, draft_scope_json, created_at, updated_at FROM projects WHERE id = ?;', [id]);

    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      clientName: row.client_name,
      description: row.description,
      draftScopeJson: row.draft_scope_json,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async update(
    id: string,
    updates: {
      title?: string;
      clientName?: string | null;
      description?: string | null;
      draftScopeJson?: string | null;
    },
  ): Promise<Project | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const title = updates.title !== undefined ? updates.title.trim() : existing.title;
    const clientName = updates.clientName !== undefined ? (updates.clientName?.trim() ?? null) : existing.clientName;
    const description = updates.description !== undefined ? (updates.description?.trim() ?? null) : existing.description;
    const draftScopeJson = updates.draftScopeJson !== undefined ? (updates.draftScopeJson ?? null) : (existing.draftScopeJson ?? null);

    await this.db.runAsync(
      `UPDATE projects SET title = ?, client_name = ?, description = ?, draft_scope_json = ?, updated_at = ? WHERE id = ?;`,
      [title, clientName, description, draftScopeJson, now, id],
    );

    return {
      id,
      title,
      clientName,
      description,
      draftScopeJson,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.runAsync('DELETE FROM projects WHERE id = ?;', [id]);
    return result.changes > 0;
  }
}
