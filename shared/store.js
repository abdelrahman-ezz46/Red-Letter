// Compares two state objects one level deep — the store's change detector.
//
// Object.is (not ===) because Object.is(NaN, NaN) is true and
// Object.is(0, -0) is false, which is the correct identity test here.
//
// Note this compares objects and arrays by REFERENCE, not by contents. That
// is deliberate: it is instant regardless of list size, and it works because
// every update in this codebase builds a new array rather than mutating one.
function shallowEqual(a, b) {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => Object.is(a[key], b[key]));
}

// Creates one observable state container.
//
// This is the app's answer to a problem vertical slices don't solve on their
// own: the shortlist is written by Calendar and read/removed by Shortlist,
// and neither slice may import or touch the other. Both depend on this store
// instead, so data flows one way and the slices stay independent.
//
// A factory rather than a global singleton, so tests can create a clean one.
export function createStore(initialState = {}) {
  // Copied (so the caller can't mutate it afterwards) and frozen (so no slice
  // can write to state directly — every change must go through setState).
  let state = Object.freeze({ ...initialState });

  // A Set, so subscribing the same function twice can't register it twice.
  const listeners = new Set();

  // Returns the current state. Safe to hand out the real object rather than a
  // copy precisely because it is frozen.
  function getState() {
    return state;
  }

  // The single write path for the entire app.
  function setState(patch) {
    // Accepts either a plain object or an updater function (state) => partial.
    const partial = typeof patch === "function" ? patch(state) : patch;

    // SHALLOW MERGE — every key you don't mention is preserved. This is what
    // lets Calendar update its nine keys without knowing that Shortlist owns
    // the `shortlist` key.
    const next = Object.freeze({ ...state, ...partial });

    // Nothing actually changed, so notify nobody. A same-value setState is a
    // no-op, not a re-render.
    if (shallowEqual(state, next)) return state;

    const previous = state;
    state = next;

    for (const listener of listeners) {
      try {
        // Subscribers get both states so they can detect what specifically
        // changed (Shortlist uses this to decide whether to save to storage).
        listener(state, previous);
      } catch (error) {
        // One subscriber throwing must not starve the others.
        console.error("Store subscriber failed", error);
      }
    }

    return state;
  }

  // Registers a listener and returns a function that unsubscribes it.
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  // Only these three functions escape. There is no path to `state` from
  // outside except through them.
  return { getState, setState, subscribe };
}
