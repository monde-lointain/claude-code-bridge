import { Command } from 'commander';
import { createFormatter } from '../output/index.js';
import { loadCLIConfig, getConfigPath } from '../config/loader.js';
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export function registerConfigCommands(program: Command): void {
  const config = program.command('config').description('Configuration management');

  config
    .command('show')
    .description('Display merged configuration')
    .action(async (_options, command) => {
      const globalOpts = command.parent.parent.opts();
      createFormatter(globalOpts);

      const cliConfig = loadCLIConfig();

      const serverConfigPath = join(
        homedir(),
        '.config',
        'mcp-claude-bridge',
        'config.json'
      );

      console.log('Server Configuration (~/.config/mcp-claude-bridge/config.json):');
      if (existsSync(serverConfigPath)) {
        try {
          const serverConfig = JSON.parse(readFileSync(serverConfigPath, 'utf-8'));
          console.log('  allowed_roots:');
          if (serverConfig.allowed_roots) {
            serverConfig.allowed_roots.forEach((root: string) => {
              console.log(`    - ${root}`);
            });
          }
          console.log(
            `  default_timeout_seconds: ${serverConfig.default_timeout_seconds || 3600}`
          );
          console.log(`  log_level: ${serverConfig.log_level || 'info'}`);
        } catch {
          console.log('  (invalid JSON)');
        }
      } else {
        console.log('  (not found)');
      }

      console.log('');
      console.log('CLI Configuration (~/.config/ccb/config.json):');
      console.log(`  default_project: ${cliConfig.default_project || '(not set)'}`);
      console.log(`  output_format: ${cliConfig.output_format}`);
      console.log(`  color: ${cliConfig.color}`);
    });

  config
    .command('edit')
    .description('Open configuration in editor')
    .option('--server', 'Edit server config instead of CLI config')
    .option('--cli', 'Edit CLI config (default)')
    .action(async (options, command) => {
      const globalOpts = command.parent.parent.opts();
      const formatter = createFormatter(globalOpts);

      const configPath = options.server
        ? join(homedir(), '.config', 'mcp-claude-bridge', 'config.json')
        : getConfigPath();

      const editor = process.env.EDITOR || 'nano';

      formatter.info(`Opening ${configPath} in ${editor}...`);

      const proc = spawn(editor, [configPath], {
        stdio: 'inherit',
      });

      proc.on('exit', (code) => {
        if (code === 0) {
          formatter.success('Configuration saved');
        } else {
          formatter.error('Editor exited with error');
          process.exit(1);
        }
      });
    });
}
