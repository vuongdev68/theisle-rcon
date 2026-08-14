export interface AuditEntry {
  id: number;
  timestamp: number;
  actor: string;
  role: string;
  action: string;
  target?: string;
  ip?: string;
  success: boolean;
  detail?: string;
}

export class AuditLog {
  private nextId = 1;
  private readonly entries: AuditEntry[] = [];

  constructor(private readonly limit = 500) {}

  record(input: Omit<AuditEntry, "id" | "timestamp"> & { timestamp?: number }): AuditEntry {
    const entry: AuditEntry = {
      id: this.nextId,
      timestamp: input.timestamp ?? Date.now(),
      actor: input.actor,
      role: input.role,
      action: input.action,
      success: input.success,
    };
    this.nextId += 1;
    if (input.target) {
      entry.target = input.target;
    }
    if (input.ip) {
      entry.ip = input.ip;
    }
    if (input.detail) {
      entry.detail = input.detail;
    }
    this.entries.unshift(entry);
    if (this.entries.length > this.limit) {
      this.entries.pop();
    }
    return entry;
  }

  list(limit = 100): AuditEntry[] {
    return this.entries.slice(0, limit);
  }
}
