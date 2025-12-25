import { execSync, ExecSyncOptionsWithStringEncoding } from 'node:child_process';
import { PathSecurity } from '../utils/path-security.js';
import { GitError } from '../types/errors.js';
import type { Config } from '../config/schema.js';
import type {
  GitStatusOutput,
  GitDiffStatOutput,
  GitDiffFileStat,
  GitDiffOutput,
} from '../types/tool.types.js';

export class GitService {
  private pathSecurity: PathSecurity;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.pathSecurity = new PathSecurity(config.allowed_roots);
  }

  private exec(command: string, cwd: string): string {
    const options: ExecSyncOptionsWithStringEncoding = {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    };

    try {
      return execSync(command, options).trim();
    } catch (error: unknown) {
      const err = error as { stderr?: string };
      if (err.stderr) {
        throw new GitError(err.stderr);
      }
      throw error;
    }
  }

  isGitRepo(dirPath: string): boolean {
    try {
      this.exec('git rev-parse --git-dir', dirPath);
      return true;
    } catch {
      return false;
    }
  }

  getStatus(dirPath: string): GitStatusOutput {
    const validPath = this.pathSecurity.validate(dirPath);

    if (!this.isGitRepo(validPath)) {
      throw new GitError(`Not a git repository: ${validPath}`);
    }

    const branchOutput = this.exec('git status --porcelain -b', validPath);
    const lines = branchOutput.split('\n');

    let branch = 'unknown';
    let ahead = 0;
    let behind = 0;

    if (lines[0]?.startsWith('##')) {
      const branchLine = lines[0].slice(3);
      const branchMatch = branchLine.match(/^([^.]+)/);
      if (branchMatch) branch = branchMatch[1];

      const aheadMatch = branchLine.match(/ahead (\d+)/);
      if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);

      const behindMatch = branchLine.match(/behind (\d+)/);
      if (behindMatch) behind = parseInt(behindMatch[1], 10);
    }

    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const indexStatus = line[0];
      const workTreeStatus = line[1];
      const filename = line.slice(3);

      if (indexStatus !== ' ' && indexStatus !== '?') {
        staged.push(filename);
      }
      if (workTreeStatus === 'M') {
        modified.push(filename);
      }
      if (indexStatus === '?' && workTreeStatus === '?') {
        untracked.push(filename);
      }
    }

    return {
      path: validPath,
      clean: staged.length === 0 && modified.length === 0 && untracked.length === 0,
      branch,
      ahead,
      behind,
      staged,
      modified,
      untracked,
    };
  }

  getDiffStat(dirPath: string, cached: boolean = false): GitDiffStatOutput {
    const validPath = this.pathSecurity.validate(dirPath);

    if (!this.isGitRepo(validPath)) {
      throw new GitError(`Not a git repository: ${validPath}`);
    }

    const command = cached ? 'git diff --cached --stat' : 'git diff --stat';
    const output = this.exec(command, validPath);

    const files: GitDiffFileStat[] = [];
    const lines = output.split('\n');
    let summary = '';

    for (const line of lines) {
      const fileMatch = line.match(/^\s*(.+?)\s+\|\s+(\d+)\s+(\+*)(-*)/);
      if (fileMatch) {
        files.push({
          file: fileMatch[1].trim(),
          insertions: fileMatch[3].length,
          deletions: fileMatch[4].length,
        });
      }

      if (line.includes('files changed') || line.includes('file changed')) {
        summary = line.trim();
      }
    }

    return {
      path: validPath,
      files,
      summary: summary || 'No changes',
    };
  }

  getDiff(dirPath: string, cached: boolean = false): GitDiffOutput {
    const validPath = this.pathSecurity.validate(dirPath);

    if (!this.isGitRepo(validPath)) {
      throw new GitError(`Not a git repository: ${validPath}`);
    }

    const command = cached ? 'git diff --cached' : 'git diff';
    let output: string;

    try {
      output = this.exec(command, validPath);
    } catch {
      output = '';
    }

    const maxSize = this.config.max_diff_size_bytes;
    let truncated = false;
    let message = 'Full diff output.';

    if (Buffer.byteLength(output) > maxSize) {
      output = output.slice(0, maxSize) + '\n\n[... DIFF TRUNCATED ...]';
      truncated = true;
      message = `Diff truncated at ${Math.round(maxSize / 1024)}KB. Use git_diff_stat for summary.`;
    }

    if (!output) {
      message = 'No changes to show.';
    }

    return {
      path: validPath,
      diff: output,
      truncated,
      message,
    };
  }
}
