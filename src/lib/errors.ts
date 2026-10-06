export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function unavailable(service: string): ApiError {
  return new ApiError(503, `${service} is temporarily unavailable. Please try again later.`);
}
