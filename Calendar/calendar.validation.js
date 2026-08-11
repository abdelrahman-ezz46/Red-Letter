// The trust boundary for data arriving from the network. Nothing from the API
// reaches the mapper without passing through here first.
//
// Every function is a pure yes/no question with no side effects, which makes
// this the most easily testable file in the codebase.

// True for exactly two uppercase letters. The ^ and $ anchors matter — without
// them "xxUSxx" would pass.
export function isValidCountryCode(code) {
  return typeof code === "string" && /^[A-Z]{2}$/.test(code);
}

// True for a whole number inside the range the holiday service supports.
// Number.isInteger rejects "2026", 2026.5 and NaN in a single call.
export function isValidYear(year) {
  return Number.isInteger(year) && year >= 1900 && year <= 2100;
}

// True if this API record is usable as a country.
export function isValidCountryRecord(record) {
  return (
    // MUST be first: typeof null is "object", so the type check alone would
    // let null through and the property reads below would throw.
    record !== null &&
    typeof record === "object" &&
    isValidCountryCode(record.countryCode) &&
    typeof record.name === "string" &&
    record.name.length > 0
  );
}

// True if this API record is usable as a holiday.
//
// Checks only what the app actually reads. `global` and `counties` are
// deliberately NOT required — the mapper defends those separately with
// `=== true` and Array.isArray, so an absent field degrades gracefully
// instead of discarding the whole record.
export function isValidHolidayRecord(record) {
  return (
    record !== null &&
    typeof record === "object" &&
    typeof record.date === "string" &&
    // The exact format every function in shared/dates.js assumes.
    /^\d{4}-\d{2}-\d{2}$/.test(record.date) &&
    typeof record.name === "string" &&
    typeof record.localName === "string" &&
    Array.isArray(record.types)
  );
}
