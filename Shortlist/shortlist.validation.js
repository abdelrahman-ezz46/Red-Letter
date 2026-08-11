// The trust boundary for data read back out of localStorage.
//
// This app wrote that data itself on a previous visit — but a PREVIOUS
// VERSION of the app, or someone editing storage by hand, could have left
// anything there. So it is checked exactly as rigorously as data from the
// internet.

// Stamped into every save. Bumping it makes every older payload get rejected
// wholesale rather than crashing on a changed shape — the migration hook.
export const STORAGE_VERSION = 1;

const KNOWN_CLASSIFICATIONS = new Set(["absorbed", "free", "bridge", "midweek"]);

// True if a stored classification object is complete and usable.
export function isValidClassification(classification) {
  return (
    classification !== null &&
    typeof classification === "object" &&
    // Guards against an older or hand-edited verdict string.
    KNOWN_CLASSIFICATIONS.has(classification.classification) &&
    typeof classification.startDate === "string" &&
    typeof classification.endDate === "string" &&
    typeof classification.totalDaysOff === "number" &&
    typeof classification.leaveDaysUsed === "number" &&
    Array.isArray(classification.leaveDates)
  );
}

// True if a stored shortlist entry has every field the UI reads.
export function isValidShortlistItem(item) {
  return (
    // Null-first again: typeof null is "object".
    item !== null &&
    typeof item === "object" &&
    typeof item.key === "string" &&
    typeof item.countryCode === "string" &&
    typeof item.countryName === "string" &&
    typeof item.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
    typeof item.name === "string" &&
    typeof item.localName === "string" &&
    typeof item.addedAt === "string" &&
    // null is LEGITIMATE here — a non-public day genuinely has no classification.
    (item.classification === null || isValidClassification(item.classification))
  );
}

// True if the stored envelope itself is the shape and version we expect.
export function isValidStoredPayload(payload) {
  return (
    payload !== null &&
    typeof payload === "object" &&
    payload.version === STORAGE_VERSION &&
    Array.isArray(payload.items)
  );
}
