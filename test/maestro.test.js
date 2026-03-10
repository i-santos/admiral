"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const { mkdtemp, readFile, writeFile } = require("node:fs/promises");
const { spawn } = require("node:child_process");
const { execFile } = require("../lib/utils/process");

const CLI_PATH = path.join(__dirname, "..", "bin", "maestro");

async function createTempRepo() {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), "maestro-test-"));
  await execFile("git", ["init", "-b", "main"], { cwd: repoDir });
  await execFile("git", ["config", "user.email", "test@example.com"], { cwd: repoDir });
  await execFile("git", ["config", "user.name", "Maestro Test"], { cwd: repoDir });
  await writeFile(path.join(repoDir, "README.md"), "# temp\n", "utf8");
  await execFile("git", ["add", "."], { cwd: repoDir });
  await execFile("git", ["commit", "-m", "init"], { cwd: repoDir });
  return repoDir;
}

async function runCli(args, cwd) {
  return execFile(process.execPath, [CLI_PATH, ...args], {
    cwd,
    env: {
      ...process.env,
      SHELL: "/bin/sh",
    },
  });
}

test("maestro init creates runtime structure", async () => {
  const repoDir = await createTempRepo();
  await runCli(["init"], repoDir);

  const config = JSON.parse(await readFile(path.join(repoDir, ".maestro", "config.json"), "utf8"));
  const graph = JSON.parse(await readFile(path.join(repoDir, "kanban", "graph.json"), "utf8"));

  assert.equal(config.default_branch, "main");
  assert.deepEqual(graph.tasks, []);
});

test("maestro can create tasks and list them", async () => {
  const repoDir = await createTempRepo();
  await runCli(["init"], repoDir);
  await runCli(["task", "create", "backend-auth", "--scope", "backend"], repoDir);
  await runCli(["task", "create", "frontend-login", "--scope", "frontend", "--depends-on", "backend-auth"], repoDir);

  const result = await runCli(["task", "list"], repoDir);
  assert.match(result.stdout, /backend-auth/);
  assert.match(result.stdout, /frontend-login/);
});

test("scheduler moves a successful task to review", async () => {
  const repoDir = await createTempRepo();
  await runCli(["init"], repoDir);

  const configPath = path.join(repoDir, ".maestro", "config.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.agent_command = "node -e \"require('node:fs').writeFileSync('done.txt', process.env.MAESTRO_TASK_ID)\"";
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  await runCli(["task", "create", "backend-auth", "--scope", "general"], repoDir);
  await runCli(["run", "--once"], repoDir);

  await new Promise((resolve) => setTimeout(resolve, 1200));

  const graph = JSON.parse(await readFile(path.join(repoDir, "kanban", "graph.json"), "utf8"));
  const task = graph.tasks.find((item) => item.id === "backend-auth");
  assert.equal(task.status, "review");
  assert.ok(task.workspace);

  const artifact = await readFile(path.join(task.workspace, "done.txt"), "utf8");
  assert.equal(artifact, "backend-auth");
});

test("recovery retries a dead running task", async () => {
  const repoDir = await createTempRepo();
  await runCli(["init"], repoDir);

  const configPath = path.join(repoDir, ".maestro", "config.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.heartbeat_timeout_ms = 800;
  config.agent_command = "node -e \"setTimeout(()=>process.exit(0), 10000)\"";
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  await runCli(["task", "create", "backend-auth"], repoDir);

  const runProcess = spawn(process.execPath, [CLI_PATH, "run", "--once"], {
    cwd: repoDir,
    env: {
      ...process.env,
      SHELL: "/bin/sh",
    },
    detached: false,
    stdio: "ignore",
  });
  await new Promise((resolve) => setTimeout(resolve, 200));

  const pidRecord = JSON.parse(await readFile(path.join(repoDir, "runtime", "pids", "backend-auth.json"), "utf8"));
  process.kill(pidRecord.pid, "SIGKILL");
  runProcess.kill("SIGKILL");

  await new Promise((resolve) => setTimeout(resolve, 1000));
  await runCli(["run", "--once"], repoDir);

  const graph = JSON.parse(await readFile(path.join(repoDir, "kanban", "graph.json"), "utf8"));
  const task = graph.tasks.find((item) => item.id === "backend-auth");
  assert.equal(task.status, "todo");
  assert.equal(task.retries, 1);
});
