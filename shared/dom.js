// A tiny hand-rolled view layer — roughly the minimum both slices need, with
// no framework and no build step.

// querySelector, optionally scoped to a subtree.
export function qs(selector, root = document) {
  return root.querySelector(selector);
}

// Empties a node.
// Removes children one at a time rather than using innerHTML = "", which never
// invokes the HTML parser and so cannot become an injection route.
export function clear(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

// Records which element inside `node` has keyboard focus, and where its text
// cursor sits, so a full rebuild can put it back.
//
// Without this pair of functions the country filter would be unusable: every
// keystroke rebuilds the subtree, destroying the very input being typed into,
// so focus would fall to <body> and the second character would never arrive.
function captureFocus(node) {
  // Needs an id to be findable again, and must actually be inside the subtree
  // about to be replaced.
  const active = document.activeElement;
  if (!active || !active.id || !node.contains(active)) return null;

  // Feature-detects a text field. Checking selectionStart is safer than
  // checking the tag name — on some input types reading it would throw.
  const hasSelection = typeof active.selectionStart === "number";
  return {
    id: active.id,
    selectionStart: hasSelection ? active.selectionStart : null,
    selectionEnd: hasSelection ? active.selectionEnd : null,
  };
}

// Puts focus and cursor position back after a rebuild.
function restoreFocus(node, captured) {
  if (!captured) return;

  // CSS.escape so an id containing special characters can't break the selector.
  const next = node.querySelector(`#${CSS.escape(captured.id)}`);
  if (!next) return; // the element genuinely no longer exists — give up quietly

  next.focus();
  if (captured.selectionStart !== null && typeof next.setSelectionRange === "function") {
    next.setSelectionRange(captured.selectionStart, captured.selectionEnd);
  }
}

// The one and only way anything reaches the screen.
//
// There is no diffing and no patching in this app: every update wipes the
// container and rebuilds it. Simple, and impossible to get out of sync — but
// only survivable because of the focus capture/restore around it.
export function render(node, content) {
  const captured = captureFocus(node);

  clear(node);
  if (content instanceof Node) {
    node.appendChild(content);
  } else if (Array.isArray(content)) {
    for (const item of content) {
      // Silently skips non-nodes, which is what makes the
      // `condition ? h(...) : null` pattern work throughout both UI files.
      if (item instanceof Node) node.appendChild(item);
    }
  }

  restoreFocus(node, captured);
  return node;
}

// Builds one element. Every visible thing in the app comes from here.
//
//   h("li.holiday-card", { onclick: fn }, [childA, childB])
//
// The tag uses a shorthand: "span.badge.badge-free" means a <span> carrying
// those two classes.
export function h(tag, attrs = {}, children = []) {
  const [tagName, ...classTokens] = tag.split(".");
  const element = document.createElement(tagName || "div");

  if (classTokens.length > 0) {
    element.classList.add(...classTokens);
  }

  for (const [key, value] of Object.entries(attrs)) {
    // Skipping null/undefined is what makes `title: cond ? "..." : null` work
    // as a conditional attribute.
    if (value === null || value === undefined) continue;

    if (key === "class") {
      // Merges rather than replaces; filter(Boolean) drops empty tokens.
      element.classList.add(...value.split(" ").filter(Boolean));
    } else if (key.startsWith("on") && typeof value === "function") {
      // onclick -> "click". Wrapped so a throwing handler logs rather than
      // escaping into the browser's global error handling.
      element.addEventListener(key.slice(2).toLowerCase(), (event) => {
        try {
          value(event);
        } catch (error) {
          console.error(`Unhandled error in "${key}" handler`, error);
        }
      });
    } else if (key === "dataset") {
      Object.assign(element.dataset, value); // becomes data-* attributes
    } else if (key.startsWith("aria-") || key === "role") {
      // MUST come before the boolean branch below: aria-pressed="false" is
      // meaningful and has to be written out literally, or a screen reader
      // stops announcing the element as a toggle button.
      element.setAttribute(key, String(value));
    } else if (typeof value === "boolean") {
      // Ordinary HTML booleans work by presence: `disabled` present means
      // disabled, absent means enabled. There is no disabled="false".
      if (value) element.setAttribute(key, "");
    } else {
      element.setAttribute(key, String(value));
    }
  }

  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    // Supports the `condition ? h(...) : null` idiom. Note 0 and "" are NOT
    // skipped and would render.
    if (child === null || child === undefined || child === false) continue;
    // THE APP'S XSS BOUNDARY: anything that isn't already a node becomes a
    // TEXT node. Holiday names come from an external API, so a name containing
    // <script> renders as visible characters and can never execute.
    element.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return element;
}

// Attaches an event listener and returns a function that removes it again.
// Two forms: pass a handler to bind directly, or pass a selector plus a
// handler to bind one delegated listener on the container instead of one per
// child.
export function on(node, eventName, selectorOrHandler, maybeHandler) {
  if (typeof selectorOrHandler === "function") {
    node.addEventListener(eventName, selectorOrHandler);
    return () => node.removeEventListener(eventName, selectorOrHandler);
  }

  const selector = selectorOrHandler;
  const handler = maybeHandler;
  const delegated = (event) => {
    // closest() walks up from whatever was actually clicked to the matching
    // ancestor; contains() confirms it is still inside our subtree.
    const target = event.target.closest(selector);
    if (target && node.contains(target)) handler(event, target);
  };
  node.addEventListener(eventName, delegated);
  return () => node.removeEventListener(eventName, delegated);
}
