import { h, render } from "../shared/dom.js";
import { messageForError } from "../shared/errorMessages.js";
import { CLASSIFICATION_LABELS } from "../shared/classificationLabels.js";
import { WEEKDAY_NAMES, formatDayTile, getWeekday } from "../shared/dates.js";
import { sortShortlist, summarizeShortlist } from "./shortlist.mapper.js";

function pluralDays(count) {
  return `${count} day${count === 1 ? "" : "s"}`;
}

function renderDayTile(dateString) {
  const { day, month } = formatDayTile(dateString);
  return h("time.day-tile", { datetime: dateString }, [
    h("span.day-tile-month", {}, month),
    h("span.day-tile-number", {}, day),
    h("span.day-tile-weekday", {}, WEEKDAY_NAMES[getWeekday(dateString)].slice(0, 3)),
  ]);
}

function renderSummary(summary) {
  if (summary.count === 0) return null;
  return h(
    "p.shortlist-summary",
    {},
    `${pluralDays(summary.count)} shortlisted — ${summary.totalDaysOff} days off in total, using ${pluralDays(summary.totalLeaveDays)} of leave.`,
  );
}

function renderClassificationBadge(classification) {
  if (!classification) return null;
  return h(`span.badge.badge-${classification.classification}`, {}, [
    h("strong", {}, CLASSIFICATION_LABELS[classification.classification]),
    h("span.badge-detail", {}, `${classification.startDate} → ${classification.endDate} — ${classification.totalDaysOff} days off`),
  ]);
}

function renderItem(item, handlers) {
  return h("li.shortlist-item", { dataset: { classification: item.classification?.classification ?? "none" } }, [
    renderDayTile(item.date),
    h("div.holiday-body", {}, [
      h("div.holiday-heading", {}, [
        h("span.holiday-local-name", { dir: "auto" }, item.localName),
        item.localName !== item.name ? h("span.holiday-name", {}, `(${item.name})`) : null,
        h("span.shortlist-country", {}, `— ${item.countryName}`),
      ].filter(Boolean)),
      renderClassificationBadge(item.classification),
      h("button.shortlist-remove", { type: "button", onclick: () => handlers.onRemove(item) }, "Remove"),
    ].filter(Boolean)),
  ]);
}

export function renderShortlist(root, state, handlers) {
  const items = sortShortlist(state.shortlist);
  const children = [];

  if (state.shortlistStorageError) {
    children.push(
      h("p.status-error", { role: "alert" }, messageForError(
        state.shortlistStorageError.code,
        state.shortlistStorageError.context ?? {},
      )),
    );
  }

  if (items.length === 0) {
    children.push(h("p.placeholder", {}, "Days you shortlist from the calendar will collect here."));
  } else {
    children.push(renderSummary(summarizeShortlist(items)));
    children.push(h("ul.shortlist-list", {}, items.map((item) => renderItem(item, handlers))));
  }

  render(root, children.filter(Boolean));
}
