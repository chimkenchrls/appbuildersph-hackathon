import { openDatabaseAsync } from 'expo-sqlite';
import { closeDatabaseAsync, getDatabaseAsync } from '@/database/client';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

afterEach(() => jest.clearAllMocks());

test('concurrent database consumers share one opening and configured connection', async () => {
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  const db = { execAsync: async () => ready, closeAsync: jest.fn(async () => {}) };
  jest.mocked(openDatabaseAsync).mockResolvedValue(db as never);
  const first = getDatabaseAsync(); const second = getDatabaseAsync();
  release();
  expect(await first).toBe(await second);
  expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
  await closeDatabaseAsync();
});

test('failed connection setup closes its handle and allows a clean retry', async () => {
  const broken = { execAsync: async () => { throw new Error('Cannot configure database'); }, closeAsync: jest.fn(async () => {}) };
  const healthy = { execAsync: async () => {}, closeAsync: jest.fn(async () => {}) };
  jest.mocked(openDatabaseAsync).mockResolvedValueOnce(broken as never).mockResolvedValueOnce(healthy as never);
  await expect(getDatabaseAsync()).rejects.toThrow('Cannot configure database');
  expect(broken.closeAsync).toHaveBeenCalledTimes(1);
  expect(await getDatabaseAsync()).toBe(healthy);
  await closeDatabaseAsync();
});
