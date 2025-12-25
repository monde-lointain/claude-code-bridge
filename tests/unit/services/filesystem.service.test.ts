import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FilesystemService } from '../../../src/services/filesystem.service.js';
import { BinaryFileError, PathSecurityError } from '../../../src/types/errors.js';
import type { Config } from '../../../src/config/schema.js';

describe('FilesystemService', () => {
  let tempDir: string;
  let service: FilesystemService;
  let config: Config;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-service-test-'));
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
    service = new FilesystemService(config);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('listFiles', () => {
    it('should list files and directories', async () => {
      fs.mkdirSync(path.join(tempDir, 'subdir'));
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'content');

      const result = await service.listFiles(tempDir);

      expect(result.files).toHaveLength(2);
      expect(result.files[0].name).toBe('subdir');
      expect(result.files[0].type).toBe('directory');
      expect(result.files[1].name).toBe('file.txt');
      expect(result.files[1].type).toBe('file');
    });

    it('should ignore node_modules', async () => {
      fs.mkdirSync(path.join(tempDir, 'node_modules'));
      fs.mkdirSync(path.join(tempDir, 'src'));

      const result = await service.listFiles(tempDir);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('src');
    });

    it('should throw for path outside allowed roots', async () => {
      await expect(service.listFiles('/etc')).rejects.toThrow(PathSecurityError);
    });
  });

  describe('readFile', () => {
    it('should read text file', async () => {
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'Hello, World!');

      const result = await service.readFile(path.join(tempDir, 'test.txt'));

      expect(result.content).toBe('Hello, World!');
      expect(result.size).toBe(13);
    });

    it('should throw BinaryFileError for binary files', async () => {
      const binaryPath = path.join(tempDir, 'binary.bin');
      fs.writeFileSync(binaryPath, Buffer.from([0x00, 0x01, 0x02]));

      await expect(service.readFile(binaryPath)).rejects.toThrow(BinaryFileError);
    });

    it('should truncate large files', async () => {
      const largePath = path.join(tempDir, 'large.txt');
      const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB
      fs.writeFileSync(largePath, largeContent);

      const result = await service.readFile(largePath);

      expect(result.content).toContain('[... FILE TRUNCATED AT 1MB ...]');
      expect(result.size).toBe(2 * 1024 * 1024);
    });
  });

  describe('readFileRange', () => {
    it('should read specific line range', async () => {
      fs.writeFileSync(path.join(tempDir, 'lines.txt'), 'line1\nline2\nline3\nline4\nline5');

      const result = await service.readFileRange(path.join(tempDir, 'lines.txt'), 2, 4);

      expect(result.content).toBe('line2\nline3\nline4');
      expect(result.start_line).toBe(2);
      expect(result.end_line).toBe(4);
      expect(result.total_lines).toBe(5);
    });

    it('should clamp out-of-bounds lines', async () => {
      fs.writeFileSync(path.join(tempDir, 'short.txt'), 'a\nb\nc');

      const result = await service.readFileRange(path.join(tempDir, 'short.txt'), -5, 100);

      expect(result.start_line).toBe(1);
      expect(result.end_line).toBe(3);
    });
  });

  describe('getFileTree', () => {
    it('should generate ASCII tree', async () => {
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.writeFileSync(path.join(tempDir, 'src', 'index.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');

      const tree = await service.getFileTree(tempDir, 2);

      expect(tree).toContain('src/');
      expect(tree).toContain('index.ts');
      expect(tree).toContain('package.json');
    });
  });

  describe('createDirectory', () => {
    it('should create nested directories', async () => {
      const nestedPath = path.join(tempDir, 'a', 'b', 'c');

      await service.createDirectory(nestedPath);

      expect(fs.existsSync(nestedPath)).toBe(true);
    });
  });

  describe('writeFile', () => {
    it('should create file with content', async () => {
      const filePath = path.join(tempDir, 'new', 'file.txt');

      const size = await service.writeFile(filePath, 'Hello!');

      expect(fs.readFileSync(filePath, 'utf-8')).toBe('Hello!');
      expect(size).toBe(6);
    });
  });

  describe('initGitRepo', () => {
    it('should initialize git repo', async () => {
      const repoPath = path.join(tempDir, 'new-repo');

      const result = await service.initGitRepo(repoPath);

      expect(result).toBe(true);
      expect(fs.existsSync(path.join(repoPath, '.git'))).toBe(true);
    });

    it('should return false if already initialized', async () => {
      const repoPath = path.join(tempDir, 'existing-repo');
      fs.mkdirSync(path.join(repoPath, '.git'), { recursive: true });

      const result = await service.initGitRepo(repoPath);

      expect(result).toBe(false);
    });
  });
});
