import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigLoader } from '../../../src/config/loader.js';

vi.mock('node:fs');
vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
}));

describe('ConfigLoader', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('env var overrides', () => {
    it('should override allowed_roots from MCP_ALLOWED_ROOTS', async () => {
      process.env.MCP_ALLOWED_ROOTS = '/tmp/test1,/tmp/test2';

      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(true);

      const loader = new ConfigLoader();
      const config = loader.load();

      expect(config.allowed_roots).toEqual(['/tmp/test1', '/tmp/test2']);
    });

    it('should override timeout from MCP_DEFAULT_TIMEOUT', async () => {
      process.env.MCP_ALLOWED_ROOTS = '/tmp';
      process.env.MCP_DEFAULT_TIMEOUT = '7200';

      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(true);

      const loader = new ConfigLoader();
      const config = loader.load();

      expect(config.default_timeout_seconds).toBe(7200);
    });

    it('should override log level from MCP_LOG_LEVEL', async () => {
      process.env.MCP_ALLOWED_ROOTS = '/tmp';
      process.env.MCP_LOG_LEVEL = 'debug';

      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(true);

      const loader = new ConfigLoader();
      const config = loader.load();

      expect(config.log_level).toBe('debug');
    });
  });

  describe('validation', () => {
    it('should throw error when no allowed_roots provided', async () => {
      const { existsSync, readFileSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      const loader = new ConfigLoader();
      expect(() => loader.load()).toThrow();
    });

    it('should accept valid config', async () => {
      process.env.MCP_ALLOWED_ROOTS = '/tmp';

      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(true);

      const loader = new ConfigLoader();
      const config = loader.load();

      expect(config.allowed_roots).toEqual(['/tmp']);
      expect(config.default_timeout_seconds).toBe(3600); // default
    });
  });

  describe('default values', () => {
    it('should use default values when not overridden', async () => {
      process.env.MCP_ALLOWED_ROOTS = '/tmp';

      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(true);

      const loader = new ConfigLoader();
      const config = loader.load();

      expect(config.default_timeout_seconds).toBe(3600);
      expect(config.max_log_size_bytes).toBe(10 * 1024 * 1024);
      expect(config.task_history_size).toBe(20);
      expect(config.default_tree_depth).toBe(2);
      expect(config.shell).toBe('/bin/bash');
      expect(config.log_level).toBe('info');
    });
  });

  describe('file loading', () => {
    it('should load config from file when present', async () => {
      const mockConfig = {
        allowed_roots: ['/home/test'],
        default_timeout_seconds: 1800
      };

      const { existsSync, readFileSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockConfig));

      const loader = new ConfigLoader();
      const config = loader.load();

      expect(config.allowed_roots).toEqual(['/home/test']);
      expect(config.default_timeout_seconds).toBe(1800);
    });
  });
});
