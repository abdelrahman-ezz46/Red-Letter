import { h, render } from "../shared/dom.js";
import { messageForError } from "../shared/errorMessages.js";
import { CLASSIFICATION_LABELS } from "../shared/classificationLabels.js";
import { WEEKDAY_NAMES, formatDayTile, isPastDate, todayISO } from "../shared/dates.js";

function formatDateRange(startDate, endDate) {
  return startDate === endDate ? startDate : `${startDate} → ${endDate}`;
}

function renderDayTile(dateString, weekday) {
  const { day, month } = formatDayTile(dateString);
  return h("time.day-tile", { datetime: dateString }, [
    h("span.day-tile-month", {}, month),
    h("span.day-tile-number", {}, day),
    h("span.day-tile-weekday", {}, WEEKDAY_NAMES[weekday].slice(0, 3)),
  ]);
}

function renderClassificationBadge(classification) {
  if (!classification) {
    return h("span.badge.badge-none", {}, "Not a public holiday — not counted toward leave");
  }

  const { classification: kind, startDate, endDate, totalDaysOff, leaveDaysUsed } = classification;
  const leaveNote = leaveDaysUsed > 0 ? `, ${leaveDaysUsed} leave day${leaveDaysUsed === 1 ? "" : "s"}` : ", no leave needed";

  return h(`span.badge.badge-${kind}`, {}, [
    h("strong", {}, CLASSIFICATION_LABELS[kind]),
    h("span.badge-detail", {}, `${formatDateRange(startDate, endDate)} — ${totalDaysOff} days off${leaveNote}`),
  ]);
}

function renderRegionNote(holiday) {
  if (holiday.isNationwide) return null;
  const regionList = holiday.regions && holiday.regions.length > 0
    ? holiday.regions.join(", ")
    : "no specific regions listed by the source";
  return h("p.holiday-regions", {}, `Not marked nationwide by the source — regions: ${regionList}`);
}

function renderShortlistToggle(holiday, isShortlisted, isPast, handlers) {
  const blocked = isPast && !isShortlisted;

  return h("button.shortlist-toggle", {
    type: "button",
    "aria-pressed": isShortlisted,
    disabled: blocked,
    title: blocked ? "This date has already passed" : null,
    onclick: () => handlers.onToggleShortlist(holiday),
  }, blocked ? "Date has passed" : isShortlisted ? "✓ Shortlisted" : "Add to shortlist");
}

function renderHolidayCard(holiday, isShortlisted, isPast, handlers) {
  return h("li.holiday-card", {
    dataset: {
      classification: holiday.classification?.classification ?? "none",
      past: String(isPast),
    },
  }, [
    renderDayTile(holiday.date, holiday.weekday),
    h("div.holiday-body", {}, [
      h("div.holiday-heading", {}, [
        h("span.holiday-local-name", { dir: "auto" }, holiday.localName),
        holiday.localName !== holiday.name ? h("span.holiday-name", {}, `(${holiday.name})`) : null,
      ].filter(Boolean)),
      !holiday.isPublic ? h("p.holiday-types", {}, `Type: ${holiday.types.join(", ")}`) : null,
      renderClassificationBadge(holiday.classification),
      renderRegionNote(holiday),
      renderShortlistToggle(holiday, isShortlisted, isPast, handlers),
    ].filter(Boolean)),
  ]);
}

function renderCountryPicker(state, handlers) {
  if (state.countriesStatus === "loading") {
    return h("div.country-picker", {}, h("p.status-loading", { role: "status" }, "Loading countries…"));
  }

  if (state.countriesStatus === "error") {
    return h("div.country-picker", {}, [
      h("p.status-error", { role: "alert" }, messageForError(state.countriesError.code, state.countriesError.context)),
      h("button", { type: "button", onclick: handlers.onRetryCountries }, "Retry"),
    ]);
  }

  if (state.countriesStatus === "empty") {
    return h("div.country-picker", {}, [
      h("p.status-empty", { role: "status" }, messageForError(state.countriesError.code, state.countriesError.context)),
      h("button", { type: "button", onclick: handlers.onRetryCountries }, "Retry"),
    ]);
  }

  const matches = state.filteredCountries.slice(0, 40);

  return h("div.country-picker", {}, [
    h("label", { for: "country-filter" }, "Country"),
    h("input", {
      id: "country-filter",
      type: "text",
      autocomplete: "off",
      placeholder: "Type to filter…",
      value: state.filterQuery,
      oninput: (event) => handlers.onFilterInput(event.target.value),
    }),
    h("p.filter-status", { role: "status" }, `${state.filteredCountries.length} of ${state.countries.length} countries${state.filterQuery ? ` match "${state.filterQuery}"` : ""}${state.filteredCountries.length > 40 ? " — showing first 40" : ""}`),
    h("ul.country-results", {}, matches.map((country) =>
      h("li", {}, h("button.country-option", {
        type: "button",
        "aria-pressed": country.countryCode === state.selectedCountryCode,
        onclick: () => handlers.onSelectCountry(country),
      }, `${country.name} (${country.countryCode})`)),
    )),
  ]);
}

function renderYearControls(state, handlers) {
  return h("div.year-controls", {}, [
    h("button", { type: "button", onclick: () => handlers.onChangeYear(-1) }, "← Previous year"),
    h("span.year-label", {}, `${state.selectedCountryName} — ${state.selectedYear}`),
    h("button", { type: "button", onclick: () => handlers.onChangeYear(1) }, "Next year →"),
  ]);
}

function renderHolidaysSection(state, handlers) {
  if (state.holidaysStatus === "loading") {
    return h("p.status-loading", { role: "status" }, "Loading holidays…");
  }

  if (state.holidaysStatus === "error") {
    return h("div.status-error-block", {}, [
      h("p.status-error", { role: "alert" }, messageForError(state.holidaysError.code, {
        ...state.holidaysError.context,
        countryName: state.selectedCountryName,
      })),
      h("button", { type: "button", onclick: handlers.onRetryHolidays }, "Retry"),
    ]);
  }

  if (state.holidaysStatus === "empty") {
    return h("p.status-empty", { role: "status" }, messageForError(state.holidaysError.code, {
      ...state.holidaysError.context,
      countryName: state.selectedCountryName,
    }));
  }

  if (state.holidaysStatus === "success") {
    const shortlistKeys = new Set(state.shortlist.map((item) => item.key));
    const today = todayISO();
    return h("ul.holiday-list", {}, state.holidays.map((holiday) =>
      renderHolidayCard(
        holiday,
        shortlistKeys.has(`${state.selectedCountryCode}:${holiday.date}`),
        isPastDate(holiday.date, today),
        handlers,
      ),
    ));
  }

  return null;
}

export function renderCalendar(root, state, handlers) {
  const children = [renderCountryPicker(state, handlers)];

  if (state.selectedCountryCode) {
    children.push(renderYearControls(state, handlers));
    children.push(renderHolidaysSection(state, handlers));
  }

  render(root, children);
}
