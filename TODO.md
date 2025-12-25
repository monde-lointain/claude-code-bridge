# Claude Code Bridge — Implementation Plan

## Overview
- **Total Tasks**: 78
- **Estimated Phases**: 6
- **Target**: Fully functional, tested MCP server ready for deployment.

## Task Status Legend
- [ ] Not started
- [x] Completed
- [~] In progress
- [!] Blocked

---

## Phase 1: Foundation & Configuration (Sequential)
*Goal: Establish the project skeleton, type systems, and configuration logic.*

### P1-001: Project Initialization ✓
- **Description**: Initialize npm project and configure core build files.
- **Files**: `package.json`, `.gitignore`, `LICENSE`
- **Acceptance Criteria**:
  - [x] `npm init` completes with details from Spec 17.1.
  - [x] Dependencies (`@modelcontextprotocol/sdk`, `node-pty`, `zod`, `ignore`) installed.
  - [x] Dev dependencies (`typescript`, `vitest`, `eslint`, `prettier`, etc.) installed.
  - [x] `.gitignore` includes `node_modules`, `dist`, `.env`, `.claude/mcp-logs`.
- **Dependencies**: None

### P1-002: TypeScript & Test Config ✓
- **Description**: Configure TypeScript and Vitest environments.
- **Files**: `tsconfig.json`, `vitest.config.ts`, `.eslintrc.json`, `.prettierrc`
- **Acceptance Criteria**:
  - [x] `tsconfig.json` matches Spec 17.2 (ES2022, NodeNext, Strict).
  - [x] `vitest.config.ts` matches Spec 17.3.
  - [x] Linting (`npm run lint`) and formatting (`npm run format`) scripts work.
- **Dependencies**: P1-001

### P1-003: Directory Structure ✓
- **Description**: Create the complete directory tree.
- **Files**: `src/{config,tools,resources,services,utils,types}`, `tests/{unit,integration,mocks,fixtures}`
- **Acceptance Criteria**:
  - [x] All directories from Spec Section 3 exist.
  - [x] Empty `index.ts` files created in each `src` subdirectory to allow imports.
- **Dependencies**: P1-001

### P1-004: Type Definitions (Shared) ✓
- **Description**: Define core interfaces used across the app to prevent circular dependency issues later.
- **Files**: `src/types/{index.ts, task.types.ts, tool.types.ts, resource.types.ts, config.types.ts}`
- **Acceptance Criteria**:
  - [x] `Task`, `TaskStatus`, `PermissionMode` interfaces defined.
  - [x] Tool input/output interfaces (FS, Git, Project) defined.
  - [x] Resource interfaces defined.
  - [x] Config interface defined.
- **Dependencies**: P1-003

### P1-005: Error System ✓
- **Description**: Define custom error types early so Services can use them immediately.
- **Files**: `src/types/errors.ts`, `src/utils/error-handler.ts`
- **Acceptance Criteria**:
  - [x] `McpBridgeError` base class implemented.
  - [x] Specific errors: `PathSecurityError`, `TaskNotFoundError`, `BinaryFileError`, `GitError` implemented.
  - [x] `handleError` utility returns structured JSON `ErrorResponse`.
- **Dependencies**: P1-004

### P1-006: Configuration System ✓
- **Description**: Implement Zod schema, defaults, and the config loader.
- **Files**: `src/config/{schema.ts, defaults.ts, loader.ts, index.ts}`
- **Acceptance Criteria**:
  - [x] Zod schema implements all validation rules from Spec 4.2.
  - [x] `ConfigLoader` prioritizes: Env Vars > File > Defaults.
  - [x] `validateAllowedRoots` warns (doesn't crash) on missing directories.
- **Dependencies**: P1-004

### P1-007: Config Loader Tests ✓
- **Description**: Unit tests for configuration logic.
- **Files**: `tests/unit/config/loader.test.ts`
- **Acceptance Criteria**:
  - [x] Test env var overrides.
  - [x] Test invalid schema throws error.
  - [x] Test default values fallback.
- **Dependencies**: P1-006

---

## Phase 2: Core Utilities (Parallelizable)
*Goal: Build the low-level helpers required by the services.*

### Parallel Group A: Security & Validation
#### P2-001: Path Security Utility ✓
- **Description**: Implement strict path whitelisting.
- **Files**: `src/utils/path-security.ts`
- **Acceptance Criteria**:
  - [x] Expands `~` to user home.
  - [x] `validate(path)` throws `PathSecurityError` if outside `allowed_roots`.
  - [x] Resolves relative paths before checking.

#### P2-002: Path Security Tests ✓
- **Files**: `tests/unit/utils/path-security.test.ts`
- **Acceptance Criteria**:
  - [x] Test path traversal attempts (`../`).
  - [x] Test exact match and subdirectory match.

### Parallel Group B: Content Handling
#### P2-003: Binary & ANSI Utilities ✓
- **Description**: Implement binary file detection and ANSI stripping.
- **Files**: `src/utils/ansi.ts`, `src/utils/binary-detector.ts`
- **Acceptance Criteria**:
  - [x] `isBinaryFile` correctly identifies null bytes in first 8KB.
  - [x] `stripAnsi` removes colors and cursor codes.

#### P2-004: Content Utility Tests ✓
- **Files**: `tests/unit/utils/ansi.test.ts`, `tests/unit/utils/binary-detector.test.ts`
- **Acceptance Criteria**:
  - [x] Verify text files pass binary check.
  - [x] Verify ANSI codes are removed from mixed strings.

### Parallel Group C: Git & ID Helpers
#### P2-005: Gitignore Parser & ID Generator
- **Description**: Parse .gitignore files and generate Task IDs.
- **Files**: `src/utils/gitignore-parser.ts`, `src/utils/id-generator.ts`
- **Acceptance Criteria**:
  - [ ] `generateTaskId` produces `task_<hex>` format.
  - [ ] `GitignoreParser` respects root `.gitignore` and default ignores (`node_modules`).

#### P2-006: Gitignore & ID Tests
- **Files**: `tests/unit/utils/gitignore-parser.test.ts`
- **Acceptance Criteria**:
  - [ ] Test that `node_modules` is always ignored.
  - [ ] Test file-specific ignore rules.

---

## Phase 3: Core Services (Parallelizable)
*Goal: Implement the heavy lifting logic. Note: Error Handling (P1-005) is now available.*

### Parallel Group A: Filesystem Service
#### P3-001: Filesystem Service (Read Operations)
- **Description**: Implement safe reading and listing.
- **Files**: `src/services/filesystem.service.ts` (Part 1)
- **Acceptance Criteria**:
  - [ ] `listFiles`: Uses `PathSecurity`, respects `GitignoreParser`, sorts output.
  - [ ] `readFile`: Uses `BinaryDetector`, enforces 1MB limit (truncates).
  - [ ] `readFileRange`: Clamps line numbers, handles out-of-bounds.
  - [ ] `getFileTree`: Generates ASCII tree respecting depth.

#### P3-002: Filesystem Service (Write Operations)
- **Description**: Implement modification methods.
- **Files**: `src/services/filesystem.service.ts` (Part 2)
- **Acceptance Criteria**:
  - [ ] `createDirectory`: `mkdir -p` behavior.
  - [ ] `writeFile`: Creates parent dirs if missing.
  - [ ] `initGitRepo`: Idempotent (checks for existing .git).

#### P3-003: Filesystem Service Tests
- **Description**: Comprehensive tests for FS service.
- **Files**: `tests/unit/services/filesystem.service.test.ts`, `tests/fixtures/sample-project/`
- **Acceptance Criteria**:
  - [ ] Setup `tests/fixtures/sample-project` with binary, large text, and ignored files.
  - [ ] Test read restrictions (binary/security).
  - [ ] Test write operations success states.

### Parallel Group B: Git Service
#### P3-004: Git Service (Status & Stat)
- **Description**: Implement status and stats retrieval.
- **Files**: `src/services/git.service.ts` (Part 1)
- **Acceptance Criteria**:
  - [ ] `isGitRepo`: Returns false gracefully.
  - [ ] `getStatus`: Parses porcelain output into structured object.
  - [ ] `getDiffStat`: Parses `--stat` output.

#### P3-005: Git Service (Diff)
- **Description**: Implement full diff with safety limits.
- **Files**: `src/services/git.service.ts` (Part 2)
- **Acceptance Criteria**:
  - [ ] `getDiff`: Enforces `max_diff_size_bytes`.
  - [ ] Returns truncated flag if size exceeded.

#### P3-006: Git Service Tests
- **Files**: `tests/unit/services/git.service.test.ts`
- **Acceptance Criteria**:
  - [ ] Mock `execSync` to return sample git outputs.
  - [ ] Verify parsing logic for status/stats.
  - [ ] Verify truncation logic.

### Parallel Group C: Logging Service
#### P3-007: Logger Service
- **Description**: Structured logging implementation.
- **Files**: `src/services/logger.service.ts`
- **Acceptance Criteria**:
  - [ ] Log to `stderr` (crucial for MCP stdio transport).
  - [ ] File rotation implementation (rename .log to .log.1).
  - [ ] Supports log levels from config.

---

## Phase 4: PTY & Task Management (Sequential)
*Goal: The core orchestration engine. Must be sequential due to high complexity and internal dependencies.*

### P4-001: Mock PTY
- **Description**: Create a robust mock for `node-pty` to allow testing without spawning real shells.
- **Files**: `tests/mocks/mock-pty.ts`
- **Acceptance Criteria**:
  - [ ] Simulates data emission (`on('data')`).
  - [ ] Simulates exit codes.
  - [ ] Simulates input response (auto-approve logic test).

### P4-002: PTY Manager (Core)
- **Description**: Process spawning and output buffering.
- **Files**: `src/services/pty-manager.ts` (Part 1)
- **Acceptance Criteria**:
  - [ ] `spawn`: Launches process with correct env (`TERM`, `CI`).
  - [ ] Output piped to file stream and memory buffer.
  - [ ] `kill`: Implements graceful SIGTERM -> SIGKILL escalation.

### P4-003: PTY Manager (Interaction)
- **Description**: Expect-send logic for auto-approvals.
- **Files**: `src/services/pty-manager.ts` (Part 2)
- **Acceptance Criteria**:
  - [ ] Regex matching against `auto_approve_patterns`.
  - [ ] Auto-writes 'y\n' when pattern matches.
  - [ ] ANSI stripping applied before buffer storage.

### P4-004: PTY Manager Tests
- **Files**: `tests/unit/services/pty-manager.test.ts`
- **Acceptance Criteria**:
  - [ ] Verify output capturing.
  - [ ] Verify auto-approval triggers on mock patterns.
  - [ ] Verify cleanup of old sessions.

### P4-005: Task Manager (Lifecycle)
- **Description**: Task creation, locking, and status tracking.
- **Files**: `src/services/task-manager.ts` (Part 1)
- **Acceptance Criteria**:
  - [ ] `startTask`: Enforces "One task per project" lock.
  - [ ] `writePromptFile`: Saves prompt to `.claude/mcp-logs/`.
  - [ ] History ring buffer maintains `task_history_size`.

### P4-006: Task Manager (Integration)
- **Description**: Connect TaskManager to PtyManager.
- **Files**: `src/services/task-manager.ts` (Part 2)
- **Acceptance Criteria**:
  - [ ] `startTask` calls `PtyManager.spawn`.
  - [ ] Listen to PTY exit events to update Task status (`completed`/`failed`).
  - [ ] Timeout logic: kills task if `timeout_seconds` exceeded.
  - [ ] `getTaskStatus`: Generates user-friendly hints based on runtime.

### P4-007: Task Manager Tests
- **Files**: `tests/unit/services/task-manager.test.ts`
- **Acceptance Criteria**:
  - [ ] Test project locking prevents duplicate tasks.
  - [ ] Test timeout kills task.
  - [ ] Test status transitions (pending -> running -> completed).

---

## Phase 5: MCP Layer (Parallelizable)
*Goal: Expose the services via the Model Context Protocol.*

### Parallel Group A: Task Tools
#### P5-001: Task Tool Handlers
- **Description**: Expose TaskManager methods.
- **Files**: `src/tools/task.tools.ts`
- **Acceptance Criteria**:
  - [ ] `start_task`: Returns task_id immediately.
  - [ ] `get_task_status`: Returns structured status + hint.
  - [ ] `kill_task`: Handles non-existent/already-stopped tasks gracefully.

### Parallel Group B: Project & FS Tools
#### P5-002: Filesystem Tool Handlers
- **Description**: Expose FilesystemService methods.
- **Files**: `src/tools/filesystem.tools.ts`
- **Acceptance Criteria**:
  - [ ] `list_files`, `read_file` mapped correctly.
  - [ ] Default depth applied from config.

#### P5-003: Project Tool Handlers
- **Description**: Expose Project methods.
- **Files**: `src/tools/project.tools.ts`
- **Acceptance Criteria**:
  - [ ] `set_active_project`: Validates path via FilesystemService.
  - [ ] `create_directory`, `write_file`, `init_git_repo` exposed.

### Parallel Group C: Git Tools & Resources
#### P5-004: Git Tool Handlers
- **Description**: Expose GitService methods.
- **Files**: `src/tools/git.tools.ts`
- **Acceptance Criteria**:
  - [ ] `git_status`, `git_diff`, `git_diff_stat` exposed.
  - [ ] `cached` flag supported.

#### P5-005: Resource Handlers
- **Description**: Implement MCP Resources.
- **Files**: `src/resources/index.ts`
- **Acceptance Criteria**:
  - [ ] `logs://{task_id}`: Reads log file, strips ANSI.
  - [ ] `tasks://active`: Lists running tasks.
  - [ ] `config://current`: Returns sanitized config.

### Parallel Group D: Server & Registry
#### P5-006: Tool Registry
- **Description**: Central router for tool calls.
- **Files**: `src/tools/index.ts`
- **Acceptance Criteria**:
  - [ ] `registerTools`: Aggregates all tool arrays.
  - [ ] `handleToolCall`: Routes based on tool name string.

#### P5-007: Server Entry Point
- **Description**: Bootstrapping the MCP server.
- **Files**: `src/server.ts`, `src/index.ts`
- **Acceptance Criteria**:
  - [ ] Initializes all services (Task, FS, Git, Logger).
  - [ ] Connects StdioTransport.
  - [ ] Handles SIGINT/SIGTERM for graceful shutdown (kills child PTYs).

---

## Phase 6: Integration & Polish (Sequential)

### P6-001: Integration Tests
- **Description**: Test the MCP server flow end-to-end (mocked PTY).
- **Files**: `tests/integration/tools.test.ts`, `tests/integration/resources.test.ts`
- **Acceptance Criteria**:
  - [ ] `set_active_project` -> `list_files` flow.
  - [ ] `start_task` -> `get_task_status` flow (using MockPty).
  - [ ] `logs://` resource access.

### P6-002: Live Smoke Test Script
- **Description**: Manual verification script using real node-pty.
- **Files**: `scripts/test-live.ts`
- **Acceptance Criteria**:
  - [ ] Script prompts for input.
  - [ ] Spawns real shell process.
  - [ ] Logs output to console.

### P6-003: Setup Helpers
- **Description**: Helper script for user configuration.
- **Files**: `scripts/setup-config.ts`
- **Acceptance Criteria**:
  - [ ] Interactive CLI to generate `config.json`.
  - [ ] Validates user inputs (paths exist).

### P6-004: Documentation & Licensing
- **Description**: Finalize documentation.
- **Files**: `README.md`, `LICENSE`
- **Acceptance Criteria**:
  - [ ] README matches Spec 17.12.
  - [ ] Installation steps verified.
  - [ ] MIT License added.

### P6-005: Final Build
- **Description**: Verify production build.
- **Files**: `dist/`
- **Acceptance Criteria**:
  - [ ] `npm run build` succeeds.
  - [ ] `npm run typecheck` passes (no `any` leaks).
  - [ ] `npm run test` passes (100% coverage on core paths).

---

## Summary by Phase

| Phase | Description | Task Count |
|-------|-------------|------------|
| 1 | Foundation | 13 |
| 2 | Core Utilities | 9 |
| 3 | Services | 7 |
| 4 | PTY and Task Management | 5 |
| 5 | MCP Integration | 12 |
| 6 | Polish and Documentation | 6 |
| **Total** | | **52** |

---

## Unresolved Questions

1. `ignore` pkg version? Spec uses ^5.3.0, verify compat w/ current
2. node-pty native build issues on CI?
3. MCP SDK version ^1.0.0 - confirm exact version exists
4. Shld config setup script be interactive CLI or just template copy?
5. Test fixtures need real git repo init or mock?
6. Log file location for MCP server (spec says stderr only)?
7. How to test PTY auto-approval w/o real claude CLI?
