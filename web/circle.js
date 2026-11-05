import { ERRORS, mutation, query } from "./lib.js";
import { h, message, show } from "./ui.js";

const REFRESH_MS = 15000;
let timer = null;

function localDay() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const unitLabel = (a) => (a.unit === "minutes" ? " min" : "");
const errorText = (code) => ERRORS[code] || `Something went wrong (${code}).`;

// Ekran kręgu: odświeża się sam co kilka sekund, dopóki jest otwarty (jak „na żywo” w aplikacji).
export function openCircle(root, secret, circle, back) {
  let tab = "today";
  const leave = () => { clearInterval(timer); back(); };

  async function render() {
    const day = localDay();
    const res = tab === "today" ? await query("checkins:today", { secret, circleId: circle.id, day }) : await query("checkins:week", { secret, circleId: circle.id, endDay: day });
    const tabs = h("div", { class: "tabs" }, ...["today", "week"].map((t) => h("button", { class: t === tab ? "tab on" : "tab", onclick: () => { tab = t; render(); } }, t === "today" ? "Today" : "Week")));
    const head = [h("button", { class: "link", onclick: leave }, "‹ Circles"), h("h1", {}, circle.name), tabs];
    if (!res.ok) return show(root, head, message(errorText(res.error)));
    show(root, head, tab === "today" ? todayView(res.value, day) : weekView(res.value));
  }

  async function act(path, args) {
    const res = await mutation(path, { secret, ...args });
    if (!res.ok) alert(errorText(res.error));
    render();
  }

  function todayView(data, day) {
    return data.activities.map((a) => {
      const done = data.members.filter((m) => a.totals.find((t) => t.userId === m.id).total >= a.dailyTarget).length;
      const rows = data.members.map((m) => {
        const total = a.totals.find((t) => t.userId === m.id).total;
        const pct = Math.min(100, Math.round((total / a.dailyTarget) * 100));
        const value = a.unit === "done" ? (total >= 1 ? "✓" : "not yet") : total >= a.dailyTarget ? `✓ ${total}` : `${total}/${a.dailyTarget}`;
        return h("div", { class: "member" }, h("div", { class: "avatar" }, m.name[0].toUpperCase()), h("div", { class: "grow" }, h("div", {}, m.isMe ? `${m.name} (you)` : m.name), a.unit === "done" ? null : h("div", { class: "bar" }, h("div", { class: pct >= 100 ? "fill ok" : "fill", style: `width:${pct}%` }))), h("div", { class: total >= a.dailyTarget ? "value ok" : "value" }, value));
      });
      const add = (value) => () => act("checkins:add", { activityId: a.id, day, value });
      const buttons = a.unit === "done" ? [h("button", { class: "primary", onclick: add(1) }, "Done ✓")] : [h("button", { class: "secondary", onclick: add(5) }, "+5"), h("button", { class: "secondary", onclick: add(10) }, "+10"), h("button", { class: "secondary", onclick: () => { const n = Number(prompt(`How many${unitLabel(a)}?`)); if (Number.isInteger(n) && n > 0) add(n)(); } }, "Other")];
      buttons.push(h("button", { class: "ghost", onclick: () => act("checkins:undoLast", { activityId: a.id, day }) }, "Undo"));
      return h("div", { class: "card" }, h("div", { class: "split" }, h("h2", {}, `${a.emoji} ${a.name}`), h("span", { class: "muted" }, `${done}/${data.members.length} done`)), h("p", { class: "muted" }, `Goal: ${a.dailyTarget}${unitLabel(a)} daily`), rows, h("div", { class: "actions" }, buttons));
    });
  }

  function weekView(data) {
    const names = data.days.map((d) => new Date(`${d}T12:00:00`).toLocaleDateString("en", { weekday: "short" }));
    const grid = data.members.map((m) => h("div", { class: "member" }, h("div", { class: "avatar" }, m.name[0].toUpperCase()), h("div", { class: "grow" }, h("div", {}, m.isMe ? `${m.name} (you)` : m.name), h("div", { class: "dots" }, m.days.map((d) => h("span", { class: d.of > 0 && d.done === d.of ? "dot ok" : "dot" }, d.of > 0 && d.done === d.of ? "✓" : String(d.done))))), h("div", { class: "value" }, m.streak > 0 ? `🔥 ${m.streak}` : "")));
    return [h("div", { class: "card" }, h("h2", {}, "Last 7 days"), h("p", { class: "muted" }, `Green ✓ = all activities done · ${names.join(" ")}`), grid)];
  }

  clearInterval(timer);
  timer = setInterval(() => { if (!document.hidden && !document.activeElement?.matches("input")) render(); }, REFRESH_MS);
  render();
}
