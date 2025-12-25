import type { Config } from './schema.js';

export const defaultConfig: Partial<Config> = {
  default_timeout_seconds: 3600,
  max_log_size_bytes: 10 * 1024 * 1024,
  task_history_size: 20,
  default_tree_depth: 2,
  max_diff_size_bytes: 50 * 1024,
  default_header_lines: 50,
  shell: '/bin/bash',
  claude_command: 'claude',
  auto_approve_patterns: [
    'Do you want to proceed\\?',
    '\\[y/N\\]',
    '\\[Y/n\\]',
    'Continue\\?',
    'Approve\\?',
  ],
  log_level: 'info',
};
