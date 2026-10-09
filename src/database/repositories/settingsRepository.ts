import type { SQLiteDatabase } from 'expo-sqlite';

export class SettingsRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async get(key: string, defaultValue: string | null = null): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?;',
      [key],
    );
    return row ? row.value : defaultValue;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
      [key, value],
    );
  }

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.db.getAllAsync<{ key: string; value: string }>(
      'SELECT key, value FROM app_settings;',
    );
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  }
}
