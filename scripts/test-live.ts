#!/usr/bin/env tsx

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as pty from 'node-pty';
import { ConfigLoader } from '../src/config/loader.js';
import { FilesystemService } from '../src/services/filesystem.service.js';
import { GitService } from '../src/services/git.service.js';
import type { Config } from '../src/config/schema.js';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(msg: string): void {
  console.log(`${COLORS.cyan}[test-live]${COLORS.reset} ${msg}`);
}

function success(msg: string): void {
  console.log(`${COLORS.green}✓${COLORS.reset} ${msg}`);
}

function error(msg: string): void {
  console.log(`${COLORS.red}✗${COLORS.reset} ${msg}`);
}

function header(msg: string): void {
  console.log(`\n${COLORS.bright}${COLORS.blue}${msg}${COLORS.reset}`);
}

async function cleanupTempDir(tmpDir: string): Promise<void> {
  try {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  } catch (err) {
    error(`Failed to cleanup temp directory: ${err}`);
  }
}

async function testPtySpawn(): Promise<void> {
  header('Testing PTY Process Spawn');

  return new Promise((resolve, reject) => {
    log('Spawning PTY with command: echo "hello from pty"');

    const ptyProcess = pty.spawn('/bin/bash', ['-c', 'echo "hello from pty"'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env as { [key: string]: string },
    });

    let output = '';
    let completed = false;

    ptyProcess.onData((data: string) => {
      output += data;
      log(`PTY output: ${data.trim()}`);
    });

    ptyProcess.onExit(({ exitCode }) => {
      if (completed) return;
      completed = true;

      if (exitCode === 0 && output.includes('hello from pty')) {
        success(`PTY spawned successfully, exit code: ${exitCode}`);
        resolve();
      } else {
        error(`PTY failed with exit code: ${exitCode}`);
        reject(new Error(`PTY test failed: exit code ${exitCode}`));
      }
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      if (completed) return;
      completed = true;

      ptyProcess.kill();
      error('PTY test timeout');
      reject(new Error('PTY test timeout'));
    }, 5000);
  });
}

async function main(): Promise<void> {
  console.log(`${COLORS.bright}${COLORS.yellow}Claude Code Bridge - Live Smoke Test${COLORS.reset}\n`);

  // 1. Create temp directory as allowed_root
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccb-test-'));
  log(`Created temp directory: ${tmpDir}`);

  try {
    // 2. Initialize config with temp directory as allowed_root
    header('Initializing Configuration');
    const config: Config = {
      allowed_roots: [tmpDir],
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
    success('Config initialized');

    // 3. Initialize services
    header('Initializing Services');
    const fsService = new FilesystemService(config);
    const gitService = new GitService(config);
    success('Services initialized');

    // 4. Test: set_active_project (validate path)
    header('Test: set_active_project (path validation)');
    try {
      const validatedPath = fsService.validatePath(tmpDir);
      success(`Path validated: ${validatedPath}`);
    } catch (err) {
      error(`Path validation failed: ${err}`);
      throw err;
    }

    // 5. Test: create_directory
    header('Test: create_directory');
    const testDir = path.join(tmpDir, 'test-project', 'src');
    await fsService.createDirectory(testDir);
    success(`Directory created: ${testDir}`);

    // 6. Test: write_file
    header('Test: write_file');
    const testFile = path.join(testDir, 'index.ts');
    const content = 'export function hello() {\n  return "world";\n}\n';
    await fsService.writeFile(testFile, content);
    success(`File written: ${testFile} (${content.length} bytes)`);

    // 7. Test: list_files
    header('Test: list_files');
    const listResult = await fsService.listFiles(path.join(tmpDir, 'test-project'));
    log(`Files found: ${listResult.files.length}`);
    for (const file of listResult.files) {
      log(`  - ${file.name} (${file.type}, ${file.size} bytes)`);
    }
    success('list_files successful');

    // 8. Test: read_file
    header('Test: read_file');
    const readResult = await fsService.readFile(testFile);
    log(`File content:\n${readResult.content}`);
    if (readResult.content === content) {
      success('read_file successful (content matches)');
    } else {
      error('read_file failed (content mismatch)');
      throw new Error('Content mismatch');
    }

    // 9. Test: init git repo
    header('Test: init_git_repo');
    const projectPath = path.join(tmpDir, 'test-project');
    await fsService.initGitRepo(projectPath);
    success(`Git repo initialized: ${projectPath}`);

    // 10. Test: git_status
    header('Test: git_status');
    const gitStatus = gitService.getStatus(projectPath);
    log(`Branch: ${gitStatus.branch}`);
    log(`Clean: ${gitStatus.clean}`);
    log(`Untracked files: ${gitStatus.untracked.length}`);
    for (const file of gitStatus.untracked) {
      log(`  - ${file}`);
    }
    success('git_status successful');

    // 11. Test: file tree
    header('Test: get_file_tree');
    const tree = await fsService.getFileTree(projectPath);
    log(`File tree:\n${tree}`);
    success('get_file_tree successful');

    // 12. Test: PTY spawn
    await testPtySpawn();

    // All tests passed
    console.log(`\n${COLORS.bright}${COLORS.green}All tests passed!${COLORS.reset}\n`);
  } catch (err) {
    console.error(`\n${COLORS.bright}${COLORS.red}Test failed:${COLORS.reset}`, err);
    process.exit(1);
  } finally {
    // Cleanup
    header('Cleanup');
    await cleanupTempDir(tmpDir);
    success('Temp directory cleaned up');
  }
}

// Run main and handle errors
main().catch((err) => {
  console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, err);
  process.exit(1);
});
