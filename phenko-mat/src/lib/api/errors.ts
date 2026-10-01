export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/** User-facing message for anything thrown by an API call. */
export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again.") {
  return e instanceof ApiRequestError ? e.message : fallback;
}

export const isApiError = (e: unknown, code?: string): e is ApiRequestError =>
  e instanceof ApiRequestError && (code === undefined || e.code === code);
