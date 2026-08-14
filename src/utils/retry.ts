export async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function computeBackoffDelay(
  attempt: number,
  initialDelayMs: number,
  multiplier: number,
  maxDelayMs: number,
): number {
  const delay = initialDelayMs * multiplier ** Math.max(0, attempt - 1);
  return Math.min(delay, maxDelayMs);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts: number;
    initialDelayMs: number;
    multiplier?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
    onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
  },
): Promise<T> {
  const multiplier = options.multiplier ?? 2;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= options.maxAttempts) {
        break;
      }
      if (options.shouldRetry && !options.shouldRetry(error)) {
        break;
      }
      const delayMs = computeBackoffDelay(attempt, options.initialDelayMs, multiplier, maxDelayMs);
      options.onRetry?.(attempt, delayMs, error);
      await sleep(delayMs);
    }
  }

  throw lastError;
}
