import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { GitignoreParser } from '../../../src/utils/gitignore-parser.js';

describe('GitignoreParser', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitignore-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('default ignores', () => {
    it('should ignore node_modules by default', () => {
      const parser = new GitignoreParser(tempDir);
      expect(parser.isIgnored(path.join(tempDir, 'node_modules'))).toBe(true);
      expect(parser.isIgnored(path.join(tempDir, 'node_modules', 'package', 'index.js'))).toBe(true);
    });

    it('should ignore .git by default', () => {
      const parser = new GitignoreParser(tempDir);
      expect(parser.isIgnored(path.join(tempDir, '.git'))).toBe(true);
    });

    it('should ignore dist by default', () => {
      const parser = new GitignoreParser(tempDir);
      expect(parser.isIgnored(path.join(tempDir, 'dist'))).toBe(true);
    });
  });

  describe('.gitignore file', () => {
    it('should respect .gitignore rules', () => {
      fs.writeFileSync(path.join(tempDir, '.gitignore'), '*.secret\nbuild/\n');

      const parser = new GitignoreParser(tempDir);
      expect(parser.isIgnored(path.join(tempDir, 'config.secret'))).toBe(true);
      expect(parser.isIgnored(path.join(tempDir, 'build'))).toBe(true);
      expect(parser.isIgnored(path.join(tempDir, 'src'))).toBe(false);
    });

    it('should handle missing .gitignore gracefully', () => {
      const parser = new GitignoreParser(tempDir);
      // Should still work with default ignores
      expect(parser.isIgnored(path.join(tempDir, 'node_modules'))).toBe(true);
      expect(parser.isIgnored(path.join(tempDir, 'src'))).toBe(false);
    });
  });

  describe('path handling', () => {
    it('should not ignore paths outside root', () => {
      const parser = new GitignoreParser(tempDir);
      // Parent directory should not be ignored
      expect(parser.isIgnored(path.join(tempDir, '..'))).toBe(false);
    });

    it('should handle nested paths', () => {
      fs.writeFileSync(path.join(tempDir, '.gitignore'), 'logs/\n');

      const parser = new GitignoreParser(tempDir);
      expect(parser.isIgnored(path.join(tempDir, 'logs', 'app.log'))).toBe(true);
      expect(parser.isIgnored(path.join(tempDir, 'src', 'logs'))).toBe(false);
    });
  });
});
