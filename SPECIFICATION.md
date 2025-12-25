I'll now generate the comprehensive specification for `claude-code-bridge`. Given the complexity and length required, I'll structure this as a complete, implementation-ready document.

---

# Claude Code Bridge MCP Server — Complete Implementation Specification

## Version 0.1.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Project Structure](#3-project-structure)
4. [Configuration System](#4-configuration-system)
5. [Core Components](#5-core-components)
6. [MCP Tools Specification](#6-mcp-tools-specification)
7. [MCP Resources Specification](#7-mcp-resources-specification)
8. [PTY Management System](#8-pty-management-system)
9. [Task Lifecycle Management](#9-task-lifecycle-management)
10. [Filesystem Operations](#10-filesystem-operations)
11. [Git Operations](#11-git-operations)
12. [Logging System](#12-logging-system)
13. [Error Handling](#13-error-handling)
14. [Security Model](#14-security-model)
15. [Testing Strategy](#15-testing-strategy)
16. [Implementation Sequence](#16-implementation-sequence)
17. [File-by-File Specifications](#17-file-by-file-specifications)

---

## 1. Executive Summary

### 1.1 Purpose

`claude-code-bridge` is an MCP (Model Context Protocol) server that enables Claude.ai to orchestrate long-running Claude Code CLI tasks. It eliminates the manual copy-paste workflow between Claude.ai and Claude Code by providing:

- **Asynchronous task execution** with polling-based status checks
- **PTY-based process management** for reliable terminal emulation
- **Native filesystem tools** for cheap, fast codebase exploration
- **Git observation tools** for understanding repository state
- **Structured logging** for debugging and auditability

### 1.2 Key Design Principles

1. **Claude.ai is the Brain**: The MCP server is stateless regarding conversation context. Claude.ai maintains all orchestration logic.
2. **Async-First**: Long-running tasks return immediately with a task ID. Status is retrieved via polling.
3. **Fail-Safe Defaults**: Conservative timeouts, strict path whitelisting, and clean-slate restarts.
4. **Observability Over Automation**: Read-only git tools, raw output passthrough, explicit status codes.
5. **Unix-Native**: V1 targets macOS and Linux. Windows support is out of scope.

### 1.3 Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Node.js 20+ | Native MCP SDK support, excellent async I/O |
| Language | TypeScript 5.x | Type safety, better maintainability |
| PTY | `node-pty` | Industry standard (used by VS Code) |
| MCP SDK | `@modelcontextprotocol/sdk` | Official reference implementation |
| Testing | Vitest | Fast, TypeScript-native, good mocking |
| Linting | ESLint + Prettier | Consistent code style |

---

## 2. System Architecture

### 2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Claude.ai (Web UI)                              │
│                         [The Orchestrating "Brain"]                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ MCP Protocol (stdio)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          claude-code-bridge (MCP Server)                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                           Transport Layer                                ││
│  │                    (stdio via @modelcontextprotocol/sdk)                ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                       │                                      │
│       ┌───────────────────────────────┼───────────────────────────────┐     │
│       ▼                               ▼                               ▼     │
│  ┌─────────────┐              ┌─────────────┐              ┌─────────────┐  │
│  │    Tools    │              │  Resources  │              │   Config    │  │
│  │   Handler   │              │   Handler   │              │   Manager   │  │
│  └─────────────┘              └─────────────┘              └─────────────┘  │
│       │                               │                           │         │
│       ▼                               ▼                           ▼         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                           Core Services                                  ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    ││
│  │  │    Task     │  │ Filesystem  │  │     Git     │  │   Logger    │    ││
│  │  │   Manager   │  │   Service   │  │   Service   │  │   Service   │    ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         PTY Manager                                      ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      ││
│  │  │  PTY Pool   │  │   Expect    │  │   Output    │                      ││
│  │  │  (node-pty) │  │   Handler   │  │   Buffer    │                      ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘                      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ PTY (pseudo-terminal)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Claude Code CLI Process                            │
│                        (spawned per task, one per project)                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ File I/O
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Project Directory                               │
│                    (within allowed_roots whitelist)                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  .claude/                                                             │   │
│  │  ├── mcp-logs/           ← Task logs stored here                     │   │
│  │  │   ├── task_abc123.log                                             │   │
│  │  │   └── current_task_prompt.md                                      │   │
│  │  └── ...                  ← Claude Code's own state                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Transport Layer** | Handles MCP protocol communication via stdio |
| **Tools Handler** | Routes tool calls to appropriate services |
| **Resources Handler** | Serves resource URIs (logs, task list, config) |
| **Config Manager** | Loads, validates, and provides configuration |
| **Task Manager** | Orchestrates task lifecycle, maintains task registry |
| **PTY Manager** | Spawns/manages PTY processes, handles expect-send |
| **Filesystem Service** | Safe file/directory operations within allowed roots |
| **Git Service** | Read-only git operations for observability |
| **Logger Service** | Structured logging with file rotation |

### 2.3 Data Flow: Task Execution

```
1. Claude.ai calls start_task(prompt, path)
          │
          ▼
2. Tools Handler validates path against allowed_roots
          │
          ▼
3. Task Manager checks project lock (one task per project)
          │
          ▼
4. Task Manager creates task entry {id, status: "starting", ...}
          │
          ▼
5. Prompt written to .claude/mcp-logs/current_task_prompt.md
          │
          ▼
6. PTY Manager spawns: cat current_task_prompt.md | claude
          │
          ▼
7. Task Manager returns {task_id, status: "running"} immediately
          │
          ▼
8. [Async] PTY Manager streams output to log file
          │
          ▼
9. [Async] Expect Handler watches for approval prompts, sends "y"
          │
          ▼
10. Claude.ai polls get_task_status(task_id)
          │
          ▼
11. Task Manager returns {status, elapsed, last_output, hint}
          │
          ▼
12. [Eventually] Process exits, Task Manager updates status
          │
          ▼
13. Claude.ai calls get_task_status, receives {status: "completed"}
```

---

## 3. Project Structure

```
claude-code-bridge/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.json
├── .prettierrc
├── .gitignore
├── README.md
├── LICENSE
│
├── src/
│   ├── index.ts                    # Entry point, server bootstrap
│   ├── server.ts                   # MCP server setup and routing
│   │
│   ├── config/
│   │   ├── index.ts                # Config module exports
│   │   ├── loader.ts               # Load config from file + env
│   │   ├── schema.ts               # Zod schema for config validation
│   │   └── defaults.ts             # Default configuration values
│   │
│   ├── tools/
│   │   ├── index.ts                # Tool registration and routing
│   │   ├── task.tools.ts           # start_task, get_task_status, kill_task
│   │   ├── filesystem.tools.ts     # list_files, read_file, etc.
│   │   ├── git.tools.ts            # git_status, git_diff, git_diff_stat
│   │   └── project.tools.ts        # set_active_project, create_directory, etc.
│   │
│   ├── resources/
│   │   ├── index.ts                # Resource registration and routing
│   │   ├── logs.resource.ts        # resource://logs/{task_id}
│   │   ├── tasks.resource.ts       # resource://tasks/active
│   │   └── config.resource.ts      # resource://config
│   │
│   ├── services/
│   │   ├── index.ts                # Service exports
│   │   ├── task-manager.ts         # Task lifecycle, registry, locking
│   │   ├── pty-manager.ts          # PTY spawning, expect-send logic
│   │   ├── filesystem.service.ts   # File operations with security
│   │   ├── git.service.ts          # Git command execution
│   │   └── logger.service.ts       # Structured logging, rotation
│   │
│   ├── utils/
│   │   ├── index.ts                # Utility exports
│   │   ├── ansi.ts                 # ANSI escape code stripping
│   │   ├── path-security.ts        # Path validation against allowed_roots
│   │   ├── id-generator.ts         # Unique task ID generation
│   │   ├── binary-detector.ts      # Detect binary files
│   │   └── gitignore-parser.ts     # Parse and apply .gitignore rules
│   │
│   └── types/
│       ├── index.ts                # Type exports
│       ├── config.types.ts         # Configuration interfaces
│       ├── task.types.ts           # Task-related interfaces
│       ├── tool.types.ts           # Tool input/output interfaces
│       └── resource.types.ts       # Resource interfaces
│
├── tests/
│   ├── unit/
│   │   ├── config/
│   │   │   └── loader.test.ts
│   │   ├── services/
│   │   │   ├── task-manager.test.ts
│   │   │   ├── pty-manager.test.ts
│   │   │   ├── filesystem.service.test.ts
│   │   │   └── git.service.test.ts
│   │   └── utils/
│   │       ├── ansi.test.ts
│   │       ├── path-security.test.ts
│   │       └── binary-detector.test.ts
│   │
│   ├── integration/
│   │   ├── tools.test.ts           # Tool integration tests (mocked PTY)
│   │   └── resources.test.ts       # Resource integration tests
│   │
│   ├── mocks/
│   │   ├── mock-pty.ts             # MockPty class for testing
│   │   └── mock-filesystem.ts      # Mock filesystem for testing
│   │
│   └── fixtures/
│       ├── sample-project/         # Sample project for filesystem tests
│       └── sample-config.json      # Sample configuration
│
├── scripts/
│   ├── test-live.ts                # Manual smoke test script
│   └── setup-config.ts             # Interactive config setup
│
└── dist/                           # Compiled output (gitignored)
```

---

## 4. Configuration System

### 4.1 Configuration File Location

**Primary**: `~/.config/mcp-claude-bridge/config.json`

**Fallback search order**:
1. Path specified in `MCP_CLAUDE_BRIDGE_CONFIG` environment variable
2. `~/.config/mcp-claude-bridge/config.json`
3. `./config.json` (current working directory)

### 4.2 Configuration Schema

```typescript
// src/config/schema.ts

import { z } from 'zod';

export const ConfigSchema = z.object({
  // Required: List of allowed root directories
  allowed_roots: z
    .array(z.string())
    .min(1, 'At least one allowed_root is required'),

  // Optional: Default timeout for tasks in seconds
  default_timeout_seconds: z
    .number()
    .int()
    .positive()
    .default(3600), // 60 minutes

  // Optional: Maximum log file size before rotation (bytes)
  max_log_size_bytes: z
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024), // 10MB

  // Optional: Number of tasks to keep in history
  task_history_size: z
    .number()
    .int()
    .positive()
    .default(20),

  // Optional: Default file tree depth
  default_tree_depth: z
    .number()
    .int()
    .positive()
    .max(10)
    .default(2),

  // Optional: Maximum diff output size (bytes)
  max_diff_size_bytes: z
    .number()
    .int()
    .positive()
    .default(50 * 1024), // 50KB

  // Optional: Default number of lines for file header reads
  default_header_lines: z
    .number()
    .int()
    .positive()
    .default(50),

  // Optional: Shell to use for PTY
  shell: z
    .string()
    .default('/bin/bash'),

  // Optional: Claude Code command
  claude_command: z
    .string()
    .default('claude'),

  // Optional: Patterns to auto-approve (expect-send)
  auto_approve_patterns: z
    .array(z.string())
    .default([
      'Do you want to proceed\\?',
      '\\[y/N\\]',
      '\\[Y/n\\]',
      'Continue\\?',
      'Approve\\?',
    ]),

  // Optional: Log level
  log_level: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info'),
});

export type Config = z.infer<typeof ConfigSchema>;
```

### 4.3 Environment Variable Overrides

Environment variables take precedence over config file values:

| Environment Variable | Config Key | Type |
|---------------------|------------|------|
| `MCP_ALLOWED_ROOTS` | `allowed_roots` | Comma-separated paths |
| `MCP_DEFAULT_TIMEOUT` | `default_timeout_seconds` | Integer |
| `MCP_MAX_LOG_SIZE` | `max_log_size_bytes` | Integer |
| `MCP_TASK_HISTORY_SIZE` | `task_history_size` | Integer |
| `MCP_TREE_DEPTH` | `default_tree_depth` | Integer |
| `MCP_MAX_DIFF_SIZE` | `max_diff_size_bytes` | Integer |
| `MCP_SHELL` | `shell` | String |
| `MCP_CLAUDE_COMMAND` | `claude_command` | String |
| `MCP_LOG_LEVEL` | `log_level` | debug\|info\|warn\|error |

### 4.4 Example Configuration

```json
{
  "allowed_roots": [
    "/Users/james/Projects",
    "/Users/james/Work"
  ],
  "default_timeout_seconds": 3600,
  "max_log_size_bytes": 10485760,
  "task_history_size": 20,
  "default_tree_depth": 2,
  "max_diff_size_bytes": 51200,
  "default_header_lines": 50,
  "shell": "/bin/bash",
  "claude_command": "claude",
  "auto_approve_patterns": [
    "Do you want to proceed\\?",
    "\\[y/N\\]",
    "\\[Y/n\\]",
    "Continue\\?",
    "Approve\\?"
  ],
  "log_level": "info"
}
```

### 4.5 Configuration Loader Implementation

```typescript
// src/config/loader.ts

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigSchema, Config } from './schema';
import { defaultConfig } from './defaults';

export class ConfigLoader {
  private config: Config | null = null;

  /**
   * Load configuration from file and environment variables.
   * Environment variables override file values.
   */
  load(): Config {
    if (this.config) {
      return this.config;
    }

    // 1. Start with defaults
    let rawConfig: Record<string, unknown> = { ...defaultConfig };

    // 2. Load from file
    const configPath = this.findConfigFile();
    if (configPath) {
      try {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        rawConfig = { ...rawConfig, ...fileConfig };
        console.error(`[config] Loaded config from ${configPath}`);
      } catch (err) {
        console.error(`[config] Warning: Failed to load ${configPath}: ${err}`);
      }
    }

    // 3. Apply environment variable overrides
    rawConfig = this.applyEnvOverrides(rawConfig);

    // 4. Validate with Zod
    const result = ConfigSchema.safeParse(rawConfig);
    if (!result.success) {
      console.error('[config] Configuration validation failed:');
      console.error(result.error.format());
      throw new Error('Invalid configuration');
    }

    // 5. Validate allowed_roots exist (soft validation - warn only)
    this.validateAllowedRoots(result.data.allowed_roots);

    this.config = result.data;
    return this.config;
  }

  private findConfigFile(): string | null {
    const candidates = [
      process.env.MCP_CLAUDE_BRIDGE_CONFIG,
      path.join(os.homedir(), '.config', 'mcp-claude-bridge', 'config.json'),
      path.join(process.cwd(), 'config.json'),
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private applyEnvOverrides(config: Record<string, unknown>): Record<string, unknown> {
    if (process.env.MCP_ALLOWED_ROOTS) {
      config.allowed_roots = process.env.MCP_ALLOWED_ROOTS.split(',').map(p => p.trim());
    }
    if (process.env.MCP_DEFAULT_TIMEOUT) {
      config.default_timeout_seconds = parseInt(process.env.MCP_DEFAULT_TIMEOUT, 10);
    }
    if (process.env.MCP_MAX_LOG_SIZE) {
      config.max_log_size_bytes = parseInt(process.env.MCP_MAX_LOG_SIZE, 10);
    }
    if (process.env.MCP_TASK_HISTORY_SIZE) {
      config.task_history_size = parseInt(process.env.MCP_TASK_HISTORY_SIZE, 10);
    }
    if (process.env.MCP_TREE_DEPTH) {
      config.default_tree_depth = parseInt(process.env.MCP_TREE_DEPTH, 10);
    }
    if (process.env.MCP_MAX_DIFF_SIZE) {
      config.max_diff_size_bytes = parseInt(process.env.MCP_MAX_DIFF_SIZE, 10);
    }
    if (process.env.MCP_SHELL) {
      config.shell = process.env.MCP_SHELL;
    }
    if (process.env.MCP_CLAUDE_COMMAND) {
      config.claude_command = process.env.MCP_CLAUDE_COMMAND;
    }
    if (process.env.MCP_LOG_LEVEL) {
      config.log_level = process.env.MCP_LOG_LEVEL;
    }

    return config;
  }

  private validateAllowedRoots(roots: string[]): void {
    for (const root of roots) {
      const expandedPath = root.replace(/^~/, os.homedir());
      if (!fs.existsSync(expandedPath)) {
        console.error(`[config] Warning: allowed_root does not exist: ${root}`);
      }
    }
  }
}

// Singleton instance
export const configLoader = new ConfigLoader();
```

---

## 5. Core Components

### 5.1 Task Types

```typescript
// src/types/task.types.ts

export type TaskStatus = 
  | 'pending'      // Task created but not yet started
  | 'starting'     // PTY being spawned
  | 'running'      // Claude Code is executing
  | 'completed'    // Process exited with code 0
  | 'failed'       // Process exited with non-zero code
  | 'timeout'      // Task exceeded timeout limit
  | 'killed'       // Task was manually terminated
  | 'error';       // Internal error (PTY failed, etc.)

export type PermissionMode = 
  | 'auto'         // Automatically approve all prompts
  | 'cautious';    // Only approve safe patterns (default in future?)

export interface Task {
  id: string;
  status: TaskStatus;
  projectPath: string;
  prompt: string;
  permissionMode: PermissionMode;
  timeoutSeconds: number;
  
  // Timing
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  
  // Process info
  pid: number | null;
  exitCode: number | null;
  
  // Output
  logFile: string;
  lastOutput: string;      // Last N characters of output
  outputSizeBytes: number;
}

export interface TaskSummary {
  id: string;
  status: TaskStatus;
  projectPath: string;
  createdAt: string;       // ISO string
  elapsedSeconds: number;
  lastOutput: string;
}

export interface StartTaskInput {
  prompt: string;
  path: string;
  timeout_seconds?: number;
  permission_mode?: PermissionMode;
}

export interface StartTaskOutput {
  task_id: string;
  status: TaskStatus;
  message: string;
}

export interface GetTaskStatusInput {
  task_id: string;
}

export interface GetTaskStatusOutput {
  task_id: string;
  status: TaskStatus;
  elapsed_seconds: number;
  exit_code: number | null;
  last_output: string;
  files_changed?: string[];  // If we can detect from output
  hint: string;
}

export interface KillTaskInput {
  task_id: string;
}

export interface KillTaskOutput {
  task_id: string;
  status: TaskStatus;
  message: string;
}
```

### 5.2 Tool Types

```typescript
// src/types/tool.types.ts

// Filesystem Tools

export interface SetActiveProjectInput {
  path: string;
}

export interface SetActiveProjectOutput {
  active_project: string;
  message: string;
}

export interface ListFilesInput {
  path?: string;           // Defaults to active project
  depth?: number;          // Defaults to config value
}

export interface ListFilesOutput {
  path: string;
  entries: FileEntry[];
}

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;           // Only for files
}

export interface ReadFileInput {
  path: string;
}

export interface ReadFileOutput {
  path: string;
  content: string;
  lines: number;
  size_bytes: number;
}

export interface ReadFileRangeInput {
  path: string;
  start_line: number;      // 1-indexed
  end_line: number;        // Inclusive
}

export interface ReadFileRangeOutput {
  path: string;
  start_line: number;
  end_line: number;
  content: string;
  total_lines: number;
}

export interface GetFileTreeInput {
  path?: string;           // Defaults to active project
  depth?: number;          // Defaults to config value
}

export interface GetFileTreeOutput {
  path: string;
  tree: string;            // Formatted tree string
}

export interface CreateDirectoryInput {
  path: string;
}

export interface CreateDirectoryOutput {
  path: string;
  created: boolean;
  message: string;
}

export interface WriteFileInput {
  path: string;
  content: string;
}

export interface WriteFileOutput {
  path: string;
  size_bytes: number;
  message: string;
}

export interface InitGitRepoInput {
  path: string;
}

export interface InitGitRepoOutput {
  path: string;
  initialized: boolean;
  message: string;
}

// Git Tools

export interface GitStatusInput {
  path?: string;           // Defaults to active project
}

export interface GitStatusOutput {
  path: string;
  clean: boolean;
  staged: string[];
  modified: string[];
  untracked: string[];
  branch: string;
  ahead: number;
  behind: number;
}

export interface GitDiffStatInput {
  path?: string;           // Defaults to active project
  cached?: boolean;        // Staged changes only
}

export interface GitDiffStatOutput {
  path: string;
  files: GitDiffFileStat[];
  summary: string;         // e.g., "3 files changed, 25 insertions(+), 10 deletions(-)"
}

export interface GitDiffFileStat {
  file: string;
  insertions: number;
  deletions: number;
}

export interface GitDiffInput {
  path?: string;           // Defaults to active project
  cached?: boolean;        // Staged changes only
}

export interface GitDiffOutput {
  path: string;
  diff: string;
  truncated: boolean;
  message: string;
}
```

### 5.3 Resource Types

```typescript
// src/types/resource.types.ts

export interface LogsResourceParams {
  task_id: string;
}

export interface TasksActiveResource {
  tasks: TaskSummary[];
}

export interface ConfigResource {
  allowed_roots: string[];
  default_timeout_seconds: number;
  max_log_size_bytes: number;
  task_history_size: number;
  default_tree_depth: number;
  max_diff_size_bytes: number;
}
```

---

## 6. MCP Tools Specification

### 6.1 Tool Registry

The MCP server exposes the following tools:

| Tool Name | Category | Description |
|-----------|----------|-------------|
| `start_task` | Task | Start a Claude Code task asynchronously |
| `get_task_status` | Task | Poll status of a running/completed task |
| `kill_task` | Task | Terminate a running task |
| `set_active_project` | Project | Set the default working directory |
| `list_files` | Filesystem | List files in a directory |
| `read_file` | Filesystem | Read entire file contents |
| `read_file_range` | Filesystem | Read specific line range |
| `get_file_tree` | Filesystem | Get directory tree structure |
| `create_directory` | Filesystem | Create a new directory |
| `write_file` | Filesystem | Write content to a file |
| `init_git_repo` | Git | Initialize a git repository |
| `git_status` | Git | Get repository status |
| `git_diff_stat` | Git | Get compact diff statistics |
| `git_diff` | Git | Get full diff output |

### 6.2 Task Tools

#### 6.2.1 `start_task`

**Purpose**: Start a Claude Code task asynchronously.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "prompt": {
      "type": "string",
      "description": "The prompt to send to Claude Code"
    },
    "path": {
      "type": "string",
      "description": "Project directory path (must be within allowed_roots)"
    },
    "timeout_seconds": {
      "type": "integer",
      "description": "Task timeout in seconds (default: 3600)",
      "minimum": 60,
      "maximum": 14400
    },
    "permission_mode": {
      "type": "string",
      "enum": ["auto", "cautious"],
      "description": "How to handle approval prompts (default: auto)"
    }
  },
  "required": ["prompt", "path"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "task_id": {
      "type": "string",
      "description": "Unique identifier for the task"
    },
    "status": {
      "type": "string",
      "enum": ["pending", "starting", "running"]
    },
    "message": {
      "type": "string",
      "description": "Human-readable status message"
    }
  }
}
```

**Behavior**:
1. Validate `path` is within `allowed_roots`
2. Check no other task is running for this project path
3. Create task entry with status `pending`
4. Write prompt to `.claude/mcp-logs/current_task_prompt.md`
5. Spawn PTY with Claude Code command
6. Update status to `running`
7. Return immediately with `task_id`

**Error Cases**:
- Path outside allowed_roots → Error with allowed roots list
- Task already running for project → Error with existing task_id
- PTY spawn failure → Error with details

**Example**:
```json
// Input
{
  "prompt": "Refactor the authentication module to use JWT tokens...",
  "path": "/Users/james/Projects/my-app",
  "timeout_seconds": 7200
}

// Output
{
  "task_id": "task_a1b2c3d4",
  "status": "running",
  "message": "Task started. Claude Code is processing your request. Use get_task_status to check progress."
}
```

#### 6.2.2 `get_task_status`

**Purpose**: Get the current status of a task.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "task_id": {
      "type": "string",
      "description": "The task ID returned by start_task"
    }
  },
  "required": ["task_id"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "task_id": { "type": "string" },
    "status": {
      "type": "string",
      "enum": ["pending", "starting", "running", "completed", "failed", "timeout", "killed", "error"]
    },
    "elapsed_seconds": { "type": "integer" },
    "exit_code": { "type": ["integer", "null"] },
    "last_output": {
      "type": "string",
      "description": "Last 500 characters of output (ANSI stripped)"
    },
    "hint": {
      "type": "string",
      "description": "Guidance for next action"
    }
  }
}
```

**Behavior**:
1. Look up task in registry
2. Calculate elapsed time
3. Get last N characters of output from buffer (ANSI stripped)
4. Generate appropriate hint based on status

**Hint Generation Logic**:
```typescript
function generateHint(task: Task): string {
  switch (task.status) {
    case 'pending':
      return 'Task is queued. It will start shortly.';
    case 'starting':
      return 'Task is initializing. Please check back in 10 seconds.';
    case 'running':
      const elapsed = Math.floor((Date.now() - task.startedAt!.getTime()) / 1000);
      if (elapsed < 60) {
        return 'Task is still processing. Please check back in 30 seconds.';
      } else if (elapsed < 300) {
        return 'Task is actively running. Please check back in 1 minute.';
      } else {
        return 'Task is running a long operation. Please check back in 2-3 minutes.';
      }
    case 'completed':
      return 'Task completed successfully. Review the output above.';
    case 'failed':
      return `Task failed with exit code ${task.exitCode}. Review the error output above.`;
    case 'timeout':
      return 'Task exceeded the timeout limit and was terminated.';
    case 'killed':
      return 'Task was manually terminated.';
    case 'error':
      return 'An internal error occurred. Check server logs for details.';
  }
}
```

**Example**:
```json
// Input
{ "task_id": "task_a1b2c3d4" }

// Output (running)
{
  "task_id": "task_a1b2c3d4",
  "status": "running",
  "elapsed_seconds": 145,
  "exit_code": null,
  "last_output": "...Analyzing dependencies...\nFound 23 TypeScript files...\nProcessing src/auth/...",
  "hint": "Task is actively running. Please check back in 1 minute."
}

// Output (completed)
{
  "task_id": "task_a1b2c3d4",
  "status": "completed",
  "elapsed_seconds": 892,
  "exit_code": 0,
  "last_output": "...Successfully refactored auth module.\n\nModified files:\n- src/auth/jwt.ts\n- src/auth/middleware.ts\n- tests/auth.test.ts\n\nDone.",
  "hint": "Task completed successfully. Review the output above."
}
```

#### 6.2.3 `kill_task`

**Purpose**: Terminate a running task.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "task_id": {
      "type": "string",
      "description": "The task ID to terminate"
    }
  },
  "required": ["task_id"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "task_id": { "type": "string" },
    "status": { "type": "string" },
    "message": { "type": "string" }
  }
}
```

**Behavior**:
1. Look up task in registry
2. If not running, return error
3. Send SIGTERM to process
4. Wait 5 seconds
5. If still running, send SIGKILL
6. Update task status to `killed`
7. Release project lock

**Example**:
```json
// Input
{ "task_id": "task_a1b2c3d4" }

// Output
{
  "task_id": "task_a1b2c3d4",
  "status": "killed",
  "message": "Task terminated successfully."
}
```

### 6.3 Project Tools

#### 6.3.1 `set_active_project`

**Purpose**: Set the default working directory for subsequent operations.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Project directory path"
    }
  },
  "required": ["path"]
}
```

**Behavior**:
1. Validate path exists
2. Validate path is within allowed_roots
3. Store as active project in server state

**Example**:
```json
// Input
{ "path": "/Users/james/Projects/my-app" }

// Output
{
  "active_project": "/Users/james/Projects/my-app",
  "message": "Active project set. Subsequent operations will use this path by default."
}
```

### 6.4 Filesystem Tools

#### 6.4.1 `list_files`

**Purpose**: List files and directories at a path.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Directory path (defaults to active project)"
    },
    "depth": {
      "type": "integer",
      "description": "Recursion depth (default: from config)",
      "minimum": 1,
      "maximum": 5
    }
  }
}
```

**Behavior**:
1. Use active project if path not specified
2. Validate path within allowed_roots
3. Read directory entries
4. Filter out entries matching .gitignore patterns
5. Filter out hidden files (starting with `.`) except `.claude`
6. Sort: directories first, then files, alphabetically

**Example**:
```json
// Input
{ "path": "/Users/james/Projects/my-app/src" }

// Output
{
  "path": "/Users/james/Projects/my-app/src",
  "entries": [
    { "name": "components", "type": "directory" },
    { "name": "utils", "type": "directory" },
    { "name": "App.tsx", "type": "file", "size": 2048 },
    { "name": "index.ts", "type": "file", "size": 156 }
  ]
}
```

#### 6.4.2 `read_file`

**Purpose**: Read entire file contents.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "File path"
    }
  },
  "required": ["path"]
}
```

**Behavior**:
1. Validate path within allowed_roots
2. Check if file is binary → return error
3. Read file contents
4. Count lines
5. Check size limit (default 1MB) → truncate with warning if exceeded

**Binary Detection**:
```typescript
function isBinaryFile(buffer: Buffer): boolean {
  // Check for null bytes in first 8KB
  const sample = buffer.slice(0, 8192);
  return sample.includes(0);
}
```

**Example**:
```json
// Input
{ "path": "/Users/james/Projects/my-app/src/App.tsx" }

// Output
{
  "path": "/Users/james/Projects/my-app/src/App.tsx",
  "content": "import React from 'react';\n\nexport function App() {\n  return <div>Hello</div>;\n}\n",
  "lines": 5,
  "size_bytes": 89
}

// Error (binary file)
{
  "error": "Cannot read binary file: /Users/james/Projects/my-app/assets/logo.png"
}
```

#### 6.4.3 `read_file_range`

**Purpose**: Read specific lines from a file.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "File path"
    },
    "start_line": {
      "type": "integer",
      "description": "Starting line number (1-indexed)",
      "minimum": 1
    },
    "end_line": {
      "type": "integer",
      "description": "Ending line number (inclusive)",
      "minimum": 1
    }
  },
  "required": ["path", "start_line", "end_line"]
}
```

**Behavior**:
1. Validate path within allowed_roots
2. Check if binary → error
3. Read file and split into lines
4. Extract requested range (clamp to actual file length)
5. Return lines with metadata

**Example**:
```json
// Input
{
  "path": "/Users/james/Projects/my-app/src/App.tsx",
  "start_line": 10,
  "end_line": 25
}

// Output
{
  "path": "/Users/james/Projects/my-app/src/App.tsx",
  "start_line": 10,
  "end_line": 25,
  "content": "  const [count, setCount] = useState(0);\n\n  return (\n    <div>\n      ...",
  "total_lines": 150
}
```

#### 6.4.4 `get_file_tree`

**Purpose**: Get a formatted directory tree.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Root directory path (defaults to active project)"
    },
    "depth": {
      "type": "integer",
      "description": "Maximum depth (default: from config)",
      "minimum": 1,
      "maximum": 5
    }
  }
}
```

**Behavior**:
1. Use active project if path not specified
2. Validate path within allowed_roots
3. Recursively build tree, respecting .gitignore
4. Format as ASCII tree

**Example**:
```json
// Input
{ "path": "/Users/james/Projects/my-app", "depth": 2 }

// Output
{
  "path": "/Users/james/Projects/my-app",
  "tree": "my-app/\n├── src/\n│   ├── components/\n│   ├── utils/\n│   ├── App.tsx\n│   └── index.ts\n├── tests/\n│   └── App.test.tsx\n├── package.json\n├── tsconfig.json\n└── README.md"
}
```

#### 6.4.5 `create_directory`

**Purpose**: Create a new directory.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Directory path to create"
    }
  },
  "required": ["path"]
}
```

**Behavior**:
1. Validate path within allowed_roots
2. Create directory with parents (mkdir -p)
3. Return success/failure

**Example**:
```json
// Input
{ "path": "/Users/james/Projects/new-project/src/components" }

// Output
{
  "path": "/Users/james/Projects/new-project/src/components",
  "created": true,
  "message": "Directory created successfully."
}
```

#### 6.4.6 `write_file`

**Purpose**: Write content to a file.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "File path to write"
    },
    "content": {
      "type": "string",
      "description": "Content to write"
    }
  },
  "required": ["path", "content"]
}
```

**Behavior**:
1. Validate path within allowed_roots
2. Create parent directories if needed
3. Write content to file
4. Return file size

**Example**:
```json
// Input
{
  "path": "/Users/james/Projects/new-project/README.md",
  "content": "# My New Project\n\nThis is a new project.\n"
}

// Output
{
  "path": "/Users/james/Projects/new-project/README.md",
  "size_bytes": 42,
  "message": "File written successfully."
}
```

#### 6.4.7 `init_git_repo`

**Purpose**: Initialize a git repository.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Directory to initialize as git repo"
    }
  },
  "required": ["path"]
}
```

**Behavior**:
1. Validate path within allowed_roots
2. Check if already a git repo
3. Run `git init`
4. Optionally create .gitignore with common patterns

**Example**:
```json
// Input
{ "path": "/Users/james/Projects/new-project" }

// Output
{
  "path": "/Users/james/Projects/new-project",
  "initialized": true,
  "message": "Git repository initialized."
}
```

### 6.5 Git Tools

#### 6.5.1 `git_status`

**Purpose**: Get repository status.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Repository path (defaults to active project)"
    }
  }
}
```

**Behavior**:
1. Use active project if path not specified
2. Validate path within allowed_roots
3. Run `git status --porcelain -b`
4. Parse output into structured format

**Example**:
```json
// Input
{ "path": "/Users/james/Projects/my-app" }

// Output
{
  "path": "/Users/james/Projects/my-app",
  "clean": false,
  "branch": "main",
  "ahead": 2,
  "behind": 0,
  "staged": ["src/auth/jwt.ts"],
  "modified": ["src/auth/middleware.ts", "tests/auth.test.ts"],
  "untracked": ["notes.txt"]
}
```

#### 6.5.2 `git_diff_stat`

**Purpose**: Get compact diff statistics.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Repository path (defaults to active project)"
    },
    "cached": {
      "type": "boolean",
      "description": "Show staged changes only (default: false)"
    }
  }
}
```

**Behavior**:
1. Use active project if path not specified
2. Validate path within allowed_roots
3. Run `git diff --stat` (or `git diff --cached --stat`)
4. Parse output

**Example**:
```json
// Input
{ "path": "/Users/james/Projects/my-app" }

// Output
{
  "path": "/Users/james/Projects/my-app",
  "files": [
    { "file": "src/auth/jwt.ts", "insertions": 45, "deletions": 12 },
    { "file": "src/auth/middleware.ts", "insertions": 8, "deletions": 3 }
  ],
  "summary": "2 files changed, 53 insertions(+), 15 deletions(-)"
}
```

#### 6.5.3 `git_diff`

**Purpose**: Get full diff output.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Repository path (defaults to active project)"
    },
    "cached": {
      "type": "boolean",
      "description": "Show staged changes only (default: false)"
    }
  }
}
```

**Behavior**:
1. Use active project if path not specified
2. Validate path within allowed_roots
3. Run `git diff` (or `git diff --cached`)
4. Check output size against max_diff_size_bytes
5. Truncate if needed, set truncated flag

**Example**:
```json
// Input
{ "path": "/Users/james/Projects/my-app", "cached": true }

// Output
{
  "path": "/Users/james/Projects/my-app",
  "diff": "diff --git a/src/auth/jwt.ts b/src/auth/jwt.ts\nindex abc123..def456 100644\n--- a/src/auth/jwt.ts\n+++ b/src/auth/jwt.ts\n@@ -1,5 +1,10 @@\n...",
  "truncated": false,
  "message": "Full diff output."
}

// Output (truncated)
{
  "path": "/Users/james/Projects/my-app",
  "diff": "diff --git a/src/...[truncated]",
  "truncated": true,
  "message": "Diff truncated at 50KB. Use git_diff_stat for summary."
}
```

---

## 7. MCP Resources Specification

### 7.1 Resource Registry

| URI Pattern | Description |
|-------------|-------------|
| `logs://{task_id}` | Full log output for a task |
| `tasks://active` | List of currently active tasks |
| `config://current` | Current server configuration |

### 7.2 `logs://{task_id}`

**Purpose**: Retrieve full log output for a task.

**URI Template**: `logs://{task_id}`

**Response**: Plain text log content (ANSI stripped).

**Behavior**:
1. Look up task in registry
2. Find log file path
3. Read and return contents
4. Strip ANSI codes

**Example**:
```
URI: logs://task_a1b2c3d4

Response:
[2024-01-15T10:30:45Z] Task started
[2024-01-15T10:30:45Z] Prompt: Refactor authentication module...
[2024-01-15T10:30:46Z] Claude Code output:
Analyzing project structure...
Found 23 TypeScript files
Processing src/auth/jwt.ts...
...
[2024-01-15T10:45:22Z] Task completed with exit code 0
```

### 7.3 `tasks://active`

**Purpose**: List currently running tasks.

**URI**: `tasks://active`

**Response**: JSON array of task summaries.

**Behavior**:
1. Filter task registry for non-terminal statuses
2. Return summary for each

**Example**:
```json
{
  "tasks": [
    {
      "id": "task_a1b2c3d4",
      "status": "running",
      "projectPath": "/Users/james/Projects/my-app",
      "createdAt": "2024-01-15T10:30:45Z",
      "elapsedSeconds": 892
    }
  ]
}
```

### 7.4 `config://current`

**Purpose**: View current server configuration.

**URI**: `config://current`

**Response**: JSON configuration (sanitized).

**Behavior**:
1. Return current loaded configuration
2. Exclude sensitive fields if any

**Example**:
```json
{
  "allowed_roots": ["/Users/james/Projects", "/Users/james/Work"],
  "default_timeout_seconds": 3600,
  "max_log_size_bytes": 10485760,
  "task_history_size": 20,
  "default_tree_depth": 2,
  "max_diff_size_bytes": 51200
}
```

---

## 8. PTY Management System

### 8.1 PTY Manager Interface

```typescript
// src/services/pty-manager.ts

import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { stripAnsi } from '../utils/ansi';
import { Config } from '../config/schema';

export interface PtySession {
  id: string;
  pty: pty.IPty;
  outputBuffer: string;
  outputFile: fs.WriteStream;
  startedAt: Date;
  exitCode: number | null;
  exited: boolean;
}

export interface PtyManagerEvents {
  'output': (sessionId: string, data: string) => void;
  'exit': (sessionId: string, exitCode: number) => void;
  'error': (sessionId: string, error: Error) => void;
}

export class PtyManager extends EventEmitter {
  private sessions: Map<string, PtySession> = new Map();
  private config: Config;
  private approvalPatterns: RegExp[];

  constructor(config: Config) {
    super();
    this.config = config;
    this.approvalPatterns = config.auto_approve_patterns.map(p => new RegExp(p, 'i'));
  }

  /**
   * Spawn a new PTY session for Claude Code.
   */
  async spawn(
    sessionId: string,
    projectPath: string,
    promptFile: string,
    permissionMode: 'auto' | 'cautious'
  ): Promise<void> {
    // Ensure log directory exists
    const logDir = path.join(projectPath, '.claude', 'mcp-logs');
    await fs.promises.mkdir(logDir, { recursive: true });

    // Create log file
    const logPath = path.join(logDir, `task_${sessionId}.log`);
    const outputFile = fs.createWriteStream(logPath, { flags: 'a' });

    // Build command
    // We pipe the prompt file to claude
    const command = `cat "${promptFile}" | ${this.config.claude_command}`;

    // Spawn PTY
    const ptyProcess = pty.spawn(this.config.shell, ['-c', command], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: projectPath,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        // Force non-interactive mode if available
        CI: 'true',
        CLAUDE_CODE_ENTRYPOINT: 'mcp-bridge',
      },
    });

    const session: PtySession = {
      id: sessionId,
      pty: ptyProcess,
      outputBuffer: '',
      outputFile,
      startedAt: new Date(),
      exitCode: null,
      exited: false,
    };

    this.sessions.set(sessionId, session);

    // Handle output
    ptyProcess.onData((data: string) => {
      this.handleOutput(session, data, permissionMode);
    });

    // Handle exit
    ptyProcess.onExit(({ exitCode }) => {
      session.exitCode = exitCode;
      session.exited = true;
      outputFile.end();
      this.emit('exit', sessionId, exitCode);
    });
  }

  /**
   * Handle output from PTY.
   */
  private handleOutput(
    session: PtySession,
    data: string,
    permissionMode: 'auto' | 'cautious'
  ): void {
    // Write raw output to log file
    session.outputFile.write(data);

    // Strip ANSI for buffer
    const cleanData = stripAnsi(data);
    session.outputBuffer += cleanData;

    // Keep buffer at reasonable size (last 10KB)
    if (session.outputBuffer.length > 10240) {
      session.outputBuffer = session.outputBuffer.slice(-10240);
    }

    // Emit for listeners
    this.emit('output', session.id, cleanData);

    // Check for approval prompts (auto mode only)
    if (permissionMode === 'auto') {
      this.checkForApprovalPrompt(session, data);
    }
  }

  /**
   * Check if output contains an approval prompt and auto-respond.
   */
  private checkForApprovalPrompt(session: PtySession, data: string): void {
    for (const pattern of this.approvalPatterns) {
      if (pattern.test(data)) {
        // Small delay to ensure prompt is ready for input
        setTimeout(() => {
          if (!session.exited) {
            session.pty.write('y\n');
          }
        }, 100);
        break;
      }
    }
  }

  /**
   * Get the last N characters of output for a session.
   */
  getLastOutput(sessionId: string, chars: number = 500): string {
    const session = this.sessions.get(sessionId);
    if (!session) return '';
    return session.outputBuffer.slice(-chars);
  }

  /**
   * Kill a PTY session.
   */
  async kill(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || session.exited) return false;

    // Try SIGTERM first
    session.pty.kill('SIGTERM');

    // Wait up to 5 seconds for graceful exit
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (session.exited) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        if (!session.exited) {
          // Force kill
          session.pty.kill('SIGKILL');
        }
        resolve();
      }, 5000);
    });

    return true;
  }

  /**
   * Check if a session exists and is running.
   */
  isRunning(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session !== undefined && !session.exited;
  }

  /**
   * Get session info.
   */
  getSession(sessionId: string): PtySession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Clean up completed sessions older than the given age.
   */
  cleanup(maxAgeMs: number = 3600000): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.exited && now - session.startedAt.getTime() > maxAgeMs) {
        this.sessions.delete(id);
      }
    }
  }

  /**
   * Kill all running sessions (for shutdown).
   */
  async killAll(): Promise<void> {
    const promises = [];
    for (const [id, session] of this.sessions) {
      if (!session.exited) {
        promises.push(this.kill(id));
      }
    }
    await Promise.all(promises);
  }
}
```

### 8.2 ANSI Stripping Utility

```typescript
// src/utils/ansi.ts

/**
 * Strip ANSI escape codes from a string.
 * Handles colors, cursor movement, and other terminal sequences.
 */
export function stripAnsi(str: string): string {
  // Comprehensive ANSI escape code pattern
  const ansiPattern = [
    // Standard ANSI escape sequences
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    // SGR (Select Graphic Rendition) sequences
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
  ].join('|');

  const regex = new RegExp(ansiPattern, 'g');
  return str.replace(regex, '');
}

/**
 * Check if a string contains ANSI escape codes.
 */
export function hasAnsi(str: string): boolean {
  const ansiPattern = /[\u001B\u009B]/;
  return ansiPattern.test(str);
}
```

---

## 9. Task Lifecycle Management

### 9.1 Task Manager Implementation

```typescript
// src/services/task-manager.ts

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import { 
  Task, 
  TaskStatus, 
  TaskSummary, 
  StartTaskInput, 
  PermissionMode 
} from '../types/task.types';
import { PtyManager } from './pty-manager';
import { Config } from '../config/schema';
import { generateTaskId } from '../utils/id-generator';

export class TaskManager extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private projectLocks: Map<string, string> = new Map(); // projectPath -> taskId
  private taskHistory: Task[] = [];
  private ptyManager: PtyManager;
  private config: Config;
  private activeProject: string | null = null;

  constructor(config: Config) {
    super();
    this.config = config;
    this.ptyManager = new PtyManager(config);
    this.setupPtyListeners();
  }

  private setupPtyListeners(): void {
    this.ptyManager.on('output', (sessionId: string, data: string) => {
      const task = this.tasks.get(sessionId);
      if (task) {
        task.lastOutput = data.slice(-500);
        task.outputSizeBytes += Buffer.byteLength(data);
      }
    });

    this.ptyManager.on('exit', (sessionId: string, exitCode: number) => {
      const task = this.tasks.get(sessionId);
      if (task) {
        task.exitCode = exitCode;
        task.completedAt = new Date();
        task.status = exitCode === 0 ? 'completed' : 'failed';
        
        // Release project lock
        this.projectLocks.delete(task.projectPath);
        
        // Add to history
        this.addToHistory(task);
        
        this.emit('taskCompleted', task);
      }
    });
  }

  /**
   * Set the active project for default path resolution.
   */
  setActiveProject(projectPath: string): void {
    this.activeProject = projectPath;
  }

  /**
   * Get the active project path.
   */
  getActiveProject(): string | null {
    return this.activeProject;
  }

  /**
   * Resolve a path, using active project as default.
   */
  resolvePath(inputPath?: string): string {
    if (inputPath) return inputPath;
    if (this.activeProject) return this.activeProject;
    throw new Error('No path specified and no active project set. Use set_active_project first.');
  }

  /**
   * Start a new task.
   */
  async startTask(input: StartTaskInput): Promise<Task> {
    const projectPath = path.resolve(input.path);
    const timeout = input.timeout_seconds ?? this.config.default_timeout_seconds;
    const permissionMode = input.permission_mode ?? 'auto';

    // Check for existing task on this project
    if (this.projectLocks.has(projectPath)) {
      const existingTaskId = this.projectLocks.get(projectPath)!;
      throw new Error(
        `A task is already running for this project. ` +
        `Existing task ID: ${existingTaskId}. ` +
        `Use kill_task to terminate it first.`
      );
    }

    // Generate task ID
    const taskId = generateTaskId();

    // Create task entry
    const task: Task = {
      id: taskId,
      status: 'pending',
      projectPath,
      prompt: input.prompt,
      permissionMode,
      timeoutSeconds: timeout,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      pid: null,
      exitCode: null,
      logFile: path.join(projectPath, '.claude', 'mcp-logs', `task_${taskId}.log`),
      lastOutput: '',
      outputSizeBytes: 0,
    };

    this.tasks.set(taskId, task);
    this.projectLocks.set(projectPath, taskId);

    // Write prompt to file
    const promptFile = await this.writePromptFile(projectPath, taskId, input.prompt);

    // Update status
    task.status = 'starting';

    try {
      // Spawn PTY
      await this.ptyManager.spawn(taskId, projectPath, promptFile, permissionMode);
      
      task.status = 'running';
      task.startedAt = new Date();

      // Set up timeout
      this.setupTimeout(taskId, timeout);

      return task;
    } catch (error) {
      task.status = 'error';
      task.completedAt = new Date();
      this.projectLocks.delete(projectPath);
      throw error;
    }
  }

  /**
   * Write prompt to a file for piping to Claude Code.
   */
  private async writePromptFile(
    projectPath: string,
    taskId: string,
    prompt: string
  ): Promise<string> {
    const logDir = path.join(projectPath, '.claude', 'mcp-logs');
    await fs.promises.mkdir(logDir, { recursive: true });

    // Also ensure .gitignore exists for mcp-logs
    await this.ensureGitignore(projectPath);

    const promptFile = path.join(logDir, `prompt_${taskId}.md`);
    await fs.promises.writeFile(promptFile, prompt, 'utf-8');
    return promptFile;
  }

  /**
   * Ensure .claude/mcp-logs is in .gitignore.
   */
  private async ensureGitignore(projectPath: string): Promise<void> {
    const gitignorePath = path.join(projectPath, '.gitignore');
    const pattern = '.claude/mcp-logs/';

    try {
      let content = '';
      if (fs.existsSync(gitignorePath)) {
        content = await fs.promises.readFile(gitignorePath, 'utf-8');
      }

      if (!content.includes(pattern)) {
        const newContent = content + (content.endsWith('\n') ? '' : '\n') + pattern + '\n';
        await fs.promises.writeFile(gitignorePath, newContent);
      }
    } catch {
      // Ignore errors - not critical
    }
  }

  /**
   * Set up task timeout.
   */
  private setupTimeout(taskId: string, timeoutSeconds: number): void {
    setTimeout(async () => {
      const task = this.tasks.get(taskId);
      if (task && task.status === 'running') {
        await this.killTask(taskId);
        task.status = 'timeout';
      }
    }, timeoutSeconds * 1000);
  }

  /**
   * Get task status.
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get task status summary.
   */
  getTaskStatus(taskId: string): TaskSummary | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const elapsed = task.startedAt
      ? Math.floor((Date.now() - task.startedAt.getTime()) / 1000)
      : 0;

    return {
      id: task.id,
      status: task.status,
      projectPath: task.projectPath,
      createdAt: task.createdAt.toISOString(),
      elapsedSeconds: elapsed,
      lastOutput: this.ptyManager.getLastOutput(taskId, 500),
    };
  }

  /**
   * Kill a running task.
   */
  async killTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status !== 'running' && task.status !== 'starting') {
      return false;
    }

    const killed = await this.ptyManager.kill(taskId);
    
    if (killed) {
      task.status = 'killed';
      task.completedAt = new Date();
      this.projectLocks.delete(task.projectPath);
      this.addToHistory(task);
    }

    return killed;
  }

  /**
   * Get all active tasks.
   */
  getActiveTasks(): TaskSummary[] {
    const active: TaskSummary[] = [];
    for (const task of this.tasks.values()) {
      if (['pending', 'starting', 'running'].includes(task.status)) {
        active.push(this.getTaskStatus(task.id)!);
      }
    }
    return active;
  }

  /**
   * Add task to history ring buffer.
   */
  private addToHistory(task: Task): void {
    this.taskHistory.unshift(task);
    if (this.taskHistory.length > this.config.task_history_size) {
      this.taskHistory.pop();
    }
  }

  /**
   * Get task history.
   */
  getHistory(): Task[] {
    return [...this.taskHistory];
  }

  /**
   * Shutdown: kill all running tasks.
   */
  async shutdown(): Promise<void> {
    await this.ptyManager.killAll();
  }
}
```

### 9.2 Task ID Generator

```typescript
// src/utils/id-generator.ts

import { randomBytes } from 'crypto';

/**
 * Generate a unique task ID.
 * Format: task_<8 random hex chars>
 */
export function generateTaskId(): string {
  const random = randomBytes(4).toString('hex');
  return `task_${random}`;
}
```

---

## 10. Filesystem Operations

### 10.1 Filesystem Service

```typescript
// src/services/filesystem.service.ts

import * as fs from 'fs';
import * as path from 'path';
import { isBinaryFile } from '../utils/binary-detector';
import { PathSecurity } from '../utils/path-security';
import { GitignoreParser } from '../utils/gitignore-parser';
import { Config } from '../config/schema';
import {
  FileEntry,
  ListFilesOutput,
  ReadFileOutput,
  ReadFileRangeOutput,
} from '../types/tool.types';

export class FilesystemService {
  private pathSecurity: PathSecurity;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.pathSecurity = new PathSecurity(config.allowed_roots);
  }

  /**
   * Validate that a path is within allowed roots.
   */
  validatePath(inputPath: string): string {
    return this.pathSecurity.validate(inputPath);
  }

  /**
   * List files in a directory.
   */
  async listFiles(dirPath: string, depth: number = 1): Promise<ListFilesOutput> {
    const validPath = this.validatePath(dirPath);
    
    const entries: FileEntry[] = [];
    const gitignore = new GitignoreParser(validPath);

    const items = await fs.promises.readdir(validPath, { withFileTypes: true });

    for (const item of items) {
      // Skip hidden files (except .claude)
      if (item.name.startsWith('.') && item.name !== '.claude') {
        continue;
      }

      // Check gitignore
      const fullPath = path.join(validPath, item.name);
      if (gitignore.isIgnored(fullPath)) {
        continue;
      }

      const entry: FileEntry = {
        name: item.name,
        type: item.isDirectory() ? 'directory' : 'file',
      };

      if (item.isFile()) {
        try {
          const stats = await fs.promises.stat(fullPath);
          entry.size = stats.size;
        } catch {
          // Ignore stat errors
        }
      }

      entries.push(entry);
    }

    // Sort: directories first, then files, alphabetically
    entries.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      path: validPath,
      entries,
    };
  }

  /**
   * Read entire file contents.
   */
  async readFile(filePath: string): Promise<ReadFileOutput> {
    const validPath = this.validatePath(filePath);

    // Check if file exists
    const stats = await fs.promises.stat(validPath);
    if (stats.isDirectory()) {
      throw new Error(`Path is a directory, not a file: ${validPath}`);
    }

    // Check if binary
    const buffer = await fs.promises.readFile(validPath);
    if (isBinaryFile(buffer)) {
      throw new Error(`Cannot read binary file: ${validPath}`);
    }

    const content = buffer.toString('utf-8');
    const lines = content.split('\n').length;

    // Check size limit (1MB default)
    const maxSize = 1024 * 1024;
    if (buffer.length > maxSize) {
      return {
        path: validPath,
        content: content.slice(0, maxSize) + '\n\n[... FILE TRUNCATED AT 1MB ...]',
        lines,
        size_bytes: buffer.length,
      };
    }

    return {
      path: validPath,
      content,
      lines,
      size_bytes: buffer.length,
    };
  }

  /**
   * Read specific line range from a file.
   */
  async readFileRange(
    filePath: string,
    startLine: number,
    endLine: number
  ): Promise<ReadFileRangeOutput> {
    const validPath = this.validatePath(filePath);

    // Read file
    const buffer = await fs.promises.readFile(validPath);
    if (isBinaryFile(buffer)) {
      throw new Error(`Cannot read binary file: ${validPath}`);
    }

    const content = buffer.toString('utf-8');
    const allLines = content.split('\n');
    const totalLines = allLines.length;

    // Clamp line numbers (1-indexed)
    const start = Math.max(1, startLine);
    const end = Math.min(totalLines, endLine);

    // Extract lines (convert to 0-indexed)
    const selectedLines = allLines.slice(start - 1, end);

    return {
      path: validPath,
      start_line: start,
      end_line: end,
      content: selectedLines.join('\n'),
      total_lines: totalLines,
    };
  }

  /**
   * Get formatted directory tree.
   */
  async getFileTree(dirPath: string, depth: number = 2): Promise<string> {
    const validPath = this.validatePath(dirPath);
    const baseName = path.basename(validPath);
    const gitignore = new GitignoreParser(validPath);

    const lines: string[] = [`${baseName}/`];
    await this.buildTree(validPath, '', depth, lines, gitignore);

    return lines.join('\n');
  }

  private async buildTree(
    dirPath: string,
    prefix: string,
    depth: number,
    lines: string[],
    gitignore: GitignoreParser
  ): Promise<void> {
    if (depth <= 0) return;

    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });

    // Filter and sort items
    const filtered = items.filter((item) => {
      if (item.name.startsWith('.') && item.name !== '.claude') return false;
      const fullPath = path.join(dirPath, item.name);
      return !gitignore.isIgnored(fullPath);
    });

    filtered.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) {
        return a.isDirectory() ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    for (let i = 0; i < filtered.length; i++) {
      const item = filtered[i];
      const isLast = i === filtered.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = isLast ? '    ' : '│   ';

      if (item.isDirectory()) {
        lines.push(`${prefix}${connector}${item.name}/`);
        await this.buildTree(
          path.join(dirPath, item.name),
          prefix + childPrefix,
          depth - 1,
          lines,
          gitignore
        );
      } else {
        lines.push(`${prefix}${connector}${item.name}`);
      }
    }
  }

  /**
   * Create a directory (with parents).
   */
  async createDirectory(dirPath: string): Promise<boolean> {
    const validPath = this.validatePath(dirPath);
    await fs.promises.mkdir(validPath, { recursive: true });
    return true;
  }

  /**
   * Write content to a file.
   */
  async writeFile(filePath: string, content: string): Promise<number> {
    const validPath = this.validatePath(filePath);

    // Create parent directories if needed
    const parentDir = path.dirname(validPath);
    await fs.promises.mkdir(parentDir, { recursive: true });

    // Write file
    await fs.promises.writeFile(validPath, content, 'utf-8');

    return Buffer.byteLength(content, 'utf-8');
  }

  /**
   * Initialize a git repository.
   */
  async initGitRepo(dirPath: string): Promise<boolean> {
    const validPath = this.validatePath(dirPath);

    // Check if already a git repo
    const gitDir = path.join(validPath, '.git');
    if (fs.existsSync(gitDir)) {
      return false; // Already initialized
    }

    // Create directory if needed
    await fs.promises.mkdir(validPath, { recursive: true });

    // Run git init
    const { execSync } = await import('child_process');
    execSync('git init', { cwd: validPath, stdio: 'pipe' });

    return true;
  }
}
```

### 10.2 Path Security Utility

```typescript
// src/utils/path-security.ts

import * as path from 'path';
import * as os from 'os';

export class PathSecurity {
  private allowedRoots: string[];

  constructor(allowedRoots: string[]) {
    // Normalize and expand paths
    this.allowedRoots = allowedRoots.map((root) => {
      const expanded = root.replace(/^~/, os.homedir());
      return path.resolve(expanded);
    });
  }

  /**
   * Validate that a path is within allowed roots.
   * Returns the normalized absolute path.
   * Throws if path is outside allowed roots.
   */
  validate(inputPath: string): string {
    // Expand ~ and resolve to absolute path
    const expanded = inputPath.replace(/^~/, os.homedir());
    const absolute = path.resolve(expanded);

    // Check if path is within any allowed root
    const isAllowed = this.allowedRoots.some((root) => {
      return absolute === root || absolute.startsWith(root + path.sep);
    });

    if (!isAllowed) {
      throw new Error(
        `Path '${inputPath}' is not within allowed roots. ` +
        `Allowed roots: ${this.allowedRoots.join(', ')}`
      );
    }

    return absolute;
  }

  /**
   * Get the list of allowed roots.
   */
  getAllowedRoots(): string[] {
    return [...this.allowedRoots];
  }
}
```

### 10.3 Binary File Detector

```typescript
// src/utils/binary-detector.ts

/**
 * Check if a buffer contains binary content.
 * Uses the presence of null bytes as the primary indicator.
 */
export function isBinaryFile(buffer: Buffer): boolean {
  // Check first 8KB for null bytes
  const sampleSize = Math.min(buffer.length, 8192);
  
  for (let i = 0; i < sampleSize; i++) {
    if (buffer[i] === 0) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a file extension is typically binary.
 */
export function isBinaryExtension(filename: string): boolean {
  const binaryExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib',
    '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv',
    '.ttf', '.otf', '.woff', '.woff2',
    '.pyc', '.class', '.o', '.obj',
  ]);

  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return binaryExtensions.has(ext);
}
```

### 10.4 Gitignore Parser

```typescript
// src/utils/gitignore-parser.ts

import * as fs from 'fs';
import * as path from 'path';
import ignore, { Ignore } from 'ignore';

export class GitignoreParser {
  private ig: Ignore;
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.ig = ignore();

    // Always ignore node_modules, .git, etc.
    this.ig.add([
      'node_modules',
      '.git',
      '__pycache__',
      '*.pyc',
      '.DS_Store',
      'Thumbs.db',
    ]);

    // Load .gitignore if present
    const gitignorePath = path.join(rootPath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      try {
        const content = fs.readFileSync(gitignorePath, 'utf-8');
        this.ig.add(content);
      } catch {
        // Ignore read errors
      }
    }
  }

  /**
   * Check if a path should be ignored.
   */
  isIgnored(fullPath: string): boolean {
    // Get relative path from root
    const relativePath = path.relative(this.rootPath, fullPath);
    if (!relativePath || relativePath.startsWith('..')) {
      return false;
    }

    return this.ig.ignores(relativePath);
  }
}
```

---

## 11. Git Operations

### 11.1 Git Service

```typescript
// src/services/git.service.ts

import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import * as path from 'path';
import { PathSecurity } from '../utils/path-security';
import { Config } from '../config/schema';
import {
  GitStatusOutput,
  GitDiffStatOutput,
  GitDiffFileStat,
  GitDiffOutput,
} from '../types/tool.types';

export class GitService {
  private pathSecurity: PathSecurity;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.pathSecurity = new PathSecurity(config.allowed_roots);
  }

  /**
   * Execute a git command in a directory.
   */
  private exec(command: string, cwd: string): string {
    const options: ExecSyncOptionsWithStringEncoding = {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
      stdio: ['pipe', 'pipe', 'pipe'],
    };

    try {
      return execSync(command, options).trim();
    } catch (error: any) {
      if (error.stderr) {
        throw new Error(`Git error: ${error.stderr}`);
      }
      throw error;
    }
  }

  /**
   * Check if a directory is a git repository.
   */
  isGitRepo(dirPath: string): boolean {
    try {
      this.exec('git rev-parse --git-dir', dirPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get repository status.
   */
  getStatus(dirPath: string): GitStatusOutput {
    const validPath = this.pathSecurity.validate(dirPath);

    if (!this.isGitRepo(validPath)) {
      throw new Error(`Not a git repository: ${validPath}`);
    }

    // Get branch info
    const branchOutput = this.exec('git status --porcelain -b', validPath);
    const lines = branchOutput.split('\n');

    // Parse branch line
    let branch = 'unknown';
    let ahead = 0;
    let behind = 0;

    if (lines[0]?.startsWith('##')) {
      const branchLine = lines[0].slice(3);
      const branchMatch = branchLine.match(/^([^.]+)/);
      if (branchMatch) {
        branch = branchMatch[1];
      }
      
      const aheadMatch = branchLine.match(/ahead (\d+)/);
      if (aheadMatch) {
        ahead = parseInt(aheadMatch[1], 10);
      }
      
      const behindMatch = branchLine.match(/behind (\d+)/);
      if (behindMatch) {
        behind = parseInt(behindMatch[1], 10);
      }
    }

    // Parse file statuses
    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const indexStatus = line[0];
      const workTreeStatus = line[1];
      const filename = line.slice(3);

      if (indexStatus !== ' ' && indexStatus !== '?') {
        staged.push(filename);
      }
      if (workTreeStatus === 'M') {
        modified.push(filename);
      }
      if (indexStatus === '?' && workTreeStatus === '?') {
        untracked.push(filename);
      }
    }

    return {
      path: validPath,
      clean: staged.length === 0 && modified.length === 0 && untracked.length === 0,
      branch,
      ahead,
      behind,
      staged,
      modified,
      untracked,
    };
  }

  /**
   * Get diff statistics.
   */
  getDiffStat(dirPath: string, cached: boolean = false): GitDiffStatOutput {
    const validPath = this.pathSecurity.validate(dirPath);

    if (!this.isGitRepo(validPath)) {
      throw new Error(`Not a git repository: ${validPath}`);
    }

    const command = cached ? 'git diff --cached --stat' : 'git diff --stat';
    const output = this.exec(command, validPath);

    const files: GitDiffFileStat[] = [];
    const lines = output.split('\n');
    let summary = '';

    for (const line of lines) {
      // File stat line: " src/file.ts | 10 ++++----"
      const fileMatch = line.match(/^\s*(.+?)\s+\|\s+(\d+)\s+(\+*)(-*)/);
      if (fileMatch) {
        files.push({
          file: fileMatch[1].trim(),
          insertions: fileMatch[3].length,
          deletions: fileMatch[4].length,
        });
      }

      // Summary line: " 3 files changed, 25 insertions(+), 10 deletions(-)"
      if (line.includes('files changed') || line.includes('file changed')) {
        summary = line.trim();
      }
    }

    return {
      path: validPath,
      files,
      summary: summary || 'No changes',
    };
  }

  /**
   * Get full diff output.
   */
  getDiff(dirPath: string, cached: boolean = false): GitDiffOutput {
    const validPath = this.pathSecurity.validate(dirPath);

    if (!this.isGitRepo(validPath)) {
      throw new Error(`Not a git repository: ${validPath}`);
    }

    const command = cached ? 'git diff --cached' : 'git diff';
    let output: string;
    
    try {
      output = this.exec(command, validPath);
    } catch (error) {
      output = '';
    }

    // Check size limit
    const maxSize = this.config.max_diff_size_bytes;
    let truncated = false;
    let message = 'Full diff output.';

    if (Buffer.byteLength(output) > maxSize) {
      output = output.slice(0, maxSize) + '\n\n[... DIFF TRUNCATED ...]';
      truncated = true;
      message = `Diff truncated at ${Math.round(maxSize / 1024)}KB. Use git_diff_stat for summary.`;
    }

    if (!output) {
      message = 'No changes to show.';
    }

    return {
      path: validPath,
      diff: output,
      truncated,
      message,
    };
  }
}
```

---

## 12. Logging System

### 12.1 Logger Service

```typescript
// src/services/logger.service.ts

import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class LoggerService {
  private level: LogLevel;
  private logFile: string | null;
  private stream: fs.WriteStream | null = null;
  private maxSizeBytes: number;
  private currentSizeBytes: number = 0;

  constructor(level: LogLevel = 'info', logFile?: string, maxSizeBytes: number = 10 * 1024 * 1024) {
    this.level = level;
    this.logFile = logFile ?? null;
    this.maxSizeBytes = maxSizeBytes;

    if (this.logFile) {
      this.initLogFile();
    }
  }

  private initLogFile(): void {
    if (!this.logFile) return;

    const dir = path.dirname(this.logFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Check existing file size
    if (fs.existsSync(this.logFile)) {
      const stats = fs.statSync(this.logFile);
      this.currentSizeBytes = stats.size;
    }

    this.stream = fs.createWriteStream(this.logFile, { flags: 'a' });
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private format(level: LogLevel, message: string, meta?: object): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  private write(level: LogLevel, message: string, meta?: object): void {
    if (!this.shouldLog(level)) return;

    const formatted = this.format(level, message, meta);

    // Write to stderr (for MCP, stdout is reserved for protocol)
    console.error(formatted);

    // Write to file if configured
    if (this.stream && this.logFile) {
      const line = formatted + '\n';
      const lineBytes = Buffer.byteLength(line);

      // Check for rotation
      if (this.currentSizeBytes + lineBytes > this.maxSizeBytes) {
        this.rotate();
      }

      this.stream.write(line);
      this.currentSizeBytes += lineBytes;
    }
  }

  private rotate(): void {
    if (!this.logFile || !this.stream) return;

    this.stream.end();

    // Rename current file
    const rotatedPath = this.logFile + '.1';
    if (fs.existsSync(rotatedPath)) {
      fs.unlinkSync(rotatedPath);
    }
    fs.renameSync(this.logFile, rotatedPath);

    // Create new file
    this.stream = fs.createWriteStream(this.logFile, { flags: 'a' });
    this.currentSizeBytes = 0;
  }

  debug(message: string, meta?: object): void {
    this.write('debug', message, meta);
  }

  info(message: string, meta?: object): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: object): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta?: object): void {
    this.write('error', message, meta);
  }

  close(): void {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }
}

// Singleton instance
let loggerInstance: LoggerService | null = null;

export function getLogger(): LoggerService {
  if (!loggerInstance) {
    loggerInstance = new LoggerService('info');
  }
  return loggerInstance;
}

export function initLogger(level: LogLevel, logFile?: string, maxSize?: number): LoggerService {
  loggerInstance = new LoggerService(level, logFile, maxSize);
  return loggerInstance;
}
```

---

## 13. Error Handling

### 13.1 Error Types

```typescript
// src/types/errors.ts

export class McpBridgeError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'McpBridgeError';
  }
}

export class PathSecurityError extends McpBridgeError {
  allowedRoots: string[];

  constructor(path: string, allowedRoots: string[]) {
    super(
      'PATH_NOT_ALLOWED',
      `Path '${path}' is not within allowed roots. Allowed roots: ${allowedRoots.join(', ')}`
    );
    this.allowedRoots = allowedRoots;
  }
}

export class TaskNotFoundError extends McpBridgeError {
  taskId: string;

  constructor(taskId: string) {
    super('TASK_NOT_FOUND', `Task not found: ${taskId}`);
    this.taskId = taskId;
  }
}

export class TaskAlreadyRunningError extends McpBridgeError {
  projectPath: string;
  existingTaskId: string;

  constructor(projectPath: string, existingTaskId: string) {
    super(
      'TASK_ALREADY_RUNNING',
      `A task is already running for project ${projectPath}. Existing task ID: ${existingTaskId}`
    );
    this.projectPath = projectPath;
    this.existingTaskId = existingTaskId;
  }
}

export class BinaryFileError extends McpBridgeError {
  filePath: string;

  constructor(filePath: string) {
    super('BINARY_FILE', `Cannot read binary file: ${filePath}`);
    this.filePath = filePath;
  }
}

export class GitError extends McpBridgeError {
  gitMessage: string;

  constructor(message: string) {
    super('GIT_ERROR', message);
    this.gitMessage = message;
  }
}

export class ConfigurationError extends McpBridgeError {
  constructor(message: string) {
    super('CONFIG_ERROR', message);
  }
}
```

### 13.2 Error Handler

```typescript
// src/utils/error-handler.ts

import { McpBridgeError } from '../types/errors';
import { getLogger } from '../services/logger.service';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function handleError(error: unknown): ErrorResponse {
  const logger = getLogger();

  if (error instanceof McpBridgeError) {
    logger.warn(`MCP Bridge Error: ${error.code}`, { message: error.message });
    return {
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  if (error instanceof Error) {
    logger.error(`Unexpected error: ${error.message}`, { stack: error.stack });
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
      },
    };
  }

  logger.error('Unknown error type', { error });
  return {
    error: {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
    },
  };
}
```

---

## 14. Security Model

### 14.1 Security Principles

1. **Path Whitelisting**: All file operations are restricted to `allowed_roots`
2. **No Shell Injection**: Commands are constructed safely, not concatenated
3. **Process Isolation**: Each Claude Code process runs in its designated directory
4. **Input Validation**: All inputs are validated with Zod schemas
5. **Output Sanitization**: ANSI codes are stripped from output

### 14.2 Security Checklist

| Risk | Mitigation |
|------|------------|
| Path traversal (`../../../etc/passwd`) | Absolute path resolution + whitelist check |
| Shell injection via prompt | Prompt written to file, piped to command |
| Runaway processes | Timeout enforcement + kill capability |
| Resource exhaustion | Log rotation, buffer limits |
| Unauthorized directory access | Strict `allowed_roots` enforcement |
| Git command injection | Parameters are not interpolated into commands |

---

## 15. Testing Strategy

### 15.1 Unit Tests

```typescript
// tests/unit/services/task-manager.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskManager } from '../../../src/services/task-manager';
import { MockPty } from '../../mocks/mock-pty';

// Mock node-pty
vi.mock('node-pty', () => ({
  spawn: vi.fn(() => new MockPty()),
}));

describe('TaskManager', () => {
  let taskManager: TaskManager;
  let mockConfig: Config;

  beforeEach(() => {
    mockConfig = {
      allowed_roots: ['/test/projects'],
      default_timeout_seconds: 60,
      task_history_size: 20,
      // ... other defaults
    };
    taskManager = new TaskManager(mockConfig);
  });

  describe('startTask', () => {
    it('should create a task with pending status', async () => {
      const task = await taskManager.startTask({
        prompt: 'Test prompt',
        path: '/test/projects/my-app',
      });

      expect(task.id).toMatch(/^task_[a-f0-9]{8}$/);
      expect(task.status).toBe('running');
      expect(task.projectPath).toBe('/test/projects/my-app');
    });

    it('should reject duplicate tasks for same project', async () => {
      await taskManager.startTask({
        prompt: 'Test prompt',
        path: '/test/projects/my-app',
      });

      await expect(
        taskManager.startTask({
          prompt: 'Another prompt',
          path: '/test/projects/my-app',
        })
      ).rejects.toThrow(/already running/);
    });

    it('should allow tasks for different projects', async () => {
      const task1 = await taskManager.startTask({
        prompt: 'Test prompt 1',
        path: '/test/projects/app-1',
      });

      const task2 = await taskManager.startTask({
        prompt: 'Test prompt 2',
        path: '/test/projects/app-2',
      });

      expect(task1.id).not.toBe(task2.id);
    });
  });

  describe('getTaskStatus', () => {
    it('should return null for unknown task', () => {
      const status = taskManager.getTaskStatus('task_nonexistent');
      expect(status).toBeNull();
    });

    it('should return status for existing task', async () => {
      const task = await taskManager.startTask({
        prompt: 'Test',
        path: '/test/projects/my-app',
      });

      const status = taskManager.getTaskStatus(task.id);
      expect(status).not.toBeNull();
      expect(status!.status).toBe('running');
    });
  });

  describe('killTask', () => {
    it('should terminate a running task', async () => {
      const task = await taskManager.startTask({
        prompt: 'Test',
        path: '/test/projects/my-app',
      });

      const killed = await taskManager.killTask(task.id);
      expect(killed).toBe(true);

      const status = taskManager.getTaskStatus(task.id);
      expect(status!.status).toBe('killed');
    });
  });
});
```

### 15.2 Mock PTY

```typescript
// tests/mocks/mock-pty.ts

import { EventEmitter } from 'events';

export class MockPty extends EventEmitter {
  pid: number = 12345;
  private killed: boolean = false;
  private outputQueue: string[] = [];

  constructor() {
    super();
  }

  write(data: string): void {
    // Simulate input handling
    if (data === 'y\n') {
      // Simulate approval response
      setTimeout(() => {
        this.emitOutput('Approved. Continuing...\n');
      }, 10);
    }
  }

  kill(signal?: string): void {
    if (this.killed) return;
    this.killed = true;

    setTimeout(() => {
      this.emit('exit', { exitCode: signal === 'SIGKILL' ? 137 : 143 });
    }, 100);
  }

  resize(cols: number, rows: number): void {
    // No-op for mock
  }

  // Test helpers
  emitOutput(data: string): void {
    this.emit('data', data);
  }

  simulateExit(exitCode: number = 0): void {
    this.emit('exit', { exitCode });
  }

  simulateLongOutput(chunks: number = 10, delayMs: number = 100): void {
    let i = 0;
    const interval = setInterval(() => {
      this.emitOutput(`Processing chunk ${i + 1}/${chunks}...\n`);
      i++;
      if (i >= chunks) {
        clearInterval(interval);
        this.emitOutput('Done.\n');
        this.simulateExit(0);
      }
    }, delayMs);
  }
}
```

### 15.3 Integration Tests

```typescript
// tests/integration/tools.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createServer } from '../../src/server';

describe('MCP Tools Integration', () => {
  let server: Server;

  beforeEach(async () => {
    // Create server with test config
    server = await createServer({
      allowed_roots: ['/tmp/test-projects'],
      default_timeout_seconds: 10,
    });
  });

  afterEach(async () => {
    // Cleanup
  });

  describe('set_active_project', () => {
    it('should set active project successfully', async () => {
      const result = await server.callTool('set_active_project', {
        path: '/tmp/test-projects/my-app',
      });

      expect(result.active_project).toBe('/tmp/test-projects/my-app');
    });

    it('should reject paths outside allowed roots', async () => {
      await expect(
        server.callTool('set_active_project', {
          path: '/etc/passwd',
        })
      ).rejects.toThrow(/not within allowed roots/);
    });
  });

  describe('list_files', () => {
    it('should list directory contents', async () => {
      // Setup test directory
      // ...

      const result = await server.callTool('list_files', {
        path: '/tmp/test-projects/my-app',
      });

      expect(result.entries).toBeInstanceOf(Array);
    });
  });
});
```

### 15.4 Live Smoke Test Script

```typescript
// scripts/test-live.ts

/**
 * Manual smoke test for claude-code-bridge.
 * Run with: npx ts-node scripts/test-live.ts
 * 
 * Prerequisites:
 * - Claude Code CLI installed and authenticated
 * - A test project directory
 */

import * as readline from 'readline';
import { PtyManager } from '../src/services/pty-manager';
import { configLoader } from '../src/config/loader';

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  console.log('=== Claude Code Bridge Smoke Test ===\n');

  const config = configLoader.load();
  console.log('Loaded config:', JSON.stringify(config, null, 2));

  const testDir = await question('\nEnter test project directory: ');
  const testPrompt = await question('Enter test prompt (e.g., "List the files in this directory"): ');

  console.log('\n--- Starting PTY Test ---\n');

  const ptyManager = new PtyManager(config);

  ptyManager.on('output', (sessionId, data) => {
    process.stdout.write(data);
  });

  ptyManager.on('exit', (sessionId, exitCode) => {
    console.log(`\n--- Process exited with code ${exitCode} ---`);
    rl.close();
    process.exit(exitCode);
  });

  // Write prompt to temp file
  const fs = await import('fs');
  const path = await import('path');
  const promptFile = path.join(testDir, '.claude', 'mcp-logs', 'test_prompt.md');
  
  await fs.promises.mkdir(path.dirname(promptFile), { recursive: true });
  await fs.promises.writeFile(promptFile, testPrompt);

  await ptyManager.spawn('test_session', testDir, promptFile, 'auto');

  console.log('PTY spawned. Waiting for output...\n');
}

main().catch(console.error);
```

---

## 16. Implementation Sequence

### Phase 1: Foundation (Days 1-2)

1. **Project Setup**
   - Initialize npm project with TypeScript
   - Configure ESLint, Prettier, Vitest
   - Set up directory structure
   - Create `package.json` with dependencies

2. **Configuration System**
   - Implement Zod schema
   - Create config loader with env overrides
   - Add defaults
   - Write unit tests

3. **Core Utilities**
   - Path security module
   - ANSI stripping
   - Binary detection
   - ID generation
   - Gitignore parser

### Phase 2: Services (Days 3-4)

4. **Logger Service**
   - Implement structured logging
   - Add file rotation
   - Configure log levels

5. **Filesystem Service**
   - List files
   - Read file / read range
   - Get file tree
   - Create directory
   - Write file
   - Init git repo
   - Write comprehensive tests

6. **Git Service**
   - Status
   - Diff stat
   - Diff (with truncation)
   - Write tests

### Phase 3: PTY & Tasks (Days 5-6)

7. **PTY Manager**
   - Spawn PTY with node-pty
   - Output buffering
   - Expect-send for approvals
   - Process termination
   - Create MockPty for tests

8. **Task Manager**
   - Task lifecycle
   - Project locking
   - Timeout enforcement
   - History management
   - Comprehensive tests

### Phase 4: MCP Integration (Days 7-8)

9. **MCP Server Setup**
   - Initialize with @modelcontextprotocol/sdk
   - Configure stdio transport
   - Set up tool/resource handlers

10. **Tool Registration**
    - Implement all 14 tools
    - Connect to services
    - Add input validation
    - Integration tests

11. **Resource Registration**
    - Logs resource
    - Active tasks resource
    - Config resource

### Phase 5: Polish (Days 9-10)

12. **Error Handling**
    - Custom error types
    - Consistent error responses
    - Error logging

13. **Documentation**
    - README with setup instructions
    - Configuration reference
    - Tool documentation
    - Troubleshooting guide

14. **Final Testing**
    - Run all unit tests
    - Run integration tests
    - Manual smoke tests
    - Edge case verification

---

## 17. File-by-File Specifications

### 17.1 `package.json`

```json
{
  "name": "claude-code-bridge",
  "version": "0.1.0",
  "description": "A bridge enabling Claude.ai to orchestrate long-running Claude Code CLI tasks via PTY, with persistent session management and filesystem access.",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "claude-code-bridge": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:live": "ts-node scripts/test-live.ts",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "ignore": "^5.3.0",
    "node-pty": "^1.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.50.0",
    "prettier": "^3.1.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  },
  "keywords": [
    "mcp",
    "claude",
    "claude-code",
    "ai",
    "automation"
  ],
  "author": "",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": ""
  }
}
```

### 17.2 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 17.3 `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', 'src/index.ts'],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
```

### 17.4 `src/index.ts`

```typescript
#!/usr/bin/env node

/**
 * Claude Code Bridge - MCP Server Entry Point
 * 
 * This server enables Claude.ai to orchestrate Claude Code CLI tasks
 * through the Model Context Protocol.
 */

import { createServer, startServer } from './server.js';
import { configLoader } from './config/index.js';
import { initLogger } from './services/logger.service.js';

async function main(): Promise<void> {
  // Load configuration
  const config = configLoader.load();

  // Initialize logger
  const logger = initLogger(
    config.log_level,
    undefined, // No file logging for MCP server (use stderr)
    config.max_log_size_bytes
  );

  logger.info('Starting Claude Code Bridge MCP Server', {
    version: '0.1.0',
    allowed_roots: config.allowed_roots,
  });

  // Create and start server
  const server = await createServer(config);
  await startServer(server);

  // Handle shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await server.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await server.shutdown();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

### 17.5 `src/server.ts`

```typescript
/**
 * MCP Server Setup and Configuration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { Config } from './config/schema.js';
import { TaskManager } from './services/task-manager.js';
import { FilesystemService } from './services/filesystem.service.js';
import { GitService } from './services/git.service.js';
import { registerTools, handleToolCall } from './tools/index.js';
import { registerResources, handleResourceRead } from './resources/index.js';
import { getLogger } from './services/logger.service.js';

export interface McpBridgeServer {
  server: Server;
  taskManager: TaskManager;
  filesystemService: FilesystemService;
  gitService: GitService;
  shutdown: () => Promise<void>;
}

export async function createServer(config: Config): Promise<McpBridgeServer> {
  const logger = getLogger();

  // Initialize services
  const taskManager = new TaskManager(config);
  const filesystemService = new FilesystemService(config);
  const gitService = new GitService(config);

  // Create MCP server
  const server = new Server(
    {
      name: 'claude-code-bridge',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: registerTools(),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.debug(`Tool call: ${name}`, { args });

    try {
      const result = await handleToolCall(
        name,
        args ?? {},
        { taskManager, filesystemService, gitService, config }
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      logger.error(`Tool error: ${name}`, { error: error.message });
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }],
        isError: true,
      };
    }
  });

  // Register resource handlers
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: registerResources(),
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    logger.debug(`Resource read: ${uri}`);

    try {
      const content = await handleResourceRead(
        uri,
        { taskManager, config }
      );
      return {
        contents: [{ uri, text: content, mimeType: 'application/json' }],
      };
    } catch (error: any) {
      logger.error(`Resource error: ${uri}`, { error: error.message });
      throw error;
    }
  });

  // Shutdown handler
  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down...');
    await taskManager.shutdown();
    await server.close();
  };

  return {
    server,
    taskManager,
    filesystemService,
    gitService,
    shutdown,
  };
}

export async function startServer(bridge: McpBridgeServer): Promise<void> {
  const logger = getLogger();
  const transport = new StdioServerTransport();

  await bridge.server.connect(transport);
  logger.info('MCP server connected via stdio');
}
```

### 17.6 `src/tools/index.ts`

```typescript
/**
 * Tool Registration and Routing
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Config } from '../config/schema.js';
import { TaskManager } from '../services/task-manager.js';
import { FilesystemService } from '../services/filesystem.service.js';
import { GitService } from '../services/git.service.js';

import { taskTools, handleTaskTool } from './task.tools.js';
import { filesystemTools, handleFilesystemTool } from './filesystem.tools.js';
import { gitTools, handleGitTool } from './git.tools.js';
import { projectTools, handleProjectTool } from './project.tools.js';

export interface ToolContext {
  taskManager: TaskManager;
  filesystemService: FilesystemService;
  gitService: GitService;
  config: Config;
}

export function registerTools(): Tool[] {
  return [
    ...taskTools,
    ...projectTools,
    ...filesystemTools,
    ...gitTools,
  ];
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<unknown> {
  // Task tools
  if (['start_task', 'get_task_status', 'kill_task'].includes(name)) {
    return handleTaskTool(name, args, context);
  }

  // Project tools
  if (['set_active_project', 'create_directory', 'write_file', 'init_git_repo'].includes(name)) {
    return handleProjectTool(name, args, context);
  }

  // Filesystem tools
  if (['list_files', 'read_file', 'read_file_range', 'get_file_tree'].includes(name)) {
    return handleFilesystemTool(name, args, context);
  }

  // Git tools
  if (['git_status', 'git_diff_stat', 'git_diff'].includes(name)) {
    return handleGitTool(name, args, context);
  }

  throw new Error(`Unknown tool: ${name}`);
}
```

### 17.7 `src/tools/task.tools.ts`

```typescript
/**
 * Task Management Tools
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext } from './index.js';

export const taskTools: Tool[] = [
  {
    name: 'start_task',
    description: 'Start a Claude Code task asynchronously. Returns immediately with a task ID that can be polled for status.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt to send to Claude Code',
        },
        path: {
          type: 'string',
          description: 'Project directory path (must be within allowed_roots)',
        },
        timeout_seconds: {
          type: 'integer',
          description: 'Task timeout in seconds (default: 3600)',
          minimum: 60,
          maximum: 14400,
        },
        permission_mode: {
          type: 'string',
          enum: ['auto', 'cautious'],
          description: 'How to handle approval prompts (default: auto)',
        },
      },
      required: ['prompt', 'path'],
    },
  },
  {
    name: 'get_task_status',
    description: 'Get the current status of a running or completed task. Use this to poll for task completion.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'The task ID returned by start_task',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'kill_task',
    description: 'Terminate a running task. Use this if a task is stuck or you need to cancel it.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'The task ID to terminate',
        },
      },
      required: ['task_id'],
    },
  },
];

function generateHint(status: string, elapsedSeconds: number, exitCode: number | null): string {
  switch (status) {
    case 'pending':
      return 'Task is queued. It will start shortly.';
    case 'starting':
      return 'Task is initializing. Please check back in 10 seconds.';
    case 'running':
      if (elapsedSeconds < 60) {
        return 'Task is still processing. Please check back in 30 seconds.';
      } else if (elapsedSeconds < 300) {
        return 'Task is actively running. Please check back in 1 minute.';
      } else {
        return 'Task is running a long operation. Please check back in 2-3 minutes.';
      }
    case 'completed':
      return 'Task completed successfully. Review the output above.';
    case 'failed':
      return `Task failed with exit code ${exitCode}. Review the error output above.`;
    case 'timeout':
      return 'Task exceeded the timeout limit and was terminated.';
    case 'killed':
      return 'Task was manually terminated.';
    case 'error':
      return 'An internal error occurred. Check server logs for details.';
    default:
      return '';
  }
}

export async function handleTaskTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<unknown> {
  const { taskManager } = context;

  switch (name) {
    case 'start_task': {
      const task = await taskManager.startTask({
        prompt: args.prompt as string,
        path: args.path as string,
        timeout_seconds: args.timeout_seconds as number | undefined,
        permission_mode: args.permission_mode as 'auto' | 'cautious' | undefined,
      });

      return {
        task_id: task.id,
        status: task.status,
        message: 'Task started. Claude Code is processing your request. Use get_task_status to check progress.',
      };
    }

    case 'get_task_status': {
      const taskId = args.task_id as string;
      const status = taskManager.getTaskStatus(taskId);

      if (!status) {
        throw new Error(`Task not found: ${taskId}`);
      }

      const task = taskManager.getTask(taskId);

      return {
        task_id: status.id,
        status: status.status,
        elapsed_seconds: status.elapsedSeconds,
        exit_code: task?.exitCode ?? null,
        last_output: status.lastOutput,
        hint: generateHint(status.status, status.elapsedSeconds, task?.exitCode ?? null),
      };
    }

    case 'kill_task': {
      const taskId = args.task_id as string;
      const killed = await taskManager.killTask(taskId);

      if (!killed) {
        const task = taskManager.getTask(taskId);
        if (!task) {
          throw new Error(`Task not found: ${taskId}`);
        }
        throw new Error(`Task is not running (status: ${task.status})`);
      }

      return {
        task_id: taskId,
        status: 'killed',
        message: 'Task terminated successfully.',
      };
    }

    default:
      throw new Error(`Unknown task tool: ${name}`);
  }
}
```

### 17.8 `src/tools/filesystem.tools.ts`

```typescript
/**
 * Filesystem Tools
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext } from './index.js';

export const filesystemTools: Tool[] = [
  {
    name: 'list_files',
    description: 'List files and directories at a path. Respects .gitignore and filters hidden files.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path (defaults to active project)',
        },
        depth: {
          type: 'integer',
          description: 'Recursion depth (default: from config)',
          minimum: 1,
          maximum: 5,
        },
      },
    },
  },
  {
    name: 'read_file',
    description: 'Read entire file contents. Cannot read binary files.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file_range',
    description: 'Read specific lines from a file. Useful for examining portions of large files.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path',
        },
        start_line: {
          type: 'integer',
          description: 'Starting line number (1-indexed)',
          minimum: 1,
        },
        end_line: {
          type: 'integer',
          description: 'Ending line number (inclusive)',
          minimum: 1,
        },
      },
      required: ['path', 'start_line', 'end_line'],
    },
  },
  {
    name: 'get_file_tree',
    description: 'Get a formatted directory tree structure. Useful for understanding project layout.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Root directory path (defaults to active project)',
        },
        depth: {
          type: 'integer',
          description: 'Maximum depth (default: from config)',
          minimum: 1,
          maximum: 5,
        },
      },
    },
  },
];

export async function handleFilesystemTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<unknown> {
  const { filesystemService, taskManager, config } = context;

  // Resolve path using active project as default
  const resolvePath = (inputPath?: string): string => {
    if (inputPath) return inputPath;
    const activeProject = taskManager.getActiveProject();
    if (activeProject) return activeProject;
    throw new Error('No path specified and no active project set. Use set_active_project first.');
  };

  switch (name) {
    case 'list_files': {
      const path = resolvePath(args.path as string | undefined);
      const depth = (args.depth as number) ?? config.default_tree_depth;
      return filesystemService.listFiles(path, depth);
    }

    case 'read_file': {
      const path = args.path as string;
      return filesystemService.readFile(path);
    }

    case 'read_file_range': {
      const path = args.path as string;
      const startLine = args.start_line as number;
      const endLine = args.end_line as number;
      return filesystemService.readFileRange(path, startLine, endLine);
    }

    case 'get_file_tree': {
      const path = resolvePath(args.path as string | undefined);
      const depth = (args.depth as number) ?? config.default_tree_depth;
      const tree = await filesystemService.getFileTree(path, depth);
      return { path, tree };
    }

    default:
      throw new Error(`Unknown filesystem tool: ${name}`);
  }
}
```

### 17.9 `src/tools/project.tools.ts`

```typescript
/**
 * Project Management Tools
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext } from './index.js';

export const projectTools: Tool[] = [
  {
    name: 'set_active_project',
    description: 'Set the default working directory for subsequent operations. This path will be used when no explicit path is provided to other tools.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Project directory path',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'create_directory',
    description: 'Create a new directory, including any necessary parent directories.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to create',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file. Creates parent directories if needed.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to write',
        },
        content: {
          type: 'string',
          description: 'Content to write',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'init_git_repo',
    description: 'Initialize a new git repository in a directory.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory to initialize as git repo',
        },
      },
      required: ['path'],
    },
  },
];

export async function handleProjectTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<unknown> {
  const { taskManager, filesystemService } = context;

  switch (name) {
    case 'set_active_project': {
      const path = args.path as string;
      // Validate path first
      const validPath = filesystemService.validatePath(path);
      taskManager.setActiveProject(validPath);
      return {
        active_project: validPath,
        message: 'Active project set. Subsequent operations will use this path by default.',
      };
    }

    case 'create_directory': {
      const path = args.path as string;
      await filesystemService.createDirectory(path);
      return {
        path,
        created: true,
        message: 'Directory created successfully.',
      };
    }

    case 'write_file': {
      const path = args.path as string;
      const content = args.content as string;
      const sizeBytes = await filesystemService.writeFile(path, content);
      return {
        path,
        size_bytes: sizeBytes,
        message: 'File written successfully.',
      };
    }

    case 'init_git_repo': {
      const path = args.path as string;
      const initialized = await filesystemService.initGitRepo(path);
      return {
        path,
        initialized,
        message: initialized
          ? 'Git repository initialized.'
          : 'Directory is already a git repository.',
      };
    }

    default:
      throw new Error(`Unknown project tool: ${name}`);
  }
}
```

### 17.10 `src/tools/git.tools.ts`

```typescript
/**
 * Git Tools
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext } from './index.js';

export const gitTools: Tool[] = [
  {
    name: 'git_status',
    description: 'Get repository status including branch, staged files, modified files, and untracked files.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Repository path (defaults to active project)',
        },
      },
    },
  },
  {
    name: 'git_diff_stat',
    description: 'Get compact diff statistics showing files changed and lines added/removed.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Repository path (defaults to active project)',
        },
        cached: {
          type: 'boolean',
          description: 'Show staged changes only (default: false)',
        },
      },
    },
  },
  {
    name: 'git_diff',
    description: 'Get full diff output. Large diffs are truncated to 50KB.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Repository path (defaults to active project)',
        },
        cached: {
          type: 'boolean',
          description: 'Show staged changes only (default: false)',
        },
      },
    },
  },
];

export async function handleGitTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<unknown> {
  const { gitService, taskManager } = context;

  // Resolve path using active project as default
  const resolvePath = (inputPath?: string): string => {
    if (inputPath) return inputPath;
    const activeProject = taskManager.getActiveProject();
    if (activeProject) return activeProject;
    throw new Error('No path specified and no active project set. Use set_active_project first.');
  };

  switch (name) {
    case 'git_status': {
      const path = resolvePath(args.path as string | undefined);
      return gitService.getStatus(path);
    }

    case 'git_diff_stat': {
      const path = resolvePath(args.path as string | undefined);
      const cached = (args.cached as boolean) ?? false;
      return gitService.getDiffStat(path, cached);
    }

    case 'git_diff': {
      const path = resolvePath(args.path as string | undefined);
      const cached = (args.cached as boolean) ?? false;
      return gitService.getDiff(path, cached);
    }

    default:
      throw new Error(`Unknown git tool: ${name}`);
  }
}
```

### 17.11 `src/resources/index.ts`

```typescript
/**
 * Resource Registration and Routing
 */

import { Resource } from '@modelcontextprotocol/sdk/types.js';
import { Config } from '../config/schema.js';
import { TaskManager } from '../services/task-manager.js';

export interface ResourceContext {
  taskManager: TaskManager;
  config: Config;
}

export function registerResources(): Resource[] {
  return [
    {
      uri: 'logs://{task_id}',
      name: 'Task Logs',
      description: 'Full log output for a completed or running task',
      mimeType: 'text/plain',
    },
    {
      uri: 'tasks://active',
      name: 'Active Tasks',
      description: 'List of currently running tasks',
      mimeType: 'application/json',
    },
    {
      uri: 'config://current',
      name: 'Current Configuration',
      description: 'Server configuration (read-only)',
      mimeType: 'application/json',
    },
  ];
}

export async function handleResourceRead(
  uri: string,
  context: ResourceContext
): Promise<string> {
  const { taskManager, config } = context;

  // Parse URI
  if (uri.startsWith('logs://')) {
    const taskId = uri.slice('logs://'.length);
    return handleLogsResource(taskId, taskManager);
  }

  if (uri === 'tasks://active') {
    return handleTasksResource(taskManager);
  }

  if (uri === 'config://current') {
    return handleConfigResource(config);
  }

  throw new Error(`Unknown resource URI: ${uri}`);
}

async function handleLogsResource(taskId: string, taskManager: TaskManager): Promise<string> {
  const task = taskManager.getTask(taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const fs = await import('fs');
  
  try {
    const content = await fs.promises.readFile(task.logFile, 'utf-8');
    // Strip ANSI codes
    const { stripAnsi } = await import('../utils/ansi.js');
    return stripAnsi(content);
  } catch (error) {
    return `[Log file not available: ${task.logFile}]`;
  }
}

async function handleTasksResource(taskManager: TaskManager): Promise<string> {
  const activeTasks = taskManager.getActiveTasks();
  return JSON.stringify({ tasks: activeTasks }, null, 2);
}

async function handleConfigResource(config: Config): Promise<string> {
  // Return sanitized config (exclude any sensitive fields if present)
  const safeConfig = {
    allowed_roots: config.allowed_roots,
    default_timeout_seconds: config.default_timeout_seconds,
    max_log_size_bytes: config.max_log_size_bytes,
    task_history_size: config.task_history_size,
    default_tree_depth: config.default_tree_depth,
    max_diff_size_bytes: config.max_diff_size_bytes,
  };
  return JSON.stringify(safeConfig, null, 2);
}
```

### 17.12 `README.md`

```markdown
# Claude Code Bridge

A Model Context Protocol (MCP) server that enables Claude.ai to orchestrate long-running Claude Code CLI tasks.

## Overview

Claude Code Bridge eliminates the copy-paste workflow between Claude.ai and Claude Code by providing:

- **Asynchronous task execution** - Start Claude Code tasks and poll for status
- **Native filesystem tools** - Fast, cheap exploration of codebases
- **Git observation tools** - Read-only repository status and diffs
- **Session management** - One task per project with automatic locking

## Installation

```bash
npm install -g claude-code-bridge
```

Or install from source:

```bash
git clone https://github.com/your-username/claude-code-bridge.git
cd claude-code-bridge
npm install
npm run build
```

## Configuration

Create `~/.config/mcp-claude-bridge/config.json`:

```json
{
  "allowed_roots": [
    "/Users/your-username/Projects",
    "/Users/your-username/Work"
  ],
  "default_timeout_seconds": 3600,
  "log_level": "info"
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `allowed_roots` | string[] | **Required** | Directories Claude Code can access |
| `default_timeout_seconds` | number | 3600 | Task timeout (1 hour) |
| `max_log_size_bytes` | number | 10MB | Log file rotation size |
| `task_history_size` | number | 20 | Tasks kept in history |
| `default_tree_depth` | number | 2 | File tree depth |
| `max_diff_size_bytes` | number | 50KB | Git diff truncation limit |
| `shell` | string | /bin/bash | Shell for PTY |
| `claude_command` | string | claude | Claude Code CLI command |
| `log_level` | string | info | Log verbosity |

### Environment Variables

Override config values with environment variables:

- `MCP_ALLOWED_ROOTS` - Comma-separated paths
- `MCP_DEFAULT_TIMEOUT` - Timeout in seconds
- `MCP_LOG_LEVEL` - debug, info, warn, error

## Claude Desktop Integration

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "claude-code-bridge": {
      "command": "npx",
      "args": ["claude-code-bridge"]
    }
  }
}
```

## Tools

### Task Management

- `start_task` - Start a Claude Code task asynchronously
- `get_task_status` - Poll task status
- `kill_task` - Terminate a running task

### Project Management

- `set_active_project` - Set default working directory
- `create_directory` - Create directories
- `write_file` - Write files
- `init_git_repo` - Initialize git repository

### Filesystem

- `list_files` - List directory contents
- `read_file` - Read file contents
- `read_file_range` - Read specific lines
- `get_file_tree` - Get directory tree

### Git (Read-Only)

- `git_status` - Repository status
- `git_diff_stat` - Diff statistics
- `git_diff` - Full diff output

## Resources

- `logs://{task_id}` - Full task log output
- `tasks://active` - Currently running tasks
- `config://current` - Server configuration

## Usage Example

```
Claude.ai: "I want to add authentication to my Express app at /Users/me/Projects/my-api"

1. set_active_project("/Users/me/Projects/my-api")
2. get_file_tree() - Explore structure
3. read_file("src/server.ts") - Understand current code
4. git_status() - Check for uncommitted changes
5. start_task("Add JWT authentication...") - Start Claude Code
6. get_task_status(task_id) - Poll until complete
7. git_diff_stat() - Review changes
```

## Security

- All file operations restricted to `allowed_roots`
- One task per project (prevents conflicts)
- Automatic process termination on timeout
- No shell injection (prompts piped via files)

## Development

```bash
npm run dev      # Run with ts-node
npm run test     # Run tests
npm run lint     # Check linting
npm run build    # Compile TypeScript
```

## License

MIT
```

---

## Summary

This specification provides a complete, implementation-ready blueprint for `claude-code-bridge` v0.1.0. The key architectural decisions are:

1. **TypeScript + Node.js** with `node-pty` for PTY management
2. **Async job queue** with polling for long-running tasks
3. **14 tools** spanning task management, filesystem, and git operations
4. **3 resources** for logs, active tasks, and configuration
5. **Strict path whitelisting** for security
6. **MockPty-based testing** (no real Claude Code in CI)
7. **Unix-focused** (macOS/Linux) for v1

The modular architecture ensures high separation of concerns, with dedicated services for task management, filesystem operations, git operations, and PTY management. The comprehensive type system and Zod validation provide type safety throughout.
