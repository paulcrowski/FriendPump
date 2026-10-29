/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const SECRET_A = "a".repeat(64);
const SECRET_B = "b".repeat(64);

function setup() {
  return convexTest(schema, modules);
}

async function codeOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  return "NO_ERROR";
}

describe("users", () => {
  it("register tworzy użytkownika, a me go zwraca", async () => {
    const t = setup();
    const created = await t.mutation(api.users.register, { secret: SECRET_A, name: "  Paul " });
    expect(created.name).toBe("Paul");
    const me = await t.query(api.users.me, { secret: SECRET_A });
    expect(me).toEqual({ id: created.id, name: "Paul" });
  });

  it("register jest idempotentny: ten sam sekret to ten sam użytkownik", async () => {
    const t = setup();
    const first = await t.mutation(api.users.register, { secret: SECRET_A, name: "Paul" });
    const second = await t.mutation(api.users.register, { secret: SECRET_A, name: "Paweł" });
    expect(second.id).toBe(first.id);
    const rows = await t.run((ctx) => ctx.db.query("users").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Paweł");
  });

  it("w bazie nie ma surowego sekretu", async () => {
    const t = setup();
    await t.mutation(api.users.register, { secret: SECRET_A, name: "Paul" });
    const rows = await t.run((ctx) => ctx.db.query("users").collect());
    expect(rows[0].secretHash).not.toBe(SECRET_A);
    expect(rows[0].secretHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("me z nieznanym sekretem to błąd NOT_REGISTERED", async () => {
    const t = setup();
    await t.mutation(api.users.register, { secret: SECRET_A, name: "Paul" });
    expect(await codeOf(t.query(api.users.me, { secret: SECRET_B }))).toBe("NOT_REGISTERED");
  });

  it("zły format sekretu to błąd BAD_SECRET", async () => {
    const t = setup();
    expect(await codeOf(t.mutation(api.users.register, { secret: "abc", name: "Paul" }))).toBe("BAD_SECRET");
    expect(await codeOf(t.query(api.users.me, { secret: "" }))).toBe("BAD_SECRET");
  });

  it("puste i zbyt długie imię to błąd BAD_NAME", async () => {
    const t = setup();
    expect(await codeOf(t.mutation(api.users.register, { secret: SECRET_A, name: "   " }))).toBe("BAD_NAME");
    expect(await codeOf(t.mutation(api.users.register, { secret: SECRET_A, name: "x".repeat(31) }))).toBe("BAD_NAME");
  });

  it("dwaj użytkownicy nie widzą swoich danych", async () => {
    const t = setup();
    await t.mutation(api.users.register, { secret: SECRET_A, name: "Ala" });
    await t.mutation(api.users.register, { secret: SECRET_B, name: "Bob" });
    expect((await t.query(api.users.me, { secret: SECRET_A })).name).toBe("Ala");
    expect((await t.query(api.users.me, { secret: SECRET_B })).name).toBe("Bob");
  });
});
