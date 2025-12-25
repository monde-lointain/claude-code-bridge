/**
 * Strip ANSI escape codes from a string.
 * Handles colors, cursor movement, and other terminal sequences.
 */
export function stripAnsi(str: string): string {
  // Comprehensive ANSI escape code pattern
  const ansiPattern = [
    // Standard ANSI escape sequences
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    // SGR (Select Graphic Rendition) sequences
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
  ].join('|');

  const regex = new RegExp(ansiPattern, 'g');
  return str.replace(regex, '');
}

/**
 * Check if a string contains ANSI escape codes.
 */
export function hasAnsi(str: string): boolean {
  const ansiPattern = /[\u001B\u009B]/;
  return ansiPattern.test(str);
}
