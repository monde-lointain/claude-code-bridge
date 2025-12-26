import {
  TaskStatusResult,
  TaskCompletedResult,
  TaskFailedResult,
  FileListResult,
  FileContentResult,
  FileTreeResult,
  GitStatusResult,
  GitDiffResult,
} from '../../shared/tool-types.js';

export interface OutputFormatter {
  taskStarted(taskId: string, path: string): void;
  taskStatus(status: TaskStatusResult): void;
  taskCompleted(result: TaskCompletedResult): void;
  taskFailed(result: TaskFailedResult): void;
  taskKilled(taskId: string): void;
  taskOutput(line: string): void;
  taskList(tasks: any): void;

  fileList(result: FileListResult): void;
  fileContent(result: FileContentResult): void;
  fileTree(result: FileTreeResult): void;

  gitStatus(result: GitStatusResult): void;
  gitDiff(result: GitDiffResult): void;

  success(message: string): void;
  error(message: string, hint?: string): void;
  info(message: string): void;
  warn(message: string): void;

  startSpinner(message: string): void;
  stopSpinner(success?: boolean, message?: string): void;
}
