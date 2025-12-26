const HINT_PATTERNS: Array<[RegExp, string]> = [
  [/allowed_roots/i, "Add this path to 'allowed_roots' in your config."],
  [
    /ENOENT.*claude/i,
    'Claude Code CLI not found. Run: npm install -g @anthropic-ai/claude-code',
  ],
  [/ENOENT/i, 'File or directory not found. Check the path exists.'],
  [/ECONNREFUSED/i, 'Connection refused. Is the MCP server running?'],
  [/timeout/i, 'Operation timed out. Try increasing the timeout.'],
  [/permission denied/i, 'Permission denied. Check file permissions.'],
  [/rate.?limit/i, 'You have hit an API rate limit. Wait and try again.'],
];

export function generateHint(error: string): string | undefined {
  for (const [pattern, hint] of HINT_PATTERNS) {
    if (pattern.test(error)) {
      return hint;
    }
  }
  return undefined;
}
