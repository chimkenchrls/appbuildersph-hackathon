import { Operation } from '@/services/operation';
import { DraftWriter } from '@/services/draftWriter';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('Stop after generation resolves but before saving prevents the write', async () => {
  const operation = new Operation();
  const response = deferred<string>();
  let stored = '';
  const pending = operation.run(async ({ beginSave }) => {
    const value = await response.promise;
    beginSave();
    stored = value;
    return value;
  });
  await Promise.resolve();
  response.resolve('candidate');
  operation.cancel();
  expect(await pending).toEqual({ ok: false });
  expect(stored).toBe('');
  expect(operation.getSnapshot().status).toBe('cancelled');
});

test('Stop after saving begins cannot report a committed write as cancelled', async () => {
  const operation = new Operation();
  const saved = deferred<string>();
  const pending = operation.run(async ({ beginSave }) => { beginSave(); return saved.promise; });
  await Promise.resolve();
  expect(operation.getSnapshot().status).toBe('saving');
  operation.cancel();
  saved.resolve('saved-id');
  expect(await pending).toEqual({ ok: true, value: 'saved-id' });
  expect(operation.getSnapshot().status).toBe('succeeded');
});

test('duplicate generation remains blocked while cancellation is settling', async () => {
  const operation = new Operation();
  const response = deferred<string>();
  const first = operation.run(async () => response.promise);
  await Promise.resolve();
  operation.cancel();
  let duplicateStarted = false;
  await operation.run(async () => { duplicateStarted = true; });
  expect(duplicateStarted).toBe(false);
  response.resolve('late');
  expect(await first).toEqual({ ok: false });
  expect((await operation.run(async () => 'fresh'))).toEqual({ ok: true, value: 'fresh' });
});

test('disposing an operation rejects late generation and cleans its listeners', async () => {
  const operation = new Operation();
  const response = deferred<string>();
  const pending = operation.run(async () => response.promise);
  operation.dispose();
  response.resolve('late');
  expect(await pending).toEqual({ ok: false });
});

test('draft saves serialize snapshots so an older save cannot win', async () => {
  const first = deferred<void>();
  const saved: string[] = [];
  const writer = new DraftWriter<string>(async snapshot => {
    if (snapshot === 'old') await first.promise;
    saved.push(snapshot);
  });
  const a = writer.save('old');
  const b = writer.save('new');
  expect(saved).toEqual([]);
  first.resolve();
  await Promise.all([a, b]);
  expect(saved).toEqual(['old', 'new']);
  await writer.flush();
});

test('a rejected draft save remains retryable without poisoning the queue', async () => {
  let fail = true;
  const saved: string[] = [];
  const writer = new DraftWriter<string>(async snapshot => {
    if (fail) throw new Error('disk full');
    saved.push(snapshot);
  });
  await expect(writer.save('reviewed')).rejects.toThrow('disk full');
  fail = false;
  await writer.save('reviewed');
  expect(saved).toEqual(['reviewed']);
});
