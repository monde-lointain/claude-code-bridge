import type { TaskSummary } from './task.types.js';

export interface LogsResourceParams {
  task_id: string;
}

export interface TasksActiveResource {
  tasks: TaskSummary[];
}

export interface ConfigResource {
  allowed_roots: string[];
  default_timeout_seconds: number;
  max_log_size_bytes: number;
  task_history_size: number;
  default_tree_depth: number;
  max_diff_size_bytes: number;
}
