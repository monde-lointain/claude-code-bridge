import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ConfigSchema, type Config } from './schema.js';
import { defaultConfig } from './defaults.js';

export class ConfigLoader {
  private config: Config | null = null;

  /**
   * Load configuration from file and environment variables.
   * Environment variables override file values.
   */
  load(): Config {
    if (this.config) {
      return this.config;
    }

    // 1. Start with defaults
    let rawConfig: Record<string, unknown> = { ...defaultConfig };

    // 2. Load from file
    const configPath = this.findConfigFile();
    if (configPath) {
      try {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        rawConfig = { ...rawConfig, ...fileConfig };
        console.error(`[config] Loaded config from ${configPath}`);
      } catch (err) {
        console.error(`[config] Warning: Failed to load ${configPath}: ${err}`);
      }
    }

    // 3. Apply environment variable overrides
    rawConfig = this.applyEnvOverrides(rawConfig);

    // 4. Validate with Zod
    const result = ConfigSchema.safeParse(rawConfig);
    if (!result.success) {
      console.error('[config] Configuration validation failed:');
      console.error(result.error.format());
      throw new Error('Invalid configuration');
    }

    // 5. Validate allowed_roots exist (soft validation - warn only)
    this.validateAllowedRoots(result.data.allowed_roots);

    this.config = result.data;
    return this.config;
  }

  private findConfigFile(): string | null {
    const candidates = [
      process.env.MCP_CLAUDE_BRIDGE_CONFIG,
      path.join(os.homedir(), '.config', 'mcp-claude-bridge', 'config.json'),
      path.join(process.cwd(), 'config.json'),
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private applyEnvOverrides(config: Record<string, unknown>): Record<string, unknown> {
    if (process.env.MCP_ALLOWED_ROOTS) {
      config.allowed_roots = process.env.MCP_ALLOWED_ROOTS.split(',').map(p => p.trim());
    }
    if (process.env.MCP_DEFAULT_TIMEOUT) {
      config.default_timeout_seconds = parseInt(process.env.MCP_DEFAULT_TIMEOUT, 10);
    }
    if (process.env.MCP_MAX_LOG_SIZE) {
      config.max_log_size_bytes = parseInt(process.env.MCP_MAX_LOG_SIZE, 10);
    }
    if (process.env.MCP_TASK_HISTORY_SIZE) {
      config.task_history_size = parseInt(process.env.MCP_TASK_HISTORY_SIZE, 10);
    }
    if (process.env.MCP_TREE_DEPTH) {
      config.default_tree_depth = parseInt(process.env.MCP_TREE_DEPTH, 10);
    }
    if (process.env.MCP_MAX_DIFF_SIZE) {
      config.max_diff_size_bytes = parseInt(process.env.MCP_MAX_DIFF_SIZE, 10);
    }
    if (process.env.MCP_SHELL) {
      config.shell = process.env.MCP_SHELL;
    }
    if (process.env.MCP_CLAUDE_COMMAND) {
      config.claude_command = process.env.MCP_CLAUDE_COMMAND;
    }
    if (process.env.MCP_LOG_LEVEL) {
      config.log_level = process.env.MCP_LOG_LEVEL;
    }

    return config;
  }

  private validateAllowedRoots(roots: string[]): void {
    for (const root of roots) {
      const expandedPath = root.replace(/^~/, os.homedir());
      if (!fs.existsSync(expandedPath)) {
        console.error(`[config] Warning: allowed_root does not exist: ${root}`);
      }
    }
  }
}

// Singleton instance
export const configLoader = new ConfigLoader();
