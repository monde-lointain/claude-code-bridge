import { EventEmitter } from 'node:events';

export interface MockPtyOptions {
  autoRespond?: boolean;
  exitCode?: number;
  exitDelay?: number;
}

export class MockPty extends EventEmitter {
  pid: number = 12345;
  private killed: boolean = false;
  private exitCode: number;
  private exitDelay: number;
  cols: number = 80;
  rows: number = 24;

  constructor(options: MockPtyOptions = {}) {
    super();
    this.exitCode = options.exitCode ?? 0;
    this.exitDelay = options.exitDelay ?? 100;
  }

  write(data: string): void {
    // Simulate input handling
    if (data === 'y\n') {
      // Simulate approval response
      setTimeout(() => {
        this.emitOutput('Approved. Continuing...\n');
      }, 10);
    }
  }

  kill(signal?: string): void {
    if (this.killed) return;
    this.killed = true;

    setTimeout(() => {
      this.emit('exit', { exitCode: signal === 'SIGKILL' ? 137 : 143 });
    }, this.exitDelay);
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
  }

  // Test helpers
  emitOutput(data: string): void {
    this.emit('data', data);
  }

  simulateExit(exitCode: number = 0): void {
    if (this.killed) return;
    this.killed = true;
    this.emit('exit', { exitCode });
  }

  simulateLongOutput(chunks: number = 10, delayMs: number = 100): void {
    let i = 0;
    const interval = setInterval(() => {
      this.emitOutput(`Processing chunk ${i + 1}/${chunks}...\n`);
      i++;
      if (i >= chunks) {
        clearInterval(interval);
        this.emitOutput('Done.\n');
        this.simulateExit(0);
      }
    }, delayMs);
  }

  simulateApprovalPrompt(promptText: string = 'Do you want to proceed? [y/N]'): void {
    this.emitOutput(promptText);
  }
}

// Factory function for vitest mock
export function createMockPty(options?: MockPtyOptions): MockPty {
  return new MockPty(options);
}
