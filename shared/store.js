function shallowEqual(a, b) {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => Object.is(a[key], b[key]));
}

export function createStore(initialState = {}) {
  let state = Object.freeze({ ...initialState });
  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(patch) {
    const partial = typeof patch === "function" ? patch(state) : patch;
    const next = Object.freeze({ ...state, ...partial });

    if (shallowEqual(state, next)) return state;

    const previous = state;
    state = next;

    for (const listener of listeners) {
      try {
        listener(state, previous);
      } catch (error) {
        console.error("Store subscriber failed", error);
      }
    }

    return state;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { getState, setState, subscribe };
}
