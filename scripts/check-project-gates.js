const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const root = path.resolve(process.env.CHECK_PROJECT_ROOT || ".");
const packageFile = path.resolve(process.env.CHECK_PROJECT_PACKAGE_FILE || path.join(root, "package.json"));
const requiredScripts = list(process.env.CHECK_PROJECT_REQUIRED_SCRIPTS || "lint,typecheck,test,build");
const appPaths = list(process.env.CHECK_PROJECT_APP_PATHS || "src,app,pages,components,lib,server,tests");
const forceRequired = process.env.CHECK_PROJECT_REQUIRE === "1";
const dryRun = process.env.CHECK_PROJECT_DRY_RUN === "1";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function list(value) {
  return value.split(",").map(item => item.trim()).filter(Boolean);
}

if (!fs.existsSync(packageFile)) {
  fail(`Missing package.json: ${packageFile}`);
}

const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8"));
const scripts = pkg.scripts || {};
const detectedAppPaths = appPaths.filter(item => fs.existsSync(path.join(root, item)));
const requiresProjectGates = forceRequired || detectedAppPaths.length > 0;

if (!requiresProjectGates) {
  console.log("check:project-gates PASS - no app paths detected");
  process.exit(0);
}

const missing = requiredScripts.filter(name => !scripts[name]);
if (missing.length) {
  fail(`Missing required project scripts: ${missing.join(", ")}. Add real lint/typecheck/test/build gates.`);
}

const placeholders = requiredScripts.filter(name => isPlaceholderScript(scripts[name]));
if (placeholders.length) {
  fail(`Project scripts cannot be placeholders: ${placeholders.join(", ")}`);
}

let logDir;
for (const [index, name] of requiredScripts.entries()) {
  if (dryRun) {
    console.log(`check:project-gates DRY_RUN npm run ${name}`);
    continue;
  }

  console.log(`check:project-gates RUN npm run ${name}`);
  logDir ||= fs.mkdtempSync(path.join(os.tmpdir(), "workflow-gates-"));
  const logFile = path.join(logDir, `${index + 1}.log`);
  const fd = fs.openSync(logFile, "w", 0o600);
  let result;
  try {
    result = spawnSync("npm", ["run", name], { cwd: root, stdio: ["inherit", fd, fd] });
  } finally {
    fs.closeSync(fd);
  }
  if (result.error || result.signal || result.status !== 0) {
    const code = result.signal ? 128 + os.constants.signals[result.signal] : result.status || 1;
    console.error(`check:project-gates FAIL - npm run ${name} exit ${code}; log: ${logFile}`);
    if (result.error || result.signal) console.error(result.error?.message || result.signal);
    printTail(logFile);
    process.exit(code);
  }
  console.log(`check:project-gates PASS - npm run ${name} exit 0; log: ${logFile}`);
}

console.log(`check:project-gates PASS - ${requiredScripts.join(", ")}`);

function printTail(file) {
  const fd = fs.openSync(file, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const buffer = Buffer.alloc(Math.min(size, 4096));
    const bytes = fs.readSync(fd, buffer, 0, buffer.length, size - buffer.length);
    if (size > buffer.length) console.error("Last 4096 bytes; full output in log above:");
    process.stderr.write(buffer.subarray(0, bytes));
  } finally {
    fs.closeSync(fd);
  }
}

function isPlaceholderScript(script) {
  const value = String(script).trim();
  return !value ||
    value === "..." ||
    value === "TODO" ||
    value.includes("TODO") ||
    /^echo\s+["']?(TODO|not implemented|placeholder)/i.test(value);
}
