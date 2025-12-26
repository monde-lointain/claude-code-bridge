import { Command } from 'commander';
import { MCPClient } from '../mcp/client.js';
import { createFormatter } from '../output/index.js';
import { detectProjectContext } from '../context/detector.js';
import { loadCLIConfig, saveCLIConfig } from '../config/loader.js';
import { StateManager } from '../state/manager.js';
import { ensureAbsolute } from '../utils/paths.js';
import { existsSync } from 'fs';

export function registerProjectCommands(program: Command): void {
  const project = program.command('project').description('Project management');

  project
    .command('set <path>')
    .description('Set the default project path')
    .action(async (path, _options, command) => {
      const globalOpts = command.parent.parent.opts();
      const formatter = createFormatter(globalOpts);

      const absolutePath = ensureAbsolute(path);

      if (!existsSync(absolutePath)) {
        formatter.error(`Path does not exist: ${absolutePath}`);
        process.exit(1);
      }

      saveCLIConfig({ default_project: absolutePath });
      formatter.success(`Default project set to ${absolutePath}`);
    });

  project
    .command('init <path>')
    .description('Create and initialize a project directory')
    .option('--git', 'Initialize git repository')
    .action(async (path, options, command) => {
      const globalOpts = command.parent.parent.opts();
      const formatter = createFormatter(globalOpts);

      const absolutePath = ensureAbsolute(path);

      const client = new MCPClient();
      try {
        await client.connect();

        await client.callTool('init_project', {
          path: absolutePath,
          init_git: options.git || false,
        });

        formatter.success(`Created ${absolutePath}`);
        if (options.git) {
          formatter.success('Initialized git repository');
        }
      } finally {
        await client.disconnect();
      }
    });

  project
    .command('info')
    .description('Show current project information')
    .action(async (_options, command) => {
      const globalOpts = command.parent.parent.opts();
      createFormatter(globalOpts);
      const config = loadCLIConfig();

      const context = detectProjectContext(undefined, config.default_project);

      console.log('Current Project:');
      console.log(`  Path:     ${context.root}`);
      console.log(`  Source:   ${context.source} (found ${context.marker})`);

      const state = new StateManager(context.root);
      const lastTaskId = state.getLastTaskId();

      if (lastTaskId) {
        const stateData = state.load();
        console.log('');
        console.log('Last Task:');
        console.log(`  ID:       ${lastTaskId}`);
        console.log(`  Status:   ${stateData.last_task_status || 'unknown'}`);
        if (stateData.last_task_time) {
          const time = new Date(stateData.last_task_time);
          const now = new Date();
          const diffMs = now.getTime() - time.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          console.log(`  Time:     ${diffMins} minutes ago`);
        }
      }
    });
}
