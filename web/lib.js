export const VERSION = "0.2.0";
const BASE_URL = "https://silent-porpoise-665.convex.cloud";
const KEY = "friendpump.secret";
const SECRET_FORMAT = /^[0-9a-f]{64}$/;

export function loadSecret() {
  try {
    const saved = localStorage.getItem(KEY);
    return SECRET_FORMAT.test(saved || "") ? saved : null;
  } catch {
    return null;
  }
}

// Sekret to „konto”: 32 losowe bajty jako 64 znaki hex, tak samo jak w aplikacji na Androida.
export function createSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const secret = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  localStorage.setItem(KEY, secret);
  return secret;
}

// Wynik zawsze jawny: { ok: true, value } albo { ok: false, error: kod }.
async function call(kind, path, args) {
  try {
    const res = await fetch(`${BASE_URL}/api/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, args, format: "json" }),
    });
    const json = await res.json();
    if (json.status === "success") return { ok: true, value: json.value };
    return { ok: false, error: json.errorData?.code || "SERVER_ERROR" };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}

export const query = (path, args) => call("query", path, args);
export const mutation = (path, args) => call("mutation", path, args);

export const ERRORS = {
  NETWORK: "Can't reach the server. Check your connection.",
  BAD_NAME: "Your name must be 1 to 30 characters.",
  NOT_REGISTERED: "Your account was not found. Reload the page.",
};
