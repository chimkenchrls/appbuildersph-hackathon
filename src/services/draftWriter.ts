/** Serializes snapshot writes; a failure does not prevent a later explicit retry. */
export class DraftWriter<T> {
  private tail: Promise<void> = Promise.resolve();
  constructor(private readonly write: (snapshot: T) => Promise<void>) {}
  save(snapshot: T): Promise<void> {
    const next = this.tail.catch(() => {}).then(() => this.write(snapshot));
    this.tail = next;
    return next;
  }
  async flush() { await this.tail.catch(() => {}); }
}
