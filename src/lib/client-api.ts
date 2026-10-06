export class ClientApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly retryAfter?: number, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "ClientApiError";
  }
}

export async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000);
  const response = await fetch(path, { ...options, cache: "no-store", signal });
  const body: unknown = await response.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ClientApiError("The server is temporarily unavailable. Please try again.", response.ok ? 502 : response.status);
  }
  const data = body as Record<string, unknown>;
  if (!response.ok) {
    throw new ClientApiError(response.status === 401 ? "Please log in again to continue." : typeof data.error === "string" ? data.error : "That didn’t go through. Please try again.", response.status, Number(response.headers.get("retry-after")) || undefined, data);
  }
  return data as T;
}

export function displayError(error: unknown) {
  return error instanceof Error && !["TimeoutError", "TypeError", "AbortError", "SyntaxError"].includes(error.name) ? error.message : "We couldn’t reach the server. Check your connection and try again.";
}
