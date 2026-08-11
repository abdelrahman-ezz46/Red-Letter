import { safeFetch } from "../shared/safeFetch.js";
import { Result, ErrorCode } from "../shared/result.js";

// Open API, no key required. Every response shape here was verified against
// the live service rather than assumed.
const BASE_URL = "https://date.nager.at/api/v3";

// Fetches the list of countries the holiday service supports.
// Returns a Result — the raw array on success, or a code on failure. Note it
// never produces English wording; that is errorMessages.js's job alone.
export async function fetchAvailableCountries() {
  const result = await safeFetch(`${BASE_URL}/AvailableCountries`);
  // Network and HTTP failures pass straight through, untouched.
  if (!result.isSuccess) return result;

  // ?? [] converts safeFetch's 204 "success with no body" into an empty list.
  const countries = result.data ?? [];

  // An empty list is not a broken request — it is a real answer. Giving it its
  // own code makes "succeeded but empty" a first-class state the controller
  // can branch on, instead of a silently blank list.
  if (countries.length === 0) {
    return Result.failure(
      ErrorCode.NO_RESULTS,
      "No countries available from the holiday service.",
      {},
    );
  }

  // Still unvalidated at this point — shaping and filtering is the mapper's job.
  return Result.success(countries);
}

// Fetches one country's public holidays for one year.
// The whole year arrives in a single request: no pagination, no per-holiday
// fan-out, which is deliberate — the complexity in this project sits in state
// flow and error handling, not in request orchestration.
export async function fetchPublicHolidays(countryCode, year) {
  // Note the path order: year first, then country code.
  const result = await safeFetch(`${BASE_URL}/PublicHolidays/${year}/${countryCode}`);
  if (!result.isSuccess) return result;

  const holidays = result.data ?? [];

  if (holidays.length === 0) {
    return Result.failure(
      ErrorCode.NO_RESULTS,
      "No public holidays recorded for this selection.",
      // The context the message layer needs to name the country and year.
      { countryCode, year },
    );
  }

  return Result.success(holidays);
}
