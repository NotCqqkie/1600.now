import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const root = path.resolve(readArg("--root", process.cwd()));
const project = readArg("--project", process.env.HACKATIME_PROJECT || path.basename(root));
const category = readArg("--category", process.env.CODEX_HACKATIME_CATEGORY || "coding");
const intervalMs = Number(readArg("--interval-ms", process.env.CODEX_HACKATIME_INTERVAL_MS || "60000"));
const idleMs = Number(readArg("--idle-ms", process.env.CODEX_HACKATIME_IDLE_MS || "300000"));
const syncAi = readArg("--sync-ai", process.env.CODEX_HACKATIME_SYNC_AI || "0") === "1";
const syncAiEveryMs = Number(readArg("--sync-ai-every-ms", process.env.CODEX_HACKATIME_SYNC_AI_EVERY_MS || "300000"));
const codexHome = path.resolve(readArg("--codex-home", process.env.CODEX_HOME || path.join(os.homedir(), ".codex")));
const codexActivityMs = Number(readArg("--codex-activity-ms", process.env.CODEX_HACKATIME_CODEX_ACTIVITY_MS || "300000"));
const dryRun = args.includes("--dry-run") || process.env.CODEX_HACKATIME_DRY_RUN === "1";
const onceFile = readArg("--once", "");
const onceIfCodexActive = args.includes("--once-if-codex-active");

const ignoredDirs = new Set([
  ".git",
  ".claude",
  ".codex",
  ".cursor",
  ".playwright",
  ".playwright-mcp",
  ".shannon",
  ".wakatime",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".vite",
  ".cache",
  "coverage",
  "tmp",
  "logs",
  "_data",
  "_runs",
]);

const ignoredExts = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".mp4",
  ".mov",
  ".zip",
  ".gz",
  ".log",
]);

const ignoredPrefixes = [
  `public${path.sep}images${path.sep}`,
  `scripts${path.sep}_data${path.sep}`,
  `scripts${path.sep}extract${path.sep}_runs${path.sep}`,
];

const cli = await findWakaTimeCli();
let lastFile = "";
let lastActivityAt = 0;
let lastSentAt = 0;
let lastSentFile = "";
let lastCodexSessionMtime = 0;
let fallbackFile = "";

if (onceFile) {
  const file = path.resolve(root, onceFile);
  if (!shouldTrack(file)) {
    throw new Error(`File is ignored: ${file}`);
  }
  await sendHeartbeat(file, true);
  process.exit(0);
}

if (onceIfCodexActive) {
  const session = await latestCodexSessionForRoot();
  if (!session || Date.now() - session.mtimeMs > codexActivityMs) {
    process.exit(0);
  }

  const file = await findFallbackFile();
  if (file) {
    await sendHeartbeat(file, false);
  }
  process.exit(0);
}

console.log(`Tracking Codex file changes for Hackatime project "${project}"`);
console.log(`Root: ${root}`);
console.log(`Category: ${category}`);
console.log(`CLI: ${cli}`);
console.log(`Codex sessions: ${codexHome}`);
console.log(dryRun ? "Dry run: heartbeats will not be sent" : "Press Ctrl-C to stop");

if (syncAi) {
  void syncAiActivity();
  setInterval(() => {
    void syncAiActivity();
  }, syncAiEveryMs);
}

try {
  fs.watch(root, { recursive: true }, (_eventType, filename) => {
    if (!filename) return;
    const file = path.resolve(root, filename.toString());
    void handleFileChange(file);
  });
} catch {
  console.log("Recursive file watching unavailable; falling back to polling");
  void pollForChanges();
}

setInterval(() => {
  void syncCodexActivity();
}, Math.max(5000, Math.min(intervalMs, 30000)));

setInterval(() => {
  if (!lastFile) return;
  if (Date.now() - lastActivityAt > idleMs) return;
  void sendHeartbeat(lastFile, false);
}, intervalMs);

function readArg(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

async function findWakaTimeCli() {
  const candidates = [
    process.env.WAKATIME_CLI,
    path.join(os.homedir(), ".wakatime", "wakatime-cli"),
    "/opt/homebrew/bin/wakatime-cli",
    "/usr/local/bin/wakatime-cli",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fsp.access(candidate, fs.constants.X_OK);
      return candidate;
    } catch {}
  }

  throw new Error("wakatime-cli was not found. Run the Hackatime setup page first.");
}

async function handleFileChange(file) {
  if (!shouldTrack(file)) return;

  try {
    const stat = await fsp.stat(file);
    if (!stat.isFile()) return;
  } catch {
    return;
  }

  lastFile = file;
  lastActivityAt = Date.now();
  await sendHeartbeat(file, true);
}

async function syncCodexActivity() {
  const session = await latestCodexSessionForRoot();
  if (!session) return;
  if (session.mtimeMs <= lastCodexSessionMtime) return;

  lastCodexSessionMtime = session.mtimeMs;
  if (Date.now() - session.mtimeMs > codexActivityMs) return;

  lastActivityAt = Date.now();
  if (!lastFile || !shouldTrack(lastFile)) {
    lastFile = await findFallbackFile();
  }
  if (lastFile) {
    await sendHeartbeat(lastFile, false);
  }
}

function shouldTrack(file) {
  const relative = path.relative(root, file);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return false;
  if (relative.split(path.sep).some((part) => ignoredDirs.has(part))) return false;
  if (ignoredPrefixes.some((prefix) => relative.startsWith(prefix))) return false;
  if (path.basename(relative) === ".DS_Store") return false;
  if (ignoredExts.has(path.extname(relative).toLowerCase())) return false;
  return true;
}

async function sendHeartbeat(file, write) {
  const now = Date.now();
  if (file === lastSentFile && now - lastSentAt < 30_000) return;

  const heartbeatArgs = [
    "--entity",
    file,
    "--entity-type",
    "file",
    "--project",
    project,
    "--project-folder",
    root,
    "--category",
    category,
    "--sync-ai-disabled",
    "--heartbeat-rate-limit-seconds",
    "0",
    "--plugin",
    "codex-hackatime-tracker/1.0.0",
  ];

  if (write) heartbeatArgs.push("--write");

  lastSentAt = now;
  lastSentFile = file;

  if (dryRun) {
    console.log(`[dry-run] ${cli} ${heartbeatArgs.map(shellQuote).join(" ")}`);
    return;
  }

  await new Promise((resolve, reject) => {
    const child = spawn(cli, heartbeatArgs, { stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        console.log(`sent ${write ? "write " : ""}heartbeat: ${path.relative(root, file)}`);
        resolve();
      } else {
        reject(new Error(`wakatime-cli exited with ${code}`));
      }
    });
  });
}

async function syncAiActivity() {
  if (dryRun) {
    console.log(`[dry-run] ${cli} --sync-ai-activity --sync-offline-activity 0 --timeout 15`);
    return;
  }

  await new Promise((resolve, reject) => {
    const child = spawn(cli, ["--sync-ai-activity", "--sync-offline-activity", "0", "--timeout", "15"], { stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`wakatime-cli ai sync exited with ${code}`));
      }
    });
  });
}

async function latestCodexSessionForRoot() {
  const entries = [];

  for (const dir of codexSessionDirs()) {
    try {
      entries.push(...await collectJsonlFiles(dir));
    } catch {}
  }

  if (!entries.length) return null;

  let latest = null;
  const now = Date.now();

  for (const file of entries) {
    let stat;
    try {
      stat = await fsp.stat(file);
    } catch {
      continue;
    }

    if (stat.mtimeMs <= lastCodexSessionMtime && now - stat.mtimeMs > codexActivityMs) continue;
    if (!(await sessionMatchesRoot(file))) continue;
    if (!latest || stat.mtimeMs > latest.mtimeMs) {
      latest = { file, mtimeMs: stat.mtimeMs };
    }
  }

  return latest;
}

function codexSessionDirs() {
  return [0, -1].map((dayOffset) => {
    const date = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return path.join(codexHome, "sessions", year, month, day);
  });
}

async function collectJsonlFiles(dir) {
  const files = [];
  const stack = [dir];

  while (stack.length) {
    const current = stack.pop();
    const entries = await fsp.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(file);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        files.push(file);
      }
    }
  }

  return files;
}

async function sessionMatchesRoot(file) {
  const line = await readFirstLine(file);
  if (!line) return false;

  try {
    const event = JSON.parse(line);
    return path.resolve(event?.payload?.cwd || "") === root;
  } catch {
    return false;
  }
}

async function readFirstLine(file) {
  const handle = await fsp.open(file, "r");
  try {
    const chunks = [];
    let offset = 0;
    let total = 0;

    while (total < 4 * 1024 * 1024) {
      const buffer = Buffer.alloc(65536);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      if (!bytesRead) break;

      chunks.push(buffer.subarray(0, bytesRead));
      offset += bytesRead;
      total += bytesRead;

      if (buffer.subarray(0, bytesRead).includes(10)) break;
    }

    return Buffer.concat(chunks).toString("utf8").split("\n")[0];
  } finally {
    await handle.close();
  }
}

async function findFallbackFile() {
  if (fallbackFile && shouldTrack(fallbackFile)) return fallbackFile;

  for (const relative of ["package.json", "README.md", "src/main.tsx", "src/App.tsx", "index.html"]) {
    const file = path.join(root, relative);
    try {
      const stat = await fsp.stat(file);
      if (stat.isFile() && shouldTrack(file)) {
        fallbackFile = file;
        return file;
      }
    } catch {}
  }

  fallbackFile = await findFirstTrackableFile(root);
  return fallbackFile;
}

async function findFirstTrackableFile(dir) {
  const stack = [dir];

  while (stack.length) {
    const current = stack.pop();
    const entries = await fsp.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) stack.push(file);
        continue;
      }

      if (entry.isFile() && shouldTrack(file)) return file;
    }
  }

  return "";
}

async function pollForChanges() {
  const seen = new Map();
  await scan(seen, false);

  setInterval(() => {
    void scan(seen, true);
  }, 5000);
}

async function scan(seen, emit) {
  const stack = [root];

  while (stack.length) {
    const dir = stack.pop();
    const entries = await fsp.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) stack.push(file);
        continue;
      }

      if (!entry.isFile() || !shouldTrack(file)) continue;
      const stat = await fsp.stat(file);
      const previous = seen.get(file);
      seen.set(file, stat.mtimeMs);
      if (emit && previous !== undefined && previous !== stat.mtimeMs) {
        await handleFileChange(file);
      }
    }
  }
}

function shellQuote(value) {
  if (/^[a-zA-Z0-9_./:=@+-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}
