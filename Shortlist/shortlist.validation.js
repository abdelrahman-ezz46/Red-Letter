export const STORAGE_VERSION = 1;

const KNOWN_CLASSIFICATIONS = new Set(["absorbed", "free", "bridge", "midweek"]);

export function isValidClassification(classification) {
  return (
    classification !== null &&
    typeof classification === "object" &&
    KNOWN_CLASSIFICATIONS.has(classification.classification) &&
    typeof classification.startDate === "string" &&
    typeof classification.endDate === "string" &&
    typeof classification.totalDaysOff === "number" &&
    typeof classification.leaveDaysUsed === "number" &&
    Array.isArray(classification.leaveDates)
  );
}

export function isValidShortlistItem(item) {
  return (
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
    (item.classification === null || isValidClassification(item.classification))
  );
}

export function isValidStoredPayload(payload) {
  return (
    payload !== null &&
    typeof payload === "object" &&
    payload.version === STORAGE_VERSION &&
    Array.isArray(payload.items)
  );
}
