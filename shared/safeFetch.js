import { Result, ErrorCode } from "./result.js";

const TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 600;

const RETRYABLE = new Set([ErrorCode.HTTP_429, ErrorCode.HTTP_5XX]);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function codeForStatus(status) {
  if (status === 404) return ErrorCode.HTTP_404;
  if (status === 429) return ErrorCode.HTTP_429;
  if (status >= 500) return ErrorCode.HTTP_5XX;
  return ErrorCode.HTTP_400;
}

function isAbort(error) {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

async function attempt(url, options) {
  let response;

  try {
    response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
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

  if (!response.ok) {
    return Result.failure(
      codeForStatus(response.status),
      `The server responded with status ${response.status}.`,
      { url, status: response.status },
    );
  }

  if (response.status === 204) {
    return Result.success(null);
  }

  try {
    return Result.success(await response.json());
  } catch {
    return Result.failure(
      ErrorCode.PARSE,
      "The response was not readable as JSON.",
      { url, status: response.status },
    );
  }
}

export async function safeFetch(url, options = {}) {
  const first = await attempt(url, options);

  if (first.isSuccess || !RETRYABLE.has(first.error.code)) {
    return first;
  }

  await wait(RETRY_DELAY_MS);
  return attempt(url, options);
}
