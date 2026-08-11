import { h, render } from "../shared/dom.js";
import { messageForError } from "../shared/errorMessages.js";
import { CLASSIFICATION_LABELS } from "../shared/classificationLabels.js";
import { WEEKDAY_NAMES, formatDayTile, isPastDate, todayISO } from "../shared/dates.js";

// Presentation only. Every function here is pure: same state in, same elements
// out. Nothing reads the store, fetches anything, or decides anything — it
// receives state plus a `handlers` object and returns DOM.

// Collapses a one-day range to a single date instead of "X → X".
function formatDateRange(startDate, endDate) {
  return startDate === endDate ? startDate : `${startDate} → ${endDate}`;
}

// The small date square on the left of each card.
function renderDayTile(dateString, weekday) {
  const { day, month } = formatDayTile(dateString);
  // A real <time> element with a machine-readable datetime attribute.
  return h("time.day-tile", { datetime: dateString }, [
    h("span.day-tile-month", {}, month),
    h("span.day-tile-number", {}, day),
    h("span.day-tile-weekday", {}, WEEKDAY_NAMES[weekday].slice(0, 3)),
  ]);
}

// The coloured badge: the verdict plus the days-off maths in one line.
function renderClassificationBadge(classification) {
  // A non-public day has no classification — say so plainly rather than
  // pretending it scores zero.
  if (!classification) {
    return h("span.badge.badge-none", {}, "Not a public holiday — not counted toward leave");
  }

  // Renamed on destructure because the field shares its container's name.
  const { classification: kind, startDate, endDate, totalDaysOff, leaveDaysUsed } = classification;
  // Says "no leave needed" rather than the colder "0 leave days".
  const leaveNote = leaveDaysUsed > 0 ? `, ${leaveDaysUsed} leave day${leaveDaysUsed === 1 ? "" : "s"}` : ", no leave needed";

  // The template literal builds badge-free / badge-bridge / badge-midweek —
  // the class the CSS colours from.
  return h(`span.badge.badge-${kind}`, {}, [
    h("strong", {}, CLASSIFICATION_LABELS[kind]),
    h("span.badge-detail", {}, `${formatDateRange(startDate, endDate)} — ${totalDaysOff} days off${leaveNote}`),
  ]);
}

// For holidays the API doesn't mark as nationwide, names the regions given.
function renderRegionNote(holiday) {
  if (holiday.isNationwide) return null; // nothing to say

  const regionList = holiday.regions && holiday.regions.length > 0
    ? holiday.regions.join(", ")
    : "no specific regions listed by the source";
  // Wording attributes the claim to the API rather than asserting the day is
  // regional — some genuinely national holidays are flagged global: false.
  return h("p.holiday-regions", {}, `Not marked nationwide by the source — regions: ${regionList}`);
}

// The add/remove button — the control that writes into the shared store.
function renderShortlistToggle(holiday, isShortlisted, isPast, handlers) {
  // Blocked only if past AND not already saved, so an item shortlisted months
  // ago stays removable once its date passes.
  const blocked = isPast && !isShortlisted;

  return h("button.shortlist-toggle", {
    type: "button",
    // Gives it toggle-button semantics for screen readers — and the CSS styles
    // it from this same attribute, so appearance and announcement can't drift.
    "aria-pressed": isShortlisted,
    disabled: blocked,
    title: blocked ? "This date has already passed" : null,
    onclick: () => handlers.onToggleShortlist(holiday),
  }, blocked ? "Date has passed" : isShortlisted ? "✓ Shortlisted" : "Add to shortlist");
}

// One holiday card.
function renderHolidayCard(holiday, isShortlisted, isPast, handlers) {
  return h("li.holiday-card", {
    // These carry no behaviour. They exist purely so the CSS can colour the
    // card and fade past ones with no JavaScript involved.
    dataset: {
      classification: holiday.classification?.classification ?? "none",
      past: String(isPast),
    },
  }, [
    renderDayTile(holiday.date, holiday.weekday),
    h("div.holiday-body", {}, [
      h("div.holiday-heading", {}, [
        // dir="auto" lets the browser render Arabic and Hebrew names RTL.
        h("span.holiday-local-name", { dir: "auto" }, holiday.localName),
        // No point showing "Christmas Day (Christmas Day)".
        holiday.localName !== holiday.name ? h("span.holiday-name", {}, `(${holiday.name})`) : null,
      ].filter(Boolean)),
      // Only shown for non-public days, to explain why they aren't classified.
      !holiday.isPublic ? h("p.holiday-types", {}, `Type: ${holiday.types.join(", ")}`) : null,
      renderClassificationBadge(holiday.classification),
      renderRegionNote(holiday),
      renderShortlistToggle(holiday, isShortlisted, isPast, handlers),
    ].filter(Boolean)),
  ]);
}

// The country search box, plus the three states it can be in instead.
function renderCountryPicker(state, handlers) {
  if (state.countriesStatus === "loading") {
    // role="status" waits politely for a screen reader to finish speaking.
    return h("div.country-picker", {}, h("p.status-loading", { role: "status" }, "Loading countries…"));
  }

  if (state.countriesStatus === "error") {
    return h("div.country-picker", {}, [
      // role="alert" interrupts — appropriate for a genuine failure.
      h("p.status-error", { role: "alert" }, messageForError(state.countriesError.code, state.countriesError.context)),
      h("button", { type: "button", onclick: handlers.onRetryCountries }, "Retry"),
    ]);
  }

  if (state.countriesStatus === "empty") {
    // Same layout as the error branch, but role="status" and .status-empty:
    // an empty answer is a real answer, so it is announced and styled calmly.
    return h("div.country-picker", {}, [
      h("p.status-empty", { role: "status" }, messageForError(state.countriesError.code, state.countriesError.context)),
      h("button", { type: "button", onclick: handlers.onRetryCountries }, "Retry"),
    ]);
  }

  // Cap the rendered list. With 200+ countries, rebuilding every one on every
  // keystroke is the difference between a smooth filter and a janky one.
  const matches = state.filteredCountries.slice(0, 40);

  return h("div.country-picker", {}, [
    h("label", { for: "country-filter" }, "Country"),
    h("input", {
      id: "country-filter", // the id captureFocus/restoreFocus rely on
      type: "text",
      autocomplete: "off",
      placeholder: "Type to filter…",
      // Controlled input: the value comes from state, which together with the
      // focus restoration in dom.js is what makes typing survive the rebuild.
      value: state.filterQuery,
      oninput: (event) => handlers.onFilterInput(event.target.value),
    }),
    // Live count, announced politely as you type.
    h("p.filter-status", { role: "status" }, `${state.filteredCountries.length} of ${state.countries.length} countries${state.filterQuery ? ` match "${state.filterQuery}"` : ""}${state.filteredCountries.length > 40 ? " — showing first 40" : ""}`),
    // Real <button>s, so keyboard and screen-reader support come free.
    h("ul.country-results", {}, matches.map((country) =>
      h("li", {}, h("button.country-option", {
        type: "button",
        "aria-pressed": country.countryCode === state.selectedCountryCode,
        onclick: () => handlers.onSelectCountry(country),
      }, `${country.name} (${country.countryCode})`)),
    )),
  ]);
}

// Previous/next year buttons with the current selection between them.
function renderYearControls(state, handlers) {
  return h("div.year-controls", {}, [
    h("button", { type: "button", onclick: () => handlers.onChangeYear(-1) }, "← Previous year"),
    h("span.year-label", {}, `${state.selectedCountryName} — ${state.selectedYear}`),
    h("button", { type: "button", onclick: () => handlers.onChangeYear(1) }, "Next year →"),
  ]);
}

// The holiday list and the four states it can be in.
function renderHolidaysSection(state, handlers) {
  if (state.holidaysStatus === "loading") {
    return h("p.status-loading", { role: "status" }, "Loading holidays…");
  }

  if (state.holidaysStatus === "error") {
    return h("div.status-error-block", {}, [
      h("p.status-error", { role: "alert" }, messageForError(state.holidaysError.code, {
        // Spread the service's context, then add the country name — this is how
        // the message layer can name the country even though the service, which
        // only ever saw a country CODE, never knew it.
        ...state.holidaysError.context,
        countryName: state.selectedCountryName,
      })),
      h("button", { type: "button", onclick: handlers.onRetryHolidays }, "Retry"),
    ]);
  }

  if (state.holidaysStatus === "empty") {
    // Deliberately NO retry button: there is nothing to retry. The request
    // succeeded; the honest answer is that there are no holidays.
    return h("p.status-empty", { role: "status" }, messageForError(state.holidaysError.code, {
      ...state.holidaysError.context,
      countryName: state.selectedCountryName,
    }));
  }

  if (state.holidaysStatus === "success") {
    // Built once for the whole list. The alternative — .some() inside the loop
    // — would be O(n x m).
    const shortlistKeys = new Set(state.shortlist.map((item) => item.key));
    const today = todayISO(); // computed once, reused for every card
    return h("ul.holiday-list", {}, state.holidays.map((holiday) =>
      renderHolidayCard(
        holiday,
        // Key format must stay in sync with the controller's onToggleShortlist.
        shortlistKeys.has(`${state.selectedCountryCode}:${holiday.date}`),
        isPastDate(holiday.date, today),
        handlers,
      ),
    ));
  }

  return null; // "idle" — no country chosen yet, so nothing to show
}

// The slice's single entry point: state in, rendered panel out.
export function renderCalendar(root, state, handlers) {
  const children = [renderCountryPicker(state, handlers)];

  // The year controls and holiday list only exist once a country is chosen,
  // which is why the page starts as just a search box and grows.
  if (state.selectedCountryCode) {
    children.push(renderYearControls(state, handlers));
    children.push(renderHolidaysSection(state, handlers)); // may be null; render skips it
  }

  // One render call means one DOM swap per paint.
  render(root, children);
}
