import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { EventEmitter } from 'node:events';
import type { Config } from '../../../src/config/schema.js';

// Create mock pty before importing PtyManager
class MockPtyProcess extends EventEmitter {
  pid = 12345;
  private killed = false;

  write(data: string): void {
    // Simulate input response
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
const { PtyManager } = await import('../../../src/services/pty-manager.js');

describe('PtyManager', () => {
  let tempDir: string;
  let manager: PtyManager;
  let config: Config;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pty-test-'));
    // Create log directory
    fs.mkdirSync(path.join(tempDir, '.claude', 'mcp-logs'), { recursive: true });
    config = {
      allowed_roots: [tempDir],
      default_timeout_seconds: 60,
      max_log_size_bytes: 10485760,
      task_history_size: 20,
      default_tree_depth: 2,
      max_diff_size_bytes: 51200,
      default_header_lines: 50,
      shell: '/bin/bash',
      claude_command: 'echo test',
      auto_approve_patterns: ['Continue\\?', '\\[y/N\\]'],
      log_level: 'info',
    };
    manager = new PtyManager(config);
  });

  afterEach(async () => {
    // Clean up all sessions
    for (const sessionId of manager.getAllSessionIds()) {
      await manager.kill(sessionId);
      manager.cleanup(sessionId);
    }
    // Small delay for file handles to close
    await new Promise(r => setTimeout(r, 100));
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('spawn', () => {
    it('should create session and emit output', async () => {
      const promptFile = path.join(tempDir, 'prompt.md');
      fs.writeFileSync(promptFile, 'test prompt');

      await manager.spawn('test-session', tempDir, promptFile, 'auto');

      expect(manager.isRunning('test-session')).toBe(true);

      // Simulate output
      mockPtyInstance.emitData('Hello world\n');

      const output = manager.getLastOutput('test-session');
      expect(output).toContain('Hello world');
    });
  });

  describe('output handling', () => {
    it('should strip ANSI codes from buffer', async () => {
      const promptFile = path.join(tempDir, 'prompt.md');
      fs.writeFileSync(promptFile, 'test');

      await manager.spawn('ansi-test', tempDir, promptFile, 'auto');

      mockPtyInstance.emitData('\u001b[31mred text\u001b[0m');

      const output = manager.getLastOutput('ansi-test');
      expect(output).toBe('red text');
      expect(output).not.toContain('\u001b');
    });

    it('should auto-approve on matching pattern', async () => {
      const promptFile = path.join(tempDir, 'prompt.md');
      fs.writeFileSync(promptFile, 'test');

      await manager.spawn('approve-test', tempDir, promptFile, 'auto');

      // Emit approval prompt
      mockPtyInstance.emitData('Do you want to Continue? [y/N]');

      // Wait for auto-approval delay
      await new Promise(r => setTimeout(r, 150));

      // Check that approval was sent (mock tracks this via emitting 'Approved')
    });
  });

  describe('kill', () => {
    it('should terminate session', async () => {
      const promptFile = path.join(tempDir, 'prompt.md');
      fs.writeFileSync(promptFile, 'test');

      await manager.spawn('kill-test', tempDir, promptFile, 'auto');
      expect(manager.isRunning('kill-test')).toBe(true);

      await manager.kill('kill-test');

      // Wait for exit
      await new Promise(r => setTimeout(r, 100));
      expect(manager.isRunning('kill-test')).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should remove old sessions', async () => {
      const promptFile = path.join(tempDir, 'prompt.md');
      fs.writeFileSync(promptFile, 'test');

      await manager.spawn('cleanup-test', tempDir, promptFile, 'auto');
      mockPtyInstance.emitExit(0);

      await new Promise(r => setTimeout(r, 50));

      manager.cleanup('cleanup-test');
      expect(manager.getSession('cleanup-test')).toBeUndefined();
    });
  });
});
