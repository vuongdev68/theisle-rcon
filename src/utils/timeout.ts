import { RconTimeoutError } from "../rcon/RconErrors.js";

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  metadata: { requestId?: number; command?: string } = {},
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new RconTimeoutError(`Operation timed out after ${timeoutMs}ms`, {
          timeout: timeoutMs,
          ...metadata,
        }),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
