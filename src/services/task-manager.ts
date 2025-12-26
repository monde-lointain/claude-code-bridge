import { EventEmitter } from 'node:events';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  Task,
  TaskSummary,
  StartTaskInput,
} from '../types/task.types.js';
import { PtyManager } from './pty-manager.js';
import { Config } from '../config/schema.js';
import { generateTaskId } from '../utils/id-generator.js';

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
    throw new Error(
      'No path specified and no active project set. Use set_active_project first.'
    );
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
    const killPromises: Promise<boolean>[] = [];
    for (const taskId of this.ptyManager.getAllSessionIds()) {
      killPromises.push(this.ptyManager.kill(taskId));
    }
    await Promise.all(killPromises);
  }
}

/**
 * Generate a hint based on task status and elapsed time.
 */
export function generateHint(task: Task): string {
  switch (task.status) {
    case 'pending':
      return 'Task is queued. It will start shortly.';
    case 'starting':
      return 'Task is initializing. Please check back in 10 seconds.';
    case 'running': {
      const elapsed = task.startedAt
        ? Math.floor((Date.now() - task.startedAt.getTime()) / 1000)
        : 0;
      if (elapsed < 60) {
        return 'Task is still processing. Please check back in 30 seconds.';
      } else if (elapsed < 300) {
        return 'Task is actively running. Please check back in 1 minute.';
      } else {
        return 'Task is running a long operation. Please check back in 2-3 minutes.';
      }
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
