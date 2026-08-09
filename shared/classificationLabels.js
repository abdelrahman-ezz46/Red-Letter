export const CLASSIFICATION_LABELS = Object.freeze({
  absorbed: "Absorbed into the weekend",
  free: "Free long weekend",
  bridge: "Bridge day",
  midweek: "Midweek holiday",
});

export function labelForClassification(kind) {
  return CLASSIFICATION_LABELS[kind] ?? kind;
}
