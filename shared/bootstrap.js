import { createStore } from "./store.js";
import { initCalendarSlice } from "../Calendar/calendar.Controller.js";
import { initShortlistSlice } from "../Shortlist/shortlist.Controller.js";

const MOUNT_IDS = {
  calendar: "calendar-root",
  shortlist: "shortlist-root",
};

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

function reportBootFailure(reason) {
  document.documentElement.dataset.appReady = "false";
  console.error(`Red Letter could not start: ${reason}`);
}

export function boot() {
  const { mounts, missing } = resolveMounts();

  if (missing.length > 0) {
    reportBootFailure(`missing mount ${missing.join(", ")}`);
    return null;
  }

  try {
    const store = createStore({ shortlist: [] });

    initShortlistSlice(mounts.shortlist, store);
    initCalendarSlice(mounts.calendar, store);

    document.documentElement.dataset.appReady = "true";
    return { mounts, store };
  } catch (error) {
    reportBootFailure(`unexpected error during startup (${error.message})`);
    return null;
  }
}
