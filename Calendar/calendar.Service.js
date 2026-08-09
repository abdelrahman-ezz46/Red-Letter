import { safeFetch } from "../shared/safeFetch.js";
import { Result, ErrorCode } from "../shared/result.js";

const BASE_URL = "https://date.nager.at/api/v3";

export async function fetchAvailableCountries() {
  const result = await safeFetch(`${BASE_URL}/AvailableCountries`);
  if (!result.isSuccess) return result;
  return Result.success(result.data ?? []);
}

export async function fetchPublicHolidays(countryCode, year) {
  const result = await safeFetch(`${BASE_URL}/PublicHolidays/${year}/${countryCode}`);
  if (!result.isSuccess) return result;

  const holidays = result.data ?? [];
  if (holidays.length === 0) {
    return Result.failure(
      ErrorCode.NO_RESULTS,
      "No public holidays recorded for this selection.",
      { countryCode, year },
    );
  }

  return Result.success(holidays);
}
