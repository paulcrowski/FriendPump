const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const gate = path.join(__dirname, "check-project-gates.js");

function fixture(t, source, extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gate-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "run.cjs"), source);
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: {
    test: `"${process.execPath}" run.cjs`, build: `"${process.execPath}" -e "require('fs').writeFileSync('built', 'yes')"`
  } }));
  return { root, env: { ...process.env, CHECK_PROJECT_ROOT: root, TMPDIR: root,
    CHECK_PROJECT_REQUIRE: "1", CHECK_PROJECT_REQUIRED_SCRIPTS: "test,build",
    CHECK_PROJECT_DRY_RUN: "0", ...extra } };
}
function run(f) {
  return spawnSync(process.execPath, [gate], { env: f.env, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
}
function log(t, output) {
  const match = output.match(/log: (.+\.log)/);
  assert.ok(match, "full log path must be reported");
  t.after(() => fs.rmSync(path.dirname(match[1]), { recursive: true, force: true }));
  assert.equal(fs.statSync(match[1]).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.dirname(match[1])).mode & 0o777, 0o700);
  return fs.readFileSync(match[1], "utf8");
}

test("large success stays quiet and preserves stdout/stderr on disk", t => {
  const f = fixture(t, "process.stdout.write('START\\n' + 'x'.repeat(2 ** 21)); process.stderr.write('WARNING-END\\n');");
  const r = run(f);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.length + r.stderr.length < 2048);
  assert.match(r.stdout, /test exit 0/);
  const saved = log(t, r.stdout);
  assert.match(saved, /START/);
  assert.match(saved, /WARNING-END/);
  assert.ok(saved.length > 2 ** 21);
  assert.equal(fs.existsSync(path.join(f.root, "built")), true);
});

test("failure keeps exit code, full log and tail; next gate never runs", t => {
  const f = fixture(t, "process.stdout.write('EARLY\\n' + 'x'.repeat(8192) + '\\nSTDOUT-END\\n'); process.stderr.write('STDERR-END\\n'); process.exitCode = 23;");
  const r = run(f);
  assert.equal(r.status, 23);
  assert.ok(r.stdout.length + r.stderr.length < 6000);
  assert.match(r.stderr, /STDOUT-END/);
  assert.match(r.stderr, /STDERR-END/);
  assert.match(log(t, r.stdout + r.stderr), /EARLY/);
  assert.equal(fs.existsSync(path.join(f.root, "built")), false);
});

test("dry-run and validation do not execute project scripts", t => {
  const f = fixture(t, "process.exit(23)", { CHECK_PROJECT_DRY_RUN: "1" });
  const r = run(f);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /DRY_RUN/);
  assert.doesNotMatch(r.stdout, /log:/);
  assert.equal(fs.readdirSync(f.root).some(name => name.startsWith("workflow-gates-")), false);
  f.env.CHECK_PROJECT_REQUIRED_SCRIPTS = "missing";
  assert.equal(run(f).status, 1);
  f.env.CHECK_PROJECT_REQUIRED_SCRIPTS = "test";
  fs.writeFileSync(path.join(f.root, "package.json"), JSON.stringify({ scripts: { test: "TODO" } }));
  assert.match(run(f).stderr, /cannot be placeholders/);
  assert.equal(fs.existsSync(path.join(f.root, "built")), false);
});

test("spawn error and signal are explicit failures", t => {
  const f = fixture(t, "", { PATH: "" });
  let r = run(f);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /ENOENT/);
  log(t, r.stdout + r.stderr);
  fs.writeFileSync(path.join(f.root, "npm"), "#!/bin/sh\nkill -TERM $$\n", { mode: 0o700 });
  f.env.PATH = f.root;
  r = run(f);
  assert.equal(r.status, 143);
  assert.match(r.stderr, /SIGTERM/);
  log(t, r.stdout + r.stderr);
  assert.equal(fs.existsSync(path.join(f.root, "built")), false);
});

test("no-app skips execution; log write failure stops before npm", t => {
  const f = fixture(t, "process.exit(23)", { CHECK_PROJECT_REQUIRE: "0" });
  const r = run(f);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /no app paths/);
  assert.doesNotMatch(r.stdout, /log:/);
  f.env.CHECK_PROJECT_REQUIRE = "1";
  f.env.TMPDIR = path.join(f.root, "missing");
  const failed = run(f);
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /ENOENT/);
  assert.doesNotMatch(failed.stdout, /PASS/);
  assert.equal(fs.existsSync(path.join(f.root, "built")), false);
});
