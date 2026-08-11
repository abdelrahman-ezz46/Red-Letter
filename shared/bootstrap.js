import { createStore } from "./store.js";
import { initCalendarSlice } from "../Calendar/calendar.Controller.js";
import { initShortlistSlice } from "../Shortlist/shortlist.Controller.js";

// The written-down agreement between index.html and the JavaScript about what
// the two mount points are called.
const MOUNT_IDS = {
  calendar: "calendar-root",
  shortlist: "shortlist-root",
};

// Looks up both mount elements, returning what was found and what was missing.
// Returns both rather than throwing, so the caller decides what failure means.
function resolveMounts() {
  const mounts = {};
  const missing = [];

  for (const [slice, id] of Object.entries(MOUNT_IDS)) {
    const element = document.getElementById(id);
    if (element) {
      mounts[slice] = element;
    } else {
      missing.push(id);
    }
  }

  return { mounts, missing };
}

// The single, honest way the app admits it could not start.
// The data attribute is a hook CSS or an end-to-end test can assert on.
function reportBootFailure(reason) {
  document.documentElement.dataset.appReady = "false";
  console.error(`Red Letter could not start: ${reason}`);
}

// Starts the app. The ONLY place in the codebase that knows both slices
// exist — which is precisely what keeps Calendar and Shortlist ignorant of
// each other.
export function boot() {
  const { mounts, missing } = resolveMounts();

  // Fail fast rather than starting half an app, and name exactly what's absent.
  if (missing.length > 0) {
    reportBootFailure(`missing mount ${missing.join(", ")}`);
    return null;
  }

  try {
    // One store, shared by both slices. `shortlist` is seeded here because it
    // is the only genuinely cross-slice key.
    const store = createStore({ shortlist: [] });

    // ORDER MATTERS: Shortlist runs first because it restores saved data into
    // the store. Calendar's own setState is a shallow merge that never
    // mentions `shortlist`, so the restored array survives untouched.
    initShortlistSlice(mounts.shortlist, store);
    initCalendarSlice(mounts.calendar, store);

    // Set while the countries request is still in flight — correct, because
    // the app IS ready even though the data isn't.
    document.documentElement.dataset.appReady = "true";
    return { mounts, store };
  } catch (error) {
    reportBootFailure(`unexpected error during startup (${error.message})`);
    return null;
  }
}
