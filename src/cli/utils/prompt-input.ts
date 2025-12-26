import { readFileSync } from 'fs';
import { resolve } from 'path';

export async function resolvePromptInput(
  promptArg?: string,
  fileOption?: string
): Promise<string> {
  if (promptArg) {
    return promptArg;
  }

  if (fileOption) {
    return readFileSync(resolve(fileOption), 'utf-8');
  }

  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks).toString('utf-8');
  }

  throw new Error('Prompt required. Provide as argument, --file, or via stdin.');
}
