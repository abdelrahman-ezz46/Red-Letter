// Display wording for the four classifications.
//
// Kept separate from dates.js on purpose: that module is pure logic and holds
// no user-facing copy, exactly as services hold no error wording.
export const CLASSIFICATION_LABELS = Object.freeze({
  absorbed: "Absorbed into the weekend",
  free: "Free long weekend",
  bridge: "Bridge day",
  midweek: "Midweek holiday",
});

// Label for a classification key, falling back to the raw key if unknown.
export function labelForClassification(kind) {
  return CLASSIFICATION_LABELS[kind] ?? kind;
}
