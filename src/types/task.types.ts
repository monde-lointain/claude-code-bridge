export type TaskStatus =
  | 'pending'
  | 'starting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'killed'
  | 'error';

export type PermissionMode = 'auto' | 'cautious';

export interface Task {
  id: string;
  status: TaskStatus;
  projectPath: string;
  prompt: string;
  permissionMode: PermissionMode;
  timeoutSeconds: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  pid: number | null;
  exitCode: number | null;
  logFile: string;
  lastOutput: string;
  outputSizeBytes: number;
}

export interface TaskSummary {
  id: string;
  status: TaskStatus;
  projectPath: string;
  createdAt: string;
  elapsedSeconds: number;
  lastOutput: string;
}

export interface StartTaskInput {
  prompt: string;
  path: string;
  timeout_seconds?: number;
  permission_mode?: PermissionMode;
}

export interface StartTaskOutput {
  task_id: string;
  status: TaskStatus;
  message: string;
}

export interface GetTaskStatusInput {
  task_id: string;
}

export interface GetTaskStatusOutput {
  task_id: string;
  status: TaskStatus;
  elapsed_seconds: number;
  exit_code: number | null;
  last_output: string;
  files_changed?: string[];
  hint: string;
}

export interface KillTaskInput {
  task_id: string;
}

export interface KillTaskOutput {
  task_id: string;
  status: TaskStatus;
  message: string;
}
