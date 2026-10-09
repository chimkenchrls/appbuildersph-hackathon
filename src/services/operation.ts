import { checkCancelled, ServiceError } from './errors';

export type OperationStatus = 'idle' | 'running' | 'saving' | 'succeeded' | 'failed' | 'cancelled';
export interface OperationContext { signal: AbortSignal; beginSave(): void }
export type Outcome<T> = { ok: true; value: T } | { ok: false };
interface Snapshot { status: OperationStatus; error: unknown; cancelling: boolean }

export class Operation {
  private snapshot: Snapshot = { status: 'idle', error: null, cancelling: false };
  private listeners = new Set<() => void>();
  private controller: AbortController | null = null;
  private pending: Promise<Outcome<unknown>> | null = null;
  private disposed = false;
  getSnapshot = () => this.snapshot;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private update(next: Snapshot) { this.snapshot = next; this.listeners.forEach(fn => fn()); }
  clearError = () => { if (!this.pending) this.update({ status: 'idle', error: null, cancelling: false }); };
  cancel = () => {
    if (this.snapshot.status !== 'running') return;
    this.controller?.abort();
    this.update({ ...this.snapshot, cancelling: true });
  };
  settle = async () => { await this.pending; };
  dispose = () => { this.disposed = true; this.cancel(); this.listeners.clear(); };
  activate = () => { this.disposed = false; };
  run = async <T,>(fn: (context: OperationContext) => Promise<T>): Promise<Outcome<T>> => {
    if (this.pending || this.disposed) return { ok: false };
    const controller = new AbortController();
    this.controller = controller;
    this.update({ status: 'running', error: null, cancelling: false });
    let saving = false;
    const beginSave = () => {
      checkCancelled(controller.signal);
      if (this.disposed || this.controller !== controller) throw new ServiceError('cancelled');
      saving = true;
      this.update({ status: 'saving', error: null, cancelling: false });
    };
    // Defer invocation until pending is assigned, even if fn completes synchronously.
    const task = Promise.resolve().then(async (): Promise<Outcome<T>> => {
      try {
        checkCancelled(controller.signal);
        const value = await fn({ signal: controller.signal, beginSave });
        if (!saving) { checkCancelled(controller.signal); if (this.disposed) throw new ServiceError('cancelled'); }
        this.update({ status: 'succeeded', error: null, cancelling: false });
        return { ok: true, value };
      } catch (error) {
        const cancelled = !saving && (controller.signal.aborted || (error instanceof ServiceError && error.code === 'cancelled'));
        this.update({ status: cancelled ? 'cancelled' : 'failed', error, cancelling: false });
        return { ok: false };
      } finally { this.pending = null; this.controller = null; }
    });
    this.pending = task;
    return task;
  };
}
