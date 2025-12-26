# Claude Code Bridge

A Model Context Protocol (MCP) server that enables Claude.ai to orchestrate long-running Claude Code CLI tasks.

## Overview

Claude Code Bridge eliminates the copy-paste workflow between Claude.ai and Claude Code by providing:

- **Asynchronous task execution** - Start Claude Code tasks and poll for status
- **Native filesystem tools** - Fast, cheap exploration of codebases
- **Git observation tools** - Read-only repository status and diffs
- **Session management** - One task per project with automatic locking

## Features

- 15 MCP tools for task orchestration, filesystem access, and git operations
- 3 MCP resources for logs, active tasks, and configuration
- PTY-based task execution with auto-approval of prompts
- Path whitelisting for security
- TypeScript implementation with full type safety
- Comprehensive test suite with MockPty

## Installation

Install globally via npm:

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
| `max_log_size_bytes` | number | 10485760 | Log file rotation size (10MB) |
| `task_history_size` | number | 20 | Tasks kept in history |
| `default_tree_depth` | number | 2 | File tree depth |
| `max_diff_size_bytes` | number | 51200 | Git diff truncation limit (50KB) |
| `shell` | string | /bin/bash | Shell for PTY |
| `claude_command` | string | claude | Claude Code CLI command |
| `log_level` | string | info | Log verbosity (debug, info, warn, error) |

### Environment Variables

Override config values with environment variables:

- `MCP_ALLOWED_ROOTS` - Comma-separated paths
- `MCP_DEFAULT_TIMEOUT` - Timeout in seconds
- `MCP_LOG_LEVEL` - debug, info, warn, error

## Claude Desktop Integration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

- **`start_task`** - Start a Claude Code task asynchronously with a prompt and project path
- **`get_task_status`** - Poll task status, elapsed time, and last output
- **`kill_task`** - Terminate a running task

### Project Management

- **`set_active_project`** - Set default working directory for subsequent operations
- **`get_active_project`** - Get the current active project directory
- **`create_directory`** - Create directories with parent creation
- **`write_file`** - Write content to files
- **`init_git_repo`** - Initialize a git repository

### Filesystem

- **`list_files`** - List directory contents (respects .gitignore)
- **`read_file`** - Read entire file contents or header lines
- **`read_file_range`** - Read specific line ranges from large files
- **`file_tree`** - Get recursive directory tree structure

### Git (Read-Only)

- **`git_status`** - Repository status including branch, staged, modified, and untracked files
- **`git_diff_stat`** - Compact diff statistics showing files changed and lines added/removed
- **`git_diff`** - Full diff output (truncated to 50KB for large diffs)

## Resources

- **`logs://{task_id}`** - Full log output for a completed or running task (text/plain)
- **`tasks://active`** - List of currently running tasks (application/json)
- **`config://current`** - Server configuration, read-only (application/json)

## Usage Example

```
Claude.ai: "I want to add authentication to my Express app at /Users/me/Projects/my-api"

1. set_active_project("/Users/me/Projects/my-api")
2. file_tree() - Explore project structure
3. read_file("src/server.ts") - Understand current code
4. git_status() - Check for uncommitted changes
5. start_task("Add JWT authentication with bcrypt and express-jwt...") - Start Claude Code
6. get_task_status(task_id) - Poll until complete
7. git_diff_stat() - Review changes made
```

## Security

- All file operations restricted to `allowed_roots`
- One task per project prevents concurrent access conflicts
- Automatic process termination on timeout
- No shell injection (prompts piped via files)
- Filesystem validation rejects path traversal attempts

## Development

```bash
npm run dev              # Run with tsx
npm run test             # Run tests with vitest
npm run test:coverage    # Run tests with coverage
npm run lint             # Check linting with eslint
npm run format           # Format code with prettier
npm run build            # Compile TypeScript
npm run typecheck        # Type check without emitting
```

## License

MIT
