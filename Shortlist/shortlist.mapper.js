import { compareISODates } from "../shared/dates.js";

// Sorts the shortlist chronologically, so it reads as an itinerary rather than
// as a pile in the order the user happened to click.
export function sortShortlist(items) {
  // Copies FIRST: .sort() rearranges the array it is given, and `items` comes
  // from frozen store state.
  return [...items].sort((a, b) => compareISODates(a.date, b.date));
}

// Totals the shortlist into the one-line summary above the list.
export function summarizeShortlist(items) {
  return {
    count: items.length,
    // ?. and ?? 0 so a null classification (a non-public day) contributes zero
    // rather than turning the whole sum into NaN.
    //
    // Note these are naive sums: two holidays inside the same long weekend
    // double-count the days they share.
    totalDaysOff: items.reduce((sum, item) => sum + (item.classification?.totalDaysOff ?? 0), 0),
    totalLeaveDays: items.reduce((sum, item) => sum + (item.classification?.leaveDaysUsed ?? 0), 0),
  };
}
