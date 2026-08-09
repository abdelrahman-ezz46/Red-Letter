export const ErrorCode = Object.freeze({
  NETWORK: "NETWORK",
  TIMEOUT: "TIMEOUT",
  HTTP_400: "HTTP_400",
  HTTP_404: "HTTP_404",
  HTTP_429: "HTTP_429",
  HTTP_5XX: "HTTP_5XX",
  PARSE: "PARSE",
  NO_RESULTS: "NO_RESULTS",
});

export const Result = Object.freeze({
  success(data) {
    return { isSuccess: true, data, error: null };
  },

  failure(code, message, context = null) {
    return {
      isSuccess: false,
      data: null,
      error: { code, message, context },
    };
  },
});

export function isKnownErrorCode(code) {
  return Object.prototype.hasOwnProperty.call(ErrorCode, code);
}
