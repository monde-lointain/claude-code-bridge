import { Command } from 'commander';
import { MCPClient } from '../mcp/client.js';
import { detectProjectContext } from '../context/detector.js';
import { StateManager } from '../state/manager.js';
import { createFormatter, OutputFormatter } from '../output/index.js';
import { CLIError } from '../errors/cli-error.js';
import { resolvePromptInput } from '../utils/prompt-input.js';
import { loadCLIConfig } from '../config/loader.js';
import { StartTaskResult, TaskStatusResult } from '../../shared/tool-types.js';

export function registerTaskCommands(program: Command): void {
  const task = program.command('task').description('Manage Claude Code tasks');

  task
    .command('start [prompt]')
    .description('Start a Claude Code task')
    .option('-p, --path <dir>', 'Project directory path')
    .option('-f, --file <file>', 'Read prompt from file')
    .option('-t, --timeout <seconds>', 'Task timeout', '3600')
    .option('-d, --detach', 'Return immediately with task ID')
    .addHelpText(
      'after',
      `
Examples:
  $ ccb task start "Add JWT authentication" --path ./my-api
  $ ccb task start --file spec.md --path ./my-api
  $ cat prompt.md | ccb task start --path ./my-api
  $ ccb task start "Fix ESLint errors" --detach
`
    )
    .action(async (promptArg, options, command) => {
      const globalOpts = command.parent.parent.opts();
      const formatter = createFormatter(globalOpts);
      const config = loadCLIConfig();

      const prompt = await resolvePromptInput(promptArg, options.file);
      const context = detectProjectContext(options.path, config.default_project);

      formatter.startSpinner('Connecting to MCP server...');

      const client = new MCPClient();
      try {
        await client.connect();
        formatter.stopSpinner(true, 'Connected');

        formatter.startSpinner('Starting task...');

        const result = await client.callTool<StartTaskResult>('start_task', {
          prompt,
          path: context.root,
          timeout_seconds: parseInt(options.timeout, 10),
        });

        formatter.stopSpinner(true);
        formatter.taskStarted(result.task_id, context.root);

        const state = new StateManager(context.root);
        state.setLastTask(result.task_id, 'running');

        if (!options.detach) {
          await followTask(client, result.task_id, formatter, state, config.poll_interval_ms);
        }
      } finally {
        await client.disconnect();
      }
    });

  task
    .command('status [task-id]')
    .description('Get task status')
    .action(async (taskIdArg, _options, command) => {
      const globalOpts = command.parent.parent.opts();
      const formatter = createFormatter(globalOpts);
      const config = loadCLIConfig();

      const context = detectProjectContext(undefined, config.default_project);
      const state = new StateManager(context.root);
      const taskId = taskIdArg || state.getLastTaskId();

      if (!taskId) {
        throw new CLIError('No task ID provided and no recent task found.', 2);
      }

      const client = new MCPClient();
      try {
        await client.connect();

        const result = await client.callTool<TaskStatusResult>('get_task_status', {
          task_id: taskId,
        });

        formatter.taskStatus(result);
      } finally {
        await client.disconnect();
      }
    });

  task
    .command('kill [task-id]')
    .description('Terminate a running task')
    .action(async (taskIdArg, _options, command) => {
      const globalOpts = command.parent.parent.opts();
      const formatter = createFormatter(globalOpts);
      const config = loadCLIConfig();

      const context = detectProjectContext(undefined, config.default_project);
      const state = new StateManager(context.root);
      const taskId = taskIdArg || state.getLastTaskId();

      if (!taskId) {
        throw new CLIError('No task ID provided and no recent task found.', 2);
      }

      formatter.startSpinner(`Killing task ${taskId}...`);

      const client = new MCPClient();
      try {
        await client.connect();

        await client.callTool('kill_task', { task_id: taskId });

        formatter.stopSpinner(true);
        formatter.taskKilled(taskId);

        state.setLastTask(taskId, 'killed');
      } finally {
        await client.disconnect();
      }
    });

  task
    .command('watch [task-id]')
    .description('Attach to a running task')
    .action(async (taskIdArg, _options, command) => {
      const globalOpts = command.parent.parent.opts();
      const formatter = createFormatter(globalOpts);
      const config = loadCLIConfig();

      const context = detectProjectContext(undefined, config.default_project);
      const state = new StateManager(context.root);
      const taskId = taskIdArg || state.getLastTaskId();

      if (!taskId) {
        throw new CLIError('No task ID provided and no recent task found.', 2);
      }

      const client = new MCPClient();
      try {
        await client.connect();
        await followTask(client, taskId, formatter, state, config.poll_interval_ms);
      } finally {
        await client.disconnect();
      }
    });

  task
    .command('logs [task-id]')
    .description('View full task logs')
    .action(async (taskIdArg, _options, command) => {
      const globalOpts = command.parent.parent.opts();
      createFormatter(globalOpts);
      const config = loadCLIConfig();

      const context = detectProjectContext(undefined, config.default_project);
      const state = new StateManager(context.root);
      const taskId = taskIdArg || state.getLastTaskId();

      if (!taskId) {
        throw new CLIError('No task ID provided and no recent task found.', 2);
      }

      const client = new MCPClient();
      try {
        await client.connect();

        const logs = await client.readResource(`logs://${taskId}`);
        console.log(logs);
      } finally {
        await client.disconnect();
      }
    });

  task
    .command('list')
    .description('List recent and active tasks')
    .option('-a, --all', 'Show all tasks, not just current project')
    .action(async (_options, command) => {
      const globalOpts = command.parent.parent.opts();
      const formatter = createFormatter(globalOpts);

      const client = new MCPClient();
      try {
        await client.connect();

        const tasks = await client.readResource('tasks://active');
        formatter.taskList(JSON.parse(tasks));
      } finally {
        await client.disconnect();
      }
    });
}

async function followTask(
  client: MCPClient,
  taskId: string,
  formatter: OutputFormatter,
  state: StateManager,
  pollInterval: number
): Promise<void> {
  console.log('[Following task output - Ctrl+C to detach or kill]');
  console.log('');

  let lastOutput = '';
  let running = true;

  const handleInterrupt = async () => {
    console.log('');
    console.log('Caught interrupt. [D]etach (default) or [K]ill task?');

    const response = await Promise.race([
      new Promise<string>((resolve) => {
        process.stdin.setRawMode(true);
        process.stdin.once('data', (data) => {
          process.stdin.setRawMode(false);
          resolve(data.toString().trim().toLowerCase());
        });
      }),
      new Promise<string>((resolve) => setTimeout(() => resolve('d'), 3000)),
    ]);

    if (response === 'k') {
      formatter.startSpinner('Killing task...');
      await client.callTool('kill_task', { task_id: taskId });
      formatter.stopSpinner(true, 'Task killed');
      state.setLastTask(taskId, 'killed');
      process.exit(130);
    } else {
      console.log('Detaching... task continues running.');
      console.log("Use 'ccb task status' to check progress.");
      running = false;
    }
  };

  process.on('SIGINT', handleInterrupt);

  try {
    while (running) {
      const status = await client.callTool<TaskStatusResult>('get_task_status', {
        task_id: taskId,
      });

      if (status.last_output && status.last_output !== lastOutput) {
        const newOutput = status.last_output.slice(lastOutput.length);
        if (newOutput) {
          for (const line of newOutput.split('\n')) {
            if (line) formatter.taskOutput(line);
          }
        }
        lastOutput = status.last_output;
      }

      if (['completed', 'failed', 'timeout', 'killed'].includes(status.status)) {
        state.setLastTask(taskId, status.status as any);

        if (status.status === 'completed') {
          formatter.taskCompleted({
            task_id: taskId,
            elapsed_seconds: status.elapsed_seconds,
            exit_code: 0,
          });
        } else {
          formatter.taskFailed({
            task_id: taskId,
            elapsed_seconds: status.elapsed_seconds,
            exit_code: status.exit_code || 1,
            status: status.status,
          });
          process.exitCode = 127;
        }
        break;
      }

      await new Promise((r) => setTimeout(r, pollInterval));
    }
  } finally {
    process.off('SIGINT', handleInterrupt);
  }
}
