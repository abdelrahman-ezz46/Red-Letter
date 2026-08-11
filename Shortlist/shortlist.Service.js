import { Result, ErrorCode } from "../shared/result.js";
import { STORAGE_VERSION, isValidStoredPayload, isValidShortlistItem } from "./shortlist.validation.js";

// Namespaced and version-suffixed, so it can never collide with another app's
// key on the same origin.
const STORAGE_KEY = "redletter.shortlist.v1";

// Restores the saved shortlist.
//
// The interesting part of this function is not the reading — it is the
// judgement about WHICH storage problems are worth reporting. Three of the
// five outcomes below recover silently.
export function loadShortlist() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Some browsers throw on merely TOUCHING localStorage (private browsing,
    // storage disabled). This is worth reporting: nothing will persist.
    return Result.failure(ErrorCode.STORAGE, "Local storage is not available in this browser.");
  }

  // Nothing saved yet. A first visit, not a failure.
  if (raw === null) {
    return Result.success([]);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Corrupted text. DELIBERATELY SILENT: the user didn't cause it and can't
    // act on it, so the app starts clean instead of showing a useless error.
    return Result.success([]);
  }

  // Wrong version or wrong shape — same silent clean start.
  if (!isValidStoredPayload(payload)) {
    return Result.success([]);
  }

  // One malformed entry doesn't discard an otherwise valid list.
  return Result.success(payload.items.filter(isValidShortlistItem));
}

// Writes the shortlist to storage.
export function saveShortlist(items) {
  // The version stamp is what makes a future format change survivable.
  const payload = { version: STORAGE_VERSION, items };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return Result.success(null);
  } catch {
    // Unlike loading, a failed SAVE is reported. The asymmetry is the point:
    // here the user just took an action that genuinely won't persist (quota
    // exceeded, private browsing), and they should know.
    return Result.failure(
      ErrorCode.STORAGE,
      "Couldn't save your shortlist to this browser.",
    );
  }
}
