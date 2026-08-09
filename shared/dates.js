export const Weekday = Object.freeze({
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
});

export const Classification = Object.freeze({
  ABSORBED: "absorbed",
  FREE: "free",
  BRIDGE: "bridge",
  MIDWEEK: "midweek",
});

const MS_PER_DAY = 86400000;

const WEEKDAY_RULES = {
  [Weekday.SUNDAY]: { classification: Classification.ABSORBED, startOffset: -1, span: 2, leaveOffsets: [] },
  [Weekday.MONDAY]: { classification: Classification.FREE, startOffset: -2, span: 3, leaveOffsets: [] },
  [Weekday.TUESDAY]: { classification: Classification.BRIDGE, startOffset: -3, span: 4, leaveOffsets: [-1] },
  [Weekday.WEDNESDAY]: { classification: Classification.MIDWEEK, startOffset: -4, span: 5, leaveOffsets: [-2, -1] },
  [Weekday.THURSDAY]: { classification: Classification.BRIDGE, startOffset: 0, span: 4, leaveOffsets: [1] },
  [Weekday.FRIDAY]: { classification: Classification.FREE, startOffset: 0, span: 3, leaveOffsets: [] },
  [Weekday.SATURDAY]: { classification: Classification.ABSORBED, startOffset: 0, span: 2, leaveOffsets: [] },
};

export function parseISODate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return { year, month, day };
}

function toTimestamp({ year, month, day }) {
  return Date.UTC(year, month - 1, day);
}

function timestampToISODate(timestamp) {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(dateString, delta) {
  const { year, month, day } = parseISODate(dateString);
  return timestampToISODate(Date.UTC(year, month - 1, day + delta));
}

export function getWeekday(dateString) {
  return new Date(toTimestamp(parseISODate(dateString))).getUTCDay();
}

export function compareISODates(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function daysBetween(startDate, endDate) {
  const start = toTimestamp(parseISODate(startDate));
  const end = toTimestamp(parseISODate(endDate));
  return Math.round((end - start) / MS_PER_DAY);
}

export function classifyWeekday(weekday) {
  return WEEKDAY_RULES[weekday].classification;
}

export function currentYear() {
  return new Date().getUTCFullYear();
}

function isAlreadyOff(dateString, holidaySet) {
  const weekday = getWeekday(dateString);
  return weekday === Weekday.SUNDAY || weekday === Weekday.SATURDAY || holidaySet.has(dateString);
}

export function classifyHoliday(dateString, holidayDates = []) {
  const holidaySet = new Set(holidayDates);
  const weekday = getWeekday(dateString);
  const rule = WEEKDAY_RULES[weekday];

  const blockStart = addDays(dateString, rule.startOffset);
  const blockEnd = addDays(blockStart, rule.span - 1);

  const leaveDates = rule.leaveOffsets
    .map((offset) => addDays(dateString, offset))
    .filter((leaveDate) => !holidaySet.has(leaveDate));

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
    totalDaysOff: daysBetween(startDate, endDate) + 1,
    leaveDaysUsed: leaveDates.length,
    leaveDates,
  };
}
