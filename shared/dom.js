export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function clear(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

export function render(node, content) {
  clear(node);
  if (content instanceof Node) {
    node.appendChild(content);
  } else if (Array.isArray(content)) {
    for (const item of content) {
      if (item instanceof Node) node.appendChild(item);
    }
  }
  return node;
}

export function h(tag, attrs = {}, children = []) {
  const [tagName, ...classTokens] = tag.split(".");
  const element = document.createElement(tagName || "div");

  if (classTokens.length > 0) {
    element.classList.add(...classTokens);
  }

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) continue;

    if (key === "class") {
      element.classList.add(...value.split(" ").filter(Boolean));
    } else if (key.startsWith("on") && typeof value === "function") {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "dataset") {
      Object.assign(element.dataset, value);
    } else if (key.startsWith("aria-") || key === "role") {
      element.setAttribute(key, String(value));
    } else if (typeof value === "boolean") {
      if (value) element.setAttribute(key, "");
    } else {
      element.setAttribute(key, String(value));
    }
  }

  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    element.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return element;
}

export function on(node, eventName, selectorOrHandler, maybeHandler) {
  if (typeof selectorOrHandler === "function") {
    node.addEventListener(eventName, selectorOrHandler);
    return () => node.removeEventListener(eventName, selectorOrHandler);
  }

  const selector = selectorOrHandler;
  const handler = maybeHandler;
  const delegated = (event) => {
    const target = event.target.closest(selector);
    if (target && node.contains(target)) handler(event, target);
  };
  node.addEventListener(eventName, delegated);
  return () => node.removeEventListener(eventName, delegated);
}
