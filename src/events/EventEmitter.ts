type EventHandler<T> = (payload: T) => void;

export class TypedEventEmitter<TEvents extends { [K in keyof TEvents]: unknown }> {
  private readonly listeners = new Map<keyof TEvents, Set<EventHandler<unknown>>>();

  on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): this {
    const existing = this.listeners.get(event) ?? new Set();
    existing.add(handler as EventHandler<unknown>);
    this.listeners.set(event, existing);
    return this;
  }

  once<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): this {
    const wrapped: EventHandler<TEvents[K]> = (payload) => {
      this.off(event, wrapped);
      handler(payload);
    };
    return this.on(event, wrapped);
  }

  off<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): this {
    const existing = this.listeners.get(event);
    if (!existing) {
      return this;
    }
    existing.delete(handler as EventHandler<unknown>);
    if (existing.size === 0) {
      this.listeners.delete(event);
    }
    return this;
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): boolean {
    const existing = this.listeners.get(event);
    if (!existing || existing.size === 0) {
      return false;
    }
    for (const handler of [...existing]) {
      handler(payload);
    }
    return true;
  }

  removeAllListeners(event?: keyof TEvents): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  listenerCount(event: keyof TEvents): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
