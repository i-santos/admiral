"use strict";

const { spawn, spawnSync } = require("node:child_process");

async function execFile(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: options.env || process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 && !options.allowFailure) {
        reject(new Error(stderr || `${command} exited with code ${code}`));
        return;
      }
      resolve({ code, stdout, stderr });
    });
  });
}

async function execShellCommand(command, options = {}) {
  return execFile(process.env.SHELL || "/bin/sh", ["-lc", command], options);
}

function isProcessAlive(pid) {
  if (!pid) {
    return false;
  }
  const result = spawnSync("kill", ["-0", String(pid)], {
    stdio: "ignore",
  });
  return result.status === 0;
}

module.exports = {
  execFile,
  execShellCommand,
  isProcessAlive,
};
