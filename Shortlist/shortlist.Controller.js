import { h } from "../shared/dom.js";
import { loadShortlist, saveShortlist } from "./shortlist.Service.js";
import { renderShortlist } from "./shortlist.UI.js";

export function initShortlistSlice(root, store) {
  const body = h("div.slice-body");
  root.appendChild(body);

  const loadResult = loadShortlist();
  store.setState({
    shortlist: loadResult.isSuccess ? loadResult.data : store.getState().shortlist,
    shortlistStorageError: loadResult.isSuccess ? null : loadResult.error,
  });

  function paint() {
    renderShortlist(body, store.getState(), handlers);
  }

  const handlers = {
    onRemove(item) {
      const { shortlist } = store.getState();
      store.setState({ shortlist: shortlist.filter((existing) => existing.key !== item.key) });
    },
  };

  store.subscribe((next, previous) => {
    paint();

    if (next.shortlist !== previous.shortlist) {
      const saveResult = saveShortlist(next.shortlist);
      if (!saveResult.isSuccess) {
        store.setState({ shortlistStorageError: saveResult.error });
      }
    }
  });

  paint();
}
