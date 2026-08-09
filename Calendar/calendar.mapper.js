import { classifyHoliday, compareISODates } from "../shared/dates.js";
import { isValidCountryRecord, isValidHolidayRecord } from "./calendar.validation.js";

export function mapCountries(rawList) {
  return rawList
    .filter(isValidCountryRecord)
    .map((raw) => ({ countryCode: raw.countryCode, name: raw.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function filterCountries(countries, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return countries;
  return countries.filter(
    (country) =>
      country.name.toLowerCase().includes(normalized) ||
      country.countryCode.toLowerCase() === normalized,
  );
}

function mapHoliday(raw) {
  return {
    date: raw.date,
    name: raw.name,
    localName: raw.localName,
    types: raw.types,
    isPublic: raw.types.includes("Public"),
    isNationwide: raw.global === true,
    regions: Array.isArray(raw.counties) ? raw.counties : null,
  };
}

export function mapHolidays(rawList) {
  const validRecords = rawList.filter(isValidHolidayRecord);
  const nationwidePublicDates = validRecords
    .filter((record) => record.types.includes("Public") && record.global === true)
    .map((record) => record.date);

  return validRecords
    .map(mapHoliday)
    .map((holiday) => ({
      ...holiday,
      classification: holiday.isPublic ? classifyHoliday(holiday.date, nationwidePublicDates) : null,
    }))
    .sort((a, b) => compareISODates(a.date, b.date));
}
