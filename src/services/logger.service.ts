import * as fs from 'node:fs';
import * as path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class LoggerService {
  private level: LogLevel;
  private logFile: string | null;
  private stream: fs.WriteStream | null = null;
  private maxSizeBytes: number;
  private currentSizeBytes: number = 0;

  constructor(level: LogLevel = 'info', logFile?: string, maxSizeBytes: number = 10 * 1024 * 1024) {
    this.level = level;
    this.logFile = logFile ?? null;
    this.maxSizeBytes = maxSizeBytes;

    if (this.logFile) {
      this.initLogFile();
    }
  }

  private initLogFile(): void {
    if (!this.logFile) return;

    const dir = path.dirname(this.logFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.logFile)) {
      const stats = fs.statSync(this.logFile);
      this.currentSizeBytes = stats.size;
    }

    this.stream = fs.createWriteStream(this.logFile, { flags: 'a' });
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private format(level: LogLevel, message: string, meta?: object): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  private write(level: LogLevel, message: string, meta?: object): void {
    if (!this.shouldLog(level)) return;

    const formatted = this.format(level, message, meta);

    // Write to stderr (for MCP, stdout is reserved for protocol)
    console.error(formatted);

    // Write to file if configured
    if (this.stream && this.logFile) {
      const line = formatted + '\n';
      const lineBytes = Buffer.byteLength(line);

      if (this.currentSizeBytes + lineBytes > this.maxSizeBytes) {
        this.rotate();
      }

      this.stream.write(line);
      this.currentSizeBytes += lineBytes;
    }
  }

  private rotate(): void {
    if (!this.logFile || !this.stream) return;

    this.stream.end();

    const rotatedPath = this.logFile + '.1';
    if (fs.existsSync(rotatedPath)) {
      fs.unlinkSync(rotatedPath);
    }
    fs.renameSync(this.logFile, rotatedPath);

    this.stream = fs.createWriteStream(this.logFile, { flags: 'a' });
    this.currentSizeBytes = 0;
  }

  debug(message: string, meta?: object): void {
    this.write('debug', message, meta);
  }

  info(message: string, meta?: object): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: object): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta?: object): void {
    this.write('error', message, meta);
  }

  close(): void {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }
}

// Singleton instance
let loggerInstance: LoggerService | null = null;

export function getLogger(): LoggerService {
  if (!loggerInstance) {
    loggerInstance = new LoggerService('info');
  }
  return loggerInstance;
}

export function initLogger(level: LogLevel, logFile?: string, maxSize?: number): LoggerService {
  loggerInstance = new LoggerService(level, logFile, maxSize);
  return loggerInstance;
}
