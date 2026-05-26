import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "scripts", "hooks", "pre-commit");

if (!existsSync(join(root, ".git"))) {
  console.error("Error: .git directory not found.");
  process.exit(1);
}

const target = execFileSync("git", ["rev-parse", "--git-path", "hooks/pre-commit"], {
  cwd: root,
  encoding: "utf8",
}).trim();

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
chmodSync(target, 0o755);

console.log(`Installed ${target}`);
