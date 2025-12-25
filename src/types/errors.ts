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
