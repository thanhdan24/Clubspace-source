import { spawn } from "node:child_process";
import process from "node:process";

console.log("\n========================================================");
console.log("🚀 Đang khởi động Clubspace (Backend: 3001 | Frontend: 5173)...");
console.log("========================================================\n");

const backend = spawn(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["run", "start"],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

const frontend = spawn(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["run", "dev:frontend"],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

function shutdown() {
  try {
    backend.kill();
  } catch {}
  try {
    frontend.kill();
  } catch {}
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", shutdown);
