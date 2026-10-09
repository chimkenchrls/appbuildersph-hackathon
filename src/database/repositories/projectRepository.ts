import { ProjectSchema, stored } from '@/safety/persistedSchemas';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Project } from '@/types/domain';

export class ProjectRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async create(data: { id: string; title: string; clientName?: string | null; description?: string | null; draftScopeJson?: string | null }): Promise<Project> {
    const now = new Date().toISOString();
    return this.restore({
      id: data.id, title: data.title.trim(), clientName: data.clientName?.trim() ?? null,
      description: data.description?.trim() ?? null,
      ...(data.draftScopeJson != null ? { draftScopeJson: data.draftScopeJson } : {}), createdAt: now, updatedAt: now,
    });
  }

  /** Restore a validated backup exactly; ordinary creation owns new timestamps. */
  async restore(project: Project): Promise<Project> {
    project = ProjectSchema.parse(project);
    await this.db.runAsync(
      'INSERT INTO projects (id, title, client_name, description, created_at, updated_at, draft_scope_json) VALUES (?, ?, ?, ?, ?, ?, ?);',
      [project.id, project.title, project.clientName, project.description, project.createdAt, project.updatedAt, project.draftScopeJson ?? null],
    );
    return project;
  }

  async list(): Promise<Project[]> {
    const rows = await this.db.getAllAsync<{
      id: string;
      title: string;
      client_name: string | null;
      description: string | null;
      created_at: string;
      updated_at: string;
      draft_scope_json: string | null;
    }>('SELECT id, title, client_name, description, created_at, updated_at, draft_scope_json FROM projects ORDER BY updated_at DESC;');

    return rows.map((r) => stored(ProjectSchema, {
      id: r.id,
      title: r.title,
      clientName: r.client_name,
      description: r.description,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      ...(r.draft_scope_json != null ? { draftScopeJson: r.draft_scope_json } : {}),
    }));
  }

  async getById(id: string): Promise<Project | null> {
    const row = await this.db.getFirstAsync<{
      id: string;
      title: string;
      client_name: string | null;
      description: string | null;
      created_at: string;
      updated_at: string;
      draft_scope_json: string | null;
    }>('SELECT id, title, client_name, description, created_at, updated_at, draft_scope_json FROM projects WHERE id = ?;', [id]);

    if (!row) return null;

    return stored(ProjectSchema, {
      id: row.id,
      title: row.title,
      clientName: row.client_name,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(row.draft_scope_json != null ? { draftScopeJson: row.draft_scope_json } : {}),
    });
  }

  async update(id: string, updates: { title?: string; clientName?: string | null; description?: string | null; draftScopeJson?: string | null }): Promise<Project | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const title = updates.title !== undefined ? updates.title.trim() : existing.title;
    const clientName = updates.clientName !== undefined ? (updates.clientName?.trim() ?? null) : existing.clientName;
    const description = updates.description !== undefined ? (updates.description?.trim() ?? null) : existing.description;

    const draftScopeJson = updates.draftScopeJson !== undefined ? updates.draftScopeJson : existing.draftScopeJson;
    const next = ProjectSchema.parse({ id, title, clientName, description, createdAt: existing.createdAt, updatedAt: now,
      ...(draftScopeJson != null ? { draftScopeJson } : {}) });
    await this.db.runAsync(
      `UPDATE projects SET title = ?, client_name = ?, description = ?, updated_at = ?, draft_scope_json = ? WHERE id = ?;`,
      [title, clientName, description, now, draftScopeJson ?? null, id],
    );

    return next;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.runAsync('DELETE FROM projects WHERE id = ?;', [id]);
    return result.changes > 0;
  }
}
