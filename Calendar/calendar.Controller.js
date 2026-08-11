import { currentYear, isPastDate } from "../shared/dates.js";
import { ErrorCode } from "../shared/result.js";
import { h } from "../shared/dom.js";
import { fetchAvailableCountries, fetchPublicHolidays } from "./calendar.Service.js";
import { mapCountries, mapHolidays, filterCountries } from "./calendar.mapper.js";
import { renderCalendar } from "./calendar.UI.js";

// Orchestration for the Calendar slice: wires events, calls the service,
// writes to the store. Everything below lives inside this function and shares
// its private variables.
export function initCalendarSlice(root, store) {
  // Renders into an inner container appended AFTER the <h2> already in the
  // HTML, so the heading survives every rebuild.
  const body = h("div.slice-body");
  root.appendChild(body);

  // LOCAL closure state, deliberately NOT in the shared store. The filter text
  // is Calendar's business alone; putting it on the store would make Shortlist
  // re-render on every keystroke for no reason. The store is for genuinely
  // cross-slice concerns, not a dumping ground for all UI state.
  let filterQuery = "";

  // The slice's starting state. Note the asymmetry: countries are "loading"
  // (a request fires below) but holidays are "idle" (nothing to fetch until a
  // country is picked). Nothing here mentions `shortlist`, so the shallow
  // merge leaves Shortlist's restored data untouched.
  store.setState({
    countries: [],
    countriesStatus: "loading",
    countriesError: null,
    selectedCountryCode: null,
    selectedCountryName: null,
    selectedYear: currentYear(),
    holidays: [],
    holidaysStatus: "idle",
    holidaysError: null,
  });

  // Assembles what the UI needs: store state plus the local filter text and
  // the derived match list. Filtering happens HERE at render time, so no
  // derived data is ever stored and nothing derived can go stale.
  function buildViewState() {
    const state = store.getState();
    return { ...state, filterQuery, filteredCountries: filterCountries(state.countries, filterQuery) };
  }

  // Redraws the panel. Wrapped so a rendering bug logs rather than killing the
  // store subscriber and freezing the whole page.
  function paint() {
    try {
      renderCalendar(body, buildViewState(), handlers);
    } catch (error) {
      console.error("Calendar failed to render", error);
    }
  }

  // Loads the country list. Runs at startup and again on Retry.
  async function loadCountries() {
    // On the first call these are already the seeded values, so shallowEqual
    // makes this a silent no-op rather than a wasted repaint.
    store.setState({ countriesStatus: "loading", countriesError: null });

    try {
      const result = await fetchAvailableCountries();

      if (result.isSuccess) {
        store.setState({ countries: mapCountries(result.data), countriesStatus: "success" });
      } else if (result.error.code === ErrorCode.NO_RESULTS) {
        // "empty" is kept separate from "error" — the UI styles and announces
        // the two differently. The error object is retained so the UI can
        // still get its wording from it.
        store.setState({ countries: [], countriesStatus: "empty", countriesError: result.error });
      } else {
        store.setState({ countriesStatus: "error", countriesError: result.error });
      }
    } catch (error) {
      // Neither safeFetch nor the mapper is expected to throw; this is the
      // last-resort net. The synthetic code has no message builder, so the UI
      // falls back to the generic wording.
      console.error("Unexpected error loading countries", error);
      store.setState({
        countriesStatus: "error",
        countriesError: { code: "UNEXPECTED", message: error.message, context: {} },
      });
    }
  }

  // Loads and classifies one country-year of holidays.
  async function loadHolidays(countryCode, year) {
    store.setState({ holidaysStatus: "loading", holidaysError: null });

    try {
      const result = await fetchPublicHolidays(countryCode, year);

      // THE STALE-RESPONSE GUARD — the most important check in this file.
      //
      // Responses do not arrive in the order they were sent. Click Germany
      // then France, and Germany's slower answer could land last and overwrite
      // France's. So after awaiting, re-read the store: if the user has moved
      // on, discard this answer entirely.
      //
      // Returning early deliberately leaves holidaysStatus as "loading" — the
      // newer request that superseded this one owns that flag and will resolve
      // it.
      const current = store.getState();
      if (current.selectedCountryCode !== countryCode || current.selectedYear !== year) {
        return;
      }

      if (result.isSuccess) {
        // holidaysError is explicitly re-nulled so a previous failure can't linger.
        store.setState({ holidays: mapHolidays(result.data), holidaysStatus: "success", holidaysError: null });
      } else if (result.error.code === ErrorCode.NO_RESULTS) {
        store.setState({ holidays: [], holidaysStatus: "empty", holidaysError: result.error });
      } else {
        store.setState({ holidaysStatus: "error", holidaysError: result.error });
      }
    } catch (error) {
      console.error("Unexpected error loading holidays", error);
      store.setState({
        holidaysStatus: "error",
        holidaysError: { code: "UNEXPECTED", message: error.message, context: {} },
      });
    }
  }

  // Everything the UI is allowed to do, passed down to it as callbacks. The UI
  // never touches the store or the service directly.
  const handlers = {
    // Live filtering. Updates the local variable and repaints DIRECTLY — the
    // one path in the app that deliberately bypasses the store, so the
    // Shortlist panel never hears about a keystroke.
    onFilterInput(value) {
      filterQuery = value;
      paint();
    },

    // Records the chosen country, then fetches its holidays.
    onSelectCountry(country) {
      store.setState({
        selectedCountryCode: country.countryCode,
        selectedCountryName: country.name,
      });
      // Year read freshly from the store rather than from a stale local copy.
      loadHolidays(country.countryCode, store.getState().selectedYear);
    },

    // Re-runs the country request after a failure.
    onRetryCountries() {
      loadCountries();
    },

    // Re-runs the holiday request. Re-reads country and year from the store so
    // it always retries the request the user is CURRENTLY looking at.
    onRetryHolidays() {
      const { selectedCountryCode, selectedYear } = store.getState();
      loadHolidays(selectedCountryCode, selectedYear);
    },

    // Steps the year by +1 or -1 and reloads.
    onChangeYear(delta) {
      const { selectedCountryCode, selectedYear } = store.getState();
      const nextYear = selectedYear + delta;
      // Storing BEFORE the fetch is what lets the stale guard above reject any
      // in-flight response for the old year.
      store.setState({ selectedYear: nextYear });
      loadHolidays(selectedCountryCode, nextYear);
      // No clamping here: an out-of-range year comes back as HTTP_400, which
      // the message layer turns into "Try a different year."
    },

    // THE CROSS-SLICE WRITE — the architectural payoff.
    //
    // A button rendered by Calendar changes data that Shortlist owns, and
    // neither slice references the other. Both only ever touch the store.
    onToggleShortlist(holiday) {
      const { selectedCountryCode, selectedCountryName, shortlist } = store.getState();
      // Country-scoped, so the same date in two countries stays two entries.
      const key = `${selectedCountryCode}:${holiday.date}`;
      const exists = shortlist.some((item) => item.key === key);

      if (exists) {
        // .filter produces a NEW array, which is what makes the store's
        // reference comparison detect the change.
        store.setState({ shortlist: shortlist.filter((item) => item.key !== key) });
        return;
      }

      // Placed AFTER the removal branch on purpose: removing an old date is
      // always allowed, only ADDING a past one is blocked. The UI disables the
      // button too — this is the second line of defence.
      if (isPastDate(holiday.date)) return;

      store.setState({
        shortlist: [
          // Spread into a new array rather than .push, for the same reason as
          // above: a mutated array would be reference-equal and the store
          // would detect nothing.
          ...shortlist,
          {
            key,
            countryCode: selectedCountryCode,
            countryName: selectedCountryName,
            date: holiday.date,
            name: holiday.name,
            localName: holiday.localName,
            // A full COPY of the maths, not a link to it. This is why the
            // shortlist can render complete on a later visit with no network.
            classification: holiday.classification,
            addedAt: new Date().toISOString(),
          },
        ],
      });
    },
  };

  // Watch the store. This is also how a removal in the Shortlist panel
  // repaints this panel's toggle buttons.
  store.subscribe(paint);
  paint(); // draw immediately, so "Loading countries…" appears before the request
  loadCountries();
}
