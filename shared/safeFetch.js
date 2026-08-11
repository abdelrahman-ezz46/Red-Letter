import { Result, ErrorCode } from "./result.js";

const TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 600;

// Only these two failures are worth a second attempt. A 404 or a malformed
// request will fail identically next time; a rate limit or a transient server
// error might not.
const RETRYABLE = new Set([ErrorCode.HTTP_429, ErrorCode.HTTP_5XX]);

// Promise-wrapped setTimeout, so a delay can be awaited.
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Maps an HTTP status onto the app's error vocabulary.
// Anything non-OK that isn't 404/429/5xx falls through to HTTP_400, which
// reads correctly as "your request was wrong" for the rest of the 4xx band.
function codeForStatus(status) {
  if (status === 404) return ErrorCode.HTTP_404;
  if (status === 429) return ErrorCode.HTTP_429;
  if (status >= 500) return ErrorCode.HTTP_5XX;
  return ErrorCode.HTTP_400;
}

// True if this rejection was the request being cancelled rather than a
// transport failure. An 8s timeout surfaces as TimeoutError; a manual abort
// as AbortError. The instanceof guard stops a rejected non-Error crashing us.
function isAbort(error) {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

// One complete network round-trip. Never throws — every path returns a Result.
async function attempt(url, options) {
  let response;

  try {
    response = await fetch(url, {
      ...options,
      // Built fresh on every call, so a retry gets its own signal. Sharing one
      // across a retry would make the retry abort instantly, because a signal
      // that has already fired stays fired.
      // Spread first, signal second, so a caller can't override the timeout.
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    // fetch only rejects on transport failure, never on a bad status, so
    // reaching here means the request never completed at all.
    if (isAbort(error)) {
      return Result.failure(
        ErrorCode.TIMEOUT,
        `No response within ${TIMEOUT_MS / 1000} seconds.`,
        { url },
      );
    }
    return Result.failure(ErrorCode.NETWORK, "The request could not be sent.", {
      url,
    });
  }

  // CRITICAL: fetch does NOT throw on 404 or 500 — as far as it is concerned
  // the round-trip succeeded. Without this explicit check, an error page
  // would be parsed and treated as valid data.
  if (!response.ok) {
    return Result.failure(
      codeForStatus(response.status),
      `The server responded with status ${response.status}.`,
      { url, status: response.status },
    );
  }

  // 204 No Content is a SUCCESS with an empty body. Calling .json() on it
  // throws, and a naive implementation would report that as a parse error
  // when the truth is "this worked and there's nothing to show".
  // Nager.Date really does this — its PublicHolidays endpoint returns 204
  // for Antarctica.
  if (response.status === 204) {
    return Result.success(null);
  }

  try {
    return Result.success(await response.json());
  } catch {
    // A 200 with an unreadable body is a different failure from a 500, and
    // deserves its own honest message.
    return Result.failure(
      ErrorCode.PARSE,
      "The response was not readable as JSON.",
      { url, status: response.status },
    );
  }
}

// The only network entry point in the app — there is no bare fetch anywhere
// else. Adds a single retry to `attempt`, and never throws.
export async function safeFetch(url, options = {}) {
  const first = await attempt(url, options);

  if (first.isSuccess || !RETRYABLE.has(first.error.code)) {
    return first;
  }

  await wait(RETRY_DELAY_MS);
  // Exactly one retry — whatever it returns is final. No unbounded loop.
  return attempt(url, options);
}
