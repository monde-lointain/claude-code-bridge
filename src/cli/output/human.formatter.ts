import chalk from 'chalk';
import ora, { Ora } from 'ora';
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

export class HumanFormatter implements OutputFormatter {
  private spinner: Ora | null = null;
  private quiet: boolean;

  constructor(options: { quiet?: boolean; color?: boolean } = {}) {
    this.quiet = options.quiet || false;
  }

  taskStarted(taskId: string, path: string): void {
    if (this.quiet) return;
    console.log(`Starting task in ${chalk.cyan(path)}...`);
    console.log(`Task ID: ${chalk.yellow(taskId)}`);
    console.log('');
  }

  taskStatus(status: TaskStatusResult): void {
    const statusColor = this.getStatusColor(status.status);
    console.log(`Task: ${chalk.yellow(status.task_id)}`);
    console.log(`Status: ${statusColor(status.status)}`);
    console.log(`Elapsed: ${this.formatDuration(status.elapsed_seconds)}`);

    if (status.last_output) {
      console.log('');
      console.log('Recent output:');
      console.log(chalk.dim(status.last_output));
    }
  }

  taskOutput(line: string): void {
    console.log(chalk.dim('> ') + line);
  }

  taskCompleted(result: TaskCompletedResult): void {
    this.stopSpinner(true);
    console.log('');
    console.log(chalk.green('✓ Task completed successfully'));
    console.log(`  Duration: ${this.formatDuration(result.elapsed_seconds)}`);
    if (result.files_modified) {
      console.log(`  Files modified: ${result.files_modified}`);
    }
  }

  taskFailed(result: TaskFailedResult): void {
    this.stopSpinner(false);
    console.log('');
    console.log(chalk.red(`✗ Task failed (exit code ${result.exit_code})`));
    console.log(`  Duration: ${this.formatDuration(result.elapsed_seconds)}`);
  }

  taskKilled(taskId: string): void {
    console.log(chalk.green(`✓ Task ${taskId} terminated`));
  }

  taskList(tasks: any): void {
    console.log(JSON.stringify(tasks, null, 2));
  }

  fileList(result: FileListResult): void {
    console.log(`Directory: ${chalk.cyan(result.path)}`);
    console.log('');

    for (const entry of result.entries) {
      const icon = entry.type === 'directory' ? '📁' : '📄';
      const name = entry.type === 'directory' ? chalk.blue(entry.name + '/') : entry.name;
      const size = entry.size ? this.formatSize(entry.size) : '';
      console.log(`  ${icon} ${name}${size ? '  ' + chalk.dim(size) : ''}`);
    }

    console.log('');
    const dirs = result.entries.filter((e) => e.type === 'directory').length;
    const files = result.entries.filter((e) => e.type === 'file').length;
    console.log(`${result.total} items (${dirs} directories, ${files} files)`);
  }

  fileContent(result: FileContentResult): void {
    console.log(`File: ${chalk.cyan(result.path)}`);
    console.log(
      `Lines: ${result.start_line}-${result.end_line} of ${result.total_lines}`
    );
    console.log('');

    const lines = result.content.split('\n');
    lines.forEach((line, idx) => {
      const lineNum = result.start_line + idx;
      console.log(chalk.dim(`${lineNum.toString().padStart(4)} │ `) + line);
    });
  }

  fileTree(result: FileTreeResult): void {
    console.log(chalk.cyan(result.path));
    this.printTreeNode(result.tree, '', true);
  }

  private printTreeNode(node: any, prefix: string, _isLast: boolean): void {
    if (node.children) {
      node.children.forEach((child: any, idx: number) => {
        const isLastChild = idx === node.children.length - 1;
        const connector = isLastChild ? '└── ' : '├── ';
        const name =
          child.type === 'directory' ? chalk.blue(child.name + '/') : child.name;
        console.log(prefix + connector + name);

        if (child.children) {
          const newPrefix = prefix + (isLastChild ? '    ' : '│   ');
          this.printTreeNode(child, newPrefix, isLastChild);
        }
      });
    }
  }

  gitStatus(result: GitStatusResult): void {
    console.log(`Branch: ${chalk.cyan(result.branch)}`);
    if (result.ahead || result.behind) {
      console.log(
        `  ${chalk.yellow(`ahead ${result.ahead}, behind ${result.behind}`)}`
      );
    }
    console.log('');

    if (result.staged.length > 0) {
      console.log(chalk.green('Staged:'));
      result.staged.forEach((f) => console.log(`  ${f.status}  ${f.path}`));
      console.log('');
    }

    if (result.modified.length > 0) {
      console.log(chalk.yellow('Modified:'));
      result.modified.forEach((f) => console.log(`  ${f.status}  ${f.path}`));
      console.log('');
    }

    if (result.untracked.length > 0) {
      console.log(chalk.dim('Untracked:'));
      result.untracked.forEach((f) => console.log(`  ?  ${f}`));
    }
  }

  gitDiff(result: GitDiffResult): void {
    if (result.files_changed !== undefined) {
      console.log(
        `${result.files_changed} files changed, ${chalk.green(`+${result.insertions}`)} insertions, ${chalk.red(`-${result.deletions}`)} deletions`
      );
    } else {
      console.log(result.diff);
    }
  }

  startSpinner(message: string): void {
    if (this.quiet) return;
    this.spinner = ora(message).start();
  }

  stopSpinner(success = true, message?: string): void {
    if (!this.spinner) return;
    if (success) {
      this.spinner.succeed(message);
    } else {
      this.spinner.fail(message);
    }
    this.spinner = null;
  }

  success(message: string): void {
    console.log(chalk.green('✓ ') + message);
  }

  error(message: string, hint?: string): void {
    console.error(chalk.red('✗ ') + message);
    if (hint) {
      console.error(chalk.dim('  Tip: ') + hint);
    }
  }

  info(message: string): void {
    if (!this.quiet) {
      console.log(chalk.blue('ℹ ') + message);
    }
  }

  warn(message: string): void {
    console.log(chalk.yellow('⚠ ') + message);
  }

  private getStatusColor(status: string): (s: string) => string {
    switch (status) {
      case 'completed':
        return chalk.green;
      case 'running':
        return chalk.blue;
      case 'pending':
      case 'starting':
        return chalk.yellow;
      case 'failed':
      case 'timeout':
      case 'killed':
        return chalk.red;
      default:
        return chalk.white;
    }
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
