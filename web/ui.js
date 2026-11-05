// Minimalny helper DOM: h("div", { class: "card" }, "tekst", inny_węzeł).
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value);
  }
  el.append(...children.flat().filter((c) => c != null));
  return el;
}

export function show(root, ...nodes) {
  root.replaceChildren(...nodes);
}

export const message = (text) => h("p", { class: "message", role: "status" }, text);
