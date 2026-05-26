import { execFileSync } from "node:child_process";

const MIN_NPM = "11.10.0";

function parseVersion(value) {
  return String(value || "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const delta = (a[i] || 0) - (b[i] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function npmVersionFromExecPath() {
  if (!process.env.npm_execpath) return "";
  try {
    return execFileSync(process.execPath, [process.env.npm_execpath, "--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function npmVersionFromUserAgent() {
  const userAgent = process.env.npm_config_user_agent || "";
  const match = userAgent.match(/\bnpm\/([^\s]+)/);
  return match ? match[1] : "";
}

function commandForPid(pid) {
  try {
    return execFileSync("ps", ["-o", "pid=", "-o", "ppid=", "-o", "comm=", "-o", "args=", "-p", String(pid)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function ancestorCommands() {
  const commands = [];
  let pid = process.ppid;

  for (let depth = 0; depth < 16 && pid > 1; depth += 1) {
    const line = commandForPid(pid);
    if (!line) break;
    commands.push(line);
    const parts = line.trim().split(/\s+/);
    pid = Number.parseInt(parts[1], 10);
    if (!Number.isFinite(pid)) break;
  }

  return commands;
}

function isSocketFirewallCommand(command) {
  return /(^|\s|\/)(sfw|sfw-free|socket-firewall)(\s|$|-)/i.test(command);
}

const npmVersion = npmVersionFromExecPath() || npmVersionFromUserAgent();
if (!npmVersion || compareVersions(npmVersion, MIN_NPM) < 0) {
  console.error(`Error: npm ${MIN_NPM} or newer is required so min-release-age is enforced.`);
  console.error("Use Socket Firewall with the pinned npm version, for example:");
  console.error("  sfw npm exec --yes --package npm@11.11.1 -- npm install");
  process.exit(1);
}

const commands = ancestorCommands();
if (!commands.some(isSocketFirewallCommand)) {
  console.error("Error: install dependencies using the Socket Firewall wrapper.");
  console.error("Use:");
  console.error("  sfw npm install");
  process.exit(1);
}
