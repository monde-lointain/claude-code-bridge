import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { EventEmitter } from 'node:events';
import type { Config } from '../../src/config/schema.js';

// Mock node-pty before importing services
class MockPtyProcess extends EventEmitter {
  pid = 12345;
  private killed = false;

  write(data: string): void {
    if (data === 'y\n') {
      setTimeout(() => this.emit('data', 'Approved.\n'), 10);
    }
  }

  kill(signal?: string): void {
    if (this.killed) return;
    this.killed = true;
    setTimeout(() => this.emit('exit', { exitCode: signal === 'SIGKILL' ? 137 : 0 }), 50);
  }

  resize(): void {}

  onData(callback: (data: string) => void): void {
    this.on('data', callback);
  }

  onExit(callback: (event: { exitCode: number }) => void): void {
    this.on('exit', callback);
  }

  // Test helpers
  emitData(data: string): void { this.emit('data', data); }
  emitExit(exitCode: number): void { this.emit('exit', { exitCode }); }
}

let mockPtyInstance: MockPtyProcess;

vi.mock('node-pty', () => ({
  spawn: vi.fn(() => {
    mockPtyInstance = new MockPtyProcess();
    return mockPtyInstance;
  }),
}));

// Import after mocking
const { registerResources, handleResourceRead } = await import('../../src/resources/index.js');
const { TaskManager } = await import('../../src/services/task-manager.js');

type ResourceContext = {
  taskManager: InstanceType<typeof TaskManager>;
  config: Config;
};

describe('Resources Integration', () => {
  let tempDir: string;
  let context: ResourceContext;
  let config: Config;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resources-integration-test-'));

    config = {
      allowed_roots: [tempDir],
      default_timeout_seconds: 3600,
      max_log_size_bytes: 10485760,
      task_history_size: 20,
      default_tree_depth: 2,
      max_diff_size_bytes: 51200,
      default_header_lines: 50,
      shell: '/bin/bash',
      claude_command: 'claude',
      auto_approve_patterns: [],
      log_level: 'info',
    };

    const taskManager = new TaskManager(config);

    context = {
      taskManager,
      config,
    };
  });

  afterEach(async () => {
    // Shutdown task manager to prevent file handle leaks
    await context.taskManager.shutdown();
    // Small delay for file handles to close
    await new Promise(resolve => setTimeout(resolve, 100));
    vi.clearAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('registerResources', () => {
    it('should register all resources', () => {
      const resources = registerResources();

      expect(resources).toHaveLength(3);

      const uris = resources.map(r => r.uri);
      expect(uris).toContain('logs://{task_id}');
      expect(uris).toContain('tasks://active');
      expect(uris).toContain('config://current');

      resources.forEach(resource => {
        expect(resource).toHaveProperty('name');
        expect(resource).toHaveProperty('description');
        expect(resource).toHaveProperty('mimeType');
      });
    });
  });

  describe('Resource: logs://{task_id}', () => {
    it('should read task logs', async () => {
      // Setup: Create task with log file
      const logDir = path.join(tempDir, '.claude', 'mcp-logs');
      fs.mkdirSync(logDir, { recursive: true });

      const task = await context.taskManager.startTask({
        prompt: 'Test task',
        path: tempDir,
      });

      // Write some log data
      const logContent = 'Task started\nProcessing...\nTask completed\n';
      fs.writeFileSync(task.logFile, logContent);

      // Read logs resource
      const logs = await handleResourceRead(`logs://${task.id}`, context);

      expect(logs).toContain('Task started');
      expect(logs).toContain('Processing');
      expect(logs).toContain('Task completed');
    });

    it('should strip ANSI codes from logs', async () => {
      const logDir = path.join(tempDir, '.claude', 'mcp-logs');
      fs.mkdirSync(logDir, { recursive: true });

      const task = await context.taskManager.startTask({
        prompt: 'Test with colors',
        path: tempDir,
      });

      // Write logs with ANSI codes
      const ansiLog = '\x1b[32mGreen text\x1b[0m\n\x1b[1;31mBold red\x1b[0m\n';
      fs.writeFileSync(task.logFile, ansiLog);

      const logs = await handleResourceRead(`logs://${task.id}`, context);

      // ANSI codes should be stripped
      expect(logs).not.toContain('\x1b[');
      expect(logs).toContain('Green text');
      expect(logs).toContain('Bold red');
    });

    it('should handle missing log file', async () => {
      const logDir = path.join(tempDir, '.claude', 'mcp-logs');
      fs.mkdirSync(logDir, { recursive: true });

      const task = await context.taskManager.startTask({
        prompt: 'Test task',
        path: tempDir,
      });

      // Delete log file
      if (fs.existsSync(task.logFile)) {
        fs.unlinkSync(task.logFile);
      }

      const logs = await handleResourceRead(`logs://${task.id}`, context);

      expect(logs).toContain('Log file not available');
    });

    it('should throw on non-existent task', async () => {
      await expect(
        handleResourceRead('logs://non-existent-task-id', context)
      ).rejects.toThrow('Task not found');
    });
  });

  describe('Resource: tasks://active', () => {
    it('should return empty list when no active tasks', async () => {
      const result = await handleResourceRead('tasks://active', context);

      const data = JSON.parse(result);
      expect(data).toHaveProperty('tasks');
      expect(data.tasks).toEqual([]);
    });

    it('should list active tasks', async () => {
      const logDir = path.join(tempDir, '.claude', 'mcp-logs');
      fs.mkdirSync(logDir, { recursive: true });

      // Start multiple tasks
      const task1 = await context.taskManager.startTask({
        prompt: 'Task 1',
        path: tempDir,
      });

      // Create another temp dir for task 2
      const tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'resources-test-2-'));
      config.allowed_roots.push(tempDir2);
      const logDir2 = path.join(tempDir2, '.claude', 'mcp-logs');
      fs.mkdirSync(logDir2, { recursive: true });

      const task2 = await context.taskManager.startTask({
        prompt: 'Task 2',
        path: tempDir2,
      });

      const result = await handleResourceRead('tasks://active', context);
      const data = JSON.parse(result);

      expect(data.tasks).toHaveLength(2);
      expect(data.tasks.map((t: any) => t.id)).toContain(task1.id);
      expect(data.tasks.map((t: any) => t.id)).toContain(task2.id);

      // Cleanup - kill tasks first
      await context.taskManager.killTask(task1.id);
      await context.taskManager.killTask(task2.id);
      await new Promise(resolve => setTimeout(resolve, 60));
      fs.rmSync(tempDir2, { recursive: true, force: true });
    });

    it('should format tasks as JSON', async () => {
      const logDir = path.join(tempDir, '.claude', 'mcp-logs');
      fs.mkdirSync(logDir, { recursive: true });

      await context.taskManager.startTask({
        prompt: 'Test task',
        path: tempDir,
      });

      const result = await handleResourceRead('tasks://active', context);

      // Should be valid JSON
      expect(() => JSON.parse(result)).not.toThrow();

      const data = JSON.parse(result);
      expect(data.tasks[0]).toHaveProperty('id');
      expect(data.tasks[0]).toHaveProperty('status');
      expect(data.tasks[0]).toHaveProperty('projectPath');
      expect(data.tasks[0]).toHaveProperty('elapsedSeconds');
    });

    it('should not include completed tasks', async () => {
      const logDir = path.join(tempDir, '.claude', 'mcp-logs');
      fs.mkdirSync(logDir, { recursive: true });

      const task = await context.taskManager.startTask({
        prompt: 'Short task',
        path: tempDir,
      });

      // Complete the task
      mockPtyInstance.emitExit(0);
      await new Promise(resolve => setTimeout(resolve, 60));

      const result = await handleResourceRead('tasks://active', context);
      const data = JSON.parse(result);

      expect(data.tasks).toHaveLength(0);
    });
  });

  describe('Resource: config://current', () => {
    it('should return current configuration', async () => {
      const result = await handleResourceRead('config://current', context);

      const data = JSON.parse(result);

      expect(data).toHaveProperty('allowed_roots');
      expect(data).toHaveProperty('default_timeout_seconds');
      expect(data).toHaveProperty('max_log_size_bytes');
      expect(data).toHaveProperty('task_history_size');
      expect(data).toHaveProperty('default_tree_depth');
      expect(data).toHaveProperty('max_diff_size_bytes');
    });

    it('should format config as JSON', async () => {
      const result = await handleResourceRead('config://current', context);

      // Should be valid JSON
      expect(() => JSON.parse(result)).not.toThrow();

      const data = JSON.parse(result);
      expect(data.allowed_roots).toEqual([tempDir]);
      expect(data.default_timeout_seconds).toBe(3600);
      expect(data.task_history_size).toBe(20);
    });

    it('should be formatted with indentation', async () => {
      const result = await handleResourceRead('config://current', context);

      // Should have newlines and indentation
      expect(result).toContain('\n');
      expect(result).toContain('  ');
    });
  });

  describe('Resource Flow: task lifecycle with logs', () => {
    it('should track task from start to completion via resources', async () => {
      const logDir = path.join(tempDir, '.claude', 'mcp-logs');
      fs.mkdirSync(logDir, { recursive: true });

      // 1. Start task
      const task = await context.taskManager.startTask({
        prompt: 'Full lifecycle task',
        path: tempDir,
      });

      // 2. Check active tasks
      let activeTasks = JSON.parse(await handleResourceRead('tasks://active', context));
      expect(activeTasks.tasks).toHaveLength(1);
      expect(activeTasks.tasks[0].id).toBe(task.id);

      // 3. Simulate output and write to log
      const logOutput = 'Step 1: Starting\nStep 2: Processing\nStep 3: Finalizing\n';
      fs.writeFileSync(task.logFile, logOutput);

      // 4. Read logs
      const logs = await handleResourceRead(`logs://${task.id}`, context);
      expect(logs).toContain('Step 1');
      expect(logs).toContain('Step 2');
      expect(logs).toContain('Step 3');

      // 5. Complete task
      mockPtyInstance.emitExit(0);
      await new Promise(resolve => setTimeout(resolve, 60));

      // 6. Check active tasks again (should be empty)
      activeTasks = JSON.parse(await handleResourceRead('tasks://active', context));
      expect(activeTasks.tasks).toHaveLength(0);

      // 7. Logs should still be accessible
      const logsAfterCompletion = await handleResourceRead(`logs://${task.id}`, context);
      expect(logsAfterCompletion).toContain('Step 1');
    });
  });

  describe('Error Handling', () => {
    it('should throw on unknown resource URI', async () => {
      await expect(
        handleResourceRead('unknown://resource', context)
      ).rejects.toThrow('Unknown resource URI');
    });

    it('should throw on malformed logs URI', async () => {
      await expect(
        handleResourceRead('logs://', context)
      ).rejects.toThrow();
    });

    it('should handle task not found gracefully', async () => {
      await expect(
        handleResourceRead('logs://invalid-task-id', context)
      ).rejects.toThrow('Task not found');
    });
  });

  describe('Integration: Resources with multiple tasks', () => {
    it('should handle multiple concurrent tasks', async () => {
      const logDir = path.join(tempDir, '.claude', 'mcp-logs');
      fs.mkdirSync(logDir, { recursive: true });

      // Create temp dirs for multiple tasks
      const tempDirs = [tempDir];
      for (let i = 1; i < 3; i++) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), `resources-multi-${i}-`));
        config.allowed_roots.push(dir);
        fs.mkdirSync(path.join(dir, '.claude', 'mcp-logs'), { recursive: true });
        tempDirs.push(dir);
      }

      // Start tasks
      const tasks = await Promise.all([
        context.taskManager.startTask({ prompt: 'Task A', path: tempDirs[0] }),
        context.taskManager.startTask({ prompt: 'Task B', path: tempDirs[1] }),
        context.taskManager.startTask({ prompt: 'Task C', path: tempDirs[2] }),
      ]);

      // Write different logs for each
      fs.writeFileSync(tasks[0].logFile, 'Log A\n');
      fs.writeFileSync(tasks[1].logFile, 'Log B\n');
      fs.writeFileSync(tasks[2].logFile, 'Log C\n');

      // Verify active tasks
      const activeTasks = JSON.parse(await handleResourceRead('tasks://active', context));
      expect(activeTasks.tasks).toHaveLength(3);

      // Verify individual logs
      const logA = await handleResourceRead(`logs://${tasks[0].id}`, context);
      const logB = await handleResourceRead(`logs://${tasks[1].id}`, context);
      const logC = await handleResourceRead(`logs://${tasks[2].id}`, context);

      expect(logA).toContain('Log A');
      expect(logB).toContain('Log B');
      expect(logC).toContain('Log C');

      // Cleanup - kill all tasks first
      await Promise.all(tasks.map(t => context.taskManager.killTask(t.id)));
      await new Promise(resolve => setTimeout(resolve, 100));
      tempDirs.slice(1).forEach(dir => {
        fs.rmSync(dir, { recursive: true, force: true });
      });
    });
  });
});
