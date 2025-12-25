export interface SetActiveProjectInput {
  path: string;
}

export interface SetActiveProjectOutput {
  message: string;
  path: string;
}

export interface ListFilesInput {
  path: string;
}

export interface FileEntry {
  name: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modified: string;
}

export interface ListFilesOutput {
  path: string;
  files: FileEntry[];
}

export interface ReadFileInput {
  path: string;
  header_lines?: number;
}

export interface ReadFileOutput {
  path: string;
  content: string;
  size: number;
  is_truncated: boolean;
}

export interface ReadFileRangeInput {
  path: string;
  start_line: number;
  end_line: number;
}

export interface ReadFileRangeOutput {
  path: string;
  content: string;
  start_line: number;
  end_line: number;
  total_lines: number;
}

export interface GetFileTreeInput {
  path: string;
  depth?: number;
}

export interface GetFileTreeOutput {
  path: string;
  tree: string;
}

export interface CreateDirectoryInput {
  path: string;
}

export interface CreateDirectoryOutput {
  message: string;
  path: string;
}

export interface WriteFileInput {
  path: string;
  content: string;
}

export interface WriteFileOutput {
  message: string;
  path: string;
  size: number;
}

export interface InitGitRepoInput {
  path: string;
}

export interface InitGitRepoOutput {
  message: string;
  path: string;
}

export interface GitStatusInput {
  path: string;
}

export interface GitStatusOutput {
  path: string;
  clean: boolean;
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
}

export interface GitDiffStatInput {
  path: string;
  cached?: boolean;
}

export interface GitDiffFileStat {
  file: string;
  insertions: number;
  deletions: number;
}

export interface GitDiffStatOutput {
  path: string;
  files: GitDiffFileStat[];
  summary: string;
}

export interface GitDiffInput {
  path: string;
  cached?: boolean;
}

export interface GitDiffOutput {
  path: string;
  diff: string;
  truncated: boolean;
  message: string;
}
