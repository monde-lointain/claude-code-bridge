import { OutputFormatter } from './formatter.js';
import { HumanFormatter } from './human.formatter.js';
import { JSONFormatter } from './json.formatter.js';

export * from './formatter.js';
export * from './human.formatter.js';
export * from './json.formatter.js';

export function createFormatter(options: {
  json?: boolean;
  quiet?: boolean;
  color?: boolean;
}): OutputFormatter {
  if (options.json) {
    return new JSONFormatter();
  }
  return new HumanFormatter({
    quiet: options.quiet,
    color: options.color,
  });
}
