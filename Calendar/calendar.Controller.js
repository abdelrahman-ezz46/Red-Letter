import { currentYear, isPastDate } from "../shared/dates.js";
import { ErrorCode } from "../shared/result.js";
import { h } from "../shared/dom.js";
import { fetchAvailableCountries, fetchPublicHolidays } from "./calendar.Service.js";
import { mapCountries, mapHolidays, filterCountries } from "./calendar.mapper.js";
import { renderCalendar } from "./calendar.UI.js";

export function initCalendarSlice(root, store) {
  const body = h("div.slice-body");
  root.appendChild(body);

  let filterQuery = "";

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

  function buildViewState() {
    const state = store.getState();
    return { ...state, filterQuery, filteredCountries: filterCountries(state.countries, filterQuery) };
  }

  function paint() {
    try {
      renderCalendar(body, buildViewState(), handlers);
    } catch (error) {
      console.error("Calendar failed to render", error);
    }
  }

  async function loadCountries() {
    store.setState({ countriesStatus: "loading", countriesError: null });

    try {
      const result = await fetchAvailableCountries();

      if (result.isSuccess) {
        store.setState({ countries: mapCountries(result.data), countriesStatus: "success" });
      } else if (result.error.code === ErrorCode.NO_RESULTS) {
        store.setState({ countries: [], countriesStatus: "empty", countriesError: result.error });
      } else {
        store.setState({ countriesStatus: "error", countriesError: result.error });
      }
    } catch (error) {
      console.error("Unexpected error loading countries", error);
      store.setState({
        countriesStatus: "error",
        countriesError: { code: "UNEXPECTED", message: error.message, context: {} },
      });
    }
  }

  async function loadHolidays(countryCode, year) {
    store.setState({ holidaysStatus: "loading", holidaysError: null });

    try {
      const result = await fetchPublicHolidays(countryCode, year);

      const current = store.getState();
      if (current.selectedCountryCode !== countryCode || current.selectedYear !== year) {
        return;
      }

      if (result.isSuccess) {
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

  const handlers = {
    onFilterInput(value) {
      filterQuery = value;
      paint();
    },
    onSelectCountry(country) {
      store.setState({
        selectedCountryCode: country.countryCode,
        selectedCountryName: country.name,
      });
      loadHolidays(country.countryCode, store.getState().selectedYear);
    },
    onRetryCountries() {
      loadCountries();
    },
    onRetryHolidays() {
      const { selectedCountryCode, selectedYear } = store.getState();
      loadHolidays(selectedCountryCode, selectedYear);
    },
    onChangeYear(delta) {
      const { selectedCountryCode, selectedYear } = store.getState();
      const nextYear = selectedYear + delta;
      store.setState({ selectedYear: nextYear });
      loadHolidays(selectedCountryCode, nextYear);
    },
    onToggleShortlist(holiday) {
      const { selectedCountryCode, selectedCountryName, shortlist } = store.getState();
      const key = `${selectedCountryCode}:${holiday.date}`;
      const exists = shortlist.some((item) => item.key === key);

      if (exists) {
        store.setState({ shortlist: shortlist.filter((item) => item.key !== key) });
        return;
      }

      if (isPastDate(holiday.date)) return;

      store.setState({
        shortlist: [
          ...shortlist,
          {
            key,
            countryCode: selectedCountryCode,
            countryName: selectedCountryName,
            date: holiday.date,
            name: holiday.name,
            localName: holiday.localName,
            classification: holiday.classification,
            addedAt: new Date().toISOString(),
          },
        ],
      });
    },
  };

  store.subscribe(paint);
  paint();
  loadCountries();
}
