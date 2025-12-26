import { Command } from 'commander';
import { MCPClient } from '../mcp/client.js';
import { createFormatter } from '../output/index.js';
import { detectProjectContext } from '../context/detector.js';
import { loadCLIConfig } from '../config/loader.js';
import { ensureAbsolute } from '../utils/paths.js';
import {
  FileListResult,
  FileContentResult,
  FileTreeResult,
} from '../../shared/tool-types.js';

export function registerFsCommands(program: Command): void {
  const fs = program.command('fs').description('Filesystem operations');

  fs.command('list <path>')
    .description('List directory contents')
    .option('-a, --all', 'Show hidden files')
    .action(async (path, options, command) => {
      const globalOpts = command.parent.parent.opts();
      const formatter = createFormatter(globalOpts);

      const absolutePath = ensureAbsolute(path);

      const client = new MCPClient();
      try {
        await client.connect();

        const result = await client.callTool<FileListResult>('list_files', {
          path: absolutePath,
          show_hidden: options.all || false,
        });

        formatter.fileList(result);
      } finally {
        await client.disconnect();
      }
    });

  fs.command('read <path>')
    .description('Read file contents')
    .option('-l, --lines <range>', 'Line range (e.g., "1:50", "100:150")')
    .action(async (path, options, command) => {
      const globalOpts = command.parent.parent.opts();
      const formatter = createFormatter(globalOpts);

      const absolutePath = ensureAbsolute(path);

      let startLine: number | undefined;
      let endLine: number | undefined;

      if (options.lines) {
        const parts = options.lines.split(':');
        startLine = parseInt(parts[0], 10);
        endLine = parts[1] ? parseInt(parts[1], 10) : undefined;
      }

      const client = new MCPClient();
      try {
        await client.connect();

        const result = await client.callTool<FileContentResult>('read_file', {
          path: absolutePath,
          start_line: startLine,
          end_line: endLine,
        });

        formatter.fileContent(result);
      } finally {
        await client.disconnect();
      }
    });

  fs.command('tree [path]')
    .description('Show directory tree')
    .option('-d, --depth <n>', 'Maximum depth', '3')
    .action(async (path, options, command) => {
      const globalOpts = command.parent.parent.opts();
      const formatter = createFormatter(globalOpts);
      const config = loadCLIConfig();

      const context = detectProjectContext(path, config.default_project);

      const client = new MCPClient();
      try {
        await client.connect();

        const result = await client.callTool<FileTreeResult>('get_directory_tree', {
          path: context.root,
          max_depth: parseInt(options.depth, 10),
        });

        formatter.fileTree(result);
      } finally {
        await client.disconnect();
      }
    });
}
