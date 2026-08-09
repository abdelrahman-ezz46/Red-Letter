# Red Letter

A long-weekend planner. Pick a country, see this year's public holidays, and the app works out which ones land next to a weekend and are worth booking leave around. Shortlist the ones you want and keep them — a small, persistent plan, not a lookup table.

**Live app:** https://abdelrahman-ezz46.github.io/Red-Letter/

---

## What it does

- Pick a country from a filterable list of 200+ (typing narrows it — no 200-item raw `<select>`).
- See the year's public holidays, each classified by which weekday it falls on:
  - **Absorbed** — lands on the weekend, no benefit.
  - **Free long weekend** — lands on Monday or Friday, no leave needed.
  - **Bridge day** — lands on Tuesday or Thursday, one day of leave buys four days off.
  - **Midweek** — lands on Wednesday, two days of leave buys five days off.
- Shortlist the ones worth planning around. The shortlist persists in `localStorage` and survives a reload.
- Every network and storage failure renders a real, specific message — never a raw status code or a silent blank screen.

## Architecture: vertical slice, not N-tier

The codebase is organized by **feature**, not by **layer**. Each feature lives in one capitalized folder — `Calendar/`, `Shortlist/` — and each folder holds its own full stack:

```
Calendar/
  calendar.Controller.js   orchestrates: wires events, calls the service, updates the store
  calendar.Service.js      talks to the network, returns Result values
  calendar.mapper.js       pure transforms: raw API shape -> view model, classification
  calendar.validation.js   guards untrusted external data at the boundary
  calendar.UI.js           renders DOM from state, no logic beyond presentation
```

The alternative — classic N-tier, with `controllers/`, `services/`, `ui/`, `mappers/` as **top-level** folders — causes shotgun surgery on a frontend: one feature change (say, adding a "regional holiday" note to a holiday card) touches four distant directories at once, and those directories group together files that change for *different* reasons at *different* times. Vertical slices fix that: adding a feature touches one folder. The layers still exist inside each slice, so separation of concerns isn't lost — you get both.

### The problem pure vertical slices don't solve: cross-slice state

Slices are self-contained by design, but this app has a piece of state that isn't: the shortlist is **written** by `Calendar` (the "Add to shortlist" button lives on a holiday card) and **read and removed** by `Shortlist`. Neither slice may reach into the other's DOM or import the other's private internals — that would immediately undo the whole point of slicing by feature.

The fix is `shared/store.js` — a small observable store (`getState`, `setState`, `subscribe`, ~40 lines including immutability handling) that both slices depend on instead of on each other. Data flows one way:

```
DOM event (in Calendar's rendered UI)
  -> Calendar's controller handles it
    -> store.setState(...)
      -> store notifies every subscriber
        -> Shortlist's controller re-renders from the new state
```

`Calendar` never touches `Shortlist`'s DOM, and `Shortlist` never touches `Calendar`'s. Both only ever touch the store. State updates are shallow-merged and frozen (`Object.freeze`) after every write, and a subscriber is only notified when something actually changed — a same-value `setState` call is a no-op, not a re-render.

Not everything went into the shared store, though — the live text in the country-filter input is kept as local closure state inside `Calendar`'s own controller, since no other slice will ever need it. The store is for genuinely cross-slice concerns, not a dumping ground for every piece of UI state.

## The Result pattern

`shared/result.js` extends the usual "just throw or return null" approach into a typed value both branches of the code can act on:

```js
Result.success(data)                     // { isSuccess: true,  data, error: null }
Result.failure(code, message, context)   // { isSuccess: false, data: null, error: { code, message, context } }
```

Services **return codes**; only the UI layer (`*.UI.js`) decides the English wording, via `shared/errorMessages.js`. This is what makes "clear error messages to users" a structural property of the codebase rather than a pile of ad hoc `catch` blocks with hardcoded strings scattered through the app — every failure a service can produce has exactly one place where its wording is decided, and that place has access to context (the country name, the year) that the service layer doesn't need to know about.

## Safe fetch

`shared/safeFetch.js` wraps every network call in the app — there is no bare `fetch` anywhere else in the codebase. It:

- **Never throws.** Every code path returns a `Result`, success or failure.
- **Times out at 8 seconds**, via `AbortSignal.timeout(8000)`. Each retry attempt gets its own fresh signal — sharing one signal across a retry would make the retry silently give up instantly, since an already-fired abort signal stays fired.
- **Retries once, with backoff, and only on `429` and `5xx`.** A `404` or a malformed request retrying itself is never going to succeed differently the second time; a rate limit or a transient server error might.
- **Isolates JSON-parse failures as their own error**, distinct from a bad HTTP status — a `200` response with an unparseable body is a different failure mode from a `500`, and users deserve different, honest messages for each.
- **Treats `204 No Content` as a successful empty payload**, not a parse failure. This one is easy to get wrong: calling `.json()` on an empty body throws, and a naive implementation would report that as a parse error when the truth is "this request succeeded and there's nothing to show." Nager.Date's own `PublicHolidays` endpoint does exactly this for Antarctica — confirmed against the live API before writing the mapper, not assumed from memory.

## Error handling — the full catalog

| Code | Meaning | Retried by `safeFetch`? |
|---|---|---|
| `NETWORK` | The request couldn't be sent at all (offline, DNS, connection refused) | No |
| `TIMEOUT` | No response within 8 seconds | No |
| `HTTP_400` | The request itself was invalid (Nager.Date returns this for an out-of-range year, e.g. `1700` or `2200`) | No |
| `HTTP_404` | The country code isn't recognized by the service | No |
| `HTTP_429` | Rate limited | Yes, once |
| `HTTP_5XX` | Server-side failure | Yes, once |
| `PARSE` | The response body wasn't valid JSON | No |
| `NO_RESULTS` | The request **succeeded** but returned nothing — a valid answer, not an error | No |
| `STORAGE` | `localStorage` itself failed (private browsing, quota, disabled) | No |

Two of these — `HTTP_400` and `STORAGE` — go beyond the brief's stated minimum set (`NETWORK`, `TIMEOUT`, `HTTP_404`, `HTTP_429`, `HTTP_5XX`, `PARSE`, `NO_RESULTS`). Both cover a failure mode the app can genuinely hit:

- `HTTP_400` — Nager.Date returns `400`, not `404`, for a year outside its supported range. Without this code, stepping the year controls too far would either be silently swallowed or misreported.
- `STORAGE` — `localStorage.setItem`/`getItem` can throw (private browsing in some browsers, quota exceeded, storage disabled entirely). Without it, a failed shortlist save would look like it worked and then silently vanish on reload.

**`NO_RESULTS` is deliberately not styled or worded like an error.** A country with zero recorded public holidays for a given year is a legitimate answer from the API, not a failure — the UI renders it with calm, informational styling (`role="status"`, muted color) and copy that explicitly says so, and it has no retry button (there's nothing to retry). Every other code renders with `role="alert"` and a working retry button that re-runs the exact request that failed.

**Corrupted or incompatible data in `localStorage` is a special case.** `shortlist.validation.js` never trusts what it reads back: malformed JSON, a version mismatch, or any single malformed item in an otherwise-valid list is dropped silently and the app starts clean, rather than surfacing an error the user can't act on and didn't cause. `STORAGE` is only raised when the storage API itself throws — the one case where the user's actual action (adding or removing a shortlist item) genuinely won't persist, and they should know that.

## The API: Nager.Date

`https://date.nager.at/api/v3` — open, no API key, and (per the brief) a service not covered in training data, so every response shape here was verified against the live API rather than assumed.

- `GET /AvailableCountries` — powers the country picker.
- `GET /PublicHolidays/{year}/{countryCode}` — the whole year in one request. This is deliberate: there's no pagination and no per-holiday fan-out, so the complexity in this project sits in the state flow and error handling, not in request orchestration.
- `GET /CountryInfo/{countryCode}` — available but unused; nothing in the current feature set needed it.

Two things about the data that shaped the mapper and aren't obvious from the docs:

- **Regional holidays are inconsistently flagged.** A holiday's `global` field is `false` for both genuinely region-specific days (e.g. Germany's Epiphany, three states only) *and* for holidays that are `global: false` but list every constituent region of the country (the UK's New Year's Day lists all four home nations). The mapper never collapses `global` into a confident "this is regional" claim — when `global` is `false` it always shows the actual region codes from the API, rather than guessing.
- **Adjacency-based leave reduction only considers nationwide holidays.** The long-weekend classifier (`shared/dates.js`) reduces a bridge/midweek day's leave cost when an adjacent day is *also* a public holiday. Live testing against the UK's 2026 data caught a real bug here: January 2nd is a holiday only in Scotland, and an early version of the mapper let that zero out the leave cost for New Year's Day for every UK user, not just Scottish ones. Fixed by restricting the adjacency check to `global === true` holidays only — see `Calendar/calendar.mapper.js`.

## The long-weekend classifier

`shared/dates.js` is pure logic — no DOM, no network, fully unit-testable in isolation. All date math goes through `Date.UTC()` / `getUTCDay()` after manually splitting the `"YYYY-MM-DD"` string into integers; `new Date(dateString)` is never called directly anywhere in the module. That distinction matters: parsing a bare date string with the `Date` constructor treats it as UTC midnight, but a call to the non-UTC `.getDay()` reads it back in the *browser's local* timezone — for anyone west of UTC, that can silently shift the reported weekday back by a day. Verified directly: mathematically replicated what a New York (UTC−5) browser's `.getDay()` would compute for `2026-01-01` (wrongly returns Wednesday) against this module's UTC-safe `getWeekday()` (correctly returns Thursday, regardless of the environment's own timezone).

`classifyWeekday(weekday)` is the pure four-way rule from the brief, and it never changes based on adjacency — only the *range* a holiday produces does. `classifyHoliday(date, holidayDates)` builds that range: a base block sized by the classification's rule, then a zero-cost chain extension outward through any adjacent weekend day or other known holiday. This is what correctly handles two holidays falling next to each other, and what correctly rolls a bridge day over a year boundary (verified against a real case: December 31, 2026 is a Thursday, so its bridge day is January 1, 2027).

One judgment call: the brief specifies Wednesday costs "two days for five" without saying which two. This implementation bridges backward (Monday + Tuesday, connecting to the preceding weekend) for consistency with how Tuesday also bridges backward.

## About the AI feature

The original brief for this project specified an AI-generated note on each shortlisted holiday, via Claude called from a serverless function so the API key never reaches the browser. That feature was **deliberately dropped** during planning, for a hosting-compatibility reason rather than a technical limitation of the pattern itself: this project is hosted on GitHub Pages, which serves static files only and cannot run a serverless function. There is no way to keep a secret out of client-side code without *some* server-side component holding it, and adding one (Netlify, Vercel, or a small edge function elsewhere) was out of scope for how this project is hosted.

Rather than compromise on the "no secrets in client code, ever" constraint — the one hard rule in the original brief with no acceptable middle ground — the AI slice was cut entirely. The app is fully functional and useful without it: the whole value of "which holidays are worth planning around" comes from the deterministic weekday classifier, not from AI-generated commentary. If this project is ever moved to a host with serverless functions, the vertical-slice architecture means adding an `Insight/` slice back would touch one new folder and the store — it wouldn't require restructuring `Calendar` or `Shortlist`.

## Local setup

No build step, no bundler, no dependencies. This is plain ES modules loaded directly by the browser.

```bash
git clone <this-repo-url>
cd red-letter
```

ES modules must be served over `http://`, not opened directly as a `file://` URL (browsers block module imports from the filesystem). Any static file server works:

```bash
python3 -m http.server 4321
# or
npx serve .
```

Then open `http://localhost:4321`.

## Deploy

Fully static — no environment variables, no secrets, no server-side component required. Any static host works identically:

- **GitHub Pages** (used for the live link above) — Settings → Pages → deploy from the `main` branch, root directory. No build step, no configuration beyond that.
- **Netlify / Vercel** — connect the repo; build command is empty, publish directory is the repo root.

## Known limitations

- **No AI-generated notes.** Cut entirely — see [About the AI feature](#about-the-ai-feature) above.
- **Regional holidays are visible but not filterable.** The app shows every holiday the API returns for a country, including region-specific ones, with a note naming the regions — but there's no way to say "I'm specifically in Scotland" and have the app tailor its leave-cost math to that. The adjacency calculation deliberately stays conservative (nationwide-only) rather than guessing at the user's region.
- **No pagination or fan-out needed, but also no way to see multiple countries at once.** One country, one year, at a time — by design, matching the brief's intent to keep the complexity in state and error handling rather than request orchestration, but it does mean comparing two countries' holidays requires switching back and forth.
- **The shortlist doesn't sync across devices or browsers.** It's `localStorage`-only, per the brief's explicit "no backend, no auth" instruction — clearing browser data or switching devices loses it.
- **Nager.Date's data quality varies by country.** Some countries' `types` fields distinguish `Public` from `Bank`/`Observance`/etc.; others only ever report `Public`. Non-`Public` entries are shown but excluded from long-weekend classification, since they're not actually days off — but this depends on the source data being accurately typed, which isn't guaranteed for every country in the dataset.
- **Year navigation is a lightweight addition beyond the brief's literal scope** ("this year's public holidays"). It reuses the exact same fetch/classify pipeline with no added architecture, and defaults to the current year on load — but it wasn't explicitly requested, so it's called out here rather than left silent.
