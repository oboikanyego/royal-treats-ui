/** An API call that failed. `status` is 0 when the server could not be reached. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

type Failure = { name?: string; status?: number; error?: unknown };

/**
 * Turns whatever HttpClient or rxjs threw into an ApiRequestError, using the API's
 * `{ error, details }` body when there is one. Duck-typed so it needs no Angular imports.
 */
export function toApiError(failure: unknown): ApiRequestError {
  if (failure instanceof ApiRequestError) return failure;
  const f = (failure ?? {}) as Failure;
  if (f.name === 'TimeoutError')
    return new ApiRequestError(0, 'The server took too long to respond. Please try again.');
  const status = typeof f.status === 'number' ? f.status : 0;
  if (status === 0)
    return new ApiRequestError(0, 'Cannot reach the server. Check your connection.');
  // A text response (a receipt) reports its failure as the JSON text of the API's error body.
  const body = (typeof f.error === 'string' ? parseJson(f.error) : f.error) as
    { error?: unknown; details?: unknown } | null | undefined;
  const message =
    typeof body?.error === 'string' && body.error
      ? body.error
      : `The server returned an error (${status}).`;
  return new ApiRequestError(status, message, body?.details);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Network failures, timeouts and gateway errors are worth retrying for a read. */
export const isTransient = (error: ApiRequestError): boolean =>
  error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504;
