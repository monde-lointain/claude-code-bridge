#!/usr/bin/env node

import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { homedir } from 'os';

interface Config {
  allowed_roots: string[];
  default_timeout_seconds: number;
  max_log_size_bytes: number;
  task_history_size: number;
  default_tree_depth: number;
  max_diff_size_bytes: number;
  default_header_lines: number;
  shell: string;
  claude_command: string;
  auto_approve_patterns: string[];
  log_level: 'debug' | 'info' | 'warn' | 'error';
}

const DEFAULT_CONFIG: Partial<Config> = {
  default_timeout_seconds: 120,
  max_log_size_bytes: 10485760,
  task_history_size: 100,
  default_tree_depth: 3,
  max_diff_size_bytes: 1048576,
  default_header_lines: 50,
  shell: '/bin/bash',
  claude_command: 'claude',
  auto_approve_patterns: [],
  log_level: 'info',
};

async function prompt(rl: any, question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` (default: ${defaultValue})` : '';
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || defaultValue || '';
}

async function validatePaths(paths: string[]): Promise<boolean> {
  const invalid: string[] = [];

  for (const path of paths) {
    const resolved = resolve(path);
    if (!existsSync(resolved)) {
      invalid.push(path);
    }
  }

  if (invalid.length > 0) {
    console.error(`\nError: The following paths do not exist:`);
    invalid.forEach(p => console.error(`  - ${p}`));
    return false;
  }

  return true;
}

async function main() {
  const rl = createInterface({ input, output });

  console.log('=== MCP Claude Bridge Configuration Setup ===\n');

  try {
    // Prompt for allowed_roots
    const rootsInput = await prompt(
      rl,
      'Enter allowed root directories (comma-separated)',
      homedir()
    );
    const allowed_roots = rootsInput
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (allowed_roots.length === 0) {
      console.error('Error: At least one allowed root directory is required');
      process.exit(1);
    }

    // Validate paths
    console.log('\nValidating paths...');
    if (!(await validatePaths(allowed_roots))) {
      process.exit(1);
    }
    console.log('All paths valid.');

    // Prompt for timeout
    const timeoutInput = await prompt(
      rl,
      'Default timeout in seconds',
      String(DEFAULT_CONFIG.default_timeout_seconds)
    );
    const default_timeout_seconds = parseInt(timeoutInput) || DEFAULT_CONFIG.default_timeout_seconds!;

    // Prompt for log_level
    const log_level_input = await prompt(
      rl,
      'Log level (debug/info/warn/error)',
      DEFAULT_CONFIG.log_level
    );
    const log_level = ['debug', 'info', 'warn', 'error'].includes(log_level_input)
      ? (log_level_input as 'debug' | 'info' | 'warn' | 'error')
      : DEFAULT_CONFIG.log_level!;

    // Prompt for permission_mode (stored as auto_approve_patterns)
    const permission_mode = await prompt(
      rl,
      'Permission mode (auto/cautious)',
      'cautious'
    );
    const auto_approve_patterns = permission_mode === 'auto' ? ['*'] : [];

    // Build config
    const config: Config = {
      allowed_roots: allowed_roots.map(p => resolve(p)),
      default_timeout_seconds,
      log_level,
      auto_approve_patterns,
      max_log_size_bytes: DEFAULT_CONFIG.max_log_size_bytes!,
      task_history_size: DEFAULT_CONFIG.task_history_size!,
      default_tree_depth: DEFAULT_CONFIG.default_tree_depth!,
      max_diff_size_bytes: DEFAULT_CONFIG.max_diff_size_bytes!,
      default_header_lines: DEFAULT_CONFIG.default_header_lines!,
      shell: DEFAULT_CONFIG.shell!,
      claude_command: DEFAULT_CONFIG.claude_command!,
    };

    // Write config
    const configDir = resolve(homedir(), '.config', 'mcp-claude-bridge');
    const configPath = resolve(configDir, 'config.json');

    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    console.log(`\n✓ Configuration written to: ${configPath}`);
    console.log('\nConfiguration summary:');
    console.log(`  Allowed roots: ${config.allowed_roots.join(', ')}`);
    console.log(`  Timeout: ${config.default_timeout_seconds}s`);
    console.log(`  Log level: ${config.log_level}`);
    console.log(`  Permission mode: ${permission_mode}`);

  } catch (error) {
    console.error('\nSetup failed:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
