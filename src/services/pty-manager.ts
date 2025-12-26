import * as pty from 'node-pty';
import { EventEmitter } from 'node:events';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { stripAnsi } from '../utils/ansi.js';
import type { Config } from '../config/schema.js';

export interface PtySession {
  id: string;
  pty: pty.IPty;
  outputBuffer: string;
  outputFile: ReturnType<typeof createWriteStream>;
  startedAt: Date;
  exitCode: number | null;
  exited: boolean;
}

export interface PtyManagerEvents {
  'output': (sessionId: string, data: string) => void;
  'exit': (sessionId: string, exitCode: number) => void;
  'error': (sessionId: string, error: Error) => void;
}

export declare interface PtyManager {
  on<U extends keyof PtyManagerEvents>(
    event: U,
    listener: PtyManagerEvents[U]
  ): this;
  emit<U extends keyof PtyManagerEvents>(
    event: U,
    ...args: Parameters<PtyManagerEvents[U]>
  ): boolean;
}

export class PtyManager extends EventEmitter {
  private sessions: Map<string, PtySession> = new Map();
  private config: Config;
  private approvalPatterns: RegExp[];

  constructor(config: Config) {
    super();
    this.config = config;
    this.approvalPatterns = config.auto_approve_patterns.map(p => new RegExp(p, 'i'));
  }

  /**
   * Spawn a new PTY session for Claude Code.
   */
  async spawn(
    sessionId: string,
    projectPath: string,
    promptFile: string,
    permissionMode: 'auto' | 'cautious'
  ): Promise<void> {
    // Ensure log directory exists
    const logDir = join(projectPath, '.claude', 'mcp-logs');
    await mkdir(logDir, { recursive: true });

    // Create log file
    const logPath = join(logDir, `task_${sessionId}.log`);
    const outputFile = createWriteStream(logPath, { flags: 'a' });

    // Build command
    // We pipe the prompt file to claude
    const command = `cat "${promptFile}" | ${this.config.claude_command}`;

    // Spawn PTY
    const ptyProcess = pty.spawn(this.config.shell, ['-c', command], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: projectPath,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        // Force non-interactive mode if available
        CI: 'true',
        CLAUDE_CODE_ENTRYPOINT: 'mcp-bridge',
      },
    });

    const session: PtySession = {
      id: sessionId,
      pty: ptyProcess,
      outputBuffer: '',
      outputFile,
      startedAt: new Date(),
      exitCode: null,
      exited: false,
    };

    this.sessions.set(sessionId, session);

    // Handle output
    ptyProcess.onData((data: string) => {
      this.handleOutput(session, data, permissionMode);
    });

    // Handle exit
    ptyProcess.onExit(({ exitCode }) => {
      session.exitCode = exitCode;
      session.exited = true;
      outputFile.end();
      this.emit('exit', sessionId, exitCode);
    });
  }

  /**
   * Handle output from PTY.
   */
  private handleOutput(
    session: PtySession,
    data: string,
    permissionMode: 'auto' | 'cautious'
  ): void {
    // Write raw output to log file
    session.outputFile.write(data);

    // Strip ANSI for buffer
    const cleanData = stripAnsi(data);
    session.outputBuffer += cleanData;

    // Keep buffer at reasonable size (last 10KB)
    if (session.outputBuffer.length > 10240) {
      session.outputBuffer = session.outputBuffer.slice(-10240);
    }

    // Emit for listeners
    this.emit('output', session.id, cleanData);

    // Check for approval prompts (auto mode only)
    if (permissionMode === 'auto') {
      this.checkForApprovalPrompt(session, data);
    }
  }

  /**
   * Check if output contains an approval prompt and auto-respond.
   */
  private checkForApprovalPrompt(session: PtySession, data: string): void {
    for (const pattern of this.approvalPatterns) {
      if (pattern.test(data)) {
        // Small delay to ensure prompt is ready for input
        setTimeout(() => {
          if (!session.exited) {
            session.pty.write('y\n');
          }
        }, 100);
        break;
      }
    }
  }

  /**
   * Get the last N characters of output for a session.
   */
  getLastOutput(sessionId: string, chars: number = 500): string {
    const session = this.sessions.get(sessionId);
    if (!session) return '';
    return session.outputBuffer.slice(-chars);
  }

  /**
   * Kill a PTY session.
   */
  async kill(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || session.exited) return false;

    // Try SIGTERM first
    session.pty.kill('SIGTERM');

    // Wait up to 5 seconds for graceful exit
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (session.exited) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        if (!session.exited) {
          // Force kill
          session.pty.kill('SIGKILL');
        }
        resolve();
      }, 5000);
    });

    return true;
  }

  /**
   * Check if a session exists and is running.
   */
  isRunning(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session !== undefined && !session.exited;
  }

  /**
   * Get session info.
   */
  getSession(sessionId: string): PtySession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Cleanup completed sessions.
   */
  cleanup(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.exited) {
      session.outputFile.destroy();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Get all session IDs.
   */
  getAllSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }
}
