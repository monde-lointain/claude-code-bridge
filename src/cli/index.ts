#!/usr/bin/env node

import { run } from './cli.js';
import { CLIError } from './errors/cli-error.js';
import { generateHint } from './errors/hints.js';

process.on('uncaughtException', (error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(`Unhandled rejection: ${reason}`);
  process.exit(1);
});

run(process.argv).catch((error) => {
  if (error instanceof CLIError) {
    console.error(error.message);
    if (error.hint) {
      console.error(`Tip: ${error.hint}`);
    }
    process.exit(error.exitCode);
  } else {
    console.error(error.message);
    const hint = generateHint(error.message);
    if (hint) {
      console.error(`Tip: ${hint}`);
    }
    process.exit(1);
  }
});
