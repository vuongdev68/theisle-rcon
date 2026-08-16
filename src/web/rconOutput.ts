export class RconOutputLog {
  private readonly lines: Array<{ timestamp: number; action: string; body: string }> = [];

  constructor(private readonly limit = 200) {}

  push(action: string, body: string): void {
    this.lines.unshift({ timestamp: Date.now(), action, body: body.slice(0, 4000) });
    if (this.lines.length > this.limit) {
      this.lines.pop();
    }
  }

  list(): Array<{ timestamp: number; action: string; body: string }> {
    return this.lines.slice();
  }

  clear(): void {
    this.lines.length = 0;
  }
}
