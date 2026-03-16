import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const nextBin = path.resolve(projectRoot, "node_modules/next/dist/bin/next");

const nextArgs = process.argv.slice(2);
if (nextArgs.length === 0) {
  console.error("Usage: node scripts/run-next.mjs <next-command> [args...]");
  process.exit(1);
}

const isDarwin = process.platform === "darwin";
const isRosettaNode = process.arch === "x64";
const arm64Lightning = path.resolve(projectRoot, "node_modules/lightningcss-darwin-arm64");
const x64Lightning = path.resolve(projectRoot, "node_modules/lightningcss-darwin-x64");
const hasArm64Lightning = fs.existsSync(arm64Lightning);
const hasX64Lightning = fs.existsSync(x64Lightning);

const shouldForceArm64 =
  isDarwin && isRosettaNode && hasArm64Lightning && !hasX64Lightning;

let cmd = process.execPath;
let args = [nextBin, ...nextArgs];
if (shouldForceArm64) {
  cmd = "/usr/bin/arch";
  args = ["-arm64", process.execPath, nextBin, ...nextArgs];
  console.warn(
    "[run-next] Rosetta Node detected with arm64-only lightningcss binary. Launching Next in arm64 mode."
  );
}

const child = spawn(cmd, args, {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

