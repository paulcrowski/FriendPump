import { ERRORS, mutation } from "./lib.js";
import { h, show } from "./ui.js";

// Te same gotowe czynności co w aplikacji na Androida; cel dzienny można zmienić przed utworzeniem kręgu.
const PRESETS = [
  { emoji: "💪", name: "Push-ups", unit: "count", target: 20, label: "times" },
  { emoji: "🧗", name: "Pull-ups", unit: "count", target: 10, label: "times" },
  { emoji: "🧘", name: "Meditation", unit: "minutes", target: 10, label: "min" },
  { emoji: "🧶", name: "Knitting", unit: "done" },
  { emoji: "🏃", name: "Running", unit: "minutes", target: 30, label: "min" },
  { emoji: "📖", name: "Reading", unit: "minutes", target: 20, label: "min" },
  { emoji: "💧", name: "Water (glasses)", unit: "count", target: 8, label: "glasses" },
  { emoji: "🥗", name: "Healthy lunch", unit: "done" },
];

const errorText = (code) => ERRORS[code] || `Couldn't save (${code}).`;

function presetRow(preset) {
  const check = h("input", { type: "checkbox", id: `p-${preset.name}` });
  const target = preset.unit === "done" ? null : h("input", { type: "number", min: "1", max: "1000", value: String(preset.target), class: "target" });
  const row = h("label", { class: "card row" }, check, h("span", {}, `${preset.emoji} ${preset.name}`), target, preset.label ? h("span", { class: "muted" }, preset.label) : null);
  return { row, picked: () => (check.checked ? { name: preset.name, emoji: preset.emoji, unit: preset.unit, dailyTarget: target ? Number(target.value) : 1 } : null) };
}

export function createForm(root, secret, back) {
  const name = h("input", { placeholder: "Name, e.g. Workouts", maxlength: "30" });
  const status = h("p", { class: "message", role: "status" }, "");
  const rows = PRESETS.map(presetRow);
  const save = h("button", { class: "primary" }, "Create circle");
  save.addEventListener("click", async () => {
    const activities = rows.map((r) => r.picked()).filter(Boolean);
    if (!name.value.trim()) return void (status.textContent = "Enter a circle name.");
    if (!activities.length) return void (status.textContent = "Pick at least one activity.");
    save.disabled = true;
    status.textContent = "Saving…";
    const res = await mutation("circles:create", { secret, name: name.value.trim(), activities });
    if (res.ok) return back();
    save.disabled = false;
    status.textContent = errorText(res.error);
  });
  show(root, h("h1", {}, "New circle"), name, h("p", { class: "muted" }, "What do you do together? Pick and set a daily goal."), rows.map((r) => r.row), status, save, h("button", { class: "secondary", onclick: back }, "Cancel"));
}

export function joinForm(root, secret, back) {
  const code = h("input", { placeholder: "e.g. 2TNB-YY3T", autocapitalize: "characters", autocomplete: "off" });
  const status = h("p", { class: "message", role: "status" }, "");
  const join = h("button", { class: "primary" }, "Join");
  join.addEventListener("click", async () => {
    if (!code.value.trim()) return void (status.textContent = "Enter a code.");
    join.disabled = true;
    status.textContent = "Joining…";
    const res = await mutation("circles:join", { secret, code: code.value });
    if (res.ok) return back();
    join.disabled = false;
    const known = { BAD_CODE: "The code has 8 characters, e.g. 2TNB-YY3T.", CIRCLE_NOT_FOUND: "No such circle. Check the code.", CIRCLE_FULL: "This circle is full." };
    status.textContent = known[res.error] || errorText(res.error);
  });
  show(root, h("h1", {}, "Join a circle"), h("p", { class: "muted" }, "Paste the code from a friend."), code, status, join, h("button", { class: "secondary", onclick: back }, "Cancel"));
}
