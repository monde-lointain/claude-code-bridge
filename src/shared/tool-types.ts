import { z } from 'zod';

// Task Tool Types
export const StartTaskInputSchema = z.object({
  prompt: z.string(),
  path: z.string(),
  timeout_seconds: z.number().optional().default(3600),
});

export type StartTaskInput = z.infer<typeof StartTaskInputSchema>;

export interface StartTaskResult {
  task_id: string;
  status: string;
  path: string;
}

export const GetTaskStatusInputSchema = z.object({
  task_id: z.string(),
});

export type GetTaskStatusInput = z.infer<typeof GetTaskStatusInputSchema>;

export interface TaskStatusResult {
  task_id: string;
  status: 'pending' | 'starting' | 'running' | 'completed' | 'failed' | 'timeout' | 'killed';
  elapsed_seconds: number;
  exit_code: number | null;
  last_output?: string;
}

export const KillTaskInputSchema = z.object({
  task_id: z.string(),
});

export type KillTaskInput = z.infer<typeof KillTaskInputSchema>;

export interface TaskCompletedResult {
  task_id: string;
  elapsed_seconds: number;
  exit_code: number;
  files_modified?: number;
}

export interface TaskFailedResult {
  task_id: string;
  elapsed_seconds: number;
  exit_code: number;
  status: string;
}

// Filesystem Tool Types
export const ListFilesInputSchema = z.object({
  path: z.string(),
  show_hidden: z.boolean().optional().default(false),
});

export type ListFilesInput = z.infer<typeof ListFilesInputSchema>;

export interface FileEntry {
  name: string;
  type: 'file' | 'directory' | 'symlink';
  size?: number;
  mode?: number;
}

export interface FileListResult {
  path: string;
  entries: FileEntry[];
  total: number;
}

export const ReadFileInputSchema = z.object({
  path: z.string(),
  start_line: z.number().optional(),
  end_line: z.number().optional(),
});

export type ReadFileInput = z.infer<typeof ReadFileInputSchema>;

export interface FileContentResult {
  path: string;
  content: string;
  start_line: number;
  end_line: number;
  total_lines: number;
  is_binary: boolean;
}

export const GetDirectoryTreeInputSchema = z.object({
  path: z.string(),
  max_depth: z.number().optional().default(3),
});

export type GetDirectoryTreeInput = z.infer<typeof GetDirectoryTreeInputSchema>;

export interface TreeNode {
  name: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

export interface FileTreeResult {
  path: string;
  tree: TreeNode;
}

// Git Tool Types
export const GitStatusInputSchema = z.object({
  path: z.string(),
});

export type GitStatusInput = z.infer<typeof GitStatusInputSchema>;

export interface GitFileStatus {
  path: string;
  status: string;
}

export interface GitStatusResult {
  branch: string;
  ahead: number;
  behind: number;
  staged: GitFileStatus[];
  modified: GitFileStatus[];
  untracked: string[];
}

export const GitDiffInputSchema = z.object({
  path: z.string(),
  staged: z.boolean().optional().default(false),
  stat_only: z.boolean().optional().default(false),
});

export type GitDiffInput = z.infer<typeof GitDiffInputSchema>;

export interface GitDiffResult {
  diff: string;
  files_changed?: number;
  insertions?: number;
  deletions?: number;
}

// Project Tool Types
export const SetDefaultProjectInputSchema = z.object({
  path: z.string(),
});

export type SetDefaultProjectInput = z.infer<typeof SetDefaultProjectInputSchema>;

export const InitProjectInputSchema = z.object({
  path: z.string(),
  init_git: z.boolean().optional().default(false),
});

export type InitProjectInput = z.infer<typeof InitProjectInputSchema>;
