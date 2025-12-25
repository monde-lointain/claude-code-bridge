/**
 * Check if a buffer contains binary content.
 * Uses the presence of null bytes as the primary indicator.
 */
export function isBinaryFile(buffer: Buffer): boolean {
  // Check first 8KB for null bytes
  const sampleSize = Math.min(buffer.length, 8192);

  for (let i = 0; i < sampleSize; i++) {
    if (buffer[i] === 0) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a file extension is typically binary.
 */
export function isBinaryExtension(filename: string): boolean {
  const binaryExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib',
    '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv',
    '.ttf', '.otf', '.woff', '.woff2',
    '.pyc', '.class', '.o', '.obj',
  ]);

  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return binaryExtensions.has(ext);
}
