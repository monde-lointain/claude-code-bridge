export class CLIError extends Error {
  constructor(
    message: string,
    public exitCode: number = 1,
    public hint?: string
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

export class TaskNotFoundError extends CLIError {
  constructor(taskId: string) {
    super(
      `Task not found: ${taskId}`,
      1,
      "Run 'ccb task list' to see available tasks."
    );
  }
}

export class PathNotAllowedError extends CLIError {
  constructor(path: string) {
    super(
      `Path not in allowed_roots: ${path}`,
      1,
      "Add this path to 'allowed_roots' in ~/.config/mcp-claude-bridge/config.json"
    );
  }
}

export class ServerSpawnError extends CLIError {
  constructor(message: string) {
    super(
      `Failed to start MCP server: ${message}`,
      1,
      "Run 'ccb doctor' to diagnose environment issues."
    );
  }
}
