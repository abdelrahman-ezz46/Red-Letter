import { h } from "../shared/dom.js";
import { loadShortlist, saveShortlist } from "./shortlist.Service.js";
import { renderShortlist } from "./shortlist.UI.js";

// Orchestration for the Shortlist slice. It owns persistence; it does not own
// adding (that happens on a Calendar card), which is exactly why the store
// exists.
export function initShortlistSlice(root, store) {
  // Same pattern as Calendar: render into an inner container so the <h2>
  // already in the HTML survives every rebuild.
  const body = h("div.slice-body");
  root.appendChild(body);

  // Restore from storage BEFORE anything else, so a returning visitor sees
  // their shortlist fully drawn — badges, totals and all — before a single
  // network request leaves the browser. Possible only because each saved item
  // carries its own classification snapshot.
  const loadResult = loadShortlist();
  // No subscriber is registered yet, so this write notifies nobody. On failure
  // it keeps the empty array bootstrap seeded and records the error instead.
  store.setState({
    shortlist: loadResult.isSuccess ? loadResult.data : store.getState().shortlist,
    shortlistStorageError: loadResult.isSuccess ? null : loadResult.error,
  });

  // Redraws the panel, wrapped so a rendering bug logs instead of freezing
  // the page.
  function paint() {
    try {
      renderShortlist(body, store.getState(), handlers);
    } catch (error) {
      console.error("Shortlist failed to render", error);
    }
  }

  const handlers = {
    // The only handler this slice has — adding happens over in Calendar.
    onRemove(item) {
      const { shortlist } = store.getState();
      // A NEW array, so the store's reference comparison sees the change.
      store.setState({ shortlist: shortlist.filter((existing) => existing.key !== item.key) });
    },
  };

  // The slice's standing instruction, and the app's only automatic side
  // effect — this is why no code anywhere calls "save" explicitly.
  store.subscribe((next, previous) => {
    paint(); // always redraw

    // ...but only WRITE TO STORAGE when the shortlist itself actually changed.
    // Without this guard, every keystroke in Calendar's country filter would
    // trigger a JSON.stringify and a localStorage write.
    if (next.shortlist !== previous.shortlist) {
      const saveResult = saveShortlist(next.shortlist);
      if (!saveResult.isSuccess) {
        // A setState from INSIDE a notification loop. This terminates cleanly:
        // the second pass changes only the error key, leaving `shortlist`
        // reference-equal, so the guard above is false and it does not re-save.
        store.setState({ shortlistStorageError: saveResult.error });
      }
    }
  });

  paint();
}
