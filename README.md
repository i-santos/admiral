# maestro

`maestro` is a local-first CLI for orchestrating multiple coding agents inside any Git repository.

It creates an isolated runtime in the target project, models work as a JSON task graph, and runs agents in parallel using `git worktree`.

## Current scope

The current implementation covers the practical core of phases 1 and 2:

- `maestro init`
- `maestro run`
- `maestro status`
- `maestro task create`
- `maestro task list`
- `maestro task retry`
- `maestro merge`
- `maestro cleanup`

It also includes:

- local runtime folders under `.maestro/`, `kanban/`, `runtime/`, `events/`, and `workspaces/`
- task dependency handling through `kanban/graph.json`
- scheduler-based claiming and execution
- isolated workspaces through `git worktree`
- sparse checkout by task scope
- heartbeat, retry, and recovery handling

## Installation

```bash
npm install -g maestro
```

## Usage

Initialize `maestro` inside a Git repository:

```bash
maestro init
```

Create tasks:

```bash
maestro task create backend-auth --scope backend
maestro task create frontend-login --scope frontend --depends-on backend-auth
```

Run the scheduler once:

```bash
maestro run --once
```

Check status:

```bash
maestro status
```

## Configuration

`maestro init` creates `.maestro/config.json` with defaults such as:

- `max_agents`
- `scheduler_interval_ms`
- `heartbeat_timeout_ms`
- `max_retries_per_task`
- `default_branch`
- `agent_command`
- `scopes`

The runner is provider-agnostic. `maestro` executes the configured `agent_command` inside the task workspace and exposes task metadata through environment variables like:

- `MAESTRO_TASK_ID`
- `MAESTRO_TASK_TITLE`
- `MAESTRO_TASK_SCOPE`
- `MAESTRO_TASK_BRANCH`
- `MAESTRO_TASK_WORKSPACE`

## Development

Run tests:

```bash
npm test
```

Check the package contents before publishing:

```bash
npm run pack:check
```

## Publishing status

The package is functionally ready to pack. Before publishing to npm, make sure the repository metadata in `package.json` points to the final hosted Git URL.
