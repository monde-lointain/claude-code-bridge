import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { CLIConfig, CLIConfigSchema } from './schema.js';
import { DEFAULT_CLI_CONFIG } from './defaults.js';

const CONFIG_DIR = join(homedir(), '.config', 'ccb');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

export function loadCLIConfig(): CLIConfig {
  if (!existsSync(CONFIG_PATH)) {
    return DEFAULT_CLI_CONFIG;
  }

  try {
    const content = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    return CLIConfigSchema.parse({ ...DEFAULT_CLI_CONFIG, ...parsed });
  } catch (error) {
    console.error(`Warning: Invalid config at ${CONFIG_PATH}, using defaults`);
    return DEFAULT_CLI_CONFIG;
  }
}

export function saveCLIConfig(config: Partial<CLIConfig>): void {
  const existing = loadCLIConfig();
  const merged = { ...existing, ...config };

  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}
