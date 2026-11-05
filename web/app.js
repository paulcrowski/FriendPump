import { ERRORS, VERSION, createSecret, loadSecret, mutation, query } from "./lib.js";
import { h, message, show } from "./ui.js";

const root = document.getElementById("app");
const footer = document.getElementById("footer");
footer.textContent = `FriendPump web v${VERSION}`;

const errorText = (code) => ERRORS[code] || `Something went wrong (${code}).`;

function welcome() {
  const input = h("input", { placeholder: "Your name", maxlength: "30", autocomplete: "given-name" });
  const status = message("");
  const start = h("button", { class: "primary" }, "Get started");
  start.addEventListener("click", async () => {
    const name = input.value.trim();
    if (!name) return void (status.textContent = "Enter your name.");
    start.disabled = true;
    status.textContent = "Saving…";
    const secret = loadSecret() || createSecret();
    const res = await mutation("users:register", { secret, name });
    if (!res.ok) {
      start.disabled = false;
      status.textContent = errorText(res.error);
      return;
    }
    home(secret, res.value.name);
  });
  show(root, h("h1", { class: "hero" }, "FriendPump"), h("p", { class: "muted" }, "Daily habits are easier together"), input, start, status);
}

async function home(secret, name) {
  show(root, h("h1", {}, `Hi, ${name}!`), message("Loading circles…"));
  const res = await query("circles:list", { secret });
  if (!res.ok) {
    const retry = h("button", { class: "secondary", onclick: () => home(secret, name) }, "Try again");
    return show(root, h("h1", {}, `Hi, ${name}!`), message(errorText(res.error)), retry);
  }
  const cards = res.value.map((c) =>
    h("div", { class: "card" }, h("h2", {}, c.name), h("p", { class: "muted" }, `${c.memberCount} ${c.memberCount === 1 ? "person" : "people"} · ${c.activities.map((a) => a.emoji).join(" ")}`)),
  );
  show(root, h("h1", {}, `Hi, ${name}!`), cards.length ? cards : h("p", { class: "muted" }, "You don't have a circle yet."));
}

async function boot() {
  const secret = loadSecret();
  if (!secret) return welcome();
  const me = await query("users:me", { secret });
  if (me.ok) return home(secret, me.value.name);
  if (me.error === "NOT_REGISTERED") return welcome();
  show(root, message(errorText(me.error)), h("button", { class: "secondary", onclick: boot }, "Try again"));
}

boot();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
