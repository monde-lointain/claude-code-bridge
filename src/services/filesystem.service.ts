import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { isBinaryFile } from '../utils/binary-detector.js';
import { PathSecurity } from '../utils/path-security.js';
import { GitignoreParser } from '../utils/gitignore-parser.js';
import { BinaryFileError } from '../types/errors.js';
import type { Config } from '../config/schema.js';
import type {
  FileEntry,
  ListFilesOutput,
  ReadFileOutput,
  ReadFileRangeOutput,
} from '../types/tool.types.js';

export class FilesystemService {
  private pathSecurity: PathSecurity;

  constructor(config: Config) {
    this.pathSecurity = new PathSecurity(config.allowed_roots);
  }

  validatePath(inputPath: string): string {
    return this.pathSecurity.validate(inputPath);
  }

  async listFiles(dirPath: string): Promise<ListFilesOutput> {
    const validPath = this.validatePath(dirPath);
    const files: FileEntry[] = [];
    const gitignore = new GitignoreParser(validPath);
    const items = await fs.promises.readdir(validPath, { withFileTypes: true });

    for (const item of items) {
      if (item.name.startsWith('.') && item.name !== '.claude') continue;
      const fullPath = path.join(validPath, item.name);
      if (gitignore.isIgnored(fullPath)) continue;

      const entry: FileEntry = {
        name: item.name,
        type: item.isDirectory() ? 'directory' : (item.isSymbolicLink() ? 'symlink' : 'file'),
        size: 0,
        modified: '',
      };

      try {
        const stats = await fs.promises.stat(fullPath);
        entry.size = stats.size;
        entry.modified = stats.mtime.toISOString();
      } catch {
        /* ignore stat errors */
      }

      files.push(entry);
    }

    files.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return { path: validPath, files };
  }

  async readFile(filePath: string): Promise<ReadFileOutput> {
    const validPath = this.validatePath(filePath);
    const stats = await fs.promises.stat(validPath);
    if (stats.isDirectory()) {
      throw new Error(`Path is a directory, not a file: ${validPath}`);
    }

    const buffer = await fs.promises.readFile(validPath);
    if (isBinaryFile(buffer)) {
      throw new BinaryFileError(validPath);
    }

    const content = buffer.toString('utf-8');
    const maxSize = 1024 * 1024; // 1MB
    const isTruncated = buffer.length > maxSize;

    return {
      path: validPath,
      content: isTruncated
        ? content.slice(0, maxSize) + '\n\n[... FILE TRUNCATED AT 1MB ...]'
        : content,
      size: buffer.length,
      is_truncated: isTruncated,
    };
  }

  async readFileRange(
    filePath: string,
    startLine: number,
    endLine: number
  ): Promise<ReadFileRangeOutput> {
    const validPath = this.validatePath(filePath);
    const buffer = await fs.promises.readFile(validPath);
    if (isBinaryFile(buffer)) {
      throw new BinaryFileError(validPath);
    }

    const content = buffer.toString('utf-8');
    const allLines = content.split('\n');
    const totalLines = allLines.length;
    const start = Math.max(1, startLine);
    const end = Math.min(totalLines, endLine);
    const selectedLines = allLines.slice(start - 1, end);

    return {
      path: validPath,
      start_line: start,
      end_line: end,
      content: selectedLines.join('\n'),
      total_lines: totalLines,
    };
  }

  async getFileTree(dirPath: string, depth: number = 2): Promise<string> {
    const validPath = this.validatePath(dirPath);
    const baseName = path.basename(validPath);
    const gitignore = new GitignoreParser(validPath);
    const lines: string[] = [`${baseName}/`];
    await this.buildTree(validPath, '', depth, lines, gitignore);
    return lines.join('\n');
  }

  private async buildTree(
    dirPath: string,
    prefix: string,
    depth: number,
    lines: string[],
    gitignore: GitignoreParser
  ): Promise<void> {
    if (depth <= 0) return;

    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const filtered = items.filter((item) => {
      if (item.name.startsWith('.') && item.name !== '.claude') return false;
      return !gitignore.isIgnored(path.join(dirPath, item.name));
    });

    filtered.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (let i = 0; i < filtered.length; i++) {
      const item = filtered[i];
      const isLast = i === filtered.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = isLast ? '    ' : '│   ';

      if (item.isDirectory()) {
        lines.push(`${prefix}${connector}${item.name}/`);
        await this.buildTree(
          path.join(dirPath, item.name),
          prefix + childPrefix,
          depth - 1,
          lines,
          gitignore
        );
      } else {
        lines.push(`${prefix}${connector}${item.name}`);
      }
    }
  }

  async createDirectory(dirPath: string): Promise<boolean> {
    const validPath = this.validatePath(dirPath);
    await fs.promises.mkdir(validPath, { recursive: true });
    return true;
  }

  async writeFile(filePath: string, content: string): Promise<number> {
    const validPath = this.validatePath(filePath);
    const parentDir = path.dirname(validPath);
    await fs.promises.mkdir(parentDir, { recursive: true });
    await fs.promises.writeFile(validPath, content, 'utf-8');
    return Buffer.byteLength(content, 'utf-8');
  }

  async initGitRepo(dirPath: string): Promise<boolean> {
    const validPath = this.validatePath(dirPath);
    const gitDir = path.join(validPath, '.git');
    if (fs.existsSync(gitDir)) return false;
    await fs.promises.mkdir(validPath, { recursive: true });
    execSync('git init', { cwd: validPath, stdio: 'pipe' });
    return true;
  }
}
