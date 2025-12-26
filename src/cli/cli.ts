import { Command } from 'commander';
import { getVersion } from './utils/version.js';
import {
  registerTaskCommands,
  registerFsCommands,
  registerGitCommands,
  registerProjectCommands,
  registerConfigCommands,
  registerDoctorCommand,
} from './commands/index.js';

export async function run(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name('ccb')
    .description('Claude Code Bridge CLI - Control Claude Code from your terminal')
    .version(getVersion(), '-v, --version')
    .option('--json', 'Output as JSON')
    .option('-q, --quiet', 'Suppress non-essential output');

  registerTaskCommands(program);
  registerFsCommands(program);
  registerGitCommands(program);
  registerProjectCommands(program);
  registerConfigCommands(program);
  registerDoctorCommand(program);

  program.addHelpText(
    'after',
    `
Examples:
  $ ccb task start "Add authentication" --path ./my-api
  $ ccb task status
  $ ccb fs tree ./src
  $ ccb git diff --stat
  $ ccb doctor
`
  );

  await program.parseAsync(argv);
}
