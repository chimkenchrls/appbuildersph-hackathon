let sequence = 0;
// Fixture/local UI keys only. The SQLite implementation owns durable record IDs.
export function newId(prefix = 'item'): string {
  return `${prefix}-${Date.now().toString(36)}-${++sequence}`;
}
export function routeId(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,96}$/.test(value) ? value : null;
}
