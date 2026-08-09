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

function reportBootFailure(missing) {
  document.documentElement.dataset.appReady = "false";
  const message = `Red Letter could not start: missing mount ${missing.join(", ")}`;
  console.error(message);
}

export function boot() {
  const { mounts, missing } = resolveMounts();

  if (missing.length > 0) {
    reportBootFailure(missing);
    return null;
  }

  const store = createStore({ shortlist: [] });

  initShortlistSlice(mounts.shortlist, store);
  initCalendarSlice(mounts.calendar, store);

  document.documentElement.dataset.appReady = "true";
  return { mounts, store };
}
