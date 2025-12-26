import { OutputFormatter } from './formatter.js';
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

export class JSONFormatter implements OutputFormatter {
  private output: any = {};

  taskStarted(taskId: string, path: string): void {
    this.output = { task_id: taskId, path, status: 'started' };
  }

  taskStatus(status: TaskStatusResult): void {
    this.output = status;
  }

  taskCompleted(result: TaskCompletedResult): void {
    this.output = { ...result, status: 'completed' };
    this.flush();
  }

  taskFailed(result: TaskFailedResult): void {
    this.output = { ...result, status: 'failed' };
    this.flush();
  }

  taskKilled(taskId: string): void {
    this.output = { task_id: taskId, status: 'killed' };
    this.flush();
  }

  taskOutput(line: string): void {
    // Accumulate output
    if (!this.output.output) {
      this.output.output = [];
    }
    this.output.output.push(line);
  }

  taskList(tasks: any): void {
    this.output = tasks;
    this.flush();
  }

  fileList(result: FileListResult): void {
    this.output = result;
    this.flush();
  }

  fileContent(result: FileContentResult): void {
    this.output = result;
    this.flush();
  }

  fileTree(result: FileTreeResult): void {
    this.output = result;
    this.flush();
  }

  gitStatus(result: GitStatusResult): void {
    this.output = result;
    this.flush();
  }

  gitDiff(result: GitDiffResult): void {
    this.output = result;
    this.flush();
  }

  success(message: string): void {
    this.output.message = message;
    this.output.success = true;
  }

  error(message: string, hint?: string): void {
    this.output.error = message;
    if (hint) this.output.hint = hint;
    this.flush();
  }

  info(message: string): void {
    this.output.info = message;
  }

  warn(message: string): void {
    this.output.warning = message;
  }

  startSpinner(): void {}
  stopSpinner(): void {}

  flush(): void {
    console.log(JSON.stringify(this.output, null, 2));
  }
}
