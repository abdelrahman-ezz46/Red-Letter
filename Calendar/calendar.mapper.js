import { classifyHoliday, compareISODates, getWeekday } from "../shared/dates.js";
import { isValidCountryRecord, isValidHolidayRecord } from "./calendar.validation.js";

// Pure transforms: raw API shapes in, view models out. No DOM, no network.
// Their job is to make sure nothing downstream ever sees the API's shape.

// Raw country records -> a clean, sorted list for the picker.
export function mapCountries(rawList) {
  return rawList
    .filter(isValidCountryRecord) // drop anything malformed
    .map((raw) => ({ countryCode: raw.countryCode, name: raw.name })) // keep only what's used
    // localeCompare sorts accented names correctly, where a plain < would not.
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Narrows the country list to those matching the filter text.
// Called fresh on every keystroke.
export function filterCountries(countries, query) {
  const normalized = query.trim().toLowerCase();
  // Returns the ORIGINAL array by reference when empty — a new array would
  // look like a change to the store's reference-based comparison.
  if (!normalized) return countries;
  return countries.filter(
    (country) =>
      // Names match on a substring, but codes must match EXACTLY. Substring
      // matching on two-letter codes would drag in unrelated countries on
      // almost every letter typed.
      country.name.toLowerCase().includes(normalized) ||
      country.countryCode.toLowerCase() === normalized,
  );
}

// One raw API record -> the app's own view of a holiday.
function mapHoliday(raw) {
  return {
    date: raw.date,
    weekday: getWeekday(raw.date), // computed once here, not per render
    name: raw.name,
    localName: raw.localName,
    types: raw.types,
    isPublic: raw.types.includes("Public"),
    // === true is deliberate: a missing field must read as "not nationwide",
    // not be truthy-coerced into a claim the API never made.
    isNationwide: raw.global === true,
    regions: Array.isArray(raw.counties) ? raw.counties : null,
  };
}

// A year of raw API data -> a validated, classified, sorted list.
export function mapHolidays(rawList) {
  const validRecords = rawList.filter(isValidHolidayRecord);

  // THE SUBTLEST CORRECTNESS DECISION IN THE APP.
  //
  // Only holidays that are both Public AND nationwide count as neighbours when
  // stretching a break. Live UK data caught the bug this prevents: January 2nd
  // is a public holiday in Scotland only, and an earlier version let it zero
  // out New Year's Day's leave cost for EVERY UK user, not just Scottish ones.
  const nationwidePublicDates = validRecords
    .filter((record) => record.types.includes("Public") && record.global === true)
    .map((record) => record.date);

  return validRecords
    .map(mapHoliday)
    .map((holiday) => ({
      ...holiday,
      // Only public holidays are actual days off, so only they get classified.
      // Everything else gets null, which the UI renders as the grey
      // "not counted toward leave" badge.
      // Every classification uses the SAME nationwide set, so adjacency stays
      // consistent across the whole year.
      classification: holiday.isPublic ? classifyHoliday(holiday.date, nationwidePublicDates) : null,
    }))
    .sort((a, b) => compareISODates(a.date, b.date));
}
