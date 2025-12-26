import { Command } from 'commander';
import { MCPClient } from '../mcp/client.js';
import { createFormatter } from '../output/index.js';
import { detectProjectContext } from '../context/detector.js';
import { loadCLIConfig } from '../config/loader.js';
import { GitStatusResult, GitDiffResult } from '../../shared/tool-types.js';

export function registerGitCommands(program: Command): void {
  const git = program.command('git').description('Git repository operations');

  git
    .command('status [path]')
    .description('Show repository status')
    .action(async (path, _options, command) => {
      const globalOpts = command.parent.parent.opts();
      const formatter = createFormatter(globalOpts);
      const config = loadCLIConfig();

      const context = detectProjectContext(path, config.default_project);

      const client = new MCPClient();
      try {
        await client.connect();

        const result = await client.callTool<GitStatusResult>('git_status', {
          path: context.root,
        });

        formatter.gitStatus(result);
      } finally {
        await client.disconnect();
      }
    });

  git
    .command('diff [path]')
    .description('Show diff output')
    .option('--stat', 'Show diff statistics only')
    .option('--cached', 'Show staged changes')
    .action(async (path, options, command) => {
      const globalOpts = command.parent.parent.opts();
      const formatter = createFormatter(globalOpts);
      const config = loadCLIConfig();

      const context = detectProjectContext(path, config.default_project);

      const client = new MCPClient();
      try {
        await client.connect();

        const result = await client.callTool<GitDiffResult>('git_diff', {
          path: context.root,
          staged: options.cached || false,
          stat_only: options.stat || false,
        });

        formatter.gitDiff(result);
      } finally {
        await client.disconnect();
      }
    });
}
