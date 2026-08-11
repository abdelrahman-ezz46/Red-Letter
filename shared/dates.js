// This module is pure logic — no DOM, no network, no storage. It can be
// unit-tested in complete isolation, and it is the only place in the app that
// knows what a "long weekend" is.

// JavaScript numbers weekdays 0-6 starting at Sunday. Naming them keeps the
// rules table below readable instead of a wall of magic numbers.
export const Weekday = Object.freeze({
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
});

// The four verdicts. These exact strings also appear in the CSS as
// [data-classification="free"] and .badge-bridge, so they are a contract.
export const Classification = Object.freeze({
  ABSORBED: "absorbed", // lands on the weekend — no benefit
  FREE: "free", // Monday or Friday — long weekend, no leave needed
  BRIDGE: "bridge", // Tuesday or Thursday — 1 leave day buys 4 off
  MIDWEEK: "midweek", // Wednesday — 2 leave days buy 5 off
});

// Index-aligned to Weekday above, so WEEKDAY_NAMES[getWeekday(d)] just works.
export const WEEKDAY_NAMES = Object.freeze([
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]);

// Zero-indexed to match getUTCMonth().
export const MONTH_ABBREVIATIONS = Object.freeze([
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]);

const MS_PER_DAY = 86400000;

// THE BUSINESS LOGIC OF THE ENTIRE APP, as a lookup table. One row per
// weekday, four facts each:
//
//   classification  the verdict
//   startOffset     how many days BEFORE the holiday the break starts
//   span            how many days the break runs for
//   leaveOffsets    which days you would have to book off
//
// Read Thursday: the break starts on the day itself (0) and runs 4 days
// (Thu-Sun); you book one day at +1, the Friday. One day of leave, four off.
//
// Wednesday bridges BACKWARD (Mon + Tue, joining the weekend before). The
// brief said "two days for five" without saying which two; backward was
// chosen for consistency with Tuesday, which also bridges backward.
const WEEKDAY_RULES = {
  [Weekday.SUNDAY]: { classification: Classification.ABSORBED, startOffset: -1, span: 2, leaveOffsets: [] },
  [Weekday.MONDAY]: { classification: Classification.FREE, startOffset: -2, span: 3, leaveOffsets: [] },
  [Weekday.TUESDAY]: { classification: Classification.BRIDGE, startOffset: -3, span: 4, leaveOffsets: [-1] },
  [Weekday.WEDNESDAY]: { classification: Classification.MIDWEEK, startOffset: -4, span: 5, leaveOffsets: [-2, -1] },
  [Weekday.THURSDAY]: { classification: Classification.BRIDGE, startOffset: 0, span: 4, leaveOffsets: [1] },
  [Weekday.FRIDAY]: { classification: Classification.FREE, startOffset: 0, span: 3, leaveOffsets: [] },
  [Weekday.SATURDAY]: { classification: Classification.ABSORBED, startOffset: 0, span: 2, leaveOffsets: [] },
};

// "2026-01-01" -> { year: 2026, month: 1, day: 1 }.
//
// This exists so that `new Date(dateString)` is NEVER called in this module.
// That matters: the Date constructor reads a bare date string as midnight UTC,
// but the non-UTC .getDay() reads it back in the browser's LOCAL timezone. For
// anyone west of UTC that silently shifts the weekday back a day — in New York
// (UTC-5), "2026-01-01" reports as Wednesday when the answer is Thursday, and
// every holiday would be misclassified.
export function parseISODate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return { year, month, day };
}

// Date parts -> a UTC timestamp. The `month - 1` is JS's zero-indexed months.
function toTimestamp({ year, month, day }) {
  return Date.UTC(year, month - 1, day);
}

// A timestamp -> "2026-01-01". Every getter here is a getUTC* variant.
function timestampToISODate(timestamp) {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Moves a date forwards or backwards by whole days.
//
// Date.UTC normalises overflow itself: day 32 of January becomes Feb 1, day 0
// becomes the previous month's last day, and month overflow rolls the year.
// That is how a bridge day on 31 December correctly reaches into next January
// with no special-case code.
export function addDays(dateString, delta) {
  const { year, month, day } = parseISODate(dateString);
  return timestampToISODate(Date.UTC(year, month - 1, day + delta));
}

// Weekday number for a date string. getUTCDay(), never getDay() — see the
// timezone note on parseISODate above.
export function getWeekday(dateString) {
  return new Date(toTimestamp(parseISODate(dateString))).getUTCDay();
}

// Sort comparator for date strings: -1, 0 or 1.
// Plain text comparison is valid ONLY because "YYYY-MM-DD" is fixed-width and
// zero-padded, so alphabetical order equals chronological order. No parsing.
export function compareISODates(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

// Whole days from one date to another. Safe to divide by a fixed day length
// because both timestamps come from Date.UTC, which has no DST jumps.
export function daysBetween(startDate, endDate) {
  const start = toTimestamp(parseISODate(startDate));
  const end = toTimestamp(parseISODate(endDate));
  return Math.round((end - start) / MS_PER_DAY);
}

// The pure four-way rule on its own, independent of any adjacency.
export function classifyWeekday(weekday) {
  return WEEKDAY_RULES[weekday].classification;
}

// The current year in UTC — the app's default view.
export function currentYear() {
  return new Date().getUTCFullYear();
}

// Today as "YYYY-MM-DD" in UTC.
export function todayISO() {
  return timestampToISODate(Date.now());
}

// True if the date is strictly before the reference date, so TODAY is never
// counted as past. The reference is a parameter so the UI can compute it once
// and reuse it across a whole list instead of per card.
export function isPastDate(dateString, referenceDate = todayISO()) {
  return compareISODates(dateString, referenceDate) < 0;
}

// Splits a date into the two pieces the little date square shows.
export function formatDayTile(dateString) {
  const { month, day } = parseISODate(dateString);
  return { day: String(day).padStart(2, "0"), month: MONTH_ABBREVIATIONS[month - 1] };
}

// A day you would already have off: a weekend day, or another known holiday.
function isAlreadyOff(dateString, holidaySet) {
  const weekday = getWeekday(dateString);
  return weekday === Weekday.SUNDAY || weekday === Weekday.SATURDAY || holidaySet.has(dateString);
}

// THE PAYOFF FUNCTION.
//
// Given one holiday date and the dates of that country's other NATIONWIDE
// public holidays, works out the real break it produces and what it costs.
export function classifyHoliday(dateString, holidayDates = []) {
  // A Set for O(1) lookups — the stretch loops below hit it repeatedly.
  const holidaySet = new Set(holidayDates);
  const weekday = getWeekday(dateString);
  const rule = WEEKDAY_RULES[weekday];

  // 1. The base block, straight from the rule.
  const blockStart = addDays(dateString, rule.startOffset);
  const blockEnd = addDays(blockStart, rule.span - 1);

  // 2. The days you would book — minus any that are themselves holidays,
  //    because you don't spend leave on a day you already have off. This is
  //    where two neighbouring holidays reduce each other's cost.
  const leaveDates = rule.leaveOffsets
    .map((offset) => addDays(dateString, offset))
    .filter((leaveDate) => !holidaySet.has(leaveDate));

  // 3. Stretch the break outward through anything already free. Uncapped by
  //    design — a genuine holiday chain should extend as far as it really
  //    goes. This is what correctly handles two holidays falling side by side.
  let startDate = blockStart;
  while (isAlreadyOff(addDays(startDate, -1), holidaySet)) {
    startDate = addDays(startDate, -1);
  }

  let endDate = blockEnd;
  while (isAlreadyOff(addDays(endDate, 1), holidaySet)) {
    endDate = addDays(endDate, 1);
  }

  return {
    date: dateString,
    weekday,
    classification: rule.classification,
    startDate,
    endDate,
    totalDaysOff: daysBetween(startDate, endDate) + 1, // +1: inclusive of both ends
    leaveDaysUsed: leaveDates.length,
    leaveDates,
  };
}
