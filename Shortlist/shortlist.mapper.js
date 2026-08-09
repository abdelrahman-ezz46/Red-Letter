import { compareISODates } from "../shared/dates.js";

export function sortShortlist(items) {
  return [...items].sort((a, b) => compareISODates(a.date, b.date));
}

export function summarizeShortlist(items) {
  return {
    count: items.length,
    totalDaysOff: items.reduce((sum, item) => sum + (item.classification?.totalDaysOff ?? 0), 0),
    totalLeaveDays: items.reduce((sum, item) => sum + (item.classification?.leaveDaysUsed ?? 0), 0),
  };
}
