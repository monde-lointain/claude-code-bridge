import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import { GitService } from '../../../src/services/git.service.js';
import { GitError } from '../../../src/types/errors.js';
import type { Config } from '../../../src/config/schema.js';

describe('GitService', () => {
  let tempDir: string;
  let service: GitService;
  let config: Config;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-service-test-'));
    config = {
      allowed_roots: [tempDir],
      default_timeout_seconds: 3600,
      max_log_size_bytes: 10485760,
      task_history_size: 20,
      default_tree_depth: 2,
      max_diff_size_bytes: 1024, // Small for testing truncation
      default_header_lines: 50,
      shell: '/bin/bash',
      claude_command: 'claude',
      auto_approve_patterns: [],
      log_level: 'info',
    };
    service = new GitService(config);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function initGitRepo(dir: string): void {
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.name "Test User"', { cwd: dir, stdio: 'pipe' });
  }

  describe('isGitRepo', () => {
    it('should return true for git repo', () => {
      initGitRepo(tempDir);
      expect(service.isGitRepo(tempDir)).toBe(true);
    });

    it('should return false for non-git directory', () => {
      expect(service.isGitRepo(tempDir)).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return clean status for clean repo', () => {
      initGitRepo(tempDir);
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'content');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "init"', { cwd: tempDir, stdio: 'pipe' });

      const status = service.getStatus(tempDir);

      expect(status.clean).toBe(true);
      expect(status.staged).toEqual([]);
      expect(status.modified).toEqual([]);
      expect(status.untracked).toEqual([]);
    });

    it('should detect untracked files', () => {
      initGitRepo(tempDir);
      fs.writeFileSync(path.join(tempDir, 'untracked.txt'), 'content');

      const status = service.getStatus(tempDir);

      expect(status.clean).toBe(false);
      expect(status.untracked).toContain('untracked.txt');
    });

    it('should detect modified files', () => {
      initGitRepo(tempDir);
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'content');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "init"', { cwd: tempDir, stdio: 'pipe' });
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'modified');

      const status = service.getStatus(tempDir);

      expect(status.modified).toContain('file.txt');
    });

    it('should detect staged files', () => {
      initGitRepo(tempDir);
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'content');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });

      const status = service.getStatus(tempDir);

      expect(status.staged).toContain('file.txt');
    });

    it('should throw GitError for non-repo', () => {
      expect(() => service.getStatus(tempDir)).toThrow(GitError);
    });
  });

  describe('getDiffStat', () => {
    it('should return file stats', () => {
      initGitRepo(tempDir);
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'content');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "init"', { cwd: tempDir, stdio: 'pipe' });
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'modified content');

      const stat = service.getDiffStat(tempDir);

      expect(stat.files.length).toBeGreaterThan(0);
      expect(stat.files[0].file).toBe('file.txt');
    });

    it('should return empty for no changes', () => {
      initGitRepo(tempDir);

      const stat = service.getDiffStat(tempDir);

      expect(stat.files).toEqual([]);
      expect(stat.summary).toBe('No changes');
    });
  });

  describe('getDiff', () => {
    it('should return diff content', () => {
      initGitRepo(tempDir);
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'content');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "init"', { cwd: tempDir, stdio: 'pipe' });
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'modified');

      const diff = service.getDiff(tempDir);

      expect(diff.diff).toContain('diff --git');
      expect(diff.truncated).toBe(false);
    });

    it('should truncate large diffs', () => {
      initGitRepo(tempDir);
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'a');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "init"', { cwd: tempDir, stdio: 'pipe' });
      // Create large change
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'x'.repeat(5000));

      const diff = service.getDiff(tempDir);

      expect(diff.truncated).toBe(true);
      expect(diff.diff).toContain('[... DIFF TRUNCATED ...]');
    });

    it('should return empty diff message when no changes', () => {
      initGitRepo(tempDir);

      const diff = service.getDiff(tempDir);

      expect(diff.diff).toBe('');
      expect(diff.message).toBe('No changes to show.');
    });
  });
});
