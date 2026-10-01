import "server-only";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message = "Invalid request.", code = "BAD_REQUEST") => new ApiError(400, code, message);
export const unauthorized = (message = "Please sign in to continue.") => new ApiError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "You can't do that.", code = "FORBIDDEN") => new ApiError(403, code, message);
export const notFound = (what = "Resource") => new ApiError(404, "NOT_FOUND", `${what} not found.`);
export const conflict = (message: string, code = "CONFLICT") => new ApiError(409, code, message);
export const gone = (message: string) => new ApiError(410, "GONE", message);
export const tooManyRequests = () => new ApiError(429, "RATE_LIMITED", "Slow down a little and try again shortly.");
