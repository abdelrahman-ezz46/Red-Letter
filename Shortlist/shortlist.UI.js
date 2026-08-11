import { h, render } from "../shared/dom.js";
import { messageForError } from "../shared/errorMessages.js";
import { CLASSIFICATION_LABELS } from "../shared/classificationLabels.js";
import { WEEKDAY_NAMES, formatDayTile, getWeekday } from "../shared/dates.js";
import { sortShortlist, summarizeShortlist } from "./shortlist.mapper.js";

// Presentation only, same contract as the Calendar UI: state in, DOM out.

// "1 day" / "3 days".
function pluralDays(count) {
  return `${count} day${count === 1 ? "" : "s"}`;
}

// The small date square. Near-identical to Calendar's, with one difference:
// the weekday is RECOMPUTED here, because a stored item has no weekday field.
function renderDayTile(dateString) {
  const { day, month } = formatDayTile(dateString);
  return h("time.day-tile", { datetime: dateString }, [
    h("span.day-tile-month", {}, month),
    h("span.day-tile-number", {}, day),
    h("span.day-tile-weekday", {}, WEEKDAY_NAMES[getWeekday(dateString)].slice(0, 3)),
  ]);
}

// The totals line: the shortlist turned into a decision.
function renderSummary(summary) {
  if (summary.count === 0) return null;
  return h(
    "p.shortlist-summary",
    {},
    `${pluralDays(summary.count)} shortlisted — ${summary.totalDaysOff} days off in total, using ${pluralDays(summary.totalLeaveDays)} of leave.`,
  );
}

// A leaner badge than the Calendar's: no leave note, since the summary above
// already covers the total.
function renderClassificationBadge(classification) {
  if (!classification) return null;
  return h(`span.badge.badge-${classification.classification}`, {}, [
    h("strong", {}, CLASSIFICATION_LABELS[classification.classification]),
    h("span.badge-detail", {}, `${classification.startDate} → ${classification.endDate} — ${classification.totalDaysOff} days off`),
  ]);
}

// One saved holiday.
function renderItem(item, handlers) {
  return h("li.shortlist-item", { dataset: { classification: item.classification?.classification ?? "none" } }, [
    renderDayTile(item.date),
    // Reuses the Calendar's .holiday-body / .holiday-heading classes so both
    // lists read as one visual system.
    h("div.holiday-body", {}, [
      h("div.holiday-heading", {}, [
        h("span.holiday-local-name", { dir: "auto" }, item.localName),
        item.localName !== item.name ? h("span.holiday-name", {}, `(${item.name})`) : null,
        // The shortlist can span countries, so each entry names its own.
        h("span.shortlist-country", {}, `— ${item.countryName}`),
      ].filter(Boolean)),
      renderClassificationBadge(item.classification),
      h("button.shortlist-remove", { type: "button", onclick: () => handlers.onRemove(item) }, "Remove"),
    ].filter(Boolean)),
  ]);
}

// The slice's single entry point.
export function renderShortlist(root, state, handlers) {
  const items = sortShortlist(state.shortlist);
  const children = [];

  // A storage failure goes ABOVE the list rather than replacing it — the
  // shortlist still works in memory for this session, and the message says so.
  if (state.shortlistStorageError) {
    children.push(
      h("p.status-error", { role: "alert" }, messageForError(
        state.shortlistStorageError.code,
        state.shortlistStorageError.context ?? {},
      )),
    );
  }

  if (items.length === 0) {
    // A plain placeholder — no error styling. An empty shortlist is normal.
    children.push(h("p.placeholder", {}, "Days you shortlist from the calendar will collect here."));
  } else {
    children.push(renderSummary(summarizeShortlist(items)));
    children.push(h("ul.shortlist-list", {}, items.map((item) => renderItem(item, handlers))));
  }

  // filter(Boolean) drops the null renderSummary can return.
  render(root, children.filter(Boolean));
}
