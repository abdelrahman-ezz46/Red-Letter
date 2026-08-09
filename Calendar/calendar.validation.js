export function isValidCountryCode(code) {
  return typeof code === "string" && /^[A-Z]{2}$/.test(code);
}

export function isValidYear(year) {
  return Number.isInteger(year) && year >= 1900 && year <= 2100;
}

export function isValidCountryRecord(record) {
  return (
    record !== null &&
    typeof record === "object" &&
    isValidCountryCode(record.countryCode) &&
    typeof record.name === "string" &&
    record.name.length > 0
  );
}

export function isValidHolidayRecord(record) {
  return (
    record !== null &&
    typeof record === "object" &&
    typeof record.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(record.date) &&
    typeof record.name === "string" &&
    typeof record.localName === "string" &&
    Array.isArray(record.types)
  );
}
