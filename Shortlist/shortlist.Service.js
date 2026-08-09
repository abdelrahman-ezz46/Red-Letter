import { Result, ErrorCode } from "../shared/result.js";
import { STORAGE_VERSION, isValidStoredPayload, isValidShortlistItem } from "./shortlist.validation.js";

const STORAGE_KEY = "redletter.shortlist.v1";

export function loadShortlist() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return Result.failure(ErrorCode.STORAGE, "Local storage is not available in this browser.");
  }

  if (raw === null) {
    return Result.success([]);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Result.success([]);
  }

  if (!isValidStoredPayload(payload)) {
    return Result.success([]);
  }

  return Result.success(payload.items.filter(isValidShortlistItem));
}

export function saveShortlist(items) {
  const payload = { version: STORAGE_VERSION, items };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return Result.success(null);
  } catch {
    return Result.failure(
      ErrorCode.STORAGE,
      "Couldn't save your shortlist to this browser.",
    );
  }
}
