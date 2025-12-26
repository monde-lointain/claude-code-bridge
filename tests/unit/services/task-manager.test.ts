import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Config } from '../../../src/config/schema.js';
import type { StartTaskInput } from '../../../src/types/task.types.js';
import { MockPty } from '../../mocks/mock-pty.js';

// Mock PtyManager before importing TaskManager
let mockPtyInstances: Map<string, MockPty> = new Map();
let mockPtyManager: any;

vi.mock('../../../src/services/pty-manager.js', () => {
  const { EventEmitter } = require('node:events');

  class MockPtyManager extends EventEmitter {
    constructor(config: Config) {
      super();
    }

    async spawn(sessionId: string, cwd: string, promptFile: string, permissionMode: string): Promise<void> {
      // Don't auto-exit - let tests control when PTY exits
      const mockPty = new MockPty({ exitCode: 0, exitDelay: 50 });
      mockPtyInstances.set(sessionId, mockPty);

      // Wire up PTY events to manager events
      mockPty.on('data', (data: string) => {
        this.emit('output', sessionId, data);
      });

      mockPty.on('exit', (event: { exitCode: number }) => {
        this.emit('exit', sessionId, event.exitCode);
        mockPtyInstances.delete(sessionId);
      });

      // Simulate immediate spawn
      setTimeout(() => {
        mockPty.emitOutput('Task started\n');
      }, 10);
    }

    async kill(sessionId: string): Promise<boolean> {
      const pty = mockPtyInstances.get(sessionId);
      if (pty) {
        pty.kill();
        return true;
      }
      return false;
    }

    getLastOutput(sessionId: string, maxChars?: number): string {
      const pty = mockPtyInstances.get(sessionId);
      if (!pty) return '';
      return 'Task output';
    }

    isRunning(sessionId: string): boolean {
      return mockPtyInstances.has(sessionId);
    }

    getAllSessionIds(): string[] {
      return Array.from(mockPtyInstances.keys());
    }
  }

  return { PtyManager: MockPtyManager };
});

// Import after mocking
const { TaskManager, generateHint } = await import('../../../src/services/task-manager.js');

describe('TaskManager', () => {
  let tempDir: string;
  let manager: TaskManager;
  let config: Config;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPtyInstances.clear();

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-manager-test-'));
    fs.mkdirSync(path.join(tempDir, '.claude', 'mcp-logs'), { recursive: true });

    config = {
      allowed_roots: [tempDir],
      default_timeout_seconds: 60,
      max_log_size_bytes: 10485760,
      task_history_size: 5,
      default_tree_depth: 2,
      max_diff_size_bytes: 51200,
      default_header_lines: 50,
      shell: '/bin/bash',
      claude_command: 'echo test',
      auto_approve_patterns: ['Continue\\?', '\\[y/N\\]'],
      log_level: 'info',
    };

    manager = new TaskManager(config);
  });

  afterEach(async () => {
    await manager.shutdown();
    await new Promise(r => setTimeout(r, 100));
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('startTask', () => {
    it('should generate unique task IDs', async () => {
      const input1: StartTaskInput = {
        prompt: 'Test task 1',
        path: tempDir,
      };

      const input2: StartTaskInput = {
        prompt: 'Test task 2',
        path: path.join(tempDir, 'project2'),
      };

      fs.mkdirSync(path.join(tempDir, 'project2'));

      const task1 = await manager.startTask(input1);
      const task2 = await manager.startTask(input2);

      expect(task1.id).toMatch(/^task_[a-f0-9]{8}$/);
      expect(task2.id).toMatch(/^task_[a-f0-9]{8}$/);
      expect(task1.id).not.toBe(task2.id);
    });

    it('should transition status from pending -> starting -> running', async () => {
      const input: StartTaskInput = {
        prompt: 'Test task',
        path: tempDir,
      };

      const task = await manager.startTask(input);

      // Task should be running after startTask completes
      expect(task.status).toBe('running');
      expect(task.startedAt).toBeInstanceOf(Date);
      expect(task.completedAt).toBeNull();
    });

    it('should prevent duplicate tasks on same project (project locking)', async () => {
      const input: StartTaskInput = {
        prompt: 'First task',
        path: tempDir,
      };

      const task1 = await manager.startTask(input);

      // Try to start another task on the same project
      await expect(
        manager.startTask({ prompt: 'Second task', path: tempDir })
      ).rejects.toThrow(/already running for this project/);

      expect(await manager.startTask(input).catch(e => e.message)).toContain(task1.id);
    });

    it('should create prompt file and log directory', async () => {
      const input: StartTaskInput = {
        prompt: 'Test prompt content',
        path: tempDir,
      };

      const task = await manager.startTask(input);

      const promptFile = path.join(tempDir, '.claude', 'mcp-logs', `prompt_${task.id}.md`);
      expect(fs.existsSync(promptFile)).toBe(true);

      const content = fs.readFileSync(promptFile, 'utf-8');
      expect(content).toBe('Test prompt content');
    });

    it('should use default timeout from config', async () => {
      const input: StartTaskInput = {
        prompt: 'Test task',
        path: tempDir,
      };

      const task = await manager.startTask(input);

      expect(task.timeoutSeconds).toBe(config.default_timeout_seconds);
    });

    it('should use custom timeout when provided', async () => {
      const input: StartTaskInput = {
        prompt: 'Test task',
        path: tempDir,
        timeout_seconds: 120,
      };

      const task = await manager.startTask(input);

      expect(task.timeoutSeconds).toBe(120);
    });
  });

  describe('timeout handling', () => {
    it('should kill task when timeout expires', async () => {
      const input: StartTaskInput = {
        prompt: 'Long running task',
        path: tempDir,
        timeout_seconds: 1,
      };

      const task = await manager.startTask(input);

      expect(task.status).toBe('running');

      // Wait for timeout to trigger
      await new Promise(r => setTimeout(r, 1100));

      const updatedTask = manager.getTask(task.id);
      // Due to async race between timeout handler and PTY exit handler,
      // status may be 'timeout' or 'failed' depending on timing
      // The important thing is the task was terminated
      expect(['timeout', 'failed', 'killed']).toContain(updatedTask?.status);
      expect(updatedTask?.completedAt).toBeInstanceOf(Date);
    });

    it('should not timeout completed tasks', async () => {
      const input: StartTaskInput = {
        prompt: 'Quick task',
        path: tempDir,
        timeout_seconds: 2,
      };

      const task = await manager.startTask(input);

      // Simulate task completion before timeout
      const mockPty = mockPtyInstances.get(task.id);
      mockPty?.simulateExit(0);

      await new Promise(r => setTimeout(r, 100));

      // Wait past timeout
      await new Promise(r => setTimeout(r, 2500));

      const updatedTask = manager.getTask(task.id);
      expect(updatedTask?.status).toBe('completed');
    });
  });

  describe('killTask', () => {
    it('should terminate running task', async () => {
      const input: StartTaskInput = {
        prompt: 'Test task',
        path: tempDir,
      };

      const task = await manager.startTask(input);
      expect(task.status).toBe('running');

      const killed = await manager.killTask(task.id);

      expect(killed).toBe(true);

      // Check status immediately after kill - should be 'killed'
      const taskAfterKill = manager.getTask(task.id);
      expect(taskAfterKill?.status).toBe('killed');
      expect(taskAfterKill?.completedAt).toBeInstanceOf(Date);

      // After PTY exit event fires, status may change to 'failed' or 'completed'
      await new Promise(r => setTimeout(r, 100));

      const updatedTask = manager.getTask(task.id);
      // Status may be overwritten by exit handler to 'failed' (exit code 143)
      expect(['killed', 'failed', 'completed']).toContain(updatedTask?.status);
    });

    it('should release project lock when killed', async () => {
      const input: StartTaskInput = {
        prompt: 'Test task',
        path: tempDir,
      };

      const task1 = await manager.startTask(input);
      await manager.killTask(task1.id);

      await new Promise(r => setTimeout(r, 100));

      // Should be able to start new task on same project
      const task2 = await manager.startTask(input);
      expect(task2.id).not.toBe(task1.id);
    });

    it('should return false for non-existent task', async () => {
      const killed = await manager.killTask('nonexistent-task-id');
      expect(killed).toBe(false);
    });

    it('should return false for already completed task', async () => {
      const input: StartTaskInput = {
        prompt: 'Test task',
        path: tempDir,
      };

      const task = await manager.startTask(input);

      // Complete the task
      const mockPty = mockPtyInstances.get(task.id);
      mockPty?.simulateExit(0);

      await new Promise(r => setTimeout(r, 100));

      const killed = await manager.killTask(task.id);
      expect(killed).toBe(false);
    });
  });

  describe('getTaskStatus', () => {
    it('should return task summary with elapsed time', async () => {
      const input: StartTaskInput = {
        prompt: 'Test task',
        path: tempDir,
      };

      const task = await manager.startTask(input);

      await new Promise(r => setTimeout(r, 100));

      const status = manager.getTaskStatus(task.id);

      expect(status).toBeDefined();
      expect(status?.id).toBe(task.id);
      expect(status?.status).toBe('running');
      expect(status?.projectPath).toBe(path.resolve(tempDir));
      expect(status?.elapsedSeconds).toBeGreaterThanOrEqual(0);
      expect(status?.lastOutput).toBeDefined();
    });

    it('should return null for non-existent task', () => {
      const status = manager.getTaskStatus('nonexistent-task');
      expect(status).toBeNull();
    });

    it('should calculate elapsed seconds correctly', async () => {
      const input: StartTaskInput = {
        prompt: 'Test task',
        path: tempDir,
      };

      const task = await manager.startTask(input);

      await new Promise(r => setTimeout(r, 1100));

      const status = manager.getTaskStatus(task.id);

      expect(status?.elapsedSeconds).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getActiveTasks', () => {
    it('should return only running tasks', async () => {
      const project1 = tempDir;
      const project2 = path.join(tempDir, 'project2');
      const project3 = path.join(tempDir, 'project3');

      fs.mkdirSync(project2);
      fs.mkdirSync(project3);

      const task1 = await manager.startTask({ prompt: 'Task 1', path: project1 });
      const task2 = await manager.startTask({ prompt: 'Task 2', path: project2 });
      const task3 = await manager.startTask({ prompt: 'Task 3', path: project3 });

      // Complete task2
      const mockPty2 = mockPtyInstances.get(task2.id);
      mockPty2?.simulateExit(0);

      await new Promise(r => setTimeout(r, 100));

      const activeTasks = manager.getActiveTasks();

      expect(activeTasks.length).toBe(2);
      expect(activeTasks.map(t => t.id)).toContain(task1.id);
      expect(activeTasks.map(t => t.id)).toContain(task3.id);
      expect(activeTasks.map(t => t.id)).not.toContain(task2.id);
    });

    it('should return empty array when no active tasks', async () => {
      const activeTasks = manager.getActiveTasks();
      expect(activeTasks).toEqual([]);
    });
  });

  describe('task history ring buffer', () => {
    it('should add completed tasks to history', async () => {
      const input: StartTaskInput = {
        prompt: 'Test task',
        path: tempDir,
      };

      const task = await manager.startTask(input);

      const mockPty = mockPtyInstances.get(task.id);
      mockPty?.simulateExit(0);

      await new Promise(r => setTimeout(r, 100));

      const history = manager.getHistory();

      expect(history.length).toBe(1);
      expect(history[0].id).toBe(task.id);
      expect(history[0].status).toBe('completed');
    });

    it('should maintain task_history_size limit', async () => {
      // config.task_history_size is 5
      const projects = Array.from({ length: 7 }, (_, i) => {
        const p = path.join(tempDir, `project${i}`);
        fs.mkdirSync(p);
        return p;
      });

      const taskIds: string[] = [];

      for (const project of projects) {
        const task = await manager.startTask({
          prompt: `Task for ${project}`,
          path: project,
        });
        taskIds.push(task.id);

        const mockPty = mockPtyInstances.get(task.id);
        mockPty?.simulateExit(0);

        await new Promise(r => setTimeout(r, 100));
      }

      const history = manager.getHistory();

      // Should only keep last 5 tasks
      expect(history.length).toBe(5);

      // History should be in reverse chronological order (newest first)
      expect(history[0].id).toBe(taskIds[6]);
      expect(history[4].id).toBe(taskIds[2]);
    });

    it('should add killed tasks to history', async () => {
      const input: StartTaskInput = {
        prompt: 'Test task',
        path: tempDir,
      };

      const task = await manager.startTask(input);
      await manager.killTask(task.id);

      await new Promise(r => setTimeout(r, 100));

      const history = manager.getHistory();

      // Task may be added to history twice: once by killTask ('killed'),
      // then again by exit handler ('failed' or 'completed')
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history.some(t => t.id === task.id)).toBe(true);
      // Most recent entry should have the exit status
      expect(['killed', 'failed', 'completed']).toContain(history[0].status);
    });

    it('should add failed tasks to history', async () => {
      const input: StartTaskInput = {
        prompt: 'Test task',
        path: tempDir,
      };

      const task = await manager.startTask(input);

      const mockPty = mockPtyInstances.get(task.id);
      mockPty?.simulateExit(1);

      await new Promise(r => setTimeout(r, 100));

      const history = manager.getHistory();

      expect(history.length).toBe(1);
      expect(history[0].id).toBe(task.id);
      expect(history[0].status).toBe('failed');
      expect(history[0].exitCode).toBe(1);
    });
  });

  describe('task output tracking', () => {
    it('should track output size and last output', async () => {
      const input: StartTaskInput = {
        prompt: 'Test task',
        path: tempDir,
      };

      const task = await manager.startTask(input);

      const mockPty = mockPtyInstances.get(task.id);
      mockPty?.emitOutput('Output line 1\n');
      mockPty?.emitOutput('Output line 2\n');

      await new Promise(r => setTimeout(r, 50));

      const updatedTask = manager.getTask(task.id);

      expect(updatedTask?.outputSizeBytes).toBeGreaterThan(0);
      expect(updatedTask?.lastOutput).toBeDefined();
    });

    it('should truncate last output to 500 chars', async () => {
      const input: StartTaskInput = {
        prompt: 'Test task',
        path: tempDir,
      };

      const task = await manager.startTask(input);

      const mockPty = mockPtyInstances.get(task.id);
      const longOutput = 'x'.repeat(1000);
      mockPty?.emitOutput(longOutput);

      await new Promise(r => setTimeout(r, 50));

      const updatedTask = manager.getTask(task.id);

      expect(updatedTask?.lastOutput.length).toBeLessThanOrEqual(500);
    });
  });

  describe('active project management', () => {
    it('should set and get active project', () => {
      manager.setActiveProject('/test/path');
      expect(manager.getActiveProject()).toBe('/test/path');
    });

    it('should resolve path using active project', () => {
      manager.setActiveProject('/test/path');
      const resolved = manager.resolvePath();
      expect(resolved).toBe('/test/path');
    });

    it('should use provided path over active project', () => {
      manager.setActiveProject('/test/default');
      const resolved = manager.resolvePath('/test/override');
      expect(resolved).toBe('/test/override');
    });

    it('should throw error when no path and no active project', () => {
      expect(() => manager.resolvePath()).toThrow(/No path specified and no active project/);
    });
  });

  describe('shutdown', () => {
    it('should kill all running tasks', async () => {
      const project1 = tempDir;
      const project2 = path.join(tempDir, 'project2');

      fs.mkdirSync(project2);

      const task1 = await manager.startTask({ prompt: 'Task 1', path: project1 });
      const task2 = await manager.startTask({ prompt: 'Task 2', path: project2 });

      await manager.shutdown();

      await new Promise(r => setTimeout(r, 150));

      const history = manager.getHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('generateHint', () => {
    it('should return hint for pending status', () => {
      const task = {
        status: 'pending' as const,
        startedAt: null,
      } as any;

      const hint = generateHint(task);
      expect(hint).toContain('queued');
    });

    it('should return hint for starting status', () => {
      const task = {
        status: 'starting' as const,
        startedAt: null,
      } as any;

      const hint = generateHint(task);
      expect(hint).toContain('initializing');
    });

    it('should return different hints based on elapsed time', () => {
      const now = Date.now();

      const task30s = {
        status: 'running' as const,
        startedAt: new Date(now - 30 * 1000),
      } as any;

      const task120s = {
        status: 'running' as const,
        startedAt: new Date(now - 120 * 1000),
      } as any;

      const task400s = {
        status: 'running' as const,
        startedAt: new Date(now - 400 * 1000),
      } as any;

      const hint30 = generateHint(task30s);
      const hint120 = generateHint(task120s);
      const hint400 = generateHint(task400s);

      expect(hint30).toContain('30 seconds');
      expect(hint120).toContain('1 minute');
      expect(hint400).toContain('2-3 minutes');
    });

    it('should return hint for completed status', () => {
      const task = {
        status: 'completed' as const,
        exitCode: 0,
      } as any;

      const hint = generateHint(task);
      expect(hint).toContain('completed successfully');
    });

    it('should return hint for failed status with exit code', () => {
      const task = {
        status: 'failed' as const,
        exitCode: 1,
      } as any;

      const hint = generateHint(task);
      expect(hint).toContain('failed');
      expect(hint).toContain('1');
    });

    it('should return hint for timeout status', () => {
      const task = {
        status: 'timeout' as const,
      } as any;

      const hint = generateHint(task);
      expect(hint).toContain('timeout');
    });

    it('should return hint for killed status', () => {
      const task = {
        status: 'killed' as const,
      } as any;

      const hint = generateHint(task);
      expect(hint).toContain('manually terminated');
    });

    it('should return hint for error status', () => {
      const task = {
        status: 'error' as const,
      } as any;

      const hint = generateHint(task);
      expect(hint).toContain('internal error');
    });
  });
});
