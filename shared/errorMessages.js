import { ErrorCode } from "./result.js";

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

const MESSAGE_BUILDERS = {
  [ErrorCode.NETWORK]: () =>
    "Couldn't reach the holiday service. Check your connection and try again.",
  [ErrorCode.TIMEOUT]: () =>
    "The holiday service took too long to respond. Try again in a moment.",
  [ErrorCode.HTTP_400]: (context) =>
    `That request wasn't valid${context.year ? ` for ${context.year}` : ""}. Try a different year.`,
  [ErrorCode.HTTP_404]: (context) =>
    `We couldn't find holiday data for ${context.countryName ?? "that country"}.`,
  [ErrorCode.HTTP_429]: () =>
    "Too many requests right now. Wait a moment and try again.",
  [ErrorCode.HTTP_5XX]: () =>
    "The holiday service is having trouble right now. Try again shortly.",
  [ErrorCode.PARSE]: () =>
    "The holiday service sent back something we couldn't read.",
  [ErrorCode.NO_RESULTS]: (context) =>
    `${context.countryName ?? "This country"} has no recorded public holidays for ${context.year ?? "this year"}. That's the real answer, not an error — try another year.`,
};

export function messageForError(code, context = {}) {
  const build = MESSAGE_BUILDERS[code];
  return build ? build(context) : GENERIC_MESSAGE;
}
