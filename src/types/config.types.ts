export interface Config {
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
