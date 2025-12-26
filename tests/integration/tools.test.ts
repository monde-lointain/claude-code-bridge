import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { EventEmitter } from 'node:events';
import type { Config } from '../../src/config/schema.js';
import type { SetActiveProjectOutput, ListFilesOutput, ReadFileOutput, GetFileTreeOutput } from '../../src/types/tool.types.js';
import type { GitStatusOutput } from '../../src/types/tool.types.js';
import type { StartTaskOutput, GetTaskStatusOutput, KillTaskOutput } from '../../src/types/task.types.js';

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
const { handleToolCall } = await import('../../src/tools/index.js');
const { TaskManager } = await import('../../src/services/task-manager.js');
const { FilesystemService } = await import('../../src/services/filesystem.service.js');
const { GitService } = await import('../../src/services/git.service.js');

type ToolHandlerContext = {
  taskManager: InstanceType<typeof TaskManager>;
  filesystemService: InstanceType<typeof FilesystemService>;
  gitService: InstanceType<typeof GitService>;
  config: Config;
};

describe('Tools Integration', () => {
  let tempDir: string;
  let context: ToolHandlerContext;
  let config: Config;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-integration-test-'));

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
    const filesystemService = new FilesystemService(config);
    const gitService = new GitService(config);

    context = {
      taskManager,
      filesystemService,
      gitService,
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

  describe('Tool Flow: set_active_project -> list_files -> read_file', () => {
    it('should set active project and list files', async () => {
      // Setup: Create test files
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content1');
      fs.writeFileSync(path.join(tempDir, 'file2.txt'), 'content2');
      fs.mkdirSync(path.join(tempDir, 'subdir'));

      // 1. Set active project
      const setResult = await handleToolCall(
        'set_active_project',
        { path: tempDir },
        context
      ) as SetActiveProjectOutput;

      expect(setResult.path).toBe(tempDir);
      expect(setResult.message).toContain('Active project set');

      // 2. List files (no path needed, uses active project)
      const listResult = await handleToolCall(
        'list_files',
        { path: tempDir },
        context
      ) as ListFilesOutput;

      expect(listResult.files).toHaveLength(3);
      expect(listResult.files.map(f => f.name)).toContain('file1.txt');
      expect(listResult.files.map(f => f.name)).toContain('file2.txt');
      expect(listResult.files.map(f => f.name)).toContain('subdir');
    });

    it('should read file after setting active project', async () => {
      // Setup
      const testContent = 'Hello World!';
      const testFile = path.join(tempDir, 'test.txt');
      fs.writeFileSync(testFile, testContent);

      // 1. Set active project
      await handleToolCall('set_active_project', { path: tempDir }, context);

      // 2. Read file
      const readResult = await handleToolCall(
        'read_file',
        { path: testFile },
        context
      ) as ReadFileOutput;

      expect(readResult.content).toBe(testContent);
      expect(readResult.size).toBe(testContent.length);
      expect(readResult.is_truncated).toBe(false);
    });
  });

  describe('Tool Flow: file_tree', () => {
    it('should get file tree structure', async () => {
      // Setup
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.mkdirSync(path.join(tempDir, 'src', 'lib'));
      fs.writeFileSync(path.join(tempDir, 'src', 'index.ts'), 'export {}');
      fs.writeFileSync(path.join(tempDir, 'src', 'lib', 'utils.ts'), 'export {}');
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test');

      await handleToolCall('set_active_project', { path: tempDir }, context);

      const treeResult = await handleToolCall(
        'file_tree',
        { path: tempDir, depth: 3 },
        context
      ) as GetFileTreeOutput;

      expect(treeResult.tree).toContain('src');
      expect(treeResult.tree).toContain('README.md');
      expect(treeResult.tree).toContain('index.ts');
    });
  });

  describe('Tool Flow: git_status', () => {
    it('should get git status after init', async () => {
      // Setup: Initialize git repo
      await handleToolCall('init_git_repo', { path: tempDir }, context);
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'content');

      await handleToolCall('set_active_project', { path: tempDir }, context);

      const statusResult = await handleToolCall(
        'git_status',
        { path: tempDir },
        context
      ) as GitStatusOutput;

      expect(statusResult.branch).toBeDefined();
      expect(statusResult.untracked).toContain('test.txt');
    });
  });

  describe('Tool Flow: create_directory -> write_file', () => {
    it('should create directory and write file', async () => {
      await handleToolCall('set_active_project', { path: tempDir }, context);

      const newDir = path.join(tempDir, 'new-folder');
      await handleToolCall('create_directory', { path: newDir }, context);

      expect(fs.existsSync(newDir)).toBe(true);
      expect(fs.statSync(newDir).isDirectory()).toBe(true);

      const newFile = path.join(newDir, 'file.txt');
      await handleToolCall(
        'write_file',
        { path: newFile, content: 'test content' },
        context
      );

      expect(fs.existsSync(newFile)).toBe(true);
      expect(fs.readFileSync(newFile, 'utf-8')).toBe('test content');
    });
  });

  describe('Tool Flow: start_task -> get_task_status', () => {
    it('should start task and get status', async () => {
      // Ensure .claude/mcp-logs directory exists
      const logDir = path.join(tempDir, '.claude', 'mcp-logs');
      fs.mkdirSync(logDir, { recursive: true });

      // 1. Start task
      const startResult = await handleToolCall(
        'start_task',
        {
          prompt: 'Test task',
          path: tempDir,
          timeout_seconds: 300,
        },
        context
      ) as StartTaskOutput;

      expect(startResult.task_id).toBeDefined();
      expect(startResult.status).toMatch(/starting|running/);

      // Simulate task output
      mockPtyInstance.emitData('Processing...\n');
      await new Promise(resolve => setTimeout(resolve, 20));

      // 2. Get task status
      const statusResult = await handleToolCall(
        'get_task_status',
        { task_id: startResult.task_id },
        context
      ) as GetTaskStatusOutput;

      expect(statusResult.task_id).toBe(startResult.task_id);
      expect(statusResult.status).toMatch(/starting|running/);
      expect(statusResult.last_output).toBeDefined();
    });

    it('should handle task completion', async () => {
      const logDir = path.join(tempDir, '.claude', 'mcp-logs');
      fs.mkdirSync(logDir, { recursive: true });

      const startResult = await handleToolCall(
        'start_task',
        { prompt: 'Quick task', path: tempDir, timeout_seconds: 300 },
        context
      ) as StartTaskOutput;

      // Simulate task completion
      mockPtyInstance.emitData('Task completed successfully.\n');
      await new Promise(resolve => setTimeout(resolve, 20));
      mockPtyInstance.emitExit(0);
      await new Promise(resolve => setTimeout(resolve, 60));

      const statusResult = await handleToolCall(
        'get_task_status',
        { task_id: startResult.task_id },
        context
      ) as GetTaskStatusOutput;

      expect(statusResult.status).toBe('completed');
      expect(statusResult.exit_code).toBe(0);
    });
  });

  describe('Tool Flow: kill_task', () => {
    it('should kill running task', async () => {
      const logDir = path.join(tempDir, '.claude', 'mcp-logs');
      fs.mkdirSync(logDir, { recursive: true });

      const startResult = await handleToolCall(
        'start_task',
        { prompt: 'Long running task', path: tempDir, timeout_seconds: 3600 },
        context
      ) as StartTaskOutput;

      await new Promise(resolve => setTimeout(resolve, 20));

      const killResult = await handleToolCall(
        'kill_task',
        { task_id: startResult.task_id },
        context
      ) as KillTaskOutput;

      expect(killResult.task_id).toBe(startResult.task_id);
      expect(killResult.message).toContain('terminated');
    });

    it('should handle kill of non-existent task', async () => {
      const killResult = await handleToolCall(
        'kill_task',
        { task_id: 'non-existent-task-id' },
        context
      ) as KillTaskOutput;

      expect(killResult.status).toBe('error');
      expect(killResult.message).toContain('not found');
    });
  });

  describe('Tool Flow: get_active_project', () => {
    it('should return null when no active project', async () => {
      const result = await handleToolCall('get_active_project', {}, context);

      expect(result).toHaveProperty('path', null);
      expect(result).toHaveProperty('message');
    });

    it('should return active project after setting', async () => {
      await handleToolCall('set_active_project', { path: tempDir }, context);

      const result = await handleToolCall('get_active_project', {}, context);

      expect(result).toHaveProperty('path', tempDir);
    });
  });

  describe('Tool Flow: read_file_range', () => {
    it('should read specific lines from file', async () => {
      const testFile = path.join(tempDir, 'multiline.txt');
      const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      fs.writeFileSync(testFile, content);

      await handleToolCall('set_active_project', { path: tempDir }, context);

      const result = await handleToolCall(
        'read_file_range',
        { path: testFile, start_line: 2, end_line: 4 },
        context
      );

      expect(result).toHaveProperty('content');
      const resultContent = (result as any).content;
      expect(resultContent).toContain('Line 2');
      expect(resultContent).toContain('Line 3');
      expect(resultContent).toContain('Line 4');
      expect(resultContent).not.toContain('Line 1');
      expect(resultContent).not.toContain('Line 5');
    });
  });

  describe('Error Handling', () => {
    it('should throw on unknown tool', async () => {
      await expect(
        handleToolCall('unknown_tool', {}, context)
      ).rejects.toThrow('Unknown tool');
    });

    it('should throw on invalid path', async () => {
      await expect(
        handleToolCall('list_files', { path: '/invalid/path' }, context)
      ).rejects.toThrow();
    });

    it('should handle binary file read error', async () => {
      const binaryFile = path.join(tempDir, 'binary.bin');
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE]);
      fs.writeFileSync(binaryFile, buffer);

      await expect(
        handleToolCall('read_file', { path: binaryFile }, context)
      ).rejects.toThrow();
    });
  });
});
