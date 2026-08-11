import { ErrorCode } from "./result.js";

// Shown for any code without a builder below — including the "UNEXPECTED"
// code the controllers synthesise for genuinely unforeseen crashes.
const GENERIC_MESSAGE = "Something went wrong. Please try again.";

// Code -> message builder.
//
// These are FUNCTIONS rather than fixed strings because several messages need
// runtime facts (the country name, the year) that only the caller has.
//
// This map is the single place in the codebase where a failure becomes
// English. Services return codes and never wording, which is what makes
// "clear error messages" a structural property rather than a scattering of
// hardcoded strings across dozens of catch blocks.
const MESSAGE_BUILDERS = {
  [ErrorCode.NETWORK]: () =>
    "Couldn't reach the holiday service. Check your connection and try again.",
  [ErrorCode.TIMEOUT]: () =>
    "The holiday service took too long to respond. Try again in a moment.",
  // The year is spliced in only when known, so this never says "for undefined".
  [ErrorCode.HTTP_400]: (context) =>
    `That request wasn't valid${context.year ? ` for ${context.year}` : ""}. Try a different year.`,
  // ?? rather than || so an empty-string name would still be used.
  [ErrorCode.HTTP_404]: (context) =>
    `We couldn't find holiday data for ${context.countryName ?? "that country"}.`,
  [ErrorCode.HTTP_429]: () =>
    "Too many requests right now. Wait a moment and try again.",
  [ErrorCode.HTTP_5XX]: () =>
    "The holiday service is having trouble right now. Try again shortly.",
  [ErrorCode.PARSE]: () =>
    "The holiday service sent back something we couldn't read.",
  // Branches on context to tell two different empty answers apart: a country
  // with no holidays, versus no countries being available at all. Both say
  // outright that this is not an error — the UI backs that up with calm
  // styling and no retry button.
  [ErrorCode.NO_RESULTS]: (context) => {
    if (context.countryName) {
      return `${context.countryName} has no recorded public holidays for ${context.year ?? "this year"}. That's the real answer, not an error — try another year.`;
    }
    return "No countries are available from the holiday service right now. That's the real answer, not an error — try again shortly.";
  },
  // States the consequence rather than the cause — the user can't act on
  // "quota exceeded", but can act on "your changes won't be kept".
  [ErrorCode.STORAGE]: () =>
    "Your shortlist can't be saved in this browser right now. Changes will be lost when you leave this page.",
};

// Turns an error code plus its context into the sentence shown to the user.
export function messageForError(code, context = {}) {
  const build = MESSAGE_BUILDERS[code];
  return build ? build(context) : GENERIC_MESSAGE;
}
