// The complete, closed set of failure kinds the app can produce.
// Frozen so nothing can add a tenth code at runtime. Each value is its own
// name as a string, so a code survives JSON and reads clearly in a log.
export const ErrorCode = Object.freeze({
  NETWORK: "NETWORK", // the request couldn't be sent at all (offline, DNS)
  TIMEOUT: "TIMEOUT", // no response inside safeFetch's 8-second limit
  HTTP_400: "HTTP_400", // the request itself was invalid (e.g. year 2200)
  HTTP_404: "HTTP_404", // the service doesn't recognise the country code
  HTTP_429: "HTTP_429", // rate limited
  HTTP_5XX: "HTTP_5XX", // server-side failure
  PARSE: "PARSE", // 200 OK, but the body wasn't valid JSON
  NO_RESULTS: "NO_RESULTS", // succeeded and returned nothing — a real answer
  STORAGE: "STORAGE", // localStorage itself threw
});

// Result — this app's alternative to throwing.
//
// Every operation that can fail returns one of these two shapes instead of
// throwing, so a caller cannot reach the data without first passing the
// `isSuccess` check. Both shapes carry the identical set of keys, so a
// consumer never meets `undefined` and never has to guess what it was handed.
export const Result = Object.freeze({
  // Wrap a value as a successful outcome.
  success(data) {
    return { isSuccess: true, data, error: null };
  },

  // Wrap a failure. `code` is what the app branches on; `message` is a
  // developer-facing note; `context` carries the structured facts (country,
  // year, url) that errorMessages.js later interpolates into English.
  failure(code, message, context = null) {
    return {
      isSuccess: false,
      data: null,
      error: { code, message, context },
    };
  },
});

// True if `code` is one of the nine official codes above.
// Uses hasOwnProperty via .call rather than `code in ErrorCode`, so an
// inherited property name such as "toString" can't produce a false positive.
export function isKnownErrorCode(code) {
  return Object.prototype.hasOwnProperty.call(ErrorCode, code);
}
